/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER ANALYSER — COLOUR ENGINE
 * ═══════════════════════════════════════════════════════════════
 *
 * Canvas-based colour sampling engine:
 *   - Region sampling (average luminance, hue, saturation, colour name)
 *   - Palette extraction (quantised HSL bucketing)
 *   - Gradient direction detection (directional, radial, uniform)
 *   - Grid region generation
 *   - Full colour analysis runner (_runColourAnalysis)
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
      console.error(`[AnalyserColour] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AnalyserColour] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AnalyserColour] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AnalyserColour] ${message}`, ...args);
  }

  // ============================================================================
  // DEPENDENCY REFERENCES
  // ============================================================================

  /** Shorthand references to utils — resolved at call time, not load time */
  function utils() {
    return window.ImageDescriberAnalyserUtils;
  }

  // ============================================================================
  // COLOUR SAMPLING
  // ============================================================================

  /**
   * Samples colour data from a specific region of a canvas.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasWidth — pixel width
   * @param {number} canvasHeight — pixel height
   * @param {{ x, y, w, h }} bounds — normalised bounds (0–1)
   * @param {number} sampleInterval — sample every Nth pixel
   * @returns {object|null} ColourRegion data
   */
  function sampleRegion(
    ctx,
    canvasWidth,
    canvasHeight,
    bounds,
    sampleInterval,
  ) {
    const u = utils();
    const pxX = Math.floor(bounds.x * canvasWidth);
    const pxY = Math.floor(bounds.y * canvasHeight);
    const pxW = Math.floor(bounds.w * canvasWidth);
    const pxH = Math.floor(bounds.h * canvasHeight);

    // Clamp to canvas bounds
    const safeW = Math.min(pxW, canvasWidth - pxX);
    const safeH = Math.min(pxH, canvasHeight - pxY);

    if (safeW <= 0 || safeH <= 0) {
      return null;
    }

    const imageData = ctx.getImageData(pxX, pxY, safeW, safeH);
    const data = imageData.data;

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let totalLuminance = 0;
    let sampleCount = 0;

    // Hue buckets: 12 buckets of 30° each
    const hueBuckets = new Array(12).fill(0);
    let totalSaturation = 0;

    const step = sampleInterval || 4;

    for (let y = 0; y < safeH; y += step) {
      for (let x = 0; x < safeW; x += step) {
        const idx = (y * safeW + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        // Skip fully transparent pixels
        const a = data[idx + 3];
        if (a < 128) continue;

        totalR += r;
        totalG += g;
        totalB += b;
        totalLuminance += u.calcLuminance(r, g, b);

        const hsl = u.rgbToHsl(r, g, b);
        totalSaturation += hsl.s;

        // Only count hue for chromatic pixels
        if (hsl.s > 0.1) {
          const bucket = Math.floor(hsl.h / 30) % 12;
          hueBuckets[bucket]++;
        }

        sampleCount++;
      }
    }

    if (sampleCount === 0) {
      return null;
    }

    const avgR = Math.round(totalR / sampleCount);
    const avgG = Math.round(totalG / sampleCount);
    const avgB = Math.round(totalB / sampleCount);
    const avgLuminance = totalLuminance / sampleCount;
    const avgSaturation = totalSaturation / sampleCount;

    // Find dominant hue bucket
    let maxBucket = 0;
    let maxBucketCount = 0;
    for (let i = 0; i < 12; i++) {
      if (hueBuckets[i] > maxBucketCount) {
        maxBucketCount = hueBuckets[i];
        maxBucket = i;
      }
    }
    const avgHue = maxBucketCount > 0 ? maxBucket * 30 + 15 : 0;

    const hsl = u.rgbToHsl(avgR, avgG, avgB);
    const colourName = u.getColourName(hsl.h, hsl.s, hsl.l);

    return {
      avgLuminance,
      avgHue,
      avgSaturation,
      dominantRGB: [avgR, avgG, avgB],
      colourName,
      sampleCount,
    };
  }

  /**
   * Extracts the dominant colour palette from the entire image.
   *
   * Uses a simplified colour bucketing approach:
   * divide colour space into buckets, count prevalence, return top N.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @param {number} sampleInterval
   * @param {number} paletteSize — number of colours to return
   * @returns {Array} PaletteEntry objects
   */
  function extractPalette(
    ctx,
    canvasWidth,
    canvasHeight,
    sampleInterval,
    paletteSize,
  ) {
    const u = utils();
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    const step = sampleInterval || 4;

    // Bucket colours by quantised HSL
    // Hue: 12 buckets (30° each), Saturation: 3 buckets, Lightness: 5 buckets
    const buckets = {};
    let totalSamples = 0;

    for (let y = 0; y < canvasHeight; y += step) {
      for (let x = 0; x < canvasWidth; x += step) {
        const idx = (y * canvasWidth + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a < 128) continue;

        const hsl = u.rgbToHsl(r, g, b);

        // Quantise
        let hBucket, sBucket, lBucket;

        if (hsl.s < 0.1) {
          // Achromatic — group by lightness only
          hBucket = -1;
          sBucket = 0;
        } else {
          hBucket = Math.floor(hsl.h / 30) % 12;
          sBucket = hsl.s < 0.33 ? 0 : hsl.s < 0.67 ? 1 : 2;
        }
        lBucket = Math.floor(hsl.l * 4.99);

        const key = `${hBucket}:${sBucket}:${lBucket}`;
        if (!buckets[key]) {
          buckets[key] = { totalR: 0, totalG: 0, totalB: 0, count: 0 };
        }
        buckets[key].totalR += r;
        buckets[key].totalG += g;
        buckets[key].totalB += b;
        buckets[key].count++;
        totalSamples++;
      }
    }

    if (totalSamples === 0) return [];

    // Sort buckets by count, take top N
    const sorted = Object.values(buckets).sort((a, b) => b.count - a.count);
    const topBuckets = sorted.slice(0, paletteSize);

    return topBuckets.map((bucket) => {
      const avgR = Math.round(bucket.totalR / bucket.count);
      const avgG = Math.round(bucket.totalG / bucket.count);
      const avgB = Math.round(bucket.totalB / bucket.count);
      const hsl = u.rgbToHsl(avgR, avgG, avgB);
      const colourName = u.getColourName(hsl.h, hsl.s, hsl.l);

      return {
        rgb: [avgR, avgG, avgB],
        hsl: [
          Math.round(hsl.h),
          parseFloat(hsl.s.toFixed(2)),
          parseFloat(hsl.l.toFixed(2)),
        ],
        percentage: parseFloat((bucket.count / totalSamples).toFixed(3)),
        colourName,
      };
    });
  }

  /**
   * Derives the gradient direction from region luminance values.
   *
   * @param {Array} regions — ColourRegion objects with label, avgLuminance
   * @returns {string|null} gradient direction or null
   */
  function deriveGradientDirection(regions) {
    if (!regions || regions.length < 2) return null;

    // Separate out the centre region (it's an overlay, not part of the grid)
    const gridRegions = regions.filter((r) => r.label !== "centre");
    if (gridRegions.length < 2) return null;

    const luminances = gridRegions.map((r) => r.avgLuminance);
    const range = Math.max(...luminances) - Math.min(...luminances);

    // If luminance is very uniform, report as such
    if (range < 0.08) return "uniform";

    // For 2×2 grids, check directional patterns
    const byLabel = {};
    gridRegions.forEach((r) => {
      byLabel[r.label] = r.avgLuminance;
    });

    // Top-to-bottom: average of top row vs bottom row
    if (
      byLabel["top-left"] !== undefined &&
      byLabel["top-right"] !== undefined &&
      byLabel["bottom-left"] !== undefined &&
      byLabel["bottom-right"] !== undefined
    ) {
      const topAvg = (byLabel["top-left"] + byLabel["top-right"]) / 2;
      const bottomAvg = (byLabel["bottom-left"] + byLabel["bottom-right"]) / 2;
      const leftAvg = (byLabel["top-left"] + byLabel["bottom-left"]) / 2;
      const rightAvg = (byLabel["top-right"] + byLabel["bottom-right"]) / 2;

      const vertDiff = Math.abs(topAvg - bottomAvg);
      const horizDiff = Math.abs(leftAvg - rightAvg);

      // Minimum difference to be considered a gradient
      const threshold = 0.1;

      if (vertDiff > horizDiff && vertDiff > threshold) {
        return topAvg > bottomAvg ? "top-to-bottom" : "bottom-to-top";
      }
      if (horizDiff > vertDiff && horizDiff > threshold) {
        return leftAvg > rightAvg ? "left-to-right" : "right-to-left";
      }
    }

    // For larger grids: compute row and column averages
    // Group regions by row and column
    const rowGroups = {};
    const colGroups = {};

    gridRegions.forEach((r) => {
      // Parse row/col from label like "row1-col2" or "top-left"
      const rowColMatch = r.label.match(/^row(\d+)-col(\d+)$/);
      if (rowColMatch) {
        const row = parseInt(rowColMatch[1]);
        const col = parseInt(rowColMatch[2]);
        if (!rowGroups[row]) rowGroups[row] = [];
        if (!colGroups[col]) colGroups[col] = [];
        rowGroups[row].push(r.avgLuminance);
        colGroups[col].push(r.avgLuminance);
      }
    });

    const rowKeys = Object.keys(rowGroups).sort((a, b) => a - b);
    const colKeys = Object.keys(colGroups).sort((a, b) => a - b);

    if (rowKeys.length >= 2) {
      const rowAvgs = rowKeys.map(
        (k) => rowGroups[k].reduce((a, b) => a + b, 0) / rowGroups[k].length,
      );
      const colAvgs =
        colKeys.length >= 2
          ? colKeys.map(
              (k) =>
                colGroups[k].reduce((a, b) => a + b, 0) / colGroups[k].length,
            )
          : [];

      const rowDiff =
        rowAvgs.length >= 2
          ? Math.abs(rowAvgs[0] - rowAvgs[rowAvgs.length - 1])
          : 0;
      const colDiff =
        colAvgs.length >= 2
          ? Math.abs(colAvgs[0] - colAvgs[colAvgs.length - 1])
          : 0;

      const threshold = 0.1;

      if (rowDiff > colDiff && rowDiff > threshold) {
        return rowAvgs[0] > rowAvgs[rowAvgs.length - 1]
          ? "top-to-bottom"
          : "bottom-to-top";
      }
      if (colDiff > rowDiff && colDiff > threshold) {
        return colAvgs[0] > colAvgs[colAvgs.length - 1]
          ? "left-to-right"
          : "right-to-left";
      }
    }

    // Check for radial pattern: centre vs edges
    const centreRegion = regions.find((r) => r.label === "centre");
    if (centreRegion) {
      const edgeLuminances = gridRegions.map((r) => r.avgLuminance);
      const edgeAvg =
        edgeLuminances.reduce((a, b) => a + b, 0) / edgeLuminances.length;
      const centreDiff = Math.abs(centreRegion.avgLuminance - edgeAvg);

      if (centreDiff > 0.15) {
        return centreRegion.avgLuminance > edgeAvg
          ? "radial-centre-out"
          : "radial-edges-in";
      }
    }

    return null;
  }

  // ============================================================================
  // COLOUR ANALYSIS ENGINE
  // ============================================================================

  /**
   * Runs Canvas colour sampling analysis.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @param {object} colourConfig — colour profile configuration
   * @returns {Promise<object>} ColourAnalysisResult
   */
  async function runColourAnalysis(ctx, canvasWidth, canvasHeight, colourConfig) {
    const u = utils();
    const colourStart = Date.now();

    try {
      const gridConfig = colourConfig.grid;
      const sampleInterval = colourConfig.sampleInterval || 4;
      const paletteSize = colourConfig.paletteSize || 5;

      // Generate grid regions
      const regionDefs = u.generateGridRegions(gridConfig);

      // Sample each region
      const regions = [];
      regionDefs.forEach((def) => {
        const sampled = sampleRegion(
          ctx,
          canvasWidth,
          canvasHeight,
          def.bounds,
          sampleInterval,
        );

        if (sampled) {
          regions.push({
            label: def.label,
            bounds: def.bounds,
            avgLuminance: parseFloat(sampled.avgLuminance.toFixed(3)),
            avgHue: sampled.avgHue,
            avgSaturation: parseFloat(sampled.avgSaturation.toFixed(3)),
            dominantRGB: sampled.dominantRGB,
            colourName: sampled.colourName,
            sampleCount: sampled.sampleCount,
          });
        }
      });

      // Extract palette
      const palette = extractPalette(
        ctx,
        canvasWidth,
        canvasHeight,
        sampleInterval,
        paletteSize,
      );

      // Compute derived values
      const gridRegions = regions.filter((r) => r.label !== "centre");
      const luminances = gridRegions.map((r) => r.avgLuminance);
      const luminanceRange =
        luminances.length >= 2
          ? parseFloat(
              (Math.max(...luminances) - Math.min(...luminances)).toFixed(3),
            )
          : 0;

      const darkCount = gridRegions.filter(
        (r) => r.avgLuminance < 0.5,
      ).length;
      const isDarkDominant =
        gridRegions.length > 0 && darkCount > gridRegions.length / 2;
      const isHighContrast = luminanceRange > 0.4;

      // Gradient direction
      const gradientDirection = colourConfig.deriveGradientDirection
        ? deriveGradientDirection(regions)
        : null;

      const duration = Date.now() - colourStart;
      logDebug(
        `Colour analysis complete: ${regions.length} regions in ${duration}ms`,
      );

      return {
        status: "complete",
        duration,
        error: null,
        gridConfig,
        regions,
        palette,
        luminanceRange,
        gradientDirection,
        isDarkDominant,
        isHighContrast,
      };
    } catch (err) {
      const duration = Date.now() - colourStart;
      logError("Colour analysis failed:", err.message);

      return {
        status: "failed",
        duration,
        error: err.message,
        gridConfig: colourConfig.grid,
        regions: [],
        palette: [],
        luminanceRange: 0,
        gradientDirection: null,
        isDarkDominant: false,
        isHighContrast: false,
      };
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.ImageDescriberAnalyserColour = {
    sampleRegion,
    extractPalette,
    deriveGradientDirection,
    runColourAnalysis,
  };

  logInfo("Analyser colour engine loaded");
})();
