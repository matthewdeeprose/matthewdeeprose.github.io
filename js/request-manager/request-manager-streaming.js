/**
 * @fileoverview Request Manager Streaming
 * Handles streaming request processing.
 */

import { openRouterClient } from "../openrouter-client/openrouter-client-index.js";
import { a11y } from "../accessibility-helpers.js";
import { RequestManagerUtils } from "./request-manager-utils.js";

// Logging configuration (at module level)
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

// Helper functions for logging
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
 * Manages streaming requests
 */
export class RequestManagerStreaming {
  /**
   * Create a new RequestManagerStreaming instance
   * @param {Object} progressHandler - Progress handler instance
   * @param {RequestManagerResponse} responseHandler - Response handler instance
   */
  constructor(progressHandler, responseHandler) {
    this.progressHandler = progressHandler;
    this.responseHandler = responseHandler;
    this.abortController = null;
    this.onBeginStreaming = null;
    this.onStreamChunk = null;
    this.onStreamComplete = null;
    this.onStreamCancel = null;
    this.onToolCall = null;
  }

  /**
   * Set callbacks for streaming events
   * @param {Object} callbacks - Streaming callbacks
   */
  setStreamingCallbacks(callbacks) {
    const {
      onBeginStreaming,
      onStreamChunk,
      onStreamComplete,
      onStreamCancel,
      onToolCall,
    } = callbacks;

    this.onBeginStreaming = onBeginStreaming;
    this.onStreamChunk = onStreamChunk;
    this.onStreamComplete = onStreamComplete;
    this.onStreamCancel = onStreamCancel;
    this.onToolCall = onToolCall;
  }

  /**
   * Process a streaming request
   * @param {string} inputText - User input
   * @param {Array} request - Prepared request messages
   * @param {Object} parameters - Request parameters
   * @param {string} requestId - Current request ID
   * @param {Function} tokenRecorder - Function to record token usage
   * @returns {Promise<void>}
   */
  async processStreamingRequest(
    inputText,
    request,
    parameters,
    requestId,
    tokenRecorder
  ) {
    try {
      // Begin streaming UI updates
      if (this.onBeginStreaming) {
        this.onBeginStreaming();
      }

      // Update progress
      this.progressHandler.updateRequestProgress(
        "Starting AI response stream..."
      );

      // Set up callbacks for streaming
      const streamingOptions = {
        ...parameters,
        stream: true, // Make sure stream is set to true
        onStart: () => {
          logInfo("Stream started, processing response...");
          this.progressHandler.updateResponseProgress(
            "Receiving AI response stream..."
          );
        },
        onChunk: (chunk, data) => {
          logDebug("Received chunk:", {
            length: chunk.length,
            preview: chunk.substring(0, 20) + (chunk.length > 20 ? "..." : ""),
            data: data ? Object.keys(data) : "no data",
          });

          // Update UI with each chunk
          if (this.onStreamChunk) {
            this.onStreamChunk(chunk, data);
          } else {
            logWarn("onStreamChunk callback not set");
          }
        },
        onToolCall: (toolCalls, data) => {
          logDebug("Received tool call:", toolCalls);
          // Handle tool calls if supported
          if (this.onToolCall) {
            this.onToolCall(toolCalls, data);
          }
        },
        onComplete: (fullResponse, responseData) => {
          logInfo("Stream complete:", {
            responseLength: fullResponse.length,
            preview:
              fullResponse.substring(0, 30) +
              (fullResponse.length > 30 ? "..." : ""),
            responseData: responseData ? Object.keys(responseData) : "no data",
            responseDataType: typeof responseData,
            hasUsage: responseData?.usage ? true : false,
            modelInfo: responseData?.model || "unknown",
          });

          // Update the developer panel with usage information
          this.responseHandler.updateDevPanel(responseData, parameters.model);

          // Update the request and response displays
          this.responseHandler.updateDisplays(
            request,
            parameters,
            fullResponse,
            responseData
          );

          // Handle completion
          if (this.onStreamComplete) {
            this.onStreamComplete(fullResponse, responseData);
          } else {
            logWarn("onStreamComplete callback not set");
          }

          // Update token tracking
          try {
            tokenRecorder(
              requestId,
              responseData?.usage || {
                prompt_tokens: request.length * 0.25, // Rough estimation
                completion_tokens: fullResponse.length * 0.25, // Rough estimation
                total_tokens: (request.length + fullResponse.length) * 0.25,
              },
              parameters.model,
              false
            );
          } catch (tokenError) {
            logWarn("Token tracking completion failed:", tokenError);
            // Continue anyway, as token tracking is non-essential
          }

          // Complete progress indication
          this.progressHandler.complete("Stream completed successfully");
        },
        onError: (error) => {
          logError("Streaming error:", error);

          // CRITICAL: Clear streaming state to stop blinking cursor and allow next request
          if (this.onStreamComplete) {
            try {
              // Call onStreamComplete with empty response to trigger cleanup
              this.onStreamComplete("", { error: true });
              logInfo(
                "Streaming state cleared after error via onStreamComplete"
              );
            } catch (cleanupError) {
              logWarn(
                "Failed to clear streaming state after error:",
                cleanupError
              );
            }
          }

          throw error; // Re-throw to be caught by the outer try/catch
        },
        controller: (this.abortController = new AbortController()),
      };

      // Send the streaming request
      RequestManagerUtils.logRequestDetails(request, streamingOptions);
      await openRouterClient.sendStreamingRequest(request, streamingOptions);
    } catch (error) {
      // Let the caller handle the error
      throw error;
    }
  }

  /**
   * Cancel the current streaming request if one is in progress
   */
  cancelStreaming() {
    if (this.abortController) {
      this.abortController.abort();
      this.progressHandler.complete("Request canceled", false);

      // Update UI to show cancellation
      if (this.onStreamCancel) {
        this.onStreamCancel();
      }

      a11y.announceStatus("Response generation canceled", "assertive");
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.abortController) {
      this.abortController = null;
    }
  }
}
