/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER ANALYSER — PROMPT FORMATTING
 * ═══════════════════════════════════════════════════════════════
 *
 * Formats analysis results into structured prompt text:
 *   - formatForPrompt() — full analysis to prompt section
 *   - formatOCRForPrompt() — OCR labels with positions and colours
 *   - formatColourForPrompt() — colour regions, gradient, palette
 *   - confidenceWord() — numeric confidence → human-readable
 *   - luminanceDescriptor() — numeric luminance → human-readable
 *
 * Depends on: window.ImageDescriberAnalyserUtils
 *
 * VERSION: 2.3.0
 * DATE: 29 March 2026
 * PHASE: Local Analysis — Phase 13D (FastVLM local prompt formatting), null-confidence fix
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
      console.error(`[AnalyserFormat] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AnalyserFormat] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AnalyserFormat] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AnalyserFormat] ${message}`, ...args);
  }

  // ============================================================================
  // DEPENDENCY REFERENCES
  // ============================================================================

  /** Shorthand reference to utils — resolved at call time, not load time */
  function utils() {
    return window.ImageDescriberAnalyserUtils;
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Maps a confidence value (0–1) to a human-readable word.
   */
  function confidenceWord(confidence) {
    if (confidence === null || confidence === undefined) return "unscored";
    if (confidence >= 0.8) return "high confidence";
    if (confidence >= 0.5) return "moderate confidence";
    return "low confidence";
  }

  /**
   * Maps a luminance value (0–1) to a human-readable descriptor.
   */
  function luminanceDescriptor(luminance) {
    if (luminance <= 0.2) return "very dark";
    if (luminance <= 0.4) return "dark";
    if (luminance <= 0.6) return "medium";
    if (luminance <= 0.8) return "light";
    return "very light";
  }

  // ============================================================================
  // OCR FORMATTING
  // ============================================================================

  /**
   * Formats the OCR section of the prompt.
   * Returns empty string if nothing meaningful to report.
   */
  function formatOCRForPrompt(ocr, confidenceThreshold) {
    const u = utils();
    if (
      !ocr ||
      ocr.status !== "complete" ||
      !ocr.items ||
      ocr.items.length === 0
    ) {
      return "";
    }

    const threshold = confidenceThreshold || u.DEFAULT_CONFIDENCE_THRESHOLD;
    const included = ocr.items.filter(
      (i) => i.confidence === null || i.confidence >= threshold,
    );
    const excluded = ocr.items.length - included.length;

    if (included.length === 0 && excluded === 0) return "";
    if (included.length === 0) {
      // All detections were low-confidence
      return `### Text labels detected (OCR)\n${excluded} low-confidence detection${excluded !== 1 ? "s were" : " was"} excluded.\n`;
    }

    let text = "### Text labels detected (OCR)\n";

    included.forEach((item) => {
      let line = `- "${item.text}" \u2014 ${item.quadrant} (${confidenceWord(item.confidence)})`;

      if (item.nearbyColour) {
        line += `, within a ${item.nearbyColour.colourName} region`;
      }

      if (item.orientation && item.orientation !== "horizontal") {
        const orientLabel =
          item.orientation === "vertical-up"
            ? "vertical, reads upward"
            : "vertical, reads downward";
        line += `, ${orientLabel}`;
      }

      text += line + "\n";
    });

    if (excluded > 0) {
      text += `${excluded} additional low-confidence detection${excluded !== 1 ? "s were" : " was"} excluded.\n`;
    }

    return text;
  }

  // ============================================================================
  // COLOUR FORMATTING
  // ============================================================================

  /**
   * Formats the colour section of the prompt.
   * Returns empty string if nothing meaningful to report.
   */
  function formatColourForPrompt(colour) {
    if (
      !colour ||
      colour.status !== "complete" ||
      !colour.regions ||
      colour.regions.length === 0
    ) {
      return "";
    }

    let text = "### Colour and tonal distribution\n";

    colour.regions.forEach((region) => {
      const desc = luminanceDescriptor(region.avgLuminance);
      const pct = Math.round(region.avgLuminance * 100);
      text += `- ${region.label}: ${desc} (luminance ${pct}%), predominantly ${region.colourName}\n`;
    });

    // Gradient direction
    if (colour.gradientDirection && colour.gradientDirection !== "uniform") {
      let gradientDesc = colour.gradientDirection;
      // Add natural language clarification
      if (gradientDesc === "top-to-bottom") {
        gradientDesc += " (lighter at top, darker at bottom)";
      } else if (gradientDesc === "bottom-to-top") {
        gradientDesc += " (darker at top, lighter at bottom)";
      } else if (gradientDesc === "left-to-right") {
        gradientDesc += " (lighter at left, darker at right)";
      } else if (gradientDesc === "right-to-left") {
        gradientDesc += " (darker at left, lighter at right)";
      }
      text += `- Gradient direction: ${gradientDesc}\n`;
    }

    // Palette
    if (colour.palette && colour.palette.length > 0) {
      const paletteStr = colour.palette
        .map((p) => `${p.colourName} (${Math.round(p.percentage * 100)}%)`)
        .join(", ");
      text += `- Dominant palette: ${paletteStr}\n`;
    }

    return text;
  }

  // ============================================================================
  // CLASSIFICATION FORMATTING (Phase 5B-2)
  // ============================================================================

  /**
   * Formats classification data into a prompt section.
   * Used to give the LLM context about what type of image this is.
   *
   * @param {object} classification — ClassificationResult from classify module
   * @returns {string} formatted prompt text, or empty string if no classification
   */
  function formatClassificationForPrompt(classification) {
    if (!classification || !classification.profile) return "";

    const parts = [];
    parts.push("### Image Classification (automated pre-analysis)");

    const pct = Math.round((classification.confidence || 0) * 100);
    parts.push(
      `This image has been automatically classified as a **${classification.profile}** (${pct}% confidence, source: ${classification.source}).`,
    );

    // Add CLIP detail if available
    if (classification.clip && classification.clip.status === "success") {
      const clipPct = Math.round(classification.clip.topConfidence * 100);
      parts.push(
        `CLIP model identified it as "${classification.clip.topLabel}" (${clipPct}% confidence).`,
      );

      // Include top 3 alternative labels for context
      if (classification.clip.labels && classification.clip.labels.length > 1) {
        const alts = classification.clip.labels
          .slice(1, 4)
          .map((l) => `${l.label} (${Math.round(l.score * 100)}%)`)
          .join(", ");
        parts.push(`Other possibilities: ${alts}.`);
      }
    }

    parts.push(
      "Use this classification to inform your description approach, but verify it against what you see in the image.",
    );

    return parts.join("\n");
  }

  // ============================================================================
  // OBJECT DETECTION FORMATTING (Phase 8A)
  // ============================================================================

  /**
   * Formats object detection data into a prompt section.
   * Tells the LLM what objects were detected and where.
   *
   * @param {object} objects — ObjectDetectionResult from the gateway
   * @returns {string} formatted prompt text, or empty string if no objects
   */
  function formatObjectsForPrompt(objects) {
    if (
      !objects ||
      objects.status !== "complete" ||
      !objects.items ||
      objects.items.length === 0
    ) {
      return "";
    }

    const parts = [];
    parts.push("### Detected objects (automated pre-analysis)");

    objects.items.forEach(function (item) {
      const pct = Math.round(item.confidence * 100);
      const position = describePosition(item.bounds);
      parts.push(`- ${item.label} (${pct}% confidence) \u2014 ${position}`);
    });

    parts.push(
      "Use these detected objects to inform your description, but verify them against what you see in the image.",
    );

    return parts.join("\n");
  }

  /**
   * Describes a position from normalised bounds { x, y, w, h }.
   * @param {object} bounds — { x, y, w, h } normalised 0–1
   * @returns {string}
   */
  function describePosition(bounds) {
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    const vertical = cy < 0.33 ? "top" : cy > 0.67 ? "bottom" : "centre";
    const horizontal = cx < 0.33 ? "left" : cx > 0.67 ? "right" : "centre";
    if (vertical === "centre" && horizontal === "centre") return "centre area";
    if (vertical === "centre") return horizontal + " area";
    if (horizontal === "centre") return vertical + " area";
    return vertical + "-" + horizontal + " area";
  }

  // ============================================================================
  // FLORENCE-2 FORMATTING (Phase 10B)
  // ============================================================================

  /**
   * Formats a Florence-2 caption result into a prompt section.
   * @param {object} florenceCaption — result from generateCaption()
   *   { text: string, task: string, status: "complete"|"error", duration: number }
   * @returns {string} formatted prompt text, or empty string if nothing to report
   */
  function formatFlorence2CaptionForPrompt(florenceCaption) {
    if (
      !florenceCaption ||
      florenceCaption.status !== "complete" ||
      !florenceCaption.text
    ) {
      return "";
    }

    const text = florenceCaption.text.trim();
    if (!text) return "";

    const parts = [];
    parts.push("### AI caption (Florence-2 pre-analysis)");
    parts.push(text);
    parts.push(
      "Use this caption as additional context for your description, but verify it against what you see in the image.",
    );

    return parts.join("\n");
  }

  /**
   * Formats Florence-2 object detection results into a prompt section.
   * Bounds are pixel coordinates; imageWidth/imageHeight are used to
   * derive human-readable position descriptions.
   *
   * @param {object} florenceObjects — result from detectObjects()
   *   { items: [{ label: string, bounds: {x1,y1,x2,y2}, confidence: null }],
   *     status: "complete"|"error", duration: number }
   * @param {number} [imageWidth] — image pixel width for position calculation
   * @param {number} [imageHeight] — image pixel height for position calculation
   * @returns {string} formatted prompt text, or empty string if nothing to report
   */
  function formatFlorence2ObjectsForPrompt(
    florenceObjects,
    imageWidth,
    imageHeight,
  ) {
    if (
      !florenceObjects ||
      florenceObjects.status !== "complete" ||
      !florenceObjects.items ||
      florenceObjects.items.length === 0
    ) {
      return "";
    }

    const parts = [];
    parts.push("### Objects detected by Florence-2 (pre-analysis)");

    florenceObjects.items.forEach(function (item) {
      let position = "";
      if (imageWidth && imageHeight && item.bounds) {
        const cx = (item.bounds.x1 + item.bounds.x2) / 2 / imageWidth;
        const cy = (item.bounds.y1 + item.bounds.y2) / 2 / imageHeight;
        const vertical = cy < 0.33 ? "top" : cy > 0.67 ? "bottom" : "centre";
        const horizontal = cx < 0.33 ? "left" : cx > 0.67 ? "right" : "centre";
        if (vertical === "centre" && horizontal === "centre") {
          position = " \u2014 centre area";
        } else if (vertical === "centre") {
          position = " \u2014 " + horizontal + " area";
        } else if (horizontal === "centre") {
          position = " \u2014 " + vertical + " area";
        } else {
          position = " \u2014 " + vertical + "-" + horizontal + " area";
        }
      }
      parts.push("- " + item.label + position);
    });

    parts.push(
      "Use these detected objects to inform your description, but verify them against what you see in the image.",
    );

    return parts.join("\n");
  }

  /**
   * Formats Florence-2 OCR results into a prompt section.
   * Intended for Phase 10D (OCR merge); included here so format module
   * is complete when the orchestrator starts passing florenceOCR data.
   *
   * @param {object} florenceOCR — result from extractOCR()
   *   { items: [{ text: string, quadBox: [x1,y1,x2,y2,x3,y3,x4,y4] }],
   *     status: "complete"|"error", duration: number }
   * @returns {string} formatted prompt text, or empty string if nothing to report
   */
  function formatFlorence2OCRForPrompt(florenceOCR) {
    if (
      !florenceOCR ||
      florenceOCR.status !== "complete" ||
      !florenceOCR.items ||
      florenceOCR.items.length === 0
    ) {
      return "";
    }

    const parts = [];
    parts.push("### Additional text detected by Florence-2 OCR (pre-analysis)");

    florenceOCR.items.forEach(function (item) {
      if (item.text && item.text.trim()) {
        parts.push("- \u201c" + item.text.trim() + "\u201d");
      }
    });

    // If all items had empty text, nothing useful to add
    if (parts.length === 1) return "";

    parts.push(
      "These text regions may supplement the Tesseract OCR results above.",
    );

    return parts.join("\n");
  }

  // ============================================================================
  // DEPTH FORMATTING (Phase 11A)
  // ============================================================================

  /**
   * Human-readable labels for depth zones.
   */
  const DEPTH_ZONE_LABELS = {
    foreground: "Foreground (closest",
    midground: "Midground (intermediate",
    background: "Background (farthest",
  };

  /**
   * Formats depth estimation data into a prompt section.
   * Returns empty string if depth data is absent, errored, skipped,
   * or shows no significant depth variation.
   *
   * @param {object} depth — depth estimation result from estimateDepth()
   * @returns {string} formatted prompt text, or empty string
   */
  function formatDepthForPrompt(depth) {
    if (!depth || depth.status !== "success" || !depth.hasSignificantDepth) {
      return "";
    }

    if (!depth.zones) return "";

    const parts = [];
    parts.push("### Depth analysis (pre-analysis)");
    parts.push("This image contains distinct depth layers:");

    const zoneNames = ["foreground", "midground", "background"];
    let significantZoneCount = 0;

    zoneNames.forEach(function (name) {
      const zone = depth.zones[name];
      if (!zone || zone.areaPercent < 5) return;

      significantZoneCount++;
      const label = DEPTH_ZONE_LABELS[name];
      let line = "- " + label + ", " + zone.areaPercent + "% of image area)";

      if (zone.dominantQuadrants && zone.dominantQuadrants.length > 0) {
        line += ": concentrated in " + zone.dominantQuadrants.join(", ");
      }

      parts.push(line);
    });

    if (significantZoneCount <= 1) {
      parts.push("This image has minimal depth variation.");
    }

    return parts.join("\n");
  }

  // ============================================================================
  // FULL PROMPT FORMATTING
  // ============================================================================

  /**
   * Formats an ImageAnalysisResult into prompt text.
   * Returns an empty string if no analysers produced usable results.
   *
   * @param {object} analysis — ImageAnalysisResult
   * @param {object} [config] — optional { confidenceThreshold }
   * @returns {string}
   */
  function formatForPrompt(analysis, config) {
    if (!analysis) return "";

    const u = utils();
    const threshold =
      (config && config.confidenceThreshold) || u.DEFAULT_CONFIDENCE_THRESHOLD;

    const ocrText = formatOCRForPrompt(analysis.ocr, threshold);
    const colourText = formatColourForPrompt(analysis.colour);

    // Florence-2 context (Phase 10B)
    const imgW = analysis.source && analysis.source.width;
    const imgH = analysis.source && analysis.source.height;
    const florenceCaptionText = formatFlorence2CaptionForPrompt(
      analysis.florenceCaption,
    );
    const florenceObjectsText = formatFlorence2ObjectsForPrompt(
      analysis.florenceObjects,
      imgW,
      imgH,
    );
    // Suppress separate Florence-2 OCR section if items are already merged into main OCR
    const florenceMerged =
      analysis.ocr &&
      analysis.ocr.items &&
      analysis.ocr.items.some(function (item) {
        return item.source === "florence2";
      });
    const florenceOCRText = florenceMerged
      ? ""
      : formatFlorence2OCRForPrompt(analysis.florenceOCR);

    // Depth estimation context (Phase 11A)
    const depthText = formatDepthForPrompt(analysis.depth);

    // If no analyser produced any output, return empty
    if (
      !ocrText &&
      !colourText &&
      !depthText &&
      !florenceCaptionText &&
      !florenceObjectsText &&
      !florenceOCRText
    ) {
      return "";
    }

    let prompt =
      "## Machine pre-analysis data\n\n" +
      "The following positions and colours were extracted from the image by OCR\n" +
      "and pixel analysis before you received it. Treat this data as accurate\n" +
      "unless you can see clear evidence that it is wrong. Specifically:\n" +
      "- Use the OCR label positions below when describing where labels appear.\n" +
      "- Use the colour data below when describing regional colours and tones.\n" +
      "- If your visual impression contradicts this data, re-examine the image\n" +
      "  before defaulting to your initial interpretation.\n\n";

    if (ocrText) prompt += ocrText + "\n";
    if (colourText) prompt += colourText + "\n";

    // Classification context (Phase 5B-2)
    if (analysis.classification) {
      const classText = formatClassificationForPrompt(analysis.classification);
      if (classText) {
        prompt += "\n" + classText + "\n";
      }
    }

    // Depth estimation context (Phase 11A)
    if (depthText) prompt += "\n" + depthText + "\n";

    // Object detection context (Phase 8A — OWL-ViT legacy, may be unused)
    if (analysis.objects) {
      const objectsText = formatObjectsForPrompt(analysis.objects);
      if (objectsText) {
        prompt += "\n" + objectsText + "\n";
      }
    }

    // Florence-2 context (Phase 10B)
    if (florenceCaptionText) prompt += "\n" + florenceCaptionText + "\n";
    if (florenceObjectsText) prompt += "\n" + florenceObjectsText + "\n";
    if (florenceOCRText) prompt += "\n" + florenceOCRText + "\n";

    return prompt.trimEnd() + "\n";
  }

  // ============================================================================
  // LOCAL PROMPT FORMATTING (Phase 13D)
  // ============================================================================

  /**
   * Formats analysis data as concise plain text for local VLM generation.
   * Unlike formatForPrompt() (which produces verbose markdown for cloud models),
   * this outputs minimal factual context targeting ~50–150 tokens.
   *
   * NOTE (Phase 13F): Currently unused. Empirical testing showed FastVLM 0.5B
   * parrots this data rather than using it as context. Preserved for the
   * hybrid pipeline (future exploration) and for potential use with larger
   * local models (e.g. Qwen3.5-0.8B).
   *
   * @param {object} analysis — ImageAnalysisResult (same structure as formatForPrompt)
   * @returns {string} concise plain text, or empty string if no analysis available
   */
  function formatForLocalPrompt(analysis) {
    if (!analysis) return "";

    const u = utils();
    const threshold = u.DEFAULT_CONFIDENCE_THRESHOLD;
    const lines = [];

    // CLIP classification
    if (analysis.classification && analysis.classification.profile) {
      const cls = analysis.classification;
      const pct = Math.round((cls.confidence || 0) * 100);
      let line = "- Image type: " + cls.profile + " (" + pct + "% confidence)";
      // Include CLIP topLabel if available and different from profile
      if (
        cls.clip &&
        cls.clip.topLabel &&
        cls.clip.topLabel.toLowerCase() !== cls.profile.toLowerCase()
      ) {
        line += ' (CLIP: "' + cls.clip.topLabel + '")';
      }
      lines.push(line);
    }

    // OCR text
    if (
      analysis.ocr &&
      analysis.ocr.status === "complete" &&
      analysis.ocr.items &&
      analysis.ocr.items.length > 0
    ) {
      const seen = new Set();
      const texts = [];
      for (let i = 0; i < analysis.ocr.items.length; i++) {
        const item = analysis.ocr.items[i];
        if (item.confidence !== null && item.confidence < threshold) continue;
        let text = (item.text || "").trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        // Truncate long items
        if (text.length > 40) {
          text = text.substring(0, 37) + "...";
        }
        texts.push('"' + text + '"');
        if (texts.length >= 8) break;
      }
      if (texts.length > 0) {
        lines.push("- Visible text: " + texts.join(", "));
      }
    }

    // Colour palette
    if (
      analysis.colour &&
      analysis.colour.status === "complete" &&
      analysis.colour.palette &&
      analysis.colour.palette.length > 0
    ) {
      const colourNames = [];
      const max = Math.min(analysis.colour.palette.length, 5);
      for (let c = 0; c < max; c++) {
        const entry = analysis.colour.palette[c];
        if (entry.colourName) {
          colourNames.push(entry.colourName);
        }
      }
      if (colourNames.length > 0) {
        lines.push("- Main colours: " + colourNames.join(", "));
      }
    }

    // Depth zones
    if (
      analysis.depth &&
      analysis.depth.status === "success" &&
      analysis.depth.hasSignificantDepth
    ) {
      const zones = analysis.depth.zones || analysis.depth.depthZones;
      if (zones && zones.length > 0) {
        const zoneParts = [];
        for (let z = 0; z < zones.length; z++) {
          const zone = zones[z];
          const areaPct = zone.areaPercent || zone.area || 0;
          if (areaPct >= 10) {
            zoneParts.push(
              (zone.label || zone.name || "zone") +
                " (" +
                Math.round(areaPct) +
                "%)",
            );
          }
        }
        if (zoneParts.length > 0) {
          lines.push("- Depth: " + zoneParts.join(", "));
        }
      }
    }

    // Florence-2 caption
    if (
      analysis.florenceCaption &&
      analysis.florenceCaption.status === "complete" &&
      analysis.florenceCaption.text
    ) {
      let caption = analysis.florenceCaption.text.trim();
      if (caption.length > 100) {
        caption = caption.substring(0, 97) + "...";
      }
      if (caption) {
        lines.push("- Caption: " + caption);
      }
    }

    if (lines.length === 0) return "";

    return "Pre-analysis context:\n" + lines.join("\n");
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ImageDescriberAnalyserFormat = {
    confidenceWord,
    luminanceDescriptor,
    formatOCRForPrompt,
    formatColourForPrompt,
    formatClassificationForPrompt,
    formatObjectsForPrompt,
    formatDepthForPrompt,
    formatFlorence2CaptionForPrompt,
    formatFlorence2ObjectsForPrompt,
    formatFlorence2OCRForPrompt,
    formatForPrompt,
    formatForLocalPrompt,
  };

  logInfo("Analyser prompt formatter loaded");
})();
