// ─── MathPixSessionRestorer Restore Mixin ────────────────────────────────────
// Main restoration orchestrator.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-restore.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // SESSION RESTORATION
  // =========================================================================

  /**
   * Restore session from parse result
   * @param {Object} parseResult - Parsed ZIP data
   * @param {Object|null} selectedEdit - User's edit selection (or null for original)
   */
  proto.restoreSession = async function (parseResult, selectedEdit) {
    logInfo("Restoring session from ZIP archive");

    try {
      // Determine the content to load (edit takes priority over original)
      const loadedContent = selectedEdit?.content || parseResult.results.mmd;

      // Store session data
      this.restoredSession = {
        source: parseResult.source,
        results: parseResult.results,
        // Phase 7C-6: keep the JSZip handle so _detectRestoredChemistry can
        // read data/chemistry-settings.json without reparsing the archive.
        zip: parseResult.zip || null,
        originalMMD: parseResult.results.mmd,
        baselineMMD: loadedContent, // Content at session start (for tracking user edits)
        currentMMD: loadedContent,
        selectedEdit: selectedEdit,
        metadata: parseResult.metadata,
        linesData: parseResult.linesData,
        isPDF: parseResult.source.isPDF,
        // Phase H.2: Page range tracking for partial PDF processing
        pageRange: parseResult.metadata?.processing?.pageRange || "all",
        totalPdfPages: parseResult.metadata?.processing?.totalPdfPages || null,
        pagesProcessed:
          parseResult.metadata?.processing?.pagesProcessed || null,
      };

      // Store original MMD lines for edit tracking (Phase 8.3.5)
      // This enables confidence display to show pencil icon for edited lines
      this.setOriginalMmdContent(parseResult.results.mmd);

      // Phase 8F: Extract images from ZIP and restore registry
      // Must happen before loadMMDContent so blob URLs are in place for preview
      try {
        const imageResult = await this.extractAndRestoreImages();

        if (imageResult.restored) {
          logInfo(`Restored ${imageResult.imageCount} images from ZIP`);

          // Phase 8H.3: Rewrite relative image paths (images/filename.jpg) to blob URLs
          this.restoredSession.currentMMD = this.rewriteRelativePathsToBlobUrls(
            this.restoredSession.currentMMD,
          );
          // Also apply standard CDN→blob rewriting (for any CDN URLs in the content)
          this.restoredSession.currentMMD = this.rewriteMMDWithBlobUrls(
            this.restoredSession.currentMMD,
          );

          // Also rewrite originalMMD so preview shows images
          this.restoredSession.originalMMD =
            this.rewriteRelativePathsToBlobUrls(
              this.restoredSession.originalMMD,
            );
          this.restoredSession.originalMMD = this.rewriteMMDWithBlobUrls(
            this.restoredSession.originalMMD,
          );

          // Store registry on session for external access (AI enhancer, etc.)
          this.restoredSession.imageRegistry = this.imageRegistry;

          this.showNotification(
            `${imageResult.imageCount} image(s) restored from archive`,
            "info",
          );
        }

        if (imageResult.errors.length > 0) {
          logWarn("Image restore had errors:", imageResult.errors);
        }
      } catch (imageError) {
        // Non-fatal: images failing should not block session restore
        logWarn("Image restore failed (non-fatal):", imageError);
      }

      // Configure UI based on source type
      this.configureUIForSourceType(parseResult.source.isPDF);

      // Update session header
      this.updateSessionHeader(parseResult.source.filename);

      // Phase 8G: Initialise display layer for image collapse
      this.initialiseDisplayLayer(this.restoredSession.currentMMD);

      // Load MMD content into editor
      // If display layer is active, this will show collapsed content
      this.loadMMDContent(
        this.restoredSession.currentMMD,
        this.restoredSession.originalMMD,
      );

      // Integrate with MMDEditorPersistence module
      this.integratePersistenceModule(parseResult.source.filename);

      // Load source PDF if applicable
      if (parseResult.source.isPDF && parseResult.source.blob) {
        await this.loadSourcePDF(parseResult.source.blob);
      }

      // Load confidence visualiser if PDF with lines data
      if (
        parseResult.source.isPDF &&
        parseResult.linesData &&
        parseResult.source.blob
      ) {
        await this.loadConfidenceVisualiser(
          parseResult.linesData,
          parseResult.source.blob,
        );

        // Phase 8.3.4: Show confidence toggle for MMD view
        this.showConfidenceToggle();
      }

      // Phase 6B: Detect and display chemistry from restored MMD content
      await this._detectRestoredChemistry();

      // Check for PRE-EXISTING localStorage sessions BEFORE creating new one
      // This must happen before startPersistenceSession() to avoid finding
      // the session we're about to create
      const preExistingSessions = this.checkForMatchingSessions(
        parseResult.source.filename,
      );

      // Defer persistence session start — if auto-restore will run,
      // we reuse the recovered session's key instead of creating a new one.
      // Only create a new persistence session if no auto-restore occurs.
      let persistenceSessionStarted = false;

      // Update AI Enhancement button state (Phase 7.1)
      this.updateAIEnhanceButton();

      // Hide upload section, show working area
      if (this.elements.uploadSection) {
        this.elements.uploadSection.hidden = true;
      }
      if (this.elements.workingArea) {
        this.elements.workingArea.hidden = false;
      }

      // Show convert section and update button state
      if (this.elements.convertSection) {
        this.elements.convertSection.hidden = false;
        logDebug("Convert section shown");
      }
      this.updateConvertButtonState();

      // Check if there are multiple versions to switch between
      const zipEdits = parseResult.edits?.files || [];
      const hasMultipleZipVersions = zipEdits.length > 0; // Has at least one edit besides original
      const hasLocalStorageSessions = preExistingSessions.length > 0;

      // Calculate initial session index based on what was loaded
      // (do this BEFORE showing banner so we can pass it)
      let initialSessionIndex = null;
      if (selectedEdit) {
        // Find which ZIP edit index this corresponds to
        const editIndex = zipEdits.findIndex(
          (e) => e.content === selectedEdit.content,
        );
        initialSessionIndex = editIndex >= 0 ? -2 - editIndex : -2;
      } else {
        // Loaded original
        initialSessionIndex = -1;
      }
      this._currentSessionIndex = initialSessionIndex;

      // Handle localStorage session recovery with auto-restore
      if (hasLocalStorageSessions) {
        // Filter to only sessions newer than the ZIP edit
        // AND with genuinely different content (not just URL format differences)
        const zipEditTime = selectedEdit?.timestamp?.getTime() || 0;

        // Normalise content by replacing all image URL variants with a placeholder
        // so blob URLs, CDN URLs, and data URIs all compare as equal
        const normaliseForComparison = (text) => {
          if (!text) return "";
          return text
            .replace(/blob:http[^\s)}"\\]+/g, "IMG_URL")
            .replace(/https:\/\/cdn\.mathpix\.com\/[^\s)}"\\]+/g, "IMG_URL")
            .replace(/data:image\/[^\s)}"\\]+/g, "IMG_URL");
        };

        const normalisedZipContent = normaliseForComparison(
          this.restoredSession.currentMMD,
        );

        const newerSessions = preExistingSessions.filter((s) => {
          if (s.lastModified <= zipEditTime) return false;
          // Skip sessions whose content only differs by image URL format
          const normalisedStored = normaliseForComparison(
            s.data?.current || "",
          );
          return normalisedStored !== normalisedZipContent;
        });

        if (newerSessions.length > 0) {
          // Auto-restore the most recent localStorage session
          // Sessions are already sorted by lastModified (newest first)
          const mostRecentSession = newerSessions[0];

          logInfo("Auto-restoring most recent localStorage session:", {
            key: mostRecentSession.key,
            lastModified: new Date(
              mostRecentSession.lastModified,
            ).toISOString(),
            sessionCount: newerSessions.length,
          });

          // Store sessions reference for version switching
          this._recoverySessions = newerSessions;

          // Reuse the recovered session's storage key instead of creating a new one
          // This prevents version proliferation when reloading the same ZIP
          const recoveredKey = mostRecentSession.key;
          const recoveredStorageKey =
            mostRecentSession.data?.storageKey ||
            `mathpix-resume-session-${recoveredKey}`;
          this.restoredSession.sessionKey = recoveredKey;
          this.restoredSession.storageKey = recoveredStorageKey;
          persistenceSessionStarted = true;
          logDebug("Reusing recovered session key:", recoveredStorageKey);

          // Apply the most recent session
          await this.applyRecoveredSession({
            key: mostRecentSession.key,
            data: mostRecentSession.data,
          });

          // Update the current session index to reflect the auto-restored session
          this._currentSessionIndex = 0; // First localStorage session

          // Show informational banner instead of selection banner
          this.showAutoRestoredBanner(mostRecentSession);
        } else {
          // All localStorage sessions are older, clean them up
          this.clearMatchingSessions(preExistingSessions);
        }
      }

      // Start persistence session only if auto-restore didn't reuse an existing key
      if (!persistenceSessionStarted) {
        this.startPersistenceSession(parseResult.source.filename);
      }

      // Show Switch Version button if there are multiple versions available
      // (even without localStorage sessions, user may want to switch between ZIP versions)
      if (hasMultipleZipVersions || hasLocalStorageSessions) {
        this.showSwitchVersionButton();
      }

      // Show notification
      this.showNotification(RESTORER_CONFIG.MESSAGES.SUCCESS, "success");

      logInfo("Session restored successfully", {
        sourceFile: parseResult.source.filename,
        isPDF: parseResult.source.isPDF,
        hasLinesData: !!parseResult.linesData,
        mmdLength: this.restoredSession.currentMMD?.length || 0,
        convertSectionVisible: !this.elements.convertSection?.hidden,
      });
    } catch (error) {
      logError("Failed to restore session:", error);
      this.showNotification(
        `Failed to restore session: ${error.message}`,
        "error",
      );
    }
  };

  /**
   * Phase 6B / 7A-5d: Detect chemistry in restored MMD content and display
   * in the resume chemistry tab. Extracts SMILES from MMD, populates the
   * canonical panel (for renderer state / 7C-6), then independently populates
   * the resume panel's own DOM elements (no element moving).
   * @private
   */
  proto._detectRestoredChemistry = async function () {
    const chemUtils = window.MathPixChemistryUtils;
    if (!chemUtils || typeof chemUtils.extractChemistryFromResponse !== "function") {
      logDebug("MathPixChemistryUtils not available — skipping resume chemistry detection");
      return;
    }

    const mmdContent = this.restoredSession?.currentMMD || "";
    if (!mmdContent) return;

    const chemData = chemUtils.extractChemistryFromResponse({ text: mmdContent });
    if (!chemData || chemData.length === 0) {
      logDebug("No chemistry detected in restored MMD content");
      return;
    }

    logInfo("Chemistry detected in restored session", {
      structureCount: chemData.length,
      notations: chemData.map((s) => s.notation),
    });

    // Use the result renderer to populate the chemistry panel (sets up data + rendering)
    // Note: this.controller may be null in restore context; use getMathPixController() instead
    const controller = this.controller || window.getMathPixController?.();
    const resultRenderer = controller?.resultRenderer;
    if (!resultRenderer) {
      logWarn("Result renderer not available for resume chemistry display");
      return;
    }

    resultRenderer.populateChemistryFormat(chemData);

    // Phase 7C-6: after _chemistryData is populated, read the chemistry
    // settings manifest from the ZIP (if present) and restore per-image
    // overrides + global preset. Wrapped in try/catch — restore failures
    // here must never break the overall session-restore flow.
    try {
      const zip = this.restoredSession?.zip;
      if (zip && typeof chemUtils.readChemistrySettingsFromZip === "function") {
        const manifest = await chemUtils.readChemistrySettingsFromZip(zip);
        if (manifest && typeof resultRenderer.restoreChemistryFromManifest === "function") {
          // Phase 7C-7: flag the restore so the chemistry-settings-changed
          // listener in session-restorer-init doesn't flash the Download
          // Updated button just because restore fired the event.
          this._restoringChemistrySettings = true;
          try {
            resultRenderer.restoreChemistryFromManifest(manifest);
          } finally {
            this._restoringChemistrySettings = false;
          }
          logInfo("Phase 7C-6: chemistry settings manifest applied during resume");
        }
      }
    } catch (restoreError) {
      logWarn("Phase 7C-6: chemistry settings restore failed (non-fatal)", {
        error: restoreError.message,
      });
    }

    // Phase 7A-5d: Populate the resume panel's own DOM elements directly.
    // No element moving — each panel owns its own chemistry DOM.
    this._populateResumeChemistryPanel(chemData);

    // Show the chemistry tab button
    const chemTab = this.elements.tabChemistry;
    if (chemTab) {
      chemTab.style.display = "";
    }

    logInfo("Chemistry tab added to resume tabs", {
      structures: chemData.length,
    });
  };

  // =========================================================================
  // Phase 7A-5d: Resume chemistry panel — own DOM, no element moving
  // =========================================================================

  /**
   * Populate the resume panel's own chemistry DOM elements.
   * Stores data for navigation and displays the first structure.
   * @param {Array} chemData - Array of chemistry items from extractChemistryFromResponse
   * @private
   */
  proto._populateResumeChemistryPanel = function (chemData) {
    const self = this;
    this._resumeChemistryData = chemData;
    this._resumeChemistryIndex = 0;

    // Display first structure
    this._displayResumeChemistryStructure(0);

    // Show/hide navigation
    const selector = document.getElementById("resume-chemistry-structure-selector");
    if (selector) {
      selector.style.display = chemData.length > 1 ? "" : "none";
    }

    // Set up navigation button handlers
    const prevBtn = document.getElementById("resume-chemistry-prev-structure");
    const nextBtn = document.getElementById("resume-chemistry-next-structure");
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (this._resumeChemistryIndex > 0) {
          this._displayResumeChemistryStructure(this._resumeChemistryIndex - 1);
        }
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        if (this._resumeChemistryIndex < this._resumeChemistryData.length - 1) {
          this._displayResumeChemistryStructure(this._resumeChemistryIndex + 1);
        }
      };
    }

    // Set up action button handlers
    const copySmilesBtn = document.getElementById("resume-chemistry-copy-smiles-btn");
    if (copySmilesBtn) {
      copySmilesBtn.onclick = () => {
        const item = this._resumeChemistryData?.[this._resumeChemistryIndex];
        if (item?.notation) {
          navigator.clipboard.writeText(item.notation).then(() => {
            copySmilesBtn.textContent = "Copied!";
            setTimeout(() => { copySmilesBtn.innerHTML = '<span aria-hidden="true" data-icon="clipboard"></span> Copy SMILES'; }, 1500);
          });
        }
      };
    }

    const copyInchiBtn = document.getElementById("resume-chemistry-copy-inchi-btn");
    if (copyInchiBtn) {
      copyInchiBtn.onclick = () => {
        const item = this._resumeChemistryData?.[this._resumeChemistryIndex];
        if (item?.inchi) {
          navigator.clipboard.writeText(item.inchi).then(() => {
            copyInchiBtn.textContent = "Copied!";
            setTimeout(() => { copyInchiBtn.innerHTML = '<span aria-hidden="true" data-icon="clipboard"></span> Copy InChI'; }, 1500);
          });
        }
      };
    }

    const lookupBtn = document.getElementById("resume-chemistry-lookup-btn");
    if (lookupBtn) {
      lookupBtn.onclick = () => {
        const url = lookupBtn.dataset.url;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      };
    }

    const describeBtn = document.getElementById("resume-chemistry-describe-btn");
    if (describeBtn) {
      describeBtn.disabled = false;
      describeBtn.onclick = async () => {
        const item = this._resumeChemistryData?.[this._resumeChemistryIndex];
        if (!item?.notation) return;
        const chemUtils = window.MathPixChemistryUtils;
        if (!chemUtils) return;

        // Already have a description? Just show it.
        if (item._description) {
          this._applyResumeFromCache(item);
          return;
        }

        // Call the AI description service
        const service = chemUtils.getDescriptionService?.();
        if (!service || typeof service.describe !== "function") {
          logWarn("AI description service not available for resume panel");
          return;
        }

        describeBtn.disabled = true;
        describeBtn.textContent = "Generating…";
        try {
          const desc = await service.describe({
            notation: item.notation,
            iupacName: item.iupacName,
            commonNames: item.commonNames,
            formula: item.inchi ? chemUtils.parseInChIFormula(item.inchi)?.raw : null,
          });
          if (desc) {
            item._description = desc;
            item._descriptionProvenance = "AI-generated description";
            this._applyResumeFromCache(item);
            // Phase 8A-5: Show copy description button
            const copyDescBtn = document.getElementById("resume-chemistry-copy-description-btn");
            if (copyDescBtn) copyDescBtn.style.display = "";
          }
        } catch (err) {
          logWarn("Resume AI description failed", { error: err.message });
        } finally {
          describeBtn.disabled = false;
          describeBtn.innerHTML = '<span aria-hidden="true" data-icon="aiSparkle"></span> Describe Structure';
        }
      };
    }

    // Phase 8B: Save structure image
    const saveImageBtn = document.getElementById("resume-chemistry-save-image-btn");
    if (saveImageBtn) {
      saveImageBtn.disabled = false;
      saveImageBtn.onclick = async function () {
        // Resolve state at click time via singleton — the arrow-function `this`
        // closure was unreliable (clicks produced no observable output). The
        // singleton always holds the current chemistry data.
        const restorer = window.getMathPixSessionRestorer?.() || self;
        const data = restorer?._resumeChemistryData;
        const index = restorer?._resumeChemistryIndex ?? 0;

        logWarn("Phase 8B: resume save click", {
          hasRestorer: !!restorer,
          hasData: Array.isArray(data),
          dataLength: Array.isArray(data) ? data.length : 0,
          index: index,
        });

        const item = data?.[index];
        if (!item?.notation) {
          logWarn("Phase 8B: resume save aborted — no notation", {
            hasItem: !!item,
          });
          return;
        }

        const utils = window.MathPixChemistryUtils;
        if (!utils?.renderStructureToBlob) {
          logWarn("Phase 8B: resume save aborted — renderStructureToBlob unavailable");
          return;
        }

        saveImageBtn.disabled = true;
        const originalHTML = saveImageBtn.innerHTML;
        const hourglassHtml = typeof window.getIcon === "function"
          ? window.getIcon("hourglass")
          : '<span aria-hidden="true" data-icon="hourglass"></span>';
        saveImageBtn.innerHTML = hourglassHtml + " Saving…";

        try {
          // Phase 7C-7: retry once on a null return. SmilesDrawer has an
          // intermittent "canvas appears blank" race — a short async gap
          // is enough for the next call to succeed.
          const renderOpts = {
            width: 800,
            height: 600,
            background: "#ffffff",
            forExport: true,
            perImageOptions: item.renderOptions || null,
          };
          let blob = await utils.renderStructureToBlob(item.notation, renderOpts);
          if (!blob) {
            logWarn("Phase 8B: first resume render returned null — retrying", {
              notation: item.notation,
            });
            await new Promise((resolve) => setTimeout(resolve, 50));
            blob = await utils.renderStructureToBlob(item.notation, renderOpts);
          }

          if (!blob) {
            const liveRegion = document.getElementById("resume-chemistry-live-region");
            if (liveRegion) liveRegion.textContent = "Failed to generate image";
            if (typeof restorer?.showNotification === "function") {
              restorer.showNotification("Failed to generate structure image", "error");
            }
            return;
          }

          const name = item._resolvedName || item.commonNames?.[0] || item.iupacName;
          const filename = name
            ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "") + ".png"
            : "structure-" + (index + 1) + ".png";

          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          // Revoke after a delay — the browser reads the blob asynchronously
          // once a.click() triggers the download, so revoking synchronously
          // can race the download and produce a silent no-op save.
          setTimeout(() => URL.revokeObjectURL(url), 1000);

          const liveRegion = document.getElementById("resume-chemistry-live-region");
          if (liveRegion) liveRegion.textContent = "Structure image saved as " + filename;
          if (typeof restorer?.showNotification === "function") {
            restorer.showNotification("Saved " + filename, "success");
          }
        } catch (err) {
          logWarn("Phase 8B: Resume save image failed", { error: err.message });
          const liveRegion = document.getElementById("resume-chemistry-live-region");
          if (liveRegion) liveRegion.textContent = "Failed to save image";
          if (typeof restorer?.showNotification === "function") {
            restorer.showNotification("Failed to save structure image", "error");
          }
        } finally {
          saveImageBtn.disabled = false;
          saveImageBtn.innerHTML = originalHTML;
        }
      };
    }

    // Phase 8A: Set up rendering controls
    this._setupResumePresetSelector();
    this._setupResumeAdvancedControls();

    // Phase 8A-5: Copy description button
    const copyDescBtn = document.getElementById("resume-chemistry-copy-description-btn");
    if (copyDescBtn) {
      copyDescBtn.onclick = async () => {
        const descText = document.getElementById("resume-chemistry-description-text");
        if (!descText?.textContent) return;
        try {
          await navigator.clipboard.writeText(descText.textContent);
          const originalHTML = copyDescBtn.innerHTML;
          const checkHtml = typeof window.getIcon === "function"
            ? window.getIcon("check")
            : '<span aria-hidden="true" data-icon="check"></span>';
          copyDescBtn.innerHTML = checkHtml + " Copied!";
          const lr = document.getElementById("resume-chemistry-live-region");
          if (lr) lr.textContent = "Description copied to clipboard";
          setTimeout(() => { copyDescBtn.innerHTML = originalHTML; }, 2000);
        } catch (err) {
          logWarn("Resume clipboard write failed", { error: err.message });
        }
      };
    }

    // Announce to screen readers
    const liveRegion = document.getElementById("resume-chemistry-live-region");
    if (liveRegion) {
      const count = chemData.length;
      liveRegion.textContent = count === 1
        ? "One chemical structure detected"
        : `${count} chemical structures detected`;
    }

    logInfo("Phase 7A-5d: resume chemistry panel populated", {
      structureCount: chemData.length,
    });
  };

  /**
   * Display a specific chemistry structure in the resume panel.
   * Renders the canvas, populates identifiers, and does a PubChem lookup.
   * @param {number} index - Index into this._resumeChemistryData
   * @private
   */
  proto._displayResumeChemistryStructure = function (index) {
    const data = this._resumeChemistryData;
    if (!data || index < 0 || index >= data.length) return;

    const item = data[index];
    this._resumeChemistryIndex = index;
    const chemUtils = window.MathPixChemistryUtils;
    const el = (id) => document.getElementById("resume-chemistry-" + id);

    // Phase 8A: Update compound name heading
    const compoundNameEl = el("compound-name");
    if (compoundNameEl) {
      const name = item._resolvedName || item.commonNames?.[0] || item.iupacName;
      if (name) {
        compoundNameEl.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        compoundNameEl.style.display = "";
      } else {
        compoundNameEl.textContent = "";
        compoundNameEl.style.display = "none";
      }
    }

    // Phase 8A-5: Hide copy description button until description is available for this structure
    const copyDescBtn = document.getElementById("resume-chemistry-copy-description-btn");
    if (copyDescBtn) copyDescBtn.style.display = item._description ? "" : "none";

    // 1. Render structure on the resume canvas (with onGraphReady for structural description)
    const canvas = el("structure-canvas");
    if (canvas && chemUtils?.renderStructure) {
      chemUtils.renderStructure(item.notation, canvas, {
        onGraphReady: () => {
          // Generate structural description once the molecular graph is cached
          if (chemUtils.generateStructuralDescription && !item._structuralDescription) {
            const pubData = item._resolvedName
              ? { commonNames: item.commonNames, iupacName: item.iupacName }
              : undefined;
            const desc = chemUtils.generateStructuralDescription(item.notation, pubData);
            if (desc) {
              item._structuralDescription = desc;
              // Only update DOM if this structure is still displayed
              if (this._resumeChemistryIndex === index) {
                const descEl = el("structural-desc-text");
                const container = el("structural-description");
                if (descEl) descEl.textContent = desc;
                if (container) container.style.display = "";
                // Phase 8A-4: Progressive aria-label
                const figure = el("structure-figure");
                if (figure) figure.setAttribute("aria-label", desc);
              }
            }
          }
        },
        perImageOptions: item.renderOptions || null,
      });
    }

    // Phase 8A: Show rendering controls
    const presetSelector = document.getElementById("resume-chemistry-preset-selector");
    if (presetSelector) presetSelector.style.display = "";
    const advancedControls = document.getElementById("resume-chemistry-advanced-controls");
    if (advancedControls) advancedControls.style.display = "";

    // Phase 8A-3: Sync per-image state for this structure
    this._syncResumePerImageState(index);

    // 2. Populate identifiers (sync — may be partially empty until PubChem resolves)
    this._syncResumeIdentifiers(item);

    // 3. Hide description areas until data arrives
    const descArea = el("description-area");
    if (descArea) descArea.style.display = "none";
    const structDesc = el("structural-description");
    if (structDesc) structDesc.style.display = "none";

    // 4. Show cached descriptions if pre-fetch already resolved (item is shared
    //    with resultRenderer._chemistryData, which _prefetchAllChemistryData populates).
    if (item._pubchemResolved) {
      this._applyResumeFromCache(item);
    } else {
      // Async PubChem lookup — back-populate ALL fields on resolve
      const nameEl = el("name-display");
      if (nameEl) { nameEl.textContent = "Looking up…"; nameEl.classList.add("chemistry-loading"); }

      if (chemUtils) {
        const lookupPromise = item.inchiKey
          ? chemUtils.lookupPubChem(item.inchiKey)
          : chemUtils.lookupPubChemBySmiles(item.notation);

        lookupPromise.then((result) => {
          if (this._resumeChemistryIndex !== index) return;
          if (nameEl) nameEl.classList.remove("chemistry-loading");
          if (!result?.found) { if (nameEl) nameEl.textContent = "—"; return; }

          // Back-populate the shared item object
          if (result.inchi && !item.inchi) item.inchi = result.inchi;
          if (result.inchiKey && !item.inchiKey) item.inchiKey = result.inchiKey;
          if (result.commonNames?.length) item.commonNames = result.commonNames;
          if (result.iupacName) item.iupacName = result.iupacName;
          if (result.molecularWeight) item.molecularWeight = result.molecularWeight;
          if (result.pubchemCid) item.pubchemCid = result.pubchemCid;
          if (result.pubchemUrl) item.pubchemUrl = result.pubchemUrl;
          item._resolvedName = result.commonNames?.[0] || result.iupacName;

          // Re-sync all identifier fields with the now-populated item
          this._syncResumeIdentifiers(item);

          // Phase 8A: Update compound name heading with resolved name
          const compoundNameEl = el("compound-name");
          if (compoundNameEl && item._resolvedName) {
            compoundNameEl.textContent = item._resolvedName.charAt(0).toUpperCase() + item._resolvedName.slice(1);
            compoundNameEl.style.display = "";
          }

          // Re-generate structural description with PubChem names (if graph is cached)
          if (chemUtils.generateStructuralDescription) {
            const pubData = { commonNames: item.commonNames, iupacName: item.iupacName };
            const desc = chemUtils.generateStructuralDescription(item.notation, pubData);
            if (desc) {
              item._structuralDescription = desc;
              const descEl = el("structural-desc-text");
              const container = el("structural-description");
              if (descEl) descEl.textContent = desc;
              if (container) container.style.display = "";
              // Phase 8A-4: Update aria-label with name-enriched description
              const figure = el("structure-figure");
              if (figure) figure.setAttribute("aria-label", desc);
            }
          }

          // Apply any cached descriptions (AI description from prefetch)
          if (item._description || item._pubchemResolved) {
            this._applyResumeFromCache(item);
          }

          // Enable action buttons
          this._enableResumeActions(item);
        }).catch((err) => {
          if (nameEl) { nameEl.classList.remove("chemistry-loading"); nameEl.textContent = "—"; }
          logDebug("Resume PubChem lookup failed (non-fatal)", { error: err.message });
        });
      }
    }

    // 5. Enable Copy SMILES immediately (always available)
    const copySmilesBtn = el("copy-smiles-btn");
    if (copySmilesBtn) copySmilesBtn.disabled = !item.notation;

    // Phase 8B: Save image button enabled when SMILES is available
    const saveImageBtn = document.getElementById("resume-chemistry-save-image-btn");
    if (saveImageBtn) saveImageBtn.disabled = !item.notation;

    // 6. Update navigation counter + buttons
    const counter = el("structure-counter");
    if (counter) counter.textContent = `Structure ${index + 1} of ${data.length}`;
    const prevBtn = el("prev-structure");
    const nextBtn = el("next-structure");
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === data.length - 1;

    // 7. Update caption
    const caption = el("structure-caption");
    if (caption) {
      caption.textContent = chemUtils?.generateBasicAccessibleDescription
        ? chemUtils.generateBasicAccessibleDescription(item.notation, item.inchi)
        : "2D structural diagram";
    }
  };

  /**
   * Sync resume panel identifier fields from the item's current state.
   * @param {Object} item - Chemistry data item
   * @private
   */
  proto._syncResumeIdentifiers = function (item) {
    const chemUtils = window.MathPixChemistryUtils;
    const el = (id) => document.getElementById("resume-chemistry-" + id);

    const smilesEl = el("smiles-display");
    if (smilesEl) smilesEl.textContent = item.notation || "—";

    const inchiEl = el("inchi-display");
    if (inchiEl) inchiEl.textContent = item.inchi || "—";

    const inchikeyEl = el("inchikey-display");
    if (inchikeyEl) inchikeyEl.textContent = item.inchiKey || "—";

    const formulaEl = el("formula-display");
    if (formulaEl && chemUtils) {
      const parsed = item.inchi ? chemUtils.parseInChIFormula(item.inchi) : null;
      if (parsed?.raw) {
        formulaEl.innerHTML = chemUtils.formatFormulaAsHTML(parsed.raw);
        formulaEl.setAttribute("aria-label",
          "Molecular formula: " + chemUtils.formatFormulaForScreenReader(parsed.raw));
      } else {
        formulaEl.textContent = "—";
        formulaEl.setAttribute("aria-label", "");
      }
    }

    const nameEl = el("name-display");
    if (nameEl) {
      const name = item._resolvedName || item.commonNames?.[0] || item.iupacName;
      if (name) {
        nameEl.classList.remove("chemistry-loading", "chemistry-not-found");
        nameEl.textContent = name;
      }
    }

    const weightEl = el("weight-display");
    if (weightEl) {
      weightEl.textContent = item.molecularWeight
        ? item.molecularWeight.toFixed(2) + " g/mol"
        : "—";
    }
  };

  /**
   * Apply cached descriptions and enable actions for a pre-fetched item.
   * @param {Object} item - Chemistry data item with _pubchemResolved === true
   * @private
   */
  proto._applyResumeFromCache = function (item) {
    const el = (id) => document.getElementById("resume-chemistry-" + id);

    // Structural description
    if (item._structuralDescription) {
      const descEl = el("structural-desc-text");
      const container = el("structural-description");
      if (descEl) descEl.textContent = item._structuralDescription;
      if (container) container.style.display = "";
    }

    // AI / PubChem description
    if (item._description) {
      const textEl = el("description-text");
      const provEl = el("description-provenance");
      const area = el("description-area");
      if (textEl) textEl.textContent = item._description;
      if (provEl) provEl.textContent = item._descriptionProvenance || "";
      if (area) area.style.display = "";

      // Phase 8A-5: Show copy description button when description is available
      const copyDescBtn = document.getElementById("resume-chemistry-copy-description-btn");
      if (copyDescBtn) copyDescBtn.style.display = "";
    }

    this._enableResumeActions(item);
  };

  /**
   * Enable resume panel action buttons based on available data.
   * @param {Object} item - Chemistry data item
   * @private
   */
  proto._enableResumeActions = function (item) {
    const el = (id) => document.getElementById("resume-chemistry-" + id);
    const copyInchiBtn = el("copy-inchi-btn");
    if (copyInchiBtn) copyInchiBtn.disabled = !item.inchi;

    const lookupBtn = el("lookup-btn");
    if (lookupBtn) {
      const url = item.pubchemUrl ||
        (item.pubchemCid ? `https://pubchem.ncbi.nlm.nih.gov/compound/${item.pubchemCid}` : null);
      lookupBtn.disabled = !url;
      lookupBtn.dataset.url = url || "";
    }
  };

  // =========================================================================
  // Phase 8A: Resume chemistry rendering controls
  // =========================================================================

  /**
   * Collect current values from all resume-panel advanced controls.
   * Mirrors _collectAdvancedControlValues() from mathpix-result-renderer.js.
   * @returns {Object} Options object with all rendering control values
   * @private
   */
  proto._collectResumeAdvancedControlValues = function () {
    const el = (id) => document.getElementById(id);
    const safeFloat = (node, fallback) => {
      const v = node ? parseFloat(node.value) : NaN;
      return Number.isFinite(v) ? v : fallback;
    };
    return {
      bondThickness: safeFloat(el("resume-chem-bond-thickness"), 2),
      bondSpacing: safeFloat(el("resume-chem-bond-spacing"), 5),
      fontSizeLarge: safeFloat(el("resume-chem-font-size-large"), 11),
      fontSizeSmall: safeFloat(el("resume-chem-font-size-small"), 4),
      compactDrawing: !!el("resume-chem-compact-drawing")?.checked,
      explicitHydrogens: !!el("resume-chem-explicit-hydrogens")?.checked,
      terminalCarbons: !!el("resume-chem-terminal-carbons")?.checked,
      colourScheme: el("resume-chem-colour-scheme")?.value || "element",
    };
  };

  /**
   * Populate resume-panel advanced controls from a named preset.
   * Mirrors _populateAdvancedControlsFromPreset() from mathpix-result-renderer.js.
   * @param {string} presetName - Preset name (skeletal, textbook, etc.)
   * @private
   */
  proto._populateResumeAdvancedControlsFromPreset = function (presetName) {
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!config) return;
    const utils = window.MathPixChemistryUtils;

    let values;
    if (presetName === "custom" && utils?.getCustomOptions) {
      const base = config.PRESETS[config.DEFAULT_PRESET] || {};
      values = { ...base, ...utils.getCustomOptions() };
    } else {
      values = config.PRESETS[presetName] || config.PRESETS[config.DEFAULT_PRESET] || {};
    }

    const setRange = (id, value) => {
      const input = document.getElementById(id);
      if (!input || value == null) return;
      input.value = value;
      const output = document.getElementById(id + "-value");
      if (output) output.textContent = String(value);
    };
    const setCheckbox = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!value;
    };
    const setSelect = (id, value) => {
      const el = document.getElementById(id);
      if (el && value) el.value = value;
    };

    setRange("resume-chem-bond-thickness", values.bondThickness);
    setRange("resume-chem-bond-spacing", values.bondSpacing);
    setRange("resume-chem-font-size-large", values.fontSizeLarge);
    setRange("resume-chem-font-size-small", values.fontSizeSmall);
    setCheckbox("resume-chem-compact-drawing", values.compactDrawing);
    setCheckbox("resume-chem-explicit-hydrogens", values.explicitHydrogens);
    setCheckbox("resume-chem-terminal-carbons", values.terminalCarbons);
    setSelect("resume-chem-colour-scheme", values.colourScheme || "element");
  };

  /**
   * Populate resume-panel advanced controls from an options object.
   * Mirrors _populateAdvancedControlsFromOptions() from mathpix-result-renderer.js.
   * @param {Object} optionsObj - Plain options object with rendering values
   * @private
   */
  proto._populateResumeAdvancedControlsFromOptions = function (optionsObj) {
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!config) return;
    const base = config.PRESETS[config.DEFAULT_PRESET] || {};
    const values = { ...base, ...(optionsObj || {}) };

    const setRange = (id, value) => {
      const input = document.getElementById(id);
      if (!input || value == null) return;
      input.value = value;
      const output = document.getElementById(id + "-value");
      if (output) output.textContent = String(value);
    };
    const setCheckbox = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!value;
    };
    const setSelect = (id, value) => {
      const el = document.getElementById(id);
      if (el && value) el.value = value;
    };

    setRange("resume-chem-bond-thickness", values.bondThickness);
    setRange("resume-chem-bond-spacing", values.bondSpacing);
    setRange("resume-chem-font-size-large", values.fontSizeLarge);
    setRange("resume-chem-font-size-small", values.fontSizeSmall);
    setCheckbox("resume-chem-compact-drawing", values.compactDrawing);
    setCheckbox("resume-chem-explicit-hydrogens", values.explicitHydrogens);
    setCheckbox("resume-chem-terminal-carbons", values.terminalCarbons);
    setSelect("resume-chem-colour-scheme", values.colourScheme || "element");
  };

  /**
   * Update the per-image badge and clear button for the resume panel.
   * Mirrors _updatePerImageBadge() from mathpix-result-renderer.js.
   * @param {number} index - Index into this._resumeChemistryData
   * @private
   */
  proto._updateResumePerImageBadge = function (index) {
    const item = this._resumeChemistryData?.[index];
    const hasPerImage = item?.renderOptions &&
      typeof item.renderOptions === "object" &&
      Object.keys(item.renderOptions).length > 0;

    const badge = document.getElementById("resume-chemistry-per-image-badge");
    if (badge) badge.hidden = !hasPerImage;

    const clearBtn = document.getElementById("resume-chem-clear-per-image");
    if (clearBtn) clearBtn.disabled = !hasPerImage;
  };

  /**
   * Sync per-image state (toggle, radio, controls, badge) for a given index.
   * Called on navigation in _displayResumeChemistryStructure.
   * Mirrors _syncPerImageStateForIndex() from mathpix-result-renderer.js.
   * @param {number} index - Index into this._resumeChemistryData
   * @private
   */
  proto._syncResumePerImageState = function (index) {
    const item = this._resumeChemistryData?.[index];
    if (!item) return;

    const utils = window.MathPixChemistryUtils;
    const hasPerImage = item.renderOptions &&
      typeof item.renderOptions === "object" &&
      Object.keys(item.renderOptions).length > 0;

    const toggle = document.getElementById("resume-chem-per-image-toggle");
    if (toggle) toggle.checked = !!hasPerImage;

    const targetPreset = hasPerImage
      ? (item.renderPresetName || "custom")
      : (utils?.getActivePreset?.() || "skeletal");
    const targetRadio = document.querySelector(
      'input[name="resume-chemistry-preset"][value="' + targetPreset + '"]'
    );
    if (targetRadio) targetRadio.checked = true;

    if (hasPerImage) {
      this._populateResumeAdvancedControlsFromOptions(item.renderOptions);
    } else if (utils?.getActivePreset) {
      this._populateResumeAdvancedControlsFromPreset(utils.getActivePreset());
    }

    this._updateResumePerImageBadge(index);
  };

  /**
   * Set up the resume-panel preset selector radio group.
   * Mirrors _setupChemistryPresetSelector() from mathpix-result-renderer.js.
   * @private
   */
  proto._setupResumePresetSelector = function () {
    const container = document.getElementById("resume-chemistry-preset-selector");
    if (!container) return;

    const utils = window.MathPixChemistryUtils;
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!utils || !config) return;

    // Set the radio to match the stored preset
    const activePreset = utils.getActivePreset();
    const activeRadio = container.querySelector(
      'input[name="resume-chemistry-preset"][value="' + activePreset + '"]'
    );
    if (activeRadio) activeRadio.checked = true;

    // Listen for changes on the radio group
    const radios = container.querySelectorAll('input[name="resume-chemistry-preset"]');
    const self = this;
    radios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        const presetName = radio.value;
        const liveRegion = document.getElementById("resume-chemistry-live-region");

        const perImageToggle = document.getElementById("resume-chem-per-image-toggle");
        const perImageActive = !!(perImageToggle && perImageToggle.checked);
        const index = self._resumeChemistryIndex;
        const item = self._resumeChemistryData?.[index];

        if (perImageActive && item) {
          let resolvedOptions;
          if (presetName === "custom") {
            resolvedOptions = self._collectResumeAdvancedControlValues();
          } else {
            const presetOpts = config.PRESETS[presetName];
            resolvedOptions = presetOpts ? { ...presetOpts } : {};
            if (!resolvedOptions.colourScheme) {
              resolvedOptions.colourScheme = "element";
            }
          }

          item.renderOptions = resolvedOptions;
          item.renderPresetName = presetName;

          self._populateResumeAdvancedControlsFromOptions(resolvedOptions);
          self._updateResumePerImageBadge(index);

          const canvas = document.getElementById("resume-chemistry-structure-canvas");
          if (canvas && item.notation) {
            utils.renderStructure(item.notation, canvas, {
              onGraphReady: function () {
                if (utils.generateStructuralDescription) {
                  const pubData = item._resolvedName
                    ? { commonNames: item.commonNames, iupacName: item.iupacName }
                    : undefined;
                  const desc = utils.generateStructuralDescription(item.notation, pubData);
                  if (desc) {
                    item._structuralDescription = desc;
                    if (self._resumeChemistryIndex === index) {
                      const descEl = document.getElementById("resume-chemistry-structural-desc-text");
                      const descContainer = document.getElementById("resume-chemistry-structural-description");
                      if (descEl) descEl.textContent = desc;
                      if (descContainer) descContainer.style.display = "";
                      // Phase 8A-4: progressive aria-label
                      const figure = document.getElementById("resume-chemistry-structure-figure");
                      if (figure) figure.setAttribute("aria-label", desc);
                    }
                  }
                }
              },
              perImageOptions: resolvedOptions,
            });
          }

          const perImageLabel = presetName === "custom"
            ? "Custom"
            : (config.PRESETS[presetName]?.label || presetName);
          if (liveRegion) {
            liveRegion.textContent = "Per-image rendering style set to " + perImageLabel + " for this structure";
          }

          document.dispatchEvent(new CustomEvent("chemistry-settings-changed", {
            detail: { scope: "perImage", index: index, smiles: item.notation },
          }));
          return;
        }

        // Global preset branch
        const saved = utils.setActivePreset(presetName);
        if (!saved) return;

        if (presetName !== "custom") {
          self._populateResumeAdvancedControlsFromPreset(presetName);
        }

        const canvas = document.getElementById("resume-chemistry-structure-canvas");
        if (canvas && item?.notation) {
          utils.renderStructure(item.notation, canvas, {
            onGraphReady: function () {
              if (utils.generateStructuralDescription) {
                const pubData = item._resolvedName
                  ? { commonNames: item.commonNames, iupacName: item.iupacName }
                  : undefined;
                const desc = utils.generateStructuralDescription(item.notation, pubData);
                if (desc) {
                  item._structuralDescription = desc;
                  if (self._resumeChemistryIndex === index) {
                    const descEl = document.getElementById("resume-chemistry-structural-desc-text");
                    const descContainer = document.getElementById("resume-chemistry-structural-description");
                    if (descEl) descEl.textContent = desc;
                    if (descContainer) descContainer.style.display = "";
                    const figure = document.getElementById("resume-chemistry-structure-figure");
                    if (figure) figure.setAttribute("aria-label", desc);
                  }
                }
              }
            },
            perImageOptions: item?.renderOptions || null,
          });
        }

        const presetLabel = presetName === "custom"
          ? "Custom"
          : (config.PRESETS[presetName]?.label || presetName);
        if (liveRegion) {
          liveRegion.textContent = "Rendering style changed to " + presetLabel;
        }

        document.dispatchEvent(new CustomEvent("chemistry-settings-changed", {
          detail: { scope: "global" },
        }));
      });
    });

    logInfo("Phase 8A-1: resume preset selector wired");
  };

  /**
   * Set up the resume-panel advanced rendering controls.
   * Mirrors _setupChemistryAdvancedControls() from mathpix-result-renderer.js.
   * @private
   */
  proto._setupResumeAdvancedControls = function () {
    const container = document.getElementById("resume-chemistry-advanced-controls");
    if (!container) return;

    const utils = window.MathPixChemistryUtils;
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!utils || !config) return;

    // Guard against double wiring
    if (container.dataset.wired === "true") {
      this._populateResumeAdvancedControlsFromPreset(utils.getActivePreset());
      return;
    }
    container.dataset.wired = "true";

    const ids = {
      bondThickness: "resume-chem-bond-thickness",
      bondSpacing: "resume-chem-bond-spacing",
      fontSizeLarge: "resume-chem-font-size-large",
      fontSizeSmall: "resume-chem-font-size-small",
      compactDrawing: "resume-chem-compact-drawing",
      explicitHydrogens: "resume-chem-explicit-hydrogens",
      terminalCarbons: "resume-chem-terminal-carbons",
      colourScheme: "resume-chem-colour-scheme",
    };

    // Populate from current active preset
    this._populateResumeAdvancedControlsFromPreset(utils.getActivePreset());

    // Debounce timer shared by range sliders
    let debounceTimer = null;
    const self = this;

    const collectOptions = function () {
      const el = (id) => document.getElementById(id);
      return {
        bondThickness: parseFloat(el(ids.bondThickness).value),
        bondSpacing: parseFloat(el(ids.bondSpacing).value),
        fontSizeLarge: parseFloat(el(ids.fontSizeLarge).value),
        fontSizeSmall: parseFloat(el(ids.fontSizeSmall).value),
        compactDrawing: el(ids.compactDrawing).checked,
        explicitHydrogens: el(ids.explicitHydrogens).checked,
        terminalCarbons: el(ids.terminalCarbons).checked,
        colourScheme: el(ids.colourScheme).value,
      };
    };

    const reRenderResume = function (item, index, perImageOptions) {
      const canvas = document.getElementById("resume-chemistry-structure-canvas");
      if (canvas && item.notation) {
        utils.renderStructure(item.notation, canvas, {
          onGraphReady: function () {
            if (utils.generateStructuralDescription) {
              const pubData = item._resolvedName
                ? { commonNames: item.commonNames, iupacName: item.iupacName }
                : undefined;
              const desc = utils.generateStructuralDescription(item.notation, pubData);
              if (desc) {
                item._structuralDescription = desc;
                if (self._resumeChemistryIndex === index) {
                  const descEl = document.getElementById("resume-chemistry-structural-desc-text");
                  const descContainer = document.getElementById("resume-chemistry-structural-description");
                  if (descEl) descEl.textContent = desc;
                  if (descContainer) descContainer.style.display = "";
                  const figure = document.getElementById("resume-chemistry-structure-figure");
                  if (figure) figure.setAttribute("aria-label", desc);
                }
              }
            }
          },
          perImageOptions: perImageOptions,
        });
      }
    };

    const applyCustom = function () {
      const options = collectOptions();
      const liveRegion = document.getElementById("resume-chemistry-live-region");

      const perImageToggle = document.getElementById("resume-chem-per-image-toggle");
      const perImageActive = !!(perImageToggle && perImageToggle.checked);
      const index = self._resumeChemistryIndex;
      const item = self._resumeChemistryData?.[index];

      if (perImageActive && item) {
        item.renderOptions = options;
        item.renderPresetName = "custom";

        const customRadio = document.querySelector(
          'input[name="resume-chemistry-preset"][value="custom"]'
        );
        if (customRadio) customRadio.checked = true;

        self._updateResumePerImageBadge(index);
        reRenderResume(item, index, options);

        if (liveRegion) {
          liveRegion.textContent = "Per-image rendering updated for this structure";
        }

        document.dispatchEvent(new CustomEvent("chemistry-settings-changed", {
          detail: { scope: "perImage", index: index, smiles: item.notation },
        }));
        return;
      }

      // Global-custom branch
      utils.setActivePreset("custom");
      utils.setCustomOptions(options);

      const customRadio = document.querySelector(
        'input[name="resume-chemistry-preset"][value="custom"]'
      );
      if (customRadio) customRadio.checked = true;

      if (item?.notation) {
        reRenderResume(item, self._resumeChemistryIndex, null);
      }

      if (liveRegion) {
        liveRegion.textContent = "Custom rendering style applied";
      }

      document.dispatchEvent(new CustomEvent("chemistry-settings-changed", {
        detail: { scope: "global" },
      }));
    };

    const debouncedApply = function () {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
        applyCustom();
      }, 150);
    };

    // Wire range sliders — update <output> immediately, debounce re-render
    [ids.bondThickness, ids.bondSpacing, ids.fontSizeLarge, ids.fontSizeSmall].forEach(function (id) {
      const input = document.getElementById(id);
      if (!input) return;
      const output = document.getElementById(id + "-value");
      input.addEventListener("input", function () {
        if (output) output.textContent = input.value;
        debouncedApply();
      });
    });

    // Wire checkboxes and select — immediate re-render
    [ids.compactDrawing, ids.explicitHydrogens, ids.terminalCarbons, ids.colourScheme].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", function () { applyCustom(); });
    });

    // Reset-to-preset button
    const resetBtn = document.getElementById("resume-chem-reset-to-preset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        let targetPreset = utils.getActivePreset();
        if (targetPreset === "custom") {
          targetPreset = config.DEFAULT_PRESET;
        }

        utils.setActivePreset(targetPreset);
        const radio = document.querySelector(
          'input[name="resume-chemistry-preset"][value="' + targetPreset + '"]'
        );
        if (radio) radio.checked = true;
        self._populateResumeAdvancedControlsFromPreset(targetPreset);

        const index = self._resumeChemistryIndex;
        const item = self._resumeChemistryData?.[index];
        if (item?.notation) {
          reRenderResume(item, index, item.renderOptions || null);
        }

        const presetLabel = config.PRESETS[targetPreset]?.label || targetPreset;
        const liveRegion = document.getElementById("resume-chemistry-live-region");
        if (liveRegion) {
          liveRegion.textContent = "Advanced controls reset to " + presetLabel + " preset";
        }
      });
    }

    // Per-image toggle
    const perImageToggle = document.getElementById("resume-chem-per-image-toggle");
    if (perImageToggle) {
      perImageToggle.addEventListener("change", function () {
        const index = self._resumeChemistryIndex;
        const item = self._resumeChemistryData?.[index];
        if (!item) return;
        const liveRegion = document.getElementById("resume-chemistry-live-region");

        if (perImageToggle.checked) {
          item.renderOptions = collectOptions();
          const checkedRadio = document.querySelector(
            'input[name="resume-chemistry-preset"]:checked'
          );
          item.renderPresetName = checkedRadio?.value || utils.getActivePreset() || "skeletal";
          self._updateResumePerImageBadge(index);
          if (liveRegion) {
            liveRegion.textContent = "Per-image settings enabled for this structure";
          }
        } else {
          delete item.renderOptions;
          delete item.renderPresetName;
          self._updateResumePerImageBadge(index);

          const globalPreset = utils.getActivePreset();
          const globalRadio = document.querySelector(
            'input[name="resume-chemistry-preset"][value="' + globalPreset + '"]'
          );
          if (globalRadio) globalRadio.checked = true;
          self._populateResumeAdvancedControlsFromPreset(globalPreset);

          if (liveRegion) {
            liveRegion.textContent = "Per-image settings disabled, using global preset";
          }
        }

        // Re-render
        const canvas = document.getElementById("resume-chemistry-structure-canvas");
        if (canvas && item.notation) {
          reRenderResume(item, index, item.renderOptions || null);
        }

        document.dispatchEvent(new CustomEvent("chemistry-settings-changed", {
          detail: { scope: "perImage", index: index, smiles: item.notation },
        }));
      });
    }

    // Clear per-image settings button
    const clearPerImageBtn = document.getElementById("resume-chem-clear-per-image");
    if (clearPerImageBtn) {
      clearPerImageBtn.addEventListener("click", function () {
        const index = self._resumeChemistryIndex;
        const item = self._resumeChemistryData?.[index];
        if (!item) return;

        delete item.renderOptions;
        delete item.renderPresetName;

        const toggle = document.getElementById("resume-chem-per-image-toggle");
        if (toggle) toggle.checked = false;

        self._updateResumePerImageBadge(index);

        const globalPreset = utils.getActivePreset();
        const globalRadio = document.querySelector(
          'input[name="resume-chemistry-preset"][value="' + globalPreset + '"]'
        );
        if (globalRadio) globalRadio.checked = true;
        self._populateResumeAdvancedControlsFromPreset(globalPreset);

        reRenderResume(item, index, null);

        const liveRegion = document.getElementById("resume-chemistry-live-region");
        if (liveRegion) {
          liveRegion.textContent = "Per-image settings cleared";
        }

        document.dispatchEvent(new CustomEvent("chemistry-settings-changed", {
          detail: { scope: "perImage", index: index, smiles: item.notation },
        }));
      });
    }

    logInfo("Phase 8A-2: resume advanced controls wired");
  };

  /**
   * Integrate with the MMDEditorPersistence module
   * @param {string} sourceFilename - Source filename
   * @private
   */
  proto.integratePersistenceModule = function (sourceFilename) {
    const persistence = window.getMathPixMMDPersistence?.();
    if (!persistence) {
      logDebug("Persistence module not available, using internal persistence");
      return;
    }

    // Initialise persistence if needed
    if (!persistence.isInitialised) {
      persistence.init();
    }

    // Start a new session with our restored content
    const mmdContent = this.getMMDForAPI(
      this.restoredSession?.originalMMD || "",
    );
    if (mmdContent) {
      persistence.startSession(mmdContent, sourceFilename);
      logInfo("Persistence module session started for resume mode");

      // Listen for status changes from persistence
      this.setupPersistenceStatusSync(persistence);
    }
  };

  /**
   * Update AI Enhancement button state after session change
   * @since Phase 7.1
   */
  proto.updateAIEnhanceButton = function () {
    const enhancer = window.getMathPixAIEnhancer?.();
    if (enhancer) {
      enhancer.updateButtonState();
      logDebug("AI Enhancement button state updated");
    }
  };

  /**
   * Sync status updates from persistence module
   * @param {Object} persistence - Persistence module instance
   * @private
   */
  proto.setupPersistenceStatusSync = function (persistence) {
    // Override the persistence module's updateStatus to also update our UI
    const originalUpdateStatus = persistence.updateStatus.bind(persistence);
    persistence.updateStatus = (state) => {
      originalUpdateStatus(state);
      this.updateSessionStatus(state);
    };

    // Initial button state sync
    this.updateUndoRedoButtons();
  };

  /**
   * Configure UI based on source type
   * @param {boolean} isPDF - Whether source is PDF
   * @private
   */
  proto.configureUIForSourceType = function (isPDF) {
    logDebug("Configuring UI for source type:", { isPDF });

    // Show/hide Confidence tab
    if (this.elements.tabConfidence) {
      this.elements.tabConfidence.hidden = !isPDF;
    }

    // Show/hide Compare button
    if (this.elements.mmdViewPdfSplitBtn) {
      this.elements.mmdViewPdfSplitBtn.hidden = !isPDF;
    }

    // Show/hide Split PDF toggle (only visible in split mode with PDF source)
    if (this.elements.splitPdfToggle) {
      this.elements.splitPdfToggle.hidden = !isPDF;
    }

    // Set default view to split
    this.switchMmdView("split");
  };

  /**
   * Update session header with source info
   * @param {string} filename - Source filename
   * @private
   */
  proto.updateSessionHeader = function (filename) {
    if (this.elements.sourceName) {
      this.elements.sourceName.textContent = filename || "Unknown file";
    }
    if (this.elements.sessionStatus) {
      this.elements.sessionStatus.textContent =
        RESTORER_CONFIG.MESSAGES.SESSION_SAVED;
      this.elements.sessionStatus.dataset.state = "saved";
    }
  };

  console.log("[SessionRestorer] Restore mixin loaded");
})();
