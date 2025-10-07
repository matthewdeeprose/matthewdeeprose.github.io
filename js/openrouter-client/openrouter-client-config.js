/**
 * OpenRouter Client Module - Configuration
 *
 * Handles configuration validation, header generation, and endpoint management.
 */
import { CONFIG } from "../config.js";
import {
  openRouterUtils,
  OpenRouterClientError,
  ErrorCodes,
} from "./openrouter-client-utils.js";

/**
 * Class for managing OpenRouter API configuration
 */
class OpenRouterConfig {
  /**
   * Validate required configuration
   * @throws {OpenRouterClientError} If configuration is invalid
   */
  validateConfig() {
    if (!CONFIG.API_ENDPOINT) {
      throw new OpenRouterClientError(
        "API endpoint not configured",
        ErrorCodes.INVALID_PARAMETERS,
        { configKey: "API_ENDPOINT" }
      );
    }

    if (!CONFIG.API_KEY) {
      throw new OpenRouterClientError(
        "API key not configured",
        ErrorCodes.INVALID_PARAMETERS,
        { configKey: "API_KEY" }
      );
    }

    openRouterUtils.info("OpenRouter configuration validated", {
      endpoint: CONFIG.API_ENDPOINT,
    });
  }

  /**
   * Generate request headers
   * @returns {Object} Headers for API requests
   */
  getHeaders() {
    return {
      Authorization: `Bearer ${CONFIG.API_KEY}`,
      "HTTP-Referer": window.location.href,
      "X-Title": "Accessibility Tools MVP",
      "Content-Type": "application/json",
    };
  }

  /**
   * Get API endpoint
   * @returns {string} API endpoint URL
   */
  getEndpoint() {
    return CONFIG.API_ENDPOINT;
  }
}

// Export singleton instance
export const openRouterConfig = new OpenRouterConfig();
