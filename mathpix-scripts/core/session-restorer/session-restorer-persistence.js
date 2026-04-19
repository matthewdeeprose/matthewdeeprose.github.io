// ─── MathPixSessionRestorer Persistence Mixin ────────────────────────────────
// Auto-save, undo/redo, file operations, and ZIP download.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-persistence.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // UPDATED ZIP DOWNLOAD
  // =========================================================================

  /**
   * Download updated ZIP with new edits/conversions
   * Uses MathPixTotalDownloader.createArchive() API
   *
   * Data structure requirements:
   * - sourceState.file: File object (for source folder)
   * - formats: Object with format keys (for results folder)
   * - Persistence session: For edits folder
   * - ConvertUI.getCompletedDownloadsWithFilenames: For converted folder
   */
  proto.downloadUpdatedZIP = async function () {
    logInfo("Creating updated ZIP archive");

    try {
      // Check if MathPixTotalDownloader class is available
      if (typeof window.MathPixTotalDownloader === "undefined") {
        this.showNotification(
          "ZIP downloader not available. Ensure mathpix-total-downloader.js is loaded.",
          "error",
        );
        return;
      }

      // Check if JSZip is available (required by downloader)
      if (typeof JSZip === "undefined") {
        this.showNotification(
          "JSZip library not available. ZIP creation requires JSZip.",
          "error",
        );
        return;
      }

      // Create downloader instance
      const downloader = new window.MathPixTotalDownloader(null);

      // Initialize the downloader
      const initResult = downloader.initialize();
      if (!initResult) {
        this.showNotification("Failed to initialise ZIP downloader", "error");
        return;
      }

      // Get current MMD content
      const currentMMD = this.getCurrentMMDContent();
      const originalMMD = this.restoredSession?.originalMMD || "";
      const hasEdits = currentMMD !== originalMMD;

      // =========================================================================
      // FIX 1: Properly build source File object for source folder
      // =========================================================================
      const sourceFilename =
        this.restoredSession?.source?.filename || "source-document";
      let sourceFile = null;

      if (this.restoredSession?.source?.blob) {
        // Create a proper File object from the blob with original filename
        const blob = this.restoredSession.source.blob;
        const mimeType =
          blob.type ||
          (this.restoredSession?.isPDF ? "application/pdf" : "image/png");
        sourceFile = new File([blob], sourceFilename, { type: mimeType });
        logDebug("Created source File object:", {
          name: sourceFile.name,
          size: sourceFile.size,
          type: sourceFile.type,
        });
      }

      const sourceState = {
        sourceType: this.restoredSession?.isPDF ? "upload" : "upload",
        file: sourceFile,
      };

      // =========================================================================
      // FIX 2: Set up persistence session for edits folder
      // Phase 8H.3: Rewrite blob URLs to relative paths for ZIP storage
      // =========================================================================
      if (hasEdits) {
        const zipSafeMMD = this.rewriteMMDForZIP(currentMMD);
        this.setupPersistenceForEdits(zipSafeMMD, originalMMD, sourceFilename);
      }

      // =========================================================================
      // FIX 3: Set up ConvertUI for converted folder
      // =========================================================================
      if (this.conversionResults && this.conversionResults.size > 0) {
        this.setupConvertUIForDownload(sourceFilename);
      }

      // Build formats object with TRUE ORIGINAL MMD (not edited content)
      // The /results/ folder should contain the original MathPix output
      // User edits go in /edits/ via collectMMDEdits()
      const trueOriginalMMD = this.restoredSession?.results?.mmd || originalMMD;

      const formats = {
        mmd: trueOriginalMMD,
      };

      // Add any other results from original session
      if (this.restoredSession?.results) {
        Object.entries(this.restoredSession.results).forEach(([key, value]) => {
          if (key !== "mmd" && value) {
            formats[key] = value;
          }
        });
      }

      logDebug("Formats prepared for archive:", {
        usingTrueOriginal: formats.mmd === trueOriginalMMD,
        originalLength: trueOriginalMMD?.length || 0,
        currentLength: currentMMD?.length || 0,
        hasEditsToCollect: hasEdits,
      });

      // Detect API type for result file collection
      if (this.restoredSession?.isPDF) {
        formats.pdf_id = "restored"; // Marker for PDF API type detection
      }

      // Collect existing edits from the ZIP we resumed from
      // These need to be carried forward to preserve edit history
      const existingEdits = this.parseResult?.edits?.files || [];

      logDebug("Existing edits from ZIP:", {
        count: existingEdits.length,
        filenames: existingEdits.map((e) => e.filename),
      });

      // Combine saved and loaded versions for ZIP inclusion
      const allSavedVersions = [
        ...(this.savedMMDVersions || []),
        ...(this.loadedMMDVersions || []),
      ];

      logDebug("Combined saved and loaded versions:", {
        savedCount: this.savedMMDVersions?.length || 0,
        loadedCount: this.loadedMMDVersions?.length || 0,
        totalCount: allSavedVersions.length,
      });

      // Create archive data matching the expected structure
      const archiveData = {
        sourceState: sourceState,
        formats: formats,
        response: this.restoredSession?.metadata || {},
        linesData: this.restoredSession?.linesData,
        // NEW: Pass existing edits for preservation across sessions
        existingEdits: existingEdits,
        // Pass manually saved versions AND loaded files for inclusion in edits folder
        savedMMDVersions: allSavedVersions,
        // Phase 8H.2: Pass live image registry so the ZIP includes
        // user-modified images (swaps, adds) and excludes deleted ones.
        // Without this, the downloader builds a fresh registry from
        // trueOriginalMMD and re-downloads originals from CDN.
        imageRegistry: this.imageRegistry || null,
        imageFilenameMap: this.imageFilenameMap || null,
      };

      logDebug("Archive data prepared:", {
        hasSourceFile: !!sourceState.file,
        sourceFilename: sourceState.file?.name,
        sourceType: sourceState.sourceType,
        formatCount: Object.keys(formats).length,
        hasNewEdits: hasEdits,
        existingEditsCount: existingEdits.length,
        hasLinesData: !!archiveData.linesData,
        hasConversions: this.conversionResults?.size > 0,
      });

      // Create the archive
      await downloader.createArchive(archiveData);

      this.hasUnsavedChanges = false;

      // Phase 9 Feature 1C: Clear image save warning after successful download
      this._clearImageSaveWarning();

      // Track manually saved MMD versions for inclusion in ZIP
      this.savedMMDVersions = [];
      this.showNotification("Updated ZIP downloaded successfully!", "success");

      logInfo("Updated ZIP archive created successfully");
    } catch (error) {
      logError("Failed to create updated ZIP:", error);
      this.showNotification(`Failed to create ZIP: ${error.message}`, "error");
    }
  };

  /**
   * Set up persistence session so the downloader's collectMMDEdits can find our edits
   * The TotalDownloader checks window.getMathPixMMDPersistence().session
   * @param {string} currentMMD - Current edited content
   * @param {string} originalMMD - Original content
   * @param {string} sourceFilename - Source filename for edit naming
   * @private
   */
  proto.setupPersistenceForEdits = function (
    currentMMD,
    originalMMD,
    sourceFilename,
  ) {
    try {
      const persistence = window.getMathPixMMDPersistence?.();

      if (persistence) {
        // Ensure we have a session
        if (!persistence.session) {
          persistence.session = {};
        }

        // Set up the session data that collectMMDEdits expects
        persistence.session.current = currentMMD;
        persistence.session.original = originalMMD;
        persistence.session.sourceFileName = sourceFilename.replace(
          /\.[^/.]+$/,
          "",
        ); // Remove extension
        persistence.session.lastModified = Date.now();

        // Ensure hasSession returns true
        if (!persistence.hasSession) {
          persistence.hasSession = () => true;
        }

        logDebug("Persistence session configured for edits:", {
          originalLength: originalMMD.length,
          currentLength: currentMMD.length,
          sourceFileName: persistence.session.sourceFileName,
        });
      } else {
        logWarn(
          "Persistence module not available - edits may not be collected separately",
        );
      }
    } catch (error) {
      logWarn("Failed to setup persistence for edits:", error);
    }
  };

  /**
   * Register a manually saved MMD version for inclusion in ZIP downloads
   * Called by downloadResumeMMD() when user clicks "Save File"
   * @param {string} filename - The filename used for the save
   * @param {string} content - The MMD content that was saved
   */
  proto.registerSavedMMDVersion = function (filename, content) {
    if (!filename || !content) {
      logWarn("Cannot register saved version: missing filename or content");
      return;
    }

    // Ensure array exists (defensive initialisation)
    if (!this.savedMMDVersions) {
      this.savedMMDVersions = [];
    }

    // Avoid duplicates - check if this exact content was already saved
    const isDuplicate = this.savedMMDVersions.some(
      (v) => v.content === content,
    );

    if (isDuplicate) {
      logDebug("Skipping duplicate saved version registration");
      return;
    }

    this.savedMMDVersions.push({
      filename: filename,
      content: content,
      savedAt: Date.now(),
    });

    logInfo("Registered saved MMD version:", {
      filename: filename,
      contentLength: content.length,
      totalSavedVersions: this.savedMMDVersions.length,
    });
  };

  /**
   * Store AI enhancement metadata for session tracking
   * Called by MathPixAIEnhancer.applyEnhancement() when user applies AI changes
   *
   * This enables:
   * - AI sparkle icon in session loader (instead of disk icon)
   * - Special filename in ZIP: {basename}-ai-enhanced-{timestamp}.mmd
   * - AI metadata in ZIP README (model, lines changed, cost)
   *
   * @param {Object} metadata - AI enhancement metadata
   * @param {number} metadata.appliedAt - Timestamp when enhancement was applied
   * @param {string} metadata.model - Model ID used (e.g., "anthropic/claude-sonnet-4")
   * @param {number} metadata.linesAdded - Number of lines added
   * @param {number} metadata.linesRemoved - Number of lines removed
   * @param {number} metadata.linesChanged - Number of lines changed (max of added/removed)
   * @param {number} metadata.totalLines - Total lines in document
   * @param {number} metadata.cost - Cost in USD
   * @param {string} enhancedContent - The AI-enhanced MMD content
   */
  proto.setAIEnhancementMetadata = function (metadata, enhancedContent) {
    if (!metadata) {
      logWarn("Cannot set AI enhancement metadata: missing metadata");
      return;
    }

    logInfo("Setting AI enhancement metadata:", {
      model: metadata.model,
      linesChanged: metadata.linesChanged,
      cost: metadata.cost,
    });

    // Store in restoredSession for persistence and ZIP generation
    if (this.restoredSession) {
      this.restoredSession.aiEnhanced = {
        ...metadata,
        content: enhancedContent,
      };
      logDebug("AI enhancement metadata stored in restoredSession");
    }

    // Also update persistence session so it's saved to localStorage
    const persistence = window.getMathPixMMDPersistence?.();
    if (persistence?.session) {
      persistence.session.aiEnhanced = {
        ...metadata,
        content: enhancedContent,
      };
      // Trigger save to localStorage
      if (typeof persistence.saveToStorage === "function") {
        persistence.saveToStorage();
        logDebug("AI enhancement metadata saved to localStorage");
      }
    }
  };

  /**
   * Register an externally loaded MMD file for integration with session
   * Called by handleResumeMMDFileUpload() when user loads a file via "Load File"
   *
   * This method:
   * 1. Generates a new filename matching source pattern: {sourceBasename}-imported-{timestamp}.mmd
   * 2. Updates the baseline for edit detection (so subsequent edits are compared to loaded content)
   * 3. Stores the loaded filename for use in subsequent saves
   * 4. Registers the loaded file for inclusion in ZIP downloads (with original filename preserved)
   * 5. Updates the persistence session baseline
   *
   * @param {string} filename - The original filename of the loaded file
   * @param {string} content - The loaded file content
   */
  proto.registerLoadedFile = function (filename, content) {
    if (!filename || !content) {
      logWarn("Cannot register loaded file: missing filename or content");
      return;
    }

    logInfo("Registering loaded file:", {
      originalFilename: filename,
      contentLength: content.length,
    });

    // Generate renamed filename matching source pattern
    const renamedFilename = this.generateImportedFilename(filename);

    logDebug("Generated imported filename:", {
      original: filename,
      renamed: renamedFilename,
    });

    // 1. Update baseline for edit detection
    // After loading a file, we want "has edits" to compare against the loaded content
    if (this.restoredSession) {
      this.restoredSession.baselineMMD = content;
      this.restoredSession.currentMMD = content;

      // Track loaded file info for subsequent saves
      this.restoredSession.loadedFile = {
        filename: renamedFilename, // Use renamed filename
        originalFilename: filename, // Preserve original
        content: content,
        loadedAt: Date.now(),
      };

      logDebug("Updated session baseline to loaded file content");
    }

    // 2. Store loaded filename for use in subsequent saves (without extension)
    // This enables "Save File" to use the source-based filename as base
    const baseName = renamedFilename.replace(/\.[^/.]+$/, ""); // Remove extension
    this.loadedSourceFilename = baseName;

    // 3. Register the loaded file for inclusion in ZIP downloads
    // We treat loaded files similarly to saved versions but mark them distinctly
    if (!this.loadedMMDVersions) {
      this.loadedMMDVersions = [];
    }

    // Check for duplicates by content
    const isDuplicate = this.loadedMMDVersions.some(
      (v) => v.content === content,
    );

    if (!isDuplicate) {
      this.loadedMMDVersions.push({
        filename: renamedFilename, // Use renamed filename for ZIP storage
        originalFilename: filename, // Preserve original for UI display
        content: content,
        loadedAt: new Date().toISOString(),
        isLoadedFile: true, // Distinguish from manual saves
      });

      logDebug("Added to loadedMMDVersions array:", {
        totalLoaded: this.loadedMMDVersions.length,
        storedAs: renamedFilename,
        originalWas: filename,
      });
    }

    // 4. Update the persistence session baseline
    // This ensures the persistence module treats loaded content as the new "original"
    try {
      const persistence = window.getMathPixMMDPersistence?.();
      if (persistence && persistence.session) {
        // Update the baseline - subsequent edits compare against loaded content
        persistence.session.original = content;
        persistence.session.current = content;
        persistence.session.sourceFileName = baseName;
        persistence.session.lastModified = Date.now();

        // Clear undo/redo stacks since we're starting fresh with loaded content
        persistence.session.undoStack = [];
        persistence.session.redoStack = [];

        logDebug("Updated persistence session baseline to loaded content");
      }
    } catch (error) {
      logWarn("Failed to update persistence baseline:", error);
    }

    // 5. Reset unsaved changes flag (loaded content is considered "saved")
    this.hasUnsavedChanges = false;
    this.updateSessionStatus("saved");

    // 6. Update undo/redo stacks for session restorer
    // Push previous content to undo stack before loading new content
    if (this.restoredSession?.currentMMD && this.undoStack) {
      const previousContent =
        this.elements.mmdEditorTextarea?.value ||
        this.restoredSession.currentMMD;

      // Only push if different from what we're loading
      if (previousContent !== content) {
        this.undoStack.push(previousContent);

        // Trim undo stack if too large
        if (this.undoStack.length > this.maxUndoLevels) {
          this.undoStack.shift();
        }

        // Clear redo stack when new content is loaded
        this.redoStack = [];

        this.updateUndoRedoButtons();
        logDebug("Pushed previous content to undo stack");
      }
    }

    logInfo("Loaded file registered successfully:", {
      originalFilename: filename,
      renamedTo: renamedFilename,
      contentLength: content.length,
      baselineUpdated: true,
      persistenceUpdated: !!window.getMathPixMMDPersistence?.()?.session,
    });
  };

  /**
   * Generate an imported filename that matches the source pattern
   * Pattern: {sourceBasename}-imported-{YYYY}-{MM}-{DD}-{HH}-{mm}-{ss}.mmd
   *
   * @param {string} originalFilename - The original filename of the loaded file
   * @returns {string} New filename matching source pattern
   * @private
   */
  proto.generateImportedFilename = function (originalFilename) {
    // Get source filename from restored session
    const sourceFilename = this.restoredSession?.source?.filename;

    // Extract base name from source (remove extension)
    let sourceBasename = "document"; // Default fallback

    if (sourceFilename) {
      sourceBasename = sourceFilename.replace(/\.[^/.]+$/, "");
    } else {
      logWarn(
        "No source filename available, using default basename for imported file",
      );
    }

    // Generate timestamp: YYYY-MM-DD-HH-mm-ss
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("-");

    // Build new filename: {sourceBasename}-imported-{timestamp}.mmd
    const newFilename = `${sourceBasename}-imported-${timestamp}.mmd`;

    logDebug("Generated imported filename:", {
      sourceBasename,
      timestamp,
      newFilename,
    });

    return newFilename;
  };

  /**
   * Get the loaded source filename for use in saves
   * Used by downloadResumeMMD() to generate appropriate filenames
   * @returns {string|null} The loaded filename without extension, or null
   */
  proto.getLoadedSourceFilename = function () {
    return this.loadedSourceFilename || null;
  };

  /**
   * Get all loaded MMD versions for ZIP inclusion
   * @returns {Array} Array of loaded file objects
   */
  proto.getLoadedMMDVersions = function () {
    return this.loadedMMDVersions || [];
  };

  /**
   * Set up ConvertUI with our conversion results so collectConvertedFiles can find them
   * The TotalDownloader checks window.getMathPixConvertUI().getCompletedDownloadsWithFilenames()
   * @param {string} sourceFilename - Source filename for conversion naming
   * @private
   */
  proto.setupConvertUIForDownload = function (sourceFilename) {
    try {
      const convertUI = window.getMathPixConvertUI?.();

      if (
        convertUI &&
        this.conversionResults &&
        this.conversionResults.size > 0
      ) {
        // Clear any existing downloads
        if (convertUI.completedDownloads) {
          convertUI.completedDownloads.clear();
        } else {
          convertUI.completedDownloads = new Map();
        }

        // Set base filename for proper naming
        const baseName = sourceFilename.replace(/\.[^/.]+$/, "");
        if (convertUI.setBaseFilename) {
          convertUI.setBaseFilename(baseName);
        } else {
          convertUI.baseFilename = baseName;
        }

        // Copy our conversion results to convertUI
        this.conversionResults.forEach((blob, format) => {
          convertUI.completedDownloads.set(format, blob);
        });

        // Ensure the method exists that the downloader calls
        if (!convertUI.getCompletedDownloadsWithFilenames) {
          convertUI.getCompletedDownloadsWithFilenames = () => {
            const results = [];
            const formatInfo = {
              docx: { label: "Word Document", extension: ".docx" },
              pdf: { label: "PDF (HTML Rendering)", extension: ".pdf" },
              "tex.zip": { label: "LaTeX (ZIP)", extension: ".tex.zip" },
              "latex.pdf": {
                label: "PDF (LaTeX Rendering)",
                extension: "-latex.pdf",
              },
              html: { label: "HTML", extension: ".html" },
              md: { label: "Markdown", extension: ".md" },
              pptx: { label: "PowerPoint", extension: ".pptx" },
              "mmd.zip": { label: "MMD Archive (ZIP)", extension: ".mmd.zip" },
              "md.zip": {
                label: "Markdown Archive (ZIP)",
                extension: ".md.zip",
              },
              "html.zip": {
                label: "HTML Archive (ZIP)",
                extension: ".html.zip",
              },
            };

            convertUI.completedDownloads.forEach((blob, format) => {
              const info = formatInfo[format] || { extension: `.${format}` };
              const filename = `${
                convertUI.baseFilename || "document"
              }-converted${info.extension}`;
              results.push({ filename, blob, format });
            });

            return results;
          };
        }

        logDebug("ConvertUI configured for download:", {
          baseFilename: convertUI.baseFilename,
          conversionCount: this.conversionResults.size,
        });
      }
    } catch (error) {
      logWarn("Failed to setup ConvertUI for download:", error);
    }
  };

  /**
   * Set up persistence session data for the downloader to collect edits
   * The TotalDownloader's collectMMDEdits looks for getMathPixMMDPersistence
   * @param {string} currentMMD - Current edited content
   * @param {string} originalMMD - Original content
   * @private
   */
  proto.setupPersistenceForDownload = function (currentMMD, originalMMD) {
    // Try to use the actual persistence module if available
    const persistence = window.getMathPixMMDPersistence?.();
    if (persistence && persistence.hasSession?.()) {
      // Persistence already has our session, just update current content
      if (persistence.session) {
        persistence.session.current = currentMMD;
        persistence.session.original = originalMMD;
        persistence.session.sourceFileName =
          this.restoredSession?.source?.filename || "restored-document";
        persistence.session.lastModified = Date.now();
      }
      logDebug("Updated existing persistence session for download");
      return;
    }

    // If no persistence module, the downloader will skip edits collection
    // The edits will still be in the main MMD content
    logDebug("Persistence module not available - edits included in main MMD");
  };

  /**
   * Store conversion results where the downloader can collect them
   * The TotalDownloader's collectConvertedFiles looks for getMathPixConvertUI
   * @private
   */
  proto.storeConversionsForDownload = function () {
    // The downloader looks for window.getMathPixConvertUI().completedDownloads
    // We'll try to use that if available, otherwise conversions go in main results
    const convertUI = window.getMathPixConvertUI?.();
    if (convertUI && this.conversionResults) {
      // Copy our results to the convert UI's storage
      this.conversionResults.forEach((blob, format) => {
        if (convertUI.completedDownloads) {
          convertUI.completedDownloads.set(format, blob);
        }
      });
      logDebug("Stored conversions in ConvertUI for download collection");
    } else {
      logDebug("ConvertUI not available - conversions stored locally");
    }
  };

  /**
   * Get current MMD content (possibly edited)
   * @returns {string} Current MMD content
   */
  proto.getCurrentMMDContent = function () {
    // Phase 8G: When display layer is active, textarea holds collapsed content.
    // Always return the WORKING MMD (full URLs) for consumers.
    if (
      this.isDisplayCollapsed &&
      this.displayLayer &&
      this.displayLayer.hasActiveMappings()
    ) {
      // Prefer workingMMD, fall back to expanding current textarea content
      if (this.restoredSession?.workingMMD) {
        return this.restoredSession.workingMMD;
      }
      // Fallback: expand the textarea content
      const displayContent = this.elements.mmdEditorTextarea?.value || "";
      return this.displayLayer.expand(displayContent);
    }

    // Default: textarea holds the real content (no display layer active)
    return (
      this.elements.mmdEditorTextarea?.value ||
      this.restoredSession?.currentMMD ||
      this.restoredSession?.results?.mmd ||
      ""
    );
  };

  /**
   * Get only NEW conversions (not from original ZIP)
   * @returns {Object} New conversions object
   * @private
   */
  proto.getNewConversions = function () {
    // TODO: Integrate with Convert UI to get newly converted files
    // For now, return empty
    return {
      hasConverted: false,
      filenames: [],
    };
  };

  console.log("[SessionRestorer] Persistence mixin loaded");
})();
