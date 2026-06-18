// ─── MathPixSessionRestorer Convert Mixin ────────────────────────────────────
// Format conversion UI, progress, and downloads.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-convert.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // CONVERT FUNCTIONALITY
  // =========================================================================

  /**
   * Update convert button enabled state based on checkbox selection
   * @private
   */
  proto.updateConvertButtonState = function () {
    if (!this.elements.convertBtn) return;

    const hasSelection = Array.from(
      this.elements.convertFormatCheckboxes || [],
    ).some((cb) => cb.checked);
    const hasContent = !!this.restoredSession?.currentMMD;

    this.elements.convertBtn.disabled = !hasSelection || !hasContent;
  };

  /**
   * Get selected conversion formats
   * @returns {string[]} Array of format values
   * @private
   */
  proto.getSelectedConvertFormats = function () {
    return Array.from(this.elements.convertFormatCheckboxes || [])
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
  };

  /**
   * Read the convert size limit using the same three-tier fallback the gate
   * has always used, so the gate and the convert-size indicator read one
   * limit. EMBEDDING override → CONVERT default → hard-coded 10 MB.
   * @returns {number} the limit in bytes
   * @private
   */
  proto._getConvertSizeLimit = function () {
    return (
      window.MATHPIX_CONFIG?.CONVERT?.EMBEDDING?.MAX_EMBEDDED_MMD_SIZE_BYTES ??
      window.MATHPIX_CONFIG?.CONVERT?.MAX_MMD_SIZE_BYTES ??
      10 * 1024 * 1024
    );
  };

  /**
   * Build the over-limit alert prose (the P8b wording) so the gate and the
   * convert-size indicator speak with one voice. Pure: depends only on the two
   * byte counts. Keeps the gate's existing fmtSize format (two-decimal MB)
   * verbatim — do not switch this to _formatBytes.
   * @param {number} embeddedSize - measured embedded MMD size in bytes
   * @param {number} maxBytes - the limit in bytes
   * @returns {string} the over-limit message
   * @private
   */
  proto._buildOverLimitMessage = function (embeddedSize, maxBytes) {
    const limitMB = (maxBytes / (1024 * 1024)).toFixed(0);
    const fmtSize = (bytes) => {
      if (bytes >= 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KB`;
      return `${bytes} bytes`;
    };
    const overBy = fmtSize(embeddedSize - maxBytes);
    const totalSize = fmtSize(embeddedSize);
    return `This document is too large to convert via the API after embedding image data — about ${overBy} over the ${limitMB} MB limit (${totalSize} total). Try converting fewer formats at once, or contact support if this is a persistent issue with this document.`;
  };

  /**
   * Compose the visible readout text from a size breakdown and band. Pure.
   * The "over" detail reuses the P8b wording so the indicator and the gate
   * speak with one voice; the "close" detail surfaces the actionable image
   * breakdown; "under" shows the size alone. An unavailable estimate (a
   * chemistry image that could not be measured) overrides the band.
   * @param {{total:number, imageBytes:number, textBytes:number}} breakdown
   * @param {"under"|"close"|"over"} band
   * @param {number} limit - limit in bytes
   * @param {boolean} unavailable - true when an image could not be measured
   * @returns {{readout:string, detail:string}}
   */
  proto._composeConvertSizeReadout = function (breakdown, band, limit, unavailable) {
    if (unavailable) {
      return {
        readout: "Projected size: unavailable",
        detail:
          "An image could not be measured. Check your connection and try again.",
      };
    }
    const total = this._formatBytes(breakdown.total);
    const limitMB = (limit / (1024 * 1024)).toFixed(0);
    if (band === "over") {
      return {
        readout: `Projected size: ${total} — over the ${limitMB} MB limit`,
        detail: this._buildOverLimitMessage(breakdown.total, limit),
      };
    }
    if (band === "close") {
      return {
        readout: `Projected size: ${total} — close to the ${limitMB} MB limit`,
        detail: `Images ${this._formatBytes(breakdown.imageBytes)}, text ${this._formatBytes(breakdown.textBytes)}. Remove or shrink images to stay under the limit.`,
      };
    }
    return { readout: `Projected size: ${total}`, detail: "" };
  };

  /**
   * Decide the band-transition announcement. Pure. Returns null on the first
   * compute (previousBand null) and when the band is unchanged, so a freshly
   * loaded document never startles and steady editing stays silent. Otherwise
   * it speaks for the band just entered.
   * @param {?("under"|"close"|"over")} previousBand
   * @param {"under"|"close"|"over"} nextBand
   * @returns {?string} the announcement, or null for no announcement
   */
  proto._convertSizeTransition = function (previousBand, nextBand) {
    if (previousBand == null || previousBand === nextBand) return null;
    if (nextBand === "over") return "Projected convert size is over the limit.";
    if (nextBand === "close")
      return "Projected convert size is close to the limit.";
    return "Projected convert size is back under the limit.";
  };

  /**
   * Infer whether the estimate is incomplete because a chemistry embed failed
   * (offline). A failed embed shows as a chemistry CDN URL that is present in
   * the MMD with a blobUrl in the live map, yet absent from the manifest the
   * estimator built. Pure aside from reading the live preview map. Returns
   * false when there is no chemistry, or every expected embed is present.
   * @param {string} mmdContent
   * @param {Array<{url:string, replacement:string}>} manifest
   * @returns {boolean}
   */
  proto._convertSizeUnavailable = function (mmdContent, manifest) {
    if (!mmdContent) return false;
    const chemMap =
      typeof window.getMathPixMMDPreview === "function"
        ? window.getMathPixMMDPreview()?.chemistryBlobUrlMap
        : null;
    if (!chemMap || chemMap.size === 0) return false;
    const embedded = new Set(manifest.map((entry) => entry.url));
    for (const [cdnUrl, chemEntry] of chemMap.entries()) {
      if (!chemEntry?.blobUrl) continue;
      if (!mmdContent.includes(cdnUrl)) continue;
      if (!embedded.has(cdnUrl)) return true;
    }
    return false;
  };

  /**
   * Write a band-transition message to the dedicated polite announce region.
   * Mirrors announceToScreenReader's set-then-clear, but on the convert-size
   * region (#resume-convert-size-announce), which is cleanly polite — unlike
   * the shared app announcer, which also carries role="alert". No-ops when the
   * region is absent (the indicator is an enhancement).
   * @param {string} message
   * @private
   */
  proto._announceConvertSize = function (message) {
    const region = this.elements?.convertSizeAnnounce;
    if (!region || !message) return;
    region.textContent = message;
    clearTimeout(this._convertSizeAnnounceTimer);
    this._convertSizeAnnounceTimer = setTimeout(() => {
      region.textContent = "";
    }, 3000);
  };

  /**
   * Refresh the convert-size indicator: read the same MMD and formats the gate
   * uses, project the embedded size and breakdown, write the readout silently,
   * and announce only on a genuine band transition. Fire-and-forget safe — it
   * catches its own errors and no-ops when the markup is absent, so it never
   * breaks the auto-save it hangs off. Matches the gate exactly via
   * getCurrentMMDContent + getSelectedConvertFormats, so the readout and the
   * gate never disagree on the boundary.
   * @private
   */
  proto._refreshConvertSizeIndicator = async function () {
    try {
      const readoutEl = this.elements?.convertSizeReadout;
      if (!readoutEl) return; // enhancement absent — nothing to update
      const detailEl = this.elements?.convertSizeDetail;

      const mmd = this.getCurrentMMDContent();
      if (!mmd) {
        readoutEl.hidden = true;
        readoutEl.textContent = "";
        readoutEl.removeAttribute("data-band");
        if (detailEl) {
          detailEl.hidden = true;
          detailEl.textContent = "";
        }
        this._lastConvertSizeBand = null;
        return;
      }

      const selectedFormats = this.getSelectedConvertFormats();
      // One manifest build for the offline check; the breakdown rebuilds it,
      // but P3's encode cache makes the second build cheap.
      const manifest = await this.buildManifest(mmd, selectedFormats);
      const unavailable = this._convertSizeUnavailable(mmd, manifest);
      const breakdown = await this._estimateConvertSizeBreakdown(
        mmd,
        selectedFormats,
      );
      const limit = this._getConvertSizeLimit();

      let band = null;
      let readout;
      let detail;
      if (unavailable) {
        ({ readout, detail } = this._composeConvertSizeReadout(
          breakdown,
          "under",
          limit,
          true,
        ));
      } else {
        band = this._convertSizeBand(breakdown.total, limit);
        ({ readout, detail } = this._composeConvertSizeReadout(
          breakdown,
          band,
          limit,
          false,
        ));
      }

      readoutEl.hidden = false;
      readoutEl.textContent = readout;
      readoutEl.dataset.band = unavailable ? "unavailable" : band;
      if (detailEl) {
        detailEl.hidden = detail === "";
        detailEl.textContent = detail;
      }

      // Announce only on a real band change; stay silent while unavailable so
      // a transient offline blip does not speak, and keep the last known band.
      if (!unavailable) {
        const speech = this._convertSizeTransition(
          this._lastConvertSizeBand,
          band,
        );
        if (speech) this._announceConvertSize(speech);
        this._lastConvertSizeBand = band;
      }
    } catch (err) {
      logError("_refreshConvertSizeIndicator failed", err);
    }
  };

  /**
   * Handle convert button click
   * Follows the pattern from mathpix-convert-ui.js
   * @private
   */
  proto.handleConvert = async function () {
    if (this.isConverting) {
      logWarn("Conversion already in progress");
      return;
    }

    const selectedFormats = this.getSelectedConvertFormats();
    if (selectedFormats.length === 0) {
      this.showNotification(
        "Please select at least one format to convert to.",
        "warning",
      );
      return;
    }

    let mmdContent = this.getCurrentMMDContent();
    if (!mmdContent) {
      this.showNotification(
        "No MMD content available for conversion.",
        "error",
      );
      return;
    }

    // F-M Phase 4 (was Phase 8F): bytes-first embedding for the convert
    // API. getMMDForAPI now encodes live registry bytes as dataURIs for
    // OCR replacements, chemistry RDKit renders, and user-added uploads;
    // falls back to CDN URLs when no bytes are available. Async because
    // canvas.toBlob() is callback-based — selectedFormats drive
    // pickEncoders' WebP gate.
    mmdContent = await this.getMMDForAPI(mmdContent, selectedFormats);

    // F-M Phase 4: pre-flight size guard. Embedding can push MMD size
    // from ~6 KB to multi-MB; the Convert API enforces a 10 MB JSON
    // body limit. Surface an actionable safeAlert rather than letting
    // the API reject with a generic error.
    const maxBytes = this._getConvertSizeLimit();
    const embeddedSize = new Blob([mmdContent]).size;
    logDebug(
      `Site 3 convert: post-embedding MMD size = ${embeddedSize} bytes (limit ${maxBytes})`,
    );
    if (embeddedSize > maxBytes) {
      const message = this._buildOverLimitMessage(embeddedSize, maxBytes);
      logError(
        `Site 3 convert: payload too large after embedding (${embeddedSize} > ${maxBytes})`,
      );
      if (typeof window.safeAlert === "function") {
        await window.safeAlert(message, "Document too large to convert");
      } else {
        this.showNotification(message, "error");
      }
      return;
    }

    // Get the API client
    const client = window.getMathPixConvertClient?.();
    if (!client) {
      this.showNotification(
        "Convert API client not available. Please refresh the page.",
        "error",
      );
      return;
    }

    // Validate MMD content
    const validation = client.validateMMD(mmdContent);
    if (!validation.valid) {
      this.showNotification(validation.error, "error");
      return;
    }

    // Start conversion
    this.isConverting = true;
    this.conversionResults = new Map();

    // Update UI
    this.updateConvertButtonState();
    if (this.elements.convertCancelBtn)
      this.elements.convertCancelBtn.hidden = false;
    this.hideConvertErrors();
    this.hideConvertDownloads();
    this.showConvertProgress(selectedFormats);

    logInfo("Starting conversion for formats:", selectedFormats);

    try {
      const results = await client.convertAndDownload(
        mmdContent,
        selectedFormats,
        {
          onStart: (conversionId) => {
            this.activeConversionId = conversionId;
            logDebug("Conversion started:", conversionId);
          },
          onProgress: (status) => {
            this.updateConvertProgress(status);
          },
          onFormatComplete: (format, blob) => {
            logInfo(`Format complete: ${format} (${blob.size} bytes)`);
            this.updateConvertProgressItem(format, "completed");
            this.conversionResults.set(format, blob);
          },
          onComplete: (completionResult) => {
            logInfo("Conversion workflow complete:", {
              completed: completionResult.completed?.length || 0,
              failed: completionResult.failed?.length || 0,
            });

            // Show any errors for failed formats
            if (completionResult.failed && completionResult.failed.length > 0) {
              const errorMessages = completionResult.failed.map((format) => {
                const formatInfo = this.getFormatInfo(format);
                const error = completionResult.errors?.[format];
                return `${formatInfo.label}: ${error || "Unknown error"}`;
              });
              this.showConvertErrors(errorMessages);
            }
          },
          onError: (error) => {
            logWarn("Format error:", error.message);
          },
        },
      );

      // Store results from returned Map (backup in case callbacks didn't fire)
      if (results && results.size > 0) {
        results.forEach((blob, format) => {
          if (!this.conversionResults.has(format)) {
            this.conversionResults.set(format, blob);
          }
        });
      }

      // Show downloads if any succeeded
      if (this.conversionResults.size > 0) {
        this.showConvertDownloads();
        this.showNotification(
          `${this.conversionResults.size} format(s) converted successfully!`,
          "success",
        );
      }
    } catch (error) {
      logError("Conversion failed:", error);
      this.showConvertError(error.message);
      this.showNotification(`Conversion failed: ${error.message}`, "error");
    } finally {
      this.isConverting = false;
      this.activeConversionId = null;
      this.updateConvertButtonState();
      if (this.elements.convertCancelBtn)
        this.elements.convertCancelBtn.hidden = true;
      this.hideConvertProgress();
    }
  };

  /**
   * Cancel ongoing conversion
   * @private
   */
  proto.cancelConversion = function () {
    this.conversionAborted = true;
    this.showNotification("Conversion cancelled", "info");
    logInfo("Conversion cancelled by user");
  };

  /**
   * Show conversion progress UI
   * Mirrors mathpix-convert-ui.js showProgress
   * @param {string[]} formats - Formats being converted
   * @private
   */
  proto.showConvertProgress = function (formats) {
    if (!this.elements.convertProgress || !this.elements.convertProgressList)
      return;

    // Clear existing items
    this.elements.convertProgressList.innerHTML = "";

    // Create progress item for each format
    formats.forEach((format) => {
      const formatInfo = this.getFormatInfo(format);
      const item = document.createElement("div");
      item.className = "resume-progress-item";
      item.dataset.format = format;
      item.dataset.status = "pending";

      item.innerHTML = `
      <span class="progress-icon">${getIcon("hourglass")}</span>
      <span class="progress-format">${formatInfo.label}</span>
      <span class="progress-status">Waiting...</span>
    `;

      this.elements.convertProgressList.appendChild(item);
    });

    this.elements.convertProgress.hidden = false;
    logDebug("Progress UI shown for formats:", formats);
  };

  /**
   * Update a progress item status
   * Mirrors mathpix-convert-ui.js pattern
   * @param {string} format - Format being updated
   * @param {string} status - New status (pending, processing, completed, error)
   * @param {string} [message] - Optional message for errors
   * @private
   */
  proto.updateConvertProgressItem = function (format, status, message) {
    const item = this.elements.convertProgressList?.querySelector(
      `.resume-progress-item[data-format="${format}"]`,
    );
    if (!item) return;

    item.dataset.status = status;

    const icon = item.querySelector(".progress-icon");
    const statusEl = item.querySelector(".progress-status");

    const iconNames = {
      pending: "hourglass",
      processing: "refresh",
      completed: "checkCircle",
      error: "error",
    };

    const statusTexts = {
      pending: "Waiting...",
      processing: "Converting...",
      completed: "Complete!",
      error: message || "Failed",
    };

    if (icon) icon.innerHTML = getIcon(iconNames[status] || "hourglass");
    if (statusEl) statusEl.textContent = statusTexts[status] || status;
  };

  /**
   * Update progress display from API status
   * @param {Object} status - Status object from API client
   * @private
   */
  proto.updateConvertProgress = function (status) {
    if (!status) return;

    // Update individual format items based on formatStatuses
    if (status.formatStatuses) {
      Object.entries(status.formatStatuses).forEach(
        ([format, formatStatus]) => {
          this.updateConvertProgressItem(
            format,
            formatStatus.status || "processing",
          );
        },
      );
    }
  };

  /**
   * Hide conversion progress UI
   * @private
   */
  proto.hideConvertProgress = function () {
    if (this.elements.convertProgress) {
      this.elements.convertProgress.hidden = true;
    }
  };

  /**
   * Show conversion downloads
   * Mirrors mathpix-convert-ui.js showDownloads
   * @private
   */
  proto.showConvertDownloads = function () {
    if (
      !this.elements.convertDownloads ||
      !this.elements.convertDownloadButtons
    )
      return;

    // Clear existing buttons
    this.elements.convertDownloadButtons.innerHTML = "";

    // Get base filename from source
    const baseFilename =
      this.restoredSession?.source?.filename?.replace(/\.[^/.]+$/, "") ||
      "document";

    // Create download button for each result
    this.conversionResults.forEach((blob, format) => {
      const formatInfo = this.getFormatInfo(format);
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "resume-btn resume-btn-secondary resume-download-format-btn";
      button.innerHTML = `${getIcon("download")} ${formatInfo.label}`;

      // Generate filename
      const filename = `${baseFilename}-converted${formatInfo.extension}`;

      button.addEventListener("click", () => {
        this.triggerDownload(blob, filename);
      });

      this.elements.convertDownloadButtons.appendChild(button);
    });

    this.elements.convertDownloads.hidden = false;
    logDebug("Downloads shown:", this.conversionResults.size);
  };

  /**
   * Trigger download for a blob
   * @param {Blob} blob - File blob
   * @param {string} filename - Suggested filename
   * @private
   */
  proto.triggerDownload = function (blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up URL after short delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      this.showNotification(`Downloaded ${filename}`, "success");
      logInfo("Download triggered:", filename);
    } catch (error) {
      logError("Download failed:", error);
      this.showNotification(`Download failed: ${error.message}`, "error");
    }
  };

  /**
   * Hide conversion downloads
   * @private
   */
  proto.hideConvertDownloads = function () {
    if (this.elements.convertDownloads) {
      this.elements.convertDownloads.hidden = true;
    }
  };

  /**
   * Download a converted file
   * @param {string} format - Format type
   * @param {Object} result - Conversion result with blob and filename
   * @private
   */
  proto.downloadConvertedFile = function (format, result) {
    try {
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      this.showNotification(`Downloaded ${result.filename}`, "success");
    } catch (error) {
      logError("Download failed:", error);
      this.showNotification(`Download failed: ${error.message}`, "error");
    }
  };

  /**
   * Show conversion error
   * @param {string} message - Error message
   * @private
   */
  proto.showConvertError = function (message) {
    this.showConvertErrors([message]);
  };

  /**
   * Show multiple conversion errors
   * @param {string[]} messages - Error messages
   * @private
   */
  proto.showConvertErrors = function (messages) {
    if (!this.elements.convertErrors || !this.elements.convertErrorList) return;

    // Clear and populate error list
    this.elements.convertErrorList.innerHTML = "";
    messages.forEach((msg) => {
      const li = document.createElement("li");
      li.textContent = msg;
      this.elements.convertErrorList.appendChild(li);
    });

    this.elements.convertErrors.hidden = false;
    logDebug("Errors shown:", messages.length);
  };

  /**
   * Hide conversion errors
   * @private
   */
  proto.hideConvertErrors = function () {
    if (this.elements.convertErrors) {
      this.elements.convertErrors.hidden = true;
    }
  };

  /**
   * Get user-friendly format label
   * @param {string} format - Format value
   * @returns {string} Display label
   * @private
   */
  proto.getFormatLabel = function (format) {
    const labels = {
      docx: "DOCX (Word)",
      pdf: "PDF (HTML Rendering)",
      "tex.zip": "LaTeX (ZIP)",
      "latex.pdf": "PDF (LaTeX Rendering)",
      html: "HTML",
      md: "Markdown",
      pptx: "PowerPoint (PPTX)",
      "mmd.zip": "MMD Archive (ZIP)",
      "md.zip": "Markdown Archive (ZIP)",
      "html.zip": "HTML Archive (ZIP)",
    };
    return labels[format] || format.toUpperCase();
  };

  /**
   * Get format info object with label and extension
   * Mirrors mathpix-convert-ui.js getFormatInfo - includes ALL supported formats
   * @param {string} format - Format key
   * @returns {Object} Format info with label and extension
   * @private
   */
  proto.getFormatInfo = function (format) {
    // Try to get from config first
    if (
      typeof MATHPIX_CONFIG !== "undefined" &&
      MATHPIX_CONFIG.CONVERT?.FORMATS?.[format]
    ) {
      return MATHPIX_CONFIG.CONVERT.FORMATS[format];
    }

    // Complete fallback defaults matching PDF mode
    const defaults = {
      docx: { label: "Word Document", extension: ".docx" },
      pdf: { label: "PDF (HTML Rendering)", extension: ".pdf" },
      "tex.zip": { label: "LaTeX (ZIP)", extension: ".tex.zip" },
      "latex.pdf": { label: "PDF (LaTeX Rendering)", extension: ".pdf" },
      html: { label: "HTML", extension: ".html" },
      md: { label: "Markdown", extension: ".md" },
      pptx: { label: "PowerPoint", extension: ".pptx" },
      "mmd.zip": { label: "MMD Archive (ZIP)", extension: ".mmd.zip" },
      "md.zip": { label: "Markdown Archive (ZIP)", extension: ".md.zip" },
      "html.zip": { label: "HTML Archive (ZIP)", extension: ".html.zip" },
    };

    return (
      defaults[format] || {
        label: format.toUpperCase(),
        extension: `.${format}`,
      }
    );
  };

  /**
   * Update Select All checkbox state based on individual checkboxes
   * @private
   */
  proto.updateSelectAllState = function () {
    if (
      !this.elements.convertSelectAll ||
      !this.elements.convertFormatCheckboxes
    ) {
      return;
    }

    const checkboxes = Array.from(this.elements.convertFormatCheckboxes);
    const allChecked = checkboxes.every((cb) => cb.checked);
    const someChecked = checkboxes.some((cb) => cb.checked);

    this.elements.convertSelectAll.checked = allChecked;
    this.elements.convertSelectAll.indeterminate = someChecked && !allChecked;
  };

  /**
   * Download all converted files as a combined operation
   * Uses the existing TotalDownloader pattern
   * @private
   */
  proto.downloadAllConvertedFiles = async function () {
    if (!this.conversionResults || this.conversionResults.size === 0) {
      this.showNotification(
        "No converted files available to download.",
        "warning",
      );
      return;
    }

    logInfo("Downloading all converted files...");

    try {
      // Download each file individually (simple approach)
      // Could be enhanced to create a ZIP with all converted files
      const sourceFilename =
        this.restoredSession?.source?.filename || "document";
      const baseName = sourceFilename.replace(/\.[^/.]+$/, "");

      this.conversionResults.forEach((blob, format) => {
        const formatInfo = this.getFormatInfo(format);
        const filename = `${baseName}-converted${formatInfo.extension}`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      });

      this.showNotification(
        `Downloaded ${this.conversionResults.size} converted file(s)`,
        "success",
      );
    } catch (error) {
      logError("Failed to download converted files:", error);
      this.showNotification(`Download failed: ${error.message}`, "error");
    }
  };

  console.log("[SessionRestorer] Convert mixin loaded");
})();
