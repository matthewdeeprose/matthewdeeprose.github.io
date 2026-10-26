/**
 * Image Describer Overlay System — Core
 * Container lifecycle, rendering, layer toggling, toolbar, fullscreen layout.
 * Review mode methods are in image-describer-overlay-review.js (loaded after).
 *
 * Phase 5D-1: OCR boxes, toolbar state, toggletip integration.
 * Phase 5D-4: Colour grid overlay (its classification badge was removed in H-56).
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

  // ── Constants ────────────────────────────────────────────────────────

  // The visually-hidden element carrying the OCR item count, used as the
  // Review OCR control's accessible description (H-6c). Declared in tools.html.
  const REVIEW_COUNT_ID = "imgdesc-overlay-review-count";

  // The skip link past the box layers (H-13). The OCR layer alone can hold
  // dozens of tab stops, all of them between the image and the toolbar that
  // carries Review OCR. The link exists only while a layer below holds one.
  const SKIP_LINK_ID = "imgdesc-overlay-skip";
  const SKIP_LINK_TEXT = "Skip text boxes to analysis controls";
  const TOOLBAR_ID = "imgdesc-overlay-toolbar";
  const BOX_LAYER_TYPES = Object.freeze(["ocr", "objects"]);
  // H-88: where a plain suppressed box parks its toggletip id until review mode
  const PARKED_CONTROLS_ATTR = "data-parked-controls";
  // H-92: a suppressed box the person has confirmed in review mode ("restored")
  const RESTORED_STATUS = "restored";
  const RESTORED_ATTR = "data-restored";
  const REVIEW_EDIT_HINT = ". Press Enter to edit";

  // H-96: the review screen when text detection ended with nothing to review. Every
  // word that changes lives here, with the words they swap back to when something was
  // detected (plan entry: idq-dispatch-h-96.md § 0). Change a wording here only.
  const NO_DETECTION_WORDING = Object.freeze({
    BUTTON_LABEL: "Add text items",
    BUTTON_LABEL_DETECTED: "Review OCR",
    BUTTON_DESCRIPTION:
      "No text was detected in this picture. You can type any text it contains and mark where it sits.",
    PANEL_REGION_NAME: "Edit text item",
    PANEL_REGION_NAME_DETECTED: "Edit OCR item",
    LIST_REGION_NAME: "Your text items list",
    LIST_REGION_NAME_DETECTED: "Detected text items list",
    LIST_NAME: "Your text items",
    LIST_NAME_DETECTED: "Detected text items",
  });
  // The OCR statuses that mean detection has ended (so there is nothing left to wait for).
  const NO_DETECTION_ENDED_STATUSES = Object.freeze(["complete", "skipped", "timed-out", "failed"]);

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
    _skipLink: null, // H-13: the one skip link, created once per container
    _skipLinkObserver: null, // H-13: safety net for box changes made in the review file

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

      this._watchBoxLayers();
      this._syncSkipLink();

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

      // Stop watching and drop the skip link with the container (H-13)
      if (this._skipLinkObserver) {
        this._skipLinkObserver.disconnect();
        this._skipLinkObserver = null;
      }
      this._skipLink = null;

      // Clean up toggletips
      this._cleanupToggletips();

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
      this._syncSkipLink();

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

      this._syncSkipLink();
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

      this._syncSkipLink();
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

      // H-96: the sorted list is written only by _renderOCRLayer, so an analysis with no
      // detected items must not keep the previous analysis's items for the review screen.
      this._sortedItems = [];

      // Clear existing colour regions (Phase 5D-4)
      if (this._layers.colour) {
        this._layers.colour.innerHTML = "";
      }

      // Clear existing object boxes (Phase 10C)
      if (this._layers.objects) {
        this._layers.objects.innerHTML = "";
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

      this._syncSkipLink();
    },

    // ══════════════════════════════════════════════════════════════════
    // Skip link past the box layers (H-13)
    // ══════════════════════════════════════════════════════════════════

    /**
     * Is there a reason for the skip link to exist right now? True while at
     * least one box layer is shown AND holds a tab stop. This is the single
     * predicate: every path that can change either half calls
     * _syncSkipLink(), which asks it.
     * @returns {boolean}
     * @private
     */
    _skipLinkWanted() {
      return BOX_LAYER_TYPES.some((type) => {
        const layer = this._layers[type];
        return !!layer && !layer.hidden && !!layer.querySelector('[tabindex="0"]');
      });
    },

    /**
     * The first enabled, un-hidden button in the toolbar (OCR Labels today).
     * A native button takes focus with no tabindex change.
     * @returns {HTMLElement|null}
     * @private
     */
    _skipLinkTarget() {
      const toolbar = document.getElementById(TOOLBAR_ID);
      if (!toolbar) return null;
      return (
        Array.from(toolbar.querySelectorAll("button")).find(
          (button) => !button.disabled && !button.hidden,
        ) || null
      );
    },

    /**
     * Create the link once per container, immediately before the first box
     * layer in document order, so its identity is stable for focus. It is an
     * <a href> so it still does something without script. Activating it moves
     * focus and says nothing: the target button names itself.
     * @returns {HTMLAnchorElement|null}
     * @private
     */
    _ensureSkipLink() {
      if (this._skipLink && this._container && this._container.contains(this._skipLink)) {
        return this._skipLink;
      }
      if (!this._container || !this._layers.ocr) return null;

      const link = document.createElement("a");
      link.id = SKIP_LINK_ID;
      link.className = "skip-link imgdesc-overlay-skip";
      link.setAttribute("href", "#" + TOOLBAR_ID);
      link.textContent = SKIP_LINK_TEXT;
      link.hidden = true;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = this._skipLinkTarget();
        if (target) target.focus();
      });

      this._container.insertBefore(link, this._layers.ocr);
      this._skipLink = link;
      return link;
    },

    /**
     * Show or hide the skip link to match _skipLinkWanted(). Safe to call at
     * any time and from any path; it writes nothing when nothing changed.
     * @private
     */
    _syncSkipLink() {
      if (!this._container) return;
      const link = this._ensureSkipLink();
      if (!link) return;
      const hidden = !this._skipLinkWanted();
      if (link.hidden !== hidden) link.hidden = hidden;
    },

    /**
     * Keep the link right when boxes are added or removed by code outside
     * this file (review mode adds and removes boxes in
     * image-describer-overlay-review.js). One observer, one predicate.
     * @private
     */
    _watchBoxLayers() {
      if (this._skipLinkObserver) this._skipLinkObserver.disconnect();
      if (typeof MutationObserver === "undefined" || !this._container) return;
      this._skipLinkObserver = new MutationObserver(() => this._syncSkipLink());
      this._skipLinkObserver.observe(this._container, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["hidden", "tabindex"],
      });
    },

    /**
     * Derive the reading-order item list that review-mode corrections index
     * into. Pure — no DOM, no state written — so it can be recomputed on
     * demand by getCorrectedAnalysis() when no OCR layer was ever rendered.
     *
     * The sort is deterministic over the same input, so a list derived here
     * is byte-identical to the one _renderOCRLayer stored, and existing
     * corrections keep pointing at the items they were made against.
     *
     * @param {Object} ocrResult - The OCR result from analysis
     * @returns {Array<{item: Object, suppressed: boolean}>} reading-order list
     * @private
     */
    _deriveSortedItems(ocrResult) {
      if (!ocrResult) return [];

      const items = ocrResult.items || [];
      const suppressedItems = ocrResult.suppressedItems || [];

      // Tag each item with its suppressed status, then sort all together
      // by visual reading order (top-to-bottom, left-to-right).
      // Items within 5% vertical distance are treated as the same line.
      const LINE_TOLERANCE = 0.05;
      return items
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

      const allItems = this._deriveSortedItems(ocrResult);

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
      // H-88: suppressed boxes get no tabindex here (see _setSuppressedBoxInteractive)
      if (!isSuppressed) box.setAttribute("tabindex", "0");
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

      // H-88: a suppressed box is a plain visual mark outside review mode
      if (isSuppressed) {
        this._setSuppressedBoxInteractive(box, !!this._inReviewMode);
      }
    },

    /**
     * H-88: make a suppressed OCR box interactive (review mode) or plain
     * (everywhere else). Changes attributes on the existing element only.
     * Plain = no tabindex, no role, no aria-expanded/aria-controls, so it is
     * not a Tab stop and not exposed as a control. The toggletip stays
     * attached; its trigger id is parked in a data attribute and restored on
     * entering review mode. Pointer events are switched off in CSS.
     * @param {HTMLElement} box
     * @param {boolean} interactive
     * @private
     */
    _setSuppressedBoxInteractive(box, interactive) {
      if (!box || box.getAttribute("data-suppressed") !== "true") return;

      // H-92: a restored box is an ordinary keyboard stop everywhere, because
      // its text is sent to the model; only review mode needs the rest
      this._syncRestoredBoxName(box, !!interactive);
      if (interactive || this._isSuppressedBoxRestored(box)) {
        const controls = box.getAttribute(PARKED_CONTROLS_ATTR);
        box.removeAttribute("aria-hidden");
        box.setAttribute("tabindex", "0");
        box.setAttribute("role", "button");
        box.setAttribute("aria-expanded", "false");
        if (controls) box.setAttribute("aria-controls", controls);
        return;
      }

      const controls = box.getAttribute("aria-controls");
      if (controls) {
        box.setAttribute(PARKED_CONTROLS_ATTR, controls);
        // Close the tip if it was open when review mode ended
        if (
          box.getAttribute("aria-expanded") === "true" &&
          window.UniversalToggletip &&
          typeof window.UniversalToggletip.hide === "function"
        ) {
          window.UniversalToggletip.hide(controls);
        }
      }
      box.removeAttribute("tabindex");
      box.removeAttribute("role");
      box.removeAttribute("aria-expanded");
      box.removeAttribute("aria-controls");
      // Hidden from the accessibility tree; legal here because it is no longer focusable (ARIA rule 4)
      box.setAttribute("aria-hidden", "true");
    },

    /**
     * H-92: the one rule for "this suppressed box is now an ordinary stop".
     * Reads the corrections store, not the DOM, because a re-render rebuilds
     * the boxes without any data-status. Only "restored" counts: a "removed"
     * suppressed box stays plain, and so does one with no correction.
     * @param {HTMLElement} box
     * @returns {boolean}
     * @private
     */
    _isSuppressedBoxRestored(box) {
      if (!box || box.getAttribute("data-suppressed") !== "true") return false;
      const corrections = this._userEdits && this._userEdits.corrections;
      const correction = corrections && corrections[Number(box.dataset.index)];
      return !!correction && correction.status === RESTORED_STATUS;
    },

    /**
     * H-92: make a suppressed box's name, tip and CSS hook say "restored" (or
     * "suppressed" again after an undo). A restored item is in the request, so
     * ", suppressed" would misdescribe it. Rebuilt from the stored item, so
     * it is idempotent and the review-mode hint is added only in review.
     * @param {HTMLElement} box
     * @param {boolean} inReview
     * @private
     */
    _syncRestoredBoxName(box, inReview) {
      if (!box || box.getAttribute("data-suppressed") !== "true") return;
      const restored = this._isSuppressedBoxRestored(box);
      if (restored) box.setAttribute(RESTORED_ATTR, "true");
      else box.removeAttribute(RESTORED_ATTR);

      const index = Number(box.dataset.index);
      const entry = this._sortedItems && this._sortedItems[index];
      if (!entry) return;

      box.setAttribute(
        "aria-label",
        this._buildOCRAccessibleLabel(entry.item, index, true, restored) +
          (inReview ? REVIEW_EDIT_HINT : ""),
      );

      const tipId =
        box.getAttribute("aria-controls") ||
        box.getAttribute(PARKED_CONTROLS_ATTR);
      if (
        tipId &&
        window.UniversalToggletip &&
        typeof window.UniversalToggletip.updateContent === "function"
      ) {
        window.UniversalToggletip.updateContent(
          tipId,
          this._buildOCRToggletipContent(entry.item, index, true, restored),
        );
      }
    },

    /**
     * H-88: apply _setSuppressedBoxInteractive to every suppressed OCR box.
     * @param {boolean} interactive
     * @private
     */
    _syncSuppressedBoxes(interactive) {
      const layer = this._layers && this._layers.ocr;
      if (!layer) return;
      layer
        .querySelectorAll('.imgdesc-overlay-box[data-suppressed="true"]')
        .forEach((box) => this._setSuppressedBoxInteractive(box, interactive));
    },

    /**
     * Build accessible label for an OCR box.
     * @param {Object} item
     * @param {number} index
     * @param {boolean} isSuppressed
     * @returns {string}
     * @private
     */
    _buildOCRAccessibleLabel(item, index, isSuppressed, isRestored) {
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
      // Nine-position word from H-7e's helper, so the name matches what the model is told.
      const utils = window.ImageDescriberAnalyserUtils;
      const position =
        (utils && utils.getItemPositionWord(item)) || item.quadrant || "unknown";
      const source = SOURCE_LABELS[item.source] || item.source || "Primary";
      let label =
        "OCR item " +
        (index + 1) +
        ": " +
        text +
        ", confidence " +
        (conf !== null ? conf + "%" : "N/A") +
        ", position " +
        position +
        ", " +
        source +
        " source";
      if (isSuppressed) {
        label += isRestored ? ", restored" : ", suppressed";
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
    _buildOCRToggletipContent(item, index, isSuppressed, isRestored) {
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
      // Nine-position word from H-7e's helper (see _buildOCRAccessibleLabel).
      const utils = window.ImageDescriberAnalyserUtils;
      const quadrant =
        (utils && utils.getItemPositionWord(item)) || item.quadrant || "unknown";
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
          '<dd class="toggletip-value">' +
          (isRestored
            ? "Restored (noise-filtered, then confirmed)"
            : "Suppressed (noise-filtered)") +
          "</dd>";
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

      // Review OCR button (H-96: also the "Add text items" button when nothing was detected)
      const reviewBtn = document.getElementById("imgdesc-overlay-review-btn");
      if (reviewBtn) {
        const hasItems =
          result &&
          result.ocr &&
          result.ocr.items &&
          result.ocr.items.length > 0;
        const noDetection = this._hasNoDetectedText();
        reviewBtn.disabled = !(hasItems || noDetection);
        this._setReviewCountDescription(
          reviewBtn,
          hasItems ? result.ocr.items.length : 0,
        );
        this._applyNoDetectionWording(reviewBtn, noDetection);
      }
    },

    /**
     * H-96: has text detection ENDED with no detected text?
     * True when it was skipped, timed out, failed, or completed with no detected
     * items. H-102: items suppressed as noise do not count, so a picture where
     * detection found only noise is still "nothing detected"; the review list
     * shows those fragments (restorable), and whatever the person keeps is their
     * own choice. While detection is still running (no status yet, or any other
     * status) this is false, so the button stays disabled until there is
     * something to decide. This one predicate drives the button's enabled state,
     * its words, the panel names, enterReviewMode and the person-entered flag.
     * @returns {boolean}
     * @private
     */
    _hasNoDetectedText() {
      const ocr = this._analysisRef && this._analysisRef.ocr;
      if (!ocr || !NO_DETECTION_ENDED_STATUSES.includes(ocr.status)) return false;
      const detected = ocr.items ? ocr.items.length : 0;
      return detected === 0;
    },

    /**
     * H-96: set (or restore) the words that change when nothing was detected:
     * the button's label, its description, and the three review panel names.
     * Every string comes from NO_DETECTION_WORDING. Writes only when changed.
     * @param {HTMLElement} reviewBtn - the Review OCR control
     * @param {boolean} noDetection - whether to use the no-detection words
     * @private
     */
    _applyNoDetectionWording(reviewBtn, noDetection) {
      const W = NO_DETECTION_WORDING;

      // The label is the button's last non-empty text node; the icon span is left alone.
      const labelNode = Array.from(reviewBtn.childNodes)
        .reverse()
        .find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      if (labelNode) {
        const wanted = noDetection ? W.BUTTON_LABEL : W.BUTTON_LABEL_DETECTED;
        if (labelNode.textContent.trim() !== wanted) labelNode.textContent = " " + wanted + " ";
      }

      if (noDetection) {
        const target = document.getElementById(REVIEW_COUNT_ID);
        if (target) {
          target.textContent = W.BUTTON_DESCRIPTION;
          reviewBtn.setAttribute("aria-describedby", REVIEW_COUNT_ID);
        }
      }

      const names = [
        ["imgdesc-overlay-review-panel", W.PANEL_REGION_NAME, W.PANEL_REGION_NAME_DETECTED],
        ["imgdesc-review-list-panel", W.LIST_REGION_NAME, W.LIST_REGION_NAME_DETECTED],
        ["imgdesc-review-list", W.LIST_NAME, W.LIST_NAME_DETECTED],
      ];
      names.forEach(([id, own, detected]) => {
        const el = document.getElementById(id);
        const wanted = noDetection ? own : detected;
        if (el && el.getAttribute("aria-label") !== wanted) el.setAttribute("aria-label", wanted);
      });
    },

    /**
     * Describe how much text is available to review, on the control itself
     * (H-6c). The completion announcement carries only the state change; the
     * detail belongs on the control, where it is spoken when the user reaches
     * it — the settled house pattern at setReanalyseWarning in
     * image-describer-controller-analysis.js.
     *
     * It lives HERE, beside reviewBtn.disabled, rather than at the two
     * analysis-completion sites, so the description and the button's enabled
     * state are computed from one predicate and cannot disagree. The Florence
     * OCR merge re-renders through setAnalysis() and changes ocr.items.length
     * without a fresh completion, so a description written at completion time
     * alone would go stale and state a count the button no longer matches.
     *
     * The attribute is ADDED only while there is something to review and
     * REMOVED otherwise, so a user with nothing to review is never told about
     * text that is not there.
     *
     * @param {HTMLElement} reviewBtn - the Review OCR control
     * @param {number} count - OCR items available to review; 0 removes it
     * @private
     */
    _setReviewCountDescription(reviewBtn, count) {
      const target = document.getElementById(REVIEW_COUNT_ID);
      if (!target) return;

      if (count > 0) {
        target.textContent =
          count === 1
            ? "1 text item detected in this image, available to review and correct."
            : count +
              " text items detected in this image, available to review and correct.";
        reviewBtn.setAttribute("aria-describedby", REVIEW_COUNT_ID);
      } else {
        target.textContent = "";
        reviewBtn.removeAttribute("aria-describedby");
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
  };

  logInfo("Module loaded");
})();
