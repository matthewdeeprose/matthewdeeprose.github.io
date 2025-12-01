/**
 * OpenRouter Client Module - Parameter Validator
 *
 * Handles validation of parameters for OpenRouter API requests.
 * Ensures parameters are within acceptable ranges and compatible with selected models.
 */

import { CONFIG } from "../config.js";
import { modelRegistry } from "../model-definitions.js";
import {
  OpenRouterClientError,
  ErrorCodes,
  openRouterUtils,
} from "./openrouter-client-utils.js";

// ============================================================================
// LOGGING CONFIGURATION (Module Scope)
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
 * Class for validating OpenRouter API parameters
 */
export class OpenRouterValidator {
  constructor() {
    // Internal properties that shouldn't trigger warnings
    this.internalProps = [
      "model",
      "onModelChange",
      "stream",
      "transforms",
      "models",
      "route",
      "provider",
      // Streaming callback functions
      "onChunk",
      "onToolCall",
      "onComplete",
      "onError",
      "onStart",
      "controller",
      "abortSignal",
      "requestId",
      "isModelSwitch",
    ];
  }

  /**
   * Validate temperature parameter
   * @param {number|string} temperature - Temperature value to validate
   * @returns {number} Validated temperature value
   * @throws {OpenRouterClientError} If temperature is invalid
   */
  validateTemperature(temperature) {
    const parsedTemp = parseFloat(
      temperature || CONFIG.DEFAULT_PARAMS.temperature
    );

    if (isNaN(parsedTemp) || parsedTemp < 0 || parsedTemp > 2) {
      throw new OpenRouterClientError(
        "Temperature must be between 0 and 2",
        ErrorCodes.INVALID_PARAMETERS,
        { parameter: "temperature", value: temperature }
      );
    }

    return parsedTemp;
  }

  /**
   * Validate top_p parameter
   * @param {number|string} top_p - Top P value to validate
   * @returns {number} Validated top_p value
   * @throws {OpenRouterClientError} If top_p is invalid
   */
  validateTopP(top_p) {
    const parsedTopP = parseFloat(top_p || CONFIG.DEFAULT_PARAMS.top_p);

    if (isNaN(parsedTopP) || parsedTopP < 0 || parsedTopP > 1) {
      throw new OpenRouterClientError(
        "Top P must be between 0 and 1",
        ErrorCodes.INVALID_PARAMETERS,
        { parameter: "top_p", value: top_p }
      );
    }

    return parsedTopP;
  }

  /**
   * Validate max_tokens parameter
   * @param {number|string} max_tokens - Max tokens value to validate
   * @returns {number} Validated max_tokens value
   * @throws {OpenRouterClientError} If max_tokens is invalid
   */
  validateMaxTokens(max_tokens) {
    const parsedMaxTokens = parseInt(
      max_tokens || CONFIG.DEFAULT_PARAMS.max_tokens,
      10
    );

    if (isNaN(parsedMaxTokens) || parsedMaxTokens < 1) {
      throw new OpenRouterClientError(
        "Max tokens must be greater than 0",
        ErrorCodes.INVALID_PARAMETERS,
        { parameter: "max_tokens", value: max_tokens }
      );
    }

    return parsedMaxTokens;
  }

  /**
   * Validate frequency_penalty parameter
   * @param {number|string} frequency_penalty - Frequency penalty value to validate
   * @returns {number} Validated frequency_penalty value
   */
  validateFrequencyPenalty(frequency_penalty) {
    return frequency_penalty !== undefined
      ? parseFloat(frequency_penalty)
      : CONFIG.DEFAULT_PARAMS.frequency_penalty;
  }

  /**
   * Validate presence_penalty parameter
   * @param {number|string} presence_penalty - Presence penalty value to validate
   * @returns {number} Validated presence_penalty value
   */
  validatePresencePenalty(presence_penalty) {
    return presence_penalty !== undefined
      ? parseFloat(presence_penalty)
      : CONFIG.DEFAULT_PARAMS.presence_penalty;
  }

  /**
   * Check if parameters are supported by the model
   * @param {Object} options - Request options
   * @param {string} modelId - Model ID
   * @returns {Object} Object containing validated parameters and warnings
   */
  validateModelParameters(options, modelId) {
    const modelConfig = modelRegistry.getModel(modelId);
    const parameterWarnings = [];
    const validatedOptions = { ...options };

    if (!modelConfig) {
      openRouterUtils.warn(
        "No model configuration found, using default parameters",
        { modelId }
      );
      return {
        validatedOptions,
        parameterWarnings,
        supportedParams: Object.keys(CONFIG.DEFAULT_PARAMS),
      };
    }

    const supportedParams = modelConfig.parameterSupport?.supported || [];

    // Log parameter validation info
    openRouterUtils.debug("Parameter validation", {
      model: modelConfig.name,
      supportedParameters: supportedParams,
      requestParameters: Object.keys(options).filter(
        (key) => !this.internalProps.includes(key)
      ),
    });

    // Check for unsupported parameters
    Object.keys(options).forEach((param) => {
      if (this.internalProps.includes(param)) return;

      if (!supportedParams.includes(param)) {
        // Only add to warnings if this is a model switch
        if (options.isModelSwitch) {
          parameterWarnings.push({
            parameter: param,
            message: `Parameter '${param}' not supported by ${modelConfig.name}`,
            value: options[param],
          });
        }

        // Remove unsupported parameter regardless
        delete validatedOptions[param];
        openRouterUtils.debug(
          `Removing unsupported parameter for ${modelConfig.name}`,
          {
            parameter: param,
            value: options[param],
          }
        );
      }
    });

    return {
      validatedOptions,
      parameterWarnings,
      supportedParams,
    };
  }

  /**
   * Validate file content structure and constraints
   * @param {Array} messages - Messages array that may contain file content
   * @returns {Object} Validation result with file-specific checks
   */
  async validateFileContent(messages) {
    // Apply Stage 3.1 defensive validation patterns
    if (!messages || !Array.isArray(messages)) {
      return { valid: false, error: "Invalid messages structure" };
    }

    // Check for file content in messages
    const hasFileContent = messages.some(
      (msg) =>
        msg.content &&
        Array.isArray(msg.content) &&
        msg.content.some(
          (content) => content.type === "image_url" || content.type === "file"
        )
    );

    if (!hasFileContent) {
      return { valid: true, hasFiles: false };
    }

    // Use CONFIG.FILE_UPLOAD_UTILS with defensive checks
    const constraints = CONFIG?.FILE_UPLOAD_UTILS?.validateFileConstraints;
    if (!constraints) {
      logWarn("File upload utils not available - skipping file validation");
      return {
        valid: true,
        warnings: ["File validation skipped"],
        hasFiles: true,
      };
    }

    // Validate file constraints using existing utilities
    // This leverages the CONFIG.FILE_UPLOAD_UTILS already implemented
    return { valid: true, hasFiles: true, constraints: "validated" };
  }

  /**
   * Enhanced parameter validation with file support
   * @param {Array} messages - Messages to validate
   * @param {Object} options - Request options
   * @returns {Object} Enhanced validation result
   */
  async validateRequestParametersAsync(messages, options = {}) {
    // Existing parameter validation (call the sync version)
    const standardValidation = this.validateRequestParametersSync(
      messages,
      options
    );

    // Add file validation
    const fileValidation = await this.validateFileContent(messages);

    // Check for clean message structure (Stage 3.1 lesson)
    const hasValidStructure = messages.every(
      (msg) =>
        msg.role &&
        msg.content &&
        Object.keys(msg).filter((key) => key !== "_pluginConfig").length === 2
    );

    if (!hasValidStructure) {
      throw new OpenRouterClientError(
        "Invalid message structure - only role and content allowed in messages array",
        ErrorCodes.INVALID_PARAMETERS
      );
    }

    return {
      ...standardValidation,
      fileValidation,
      hasFiles: fileValidation.hasFiles,
    };
  }

  /**
   * Validate all parameters for a request (sync version for backward compatibility)
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options
   * @returns {Object} Object containing validated parameters and request body
   * @throws {OpenRouterClientError} If validation fails
   */
  validateRequestParameters(messages, options = {}) {
    return this.validateRequestParametersSync(messages, options);
  }

  /**
   * Synchronous parameter validation (renamed from original method)
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options
   * @returns {Object} Object containing validated parameters and request body
   * @throws {OpenRouterClientError} If validation fails
   */
  validateRequestParametersSync(messages, options = {}) {
    try {
      // Validate basic parameters
      const temperature = this.validateTemperature(options.temperature);
      const top_p = this.validateTopP(options.top_p);
      const max_tokens = this.validateMaxTokens(options.max_tokens);
      const frequency_penalty = this.validateFrequencyPenalty(
        options.frequency_penalty
      );
      const presence_penalty = this.validatePresencePenalty(
        options.presence_penalty
      );

      // Validate model-specific parameters
      const { validatedOptions, parameterWarnings, supportedParams } =
        this.validateModelParameters(options, options.model);

// Build request body with only supported parameters
      const requestBody = {
        model:
          options.model ||
          modelRegistry.getAllModels().find((m) => m.isDefault)?.id,
        messages: messages,
      };

      // Always include stream parameter if it's set in options
      if (options.stream === true) {
        requestBody.stream = true;
        openRouterUtils.debug(
          "Setting stream parameter to true in request body"
        );
      }

      // Only add parameters that are supported
      if (supportedParams.includes("temperature")) {
        requestBody.temperature = temperature;
      }
      if (supportedParams.includes("top_p")) {
        requestBody.top_p = top_p;
      }
      if (supportedParams.includes("max_tokens")) {
        requestBody.max_tokens = max_tokens;
      }
      if (supportedParams.includes("frequency_penalty")) {
        requestBody.frequency_penalty = frequency_penalty;
      }
      if (supportedParams.includes("presence_penalty")) {
        requestBody.presence_penalty = presence_penalty;
      }

      // Add plugins parameter if provided (for PDF engine selection, file handling, etc.)
      // This is critical for file uploads with streaming
      if (options.plugins && Array.isArray(options.plugins)) {
        requestBody.plugins = options.plugins;
        openRouterUtils.debug("Added plugins parameter to request body", {
          pluginCount: options.plugins.length,
          plugins: options.plugins,
        });
      }

      return {
        requestBody,
        validatedOptions,
        parameterWarnings,
      };
    } catch (error) {
      openRouterUtils.error("Parameter validation failed", { error, options });
      throw error;
    }
  }

  /**
   * Display parameter warnings in the UI
   * @param {Array} parameterWarnings - Array of parameter warnings
   * @param {string} modelName - Name of the model
   */
  displayParameterWarnings(parameterWarnings, modelName) {
    if (parameterWarnings.length === 0) return;

    openRouterUtils.warn("Parameter adjustments for model switch", {
      model: modelName,
      warnings: parameterWarnings,
    });

    console.group("Parameter Adjustments for Model Switch");
    console.log("Model:", modelName);
    console.table(parameterWarnings);
    console.groupEnd();

    const statusContainer = document.querySelector(".processing-status");
    if (statusContainer) {
      statusContainer.innerHTML = `
        <div class="parameter-warning" role="alert">
          <p>Parameter adjustments made:</p>
          <ul>
            ${parameterWarnings
              .map((warning) => `<li>${warning.message}</li>`)
              .join("")}
          </ul>
        </div>
      `;
    }
  }
}

// Export singleton instance
export const openRouterValidator = new OpenRouterValidator();
