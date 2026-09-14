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
 * CHOICE EXTRACTION LIVES IN ONE PLACE NOW — js/modality/modality-core.js.
 *
 * This file used to hold FOUR copies of it, in TWO different precedence orders:
 *
 *   delta-first    processLine, and processBufferLine's SSE branch
 *   message-first  the processStream done path, and processBufferLine's
 *                  full-JSON branch — neither of which inspects `delta` at all
 *
 * The two orders are NOT interchangeable. On a choice carrying both `text` and
 * `message.content` the delta-first order yields `text` and the message-first
 * order yields `message.content`, so unifying them into a single fold would
 * change shipped behaviour at two of the four sites. Both orders are therefore
 * preserved, and .claude/modality/prove-collapse-differential.mjs replays
 * recorded wire captures through the pre-collapse and post-collapse modules and
 * requires the observable output to be byte-identical.
 *
 * WHY THE HELPERS ARE RESOLVED AT CALL TIME AND NEVER CACHED. modality-core.js
 * is a plain script publishing on `window`, which the HTML spec guarantees runs
 * before any deferred ES module — but a module-scope `const core =
 * window.ModalityCore` would capture whatever was there at evaluation time, and
 * this codebase has already shipped ten dead announcement call sites that way.
 * The `<script>` tag ships in the same commit as this file.
 *
 * There is deliberately NO INLINE FALLBACK. A fallback would be a fifth copy of
 * the very logic this collapse exists to remove, and it would rot in exactly the
 * way the four copies did — silently, because nothing would exercise it.
 */
function modalityCore() {
  const core = typeof window !== "undefined" ? window.ModalityCore : null;
  if (!core) {
    openRouterUtils.error(
      "window.ModalityCore is unavailable — choice extraction cannot run. " +
        "js/modality/modality-core.js must load before this module.",
    );
    return null;
  }
  return core;
}

/** Delta-first precedence, for a streaming chunk. */
function extractDeltaChoice(choice) {
  const core = modalityCore();
  return core
    ? core.extractDeltaChoice(choice)
    : { kind: "none", content: null, toolCalls: null };
}

/** Message-first precedence, for a complete body. */
function extractMessageChoice(choice) {
  const core = modalityCore();
  return core
    ? core.extractMessageChoice(choice)
    : { kind: "none", content: null, toolCalls: null };
}

/**
 * Fold one streaming delta into an accumulator (MODALITY STEP 4).
 *
 * Resolved at call time for the same reason the two extractors above are, and
 * returns null rather than an inline fallback when the core is absent — a
 * fallback would be a second copy of the fold, which is the duplication this
 * whole arrangement exists to remove.
 */
function reduceStreamDelta(delta, acc) {
  const core = modalityCore();
  return core ? core.reduceStreamDelta(delta, acc) : null;
}

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
        ErrorCodes.INVALID_PARAMETERS,
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
        onAudio, // Callback for the streamed audio side channel
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
      // Phase 2 fix: Also handles type:"file" (PDFs) not just type:"image_url" (images)
      const sanitizedBodyForConsole = (() => {
        try {
          // Build a lightweight summary instead of deep-cloning the entire payload
          // Deep cloning via JSON.parse(JSON.stringify()) on multi-MB base64 data
          // causes ~22MB+ of synchronous string processing and freezes/crashes tabs
          const summary = {
            model: requestBody.model,
            stream: requestBody.stream,
            temperature: requestBody.temperature,
            max_tokens: requestBody.max_tokens,
            top_p: requestBody.top_p,
          };

          if (requestBody.messages && Array.isArray(requestBody.messages)) {
            summary.messages = requestBody.messages.map((msg) => {
              // For simple string content, include as-is
              if (typeof msg.content === "string") {
                return {
                  role: msg.role,
                  content:
                    msg.content.length > 500
                      ? msg.content.substring(0, 500) +
                        `... <TRUNCATED: ${msg.content.length.toLocaleString()} chars total>`
                      : msg.content,
                };
              }

              // For array content (file attachments), sanitise each item
              if (Array.isArray(msg.content)) {
                return {
                  role: msg.role,
                  content: msg.content.map((item) => {
                    // Truncate base64 image data
                    if (item.type === "image_url" && item.image_url?.url) {
                      const url = item.image_url.url;
                      if (url.startsWith("data:") && url.length > 200) {
                        const [header] = url.split(",");
                        const dataLength = url.length - header.length - 1;
                        return {
                          type: "image_url",
                          image_url: {
                            url: `${header},<BASE64_TRUNCATED: ${dataLength.toLocaleString()} chars>`,
                          },
                        };
                      }
                    }

                    // Truncate base64 PDF/file data (Phase 2 fix)
                    if (item.type === "file" && item.file?.file_data) {
                      const fileData = item.file.file_data;
                      if (
                        fileData.startsWith("data:") &&
                        fileData.length > 200
                      ) {
                        const [header] = fileData.split(",");
                        const dataLength = fileData.length - header.length - 1;
                        return {
                          type: "file",
                          file: {
                            filename: item.file.filename,
                            file_data: `${header},<BASE64_TRUNCATED: ${dataLength.toLocaleString()} chars>`,
                          },
                        };
                      }
                    }

                    // MODALITY STEP 4 — input_audio, which the fall-through at
                    // the bottom of this map would otherwise return WHOLE.
                    //
                    // That fall-through is `return item`, so this block has
                    // only ever truncated what it RECOGNISES, and an audio part
                    // is precisely the multi-megabyte console freeze it exists
                    // to prevent: one captured reply carries 160,000 base64
                    // chars, and this summary is read by both the debug log and
                    // the dev panel.
                    //
                    // NO `data:` HEADER TO PRESERVE, unlike the two arms above.
                    // input_audio.data is RAW base64 — audioContentPart mints it
                    // without a prefix, because audio input has no URL form — so
                    // there is nothing to split on and the whole string is data.
                    if (item.type === "input_audio" && item.input_audio?.data) {
                      const audioData = item.input_audio.data;
                      if (typeof audioData === "string" && audioData.length > 200) {
                        return {
                          type: "input_audio",
                          input_audio: {
                            format: item.input_audio.format,
                            data: `<BASE64_TRUNCATED: ${audioData.length.toLocaleString()} chars>`,
                          },
                        };
                      }
                    }

                    // For text items, truncate if very long
                    if (item.type === "text" && item.text?.length > 500) {
                      return {
                        type: "text",
                        text:
                          item.text.substring(0, 500) +
                          `... <TRUNCATED: ${item.text.length.toLocaleString()} chars total>`,
                      };
                    }

                    return item;
                  }),
                };
              }

              return { role: msg.role, content: "[complex content]" };
            });
          }

          // Copy any plugins config
          if (requestBody.plugins) {
            summary.plugins = requestBody.plugins;
          }

          return summary;
        } catch (e) {
          return {
            error: "Failed to sanitize request body",
            type: typeof requestBody,
          };
        }
      })();

      // Only log request body at debug level to avoid console overhead
      openRouterUtils.debug(
        "Streaming request body (sanitised)",
        sanitizedBodyForConsole,
      );

      // Update dev panel display with sanitised (lightweight) body
      openRouterDisplay.updateCodeDisplay(
        "original-request",
        sanitizedBodyForConsole,
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
          JSON.stringify(error, null, 2),
        );

        throw new OpenRouterClientError(
          error.error?.message || "API request failed",
          ErrorCodes.API_ERROR,
          { status: response.status, error },
        );
      }

      // Process the stream (with defensive error handling)
      this.processStream(response, {
        onChunk,
        onToolCall,
        onComplete,
        onError,
        // MODALITY STEP 4. processStream reads options.onAudio (see the audio
        // block gated on delta.audio); this literal is the only object that
        // reaches it from the public entry point, so a key absent here is a
        // callback the consumer can never receive. It was absent until
        // 12 September 2026: the bytes were accumulated correctly and then
        // discarded, and only the transcript survived via fullResponse.
        //
        // onStart is DELIBERATELY still absent. processStream reads it too, but
        // sendStreamingRequest already fires it directly at the top of this
        // method — adding it here would make it fire TWICE.
        onAudio,
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

    // MODALITY STEP 4: the per-stream audio accumulator, folded by
    // ModalityCore.reduceStreamDelta. Null until a chunk carries delta.audio,
    // so an ordinary text stream never allocates it and never touches this.
    let streamAudio = null;
    this.hasRecordedChunk = false;

    // AW-23: per-stream latch for the provider's stop signal. The wire carries
    // finish_reason on a TERMINAL chunk whose delta holds no content, and the
    // synthesised finalResponseData below is built after the reader has
    // finished, so the value has to be latched as it goes past rather than read
    // off the last chunk. Reset here, beside hasRecordedChunk, so one stream's
    // reason can never be reported for the next.
    this.lastFinishReason = null;
    this.lastNativeFinishReason = null;

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

                  // AW-23: a final buffer that parsed as one complete body
                  // carries the stop signal in the ordinary place.
                  this.latchFinishReason(choice);

                  openRouterUtils.debug("Examining final response choice", {
                    choiceKeys: Object.keys(choice),
                    hasMessage: !!choice.message,
                    messageKeys: choice.message
                      ? Object.keys(choice.message)
                      : "none",
                    hasText: !!choice.text,
                  });

                  // Message-first: this is a COMPLETE body, not a chunk.
                  const extracted = extractMessageChoice(choice);
                  if (extracted.content) {
                    extractedContent = extracted.content;
                  }

                  openRouterUtils.debug(
                    "Extracted content from final response",
                    {
                      contentLength: extractedContent.length,
                      contentType: typeof extractedContent,
                      preview:
                        extractedContent.substring(0, 30) +
                        (extractedContent.length > 30 ? "..." : ""),
                    },
                  );

                  // If we extracted content, add it to fullResponse
                  if (extractedContent) {
                    openRouterUtils.debug(
                      "Updating fullResponse with extracted content",
                      {
                        oldLength: fullResponse.length,
                        newLength: extractedContent.length,
                        isReplacement: true,
                      },
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
                    },
                  );
                  options.onComplete(fullResponse, response);
                  break;
                }
              } else {
                // Standard processing for streaming chunks
                openRouterUtils.debug(
                  "Processing non-JSON final buffer with processBufferLine",
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
                  // AW-23: the provider's stop signal, latched as the stream
                  // went past. Until this parcel it was read at the chunk and
                  // then discarded here, so no consumer could tell a reply cut
                  // off at the token budget from one that finished — AW-15
                  // measured four such replies applied silently. null when the
                  // wire carried none; never invented.
                  finish_reason: this.lastFinishReason || null,
                  native_finish_reason: this.lastNativeFinishReason || null,
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
                },
              );
              openRouterDisplay.updateDevPanel(
                finalResponseData,
                options.model,
              );
            } catch (error) {
              openRouterUtils.warn(
                "Failed to update dev panel after streaming",
                {
                  error: error.message,
                  stack: error.stack,
                },
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
                },
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
                displayResponseData,
              );
            } catch (error) {
              openRouterUtils.warn(
                "Failed to update response code display after streaming",
                {
                  error: error.message,
                  stack: error.stack,
                },
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
          // MODALITY STEP 4 — THE AUDIO REPLY THIS LOOP USED TO DROP WHOLE.
          //
          // Measured on .claude/modality/fixtures/audio-out.raw.txt: ALL 17
          // chunks carry delta.content === "", so the guard above never fires
          // once, `fullResponse` stayed "", and onComplete was called with an
          // empty string at the end of a complete, paid-for reply. Fifteen of
          // the seventeen carry delta.audio.
          //
          // THE TEXT CHANNEL ITSELF HAS MOVED, and that is the whole shape of
          // this block. The human-readable words of an audio reply live in
          // delta.audio.transcript, NOT in delta.content — so accumulating the
          // bytes and leaving the text path alone would still render an empty
          // reply. The transcript is appended to fullResponse because it IS the
          // reply's text; the base64 audio leaves on its own side channel and
          // never touches the string.
          //
          // GATED ON delta.audio ALONE, so a pure-text stream cannot reach a
          // line of this. The golden differential over recorded captures is
          // what holds that claim — not this comment.
          const audioChoice =
            processed &&
            processed.parsedData &&
            processed.parsedData.choices &&
            processed.parsedData.choices[0];
          const audioDelta =
            audioChoice && audioChoice.delta ? audioChoice.delta.audio : null;

          if (audioDelta && typeof audioDelta === "object") {
            // Folded through the core rather than reassembled here: `data` and
            // `transcript` append, `id` and `expires_at` overwrite. Only the
            // audio key is handed to the fold, so it cannot touch text even if
            // a chunk ever carried both.
            streamAudio = reduceStreamDelta({ audio: audioDelta }, streamAudio);

            if (typeof audioDelta.transcript === "string") {
              fullResponse += audioDelta.transcript;
            }

            // NEVER LOG THE PAYLOAD. 160,000 base64 chars is what one captured
            // reply carries, the request sanitiser's fall-through has already
            // put an untruncated part into the console once, and the RESPONSE
            // side has no sanitiser at all. A length is the only safe thing to
            // print here.
            const acc = streamAudio && streamAudio.audio ? streamAudio.audio : null;
            openRouterUtils.debug("Accumulated audio:", {
              transcriptLength: acc ? acc.transcript.length : 0,
              audioDataLength: acc ? acc.data.length : 0,
              hasId: !!(acc && acc.id),
            });

            // The side channel, carrying a CUMULATIVE SNAPSHOT rather than a
            // fragment: reduceStreamDelta is pure and returns a fresh object
            // each fold, so every call gets its own snapshot and the LAST one
            // is the complete payload. A consumer that keeps only the latest is
            // therefore correct. Deliberately NOT routed through onChunk — that
            // path does `streamBuffer += chunk` and `chunk.substring(0, 30)`,
            // and a non-string corrupts the buffer and then throws.
            if (
              acc &&
              options.onAudio &&
              typeof options.onAudio === "function"
            ) {
              try {
                options.onAudio(acc);
              } catch (callbackError) {
                openRouterUtils.error("Error in onAudio callback", {
                  error: callbackError,
                });
              }
            }
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
        { originalError: error },
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

      // Ensure reader is closed. reader.cancel() returns a Promise that REJECTS
      // when the stream has already errored (e.g. a mid-stream network drop), so
      // a synchronous try/catch can't catch it — attach a .catch() to swallow the
      // async rejection and avoid an "Uncaught (in promise)" in the console. The
      // try/catch still guards any synchronous throw from cancel() itself.
      try {
        reader.cancel().catch((cancelError) => {
          openRouterUtils.debug("Reader cancellation rejected (expected)", {
            errorMessage: cancelError?.message,
          });
        });
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
   * Latch the provider's stop signal off a choice, if it carries one.
   *
   * AW-23. Called from every site that resolves choices[0], because the chunk
   * carrying finish_reason is not reliably the one carrying content, nor
   * reliably the last one parsed. Only a non-empty value is latched, so a
   * stream of `finish_reason: null` deltas cannot erase a reason already seen.
   *
   * native_finish_reason is OpenRouter's pass-through of the upstream
   * provider's own wording, and is recorded unchanged beside the normalised
   * one — neither is interpreted here.
   *
   * @param {Object} choice - A single element of a response `choices` array
   * @private
   */
  latchFinishReason(choice) {
    if (!choice) return;

    if (typeof choice.finish_reason === "string" && choice.finish_reason) {
      this.lastFinishReason = choice.finish_reason;
    }

    if (
      typeof choice.native_finish_reason === "string" &&
      choice.native_finish_reason
    ) {
      this.lastNativeFinishReason = choice.native_finish_reason;
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

          // AW-23: latch before any branch below returns, so the stop signal is
          // captured whichever shape this chunk turns out to be.
          this.latchFinishReason(choice);

          // Handle content chunks
          // Delta-first extraction, in one place. The four arms below are the
          // same four this chain has always had, and in the same order — what
          // has gone is the DUPLICATION of the order itself, which lived in
          // three other places in this file and disagreed with two of them.
          //
          // Note the chain is exhaustive-by-precedence, not by shape: a chunk
          // carrying BOTH delta.content and delta.audio yields only the content,
          // because content outranks everything. That is deliberately unchanged
          // here — handling the second payload is a later step, and this parcel
          // must not alter what a user sees.
          const extracted = extractDeltaChoice(choice);
          const isContentKind =
            extracted.kind === "content" ||
            extracted.kind === "text" ||
            extracted.kind === "message";

          if (isContentKind) {
            const content = extracted.content;

            // Each arm has always logged differently, and token tracking has
            // always run on the delta.content arm ALONE. Preserved exactly:
            // a differential over recorded wire captures compares these paths
            // call for call, so a "tidier" uniform version would redden.
            if (extracted.kind === "content") {
              openRouterUtils.debug("Extracted content:", {
                length: content.length,
                preview:
                  content.substring(0, 20) + (content.length > 20 ? "..." : ""),
              });

              // Track token usage if not done already
              this.trackStreamTokens(options, parsedData);
            } else if (extracted.kind === "text") {
              openRouterUtils.debug("Extracted text:", {
                length: content.length,
              });
            } else {
              openRouterUtils.debug("Extracted message content:", {
                length: content.length,
              });
            }

            // Call the onChunk callback (with error handling for user code)
            if (options.onChunk && typeof options.onChunk === "function") {
              if (extracted.kind === "content") {
                openRouterUtils.debug("Calling onChunk callback with content:", {
                  contentLength: content.length,
                });
              }
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
                    },
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
            } else if (extracted.kind === "content") {
              // Only the delta.content arm has ever warned about a missing
              // callback. The other two stayed silent, and still do.
              openRouterUtils.warn(
                "onChunk callback not available or not a function",
              );
            }

            return { content, parsedData };
          }

          // Handle tool calls
          if (extracted.kind === "toolCalls") {
            if (
              options.onToolCall &&
              typeof options.onToolCall === "function"
            ) {
              options.onToolCall(extracted.toolCalls, parsedData);
            }
            return { toolCalls: extracted.toolCalls, parsedData };
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
          },
        );

        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0]) {
            const choice = parsed.choices[0];

            // AW-23: the tail drain parses chunks the main loop never saw.
            this.latchFinishReason(choice);
            let content = null;

            // Delta-first: an SSE chunk. Note this branch has never handled
            // tool_calls, and still does not — a tool-call-only chunk yields no
            // content here, exactly as before.
            const extracted = extractDeltaChoice(choice);
            if (extracted.content) {
              content = extracted.content;
              const FOUND_LABEL = {
                content: "Found delta.content in SSE chunk",
                text: "Found text in SSE chunk",
                message: "Found message.content in SSE chunk",
              };
              openRouterUtils.info(FOUND_LABEL[extracted.kind], {
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
            },
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

            // AW-23: the non-SSE full-JSON drain reaches consumers too.
            this.latchFinishReason(choice);

            openRouterUtils.info("Examining choice for content", {
              choiceKeys: Object.keys(choice),
              hasMessage: !!choice.message,
              messageKeys: choice.message
                ? Object.keys(choice.message)
                : "none",
              hasText: !!choice.text,
            });

            // Message-first: a complete body. Deliberately does NOT inspect
            // `delta`, matching what this branch has always done.
            const extracted = extractMessageChoice(choice);
            if (extracted.content) {
              content = extracted.content;
              openRouterUtils.info(
                extracted.kind === "message"
                  ? "Found message.content in JSON response"
                  : "Found text in JSON response",
                {
                  contentLength: content.length,
                  preview:
                    content.substring(0, 30) +
                    (content.length > 30 ? "..." : ""),
                },
              );
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
                },
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
                },
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
              },
            );
          } else if (options.onComplete) {
            // If we have no content but have a complete response with usage info, call onComplete
            openRouterUtils.info(
              "No content extracted but calling onComplete with response data",
              {
                hasUsage: !!parsed.usage,
                responseModel: parsed.model || "unknown",
              },
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
            options.model,
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
