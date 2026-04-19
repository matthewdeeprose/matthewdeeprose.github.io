/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER CONTROLLER — ANALYSIS PIPELINE SUB-MODULE
 * ═══════════════════════════════════════════════════════════════
 *
 * Analysis orchestration, profile management, cache recall,
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

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[IDC-Analysis] ${message}`, ...args);
  }

  // ============================================================================
  // ANALYSIS PIPELINE METHODS
  // ============================================================================

  const methods = {

    // ========================================================================
    // ANALYSIS PROFILE SELECTION (Phase 4C)
    // ========================================================================

    /**
     * Get the currently selected analysis profile name.
     * @returns {string} profile name (e.g. "default", "chart")
     */
    getSelectedProfile() {
      const checked = document.querySelector(
        'input[name="imgdesc-profile"]:checked',
      );
      return checked ? checked.value : "default";
    },

    /**
     * Set the selected analysis profile by value.
     * @param {string} profileName
     */
    setSelectedProfile(profileName) {
      const radio = document.querySelector(
        `input[name="imgdesc-profile"][value="${profileName}"]`,
      );
      if (radio) {
        radio.checked = true;
        logDebug(`Profile set to: ${profileName}`);
      } else {
        logWarn(`Profile not found: ${profileName}, falling back to default`);
        const defaultRadio = document.querySelector(
          'input[name="imgdesc-profile"][value="default"]',
        );
        if (defaultRadio) defaultRadio.checked = true;
      }
    },

    /**
     * Handle profile change — persist and re-run analysis if image loaded.
     * @param {string} profileName — the newly selected profile
     */
    handleProfileChange(profileName) {
      // Persist selection
      try {
        localStorage.setItem("imgdesc-profile", profileName);
      } catch (e) {
        logWarn("Could not save profile selection:", e);
      }

      logInfo(`Analysis profile changed to: ${profileName}`);

      // If in two-phase flow (immediate analysis done, awaiting profile
      // confirmation), run the gated phase directly instead of restarting
      if (this._immediateResult) {
        const skipOCRCheckbox = document.getElementById("imgdesc-skip-ocr");
        const skipOCR = skipOCRCheckbox ? skipOCRCheckbox.checked : false;

        logInfo(
          `Profile selected during two-phase flow — running gated analysis: ${profileName}, skipOCR: ${skipOCR}`,
        );
        this.runGatedAnalysis(profileName, skipOCR);
        return;
      }

      // Re-run analysis if an image is currently loaded
      if (this.currentFile && this.elements.preview?.querySelector("img")) {
        this.startBackgroundAnalysis();
      }
    },

    // ========================================================================
    // PROFILE SUGGESTION (Phase 5C)
    // ========================================================================

    /**
     * Show a suggestion banner when classification recommends a different profile.
     * If heuristic and CLIP disagree, shows both options.
     * @param {Object} classification - { profile, confidence, reason, source, scores, heuristic?, clip? }
     */
    showProfileSuggestion(classification) {
      const banner = document.getElementById("imgdesc-profile-suggestion");
      if (!banner) return;

      // Reset skip OCR checkbox (Phase 15B)
      const skipOCRCheckbox = document.getElementById("imgdesc-skip-ocr");
      if (skipOCRCheckbox) skipOCRCheckbox.checked = false;

      const currentProfile = this.getSelectedProfile();
      const inTwoPhaseFlow = this._immediateResult !== null;

      // Phase 15B: In two-phase flow, always show the banner so the user can
      // confirm the profile and optionally skip text detection before gated
      // analysis runs. When no profile change is needed, show a confirmation
      // banner instead of a suggestion banner.
      const suggestedProfile = classification?.profile;
      const noSuggestion =
        !suggestedProfile ||
        suggestedProfile === "default" ||
        suggestedProfile === currentProfile;

      if (noSuggestion && !inTwoPhaseFlow) {
        // Old behaviour: hide banner when not in two-phase flow
        banner.hidden = true;
        return;
      }

      if (noSuggestion && inTwoPhaseFlow) {
        // Two-phase flow but no profile change needed — show confirmation banner
        const currentDisplayName =
          currentProfile.charAt(0).toUpperCase() + currentProfile.slice(1);

        this._pendingSuggestion = { profile: currentProfile };
        this._pendingAlternative = null;

        const textEl = document.getElementById(
          "imgdesc-profile-suggestion-text",
        );
        const applyBtn = banner.querySelector(
          ".imgdesc-profile-suggestion-apply",
        );

        if (textEl) {
          textEl.innerHTML =
            `Ready to analyse with the <strong>${currentDisplayName}</strong> profile. ` +
            `Proceed, or choose another profile?`;
        }
        if (applyBtn) applyBtn.textContent = "Proceed";

        // Hide alternative button if it exists
        const altBtn = banner.querySelector(
          ".imgdesc-profile-suggestion-apply-alt",
        );
        if (altBtn) altBtn.hidden = true;

        banner.hidden = false;
        logInfo(
          `Profile confirmation banner shown for: ${currentProfile} (no change needed)`,
        );
        return;
      }

      // Store pending suggestion
      this._pendingSuggestion = classification;
      this._pendingAlternative = null;

      // Detect conflicting alternative
      let altProfile = null;
      let altSource = null;
      let altConfidence = null;

      if (classification.source === "clip" && classification.heuristic) {
        // CLIP won, check if heuristic had a different idea
        const h = classification.heuristic;
        if (
          h.profile &&
          h.profile !== classification.profile &&
          h.profile !== "default" &&
          h.profile !== currentProfile
        ) {
          altProfile = h.profile;
          altSource = "heuristic";
          altConfidence = h.confidence;
        }
      } else if (
        classification.source === "heuristic" &&
        classification.clip &&
        classification.clip.status === "success"
      ) {
        // Heuristic won, check if CLIP had a different idea
        const profiles = window.ImageDescriberAnalyserProfiles;
        const clipMapped =
          profiles?.LABEL_TO_PROFILE?.[classification.clip.topLabel];
        if (
          clipMapped &&
          clipMapped !== classification.profile &&
          clipMapped !== "default" &&
          clipMapped !== currentProfile
        ) {
          altProfile = clipMapped;
          altSource = "clip";
          altConfidence = classification.clip.topConfidence;
        }
      }

      // Build display names
      const displayName =
        classification.profile.charAt(0).toUpperCase() +
        classification.profile.slice(1);
      const confidenceText =
        classification.confidence != null
          ? ` (${Math.round(classification.confidence * 100)}% confidence)`
          : "";

      const textEl = document.getElementById("imgdesc-profile-suggestion-text");
      const applyBtn = banner.querySelector(
        ".imgdesc-profile-suggestion-apply",
      );

      if (altProfile && altProfile !== classification.profile) {
        // Conflicting suggestion — show both options
        const altDisplayName =
          altProfile.charAt(0).toUpperCase() + altProfile.slice(1);
        const altConfText =
          altConfidence != null ? ` (${Math.round(altConfidence * 100)}%)` : "";

        this._pendingAlternative = altProfile;

        if (textEl) {
          textEl.innerHTML =
            `Analysis suggests this could be a <strong>${displayName}</strong>${confidenceText} or a <strong>${altDisplayName}</strong>${altConfText}. ` +
            `Which profile would you like to use?`;
        }

        // Update primary Apply button text
        if (applyBtn) applyBtn.textContent = "Apply " + displayName;

        // Show or create the alternative Apply button
        let altBtn = banner.querySelector(
          ".imgdesc-profile-suggestion-apply-alt",
        );
        if (!altBtn) {
          altBtn = document.createElement("button");
          altBtn.type = "button";
          altBtn.className = "imgdesc-profile-suggestion-apply-alt";
          altBtn.setAttribute(
            "onclick",
            "ImageDescriberController.applyAlternativeSuggestion()",
          );
          // Insert after primary Apply button
          if (applyBtn && applyBtn.parentNode) {
            applyBtn.parentNode.insertBefore(altBtn, applyBtn.nextSibling);
          }
        }
        altBtn.textContent = "Apply " + altDisplayName;
        altBtn.hidden = false;
      } else {
        // Single suggestion — standard banner
        this._pendingAlternative = null;

        if (textEl) {
          textEl.innerHTML =
            `Analysis suggests this is a <strong>${displayName}</strong>${confidenceText}. ` +
            `Switch to the ${displayName} profile for optimised results?`;
        }

        // Reset primary Apply button text
        if (applyBtn) applyBtn.textContent = "Apply";

        // Hide alternative button if it exists
        const altBtn = banner.querySelector(
          ".imgdesc-profile-suggestion-apply-alt",
        );
        if (altBtn) altBtn.hidden = true;
      }

      banner.hidden = false;
      logInfo(
        `Profile suggestion shown: ${classification.profile} (${classification.source})` +
          (altProfile ? ` with alternative: ${altProfile} (${altSource})` : ""),
      );
    },

    /**
     * Slot definitions for the analysis status display.
     * Keys match analysis:stage event stage values.
     */
    _ANALYSIS_STATUS_SLOTS: {
      clip: { label: "CLIP classification" },
      colour: { label: "Colour sampling" },
      ocr: { label: "Tesseract OCR" },
      depth: { label: "Depth estimation" },
      florenceOCR: { label: "Florence-2 OCR (optional)" },
    },

    /**
     * Icon and text mappings for analysis slot statuses.
     */
    _ANALYSIS_STATUS_ICONS: {
      pending: { icon: "", text: "pending" },
      running: { icon: "hourglass", text: "running\u2026" },
      complete: { icon: "checkCircle", text: "complete" },
      skipped: { icon: "close", text: "skipped" },
      error: { icon: "error", text: "failed" },
      cached: { icon: "disk", text: "restored from cache" },
    },

    /**
     * Update the analysis progress status display (Phase 6A, enhanced Phase 9E).
     * Shows per-slot breakdown with icons matching the generation progress style.
     * @param {string} stage — "analysis", "ocr", "colour", "clip"
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
      if (stage === "clip") this._stageStatus_clip = status;
      if (stage === "colour") this._stageStatus_colour = status;
      if (stage === "ocr") this._stageStatus_ocr = status;
      if (stage === "depth") this._stageStatus_depth = status;
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
     * Apply the pending profile suggestion — changes selection, persists, re-analyses.
     */
    applyProfileSuggestion() {
      if (!this._pendingSuggestion) return;

      const suggestedProfile = this._pendingSuggestion.profile;

      // Read skip OCR checkbox state (Phase 15B)
      const skipOCRCheckbox = document.getElementById("imgdesc-skip-ocr");
      const skipOCR = skipOCRCheckbox ? skipOCRCheckbox.checked : false;

      // Change the profile selection (UI radio button)
      this.setSelectedProfile(suggestedProfile);

      // Persist profile selection
      try {
        localStorage.setItem("imgdesc-profile", suggestedProfile);
      } catch (e) {
        logWarn("Could not save profile selection:", e);
      }

      // Hide banner
      const banner = document.getElementById("imgdesc-profile-suggestion");
      if (banner) banner.hidden = true;
      this._pendingSuggestion = null;
      this._pendingAlternative = null;

      // Move focus to the now-checked radio button
      const checkedRadio = document.querySelector(
        'input[name="imgdesc-profile"]:checked',
      );
      if (checkedRadio) checkedRadio.focus();

      logInfo(
        `Profile suggestion applied: ${suggestedProfile}, skipOCR: ${skipOCR}`,
      );

      // Run gated analysis with confirmed profile (Phase 15B)
      this.runGatedAnalysis(suggestedProfile, skipOCR);
    },

    /**
     * Apply the alternative profile from a conflicting suggestion.
     */
    applyAlternativeSuggestion() {
      if (!this._pendingAlternative) return;

      const altProfile = this._pendingAlternative;

      // Read skip OCR checkbox state (Phase 15B)
      const skipOCRCheckbox = document.getElementById("imgdesc-skip-ocr");
      const skipOCR = skipOCRCheckbox ? skipOCRCheckbox.checked : false;

      // Change the profile selection
      this.setSelectedProfile(altProfile);

      // Persist profile selection
      try {
        localStorage.setItem("imgdesc-profile", altProfile);
      } catch (e) {
        logWarn("Could not save profile selection:", e);
      }

      // Hide banner
      const banner = document.getElementById("imgdesc-profile-suggestion");
      if (banner) banner.hidden = true;
      this._pendingSuggestion = null;
      this._pendingAlternative = null;

      // Move focus to the now-checked radio button
      const checkedRadio = document.querySelector(
        'input[name="imgdesc-profile"]:checked',
      );
      if (checkedRadio) checkedRadio.focus();

      logInfo(
        `Alternative profile suggestion applied: ${altProfile}, skipOCR: ${skipOCR}`,
      );

      // Run gated analysis with confirmed profile (Phase 15B)
      this.runGatedAnalysis(altProfile, skipOCR);
    },

    /**
     * Open the expert panel profile section so the user can choose manually.
     */
    chooseProfileManually() {
      // Hide the suggestion banner
      const banner = document.getElementById("imgdesc-profile-suggestion");
      if (banner) banner.hidden = true;
      this._pendingSuggestion = null;
      this._pendingAlternative = null;

      // Open the expert panel if it's closed
      const expertPanel = document.getElementById("imgdesc-expert-panel");
      if (expertPanel && !expertPanel.open) {
        expertPanel.open = true;
      }

      // Scroll to and focus the profile heading
      const profileHeading = document.getElementById("imgdesc-profile-heading");
      if (profileHeading) {
        profileHeading.scrollIntoView({ behavior: "smooth", block: "start" });
        // Focus the first profile radio for keyboard users
        const firstRadio = document.querySelector(
          'input[name="imgdesc-profile"]',
        );
        if (firstRadio) {
          // Small delay to let scroll complete before focus
          setTimeout(function () {
            firstRadio.focus();
          }, 300);
        }
      }

      logInfo("User chose to select profile manually");
    },

    /**
     * Dismiss the profile suggestion without changing anything.
     */
    dismissProfileSuggestion() {
      const currentProfile = this.getSelectedProfile();

      // Read skip OCR checkbox state (Phase 15B)
      const skipOCRCheckbox = document.getElementById("imgdesc-skip-ocr");
      const skipOCR = skipOCRCheckbox ? skipOCRCheckbox.checked : false;

      document.getElementById("imgdesc-profile-suggestion").hidden = true;
      this._pendingSuggestion = null;
      this._pendingAlternative = null;
      // Hide alt button if visible
      const altBtn = document.querySelector(
        ".imgdesc-profile-suggestion-apply-alt",
      );
      if (altBtn) altBtn.hidden = true;

      logDebug(
        `Profile suggestion dismissed, running gated analysis with: ${currentProfile}, skipOCR: ${skipOCR}`,
      );

      // Run gated analysis with current profile (Phase 15B)
      this.runGatedAnalysis(currentProfile, skipOCR);
    },

    // ========================================================================
    // CACHE RECALL BANNER (Phase 11D)
    // ========================================================================

    /**
     * Show the cache recall banner with the date the analysis was created.
     * @param {number} createdAt - Timestamp from the cached record
     */
    showCacheRecallBanner(createdAt) {
      const banner = this.elements.cacheRecallBanner;
      const textEl = this.elements.cacheRecallText;
      if (!banner || !textEl) return;

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
    // BACKGROUND ANALYSIS
    // ========================================================================

    /**
     * Start background image analysis as soon as preview loads.
     * Runs OCR + colour sampling in parallel, storing results
     * in this.lastAnalysis for later inclusion in the prompt.
     * Results are stored in this.lastAnalysis when complete.
     */
    startBackgroundAnalysis() {
      // Clear any previous analysis
      this.lastAnalysis = null;
      this._analysisPending = null;
      this._cacheHit = false;
      this._immediateResult = null;
      this._immediateCanvasData = null;

      // Clear stage tracking (Phase 6A)
      this._stageStatus_ocr = null;
      this._stageStatus_colour = null;
      this._stageStatus_clip = null;
      this._stageStatus_depth = null;

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

      const applyFullResult = (result) => {
        self.lastAnalysis = result;
        self._analysisPending = null;

        // Update overlay with analysis data (Phase 5D-1)
        if (typeof window.ImageDescriberOverlay !== "undefined") {
          window.ImageDescriberOverlay.setAnalysis(result);
          const toolbar = document.getElementById("imgdesc-overlay-toolbar");
          if (toolbar) toolbar.hidden = false;
        }

        // Phase 10C-fix: update Florence-2 opt-in button state
        self._updateFlorenceOptinState();

        return result;
      };

      const runAnalysis = () => {
        const profile = this.getSelectedProfile();

        // Phase 9B: Check cache before running analysis
        const cacheCheck =
          this.currentFileHash &&
          typeof window.ImageDescriberCache !== "undefined"
            ? window.ImageDescriberCache.load(this.currentFileHash)
            : Promise.resolve(null);

        this._analysisPending = cacheCheck
          .then((cached) => {
            if (cached && cached.analysis) {
              // Check if the cached analysis matches current profile
              const cachedProfile = cached.analysis.profile;
              if (cachedProfile === profile) {
                logInfo(
                  `Cache hit for ${this.currentFileHash.substring(0, 16)}... — restoring analysis (profile: ${profile})`,
                );
                this._cacheHit = true;

                // Phase 11C: Increment access count (fire-and-forget)
                window.ImageDescriberCache.incrementAccessCount(
                  this.currentFileHash,
                );

                // Restore user edits if any
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

                applyFullResult(cached.analysis);

                // Show profile suggestion if classification differs
                if (cached.analysis?.classification) {
                  self.showProfileSuggestion(cached.analysis.classification);
                }

                // Phase 11D: show cache recall banner
                this.showCacheRecallBanner(cached.createdAt);

                return cached.analysis;
              } else {
                logInfo(
                  `Cache hit but profile mismatch (cached: ${cachedProfile}, current: ${profile}) — re-analysing`,
                );
              }
            }

            // No usable cache — run two-phase analysis
            const analyser = window.ImageDescriberAnalyser;

            // Check if two-phase API is available (Phase 15A)
            if (typeof analyser.analyseImmediate !== "function") {
              // Fallback: use single-phase analyse() (pre-15A compatibility)
              logInfo(`Starting background analysis with profile: ${profile}`);
              return analyser.analyse(previewImg, profile).then((result) => {
                applyFullResult(result);
                if (result?.classification) {
                  self.showProfileSuggestion(result.classification);
                }
                logInfo(
                  `Background analysis complete in ${result.totalDuration}ms ` +
                    `(OCR: ${result.ocr?.status}, Colour: ${result.colour?.status})`,
                );
                return result;
              });
            }

            // Phase 15B: Two-phase analysis
            logInfo("Starting immediate analysis (CLIP + colour)...");
            return analyser.analyseImmediate(previewImg).then((immediate) => {
              if (!immediate || !immediate.result) {
                logWarn("Immediate analysis returned no result");
                return null;
              }

              // Store immediate result for gated phase
              self._immediateResult = immediate.result;
              self._immediateCanvasData = immediate.canvasData;

              // Store partial analysis (colour + CLIP available for prompt)
              self.lastAnalysis = immediate.result;

              logInfo(
                `Immediate analysis complete ` +
                  `(Colour: ${immediate.result.colour?.status}, ` +
                  `CLIP: ${immediate.result.classification?.clip ? "yes" : "no"})`,
              );

              // Show profile suggestion banner — user must confirm before gated analyses run
              if (immediate.result.classification) {
                self.showProfileSuggestion(immediate.result.classification);
              } else {
                // No CLIP result — run gated analysis immediately with current profile
                logInfo(
                  "No CLIP classification — running gated analysis with current profile",
                );
                return self.runGatedAnalysis(profile, false);
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
     * Run the gated (profile-dependent) analysis phase (Phase 15B).
     * Called after user confirms profile via suggestion banner,
     * or when no CLIP classification is available.
     *
     * @param {string} profileName — confirmed profile name
     * @param {boolean} skipOCR — whether to skip Tesseract OCR
     * @returns {Promise<object|null>} Full analysis result or null on failure
     */
    async runGatedAnalysis(profileName, skipOCR) {
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

      try {
        const result = await analyser.analyseGated(
          this._immediateResult,
          this._immediateCanvasData,
          profileName,
          { skipOCR: skipOCR },
        );

        // Store final result
        this.lastAnalysis = result;
        this._analysisPending = null;

        // Clear immediate state (no longer needed)
        this._immediateResult = null;
        this._immediateCanvasData = null;

        // Update overlay with full analysis data (Phase 5D-1)
        if (typeof window.ImageDescriberOverlay !== "undefined") {
          window.ImageDescriberOverlay.setAnalysis(result);
          const toolbar = document.getElementById("imgdesc-overlay-toolbar");
          if (toolbar) toolbar.hidden = false;
        }

        // Phase 10C-fix: update Florence-2 opt-in button state
        this._updateFlorenceOptinState();

        logInfo(
          `Gated analysis complete in ${result.totalDuration}ms ` +
            `(OCR: ${result.ocr?.status}, Depth: ${result.depth?.status})`,
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
          '<span aria-hidden="true" data-icon="check"></span> Restored from cache';
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
          '<span aria-hidden="true" data-icon="aiSparkle"></span> Run Florence-2';
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

      // Guard: user said "no text in this image" — Florence-2 OCR not useful
      const skipOCRCheckbox = document.getElementById("imgdesc-skip-ocr");
      if (skipOCRCheckbox && skipOCRCheckbox.checked) {
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
          '<span aria-hidden="true" data-icon="aiSparkle"></span> ' +
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
          '<span aria-hidden="true" data-icon="aiSparkle"></span> ' +
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
          '<span aria-hidden="true" data-icon="aiSparkle"></span> ' +
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
          '<span aria-hidden="true" data-icon="aiSparkle"></span> ' +
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
          '<span aria-hidden="true" data-icon="download"></span> ' +
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
              florenceRow.scrollIntoView({ behavior: "smooth", block: "center" });
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
