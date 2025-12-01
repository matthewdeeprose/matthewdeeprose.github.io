/**
 * @fileoverview Core File Handler - Phase 4.3+ Implementation with Memory Management
 * Handles file upload, validation, preview, and cost estimation with Stage 3 integration
 * Enhanced with Phase 4.3.1 Parameter Synchronization System
 * Enhanced with comprehensive memory management to prevent browser freezes
 * Follows defensive programming patterns and provides comprehensive console testing
 *
 * @version Phase 4.3+ with Memory Management
 * @date 25 November 2025
 */

import { CONFIG } from "../config.js";
import { FileHandlerParameterSync } from "./file-handler-parameter-sync.js";
import {
  MemoryMonitor,
  ResourceTracker,
  CircuitBreaker,
} from "../utilities/memory-manager.js";

// Stage 3 logging configuration pattern (MANDATORY)
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
    console.error(`[FileHandler] ${message}`, ...args);
}
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[FileHandler] ${message}`, ...args);
}
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[FileHandler] ${message}`, ...args);
}
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[FileHandler] ${message}`, ...args);
}
export class FileHandler {
  constructor() {
    this.currentFile = null;
    this.fileType = null;
    this.base64Data = null;
    this.fileAnalysis = null;
    this.costEstimate = null;

    // UI Elements
    this.fileInput = null;
    this.fileLabel = null;
    this.uploadSection = null;
    this.previewArea = null;
    this.removeButton = null;

    // Parameter system integration (Phase 4.2+)
    this.pdfEngineParameter = null;
    this.parameterController = null;

    // Phase 4.3.1: Parameter Synchronization System
    this.parameterSync = new FileHandlerParameterSync(this);
    this.parameterSyncAvailable = false;

    // Advanced state management (Phase 4.2+)
    this.fileStateManager = {
      currentFile: null,
      validationResult: null,
      costEstimate: null,
      engineRecommendation: null,
    };

    // Memory management tracking
    this.resourceIds = new Set(); // Track all resources created by this handler

    // State management
    this.isInitialised = false;
    this.hasValidFile = false;

    logInfo(
      "Core file handler initialised with Stage 3 integration and memory management"
    );

    // Track initialisation
    if (MemoryMonitor) {
      MemoryMonitor.track("FileHandler_constructor", {
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Initialise the file handler with DOM elements and event listeners
   */
  async initialise() {
    logInfo("FileHandler: Starting initialisation...");

    try {
      // Find DOM elements
      this.fileInput = document.getElementById("file-upload");
      this.fileLabel = document.querySelector(".file-upload-label");
      this.uploadSection = document.querySelector(".file-upload-section");
      this.previewArea = document.getElementById("file-preview");
      this.removeButton = document.getElementById("preview-remove");

      // Defensive element checking
      if (
        !this.fileInput ||
        !this.fileLabel ||
        !this.uploadSection ||
        !this.previewArea
      ) {
        logError("FileHandler: Required DOM elements not found");
        this.initialiseFallback();
        return false;
      }

      // Set up event listeners
      this.setupEventListeners();

      // Verify Stage 3 integration
      this.verifyStage3Integration();

      // Initialize parameter system integration (Phase 4.2+)
      this.initializeParameterIntegration();

      // Initialize advanced cost management (Phase 4.2+)
      this.initializeCostManagement();

      // Set up file state synchronization (Phase 4.2+)
      this.initializeFileStateSync();

      // Phase 4.3.1: Schedule deferred parameter sync initialization
      this.scheduleDeferredParameterSync();

      this.isInitialised = true;
      logInfo(
        "FileHandler: Initialisation complete - parameter sync will initialize when system ready"
      );

      return true;
    } catch (error) {
      logError("FileHandler: Initialisation failed:", error);
      this.initialiseFallback();
      return false;
    }
  }

  /**
   * Set up all event listeners for file handling
   */
  setupEventListeners() {
    logDebug("FileHandler: Setting up event listeners");

    // File input change
    this.fileInput.addEventListener("change", (event) => {
      this.handleFileSelect(event.target.files[0]);
    });

    // Drag and drop support
    this.setupDragAndDrop();

    // Remove file button
    if (this.removeButton) {
      this.removeButton.addEventListener("click", () => {
        this.removeFile();
      });
    }

    // Keyboard support for file input
    this.fileLabel.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.fileInput.click();
      }
    });
  }

  /**
   * Set up drag and drop functionality
   */
  setupDragAndDrop() {
    // Prevent default drag behaviors
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      this.uploadSection.addEventListener(
        eventName,
        this.preventDefaults,
        false
      );
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });

    // Highlight drop area when item is dragged over it
    ["dragenter", "dragover"].forEach((eventName) => {
      this.uploadSection.addEventListener(
        eventName,
        () => {
          this.uploadSection.classList.add("drag-over");
        },
        false
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      this.uploadSection.addEventListener(
        eventName,
        () => {
          this.uploadSection.classList.remove("drag-over");
        },
        false
      );
    });

    // Handle dropped files
    this.uploadSection.addEventListener(
      "drop",
      (event) => {
        const files = event.dataTransfer.files;
        if (files.length > 0) {
          this.handleFileSelect(files[0]);
        }
      },
      false
    );
  }

  /**
   * Prevent default drag behaviors
   */
  preventDefaults(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Handle file selection from input or drag-drop
   */
  async handleFileSelect(file) {
    logInfo("FileHandler: File selected:", {
      name: file?.name,
      type: file?.type,
      size: file?.size,
    });

    if (!file) {
      logWarn("FileHandler: No file provided");
      return;
    }

    try {
      // Validate file using Stage 3 defensive patterns
      const validation = this.validateFile(file);

      if (!validation.valid) {
        this.showError(validation.errors.join(", "));
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        logWarn("FileHandler: File validation warnings:", validation.warnings);
      }

      // DEBUG: Check state before processing
      console.log(
        "🔍 [DEBUG] Before processFile - currentFile:",
        this.currentFile
      );

      // Process the file
      await this.processFile(file);

      // DEBUG: Check state after processing
      console.log(
        "🔍 [DEBUG] After processFile - currentFile:",
        this.currentFile
      );
      console.log(
        "🔍 [DEBUG] After processFile - hasValidFile:",
        this.hasValidFile
      );

      // Update UI state
      this.showPreview(file);

      // Estimate cost using Stage 3 integration
      await this.estimateAndDisplayCost(file);

      // DEBUG: Check state before notification
      console.log(
        "🔍 [DEBUG] Before notifyFileStateChange - currentFile:",
        this.currentFile
      );

      // Notify other components of file change
      this.notifyFileStateChange(true);

      logInfo("FileHandler: File processing complete");
    } catch (error) {
      logError("FileHandler: File handling error:", error);
      console.error("🔍 [DEBUG] Error in handleFileSelect:", error);
      console.error("🔍 [DEBUG] Stack trace:", error.stack);
      this.showError("Failed to process file. Please try again.");
    }
  }

  /**
   * Validate file using Stage 3 CONFIG utilities with defensive patterns
   */
  validateFile(file) {
    logDebug("FileHandler: Validating file:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Defensive validation using CONFIG (Stage 3 pattern)
    const uploadConfig = CONFIG?.FILE_UPLOAD;
    const validation = CONFIG?.FILE_UPLOAD_UTILS?.validateFileConstraints;

    if (!uploadConfig || !validation) {
      logWarn(
        "FileHandler: File upload configuration not available - using fallback validation"
      );
      return this.fallbackValidation(file);
    }

    try {
      const result = validation(file);
      logDebug("FileHandler: Validation result:", result);
      return result;
    } catch (error) {
      logError("FileHandler: File validation failed, using fallback:", error);
      return this.fallbackValidation(file);
    }
  }

  /**
   * Fallback validation when CONFIG utilities are not available
   */
  fallbackValidation(file) {
    const validation = {
      valid: false,
      errors: [],
      warnings: [],
    };

    // Basic type checking
    const supportedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!supportedTypes.includes(file.type)) {
      validation.errors.push(
        "Unsupported file type. Please choose JPG, PNG, WebP, or PDF."
      );
    }

    // Basic size checking (fallback limits)
    const maxSize = file.type.startsWith("image/")
      ? 20 * 1024 * 1024
      : 512 * 1024 * 1024; // 20MB for images, 512MB for PDFs
    if (file.size > maxSize) {
      validation.errors.push(
        `File too large. Maximum size: ${this.formatFileSize(maxSize)}`
      );
    }

    validation.valid = validation.errors.length === 0;
    return validation;
  }

  /**
   * Process the uploaded file (convert to base64, analyse)
   */
  async processFile(file) {
    logDebug("FileHandler: Processing file");
    console.log("🔍 [DEBUG] processFile START - file:", file);
    console.log("🔍 [DEBUG] processFile START - file.name:", file?.name);
    console.log("🔍 [DEBUG] processFile START - file.type:", file?.type);

    try {
      // Convert to base64
      console.log("🔍 [DEBUG] Converting to base64...");
      this.base64Data = await this.fileToBase64(file);
      console.log(
        "🔍 [DEBUG] Base64 conversion complete, length:",
        this.base64Data?.length
      );

      // Store file info with enhanced state management (Phase 4.2+)
      console.log("🔍 [DEBUG] Setting currentFile...");
      this.currentFile = file;
      this.fileType = file.type;
      this.hasValidFile = true;
      console.log("🔍 [DEBUG] currentFile set to:", this.currentFile);

      // Update file state manager
      console.log("🔍 [DEBUG] Updating fileStateManager...");
      this.fileStateManager.currentFile = file;
      this.fileStateManager.validationResult = this.validateFile(file);
      console.log("🔍 [DEBUG] fileStateManager updated");

      // Integrate with PDF engine parameter if PDF (with timing resilience)
      if (file.type === "application/pdf") {
        console.log(
          "🔍 [DEBUG] PDF detected, integrating with PDF parameter..."
        );
        this.integrateWithPDFParameter(file);
      }

      // Analyse file using CONFIG utilities (defensive)
      try {
        console.log("🔍 [DEBUG] Analysing file...");
        if (CONFIG?.FILE_UPLOAD_UTILS?.analyseFile) {
          this.fileAnalysis = CONFIG.FILE_UPLOAD_UTILS.analyseFile(file);
        } else {
          this.fileAnalysis = this.fallbackAnalysis(file);
        }
        console.log("🔍 [DEBUG] File analysis complete:", this.fileAnalysis);
      } catch (error) {
        logWarn("FileHandler: File analysis failed, using fallback:", error);
        this.fileAnalysis = this.fallbackAnalysis(file);
      }

      console.log(
        "🔍 [DEBUG] processFile END - currentFile:",
        this.currentFile
      );
      logDebug("FileHandler: File processed successfully");
    } catch (error) {
      console.error("🔍 [DEBUG] ERROR in processFile:", error);
      console.error("🔍 [DEBUG] Stack trace:", error.stack);
      throw error; // Re-throw to be caught by handleFileSelect
    }
  }

  /**
   * Convert file to base64 string
   */
  async fileToBase64(file) {
    const operationId = `fileToBase64_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    this.resourceIds.add(operationId);

    logDebug("Converting file to base64...", {
      name: file.name,
      size: file.size,
      operationId,
    });

    // Track memory before operation
    if (MemoryMonitor) {
      MemoryMonitor.track("FileHandler_fileToBase64_start", {
        fileName: file.name,
        fileSize: file.size,
        operationId,
      });
    }

    let reader = null;

    try {
      // Use circuit breaker protection
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
            const base64 = reader.result.split(",")[1];

            logDebug("File converted to base64", {
              length: base64.length,
              operationId,
            });

            // Track memory after conversion
            if (MemoryMonitor) {
              MemoryMonitor.track("FileHandler_fileToBase64_complete", {
                base64Length: base64.length,
                operationId,
              });
            }

            resolve(base64);
          };

          reader.onerror = () => {
            clearTimeout(timeout);
            logError("Failed to read file:", reader.error);

            // Track failure
            if (MemoryMonitor) {
              MemoryMonitor.track("FileHandler_fileToBase64_error", {
                error: reader.error?.message || "Unknown error",
                operationId,
              });
            }

            reject(new Error("Failed to read file: " + reader.error));
          };

          reader.readAsDataURL(file);
        });
      };

      // Execute with circuit breaker
      if (CircuitBreaker) {
        return await CircuitBreaker.execute(
          performConversion,
          `FileHandler.fileToBase64(${file.name})`
        );
      } else {
        return await performConversion();
      }
    } finally {
      // Critical cleanup
      if (reader) {
        try {
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
        MemoryMonitor.track("FileHandler_fileToBase64_cleanup", {
          operationId,
        });
      }

      // Remove from tracked IDs
      this.resourceIds.delete(operationId);

      // Suggest garbage collection for large files (>5MB)
      if (file.size > 5 * 1024 * 1024 && window.gc) {
        window.gc();
        logDebug("Garbage collection suggested for large file");
      }
    }
  }

  /**
   * Enhanced file analysis with Stage 5 sophisticated features
   * @param {File} file - File to analyse
   * @returns {Object} Comprehensive analysis object
   */
  fallbackAnalysis(file) {
    logInfo("FileHandler: Performing enhanced file analysis for:", file.name);

    const analysis = {
      // Stage 4 compatibility properties
      isImage: file.type.startsWith("image/"),
      isPDF: file.type === "application/pdf",
      estimatedPages: 1,
      likelyScanned: false,
      recommendedEngine: "native",

      // Stage 5 enhanced properties
      complexity: "simple", // simple, medium, complex
      confidence: "medium", // low, medium, high
      processingTime: "fast", // fast, medium, slow
      costBreakdown: null,
      sizePrediction: null,
      engineRecommendations: null,
    };

    if (analysis.isPDF) {
      // Enhanced PDF analysis using new helper methods
      const sizePerPage = this.estimatePageSize(file);
      analysis.estimatedPages = Math.max(
        1,
        Math.round(file.size / sizePerPage)
      );

      // Sophisticated analysis
      analysis.likelyScanned = this.detectScannedPDF(file);
      analysis.complexity = this.assessPDFComplexity(file);
      analysis.confidence = this.calculateAnalysisConfidence(file, analysis);
      analysis.processingTime = this.estimateProcessingTime(analysis);

      // Generate recommendations and cost breakdown
      analysis.engineRecommendations = this.selectOptimalEngine(analysis);
      analysis.costBreakdown = this.generateCostBreakdown(analysis);
      analysis.recommendedEngine =
        analysis.engineRecommendations?.primary || "native";

      // Set analysis to this instance before prediction to avoid recursion
      this.fileAnalysis = analysis;

      // Response size prediction (now that this.fileAnalysis is set)
      analysis.sizePrediction = this.predictResponseSize(
        file,
        analysis.recommendedEngine
      );

      logInfo("FileHandler: Enhanced PDF analysis complete", {
        pages: analysis.estimatedPages,
        complexity: analysis.complexity,
        recommended: analysis.recommendedEngine,
        scanned: analysis.likelyScanned,
      });
    } else if (analysis.isImage) {
      // Enhanced image analysis
      analysis.complexity = this.assessImageComplexity(file);
      analysis.processingTime = "fast";
      analysis.confidence = "high";

      // Set analysis before prediction to maintain consistency
      this.fileAnalysis = analysis;
      analysis.sizePrediction = this.predictImageResponseSize(file);

      logInfo("FileHandler: Enhanced image analysis complete", {
        complexity: analysis.complexity,
        sizeMB: (file.size / 1024 / 1024).toFixed(2),
      });
    }

    return analysis;
  }

  /**
   * Estimate page size for more accurate page counting
   * @param {File} file - PDF file
   * @returns {number} Estimated bytes per page
   */
  estimatePageSize(file) {
    // Improved heuristics based on Stage 1 testing insights
    const sizeInMB = file.size / (1024 * 1024);

    if (sizeInMB < 1) {
      // Small PDFs - likely text-heavy, higher compression
      return 30000; // ~30KB per page
    } else if (sizeInMB < 10) {
      // Medium PDFs - mixed content
      return 50000; // ~50KB per page
    } else if (sizeInMB < 50) {
      // Large PDFs - likely image-heavy or scanned
      return 150000; // ~150KB per page
    } else {
      // Very large PDFs - definitely scanned or high-resolution
      return 300000; // ~300KB per page
    }
  }

  /**
   * Detect if PDF is likely scanned using sophisticated heuristics
   * @param {File} file - PDF file
   * @returns {boolean} True if likely scanned
   */
  detectScannedPDF(file) {
    const sizeInMB = file.size / (1024 * 1024);
    const estimatedPages = Math.ceil(file.size / this.estimatePageSize(file));
    const avgSizePerPage = file.size / estimatedPages;

    // Heuristics based on Stage 1 testing findings:
    // 1. Very large files are usually scanned
    if (sizeInMB > 20) return true;

    // 2. High average size per page suggests images/scans
    if (avgSizePerPage > 200000) return true; // >200KB per page

    // 3. Medium size files with many pages - likely scanned
    if (sizeInMB > 5 && estimatedPages > 20) return true;

    // 4. File naming patterns (common scan patterns)
    const filename = file.name.toLowerCase();
    const scanIndicators = ["scan", "scanned", "copy", "image", "photo"];
    if (scanIndicators.some((indicator) => filename.includes(indicator))) {
      return true;
    }

    return false;
  }

  /**
   * Assess PDF complexity level
   * @param {File} file - PDF file
   * @returns {string} Complexity level: simple, medium, complex
   */
  assessPDFComplexity(file) {
    const sizeInMB = file.size / (1024 * 1024);
    const estimatedPages = Math.ceil(file.size / this.estimatePageSize(file));
    const isScanned = this.detectScannedPDF(file);

    // Complex: Large scanned documents or very large files
    if (isScanned && sizeInMB > 10) return "complex";
    if (sizeInMB > 50) return "complex";
    if (estimatedPages > 100) return "complex";

    // Medium: Mid-size documents or moderate scanned content
    if (isScanned && sizeInMB > 2) return "medium";
    if (sizeInMB > 5) return "medium";
    if (estimatedPages > 20) return "medium";

    // Simple: Small documents, text-based
    return "simple";
  }

  /**
   * Calculate confidence level for analysis
   * @param {File} file - PDF file
   * @param {Object} analysis - Current analysis object
   * @returns {string} Confidence level: low, medium, high
   */
  calculateAnalysisConfidence(file, analysis) {
    let confidenceFactors = 0;

    // File size indicators (more reliable)
    if (file.size > 100000) confidenceFactors++; // >100KB

    // Page count reliability
    if (analysis.estimatedPages > 3) confidenceFactors++;

    // Clear scanned/text distinction
    if (analysis.likelyScanned && file.size > 5 * 1024 * 1024)
      confidenceFactors++; // Clear scanned
    if (!analysis.likelyScanned && file.size < 1024 * 1024) confidenceFactors++; // Clear text

    // Filename indicators
    const filename = file.name.toLowerCase();
    if (filename.includes("scan") || filename.includes("ocr"))
      confidenceFactors++;

    if (confidenceFactors >= 3) return "high";
    if (confidenceFactors >= 2) return "medium";
    return "low";
  }

  /**
   * Estimate processing time based on analysis
   * @param {Object} analysis - File analysis object
   * @returns {string} Processing time: fast, medium, slow
   */
  estimateProcessingTime(analysis) {
    // Complex or scanned documents take longer
    if (analysis.complexity === "complex") return "slow";
    if (analysis.likelyScanned && analysis.estimatedPages > 10) return "slow";

    // Medium complexity or moderate scanned content
    if (analysis.complexity === "medium") return "medium";
    if (analysis.likelyScanned && analysis.estimatedPages > 3) return "medium";
    if (analysis.estimatedPages > 20) return "medium";

    return "fast";
  }

  /**
   * Assess image complexity for processing estimation
   * @param {File} file - Image file
   * @returns {string} Complexity level: simple, medium, complex
   */
  assessImageComplexity(file) {
    const sizeInMB = file.size / (1024 * 1024);

    if (sizeInMB > 10) return "complex"; // Very large images
    if (sizeInMB > 3) return "medium"; // Large images
    return "simple"; // Standard images
  }

  /**
   * Select optimal engine based on analysis (Stage 5 implementation)
   * @param {Object} analysis - File analysis object
   * @returns {Object} Engine recommendations with reasoning
   */
  selectOptimalEngine(analysis) {
    const recommendations = {
      primary: "native",
      alternatives: ["pdf-text", "mistral-ocr"],
      reasoning: [],
      costComparison: {},
      performanceNotes: [],
    };

    // Decision matrix based on Stage 1 testing insights
    if (analysis.likelyScanned) {
      recommendations.primary = "mistral-ocr";
      recommendations.reasoning.push(
        "Scanned document detected - OCR required"
      );
      recommendations.alternatives = ["native"]; // fallback only
      recommendations.performanceNotes.push("May generate large responses");
    } else if (
      analysis.complexity === "simple" &&
      analysis.estimatedPages < 20
    ) {
      recommendations.primary = "native";
      recommendations.reasoning.push(
        "Text PDF with good structure - best performance"
      );
      recommendations.alternatives = ["pdf-text", "mistral-ocr"];
      recommendations.performanceNotes.push(
        "Fastest processing, token-based cost"
      );
    } else if (analysis.estimatedPages > 50) {
      recommendations.primary = "pdf-text";
      recommendations.reasoning.push(
        "Large document - free processing recommended"
      );
      recommendations.alternatives = ["native", "mistral-ocr"];
      recommendations.performanceNotes.push(
        "No processing cost, basic extraction only"
      );
    } else {
      // Complex document
      recommendations.primary = "native";
      recommendations.reasoning.push(
        "Complex layout - native processing preserves structure"
      );
      recommendations.alternatives = ["mistral-ocr"];
      recommendations.performanceNotes.push("Better structure preservation");
    }

    logDebug("Engine recommendation generated:", {
      primary: recommendations.primary,
      reasoning: recommendations.reasoning[0],
      scanned: analysis.likelyScanned,
      complexity: analysis.complexity,
    });

    return recommendations;
  }

  /**
   * Generate detailed cost breakdown for different engines
   * @param {Object} analysis - File analysis object
   * @returns {Object} Cost breakdown for all available engines
   */
  generateCostBreakdown(analysis) {
    const costs = CONFIG?.FILE_UPLOAD?.PDF_ENGINE_COSTS || {
      "pdf-text": 0,
      "mistral-ocr": 0.002,
      native: 0.001,
    };

    const breakdown = {};
    const pages = analysis.estimatedPages || 1;

    // Calculate costs for each engine
    Object.keys(costs).forEach((engine) => {
      if (engine === "pdf-text") {
        breakdown[engine] = {
          cost: 0,
          display: "Free",
          confidence: "high",
          notes: "No processing cost, basic text extraction",
        };
      } else if (engine === "mistral-ocr") {
        const cost = (pages / 1000) * costs[engine];
        breakdown[engine] = {
          cost: cost,
          display: `£${cost.toFixed(4)} (~${pages} pages)`,
          confidence: analysis.likelyScanned ? "high" : "medium",
          notes: analysis.likelyScanned
            ? "Recommended for scanned content"
            : "OCR processing for scanned documents",
        };
      } else if (engine === "native") {
        breakdown[engine] = {
          cost: "variable",
          display: "Token-based (usually lowest)",
          confidence: analysis.likelyScanned ? "low" : "high",
          notes: analysis.likelyScanned
            ? "May struggle with scanned content"
            : "Best for text-based PDFs",
        };
      }
    });

    logDebug("Cost breakdown generated:", {
      engines: Object.keys(breakdown),
      pages: pages,
      recommended: analysis.recommendedEngine,
    });

    return breakdown;
  }

  /**
   * Predict response size for files and engines
   * @param {File} file - File to analyse
   * @param {string} engine - Processing engine
   * @returns {Object} Response size prediction
   */
  predictResponseSize(file, engine) {
    const prediction = {
      estimated: "small", // small, medium, large, very-large
      bytes: 0,
      estimatedSize: 0, // Size in MB for display
      warning: false,
      confidence: "medium", // low, medium, high
      factors: [], // factors affecting size
      recommendation: null, // user recommendation
    };

    if (file.type === "application/pdf") {
      // Avoid circular dependency - use existing analysis or create minimal analysis
      let analysis;
      if (this.fileAnalysis && this.fileAnalysis !== null) {
        analysis = this.fileAnalysis;
      } else {
        // Create minimal analysis without calling full fallbackAnalysis
        analysis = {
          estimatedPages: Math.max(
            1,
            Math.round(file.size / this.estimatePageSize(file))
          ),
          complexity: this.assessPDFComplexity(file),
          likelyScanned: this.detectScannedPDF(file),
        };
      }
      const pages = analysis.estimatedPages || 1;
      const complexity = analysis.complexity || "simple";

      // Engine-specific predictions based on Stage 1 testing findings
      switch (engine) {
        case "mistral-ocr":
          // High risk of large responses with base64 content
          if (pages > 5) {
            prediction.estimated = "large";
            prediction.bytes = pages * 100 * 1024; // ~100KB per page
            prediction.warning = true;
            prediction.factors.push("OCR processing generates large responses");
          } else {
            prediction.estimated = "medium";
            prediction.bytes = pages * 50 * 1024; // ~50KB per page
            prediction.factors.push("OCR processing with embedded content");
          }
          break;

        case "native":
          // Text-based responses, more predictable
          if (complexity === "complex" && pages > 10) {
            prediction.estimated = "medium";
            prediction.bytes = 500 * 1024; // ~500KB
            prediction.factors.push(
              "Complex layout may generate verbose output"
            );
          } else {
            prediction.estimated = "small";
            prediction.bytes = 100 * 1024; // ~100KB
            prediction.factors.push("Text-based processing, compact output");
          }
          break;

        case "pdf-text":
          // Usually smaller responses
          prediction.estimated = "small";
          prediction.bytes = 50 * 1024; // ~50KB
          prediction.factors.push(
            "Text extraction generates compact responses"
          );
          break;

        default:
          prediction.estimated = "small";
          prediction.factors.push("Unknown engine, assuming small response");
      }

      // Calculate estimatedSize in MB from bytes
      prediction.estimatedSize = prediction.bytes / (1024 * 1024);

      // Set warning thresholds
      if (prediction.bytes > 1024 * 1024) {
        // 1MB
        prediction.warning = true;
        prediction.recommendation =
          "Consider using pdf-text engine for large documents";
      }

      prediction.confidence = this.calculatePredictionConfidence(
        analysis,
        engine
      );
    }

    logDebug("Response size prediction:", {
      engine: engine,
      estimated: prediction.estimated,
      warning: prediction.warning,
      factors: prediction.factors.length,
    });

    return prediction;
  }

  /**
   * Calculate prediction confidence for response size
   * @param {Object} analysis - File analysis object
   * @param {string} engine - Processing engine
   * @returns {string} Confidence level: low, medium, high
   */
  calculatePredictionConfidence(analysis, engine) {
    let factors = 0;

    // Engine-specific confidence
    if (engine === "mistral-ocr" && analysis.likelyScanned) factors++;
    if (engine === "native" && !analysis.likelyScanned) factors++;
    if (engine === "pdf-text") factors++; // Always predictable

    // Analysis confidence
    if (analysis.confidence === "high") factors++;
    if (analysis.complexity !== "complex") factors++;

    if (factors >= 3) return "high";
    if (factors >= 2) return "medium";
    return "low";
  }

  /**
   * Predict response size for image files
   * @param {File} file - Image file
   * @returns {Object} Response size prediction for images
   */
  predictImageResponseSize(file) {
    const prediction = {
      estimated: "small",
      bytes: 20 * 1024, // ~20KB typical for image analysis
      estimatedSize: (20 * 1024) / (1024 * 1024), // Convert to MB
      warning: false,
      confidence: "high",
      factors: ["Image analysis typically generates concise descriptions"],
      recommendation: null,
    };

    const sizeInMB = file.size / (1024 * 1024);

    // Large images might generate more detailed responses
    if (sizeInMB > 5) {
      prediction.estimated = "medium";
      prediction.bytes = 50 * 1024; // ~50KB
      prediction.estimatedSize = (50 * 1024) / (1024 * 1024); // Convert to MB
      prediction.factors.push("Large image may generate detailed analysis");
    }

    // Very large images might hit processing limits
    if (sizeInMB > 15) {
      prediction.warning = true;
      prediction.factors.push("Very large image - consider resizing");
      prediction.recommendation = "Consider compressing image before upload";
    }

    // Ensure estimatedSize is always set
    if (!prediction.estimatedSize) {
      prediction.estimatedSize = prediction.bytes / (1024 * 1024);
    }

    return prediction;
  }

  /**
   * Show file preview in UI (Enhanced for Stage 5)
   */
  showPreview(file) {
    logDebug("FileHandler: Showing enhanced file preview");

    // Update filename and size in existing UI elements
    const filenameElement = document.getElementById("preview-filename");
    const filesizeElement = document.getElementById("preview-filesize");

    if (filenameElement) filenameElement.textContent = file.name;
    if (filesizeElement)
      filesizeElement.textContent = this.formatFileSize(file.size);

    // Generate and show enhanced preview content
    const previewContent = document.getElementById("preview-content");
    if (previewContent) {
      // Clear existing content
      previewContent.innerHTML = "";

      // Generate and append enhanced preview
      const enhancedPreview = this.generatePreview(file);
      previewContent.appendChild(enhancedPreview);
    }

    // Show preview area
    this.previewArea.hidden = false;

    // Hide upload controls
    const uploadControls = this.uploadSection.querySelector(
      ".file-upload-controls"
    );
    if (uploadControls) {
      uploadControls.style.display = "none";
    }

    // Notify accessibility tools
    const analysis = this.fileAnalysis || {};
    const announcement = `Enhanced preview loaded for ${file.name}. ${
      analysis.complexity || "Simple"
    } complexity, ${
      analysis.recommendedEngine || "native"
    } engine recommended.`;

    // Use existing accessibility helper if available
    if (window.a11y && window.a11y.announceStatus) {
      window.a11y.announceStatus(announcement, "polite");
    }
  }

  /**
   * Stage 5 Step 2: Generate enhanced visual preview with rich analysis display
   * @param {File} file - File to preview
   * @returns {HTMLElement} Preview element with enhanced analysis display
   */
  generatePreview(file) {
    logInfo("FileHandler: Generating enhanced visual preview for:", file.name);

    // Create container element
    const previewContainer = document.createElement("div");
    previewContainer.className = "file-preview-content enhanced-preview";
    previewContainer.setAttribute("role", "region");
    previewContainer.setAttribute("aria-label", `Preview of ${file.name}`);

    try {
      if (file.type.startsWith("image/")) {
        // Enhanced image preview with error handling
        const imageContent = this.createImagePreview(file);
        previewContainer.appendChild(imageContent);
      } else if (file.type === "application/pdf") {
        // Rich PDF info card with analysis results
        const pdfContent = this.createPDFInfoCard(file);
        previewContainer.appendChild(pdfContent);
      } else {
        // Generic file preview
        const genericContent = this.createGenericFilePreview(file);
        previewContainer.appendChild(genericContent);
      }

      // Add response size warning if needed
      const sizeWarning = this.createResponseSizeWarning(file);
      if (sizeWarning) {
        previewContainer.appendChild(sizeWarning);
      }

      // Add engine recommendation display
      const engineRecommendation = this.createEngineRecommendationDisplay(file);
      if (engineRecommendation) {
        previewContainer.appendChild(engineRecommendation);
      }

      logInfo("FileHandler: Enhanced preview generated successfully");
      return previewContainer;
    } catch (error) {
      logError("FileHandler: Preview generation failed:", error);
      return this.createErrorPreview(file, error);
    }
  }

  /**
   * Stage 5 Step 2: Create enhanced image preview with error handling
   * @param {File} file - Image file
   * @returns {HTMLElement} Image preview element
   */
  createImagePreview(file) {
    const imageContainer = document.createElement("div");
    imageContainer.className = "image-preview-container";

    // Create image element
    const img = document.createElement("img");
    img.className = "image-preview";
    img.alt = `Preview of ${file.name}`;

    // Create image info display
    const imageInfo = document.createElement("div");
    imageInfo.className = "image-info";

    // Get enhanced analysis data
    const analysis = this.fileAnalysis || this.fallbackAnalysis(file);

    imageInfo.innerHTML = `
      <div class="image-details">
        <span class="file-size">📏 ${this.formatFileSize(file.size)}</span>
        <span class="complexity">⚡ ${
          analysis.complexity || "Simple"
        } complexity</span>
        <span class="processing-time">⏱️ ${
          analysis.processingTime || "Fast"
        } processing</span>
      </div>
    `;

    // Set up image loading with error handling
    this.setupImagePreviewHandling(img, file, imageContainer);

    imageContainer.appendChild(img);
    imageContainer.appendChild(imageInfo);

    return imageContainer;
  }

  /**
   * Stage 5 Step 2: Set up image preview with comprehensive error handling
   * @param {HTMLImageElement} img - Image element
   * @param {File} file - Image file
   * @param {HTMLElement} container - Container element
   */
  setupImagePreviewHandling(img, file, container) {
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      container.classList.add("image-loaded");
      logDebug("FileHandler: Image preview loaded successfully");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      this.handlePreviewError(img, file, container);
    };

    // Set source to start loading
    img.src = url;

    // Add loading indicator
    container.classList.add("image-loading");
  }

  /**
   * Stage 5 Step 2: Handle image preview loading errors
   * @param {HTMLImageElement} img - Failed image element
   * @param {File} file - Original file
   * @param {HTMLElement} container - Container element
   */
  handlePreviewError(img, file, container) {
    logWarn("FileHandler: Image preview failed for:", file.name);

    // Remove failed image
    if (img.parentNode) {
      img.parentNode.removeChild(img);
    }

    // Create error placeholder
    const errorPlaceholder = document.createElement("div");
    errorPlaceholder.className = "image-preview-error";
    errorPlaceholder.innerHTML = `
      <div class="error-icon" aria-hidden="true">🖼️</div>
      <div class="error-message">
        <strong>Preview unavailable</strong>
        <span>Image: ${file.name}</span>
        <span>${this.formatFileSize(file.size)}</span>
      </div>
    `;

    container.appendChild(errorPlaceholder);
    container.classList.remove("image-loading");
    container.classList.add("image-error");
  }

  /**
   * Stage 5 Step 2: Create comprehensive PDF information card with enhanced analysis
   * @param {File} file - PDF file
   * @returns {HTMLElement} PDF info card element
   */
  createPDFInfoCard(file) {
    const pdfCard = document.createElement("div");
    pdfCard.className = "pdf-info-card";

    // Get enhanced analysis data
    const analysis = this.fileAnalysis || this.fallbackAnalysis(file);

    // Create header
    const header = document.createElement("div");
    header.className = "pdf-card-header";
    header.innerHTML = `
      <h3 class="pdf-title">${file.name}</h3>
      <div class="pdf-icon" aria-hidden="true">📄</div>
    `;

    // Create statistics section
    const stats = document.createElement("div");
    stats.className = "pdf-stats";
    stats.innerHTML = `
      <div class="stat-item">
        <span class="stat-icon" aria-hidden="true">📄</span>
        <span class="stat-value">${analysis.estimatedPages || 1} pages</span>
      </div>
      <div class="stat-item">
        <span class="stat-icon" aria-hidden="true">⚡</span>
        <span class="stat-value">${
          analysis.complexity || "Simple"
        } complexity</span>
      </div>
      <div class="stat-item">
        <span class="stat-icon" aria-hidden="true">🔧</span>
        <span class="stat-value">${
          analysis.recommendedEngine || "Native"
        } recommended</span>
      </div>
      <div class="stat-item">
        <span class="stat-icon" aria-hidden="true">⏱️</span>
        <span class="stat-value">${
          analysis.processingTime || "Fast"
        } processing</span>
      </div>
    `;

    // Create cost breakdown section
    const costSection = this.createCostBreakdownDisplay(analysis);

    // Create confidence indicator
    const confidenceIndicator = document.createElement("div");
    confidenceIndicator.className = `confidence-indicator confidence-${
      analysis.confidence || "medium"
    }`;
    confidenceIndicator.innerHTML = `
      <span class="confidence-label">Analysis confidence:</span>
      <span class="confidence-value">${analysis.confidence || "Medium"}</span>
    `;

    // Assemble card
    pdfCard.appendChild(header);
    pdfCard.appendChild(stats);
    pdfCard.appendChild(costSection);
    pdfCard.appendChild(confidenceIndicator);

    return pdfCard;
  }

  /**
   * Create cost breakdown display for PDF analysis
   * @param {Object} analysis - File analysis object
   * @returns {HTMLElement} Cost breakdown element
   */
  createCostBreakdownDisplay(analysis) {
    const costContainer = document.createElement("div");
    costContainer.className = "cost-breakdown";

    const costHeader = document.createElement("h4");
    costHeader.textContent = "Engine Options:";
    costHeader.className = "cost-breakdown-header";

    // Create radio group for engine selection
    const engineGroup = document.createElement("fieldset");
    engineGroup.className = "engine-options-fieldset";
    engineGroup.setAttribute("role", "radiogroup");
    engineGroup.setAttribute("aria-labelledby", "engine-options-legend");

    const legend = document.createElement("legend");
    legend.id = "engine-options-legend";
    legend.className = "sr-only"; // Screen reader only
    legend.textContent = "Select PDF processing engine";

    const costList = document.createElement("div");
    costList.className = "cost-options-list interactive";
    costList.setAttribute("role", "group");

    if (analysis.costBreakdown) {
      // Get current parameter value for pre-selection
      const currentEngine = this.getCurrentEngineSelection();
      const recommendedEngine = analysis.recommendedEngine;

      Object.entries(analysis.costBreakdown).forEach(([engine, details]) => {
        const isRecommended = engine === recommendedEngine;
        const isSelected = this.shouldSelectEngine(
          engine,
          currentEngine,
          recommendedEngine
        );

        // Create interactive radio button card
        const option = this.createInteractiveEngineCard(
          engine,
          details,
          isRecommended,
          isSelected
        );

        costList.appendChild(option);
      });
    }

    engineGroup.appendChild(legend);
    engineGroup.appendChild(costList);
    costContainer.appendChild(costHeader);
    costContainer.appendChild(engineGroup);

    // Set up event delegation for card interactions
    this.setupEngineCardEventHandlers(costList);

    return costContainer;
  }

  /**
   * Create an interactive engine selection card with native radio button
   * @param {string} engine - Engine identifier
   * @param {Object} details - Engine details (cost, notes, etc.)
   * @param {boolean} isRecommended - Whether this engine is recommended
   * @param {boolean} isSelected - Whether this engine should be pre-selected
   * @returns {HTMLElement} Interactive engine card element
   */
  createInteractiveEngineCard(engine, details, isRecommended, isSelected) {
    const cardId = `engine-card-${engine}`;
    const radioId = `engine-radio-${engine}`;

    // Create the main card container
    const card = document.createElement("label");
    card.className = `engine-option interactive-card ${
      isRecommended ? "recommended" : ""
    } ${isSelected ? "selected" : ""}`;
    card.setAttribute("for", radioId);
    card.setAttribute("aria-describedby", `${cardId}-details`);

    // Create native radio input
    const radioInput = document.createElement("input");
    radioInput.type = "radio";
    radioInput.id = radioId;
    radioInput.name = "pdf-engine-visual";
    radioInput.value = engine;
    radioInput.checked = isSelected;
    radioInput.className = "engine-radio";
    radioInput.setAttribute("aria-describedby", `${cardId}-details`);

    // Create engine name section (without badge)
    const engineName = document.createElement("div");
    engineName.id = `${cardId}-label`;
    engineName.className = "engine-name";
    engineName.textContent = this.formatEngineName(engine);

    // Create cost display
    const engineCost = document.createElement("div");
    engineCost.className = "engine-cost";
    engineCost.textContent = details.display || details.cost;

    // Create notes section if available
    const engineDetails = document.createElement("div");
    engineDetails.id = `${cardId}-details`;
    engineDetails.className = "engine-details";

    if (details.notes) {
      const notes = document.createElement("div");
      notes.className = "engine-notes";
      notes.textContent = details.notes;
      engineDetails.appendChild(notes);
    }

    // Create recommended badge as separate element
    const recommendedBadge = document.createElement("div");
    recommendedBadge.className = "recommended-badge-container";
    if (isRecommended) {
      const badge = document.createElement("span");
      badge.className = "recommended-badge";
      badge.textContent = "Recommended";
      recommendedBadge.appendChild(badge);
    }

    // Assemble the card
    card.appendChild(radioInput);
    card.appendChild(engineName);
    card.appendChild(engineCost);
    if (details.notes) {
      card.appendChild(engineDetails);
    }
    card.appendChild(recommendedBadge);

    return card;
  }

  /**
   * Get current engine selection from parameter system
   * @returns {string} Current engine selection
   */
  getCurrentEngineSelection() {
    try {
      const pdfParam = window.parameterRegistry?.getParameter("pdf-engine");
      if (pdfParam) {
        return pdfParam.getValue();
      }
    } catch (error) {
      logWarn("Could not get current engine selection:", error);
    }
    return "auto"; // Safe default
  }

  /**
   * Determine if an engine should be pre-selected
   * @param {string} engine - Engine to check
   * @param {string} currentEngine - Current parameter value
   * @param {string} recommendedEngine - Recommended engine
   * @returns {boolean} Whether to select this engine
   */
  shouldSelectEngine(engine, currentEngine, recommendedEngine) {
    // If parameter has a specific value, use that
    if (currentEngine && currentEngine !== "auto") {
      return engine === currentEngine;
    }

    // If set to auto or no selection, pre-select recommended
    if (currentEngine === "auto" || !currentEngine) {
      return engine === recommendedEngine;
    }

    return false;
  }

  /**
   * Set up event handlers for interactive engine cards with native radio buttons
   * @param {HTMLElement} container - Container with engine cards
   */
  setupEngineCardEventHandlers(container) {
    // Radio button change handler (primary interaction)
    const handleRadioChange = (event) => {
      if (!event.target.matches(".engine-radio")) return;

      const engine = event.target.value;
      const card = event.target.closest(".engine-option.interactive-card");

      // Update visual selection
      this.updateVisualSelection(container, card, engine);

      // Sync with parameter system
      this.syncEngineSelectionWithParameter(engine);

      // Announce change to screen readers
      this.announceEngineSelection(engine, card);
    };

    // Card click handler (delegates to radio button)
    const handleCardClick = (event) => {
      const card = event.target.closest(".engine-option.interactive-card");
      if (!card) return;

      // If clicking on the label but not the radio, trigger the radio
      const radio = card.querySelector(".engine-radio");
      if (radio && event.target !== radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    // Keyboard navigation handler
    const handleKeyboardNavigation = (event) => {
      if (!event.target.matches(".engine-radio")) return;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        this.focusNextEngineCard(container, event.target);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        this.focusPreviousEngineCard(container, event.target);
      }
    };

    // Set up event delegation
    container.addEventListener("change", handleRadioChange);
    container.addEventListener("click", handleCardClick);
    container.addEventListener("keydown", handleKeyboardNavigation);

    // Store reference for cleanup if needed
    if (!this.engineCardEventHandlers) {
      this.engineCardEventHandlers = new Map();
    }
    this.engineCardEventHandlers.set(container, {
      handleRadioChange,
      handleCardClick,
      handleKeyboardNavigation,
    });
  }

  /**
   * Update visual selection state for engine cards with native radio buttons
   * @param {HTMLElement} container - Container with all cards
   * @param {HTMLElement} selectedCard - The newly selected card
   * @param {string} engine - Selected engine
   */
  updateVisualSelection(container, selectedCard, engine) {
    // Remove selection from all cards
    const allCards = container.querySelectorAll(
      ".engine-option.interactive-card"
    );
    allCards.forEach((card) => {
      card.classList.remove("selected");

      const radio = card.querySelector(".engine-radio");
      if (radio) {
        radio.checked = false;
      }
    });

    // Add selection to the chosen card
    selectedCard.classList.add("selected");

    const radio = selectedCard.querySelector(".engine-radio");
    if (radio) {
      radio.checked = true;
    }

    logInfo("Visual engine selection updated", {
      engine,
      cardCount: allCards.length,
    });
  }

  /**
   * Sync visual selection with parameter system
   * @param {string} engine - Selected engine
   */
  syncEngineSelectionWithParameter(engine) {
    try {
      const pdfParam = window.parameterRegistry?.getParameter("pdf-engine");
      if (pdfParam) {
        // Update parameter value
        pdfParam.setValue(engine);

        // This will trigger the parameter's change handler, which will:
        // 1. Update cost displays
        // 2. Emit 'pdf-engine-changed' event
        // 3. Sync with file handler state

        logInfo("Engine selection synced with parameter system", { engine });
      } else {
        logWarn("PDF parameter not available for sync");
      }
    } catch (error) {
      logError("Failed to sync engine selection with parameter:", error);
    }
  }

  /**
   * Announce engine selection to screen readers
   * @param {string} engine - Selected engine
   * @param {HTMLElement} card - Selected card element
   */
  announceEngineSelection(engine, card) {
    const engineName = this.formatEngineName(engine);
    const isRecommended = card.classList.contains("recommended");
    const costText = card.querySelector(".engine-cost")?.textContent || "";

    let announcement = `${engineName} selected`;
    if (costText) {
      announcement += `, ${costText}`;
    }
    if (isRecommended) {
      announcement += " (Recommended)";
    }

    // Use existing accessibility helper if available
    if (window.a11y && window.a11y.announceStatus) {
      window.a11y.announceStatus(announcement, "polite");
    }

    logInfo("Engine selection announced", { engine, announcement });
  }

  /**
   * Focus next engine radio button for keyboard navigation
   * @param {HTMLElement} container - Container with cards
   * @param {HTMLElement} currentRadio - Currently focused radio button
   */
  focusNextEngineCard(container, currentRadio) {
    const radios = Array.from(container.querySelectorAll(".engine-radio"));
    const currentIndex = radios.indexOf(currentRadio);
    const nextIndex = (currentIndex + 1) % radios.length;
    radios[nextIndex].focus();
  }

  /**
   * Focus previous engine radio button for keyboard navigation
   * @param {HTMLElement} container - Container with cards
   * @param {HTMLElement} currentRadio - Currently focused radio button
   */
  focusPreviousEngineCard(container, currentRadio) {
    const radios = Array.from(container.querySelectorAll(".engine-radio"));
    const currentIndex = radios.indexOf(currentRadio);
    const prevIndex = currentIndex === 0 ? radios.length - 1 : currentIndex - 1;
    radios[prevIndex].focus();
  }

  /**
   * Stage 5 Step 3: Create response size warning display
   * @param {File} file - File to analyse
   * @returns {HTMLElement|null} Warning element or null if no warning needed
   */
  createResponseSizeWarning(file) {
    const analysis = this.fileAnalysis || this.fallbackAnalysis(file);
    const sizePrediction = analysis.sizePrediction;

    if (!sizePrediction || !sizePrediction.warning) {
      return null;
    }

    const warningContainer = document.createElement("div");
    warningContainer.className = `response-size-warning warning-${sizePrediction.estimated}`;
    warningContainer.setAttribute("role", "alert");

    // Warning icon and message
    const warningHeader = document.createElement("div");
    warningHeader.className = "warning-header";
    warningHeader.innerHTML = `
      <span class="warning-icon" aria-hidden="true">⚠️</span>
      <strong>Large response predicted</strong>
    `;

    // Warning details
    const warningDetails = document.createElement("div");
    warningDetails.className = "warning-details";

    const sizeEstimate = document.createElement("div");
    sizeEstimate.className = "size-estimate";
    sizeEstimate.textContent = `Estimated size: ${
      sizePrediction.estimated
    } (${this.formatFileSize(sizePrediction.bytes || 0)})`;

    const confidence = document.createElement("div");
    confidence.className = "warning-confidence";
    confidence.textContent = `Prediction confidence: ${
      sizePrediction.confidence || "Medium"
    }`;

    warningDetails.appendChild(sizeEstimate);
    warningDetails.appendChild(confidence);

    // Factors affecting size
    if (sizePrediction.factors && sizePrediction.factors.length > 0) {
      const factorsList = document.createElement("ul");
      factorsList.className = "warning-factors";

      sizePrediction.factors.forEach((factor) => {
        const listItem = document.createElement("li");
        listItem.textContent = factor;
        factorsList.appendChild(listItem);
      });

      warningDetails.appendChild(factorsList);
    }

    // Recommendation
    if (sizePrediction.recommendation) {
      const recommendation = document.createElement("div");
      recommendation.className = "warning-recommendation";
      recommendation.innerHTML = `
        <strong>Recommendation:</strong> ${sizePrediction.recommendation}
      `;
      warningDetails.appendChild(recommendation);
    }

    warningContainer.appendChild(warningHeader);
    warningContainer.appendChild(warningDetails);

    return warningContainer;
  }

  /**
   * Stage 5 Step 4: Create engine recommendation display
   * @param {File} file - File to analyse
   * @returns {HTMLElement|null} Recommendation element or null if none available
   */
  createEngineRecommendationDisplay(file) {
    const analysis = this.fileAnalysis || this.fallbackAnalysis(file);
    const recommendations = analysis.engineRecommendations;

    if (
      !recommendations ||
      !recommendations.reasoning ||
      recommendations.reasoning.length === 0
    ) {
      return null;
    }

    const recommendationContainer = document.createElement("div");
    recommendationContainer.className = "engine-recommendation-display";

    // Recommendation header
    const header = document.createElement("div");
    header.className = "recommendation-header";
    header.innerHTML = `
      <span class="recommendation-icon" aria-hidden="true">🧠</span>
      <strong>Smart Engine Selection</strong>
    `;

    // Primary recommendation
    const primary = document.createElement("div");
    primary.className = "primary-recommendation";
    primary.innerHTML = `
      <div class="recommended-engine">
        <strong>Recommended:</strong> ${this.formatEngineName(
          recommendations.primary
        )}
      </div>
    `;

    // Reasoning list
    const reasoningList = document.createElement("ul");
    reasoningList.className = "recommendation-reasoning";

    recommendations.reasoning.forEach((reason) => {
      const listItem = document.createElement("li");
      listItem.textContent = reason;
      reasoningList.appendChild(listItem);
    });

    // Performance notes
    if (
      recommendations.performanceNotes &&
      recommendations.performanceNotes.length > 0
    ) {
      const performanceContainer = document.createElement("div");
      performanceContainer.className = "performance-notes";

      const performanceHeader = document.createElement("div");
      performanceHeader.className = "performance-header";
      performanceHeader.textContent = "Performance Notes:";

      const performanceList = document.createElement("ul");
      performanceList.className = "performance-list";

      recommendations.performanceNotes.forEach((note) => {
        const listItem = document.createElement("li");
        listItem.textContent = note;
        performanceList.appendChild(listItem);
      });

      performanceContainer.appendChild(performanceHeader);
      performanceContainer.appendChild(performanceList);

      recommendationContainer.appendChild(header);
      recommendationContainer.appendChild(primary);
      recommendationContainer.appendChild(reasoningList);
      recommendationContainer.appendChild(performanceContainer);
    } else {
      recommendationContainer.appendChild(header);
      recommendationContainer.appendChild(primary);
      recommendationContainer.appendChild(reasoningList);
    }

    return recommendationContainer;
  }

  /**
   * Create generic file preview for unsupported file types
   * @param {File} file - File to preview
   * @returns {HTMLElement} Generic preview element
   */
  createGenericFilePreview(file) {
    const genericContainer = document.createElement("div");
    genericContainer.className = "generic-file-preview";

    genericContainer.innerHTML = `
      <div class="generic-file-icon" aria-hidden="true">📄</div>
      <div class="generic-file-details">
        <div class="file-name">${file.name}</div>
        <div class="file-type">${file.type || "Unknown file type"}</div>
        <div class="file-size">${this.formatFileSize(file.size)}</div>
      </div>
    `;

    return genericContainer;
  }

  /**
   * Create error preview when preview generation fails
   * @param {File} file - Original file
   * @param {Error} error - Error that occurred
   * @returns {HTMLElement} Error preview element
   */
  createErrorPreview(file, error) {
    const errorContainer = document.createElement("div");
    errorContainer.className = "preview-generation-error";
    errorContainer.setAttribute("role", "alert");

    errorContainer.innerHTML = `
      <div class="error-header">
        <span class="error-icon" aria-hidden="true">⚠️</span>
        <strong>Preview Error</strong>
      </div>
      <div class="error-details">
        <div>Unable to generate preview for: ${file.name}</div>
        <div>File size: ${this.formatFileSize(file.size)}</div>
        <div class="error-message">Error: ${error.message}</div>
      </div>
    `;

    return errorContainer;
  }

  /**
   * Format engine name for display
   * @param {string} engine - Engine identifier
   * @returns {string} Formatted engine name
   */
  formatEngineName(engine) {
    switch (engine) {
      case "native":
        return "Native";
      case "mistral-ocr":
        return "Mistral OCR";
      case "pdf-text":
        return "PDF Text";
      default:
        return engine.charAt(0).toUpperCase() + engine.slice(1);
    }
  }

  /**
   * Generate preview content based on file type
   */
  generatePreviewContent(file) {
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      return `<img src="${url}" alt="Preview of ${file.name}" class="preview-image" onload="URL.revokeObjectURL(this.src)">`;
    } else if (file.type === "application/pdf") {
      return `
        <div class="preview-pdf-info">
          <div class="preview-pdf-icon" aria-hidden="true">📄</div>
          <div class="preview-pdf-details">
            <div class="preview-pdf-name">${file.name}</div>
            <div class="preview-pdf-size">PDF Document • ${this.formatFileSize(
              file.size
            )}</div>
            ${
              this.fileAnalysis
                ? `<div class="preview-pdf-pages">Estimated ${this.fileAnalysis.estimatedPages} pages</div>`
                : ""
            }
          </div>
        </div>
      `;
    }
    return "<div>File selected for processing</div>";
  }

  /**
   * Estimate and display cost using Stage 3 integration
   */
  async estimateAndDisplayCost(file) {
    logDebug("FileHandler: Estimating cost with Stage 3 integration");

    try {
      // Use Stage 3 parameter handler for cost estimation (defensive)
      const paramHandler = window.requestProcessor?.core?.parameterHandler;

      if (paramHandler?.estimateRequestCost) {
        logDebug("FileHandler: Using Stage 3 cost estimation");

        const messages = [{ role: "user", content: "analyse file" }];
        const parameters = { model: "current" };

        this.costEstimate = paramHandler.estimateRequestCost(
          messages,
          parameters,
          file
        );
        // Ensure formatted property exists
        if (
          this.costEstimate &&
          !this.costEstimate.formatted &&
          this.costEstimate.total
        ) {
          this.costEstimate.formatted = `£${this.costEstimate.total.toFixed(
            4
          )}`;
        }
      } else {
        logWarn(
          "FileHandler: Stage 3 cost estimation not available - using fallback"
        );
        this.costEstimate = this.fallbackCostEstimation(file);
      }

      // Display cost estimate
      this.displayCostEstimate(this.costEstimate);

      // Update file state manager (Phase 4.2+)
      this.fileStateManager.costEstimate = this.costEstimate;

      // Integrate with PDF engine parameter cost display
      if (
        this.pdfEngineParameter &&
        this.currentFile?.type === "application/pdf"
      ) {
        this.pdfEngineParameter.updateCostDisplay();
      }

      // Check for cost warnings using CONFIG thresholds
      this.handleCostWarnings(this.costEstimate);
    } catch (error) {
      logError("FileHandler: Cost estimation failed:", error);
      this.costEstimate = this.fallbackCostEstimation(file);
      this.displayCostEstimate(this.costEstimate);
    }
  }

  /**
   * Fallback cost estimation
   */
  fallbackCostEstimation(file) {
    // Basic cost estimation fallback
    let estimatedCost = 0;

    if (file.type === "application/pdf") {
      const estimatedPages = Math.ceil(file.size / (1024 * 50)); // Rough estimate
      estimatedCost = (estimatedPages / 1000) * 2; // £2 per 1000 pages (mistral-ocr fallback)
    } else {
      estimatedCost = 0.001; // Minimal cost for images
    }

    return {
      total: estimatedCost,
      formatted: `£${estimatedCost.toFixed(4)}`, // Add formatted property
      warning:
        estimatedCost > 0.1 ? (estimatedCost > 1 ? "red" : "orange") : "green",
      breakdown: `Estimated cost: £${estimatedCost.toFixed(3)}`,
    };
  }

  /**
   * Display cost estimate in UI
   */
  displayCostEstimate(estimate) {
    const costElement = document.getElementById("preview-cost");
    if (!costElement || !estimate) return;

    // Set cost level class
    costElement.className = "preview-cost-estimate";
    const warningLevel = estimate.warning || "green";

    if (warningLevel === "green") {
      costElement.classList.add("cost-low");
    } else if (warningLevel === "orange") {
      costElement.classList.add("cost-medium");
    } else if (warningLevel === "red") {
      costElement.classList.add("cost-high");
    }

    // Display cost information
    let costText = "";
    if (estimate.total && typeof estimate.total === "number") {
      costText = `Estimated processing cost: £${estimate.total.toFixed(3)}`;

      if (warningLevel === "orange") {
        costText += " (Medium cost - please review)";
      } else if (warningLevel === "red") {
        costText += " (High cost - please confirm before proceeding)";
      }
    } else {
      costText = "Cost estimation unavailable";
    }

    costElement.innerHTML = `
      <div>${costText}</div>
      ${
        estimate.breakdown
          ? `<div class="cost-breakdown">${estimate.breakdown}</div>`
          : ""
      }
    `;

    // Add response size warning if needed (Phase 4.2+)
    this.checkResponseSizeWarning();
  }

  /**
   * Remove file and reset UI
   */
  /**
   * Display cost estimate with tiered warnings (Phase 4.6)
   * @param {Object} costEstimate - Cost estimation object
   */
  displayCostWithWarnings(costEstimate) {
    const costElement = this.previewArea?.querySelector(".file-cost");
    if (!costElement) return;

    const { total, warning } = this.determineCostWarningLevel(costEstimate);
    const formattedCost = `£${total.toFixed(2)}`;

    // Clear existing warning classes
    costElement.className = "file-cost cost-display";

    // Add warning class
    if (warning !== "none") {
      costElement.classList.add(`cost-warning-${warning}`);
    }

    // Update text content
    costElement.textContent = `Estimated cost: ${formattedCost}`;

    // Add ARIA attributes for accessibility
    if (warning === "red") {
      costElement.setAttribute("role", "alert");
      costElement.setAttribute("aria-live", "assertive");
    } else if (warning === "orange") {
      costElement.setAttribute("role", "status");
      costElement.setAttribute("aria-live", "polite");
    }

    logInfo("Cost display updated with warning", { cost: total, warning });
  }

  /**
   * Determine cost warning level (Phase 4.6)
   * @param {Object} costEstimate - Cost estimation object
   * @returns {Object} Cost total and warning level
   */
  determineCostWarningLevel(costEstimate) {
    const total = costEstimate?.total || 0;
    const thresholds = CONFIG?.FILE_UPLOAD?.COST_WARNING_THRESHOLDS || {
      YELLOW: 0.05, // £0.05+
      ORANGE: 0.5, // £0.50+
      RED: 2.0, // £2.00+
    };

    let warning = "none";
    if (total >= thresholds.RED) {
      warning = "red";
    } else if (total >= thresholds.ORANGE) {
      warning = "orange";
    } else if (total >= thresholds.YELLOW) {
      warning = "yellow";
    }

    return { total, warning };
  }

  /**
   * Check if user confirmation needed for cost (Phase 4.6)
   * @param {number} cost - Estimated cost
   * @returns {Promise<boolean>} User confirmation result
   */
  async checkCostConfirmation(cost) {
    const thresholds = CONFIG?.FILE_UPLOAD?.COST_WARNING_THRESHOLDS || {
      YELLOW: 0.05,
      ORANGE: 0.5,
      RED: 2.0,
    };

    if (cost >= thresholds.RED) {
      // Double confirmation for very high costs
      const firstConfirm = await this.safeConfirm(
        `This request will cost approximately £${cost.toFixed(
          2
        )}. This is a high cost. Continue?`,
        "High Cost Warning"
      );

      if (firstConfirm) {
        return await this.safeConfirm(
          `Please confirm again: Proceed with £${cost.toFixed(2)} request?`,
          "Confirm High Cost"
        );
      }
      return false;
    } else if (cost >= thresholds.ORANGE) {
      // Single confirmation for moderate costs
      return await this.safeConfirm(
        `This request will cost approximately £${cost.toFixed(2)}. Continue?`,
        "Cost Confirmation"
      );
    } else if (cost >= thresholds.YELLOW) {
      // Just notification for low costs
      if (window.notifyInfo) {
        window.notifyInfo(`Estimated cost: £${cost.toFixed(2)}`);
      }
      return true;
    }

    return true; // No warning needed
  }

  /**
   * Safe confirm wrapper (Phase 4.6)
   * @param {string} message - Confirmation message
   * @param {string} title - Modal title
   * @returns {Promise<boolean>} User response
   */
  async safeConfirm(message, title = "Confirm") {
    // Try UniversalModal first
    if (window.UniversalModal?.confirm) {
      return await window.UniversalModal.confirm(message, title);
    }

    // Fallback to browser confirm
    return confirm(message);
  }

  /**
   * Remove file and reset UI with comprehensive memory cleanup
   */
  removeFile() {
    logInfo("Removing file with memory cleanup");

    // Track memory before cleanup
    if (MemoryMonitor) {
      MemoryMonitor.track("FileHandler_removeFile_start", {
        hadFile: !!this.currentFile,
        trackedResources: this.resourceIds.size,
      });
    }

    // Clear file data
    this.currentFile = null;
    this.fileType = null;
    this.base64Data = null;
    this.fileAnalysis = null;
    this.costEstimate = null;
    this.hasValidFile = false;

    // Reset UI
    this.previewArea.hidden = true;
    this.uploadSection.querySelector(".file-upload-controls").style.display =
      "block";

    // Clear file input
    this.fileInput.value = "";

    // Remove any error states
    this.clearErrors();

    // Perform enhanced cleanup (Phase 4.2+)
    this.performEnhancedCleanup();

    // Reset PDF engine parameter if exists (Phase 4.2+)
    if (this.pdfEngineParameter) {
      this.pdfEngineParameter.reset();
    }

    // Reset parameter sync state (Phase 4.2+)
    if (this.parameterSync) {
      this.parameterSync.handleFileStateMessage({ hasFile: false });
    }

    // Clear file state manager (Phase 4.2+)
    this.fileStateManager = {
      currentFile: null,
      validationResult: null,
      costEstimate: null,
      engineRecommendation: null,
    };

    // Phase 4.3.1: Notify parameter sync of file removal
    if (this.parameterSync) {
      window.dispatchEvent(new CustomEvent("file-removed"));
    }

    // Memory Management: Clean up tracked resources
    if (ResourceTracker && this.resourceIds.size > 0) {
      logDebug(`Cleaning up ${this.resourceIds.size} tracked resources`);

      // Release all tracked resources for this handler
      this.resourceIds.forEach((resourceId) => {
        // Try to release from all resource types
        ["readers", "images", "blobs", "canvases"].forEach((type) => {
          try {
            ResourceTracker.release(type, resourceId);
          } catch (e) {
            // Resource might not exist in this type, that's fine
          }
        });
      });

      this.resourceIds.clear();
    }

    // Memory Management: Clean up preview images
    if (this.previewArea) {
      const previewImages = this.previewArea.querySelectorAll("img");
      previewImages.forEach((img) => {
        if (img.src && img.src.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(img.src);
            logDebug("Revoked preview blob URL");
          } catch (e) {
            logDebug("Preview blob cleanup warning:", e.message);
          }
        }
        img.src = "";
        img.onload = null;
        img.onerror = null;
      });
    }

    // Notify other components
    this.notifyFileStateChange(false);

    // Track memory after cleanup
    if (MemoryMonitor) {
      MemoryMonitor.track("FileHandler_removeFile_complete", {
        remainingResources: this.resourceIds.size,
      });
    }

    // Suggest garbage collection
    if (window.gc) {
      window.gc();
      logDebug("Garbage collection suggested after file removal");
    }

    logInfo("File removed successfully with comprehensive memory cleanup");
  }

  /**
   * Show error message
   */
  showError(message) {
    logError("FileHandler: Showing error:", message);

    // Add error class to upload section
    this.uploadSection.classList.add("file-upload-error");

    // Create or update error message
    let errorElement = this.uploadSection.querySelector(
      ".upload-error-message"
    );
    if (!errorElement) {
      errorElement = document.createElement("div");
      errorElement.className = "upload-error-message";
      errorElement.setAttribute("role", "alert");
      this.uploadSection.appendChild(errorElement);
    }

    errorElement.textContent = message;

    // Clear error after 5 seconds
    setTimeout(() => this.clearErrors(), 5000);
  }

  /**
   * Clear error states
   */
  clearErrors() {
    this.uploadSection.classList.remove("file-upload-error");
    const errorElement = this.uploadSection.querySelector(
      ".upload-error-message"
    );
    if (errorElement) {
      errorElement.remove();
    }
  }

  /**
   * Notify other components of file state change
   */
  notifyFileStateChange(hasFile) {
    // Ensure we have proper file reference when hasFile is true
    if (hasFile && !this.currentFile) {
      logWarn(
        "FileHandler: Attempted to notify file state with no current file"
      );
      return;
    }

    const detail = {
      hasFile,
      file: hasFile ? this.currentFile : null,
      fileType: hasFile ? this.fileType : null,
      costEstimate: hasFile ? this.costEstimate : null,
      fileAnalysis: hasFile ? this.fileAnalysis : null,
    };

    window.dispatchEvent(
      new CustomEvent("file-handler-state-changed", { detail })
    );
    logDebug("FileHandler: File state change notification sent:", detail);
  }

  /**
   * Verify Stage 3 integration is available
   */
  verifyStage3Integration() {
    const stage3Components = {
      CONFIG: !!CONFIG?.FILE_UPLOAD,
      fileUtils: !!CONFIG?.FILE_UPLOAD_UTILS,
      parameterHandler: !!window.requestProcessor?.core?.parameterHandler,
      pdfParameter: !!window.parameterRegistry?.getParameter("pdf-engine"),
    };

    logInfo("FileHandler: Stage 3 integration verification:", stage3Components);

    return stage3Components;
  }

  /**
   * Fallback initialisation for degraded functionality
   */
  initialiseFallback() {
    logWarn("FileHandler: Using fallback initialisation");
    this.isInitialised = true;
    // Minimal functionality without full integration
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  }

  /**
   * Get current file data for processing
   */
  getFileData() {
    if (!this.hasValidFile || !this.currentFile) {
      return null;
    }

    return {
      file: this.currentFile,
      base64: this.base64Data,
      type: this.fileType,
      analysis: this.fileAnalysis,
      costEstimate: this.costEstimate,
    };
  }

  /**
   * Initialize parameter system integration (Phase 4.2+)
   */
  initializeParameterIntegration() {
    logDebug(
      "FileHandler: Checking for immediate parameter system availability"
    );

    // Get PDF engine parameter using Stage 3 pattern
    this.parameterController = window.parameterController;

    if (this.parameterController) {
      this.pdfEngineParameter =
        window.parameterRegistry?.getParameter("pdf-engine");

      if (this.pdfEngineParameter) {
        // Listen for PDF engine changes
        document.addEventListener("pdf-engine-changed", (event) => {
          this.handlePDFEngineChange(event.detail);
        });

        logInfo("FileHandler: PDF engine parameter integration successful");
      } else {
        logDebug(
          "FileHandler: PDF engine parameter not yet available - will initialize via deferred sync"
        );
      }
    } else {
      // Changed from logWarn to logDebug since deferred initialization will handle this
      logDebug(
        "FileHandler: Parameter controller not yet available - deferred initialization scheduled"
      );
    }
  }

  /**
   * Initialize advanced cost management (Phase 4.2+)
   */
  initializeCostManagement() {
    logDebug("FileHandler: Initializing advanced cost management");

    // Verify cost warning thresholds
    const thresholds = CONFIG?.FILE_UPLOAD?.COST_WARNING_THRESHOLDS;
    if (thresholds) {
      logInfo("FileHandler: Cost warning system available", thresholds);
    } else {
      logWarn("FileHandler: Cost warning thresholds not available");
    }
  }

  /**
   * Initialize file state synchronization (Phase 4.2+)
   */
  initializeFileStateSync() {
    logDebug(
      "FileHandler: Checking for immediate file state synchronization availability"
    );

    // Connect to existing input handler file integration
    if (window.inputHandler?.fileIntegrationReady) {
      logInfo("FileHandler: Input handler integration detected");
    } else {
      // Changed from logWarn to logDebug since this is expected during early initialization
      logDebug(
        "FileHandler: Input handler integration not yet ready - will be established when available"
      );
    }
  }

  /**
   * Schedule deferred parameter synchronization initialization (Phase 4.3.1)
   */
  scheduleDeferredParameterSync() {
    logDebug(
      "FileHandler: Scheduling deferred parameter sync initialization..."
    );

    // Set up a check for when the parameter system becomes available
    const initializeWhenReady = async () => {
      // Check if parameter system is ready
      if (window.parameterController && window.parameterRegistry) {
        try {
          logInfo(
            "FileHandler: Parameter system detected, initializing sync..."
          );

          const syncSuccess = await this.parameterSync.initialise();

          if (syncSuccess) {
            this.parameterSyncAvailable = true;

            // Create test interface for debugging
            this.parameterSync.createTestInterface();

            logInfo(
              "FileHandler: Deferred parameter synchronization successful - smart engine recommendations now active"
            );

            // Dispatch ready event
            window.dispatchEvent(
              new CustomEvent("parameter-sync-ready", {
                detail: { fileHandler: this },
              })
            );
          } else {
            logWarn("FileHandler: Deferred parameter synchronization failed");
            this.parameterSyncAvailable = false;
          }
        } catch (error) {
          logError(
            "FileHandler: Error in deferred parameter sync initialization:",
            error
          );
          this.parameterSyncAvailable = false;
        }
      } else {
        // Schedule another check
        setTimeout(initializeWhenReady, 500);
      }
    };

    // Start the deferred initialization
    setTimeout(initializeWhenReady, 100);
  }

  /**
   * Manual parameter synchronization initialization (for testing)
   */
  async initializeParameterSynchronizationManually() {
    logInfo("FileHandler: Manual parameter sync initialization requested...");

    try {
      const syncSuccess = await this.parameterSync.initialise();

      if (syncSuccess) {
        this.parameterSyncAvailable = true;

        // Create test interface for debugging
        this.parameterSync.createTestInterface();

        logInfo("FileHandler: Manual parameter synchronization successful");
        return true;
      } else {
        logWarn("FileHandler: Manual parameter synchronization failed");
        this.parameterSyncAvailable = false;
        return false;
      }
    } catch (error) {
      logError(
        "FileHandler: Error in manual parameter sync initialization:",
        error
      );
      this.parameterSyncAvailable = false;
      return false;
    }
  }

  /**
   * Handle PDF engine parameter changes (Phase 4.2+)
   */
  handlePDFEngineChange(detail) {
    logDebug("FileHandler: PDF engine changed", detail);

    if (this.currentFile && detail.file === this.currentFile) {
      // Recalculate cost estimates with new engine
      this.estimateAndDisplayCost(this.currentFile, detail.engine);
    }
  }

  /**
   * Integrate with PDF engine parameter (Phase 4.2+ with timing resilience)
   */
  integrateWithPDFParameter(file) {
    // Attempt immediate integration
    const tryIntegration = () => {
      this.pdfEngineParameter =
        window.parameterRegistry?.getParameter("pdf-engine");

      if (this.pdfEngineParameter) {
        this.pdfEngineParameter.updateForFile(file);

        // Get engine recommendation using CONFIG utilities
        if (CONFIG?.FILE_UPLOAD_UTILS?.getRecommendedPDFEngine) {
          this.fileStateManager.engineRecommendation =
            CONFIG.FILE_UPLOAD_UTILS.getRecommendedPDFEngine(file);

          logInfo("FileHandler: PDF engine parameter updated", {
            recommended: this.fileStateManager.engineRecommendation,
          });
        }
        return true;
      }
      return false;
    };

    // Try immediate integration
    if (tryIntegration()) {
      return;
    }

    // Fallback: Wait for parameter system to be ready
    logWarn(
      "FileHandler: PDF parameter not immediately available, using fallback timing"
    );

    // Retry after a short delay
    setTimeout(() => {
      if (tryIntegration()) {
        logInfo("FileHandler: PDF parameter integration successful on retry");
      } else {
        logWarn(
          "FileHandler: PDF parameter integration failed - continuing without integration"
        );
      }
    }, 100);
  }

  /**
   * Handle cost warnings using CONFIG thresholds (Phase 4.2+)
   */
  handleCostWarnings(costEstimate) {
    if (!costEstimate?.total || typeof costEstimate.total !== "number") return;

    // Use CONFIG utilities if available
    if (CONFIG?.FILE_UPLOAD_UTILS?.getCostWarningLevel) {
      const warningLevel = CONFIG.FILE_UPLOAD_UTILS.getCostWarningLevel(
        costEstimate.total
      );

      if (warningLevel !== "none") {
        this.displayCostWarning(warningLevel, costEstimate.total);
      }
    } else {
      // Fallback: basic threshold checking
      this.basicCostWarningCheck(costEstimate.total);
    }
  }

  /**
   * Display cost warning based on level (Phase 4.2+)
   */
  displayCostWarning(warningLevel, totalCost) {
    const thresholds = CONFIG?.FILE_UPLOAD?.COST_WARNING_THRESHOLDS;
    let message = "";

    switch (warningLevel) {
      case "yellow":
        message = `Moderate cost: £${totalCost.toFixed(3)} (over £${
          thresholds?.YELLOW || 0.01
        })`;
        break;
      case "orange":
        message = `High cost: £${totalCost.toFixed(2)} (over £${
          thresholds?.ORANGE || 0.05
        }) - Please confirm`;
        break;
      case "red":
        message = `Very high cost: £${totalCost.toFixed(2)} (over £${
          thresholds?.RED || 0.1
        }) - Double confirmation required`;
        break;
    }

    logInfo("FileHandler: Cost warning triggered", {
      level: warningLevel,
      cost: totalCost,
    });

    // Display warning in UI if cost element exists
    const costElement = this.previewArea?.querySelector(".file-cost");
    if (costElement && message) {
      costElement.classList.add(`cost-warning-${warningLevel}`);
      costElement.title = message;
    }
  }

  /**
   * Basic cost warning fallback (Phase 4.2+)
   */
  basicCostWarningCheck(totalCost) {
    if (totalCost > 0.1) {
      logWarn("FileHandler: High cost detected (fallback check)", {
        cost: totalCost,
      });
    }
  }

  /**
   * Enhanced file removal cleanup (Phase 4.2+)
   */
  performEnhancedCleanup() {
    logDebug("FileHandler: Performing enhanced cleanup");

    // Clear any cost warnings from UI
    const costElement = this.previewArea?.querySelector(".file-cost");
    if (costElement) {
      costElement.classList.remove(
        "cost-warning-yellow",
        "cost-warning-orange",
        "cost-warning-red"
      );
      costElement.title = "";
    }

    // Clear response size warnings
    const warningElement = document.getElementById("response-warning");
    if (warningElement) {
      warningElement.hidden = true;
    }

    // Reset any parameter-related UI states
    this.resetParameterUIStates();

    logDebug("FileHandler: Enhanced cleanup complete");
  }

  /**
   * Reset parameter-related UI states (Phase 4.2+)
   */
  resetParameterUIStates() {
    // Reset PDF engine parameter visibility and state
    if (this.pdfEngineParameter) {
      try {
        this.pdfEngineParameter.hide();
        this.pdfEngineParameter.setValue(this.pdfEngineParameter.defaultValue);
      } catch (error) {
        logWarn("FileHandler: Error resetting PDF parameter UI", error);
      }
    }

    // Clear any parameter-specific error states
    const parameterControls = document.querySelectorAll(".parameter-control");
    parameterControls.forEach((control) => {
      control.classList.remove("file-related-error");
    });
  }

  /**
   * Check and display response size warnings (Phase 4.2+)
   */
  checkResponseSizeWarning() {
    const warningElement = document.getElementById("response-warning");
    if (!warningElement || !this.currentFile) return;

    const fileSize = this.currentFile.size;
    const warningThreshold =
      CONFIG?.FILE_UPLOAD?.RESPONSE_SIZE_WARNING || 1024 * 1024; // 1MB default

    if (fileSize > warningThreshold) {
      const formattedSize = this.formatFileSize(fileSize);
      const message = `Large file (${formattedSize}) may produce lengthy responses. Consider using summary options.`;

      warningElement.textContent = message;
      warningElement.hidden = false;
      warningElement.setAttribute("role", "alert");

      logInfo("FileHandler: Response size warning displayed", {
        fileSize,
        threshold: warningThreshold,
        formatted: formattedSize,
      });
    } else {
      warningElement.hidden = true;
      warningElement.removeAttribute("role");
    }
  }

  /**
   * Create comprehensive testing interface (Enhanced for Phase 4.3.1)
   */
  createTestInterface() {
    // Defensive reference to avoid ReferenceError
    const fileHandlerInstance = this;

    window.testFileHandlerAdvanced = () => {
      console.log("🧪 Testing Advanced File Handler (Phase 4.3.1)...");

      const tests = {
        // Core functionality
        isInitialised: fileHandlerInstance.isInitialised,
        hasCurrentFile: !!fileHandlerInstance.currentFile,
        hasValidFile: fileHandlerInstance.hasValidFile,

        // UI elements
        domElements: {
          fileInput: !!fileHandlerInstance.fileInput,
          uploadSection: !!fileHandlerInstance.uploadSection,
          previewArea: !!fileHandlerInstance.previewArea,
          removeButton: !!fileHandlerInstance.removeButton,
        },

        // Advanced integrations (Phase 4.3.1 Enhanced)
        advancedIntegration: {
          parameterController: !!fileHandlerInstance.parameterController,
          pdfEngineParameter: !!fileHandlerInstance.pdfEngineParameter,
          parameterSync: !!fileHandlerInstance.parameterSync,
          parameterSyncAvailable:
            fileHandlerInstance.parameterSyncAvailable || false,
          parameterSyncInitialised:
            fileHandlerInstance.parameterSync?.isInitialised || false,
          fileStateManager: !!fileHandlerInstance.fileStateManager,
        },

        // Stage 3 integration
        stage3Integration: fileHandlerInstance.verifyStage3Integration(),

        // Configuration integration
        configIntegration: {
          fileUploadConfig: !!CONFIG?.FILE_UPLOAD,
          utilsAvailable: !!CONFIG?.FILE_UPLOAD_UTILS,
          costThresholds: !!CONFIG?.FILE_UPLOAD?.COST_WARNING_THRESHOLDS,
          responseConfig: !!CONFIG?.FILE_UPLOAD?.RESPONSE_PROCESSING,
        },

        // Methods availability (Phase 4.3.1)
        methods: {
          validateFile: typeof fileHandlerInstance.validateFile === "function",
          processFile: typeof fileHandlerInstance.processFile === "function",
          estimateCost:
            typeof fileHandlerInstance.estimateAndDisplayCost === "function",
          removeFile: typeof fileHandlerInstance.removeFile === "function",
          integrateWithPDFParameter:
            typeof fileHandlerInstance.integrateWithPDFParameter === "function",
          handleCostWarnings:
            typeof fileHandlerInstance.handleCostWarnings === "function",
          checkResponseSizeWarning:
            typeof fileHandlerInstance.checkResponseSizeWarning === "function",
          performEnhancedCleanup:
            typeof fileHandlerInstance.performEnhancedCleanup === "function",
          // Phase 4.3.1 methods
          scheduleDeferredParameterSync:
            typeof fileHandlerInstance.scheduleDeferredParameterSync ===
            "function",
          initializeParameterSynchronizationManually:
            typeof fileHandlerInstance.initializeParameterSynchronizationManually ===
            "function",
        },

        // Current state (Phase 4.3.1)
        currentState: {
          fileType: fileHandlerInstance.fileType,
          hasBase64: !!fileHandlerInstance.base64Data,
          hasAnalysis: !!fileHandlerInstance.fileAnalysis,
          hasCostEstimate: !!fileHandlerInstance.costEstimate,
          stateManager: fileHandlerInstance.fileStateManager,
          // Phase 4.3.1 state
          parameterSyncStatus: fileHandlerInstance.parameterSync
            ? fileHandlerInstance.parameterSync.getSyncStatus()
            : "not available",
        },
      };

      const success =
        tests.isInitialised &&
        tests.domElements.fileInput &&
        tests.stage3Integration.CONFIG &&
        tests.methods.integrateWithPDFParameter;

      // Enhanced success criteria for Phase 4.3.1
      const phase43Success = success && tests.advancedIntegration.parameterSync;

      console.log(
        phase43Success
          ? "✅ Phase 4.3.1 File Handler tests passed"
          : success
          ? "⚠️ Basic File Handler tests passed, parameter sync pending"
          : "❌ File Handler tests failed",
        tests
      );

      return {
        success: phase43Success,
        basicSuccess: success,
        tests,
      };
    };

    // Keep existing basic test for backwards compatibility
    window.testFileHandler = () => {
      return window.testFileHandlerAdvanced();
    };

    // Global exposure for debugging (defensive)
    try {
      window.fileHandler = fileHandlerInstance;
      logInfo("FileHandler: Global exposure successful");
    } catch (error) {
      logError("FileHandler: Error in global exposure:", error);
    }

    // Phase 4.3.1: Additional test commands
    window.testFileHandlerParameterSync = () => {
      if (
        fileHandlerInstance.parameterSync &&
        typeof window.testParameterSync === "function"
      ) {
        console.log("🔄 Testing File Handler Parameter Sync Integration...");

        const syncStatus = fileHandlerInstance.parameterSync.getSyncStatus();
        const syncTest = window.testParameterSync();

        return {
          fileHandlerSync: syncStatus,
          parameterSyncTest: syncTest,
          integrated: syncStatus.initialised && syncTest.success,
        };
      } else {
        console.log("⏳ Parameter sync not yet available");
        return { available: false, message: "Parameter sync system not ready" };
      }
    };

    // Manual parameter sync trigger
    window.triggerFileHandlerParameterSync = async () => {
      if (fileHandlerInstance.initializeParameterSynchronizationManually) {
        console.log("🔧 Manually triggering parameter sync...");
        const result =
          await fileHandlerInstance.initializeParameterSynchronizationManually();
        console.log(
          result ? "✅ Manual sync successful" : "❌ Manual sync failed"
        );
        return result;
      } else {
        console.log("❌ Manual sync method not available");
        return false;
      }
    };

    logInfo("FileHandler: Phase 4.3.1 testing interface created successfully");
  }
}
