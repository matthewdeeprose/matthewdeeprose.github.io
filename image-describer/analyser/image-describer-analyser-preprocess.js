/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER ANALYSER — PREPROCESSING
 * ═══════════════════════════════════════════════════════════════
 *
 * Canvas-based image preprocessing for improved OCR accuracy.
 * Each function takes a canvas and returns a NEW canvas —
 * the original is never mutated (colour analysis needs it intact).
 *
 * Tiered approach (from project bible §7):
 *   Tier 1: contrastStretch — zero dependency, ~15 lines
 *   Tier 2: histogramEqualise — zero dependency, ~30 lines
 *   Tier 3: CLAHE via OpenCV.js — deferred (8 MB payload)
 *
 * Helper:
 *   grayscale — BT.601 luminance conversion
 *
 * Why this helps:
 *   Tesseract operates on luminance. Red text on white has decent
 *   RGB contrast but poor luminance contrast because BT.601 weights
 *   red at only 0.299. Grayscale + contrast stretching maps the
 *   actual min/max intensity to the full 0–255 range, which may
 *   give Tesseract enough separation to detect low-luminance-
 *   contrast text like TH 1 (red) on the GA mechanism image.
 *
 * Reference: preprocessing_low-contrast_images_before_OCR.md
 *
 * VERSION: 1.0.0
 * DATE: 10 March 2026
 * PHASE: Local Analysis — Phase 3 Workstream C
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
      console.error(`[AnalyserPreprocess] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AnalyserPreprocess] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AnalyserPreprocess] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AnalyserPreprocess] ${message}`, ...args);
  }

  // ============================================================================
  // HELPER: CREATE CANVAS COPY
  // ============================================================================

  /**
   * Creates a new canvas with identical dimensions and pixel data.
   * All preprocessing operates on the copy, never the original.
   *
   * @param {HTMLCanvasElement} sourceCanvas — input canvas
   * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, width: number, height: number }}
   */
  function cloneCanvas(sourceCanvas) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(sourceCanvas, 0, 0);
    return { canvas, ctx, width, height };
  }

  // ============================================================================
  // GRAYSCALE CONVERSION (BT.601)
  // ============================================================================

  /**
   * Converts a canvas to greyscale using the BT.601 luminance formula:
   *   L = 0.299·R + 0.587·G + 0.114·B
   *
   * Returns a NEW canvas — the original is not modified.
   *
   * @param {HTMLCanvasElement} sourceCanvas — input canvas (colour)
   * @returns {HTMLCanvasElement} new greyscale canvas
   */
  function grayscale(sourceCanvas) {
    const { canvas, ctx, width, height } = cloneCanvas(sourceCanvas);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const luminance =
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = luminance; // R
      data[i + 1] = luminance; // G
      data[i + 2] = luminance; // B
      // Alpha (data[i + 3]) unchanged
    }

    ctx.putImageData(imageData, 0, 0);
    logDebug(`Greyscale conversion: ${width}×${height}`);
    return canvas;
  }

  // ============================================================================
  // TIER 1: CONTRAST STRETCHING
  // ============================================================================

  /**
   * Maps the image's actual min/max greyscale intensity to the full
   * 0–255 range. Input MUST be greyscale (all channels equal) —
   * call grayscale() first.
   *
   * This is the simplest contrast enhancement: it linearly stretches
   * whatever intensity range exists to fill the entire dynamic range.
   * Critical for images where pixel values cluster in a narrow band.
   *
   * Returns a NEW canvas — the original is not modified.
   *
   * @param {HTMLCanvasElement} sourceCanvas — input canvas (greyscale)
   * @returns {HTMLCanvasElement} new contrast-stretched canvas
   */
  function contrastStretch(sourceCanvas) {
    const { canvas, ctx, width, height } = cloneCanvas(sourceCanvas);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // First pass: find actual min/max intensity
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const val = data[i]; // R channel (same as G, B for greyscale)
      if (val < min) min = val;
      if (val > max) max = val;
    }

    const range = max - min || 1; // Avoid division by zero

    logDebug(
      `Contrast stretch: min=${min}, max=${max}, range=${range} → mapping to 0–255`,
    );

    // Second pass: stretch to full 0–255 range
    for (let i = 0; i < data.length; i += 4) {
      const stretched = ((data[i] - min) / range) * 255;
      data[i] = stretched; // R
      data[i + 1] = stretched; // G
      data[i + 2] = stretched; // B
      // Alpha unchanged
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  // ============================================================================
  // TIER 2: HISTOGRAM EQUALISATION
  // ============================================================================

  /**
   * Redistributes greyscale intensities using the cumulative distribution
   * function (CDF). More aggressive than contrast stretching — adapts
   * nonlinearly, which is highly effective when most pixels cluster at
   * similar brightness levels.
   *
   * Input MUST be greyscale (all channels equal) — call grayscale() first.
   *
   * Returns a NEW canvas — the original is not modified.
   *
   * @param {HTMLCanvasElement} sourceCanvas — input canvas (greyscale)
   * @returns {HTMLCanvasElement} new equalised canvas
   */
  function histogramEqualise(sourceCanvas) {
    const { canvas, ctx, width, height } = cloneCanvas(sourceCanvas);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const totalPixels = width * height;

    // Build histogram (256 bins)
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      histogram[data[i]]++;
    }

    // Build cumulative distribution function
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    // Find minimum non-zero CDF value
    const cdfMin = cdf.find((val) => val > 0);

    // Build look-up table
    const lut = new Uint8Array(256);
    const denominator = totalPixels - cdfMin || 1; // Avoid division by zero
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.round(((cdf[i] - cdfMin) / denominator) * 255);
    }

    logDebug(`Histogram equalisation: ${totalPixels} pixels, cdfMin=${cdfMin}`);

    // Apply look-up table
    for (let i = 0; i < data.length; i += 4) {
      const equalised = lut[data[i]];
      data[i] = equalised; // R
      data[i + 1] = equalised; // G
      data[i + 2] = equalised; // B
      // Alpha unchanged
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  // ============================================================================
  // CONVENIENCE: FULL PREPROCESSING PIPELINE
  // ============================================================================

  /**
   * Applies the full Tier 1 preprocessing pipeline:
   *   1. Greyscale conversion (BT.601)
   *   2. Contrast stretching
   *
   * Returns a NEW canvas — the original is not modified.
   *
   * @param {HTMLCanvasElement} sourceCanvas — input canvas (colour)
   * @returns {HTMLCanvasElement} preprocessed canvas
   */
  function preprocessTier1(sourceCanvas) {
    const grey = grayscale(sourceCanvas);
    const stretched = contrastStretch(grey);
    logDebug("Tier 1 preprocessing complete (greyscale → contrast stretch)");
    return stretched;
  }

  /**
   * Applies the full Tier 2 preprocessing pipeline:
   *   1. Greyscale conversion (BT.601)
   *   2. Histogram equalisation
   *
   * Returns a NEW canvas — the original is not modified.
   *
   * @param {HTMLCanvasElement} sourceCanvas — input canvas (colour)
   * @returns {HTMLCanvasElement} preprocessed canvas
   */
  function preprocessTier2(sourceCanvas) {
    const grey = grayscale(sourceCanvas);
    const equalised = histogramEqualise(grey);
    logDebug("Tier 2 preprocessing complete (greyscale → histogram equalise)");
    return equalised;
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ImageDescriberAnalyserPreprocess = {
    // Core functions
    grayscale,
    contrastStretch,
    histogramEqualise,

    // Convenience pipelines
    preprocessTier1,
    preprocessTier2,

    // Utility (exposed for testing)
    cloneCanvas,
  };

  logInfo("Analyser preprocessing module loaded");
})();
