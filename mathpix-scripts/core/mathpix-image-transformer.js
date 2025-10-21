/**
 * @fileoverview MathPix Image Transformer - Canvas-based image transformation utilities
 * @module MathPixImageTransformer
 * @requires ./mathpix-base-module.js
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 1.0.0 (Phase 1F.2)
 *
 * @description
 * Provides canvas-based image transformation utilities for the MathPix system.
 * Handles rotation, flipping, and file format conversion with WYSIWYG preview support.
 *
 * Key Features:
 * - Canvas rotation (90° increments)
 * - Horizontal flip transformation
 * - File format conversion (JPEG → PNG)
 * - Metadata preservation through transformations
 * - WYSIWYG preview support with CSS transforms
 *
 * Integration:
 * - Used by MathPixFileHandler for camera capture transformations
 * - Extends MathPixBaseModule for consistent architecture
 * - Integrates with notification system for user feedback
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant transformation operations
 * - Preserves image accessibility metadata
 * - Provides user feedback for transformation operations
 */

// Logging configuration (module level)
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
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

import MathPixBaseModule from "./mathpix-base-module.js";

/**
 * @class MathPixImageTransformer
 * @extends MathPixBaseModule
 * @description
 * Handles canvas-based image transformations for the MathPix system.
 * Provides utilities for rotating, flipping, and converting image files
 * with support for WYSIWYG preview transformations.
 *
 * @example
 * const transformer = new MathPixImageTransformer(controller);
 * const rotatedFile = await transformer.applyTransforms(file, {
 *   rotation: 90,
 *   flipped: true
 * });
 *
 * @since 1.0.0 (Phase 1F.2)
 */
class MathPixImageTransformer extends MathPixBaseModule {
  /**
   * @constructor
   * @description Creates new MathPixImageTransformer instance
   *
   * @param {MathPixController} controller - Main MathPix controller instance
   *
   * @example
   * const transformer = new MathPixImageTransformer(mathPixController);
   *
   * @since 1.0.0 (Phase 1F.2)
   */
  constructor(controller) {
    super(controller);
    this.isInitialised = true;
    logInfo("MathPixImageTransformer initialised");
  }

  /**
   * @method applyTransforms
   * @description
   * Applies rotation and flip transformations to an image file.
   * Creates a new PNG file with transformations applied via canvas operations.
   *
   * @param {File} file - Original image file
   * @param {Object} transforms - Transform configuration
   * @param {number} transforms.rotation - Rotation angle (0, 90, 180, 270)
   * @param {boolean} transforms.flipped - Whether to flip horizontally
   * @returns {Promise<File>} New PNG file with transformations applied
   *
   * @throws {Error} If file loading or canvas operations fail
   *
   * @example
   * const transformedFile = await transformer.applyTransforms(file, {
   *   rotation: 90,
   *   flipped: true
   * });
   *
   * @since 1.0.0 (Phase 1F.2)
   */
  async applyTransforms(file, transforms) {
    try {
      logInfo("Applying transforms to file", {
        fileName: file.name,
        rotation: transforms.rotation,
        flipped: transforms.flipped,
      });

      // Load image from file
      const img = await this.loadImageFromFile(file);

      // Create canvas with appropriate dimensions based on rotation
      const canvas = this.createTransformCanvas(img, transforms.rotation);
      const ctx = canvas.getContext("2d");

      // Apply transformations
      this.applyCanvasTransforms(ctx, canvas, img, transforms);

      // Draw the image
      ctx.drawImage(img, 0, 0);

      // Convert canvas to PNG file
      const transformedFile = await this.canvasToFile(
        canvas,
        file.name,
        transforms
      );

      logInfo("Transforms applied successfully", {
        originalSize: file.size,
        transformedSize: transformedFile.size,
      });

      return transformedFile;
    } catch (error) {
      logError("Failed to apply transforms", {
        error: error.message,
        fileName: file.name,
      });
      throw error;
    }
  }

  /**
   * @method loadImageFromFile
   * @description
   * Loads an image from a File object and returns an Image element.
   *
   * @param {File} file - Image file to load
   * @returns {Promise<HTMLImageElement>} Loaded image element
   * @private
   *
   * @example
   * const img = await transformer.loadImageFromFile(file);
   *
   * @since 1.0.0 (Phase 1F.2)
   */
  loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image from file"));
      };

      img.src = url;
    });
  }

  /**
   * @method createTransformCanvas
   * @description
   * Creates a canvas with dimensions appropriate for the rotation angle.
   * For 90° and 270° rotations, width and height are swapped.
   *
   * @param {HTMLImageElement} img - Source image
   * @param {number} rotation - Rotation angle (0, 90, 180, 270)
   * @returns {HTMLCanvasElement} Canvas element with correct dimensions
   * @private
   *
   * @example
   * const canvas = transformer.createTransformCanvas(img, 90);
   *
   * @since 1.0.0 (Phase 1F.2)
   */
  createTransformCanvas(img, rotation) {
    const canvas = document.createElement("canvas");

    // For 90° and 270° rotations, swap width and height
    if (rotation === 90 || rotation === 270) {
      canvas.width = img.height;
      canvas.height = img.width;
    } else {
      canvas.width = img.width;
      canvas.height = img.height;
    }

    logDebug("Canvas created for rotation", {
      rotation,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      imageWidth: img.width,
      imageHeight: img.height,
    });

    return canvas;
  }

  /**
   * @method applyCanvasTransforms
   * @description
   * Applies rotation and flip transformations to canvas context.
   * Sets up the transformation matrix for drawing the image.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {HTMLImageElement} img - Source image
   * @param {Object} transforms - Transform configuration
   * @param {number} transforms.rotation - Rotation angle (0, 90, 180, 270)
   * @param {boolean} transforms.flipped - Whether to flip horizontally
   * @returns {void}
   * @private
   *
   * @example
   * transformer.applyCanvasTransforms(ctx, canvas, img, {
   *   rotation: 90,
   *   flipped: true
   * });
   *
   * @since 1.0.0 (Phase 1F.2)
   */
  applyCanvasTransforms(ctx, canvas, img, transforms) {
    const { rotation, flipped } = transforms;

    // Move origin to center for rotations
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Apply rotation
    if (rotation) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    // Apply horizontal flip
    if (flipped) {
      ctx.scale(-1, 1);
    }

    // Move back to draw position
    ctx.translate(-img.width / 2, -img.height / 2);

    logDebug("Canvas transforms applied", {
      rotation,
      flipped,
      centerX: canvas.width / 2,
      centerY: canvas.height / 2,
    });
  }

  /**
   * @method canvasToFile
   * @description
   * Converts canvas content to a PNG File object with appropriate naming.
   * Adds "-transformed" suffix to filename and preserves metadata.
   *
   * @param {HTMLCanvasElement} canvas - Canvas to convert
   * @param {string} originalFileName - Original file name
   * @param {Object} transforms - Transform configuration for metadata
   * @returns {Promise<File>} PNG file with transformed image
   * @private
   *
   * @example
   * const file = await transformer.canvasToFile(canvas, "photo.jpg", transforms);
   *
   * @since 1.0.0 (Phase 1F.2)
   */
  canvasToFile(canvas, originalFileName, transforms) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to convert canvas to blob"));
            return;
          }

          // Generate new filename with -transformed suffix
          const newFileName =
            this.generateTransformedFileName(originalFileName);

          // Create File object
          const file = new File([blob], newFileName, {
            type: "image/png",
            lastModified: Date.now(),
          });

          // Preserve transform metadata
          file.transformMetadata = {
            rotation: transforms.rotation,
            flipped: transforms.flipped,
            originalFileName: originalFileName,
            transformedAt: new Date().toISOString(),
          };

          logDebug("Canvas converted to file", {
            fileName: newFileName,
            size: file.size,
            type: file.type,
          });

          resolve(file);
        },
        "image/png",
        0.95 // High quality PNG
      );
    });
  }

  /**
   * @method generateTransformedFileName
   * @description
   * Generates a new filename with "-transformed" suffix and PNG extension.
   *
   * @param {string} originalFileName - Original file name
   * @returns {string} New filename with -transformed suffix
   * @private
   *
   * @example
   * const newName = transformer.generateTransformedFileName("photo.jpg");
   * // Returns: "photo-transformed.png"
   *
   * @since 1.0.0 (Phase 1F.2)
   */
  generateTransformedFileName(originalFileName) {
    // Remove extension
    const nameWithoutExt = originalFileName.replace(/\.[^/.]+$/, "");
    // Add -transformed suffix and PNG extension
    return `${nameWithoutExt}-transformed.png`;
  }

  /**
   * @method getCSSTransform
   * @description
   * Generates CSS transform string for preview display.
   * Used for instant visual feedback before applying canvas transforms.
   *
   * @param {Object} transforms - Transform configuration
   * @param {number} transforms.rotation - Rotation angle (0, 90, 180, 270)
   * @param {boolean} transforms.flipped - Whether to flip horizontally
   * @returns {string} CSS transform string
   *
   * @example
   * const cssTransform = transformer.getCSSTransform({
   *   rotation: 90,
   *   flipped: true
   * });
   * // Returns: "rotate(90deg) scaleX(-1)"
   *
   * @since 1.0.0 (Phase 1F.2)
   */
  getCSSTransform(rotation, flipped) {
    const parts = [];

    if (rotation) {
      parts.push(`rotate(${rotation}deg)`);
    }

    if (flipped) {
      parts.push("scaleX(-1)");
    }

    return parts.join(" ");
  }

  /**
   * @method getTransformDescription
   * @description
   * Generates human-readable description of current transforms.
   * Used for displaying transform state to users.
   *
   * @param {Object} transforms - Transform configuration
   * @param {number} transforms.rotation - Rotation angle (0, 90, 180, 270)
   * @param {boolean} transforms.flipped - Whether to flip horizontally
   * @returns {string} Human-readable transform description
   *
   * @example
   * const description = transformer.getTransformDescription({
   *   rotation: 90,
   *   flipped: true
   * });
   * // Returns: "Rotated 90° • Flipped Horizontally"
   *
   * @since 1.0.0 (Phase 1F.2)
   */
  getTransformDescription(rotation, flipped) {
    const parts = [];

    if (rotation) {
      parts.push(`Rotated ${rotation}°`);
    }

    if (flipped) {
      parts.push("Flipped Horizontally");
    }

    if (parts.length === 0) {
      return "No transforms";
    }

    return parts.join(" • ");
  }
}

export default MathPixImageTransformer;
