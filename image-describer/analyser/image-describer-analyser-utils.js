/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER ANALYSER — UTILITIES
 * ═══════════════════════════════════════════════════════════════
 *
 * Shared utilities for the Image Describer Analyser module:
 *   - Constants and schema version
 *   - Colour naming (HSL → human-readable name)
 *   - Colour conversion (RGB ↔ HSL, luminance)
 *   - Spatial helpers (normalised bounds, quadrant mapping)
 *   - Canvas loading (accepts multiple image source types)
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
      console.error(`[AnalyserUtils] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AnalyserUtils] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AnalyserUtils] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AnalyserUtils] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const SCHEMA_VERSION = 1;

  /** OCR items with confidence below this are stored but excluded from prompts */
  const DEFAULT_CONFIDENCE_THRESHOLD = 0.3;

  /** Confidence filter for Tesseract — words below this are discarded entirely */
  const TESSERACT_MIN_CONFIDENCE = 60; // Tesseract uses 0–100 scale

  /** Tesseract timeout in milliseconds */
  const TESSERACT_TIMEOUT = 15000;

  /** Expansion factor for cross-reference bounding box sampling */
  const CROSS_REF_EXPANSION = 0.2;

  /** Numeric text detection pattern */
  const NUMERIC_PATTERN = /^[\d,.\s%£$€]+$/;

  // ============================================================================
  // COLOUR NAMING
  // ============================================================================

  /**
   * Maps HSL values to a human-readable colour name.
   * Approximately 18 named colours covering the full spectrum.
   *
   * @param {number} h — hue, 0–360
   * @param {number} s — saturation, 0–1
   * @param {number} l — lightness, 0–1
   * @returns {string} colour name
   */
  function getColourName(h, s, l) {
    // Achromatic colours (low saturation)
    if (s < 0.1) {
      if (l > 0.9) return "white";
      if (l > 0.7) return "light grey";
      if (l > 0.4) return "grey";
      if (l > 0.2) return "dark grey";
      return "black";
    }

    // Brown detection: low-to-mid lightness with orange-ish hue
    if (h >= 15 && h < 45 && l < 0.4 && s > 0.15) {
      return "brown";
    }

    // Chromatic colours — map hue to name
    // Adjust for lightness extremes
    let baseName;
    if (h < 15 || h >= 345) baseName = "red";
    else if (h < 40) baseName = "orange";
    else if (h < 65) baseName = "yellow";
    else if (h < 80) baseName = "yellow-green";
    else if (h < 160) baseName = "green";
    else if (h < 180) baseName = "teal";
    else if (h < 200) baseName = "cyan";
    else if (h < 240) baseName = "blue";
    else if (h < 270) baseName = "indigo";
    else if (h < 300) baseName = "purple";
    else if (h < 330) baseName = "magenta";
    else baseName = "pink";

    // Modify with lightness
    if (l > 0.85) return "light " + baseName;
    if (l < 0.2) return "dark " + baseName;

    return baseName;
  }

  // ============================================================================
  // COLOUR CONVERSION UTILITIES
  // ============================================================================

  /**
   * Converts RGB (0–255 each) to HSL.
   * Returns { h: 0–360, s: 0–1, l: 0–1 }.
   */
  function rgbToHsl(r, g, b) {
    const rN = r / 255;
    const gN = g / 255;
    const bN = b / 255;

    const max = Math.max(rN, gN, bN);
    const min = Math.min(rN, gN, bN);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

      if (max === rN) {
        h = ((gN - bN) / delta + (gN < bN ? 6 : 0)) * 60;
      } else if (max === gN) {
        h = ((bN - rN) / delta + 2) * 60;
      } else {
        h = ((rN - gN) / delta + 4) * 60;
      }
    }

    return { h, s, l };
  }

  /**
   * Calculates WCAG perceived luminance from RGB (0–255 each).
   * Returns a value between 0 and 1.
   */
  function calcLuminance(r, g, b) {
    return 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  }

  // ============================================================================
  // SPATIAL UTILITIES
  // ============================================================================

  /**
   * Converts Tesseract pixel bbox { x0, y0, x1, y1 } to NormalisedBounds.
   */
  function toNormalisedBounds(bbox, imgWidth, imgHeight) {
    return {
      x: bbox.x0 / imgWidth,
      y: bbox.y0 / imgHeight,
      w: (bbox.x1 - bbox.x0) / imgWidth,
      h: (bbox.y1 - bbox.y0) / imgHeight,
    };
  }

  /**
   * Derives the quadrant name from a NormalisedBounds rectangle.
   * Centre zone: centreX 0.33–0.67 AND centreY 0.33–0.67
   */
  function getQuadrant(bounds) {
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;

    // Check centre zone first
    if (cx >= 0.33 && cx <= 0.67 && cy >= 0.33 && cy <= 0.67) {
      return "centre";
    }

    const horizontal = cx < 0.5 ? "left" : "right";
    const vertical = cy < 0.5 ? "top" : "bottom";

    return vertical + "-" + horizontal;
  }

  /**
   * Generates grid region definitions based on a GridConfig.
   * Returns an array of { label, bounds } objects.
   */
  function generateGridRegions(gridConfig) {
    const regions = [];
    const { rows, columns, includeCentre, centreSize } = gridConfig;

    // Determine region labels
    const useHumanLabels = rows === 2 && columns === 2;
    const humanLabels = [
      ["top-left", "top-right"],
      ["bottom-left", "bottom-right"],
    ];

    const cellWidth = 1 / columns;
    const cellHeight = 1 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const label = useHumanLabels
          ? humanLabels[r][c]
          : `row${r + 1}-col${c + 1}`;

        regions.push({
          label,
          bounds: {
            x: c * cellWidth,
            y: r * cellHeight,
            w: cellWidth,
            h: cellHeight,
          },
        });
      }
    }

    // Add centre region if requested
    if (includeCentre) {
      const offset = (1 - centreSize) / 2;
      regions.push({
        label: "centre",
        bounds: {
          x: offset,
          y: offset,
          w: centreSize,
          h: centreSize,
        },
      });
    }

    return regions;
  }

  // ============================================================================
  // CANVAS UTILITIES
  // ============================================================================

  /**
   * Loads an image source onto a canvas and returns { canvas, ctx, width, height }.
   * Accepts: HTMLImageElement, HTMLCanvasElement, File, or base64 data URL string.
   */
  async function loadImageToCanvas(imageSource) {
    let img;

    if (imageSource instanceof HTMLCanvasElement) {
      return {
        canvas: imageSource,
        ctx: imageSource.getContext("2d"),
        width: imageSource.width,
        height: imageSource.height,
      };
    }

    if (imageSource instanceof HTMLImageElement) {
      img = imageSource;
      // Ensure image is loaded
      if (!img.complete || img.naturalWidth === 0) {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
      }
    } else if (imageSource instanceof File) {
      img = await fileToImage(imageSource);
    } else if (typeof imageSource === "string") {
      // Assume base64 data URL or URL
      img = await urlToImage(imageSource);
    } else {
      throw new Error(
        "Unsupported image source type. Expected HTMLImageElement, HTMLCanvasElement, File, or data URL string.",
      );
    }

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);

    return { canvas, ctx, width, height };
  }

  /**
   * Converts a File object to a loaded HTMLImageElement.
   */
  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Loads a URL (including data URLs) into an HTMLImageElement.
   */
  function urlToImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  const utilsExport = {
    // Constants
    SCHEMA_VERSION,
    DEFAULT_CONFIDENCE_THRESHOLD,
    TESSERACT_MIN_CONFIDENCE,
    TESSERACT_TIMEOUT,
    CROSS_REF_EXPANSION,
    NUMERIC_PATTERN,

    // Colour naming
    getColourName,

    // Colour conversion
    rgbToHsl,
    calcLuminance,

    // Spatial helpers
    toNormalisedBounds,
    getQuadrant,
    generateGridRegions,

    // Canvas utilities
    loadImageToCanvas,
    fileToImage,
    urlToImage,
  };

  // Backwards-compatible re-export: PROFILES getter resolves lazily so
  // profiles module can load after utils without breaking the load order
  Object.defineProperty(utilsExport, "PROFILES", {
    get: function () {
      return window.ImageDescriberAnalyserProfiles.PROFILES;
    },
    enumerable: true,
    configurable: false,
  });

  window.ImageDescriberAnalyserUtils = utilsExport;

  logInfo("Analyser utilities loaded");
})();
