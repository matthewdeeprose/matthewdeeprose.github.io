/**
 * OpenRouter Client Module - Stream
 *
 * Handles streaming API requests, response processing, and chunk parsing.
 */
import { CONFIG } from "../config.js";
import { openRouterConfig } from "./openrouter-client-config.js";
import {
  openRouterUtils,
  OpenRouterClientError,
  ErrorCodes,
} from "./openrouter-client-utils.js";
import { openRouterValidator } from "./openrouter-client-validator.js";
import { openRouterDisplay } from "./openrouter-client-display.js";
import { tokenCounter } from "../token-counter/token-counter-index.js";

/**
 * Class for handling streaming API requests
 */
class OpenRouterStream {
  constructor() {
    this.hasRecordedChunk = false;
  }

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
   * Generate a request ID for tracking
   * @returns {string} Unique request ID
   */
  generateRequestId() {
    return `stream_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }

  /**
   * Get the model family based on the model ID
   * @param {string} modelId - The model identifier
   * @returns {string} The model family name
   */
  getModelFamily(modelId) {
    if (!modelId) return "unknown";

    const modelIdLower = modelId.toLowerCase();

    if (modelIdLower.includes("gpt-4")) return "gpt4";
    if (modelIdLower.includes("gpt-3.5")) return "gpt35";
    if (modelIdLower.includes("claude")) return "claude";
    if (modelIdLower.includes("llama")) return "llama";
    if (modelIdLower.includes("mistral")) return "mistral";
    if (modelIdLower.includes("gemini")) return "gemini";
    if (modelIdLower.includes("palm")) return "palm";

    // Extract provider if available
    if (modelIdLower.includes("/")) {
      const provider = modelIdLower.split("/")[0];
      return provider;
    }

    return "other";
  }

  /**
   * Send a streaming request to the OpenRouter API
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options including callbacks
   * @param {boolean} initialized - Initialization status
   * @returns {Promise<Object>} Request controller for abort capabilities
   */
  async sendStreamingRequest(messages, options = {}, initialized) {
    try {
      this.checkInitialized(initialized);

      const {
        onChunk, // Callback for each text chunk
        onToolCall, // Callback for tool calls
        onComplete, // Callback for completion
        onError, // Callback for errors
        onStart, // Callback for stream start
        abortSignal, // AbortSignal for cancellation
      } = options;

      openRouterUtils.info("Starting streaming request to OpenRouter API", {
        messageCount: messages.length,
        model: options.model,
      });
      // Validate parameters and prepare request body
      const { requestBody, validatedOptions } =
        openRouterValidator.validateRequestParameters(messages, {
          ...options,
          stream: true, // Force streaming mode
        });

      // Create controller for aborting if not provided
      const controller = options.controller || new AbortController();
      const signal = abortSignal || controller.signal;

      // Log the streaming request

      openRouterUtils.debug("Prepared streaming request body", requestBody);

      // Sanitize requestBody for console logging to prevent browser freeze with large base64 data
      const sanitizedBodyForConsole = (() => {
        try {
          const clone = JSON.parse(JSON.stringify(requestBody));
          if (clone.messages && Array.isArray(clone.messages)) {
            clone.messages = clone.messages.map((msg) => {
              if (msg.content && Array.isArray(msg.content)) {
                return {
                  ...msg,
                  content: msg.content.map((item) => {
                    // Truncate base64 image data to prevent console freeze
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
          return {
            error: "Failed to sanitize request body",
            type: typeof requestBody,
          };
        }
      })();

      console.log(
        "📤 STREAMING REQUEST BODY:",
        JSON.stringify(sanitizedBodyForConsole, null, 2)
      );
      // Use sanitized body for display to prevent UI freeze with large base64 data
      openRouterDisplay.updateCodeDisplay(
        "original-request",
        sanitizedBodyForConsole
      );
      openRouterUtils.debug(
        "Prepared streaming request body",
        sanitizedBodyForConsole
      );

      // Update UI to show streaming has started
      if (onStart && typeof onStart === "function") {
        onStart();
      }

      // Ensure stream parameter is set to true
      requestBody.stream = true;

      // Log which model we're using for streaming
      openRouterUtils.info("Sending streaming request for model", {
        model: requestBody.model,
        streamingEnabled: requestBody.stream === true,
        modelFamily: this.getModelFamily(requestBody.model),
      });

      // Send the streaming request
      const response = await fetch(openRouterConfig.getEndpoint(), {
        method: "POST",
        headers: openRouterConfig.getHeaders(),
        body: JSON.stringify(requestBody),
        signal, // For cancellation
      });

      if (!response.ok) {
        const error = await response.json();

        // Enhanced error logging for debugging
        openRouterUtils.error("API returned error response", {
          status: response.status,
          statusText: response.statusText,
          errorMessage: error.error?.message,
          errorCode: error.error?.code,
          errorType: error.error?.type,
          errorMetadata: error.error?.metadata,
          fullError: error,
        });

        // Log the full error as JSON to see all details
        console.error(
          "Full API error details:",
          JSON.stringify(error, null, 2)
        );

        throw new OpenRouterClientError(
          error.error?.message || "API request failed",
          ErrorCodes.API_ERROR,
          { status: response.status, error }
        );
      }

      // Process the stream (with defensive error handling)
      this.processStream(response, {
        onChunk,
        onToolCall,
        onComplete,
        onError,
        requestId: this.generateRequestId(),
        model: options.model,
      }).catch((error) => {
        // Defensive catch for any uncaught errors from processStream
        // AbortErrors should be handled in processStream, but this prevents
        // any potential uncaught promise rejections
        const isAbortError =
          error.name === "AbortError" || error.message?.includes("aborted");

        if (!isAbortError) {
          // Only log non-abort errors (real errors)
          openRouterUtils.error("Uncaught error from processStream", { error });

          // Notify via onError if not already called
          if (onError && typeof onError === "function") {
            onError(error);
          }
        } else {
          // Abort errors are expected - log as debug
          openRouterUtils.debug("Stream cancellation in defensive catch", {
            message: error.message,
          });
        }
      });

      // Return controller for potential cancellation
      return { controller, requestId: this.generateRequestId() };
    } catch (error) {
      openRouterUtils.error("Streaming request failed", { error });

      if (options.onError && typeof options.onError === "function") {
        options.onError(error);
      }

      throw error;
    }
  }

  /**
   * Process the streaming response
   * @param {Response} response - Fetch API response object
   * @param {Object} options - Processing options and callbacks
   * @private
   */
  async processStream(response, options) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullResponse = "";
    this.hasRecordedChunk = false;

    try {
      openRouterUtils.debug("Stream processing started", {
        requestId: options.requestId,
      });

      // Call onStart callback if it exists
      if (options.onStart && typeof options.onStart === "function") {
        options.onStart();
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          openRouterUtils.debug("Stream reading complete");

          // Process any remaining buffer content
          if (buffer.trim()) {
            openRouterUtils.debug("Processing final buffer content", {
              buffer,
              bufferLength: buffer.length,
              bufferStartsWith: buffer.substring(0, 20),
              bufferEndsWith: buffer.substring(buffer.length - 20),
              isJSON: buffer.startsWith("{") && buffer.endsWith("}"),
            });

            try {
              // If buffer contains a complete JSON response, try to extract content
              if (buffer.startsWith("{") && buffer.endsWith("}")) {
                const response = JSON.parse(buffer);

                openRouterUtils.debug("Parsed complete JSON response", {
                  responseKeys: Object.keys(response),
                  hasChoices: !!response.choices,
                  hasUsage: !!response.usage,
                  modelInfo: response.model || "unknown",
                });

                // Extract content from response
                let extractedContent = "";

                if (response.choices && response.choices.length > 0) {
                  const choice = response.choices[0];

                  openRouterUtils.debug("Examining final response choice", {
                    choiceKeys: Object.keys(choice),
                    hasMessage: !!choice.message,
                    messageKeys: choice.message
                      ? Object.keys(choice.message)
                      : "none",
                    hasText: !!choice.text,
                  });

                  if (choice.message?.content) {
                    extractedContent = choice.message.content;
                  } else if (choice.text) {
                    extractedContent = choice.text;
                  }

                  openRouterUtils.debug(
                    "Extracted content from final response",
                    {
                      contentLength: extractedContent.length,
                      contentType: typeof extractedContent,
                      preview:
                        extractedContent.substring(0, 30) +
                        (extractedContent.length > 30 ? "..." : ""),
                    }
                  );

                  // If we extracted content, add it to fullResponse
                  if (extractedContent) {
                    openRouterUtils.debug(
                      "Updating fullResponse with extracted content",
                      {
                        oldLength: fullResponse.length,
                        newLength: extractedContent.length,
                        isReplacement: true,
                      }
                    );
                    fullResponse = extractedContent;
                  }
                }

                // Use the usage info from the response if available
                if (
                  response.usage &&
                  options.onComplete &&
                  typeof options.onComplete === "function"
                ) {
                  openRouterUtils.debug(
                    "Calling onComplete with usage info from response",
                    {
                      usage: JSON.stringify(response.usage),
                      fullResponseLength: fullResponse.length,
                      responseModel: response.model || "unknown",
                    }
                  );
                  options.onComplete(fullResponse, response);
                  break;
                }
              } else {
                // Standard processing for streaming chunks
                openRouterUtils.debug(
                  "Processing non-JSON final buffer with processBufferLine"
                );
                this.processBufferLine(buffer, options, fullResponse);
              }
            } catch (error) {
              openRouterUtils.warn("Error processing final buffer", {
                error: error.message,
                errorStack: error.stack,
                buffer: buffer.substring(0, 100) + "...",
              });
            }
          }

          if (options.onComplete && typeof options.onComplete === "function") {
            // Create final response data object with usage information
            const finalResponseData = {
              usage: {
                prompt_tokens: this.totalPromptTokens || 0, // Use tracked tokens if available
                completion_tokens: fullResponse.length / 4, // Rough estimation based on characters
                total_tokens:
                  (this.totalPromptTokens || 0) + fullResponse.length / 4,
              },
              model: options.model,
              choices: [
                {
                  message: {
                    content: fullResponse,
                  },
                },
              ],
              provider: this.getModelFamily(options.model),
              created: Math.floor(Date.now() / 1000),
              // Add tokenReport for token efficiency display
              tokenReport: {
                tokenEfficiency: 100.0, // Default to 100% efficiency for streaming
                attempts: [
                  {
                    model: options.model,
                    success: true,
                    promptTokens: this.totalPromptTokens || 0,
                    completionTokens: fullResponse.length / 4,
                  },
                ],
                totalPromptTokens: this.totalPromptTokens || 0,
                totalCompletionTokens: fullResponse.length / 4,
              },
            };

            // Update dev panel with usage information
            try {
              openRouterUtils.debug(
                "Updating dev panel after streaming completion",
                {
                  model: options.model,
                  responseLength: fullResponse.length,
                  estimatedTokens: finalResponseData.usage.total_tokens,
                }
              );
              openRouterDisplay.updateDevPanel(
                finalResponseData,
                options.model
              );
            } catch (error) {
              openRouterUtils.warn(
                "Failed to update dev panel after streaming",
                {
                  error: error.message,
                  stack: error.stack,
                }
              );
              // Continue with callback even if dev panel update fails
            }

            // Update the original response display
            try {
              openRouterUtils.debug(
                "Updating response code display after streaming",
                {
                  responseLength: fullResponse.length,
                  displayDataKeys: Object.keys(finalResponseData),
                }
              );

              // Create a complete response object for display
              const displayResponseData = {
                ...finalResponseData,
                id: `chatcmpl-${Date.now()}`,
                object: "chat.completion",
                choices: [
                  {
                    message: {
                      content: fullResponse,
                      role: "assistant",
                    },
                    finish_reason: "stop",
                    index: 0,
                  },
                ],
              };

              openRouterDisplay.updateCodeDisplay(
                "original-response",
                displayResponseData
              );
            } catch (error) {
              openRouterUtils.warn(
                "Failed to update response code display after streaming",
                {
                  error: error.message,
                  stack: error.stack,
                }
              );
              // Continue with callback even if display update fails
            }

            openRouterUtils.debug("Calling onComplete with full response:", {
              responseLength: fullResponse.length,
              responseType: typeof fullResponse,
              hasContent: !!fullResponse,
              preview:
                fullResponse.substring(0, 30) +
                (fullResponse.length > 30 ? "..." : ""),
              finalResponseData: JSON.stringify(finalResponseData),
            });

            // Call the original onComplete callback
            options.onComplete(fullResponse, finalResponseData);
          }
          break;
        }

        // Decode the chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        openRouterUtils.debug("Received raw chunk", {
          length: chunk.length,
          preview: chunk.length > 0 ? chunk.substring(0, 20) + "..." : "empty",
        });
        buffer += chunk;

        // Process complete lines from the buffer
        let lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer

        for (const line of lines) {
          const processed = this.processLine(line, options, fullResponse);
          if (processed && processed.content) {
            fullResponse += processed.content;
            openRouterUtils.debug("Accumulated content:", {
              totalLength: fullResponse.length,
              newContentLength: processed.content.length,
              newContentPreview:
                processed.content.substring(0, 15) +
                (processed.content.length > 15 ? "..." : ""),
            });
          }
        }
      }
    } catch (error) {
      // Check if this is an expected cancellation (AbortError)
      const isAbortError =
        error.name === "AbortError" ||
        error.message.includes("aborted") ||
        error.message.includes("BodyStreamBuffer was aborted");

      if (isAbortError) {
        // Expected cancellation - log as debug, not error
        openRouterUtils.debug("Stream aborted (expected cancellation)", {
          message: error.message,
          errorName: error.name,
        });

        // DON'T call onError for expected cancellations
        // The embed core already handles cleanup via cancelStreaming()
        // Calling onError would trigger unnecessary error handlers

        // Return gracefully without throwing or calling callbacks
        return;
      }

      // Real errors - log and handle normally
      openRouterUtils.error("Error processing stream", {
        error,
        message: error.message,
        stack: error.stack,
      });

      if (options.onError && typeof options.onError === "function") {
        options.onError(error);
      }

      throw new OpenRouterClientError(
        "Stream processing failed: " + error.message,
        ErrorCodes.NETWORK_ERROR,
        { originalError: error }
      );
    } finally {
      openRouterUtils.debug("Stream processing ended", {
        fullResponseLength: fullResponse.length,
        hasContent: fullResponse.length > 0,
        finalPreview:
          fullResponse.length > 0
            ? fullResponse.substring(0, 30) + "..."
            : "no content",
      });

      // Ensure reader is closed - wrap in try-catch to handle cancellation errors
      try {
        reader.cancel();
      } catch (cancelError) {
        // Silently handle cancellation errors - they're expected when already aborted
        openRouterUtils.debug("Reader cancellation completed", {
          hadError: true,
          errorMessage: cancelError.message,
        });
      }
    }
  }

  /**
   * Process a single line from the SSE stream
   * @param {string} line - Line to process
   * @param {Object} options - Callbacks and options
   * @param {string} fullResponse - Current full response
   * @returns {Object|null} Processed content information or null
   * @private
   */
  processLine(line, options, fullResponse) {
    if (line.trim() === "") return null;

    // Handle SSE comments (keep-alive messages)
    if (line.startsWith(": ")) {
      openRouterUtils.debug("SSE Comment:", line);
      return null;
    }

    // Handle SSE data messages
    if (line.startsWith("data: ")) {
      const data = line.slice(6);

      // Handle the special [DONE] message
      if (data === "[DONE]") {
        openRouterUtils.debug("Stream complete [DONE] marker");
        return null;
      }

      // Log the raw data for debugging
      openRouterUtils.info("Processing SSE data chunk:", {
        dataLength: data.length,
        dataPreview: data.substring(0, 50) + (data.length > 50 ? "..." : ""),
        modelFamily: options.model
          ? this.getModelFamily(options.model)
          : "unknown",
        isEmptyOrWhitespace: data.trim() === "",
        firstChar: data.length > 0 ? data.charCodeAt(0) : "none",
        lastChar: data.length > 0 ? data.charCodeAt(data.length - 1) : "none",
      });

      try {
        const parsedData = JSON.parse(data);
        openRouterUtils.debug("Parsed data:", {
          hasChoices: !!parsedData.choices,
        });

        // Extract content or tool calls from the chunk
        if (parsedData.choices && parsedData.choices.length > 0) {
          const choice = parsedData.choices[0];

          // Handle content chunks
          if (choice.delta?.content) {
            const content = choice.delta.content;
            openRouterUtils.debug("Extracted content:", {
              length: content.length,
              preview:
                content.substring(0, 20) + (content.length > 20 ? "..." : ""),
            });

            // Track token usage if not done already
            this.trackStreamTokens(options, parsedData);

            // Call the onChunk callback (with error handling for user code)
            if (options.onChunk && typeof options.onChunk === "function") {
              openRouterUtils.debug("Calling onChunk callback with content:", {
                contentLength: content.length,
              });
              try {
                options.onChunk(content, parsedData);
              } catch (callbackError) {
                // Handle errors thrown by user callback code
                const isAbortError =
                  callbackError.name === "AbortError" ||
                  callbackError.message?.includes("aborted");

                if (isAbortError) {
                  // Expected cancellation from callback - log as debug and throw to trigger processStream's catch
                  openRouterUtils.debug(
                    "Callback triggered cancellation (expected)",
                    {
                      message: callbackError.message,
                    }
                  );
                  throw callbackError;
                } else {
                  // Unexpected error from user callback
                  openRouterUtils.error("Error in onChunk callback", {
                    error: callbackError,
                  });
                  if (
                    options.onError &&
                    typeof options.onError === "function"
                  ) {
                    try {
                      options.onError(callbackError);
                    } catch (e) {
                      openRouterUtils.error("Error in onError callback", {
                        error: e,
                      });
                    }
                  }
                }
              }
            } else {
              openRouterUtils.warn(
                "onChunk callback not available or not a function"
              );
            }

            return { content, parsedData };
          }
          // Handle text field (for some models)
          else if (choice.text) {
            const content = choice.text;
            openRouterUtils.debug("Extracted text:", {
              length: content.length,
            });

            // Call the onChunk callback (with error handling)
            if (options.onChunk && typeof options.onChunk === "function") {
              try {
                options.onChunk(content, parsedData);
              } catch (callbackError) {
                const isAbortError =
                  callbackError.name === "AbortError" ||
                  callbackError.message?.includes("aborted");
                if (isAbortError) {
                  openRouterUtils.debug(
                    "Callback triggered cancellation (expected)",
                    {
                      message: callbackError.message,
                    }
                  );
                  throw callbackError;
                } else {
                  openRouterUtils.error("Error in onChunk callback", {
                    error: callbackError,
                  });
                  if (
                    options.onError &&
                    typeof options.onError === "function"
                  ) {
                    try {
                      options.onError(callbackError);
                    } catch (e) {
                      openRouterUtils.error("Error in onError callback", {
                        error: e,
                      });
                    }
                  }
                }
              }
            }

            return { content, parsedData };
          }
          // Handle complete message field
          else if (choice.message?.content) {
            const content = choice.message.content;
            openRouterUtils.debug("Extracted message content:", {
              length: content.length,
            });

            // Call the onChunk callback (with error handling)
            if (options.onChunk && typeof options.onChunk === "function") {
              try {
                options.onChunk(content, parsedData);
              } catch (callbackError) {
                const isAbortError =
                  callbackError.name === "AbortError" ||
                  callbackError.message?.includes("aborted");
                if (isAbortError) {
                  openRouterUtils.debug(
                    "Callback triggered cancellation (expected)",
                    {
                      message: callbackError.message,
                    }
                  );
                  throw callbackError;
                } else {
                  openRouterUtils.error("Error in onChunk callback", {
                    error: callbackError,
                  });
                  if (
                    options.onError &&
                    typeof options.onError === "function"
                  ) {
                    try {
                      options.onError(callbackError);
                    } catch (e) {
                      openRouterUtils.error("Error in onError callback", {
                        error: e,
                      });
                    }
                  }
                }
              }
            }

            return { content, parsedData };
          }
          // Handle tool calls
          else if (choice.delta?.tool_calls) {
            if (
              options.onToolCall &&
              typeof options.onToolCall === "function"
            ) {
              options.onToolCall(choice.delta.tool_calls, parsedData);
            }
            return { toolCalls: choice.delta.tool_calls, parsedData };
          }

          // Check for finish reason
          if (choice.finish_reason) {
            openRouterUtils.debug("Finish reason:", choice.finish_reason);
          }
        }

        // Track token usage (optional)
        this.trackStreamTokens(options, parsedData);

        return { parsedData };
      } catch (error) {
        openRouterUtils.warn("Error parsing stream chunk", {
          error: error.message,
          data,
        });
        return null;
      }
    }

    // Handle any other line format we might encounter
    openRouterUtils.debug("Unhandled line format:", { line });
    return null;
  }

  /**
   * Process possible content from the final buffer
   * @param {string} buffer - Buffer content
   * @param {Object} options - Callbacks and options
   * @param {string} fullResponse - Current full response
   * @private
   */
  processBufferLine(buffer, options, fullResponse) {
    try {
      const modelFamily = options.model
        ? this.getModelFamily(options.model)
        : "unknown";

      openRouterUtils.debug("Processing buffer line:", {
        bufferLength: buffer.length,
        bufferPreview: buffer.substring(0, 50) + "...",
        modelFamily: modelFamily,
        isEmptyBuffer: buffer.trim() === "",
        bufferStartsWith: buffer.substring(0, 10),
        bufferEndsWith: buffer.substring(buffer.length - 10),
      });

      // Handle SSE data format (data: {...})
      if (buffer.startsWith("data: ")) {
        const data = buffer.slice(6);
        if (data === "[DONE]") return;

        openRouterUtils.info(
          `Processing SSE data in buffer (${modelFamily} model):`,
          {
            dataLength: data.length,
            dataPreview:
              data.substring(0, 50) + (data.length > 50 ? "..." : ""),
          }
        );

        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0]) {
            const choice = parsed.choices[0];
            let content = null;

            if (choice.delta?.content) {
              content = choice.delta.content;
              openRouterUtils.info("Found delta.content in SSE chunk", {
                contentLength: content.length,
                preview:
                  content.substring(0, 30) + (content.length > 30 ? "..." : ""),
              });
            } else if (choice.text) {
              content = choice.text;
              openRouterUtils.info("Found text in SSE chunk", {
                contentLength: content.length,
                preview:
                  content.substring(0, 30) + (content.length > 30 ? "..." : ""),
              });
            } else if (choice.message?.content) {
              content = choice.message.content;
              openRouterUtils.info("Found message.content in SSE chunk", {
                contentLength: content.length,
                preview:
                  content.substring(0, 30) + (content.length > 30 ? "..." : ""),
              });
            } else {
              openRouterUtils.info("No content found in SSE chunk", {
                choiceKeys: Object.keys(choice),
                hasDelta: !!choice.delta,
                deltaKeys: choice.delta ? Object.keys(choice.delta) : "none",
              });
            }

            if (content && options.onChunk) {
              openRouterUtils.info("Calling onChunk with content from SSE", {
                contentLength: content.length,
                hasCallback: !!options.onChunk,
              });
              options.onChunk(content, parsed);
            }
          }
        } catch (e) {
          openRouterUtils.warn("Error parsing SSE chunk", {
            error: e.message,
            data,
          });
        }
      }
      // Handle full JSON response
      else if (buffer.startsWith("{") && buffer.endsWith("}")) {
        try {
          const modelFamily = options.model
            ? this.getModelFamily(options.model)
            : "unknown";

          openRouterUtils.info(
            `Attempting to parse full JSON response (${modelFamily} model)`,
            {
              bufferStart: buffer.substring(0, 30),
              bufferLength: buffer.length,
              modelFamily: modelFamily,
            }
          );

          const parsed = JSON.parse(buffer);

          openRouterUtils.info("Successfully parsed JSON response", {
            responseKeys: Object.keys(parsed),
            hasChoices: !!parsed.choices,
            choicesLength: parsed.choices?.length || 0,
            hasUsage: !!parsed.usage,
            modelName: parsed.model || "unknown",
          });

          // Extract content from different response formats
          let content = null;

          // Check for different response formats
          if (parsed.choices && parsed.choices.length > 0) {
            const choice = parsed.choices[0];

            openRouterUtils.info("Examining choice for content", {
              choiceKeys: Object.keys(choice),
              hasMessage: !!choice.message,
              messageKeys: choice.message
                ? Object.keys(choice.message)
                : "none",
              hasText: !!choice.text,
            });

            if (choice.message?.content) {
              content = choice.message.content;
              openRouterUtils.info("Found message.content in JSON response", {
                contentLength: content.length,
                preview:
                  content.substring(0, 30) + (content.length > 30 ? "..." : ""),
              });
            } else if (choice.text) {
              content = choice.text;
              openRouterUtils.info("Found text in JSON response", {
                contentLength: content.length,
                preview:
                  content.substring(0, 30) + (content.length > 30 ? "..." : ""),
              });
            } else {
              openRouterUtils.warn("No content found in JSON response choice", {
                choiceType: typeof choice,
                choiceKeys: Object.keys(choice),
              });
            }
          }

          openRouterUtils.info("Extracted content from JSON response", {
            hasContent: !!content,
            contentLength: content?.length || 0,
            contentPreview: content ? content.substring(0, 30) : "none",
            hasOnChunkCallback: !!options.onChunk,
            hasOnCompleteCallback: !!options.onComplete,
          });

          if (content) {
            // Always update fullResponse with the content
            fullResponse = content;

            // Call onChunk if available
            if (options.onChunk) {
              openRouterUtils.info(
                "Calling onChunk with content from JSON response",
                {
                  contentLength: content.length,
                }
              );
              options.onChunk(content, parsed);
            }

            // Call onComplete if available
            if (options.onComplete) {
              openRouterUtils.info(
                "Calling onComplete with content from JSON response",
                {
                  contentLength: content.length,
                  responseData:
                    JSON.stringify(parsed).substring(0, 100) + "...",
                }
              );
              options.onComplete(content, parsed);
            }
          } else if (parsed.choices && parsed.choices.length > 0) {
            // If we couldn't extract content but have choices, log a warning
            openRouterUtils.warn(
              "Could not extract content from valid JSON response with choices",
              {
                choiceFormat: typeof parsed.choices[0],
                choiceKeys: Object.keys(parsed.choices[0]),
              }
            );
          } else if (options.onComplete) {
            // If we have no content but have a complete response with usage info, call onComplete
            openRouterUtils.info(
              "No content extracted but calling onComplete with response data",
              {
                hasUsage: !!parsed.usage,
                responseModel: parsed.model || "unknown",
              }
            );
            options.onComplete(fullResponse, parsed);
          }
        } catch (e) {
          openRouterUtils.warn("Error parsing JSON response", {
            error: e.message,
            bufferStart: buffer.substring(0, 50),
          });
        }
      }
    } catch (error) {
      openRouterUtils.warn("Error processing buffer line", {
        error: error.message,
      });
    }
  }

  /**
   * Track token usage for a stream chunk
   * @param {Object} options - Stream options
   * @param {Object} parsedData - Parsed chunk data
   * @private
   */
  trackStreamTokens(options, parsedData) {
    if (parsedData.usage && options.requestId) {
      try {
        if (
          tokenCounter &&
          typeof tokenCounter.recordStreamChunk === "function"
        ) {
          tokenCounter.recordStreamChunk(
            options.requestId,
            parsedData.usage,
            options.model
          );
        }
      } catch (tokenError) {
        openRouterUtils.warn("Error tracking stream tokens", {
          error: tokenError.message,
        });
        // Continue processing even if token tracking fails
      }
    }
  }
}

// Export singleton instance
export const openRouterStream = new OpenRouterStream();
