/**
 * OpenRouter Client Module - API
 *
 * Coordinates API communication with the OpenRouter service.
 * Delegates to specialized modules for different functionality.
 *
 * Implements lazy initialization to allow application bootstrapping
 * before API key validation occurs. Validation happens at first request.
 */
import { openRouterConfig } from "./openrouter-client-config.js";
import { openRouterRequest } from "./openrouter-client-request.js";
import { openRouterStream } from "./openrouter-client-stream.js";
import { openRouterCache } from "./openrouter-client-cache.js";
import { openRouterUtils } from "./openrouter-client-utils.js";

/**
 * Class for coordinating OpenRouter API communication
 * Uses lazy initialization pattern to defer API key validation
 * until first request is made, allowing UI initialization to complete
 * even when API key is not yet configured.
 */
export class OpenRouterAPI {
  constructor() {
    // Initialize state without validating configuration
    this.initialized = false;
    this.initializationError = null;

    // Log creation but defer validation
    openRouterUtils.info(
      "OpenRouter API client created (validation deferred until first request)"
    );
  }

  /**
   * Lazy initialization - validates API key only when first request is made
   * Implements guard clause pattern to ensure prerequisites are met before
   * allowing API operations to proceed.
   *
   * @throws {OpenRouterClientError} If API key is not configured or validation fails
   */
  ensureInitialized() {
    // Fast path: if already successfully initialized, return immediately
    if (this.initialized) {
      return;
    }

    // If previous initialization attempt failed, re-throw the cached error
    // This avoids redundant validation attempts for persistent configuration issues
    if (this.initializationError) {
      throw this.initializationError;
    }

    // Attempt initialization and validation
    try {
      openRouterConfig.validateConfig();
      this.initialized = true;
      openRouterUtils.info("OpenRouter API client initialized successfully");
    } catch (error) {
      // Cache the error for subsequent calls
      this.initializationError = error;
      openRouterUtils.error("OpenRouter API initialization failed", { error });
      throw error;
    }
  }

  /**
   * @deprecated Use ensureInitialized() instead
   * Legacy method maintained for backward compatibility with code that
   * may explicitly call initializeAPI(). Redirects to lazy initialization.
   */
  initializeAPI() {
    this.ensureInitialized();
  }

  /**
   * Check if the API client is initialized
   * @throws {OpenRouterClientError} If the API client is not initialized
   */
  checkInitialized() {
    openRouterRequest.checkInitialized(this.initialized);
  }

  /**
   * Execute the fetch request to the OpenRouter API
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async executeFetch(messages, options) {
    return openRouterRequest.executeFetch(messages, options, this.initialized);
  }

  /**
   * Send a request to the OpenRouter API
   * Validates API configuration before processing request.
   *
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   * @throws {OpenRouterClientError} If API key not configured or request fails
   */
  async sendRequest(messages, options = {}) {
    // Guard clause: ensure API is initialized before proceeding
    this.ensureInitialized();
    return openRouterRequest.sendRequest(messages, options, this.initialized);
  }

  /**
   * Send a streaming request to the OpenRouter API
   * Validates API configuration before initiating stream.
   *
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options including callbacks
   * @returns {Promise<Object>} Request controller for abort capabilities
   * @throws {OpenRouterClientError} If API key not configured or request fails
   */
  async sendStreamingRequest(messages, options = {}) {
    // Guard clause: ensure API is initialized before proceeding
    this.ensureInitialized();
    return openRouterStream.sendStreamingRequest(
      messages,
      options,
      this.initialized
    );
  }

  /**
   * Clear the request cache
   */
  clearCache() {
    openRouterCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return openRouterCache.getStats();
  }

  /**
   * Get the model family based on the model ID
   * @param {string} modelId - The model identifier
   * @returns {string} The model family name
   */
  getModelFamily(modelId) {
    return openRouterStream.getModelFamily(modelId);
  }
}

// Export singleton instance
// Note: Constructor no longer throws, allowing module to load successfully
// even when API key is not yet configured. Validation occurs at first request.
export const openRouterApi = new OpenRouterAPI();
