/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER CONTROLLER — DEBUG & LIBRARY STATUS SUB-MODULE
 * ═══════════════════════════════════════════════════════════════
 *
 * Debug panel population/clearing/copying and library status
 * management for the Image Describer controller.
 *
 * Mixed into window.ImageDescriberController via Object.assign.
 * Must load AFTER image-describer-controller.js (core).
 *
 * VERSION: 1.0.0
 * DATE: 14 March 2026
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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ControllerDebug] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ControllerDebug] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ControllerDebug] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ControllerDebug] ${message}`, ...args);
  }

  // ============================================================================
  // METHODS (mixed into ImageDescriberController)
  // ============================================================================

  const methods = {
    // ========================================================================
    // DEBUG PANEL METHODS (Phase 2C)
    // ========================================================================

    /**
     * Calculate estimated cost based on token usage (Phase 2C)
     * @param {Object} response - API response with token metadata
     * @returns {string} Formatted cost estimate
     */
    calculateEstimatedCost(response) {
      if (!response?.metadata?.tokens) {
        return "Not available";
      }

      const tokens = response.metadata.tokens;
      // Handle both streaming and non-streaming token structures
      const promptTokens = tokens.prompt || tokens.prompt_tokens || 0;
      const completionTokens =
        tokens.completion || tokens.completion_tokens || 0;

      // Claude Haiku 4.5 pricing (as of Nov 2025)
      // Input: $0.80 per million tokens
      // Output: $4.00 per million tokens
      const inputCostPerMillion = 0.8;
      const outputCostPerMillion = 4.0;

      const inputCost = (promptTokens / 1000000) * inputCostPerMillion;
      const outputCost = (completionTokens / 1000000) * outputCostPerMillion;
      const totalCost = inputCost + outputCost;

      // Format in appropriate currency
      if (totalCost < 0.01) {
        return `< $0.01 (${(totalCost * 100).toFixed(4)}¢)`;
      } else {
        return `$${totalCost.toFixed(4)}`;
      }
    },

    /**
     * Update debug panel with generation data (Phase 2C)
     * @param {Object} data - Debug data object
     */
    updateDebugPanel(data) {
      if (!this.elements.debugElements) {
        logWarn("Debug elements not cached");
        return;
      }

      const d = this.elements.debugElements;

      // Fallback config values (from core CONTROLLER_CONFIG)
      const cfg = this._controllerConfig || {};

      // Helper to safely set text content
      const setText = (el, val) => {
        if (el) el.textContent = val || "-";
      };

      // Request details
      setText(d.model, data.model || cfg.model || "-");
      // Stage 5: Selected model name and cost
      setText(
        d.selectedModel,
        data.selectedModelName || data.model || cfg.model || "-",
      );
      setText(d.modelCost, data.selectedModelCost || "-");
      setText(d.temperature, data.temperature || cfg.temperature || "-");
      setText(d.maxTokens, data.maxTokens || cfg.maxTokens || "-");
      setText(
        d.systemLength,
        data.systemPrompt ? `${data.systemPrompt.length} chars` : "-",
      );
      setText(
        d.userLength,
        data.userPrompt ? `${data.userPrompt.length} chars` : "-",
      );
      setText(d.streaming, data.useStreaming ? "Yes" : "No (reduced motion)");

      // File details
      if (this.currentFile) {
        setText(d.filename, this.currentFile.name);

        // Always show original size
        setText(
          d.originalSize,
          `${(this.currentFile.size / 1024).toFixed(1)} KB`,
        );
      }

      // Compression details (only if file was compressed)
      if (data.compression) {
        const c = data.compression;

        setText(
          d.compressedSize,
          c.compressedSize ? `${(c.compressedSize / 1024).toFixed(1)} KB` : "-",
        );
        setText(d.compressionSavings, c.savings ? `${c.savings}%` : "-");

        if (c.formatConversion) {
          setText(
            d.format,
            `${c.formatConversion.from} → ${c.formatConversion.to}`,
          );
        }

        if (c.dimensions?.original && c.dimensions?.compressed) {
          setText(
            d.dimensionsOriginal,
            `${c.dimensions.original.width}×${c.dimensions.original.height}`,
          );
          setText(
            d.dimensionsCompressed,
            `${c.dimensions.compressed.width}×${c.dimensions.compressed.height}`,
          );
        }
      } else if (this.currentFile) {
        // No compression (file too small) - show that explicitly
        setText(
          d.compressedSize,
          `${(this.currentFile.size / 1024).toFixed(1)} KB (not compressed)`,
        );
        setText(d.compressionSavings, "0% (not needed)");
        setText(d.format, "No conversion");

        // Try to get dimensions if it's an image
        if (this.currentFile.type.startsWith("image/")) {
          // Note: Dimensions would require reading the image
          // For now, indicate they're the same as original
          setText(d.dimensionsOriginal, "Same as uploaded");
          setText(d.dimensionsCompressed, "Same as uploaded");
        }
      }

      // Response details
      if (data.response) {
        const r = data.response;

        // Handle both streaming and non-streaming token structures
        // Try multiple possible locations for token data
        const tokens = r.metadata?.tokens || r.raw?.usage || {};

        // Prompt tokens (with fallback to estimate)
        const promptTokens = tokens.prompt || tokens.prompt_tokens;
        if (promptTokens) {
          setText(d.promptTokens, Math.round(promptTokens));
        } else if (data.systemPrompt && data.userPrompt) {
          // Estimate if not provided: ~0.25 tokens per character
          const estimate = Math.round(
            (data.systemPrompt.length + data.userPrompt.length) * 0.25,
          );
          setText(d.promptTokens, `~${estimate} (estimated)`);
        } else {
          setText(d.promptTokens, "-");
        }

        // Completion tokens
        const completionTokens = tokens.completion || tokens.completion_tokens;
        if (completionTokens) {
          setText(d.completionTokens, Math.round(completionTokens));
        } else if (r.text) {
          // Estimate if not provided
          const estimate = Math.round(r.text.length * 0.25);
          setText(d.completionTokens, `~${estimate} (estimated)`);
        } else {
          setText(d.completionTokens, "-");
        }

        // Total tokens - always calculate from individual values for accuracy
        // (API sometimes returns incomplete token data)
        let totalCalculated = 0;
        let hasIndividualValues = false;

        if (promptTokens) {
          totalCalculated += promptTokens;
          hasIndividualValues = true;
        } else if (data.systemPrompt && data.userPrompt) {
          totalCalculated += Math.round(
            (data.systemPrompt.length + data.userPrompt.length) * 0.25,
          );
          hasIndividualValues = true;
        }

        if (completionTokens) {
          totalCalculated += completionTokens;
          hasIndividualValues = true;
        } else if (r.text) {
          totalCalculated += Math.round(r.text.length * 0.25);
          hasIndividualValues = true;
        }

        if (hasIndividualValues) {
          // Use calculated total (more reliable than API's total)
          const hasEstimates = !promptTokens || !completionTokens;
          if (hasEstimates) {
            setText(
              d.totalTokens,
              `~${Math.round(totalCalculated)} (estimated)`,
            );
          } else {
            setText(d.totalTokens, Math.round(totalCalculated));
          }
        } else {
          // Fallback to API's total if no individual values
          const apiTotal = tokens.total || tokens.total_tokens;
          setText(d.totalTokens, apiTotal ? Math.round(apiTotal) : "-");
        }

        setText(d.responseLength, r.text ? `${r.text.length} chars` : "-");

        // Use Phase 2A timing if available
        if (this.lastElapsedTime) {
          setText(
            d.processingTime,
            this.formatElapsedTime(this.lastElapsedTime),
          );
        } else if (r.metadata?.processingTime) {
          setText(d.processingTime, `${r.metadata.processingTime}ms`);
        }

        setText(d.cost, data.estimatedCost || "Not available");
      }
      // Context applied
      setText(d.subject, this.elements.subject?.value || "Not specified");
      setText(d.topic, this.elements.topic?.value || "Not specified");
      setText(d.objective, this.elements.objective?.value || "Not specified");
      setText(d.module, this.elements.module?.value || "Not specified");

      // Description style — always Detailed (Phase 2D)
      setText(d.style, "Detailed");

      // Audience level
      const audienceSelect = this.elements.audience;
      if (audienceSelect) {
        const selectedOption = audienceSelect.options[audienceSelect.selectedIndex];
        setText(d.audience, selectedOption?.textContent || "Not specified");
      } else {
        setText(d.audience, "Not specified");
      }

      // Checkbox options
      const checkboxes = this.elements.checkboxOptions?.querySelectorAll(
        'input[type="checkbox"]:checked',
      );
      if (checkboxes && checkboxes.length > 0) {
        const labels = Array.from(checkboxes).map(
          (cb) => cb.nextElementSibling?.textContent || cb.value,
        );
        setText(d.checkboxes, labels.join(", "));
      } else {
        setText(d.checkboxes, "None selected");
      }

      // Full prompts
      if (data.systemPrompt) {
        setText(d.systemPrompt, data.systemPrompt);
        setText(d.systemCharCount, data.systemPrompt.length);
      }

      if (data.userPrompt) {
        setText(d.userPrompt, data.userPrompt);
        setText(d.userCharCount, data.userPrompt.length);
      }

      // Pre-analysis details (Local Analysis)
      // Always show selected profile regardless of analysis results
      setText(d.analysisProfile, this.getSelectedProfile());

      if (this.lastAnalysis) {
        const analysis = this.lastAnalysis;

        // Show the profile that was actually used for this analysis
        if (analysis.profile) {
          setText(d.analysisProfile, analysis.profile);
        }

        // OCR labels summary
        if (analysis.ocr && analysis.ocr.status === "complete") {
          const labelCount = analysis.ocr.labelCount || 0;
          if (labelCount > 0) {
            const labels = analysis.ocr.items
              .map((i) => `"${i.text}" (${i.quadrant})`)
              .join(", ");
            setText(d.ocrLabels, `${labelCount} labels: ${labels}`);
          } else {
            setText(d.ocrLabels, "No labels detected");
          }
          setText(
            d.ocrTime,
            analysis.ocr.duration ? `${analysis.ocr.duration}ms` : "-",
          );

          // Noise suppression stats (Phase 4D)
          if (analysis.ocr.suppressionStats) {
            const ss = analysis.ocr.suppressionStats;
            const reasonParts = Object.entries(ss.reasons)
              .map(([reason, count]) => `${count} ${reason}`)
              .join(", ");
            setText(
              d.noiseSuppression,
              `${ss.suppressed} of ${ss.total} suppressed` +
                (reasonParts ? ` (${reasonParts})` : ""),
            );
          } else {
            setText(d.noiseSuppression, "Not applied");
          }
        } else if (analysis.ocr) {
          setText(d.ocrLabels, `OCR ${analysis.ocr.status}`);
          setText(d.ocrTime, "-");
          setText(d.noiseSuppression, "-");
        }

        // Colour analysis summary
        if (analysis.colour && analysis.colour.status === "complete") {
          const regionCount = analysis.colour.regions?.length || 0;
          const gradient = analysis.colour.gradientDirection || "none";
          const paletteStr = analysis.colour.palette
            ?.map((p) => `${p.colourName}(${Math.round(p.percentage * 100)}%)`)
            .join(", ");
          setText(
            d.colourAnalysis,
            `${regionCount} regions, gradient: ${gradient}` +
              (paletteStr ? `, palette: ${paletteStr}` : ""),
          );
        } else if (analysis.colour) {
          setText(d.colourAnalysis, `Colour ${analysis.colour.status}`);
        }

        // Total analysis time
        setText(
          d.analysisTime,
          analysis.totalDuration ? `${analysis.totalDuration}ms` : "-",
        );

        // Classification (Phase 5A)
        if (d.classification) {
          if (analysis.classification?.profile) {
            const c = analysis.classification;
            setText(
              d.classification,
              `${c.profile} (${Math.round(c.confidence * 100)}%, ${c.source})`,
            );
          } else if (analysis.classification === null) {
            setText(d.classification, "No suggestion");
          } else {
            setText(d.classification, "-");
          }
        }

        // CLIP detail (Phase 5B-2)
        if (d.clip) {
          const clipData = analysis.classification?.clip;
          if (clipData && clipData.status === "success") {
            setText(
              d.clip,
              `${clipData.topLabel} (${Math.round(clipData.topConfidence * 100)}%)`,
            );
          } else {
            setText(d.clip, clipData ? clipData.status : "Not run");
          }
        }
      } else {
        setText(d.ocrLabels, "Not run");
        setText(d.ocrTime, "-");
        setText(d.noiseSuppression, "-");
        setText(d.colourAnalysis, "Not run");
        setText(d.analysisTime, "-");
        setText(d.classification, "-");
        if (d.clip) setText(d.clip, "-");
      }

      logDebug("Debug panel updated");
    },

    /**
     * Clear debug panel (Phase 2C)
     */
    clearDebugPanel() {
      if (!this.elements.debugElements) return;

      const d = this.elements.debugElements;

      // Reset all fields to '-'
      Object.values(d).forEach((el) => {
        if (el && el.textContent !== undefined) {
          el.textContent = "-";
        }
      });

      // Reset character counts
      if (d.systemCharCount) d.systemCharCount.textContent = "0";
      if (d.userCharCount) d.userCharCount.textContent = "0";

      logDebug("Debug panel cleared");
    },

    /**
     * Copy debug content to clipboard (Phase 2C)
     * @param {HTMLElement} targetElement - Element containing text to copy
     * @param {HTMLButtonElement} button - Button that was clicked
     */
    async copyDebugContent(targetElement, button) {
      if (!targetElement) return;

      try {
        const text = targetElement.textContent;
        await navigator.clipboard.writeText(text);

        // Show success feedback
        const originalText = button.innerHTML;
        button.innerHTML = '<span aria-hidden="true">✓</span> Copied!';

        setTimeout(() => {
          button.innerHTML = originalText;
        }, 2000);

        logInfo("Debug content copied to clipboard");
      } catch (error) {
        logError("Failed to copy debug content:", error);
        if (window.notifyError) {
          window.notifyError("Failed to copy debug content");
        }
      }
    },

    // ========================================================================
    // LIBRARY STATUS (Phase 4B)
    // ========================================================================

    /**
     * Update the status of a registered library in the expert panel.
     * Generic method — works for any library with a matching DOM element.
     *
     * @param {string} libraryId — matches data-library attribute (e.g. "tesseract")
     * @param {string} status — one of: "not-loaded", "loading", "ready", "error"
     * @param {object} [options]
     * @param {string} [options.statusText] — override the default status text
     * @param {string} [options.hint] — detail/hint text (e.g. timing, error message)
     */
    updateLibraryStatus(libraryId, status, options = {}) {
      // Phase 10C-fix: Library Status merged into Model Manager.
      // Target Model Manager elements instead. Silently ignore
      // "transformers" — it's infrastructure, not a user-facing model.
      if (libraryId.startsWith('transformers')) {
        logDebug('Ignoring transformers library status (infrastructure, no UI row)');
        return;
      }
      const item = document.getElementById(`imgdesc-mm-model-${libraryId}`);
      if (!item) {
        logDebug(`Model Manager element not found: imgdesc-mm-model-${libraryId}`);
        return;
      }

      // Update data-status attribute (drives CSS state styling)
      item.dataset.status = status;

      // Update status text in Model Manager row
      const statusTextEl = item.querySelector(".imgdesc-mm-state-text");
      if (statusTextEl) {
        statusTextEl.textContent =
          options.statusText || this.getDefaultStatusText(status);
      }

      logDebug(`Library ${libraryId} status → ${status}`, options);
    },

    /**
     * Get default status display text for a given state.
     * @param {string} status — one of the four status values
     * @returns {string}
     */
    getDefaultStatusText(status) {
      const texts = {
        "not-loaded": "Not loaded",
        loading: "Loading\u2026",
        ready: "Ready",
        error: "Error",
      };
      return texts[status] || status;
    },

    // getDefaultHint() removed — Phase 10C-fix merged Library Status into Model Manager

  };

  // ============================================================================
  // MIX INTO CONTROLLER
  // ============================================================================

  if (window.ImageDescriberController) {
    Object.assign(window.ImageDescriberController, methods);
    logInfo("Debug and library status methods loaded");

  } else {
    logError(
      "ImageDescriberController not found \u2014 debug methods not loaded",
    );
  }
})();
