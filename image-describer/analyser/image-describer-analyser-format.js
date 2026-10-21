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

  // How the prompt says text detection ended, for each OCR status that is not a result.
  const OCR_UNFINISHED_WORDING = Object.freeze({
    "timed-out": "did not finish",
    failed: "could not run",
    // Generate went ahead on the quick result, before text detection ended (H-36).
    // Set on a copy by the controller, never on a stored analysis.
    "not-finished": "had not finished when this description was requested",
  });

  // A label line as formatOCRForPrompt prints it: `- "text" — position (confidence)`.
  const OCR_LABEL_LINE = /^- "/m;

  // The heading of the text section, in the three places it is built (H-64; wording chosen after H-65).
  const OCR_HEADING = "### OCR results";

  // R3(0.9) from H-63: an item is a fragment at this many trimmed characters or fewer, and the
  // text section is left out when at least this share of the listed items are fragments.
  const FRAGMENT_MAX_CHARS = 2;
  const FRAGMENT_SHARE_THRESHOLD = 0.9;

  /** True when at least FRAGMENT_SHARE_THRESHOLD of the items are fragments. Counts as h63-rules.mjs does. */
  function isMostlyFragments(items) {
    if (!items.length) return false;
    const fragments = items.filter(
      (i) => String(i.text).trim().length <= FRAGMENT_MAX_CHARS,
    ).length;
    return fragments / items.length >= FRAGMENT_SHARE_THRESHOLD;
  }

  /**
   * Formats the OCR section of the prompt.
   * Returns empty string if nothing meaningful to report.
   */
  function formatOCRForPrompt(ocr, confidenceThreshold, options = {}) {
    const u = utils();
    // Text detection ran and did not return (H-31). Without this the model
    // cannot tell "no text in the picture" from "text detection failed".
    if (ocr && OCR_UNFINISHED_WORDING[ocr.status]) {
      return (
        `${OCR_HEADING}\n` +
        `Text detection ${OCR_UNFINISHED_WORDING[ocr.status]}, so text in the image is not listed here. Read any text directly from the image.\n`
      );
    }
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
      return `${OCR_HEADING}\n${excluded} low-confidence detection${excluded !== 1 ? "s were" : " was"} excluded.\n`;
    }

    // Left out whole when nearly every item is a one- or two-character fragment (H-64, rule
    // R3(0.9) from H-63): text detection returns such fragments on a picture with no text.
    // Never applied once a person has corrected or added text: their choice beats a heuristic.
    if (!options.hasCorrections && isMostlyFragments(included)) {
      logDebug(
        `Text section left out: ${included.length} item(s), at least ${FRAGMENT_SHARE_THRESHOLD * 100}% of ${FRAGMENT_MAX_CHARS} characters or fewer`,
      );
      return "";
    }

    let text = `${OCR_HEADING}\n`;

    included.forEach((item) => {
      // The position is one of nine thirds words taken from the label's own box (H-7c
      // measured it against the five-word quadrant; H-7d confirmed the shipped boxes give
      // the right word). An item with no usable box keeps the quadrant word it printed before.
      // An item with neither box nor quadrant has no position to print (H-39); the line
      // then carries no dash and no word, rather than the text "undefined".
      const position = u.getItemPositionWord(item) || item.quadrant;
      const positionPart = position ? ` \u2014 ${position}` : "";
      let line = `- "${item.text}"${positionPart} (${confidenceWord(item.confidence)})`;

      // WITHHELD at Stage F-iii, and deliberately not reworded. `nearbyColour` is
      // sampled from a ring around the label's own bounding box, so it names whatever
      // the label floats over — measured right for 6 of 6 labels printed on their
      // subject and 0 of 22 joined to it by a leader line. The word "nearby" was
      // dropped at the point the data became prose, which turned a true statement
      // about the label into a false one about the thing it names.
      //
      // A rewording would have cured 18 of those 22 and could not touch the naming
      // fault above, so a reworded clause would still have carried names that were
      // wrong for a second, independent reason. `sampleNearbyColour` and the
      // `nearbyColour` field are left in place: they are correct code doing what
      // their names say, and the fault was the sentence. KB § 9.44.

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
   * Smallest share, in whole per cent, that a colour needs to be written out in a
   * palette list a reader sees. Phase H-54 (12 October 2026), after H-53 measured
   * that dropping the 1% slots cost nothing the scoring rule could detect.
   */
  const PALETTE_DISPLAY_MIN_PERCENT = 3;

  /**
   * Tidies the analyser's palette for display: entries sharing a colour name are
   * joined (raw shares added), entries whose joined share rounds to under
   * PALETTE_DISPLAY_MIN_PERCENT are left out, and the rest are ordered largest
   * first (ties keep first-appearance order). Returns a NEW array of new objects;
   * the analyser's own palette is never changed.
   *
   * Phase H-54. Used by every list a reader sees; the debug panel reads the raw
   * palette on purpose.
   *
   * @param {Array<{colourName: string, percentage: number}>} palette
   * @returns {Array<object>} tidied copy (empty if the input is not a usable array)
   */
  function tidyPaletteForDisplay(palette) {
    if (!Array.isArray(palette)) return [];

    const groups = new Map();
    palette.forEach((entry) => {
      const share = (entry && entry.percentage) || 0;
      const existing = groups.get(entry && entry.colourName);
      if (existing) {
        existing.percentage += share;
        return;
      }
      groups.set(entry && entry.colourName, { ...entry, percentage: share });
    });

    return Array.from(groups.values())
      .filter((e) => Math.round(e.percentage * 100) >= PALETTE_DISPLAY_MIN_PERCENT)
      .sort((a, b) => b.percentage - a.percentage);
  }

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
    const tidyPalette = tidyPaletteForDisplay(colour.palette);
    if (tidyPalette.length > 0) {
      const paletteStr = tidyPalette
        .map((p) => `${p.colourName} (${Math.round(p.percentage * 100)}%)`)
        .join(", ");
      text += `- Dominant palette: ${paletteStr}\n`;
    }

    return text;
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
  // FULL PROMPT FORMATTING
  // ============================================================================

  /**
   * Formats an ImageAnalysisResult into prompt text.
   * Returns an empty string if no analysers produced usable results.
   *
   * @param {object} analysis — ImageAnalysisResult
   * @param {object} [config] — optional { confidenceThreshold, hasCorrections, includeColour }
   *   includeColour defaults to true; false leaves out the colour section and every sentence about it (H-78).
   * @returns {string}
   */
  function formatForPrompt(analysis, config) {
    if (!analysis) return "";

    const u = utils();
    const threshold =
      (config && config.confidenceThreshold) || u.DEFAULT_CONFIDENCE_THRESHOLD;

    const ocrText = formatOCRForPrompt(analysis.ocr, threshold, {
      hasCorrections: !!(config && config.hasCorrections),
    });
    // H-78: the colour analysis follows the "Include colour descriptions" box.
    // Absent option = include, so every caller that does not pass it is unchanged.
    const includeColour = !config || config.includeColour !== false;
    const colourText = includeColour ? formatColourForPrompt(analysis.colour) : "";

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
    // The merge (mergeTesseractAndFlorence) always runs when both OCR passes
    // complete, and dedups Florence items that overlap Tesseract ones. So once
    // it has run, every non-duplicate Florence item is already in ocr.items and
    // this section can only repeat — or, after review-mode corrections,
    // contradict — the main list. Emit it only when the merge never happened,
    // i.e. Tesseract OCR was skipped or failed and this is Florence's only surface.
    //
    // This replaces a heuristic that asked whether any item with
    // source === "florence2" survived into the main list. That reads FALSE
    // exactly when dedup worked best — Florence found the same labels
    // Tesseract did, so nothing Florence-sourced survived — and the raw text
    // was printed anyway, beside the human-corrected version of itself.
    const florenceMergeApplied = !!(
      analysis.ocr && analysis.ocr.florenceMergeApplied
    );
    const florenceOCRText = florenceMergeApplied
      ? ""
      : formatFlorence2OCRForPrompt(analysis.florenceOCR);

    // If no analyser produced any output, return empty
    if (
      !ocrText &&
      !colourText &&
      !florenceCaptionText &&
      !florenceObjectsText &&
      !florenceOCRText
    ) {
      return "";
    }

    // Box off: the preamble says nothing about colour, because the data it
    // would point at is not sent (H-78).
    const preambleIntro = includeColour
      ? "The following positions and colours were extracted from the image by OCR\n" +
        "and pixel analysis before you received it. Treat the colour data as accurate\n" +
        "unless you can see clear evidence that it is wrong. Specifically:\n"
      : "The following positions were extracted from the image by OCR before you received it. Specifically:\n";
    const colourInstruction = includeColour
      ? "- Use the colour data below when describing regional colours and tones.\n"
      : "";

    let prompt =
      "## Machine pre-analysis data\n\n" +
      preambleIntro +
      (OCR_LABEL_LINE.test(ocrText)
        ? "- Use the OCR label positions below when describing where labels appear.\n"
        : "") +
      colourInstruction +
      "- If your visual impression contradicts this data, re-examine the image\n" +
      "  before defaulting to your initial interpretation.\n\n";

    if (ocrText) prompt += ocrText + "\n";
    if (colourText) prompt += colourText + "\n";

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
  function formatForLocalPrompt(analysis, config) {
    if (!analysis) return "";

    // H-78: the colour line follows the "Include colour descriptions" box.
    // Absent option = include.
    const includeColour = !config || config.includeColour !== false;

    const u = utils();
    const threshold = u.DEFAULT_CONFIDENCE_THRESHOLD;
    const lines = [];

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
      includeColour &&
      analysis.colour &&
      analysis.colour.status === "complete" &&
      analysis.colour.palette &&
      analysis.colour.palette.length > 0
    ) {
      const colourNames = [];
      const tidyPalette = tidyPaletteForDisplay(analysis.colour.palette);
      const max = Math.min(tidyPalette.length, 5);
      for (let c = 0; c < max; c++) {
        const entry = tidyPalette[c];
        if (entry.colourName) {
          colourNames.push(entry.colourName);
        }
      }
      if (colourNames.length > 0) {
        lines.push("- Main colours: " + colourNames.join(", "));
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
    tidyPaletteForDisplay,
    formatColourForPrompt,
    formatObjectsForPrompt,
    formatFlorence2CaptionForPrompt,
    formatFlorence2ObjectsForPrompt,
    formatFlorence2OCRForPrompt,
    formatForPrompt,
    formatForLocalPrompt,
  };

  logInfo("Analyser prompt formatter loaded");
})();
