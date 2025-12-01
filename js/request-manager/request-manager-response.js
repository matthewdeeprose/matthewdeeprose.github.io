/**
 * @fileoverview Request Manager Response Handler
 * Processes API responses and updates UI.
 */

import { openRouterClient } from "../openrouter-client/openrouter-client-index.js";

/**
 * Handles API responses
 */
export class RequestManagerResponse {
  /**
   * Create a new RequestManagerResponse instance
   * @param {Object} modelManager - Model manager instance
   */
  constructor(modelManager) {
    this.modelManager = modelManager;
    this.onResultsUpdate = null;
  }

  /**
   * Set callback for results updates
   * @param {Function} callback - Function to call with updated results
   */
  setResultsCallback(callback) {
    this.onResultsUpdate = callback;
  }

  /**
   * Sanitize request body for display to prevent syntax highlighter crashes
   * @param {Object} requestBody - Request body to sanitize
   * @returns {Object} Sanitized request body
   */
  sanitizeRequestForDisplay(requestBody) {
    try {
      const clone = JSON.parse(JSON.stringify(requestBody));

      if (clone.messages && Array.isArray(clone.messages)) {
        clone.messages = clone.messages.map((msg) => {
          if (msg.content && Array.isArray(msg.content)) {
            return {
              ...msg,
              content: msg.content.map((item) => {
                // Truncate base64 image data to prevent display crashes
                if (item.type === "image_url" && item.image_url?.url) {
                  const url = item.image_url.url;
                  if (url.startsWith("data:") && url.length > 200) {
                    const [header] = url.split(",");
                    const dataLength = url.length - header.length - 1;
                    return {
                      ...item,
                      image_url: {
                        url: `${header},<BASE64_TRUNCATED: ${dataLength.toLocaleString()} chars>`,
                      },
                    };
                  }
                }
                return item;
              }),
            };
          }
          return msg;
        });
      }

      return clone;
    } catch (e) {
      console.warn("Failed to sanitize request for display:", e);
      return requestBody; // Return original if sanitization fails
    }
  }

  /**
   * Send request to API
   * @param {Array} request - Prepared request messages
   * @param {Object} parameters - Request parameters
   * @returns {Promise<Object>} API response
   */
  async sendRequest(request, parameters) {
    console.log("Request parameters before API call:", parameters);
    const {
      model,
      temperature,
      top_p,
      max_tokens,
      frequency_penalty,
      presence_penalty,
    } = parameters;

    return await openRouterClient.sendRequest(request, {
      model,
      temperature,
      top_p,
      max_tokens: parseInt(max_tokens),
      frequency_penalty,
      presence_penalty,
      onModelChange: (originalModel, newModel, error) => {
        this.modelManager.showModelChangeNotification(
          originalModel,
          newModel,
          error
        );
      },
    });
  }

  /**
   * Handle API response
   * @param {Object} response - API response
   * @param {string} requestId - Current request ID
   * @param {Function} tokenRecorder - Function to record token usage
   */
  async handleResponse(response, requestId, tokenRecorder) {
    // More flexible response validation
    if (!response?.choices?.[0]) {
      throw new Error("No choices in response");
    }

    // Handle different response formats
    let content;
    const choice = response.choices[0];

    if (choice.message?.content) {
      // Standard format
      content = choice.message.content;
    } else if (choice.text) {
      // Some models return direct text
      content = choice.text;
    } else if (choice.delta?.content) {
      // Streaming format
      content = choice.delta.content;
    } else {
      console.warn("Unexpected response format:", choice);
      // Try to extract content in a safe way
      content =
        choice.message?.content ||
        choice.text ||
        choice.delta?.content ||
        JSON.stringify(choice, null, 2);
    }

    if (!content && typeof content !== "string") {
      throw new Error("Could not extract content from response");
    }

    // Record successful attempt
    if (requestId && tokenRecorder) {
      tokenRecorder(requestId, response.usage, response.model, false);
    }

    // Update results if callback is set
    if (this.onResultsUpdate) {
      this.onResultsUpdate(content);
    }

    return content;
  }

  /**
   * Update code displays with request and response data
   * @param {Array} request - Request messages
   * @param {Object} parameters - Request parameters
   * @param {string} fullResponse - Complete response text
   * @param {Object} responseData - Response metadata
   */
  updateDisplays(request, parameters, fullResponse, responseData) {
    try {
      // If we have the original request, display it
      if (request && request.length > 0) {
        const requestBody = {
          model: parameters.model,
          messages: request,
          temperature: parameters.temperature,
          top_p: parameters.top_p,
          max_tokens: parameters.max_tokens,
          stream: true,
        };

        console.log("Updating request code display");
        // Sanitize request to prevent Prism.js crash with large base64 data
        const sanitizedRequest = this.sanitizeRequestForDisplay(requestBody);
        openRouterClient.updateCodeDisplay(
          "original-request",
          sanitizedRequest
        );
      }

      // Create a response object for display
      const displayResponseData = {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: parameters.model,
        choices: [
          {
            message: {
              content: fullResponse,
              role: "assistant",
            },
            finish_reason: responseData?.choices?.[0]?.finish_reason || "stop",
            index: 0,
          },
        ],
        usage: responseData?.usage || {
          prompt_tokens: request.length * 0.25,
          completion_tokens: fullResponse.length * 0.25,
          total_tokens: (request.length + fullResponse.length) * 0.25,
        },
        // Add tokenReport for token efficiency display
        tokenReport: {
          tokenEfficiency: 100.0, // Default to 100% efficiency for streaming
          attempts: [
            {
              model: parameters.model,
              success: true,
              promptTokens: request.length * 0.25,
              completionTokens: fullResponse.length * 0.25,
            },
          ],
          totalPromptTokens: request.length * 0.25,
          totalCompletionTokens: fullResponse.length * 0.25,
        },
      };

      console.log("Updating response code display");
      openRouterClient.updateCodeDisplay(
        "original-response",
        displayResponseData
      );
    } catch (error) {
      console.warn("Failed to update code displays", error);
      // Continue processing even if display updates fail
    }
  }

  /**
   * Update developer panel with usage information
   * @param {Object} responseData - Response metadata
   * @param {string} model - Model ID
   */
  updateDevPanel(responseData, model) {
    try {
      if (responseData && responseData.model) {
        openRouterClient.updateDevPanel(responseData, model);
      }
    } catch (error) {
      console.warn("Failed to update dev panel", error);
      // Continue processing even if dev panel update fails
    }
  }
}
