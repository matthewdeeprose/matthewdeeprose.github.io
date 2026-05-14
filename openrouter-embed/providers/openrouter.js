/**
 * OpenRouter Embed API - OpenRouter Provider (Stage 1, Task 1.2a)
 *
 * The first concrete provider implementing the contract from
 * `providers/_interface.js`. Self-registers with `window.EmbedProviderRegistry`
 * on load.
 *
 * This provider's responsibility for Stage 1 is metadata + a pure
 * canonical-to-wire request mapping (`buildRequest`). Transport for OpenRouter
 * traffic remains with `window.openRouterClient`; `endpoint()` returns
 * informational metadata only. SSE framing is also still handled by the
 * existing client, so `parseStreamChunk` / `parseResponse` are pass-through.
 *
 * In Stage 2 the Foundry adapter will use `endpoint()` and `parseStreamChunk`
 * for real transport; the OpenRouter provider may follow in a later iteration
 * if the OpenRouter client is itself folded into the provider abstraction.
 *
 * @version 1.0.0 (Stage 1, Task 1.2a)
 * @date 6 May 2026
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[EmbedOpenRouterProvider ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedOpenRouterProvider WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedOpenRouterProvider INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedOpenRouterProvider DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // PROVIDER OBJECT
  // ============================================================================

  /**
   * The OpenRouter provider. Conforms to the contract documented in
   * `providers/_interface.js`. See per-member JSDoc below for behaviour notes.
   *
   * @type {Provider}
   */
  const provider = {
    id: "openrouter",

    /**
     * Build an OpenRouter chat-completions request body from canonical inputs.
     *
     * Reproduces the shape that `openrouter-embed-core.js#buildOptions()`
     * currently produces inline (lines 796–856), plus the `messages` field.
     * See the conditional logic for `reasoning` and `plugins` below — both
     * mirror the existing rules exactly so the wire output is byte-compatible
     * for any given input.
     *
     * @param {Array<Object>} messages - Canonical OpenAI-compatible message array
     * @param {Object} options - Canonical request options
     * @param {string} options.model - Model identifier
     * @param {number} options.temperature
     * @param {number} options.max_tokens
     * @param {number} options.top_p
     * @param {Object} [options.reasoning] - Reasoning configuration
     * @param {boolean} [options.reasoning.enabled] - Reasoning toggle
     * @param {string}  [options.reasoning.effort]
     * @param {number}  [options.reasoning.max_tokens]
     * @param {string}  [options.fileEngine] - PDF engine: 'native', 'pdf-text',
     *                                         'mistral-ocr', or 'auto'
     * @returns {Object} Request body suitable for the OpenRouter chat-completions API
     */
    buildRequest(messages, options) {
      logDebug("Building OpenRouter request body");

      const body = {
        model: options.model,
        messages: messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        top_p: options.top_p,
      };

      // Reasoning parameter (mirrors core.js lines 811–827).
      // Three modes via the OpenRouter reasoning parameter:
      //   1. Adaptive:     { enabled: true }                     — model decides depth
      //   2. Effort-based: { enabled: true, effort: 'high' }     — provider maps to budget
      //   3. Budget-based: { enabled: true, max_tokens: 10000 }  — explicit token budget
      if (options.reasoning && options.reasoning.enabled) {
        const reasoning = { enabled: true };

        if (options.reasoning.effort) {
          reasoning.effort = options.reasoning.effort;
        }

        if (
          typeof options.reasoning.max_tokens === "number" &&
          options.reasoning.max_tokens > 0
        ) {
          reasoning.max_tokens = options.reasoning.max_tokens;
        }

        body.reasoning = reasoning;
        logDebug("Added reasoning parameter", reasoning);
      }

      // PDF engine via the official OpenRouter plugins format
      // (mirrors core.js lines 831–851). Only added if a specific engine is
      // chosen — `'auto'` lets OpenRouter choose, so the field is omitted.
      if (options.fileEngine && options.fileEngine !== "auto") {
        body.plugins = [
          {
            id: "file-parser",
            pdf: {
              engine: options.fileEngine,
            },
          },
        ];
        logDebug("Added PDF engine via plugins format", {
          engine: options.fileEngine,
        });
      }

      return body;
    },

    /**
     * Return the OpenRouter chat-completions URL plus an empty headers object.
     *
     * For Stage 1 this is informational metadata only — actual transport for
     * OpenRouter requests still goes through `window.openRouterClient`, which
     * holds authentication and handles SSE framing. Headers are therefore
     * empty here. Stage 2 makes `endpoint()` load-bearing for the Foundry
     * adapter, which uses `fetch` directly and needs the URL + auth headers.
     *
     * @param {string} model - Model identifier (currently unused; reserved for
     *                         per-model URL routing if needed in future)
     * @param {Object} options - Canonical request options (currently unused)
     * @returns {{url: string, headers: Object}}
     */
    endpoint(model, options) {
      return {
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {},
      };
    },

    /**
     * Parse a raw SSE chunk into a canonical delta.
     *
     * The OpenRouter client (`window.openRouterClient`) handles SSE framing
     * before chunks reach `core.js`, so we already receive parsed objects.
     * Pass through unchanged. The Foundry adapter will do real SSE parsing
     * because it talks to `fetch` directly.
     *
     * @param {Object} chunk - Already-parsed chunk object from the OpenRouter client
     * @returns {Object} The same chunk, unchanged
     */
    parseStreamChunk(chunk) {
      return chunk;
    },

    /**
     * Translate a non-streaming wire response to the canonical response shape.
     *
     * The OpenRouter client returns canonical OpenAI-compatible JSON, so this
     * is a pass-through. Future providers (e.g. Anthropic Messages API on
     * Foundry) will need real translation here.
     *
     * @param {Object} json - Raw JSON response body
     * @returns {Object} The same JSON, unchanged
     */
    parseResponse(json) {
      return json;
    },

    /**
     * Provider-level capability flags. These describe what the OpenRouter API
     * surface can support in general, not what any specific model offers.
     * Per-deployment capability information lives in `config.models[i].capabilities`.
     */
    capabilities: {
      streaming: true,
      images: true,
      pdf: true,
      reasoning: true,
      toolCalls: true,
    },
  };

  // ============================================================================
  // SELF-REGISTRATION
  // ============================================================================

  if (
    window.EmbedProviderRegistry &&
    typeof window.EmbedProviderRegistry.register === "function"
  ) {
    try {
      window.EmbedProviderRegistry.register(provider);
      logInfo("OpenRouter provider registered with EmbedProviderRegistry");
    } catch (error) {
      logError("Failed to register OpenRouter provider:", error);
    }
  } else {
    logError(
      "EmbedProviderRegistry not available — script load order issue. " +
        "providers/_interface.js must load before providers/openrouter.js."
    );
  }

  // ============================================================================
  // INITIALISATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed OpenRouter Provider (Stage 1, Task 1.2a) loaded");
  logInfo("Provider id: 'openrouter'");
})();
