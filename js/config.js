/**
 * Core configuration module for OpenRouter API integration and model management.
 * Centralizes essential configuration parameters including API credentials,
 * model defaults, and system settings. Provides dynamic cost calculation
 * through integration with the model registry. Supports debug modes and
 * caching optimization for improved performance. This module serves as the
 * primary configuration hub, ensuring consistent settings across the application.
 *
 * @module config
 */

import { modelRegistry } from "./model-definitions.js";

/**
 * Get API key from localStorage
 * @returns {string|null} API key or null if not configured
 */
function getApiKey() {
  const storedKey = localStorage.getItem("openrouter_api_key");

  if (!storedKey || !storedKey.trim()) {
    console.warn(
      "[Config] No API key configured. Please add your OpenRouter API key in the configuration section."
    );
    return null;
  }

  return storedKey.trim();
}

/**
 * Check if API key is configured
 * @returns {boolean} True if API key is available
 */
function hasApiKey() {
  const key = getApiKey();
  return key !== null && key.length > 0;
}

export const CONFIG = {
  get API_KEY() {
    return getApiKey();
  },

  get HAS_API_KEY() {
    return hasApiKey();
  },

  API_ENDPOINT: "https://openrouter.ai/api/v1/chat/completions",

  // Model configuration defaults
  DEFAULT_PARAMS: {
    temperature: 0.8,
    top_p: 1,
    max_tokens: 4096,
    presence_penalty: 0,
    frequency_penalty: 0,
  },

  // Cache settings
  CACHE_DURATION: 3600000, // 1 hour in milliseconds
  MAX_CHUNK_SIZE: 12000, // Default chunk size for text splitting

  // Debug settings
  DEBUG: {
    TOKEN_COUNTER: false, // Enable detailed token counting logs
  },

  // File Upload Configuration - Based on Stage 1 API Testing Results
  FILE_UPLOAD: {
    // File size limits (bytes) - Validated through testing
    MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB (19MB worked but took 9 seconds)
    MAX_PDF_SIZE: 25 * 1024 * 1024, // 25MB (reduced from 50MB due to response size issues)

    // Response size management - Critical finding from testing
    RESPONSE_SIZE_WARNING: 1 * 1024 * 1024, // Warn for responses over 1MB
    MAX_RESPONSE_DISPLAY: 5 * 1024 * 1024, // Truncate display over 5MB

    // Supported file formats - Confirmed by OpenRouter documentation
    SUPPORTED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
    SUPPORTED_FILE_TYPES: ["application/pdf"],

    // File input accept attribute string
    ACCEPT_STRING: ".jpg,.jpeg,.png,.webp,.pdf",

    // PDF processing engines and costs - Validated by testing
    PDF_ENGINE_COSTS: {
      "pdf-text": 0, // Free, confirmed in testing
      "mistral-ocr": 2.0, // £2/1000 pages, exactly as tested
      native: "Charged as input tokens", // Most economical for text PDFs
    },

    // Smart PDF engine selection logic - Based on testing insights
    PDF_ENGINE_DEFAULTS: {
      priority: ["native", "pdf-text", "mistral-ocr"], // Performance order
      autoFallback: true,
      recommendations: {
        scanned: "mistral-ocr", // Required for scanned PDFs (Test 13 finding)
        "text-layer": "native", // Best performance and cost (Test 6 finding)
        "complex-layout": "native", // Better structure preservation (Test 14 finding)
        "large-document": "pdf-text", // Free processing for large docs
      },
    },

    // Cost estimation settings - Enhanced based on testing accuracy
    COST_ESTIMATION_BUFFER: 1.3, // 30% buffer for conservative estimates

    // Tiered cost warning system - New feature based on testing insights
    COST_WARNING_THRESHOLDS: {
      YELLOW: 0.05, // £0.05+ - Basic warning
      ORANGE: 0.5, // £0.50+ - Confirmation required
      RED: 2.0, // £2.00+ - Double confirmation required
    },

    // Response processing options - Critical new feature
    RESPONSE_PROCESSING: {
      detectBase64Content: true, // Handle embedded content in responses
      filterLargeResponses: true, // Filter responses over size threshold
      showContentSummary: true, // Show summary of filtered content
      enableResponseTruncation: true, // Allow truncation of very large responses
      base64ContentReplacement: "[Embedded {type} file ({size})]", // Replacement text
    },

    // File analysis settings - For smart engine selection
    FILE_ANALYSIS: {
      enableSmartEngineSelection: true, // Use analysis to recommend engines
      pdfPageEstimation: {
        averageBytesPerPage: 50000, // ~50KB per page heuristic
        minimumPages: 1,
        scannedThreshold: 10 * 1024 * 1024, // Files over 10MB likely scanned
      },
    },

    // Performance settings - Based on testing observations
    PERFORMANCE: {
      showProgressFor: 1 * 1024 * 1024, // Show progress for files over 1MB
      encodingChunkSize: 64 * 1024, // 64KB chunks for large files
      previewImageMaxSize: 200, // Max preview height in pixels
      estimatedProcessingTime: {
        image: 0.5, // Seconds per MB for images
        "pdf-native": 0.3, // Seconds per MB for native PDF
        "pdf-text": 0.2, // Seconds per MB for text extraction
        "pdf-ocr": 4.0, // Seconds per MB for OCR (based on Test 13b)
      },
    },

    // UI configuration
    UI: {
      previewMaxWidth: "100%",
      previewMaxHeight: "200px",
      showFileSize: true,
      showEstimatedPages: true,
      showProcessingTime: true,
      enableDragAndDrop: true,
    },

    // Error messages - Standardised user feedback
    ERROR_MESSAGES: {
      FILE_TOO_LARGE: "File too large. Maximum size: {maxSize}",
      UNSUPPORTED_FORMAT: "Unsupported file format. Supported types: {types}",
      PROCESSING_FAILED: "File processing failed. Please try again.",
      NETWORK_ERROR:
        "Network error during upload. Please check your connection.",
      MODEL_INCOMPATIBLE: "Selected model does not support file uploads.",
      COST_EXCEEDED: "Estimated cost (£{cost}) exceeds your threshold.",
      RESPONSE_TOO_LARGE:
        "Response too large to display ({size}). Showing summary instead.",
    },

    // Future expansion placeholders
    PREPROCESSING: {
      enabled: false,
      imageResize: false,
      pdfPageExtraction: false,
      formatConversion: false,
      options: {},
    },

    // Caching configuration (for future annotation caching)
    CACHING: {
      enabled: false,
      maxCacheSize: 50 * 1024 * 1024, // 50MB cache
      maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
      cacheAnnotations: false,
    },
  },

  // File Upload Utility Functions
  FILE_UPLOAD_UTILS: {
    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size string
     */
    formatFileSize(bytes) {
      const units = ["B", "KB", "MB", "GB"];
      let size = bytes;
      let unitIndex = 0;

      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }

      return `${size.toFixed(1)} ${units[unitIndex]}`;
    },

    /**
     * Get cost warning level for a given cost
     * @param {number} cost - Estimated cost in pounds
     * @returns {string} Warning level: 'none', 'yellow', 'orange', 'red'
     */
    getCostWarningLevel(cost) {
      const thresholds = CONFIG.FILE_UPLOAD.COST_WARNING_THRESHOLDS;
      if (cost >= thresholds.RED) return "red";
      if (cost >= thresholds.ORANGE) return "orange";
      if (cost >= thresholds.YELLOW) return "yellow";
      return "none";
    },

    /**
     * Validate file against upload constraints
     * @param {File} file - File object to validate
     * @returns {Object} Validation result with errors and warnings
     */
    validateFileConstraints(file) {
      const config = CONFIG.FILE_UPLOAD;
      const validation = {
        valid: false,
        errors: [],
        warnings: [],
      };

      // Check file type
      const supportedTypes = [
        ...config.SUPPORTED_IMAGE_TYPES,
        ...config.SUPPORTED_FILE_TYPES,
      ];

      if (!supportedTypes.includes(file.type)) {
        validation.errors.push(
          config.ERROR_MESSAGES.UNSUPPORTED_FORMAT.replace(
            "{types}",
            supportedTypes.join(", ")
          )
        );
      }

      // Check file size
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf";

      if (isImage && file.size > config.MAX_IMAGE_SIZE) {
        validation.errors.push(
          config.ERROR_MESSAGES.FILE_TOO_LARGE.replace(
            "{maxSize}",
            CONFIG.FILE_UPLOAD_UTILS.formatFileSize(config.MAX_IMAGE_SIZE)
          )
        );
      } else if (isPDF && file.size > config.MAX_PDF_SIZE) {
        validation.errors.push(
          config.ERROR_MESSAGES.FILE_TOO_LARGE.replace(
            "{maxSize}",
            CONFIG.FILE_UPLOAD_UTILS.formatFileSize(config.MAX_PDF_SIZE)
          )
        );
      }

      // Performance warnings
      if (file.size > config.PERFORMANCE.showProgressFor) {
        validation.warnings.push("Large file - processing may take some time");
      }

      validation.valid = validation.errors.length === 0;
      return validation;
    },

    /**
     * Estimate PDF pages from file size
     * @param {number} fileSize - PDF file size in bytes
     * @returns {number} Estimated number of pages
     */
    estimatePDFPages(fileSize) {
      const avgBytes =
        CONFIG.FILE_UPLOAD.FILE_ANALYSIS.pdfPageEstimation.averageBytesPerPage;
      const minPages =
        CONFIG.FILE_UPLOAD.FILE_ANALYSIS.pdfPageEstimation.minimumPages;
      return Math.max(minPages, Math.round(fileSize / avgBytes));
    },

    /**
     * Check if PDF is likely scanned based on size
     * @param {number} fileSize - PDF file size in bytes
     * @returns {boolean} True if likely scanned
     */
    isPDFLikelyScanned(fileSize) {
      return (
        fileSize >
        CONFIG.FILE_UPLOAD.FILE_ANALYSIS.pdfPageEstimation.scannedThreshold
      );
    },

    /**
     * Get recommended PDF engine for a file
     * @param {File} file - PDF file object
     * @returns {string} Recommended engine: 'native', 'pdf-text', or 'mistral-ocr'
     */
    getRecommendedPDFEngine(file) {
      // Defensive validation for undefined or invalid file objects
      if (!file || typeof file !== "object") {
        console.warn("getRecommendedPDFEngine: Invalid file parameter", file);
        return "native"; // Safe default
      }

      if (!file.type) {
        console.warn(
          "getRecommendedPDFEngine: File missing type property",
          file
        );
        return "native"; // Safe default
      }

      if (file.type !== "application/pdf") return "native";

      // Validate file.size is a number
      if (typeof file.size !== "number" || isNaN(file.size)) {
        console.warn("getRecommendedPDFEngine: Invalid file size", file.size);
        return "native"; // Safe default
      }

      const isLikelyScanned = CONFIG.FILE_UPLOAD_UTILS.isPDFLikelyScanned(
        file.size
      );
      const recommendations =
        CONFIG.FILE_UPLOAD.PDF_ENGINE_DEFAULTS.recommendations;

      if (isLikelyScanned) {
        return recommendations.scanned; // 'mistral-ocr'
      }

      return recommendations["text-layer"]; // 'native'
    },
  },

  // Get costs from registry
  get COSTS() {
    const costs = {};
    for (const model of modelRegistry.getAllModels()) {
      costs[model.id] = model.costs;
    }
    return costs;
  },
};
