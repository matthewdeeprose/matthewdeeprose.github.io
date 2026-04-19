/**
 * Image Describer Overlay System — Review Mode
 * Interactive OCR editing, review list, keyboard navigation, draw-to-add.
 * Mixes into window.ImageDescriberOverlay (created by core module).
 *
 * Phase 5D-2: Review mode (edit/confirm/remove).
 * Phase 5D-3: Add new items (keyboard entry + draw-to-add).
 * Phase 6B-1: Review list panel.
 * Phase 6B-2: Review list keyboard navigation + unsaved-changes guard.
 *
 * @version 1.0.0
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
      console.error("[OverlayReview]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[OverlayReview]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[OverlayReview]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[OverlayReview]", message, ...args);
  }

  // ── Duplicated helpers (IIFE-scoped in core; review needs its own copies) ──

  const esc =
    window.escapeHtml ||
    function (text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    };

  function getConfidenceLevel(confidence) {
    if (confidence >= 0.7) return "high";
    if (confidence >= 0.4) return "medium";
    return "low";
  }

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

  // ════════════════════════════════════════════════════════════════════
  // Review methods — mixed into window.ImageDescriberOverlay
  // ════════════════════════════════════════════════════════════════════

  const methods = {

    // ══════════════════════════════════════════════════════════════════
    // Phase 5D-2: Review Mode
    // ══════════════════════════════════════════════════════════════════

    /**
     * Ensure the _userEdits store exists. Creates it if not yet initialised.
     * @private
     */
    _ensureEditsStore() {
      if (!this._userEdits) {
        this._userEdits = {
          corrections: {},
          additions: [],
          objectRemovals: new Set(), // Phase 10C: removed Florence-2 object indices
          lastEditTime: null,
          editCount: 0,
        };
      }
      // Phase 10C: ensure objectRemovals exists (for stores created before 10C)
      if (!this._userEdits.objectRemovals) {
        this._userEdits.objectRemovals = new Set();
      }
    },

    /**
     * Enter review mode — makes OCR boxes interactive.
     */
    enterReviewMode() {
      if (!this._analysisRef || !this._layers.ocr) return;
      const hasItems = this._sortedItems.length > 0;
      if (!hasItems) return;

      this._inReviewMode = true;

      // Enable pointer events on OCR layer
      this._layers.ocr.classList.add("imgdesc-review-active");

      // Ensure OCR layer is visible
      this.showLayer("ocr");

      // Update toolbar button
      const reviewBtn = document.getElementById("imgdesc-overlay-review-btn");
      if (reviewBtn) reviewBtn.setAttribute("aria-pressed", "true");

      // Initialise edits store if not yet done
      this._ensureEditsStore();

      // Update aria-labels on all boxes to hint keyboard usage
      const boxes = this._layers.ocr.querySelectorAll(".imgdesc-overlay-box");
      boxes.forEach(function (box) {
        const existing = box.getAttribute("aria-label") || "";
        if (!existing.includes("Press Enter to edit")) {
          box.setAttribute("aria-label", existing + ". Press Enter to edit");
        }
      });

      // Show add item controls (Phase 5D-3)
      const addControls = document.getElementById("imgdesc-add-item-controls");
      if (addControls) addControls.hidden = false;

      // Phase 7B: show sidebar wrapper
      const sidebar = document.getElementById("imgdesc-review-sidebar");
      if (sidebar) sidebar.hidden = false;

      // Phase 7B: toggle sidebar layout class when in fullscreen
      const workspace = document.getElementById("imgdesc-workspace");
      if (workspace && workspace.classList.contains("imgdesc-workspace--fullscreen")) {
        workspace.classList.add("imgdesc-workspace--review-active");
        // Show expand toggle (CSS hides it at narrow breakpoints)
        const expandToggle = document.getElementById("imgdesc-expand-toggle");
        if (expandToggle) expandToggle.hidden = false;
      }

      // Phase 6B-1: render review list
      this._renderReviewList();

      // Bind click handler (event delegation on layer)
      const self = this;
      this._reviewClickHandler = function (e) {
        const box = e.target.closest
          ? e.target.closest(".imgdesc-overlay-box")
          : null;
        if (box) {
          e.stopPropagation();
          const index = parseInt(box.getAttribute("data-index"), 10);
          if (!isNaN(index)) {
            self.selectOCRItem(index);
          } else {
            const addIndex = parseInt(
              box.getAttribute("data-addition-index"),
              10,
            );
            if (!isNaN(addIndex)) {
              self.selectAddedItem(addIndex);
            }
          }
        }
      };
      this._layers.ocr.addEventListener("click", this._reviewClickHandler, true);

      // Bind keyboard handler
      this._reviewKeyHandler = function (e) {
        self._handleReviewKeydown(e);
      };
      this._layers.ocr.addEventListener("keydown", this._reviewKeyHandler);

      // Phase 10C: also make objects layer interactive for review
      if (this._layers.objects) {
        this._layers.objects.classList.add("imgdesc-review-active");

        // Ensure objects layer is visible if it has content
        if (this._layers.objects.children.length > 0) {
          this.showLayer("objects");
        }

        // Update aria-labels on object boxes
        var objBoxes = this._layers.objects.querySelectorAll(".imgdesc-overlay-box-object");
        objBoxes.forEach(function (box) {
          var existing = box.getAttribute("aria-label") || "";
          if (!existing.includes("Press Enter to review")) {
            box.setAttribute("aria-label", existing + ". Press Enter to review");
          }
        });

        // Click handler for object boxes
        this._reviewObjectClickHandler = function (e) {
          var box = e.target.closest
            ? e.target.closest(".imgdesc-overlay-box-object")
            : null;
          if (box) {
            e.stopPropagation();
            var objIndex = parseInt(box.getAttribute("data-index"), 10);
            if (!isNaN(objIndex)) {
              self.selectObjectItem(objIndex);
            }
          }
        };
        this._layers.objects.addEventListener("click", this._reviewObjectClickHandler, true);

        // Keyboard handler for object boxes
        this._reviewObjectKeyHandler = function (e) {
          var box = e.target.closest
            ? e.target.closest(".imgdesc-overlay-box-object")
            : null;
          if (box && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            var objIndex = parseInt(box.getAttribute("data-index"), 10);
            if (!isNaN(objIndex)) {
              self.selectObjectItem(objIndex);
            }
          }
        };
        this._layers.objects.addEventListener("keydown", this._reviewObjectKeyHandler);
      }

      // Phase 6B-2: Escape handler on review panel so pressing Escape
      // while editing (focus on text input or buttons) deselects the item
      const reviewPanel = document.getElementById("imgdesc-overlay-review-panel");
      if (reviewPanel) {
        this._reviewPanelKeyHandler = function (e) {
          if (e.key !== "Escape") return;
          e.preventDefault();
          e.stopPropagation();
          if (self._selectedIndex === null && self._selectedAdditionIndex === null) return;

          // Check for unsaved text changes
          const textInput = document.getElementById("imgdesc-review-text");
          const currentText = textInput ? textInput.value : "";
          const originalText = self._reviewPanelOriginalText || "";
          const hasUnsavedChanges = currentText.trim() !== originalText.trim();

          if (hasUnsavedChanges && typeof window.safeConfirm === "function") {
            window.safeConfirm(
              "You have unsaved changes to this item. Discard them?",
              "Unsaved Changes"
            ).then(function (discard) {
              if (discard) {
                self.deselectOCRItem();
              } else {
                // Return focus to the text input so the user can continue editing
                if (textInput) textInput.focus();
              }
            });
          } else {
            self.deselectOCRItem();
          }
        };
        reviewPanel.addEventListener("keydown", this._reviewPanelKeyHandler);
      }

      logInfo("Entered review mode");
    },

    /**
     * Exit review mode.
     */
    /**
     * Phase 11D: Persist user edits to IndexedDB cache (fire-and-forget).
     * Serialises Sets to Arrays for storage compatibility.
     * @private
     */
    _persistUserEdits() {
      const ctrl = window.ImageDescriberController;
      const cache = window.ImageDescriberCache;
      if (!ctrl || !ctrl.currentFileHash || !cache) return;

      const edits = this._userEdits;
      if (!edits) return;

      // Serialise the Set to Array for IndexedDB storage
      const serialisable = Object.assign({}, edits);
      if (edits.objectRemovals instanceof Set) {
        serialisable.objectRemovals = Array.from(edits.objectRemovals);
      }

      cache.saveUserEdits(ctrl.currentFileHash, serialisable).catch(function (err) {
        // Fire-and-forget — log but do not throw
        logWarn("[OverlayReview] Failed to persist user edits:", err.message);
      });
    },

    exitReviewMode() {
      this._inReviewMode = false;

      if (this._layers.ocr) {
        this._layers.ocr.classList.remove("imgdesc-review-active");

        // Remove click handler
        if (this._reviewClickHandler) {
          this._layers.ocr.removeEventListener(
            "click",
            this._reviewClickHandler,
            true,
          );
          this._reviewClickHandler = null;
        }

        // Remove keyboard handler
        if (this._reviewKeyHandler) {
          this._layers.ocr.removeEventListener(
            "keydown",
            this._reviewKeyHandler,
          );
          this._reviewKeyHandler = null;
        }
      }

      // Phase 10C: clean up objects layer review state
      if (this._layers.objects) {
        this._layers.objects.classList.remove("imgdesc-review-active");
        if (this._reviewObjectClickHandler) {
          this._layers.objects.removeEventListener("click", this._reviewObjectClickHandler, true);
          this._reviewObjectClickHandler = null;
        }
        if (this._reviewObjectKeyHandler) {
          this._layers.objects.removeEventListener("keydown", this._reviewObjectKeyHandler);
          this._reviewObjectKeyHandler = null;
        }
        // Remove review hints from object box aria-labels
        var objBoxes = this._layers.objects.querySelectorAll(".imgdesc-overlay-box-object");
        objBoxes.forEach(function (box) {
          var label = box.getAttribute("aria-label") || "";
          box.setAttribute("aria-label", label.replace(". Press Enter to review", ""));
        });
      }

      // Deselect any selected item
      this._doDeselect();

      // Hide review panel
      const panel = document.getElementById("imgdesc-overlay-review-panel");
      if (panel) panel.hidden = true;

      // Hide add item controls (Phase 5D-3)
      const addControls = document.getElementById("imgdesc-add-item-controls");
      if (addControls) addControls.hidden = true;
      const addForm = document.getElementById("imgdesc-add-keyboard-form");
      if (addForm) addForm.hidden = true;

      // Phase 6B-1: hide review list panel and remove its click handler
      const listPanel = document.getElementById("imgdesc-review-list-panel");
      if (listPanel) listPanel.hidden = true;
      if (this._reviewListClickHandler) {
        const listEl = document.getElementById("imgdesc-review-list");
        if (listEl) listEl.removeEventListener("click", this._reviewListClickHandler);
        this._reviewListClickHandler = null;
      }
      // Phase 6B-2: remove keyboard handler from list
      if (this._reviewListKeyHandler) {
        const listEl2 = document.getElementById("imgdesc-review-list");
        if (listEl2) listEl2.removeEventListener("keydown", this._reviewListKeyHandler);
        this._reviewListKeyHandler = null;
      }
      // Phase 6B-2: remove Escape handler from review panel
      if (this._reviewPanelKeyHandler) {
        const rp = document.getElementById("imgdesc-overlay-review-panel");
        if (rp) rp.removeEventListener("keydown", this._reviewPanelKeyHandler);
        this._reviewPanelKeyHandler = null;
      }

      // Phase 7B: hide sidebar wrapper
      const sidebar = document.getElementById("imgdesc-review-sidebar");
      if (sidebar) sidebar.hidden = true;

      // Phase 7B: remove sidebar layout class and expanded mode
      const workspace = document.getElementById("imgdesc-workspace");
      if (workspace) {
        workspace.classList.remove("imgdesc-workspace--review-active");
        workspace.classList.remove("imgdesc-workspace--expanded");
      }
      // Hide expand toggle and reset state
      const expandToggle = document.getElementById("imgdesc-expand-toggle");
      if (expandToggle) {
        expandToggle.hidden = true;
        expandToggle.setAttribute("aria-pressed", "false");
        // Reset button text — find the last text node
        var nodes = expandToggle.childNodes;
        for (var ni = nodes.length - 1; ni >= 0; ni--) {
          if (nodes[ni].nodeType === Node.TEXT_NODE && nodes[ni].textContent.trim().length > 0) {
            nodes[ni].textContent = "\n                      Expand Image\n                    ";
            break;
          }
        }
      }

      // Stop draw mode if active (Phase 5D-3)
      if (this._inDrawMode) this.stopDrawMode();
      this._pendingDrawBounds = null;

      // Update toolbar button
      const reviewBtn = document.getElementById("imgdesc-overlay-review-btn");
      if (reviewBtn) reviewBtn.setAttribute("aria-pressed", "false");

      // Remove "Press Enter to edit" hints from aria-labels
      if (this._layers.ocr) {
        const boxes = this._layers.ocr.querySelectorAll(".imgdesc-overlay-box");
        boxes.forEach(function (box) {
          const label = box.getAttribute("aria-label") || "";
          box.setAttribute(
            "aria-label",
            label.replace(". Press Enter to edit", ""),
          );
        });
      }

      // Phase 11D: persist user edits as safety net
      this._persistUserEdits();

      logInfo("Exited review mode");
    },

    /**
     * Toggle review mode on or off.
     */
    toggleReviewMode() {
      if (this._inReviewMode) {
        this.exitReviewMode();
      } else {
        this.enterReviewMode();
      }
    },

    /**
     * Select an OCR item for review.
     * @param {number} index - Overlay index (position in _sortedItems)
     */
    selectOCRItem(index) {
      if (!this._inReviewMode) return;
      if (!this._layers.ocr) return;

      // Deselect any previous selection
      this._doDeselect();

      const box = this._layers.ocr.querySelector(
        '[data-index="' + index + '"]',
      );
      if (!box) {
        logWarn("selectOCRItem: no box found for index " + index);
        return;
      }

      const entry = this._sortedItems[index];
      if (!entry) {
        logWarn("selectOCRItem: no sorted item at index " + index);
        return;
      }

      box.classList.add("imgdesc-selected");
      this._selectedIndex = index;

      // Populate review panel
      const panel = document.getElementById("imgdesc-overlay-review-panel");
      const textInput = document.getElementById("imgdesc-review-text");
      const confEl = document.getElementById("imgdesc-review-confidence");
      const posEl = document.getElementById("imgdesc-review-position");
      const srcEl = document.getElementById("imgdesc-review-source");

      if (textInput) {
        // Use corrected text if already edited, otherwise original
        const existing =
          this._userEdits &&
          this._userEdits.corrections[index] &&
          this._userEdits.corrections[index].correctedText;
        textInput.value = existing || entry.item.text || "";
      }
      if (confEl) {
        const hasConf = entry.item.confidence !== null && entry.item.confidence !== undefined;
        confEl.textContent = hasConf
          ? Math.round(entry.item.confidence * 100) + "%"
          : "N/A";
      }
      if (posEl) {
        posEl.textContent = entry.item.quadrant || "unknown";
      }
      if (srcEl) {
        const SOURCE_LABELS = {
          "tesseract": "Tesseract",
          "primary": "Primary",
          "preprocessed": "Preprocessed",
          "florence2": "Florence-2",
          "user": "User",
        };
        srcEl.textContent = SOURCE_LABELS[entry.item.source] || entry.item.source || "Primary";
        if (entry.suppressed) {
          srcEl.textContent += " (suppressed)";
        }
      }

      if (panel) panel.hidden = false;

      // Orientation field is only for user-added items — hide it for Tesseract items
      const ocrOrientField = document.getElementById("imgdesc-review-orientation-field");
      if (ocrOrientField) ocrOrientField.hidden = true;

      // Phase 6B-2: store original text for unsaved-changes check on Escape
      this._reviewPanelOriginalText = textInput ? textInput.value : "";

      // Focus the text input
      if (textInput) textInput.focus();

      // Phase 6B-1: highlight corresponding list row
      const listEl = document.getElementById("imgdesc-review-list");
      if (listEl) {
        const listRow = listEl.querySelector('[data-index="' + index + '"]');
        this._highlightListRow(listRow || null);
      }

      logDebug("Selected OCR item", index);
    },

    /**
     * Select a user-added item for review (edit or remove).
     * @param {number} additionIndex - Index in _userEdits.additions
     */
    selectAddedItem(additionIndex) {
      if (!this._inReviewMode) return;
      if (!this._layers.ocr) return;
      if (!this._userEdits || !this._userEdits.additions[additionIndex]) {
        logWarn("selectAddedItem: no addition at index " + additionIndex);
        return;
      }

      // Deselect any previous selection
      this._doDeselect();

      const box = this._layers.ocr.querySelector(
        '[data-addition-index="' + additionIndex + '"]',
      );
      if (!box) {
        logWarn("selectAddedItem: no box found for index " + additionIndex);
        return;
      }

      const addition = this._userEdits.additions[additionIndex];

      box.classList.add("imgdesc-selected");
      this._selectedAdditionIndex = additionIndex;

      // Populate review panel
      const panel = document.getElementById("imgdesc-overlay-review-panel");
      const textInput = document.getElementById("imgdesc-review-text");
      const confEl = document.getElementById("imgdesc-review-confidence");
      const posEl = document.getElementById("imgdesc-review-position");
      const srcEl = document.getElementById("imgdesc-review-source");

      if (textInput) textInput.value = addition.text || "";
      if (confEl) confEl.textContent = "User-added (100%)";
      if (posEl) posEl.textContent = addition.quadrant || "unknown";
      if (srcEl) srcEl.textContent = "User";

      if (panel) panel.hidden = false;

      // Show orientation field and populate with this item's orientation
      const addedOrientField = document.getElementById("imgdesc-review-orientation-field");
      if (addedOrientField) addedOrientField.hidden = false;
      const addedOrientSelect = document.getElementById("imgdesc-review-orientation");
      if (addedOrientSelect) addedOrientSelect.value = addition.orientation || "horizontal";

      // Phase 6B-2: store original text for unsaved-changes check on Escape
      this._reviewPanelOriginalText = textInput ? textInput.value : "";

      if (textInput) textInput.focus();

      // Phase 6B-1: highlight corresponding list row
      const listEl = document.getElementById("imgdesc-review-list");
      if (listEl) {
        const listRow = listEl.querySelector('[data-addition-index="' + additionIndex + '"]');
        this._highlightListRow(listRow || null);
      }

      logDebug("Selected added item", additionIndex);
    },

    /**
     * Deselect the currently selected item and hide the review panel.
     * Returns focus to the next item in the review list (if visible),
     * or falls back to the bounding box on the image.
     */
    deselectOCRItem() {
      const prevIndex = this._selectedIndex;
      const prevAddIndex = this._selectedAdditionIndex;

      // Phase 6B-2: find position of the deselected row in the list BEFORE clearing state
      let listFocusPos = -1;
      const listPanel = document.getElementById("imgdesc-review-list-panel");
      const listEl = document.getElementById("imgdesc-review-list");
      if (listPanel && !listPanel.hidden && listEl) {
        let prevRow = null;
        if (prevIndex !== null) {
          prevRow = listEl.querySelector('[data-index="' + prevIndex + '"]');
        } else if (prevAddIndex !== null) {
          prevRow = listEl.querySelector('[data-addition-index="' + prevAddIndex + '"]');
        }
        if (prevRow) {
          const items = Array.from(listEl.querySelectorAll(".imgdesc-review-list-item"));
          const pos = items.indexOf(prevRow);
          // Target the next item, or stay at end if it was the last
          listFocusPos = pos < items.length - 1 ? pos + 1 : Math.max(0, pos - 1);
        }
      }

      this._doDeselect();

      // Phase 6B-2: return focus to the review list at the next position
      if (listFocusPos >= 0 && listEl) {
        const items = listEl.querySelectorAll(".imgdesc-review-list-item");
        if (items.length > 0) {
          const target = Math.min(listFocusPos, items.length - 1);
          items[target].focus();
          return;
        }
      }

      // Fallback: return focus to the bounding box on the image
      if (this._layers.ocr) {
        let box = null;
        if (prevIndex !== null) {
          box = this._layers.ocr.querySelector('[data-index="' + prevIndex + '"]');
        } else if (prevAddIndex !== null) {
          box = this._layers.ocr.querySelector(
            '[data-addition-index="' + prevAddIndex + '"]',
          );
        }
        if (box) box.focus();
      }
    },

    /**
     * Internal deselect — removes selected state without returning focus.
     * @private
     */
    _doDeselect() {
      if (this._layers.ocr) {
        const prev = this._layers.ocr.querySelector(".imgdesc-selected");
        if (prev) prev.classList.remove("imgdesc-selected");
      }
      // Phase 10C: also deselect in objects layer
      if (this._layers.objects) {
        const prevObj = this._layers.objects.querySelector(".imgdesc-selected");
        if (prevObj) prevObj.classList.remove("imgdesc-selected");
      }
      this._selectedIndex = null;
      this._selectedAdditionIndex = null;
      this._selectedObjectIndex = null; // Phase 10C
      this._reviewPanelOriginalText = null;

      const panel = document.getElementById("imgdesc-overlay-review-panel");
      if (panel) panel.hidden = true;

      // Hide orientation field (only visible for user-added items)
      const deselectOrientField = document.getElementById("imgdesc-review-orientation-field");
      if (deselectOrientField) deselectOrientField.hidden = true;

      // Phase 6B-1: clear list selection
      this._highlightListRow(null);
    },

    // ══════════════════════════════════════════════════════════════════
    // Phase 6B-1: Review List
    // ══════════════════════════════════════════════════════════════════

    /**
     * Render the review list panel with all detected + user-added items.
     * Called from enterReviewMode().
     * @private
     */
    _renderReviewList() {
      const listEl = document.getElementById("imgdesc-review-list");
      const listPanel = document.getElementById("imgdesc-review-list-panel");
      if (!listEl || !listPanel) return;

      // Clear existing content
      listEl.innerHTML = "";

      // Render sorted OCR items
      const sortedLen = this._sortedItems ? this._sortedItems.length : 0;
      for (let i = 0; i < sortedLen; i++) {
        const entry = this._sortedItems[i];
        const row = this._createListItem(entry, i, "sorted");
        listEl.appendChild(row);
      }

      // Render user-added items
      const additions = this._userEdits ? this._userEdits.additions : [];
      for (let ai = 0; ai < additions.length; ai++) {
        if (additions[ai].status === "removed") continue;
        const row = this._createListItem(additions[ai], ai, "addition");
        listEl.appendChild(row);
      }

      // Bind click handler on list (event delegation)
      const self = this;
      this._reviewListClickHandler = function (e) {
        const row = e.target.closest
          ? e.target.closest(".imgdesc-review-list-item")
          : null;
        if (!row) return;
        e.stopPropagation();

        const sortedIndex = row.getAttribute("data-index");
        const addIndex = row.getAttribute("data-addition-index");
        if (sortedIndex !== null) {
          self.selectOCRItem(parseInt(sortedIndex, 10));
        } else if (addIndex !== null) {
          self.selectAddedItem(parseInt(addIndex, 10));
        }
      };
      listEl.addEventListener("click", this._reviewListClickHandler);

      // Phase 6B-2: bind keyboard handler for arrow nav, Enter/Space, Escape
      this._reviewListKeyHandler = function (e) {
        self._handleListKeydown(e);
      };
      listEl.addEventListener("keydown", this._reviewListKeyHandler);

      // Update header counts
      this._updateReviewListHeader();

      // Show the panel
      listPanel.hidden = false;

      logDebug("Review list rendered: " + sortedLen + " sorted + " + additions.filter(function (a) { return a.status !== "removed"; }).length + " additions");
    },

    /**
     * Create a single list item row.
     * @param {Object} entry - A _sortedItems entry or an addition object
     * @param {number} index - Index in _sortedItems or _userEdits.additions
     * @param {string} type - "sorted" or "addition"
     * @returns {HTMLElement}
     * @private
     */
    _createListItem(entry, index, type) {
      const row = document.createElement("div");
      row.className = "imgdesc-review-list-item";
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", "false");
      row.setAttribute("tabindex", "0");

      if (type === "sorted") {
        row.setAttribute("data-index", String(index));
        const item = entry.item;
        const confidence = item.confidence || 0;
        const level = getConfidenceLevel(confidence);
        const text = item.text || "";

        // Suppressed indicator
        if (entry.suppressed) {
          row.setAttribute("data-suppressed", "true");
        }

        // Confidence badge
        const badge = document.createElement("span");
        badge.className = "imgdesc-review-confidence-badge";
        badge.setAttribute("data-level", level);
        badge.textContent = Math.round(confidence * 100) + "%";
        row.appendChild(badge);

        // Text
        const textSpan = document.createElement("span");
        textSpan.className = "imgdesc-review-list-text";
        // Use corrected text if available
        const corrected = this._userEdits &&
          this._userEdits.corrections[index] &&
          this._userEdits.corrections[index].correctedText;
        const displayText = corrected || text;
        textSpan.textContent = displayText.length > 40
          ? displayText.substring(0, 37) + "..."
          : displayText;
        if (displayText.length > 40) {
          textSpan.setAttribute("aria-label", displayText);
        }
        row.appendChild(textSpan);

        // Status badge (if correction exists)
        const correction = this._userEdits && this._userEdits.corrections[index];
        if (correction && correction.status) {
          const statusBadge = document.createElement("span");
          statusBadge.className = "imgdesc-review-status-badge";
          statusBadge.setAttribute("data-status", correction.status);
          statusBadge.textContent = correction.status;
          row.appendChild(statusBadge);
        }

        // Accessible label
        let ariaText = displayText + ", confidence " + Math.round(confidence * 100) + " percent";
        if (entry.suppressed) ariaText += ", suppressed";
        if (correction && correction.status) ariaText += ", " + correction.status;
        row.setAttribute("aria-label", ariaText);

      } else {
        // User-added item
        row.setAttribute("data-addition-index", String(index));

        // "User added" badge
        const badge = document.createElement("span");
        badge.className = "imgdesc-review-confidence-badge";
        badge.setAttribute("data-level", "user");
        badge.textContent = "User added";
        row.appendChild(badge);

        // Text
        const textSpan = document.createElement("span");
        textSpan.className = "imgdesc-review-list-text";
        const addText = entry.text || "";
        textSpan.textContent = addText.length > 40
          ? addText.substring(0, 37) + "..."
          : addText;
        if (addText.length > 40) {
          textSpan.setAttribute("aria-label", addText);
        }
        row.appendChild(textSpan);

        // Orientation badge for non-horizontal items
        if (entry.orientation && entry.orientation !== "horizontal") {
          const orientBadge = document.createElement("span");
          orientBadge.className = "imgdesc-review-list-badge";
          orientBadge.textContent = entry.orientation === "vertical-up" ? "\u2191 vertical" : "\u2193 vertical";
          row.appendChild(orientBadge);
        }

        // Accessible label
        const orientLabel = entry.orientation && entry.orientation !== "horizontal"
          ? ", " + (entry.orientation === "vertical-up" ? "vertical reads upward" : "vertical reads downward")
          : "";
        row.setAttribute("aria-label", addText + ", user added" + orientLabel);
      }

      return row;
    },

    /**
     * Update the review list header with item counts.
     * @private
     */
    _updateReviewListHeader() {
      const countEl = document.getElementById("imgdesc-review-list-count");
      const statusEl = document.getElementById("imgdesc-review-list-status");
      if (!countEl) return;

      const sortedLen = this._sortedItems ? this._sortedItems.length : 0;
      const additionsLen = this._userEdits && this._userEdits.additions
        ? this._userEdits.additions.filter(function (a) { return a.status !== "removed"; }).length
        : 0;
      const total = sortedLen + additionsLen;
      countEl.textContent = total + " item" + (total !== 1 ? "s" : "") + " detected";

      // Status summary
      if (statusEl && this._userEdits) {
        const corrections = this._userEdits.corrections || {};
        let correctedCount = 0;
        let removedCount = 0;
        let confirmedCount = 0;
        for (const key in corrections) {
          if (corrections[key].status === "corrected") correctedCount++;
          else if (corrections[key].status === "removed") removedCount++;
          else if (corrections[key].status === "confirmed") confirmedCount++;
        }
        const parts = [];
        if (correctedCount > 0) parts.push(correctedCount + " corrected");
        if (removedCount > 0) parts.push(removedCount + " removed");
        if (confirmedCount > 0) parts.push(confirmedCount + " confirmed");
        if (additionsLen > 0) parts.push(additionsLen + " added");
        statusEl.textContent = parts.length > 0 ? parts.join(", ") : "";
      }
    },

    /**
     * Re-render the review list preserving scroll position.
     * Called after confirm, remove, restore, and add actions to fix Known Issue #22.
     * @private
     */
    _refreshReviewList() {
      if (!this._inReviewMode) return;
      const listEl = document.getElementById("imgdesc-review-list");
      const savedScroll = listEl ? listEl.scrollTop : 0;

      // Save focused row position so we can restore it after re-render
      let savedFocusPos = -1;
      if (listEl) {
        const items = Array.from(listEl.querySelectorAll(".imgdesc-review-list-item"));
        const focusedPos = items.indexOf(document.activeElement);
        if (focusedPos >= 0) {
          savedFocusPos = focusedPos;
        }
      }

      // Remove old handlers before re-render (re-render rebinds them)
      if (this._reviewListClickHandler && listEl) {
        listEl.removeEventListener("click", this._reviewListClickHandler);
        this._reviewListClickHandler = null;
      }
      if (this._reviewListKeyHandler && listEl) {
        listEl.removeEventListener("keydown", this._reviewListKeyHandler);
        this._reviewListKeyHandler = null;
      }

      this._renderReviewList();

      // Restore scroll position and focus
      const newListEl = document.getElementById("imgdesc-review-list");
      if (newListEl) {
        newListEl.scrollTop = savedScroll;

        // Restore focus to the same position (or nearest if list shrank)
        if (savedFocusPos >= 0) {
          const newItems = newListEl.querySelectorAll(".imgdesc-review-list-item");
          if (newItems.length > 0) {
            const target = Math.min(savedFocusPos, newItems.length - 1);
            newItems[target].focus();
          }
        }
      }

      logDebug("Review list refreshed after action");
    },

    /**
     * Highlight a specific list row and remove highlight from all others.
     * @param {HTMLElement|null} targetRow - The row to highlight, or null to clear
     * @private
     */
    _highlightListRow(targetRow) {
      const listEl = document.getElementById("imgdesc-review-list");
      if (!listEl) return;

      // Remove existing highlight
      const prev = listEl.querySelector(".imgdesc-list-selected");
      if (prev) {
        prev.classList.remove("imgdesc-list-selected");
        prev.setAttribute("aria-selected", "false");
      }

      // Apply new highlight
      if (targetRow) {
        targetRow.classList.add("imgdesc-list-selected");
        targetRow.setAttribute("aria-selected", "true");
        // Scroll into view if needed
        targetRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    },

    /**
     * Keyboard handler for the review list panel.
     * Arrow Up/Down moves focus between list items.
     * Enter/Space selects the focused item.
     * Escape deselects (first press) or exits review mode (second press).
     * @param {KeyboardEvent} e
     * @private
     */
    _handleListKeydown(e) {
      const listEl = document.getElementById("imgdesc-review-list");
      if (!listEl) return;

      const items = Array.from(listEl.querySelectorAll(".imgdesc-review-list-item"));
      if (items.length === 0) return;

      const focused = document.activeElement;
      const currentIdx = items.indexOf(focused);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = currentIdx < items.length - 1 ? currentIdx + 1 : 0;
        items[next].focus();
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : items.length - 1;
        items[prev].focus();
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        if (currentIdx < 0) return;
        e.preventDefault();
        const row = items[currentIdx];
        const sortedIndex = row.getAttribute("data-index");
        const addIndex = row.getAttribute("data-addition-index");
        if (sortedIndex !== null) {
          this.selectOCRItem(parseInt(sortedIndex, 10));
        } else if (addIndex !== null) {
          this.selectAddedItem(parseInt(addIndex, 10));
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (this._selectedIndex !== null || this._selectedAdditionIndex !== null) {
          this.deselectOCRItem();
        } else {
          this.exitReviewMode();
        }
      }
    },

    /**
     * Confirm the currently selected item — stores correction or confirmation.
     * Also handles confirming a drawn item (Phase 5D-3: _pendingDrawBounds set).
     */
    confirmSelectedItem() {
      // Phase 5D-3: confirming a drawn item
      if (this._pendingDrawBounds) {
        const textInput = document.getElementById("imgdesc-review-text");
        const newText = textInput ? textInput.value.trim() : "";
        const bounds = this._pendingDrawBounds;
        this._pendingDrawBounds = null;

        const reviewPanel = document.getElementById(
          "imgdesc-overlay-review-panel",
        );
        if (reviewPanel) reviewPanel.hidden = true;

        if (newText) {
          const drawOrientSelect = document.getElementById("imgdesc-review-orientation");
          const drawOrientation = drawOrientSelect ? drawOrientSelect.value : "horizontal";
          this.addItemFromKeyboard(
            newText,
            bounds.x * 100,
            bounds.y * 100,
            bounds.w * 100,
            bounds.h * 100,
            drawOrientation,
          );
        } else {
          logDebug("Draw confirm cancelled — no text entered");
        }
        return;
      }

      // Confirming a user-added item — update its text
      if (this._selectedAdditionIndex !== null) {
        const addIndex = this._selectedAdditionIndex;
        const addition =
          this._userEdits && this._userEdits.additions[addIndex];
        if (addition) {
          const textInput = document.getElementById("imgdesc-review-text");
          const newText = textInput
            ? textInput.value.trim()
            : addition.text;
          if (newText) {
            addition.text = newText;
            const editOrientSelect = document.getElementById("imgdesc-review-orientation");
            if (editOrientSelect) {
              addition.orientation = editOrientSelect.value || "horizontal";
            }
            this._userEdits.editCount += 1;
            this._userEdits.lastEditTime = Date.now();

            // Update the box label
            const box = this._layers.ocr
              ? this._layers.ocr.querySelector(
                  '[data-addition-index="' + addIndex + '"]',
                )
              : null;
            if (box) {
              const labelSpan = box.querySelector(".imgdesc-overlay-box-label");
              if (labelSpan) labelSpan.textContent = newText;
              // Update accessible label
              box.setAttribute(
                "aria-label",
                "User-added OCR item: " + newText + ", " + addition.quadrant + " quadrant",
              );
            }
            logInfo("Added item " + addIndex + " updated: " + newText);
            // Phase 11D: persist user edits
            this._persistUserEdits();
          }
        }
        this.deselectOCRItem();
        this._refreshReviewList();
        return;
      }

      if (this._selectedIndex === null) return;

      const index = this._selectedIndex;
      const entry = this._sortedItems[index];
      if (!entry) return;

      const textInput = document.getElementById("imgdesc-review-text");
      const newText = textInput ? textInput.value.trim() : entry.item.text;
      const originalText = entry.item.text || "";

      this._ensureEditsStore();

      let status;
      if (entry.suppressed) {
        // Confirming a suppressed item restores it to the active list
        status = "restored";
        this._userEdits.corrections[index] = { status: "restored" };
      } else if (newText !== originalText) {
        status = "corrected";
        this._userEdits.corrections[index] = {
          originalText: originalText,
          correctedText: newText,
          status: "corrected",
        };
      } else {
        status = "confirmed";
        this._userEdits.corrections[index] = { status: "confirmed" };
      }

      this._userEdits.editCount += 1;
      this._userEdits.lastEditTime = Date.now();

      // Update box visual state
      const box = this._layers.ocr
        ? this._layers.ocr.querySelector('[data-index="' + index + '"]')
        : null;
      if (box) {
        box.setAttribute("data-status", status);
        // Update label text if corrected
        if (status === "corrected") {
          const label = box.querySelector(".imgdesc-overlay-box-label");
          if (label) label.textContent = newText;
        }
      }

      logInfo("Item " + index + " " + status);

      // Phase 11D: persist user edits
      this._persistUserEdits();

      this.deselectOCRItem();
      this._refreshReviewList();
    },

    /**
     * Remove the currently selected item (mark as noise).
     * Works for both sorted OCR items and user-added items.
     */
    removeSelectedItem() {
      // Removing a user-added item — mark removed and remove from DOM
      if (this._selectedAdditionIndex !== null) {
        const addIndex = this._selectedAdditionIndex;
        const addition =
          this._userEdits && this._userEdits.additions[addIndex];
        if (addition) {
          addition.status = "removed";
          this._userEdits.editCount += 1;
          this._userEdits.lastEditTime = Date.now();

          // Remove the box from the DOM
          const box = this._layers.ocr
            ? this._layers.ocr.querySelector(
                '[data-addition-index="' + addIndex + '"]',
              )
            : null;
          if (box && box.parentNode) {
            box.parentNode.removeChild(box);
          }
          logInfo("Added item removed", addIndex);
          // Phase 11D: persist user edits
          this._persistUserEdits();
        }
        this.deselectOCRItem();
        this._refreshReviewList();
        return;
      }

      if (this._selectedIndex === null) return;

      const index = this._selectedIndex;

      this._ensureEditsStore();

      this._userEdits.corrections[index] = { status: "removed" };
      this._userEdits.editCount += 1;
      this._userEdits.lastEditTime = Date.now();

      // Update box visual state
      const box = this._layers.ocr
        ? this._layers.ocr.querySelector('[data-index="' + index + '"]')
        : null;
      if (box) {
        box.setAttribute("data-status", "removed");
      }

      logInfo("Item removed", index);

      // Phase 11D: persist user edits
      this._persistUserEdits();

      this.deselectOCRItem();
      this._refreshReviewList();
    },

    /**
     * Restore a previously corrected or removed item to its original state.
     * @param {number} index
     */
    restoreItem(index) {
      if (!this._userEdits || !this._userEdits.corrections[index]) return;

      delete this._userEdits.corrections[index];

      // Reset box visual state
      const box = this._layers.ocr
        ? this._layers.ocr.querySelector('[data-index="' + index + '"]')
        : null;
      if (box) {
        box.removeAttribute("data-status");
        // Restore label text from sorted items
        const entry = this._sortedItems[index];
        if (entry) {
          const label = box.querySelector(".imgdesc-overlay-box-label");
          if (label) label.textContent = entry.item.text || "";
        }
      }

      logInfo("Item restored", index);
      this._refreshReviewList();
    },

    /**
     * Returns true if the user has made any corrections or additions.
     * @returns {boolean}
     */
    hasCorrections() {
      if (!this._userEdits) return false;
      return (
        Object.keys(this._userEdits.corrections).length > 0 ||
        this._userEdits.additions.length > 0 ||
        (this._userEdits.objectRemovals && this._userEdits.objectRemovals.size > 0)
      );
    },

    /**
     * Return a deep copy of the analysis result with user corrections applied.
     * The original _analysisRef is never mutated.
     * @returns {Object}
     */
    getCorrectedAnalysis() {
      if (!this._analysisRef || !this._userEdits) {
        return this._analysisRef;
      }

      const corrected = JSON.parse(JSON.stringify(this._analysisRef));
      const corrections = this._userEdits.corrections;
      const objectRemovals = this._userEdits.objectRemovals || new Set();
      const hasEdits =
        (corrections && Object.keys(corrections).length > 0) ||
        this._userEdits.additions.length > 0 ||
        objectRemovals.size > 0;

      if (!hasEdits) {
        return corrected;
      }

      // Phase 10C: filter removed Florence-2 objects
      if (
        objectRemovals.size > 0 &&
        corrected.florenceObjects &&
        corrected.florenceObjects.items
      ) {
        corrected.florenceObjects.items = corrected.florenceObjects.items.filter(
          function (item, idx) {
            return !objectRemovals.has(idx);
          }
        );
      }

      const newItems = [];

      for (let i = 0; i < this._sortedItems.length; i++) {
        const entry = this._sortedItems[i];
        const correction = corrections[i];

        if (correction) {
          if (correction.status === "removed") {
            continue; // Skip removed items
          }
          if (correction.status === "corrected") {
            const item = JSON.parse(JSON.stringify(entry.item));
            item.text = correction.correctedText;
            item._corrected = true;
            newItems.push(item);
          } else if (
            correction.status === "confirmed" ||
            correction.status === "restored"
          ) {
            newItems.push(JSON.parse(JSON.stringify(entry.item)));
          }
        } else if (!entry.suppressed) {
          // Uncorrected active item — include as-is
          newItems.push(JSON.parse(JSON.stringify(entry.item)));
        }
        // Uncorrected suppressed items are excluded
      }

      // Append user-added items (Phase 5D-3)
      if (this._userEdits.additions && this._userEdits.additions.length > 0) {
        for (const addition of this._userEdits.additions) {
          if (addition.status !== "removed") {
            newItems.push({
              text: addition.text,
              bounds: addition.bounds,
              quadrant: addition.quadrant,
              confidence: addition.confidence || 1.0,
              source: "user",
              level: "word",
              nearbyColour: null,
              isNumeric: /^[\d.,\-%+]+$/.test((addition.text || "").trim()),
              _userAdded: true,
              orientation: addition.orientation || "horizontal",
            });
          }
        }
      }

      // Re-derive quadrant summary from corrected items
      const quadrantSummary = {
        "top-left": [],
        "top-right": [],
        "bottom-left": [],
        "bottom-right": [],
        centre: [],
      };
      newItems.forEach(function (item) {
        if (quadrantSummary[item.quadrant]) {
          quadrantSummary[item.quadrant].push(item);
        }
      });

      corrected.ocr.items = newItems;
      corrected.ocr.labelCount = newItems.length;
      corrected.ocr.quadrantSummary = quadrantSummary;
      corrected.ocr.suppressedItems = [];

      return corrected;
    },

    /**
     * Keyboard handler for OCR layer when in review mode.
     * @param {KeyboardEvent} e
     * @private
     */
    _handleReviewKeydown(e) {
      const box = e.target.closest
        ? e.target.closest(".imgdesc-overlay-box")
        : null;

      if (box && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        const index = parseInt(box.getAttribute("data-index"), 10);
        if (!isNaN(index)) {
          this.selectOCRItem(index);
        } else {
          const addIndex = parseInt(
            box.getAttribute("data-addition-index"),
            10,
          );
          if (!isNaN(addIndex)) {
            this.selectAddedItem(addIndex);
          }
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (this._selectedIndex !== null || this._selectedAdditionIndex !== null) {
          this.deselectOCRItem();
        } else {
          this.exitReviewMode();
        }
      }
    },

    // ══════════════════════════════════════════════════════════════════
    // Phase 5D-3: Add New Items
    // ══════════════════════════════════════════════════════════════════

    /**
     * Add a user-specified OCR item via the keyboard entry form.
     * @param {string} text
     * @param {number} leftPct - Left position as percentage (0–100)
     * @param {number} topPct  - Top position as percentage (0–100)
     * @param {number} widthPct  - Width as percentage (0–100)
     * @param {number} heightPct - Height as percentage (0–100)
     * @returns {boolean} true on success, false if validation fails
     */
    addItemFromKeyboard(text, leftPct, topPct, widthPct, heightPct, orientation) {
      // Validate text
      if (!text || typeof text !== "string" || text.trim() === "") {
        logWarn("addItemFromKeyboard: text is empty");
        return false;
      }
      text = text.trim();

      // Validate percentages
      const vals = [leftPct, topPct, widthPct, heightPct];
      for (let i = 0; i < vals.length; i++) {
        if (typeof vals[i] !== "number" || isNaN(vals[i])) {
          logWarn("addItemFromKeyboard: non-numeric value at index " + i);
          return false;
        }
        if (vals[i] < 0 || vals[i] > 100) {
          logWarn("addItemFromKeyboard: value out of range at index " + i);
          return false;
        }
      }
      if (widthPct <= 0 || heightPct <= 0) {
        logWarn("addItemFromKeyboard: width and height must be > 0");
        return false;
      }

      const bounds = {
        x: leftPct / 100,
        y: topPct / 100,
        w: widthPct / 100,
        h: heightPct / 100,
      };

      // Derive quadrant
      const utils = window.ImageDescriberAnalyserUtils;
      const quadrant =
        utils && typeof utils.getQuadrant === "function"
          ? utils.getQuadrant(bounds)
          : "centre";

      // Initialise edits store if needed
      this._ensureEditsStore();

      const addition = {
        text: text,
        bounds: bounds,
        quadrant: quadrant,
        confidence: 1.0,
        source: "user",
        status: "user-added",
        addedAt: Date.now(),
        orientation: orientation || "horizontal",
      };

      const additionIndex = this._userEdits.additions.length;
      this._userEdits.additions.push(addition);
      this._userEdits.editCount += 1;
      this._userEdits.lastEditTime = Date.now();

      // Render the box
      if (this._layers.ocr) {
        this._createAddedBox(addition, additionIndex);
      }

      // Clear the keyboard form inputs
      const textEl = document.getElementById("imgdesc-add-text");
      if (textEl) textEl.value = "";
      const leftEl = document.getElementById("imgdesc-add-left");
      if (leftEl) leftEl.value = "10";
      const topEl = document.getElementById("imgdesc-add-top");
      if (topEl) topEl.value = "10";
      const widthEl = document.getElementById("imgdesc-add-width");
      if (widthEl) widthEl.value = "10";
      const heightEl = document.getElementById("imgdesc-add-height");
      if (heightEl) heightEl.value = "5";
      const orientResetEl = document.getElementById("imgdesc-add-orientation");
      if (orientResetEl) orientResetEl.value = "horizontal";

      logInfo('Item added via keyboard: "' + text + '"');
      // Phase 11D: persist user edits
      this._persistUserEdits();
      this._refreshReviewList();
      return true;
    },

    /**
     * Read the keyboard entry form fields and call addItemFromKeyboard().
     * Called from the Add Item button onclick.
     */
    submitKeyboardAdd() {
      const textEl = document.getElementById("imgdesc-add-text");
      const leftEl = document.getElementById("imgdesc-add-left");
      const topEl = document.getElementById("imgdesc-add-top");
      const widthEl = document.getElementById("imgdesc-add-width");
      const heightEl = document.getElementById("imgdesc-add-height");

      const text = textEl ? textEl.value.trim() : "";
      const left = parseFloat(leftEl ? leftEl.value : "");
      const top = parseFloat(topEl ? topEl.value : "");
      const width = parseFloat(widthEl ? widthEl.value : "");
      const height = parseFloat(heightEl ? heightEl.value : "");
      const orientEl = document.getElementById("imgdesc-add-orientation");
      const orientation = orientEl ? orientEl.value : "horizontal";

      const success = this.addItemFromKeyboard(text, left, top, width, height, orientation);
      if (!success) {
        logWarn("submitKeyboardAdd: validation failed — check inputs");
        // Move focus to text field so the user can correct the input
        if (textEl) textEl.focus();
      }
    },

    /**
     * Create a bounding box element for a user-added OCR item.
     * @param {Object} addition - Item from _userEdits.additions
     * @param {number} additionIndex - Index in _userEdits.additions
     * @private
     */
    _createAddedBox(addition, additionIndex) {
      const layer = this._layers.ocr;
      if (!layer) return;

      const css = boundsToCSS(addition.bounds, 0.02);

      const box = document.createElement("div");
      box.className = "imgdesc-overlay-box";
      box.setAttribute("tabindex", "0");
      box.setAttribute("data-addition-index", String(additionIndex));
      box.setAttribute("data-status", "user-added");
      box.setAttribute("data-confidence", "high");
      box.setAttribute("data-source", "user");
      box.setAttribute("data-suppressed", "false");
      box.style.left = css.left;
      box.style.top = css.top;
      box.style.width = css.width;
      box.style.height = css.height;

      const label = "User-added OCR item: " + addition.text + ", " + addition.quadrant + " quadrant";
      box.setAttribute("aria-label", label);

      // Text label tag
      const labelSpan = document.createElement("span");
      labelSpan.className = "imgdesc-overlay-box-label";
      labelSpan.textContent = addition.text;
      box.appendChild(labelSpan);

      layer.appendChild(box);

      // Attach toggletip using a synthetic item object
      const syntheticItem = {
        text: addition.text,
        bounds: addition.bounds,
        quadrant: addition.quadrant,
        confidence: 1.0,
        source: "user",
      };
      this._attachAddedToggletip(box, syntheticItem, additionIndex);
    },

    /**
     * Attach a toggletip to a user-added box.
     * @param {HTMLElement} boxElement
     * @param {Object} item - Synthetic item with text, quadrant, confidence, source
     * @param {number} additionIndex
     * @private
     */
    _attachAddedToggletip(boxElement, item, additionIndex) {
      if (
        typeof window.UniversalToggletip === "undefined" ||
        typeof window.UniversalToggletip.create !== "function"
      ) {
        return;
      }

      const html =
        '<dl class="toggletip-data">' +
        '<dt class="toggletip-label">Text</dt>' +
        '<dd class="toggletip-value">' +
        esc(item.text || "") +
        "</dd>" +
        '<dt class="toggletip-label">Confidence</dt>' +
        '<dd class="toggletip-value toggletip-confidence-high">100% (user-added)</dd>' +
        '<dt class="toggletip-label">Position</dt>' +
        '<dd class="toggletip-value">' +
        (item.quadrant || "unknown") +
        "</dd>" +
        '<dt class="toggletip-label">Source</dt>' +
        '<dd class="toggletip-value">User</dd>' +
        "</dl>";

      const label = "User-added OCR item " + (additionIndex + 1) + ": " + item.text;

      try {
        const toggletipId = window.UniversalToggletip.create({
          trigger: boxElement,
          content: html,
          position: "bottom",
          type: "success",
          label: label,
        });
        if (toggletipId) {
          this._toggletipIds.push(toggletipId);
        }
      } catch (err) {
        logWarn(
          "Failed to create toggletip for added item " + additionIndex,
          err.message,
        );
      }
    },

    /**
     * Enter draw-to-add mode. Container cursor changes to crosshair.
     * Mouse handlers are bound on the overlay container.
     */
    startDrawMode() {
      if (!this._container) {
        logWarn("startDrawMode: no container — init() must run first");
        return;
      }

      // Ensure we are in review mode
      if (!this._inReviewMode) {
        this.enterReviewMode();
      }

      this._inDrawMode = true;
      this._container.style.cursor = "crosshair";

      const self = this;

      this._drawMouseDownHandler = function (e) {
        self._onDrawMouseDown(e);
      };
      this._drawMouseMoveHandler = function (e) {
        self._onDrawMouseMove(e);
      };
      this._drawMouseUpHandler = function (e) {
        self._onDrawMouseUp(e);
      };

      this._container.addEventListener("mousedown", this._drawMouseDownHandler);
      this._container.addEventListener("mousemove", this._drawMouseMoveHandler);
      this._container.addEventListener("mouseup", this._drawMouseUpHandler);

      logInfo("Draw mode started");
    },

    /**
     * Exit draw-to-add mode, remove handlers, clean up rubber-band.
     */
    stopDrawMode() {
      this._inDrawMode = false;

      if (this._container) {
        this._container.style.cursor = "";

        if (this._drawMouseDownHandler) {
          this._container.removeEventListener(
            "mousedown",
            this._drawMouseDownHandler,
          );
        }
        if (this._drawMouseMoveHandler) {
          this._container.removeEventListener(
            "mousemove",
            this._drawMouseMoveHandler,
          );
        }
        if (this._drawMouseUpHandler) {
          this._container.removeEventListener(
            "mouseup",
            this._drawMouseUpHandler,
          );
        }
      }

      this._drawMouseDownHandler = null;
      this._drawMouseMoveHandler = null;
      this._drawMouseUpHandler = null;

      // Remove rubber-band if still present
      if (this._rubberBand && this._rubberBand.parentNode) {
        this._rubberBand.parentNode.removeChild(this._rubberBand);
      }
      this._rubberBand = null;
      this._drawStart = null;

      logDebug("Draw mode stopped");
    },

    /**
     * Convert a mouse event's client coordinates to normalised 0–1 values
     * relative to the overlay container.
     * @param {MouseEvent} event
     * @returns {{ x: number, y: number }}
     * @private
     */
    _mouseToNormalised(event) {
      const rect = this._container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      };
    },

    /** @private */
    _onDrawMouseDown(event) {
      if (!this._inDrawMode) return;
      event.preventDefault();

      // Clean up any stale rubber-band from a missed mouseup
      if (this._rubberBand && this._rubberBand.parentNode) {
        this._rubberBand.parentNode.removeChild(this._rubberBand);
        this._rubberBand = null;
      }

      this._drawStart = this._mouseToNormalised(event);

      const rb = document.createElement("div");
      rb.className = "imgdesc-overlay-rubberband";
      rb.style.position = "absolute";
      rb.style.left = (this._drawStart.x * 100).toFixed(2) + "%";
      rb.style.top = (this._drawStart.y * 100).toFixed(2) + "%";
      rb.style.width = "0";
      rb.style.height = "0";
      this._container.appendChild(rb);
      this._rubberBand = rb;
    },

    /** @private */
    _onDrawMouseMove(event) {
      if (!this._rubberBand || !this._drawStart) return;
      event.preventDefault();

      const current = this._mouseToNormalised(event);
      const x = Math.min(this._drawStart.x, current.x);
      const y = Math.min(this._drawStart.y, current.y);
      const w = Math.abs(current.x - this._drawStart.x);
      const h = Math.abs(current.y - this._drawStart.y);

      this._rubberBand.style.left = (x * 100).toFixed(2) + "%";
      this._rubberBand.style.top = (y * 100).toFixed(2) + "%";
      this._rubberBand.style.width = (w * 100).toFixed(2) + "%";
      this._rubberBand.style.height = (h * 100).toFixed(2) + "%";
    },

    /** @private */
    _onDrawMouseUp(event) {
      if (!this._rubberBand || !this._drawStart) return;
      event.preventDefault();

      const end = this._mouseToNormalised(event);
      const bounds = {
        x: Math.min(this._drawStart.x, end.x),
        y: Math.min(this._drawStart.y, end.y),
        w: Math.abs(end.x - this._drawStart.x),
        h: Math.abs(end.y - this._drawStart.y),
      };

      // Remove rubber-band
      if (this._rubberBand.parentNode) {
        this._rubberBand.parentNode.removeChild(this._rubberBand);
      }
      this._rubberBand = null;
      this._drawStart = null;

      // Minimum size check — ignore accidental clicks
      if (bounds.w < 0.01 || bounds.h < 0.01) {
        logDebug("Draw too small — ignored");
        this.stopDrawMode();
        return;
      }

      this.stopDrawMode();
      this._showAddTextPrompt(bounds);
    },

    /**
     * Show the review panel pre-filled for a newly drawn item.
     * Stores the bounds; confirmSelectedItem() will finalise the addition.
     * @param {{ x, y, w, h }} bounds - Normalised 0–1 bounds from draw
     * @private
     */
    _showAddTextPrompt(bounds) {
      const utils = window.ImageDescriberAnalyserUtils;
      const quadrant =
        utils && typeof utils.getQuadrant === "function"
          ? utils.getQuadrant(bounds)
          : "centre";

      this._pendingDrawBounds = bounds;

      // Populate review panel for the drawn item
      const textInput = document.getElementById("imgdesc-review-text");
      if (textInput) {
        textInput.value = "";
      }
      const confEl = document.getElementById("imgdesc-review-confidence");
      if (confEl) confEl.textContent = "User-added";
      const posEl = document.getElementById("imgdesc-review-position");
      if (posEl) posEl.textContent = quadrant;
      const srcEl = document.getElementById("imgdesc-review-source");
      if (srcEl) srcEl.textContent = "User";

      const panel = document.getElementById("imgdesc-overlay-review-panel");
      if (panel) panel.hidden = false;

      // Show orientation field for drawn items, reset to horizontal
      const drawOrientField = document.getElementById("imgdesc-review-orientation-field");
      if (drawOrientField) drawOrientField.hidden = false;
      const drawOrientSelect = document.getElementById("imgdesc-review-orientation");
      if (drawOrientSelect) drawOrientSelect.value = "horizontal";

      // Focus the text field
      if (textInput) textInput.focus();

      logDebug("Add text prompt shown for drawn bounds", bounds);
    },

    // ══════════════════════════════════════════════════════════════════
    // Phase 10C: Florence-2 Object Review (confirm/remove only)
    // ══════════════════════════════════════════════════════════════════

    /**
     * Select a Florence-2 object for review.
     * Shows a lightweight review panel with label and remove/confirm buttons.
     * @param {number} index - Index in florenceObjects.items
     */
    selectObjectItem(index) {
      if (!this._inReviewMode) return;
      if (!this._layers.objects) return;

      var result = this._analysisRef;
      if (
        !result || !result.florenceObjects ||
        !result.florenceObjects.items ||
        !result.florenceObjects.items[index]
      ) {
        logWarn("selectObjectItem: no object at index " + index);
        return;
      }

      // Deselect any previous selection (OCR or object)
      this._doDeselect();

      var box = this._layers.objects.querySelector(
        '[data-index="' + index + '"]'
      );
      if (!box) {
        logWarn("selectObjectItem: no box found for index " + index);
        return;
      }

      box.classList.add("imgdesc-selected");
      this._selectedObjectIndex = index;

      var item = result.florenceObjects.items[index];
      this._ensureEditsStore();
      var isRemoved = this._userEdits.objectRemovals.has(index);

      // Populate review panel — lightweight version for objects
      var panel = document.getElementById("imgdesc-overlay-review-panel");
      var textInput = document.getElementById("imgdesc-review-text");
      var confEl = document.getElementById("imgdesc-review-confidence");
      var posEl = document.getElementById("imgdesc-review-position");
      var srcEl = document.getElementById("imgdesc-review-source");

      // Show label in the text field (read-only for objects)
      if (textInput) {
        textInput.value = item.label || "";
        textInput.readOnly = true;
      }
      if (confEl) confEl.textContent = "N/A (Florence-2)";
      if (posEl) {
        // Derive position from pixel bounds
        var img = this._container ? this._container.querySelector("img") : null;
        var natW = img ? img.naturalWidth : 0;
        var natH = img ? img.naturalHeight : 0;
        var posText = "unknown";
        if (item.bounds && natW && natH) {
          var cx = (item.bounds.x1 + item.bounds.x2) / 2 / natW;
          var cy = (item.bounds.y1 + item.bounds.y2) / 2 / natH;
          var vertical = cy < 0.33 ? "top" : cy > 0.67 ? "bottom" : "centre";
          var horizontal = cx < 0.33 ? "left" : cx > 0.67 ? "right" : "centre";
          if (vertical === "centre" && horizontal === "centre") {
            posText = "centre";
          } else if (vertical === "centre") {
            posText = horizontal;
          } else if (horizontal === "centre") {
            posText = vertical;
          } else {
            posText = vertical + "-" + horizontal;
          }
        }
        posEl.textContent = posText;
      }
      if (srcEl) {
        srcEl.textContent = isRemoved ? "Florence-2 (removed)" : "Florence-2";
      }

      // Hide orientation field (not applicable for objects)
      var orientField = document.getElementById("imgdesc-review-orientation-field");
      if (orientField) orientField.hidden = true;

      if (panel) panel.hidden = false;

      // Focus the first action button (not the text field, since it's read-only)
      var firstBtn = panel ? panel.querySelector("button:not([hidden])") : null;
      if (firstBtn) firstBtn.focus();

      logDebug("Selected object item", index);
    },

    /**
     * Mark a Florence-2 object as removed (false positive).
     * @param {number} [index] - If not provided, uses currently selected object
     */
    removeObjectItem(index) {
      if (index === undefined || index === null) {
        index = this._selectedObjectIndex;
      }
      if (index === null || index === undefined) return;

      this._ensureEditsStore();
      this._userEdits.objectRemovals.add(index);
      this._userEdits.lastEditTime = Date.now();
      this._userEdits.editCount++;

      // Update the box's visual state
      var box = this._layers.objects
        ? this._layers.objects.querySelector('[data-index="' + index + '"]')
        : null;
      if (box) {
        box.setAttribute("data-status", "removed");
        box.classList.remove("imgdesc-selected");
      }

      // Phase 11D: persist user edits
      this._persistUserEdits();

      this._doDeselect();
      logInfo("Removed object item " + index);
    },

    /**
     * Confirm a Florence-2 object (mark as correct, or restore if previously removed).
     * @param {number} [index] - If not provided, uses currently selected object
     */
    confirmObjectItem(index) {
      if (index === undefined || index === null) {
        index = this._selectedObjectIndex;
      }
      if (index === null || index === undefined) return;

      this._ensureEditsStore();

      // If previously removed, restore it
      if (this._userEdits.objectRemovals.has(index)) {
        this._userEdits.objectRemovals.delete(index);
        this._userEdits.lastEditTime = Date.now();

        var box = this._layers.objects
          ? this._layers.objects.querySelector('[data-index="' + index + '"]')
          : null;
        if (box) {
          box.removeAttribute("data-status");
        }
      }

      // Phase 11D: persist user edits
      this._persistUserEdits();

      this._doDeselect();
      logInfo("Confirmed object item " + index);
    },
  };

  // ════════════════════════════════════════════════════════════════════
  // Mix into the existing overlay object
  // ════════════════════════════════════════════════════════════════════

  if (window.ImageDescriberOverlay) {
    Object.assign(window.ImageDescriberOverlay, methods);
    logInfo("Review module loaded");
  } else {
    logError("ImageDescriberOverlay not found — review methods not loaded");
  }
})();
