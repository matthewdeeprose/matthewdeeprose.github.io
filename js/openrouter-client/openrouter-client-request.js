/**
 * OpenRouter Client Module - Request
 *
 * Handles standard API requests, parameter validation, and response processing.
 */
import { openRouterConfig } from "./openrouter-client-config.js";
import {
  openRouterUtils,
  OpenRouterClientError,
  ErrorCodes,
} from "./openrouter-client-utils.js";
import { openRouterValidator } from "./openrouter-client-validator.js";
import { openRouterDisplay } from "./openrouter-client-display.js";
import { requestHandler } from "../request-handler/request-handler-index.js";
import { tokenCounter } from "../token-counter/token-counter-index.js";

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
 * Class for handling standard API requests
 */
class OpenRouterRequest {
  /**
   * Check if the API client is initialized
   * @param {boolean} initialized - Initialization status
   * @throws {OpenRouterClientError} If the API client is not initialized
   */
  checkInitialized(initialized) {
    if (!initialized) {
      throw new OpenRouterClientError(
        "OpenRouter API client not initialized",
        ErrorCodes.INVALID_PARAMETERS
      );
    }
  }

  /**
   * Execute the fetch request to the OpenRouter API
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options
   * @param {boolean} initialized - Initialization status
   * @returns {Promise<Object>} API response
   */
  async executeFetch(messages, options, initialized) {
    this.checkInitialized(initialized);

    // Validate parameters and prepare request body
    const { requestBody, validatedOptions, parameterWarnings } =
      openRouterValidator.validateRequestParameters(messages, options);

    // Handle plugin configuration metadata (Stage 3.1 pattern)
    if (messages._pluginConfig) {
      requestBody.plugins = [
        {
          id: "file-parser",
          pdf: messages._pluginConfig.pdf,
        },
      ];

      openRouterUtils.debug(
        "Added PDF plugin configuration to request body:",
        requestBody.plugins
      );

      // Clean up metadata after use (maintain message purity)
      delete messages._pluginConfig;
    }

    // Display parameter warnings if needed
    if (options.isModelSwitch && parameterWarnings.length > 0) {
      openRouterValidator.displayParameterWarnings(
        parameterWarnings,
        requestBody.model
      );
    }

    // Log the complete request body
    openRouterUtils.debug("Prepared request body", requestBody);

    // Update the original request display
    openRouterDisplay.updateCodeDisplay("original-request", requestBody);

    try {
      const response = await fetch(openRouterConfig.getEndpoint(), {
        method: "POST",
        headers: openRouterConfig.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      // Update the original response display
      openRouterDisplay.updateCodeDisplay("original-response", data);

      // Check for error in response data
      if (data.error) {
        const error = new OpenRouterClientError(
          data.error.message || "Unknown error occurred",
          ErrorCodes.API_ERROR,
          {
            status: data.error.code,
            metadata: data.error.metadata,
          }
        );
        throw error;
      }

      // Check for non-200 response without error in data
      if (!response.ok) {
        const error = new OpenRouterClientError(
          response.statusText,
          ErrorCodes.API_ERROR,
          { status: response.status }
        );
        throw error;
      }

      return data;
    } catch (error) {
      // Handle network errors
      if (!(error instanceof OpenRouterClientError)) {
        const networkError = new OpenRouterClientError(
          error.message || "Network error occurred",
          ErrorCodes.NETWORK_ERROR,
          { originalError: error }
        );
        throw networkError;
      }

      throw error;
    }
  }

  /**
   * Send a request to the OpenRouter API
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options
   * @param {boolean} initialized - Initialization status
   * @returns {Promise<Object>} API response
   */
  async sendRequest(messages, options = {}, initialized) {
    try {
      this.checkInitialized(initialized);

      openRouterUtils.info("Sending request to OpenRouter API", {
        messageCount: messages.length,
        model: options.model,
        temperature: options.temperature,
        top_p: options.top_p,
        frequency_penalty: options.frequency_penalty,
        presence_penalty: options.presence_penalty,
      });

      // Create fetch function for request handler
      const fetchFn = async (msgs, opts) => {
        return this.executeFetch(msgs, opts, initialized);
      };

      // Use requestHandler to execute request with retry logic
      const data = await requestHandler.executeRequest(
        messages,
        {
          ...options,
          onModelChange: (originalModel, newModel, error) => {
            if (options.onModelChange) {
              options.onModelChange(originalModel, newModel, error);
            }
          },
        },
        fetchFn
      );

      openRouterUtils.info("Received response from OpenRouter API", {
        model: data.model,
        provider: data.provider,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      });

      // Update developer panel with usage information
      openRouterDisplay.updateDevPanel(data, options.model);

      return data;
    } catch (error) {
      openRouterUtils.error("API request failed", { error });

      // Update dev panel to show error
      openRouterDisplay.updateDevPanelError();

      throw error;
    }
  }
}

// Export singleton instance
export const openRouterRequest = new OpenRouterRequest();
