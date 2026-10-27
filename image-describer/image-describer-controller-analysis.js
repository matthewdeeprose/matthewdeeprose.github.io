/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER CONTROLLER — ANALYSIS PIPELINE SUB-MODULE
 * ═══════════════════════════════════════════════════════════════
 *
 * Analysis orchestration, the text-detection tick box, cache recall,
 * Florence-2 integration, and background analysis for the
 * Image Describer controller.
 *
 * Mixed into window.ImageDescriberController via Object.assign.
 * Must load AFTER image-describer-controller.js (core).
 *
 * VERSION: 1.0.0
 * DATE: 31 March 2026
 * PHASE: Refactor — controller extraction
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

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
      console.error(`[IDC-Analysis] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[IDC-Analysis] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[IDC-Analysis] ${message}`, ...args);
  }

  // The image preview region: where every analysis-starting banner exit lands focus.
  const PREVIEW_ID = "imgdesc-preview";

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[IDC-Analysis] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  // The curation-loss warning shown beside the Re-analyse control, and the
  // control it describes. Both ids are declared in tools.html.
  const REANALYSE_WARNING_ID = "imgdesc-reanalyse-warning";
  const REANALYSE_BUTTON_ID = "imgdesc-reanalyse-btn";

  // The "Detect text in this picture?" question (H-64): a group holding two
  // toggle buttons, shown once a picture is loaded and unanswered for every new
  // picture. Declared in tools.html. Text detection does not start until one is
  // pressed; Skip text means text detection is skipped. Not saved.
  const TEXT_CHOICE_ID = "imgdesc-text-choice";
  const TEXT_CHOICE_BUTTON_IDS = Object.freeze({
    detect: "imgdesc-text-choice-detect",
    skip: "imgdesc-text-choice-skip",
  });
  const TEXT_CHOICE = Object.freeze({ DETECT: "detect", SKIP: "skip" });

  // The one analysis profile left since the categories were removed (H-56).
  const DEFAULT_PROFILE_NAME = "default";

  // The overlay toolbar revealed at analysis completion. Declared in tools.html.
  const OVERLAY_TOOLBAR_ID = "imgdesc-overlay-toolbar";

  // What analysis completion says. Two variants, keyed on OCR items present
  // rather than on classification present, because the Review OCR control is
  // enabled on that same predicate and naming a disabled control would be a
  // lie. The count itself is NOT here — it is the control's own description.
  const COMPLETE_WITH_OCR =
    "Analysis complete. Review OCR and the analysis overlay controls are now available.";
  const COMPLETE_WITHOUT_OCR =
    "Analysis complete. The analysis overlay controls are now available.";
  // Text detection ended without a result (H-31). Chosen on the OCR status, not
  // on items, so a run that never read the picture does not sound like a
  // picture with no text in it.
  const COMPLETE_OCR_TIMED_OUT =
    "Analysis complete. Text detection did not finish, so the description will not use any text from the picture. The analysis overlay controls are now available.";
  const COMPLETE_OCR_FAILED =
    "Analysis complete. Text detection could not run, so the description will not use any text from the picture. The analysis overlay controls are now available.";
  // Text detection finished after a description was already written without it
  // (H-36). Replaces the ordinary "Review OCR" line only, so it never implies the
  // description used the text.
  const COMPLETE_AFTER_DESCRIPTION =
    "Text detection has now finished. The description was written before it finished, so it does not use any text from the picture. Review OCR and the analysis overlay controls are now available.";

  // What the start of text detection says (H-13, moved and reworded at H-64). The
  // wait used to be voiced by the Model Manager naming each model the analyser
  // happened to load, which told the person nothing they could use. One plain line
  // gives the wait a beginning, and the completion line above is its end. It is
  // written where text detection really starts, so it is never spoken for Skip text
  // or for a cache hit, where completion follows at once.
  const DETECTING_TEXT_START =
    "Detecting text in the picture. This can take up to a minute.";

  // ============================================================================
  // ANALYSIS PIPELINE METHODS
  // ============================================================================

  const methods = {

    /**
     * Slot definitions for the analysis status display.
     * Keys match analysis:stage event stage values.
     */
    _ANALYSIS_STATUS_SLOTS: {
      colour: { label: "Colour sampling" },
      ocr: { label: "Tesseract OCR" },
      florenceOCR: { label: "Florence-2 OCR (optional)" },
    },

    /**
     * Icon and text mappings for analysis slot statuses.
     */
    _ANALYSIS_STATUS_ICONS: {
      pending: { icon: "", text: "pending" },
      waiting: { icon: "", text: "waiting for your choice" },
      running: { icon: "hourglass", text: "running\u2026" },
      complete: { icon: "checkCircle", text: "complete" },
      skipped: { icon: "close", text: "skipped" },
      error: { icon: "error", text: "failed" },
      "timed-out": { icon: "warning", text: "did not finish" },
      cached: { icon: "disk", text: "restored from cache" },
    },

    /**
     * Update the analysis progress status display (Phase 6A, enhanced Phase 9E).
     * Shows per-slot breakdown with icons matching the generation progress style.
     * @param {string} stage — "analysis", "ocr", "colour"
     * @param {string} status — "started", "running", "complete", "skipped", "error"
     * @param {object} [data] — optional extra data
     */
    _updateAnalysisStatus(stage, status, data) {
      const el = document.getElementById("imgdesc-analysis-status");
      const headingEl = document.getElementById("imgdesc-analysis-status-text");
      const slotsEl = document.getElementById("imgdesc-analysis-slots");
      if (!el || !headingEl) return;

      if (stage === "analysis" && status === "started") {
        el.hidden = false;
        headingEl.textContent = "Analysing image\u2026";
        // Build slot list
        if (slotsEl) {
          slotsEl.innerHTML = "";
          for (const [key, slot] of Object.entries(
            this._ANALYSIS_STATUS_SLOTS,
          )) {
            this["_stageStatus_" + key] = "pending";
            slotsEl.appendChild(
              this._createAnalysisSlotLi(key, slot.label, "pending"),
            );
          }
        }
        return;
      }

      if (stage === "analysis" && status === "complete") {
        headingEl.textContent = "Analysis complete";
        // Auto-hide after 2 seconds
        setTimeout(() => {
          el.hidden = true;
          headingEl.textContent = "";
          if (slotsEl) slotsEl.innerHTML = "";
        }, 2000);
        return;
      }

      // Update tracked stage
      if (stage === "colour") this._stageStatus_colour = status;
      if (stage === "ocr") this._stageStatus_ocr = status;
      if (stage === "florenceOCR") this._stageStatus_florenceOCR = status;

      // Update the individual slot element
      this._updateAnalysisSlotLi(stage, status);

      // If Tesseract OCR is skipped, Florence-2 OCR is also not useful
      if (stage === "ocr" && status === "skipped") {
        this._stageStatus_florenceOCR = "skipped";
        this._updateAnalysisSlotLi("florenceOCR", "skipped");
      }
    },

    /**
     * Create a single analysis slot <li> element.
     * @param {string} key — slot key (e.g. "ocr")
     * @param {string} label — display label
     * @param {string} status — initial status
     * @returns {HTMLLIElement}
     */
    _createAnalysisSlotLi(key, label, status) {
      const li = document.createElement("li");
      li.className = "imgdesc-progress-slot";
      li.id = "imgdesc-analysis-slot-" + key;
      li.setAttribute("data-slot-status", status);

      const iconSpan = document.createElement("span");
      iconSpan.className = "imgdesc-progress-slot-icon";
      iconSpan.setAttribute("aria-hidden", "true");
      li.appendChild(iconSpan);

      const labelSpan = document.createElement("span");
      labelSpan.className = "imgdesc-progress-slot-label";
      labelSpan.textContent = label;
      li.appendChild(labelSpan);

      const statusSpan = document.createElement("span");
      statusSpan.className = "imgdesc-progress-slot-status";
      statusSpan.textContent =
        this._ANALYSIS_STATUS_ICONS[status]?.text || status;
      li.appendChild(statusSpan);

      return li;
    },

    /**
     * Update a single analysis slot <li> with new status.
     * @param {string} key — slot key (e.g. "ocr")
     * @param {string} status — new status
     */
    _updateAnalysisSlotLi(key, status) {
      const li = document.getElementById("imgdesc-analysis-slot-" + key);
      if (!li) return;

      li.setAttribute("data-slot-status", status);

      const mapping = this._ANALYSIS_STATUS_ICONS[status] || {
        icon: "",
        text: status,
      };

      const iconSpan = li.querySelector(".imgdesc-progress-slot-icon");
      if (iconSpan) {
        iconSpan.innerHTML =
          mapping.icon && typeof getIcon === "function"
            ? getIcon(mapping.icon)
            : "";
      }

      const statusSpan = li.querySelector(".imgdesc-progress-slot-status");
      if (statusSpan) {
        statusSpan.textContent = mapping.text;
      }
    },

    /**
     * Put keyboard focus on the image preview region. Every banner exit that
     * starts the analysis (Apply, Proceed, the alternative, Dismiss) lands here,
     * and it must be called BEFORE the banner is hidden: hiding a focused button
     * drops focus to the body, and NVDA then reads the whole upload section.
     * The region is programmatic focus only (tabindex -1), so it is not a Tab stop.
     * It is deliberately silent: moving focus speaks the region's name, and a
     * polite line written in the same tick is the g-5/g-8 drop shape.
     */
    _moveFocusToPreview() {
      const preview = document.getElementById(PREVIEW_ID);
      if (!preview) return;
      if (!preview.hasAttribute("tabindex")) {
        preview.setAttribute("tabindex", "-1");
      }
      preview.focus();
    },

    // ========================================================================
    // CACHE RECALL BANNER (Phase 11D)
    // ========================================================================

    /**
     * Show or hide the warning that Re-analyse will discard saved curation.
     *
     * No announcement, by design. Both toast systems and the shared announcer
     * speak, and a curation warning is not an event the user has just caused —
     * it is a property of the control they are about to press. It is therefore
     * delivered as the button's accessible DESCRIPTION, which is spoken when
     * they reach the control and BEFORE they activate it. The attribute is
     * added only while there is curation to lose, so a user with none is never
     * told about a loss that cannot happen.
     *
     * @param {boolean} hasCuration - whether saved OCR curation would be lost
     */
    setReanalyseWarning(hasCuration) {
      const warning = document.getElementById(REANALYSE_WARNING_ID);
      if (!warning) return;

      warning.hidden = !hasCuration;

      const button = document.getElementById(REANALYSE_BUTTON_ID);
      if (!button) return;

      if (hasCuration) {
        button.setAttribute("aria-describedby", REANALYSE_WARNING_ID);
      } else {
        button.removeAttribute("aria-describedby");
      }
    },

    /**
     * True while the description view is showing (showOutputUI) rather than the
     * setup view. Anything that finishes asynchronously and would reveal a
     * setup-view control (toolbar, banner, question) must check this first, or
     * it reappears above the finished description.
     * @returns {boolean}
     */
    _isOutputMode() {
      return !!document
        .querySelector(".imgdesc-layout")
        ?.classList.contains("imgdesc-output-mode");
    },

    /**
     * Show the cache recall banner with the date the analysis was created.
     * @param {number} createdAt - Timestamp from the cached record
     * @param {boolean} [hasCuration] - whether the restored record carries
     *   user curation that Re-analyse would destroy
     */
    showCacheRecallBanner(createdAt, hasCuration) {
      const banner = this.elements.cacheRecallBanner;
      const textEl = this.elements.cacheRecallText;
      if (!banner || !textEl) return;

      // The cache lookup is asynchronous and can resolve after Generate, once
      // the description is on screen; the banner belongs to the setup view.
      if (this._isOutputMode()) return;

      // Format date as "24 Mar 2026"
      const date = new Date(createdAt);
      const day = date.getDate();
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const formatted =
        day + " " + months[date.getMonth()] + " " + date.getFullYear();

      textEl.textContent = "Previous analysis restored (" + formatted + ")";

      // Set BEFORE the banner is un-hidden, matching the order already used
      // for the banner text, so this introduces no new announcement.
      //
      // KNOWN GAP, recorded rather than half-solved: this reflects the
      // curation the record carried at recall time. Curation added after the
      // banner appears does not refresh it, because the only honest trigger
      // is the overlay's own persist path and reaching into it is outside
      // this change. The Re-analyse control is only reachable on a cache hit,
      // so the case this covers — returning to an image curated earlier — is
      // the one that loses expensive work.
      this.setReanalyseWarning(!!hasCuration);

      banner.hidden = false;
      logDebug("Cache recall banner shown — created " + formatted);
    },

    /**
     * Hide the cache recall banner and clear its text.
     */
    hideCacheRecallBanner() {
      const banner = this.elements.cacheRecallBanner;
      const textEl = this.elements.cacheRecallText;
      if (banner) banner.hidden = true;
      if (textEl) textEl.textContent = "";
      this.setReanalyseWarning(false);
    },

    /**
     * Re-analyse the current image: delete cache entry, hide banner, run fresh analysis.
     */
    async reanalyse() {
      logInfo("Re-analyse requested");

      // 1. Delete cache entry
      if (this.currentFileHash && window.ImageDescriberCache) {
        try {
          await window.ImageDescriberCache.delete(this.currentFileHash);
          logDebug(
            "Cache entry deleted for " +
              this.currentFileHash.substring(0, 16) +
              "...",
          );
        } catch (err) {
          logWarn("Failed to delete cache entry:", err.message);
        }
      }

      // 2. Hide banner
      this.hideCacheRecallBanner();

      // 3. Clear existing overlay visuals (Phase 11E)
      if (typeof window.ImageDescriberOverlay !== "undefined") {
        if (window.ImageDescriberOverlay._inReviewMode) {
          window.ImageDescriberOverlay.exitReviewMode();
        }
        window.ImageDescriberOverlay.clearAnalysis();
        window.ImageDescriberOverlay._userEdits = null;
        // Paired for the same reason as the other clearAnalysis() sites: a
        // stale _sortedItems now survives long enough to be used, because
        // getCorrectedAnalysis() only re-derives when the array is EMPTY.
        window.ImageDescriberOverlay._sortedItems = [];
      }
      const overlayToolbar = document.getElementById("imgdesc-overlay-toolbar");
      if (overlayToolbar) overlayToolbar.hidden = true;

      // 4. Reset state
      this._cacheHit = false;

      // 5. Refresh cache stats panel (Phase 11E)
      if (typeof window.imgdescMMRefreshCacheStats === "function") {
        window.imgdescMMRefreshCacheStats();
      }

      // 6. Re-run analysis
      this.startBackgroundAnalysis();
    },

    // ========================================================================
    // CACHE-RESTORE MIGRATION
    // ========================================================================

    /**
     * Repair a cached analysis record written before ocr.florenceMergeApplied
     * existed, in place, at the moment it is restored.
     *
     * WHY THIS IS NEEDED. The flag is written at merge time and persisted by
     * updateSlot(hash, "ocr", …). Every record written before that change has
     * merged ocr.items and no flag, so on a cache hit the format layer reads
     * the flag as false and emits the raw Florence OCR section a second time —
     * beside the human's corrected list, which is the original defect. The
     * same record holds those corrections, so the cache must NOT be
     * invalidated or versioned to fix this: that would throw away expensive
     * human work to repair a missing boolean.
     *
     * WHY THIS IS NOT THE HEURISTIC STAGE 2 REMOVED. The removed heuristic
     * asked which items SURVIVED dedup — `items.some(i => i.source ===
     * "florence2")` — and read false precisely when dedup worked best. This
     * asks whether both OCR passes COMPLETED, which is the merge's own guard
     * (see runFlorenceAnalysis, the `ocrResult.status === "complete" &&
     * this.lastAnalysis.ocr.status === "complete"` condition). Completion is
     * the merge's actual precondition; survival was only ever a proxy for it.
     *
     * WHY IT LIVES HERE AND NOT IN formatForPrompt. A fallback in the format
     * layer would reintroduce inference at the exact seam this work made
     * factual. Here it is a bounded migration of old data at the one boundary
     * old data enters through, and everything downstream still reads a flag
     * that was recorded rather than guessed.
     *
     * KNOWN IMPRECISION, stated rather than hidden: the merge guard also
     * requires window.ImageDescriberAnalyserOCR to have been present when
     * Florence ran, and that is an environment condition no record preserves.
     * A pre-fix record written on a page where that module failed to load
     * would have its flag derived wrongly. The module is a core load-order
     * dependency of the analyser, so this is vanishingly unlikely, but it is
     * the one case where this derivation can be wrong.
     *
     * Derives only when the flag is ABSENT — an explicitly recorded value is
     * never overwritten. Not persisted back to IndexedDB: the derivation is
     * cheap, deterministic and idempotent, so running it on each restore is
     * preferable to a write that could race the Florence slot updates.
     *
     * @param {object} analysis — a cached analysis, mutated in place
     * @returns {boolean} true if the flag was derived on this call
     */
    _migrateCachedAnalysis(analysis) {
      if (!analysis || !analysis.ocr) return false;
      if (analysis.ocr.florenceMergeApplied !== undefined) return false;

      const bothPassesComplete =
        analysis.ocr.status === "complete" &&
        analysis.florenceOCR &&
        analysis.florenceOCR.status === "complete";

      if (!bothPassesComplete) return false;

      analysis.ocr.florenceMergeApplied = true;
      logInfo(
        "Cached analysis predates florenceMergeApplied — flag derived from " +
          "both OCR passes having completed, which is the merge's own guard",
      );
      return true;
    },

    // ========================================================================
    // BACKGROUND ANALYSIS
    // ========================================================================

    /**
     * The single analysis-completion path: publish the result to the overlay,
     * reveal the toolbar, refresh the Florence-2 opt-in state, and announce
     * ONCE that the controls exist (H-6c).
     *
     * WHY IT IS SHARED. Two sites complete an analysis and they are mutually
     * exclusive for any one run — applyFullResult() inside
     * startBackgroundAnalysis() (cache hit, and the pre-15A single-phase
     * fallback) and runGatedAnalysis() (the two-phase path). Both carried the
     * identical block. A fix landing on one of two paths is the fail-open
     * shape AGENTS.md names "a guard installed but not on the path it
     * protects", so there is now one path and both call it.
     *
     * WHY THE ANNOUNCEMENT IS HERE AND NOT ON THE BADGE. The toolbar carries
     * hidden in the markup and is cleared only at completion, so no amount of
     * navigation before this moment reveals the Review OCR control — the
     * highest-value input this tool accepts. Nothing marked the moment it
     * appeared. The classification badge is NOT a usable host: it is hidden
     * until a classification arrives and hidden again in output mode, so it is
     * in the accessibility tree in some states and not others, and it sits
     * behind two classification guards that an OCR-keyed line must not inherit.
     * announceStatus() resolves the shared always-exposed polite region at
     * call time. See the badge creation site in image-describer-overlay.js,
     * which is aria-live="off" for this reason.
     *
     * EXACTLY ONE CALL PER COMPLETED ANALYSIS. Not per stage, not per render.
     * The third site that un-hides this toolbar — showConfigUI() in
     * image-describer-controller-ui.js — is deliberately NOT routed here: it
     * restores a view the user navigated back to, which is not a completion,
     * and announcing there would speak on a gesture the user already made.
     *
     * @param {Object} result - the completed analysis result
     * @private
     */
    _onAnalysisComplete(result) {
      // Update overlay with analysis data (Phase 5D-1)
      if (typeof window.ImageDescriberOverlay !== "undefined") {
        window.ImageDescriberOverlay.setAnalysis(result);
        // Not while the description is on screen: analysis can finish after
        // Generate, and showOutputUI() has already hidden the toolbar.
        // showConfigurationUI() reveals it again when the person goes back.
        const toolbar = document.getElementById(OVERLAY_TOOLBAR_ID);
        if (toolbar && !this._isOutputMode()) toolbar.hidden = false;
      }

      // Phase 10C-fix: update Florence-2 opt-in button state
      this._updateFlorenceOptinState();

      // Announce last, so the controls the sentence names already exist.
      const hasOCRItems = !!(
        result &&
        result.ocr &&
        result.ocr.items &&
        result.ocr.items.length > 0
      );
      const ocrStatus = result && result.ocr && result.ocr.status;
      let completionLine = hasOCRItems ? COMPLETE_WITH_OCR : COMPLETE_WITHOUT_OCR;
      if (hasOCRItems && this._descriptionWrittenBeforeOcr === true) {
        completionLine = COMPLETE_AFTER_DESCRIPTION;
      }
      if (ocrStatus === "timed-out") completionLine = COMPLETE_OCR_TIMED_OUT;
      if (ocrStatus === "failed") completionLine = COMPLETE_OCR_FAILED;
      this.announceStatus(completionLine);
      logDebug(
        `Analysis completion announced (OCR items: ${
          hasOCRItems ? result.ocr.items.length : 0
        })`,
      );
    },

    /**
     * True when the person has pressed "Skip text" (H-64). It is false while the
     * question is unanswered; "has the person answered" is _hasTextChoice().
     * (H-56 to H-63 read a "Detect text in the picture" tick box here.)
     * @returns {boolean}
     */
    _isSkipOcrTicked() {
      return this._textChoice === TEXT_CHOICE.SKIP;
    },

    /**
     * True once the person has answered "Detect text in this picture?" for the
     * current picture (H-64).
     * @returns {boolean}
     */
    _hasTextChoice() {
      return (
        this._textChoice === TEXT_CHOICE.DETECT ||
        this._textChoice === TEXT_CHOICE.SKIP
      );
    },

    /**
     * Show or hide the question (H-64). Shown only while a picture is loaded.
     * @param {boolean} visible
     */
    _showTextChoice(visible) {
      const group = document.getElementById(TEXT_CHOICE_ID);
      if (group) group.hidden = !visible;
    },

    /**
     * Put the question back to unanswered: no choice held, both buttons
     * unpressed (H-64). Called for every new picture and when the picture is
     * cleared. Does not touch the analysis; the caller starts or stops that.
     */
    _resetTextChoice() {
      this._textChoice = null;
      this._textDetectionPromise = null;
      this._syncTextChoiceButtons();
    },

    /** Make both buttons' aria-pressed agree with the held choice (H-64). */
    _syncTextChoiceButtons() {
      for (const [choice, id] of Object.entries(TEXT_CHOICE_BUTTON_IDS)) {
        const button = document.getElementById(id);
        if (button) {
          button.setAttribute(
            "aria-pressed",
            this._textChoice === choice ? "true" : "false",
          );
        }
      }
    },

    /**
     * A button of the question was pressed, or Generate asked it for the person
     * (H-64). The first answer for a picture starts text detection on the quick
     * result that has been waiting (or lets the colour pass start it when it
     * arrives); a different answer later analyses the picture again, and the
     * run-number guard drops the superseded pass; the same answer again does
     * nothing. No announcement of its own: the start line is written by
     * runGatedAnalysis, and "Analysis complete" by the ordinary completion path.
     * @param {string} choice - TEXT_CHOICE.DETECT or TEXT_CHOICE.SKIP
     */
    handleTextChoice(choice) {
      if (choice !== TEXT_CHOICE.DETECT && choice !== TEXT_CHOICE.SKIP) return;
      if (!this.currentFile || !this.elements.preview?.querySelector("img")) {
        return;
      }

      const previous = this._textChoice || null;
      if (previous === choice) return;

      this._textChoice = choice;
      this._syncTextChoiceButtons();
      this._updateFlorenceOCRPrompt();

      // A later answer: the earlier one already started text detection.
      if (previous !== null) {
        logInfo(
          `Text detection ${choice === TEXT_CHOICE.SKIP ? "skipped" : "chosen"} after an earlier answer — analysing the picture again`,
        );
        this.startBackgroundAnalysis();
        return;
      }

      // The first answer. If the quick result is waiting, start text detection
      // on it (after looking for a saved analysis made with this same answer,
      // H-98); if the colour pass has not finished, it will read the choice.
      if (this._immediateResult && !this._textDetectionPromise) {
        logInfo(`First answer (${choice}) — starting text detection`);
        this._textDetectionPromise = this._detectTextOrRestore(
          DEFAULT_PROFILE_NAME,
          choice === TEXT_CHOICE.SKIP,
          this._analysisRunId,
          false,
        );
      }
    },

    /**
     * True when the person has answered "Detect text in this picture?" and a
     * saved record was made with that same answer (H-56, H-64). The one answer
     * test, used by the lookup in startBackgroundAnalysis and by
     * _detectTextOrRestore (H-98), so the two cannot drift apart. The profile
     * comparison stays inline in each caller: a marker row in
     * tests-11c-cache-recall.js reads it in startBackgroundAnalysis's source.
     * @param {object} cached - a record from ImageDescriberCache.load
     * @returns {boolean}
     */
    _savedAnalysisHoldsThisAnswer(cached) {
      if (!cached || !cached.analysis || !this._hasTextChoice()) return false;
      const cachedOcrSkipped =
        !!cached.analysis.ocr && cached.analysis.ocr.status === "skipped";
      return cachedOcrSkipped === this._isSkipOcrTicked();
    },

    /**
     * Start text detection, unless the cache already holds this picture's
     * analysis made with the same answer (H-98). A picture seen before had no
     * answer to match when the page first looked, so the lookup in
     * startBackgroundAnalysis could never hit for it; the answer arrives later,
     * so the lookup is repeated here. On a match this calls
     * startBackgroundAnalysis(), whose lookup restores the record (the one
     * restore path); otherwise it runs text detection as before.
     * @param {string} profile - the profile name
     * @param {boolean} skipOCR - whether the answer was "Skip text"
     * @param {number} runId - the start this pass belongs to
     * @param {boolean} skipLookup - true when startBackgroundAnalysis has just
     *   been called from here, so a record that vanished meanwhile cannot loop
     * @returns {Promise<object|null>}
     */
    async _detectTextOrRestore(profile, skipOCR, runId, skipLookup) {
      if (
        !skipLookup &&
        this.currentFileHash &&
        typeof window.ImageDescriberCache !== "undefined"
      ) {
        let cached = null;
        try {
          cached = await window.ImageDescriberCache.load(this.currentFileHash);
        } catch (err) {
          logWarn("Saved analysis lookup failed:", err.message);
        }
        if (runId !== this._analysisRunId) return null;
        if (
          cached &&
          cached.analysis &&
          cached.analysis.profile === profile &&
          this._savedAnalysisHoldsThisAnswer(cached)
        ) {
          logInfo("Saved analysis found for this answer — restoring it");
          this._skipSavedLookupOnce = true;
          this.startBackgroundAnalysis();
          return null;
        }
      }
      return this.runGatedAnalysis(profile, skipOCR, runId);
    },

    /**
     * Wait until text detection has finished for the current picture, however
     * many times it is started again meanwhile (H-64). Resolves at once when it
     * is not running. Used by "Detect text, then describe".
     */
    async _awaitTextDetection() {
      const MAX_RESTARTS = 5;
      for (let attempt = 0; attempt < MAX_RESTARTS; attempt++) {
        // The quick pass starts text detection when it ends, so wait for it first.
        if (this._analysisPending) await this._analysisPending;
        const running = this._textDetectionPromise;
        if (!running) return;
        await running;
        if (this._textDetectionPromise === running) return;
      }
    },

    /**
     * Start background image analysis as soon as preview loads.
     * Runs OCR + colour sampling in parallel, storing results
     * in this.lastAnalysis for later inclusion in the prompt.
     * Results are stored in this.lastAnalysis when complete.
     */
    startBackgroundAnalysis() {
      // Set by _detectTextOrRestore just before it calls this (H-98).
      const skipSavedLookup = this._skipSavedLookupOnce === true;
      this._skipSavedLookupOnce = false;

      // A banner from an earlier restore must not outlive this start: a later
      // answer can analyse the picture afresh after a first-answer restore
      // (H-98). The restore path below shows it again.
      this.hideCacheRecallBanner();

      // Clear any previous analysis
      this.lastAnalysis = null;
      // A new image starts with no description written before text detection (H-36)
      this._descriptionWrittenBeforeOcr = false;
      this._analysisPending = null;
      this._textDetectionPromise = null;
      this._cacheHit = false;
      this._immediateResult = null;
      this._immediateCanvasData = null;

      // Clear stage tracking (Phase 6A)
      this._stageStatus_ocr = null;
      this._stageStatus_colour = null;

      if (
        typeof window.ImageDescriberAnalyser === "undefined" ||
        !window.ImageDescriberAnalyser.isAvailable()
      ) {
        logDebug(
          "ImageDescriberAnalyser not available — skipping background analysis",
        );
        return;
      }

      // Wait for preview image to be in the DOM and loaded
      const previewImg = this.elements.preview?.querySelector("img");
      if (!previewImg) {
        logDebug("No preview image found — skipping background analysis");
        return;
      }

      const self = this;

      // This start's number. Starting again (a new picture, Re-analyse, or the
      // "Detect text" box changed with a picture loaded) makes any earlier,
      // slower pass stale: it must neither store its result nor announce, or
      // the picture ends up with the older setting's result and "Analysis
      // complete" is spoken twice (measured at H-56 before this guard).
      this._analysisRunId = (this._analysisRunId || 0) + 1;
      const runId = this._analysisRunId;

      const applyFullResult = (result) => {
        if (runId !== self._analysisRunId) return result;
        self.lastAnalysis = result;
        self._analysisPending = null;

        self._onAnalysisComplete(result);

        return result;
      };

      const runAnalysis = () => {
        // One analysis setting for every picture (H-56): the Default profile.
        const profile = DEFAULT_PROFILE_NAME;

        // Phase 9B: Check cache before running analysis
        const cacheCheck =
          this.currentFileHash &&
          typeof window.ImageDescriberCache !== "undefined"
            ? window.ImageDescriberCache.load(this.currentFileHash)
            : Promise.resolve(null);

        this._analysisPending = cacheCheck
          .then((cached) => {
            if (runId !== self._analysisRunId) return null;
            if (cached && cached.analysis) {
              // Restore user edits on a HASH hit, whatever the profile.
              //
              // Review-mode corrections describe the IMAGE's text. They have
              // nothing to do with the analysis profile, and gating them on it
              // meant a profile change alone silently discarded the most
              // expensive input this tool accepts — see
              // docs/ocr-curation-loss-defect.md.
              //
              // KNOWN IMPRECISION, stated rather than solved: corrections
              // index into _sortedItems, and a different profile can produce a
              // different OCR item list, so restored edits may not map
              // cleanly. Restoring them anyway is the correct behaviour;
              // getCorrectedAnalysis() already degrades to "corrections lost,
              // data intact" with a logWarn, a path added at 0eea309 for
              // exactly this shape. Do NOT build a second reconciliation
              // mechanism beside it.
              if (
                cached.userEdits &&
                typeof window.ImageDescriberOverlay !== "undefined"
              ) {
                const edits = cached.userEdits;
                // Phase 11D: deserialise objectRemovals back to Set
                if (Array.isArray(edits.objectRemovals)) {
                  edits.objectRemovals = new Set(edits.objectRemovals);
                }
                window.ImageDescriberOverlay._userEdits = edits;
              }

              // The cached analysis must match the current settings: the
              // Default profile, and the same answer to "Detect text in this
              // picture?". A record saved with text detection off holds no text,
              // and one saved with it on holds text the person has now turned
              // off, so either mismatch analyses the picture again (H-56).
              // While the question is unanswered nothing matches (H-64): text
              // detection must not run, or be restored, before the person chooses.
              // Records saved under the removed categories (chart, map, ...)
              // carry another profile name, so they are analysed again once.
              const cachedProfile = cached.analysis.profile;
              const cachedOcrSkipped =
                !!cached.analysis.ocr && cached.analysis.ocr.status === "skipped";
              if (
                cachedProfile === profile &&
                this._savedAnalysisHoldsThisAnswer(cached)
              ) {
                logInfo(
                  `Cache hit for ${this.currentFileHash.substring(0, 16)}... — restoring analysis (profile: ${profile})`,
                );
                this._cacheHit = true;

                // Phase 11C: Increment access count (fire-and-forget)
                window.ImageDescriberCache.incrementAccessCount(
                  this.currentFileHash,
                );

                // Repair pre-fix records before they reach the format layer.
                this._migrateCachedAnalysis(cached.analysis);

                applyFullResult(cached.analysis);

                // Phase 11D: show cache recall banner
                this.showCacheRecallBanner(
                  cached.createdAt,
                  !!cached.userEdits,
                );

                return cached.analysis;
              } else {
                logInfo(
                  `Cache hit but settings differ (cached profile: ${cachedProfile}, text detection skipped: ${cachedOcrSkipped}; now: ${profile}, skipped: ${this._isSkipOcrTicked()}) — re-analysing`,
                );
              }
            }

            // No usable cache — the slow path. Nothing is said here any more
            // (H-64): the start line is written where text detection really
            // starts, in runGatedAnalysis.

            // Run two-phase analysis
            const analyser = window.ImageDescriberAnalyser;

            // Check if two-phase API is available (Phase 15A)
            if (typeof analyser.analyseImmediate !== "function") {
              // Fallback: use single-phase analyse() (pre-15A compatibility)
              logInfo(`Starting background analysis with profile: ${profile}`);
              return analyser.analyse(previewImg, profile).then((result) => {
                applyFullResult(result);
                logInfo(
                  `Background analysis complete in ${result.totalDuration}ms ` +
                    `(OCR: ${result.ocr?.status}, Colour: ${result.colour?.status})`,
                );
                return result;
              });
            }

            // Phase 15B: Two-phase analysis
            logInfo("Starting immediate analysis (colour)...");
            return analyser.analyseImmediate(previewImg).then((immediate) => {
              if (!immediate || !immediate.result) {
                logWarn("Immediate analysis returned no result");
                return null;
              }

              // Store immediate result for gated phase
              self._immediateResult = immediate.result;
              self._immediateCanvasData = immediate.canvasData;

              // Store partial analysis (colour available for the prompt)
              self.lastAnalysis = immediate.result;

              logInfo(
                `Immediate analysis complete ` +
                  `(Colour: ${immediate.result.colour?.status})`,
              );

              // Text detection starts only once the person has answered
              // "Detect text in this picture?" (H-64). Until then the quick
              // result waits and the status list says so. The gated run is NOT
              // returned, so _analysisPending still resolves at the quick
              // result, and Generate pressed during detection does not wait for
              // it unless the person chose "Detect text, then describe" (H-33, H-36).
              if (runId !== self._analysisRunId) return null;
              if (self._hasTextChoice()) {
                self._textDetectionPromise = self._detectTextOrRestore(
                  profile,
                  self._isSkipOcrTicked(),
                  runId,
                  skipSavedLookup,
                );
              } else {
                logInfo("Quick analysis done — waiting for the text detection choice");
                self._updateAnalysisStatus("ocr", "waiting");
              }

              return immediate.result;
            });
          })
          .catch((err) => {
            this._analysisPending = null;
            logWarn("Background analysis failed:", err.message);
            return null;
          });
      };

      // If image is already loaded, start immediately; otherwise wait
      if (previewImg.complete && previewImg.naturalWidth > 0) {
        runAnalysis();
      } else {
        previewImg.addEventListener("load", runAnalysis, { once: true });
      }
    },

    /**
     * Run the gated analysis phase: text detection (Phase 15B).
     * Called straight after the quick colour analysis (H-56); it used to wait
     * for an answer to the profile suggestion banner, which no longer exists.
     *
     * @param {string} profileName — confirmed profile name
     * @param {boolean} skipOCR — whether to skip Tesseract OCR
     * @param {number} [runId] — the start (startBackgroundAnalysis) this pass belongs to;
     *   when a newer start has happened by the time it finishes, its result is dropped
     * @returns {Promise<object|null>} Full analysis result or null on failure
     */
    async runGatedAnalysis(profileName, skipOCR, runId) {
      const analyser = window.ImageDescriberAnalyser;

      if (typeof analyser.analyseGated !== "function") {
        logWarn("analyseGated not available — falling back to full analyse()");
        const previewImg = this.elements.preview?.querySelector("img");
        if (!previewImg) return null;
        const result = await analyser.analyse(previewImg, profileName);
        this.lastAnalysis = result;
        return result;
      }

      if (!this._immediateResult) {
        logWarn("runGatedAnalysis called without immediate result");
        return null;
      }

      logInfo(
        `Running gated analysis with profile: ${profileName}, skipOCR: ${skipOCR}`,
      );

      // Text detection is really starting: say so once. Skip text says nothing
      // here; its completion line is the only voice (H-64).
      if (!skipOCR) this.announceStatus(DETECTING_TEXT_START);

      try {
        const result = await analyser.analyseGated(
          this._immediateResult,
          this._immediateCanvasData,
          profileName,
          { skipOCR: skipOCR },
        );

        // Superseded while it ran: a newer start owns lastAnalysis and the
        // completion announcement, so this result is dropped untouched.
        if (runId !== undefined && runId !== this._analysisRunId) {
          logInfo("Gated analysis superseded by a newer start — result dropped");
          return null;
        }

        // Store final result
        this.lastAnalysis = result;
        this._analysisPending = null;

        // Clear immediate state (no longer needed)
        this._immediateResult = null;
        this._immediateCanvasData = null;

        this._onAnalysisComplete(result);

        logInfo(
          `Gated analysis complete in ${result.totalDuration}ms ` +
            `(OCR: ${result.ocr?.status})`,
        );

        return result;
      } catch (err) {
        logWarn("Gated analysis failed:", err.message);
        return null;
      }
    },

    // ========================================================================
    // FLORENCE-2 OPT-IN (Phase 10C-fix)
    // ========================================================================

    /**
     * Run Florence-2 caption on the current image (opt-in, Phase 10C-fix).
     * Updates lastAnalysis with results, re-renders overlay if needed.
     */
    async runFlorenceAnalysis() {
      const gateway = window.ImageDescriberAnalyserTransformers;
      if (!gateway || gateway.getFlorenceStatus() !== "ready") {
        logWarn("runFlorenceAnalysis: Florence-2 not ready");
        return;
      }
      if (!this.lastAnalysis) {
        logWarn("runFlorenceAnalysis: no analysis to enrich");
        return;
      }

      const btn = document.getElementById("imgdesc-florence2-run-btn");
      const statusEl = document.getElementById("imgdesc-florence2-status");
      const captionChecked = document.getElementById(
        "imgdesc-florence2-caption",
      );
      const ocrChecked = document.getElementById("imgdesc-florence2-ocr");

      if (btn) {
        btn.disabled = true;
        btn.textContent = "Running\u2026";
      }
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Running Florence-2\u2026";
      }

      try {
        const img = document.querySelector("#imgdesc-preview img");
        if (!img) throw new Error("No image in preview");

        const tasks = [];
        if (captionChecked && captionChecked.checked) tasks.push("caption");
        if (ocrChecked && ocrChecked.checked) tasks.push("ocr");

        // ── Caption ──────────────────────────────────────────────
        if (tasks.includes("caption")) {
          if (statusEl) {
            statusEl.textContent =
              "Running Florence-2 caption\u2026 (~30 seconds)";
          }
          const captionResult = await gateway.generateCaption(img);
          this.lastAnalysis.florenceCaption = captionResult;
          logInfo("Florence-2 caption complete:", captionResult.status);
        }

        // ── OCR ──────────────────────────────────────────────────
        if (tasks.includes("ocr")) {
          if (statusEl) {
            statusEl.textContent = "Running Florence-2 OCR\u2026 (~30 seconds)";
          }
          this._updateAnalysisSlotLi("florenceOCR", "running");
          const ocrResult = await gateway.extractOCR(img);
          this.lastAnalysis.florenceOCR = ocrResult;
          logInfo("Florence-2 OCR complete:", ocrResult.status);
          this._updateAnalysisSlotLi("florenceOCR", ocrResult.status === "complete" ? "complete" : "error");

          // Merge with Tesseract if both are complete
          if (
            ocrResult.status === "complete" &&
            this.lastAnalysis.ocr &&
            this.lastAnalysis.ocr.status === "complete" &&
            window.ImageDescriberAnalyserOCR
          ) {
            const mergeResult =
              window.ImageDescriberAnalyserOCR.mergeTesseractAndFlorence(
                this.lastAnalysis.ocr.items,
                ocrResult.items,
                img.naturalWidth,
                img.naturalHeight,
              );
            this.lastAnalysis.ocr.items = mergeResult.merged;
            // Record that the merge ran, as a fact rather than as something
            // inferred later from the merged list. The format layer used to
            // infer it by looking for a surviving item with source ===
            // "florence2", which reads false exactly when dedup worked best —
            // every Florence item overlapped a Tesseract one and was dropped.
            // The flag lives on ocr so it survives both the getCorrectedAnalysis()
            // deep copy and the cache round trip (updateSlot saves the whole
            // ocr object below).
            this.lastAnalysis.ocr.florenceMergeApplied = true;
            logInfo("OCR merge stats:", mergeResult.stats);
          }
        }

        // Re-render overlay with new data
        if (
          window.ImageDescriberOverlay &&
          window.ImageDescriberOverlay._analysisRef
        ) {
          window.ImageDescriberOverlay.setAnalysis(this.lastAnalysis);
        }

        // ── Persist enriched analysis to cache (Bug #6) ──────────
        if (
          this.currentFileHash &&
          typeof window.ImageDescriberCache !== "undefined"
        ) {
          try {
            if (
              this.lastAnalysis.florenceCaption &&
              this.lastAnalysis.florenceCaption.status === "complete"
            ) {
              await window.ImageDescriberCache.updateSlot(
                this.currentFileHash,
                "florenceCaption",
                this.lastAnalysis.florenceCaption,
              );
            }
            if (
              this.lastAnalysis.florenceOCR &&
              this.lastAnalysis.florenceOCR.status === "complete"
            ) {
              await window.ImageDescriberCache.updateSlot(
                this.currentFileHash,
                "florenceOCR",
                this.lastAnalysis.florenceOCR,
              );
            }
            // Also save the merged OCR items
            if (this.lastAnalysis.ocr) {
              await window.ImageDescriberCache.updateSlot(
                this.currentFileHash,
                "ocr",
                this.lastAnalysis.ocr,
              );
            }
            logInfo("Florence-2 results saved to cache");
          } catch (cacheErr) {
            logWarn(
              "Failed to save Florence-2 results to cache:",
              cacheErr.message,
            );
          }
        }

        // Mark that Florence-2 ran successfully this session
        this._florenceRanThisSession = true;

        // ── Status summary ───────────────────────────────────────
        if (btn) {
          btn.textContent = "Florence-2 Complete \u2713";
        }
        if (statusEl) {
          const parts = [];
          if (this.lastAnalysis.florenceCaption) {
            const capDur = this.lastAnalysis.florenceCaption.duration;
            parts.push(
              "Caption " + (capDur ? (capDur / 1000).toFixed(1) + "s" : "done"),
            );
          }
          if (this.lastAnalysis.florenceOCR) {
            const ocrDur = this.lastAnalysis.florenceOCR.duration;
            parts.push(
              "OCR " + (ocrDur ? (ocrDur / 1000).toFixed(1) + "s" : "done"),
            );
          }
          statusEl.textContent = parts.length ? parts.join(" | ") : "Complete";
        }
      } catch (err) {
        logError("Florence-2 analysis failed:", err.message || err);
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Retry Florence-2";
        }
        if (statusEl) {
          statusEl.textContent = "Failed: " + (err.message || "Unknown error");
        }
      }
    },

    /**
     * Show/hide and enable/disable the Florence-2 opt-in section.
     * Visible when: Florence-2 model ready AND an image is uploaded.
     */
    _updateFlorenceOptinState() {
      const section = document.getElementById("imgdesc-florence2-optin");
      const btn = document.getElementById("imgdesc-florence2-run-btn");
      if (!section || !btn) return;

      const gateway = window.ImageDescriberAnalyserTransformers;
      const florenceReady = gateway && gateway.getFlorenceStatus() === "ready";
      const hasImage = !!this.lastAnalysis;

      section.hidden = !(florenceReady && hasImage);

      // Detect cached Florence-2 data (not from this session)
      const captionCached =
        this.lastAnalysis &&
        this.lastAnalysis.florenceCaption &&
        this.lastAnalysis.florenceCaption.status === "complete";
      const ocrCached =
        this.lastAnalysis &&
        this.lastAnalysis.florenceOCR &&
        this.lastAnalysis.florenceOCR.status === "complete";
      const hasCachedData =
        (captionCached || ocrCached) && !this._florenceRanThisSession;

      const statusEl = document.getElementById("imgdesc-florence2-status");
      const captionCb = document.getElementById("imgdesc-florence2-caption");
      const ocrCb = document.getElementById("imgdesc-florence2-ocr");

      if (this._florenceRanThisSession) {
        // Ran this session — show completion state
        btn.disabled = true;
        btn.textContent = "Florence-2 Complete \u2713";
      } else if (hasCachedData) {
        // Data restored from cache — inform user, disable controls
        btn.disabled = true;
        btn.innerHTML =
          '<span aria-hidden="true">' +
          window.getIcon("check") +
          "</span> Restored from cache";
        if (captionCb) captionCb.disabled = true;
        if (ocrCb) ocrCb.disabled = true;

        // Update the analysis slot to show cached state
        if (ocrCached) {
          this._updateAnalysisSlotLi("florenceOCR", "cached");
        }

        // Build status summary
        if (statusEl) {
          const parts = [];
          if (captionCached) parts.push("caption");
          if (ocrCached) parts.push("OCR");
          statusEl.textContent =
            "Florence-2 " +
            parts.join(" + ") +
            " restored from a previous analysis of this image.";
          statusEl.hidden = false;
        }
      } else {
        // Default state — ready to run
        btn.disabled = !florenceReady || !hasImage;
        btn.innerHTML =
          '<span aria-hidden="true">' +
          window.getIcon("aiSparkle") +
          "</span> Run Florence-2";
        if (captionCb) captionCb.disabled = false;
        if (ocrCb) ocrCb.disabled = false;
        if (statusEl) {
          statusEl.textContent = "";
          statusEl.hidden = true;
        }
      }

      // Update the quick-access OCR prompt (Phase 14J)
      this._updateFlorenceOCRPrompt();
    },

    // ========================================================================
    // FLORENCE-2 OCR QUICK-ACCESS (Phase 14J)
    // ========================================================================

    /**
     * Show/hide/update the Florence-2 OCR quick-access prompt.
     * Appears between the classification badge and the overlay toolbar.
     * Element is lazily created on first call.
     *
     * States: hidden, loading, running, ready, cached, not-downloaded.
     * Hidden when no image, during output mode, or when Florence OCR
     * data already exists (from cache or a previous run).
     */
    _updateFlorenceOCRPrompt() {
      // Lazy-create the element if it doesn't exist
      let prompt = document.getElementById("imgdesc-florence-ocr-prompt");
      if (!prompt) {
        const toolbar = document.getElementById("imgdesc-overlay-toolbar");
        if (!toolbar || !toolbar.parentNode) return;

        prompt = document.createElement("div");
        prompt.id = "imgdesc-florence-ocr-prompt";
        prompt.className = "imgdesc-florence-ocr-prompt";
        prompt.setAttribute("role", "status");
        prompt.setAttribute("aria-live", "polite");
        prompt.hidden = true;
        toolbar.parentNode.insertBefore(prompt, toolbar);
      }

      // Guard: no analysis yet
      if (!this.lastAnalysis) {
        prompt.hidden = true;
        return;
      }

      // Guard: the question is unanswered, or the person said "no text in this
      // image" — Florence-2 OCR not useful (yet)
      if (!this._hasTextChoice() || this._isSkipOcrTicked()) {
        prompt.hidden = true;
        return;
      }

      // Guard: Florence OCR already complete (from this session or cache)
      const ocrDone =
        this.lastAnalysis.florenceOCR &&
        this.lastAnalysis.florenceOCR.status === "complete";
      if (ocrDone) {
        prompt.hidden = true;
        return;
      }

      // Loading state — model being loaded from cache (async, page responsive)
      if (this._florenceOCRLoading) {
        prompt.hidden = false;
        prompt.innerHTML =
          '<span class="imgdesc-florence-ocr-running-text">' +
          '<span aria-hidden="true">' +
          window.getIcon("aiSparkle") +
          "</span> " +
          "Loading Florence-2\u2026" +
          "</span>";
        prompt.classList.add("imgdesc-florence-ocr-prompt--running");
        prompt.classList.remove("imgdesc-florence-ocr-prompt--ready");
        return;
      }

      // Running state — inference in progress (main thread blocked)
      if (this._florenceOCRRunning) {
        prompt.hidden = false;
        prompt.innerHTML =
          '<span class="imgdesc-florence-ocr-running-text">' +
          '<span aria-hidden="true">' +
          window.getIcon("aiSparkle") +
          "</span> " +
          "Detecting text\u2026" +
          "</span>" +
          '<span class="imgdesc-florence-ocr-hint">' +
          "This can take 1\u20132 minutes. The page may be unresponsive." +
          "</span>";
        prompt.classList.add("imgdesc-florence-ocr-prompt--running");
        prompt.classList.remove("imgdesc-florence-ocr-prompt--ready");
        return;
      }

      // Check Florence-2 availability
      const gateway = window.ImageDescriberAnalyserTransformers;
      const florenceReady = gateway && gateway.getFlorenceStatus() === "ready";

      if (florenceReady) {
        // Ready — model loaded, one click to run OCR
        prompt.hidden = false;
        prompt.innerHTML =
          '<button type="button" class="imgdesc-florence-ocr-btn" ' +
          'onclick="ImageDescriberController.runFlorenceOCRDirect()">' +
          '<span aria-hidden="true">' +
          window.getIcon("aiSparkle") +
          "</span> " +
          "Florence-2 loaded: Enhance text detection" +
          "</button>" +
          '<span class="imgdesc-florence-ocr-hint">' +
          "Finds vertical and rotated labels that standard OCR misses" +
          "</span>";
        prompt.classList.add("imgdesc-florence-ocr-prompt--ready");
        prompt.classList.remove("imgdesc-florence-ocr-prompt--running");
        return;
      }

      // Check if cached but not loaded (via Model Manager state)
      const mm = window.ImageDescriberModelManager;
      const mmState = mm ? mm.getModelState("florence2") : "unknown";

      if (mmState === "cached") {
        // Cached — can auto-load and run without visiting Model Manager
        prompt.hidden = false;
        prompt.innerHTML =
          '<button type="button" class="imgdesc-florence-ocr-btn" ' +
          'onclick="ImageDescriberController.runFlorenceOCRDirect()">' +
          '<span aria-hidden="true">' +
          window.getIcon("aiSparkle") +
          "</span> " +
          "Load Florence-2 and enhance text detection" +
          "</button>" +
          '<span class="imgdesc-florence-ocr-hint">' +
          "Cached locally \u2014 loads in ~10s then detects vertical and rotated text" +
          "</span>";
        prompt.classList.add("imgdesc-florence-ocr-prompt--ready");
        prompt.classList.remove("imgdesc-florence-ocr-prompt--running");
      } else {
        // Not downloaded — link to Model Manager for first-time download
        prompt.hidden = false;
        prompt.innerHTML =
          '<button type="button" class="imgdesc-florence-ocr-link" ' +
          'onclick="ImageDescriberController.runFlorenceOCRDirect()">' +
          '<span aria-hidden="true">' +
          window.getIcon("download") +
          "</span> " +
          "Get Florence-2 for enhanced text detection" +
          "</button>";
        prompt.classList.remove("imgdesc-florence-ocr-prompt--ready");
        prompt.classList.remove("imgdesc-florence-ocr-prompt--running");
      }
    },

    /**
     * Run Florence-2 OCR directly from the quick-access prompt.
     * Three paths:
     *   1. Florence-2 loaded (ready) → run OCR immediately
     *   2. Florence-2 cached but not loaded → auto-load from cache, then run OCR
     *   3. Florence-2 never downloaded → open Model Manager, focus Florence-2 row
     */
    async runFlorenceOCRDirect() {
      const gateway = window.ImageDescriberAnalyserTransformers;
      const florenceReady = gateway && gateway.getFlorenceStatus() === "ready";

      // ── Guard: already running or loading ──
      if (this._florenceOCRRunning || this._florenceOCRLoading) {
        logWarn("runFlorenceOCRDirect: already in progress");
        return;
      }

      // ── Guard: need analysis data ──
      if (!this.lastAnalysis) {
        logWarn("runFlorenceOCRDirect: no analysis to enrich");
        return;
      }

      // ── Path 3: Not downloaded — guide user to Model Manager ──
      if (!florenceReady) {
        const mm = window.ImageDescriberModelManager;
        const mmState = mm ? mm.getModelState("florence2") : "unknown";

        if (mmState !== "cached") {
          // Never downloaded — open Model Manager and focus Florence-2 row
          const panel = document.getElementById("imgdesc-model-manager-panel");
          if (panel) {
            panel.open = true;
            await new Promise(function (r) { setTimeout(r, 100); });
            const florenceRow = document.getElementById("imgdesc-mm-model-florence2");
            if (florenceRow) {
              florenceRow.scrollIntoView({ behavior: "instant", block: "center" });
              const actionBtn = florenceRow.querySelector(".imgdesc-mm-model-actions button");
              if (actionBtn) {
                setTimeout(function () { actionBtn.focus(); }, 300);
              }
            }
          }
          return;
        }

        // ── Path 2: Cached — auto-load from cache, then run OCR ──
        logInfo("Florence-2 cached — auto-loading before OCR");
        this._florenceOCRLoading = true;
        this._updateFlorenceOCRPrompt();

        try {
          await mm.loadModel("florence2");
          logInfo("Florence-2 loaded from cache");
        } catch (loadErr) {
          logError("Failed to auto-load Florence-2:", loadErr.message || loadErr);
          this._florenceOCRLoading = false;
          const prompt = document.getElementById("imgdesc-florence-ocr-prompt");
          if (prompt) {
            prompt.innerHTML =
              "Failed to load Florence-2. Try loading from Model Manager.";
            setTimeout(function () {
              if (prompt) prompt.hidden = true;
            }, 5000);
          }
          return;
        }
        this._florenceOCRLoading = false;
      }

      // ── Paths 1 & 2 continue: run Florence-2 OCR ──
      logInfo("Running Florence-2 OCR via quick-access prompt");
      this._florenceOCRRunning = true;
      this._florenceOCRStartTime = Date.now();
      this._updateFlorenceOCRPrompt();
      this._updateAnalysisSlotLi("florenceOCR", "running");

      try {
        const img = document.querySelector("#imgdesc-preview img");
        if (!img) throw new Error("No image in preview");

        // Run OCR only (no caption) — this blocks the main thread
        const ocrResult = await gateway.extractOCR(img);
        this.lastAnalysis.florenceOCR = ocrResult;
        logInfo("Florence-2 OCR complete:", ocrResult.status);
        this._updateAnalysisSlotLi("florenceOCR", ocrResult.status === "complete" ? "complete" : "error");

        // Merge with Tesseract results if both complete
        let newItemCount = 0;
        if (
          ocrResult.status === "complete" &&
          this.lastAnalysis.ocr &&
          this.lastAnalysis.ocr.status === "complete" &&
          window.ImageDescriberAnalyserOCR
        ) {
          const beforeCount = this.lastAnalysis.ocr.items.length;
          const mergeResult =
            window.ImageDescriberAnalyserOCR.mergeTesseractAndFlorence(
              this.lastAnalysis.ocr.items,
              ocrResult.items,
              img.naturalWidth,
              img.naturalHeight,
            );
          this.lastAnalysis.ocr.items = mergeResult.merged;
          // Same recording as the Florence-2 panel path above — this
          // quick-access prompt is a sibling merge site, so it must set the
          // flag too or the format layer will re-emit the redundant section
          // for anyone who enhanced OCR from here rather than from the panel.
          this.lastAnalysis.ocr.florenceMergeApplied = true;
          newItemCount = mergeResult.merged.length - beforeCount;
          logInfo("OCR merge stats:", mergeResult.stats);
        }

        // Re-render overlay with new data
        if (
          window.ImageDescriberOverlay &&
          window.ImageDescriberOverlay._analysisRef
        ) {
          window.ImageDescriberOverlay.setAnalysis(this.lastAnalysis);
        }

        // Save to cache
        if (
          this.currentFileHash &&
          typeof window.ImageDescriberCache !== "undefined"
        ) {
          try {
            await window.ImageDescriberCache.updateSlot(
              this.currentFileHash,
              "florenceOCR",
              this.lastAnalysis.florenceOCR,
            );
            if (this.lastAnalysis.ocr) {
              await window.ImageDescriberCache.updateSlot(
                this.currentFileHash,
                "ocr",
                this.lastAnalysis.ocr,
              );
            }
            logInfo("Florence-2 OCR results saved to cache");
          } catch (cacheErr) {
            logWarn("Failed to save Florence-2 OCR to cache:", cacheErr.message);
          }
        }

        // Show completion with elapsed time
        this._florenceOCRRunning = false;
        const elapsed = Math.round((Date.now() - this._florenceOCRStartTime) / 1000);
        const prompt = document.getElementById("imgdesc-florence-ocr-prompt");
        if (prompt) {
          const items = newItemCount > 0
            ? newItemCount + " new item" + (newItemCount !== 1 ? "s" : "") + " found"
            : "no new items \u2014 Tesseract caught everything";
          const msg = "Enhanced \u2713 (" + items + ") \u2014 " + elapsed + "s";
          prompt.hidden = false;
          prompt.innerHTML =
            '<span class="imgdesc-florence-ocr-complete">' + msg + "</span>";
          prompt.classList.remove("imgdesc-florence-ocr-prompt--running");
          prompt.classList.remove("imgdesc-florence-ocr-prompt--ready");
          // Hide after 8 seconds (longer to let user read elapsed time)
          setTimeout(function () {
            if (prompt) prompt.hidden = true;
          }, 8000);
        }

        // Update the Model Manager opt-in state too
        this._updateFlorenceOptinState();

      } catch (err) {
        logError("Florence-2 OCR quick-access failed:", err.message || err);
        this._florenceOCRRunning = false;
        this._updateAnalysisSlotLi("florenceOCR", "error");
        const prompt = document.getElementById("imgdesc-florence-ocr-prompt");
        if (prompt) {
          prompt.innerHTML =
            "Enhanced text detection failed. Try again from Model Manager.";
          setTimeout(function () {
            if (prompt) prompt.hidden = true;
          }, 5000);
        }
      }
    },
  };

  // ============================================================================
  // MIX INTO CONTROLLER
  // ============================================================================

  if (window.ImageDescriberController) {
    Object.assign(window.ImageDescriberController, methods);
    logInfo("Analysis pipeline methods loaded");
  } else {
    logError("ImageDescriberController not found — analysis methods not loaded");
  }
})();
