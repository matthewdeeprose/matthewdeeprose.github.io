/**
 * @fileoverview Request Manager Index
 * Main entry point for the request manager module.
 * Provides a facade for the request processing functionality.
 */

import { RequestManagerCore } from "./request-manager-core.js";

/**
 * Request Manager
 * Handles request processing, parameter validation, and response handling
 * with integrated token tracking.
 */
export class RequestManager {
  /**
   * Create a new RequestManager instance
   * @param {Object} modelManager - Model manager instance
   * @param {Object} progressHandler - Progress handler instance
   */
  constructor(modelManager, progressHandler) {
    // Create core manager
    this.core = new RequestManagerCore(modelManager, progressHandler);

    // For backward compatibility
    this.isProcessing = false;
    this.currentRequestId = null;
  }

  /**
   * Process a request to the AI model
   * @param {string} inputText - User input to process
   * @returns {Promise<void>}
   */
  async processRequest(inputText) {
    this.isProcessing = true;
    await this.core.processRequest(inputText);
    this.isProcessing = this.core.isProcessing;
    this.currentRequestId = this.core.currentRequestId;
  }

  /**
   * Process a streaming request to the AI model
   * @param {string} inputText - User input to process
   * @returns {Promise<void>}
   */
  async processStreamingRequest(inputText) {
    this.isProcessing = true;
    await this.core.processStreamingRequest(inputText);
    this.isProcessing = this.core.isProcessing;
    this.currentRequestId = this.core.currentRequestId;
  }

  /**
   * Cancel the current streaming request if one is in progress
   */
  cancelStreaming() {
    this.core.cancelStreaming();
  }

  /**
   * Set callbacks for streaming events
   * @param {Object} callbacks - Streaming callbacks
   */
  setStreamingCallbacks(callbacks) {
    this.core.setStreamingCallbacks(callbacks);
  }

  /**
   * Set callback for results updates
   * @param {Function} callback - Function to call with updated results
   */
  setResultsCallback(callback) {
    this.core.setResultsCallback(callback);
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.core.destroy();
  }
}

// For backward compatibility, export the class as RequestProcessor
export { RequestManager as RequestProcessor };
