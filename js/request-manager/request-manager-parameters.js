/**
 * @fileoverview Request Manager Parameters
 * Handles parameter validation and preparation.
 * Stage 3 Enhancement: Integrated file upload support with cost estimation.
 */

import { parameterController } from "../modules/parameters/parameter-controller.js";
import { modelRegistry } from "../model-definitions.js";
import { CONFIG } from "../config.js";

// Logging configuration (module level)
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
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

/**
 * Manages request parameters
 */
export class RequestManagerParameters {
  /**
   * Create a new RequestManagerParameters instance
   * @param {Object} modelManager - Model manager instance
   */
  constructor(modelManager) {
    this.modelManager = modelManager;
  }

  /**
   * Get current request parameters
   * @returns {Promise<Object>} Request parameters
   */
  async getRequestParameters() {
    const currentModel = this.modelManager.getCurrentModel();
    if (!currentModel) {
      throw new Error("No model selected");
    }

    // Get parameter values from controller
    const parameterValues = parameterController.getParameterValues();

    return {
      model: currentModel,
      ...parameterValues,
    };
  }

  /**
   * Validate request parameters
   * @param {Object} parameters - Parameters to validate
   * @throws {Error} If parameters are invalid
   */
  validateParameters(parameters) {
    // Essential parameters
    const requiredParams = ["model", "temperature", "top_p", "max_tokens"];
    const missing = requiredParams.filter((param) => !parameters[param]);

    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(", ")}`);
    }

    // Numeric validation
    if (isNaN(parameters.max_tokens) || parameters.max_tokens < 1) {
      throw new Error("Max tokens must be greater than 0");
    }

    // Temperature range
    if (parameters.temperature < 0 || parameters.temperature > 2) {
      throw new Error("Temperature must be between 0 and 2");
    }

    // Top P range
    if (parameters.top_p < 0 || parameters.top_p > 1) {
      throw new Error("Top P must be between 0 and 1");
    }

    // Model-specific validation
    const modelConfig = modelRegistry.getModel(parameters.model);
    if (!modelConfig) {
      throw new Error("Invalid model selected");
    }

    // Check against model limits
    if (parameters.max_tokens > modelConfig.maxContext) {
      throw new Error(
        `Max tokens exceeds model limit of ${modelConfig.maxContext}`
      );
    }
  }

  /**
   * Prepare request object with file support and enhanced analysis integration
   * @param {string} inputText - User input
   * @param {Object} parameters - Request parameters
   * @param {Object|null} fileData - File data object (optional)
   * @returns {Promise<Array>} Message array for request
   */
  async prepareRequest(inputText, parameters, fileData = null) {
    logInfo("Preparing request with enhanced analysis integration:", {
      model: parameters?.model,
      hasFileData: !!fileData,
      hasEnhancedAnalysis: !!fileData?.enhancedAnalysis,
      timestamp: Date.now(),
    });

    if (!inputText?.trim() && !fileData) {
      throw new Error("No input provided");
    }

    // Base message structure
    const messages = [];

    if (fileData) {
      // Enhanced file handling with Stage 5 analysis data
      const enhancedAnalysis = fileData.enhancedAnalysis || {};

      logDebug("Using enhanced analysis for request preparation:", {
        recommendedEngine: enhancedAnalysis.recommendedEngine,
        complexity: enhancedAnalysis.complexity,
        confidence: enhancedAnalysis.confidence,
        sizePrediction: enhancedAnalysis.sizePrediction?.estimated,
      });

      // Use smart engine recommendation from enhanced analysis
      const effectiveEngine =
        enhancedAnalysis.recommendedEngine || fileData.engine || "native";

      // Handle file upload request with enhanced metadata
      const fileContent = await this.prepareFileContent(
        fileData.file,
        effectiveEngine,
        enhancedAnalysis
      );

      // Create message with combined content
      const combinedContent = this.combineTextAndFileContent(
        inputText,
        fileContent.content
      );

      messages.push({
        role: "user",
        content: combinedContent,
      });

      // Add plugin configuration if needed
      if (fileContent.pluginConfig) {
        parameters.plugins = [
          {
            id: "file-parser",
            pdf: fileContent.pluginConfig,
          },
        ];
      }

      // Add enhanced analysis metadata for logging and debugging
      parameters.analysisMetadata = {
        complexity: enhancedAnalysis.complexity,
        confidence: enhancedAnalysis.confidence,
        estimatedPages: enhancedAnalysis.estimatedPages,
        likelyScanned: enhancedAnalysis.likelyScanned,
        recommendedEngine: enhancedAnalysis.recommendedEngine,
        sizePrediction: enhancedAnalysis.sizePrediction,
        processingTime: enhancedAnalysis.processingTime,
      };

      logInfo("Enhanced request prepared successfully:", {
        messagesCount: messages.length,
        hasPlugins: !!parameters.plugins,
        analysisConfidence: enhancedAnalysis.confidence,
        usingEngine: effectiveEngine,
        predictedSize: enhancedAnalysis.sizePrediction?.estimated,
      });
    } else {
      // Handle text-only request
      messages.push({
        role: "user",
        content: inputText,
      });

      logInfo("Text-only request prepared");
    }

    return messages;
  }

  /**
   * Prepare file content for API request with enhanced analysis integration
   * @param {File} file - File to process
   * @param {string|null} engine - PDF engine to use
   * @param {Object} enhancedAnalysis - Enhanced analysis data from Stage 5
   * @returns {Promise<Object>} Prepared file content and configuration
   */
  async prepareFileContent(file, engine = null, enhancedAnalysis = {}) {
    logDebug("Preparing file content with enhanced analysis:", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      requestedEngine: engine,
      analysisComplexity: enhancedAnalysis.complexity,
      analysisConfidence: enhancedAnalysis.confidence,
      recommendedEngine: enhancedAnalysis.recommendedEngine,
    });

    try {
      // Convert file to base64
      const base64Content = await this.fileToBase64(file);

      // Prepare content structure
      let result = {
        content: null,
        pluginConfig: null,
        enhancedMetadata: enhancedAnalysis, // Include analysis metadata
      };

      if (file.type.startsWith("image/")) {
        // Image file - use image_url format
        result.content = {
          type: "image_url",
          image_url: {
            url: `data:${file.type};base64,${base64Content}`,
          },
        };

        logDebug("Image content prepared with enhanced metadata:", {
          complexity: enhancedAnalysis.complexity,
          processingTime: enhancedAnalysis.processingTime,
        });
      } else if (file.type === "application/pdf") {
        // PDF file - use file format with smart engine selection
        result.content = {
          type: "file",
          file: {
            filename: file.name,
            file_data: `data:${file.type};base64,${base64Content}`,
          },
        };

        // Use enhanced analysis recommendation with fallback
        const effectiveEngine =
          engine ||
          enhancedAnalysis.recommendedEngine ||
          CONFIG.FILE_UPLOAD_UTILS.getRecommendedPDFEngine(file);

        // Add PDF plugin configuration for specific engines
        if (
          effectiveEngine === "pdf-text" ||
          effectiveEngine === "mistral-ocr"
        ) {
          result.pluginConfig = {
            pdf_engine: effectiveEngine,
          };

          logDebug("Added PDF plugin configuration with enhanced analysis:", {
            pluginConfig: result.pluginConfig,
            engineSource: engine ? "parameter" : "analysis",
            analysisReasoning:
              enhancedAnalysis.engineRecommendations?.reasoning,
          });
        }

        // Log enhanced analysis usage
        logInfo("PDF processing configured using enhanced analysis:", {
          effectiveEngine: effectiveEngine,
          complexity: enhancedAnalysis.complexity,
          confidence: enhancedAnalysis.confidence,
          estimatedPages: enhancedAnalysis.estimatedPages,
          sizePrediction: enhancedAnalysis.sizePrediction?.estimated,
        });
      }

      logInfo("File content prepared successfully with enhanced integration:", {
        contentType: result.content.type,
        hasPluginConfig: !!result.pluginConfig,
        base64Length: base64Content.length,
        analysisConfidence: enhancedAnalysis.confidence,
        usedRecommendedEngine: !!(
          enhancedAnalysis.recommendedEngine &&
          (!engine || engine === enhancedAnalysis.recommendedEngine)
        ),
      });

      return result;
    } catch (error) {
      logError("Enhanced file content preparation failed:", error);
      throw new Error(`Failed to prepare file content: ${error.message}`);
    }
  }

  /**
   * Convert file to base64 string
   * @param {File} file - File to convert
   * @returns {Promise<string>} Base64 encoded content
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove data URL prefix to get just the base64 content
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Combine user text with file content
   * @param {string} userText - User's text input
   * @param {Object} fileContent - Processed file content
   * @returns {Array} Combined content array
   */
  combineTextAndFileContent(userText, fileContent) {
    const combinedContent = [];

    // Add user text if provided
    if (userText && userText.trim()) {
      combinedContent.push({
        type: "text",
        text: userText,
      });
    }

    // Add file content
    combinedContent.push(fileContent);

    return combinedContent;
  }

  /**
   * Validate file content and constraints
   * @param {File} file - File to validate
   * @returns {Promise<Object>} Validation result with warnings
   */
  async validateFileContent(file) {
    logDebug("Validating file content:", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    // Use CONFIG validation
    const validation = CONFIG.FILE_UPLOAD_UTILS.validateFileConstraints(file);

    // Add request-specific validation
    const requestValidation = {
      ...validation,
      modelCompatibility: this.checkModelFileCompatibility(file),
    };

    // Add performance warnings
    if (file.size > CONFIG.FILE_UPLOAD.PERFORMANCE.showProgressFor) {
      const estimatedTime = this.estimateProcessingTime(file);
      requestValidation.warnings.push(
        `Large file detected. Estimated processing time: ${estimatedTime}s`
      );
    }

    logInfo("File validation completed:", {
      valid: requestValidation.valid,
      errorCount: requestValidation.errors.length,
      warningCount: requestValidation.warnings.length,
    });

    return requestValidation;
  }

  /**
   * Check if current model supports file uploads
   * @param {File} file - File to check compatibility for
   * @returns {Object} Compatibility result
   */
  checkModelFileCompatibility(file) {
    const currentModel = this.modelManager.getCurrentModel();
    const modelConfig = modelRegistry.getModel(currentModel);

    // Basic compatibility check - assume most models support files
    // This can be enhanced with model-specific file support data
    const compatible = {
      supported: true,
      limitations: [],
    };

    // Add specific limitations based on file type and model
    if (file.type === "application/pdf" && file.size > 10 * 1024 * 1024) {
      compatible.limitations.push(
        "Large PDFs may have slower processing times"
      );
    }

    logDebug("Model file compatibility check:", {
      model: currentModel,
      fileType: file.type,
      supported: compatible.supported,
      limitationCount: compatible.limitations.length,
    });

    return compatible;
  }

  /**
   * Estimate processing time for file
   * @param {File} file - File to estimate processing time for
   * @returns {number} Estimated time in seconds
   */
  estimateProcessingTime(file) {
    const fileSizeMB = file.size / (1024 * 1024);
    const timeConfig = CONFIG.FILE_UPLOAD.PERFORMANCE.estimatedProcessingTime;

    let timePerMB;
    if (file.type.startsWith("image/")) {
      timePerMB = timeConfig.image;
    } else if (file.type === "application/pdf") {
      // Use PDF engine to determine processing time
      const engine =
        parameterController.getParameterValue("pdf-engine") || "auto";
      const effectiveEngine =
        engine === "auto"
          ? CONFIG.FILE_UPLOAD_UTILS.getRecommendedPDFEngine(file)
          : engine;

      timePerMB =
        timeConfig[`pdf-${effectiveEngine}`] || timeConfig["pdf-native"];
    } else {
      timePerMB = timeConfig.image; // Default fallback
    }

    const estimatedTime = Math.ceil(fileSizeMB * timePerMB);

    logDebug("Processing time estimation:", {
      fileSizeMB: fileSizeMB.toFixed(2),
      timePerMB,
      estimatedTime,
    });

    return estimatedTime;
  }

  /**
   * Estimate request cost including file processing
   * @param {Array} messages - Request messages array
   * @param {Object} parameters - Request parameters
   * @param {File|null} file - File being processed (optional)
   * @returns {Object} Cost breakdown with warning level
   */
  estimateRequestCost(messages, parameters, file = null) {
    logDebug("Estimating request cost:", {
      messageCount: messages.length,
      model: parameters.model,
      hasFile: !!file,
    });

    // Get base model cost (existing logic would be here)
    // This is a simplified implementation - would integrate with existing cost calculation
    const baseCost = 0.002; // Example base cost

    let totalCost = baseCost;
    const costBreakdown = {
      base: baseCost,
      fileProcessing: 0,
      total: baseCost,
    };

    // Add file processing costs if file is present
    if (file && file.type === "application/pdf") {
      const engine =
        parameterController.getParameterValue("pdf-engine") || "auto";
      const effectiveEngine =
        engine === "auto"
          ? CONFIG.FILE_UPLOAD_UTILS.getRecommendedPDFEngine(file)
          : engine;

      // Validate all cost calculation inputs
      const engineCostRate =
        CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS[effectiveEngine];
      const estimatedPages = CONFIG.FILE_UPLOAD_UTILS.estimatePDFPages(
        file.size
      );

      logDebug("Cost calculation validation:", {
        effectiveEngine,
        engineCostRate,
        estimatedPages,
        fileSize: file.size,
        engineCostsAvailable: Object.keys(CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS),
      });

      // Ensure all values are valid numbers
      if (
        effectiveEngine &&
        typeof engineCostRate === "number" &&
        !isNaN(engineCostRate) &&
        typeof estimatedPages === "number" &&
        !isNaN(estimatedPages) &&
        estimatedPages > 0
      ) {
        const engineCost = (estimatedPages / 1000) * engineCostRate;

        // Final validation of calculated cost
        if (typeof engineCost === "number" && !isNaN(engineCost)) {
          costBreakdown.fileProcessing = engineCost;
          totalCost += engineCost;

          logDebug("PDF processing cost calculated successfully:", {
            engine: effectiveEngine,
            estimatedPages,
            engineCostRate,
            engineCost,
          });
        } else {
          logWarn("Calculated engine cost is invalid:", {
            engineCost,
            calculation: `(${estimatedPages} / 1000) * ${engineCostRate}`,
          });
          costBreakdown.fileProcessing = 0;
        }
      } else {
        if (
          effectiveEngine === "native" &&
          typeof engineCostRate === "string"
        ) {
          logInfo("Native engine selected - cost will be token-based:", {
            effectiveEngine,
            engineCostRate,
            estimatedPages,
          });
        } else {
          logWarn("Invalid cost calculation inputs:", {
            effectiveEngine,
            engineCostRate,
            estimatedPages,
            availableEngines: Object.keys(CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS),
          });
        }
        costBreakdown.fileProcessing = 0;
      }
    }

    // Apply cost estimation buffer
    totalCost *= CONFIG.FILE_UPLOAD.COST_ESTIMATION_BUFFER;
    costBreakdown.total = totalCost;

    // Determine warning level using CONFIG helper
    const warningLevel = this.getCostWarningLevel(totalCost);

    const result = {
      ...costBreakdown,
      warningLevel,
      currency: "GBP",
    };

    logInfo("Request cost estimation completed:", result);
    return result;
  }

  /**
   * Get cost warning level based on amount
   * @param {number} cost - Total estimated cost
   * @returns {string} Warning level: 'none', 'low', 'medium', 'high'
   */
  getCostWarningLevel(cost) {
    const thresholds = CONFIG.FILE_UPLOAD.COST_WARNING_THRESHOLDS;

    // Handle both old (YELLOW/ORANGE/RED) and new (low/medium/high) formats
    const highThreshold = thresholds.high || thresholds.RED || 2.0;
    const mediumThreshold = thresholds.medium || thresholds.ORANGE || 0.5;
    const lowThreshold = thresholds.low || thresholds.YELLOW || 0.05;

    if (cost >= highThreshold) return "high";
    if (cost >= mediumThreshold) return "medium";
    if (cost >= lowThreshold) return "low";
    return "none";
  }
  /**
   * Debug cost calculation for troubleshooting
   * @param {File} file - File to debug
   * @returns {Object} Debug information
   */
  debugCostCalculation(file) {
    if (!file) return { error: "No file provided" };

    const engine =
      parameterController.getParameterValue("pdf-engine") || "auto";
    const effectiveEngine =
      engine === "auto"
        ? CONFIG.FILE_UPLOAD_UTILS.getRecommendedPDFEngine(file)
        : engine;
    const estimatedPages = CONFIG.FILE_UPLOAD_UTILS.estimatePDFPages(file.size);
    const engineCostRate = CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS[effectiveEngine];
    const calculatedCost = (estimatedPages / 1000) * engineCostRate;

    return {
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
      },
      engine: {
        selected: engine,
        effective: effectiveEngine,
        available: Object.keys(CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS),
      },
      calculation: {
        estimatedPages,
        engineCostRate,
        formula: `(${estimatedPages} / 1000) * ${engineCostRate}`,
        result: calculatedCost,
        isValid: typeof calculatedCost === "number" && !isNaN(calculatedCost),
      },
      config: {
        pdfEngineCosts: CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS,
        fileAnalysis: CONFIG.FILE_UPLOAD.FILE_ANALYSIS,
      },
    };
  }
}
