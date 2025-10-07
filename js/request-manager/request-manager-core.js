/**
 * @fileoverview Request Manager Core
 * Handles core request processing logic.
 */

import { tokenCounter } from "../token-counter/token-counter-index.js";
import { RequestManagerError } from "./request-manager-error.js";
import { RequestManagerParameters } from "./request-manager-parameters.js";
import { RequestManagerResponse } from "./request-manager-response.js";
import { RequestManagerStreaming } from "./request-manager-streaming.js";

// Logging configuration (at module level)
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
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
 * Core request processing functionality
 */
export class RequestManagerCore {
  /**
   * Create a new RequestManagerCore instance
   * @param {Object} modelManager - Model manager instance
   * @param {Object} progressHandler - Progress handler instance
   */
  constructor(modelManager, progressHandler) {
    // Store dependencies
    this.modelManager = modelManager;
    this.progressHandler = progressHandler;

    // Initialize sub-modules
    this.errorHandler = new RequestManagerError(modelManager, progressHandler);
    this.parameterHandler = new RequestManagerParameters(modelManager);
    this.responseHandler = new RequestManagerResponse(modelManager);
    this.streamingHandler = new RequestManagerStreaming(
      progressHandler,
      this.responseHandler
    );

    // State
    this.isProcessing = false;
    this.currentRequestId = null;
    this.lastRequest = null;

    // Bind methods
    this.handleRetry = this.handleRetry.bind(this);

    // Set up retry event listener
    window.addEventListener("retryRequest", this.handleRetry);

    logInfo("[REQUEST DEBUG] 🏗️ RequestManagerCore initialised");
  }

  /**
   * Set callback for results updates
   * @param {Function} callback - Function to call with updated results
   */
  setResultsCallback(callback) {
    logInfo("[REQUEST DEBUG] 📞 Results callback set:", typeof callback);
    this.responseHandler.setResultsCallback(callback);
  }

  /**
   * Set callbacks for streaming events
   * @param {Object} callbacks - Streaming callbacks
   */
  setStreamingCallbacks(callbacks) {
    logInfo("[REQUEST DEBUG] 🌊 Streaming callbacks set:", {
      onBeginStreaming: typeof callbacks?.onBeginStreaming,
      onStreamChunk: typeof callbacks?.onStreamChunk,
      onStreamComplete: typeof callbacks?.onStreamComplete,
      onStreamCancel: typeof callbacks?.onStreamCancel,
    });
    this.streamingHandler.setStreamingCallbacks(callbacks);
  }

  /**
   * Process a request to the AI model
   * @param {string} inputText - User input to process
   * @returns {Promise<void>}
   */
  async processRequest(inputText) {
    logInfo("[REQUEST DEBUG] 🔄 STANDARD REQUEST INITIATED:", {
      inputLength: inputText?.length || 0,
      inputPreview:
        inputText?.substring(0, 50) + (inputText?.length > 50 ? "..." : ""),
      isProcessing: this.isProcessing,
      timestamp: Date.now(),
    });

    if (this.isProcessing) {
      logWarn("[REQUEST DEBUG] ⚠️ Request already in progress, aborting");
      return;
    }

    this.isProcessing = true;
    this.progressHandler.startProcessing("Preparing request...");

    try {
      // Validate input
      if (!inputText?.trim()) {
        logError("[REQUEST DEBUG] ❌ No input provided");
        throw new Error("No input provided");
      }

      logDebug("[REQUEST DEBUG] ✅ Input validation passed");

      // Get and validate parameters
      logDebug("[REQUEST DEBUG] 🔧 Getting request parameters...");
      const parameters = await this.parameterHandler.getRequestParameters();

      logDebug("[REQUEST DEBUG] 📋 Parameters retrieved:", {
        model: parameters?.model,
        temperature: parameters?.temperature,
        maxTokens: parameters?.max_tokens,
        hasStream: "stream" in parameters,
        streamValue: parameters?.stream,
      });

      this.parameterHandler.validateParameters(parameters);
      logDebug("[REQUEST DEBUG] ✅ Parameters validation passed");

      // Prepare request with enhanced file analysis integration
      logDebug(
        "[REQUEST DEBUG] 📦 Preparing request with enhanced analysis..."
      );

      // Check for enhanced file analysis data
      const fileHandler = window.fileHandler;
      let fileData = null;

      if (fileHandler?.hasValidFile && fileHandler?.currentFile) {
        fileData = {
          file: fileHandler.currentFile,
          engine: null, // Let enhanced analysis determine optimal engine
          enhancedAnalysis: fileHandler.fileAnalysis || {}, // Include Stage 5 analysis
        };

        logDebug("[REQUEST DEBUG] 📊 Using enhanced file analysis:", {
          hasAnalysis: !!fileData.enhancedAnalysis,
          recommendedEngine: fileData.enhancedAnalysis.recommendedEngine,
          confidence: fileData.enhancedAnalysis.confidence,
          complexity: fileData.enhancedAnalysis.complexity,
        });
      }

      const request = await this.parameterHandler.prepareRequest(
        inputText,
        parameters,
        fileData
      );
      this.currentRequestId = tokenCounter.generateRequestId();

      logDebug("[REQUEST DEBUG] 🆔 Request prepared:", {
        requestId: this.currentRequestId,
        requestType: Array.isArray(request) ? "messages array" : typeof request,
        messagesCount: Array.isArray(request) ? request.length : 0,
      });

      // Initialize token tracking
      try {
        // Convert request to messages array format expected by token counter
        const messages = [];

        // Add system prompt if present
        if (request.systemPrompt) {
          messages.push({ role: "system", content: request.systemPrompt });
        }

        // Add user message
        if (request.prompt) {
          messages.push({ role: "user", content: request.prompt });
        }

        // Handle file content if present
        if (request.files && request.files.length > 0) {
          request.files.forEach((file) => {
            messages.push({
              role: "user",
              content: file.content || `[File: ${file.name}]`,
            });
          });
        }

        tokenCounter.initializeRequest(
          this.currentRequestId,
          parameters.model,
          messages
        );
        logDebug(
          "[REQUEST DEBUG] 📊 Token tracking initialised with messages:",
          messages.length
        );
      } catch (tokenError) {
        logWarn(
          "[REQUEST DEBUG] ⚠️ Token tracking initialisation failed:",
          tokenError
        );
        // Continue anyway, as token tracking is non-essential
      }

      // Update progress and send request
      this.progressHandler.updateRequestProgress("Sending to AI model...");
      logInfo("[REQUEST DEBUG] 🚀 Sending standard request to AI model...");

      const response = await this.responseHandler.sendRequest(
        request,
        parameters
      );

      logDebug("[REQUEST DEBUG] 📨 Response received:", {
        responseType: typeof response,
        hasChoices: response?.choices?.length > 0,
        responseKeys: response ? Object.keys(response) : [],
      });

      // Process response
      this.progressHandler.updateResponseProgress("Processing response...");
      logDebug("[REQUEST DEBUG] 🔄 Processing response...");

      await this.responseHandler.handleResponse(
        response,
        this.currentRequestId,
        tokenCounter.recordAttempt.bind(tokenCounter)
      );

      // Complete successfully
      this.progressHandler.complete("Request completed successfully");
      logInfo("[REQUEST DEBUG] ✅ Standard request completed successfully");
    } catch (error) {
      logError("[REQUEST DEBUG] ❌ Standard request failed:", {
        error: error.message,
        stack: error.stack,
        inputLength: inputText?.length || 0,
      });

      await this.errorHandler.handleError(
        error,
        inputText,
        await this.parameterHandler.getRequestParameters(),
        this.currentRequestId,
        tokenCounter.recordAttempt.bind(tokenCounter),
        this.responseHandler.onResultsUpdate
      );
    } finally {
      this.isProcessing = false;
      logDebug("[REQUEST DEBUG] 🏁 Standard request processing finished");
    }
  }

  /**
   * Process a streaming request to the AI model
   * @param {string} inputText - User input to process
   * @returns {Promise<void>}
   */
  async processStreamingRequest(inputText) {
    logInfo("[REQUEST DEBUG] 🌊 STREAMING REQUEST INITIATED:", {
      inputLength: inputText?.length || 0,
      inputPreview:
        inputText?.substring(0, 50) + (inputText?.length > 50 ? "..." : ""),
      isProcessing: this.isProcessing,
      hasStreamingHandler: !!this.streamingHandler,
      timestamp: Date.now(),
    });

    if (this.isProcessing) {
      logWarn(
        "[REQUEST DEBUG] ⚠️ Streaming request already in progress, aborting"
      );
      return;
    }

    this.isProcessing = true;
    this.progressHandler.startProcessing("Preparing streaming request...");

    try {
      // Validate input
      if (!inputText?.trim()) {
        logError("[REQUEST DEBUG] ❌ No input provided for streaming");
        throw new Error("No input provided");
      }

      logDebug("[REQUEST DEBUG] ✅ Streaming input validation passed");

      // Get and validate parameters
      logDebug("[REQUEST DEBUG] 🔧 Getting streaming parameters...");
      const parameters = await this.parameterHandler.getRequestParameters();

      logDebug("[REQUEST DEBUG] 📋 Streaming parameters retrieved:", {
        model: parameters?.model,
        temperature: parameters?.temperature,
        maxTokens: parameters?.max_tokens,
        hasStream: "stream" in parameters,
        streamValue: parameters?.stream,
        parameterKeys: Object.keys(parameters),
      });

      this.parameterHandler.validateParameters(parameters);
      logDebug("[REQUEST DEBUG] ✅ Streaming parameters validation passed");

      // Prepare streaming request with enhanced file analysis integration
      logDebug(
        "[REQUEST DEBUG] 📦 Preparing streaming request with enhanced analysis..."
      );

      // Check for enhanced file analysis data (same as regular request)
      const fileHandler = window.fileHandler;
      let fileData = null;

      if (fileHandler?.hasValidFile && fileHandler?.currentFile) {
        fileData = {
          file: fileHandler.currentFile,
          engine: null, // Let enhanced analysis determine optimal engine
          enhancedAnalysis: fileHandler.fileAnalysis || {}, // Include Stage 5 analysis
        };

        logDebug(
          "[REQUEST DEBUG] 📊 Using enhanced file analysis for streaming:",
          {
            hasAnalysis: !!fileData.enhancedAnalysis,
            recommendedEngine: fileData.enhancedAnalysis.recommendedEngine,
            confidence: fileData.enhancedAnalysis.confidence,
            complexity: fileData.enhancedAnalysis.complexity,
          }
        );
      }

      const request = await this.parameterHandler.prepareRequest(
        inputText,
        parameters,
        fileData // Include enhanced analysis for streaming
      );
      this.currentRequestId = tokenCounter.generateRequestId();

      logDebug("[REQUEST DEBUG] 🆔 Streaming request prepared:", {
        requestId: this.currentRequestId,
        requestType: Array.isArray(request) ? "messages array" : typeof request,
        messagesCount: Array.isArray(request) ? request.length : 0,
      });

      // Initialize token tracking
      try {
        // Convert request to messages array format expected by token counter
        const messages = [];

        // Add system prompt if present
        if (request.systemPrompt) {
          messages.push({ role: "system", content: request.systemPrompt });
        }

        // Add user message
        if (request.prompt) {
          messages.push({ role: "user", content: request.prompt });
        }

        // Handle file content if present
        if (request.files && request.files.length > 0) {
          request.files.forEach((file) => {
            messages.push({
              role: "user",
              content: file.content || `[File: ${file.name}]`,
            });
          });
        }

        tokenCounter.initializeRequest(
          this.currentRequestId,
          parameters.model,
          messages
        );
        logDebug(
          "[REQUEST DEBUG] 📊 Token tracking initialised with messages:",
          messages.length
        );
      } catch (tokenError) {
        logWarn(
          "[REQUEST DEBUG] ⚠️ Token tracking initialisation failed:",
          tokenError
        );
        // Continue anyway, as token tracking is non-essential
      }

      // Process streaming request
      logInfo("[REQUEST DEBUG] 🚀 Starting streaming request processing...");
      await this.streamingHandler.processStreamingRequest(
        inputText,
        request,
        parameters,
        this.currentRequestId,
        tokenCounter.recordAttempt.bind(tokenCounter)
      );

      logInfo("[REQUEST DEBUG] ✅ Streaming request completed successfully");
    } catch (error) {
      logError("[REQUEST DEBUG] ❌ Streaming request failed:", {
        error: error.message,
        stack: error.stack,
        inputLength: inputText?.length || 0,
        hasStreamingHandler: !!this.streamingHandler,
      });

      await this.errorHandler.handleError(
        error,
        inputText,
        await this.parameterHandler.getRequestParameters(),
        this.currentRequestId,
        tokenCounter.recordAttempt.bind(tokenCounter),
        this.responseHandler.onResultsUpdate
      );
    } finally {
      this.isProcessing = false;
      this.streamingHandler.abortController = null;
      logDebug("[REQUEST DEBUG] 🏁 Streaming request processing finished");
    }
  }

  /**
   * Cancel the current streaming request if one is in progress
   */
  cancelStreaming() {
    logInfo("[REQUEST DEBUG] ❌ Streaming cancellation requested");
    this.streamingHandler.cancelStreaming();
  }

  /**
   * Handle request retry event
   */
  async handleRetry() {
    logInfo("[REQUEST DEBUG] 🔄 Retry request triggered");
    if (this.lastRequest) {
      const { inputText } = this.lastRequest;
      logDebug(
        "[REQUEST DEBUG] 🔄 Retrying with input length:",
        inputText?.length
      );
      await this.processRequest(inputText);
    } else {
      logWarn("[REQUEST DEBUG] ⚠️ No last request to retry");
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    logInfo("[REQUEST DEBUG] 🧹 Cleaning up RequestManagerCore");
    window.removeEventListener("retryRequest", this.handleRetry);
    this.streamingHandler.destroy();
  }
}
