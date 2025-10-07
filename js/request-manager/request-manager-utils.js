/**
 * @fileoverview Request Manager Utilities
 * Provides shared utility functions for the request manager modules.
 */

/**
 * Utility functions for request manager
 */
export class RequestManagerUtils {
  /**
   * Format a request for display
   * @param {Object} request - Request object
   * @returns {Object} Formatted request
   */
  static formatRequestForDisplay(request, parameters) {
    if (!request || !request.length) return null;

    return {
      model: parameters.model,
      messages: request,
      temperature: parameters.temperature,
      top_p: parameters.top_p,
      max_tokens: parameters.max_tokens,
      stream: parameters.stream || false,
    };
  }

  /**
   * Log request details
   * @param {Object} request - Request object
   * @param {Object} parameters - Request parameters
   */
  static logRequestDetails(request, parameters) {
    console.log("Request parameters:", {
      model: parameters.model,
      messageCount: request.length,
      streaming: parameters.stream || false,
    });
  }
}
