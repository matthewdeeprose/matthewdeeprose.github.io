// ─── MathPixSessionRestorer PDF Mixin ────────────────────────────────────────
// PDF rendering, navigation, zoom, and view/tab switching.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-pdf.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // MMD VIEW SWITCHING
  // =========================================================================

  /**
   * Switch MMD view mode
   * @param {string} view - View to switch to ('code', 'preview', 'split', 'pdf_split')
   * @private
   */
  proto.switchMmdView = function (view) {
    logDebug("Switching MMD view to:", view);

    // Update button states
    const viewButtons = [
      { el: this.elements.mmdViewCodeBtn, view: "code" },
      { el: this.elements.mmdViewPreviewBtn, view: "preview" },
      { el: this.elements.mmdViewSplitBtn, view: "split" },
      { el: this.elements.mmdViewPdfSplitBtn, view: "pdf_split" },
    ];

    viewButtons.forEach(({ el, view: btnView }) => {
      if (el) {
        const isActive = btnView === view;
        el.classList.toggle("active", isActive);
        el.setAttribute("aria-pressed", isActive.toString());
      }
    });

    // Update containers
    if (this.elements.mmdContentArea) {
      this.elements.mmdContentArea.dataset.currentView = view;
    }

    // Show/hide containers based on view
    const isCode = view === "code";
    const isPreview = view === "preview";
    const isSplit = view === "split";
    const isPdfSplit = view === "pdf_split";

    if (this.elements.mmdCodeContainer) {
      this.elements.mmdCodeContainer.classList.toggle(
        "active",
        isCode || isSplit || isPdfSplit,
      );
      this.elements.mmdCodeContainer.hidden =
        !isCode && !isSplit && !isPdfSplit;
    }

    if (this.elements.mmdPreviewContainer) {
      this.elements.mmdPreviewContainer.classList.toggle(
        "active",
        isPreview || isSplit,
      );
      this.elements.mmdPreviewContainer.hidden = !isPreview && !isSplit;
    }

    if (this.elements.mmdPdfContainer) {
      // Check if "Show PDF" is checked for split view
      const showPdfInSplit = isSplit && this.elements.splitPdfCheckbox?.checked;
      const shouldShowPdf = isPdfSplit || showPdfInSplit;

      this.elements.mmdPdfContainer.classList.toggle("active", shouldShowPdf);
      this.elements.mmdPdfContainer.hidden = !shouldShowPdf;

      // Update data attribute for CSS styling (used by split view 3-column layout)
      if (this.elements.mmdContentArea) {
        this.elements.mmdContentArea.dataset.showPdf =
          showPdfInSplit.toString();
      }

      // Render PDF when showing it (Compare view or Split with Show PDF)
      if (shouldShowPdf && !this.pdfRenderedForComparison) {
        this.renderPDFForComparison();
      }
    }

    if (this.elements.mmdViewDivider) {
      this.elements.mmdViewDivider.hidden = !isSplit && !isPdfSplit;
    }

    // Update status
    const statusText = {
      code: "Viewing code",
      preview: "Viewing preview",
      split: "Split view",
      pdf_split: "Comparing with PDF",
    };

    if (this.elements.mmdViewStatus) {
      this.elements.mmdViewStatus.textContent = statusText[view] || "Viewing";
    }

    // Show/hide Split PDF toggle based on view mode
    if (this.elements.splitPdfToggle) {
      // Only show in split view when PDF source is available
      const showToggle = isSplit && this.restoredSession?.isPDF;
      this.elements.splitPdfToggle.hidden = !showToggle;
    }

    // Hide the toggle in Compare mode (always shows PDF)
    if (isPdfSplit && this.elements.splitPdfToggle) {
      this.elements.splitPdfToggle.hidden = true;
    }

    // Update Resume file controls visibility (show in Code/Split views only)
    if (typeof updateResumeFileControlsVisibility === "function") {
      updateResumeFileControlsVisibility();
    }
  };

  // =========================================================================
  // ACCESSIBILITY / KEYBOARD NAVIGATION
  // =========================================================================

  /**
   * Handle skip link for resume MMD preview
   * Dynamically determines skip target based on current view mode
   * WCAG 2.4.1: Bypass Blocks
   * @param {Event} event - Click event
   */
  proto.handlePreviewSkip = function (event) {
    event.preventDefault();

    // Determine current view mode
    const currentView =
      this.elements.mmdContentArea?.dataset.currentView || "preview";

    // Check if PDF is visible in split mode
    const pdfVisible =
      this.elements.splitPdfCheckbox?.checked && currentView === "split";

    let targetElement = null;

    // Priority order for skip targets:
    // 1. PDF container (if visible in compare or split+PDF mode)
    // 2. Download section or actions after content
    // 3. New session button
    // 4. Generic skip target

    if (currentView === "pdf_split" || pdfVisible) {
      // In compare mode or split with PDF - skip to PDF container
      targetElement = this.elements.mmdPdfContainer;
    }

    if (!targetElement || targetElement.hidden) {
      // Try the download section or actions after content
      targetElement =
        document.getElementById("resume-download-section") ||
        this.elements.newSessionBtn;
    }

    if (!targetElement) {
      // Fallback to generic skip target
      targetElement = document.getElementById("resume-mmd-preview-skip-target");
    }

    if (targetElement) {
      // Ensure element can receive focus
      if (!targetElement.hasAttribute("tabindex")) {
        targetElement.setAttribute("tabindex", "-1");
      }
      targetElement.focus();

      // Announce to screen readers
      this.announceToScreenReader("Skipped preview content");

      logDebug("Preview skip: focused on", targetElement.id || targetElement);
    }
  };

  // =========================================================================
  // PDF NAVIGATION AND ZOOM
  // =========================================================================

  /**
   * Navigate to a specific page in the PDF
   * @param {number} pageNum - Page number to navigate to
   * @private
   */
  proto.goToPage = function (pageNum) {
    if (!this.pdfDocument) {
      logWarn("No PDF document loaded for navigation");
      return;
    }

    const totalPages = this.pdfDocument.numPages;

    // Validate page number
    if (isNaN(pageNum) || pageNum < 1) {
      pageNum = 1;
    } else if (pageNum > totalPages) {
      pageNum = totalPages;
    }

    // Update input value
    if (this.elements.pdfPageInput) {
      this.elements.pdfPageInput.value = pageNum;
    }

    // Find and scroll to the page
    const pageElement = this.elements.pdfPagesContainer?.querySelector(
      `[data-page="${pageNum}"]`,
    );

    if (pageElement && this.elements.pdfScrollContainer) {
      pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
      logDebug("Navigated to page", { pageNum });
    }
  };

  /**
   * Zoom PDF by a delta amount
   * @param {number} delta - Amount to change zoom by (e.g., 0.1 for +10%)
   * @private
   */
  proto.zoomPDF = function (delta) {
    if (!this.pdfDocument) {
      logWarn("No PDF document loaded for zoom");
      return;
    }

    // Get current scale or default to 1
    this.currentPdfScale = this.currentPdfScale || 1;

    // Calculate new scale with limits
    const newScale = Math.max(0.25, Math.min(3, this.currentPdfScale + delta));

    if (newScale === this.currentPdfScale) {
      return; // No change needed
    }

    this.currentPdfScale = newScale;
    this.rerenderPDFAtScale(newScale);

    // Update zoom level display
    if (this.elements.pdfZoomLevel) {
      this.elements.pdfZoomLevel.textContent = `${Math.round(newScale * 100)}%`;
    }

    logDebug("PDF zoomed", { scale: newScale });
  };

  /**
   * Fit PDF to container width
   * @private
   */
  proto.fitPDFToWidth = function () {
    if (!this.pdfDocument) {
      logWarn("No PDF document loaded for fit-to-width");
      return;
    }

    // Calculate scale to fit container width
    const containerWidth = this.elements.pdfScrollContainer?.clientWidth || 600;

    // Get first page to determine natural width
    this.pdfDocument
      .getPage(1)
      .then((page) => {
        const unscaledViewport = page.getViewport({ scale: 1 });
        const fitScale = (containerWidth - 40) / unscaledViewport.width;

        this.currentPdfScale = fitScale;
        this.rerenderPDFAtScale(fitScale);

        // Update zoom level display
        if (this.elements.pdfZoomLevel) {
          this.elements.pdfZoomLevel.textContent = `${Math.round(
            fitScale * 100,
          )}%`;
        }

        logDebug("PDF fit to width", { scale: fitScale });
      })
      .catch((error) => {
        logError("Failed to fit PDF to width:", error);
      });
  };

  /**
   * Re-render PDF at a specific scale
   * @param {number} scale - Scale factor
   * @private
   */
  proto.rerenderPDFAtScale = async function (scale) {
    if (!this.pdfDocument || !this.elements.pdfPagesContainer) {
      return;
    }

    const pagesContainer = this.elements.pdfPagesContainer;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const totalPages = this.pdfDocument.numPages;

    // Store current scroll position
    const scrollTop = this.elements.pdfScrollContainer?.scrollTop || 0;
    const scrollHeight = this.elements.pdfScrollContainer?.scrollHeight || 1;
    const scrollRatio = scrollTop / scrollHeight;

    // Re-render each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageWrapper = pagesContainer.querySelector(
        `[data-page="${pageNum}"]`,
      );
      const canvas = pageWrapper?.querySelector("canvas");

      if (!canvas) continue;

      try {
        const page = await this.pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale * devicePixelRatio });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / devicePixelRatio}px`;

        const renderContext = {
          canvasContext: canvas.getContext("2d"),
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (error) {
        logError(`Failed to re-render page ${pageNum}:`, error);
      }
    }

    // Restore approximate scroll position
    if (this.elements.pdfScrollContainer) {
      const newScrollHeight = this.elements.pdfScrollContainer.scrollHeight;
      this.elements.pdfScrollContainer.scrollTop =
        scrollRatio * newScrollHeight;
    }

    logDebug("PDF re-rendered at scale", { scale, totalPages });
  };

  /**
   * Toggle PDF visibility in split view (3-column mode)
   * @param {boolean} show - Whether to show PDF column
   * @since 8.2.1
   */
  proto.toggleSplitPDF = function (show) {
    logDebug("Toggling split PDF visibility:", { show });

    const { mmdContentArea } = this.elements;

    if (!mmdContentArea) {
      logWarn("Content area not found for PDF toggle");
      return;
    }

    // Update data attribute for CSS styling
    mmdContentArea.dataset.showPdf = show.toString();

    // If showing PDF and not already rendered, render it
    if (show && !this.pdfRenderedForComparison) {
      this.renderPDFForComparison();
    }

    // Show/hide PDF container
    if (this.elements.mmdPdfContainer) {
      this.elements.mmdPdfContainer.hidden = !show;
      if (show) {
        this.elements.mmdPdfContainer.classList.add("active");
      } else {
        this.elements.mmdPdfContainer.classList.remove("active");
      }
    }

    // Announce to screen readers
    const announcement = show
      ? "PDF column now visible in split view"
      : "PDF column hidden from split view";
    this.announceToScreenReader(announcement);

    logInfo("Split view PDF toggled", { show });
  };

  // NOTE: announceToScreenReader is defined in session-restorer-editor.js
  // (the runtime winner from the original monolith). Removed from here to
  // eliminate dead code.

  // Phase 8A-8 D-1: runtime invariant check. Flips violations into logError
  // so state drift is visible at the point of introduction. Set to false
  // to disable per-switch cost in production if needed.
  const ASSERT_TAB_INVARIANTS = true;

  /**
   * Check that the resume panel's tab state is internally consistent.
   *
   * Invariants:
   *   1. Button `.active` class matches `aria-selected === "true"`.
   *   2. Exactly one button is `.active`.
   *   3. A button with `.active` has its paired panel `.active` and visible.
   *   4. A panel with `.active` has its paired button `.active`.
   *
   * @param {HTMLElement} container - The resume container to audit.
   * @param {string} context - Label describing where this was called from
   *   (e.g. "switchTab:end") so the log can be traced.
   * @returns {Array<Object>|null} Array of violation objects, or null if all
   *   invariants hold.
   */
  function assertResumeTabStateConsistent(container, context) {
    if (!ASSERT_TAB_INVARIANTS) return null;
    if (!container) return null;
    const violations = [];
    const buttons = Array.from(
      container.querySelectorAll(".mathpix-tab-header"),
    );
    let activeCount = 0;
    for (const btn of buttons) {
      const hasActive = btn.classList.contains("active");
      const ariaSelected = btn.getAttribute("aria-selected") === "true";
      if (hasActive !== ariaSelected) {
        violations.push({
          kind: "button.class-vs-aria",
          id: btn.id,
          hasActiveClass: hasActive,
          ariaSelected,
        });
      }
      if (hasActive) activeCount += 1;
      const panelId = btn.getAttribute("aria-controls");
      const panel = panelId ? document.getElementById(panelId) : null;
      if (panel) {
        const panelActive = panel.classList.contains("active");
        const panelHidden = panel.hidden;
        if (hasActive && (!panelActive || panelHidden)) {
          violations.push({
            kind: "button-active-but-panel-hidden",
            buttonId: btn.id,
            panelId,
            panelActive,
            panelHidden,
          });
        }
        if (!hasActive && panelActive) {
          violations.push({
            kind: "panel-active-but-button-inactive",
            buttonId: btn.id,
            panelId,
          });
        }
      }
    }
    if (activeCount !== 1) {
      violations.push({ kind: "active-count", activeCount });
    }
    if (violations.length > 0) {
      logError(
        `Phase 8A-8: resume tab state invariant violated (${context})`,
        { violations, buttonCount: buttons.length },
      );
    }
    return violations.length > 0 ? violations : null;
  }

  // Phase 8A-8 D-4: expose the audit helper on window so any developer
  // (or automated test harness) can check current state in one call.
  // See CLAUDE.md → "Debug commands → MathPix".
  window.auditResumeTabState = function () {
    const container = document.getElementById("mathpix-resume-mode-container");
    if (!container) return { error: "resume container not found" };
    return (
      assertResumeTabStateConsistent(container, "manual-audit") || null
    );
  };

  /**
   * Switch between tabs in the resume panel.
   *
   * WARNING — two independent tab-switching systems exist in this codebase:
   *
   *   1. This one (session-restorer-pdf.js `switchTab`) manages resume-mode
   *      panels using `.active` on buttons AND panels, plus `aria-selected`
   *      via direct setAttribute, plus `panel.hidden`.
   *
   *   2. The canonical upload-mode system is
   *      ui/components/mathpix-result-renderer.js `showFormat`, which uses
   *      `.selected` on buttons (not `.active`) and `.active` on panels via
   *      its own cached `formatPanels` map, matching by `tab.dataset.format`.
   *
   * If you add a new resume tab or a new mode, you MUST update BOTH systems,
   * OR document in a comment why only one is affected. Cross-system state
   * leaks were the root cause of the 8A-8 regression where resume tab
   * buttons kept stale `.active` classes after upload-mode tab switching.
   * See mathpix-scripts/docs/chemistry-phase8-masterplan.md § 8A-8.
   *
   * This duplication is a candidate for consolidation in a future phase
   * (8F or 9). Do NOT introduce more duplicate conventions.
   *
   * @param {string} tab - Tab to switch to ('mmd', 'confidence', 'analysis', 'chemistry')
   * @private
   */
  proto.switchTab = function (tab) {
    logDebug("Switching tab to:", tab);

    // Phase 8A-8 Stage 2b: defensive reset. Clears any stale state inherited
    // from a previous mode (e.g. upload → resume without refresh used to
    // leave `.active` on resume tab buttons with `aria-selected="false"`,
    // or panel `.active` stripped while button class was still `.active`).
    // Must happen before the per-tab loop so the function is idempotent
    // regardless of prior DOM state. Scoped to the resume container so it
    // never touches upload-mode tabs.
    const resumeContainer = document.getElementById(
      "mathpix-resume-mode-container",
    );
    if (resumeContainer) {
      for (const btn of resumeContainer.querySelectorAll(
        ".mathpix-tab-header",
      )) {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
        btn.setAttribute("tabindex", "-1");
      }
      for (const panel of resumeContainer.querySelectorAll(
        ".mathpix-tab-panel",
      )) {
        panel.classList.remove("active");
        panel.hidden = true;
      }
    }

    // Tab/panel mapping. Fall back to a live getElementById lookup when a
    // cached reference is missing — cacheElements() runs once at init and
    // newer panels (analysis, chemistry) can be absent if init raced with
    // DOM mutation, which silently broke panel visibility toggling.
    const liveEl = (cached, id) => cached || document.getElementById(id);
    const tabs = {
      mmd: {
        tab: liveEl(this.elements.tabMmd, "resume-tab-mmd"),
        panel: liveEl(this.elements.panelMmd, "resume-panel-mmd"),
      },
      confidence: {
        tab: liveEl(this.elements.tabConfidence, "resume-tab-confidence"),
        panel: liveEl(this.elements.panelConfidence, "resume-panel-confidence"),
      },
      analysis: {
        tab: liveEl(this.elements.tabAnalysis, "resume-tab-analysis"),
        panel: liveEl(this.elements.panelAnalysis, "resume-panel-analysis"),
      },
      chemistry: {
        tab: liveEl(this.elements.tabChemistry, "resume-tab-chemistry"),
        panel: liveEl(this.elements.panelChemistry, "resume-panel-chemistry"),
      },
    };

    // Update the target tab's buttons and panels. The defensive reset above
    // has already cleared all of them, so we only need to set the winner.
    const target = tabs[tab];
    if (target) {
      if (target.tab) {
        target.tab.classList.add("active");
        target.tab.setAttribute("aria-selected", "true");
        target.tab.setAttribute("tabindex", "0");
      }
      if (target.panel) {
        target.panel.classList.add("active");
        target.panel.hidden = false;
      } else {
        logWarn("switchTab: panel element missing", { tab });
      }
    } else {
      logWarn("switchTab: unknown tab key", { tab });
    }

    // Remember the last-viewed tab so Phase 8A-8 Stage 3's
    // switchToResumeMode() can restore it on mode re-entry instead of
    // silently defaulting to whatever happened to be active.
    this._lastResumeTab = tab;

    // Lazy load confidence visualiser when first shown
    if (
      tab === "confidence" &&
      this.restoredSession?.confidenceData &&
      !this.restoredSession.confidenceData.loaded
    ) {
      this.lazyLoadConfidenceVisualiser();
    }

    // Lazy load document analysis when first shown (Phase 7.5F)
    if (tab === "analysis") {
      this.lazyLoadDocumentAnalysis();
    }

    // Phase 8A-8 D-1: verify no invariant drift at the end of the switch.
    assertResumeTabStateConsistent(resumeContainer, "switchTab:end");
  };

  /**
   * Lazy load document analysis on first tab switch (Phase 7.5F)
   * Delegates to the AI Enhancer's populateDocumentAnalysisTab() method
   * @private
   */
  proto.lazyLoadDocumentAnalysis = function () {
    logDebug("Loading document analysis tab");

    const enhancer = window.getMathPixAIEnhancer?.();
    if (!enhancer) {
      logWarn("AI Enhancer not available for document analysis");
      return;
    }

    enhancer.populateDocumentAnalysisTab();
  };

  /**
   * Lazy load confidence visualiser on first tab switch
   * @private
   */
  proto.lazyLoadConfidenceVisualiser = async function () {
    logDebug("Lazy loading confidence visualiser");

    const data = this.restoredSession?.confidenceData;
    if (!data || !this.elements.confidenceContainer) {
      logWarn("Cannot load confidence visualiser - missing data or container");
      return;
    }

    try {
      // Check if PDFConfidenceVisualiser class is available
      if (typeof window.PDFConfidenceVisualiser === "undefined") {
        logWarn("PDFConfidenceVisualiser not loaded");
        this.elements.confidenceContainer.innerHTML = `
        <p class="resume-instructions" style="padding: 2rem; text-align: center;">
          ${getIcon("warning")} 
          Confidence visualiser module not available. 
          Please ensure the PDF visualiser scripts are loaded.
        </p>
      `;
        return;
      }

      // Create object URL for PDF
      const pdfUrl = URL.createObjectURL(data.pdfBlob);
      this.objectURLs.push(pdfUrl);

      // Create visualiser instance with container
      const visualiser = new window.PDFConfidenceVisualiser({
        container: this.elements.confidenceContainer,
        enableAccessibility: true,
      });

      // Initialize and load
      await visualiser.initialize();
      await visualiser.loadPDF(pdfUrl, data.linesData);

      // Store reference for cleanup
      this.restoredSession.visualiserInstance = visualiser;
      data.loaded = true;

      logInfo("Confidence visualiser loaded successfully");
    } catch (error) {
      logError("Failed to load confidence visualiser:", error);
      this.elements.confidenceContainer.innerHTML = `
      <p class="resume-instructions" style="padding: 2rem; text-align: center;">
        ${getIcon("error")} 
        Failed to load confidence visualiser: ${this.escapeHtml(error.message)}
      </p>
    `;
    }
  };

  console.log("[SessionRestorer] PDF mixin loaded");
})();
