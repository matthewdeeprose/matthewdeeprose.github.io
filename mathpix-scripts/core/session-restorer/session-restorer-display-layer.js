// ─── MathPixSessionRestorer Display Layer Mixin ──────────────────────────────
// Display layer, content loading, and preview.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-display-layer.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // PHASE 8G: DISPLAY LAYER
  // =========================================================================

  /**
   * Initialise the display layer for image reference collapsing.
   * Checks if auto-collapse should activate based on image reference lengths.
   * Creates the display layer instance if the MathPixMMDDisplayLayer class is available.
   *
   * @param {string} mmdContent - MMD content to analyse for auto-collapse
   * @private
   */
  proto.initialiseDisplayLayer = function (mmdContent) {
    // Check if the display layer class is available
    if (typeof window.MathPixMMDDisplayLayer === "undefined") {
      logDebug("Display layer class not available — skipping initialisation");
      return;
    }

    // Create instance if not already created
    if (!this.displayLayer) {
      this.displayLayer = new window.MathPixMMDDisplayLayer();
      logInfo("Display layer instance created");
    }

    // Check if auto-collapse should activate
    const shouldCollapse = this.displayLayer.shouldAutoCollapse(mmdContent);

    if (shouldCollapse) {
      this.isDisplayCollapsed = true;
      logInfo("Auto-collapse activated: image reference(s) exceed threshold");
    }

    // Show the toggle button if the document has images (even if not auto-collapsing)
    const hasImages = this.imageRegistry && this.imageRegistry.getCount() > 0;
    if (this.elements.collapseImagesBtn) {
      this.elements.collapseImagesBtn.hidden = !hasImages;

      // Update button state
      this.updateCollapseButtonState();
    }

    // Phase 8H.1: Manage images button — always visible once a session is loaded
    // (when zero images it becomes "Add image" so users can still add)
    if (this.elements.manageImagesBtn) {
      this.elements.manageImagesBtn.hidden = false;
    }
    this.updateManageImagesButtonState();
  };

  /**
   * Toggle image reference collapse on/off.
   * When toggling on: collapses all image references (regardless of length).
   * When toggling off: expands all placeholders back to full URLs.
   *
   * @private
   */
  proto.toggleImageCollapse = function () {
    if (!this.displayLayer) {
      logWarn("Cannot toggle collapse: display layer not initialised");
      return;
    }

    const workingMMD = this.getCurrentMMDContent();
    if (!workingMMD) {
      logWarn("Cannot toggle collapse: no MMD content");
      return;
    }

    if (this.isDisplayCollapsed) {
      // Turn OFF: show raw URLs in textarea
      this.isDisplayCollapsed = false;
      this.displayLayer.isCollapsed = false;

      // Restore working MMD to textarea
      if (this.elements.mmdEditorTextarea) {
        this.elements.mmdEditorTextarea.value = workingMMD;
      }
      if (this.elements.mmdCodeElement) {
        this.elements.mmdCodeElement.textContent = workingMMD;
        if (typeof Prism !== "undefined") {
          Prism.highlightElement(this.elements.mmdCodeElement);
        }
      }

      // Clear workingMMD since textarea now holds the real content
      if (this.restoredSession) {
        this.restoredSession.workingMMD = null;
      }

      this.showNotification("Showing raw image URLs", "info");
      logInfo("Image collapse turned OFF");
    } else {
      // Turn ON: collapse all image references
      this.isDisplayCollapsed = true;

      // Store working MMD before collapsing
      if (this.restoredSession) {
        this.restoredSession.workingMMD = workingMMD;
      }

      // Collapse all (force collapse regardless of URL length)
      const { displayMMD, collapsedCount } = this.displayLayer.collapseAll(
        workingMMD,
        this.imageRegistry,
      );

      // Update textarea with collapsed content
      if (this.elements.mmdEditorTextarea) {
        this.elements.mmdEditorTextarea.value = displayMMD;
      }
      if (this.elements.mmdCodeElement) {
        this.elements.mmdCodeElement.textContent = displayMMD;
        if (typeof Prism !== "undefined") {
          Prism.highlightElement(this.elements.mmdCodeElement);
        }
      }

      this.showNotification(
        `${collapsedCount} image reference(s) collapsed`,
        "info",
      );
      logInfo(`Image collapse turned ON: ${collapsedCount} collapsed`);
    }

    // Update button state
    this.updateCollapseButtonState();

    // Auto-resize textarea for the new content
    this.autoResizeTextarea();

    // Announce to screen readers
    this.announceToScreenReader(
      this.isDisplayCollapsed
        ? "Image references collapsed to placeholders"
        : "Image references expanded to show full URLs",
    );
  };

  /**
   * Update the collapse toggle button's visual state.
   * @private
   */
  proto.updateCollapseButtonState = function () {
    if (!this.elements.collapseImagesBtn) return;

    const isCollapsed = this.isDisplayCollapsed;

    this.elements.collapseImagesBtn.setAttribute(
      "aria-pressed",
      isCollapsed ? "true" : "false",
    );

    // Update icon via icon library
    const iconName = isCollapsed ? "code" : "eye";
    const label = isCollapsed ? "Show raw URLs" : "Show placeholders";
    const iconSpan =
      this.elements.collapseImagesBtn.querySelector("[data-icon]");

    if (iconSpan) {
      iconSpan.dataset.icon = iconName;
      // Re-populate via icon library
      if (window.IconLibrary) {
        const svg = window.IconLibrary.ICONS[iconName];
        if (svg) {
          iconSpan.innerHTML = svg.replace(
            "<svg",
            '<svg aria-hidden="true" class="icon"',
          );
        }
      }
    }

    // Update label text
    const btnLabel =
      this.elements.collapseImagesBtn.querySelector(".btn-label");
    if (btnLabel) {
      btnLabel.textContent = label;
    }

    // Update aria-label for icon-only mode
    this.elements.collapseImagesBtn.setAttribute("aria-label", label);
  };

  /**
   * Update the manage images toolbar button label based on image count.
   * When images exist: "Manage images". When empty: "Add image".
   * The button remains visible in both cases so users can always add images.
   * @private
   */
  proto.updateManageImagesButtonState = function () {
    const btn = this.elements.manageImagesBtn;
    if (!btn) return;

    const hasImages = this.imageRegistry && this.imageRegistry.getCount() > 0;
    const label = hasImages ? "Manage images" : "Add image";

    const labelSpan = btn.querySelector(".btn-label");
    if (labelSpan) {
      labelSpan.textContent = label;
    }
    btn.setAttribute("aria-label", label);
  };

  /**
   * Load MMD content into editor
   * @param {string} mmdContent - Content to display/edit
   * @param {string} originalMMD - Original for restore functionality
   * @private
   */
  proto.loadMMDContent = function (mmdContent, originalMMD) {
    logDebug("Loading MMD content", { length: mmdContent?.length });

    // Phase 8G: Determine what to show in textarea vs what to store as working MMD
    let contentForTextarea = mmdContent;
    let contentForPreview = mmdContent;

    if (this.isDisplayCollapsed && this.displayLayer) {
      // Store the working MMD (source of truth for all consumers)
      if (this.restoredSession) {
        this.restoredSession.workingMMD = mmdContent;
      }

      // Collapse ALL for textarea display (collapseAll ensures short blob URLs are collapsed too)
      const { displayMMD } = this.displayLayer.collapseAll(
        mmdContent,
        this.imageRegistry,
      );
      contentForTextarea = displayMMD;
      // Preview uses the full working MMD (renders images from real URLs)
      contentForPreview = mmdContent;

      logDebug("Display layer active: textarea shows collapsed content", {
        workingLength: mmdContent?.length,
        displayLength: displayMMD?.length,
      });
    }

    // Set code element content (uses display version for readability)
    if (this.elements.mmdCodeElement) {
      this.elements.mmdCodeElement.textContent = contentForTextarea || "";

      // Apply syntax highlighting if Prism is available
      if (typeof Prism !== "undefined") {
        Prism.highlightElement(this.elements.mmdCodeElement);
      }
    }

    // Set textarea content (display version with placeholders if active)
    if (this.elements.mmdEditorTextarea) {
      this.elements.mmdEditorTextarea.value = contentForTextarea || "";
    }

    // Ensure preview content is keyboard accessible (WCAG 2.1.1)
    if (this.elements.mmdPreviewContent) {
      // Make scrollable region focusable
      if (!this.elements.mmdPreviewContent.hasAttribute("tabindex")) {
        this.elements.mmdPreviewContent.setAttribute("tabindex", "0");
      }
      // Provide accessible name for screen readers
      if (!this.elements.mmdPreviewContent.hasAttribute("aria-label")) {
        this.elements.mmdPreviewContent.setAttribute(
          "aria-label",
          "MMD content preview - scrollable region",
        );
      }
    }

    // Enable editing mode and sync button state (Issue 3 fix)
    // When content is loaded, editing is enabled by default
    this.setEditMode(true);

    // Update preview (uses full working MMD so images render properly)
    this.updatePreview(contentForPreview);

    // Re-render line-based editor if confidence highlighting is enabled
    // This ensures edit status indicators are recalculated after version switches
    if (this.isConfidenceEnabled) {
      const isEditing =
        this.elements.mmdCodeContainer?.dataset.editing === "true";
      this.renderLineBasedConfidenceEditor(isEditing);
      logDebug("Re-rendered line editor after content load");
    }
  };

  /**
   * Update MMD preview
   * @param {string} content - MMD content
   * @private
   */
  proto.updatePreview = async function (content) {
    if (!this.elements.mmdPreviewContent) return;

    // Store content for potential recovery re-render
    this.pendingContent = content;

    // Check if CDN library is ready
    const cdnReady =
      typeof window.MathpixMarkdownModel !== "undefined" ||
      typeof window.markdownToHTML !== "undefined";

    // Use MathPix markdown-it renderer if available
    // First try the global getter, then fall back to controller's instance
    let mmdPreview = window.getMathPixMMDPreview?.();

    if (!mmdPreview) {
      // Try getting from controller
      const controller = window.getMathPixController?.();
      mmdPreview = controller?.getMMDPreview?.();
    }

    if (mmdPreview) {
      try {
        // Check if the library is ready before rendering
        const libraryReady = mmdPreview.isReady?.() || cdnReady;

        if (!libraryReady) {
          logWarn("CDN library not ready - triggering immediate recovery");
          this.pendingPreviewRender = true;

          // Show loading state in preview
          this.elements.mmdPreviewContent.innerHTML = `
            <div class="mmd-preview-loading" role="status">
              <p>Loading preview renderer...</p>
              <p class="mmd-preview-fallback-note">
                <small>Mathematical content will render when the library loads.</small>
              </p>
            </div>
          `;

          // Register for recovery
          if (window.mathJaxManager?.registerPendingElement) {
            window.mathJaxManager.registerPendingElement(
              this.elements.mmdPreviewContent,
              {
                source: "session-restorer",
                reason: "cdn-not-ready",
                contentLength: content.length,
              },
            );
          }

          // CRITICAL FIX: Trigger recovery immediately instead of waiting for monitors
          // The monitors may have already timed out if the user took time to upload
          logInfo(
            "Triggering immediate recovery render (monitors may have timed out)",
          );

          // Use setTimeout to allow the loading message to render first
          setTimeout(() => {
            this.handleRecoveryRerender();
          }, 100);

          return;
        }

        // render() takes content AND target element
        await mmdPreview.render(content, this.elements.mmdPreviewContent);

        // Clear pending state on success
        this.pendingPreviewRender = false;
        this.pendingContent = null;

        logDebug("MMD preview rendered successfully");
      } catch (error) {
        logWarn("Failed to render MMD preview:", error);

        // Mark for recovery
        this.pendingPreviewRender = true;

        // Fallback: try renderToString if render fails
        try {
          const html = mmdPreview.renderToString?.(content);
          if (html) {
            this.elements.mmdPreviewContent.innerHTML = html;
          } else {
            this.elements.mmdPreviewContent.textContent = content;
          }
        } catch (fallbackError) {
          this.elements.mmdPreviewContent.textContent = content;
        }

        // Register for recovery
        if (window.mathJaxManager?.registerPendingElement) {
          window.mathJaxManager.registerPendingElement(
            this.elements.mmdPreviewContent,
            {
              source: "session-restorer",
              reason: "render-failed",
              error: error.message,
            },
          );
        }
      }
    } else {
      // Fallback to plain text - mark for recovery
      this.pendingPreviewRender = true;
      this.elements.mmdPreviewContent.textContent = content;
      logDebug(
        "MMD preview module not available, using plain text - marked for recovery",
      );
    }
  };

  /**
   * Load source PDF into viewer
   * @param {Blob} pdfBlob - PDF blob
   * @private
   */
  proto.loadSourcePDF = async function (pdfBlob) {
    logDebug("Loading source PDF into viewer");

    try {
      // Create object URL
      const pdfUrl = URL.createObjectURL(pdfBlob);
      this.objectURLs.push(pdfUrl);

      // Store for comparison view
      this.restoredSession.pdfUrl = pdfUrl;

      // TODO: Integrate with PDF viewer when switching to Compare view
      logInfo("Source PDF loaded, URL stored for comparison view");
    } catch (error) {
      logError("Failed to load source PDF:", error);
    }
  };

  /**
   * Render PDF for comparison view
   * Uses PDF.js to render all pages into the PDF container
   * Reuses existing mmd-pdf-* classes for consistent styling
   * @private
   */
  proto.renderPDFForComparison = async function () {
    logDebug("Rendering PDF for comparison view");

    const pagesContainer = document.getElementById("resume-mmd-pdf-pages");
    if (!pagesContainer) {
      logWarn("PDF pages container not found");
      return;
    }

    // Check if we have a PDF to render
    if (!this.restoredSession?.source?.blob || !this.restoredSession?.isPDF) {
      pagesContainer.innerHTML = `
      <div class="mmd-pdf-error" role="alert">
<p class="mmd-error-icon">${getIcon("document")}</p>
        <p>No PDF available for comparison</p>
      </div>
    `;
      return;
    }

    // Show loading state (reuse existing loading element if present)
    const loadingEl = document.getElementById("resume-mmd-pdf-loading");
    if (loadingEl) {
      loadingEl.hidden = false;
    } else {
      pagesContainer.innerHTML = `
      <div class="mmd-pdf-loading" role="status" aria-live="polite">
        <div class="mmd-loading-spinner" aria-hidden="true"></div>
        <p>Loading PDF...</p>
      </div>
    `;
    }

    try {
      // Load PDF.js if not already loaded
      await this.ensurePDFJSLoaded();

      // Get PDF.js library
      const pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) {
        throw new Error("PDF.js library not available");
      }

      // Load the PDF document
      const arrayBuffer = await this.restoredSession.source.blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDocument = await loadingTask.promise;

      logInfo("PDF loaded for comparison", { numPages: pdfDocument.numPages });

      // Hide loading, clear container
      if (loadingEl) {
        loadingEl.hidden = true;
      }
      pagesContainer.innerHTML = "";

      // Update page total indicators if present
      const totalPagesEl = document.getElementById(
        "resume-mmd-pdf-total-pages",
      );
      const totalDisplayEl = document.getElementById(
        "resume-mmd-pdf-total-display",
      );
      if (totalPagesEl) totalPagesEl.textContent = pdfDocument.numPages;
      if (totalDisplayEl) totalDisplayEl.textContent = pdfDocument.numPages;

      // Update page input max
      const pageInput = document.getElementById("resume-mmd-pdf-page-input");
      if (pageInput) pageInput.max = pdfDocument.numPages;

      // Calculate scale based on container width
      const scrollContainer = document.getElementById(
        "resume-mmd-pdf-scroll-container",
      );
      const containerWidth = scrollContainer?.clientWidth || 600;
      const devicePixelRatio = window.devicePixelRatio || 1;

      // Render each page
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);

        // Calculate scale to fit container width (with some padding)
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = (containerWidth - 40) / unscaledViewport.width;
        const viewport = page.getViewport({ scale: scale * devicePixelRatio });

        // Create page wrapper using existing class
        const pageWrapper = document.createElement("div");
        pageWrapper.className = "mmd-pdf-page";
        pageWrapper.setAttribute("data-page", pageNum);
        pageWrapper.setAttribute(
          "aria-label",
          `Page ${pageNum} of ${pdfDocument.numPages}`,
        );

        // Create canvas using existing class
        const canvas = document.createElement("canvas");
        canvas.className = "mmd-pdf-canvas";
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / devicePixelRatio}px`;

        pageWrapper.appendChild(canvas);
        pagesContainer.appendChild(pageWrapper);

        // Render page to canvas
        const renderContext = {
          canvasContext: canvas.getContext("2d"),
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        logDebug(`Rendered page ${pageNum}/${pdfDocument.numPages}`);
      }

      // Store document reference for navigation
      this.pdfDocument = pdfDocument;
      this.pdfRenderedForComparison = true;

      logInfo("PDF comparison rendering complete", {
        totalPages: pdfDocument.numPages,
      });
    } catch (error) {
      logError("Failed to render PDF for comparison:", error);

      if (loadingEl) {
        loadingEl.hidden = true;
      }

      // Show error using existing error classes
      pagesContainer.innerHTML = `
      <div class="mmd-pdf-error" role="alert">
<p class="mmd-error-icon">${getIcon("warning")}</p>
        <p id="resume-mmd-pdf-error-message">Failed to load PDF: ${this.escapeHtml(
          error.message,
        )}</p>
      </div>
    `;
    }
  };

  /**
   * Ensure PDF.js library is loaded
   * @private
   */
  proto.ensurePDFJSLoaded = async function () {
    // Check if already loaded
    if (window.pdfjsLib) {
      logDebug("PDF.js already available");
      return;
    }

    logInfo("Loading PDF.js library from CDN");

    // PDF.js CDN URLs (same versions as pdf-visualiser-config.js)
    const PDFJS_VERSION = "3.11.174";
    const LIB_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    const WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

    // Load the main library
    await this.loadScript(LIB_URL);

    // Verify it loaded
    if (!window.pdfjsLib) {
      throw new Error("PDF.js library not available after script load");
    }

    // Configure worker
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;

    logInfo("PDF.js loaded successfully", { version: PDFJS_VERSION });
  };

  /**
   * Load a script from URL
   * @param {string} url - Script URL
   * @returns {Promise<void>}
   * @private
   */
  proto.loadScript = function (url) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        logDebug("Script already loaded:", url);
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = url;
      script.async = true;

      const timeout = setTimeout(() => {
        reject(new Error(`Script load timeout: ${url}`));
      }, 15000);

      script.onload = () => {
        clearTimeout(timeout);
        logDebug("Script loaded:", url);
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load script: ${url}`));
      };

      document.head.appendChild(script);
    });
  };

  /**
   * Load lines data into confidence visualiser
   * @param {Object} linesData - Lines data from ZIP
   * @param {Blob} pdfBlob - Source PDF blob
   * @private
   */
  proto.loadConfidenceVisualiser = async function (linesData, pdfBlob) {
    logDebug("Loading confidence visualiser data");

    try {
      // Check if visualiser class is available
      if (typeof window.PDFConfidenceVisualiser === "undefined") {
        logWarn(
          "PDFConfidenceVisualiser class not available - ensure pdf-visualiser-core.js is loaded",
        );
        return;
      }

      // Store reference for lazy loading when Confidence tab is clicked
      this.restoredSession.confidenceData = {
        linesData,
        pdfBlob,
        loaded: false,
      };

      logInfo("Confidence data stored for lazy loading on tab activation");
    } catch (error) {
      logError("Failed to prepare confidence visualiser:", error);
    }
  };

  // =========================================================================
  // PERSISTENCE SESSION
  // =========================================================================

  /**
   * Start new persistence session for restored content
   * Stores complete session data for recovery after browser close
   * @param {string} sourceFilename - Original source filename
   * @private
   */
  proto.startPersistenceSession = function (sourceFilename) {
    logDebug("Starting persistence session");

    // Generate sanitised session key
    const sanitised = this.sanitiseFilename(sourceFilename);
    const timestamp = Date.now();
    const sessionKey = `${RESTORER_CONFIG.SESSION_KEY_PREFIX}${sanitised}-${timestamp}`;

    // Build the full localStorage key (used consistently everywhere)
    const storageKey = `mathpix-resume-session-${sessionKey}`;

    // Store complete session info in localStorage
    try {
      const sessionData = {
        // Session identification
        key: sessionKey,
        storageKey: storageKey,

        // Source file info (use consistent property name: sourceFileName with capital N)
        sourceFileName: sourceFilename,

        // Content for recovery — all stored with CDN URLs (blob URLs are ephemeral)
        // Phase 8H.3: current uses getMMDForStorage (compact placeholders for user-added images)
        original: this.getMMDForAPI(
          this.restoredSession?.baselineMMD ||
            this.restoredSession?.originalMMD ||
            "",
        ),
        baseline: this.getMMDForAPI(
          this.restoredSession?.baselineMMD ||
            this.restoredSession?.currentMMD ||
            "",
        ),
        current: this.getMMDForStorage(
          this.restoredSession?.currentMMD ||
            this.restoredSession?.originalMMD ||
            "",
        ),

        // Edit history
        undoStack: [],
        redoStack: [],

        // AI enhancement metadata (if applied)
        // Enables: AI sparkle icon in session loader, special ZIP filename
        aiEnhanced: this.restoredSession?.aiEnhanced || null,

        // Phase H.2: Page range tracking for partial PDF processing
        pageRange: this.restoredSession?.pageRange || "all",
        totalPdfPages: this.restoredSession?.totalPdfPages || null,
        pagesProcessed: this.restoredSession?.pagesProcessed || null,

        // Timestamps
        restoredAt: new Date().toISOString(),
        lastModified: timestamp,
      };

      localStorage.setItem(storageKey, JSON.stringify(sessionData));

      // Store both keys for reference
      this.restoredSession.sessionKey = sessionKey;
      this.restoredSession.storageKey = storageKey;

      logInfo("Persistence session started:", storageKey);
    } catch (error) {
      logWarn("Failed to start persistence session:", error);
    }
  };

  /**
   * Sanitise filename for use in session key
   * @param {string} filename - Original filename
   * @returns {string} Sanitised filename
   * @private
   */
  proto.sanitiseFilename = function (filename) {
    if (!filename) return "unknown";

    return filename
      .replace(/\.[^/.]+$/, "") // Remove extension
      .replace(/[^a-zA-Z0-9]/g, "-") // Replace non-alphanumeric with dash
      .replace(/-+/g, "-") // Collapse multiple dashes
      .replace(/^-|-$/g, "") // Remove leading/trailing dashes
      .substring(0, 50) // Limit length
      .toLowerCase();
  };

  console.log("[SessionRestorer] Display layer mixin loaded");
})();
