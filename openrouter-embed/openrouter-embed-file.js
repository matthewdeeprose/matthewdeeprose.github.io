/**
 * OpenRouter Embed API - File Utilities (Stage 2 + Memory Management)
 *
 * File handling utilities for image and PDF attachment
 * with validation, cost estimation, and message formatting.
 *
 * Enhanced with comprehensive memory management to prevent browser freezes.
 *
 * @version 1.1.0 (Stage 2 + Memory Management)
 * @author OpenRouter Embed Development Team
 * @date 25 November 2025
 */

// ============================================================================
// MEMORY MANAGEMENT IMPORTS
// ============================================================================

// Import memory management utilities
let MemoryMonitor, ResourceTracker, CircuitBreaker;

// Dynamic import with fallback
(async () => {
  try {
    const memoryModule = await import("../js/utilities/memory-manager.js");
    MemoryMonitor = memoryModule.MemoryMonitor;
    ResourceTracker = memoryModule.ResourceTracker;
    CircuitBreaker = memoryModule.CircuitBreaker;
    console.log("[EmbedFileUtils] Memory management utilities loaded");
  } catch (error) {
    console.warn(
      "[EmbedFileUtils] Memory management utilities not available:",
      error.message
    );
    // Create no-op fallbacks
    MemoryMonitor = {
      track: () => {},
      getMemoryInfo: () => ({ unavailable: true }),
    };
    ResourceTracker = {
      track: () => {},
      release: () => {},
      forceCleanup: () => {},
    };
    CircuitBreaker = {
      execute: async (operation) => await operation(),
    };
  }
})();

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
    console.error(`[EmbedFileUtils ERROR] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[EmbedFileUtils WARN] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[EmbedFileUtils INFO] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[EmbedFileUtils DEBUG] ${message}`, ...args);
}

// ============================================================================
// FILE VALIDATION CONSTANTS
// ============================================================================

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SUPPORTED_PDF_TYPES = ["application/pdf"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25MB

// Cost thresholds for warnings
const COST_THRESHOLDS = {
  YELLOW: 0.05, // Â£0.05+
  ORANGE: 0.5, // Â£0.50+
  RED: 2.0, // Â£2.00+
};

// ============================================================================
// IMAGE COMPRESSION CONFIGURATION
// ============================================================================

/**
 * Optimal compression settings based on performance testing
 *
 * Test results showed:
 * - 92.17 ms/KB latency relationship with OpenRouter API
 * - 70% JPEG quality optimal balance (size vs quality)
 * - 200KB threshold where compression benefits become significant
 * - Target ~150-200KB for best performance
 */
const COMPRESSION_CONFIG = {
  // Enable compression by default
  ENABLED: true,

  // File size threshold for automatic compression (bytes)
  // Images under this size perform acceptably without compression
  SIZE_THRESHOLD: 200 * 1024, // 200KB

  // Maximum dimensions for compressed images
  MAX_WIDTH: 1200,
  MAX_HEIGHT: 900,

  // JPEG quality (0.0 - 1.0)
  // 0.7 (70%) provides optimal balance based on testing
  QUALITY: 0.7,

  // Latency formula from performance testing
  // Used to calculate estimated time savings
  MS_PER_KB: 92.17,

  // Canvas image smoothing quality
  SMOOTHING_QUALITY: "high", // 'low', 'medium', 'high'
};

// ============================================================================
// EMBED FILE UTILITIES CLASS
// ============================================================================

class EmbedFileUtils {
  constructor(config = {}) {
    // Merge with default compression config
    this.compressionConfig = {
      ...COMPRESSION_CONFIG,
      ...(config.compression || {}),
    };

    // Storage for last compression metrics (Stage 5 Phase 1)
    this._lastCompressionMetrics = null;

    logInfo("EmbedFileUtils initialised", {
      compressionEnabled: this.compressionConfig.ENABLED,
      threshold: this.compressionConfig.SIZE_THRESHOLD,
      quality: this.compressionConfig.QUALITY,
    });
  }

  // ==========================================================================
  // FILE VALIDATION
  // ==========================================================================

  /**
   * Validate a file for attachment (type and size)
   *
   * @param {File} file - The file to validate
   * @param {Object} options - Validation options
   * @param {boolean} options.skipSizeCheck - Skip size validation (for pre-compression check)
   * @returns {Object} Validation result with isImage and isPDF flags
   * @throws {Error} If file is invalid
   */
  validateFile(file, options = {}) {
    logDebug("Validating file...", {
      name: file?.name,
      type: file?.type,
      size: file?.size,
      skipSizeCheck: options.skipSizeCheck || false,
    });

    // Check file exists and is a File object
    if (!file || !(file instanceof File)) {
      const error = "Invalid file: must be a File object";
      logError(error);
      throw new Error(error);
    }

    // Check file type
    const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type);
    const isPDF = SUPPORTED_PDF_TYPES.includes(file.type);

    if (!isImage && !isPDF) {
      const error =
        `Unsupported file type: ${file.type}. ` +
        `Supported types: JPEG, PNG, WebP, PDF`;
      logError(error);
      throw new Error(error);
    }

    // Check file size (unless skipped for pre-compression validation)
    if (!options.skipSizeCheck) {
      const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_PDF_SIZE;
      if (file.size > maxSize) {
        const maxMB = maxSize / (1024 * 1024);
        const fileMB = (file.size / (1024 * 1024)).toFixed(2);
        const error =
          `File too large: ${fileMB}MB. ` +
          `Maximum size for ${isImage ? "images" : "PDFs"}: ${maxMB}MB`;
        logError(error);
        throw new Error(error);
      }
    }

    logDebug("File validation passed", {
      isImage,
      isPDF,
      skipSizeCheck: options.skipSizeCheck,
    });

    return { isImage, isPDF };
  }

  /**
   * Validate file type only (no size check)
   * Used before compression when original file may exceed limits
   *
   * @param {File} file - The file to validate
   * @returns {Object} Validation result with isImage and isPDF flags
   * @throws {Error} If file type is invalid
   */
  validateFileType(file) {
    return this.validateFile(file, { skipSizeCheck: true });
  }

  /**
   * Validate file size only
   * Used after compression to check processed file
   *
   * @param {File} file - The file to validate
   * @param {number} originalSize - Original file size (for error message context)
   * @returns {boolean} True if size is valid
   * @throws {Error} If file is too large
   */
  validateFileSize(file, originalSize = null) {
    const { isImage } = this.validateFileType(file);
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_PDF_SIZE;

    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      const fileMB = (file.size / (1024 * 1024)).toFixed(2);

      let error = `File too large: ${fileMB}MB. Maximum size: ${maxMB}MB.`;

      // Add context if we know original size (compression wasn't enough)
      if (originalSize && originalSize !== file.size) {
        const originalMB = (originalSize / (1024 * 1024)).toFixed(2);
        error = `File still too large after compression: ${fileMB}MB (was ${originalMB}MB). Maximum size: ${maxMB}MB.`;
      }

      logError(error);
      throw new Error(error);
    }

    logDebug("File size validation passed", { size: file.size, maxSize });
    return true;
  }

  // ==========================================================================
  // BASE64 CONVERSION
  // ==========================================================================

  /**
   * Convert file to base64 string
   *
   * @param {File} file - The file to convert
   * @returns {Promise<string>} Base64 encoded file data
   */
  async fileToBase64(file) {
    const operationId = `fileToBase64_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    logInfo("Converting file to base64...", {
      name: file.name,
      size: file.size,
      operationId,
    });

    // Track memory before operation
    if (MemoryMonitor) {
      MemoryMonitor.track("fileToBase64_start", {
        fileName: file.name,
        fileSize: file.size,
        operationId,
      });
    }

    let reader = null;

    try {
      // Use circuit breaker protection if available
      const performConversion = async () => {
        return new Promise((resolve, reject) => {
          reader = new FileReader();

          // Track the reader resource
          if (ResourceTracker) {
            ResourceTracker.track("readers", reader, operationId);
          }

          // Set timeout for large files
          const timeout = setTimeout(() => {
            if (reader && reader.readyState === 1) {
              reader.abort();
              reject(new Error("File conversion timeout (30s)"));
            }
          }, 30000);

          reader.onload = () => {
            clearTimeout(timeout);

            // Remove data URL prefix (data:image/jpeg;base64,...)
            const base64 = reader.result.split(",")[1];

            logDebug("File converted to base64", {
              length: base64.length,
              operationId,
            });

            // Track memory after conversion
            if (MemoryMonitor) {
              MemoryMonitor.track("fileToBase64_complete", {
                base64Length: base64.length,
                operationId,
              });
            }

            resolve(base64);
          };

          reader.onerror = () => {
            clearTimeout(timeout);
            logError("Failed to read file", reader.error);

            // Track failure
            if (MemoryMonitor) {
              MemoryMonitor.track("fileToBase64_error", {
                error: reader.error?.message || "Unknown error",
                operationId,
              });
            }

            reject(new Error("Failed to read file: " + reader.error));
          };

          reader.readAsDataURL(file);
        });
      };

      // Execute with circuit breaker if available
      if (CircuitBreaker) {
        return await CircuitBreaker.execute(
          performConversion,
          `fileToBase64(${file.name})`
        );
      } else {
        return await performConversion();
      }
    } finally {
      // Critical cleanup
      if (reader) {
        try {
          // Clear reader reference
          reader.onload = null;
          reader.onerror = null;

          // Release tracked resource
          if (ResourceTracker) {
            ResourceTracker.release("readers", operationId);
          }

          reader = null;
        } catch (e) {
          logDebug("Reader cleanup warning:", e.message);
        }
      }

      // Track final cleanup
      if (MemoryMonitor) {
        MemoryMonitor.track("fileToBase64_cleanup", { operationId });
      }

      // Suggest garbage collection for large files (>5MB)
      if (file.size > 5 * 1024 * 1024 && window.gc) {
        window.gc();
        logDebug("Garbage collection suggested for large file");
      }
    }
  }

  // ==========================================================================
  // IMAGE COMPRESSION
  // ==========================================================================

  /**
   * Determine if image should be compressed
   * Based on file size and compression configuration
   *
   * @param {File} file - Image file to check
   * @returns {boolean} True if should compress
   */
  /**
   * Alias for shouldCompressImage for API consistency (Stage 5 Phase 1)
   * Matches the naming convention in the Stage 5 documentation
   *
   * @param {File} file - The file to check
   * @param {number} threshold - Optional size threshold override in bytes
   * @returns {boolean} True if file should be compressed
   */
  shouldCompress(file, threshold = null) {
    // Use custom threshold if provided, otherwise use config
    const effectiveThreshold =
      threshold !== null ? threshold : this.compressionConfig.SIZE_THRESHOLD;

    // Check if compression is enabled
    if (!this.compressionConfig.ENABLED) {
      logDebug("Compression disabled in config");
      return false;
    }

    // Check if file is an image
    try {
      const { isImage } = this.validateFileType(file);
      if (!isImage) {
        logDebug("File is not an image, skipping compression");
        return false;
      }
    } catch (error) {
      logDebug("File validation failed in shouldCompress", error);
      return false;
    }

    // Check if file exceeds threshold
    const shouldCompress = file.size > effectiveThreshold;

    logDebug("Compression decision", {
      fileSize: file.size,
      threshold: effectiveThreshold,
      shouldCompress,
    });

    return shouldCompress;
  }

  /**
   * Get metrics from the last compression operation (Stage 5 Phase 1)
   *
   * @returns {Object|null} Last compression metrics or null if no compression performed
   */
  getCompressionMetrics() {
    return this._lastCompressionMetrics || null;
  }

  /**
   * Clear stored compression metrics (Stage 5 Phase 1)
   */
  clearCompressionMetrics() {
    this._lastCompressionMetrics = null;
    logDebug("Compression metrics cleared");
  }
  /**
   * Compress image file for optimal API performance
   *
   * Based on comprehensive performance testing:
   * - 92.17 ms/KB latency with OpenRouter API
   * - 70% JPEG quality optimal balance
   * - Compression reduces latency by 60-80% for large images
   *
   * Transparency handling:
   * - JPEG inputs â†’ JPEG output (no transparency to preserve)
   * - PNG/WebP inputs â†’ WebP output (preserves transparency)
   *
   * @param {File} file - Original image file
   * @param {Object} options - Compression options (optional)
   * @returns {Promise<Object>} Compression result with file and metrics
   */
  async compressImage(file, options = {}) {
    const startTime = Date.now();

    logInfo("Compressing image...", {
      name: file.name,
      originalSize: file.size,
      originalType: file.type,
    });

    // Merge options with config
    const maxWidth = options.maxWidth || this.compressionConfig.MAX_WIDTH;
    const maxHeight = options.maxHeight || this.compressionConfig.MAX_HEIGHT;
    const quality = options.quality || this.compressionConfig.QUALITY;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          try {
            // Calculate new dimensions maintaining aspect ratio
            let width = img.width;
            let height = img.height;

            const needsResize = width > maxWidth || height > maxHeight;

            if (needsResize) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.floor(width * ratio);
              height = Math.floor(height * ratio);
              logDebug("Image resized", {
                original: `${img.width}x${img.height}`,
                new: `${width}x${height}`,
                ratio: ratio.toFixed(3),
              });
            } else {
              logDebug("Image within size limits, only adjusting quality");
            }

            // Create canvas and draw resized image
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");

            // Use high-quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality =
              this.compressionConfig.SMOOTHING_QUALITY;

            ctx.drawImage(img, 0, 0, width, height);

            // Always use WebP for output - best compression, supports transparency
            // WebP gives ~25-35% better compression than JPEG at equivalent quality
            const inputType = file.type;
            const outputType = "image/webp";
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const outputName = baseName + ".webp";

            logDebug("Compression output format", {
              inputType,
              outputType,
              outputName,
            });

            // Convert to blob with quality setting
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error("Failed to compress image"));
                  return;
                }

                // Create new compressed file
                const compressedFile = new File([blob], outputName, {
                  type: outputType,
                  lastModified: Date.now(),
                });

                // Calculate metrics
                const originalSize = file.size;
                const compressedSize = compressedFile.size;
                const savings = (
                  (1 - compressedSize / originalSize) *
                  100
                ).toFixed(1);
                const compressionTime = Date.now() - startTime;

                // Calculate estimated time savings using performance formula
                const originalKB = originalSize / 1024;
                const compressedKB = compressedSize / 1024;
                const estimatedOriginalTime = Math.round(
                  (originalKB * this.compressionConfig.MS_PER_KB) / 1000
                );
                const estimatedCompressedTime = Math.round(
                  (compressedKB * this.compressionConfig.MS_PER_KB) / 1000
                );
                const estimatedTimeSavings =
                  estimatedOriginalTime - estimatedCompressedTime;

                const result = {
                  file: compressedFile,
                  originalSize,
                  compressedSize,
                  savings: parseFloat(savings),
                  compressionTime,
                  estimatedTimeSavings,
                  dimensions: {
                    original: { width: img.width, height: img.height },
                    compressed: { width, height },
                  },
                  quality,
                  formatConversion: {
                    from: inputType,
                    to: outputType,
                    transparencyPreserved: outputType === "image/webp",
                  },
                };

                logInfo("Image compression complete", {
                  originalSize,
                  compressedSize,
                  savings: `${savings}%`,
                  compressionTime: `${compressionTime}ms`,
                  estimatedTimeSavings: `${estimatedTimeSavings}s`,
                  format: `${inputType} â†’ ${outputType}`,
                });

                // Store metrics for later retrieval (Stage 5 Phase 1)
                this._lastCompressionMetrics = {
                  originalSize,
                  compressedSize,
                  savings: parseFloat(savings),
                  savingsPercent: parseFloat(savings),
                  dimensions: {
                    original: { width: img.width, height: img.height },
                    compressed: { width, height },
                  },
                  format: outputType,
                  quality,
                  duration: compressionTime,
                };

                // Cleanup resources
                this._cleanupCompressionResources(img, canvas, reader);

                resolve(result);
              },
              outputType,
              quality
            );
          } catch (error) {
            logError("Canvas processing failed", error);
            this._cleanupCompressionResources(img, canvas, reader);
            reject(error);
          }
        };

        img.onerror = () => {
          const error = new Error("Failed to load image for compression");
          logError(error.message);
          this._cleanupCompressionResources(img, canvas, reader);
          reject(error);
        };

        img.src = e.target.result;
      };

      reader.onerror = () => {
        const error = new Error("Failed to read file for compression");
        logError(error.message, reader.error);
        this._cleanupCompressionResources(img, canvas, reader);
        reject(error);
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Clean up compression resources (Stage 5 Phase 1)
   * Prevents memory leaks by releasing canvas, image, and reader objects
   *
   * @param {HTMLImageElement} img - Image element to cleanup
   * @param {HTMLCanvasElement} canvas - Canvas element to cleanup
   * @param {FileReader} reader - FileReader to cleanup (optional)
   * @private
   */
  _cleanupCompressionResources(img, canvas, reader = null) {
    // Track with Memory Manager if available
    if (window.MemoryMonitor) {
      window.MemoryMonitor.track("EmbedFileUtils_cleanup", {
        hasImage: !!img,
        hasCanvas: !!canvas,
        hasReader: !!reader,
      });
    }

    // Clear image
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.src = "";
      if (window.ResourceTracker) {
        window.ResourceTracker.release("images", "compression_img");
      }
    }

    // Clear canvas
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 0;
      canvas.height = 0;
      if (window.ResourceTracker) {
        window.ResourceTracker.release("canvases", "compression_canvas");
      }
    }

    // Clear reader
    if (reader) {
      reader.onload = null;
      reader.onerror = null;
      reader.abort();
    }

    logDebug("Compression resources cleaned up");
  }

  // ==========================================================================
  // FILE ANALYSIS
  // ==========================================================================

  /**
   * Analyse file to estimate cost, pages, and recommended processing engine
   * Uses multiple fallback strategies for robustness
   *
   * @param {File} file - The file to analyse
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeFile(file) {
    logInfo("Analysing file...", { name: file.name, size: file.size });

    try {
      // Strategy 1: Use existing fileHandler if available
      if (
        window.fileHandler &&
        typeof window.fileHandler.fallbackAnalysis === "function"
      ) {
        logDebug("Using existing fileHandler.fallbackAnalysis for analysis");

        // Use fileHandler's fallback analysis
        const analysis = await window.fileHandler.fallbackAnalysis(file);
        logInfo("File analysis complete", analysis);

        // Calculate cost if not provided by fileHandler
        let cost = analysis.estimatedCost || analysis.cost;
        if (cost === undefined || cost === null) {
          // Fallback cost calculation
          if (analysis.isImage) {
            cost = 0.001; // ~Â£0.001 for images
          } else if (analysis.isPDF && analysis.estimatedPages) {
            cost = analysis.estimatedPages * 0.002; // ~Â£0.002 per page for PDFs
          } else {
            cost = 0; // Unknown cost
          }
        }

        // Map fileHandler field names to embed API field names
        return {
          pages: analysis.estimatedPages,
          engine: analysis.recommendedEngine,
          cost: cost,
          confidence: analysis.confidence || "medium",
          isImage: analysis.isImage,
          isPDF: analysis.isPDF,
          likelyScanned: analysis.likelyScanned,
          source: "fileHandler.fallbackAnalysis",
        };
      }

      // Strategy 2: Use existing fileHandler.analyzeFile method
      if (
        window.fileHandler &&
        typeof window.fileHandler.analyzeFile === "function"
      ) {
        logDebug("Using fileHandler.analyzeFile for analysis");

        const analysis = await window.fileHandler.analyzeFile(file);
        logInfo("File analysis complete (fileHandler.analyzeFile)", analysis);
        return {
          pages: analysis.pages || this.estimatePages(file),
          engine: analysis.engine || "auto",
          cost: analysis.cost || 0,
          confidence: analysis.confidence || "medium",
          source: "fileHandler.analyzeFile",
        };
      }
    } catch (error) {
      logWarn("fileHandler analysis failed, using fallback", error);
    }

    // Strategy 3: Simple fallback analysis
    logDebug("Using simple fallback analysis");
    return this.simpleFallbackAnalysis(file);
  }

  /**
   * Simple fallback analysis when fileHandler is unavailable
   *
   * @param {File} file - The file to analyse
   * @returns {Object} Basic analysis results
   */
  simpleFallbackAnalysis(file) {
    const { isImage, isPDF } = this.validateFile(file);

    if (isImage) {
      logDebug("Fallback analysis for image");
      return {
        pages: 1,
        engine: "native",
        cost: 0.001,
        confidence: "low",
        source: "fallback",
      };
    }

    if (isPDF) {
      // Estimate pages from file size (very rough)
      const estimatedPages = this.estimatePages(file);
      logDebug("Fallback analysis for PDF", { estimatedPages });

      return {
        pages: estimatedPages,
        engine: estimatedPages > 10 ? "pdf-text" : "native",
        cost: estimatedPages * 0.002, // Rough estimate
        confidence: "low",
        source: "fallback",
      };
    }
  }

  /**
   * Estimate number of pages from file size
   * Very rough estimate: ~50KB per page on average
   *
   * @param {File} file - The file to estimate
   * @returns {number} Estimated page count
   */
  estimatePages(file) {
    const avgPageSize = 50 * 1024; // 50KB per page average
    const estimated = Math.ceil(file.size / avgPageSize);
    logDebug("Estimated pages", { fileSize: file.size, estimated });
    return estimated;
  }

  // ==========================================================================
  // MESSAGE CONTENT PREPARATION
  // ==========================================================================

  /**
   * Prepare message content for image attachment
   *
   * @param {File} file - The image file
   * @param {string} base64Data - Base64 encoded image data
   * @param {string} prompt - User's text prompt
   * @returns {Object} Message content for OpenRouter API
   */
  prepareImageContent(file, base64Data, prompt) {
    logInfo("Preparing image message content", { fileName: file.name });

    return {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:${file.type};base64,${base64Data}`,
          },
        },
        {
          type: "text",
          text: prompt,
        },
      ],
    };
  }

  /**
   * Prepare message content for PDF attachment
   *
   * @param {File} file - The PDF file
   * @param {string} base64Data - Base64 encoded PDF data
   * @param {string} prompt - User's text prompt
   * @returns {Object} Message content for OpenRouter API
   */
  preparePDFContent(file, base64Data, prompt) {
    logInfo("Preparing PDF message content", { fileName: file.name });

    return {
      role: "user",
      content: [
        {
          type: "file",
          file: {
            filename: file.name,
            file_data: `data:application/pdf;base64,${base64Data}`,
          },
        },
        {
          type: "text",
          text: prompt,
        },
      ],
    };
  }

  // ==========================================================================
  // COST WARNING HELPERS
  // ==========================================================================

  /**
   * Determine if cost warning should be shown
   *
   * @param {number} cost - Estimated cost in GBP
   * @returns {string} Warning level: 'none', 'yellow', 'orange', 'red'
   */
  shouldWarnAboutCost(cost) {
    if (cost >= COST_THRESHOLDS.RED) {
      logDebug("Cost warning level: RED", { cost });
      return "red";
    }
    if (cost >= COST_THRESHOLDS.ORANGE) {
      logDebug("Cost warning level: ORANGE", { cost });
      return "orange";
    }
    if (cost >= COST_THRESHOLDS.YELLOW) {
      logDebug("Cost warning level: YELLOW", { cost });
      return "yellow";
    }
    logDebug("Cost warning level: NONE", { cost });
    return "none";
  }

  /**
   * Format cost for display
   *
   * @param {number} cost - Cost in GBP
   * @returns {string} Formatted cost string
   */
  formatCost(cost) {
    if (cost < 0.01) return "< Â£0.01";
    return `Â£${cost.toFixed(2)}`;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get maximum file size for a given file type
   *
   * @param {string} fileType - MIME type of the file
   * @returns {number} Maximum file size in bytes
   */
  getMaxFileSize(fileType) {
    if (SUPPORTED_IMAGE_TYPES.includes(fileType)) {
      return MAX_IMAGE_SIZE;
    }
    if (SUPPORTED_PDF_TYPES.includes(fileType)) {
      return MAX_PDF_SIZE;
    }
    return 0;
  }

  /**
   * Check if a file type is supported
   *
   * @param {string} fileType - MIME type to check
   * @returns {boolean} True if supported
   */
  isFileTypeSupported(fileType) {
    return (
      SUPPORTED_IMAGE_TYPES.includes(fileType) ||
      SUPPORTED_PDF_TYPES.includes(fileType)
    );
  }

  /**
   * Get file type category
   *
   * @param {string} fileType - MIME type
   * @returns {string} 'image', 'pdf', or 'unknown'
   */
  getFileTypeCategory(fileType) {
    if (SUPPORTED_IMAGE_TYPES.includes(fileType)) return "image";
    if (SUPPORTED_PDF_TYPES.includes(fileType)) return "pdf";
    return "unknown";
  }

  /**
   * Get human-readable file size
   *
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // ==========================================================================
  // CLIPBOARD PASTE HELPER
  // ==========================================================================

  /**
   * Bind clipboard paste event listener for image/file pasting
   *
   * Allows users to paste images directly from clipboard into the application.
   * Returns a cleanup function to remove the event listener.
   *
   * @param {Object} options - Configuration options
   * @param {string|null} options.containerSelector - CSS selector to limit scope (null = document)
   * @param {Function} options.onPaste - Callback when valid file is pasted (receives File)
   * @param {Function} options.onError - Callback for errors (receives Error)
   * @param {string[]} options.acceptedTypes - Accepted MIME types (default: image types)
   * @param {boolean} options.preventInInputs - Skip paste in input/textarea (default: true)
   * @returns {Function} Cleanup function to remove the event listener
   *
   * @example
   * const cleanup = fileUtils.bindClipboardPaste({
   *   containerSelector: '#drop-zone',
   *   onPaste: (file) => console.log('Pasted:', file.name),
   *   onError: (error) => console.error('Paste error:', error),
   *   acceptedTypes: ['image/jpeg', 'image/png'],
   *   preventInInputs: true
   * });
   *
   * // Later, to remove the listener:
   * cleanup();
   */
  bindClipboardPaste(options = {}) {
    // Validate required callback
    if (typeof options.onPaste !== "function") {
      const error = new Error("bindClipboardPaste requires onPaste callback");
      logError(error.message);
      throw error;
    }

    // Extract options with defaults
    const {
      containerSelector = null,
      onPaste,
      onError = () => {},
      acceptedTypes = SUPPORTED_IMAGE_TYPES,
      preventInInputs = true,
    } = options;

    logDebug("Binding clipboard paste handler", {
      containerSelector,
      acceptedTypes,
      preventInInputs,
    });

    // Determine target element
    let targetElement;
    if (containerSelector) {
      targetElement = document.querySelector(containerSelector);
      if (!targetElement) {
        const error = new Error(`Container not found: ${containerSelector}`);
        logError(error.message);
        throw error;
      }
      logDebug("Binding to container", { containerSelector });
    } else {
      targetElement = document;
      logDebug("Binding to document");
    }

    // Create paste event handler
    const pasteHandler = (event) => {
      logDebug("Paste event received");

      // Check if paste is in input/textarea elements
      if (preventInInputs) {
        const activeElement = document.activeElement;
        const tagName = activeElement?.tagName?.toLowerCase();

        if (
          tagName === "input" ||
          tagName === "textarea" ||
          activeElement?.isContentEditable
        ) {
          logDebug("Paste in input element - skipping", { tagName });
          return; // Let default paste behaviour happen
        }
      }

      // Get clipboard data
      const clipboardData = event.clipboardData || window.clipboardData;
      if (!clipboardData) {
        logDebug("No clipboard data available");
        return;
      }

      // Check for files in clipboard
      const items = clipboardData.items;
      if (!items || items.length === 0) {
        logDebug("No items in clipboard");
        return;
      }

      // Find first file matching accepted types
      let foundFile = null;
      let rejectedFileType = null;

      // Convert items to array for consistent iteration
      // (handles both real DataTransferItemList and mock objects)
      const itemsArray = Array.from(
        { length: items.length },
        (_, i) => items[i]
      );

      for (const item of itemsArray) {
        // Skip if item is undefined (shouldn't happen, but be safe)
        if (!item) {
          continue;
        }

        // Check if this is a file
        if (item.kind !== "file") {
          continue;
        }

        const file = item.getAsFile();
        if (!file) {
          continue;
        }

        logDebug("Found file in clipboard", {
          name: file.name,
          type: file.type,
          size: file.size,
        });

        // Check if type is accepted
        if (acceptedTypes.includes(file.type)) {
          foundFile = file;
          break;
        } else {
          // Track rejected file type for error reporting
          rejectedFileType = file.type;
          logDebug("File type not accepted", {
            type: file.type,
            acceptedTypes,
          });
        }
      }

      // Handle found file or error
      if (foundFile) {
        logDebug("Valid file pasted", {
          name: foundFile.name,
          type: foundFile.type,
          size: foundFile.size,
        });

        // Prevent default paste behaviour
        event.preventDefault();

        // Call success callback
        try {
          onPaste(foundFile);
        } catch (callbackError) {
          logError("onPaste callback error", callbackError);
          onError(callbackError);
        }
      } else {
        // Check if there was a file but wrong type
        if (rejectedFileType) {
          const error = new Error(
            `Unsupported file type: ${rejectedFileType}. Accepted types: ${acceptedTypes.join(
              ", "
            )}`
          );
          logWarn(error.message);
          onError(error);
        }
        // If no file at all, let default paste happen (e.g., text paste)
      }
    };

    // Attach event listener
    targetElement.addEventListener("paste", pasteHandler);
    logDebug("Paste handler attached");

    // Create and return cleanup function
    const cleanup = () => {
      targetElement.removeEventListener("paste", pasteHandler);
      logDebug("Paste handler removed");
    };

    // Store reference for debugging
    this._lastPasteCleanup = cleanup;

    return cleanup;
  }
}

// ============================================================================
// GLOBAL EXPOSURE
// ============================================================================

window.EmbedFileUtils = EmbedFileUtils;

logInfo("EmbedFileUtils module loaded and available globally");
