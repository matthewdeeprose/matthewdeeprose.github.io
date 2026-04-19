/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER ANALYSER — CROSS-REFERENCE
 * ═══════════════════════════════════════════════════════════════
 *
 * Cross-referencing engine: pairs OCR labels with nearby colours
 * by sampling the canvas region surrounding each label's bounding
 * box (excluding the text ink itself).
 *
 * Depends on: window.ImageDescriberAnalyserUtils
 *
 * VERSION: 2.0.0
 * DATE: 8 March 2026
 * PHASE: Local Analysis — Phase 2 (file split)
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
      console.error(`[AnalyserXRef] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AnalyserXRef] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AnalyserXRef] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AnalyserXRef] ${message}`, ...args);
  }

  // ============================================================================
  // DEPENDENCY REFERENCES
  // ============================================================================

  /** Shorthand reference to utils — resolved at call time, not load time */
  function utils() {
    return window.ImageDescriberAnalyserUtils;
  }

  // ============================================================================
  // NEARBY COLOUR SAMPLING
  // ============================================================================

  /**
   * Samples the dominant colour around an OCR bounding box, excluding the
   * text ink region itself. Expands the box by CROSS_REF_EXPANSION in each
   * direction, clamped to image edges.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @param {{ x, y, w, h }} bounds — normalised OCR bounding box
   * @returns {object|null} ColourSample or null
   */
  function sampleNearbyColour(ctx, canvasWidth, canvasHeight, bounds) {
    const u = utils();
    const expansion = u.CROSS_REF_EXPANSION;

    // Expand bounding box by 20% in each direction
    const expandX = bounds.w * expansion;
    const expandY = bounds.h * expansion;

    const outerX = Math.max(0, bounds.x - expandX);
    const outerY = Math.max(0, bounds.y - expandY);
    const outerRight = Math.min(1, bounds.x + bounds.w + expandX);
    const outerBottom = Math.min(1, bounds.y + bounds.h + expandY);
    const outerW = outerRight - outerX;
    const outerH = outerBottom - outerY;

    // Convert to pixel coordinates
    const pxOuterX = Math.floor(outerX * canvasWidth);
    const pxOuterY = Math.floor(outerY * canvasHeight);
    const pxOuterW = Math.floor(outerW * canvasWidth);
    const pxOuterH = Math.floor(outerH * canvasHeight);

    const pxInnerX = Math.floor(bounds.x * canvasWidth);
    const pxInnerY = Math.floor(bounds.y * canvasHeight);
    const pxInnerRight = Math.floor((bounds.x + bounds.w) * canvasWidth);
    const pxInnerBottom = Math.floor((bounds.y + bounds.h) * canvasHeight);

    if (pxOuterW <= 0 || pxOuterH <= 0) return null;

    const imageData = ctx.getImageData(pxOuterX, pxOuterY, pxOuterW, pxOuterH);
    const data = imageData.data;

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let count = 0;

    // Sample every 2nd pixel, excluding the inner bounding box (the text itself)
    for (let y = 0; y < pxOuterH; y += 2) {
      for (let x = 0; x < pxOuterW; x += 2) {
        // Convert back to absolute pixel coords to check if inside inner box
        const absX = pxOuterX + x;
        const absY = pxOuterY + y;

        if (
          absX >= pxInnerX &&
          absX < pxInnerRight &&
          absY >= pxInnerY &&
          absY < pxInnerBottom
        ) {
          continue; // Skip the text ink region
        }

        const idx = (y * pxOuterW + x) * 4;
        const a = data[idx + 3];
        if (a < 128) continue;

        totalR += data[idx];
        totalG += data[idx + 1];
        totalB += data[idx + 2];
        count++;
      }
    }

    if (count === 0) return null;

    const avgR = Math.round(totalR / count);
    const avgG = Math.round(totalG / count);
    const avgB = Math.round(totalB / count);
    const hsl = u.rgbToHsl(avgR, avgG, avgB);
    const luminance = u.calcLuminance(avgR, avgG, avgB);

    return {
      rgb: [avgR, avgG, avgB],
      hsl: [
        Math.round(hsl.h),
        parseFloat(hsl.s.toFixed(2)),
        parseFloat(hsl.l.toFixed(2)),
      ],
      luminance: parseFloat(luminance.toFixed(3)),
      colourName: u.getColourName(hsl.h, hsl.s, hsl.l),
    };
  }

  // ============================================================================
  // CROSS-REFERENCE
  // ============================================================================

  /**
   * Post-processing: pairs OCR labels with nearby colours.
   * Mutates ocr.items to populate nearbyColour fields.
   *
   * @param {object} ocr — OCRAnalysisResult
   * @param {object} colour — ColourAnalysisResult (unused directly, but kept for signature consistency)
   * @param {CanvasRenderingContext2D} ctx — canvas context for sampling
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   */
  function crossReference(ocr, colour, ctx, canvasWidth, canvasHeight) {
    if (!ocr || !ocr.items || !ctx) return;

    ocr.items.forEach((item) => {
      try {
        item.nearbyColour = sampleNearbyColour(
          ctx,
          canvasWidth,
          canvasHeight,
          item.bounds,
        );
      } catch (err) {
        logDebug(
          `Cross-reference failed for label "${item.text}":`,
          err.message,
        );
        item.nearbyColour = null;
      }
    });
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ImageDescriberAnalyserXRef = {
    sampleNearbyColour,
    crossReference,
  };

  logInfo("Analyser cross-reference engine loaded");
})();
