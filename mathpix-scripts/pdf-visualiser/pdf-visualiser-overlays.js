/**
 * @fileoverview PDF Visualiser Overlay Drawing
 * @module PDFVisualiserOverlays
 * @requires ./pdf-visualiser-config.js
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Handles drawing confidence overlay boxes on the PDF canvas.
 * Provides coordinate transformation from MathPix lines.json coordinates
 * to canvas pixels, and renders colour-coded confidence indicators.
 *
 * Key Features:
 * - Coordinate transformation from lines.json to canvas viewport
 * - Colour-coded confidence overlays (high/medium/low/very low)
 * - Optional percentage labels on overlay boxes
 * - Support for different line types (text, math, table, etc.)
 * - High-DPI canvas rendering support
 * - Theme-aware rendering
 *
 * Coordinate System:
 * - lines.json provides coordinates relative to page_width/page_height
 * - PDF.js viewport provides scale and dimensions
 * - This module transforms between the two coordinate systems
 *
 * Integration:
 * - Used by pdf-visualiser-renderer.js for overlay canvas
 * - Receives line data from MathPix lines.json API
 * - Respects configuration from pdf-visualiser-config.js
 *
 * Accessibility:
 * - Colours chosen for WCAG 2.2 AA contrast compliance
 * - Labels readable against overlay backgrounds
 */

// =============================================================================
// LOGGING CONFIGURATION
// =============================================================================

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
    console.error("[PDFVisualiserOverlays]", message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[PDFVisualiserOverlays]", message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[PDFVisualiserOverlays]", message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[PDFVisualiserOverlays]", message, ...args);
}

// =============================================================================
// IMPORTS
// =============================================================================

import PDF_VISUALISER_CONFIG, {
  getConfidenceLevelByRate,
  getConfidenceLevelColours,
  formatPercentage,
  getConfidenceLevelKey,
  buildToggletipContent,
  buildAccessibleLabel,
  getToggletipType,
} from "./pdf-visualiser-config.js";

// =============================================================================
// MAIN CLASS
// =============================================================================

/**
 * @class PDFVisualiserOverlays
 * @description Handles drawing confidence overlays on PDF canvas
 *
 * Provides static methods for coordinate transformation and overlay rendering.
 * Designed for use with HTML5 Canvas 2D context overlaid on PDF.js rendered pages.
 *
 * @example
 * import PDFVisualiserOverlays from './pdf-visualiser-overlays.js';
 *
 * // Get overlay canvas context
 * const ctx = overlayCanvas.getContext('2d');
 *
 * // Draw overlays for page data
 * PDFVisualiserOverlays.drawOverlays(ctx, pageData, viewport, {
 *   showLabels: true,
 *   showOverlays: true
 * });
 *
 * @since 1.0.0
 */
class PDFVisualiserOverlays {
  // ===========================================================================
  // COORDINATE TRANSFORMATION
  // ===========================================================================

  /**
   * @method transformCoordinates
   * @static
   * @description Transforms lines.json region coordinates to canvas coordinates
   *
   * MathPix lines.json provides bounding box coordinates relative to the
   * original PDF page dimensions (page_width, page_height). This method
   * transforms those coordinates to the canvas viewport dimensions after
   * PDF.js rendering.
   *
   * @param {Object} region - Bounding box from lines.json
   * @param {number} region.top_left_x - X coordinate of top-left corner
   * @param {number} region.top_left_y - Y coordinate of top-left corner
   * @param {number} region.width - Width of bounding box
   * @param {number} region.height - Height of bounding box
   * @param {number} pageWidth - Original page width from lines.json (page_width)
   * @param {number} pageHeight - Original page height from lines.json (page_height)
   * @param {Object} viewport - PDF.js viewport object
   * @param {number} viewport.width - Rendered canvas width
   * @param {number} viewport.height - Rendered canvas height
   *
   * @returns {Object} Transformed coordinates for canvas
   * @returns {number} returns.x - X position on canvas
   * @returns {number} returns.y - Y position on canvas
   * @returns {number} returns.width - Width on canvas
   * @returns {number} returns.height - Height on canvas
   *
   * @example
   * const region = { top_left_x: 100, top_left_y: 200, width: 500, height: 40 };
   * const coords = PDFVisualiserOverlays.transformCoordinates(
   *   region, 2550, 3300, viewport
   * );
   *
   * @since 1.0.0
   */
  static transformCoordinates(region, pageWidth, pageHeight, viewport) {
    if (!region || !viewport) {
      logWarn("transformCoordinates: Missing region or viewport");
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    // Calculate scale factors
    const scaleX = viewport.width / pageWidth;
    const scaleY = viewport.height / pageHeight;

    // Transform coordinates
    const transformed = {
      x: region.top_left_x * scaleX,
      y: region.top_left_y * scaleY,
      width: region.width * scaleX,
      height: region.height * scaleY,
    };

    logDebug("Coordinate transformation", {
      original: region,
      pageSize: { pageWidth, pageHeight },
      viewportSize: { width: viewport.width, height: viewport.height },
      scale: { scaleX, scaleY },
      transformed,
    });

    return transformed;
  }

  /**
   * @method transformCoordinatesWithDPI
   * @static
   * @description Transforms coordinates accounting for device pixel ratio
   *
   * For high-DPI displays, canvas dimensions may differ from CSS dimensions.
   * This method accounts for the device pixel ratio when transforming.
   *
   * @param {Object} region - Bounding box from lines.json
   * @param {number} pageWidth - Original page width
   * @param {number} pageHeight - Original page height
   * @param {Object} viewport - PDF.js viewport
   * @param {number} [dpr=1] - Device pixel ratio
   *
   * @returns {Object} Transformed coordinates
   *
   * @since 1.0.0
   */
  static transformCoordinatesWithDPI(
    region,
    pageWidth,
    pageHeight,
    viewport,
    dpr = 1
  ) {
    const base = this.transformCoordinates(
      region,
      pageWidth,
      pageHeight,
      viewport
    );

    return {
      x: base.x * dpr,
      y: base.y * dpr,
      width: base.width * dpr,
      height: base.height * dpr,
    };
  }

  /**
   * @method cntToRegion
   * @static
   * @description Converts cnt (contour) array format to region object format
   *
   * MathPix lines.json provides bounding coordinates in two possible formats:
   * 1. cnt array: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] - four corner points
   * 2. region object: {top_left_x, top_left_y, width, height}
   *
   * This method converts format 1 to format 2 for use with transformCoordinates().
   *
   * @param {Array} cnt - Contour array from lines.json
   * @param {Array} cnt[] - Each element is [x, y] coordinate pair
   *
   * @returns {Object} Region object
   * @returns {number} returns.top_left_x - X coordinate of top-left corner
   * @returns {number} returns.top_left_y - Y coordinate of top-left corner
   * @returns {number} returns.width - Width of bounding box
   * @returns {number} returns.height - Height of bounding box
   *
   * @example
   * const cnt = [[100, 200], [500, 200], [500, 240], [100, 240]];
   * const region = PDFVisualiserOverlays.cntToRegion(cnt);
   * // Returns: { top_left_x: 100, top_left_y: 200, width: 400, height: 40 }
   *
   * @since 1.0.0
   */
  static cntToRegion(cnt) {
    if (!cnt || !Array.isArray(cnt) || cnt.length < 3) {
      logWarn("cntToRegion: Invalid cnt array", { cnt });
      return { top_left_x: 0, top_left_y: 0, width: 0, height: 0 };
    }

    // Extract x and y coordinates
    // Handle both [x, y] array format and {x, y} object format
    const points = cnt.map((point) => {
      if (Array.isArray(point)) {
        return { x: point[0], y: point[1] };
      }
      return { x: point.x, y: point.y };
    });

    // Find bounding box from corner points
    const xCoords = points.map((p) => p.x);
    const yCoords = points.map((p) => p.y);

    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    const region = {
      top_left_x: minX,
      top_left_y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };

    logDebug("cntToRegion conversion", { cnt, region });

    return region;
  }

  /**
   * @method lineToRegion
   * @static
   * @description Extracts region from a line object, handling both formats
   *
   * Lines from MathPix API may have region data in:
   * 1. line.region - Direct region object
   * 2. line.cnt - Contour array that needs conversion
   *
   * This method handles both cases transparently.
   *
   * @param {Object} line - Line object from lines.json
   * @returns {Object} Region object suitable for transformCoordinates()
   *
   * @example
   * const region = PDFVisualiserOverlays.lineToRegion(line);
   * const coords = PDFVisualiserOverlays.transformCoordinates(region, pw, ph, vp);
   *
   * @since 1.0.0
   */
  static lineToRegion(line) {
    if (!line) {
      logWarn("lineToRegion: No line provided");
      return { top_left_x: 0, top_left_y: 0, width: 0, height: 0 };
    }

    // If line already has region object, use it
    if (line.region && typeof line.region.top_left_x === "number") {
      return line.region;
    }

    // If line has cnt array, convert it
    if (line.cnt && Array.isArray(line.cnt)) {
      return this.cntToRegion(line.cnt);
    }

    logWarn("lineToRegion: Line has neither region nor cnt", { line });
    return { top_left_x: 0, top_left_y: 0, width: 0, height: 0 };
  }

  // ===========================================================================
  // COLOUR SELECTION
  // ===========================================================================

  /**
   * @method getConfidenceColours
   * @static
   * @description Gets colours for a confidence rate
   *
   * @param {number} confidenceRate - Confidence rate between 0 and 1
   * @returns {Object} Colour configuration
   * @returns {string} returns.fill - Fill colour with opacity
   * @returns {string} returns.border - Border colour
   * @returns {string} returns.text - Text colour for labels
   * @returns {string} returns.level - Level name
   *
   * @example
   * const colours = PDFVisualiserOverlays.getConfidenceColours(0.92);
   * ctx.fillStyle = colours.fill;
   * ctx.strokeStyle = colours.border;
   *
   * @since 1.0.0
   */
  static getConfidenceColours(confidenceRate) {
    const levelKey = this.getConfidenceLevelKey(confidenceRate);
    const colours = getConfidenceLevelColours(levelKey);
    return {
      fill: colours.fillColour,
      border: colours.borderColour,
      text: colours.borderColour, // Use border colour for text (good contrast)
    };
  }

  /**
   * @method getConfidenceLevelKey
   * @static
   * @description Gets the confidence level key for a given rate
   * @param {number} rate - Confidence rate (0-1)
   * @returns {string} Level key (HIGH, MEDIUM, LOW, VERY_LOW)
   * @private
   */
  static getConfidenceLevelKey(rate) {
    const levels = PDF_VISUALISER_CONFIG.CONFIDENCE_LEVELS;
    if (rate >= levels.HIGH.minThreshold) return "HIGH";
    if (rate >= levels.MEDIUM.minThreshold) return "MEDIUM";
    if (rate >= levels.LOW.minThreshold) return "LOW";
    return "VERY_LOW";
  }

  // ===========================================================================
  // OVERLAY DRAWING
  // ===========================================================================

  /**
   * @method drawOverlays
   * @static
   * @description Draws all confidence overlays for a page
   *
   * Main entry point for overlay rendering. Draws colour-coded boxes
   * for all lines on a page with optional percentage labels.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
   * @param {Object} pageData - Page data from lines.json
   * @param {Array<Object>} pageData.lines - Array of line objects
   * @param {number} pageData.page_width - Original page width
   * @param {number} pageData.page_height - Original page height
   * @param {Object} viewport - PDF.js viewport object
   * @param {Object} [options={}] - Drawing options
   * @param {boolean} [options.showOverlays=true] - Whether to draw overlay boxes
   * @param {boolean} [options.showLabels=true] - Whether to show percentage labels
   * @param {number} [options.dpr=1] - Device pixel ratio
   * @param {Set<string>} [options.lineTypes=null] - Filter to specific line types
   *
   * @returns {Object} Drawing result with statistics
   * @returns {number} returns.linesDrawn - Number of overlays drawn
   * @returns {number} returns.labelsDrawn - Number of labels drawn
   * @returns {number} returns.renderTimeMs - Rendering time in milliseconds
   *
   * @example
   * const result = PDFVisualiserOverlays.drawOverlays(ctx, pageData, viewport, {
   *   showLabels: true,
   *   showOverlays: true
   * });
   * console.log(`Drew ${result.linesDrawn} overlays`);
   *
   * @since 1.0.0
   */
  static drawOverlays(ctx, pageData, viewport, options = {}) {
    const startTime = performance.now();

    const {
      showOverlays = true,
      showLabels = true,
      dpr = PDF_VISUALISER_CONFIG.RENDERING.DEVICE_PIXEL_RATIO,
      lineTypes = null,
    } = options;

    logInfo("Drawing overlays", {
      pageNumber: pageData?.page,
      lineCount: pageData?.lines?.length,
      showOverlays,
      showLabels,
    });

    // Validate inputs
    if (!ctx || !pageData || !viewport) {
      logError("drawOverlays: Missing required parameters");
      return { linesDrawn: 0, labelsDrawn: 0, renderTimeMs: 0 };
    }

    const lines = pageData.lines || [];
    const pageWidth = pageData.page_width;
    const pageHeight = pageData.page_height;

    if (!pageWidth || !pageHeight) {
      logWarn("Page dimensions missing from pageData");
      return { linesDrawn: 0, labelsDrawn: 0, renderTimeMs: 0 };
    }

    // Clear canvas before drawing
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (!showOverlays) {
      logDebug("Overlays disabled, skipping draw");
      return {
        linesDrawn: 0,
        labelsDrawn: 0,
        renderTimeMs: performance.now() - startTime,
      };
    }

    let linesDrawn = 0;
    let labelsDrawn = 0;

    // Draw each line overlay
    let lineIndex = 0; // Track line index for toggletip labels
    for (const line of lines) {
      // Filter by line type if specified
      if (lineTypes && !lineTypes.has(line.type)) {
        continue;
      }

      // Get region from line (handles both region object and cnt array formats)
      const region = this.lineToRegion(line);

      // Skip lines without valid region data
      if (!region || (region.width === 0 && region.height === 0)) {
        logDebug("Line has no valid region data", {
          lineId: line.id,
          type: line.type,
        });
        continue;
      }

      // Get confidence rate
      const confidence = line.confidence_rate ?? line.confidence ?? 0;

      // Transform coordinates
      const coords = this.transformCoordinatesWithDPI(
        region,
        pageWidth,
        pageHeight,
        viewport,
        dpr
      );

      // Draw the overlay box
      this.drawOverlayBox(ctx, coords, confidence);
      linesDrawn++;

      // Draw label if enabled and box is large enough
      if (showLabels) {
        const minSize = PDF_VISUALISER_CONFIG.RENDERING.MIN_BOX_SIZE_FOR_LABEL;
        if (coords.width >= minSize && coords.height >= minSize) {
          this.drawConfidenceLabel(ctx, coords, confidence, dpr);
          labelsDrawn++;
        }
      }

      // Create accessible toggletip region (Stages 3 & 4)
      // Only create if UniversalToggletip is available
      if (typeof UniversalToggletip !== "undefined" && ctx.canvas) {
        // CRITICAL: UniversalToggletip expects canvas pixel coordinates
        // It internally scales to CSS pixels using canvas.offsetWidth/canvas.width
        // Therefore, we must use the SAME DPI-scaled coords as the visual overlays
        // (The 'coords' variable already has DPI scaling applied)

        // Determine position based on location (top half = show below, bottom half = show above)
        const preferredPosition =
          coords.y < ctx.canvas.height / 2 ? "bottom" : "top";

        try {
          UniversalToggletip.createCanvasRegion({
            canvas: ctx.canvas,
            region: {
              x: coords.x,
              y: coords.y,
              width: coords.width,
              height: coords.height,
            },
            content: buildToggletipContent(line),
            label: buildAccessibleLabel(line, lineIndex),
            type: getToggletipType(confidence),
            position: preferredPosition,
            maxWidth: 320,
          });

          logDebug(`Toggletip region created for line ${lineIndex + 1}`);
        } catch (error) {
          logWarn(
            `Failed to create toggletip region for line ${lineIndex + 1}`,
            error
          );
        }
      }

      lineIndex++; // Increment line index for next iteration
    }

    const renderTimeMs = performance.now() - startTime;

    logInfo("Overlays drawn", {
      linesDrawn,
      labelsDrawn,
      renderTimeMs: `${renderTimeMs.toFixed(2)}ms`,
    });

    return { linesDrawn, labelsDrawn, renderTimeMs };
  }

  /**
   * @method drawOverlayBox
   * @static
   * @description Draws a single confidence overlay box
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} coords - Transformed coordinates
   * @param {number} confidence - Confidence rate (0-1)
   *
   * @private
   * @since 1.0.0
   */
  static drawOverlayBox(ctx, coords, confidence) {
    const colours = this.getConfidenceColours(confidence);
    const borderWidth = PDF_VISUALISER_CONFIG.RENDERING.OVERLAY_BORDER_WIDTH;

    ctx.save();

    // Draw filled rectangle
    ctx.fillStyle = colours.fill;
    ctx.fillRect(coords.x, coords.y, coords.width, coords.height);

    // Draw border
    ctx.strokeStyle = colours.border;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(coords.x, coords.y, coords.width, coords.height);

    ctx.restore();
  }

  /**
   * @method drawConfidenceLabel
   * @static
   * @description Draws confidence percentage label on overlay
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} coords - Transformed coordinates
   * @param {number} confidence - Confidence rate (0-1)
   * @param {number} [dpr=1] - Device pixel ratio
   *
   * @private
   * @since 1.0.0
   */
  static drawConfidenceLabel(ctx, coords, confidence, dpr = 1) {
    const colours = this.getConfidenceColours(confidence);
    const config = PDF_VISUALISER_CONFIG.RENDERING;

    const fontSize = config.LABEL_FONT_SIZE * dpr;
    const padding = config.LABEL_PADDING * dpr;
    const labelText = formatPercentage(confidence, 0);

    ctx.save();

    // Set font
    ctx.font = `${fontSize}px ${config.LABEL_FONT_FAMILY}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // Measure text for background
    const textMetrics = ctx.measureText(labelText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;

    // Position label in top-left corner of box
    const labelX = coords.x + padding;
    const labelY = coords.y + padding;

    // Draw label background for readability
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillRect(
      labelX - padding / 2,
      labelY - padding / 2,
      textWidth + padding,
      textHeight + padding
    );

    // Draw text
    ctx.fillStyle = colours.text;
    ctx.fillText(labelText, labelX, labelY);

    ctx.restore();
  }

  // ===========================================================================
  // HIGHLIGHT SPECIFIC LINE
  // ===========================================================================

  /**
   * @method highlightLine
   * @static
   * @description Highlights a specific line (e.g., on hover)
   *
   * Draws a more prominent overlay for a single line, useful for
   * interactive highlighting on mouse hover.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} line - Line object from lines.json
   * @param {number} pageWidth - Page width
   * @param {number} pageHeight - Page height
   * @param {Object} viewport - PDF.js viewport
   * @param {Object} [options={}] - Highlight options
   * @param {number} [options.dpr=1] - Device pixel ratio
   * @param {string} [options.highlightColour='rgba(59, 130, 246, 0.5)'] - Highlight colour
   *
   * @since 1.0.0
   */
  static highlightLine(
    ctx,
    line,
    pageWidth,
    pageHeight,
    viewport,
    options = {}
  ) {
    const {
      dpr = PDF_VISUALISER_CONFIG.RENDERING.DEVICE_PIXEL_RATIO,
      highlightColour = "rgba(59, 130, 246, 0.5)", // Blue highlight
    } = options;

    // Get region using helper (handles both region and cnt formats)
    const region = this.lineToRegion(line);
    if (!region || (region.width === 0 && region.height === 0)) {
      return;
    }

    const coords = this.transformCoordinatesWithDPI(
      region,
      pageWidth,
      pageHeight,
      viewport,
      dpr
    );

    ctx.save();

    // Draw highlight overlay
    ctx.fillStyle = highlightColour;
    ctx.fillRect(coords.x, coords.y, coords.width, coords.height);

    // Draw prominent border
    ctx.strokeStyle = "rgba(59, 130, 246, 1)";
    ctx.lineWidth = 3 * dpr;
    ctx.strokeRect(coords.x, coords.y, coords.width, coords.height);

    ctx.restore();
  }

  // ===========================================================================
  // LEGEND DRAWING
  // ===========================================================================

  /**
   * @method drawLegend
   * @static
   * @description Draws a legend explaining confidence level colours
   *
   * Renders a colour-coded legend showing all confidence levels
   * and their corresponding colours.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position for legend
   * @param {number} y - Y position for legend
   * @param {Object} [options={}] - Legend options
   * @param {number} [options.dpr=1] - Device pixel ratio
   * @param {number} [options.swatchSize=16] - Size of colour swatches
   * @param {number} [options.spacing=20] - Spacing between items
   *
   * @returns {Object} Legend dimensions { width, height }
   *
   * @since 1.0.0
   */
  static drawLegend(ctx, x, y, options = {}) {
    const {
      dpr = PDF_VISUALISER_CONFIG.RENDERING.DEVICE_PIXEL_RATIO,
      swatchSize = 16,
      spacing = 24,
    } = options;

    const levels = PDF_VISUALISER_CONFIG.CONFIDENCE_LEVELS;
    const levelOrder = ["HIGH", "MEDIUM", "LOW", "VERY_LOW"];

    const fontSize = 12 * dpr;
    const actualSwatchSize = swatchSize * dpr;
    const actualSpacing = spacing * dpr;
    const padding = 8 * dpr;

    ctx.save();
    ctx.font = `${fontSize}px ${PDF_VISUALISER_CONFIG.RENDERING.LABEL_FONT_FAMILY}`;

    let currentY = y + padding;
    let maxWidth = 0;

    // Draw title
    ctx.fillStyle = "#374151";
    ctx.textBaseline = "top";
    ctx.fillText("Confidence Level", x + padding, currentY);
    currentY += fontSize + padding;

    // Draw each level
    for (const levelKey of levelOrder) {
      const level = levels[levelKey];

      // Draw colour swatch
      ctx.fillStyle = level.fillColour;
      ctx.fillRect(x + padding, currentY, actualSwatchSize, actualSwatchSize);
      ctx.strokeStyle = level.borderColour;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + padding, currentY, actualSwatchSize, actualSwatchSize);

      // Draw label
      ctx.fillStyle = "#374151";
      ctx.fillText(
        level.legendLabel,
        x + padding + actualSwatchSize + padding,
        currentY + (actualSwatchSize - fontSize) / 2
      );

      // Track max width
      const textWidth = ctx.measureText(level.legendLabel).width;
      const itemWidth =
        padding + actualSwatchSize + padding + textWidth + padding;
      maxWidth = Math.max(maxWidth, itemWidth);

      currentY += actualSpacing;
    }

    ctx.restore();

    return {
      width: maxWidth,
      height: currentY - y,
    };
  }

  // ===========================================================================
  // HIT TESTING
  // ===========================================================================

  /**
   * @method findLineAtPoint
   * @static
   * @description Finds which line (if any) contains a given point
   *
   * Used for hover/click detection to identify which line the user
   * is interacting with.
   *
   * @param {number} x - X coordinate (canvas space)
   * @param {number} y - Y coordinate (canvas space)
   * @param {Object} pageData - Page data from lines.json
   * @param {Object} viewport - PDF.js viewport
   * @param {Object} [options={}] - Options
   * @param {number} [options.dpr=1] - Device pixel ratio
   *
   * @returns {Object|null} Line object if found, null otherwise
   *
   * @example
   * canvas.addEventListener('mousemove', (e) => {
   *   const line = PDFVisualiserOverlays.findLineAtPoint(
   *     e.offsetX, e.offsetY, pageData, viewport
   *   );
   *   if (line) {
   *     console.log('Hovering over:', line.text);
   *   }
   * });
   *
   * @since 1.0.0
   */
  static findLineAtPoint(x, y, pageData, viewport, options = {}) {
    const { dpr = PDF_VISUALISER_CONFIG.RENDERING.DEVICE_PIXEL_RATIO } =
      options;

    if (!pageData?.lines || !viewport) {
      return null;
    }

    const pageWidth = pageData.page_width;
    const pageHeight = pageData.page_height;

    // Adjust point for DPR
    const adjustedX = x * dpr;
    const adjustedY = y * dpr;

    // Check each line (in reverse order to match visual stacking)
    const lines = [...pageData.lines].reverse();

    for (const line of lines) {
      // Get region using helper (handles both region and cnt formats)
      const region = this.lineToRegion(line);
      if (!region || (region.width === 0 && region.height === 0)) continue;

      const coords = this.transformCoordinatesWithDPI(
        region,
        pageWidth,
        pageHeight,
        viewport,
        dpr
      );

      // Check if point is inside box
      if (
        adjustedX >= coords.x &&
        adjustedX <= coords.x + coords.width &&
        adjustedY >= coords.y &&
        adjustedY <= coords.y + coords.height
      ) {
        return line;
      }
    }

    return null;
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * @method clearOverlays
   * @static
   * @description Clears all overlays from canvas
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   *
   * @since 1.0.0
   */
  static clearOverlays(ctx) {
    if (ctx && ctx.canvas) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      logDebug("Overlays cleared");
    }
  }

  /**
   * @method setupCanvasForHiDPI
   * @static
   * @description Configures canvas for high-DPI rendering
   *
   * Sets up canvas dimensions and scaling for crisp rendering
   * on high-DPI displays.
   *
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {number} width - Desired CSS width
   * @param {number} height - Desired CSS height
   * @param {number} [dpr] - Device pixel ratio (auto-detected if not provided)
   *
   * @returns {CanvasRenderingContext2D} Configured context
   *
   * @since 1.0.0
   */
  static setupCanvasForHiDPI(canvas, width, height, dpr = null) {
    const ratio = dpr ?? window.devicePixelRatio ?? 1;

    // Set actual size in memory
    canvas.width = width * ratio;
    canvas.height = height * ratio;

    // Set display size
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Get context and scale
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);

    logDebug("Canvas configured for HiDPI", {
      cssSize: { width, height },
      actualSize: { width: canvas.width, height: canvas.height },
      dpr: ratio,
    });

    return ctx;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default PDFVisualiserOverlays;

export { PDFVisualiserOverlays };

// =============================================================================
// GLOBAL EXPOSURE FOR TESTING
// =============================================================================

if (typeof window !== "undefined") {
  window.PDFVisualiserOverlays = PDFVisualiserOverlays;

  /**
   * Test overlay drawing with mock data
   */
  window.testPDFOverlays = () => {
    console.log("🧪 Testing PDF Visualiser Overlays");

    // Test coordinate transformation
    console.log("\n📐 Testing coordinate transformation:");
    const testRegion = {
      top_left_x: 100,
      top_left_y: 200,
      width: 500,
      height: 40,
    };
    const mockViewport = { width: 612, height: 792 }; // Letter size at 72 DPI
    const transformed = PDFVisualiserOverlays.transformCoordinates(
      testRegion,
      2550,
      3300,
      mockViewport
    );
    console.table({
      "Original X": testRegion.top_left_x,
      "Original Y": testRegion.top_left_y,
      "Original Width": testRegion.width,
      "Original Height": testRegion.height,
      "Transformed X": transformed.x.toFixed(2),
      "Transformed Y": transformed.y.toFixed(2),
      "Transformed Width": transformed.width.toFixed(2),
      "Transformed Height": transformed.height.toFixed(2),
    });

    // Test colour selection
    console.log("\n🎨 Testing confidence colours:");
    const testConfidences = [0.98, 0.85, 0.72, 0.45];
    for (const conf of testConfidences) {
      const colours = PDFVisualiserOverlays.getConfidenceColours(conf);
      console.log(
        `${(conf * 100).toFixed(0)}%: ${colours.level} - ${colours.border}`
      );
    }

    console.log("\n✅ Overlay tests complete");
    return true;
  };
}
