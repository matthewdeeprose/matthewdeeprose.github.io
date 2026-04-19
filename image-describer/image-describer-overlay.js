/**
 * Image Describer Overlay System — Core
 * Container lifecycle, rendering, layer toggling, toolbar, fullscreen layout.
 * Review mode methods are in image-describer-overlay-review.js (loaded after).
 *
 * Phase 5D-1: OCR boxes, toolbar state, toggletip integration.
 * Phase 5D-4: Colour grid overlay + classification badge.
 * Phase 7B: Expand/sidebar toggle.
 *
 * @version 2.0.0
 */
(function () {
  "use strict";

  // ── Logging ──────────────────────────────────────────────────────────
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
      console.error("[Overlay]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[Overlay]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[Overlay]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[Overlay]", message, ...args);
  }

  // ── HTML escaping ────────────────────────────────────────────────────
  const esc =
    window.escapeHtml ||
    function (text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    };

  // ── Confidence helpers ───────────────────────────────────────────────

  /**
   * Map numeric confidence (0–1) to a level string.
   * @param {number} confidence
   * @returns {'high'|'medium'|'low'}
   */
  function getConfidenceLevel(confidence) {
    if (confidence >= 0.7) return "high";
    if (confidence >= 0.4) return "medium";
    return "low";
  }

  /**
   * Map confidence level to toggletip type.
   * @param {string} level - 'high' | 'medium' | 'low'
   * @returns {string}
   */
  function confidenceToToggletipType(level) {
    if (level === "high") return "success";
    if (level === "medium") return "warning";
    return "error";
  }

  // ── Coordinate helpers ───────────────────────────────────────────────

  /**
   * Convert normalised 0–1 bounds to CSS percentage strings.
   * @param {{ x: number, y: number, w: number, h: number }} bounds
   * @returns {{ left: string, top: string, width: string, height: string }}
   */
  function boundsToCSS(bounds, pad) {
    pad = pad || 0;
    const x = Number(bounds.x) || 0;
    const y = Number(bounds.y) || 0;
    const w = Number(bounds.w) || 0;
    const h = Number(bounds.h) || 0;
    return {
      left: ((x - pad) * 100).toFixed(2) + "%",
      top: ((y - pad) * 100).toFixed(2) + "%",
      width: ((w + pad * 2) * 100).toFixed(2) + "%",
      height: ((h + pad * 2) * 100).toFixed(2) + "%",
    };
  }

  /**
   * Convert Florence-2 pixel bounds { x1, y1, x2, y2 } to normalised
   * { x, y, w, h } (0–1) using the image's natural dimensions.
   * Returns the same shape that boundsToCSS() expects.
   * @param {{ x1: number, y1: number, x2: number, y2: number }} pixelBounds
   * @param {number} naturalWidth  - img.naturalWidth
   * @param {number} naturalHeight - img.naturalHeight
   * @returns {{ x: number, y: number, w: number, h: number }}
   */
  function pixelBoundsToNormalised(pixelBounds, naturalWidth, naturalHeight) {
    if (!naturalWidth || !naturalHeight) return { x: 0, y: 0, w: 0, h: 0 };
    const x1 = Number(pixelBounds.x1) || 0;
    const y1 = Number(pixelBounds.y1) || 0;
    const x2 = Number(pixelBounds.x2) || 0;
    const y2 = Number(pixelBounds.y2) || 0;
    return {
      x: x1 / naturalWidth,
      y: y1 / naturalHeight,
      w: (x2 - x1) / naturalWidth,
      h: (y2 - y1) / naturalHeight,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // Module
  // ════════════════════════════════════════════════════════════════════

  window.ImageDescriberOverlay = {
    // ── State ────────────────────────────────────────────────────────
    _container: null,
    _layers: {},
    _visible: new Set(),
    _analysisRef: null,
    _userEdits: null, // Phase 5D-2: OCR corrections per-image
    _toggletipIds: [], // Track created toggletips for cleanup
    _sortedItems: [], // Phase 5D-2: items in visual reading order
    _inReviewMode: false, // Phase 5D-2: review mode active
    _selectedIndex: null, // Phase 5D-2: currently selected sorted-item index
    _selectedAdditionIndex: null, // Phase 5D-3: currently selected addition index
    _reviewKeyHandler: null, // Phase 5D-2: bound keydown handler reference
    _reviewClickHandler: null, // Phase 5D-2: bound click handler reference

    // Phase 5D-3: Add new items — draw mode state
    _inDrawMode: false,
    _drawStart: null,
    _rubberBand: null,
    _pendingDrawBounds: null,
    _drawMouseDownHandler: null,
    _drawMouseMoveHandler: null,
    _drawMouseUpHandler: null,

    // ══════════════════════════════════════════════════════════════════
    // Setup
    // ══════════════════════════════════════════════════════════════════

    /**
     * Wrap the preview image in an overlay container.
     * Safe to call multiple times — cleans up previous container first.
     * @param {HTMLElement} previewElement - The #imgdesc-preview element
     */
    init(previewElement) {
      if (!previewElement) {
        logWarn("init() called without a preview element");
        return;
      }

      const img = previewElement.querySelector("img");
      if (!img) {
        logDebug("No <img> inside preview element — skipping overlay init");
        return;
      }

      // If we already have a container wrapping this image, reuse it
      if (this._container && this._container.contains(img)) {
        logDebug("Overlay container already wrapping this image — reusing");
        // Re-render if we have analysis data
        if (this._analysisRef) {
          this._renderFromAnalysis();
        }
        return;
      }

      // Clean up any previous container
      if (this._container) {
        this.destroy();
      }

      // Create wrapper container
      const container = document.createElement("div");
      container.className = "imgdesc-overlay-container";

      // Insert container where the img currently is
      img.parentNode.insertBefore(container, img);
      container.appendChild(img);

      // Create depth layer (Phase 11B) — inserted first so it renders
      // beneath OCR, colour, and objects layers in the stacking order
      const depthLayer = document.createElement("div");
      depthLayer.className = "imgdesc-overlay-layer imgdesc-overlay-depth";
      depthLayer.setAttribute("data-layer", "depth");
      depthLayer.setAttribute("aria-hidden", "true"); // Canvas is decorative; legend provides accessible data
      depthLayer.hidden = true;
      container.appendChild(depthLayer);

      // Create OCR layer
      const ocrLayer = document.createElement("div");
      ocrLayer.className = "imgdesc-overlay-layer imgdesc-overlay-ocr";
      ocrLayer.setAttribute("data-layer", "ocr");
      ocrLayer.setAttribute("role", "group");
      ocrLayer.setAttribute("aria-label", "OCR bounding boxes");
      ocrLayer.hidden = true;
      container.appendChild(ocrLayer);

      // Create colour layer (Phase 5D-4)
      const colourLayer = document.createElement("div");
      colourLayer.className = "imgdesc-overlay-layer imgdesc-overlay-colour";
      colourLayer.setAttribute("data-layer", "colour");
      colourLayer.setAttribute("role", "group");
      colourLayer.setAttribute("aria-label", "Colour sampling regions");
      colourLayer.hidden = true;
      container.appendChild(colourLayer);

      // Create objects layer (Phase 10C: Florence-2 object detection)
      const objectsLayer = document.createElement("div");
      objectsLayer.className = "imgdesc-overlay-layer imgdesc-overlay-objects";
      objectsLayer.setAttribute("data-layer", "objects");
      objectsLayer.setAttribute("role", "group");
      objectsLayer.setAttribute("aria-label", "Detected objects");
      objectsLayer.hidden = true;
      container.appendChild(objectsLayer);

      // Store references
      this._container = container;
      this._layers.ocr = ocrLayer;
      this._layers.colour = colourLayer;
      this._layers.objects = objectsLayer;
      this._layers.depth = depthLayer;

      // Create classification badge (Phase 5D-4) — inserted before toolbar
      let badge = document.getElementById("imgdesc-overlay-classification");
      if (!badge) {
        badge = document.createElement("div");
        badge.id = "imgdesc-overlay-classification";
        badge.className = "imgdesc-overlay-classification";
        badge.setAttribute("role", "status");
        badge.setAttribute("aria-live", "polite");
        badge.hidden = true;
        const toolbar = document.getElementById("imgdesc-overlay-toolbar");
        if (toolbar && toolbar.parentNode) {
          toolbar.parentNode.insertBefore(badge, toolbar);
        }
      }

      logInfo("Overlay container initialised");

      // If analysis data already exists (e.g. re-init after profile change), render
      if (this._analysisRef) {
        this._renderFromAnalysis();
      }
    },

    /**
     * Remove the overlay container, restore the image to its original position.
     */
    destroy() {
      if (!this._container) return;

      // Clean up toggletips
      this._cleanupToggletips();

      // Hide classification badge (Phase 5D-4)
      const destroyBadge = document.getElementById(
        "imgdesc-overlay-classification",
      );
      if (destroyBadge) {
        destroyBadge.hidden = true;
        destroyBadge.textContent = "";
      }

      // Move the image back out of the container
      const img = this._container.querySelector("img");
      if (img && this._container.parentNode) {
        this._container.parentNode.insertBefore(img, this._container);
      }

      // Remove container
      if (this._container.parentNode) {
        this._container.parentNode.removeChild(this._container);
      }

      // Clean up draw mode handlers (Phase 5D-3)
      this.stopDrawMode();

      this._container = null;
      this._layers = {};
      this._visible.clear();

      // Reset review mode state so re-init starts clean
      this._inReviewMode = false;
      this._selectedIndex = null;
      this._selectedAdditionIndex = null;
      this._pendingDrawBounds = null;
      this._reviewKeyHandler = null;
      this._reviewClickHandler = null;

      logInfo("Overlay container destroyed");
    },

    // ══════════════════════════════════════════════════════════════════
    // Data binding
    // ══════════════════════════════════════════════════════════════════

    /**
     * Bind analysis data and render overlays.
     * @param {Object} analysisResult - The complete analysis result
     */
    setAnalysis(analysisResult) {
      this._analysisRef = analysisResult;

      if (!this._container) {
        logDebug("setAnalysis() called before init() — data stored for later");
        return;
      }

      this._renderFromAnalysis();
    },

    /**
     * Refresh layout after container relocation (e.g. into/out of fullscreen modal).
     * Closes any open toggletips (they would be positioned incorrectly after resize).
     * Safe to call at any time, even before init().
     */
    refreshLayout() {
      if (!this._container) {
        logDebug("[Overlay] refreshLayout() called before init — no-op");
        return;
      }

      // Close any open toggletips
      if (
        typeof window.UniversalToggletip !== "undefined" &&
        typeof window.UniversalToggletip.closeAll === "function"
      ) {
        window.UniversalToggletip.closeAll();
      }

      var dialog = this._container.closest("dialog");

      if (dialog) {
        // Entering fullscreen: move toggletip elements into the <dialog>
        // so they render above the top layer, and switch to position:fixed
        // so viewport-based coordinates remain correct.
        this._relocateToggletipsToDialog(dialog);
      } else if (this._toggletipIds.length > 0) {
        // Leaving fullscreen (or normal view).  Check whether the
        // toggletip elements still exist — they are destroyed when the
        // <dialog> is removed from the DOM.  If missing, do a full
        // re-render which creates fresh toggletips in document.body.
        var firstEl = document.getElementById(this._toggletipIds[0]);
        if (!firstEl) {
          logInfo("[Overlay] Toggletip elements lost — rebuilding overlay");
          this._toggletipIds = [];
          this._renderFromAnalysis();
          return;
        }
      }

      logDebug("[Overlay] Layout refreshed");
    },

    /**
     * Move toggletip DOM elements into a <dialog> and switch to
     * position:fixed so viewport-based coordinates stay correct.
     * @param {HTMLDialogElement} dialog
     * @private
     */
    _relocateToggletipsToDialog(dialog) {
      if (this._toggletipIds.length === 0) return;

      for (var i = 0; i < this._toggletipIds.length; i++) {
        var el = document.getElementById(this._toggletipIds[i]);
        if (el && el.parentNode !== dialog) {
          dialog.appendChild(el);
          el.style.position = "fixed";
        }
      }

      logDebug(
        "[Overlay] Moved " +
          this._toggletipIds.length +
          " toggletip elements into dialog (fixed)",
      );
    },

    /**
     * Remove all overlay content and reset state.
     * Does NOT destroy the container — it persists for the next analysis.
     */
    clearAnalysis() {
      this._analysisRef = null;

      // Clean up toggletips
      this._cleanupToggletips();

      // Clear OCR layer content
      if (this._layers.ocr) {
        this._layers.ocr.innerHTML = "";
      }

      // Clear colour layer content (Phase 5D-4)
      if (this._layers.colour) {
        this._layers.colour.innerHTML = "";
      }

      // Clear objects layer content (Phase 10C)
      if (this._layers.objects) {
        this._layers.objects.innerHTML = "";
      }

      // Clear depth layer content (Phase 11B)
      if (this._layers.depth) {
        this._layers.depth.innerHTML = "";
      }

      // Hide depth legend (Phase 11B)
      const depthLegend = document.getElementById("imgdesc-depth-legend");
      if (depthLegend) depthLegend.hidden = true;

      // Hide classification badge (Phase 5D-4)
      const badge = document.getElementById("imgdesc-overlay-classification");
      if (badge) {
        badge.hidden = true;
        badge.textContent = "";
      }

      // Hide all layers
      for (const type of this._visible) {
        const layer = this._layers[type];
        if (layer) layer.hidden = true;
      }
      this._visible.clear();

      // Phase 6B-1: clear and hide review list
      const listPanel = document.getElementById("imgdesc-review-list-panel");
      if (listPanel) {
        listPanel.hidden = true;
        const listEl = document.getElementById("imgdesc-review-list");
        if (listEl) listEl.innerHTML = "";
      }

      this._updateToolbarState();

      logDebug("Analysis cleared");
    },

    // ══════════════════════════════════════════════════════════════════
    // Layer visibility
    // ══════════════════════════════════════════════════════════════════

    /**
     * Show a layer by type.
     * @param {string} type - Layer type ('ocr', 'colour', etc.)
     */
    showLayer(type) {
      const layer = this._layers[type];
      if (!layer) return;
      layer.hidden = false;
      this._visible.add(type);
      const btn = document.querySelector(
        '.imgdesc-overlay-toggle[data-layer="' + type + '"]',
      );
      if (btn) btn.setAttribute("aria-pressed", "true");

      // Phase 11B: show depth legend when depth layer is shown
      if (type === "depth") {
        this._updateDepthLegend();
      }
    },

    /**
     * Hide a layer by type.
     * @param {string} type
     */
    hideLayer(type) {
      const layer = this._layers[type];
      if (!layer) return;
      layer.hidden = true;
      this._visible.delete(type);
      const btn = document.querySelector(
        '.imgdesc-overlay-toggle[data-layer="' + type + '"]',
      );
      if (btn) btn.setAttribute("aria-pressed", "false");

      // Phase 11B: hide depth legend when depth layer is hidden
      if (type === "depth") {
        const legend = document.getElementById("imgdesc-depth-legend");
        if (legend) legend.hidden = true;
      }
    },

    /**
     * Toggle a layer's visibility.
     * @param {string} type
     */
    toggleLayer(type) {
      if (this._visible.has(type)) {
        this.hideLayer(type);
      } else {
        this.showLayer(type);
      }
    },

    /**
     * Check if a layer is currently visible.
     * @param {string} type
     * @returns {boolean}
     */
    isLayerVisible(type) {
      return this._visible.has(type);
    },

    // ══════════════════════════════════════════════════════════════════
    // Internal: rendering
    // ══════════════════════════════════════════════════════════════════

    /**
     * Render overlays from the stored analysis reference.
     * @private
     */
    _renderFromAnalysis() {
      const result = this._analysisRef;
      if (!result) return;

      // Exit review mode if active — re-rendering destroys all boxes,
      // so review state (selected index, handlers, panel) would be stale
      if (this._inReviewMode) {
        this.exitReviewMode();
      }

      // Clean up previous toggletips
      this._cleanupToggletips();

      // Clear existing OCR boxes
      if (this._layers.ocr) {
        this._layers.ocr.innerHTML = "";
      }

      // Clear existing colour regions (Phase 5D-4)
      if (this._layers.colour) {
        this._layers.colour.innerHTML = "";
      }

      // Clear existing object boxes (Phase 10C)
      if (this._layers.objects) {
        this._layers.objects.innerHTML = "";
      }

      // Clear existing depth layer content (Phase 11B)
      if (this._layers.depth) {
        this._layers.depth.innerHTML = "";
      }

      // Render OCR if available
      if (
        result.ocr &&
        result.ocr.status === "complete" &&
        (result.ocr.items.length > 0 ||
          (result.ocr.suppressedItems && result.ocr.suppressedItems.length > 0))
      ) {
        this._renderOCRLayer(result.ocr);
        this.showLayer("ocr");
      }

      // Re-render user-added items if any (Phase 5D-3)
      if (this._userEdits && this._userEdits.additions) {
        for (let ai = 0; ai < this._userEdits.additions.length; ai++) {
          const addition = this._userEdits.additions[ai];
          if (addition.status !== "removed") {
            this._createAddedBox(addition, ai);
          }
        }
      }

      this._updateToolbarState();

      // Render colour layer if available — start hidden, user toggles on (Phase 5D-4)
      if (result.colour && result.colour.status === "complete") {
        this._renderColourLayer(result.colour);
      }

      // Render Florence-2 objects layer if available — start hidden (Phase 10C)
      if (
        result.florenceObjects &&
        result.florenceObjects.status === "complete" &&
        result.florenceObjects.items &&
        result.florenceObjects.items.length > 0
      ) {
        this._renderObjectsLayer(result.florenceObjects);
      }

      // Render depth zone overlay if available — start hidden (Phase 11B)
      if (
        result.depth &&
        result.depth.status === "success" &&
        result.depth.rawDepthMap &&
        result.depth.rawDepthMap.data
      ) {
        this._renderDepthLayer(result.depth);
      }

      // Render classification badge (Phase 5D-4)
      if (result.classification) {
        this._renderClassificationBadge(result.classification);
      }
    },

    /**
     * Render OCR bounding boxes into the OCR layer.
     * @param {Object} ocrResult - The OCR result from analysis
     * @private
     */
    _renderOCRLayer(ocrResult) {
      const layer = this._layers.ocr;
      if (!layer) return;

      const items = ocrResult.items || [];
      const suppressedItems = ocrResult.suppressedItems || [];

      // Tag each item with its suppressed status, then sort all together
      // by visual reading order (top-to-bottom, left-to-right).
      // Items within 5% vertical distance are treated as the same line.
      const LINE_TOLERANCE = 0.05;
      const allItems = items
        .map(function (item) {
          return { item: item, suppressed: false };
        })
        .concat(
          suppressedItems.map(function (item) {
            return { item: item, suppressed: true };
          }),
        )
        .sort(function (a, b) {
          const ay = a.item.bounds ? a.item.bounds.y : 0;
          const by = b.item.bounds ? b.item.bounds.y : 0;
          if (Math.abs(ay - by) < LINE_TOLERANCE) {
            // Same line — sort left to right
            const ax = a.item.bounds ? a.item.bounds.x : 0;
            const bx = b.item.bounds ? b.item.bounds.x : 0;
            return ax - bx;
          }
          return ay - by;
        });

      // Store sorted items for review mode index mapping (Phase 5D-2)
      this._sortedItems = allItems;

      for (let i = 0; i < allItems.length; i++) {
        this._createOCRBox(layer, allItems[i].item, i, allItems[i].suppressed);
      }

      logInfo(
        "Rendered " +
          items.length +
          " OCR boxes + " +
          suppressedItems.length +
          " suppressed",
      );
    },

    /**
     * Create a single OCR bounding box element.
     * @param {HTMLElement} layer - The OCR layer element
     * @param {Object} item - The OCR item data
     * @param {number} index - Zero-based index for the box
     * @param {boolean} isSuppressed - Whether this item was noise-filtered
     * @private
     */
    _createOCRBox(layer, item, index, isSuppressed) {
      if (!item.bounds) {
        logDebug("OCR item " + index + " has no bounds — skipping");
        return;
      }

      const hasConfidence =
        item.confidence !== null && item.confidence !== undefined;
      const confidenceLevel = hasConfidence
        ? getConfidenceLevel(item.confidence)
        : "medium";
      const source = item.source || "primary";
      const css = boundsToCSS(item.bounds, 0.02);

      const box = document.createElement("div");
      box.className = "imgdesc-overlay-box";
      box.setAttribute("tabindex", "0");
      box.setAttribute("data-index", String(index));
      box.setAttribute("data-confidence", confidenceLevel);
      box.setAttribute("data-source", source);
      box.setAttribute("data-suppressed", String(isSuppressed));
      box.style.left = css.left;
      box.style.top = css.top;
      box.style.width = css.width;
      box.style.height = css.height;

      // Accessible label
      box.setAttribute(
        "aria-label",
        this._buildOCRAccessibleLabel(item, index, isSuppressed),
      );

      // Text label tag (above the box)
      const label = document.createElement("span");
      label.className = "imgdesc-overlay-box-label";
      label.textContent = item.text || "";
      box.appendChild(label);

      layer.appendChild(box);

      // Toggletip integration
      this._attachToggletip(box, item, index, isSuppressed);
    },

    /**
     * Build accessible label for an OCR box.
     * @param {Object} item
     * @param {number} index
     * @param {boolean} isSuppressed
     * @returns {string}
     * @private
     */
    _buildOCRAccessibleLabel(item, index, isSuppressed) {
      const SOURCE_LABELS = {
        tesseract: "Tesseract",
        primary: "Primary",
        preprocessed: "Preprocessed",
        florence2: "Florence-2",
        user: "User",
      };
      const text = item.text || "unknown";
      const hasConfidence =
        item.confidence !== null && item.confidence !== undefined;
      const conf = hasConfidence ? Math.round(item.confidence * 100) : null;
      const quadrant = item.quadrant || "unknown";
      const source = SOURCE_LABELS[item.source] || item.source || "Primary";
      let label =
        "OCR item " +
        (index + 1) +
        ": " +
        text +
        ", confidence " +
        (conf !== null ? conf + "%" : "N/A") +
        ", " +
        quadrant +
        " quadrant, " +
        source +
        " source";
      if (isSuppressed) {
        label += ", suppressed";
      }
      return label;
    },

    /**
     * Build toggletip HTML content for an OCR box.
     * @param {Object} item
     * @param {number} index
     * @param {boolean} isSuppressed
     * @returns {string}
     * @private
     */
    _buildOCRToggletipContent(item, index, isSuppressed) {
      const SOURCE_LABELS = {
        tesseract: "Tesseract",
        primary: "Primary",
        preprocessed: "Preprocessed",
        florence2: "Florence-2",
        user: "User",
      };
      const text = esc(item.text || "");
      const hasConfidence =
        item.confidence !== null && item.confidence !== undefined;
      const conf = hasConfidence ? Math.round(item.confidence * 100) : null;
      const confidenceLevel = hasConfidence
        ? getConfidenceLevel(item.confidence)
        : "medium";
      const quadrant = item.quadrant || "unknown";
      const source = SOURCE_LABELS[item.source] || item.source || "Primary";

      let html =
        '<dl class="toggletip-data">' +
        '<dt class="toggletip-label">Text</dt>' +
        '<dd class="toggletip-value">' +
        text +
        "</dd>" +
        '<dt class="toggletip-label">Confidence</dt>' +
        '<dd class="toggletip-value toggletip-confidence-' +
        confidenceLevel +
        '">' +
        (conf !== null ? conf + "%" : "N/A") +
        "</dd>" +
        '<dt class="toggletip-label">Position</dt>' +
        '<dd class="toggletip-value">' +
        quadrant +
        "</dd>" +
        '<dt class="toggletip-label">Source</dt>' +
        '<dd class="toggletip-value">' +
        source +
        "</dd>";

      if (isSuppressed) {
        html +=
          '<dt class="toggletip-label">Status</dt>' +
          '<dd class="toggletip-value">Suppressed (noise-filtered)</dd>';
      }

      html += "</dl>";
      return html;
    },

    /**
     * Attach a UniversalToggletip to an OCR box element.
     * @param {HTMLElement} boxElement
     * @param {Object} item
     * @param {number} index
     * @param {boolean} isSuppressed
     * @private
     */
    _attachToggletip(boxElement, item, index, isSuppressed) {
      if (
        typeof window.UniversalToggletip === "undefined" ||
        typeof window.UniversalToggletip.create !== "function"
      ) {
        logWarn(
          "UniversalToggletip not available — skipping toggletip creation",
        );
        return;
      }

      const confidenceLevel = getConfidenceLevel(item.confidence || 0);
      const toggletipType = confidenceToToggletipType(confidenceLevel);

      try {
        const toggletipId = window.UniversalToggletip.create({
          trigger: boxElement,
          content: this._buildOCRToggletipContent(item, index, isSuppressed),
          position: "bottom",
          type: toggletipType,
          label: this._buildOCRAccessibleLabel(item, index, isSuppressed),
        });
        if (toggletipId) {
          this._toggletipIds.push(toggletipId);
        }
      } catch (err) {
        logWarn(
          "Failed to create toggletip for OCR item " + index,
          err.message,
        );
      }
    },

    /**
     * Clean up all created toggletips.
     * @private
     */
    _cleanupToggletips() {
      if (
        this._toggletipIds.length > 0 &&
        typeof window.UniversalToggletip !== "undefined" &&
        typeof window.UniversalToggletip.destroy === "function"
      ) {
        for (const id of this._toggletipIds) {
          try {
            window.UniversalToggletip.destroy(id);
          } catch (err) {
            logDebug("Toggletip cleanup warning:", err.message);
          }
        }
      }
      this._toggletipIds = [];
    },

    // ══════════════════════════════════════════════════════════════════
    // Toolbar state
    // ══════════════════════════════════════════════════════════════════

    /**
     * Update toolbar button enabled/disabled and aria-pressed states.
     * @private
     */
    _updateToolbarState() {
      const result = this._analysisRef;

      // OCR Labels button
      const ocrBtn = document.querySelector(
        '.imgdesc-overlay-toggle[data-layer="ocr"]',
      );
      if (ocrBtn) {
        const hasOCR =
          result &&
          result.ocr &&
          result.ocr.status === "complete" &&
          ((result.ocr.items && result.ocr.items.length > 0) ||
            (result.ocr.suppressedItems &&
              result.ocr.suppressedItems.length > 0));
        ocrBtn.disabled = !hasOCR;
        ocrBtn.setAttribute(
          "aria-pressed",
          this._visible.has("ocr") ? "true" : "false",
        );
      }

      // Colour button
      const colourBtn = document.querySelector(
        '.imgdesc-overlay-toggle[data-layer="colour"]',
      );
      if (colourBtn) {
        const hasColour =
          result && result.colour && result.colour.status === "complete";
        colourBtn.disabled = !hasColour;
        colourBtn.setAttribute(
          "aria-pressed",
          this._visible.has("colour") ? "true" : "false",
        );
      }

      // Objects button (Phase 10C: Florence-2 object detection)
      const objBtn = document.querySelector(
        '.imgdesc-overlay-toggle[data-layer="objects"]',
      );
      if (objBtn) {
        const hasObjects =
          result &&
          result.florenceObjects &&
          result.florenceObjects.status === "complete" &&
          result.florenceObjects.items &&
          result.florenceObjects.items.length > 0;
        objBtn.disabled = !hasObjects;
        objBtn.setAttribute(
          "aria-pressed",
          this._visible.has("objects") ? "true" : "false",
        );
      }

      // Depth button (Phase 11B)
      const depthBtn = document.querySelector(
        '.imgdesc-overlay-toggle[data-layer="depth"]',
      );
      if (depthBtn) {
        const hasDepth =
          result &&
          result.depth &&
          result.depth.status === "success" &&
          result.depth.rawDepthMap &&
          result.depth.rawDepthMap.data;
        depthBtn.disabled = !hasDepth;
        depthBtn.setAttribute(
          "aria-pressed",
          this._visible.has("depth") ? "true" : "false",
        );
      }

      // Review OCR button
      const reviewBtn = document.getElementById("imgdesc-overlay-review-btn");
      if (reviewBtn) {
        const hasItems =
          result &&
          result.ocr &&
          result.ocr.items &&
          result.ocr.items.length > 0;
        reviewBtn.disabled = !hasItems;
      }
    },

    // Review mode methods are in image-describer-overlay-review.js

    // ══════════════════════════════════════════════════════════════════
    // Phase 5D-4: Colour Grid Overlay
    // ══════════════════════════════════════════════════════════════════

    /**
     * Render colour sampling regions into the colour layer.
     * The layer starts hidden — the user reveals it via the Colour toolbar button.
     * @param {Object} colourResult - The colour result from analysis
     * @private
     */
    _renderColourLayer(colourResult) {
      const layer = this._layers.colour;
      if (!layer) return;

      layer.innerHTML = "";

      const regions = colourResult.regions || [];
      for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        if (!region.bounds) continue;

        const css = boundsToCSS(region.bounds);
        const rgb = region.dominantRGB || [128, 128, 128];

        const regionDiv = document.createElement("div");
        regionDiv.className = "imgdesc-overlay-colour-region";
        regionDiv.style.left = css.left;
        regionDiv.style.top = css.top;
        regionDiv.style.width = css.width;
        regionDiv.style.height = css.height;
        regionDiv.style.border =
          "2px solid rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", 0.6)";
        regionDiv.style.background =
          "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", 0.1)";

        // Label: luminance percentage · colour name
        const lum = Math.round((region.avgLuminance || 0) * 100);
        const colourName = region.colourName || "unknown";

        const labelSpan = document.createElement("span");
        labelSpan.className = "imgdesc-overlay-colour-label";
        labelSpan.textContent = "L: " + lum + "% \u00b7 " + colourName;
        regionDiv.appendChild(labelSpan);

        layer.appendChild(regionDiv);
      }

      // Gradient arrow indicator
      if (colourResult.gradientDirection) {
        const ARROWS = {
          "left-to-right": "\u2192",
          "right-to-left": "\u2190",
          "top-to-bottom": "\u2193",
          "bottom-to-top": "\u2191",
        };
        const arrowChar = ARROWS[colourResult.gradientDirection];
        if (arrowChar) {
          const arrowDiv = document.createElement("div");
          arrowDiv.className = "imgdesc-overlay-gradient-arrow";
          arrowDiv.textContent = arrowChar;
          arrowDiv.setAttribute("aria-hidden", "true");
          layer.appendChild(arrowDiv);
        }
      }

      logInfo("Rendered " + regions.length + " colour regions");
    },

    // ══════════════════════════════════════════════════════════════════
    // Phase 10C: Florence-2 Objects Overlay
    // ══════════════════════════════════════════════════════════════════

    /**
     * Render Florence-2 detected object boxes into the objects layer.
     * The layer starts hidden — the user reveals it via the Objects toolbar button.
     * @param {Object} florenceObjects - { items: [{ label, bounds: {x1,y1,x2,y2}, confidence }], status }
     * @private
     */
    _renderObjectsLayer(florenceObjects) {
      const layer = this._layers.objects;
      if (!layer) return;

      layer.innerHTML = "";

      const items = florenceObjects.items || [];
      if (items.length === 0) return;

      // Get natural image dimensions for pixel → normalised conversion
      const img = this._container ? this._container.querySelector("img") : null;
      const natW = img ? img.naturalWidth : 0;
      const natH = img ? img.naturalHeight : 0;

      if (!natW || !natH) {
        logWarn(
          "Cannot render object boxes — image natural dimensions unavailable",
        );
        return;
      }

      for (let i = 0; i < items.length; i++) {
        this._createObjectBox(layer, items[i], i, natW, natH);
      }

      logInfo("Rendered " + items.length + " Florence-2 object boxes");
    },

    /**
     * Create a single Florence-2 object bounding box element.
     * @param {HTMLElement} layer - The objects layer element
     * @param {Object} item - { label, bounds: {x1,y1,x2,y2}, confidence }
     * @param {number} index - Zero-based index
     * @param {number} natW - img.naturalWidth
     * @param {number} natH - img.naturalHeight
     * @private
     */
    _createObjectBox(layer, item, index, natW, natH) {
      if (!item.bounds) {
        logDebug("Object item " + index + " has no bounds — skipping");
        return;
      }

      // Convert pixel bounds to normalised { x, y, w, h } then to CSS %
      const normalised = pixelBoundsToNormalised(item.bounds, natW, natH);
      const css = boundsToCSS(normalised);

      const box = document.createElement("div");
      box.className = "imgdesc-overlay-box imgdesc-overlay-box-object";
      box.setAttribute("tabindex", "0");
      box.setAttribute("data-index", String(index));
      box.setAttribute("data-type", "object");
      box.style.left = css.left;
      box.style.top = css.top;
      box.style.width = css.width;
      box.style.height = css.height;

      // Accessible label
      box.setAttribute(
        "aria-label",
        this._buildObjectAccessibleLabel(item, index),
      );

      // Label tag (above the box)
      const label = document.createElement("span");
      label.className = "imgdesc-overlay-box-label";
      label.textContent = item.label || "";
      box.appendChild(label);

      layer.appendChild(box);

      // Toggletip integration
      this._attachObjectToggletip(box, item, index);
    },

    /**
     * Build accessible label for a Florence-2 object box.
     * Confidence is always null for Florence-2 OD, so it is omitted.
     * @param {Object} item - { label, bounds, confidence }
     * @param {number} index
     * @returns {string}
     * @private
     */
    _buildObjectAccessibleLabel(item, index) {
      var labelText = item.label || "unknown object";
      return "Object " + (index + 1) + ": " + labelText;
    },

    /**
     * Build toggletip HTML content for a Florence-2 object box.
     * Shows label and position. Confidence is omitted (always null).
     * @param {Object} item
     * @param {number} index
     * @param {number} natW
     * @param {number} natH
     * @returns {string}
     * @private
     */
    _buildObjectToggletipContent(item, index, natW, natH) {
      var labelText = esc(item.label || "unknown");

      // Derive position description from pixel bounds
      var position = "unknown";
      if (item.bounds && natW && natH) {
        var cx = (item.bounds.x1 + item.bounds.x2) / 2 / natW;
        var cy = (item.bounds.y1 + item.bounds.y2) / 2 / natH;
        var vertical = cy < 0.33 ? "top" : cy > 0.67 ? "bottom" : "centre";
        var horizontal = cx < 0.33 ? "left" : cx > 0.67 ? "right" : "centre";
        if (vertical === "centre" && horizontal === "centre") {
          position = "centre";
        } else if (vertical === "centre") {
          position = horizontal;
        } else if (horizontal === "centre") {
          position = vertical;
        } else {
          position = vertical + "-" + horizontal;
        }
      }

      return (
        '<dl class="toggletip-data">' +
        '<dt class="toggletip-label">Object</dt>' +
        '<dd class="toggletip-value">' +
        labelText +
        "</dd>" +
        '<dt class="toggletip-label">Position</dt>' +
        '<dd class="toggletip-value">' +
        position +
        "</dd>" +
        '<dt class="toggletip-label">Source</dt>' +
        '<dd class="toggletip-value">Florence-2</dd>' +
        "</dl>"
      );
    },

    /**
     * Attach a UniversalToggletip to a Florence-2 object box element.
     * @param {HTMLElement} boxElement
     * @param {Object} item
     * @param {number} index
     * @private
     */
    _attachObjectToggletip(boxElement, item, index) {
      if (
        typeof window.UniversalToggletip === "undefined" ||
        typeof window.UniversalToggletip.create !== "function"
      ) {
        logWarn("UniversalToggletip not available — skipping object toggletip");
        return;
      }

      // Get natural image dimensions for position description
      var img = this._container ? this._container.querySelector("img") : null;
      var natW = img ? img.naturalWidth : 0;
      var natH = img ? img.naturalHeight : 0;

      try {
        var toggletipId = window.UniversalToggletip.create({
          trigger: boxElement,
          content: this._buildObjectToggletipContent(item, index, natW, natH),
          position: "bottom",
          type: "info",
          label: this._buildObjectAccessibleLabel(item, index),
        });
        if (toggletipId) {
          this._toggletipIds.push(toggletipId);
        }
      } catch (err) {
        logWarn(
          "Failed to create toggletip for object item " + index,
          err.message,
        );
      }
    },

    // ══════════════════════════════════════════════════════════════════
    // Phase 11B: Depth Zone Overlay
    // ══════════════════════════════════════════════════════════════════

    /**
     * Render depth zone canvas overlay into the depth layer.
     * Paints three colour-coded zones (foreground, midground, background)
     * and positions text labels at each zone's visual centroid.
     * The layer starts hidden — the user reveals it via the Depth toolbar button.
     * @param {Object} depth - The depth result from analysis
     * @private
     */
    _renderDepthLayer(depth) {
      const layer = this._layers.depth;
      if (!layer) return;

      layer.innerHTML = "";

      const rawMap = depth.rawDepthMap;
      if (!rawMap || !rawMap.data || !rawMap.width || !rawMap.height) {
        logWarn("Depth layer: rawDepthMap missing or incomplete");
        return;
      }

      const w = rawMap.width;
      const h = rawMap.height;
      const data = rawMap.data;

      // Create canvas element
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.className = "imgdesc-depth-canvas";
      const ctx = canvas.getContext("2d");
      const imageData = ctx.createImageData(w, h);
      const pixels = imageData.data;

      // Zone colour definitions: [r, g, b, a]
      const ZONE_COLOURS = {
        foreground: [230, 100, 60, 76], // rgba(230, 100, 60, 0.30)
        midground: [140, 80, 200, 64], // rgba(140, 80, 200, 0.25)
        background: [50, 120, 220, 76], // rgba(50, 120, 220, 0.30)
      };

      // Normalisation range
      const dMin = depth.depthRange ? depth.depthRange.min : 0;
      const dMax = depth.depthRange ? depth.depthRange.max : 1;
      const range = dMax - dMin;

      // Centroid accumulators: { sumX, sumY, count }
      const centroids = {
        foreground: { sumX: 0, sumY: 0, count: 0 },
        midground: { sumX: 0, sumY: 0, count: 0 },
        background: { sumX: 0, sumY: 0, count: 0 },
      };

      const totalPixels = w * h;

      for (let i = 0; i < totalPixels; i++) {
        const val = data[i];

        // Normalise using the depth result's range
        let normalised;
        if (range === 0) {
          normalised = 0; // Flat image — treat all as foreground
        } else {
          normalised = (val - dMin) / range;
          // Apply inversion if the analyser detected reversed convention
          if (depth.invertDepth) normalised = 1.0 - normalised;
          // Clamp to 0–1
          if (normalised < 0) normalised = 0;
          if (normalised > 1) normalised = 1;
        }

        // Determine zone
        let zone;
        if (normalised < 0.33) {
          zone = "foreground";
        } else if (normalised < 0.66) {
          zone = "midground";
        } else {
          zone = "background";
        }

        // Set pixel colour
        const colour = ZONE_COLOURS[zone];
        const px = i * 4;
        pixels[px] = colour[0]; // R
        pixels[px + 1] = colour[1]; // G
        pixels[px + 2] = colour[2]; // B
        pixels[px + 3] = colour[3]; // A

        // Accumulate centroid data
        const x = i % w;
        const y = Math.floor(i / w);
        centroids[zone].sumX += x;
        centroids[zone].sumY += y;
        centroids[zone].count += 1;
      }

      ctx.putImageData(imageData, 0, 0);
      layer.appendChild(canvas);

      // Create positioned labels for zones with ≥5% area
      const AREA_THRESHOLD = 0.05;
      const ZONE_DISPLAY_NAMES = {
        foreground: "Foreground",
        midground: "Midground",
        background: "Background",
      };
      const zoneKeys = ["foreground", "midground", "background"];

      for (let zi = 0; zi < zoneKeys.length; zi++) {
        const zoneName = zoneKeys[zi];
        const c = centroids[zoneName];
        if (c.count / totalPixels < AREA_THRESHOLD) continue;

        // Clamp centroid so labels stay within visible bounds.
        // Labels use translate(-50%, -50%) so a centroid at 0% or 100%
        // would place half the label outside the container.
        const LABEL_MARGIN = 0.08; // 8% inset from edges
        const centroidX = Math.max(
          LABEL_MARGIN,
          Math.min(1 - LABEL_MARGIN, c.sumX / c.count / w),
        );
        const centroidY = Math.max(
          LABEL_MARGIN,
          Math.min(1 - LABEL_MARGIN, c.sumY / c.count / h),
        );

        const label = document.createElement("span");
        label.className = "imgdesc-depth-zone-label";
        label.setAttribute("data-zone", zoneName);
        label.textContent = ZONE_DISPLAY_NAMES[zoneName];
        label.style.left = (centroidX * 100).toFixed(1) + "%";
        label.style.top = (centroidY * 100).toFixed(1) + "%";
        layer.appendChild(label);
      }

      logInfo("Rendered depth zone overlay (" + w + "×" + h + ")");
    },

    /**
     * Populate and show the depth legend panel with zone area percentages.
     * @private
     */
    _updateDepthLegend() {
      const legend = document.getElementById("imgdesc-depth-legend");
      if (!legend) return;

      const result = this._analysisRef;
      if (!result || !result.depth || !result.depth.zones) {
        legend.hidden = true;
        return;
      }

      const zones = result.depth.zones;
      const zoneConfig = [
        { key: "foreground", ddId: "imgdesc-depth-legend-foreground" },
        { key: "midground", ddId: "imgdesc-depth-legend-midground" },
        { key: "background", ddId: "imgdesc-depth-legend-bg" },
      ];

      for (let i = 0; i < zoneConfig.length; i++) {
        const z = zoneConfig[i];
        const dd = document.getElementById(z.ddId);
        if (dd && zones[z.key]) {
          const zone = zones[z.key];
          let text = zone.areaPercent + "% of image";
          if (zone.dominantQuadrants && zone.dominantQuadrants.length > 0) {
            text += " — " + zone.dominantQuadrants.join(", ");
          }
          dd.textContent = text;
        }
      }

      legend.hidden = false;
    },

    // ══════════════════════════════════════════════════════════════════
    // Phase 5D-4: Classification Badge
    // ══════════════════════════════════════════════════════════════════

    /**
     * Update the classification badge below the image.
     * Shows the suggested profile and source (heuristic or CLIP).
     * @param {Object} classification - From analysisResult.classification
     * @private
     */
    _renderClassificationBadge(classification) {
      const badge = document.getElementById("imgdesc-overlay-classification");
      if (!badge) return;

      if (!classification || !classification.profile) {
        badge.hidden = true;
        badge.textContent = "";
        return;
      }

      const profile = classification.profile;
      const conf = Math.round((classification.confidence || 0) * 100);
      const source = classification.source || "heuristic";

      let text = "Detected: " + profile + " (" + conf + "%, " + source + ")";

      // Append CLIP detail if it ran as a secondary source alongside heuristic
      if (
        classification.clip &&
        classification.clip.status === "success" &&
        classification.clip.topLabel &&
        source !== "clip"
      ) {
        const clipPct = Math.round(
          (classification.clip.topConfidence || 0) * 100,
        );
        text +=
          " \u00b7 CLIP: " +
          classification.clip.topLabel +
          " (" +
          clipPct +
          "%)";
      }

      badge.textContent = text;

      // Keep badge hidden when in output mode (generation complete)
      const layoutEl = document.querySelector(".imgdesc-layout");
      const inOutputMode = layoutEl && layoutEl.classList.contains("imgdesc-output-mode");
      badge.hidden = inOutputMode;

      logDebug("Classification badge updated:", text, inOutputMode ? "(hidden — output mode)" : "");
    },

    // ══════════════════════════════════════════════════════════════════
    // Phase 7B: Expand/Sidebar Toggle
    // ══════════════════════════════════════════════════════════════════

    /**
     * Toggle between sidebar layout and expanded (full-width image) layout.
     * Only meaningful when in fullscreen + review mode on desktop.
     */
    toggleExpandMode() {
      const workspace = document.getElementById("imgdesc-workspace");
      const toggle = document.getElementById("imgdesc-expand-toggle");
      if (!workspace || !toggle) return;

      const isExpanded = workspace.classList.toggle(
        "imgdesc-workspace--expanded",
      );
      toggle.setAttribute("aria-pressed", isExpanded ? "true" : "false");

      // Update button text — find the last text node
      var nodes = toggle.childNodes;
      for (var ni = nodes.length - 1; ni >= 0; ni--) {
        if (
          nodes[ni].nodeType === Node.TEXT_NODE &&
          nodes[ni].textContent.trim().length > 0
        ) {
          nodes[ni].textContent = isExpanded
            ? " Show Sidebar"
            : " Expand Image";
          break;
        }
      }

      logInfo(isExpanded ? "Expanded image mode" : "Sidebar mode");
    },

    // ══════════════════════════════════════════════════════════════════
    // Exposed helpers (for testing / future phases)
    // ══════════════════════════════════════════════════════════════════

    _boundsToCSS: boundsToCSS,
    _getConfidenceLevel: getConfidenceLevel,
    _pixelBoundsToNormalised: pixelBoundsToNormalised,
    // Phase 11B: exposed for testing
    // _renderDepthLayer and _updateDepthLegend are already on the object
  };

  logInfo("Module loaded");
})();
