/**
 * OpenRouter Client Module - Main Entry Point
 *
 * Provides a unified interface to the OpenRouter API client.
 */
import { openRouterApi } from "./openrouter-client-api.js";
import { openRouterDisplay } from "./openrouter-client-display.js";
import { openRouterValidator } from "./openrouter-client-validator.js";
import { openRouterUtils } from "./openrouter-client-utils.js";
import { openRouterCost } from "./openrouter-client-cost.js";

/**
 * OpenRouter Client
 * @type {Object}
 */
export const openRouterClient = {
  /**
   * Send a request to the OpenRouter API
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  sendRequest: async (messages, options = {}) => {
    return openRouterApi.sendRequest(messages, options);
  },

  /**
   * Send a streaming request to the OpenRouter API
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options including callbacks
   * @returns {Promise<Object>} Request controller for abort capabilities
   */
  sendStreamingRequest: async (messages, options = {}) => {
    return openRouterApi.sendStreamingRequest(messages, options);
  },

  /**
   * Set debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebugMode: (enabled) => {
    openRouterUtils.setDebugMode(enabled);
  },

  /**
   * Clear the request cache
   */
  clearCache: () => {
    openRouterApi.clearCache();
  },

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats: () => {
    return openRouterApi.getCacheStats();
  },

  /**
   * Get the model family based on the model ID
   * @param {string} modelId - The model identifier
   * @returns {string} The model family name
   */
  getModelFamily: (modelId) => {
    return openRouterApi.getModelFamily(modelId);
  },

  /**
   * Update the display
   * @param {string} id - Element ID
   * @param {Object} data - Data to display
   */
  updateDisplay: (id, data) => {
    openRouterDisplay.updateCodeDisplay(id, data);
  },

  // Cost methods
  isFreeModel: openRouterCost.isFreeModel.bind(openRouterCost),
  calculateCost: openRouterCost.calculateRequestCost.bind(openRouterCost),
  formatCost: openRouterCost.formatCost.bind(openRouterCost),

  // Display methods
  updateDevPanel: openRouterDisplay.updateDevPanel.bind(openRouterDisplay),
  updateDevPanelError:
    openRouterDisplay.updateDevPanelError.bind(openRouterDisplay),
  updateCodeDisplay:
    openRouterDisplay.updateCodeDisplay.bind(openRouterDisplay),

  // Utils
  utils: openRouterUtils,
};

// Log initialization
openRouterUtils.info("OpenRouter client facade initialized");

// Also export components for advanced usage
export {
  openRouterApi,
  openRouterDisplay,
  openRouterCost,
  openRouterValidator,
  openRouterUtils,
};
