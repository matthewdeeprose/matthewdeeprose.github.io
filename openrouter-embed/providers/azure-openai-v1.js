/**
 * OpenRouter Embed API - Microsoft Foundry Provider (Stage 2, Task 2.1)
 *
 * Concrete provider implementing the contract from `providers/_interface.js`
 * for Azure AI Foundry's OpenAI-compatible v1 surface. Provider id is
 * 'azure-openai'. Self-registers with `window.EmbedProviderRegistry` on load.
 *
 * Unlike the OpenRouter provider — which delegates transport to
 * `window.openRouterClient` — this provider owns its own transport: it
 * does its own `fetch` + SSE reading + parsing. The four contract methods
 * (buildRequest, endpoint, parseStreamChunk, parseResponse) are joined
 * by two transport methods (streamRequest, request) that mirror the
 * OpenRouter client's `(messages, options)` signature. Core.js dispatches
 * to these via a `typeof provider.streamRequest === 'function'` check —
 * see openrouter-embed-core.js for the dispatch surface.
 *
 * Stage 2 scope:
 *   - Task 2.1 (this file): adapter + transport, max_tokens → max_completion_tokens
 *   - Task 2.4 (extends this file): reasoning-model temperature drop
 *   - Task 2.6: empirical verification of reasoning content extraction
 *
 * Configuration: arrives via `options.providerConfig` from core.js.
 * Task 2.2 wires the source of that config; until then, `endpoint()`
 * and the transport methods throw a clear error if config is absent.
 *
 * @version 1.0.0 (Stage 2, Task 2.1)
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
      console.error(`[EmbedFoundryProvider ERROR] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedFoundryProvider WARN] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedFoundryProvider INFO] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedFoundryProvider DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  // OpenAI-compatible v1 chat completions path on the Foundry proxy.
  // The proxy forwards POST /openai/v1/chat/completions to
  // https://<resource>.openai.azure.com/openai/v1/chat/completions
  // (see foundry-proxy/worker.js#forwardToFoundry).
  const PROXY_PATH = "/openai/v1/chat/completions";

  // SSE [DONE] terminator marker per OpenAI streaming convention.
  const SSE_DONE_MARKER = "[DONE]";

  // Deployment-name patterns for models that reject `temperature` and `top_p`.
  // The Foundry adapter drops these sampling parameters from the wire body
  // when the deployment matches any pattern below. Tested against the STRIPPED
  // deployment id (e.g. "gpt-5.4-mini"), not the prefixed library id
  // ("azure-openai/gpt-5.4-mini") — see buildRequest for sequencing.
  //
  // Initial list per Stage 0 empirical findings + the staged plan's Task 2.4
  // spec. Adding a new reasoning model to a Foundry resource? Add its
  // deployment-name pattern here. Future Stage 4 work may migrate this into
  // a Provider-contract field; until then, single source of truth lives at
  // the wire-format layer.
  const REASONING_MODEL_PATTERNS = [
    /^gpt-5.*-mini.*$/i, // gpt-5.4-mini, gpt-5.4-mini-2026-03-17, etc.
    /^o1.*$/i, // o1, o1-mini, o1-preview, etc.
    /^o3.*$/i, // o3, o3-mini, etc.
    /^o4.*$/i, // o4, o4-mini, etc.
  ];

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  /**
   * Extract and validate the provider configuration from request options.
   *
   * Throws a clear error if proxyUrl is missing — Stage 2.2 wires the source
   * of this config; until then, callers must pass options.providerConfig
   * explicitly or the dispatch path will surface this error.
   *
   * @param {Object} options
   * @returns {{proxyUrl: string, userToken: string|null}}
   * @throws {Error}
   * @private
   */
  function readProviderConfig(options) {
    const cfg = options && options.providerConfig;
    if (!cfg || typeof cfg.proxyUrl !== "string" || !cfg.proxyUrl.trim()) {
      throw new Error(
        "Foundry adapter: providerConfig.proxyUrl is required. " +
          "Pass it via options.providerConfig.proxyUrl, or wait for Stage 2.2 " +
          "(openrouter-embed-config.js) which wires the configuration source.",
      );
    }
    return {
      proxyUrl: cfg.proxyUrl.trim().replace(/\/$/, ""),
      userToken:
        typeof cfg.userToken === "string" && cfg.userToken.trim()
          ? cfg.userToken.trim()
          : null,
    };
  }

  /**
   * Test whether a stripped deployment id matches any pattern in
   * REASONING_MODEL_PATTERNS. Used by buildRequest to decide whether
   * to drop `temperature` and `top_p` from the wire body.
   *
   * @param {string} strippedDeploymentId - e.g. "gpt-5.4-mini" (NOT
   *   "azure-openai/gpt-5.4-mini"). Strip the registry prefix before
   *   calling this.
   * @returns {boolean}
   * @private
   */
  function isReasoningModel(strippedDeploymentId) {
    if (typeof strippedDeploymentId !== "string" || !strippedDeploymentId) {
      return false;
    }
    return REASONING_MODEL_PATTERNS.some((re) => re.test(strippedDeploymentId));
  }

  /**
   * Parse a single SSE `data:` line into a parsed chunk object.
   *
   * Returns null for the [DONE] terminator, malformed JSON (logged as warn),
   * or non-`data:` lines. The OpenAI v1 surface emits one JSON object per
   * data line. Verified empirically against OpenRouter on 2026-05-10:
   *
   *   {
   *     id: 'gen-...',
   *     object: 'chat.completion.chunk',
   *     created: 1778401548,
   *     model: '<deployment-name>',
   *     choices: [{
   *       index: 0,
   *       delta: { content?: string, role?: 'assistant' },
   *       finish_reason: null | 'stop' | ...
   *     }],
   *     usage?: { prompt_tokens, completion_tokens, total_tokens }  // final chunk
   *   }
   *
   * @param {string} dataLine
   * @returns {Object|null}
   * @private
   */
  function parseSSEDataLine(dataLine) {
    if (typeof dataLine !== "string") return null;
    const trimmed = dataLine.trim();
    if (!trimmed.startsWith("data:")) return null;

    const payload = trimmed.slice(5).trim();
    if (payload === "" || payload === SSE_DONE_MARKER) return null;

    try {
      return JSON.parse(payload);
    } catch (err) {
      logWarn("Failed to parse SSE data line as JSON:", payload, err);
      return null;
    }
  }

  /**
   * Pull complete SSE events out of a buffer string. An event ends at a
   * blank line (`\n\n`). Within each event, lines starting with `data:`
   * carry the payload; other line types (event:, id:, retry:, comments)
   * are ignored — OpenAI's surface doesn't use them but accepting them
   * keeps us spec-compliant.
   *
   * @param {string} buffer
   * @returns {{events: Array<Array<Object>>, remaining: string}}
   * @private
   */
  function extractSSEEvents(buffer) {
    const events = [];
    let remaining = buffer;

    while (true) {
      const eventEnd = remaining.indexOf("\n\n");
      if (eventEnd === -1) break;

      const rawEvent = remaining.slice(0, eventEnd);
      remaining = remaining.slice(eventEnd + 2);

      const lines = rawEvent.split("\n");
      const parsedDataPayloads = [];

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const parsed = parseSSEDataLine(line);
        if (parsed !== null) parsedDataPayloads.push(parsed);
      }

      if (parsedDataPayloads.length > 0) {
        events.push(parsedDataPayloads);
      }
    }

    return { events, remaining };
  }

  // ============================================================================
  // PROVIDER OBJECT
  // ============================================================================

  /** @type {Provider} */
  const provider = {
    id: "azure-openai",

    /**
     * Provider-level capability flags. Describe what the Azure OpenAI v1 API
     * surface CAN support, NOT what any specific deployment offers.
     * Per-deployment variation (e.g. gpt-5.4-mini may not accept images even
     * though the surface does) is declared in config.models[i].capabilities
     * (architecture decision A7).
     *
     *   - pdf: false is canonical — Foundry has uneven PDF support;
     *     the library extracts text client-side before sending.
     *   - reasoning: true reflects o-series and GPT-5 family support.
     *     Empirical content-format work happens in Task 2.6.
     */
    capabilities: {
      streaming: true,
      images: true,
      pdf: false,
      reasoning: true,
      toolCalls: true,
    },

    /**
     * Translate canonical request options to an Azure OpenAI v1 request body.
     *
     * Translations applied:
     *   - Registry prefix stripped from `options.model` (Task 2.1, fixed
     *     Task 2.2). Azure expects raw deployment names; prefixed ids
     *     produce HTTP 404 DeploymentNotFound.
     *   - max_tokens → max_completion_tokens (Task 2.1, unconditional).
     *   - Reasoning models (REASONING_MODEL_PATTERNS): `temperature` and
     *     `top_p` dropped from the wire body when the consumer passed them
     *     (Task 2.4). Reasoning families reject these parameters; their
     *     internal sampling policy ignores caller hints.
     *
     * Streaming-specific:
     *   - Adds `stream_options: { include_usage: true }` whenever
     *     options.stream === true. Without this, Azure does not include
     *     usage stats in streaming responses, breaking responseData.usage
     *     and downstream cost reporting.
     */
    buildRequest(messages, options) {
      logDebug("Building Foundry request body");

      // Strip the `azure-openai/` registry prefix before sending to Azure.
      // Azure expects raw deployment names (e.g. `gpt-5.4-mini`), not the
      // library's namespaced ids (`azure-openai/gpt-5.4-mini`). The regex is
      // anchored to the start and is a no-op if the caller already passed a
      // bare deployment name. Confirmed by Azure 404 `DeploymentNotFound`
      // during Task 2.2 verification (Step 6) on 11 May 2026.
      const deploymentName =
        typeof options.model === "string"
          ? options.model.replace(/^azure-openai\//, "")
          : options.model;

      const body = {
        model: deploymentName,
        messages: messages,
      };

      // max_tokens → max_completion_tokens (Task 2.1 — unconditional).
      if (typeof options.max_tokens === "number") {
        body.max_completion_tokens = options.max_tokens;
      }

      // Sampling-parameter drop for reasoning models (Task 2.4).
      //
      // Reasoning models (o-series, GPT-5 family) reject `temperature` and
      // `top_p` with HTTP 400. They route through an internal sampling
      // policy that ignores caller hints. We drop both parameters when the
      // deployment matches REASONING_MODEL_PATTERNS.
      //
      // Deviation from plan literal: the staged plan says "drop temperature"
      // only, but the Stage 0 empirical principle ("only pass parameters
      // that are explicitly set, and only when the model accepts them")
      // applies symmetrically to `top_p`. Cost of being wrong: dropping on
      // an accepting model = mild fidelity loss. Keeping on a rejecting
      // model = HTTP 400. Asymmetry favours dropping.
      const isReasoning = isReasoningModel(deploymentName);

      if (typeof options.temperature === "number" && !isReasoning) {
        body.temperature = options.temperature;
      }
      if (typeof options.top_p === "number" && !isReasoning) {
        body.top_p = options.top_p;
      }

      // Single DEBUG log per drop, only when something was actually dropped.
      // Avoids log spam on routine reasoning-model requests where the
      // consumer didn't pass sampling parameters in the first place.
      if (isReasoning) {
        const droppedTemperature = typeof options.temperature === "number";
        const droppedTopP = typeof options.top_p === "number";
        if (droppedTemperature || droppedTopP) {
          logDebug(
            `Reasoning model detected — dropped sampling parameters for '${deploymentName}'`,
            {
              droppedTemperature,
              droppedTopP,
              originalTemperature: options.temperature,
              originalTopP: options.top_p,
            },
          );
        }
      }

      if (options.stream === true) {
        body.stream = true;
        // Critical: ensures Azure returns usage stats in the final chunk.
        body.stream_options = { include_usage: true };
      }

      logDebug("Foundry request body built", { keys: Object.keys(body) });
      return body;
    },

    /**
     * Compute the proxy URL + headers for an Azure OpenAI v1 chat completion.
     *
     * The proxy forwards /openai/v1/... to the configured Foundry resource
     * with the API key injected server-side. We never send the Azure key
     * ourselves — only the optional user token (per worker.js
     * validateUserToken).
     *
     * @throws {Error} If providerConfig.proxyUrl is missing.
     */
    endpoint(model, options) {
      const { proxyUrl, userToken } = readProviderConfig(options);

      const headers = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };
      if (userToken) {
        headers["x-user-token"] = userToken;
      }

      // Note: no `Authorization: Bearer <key>` — the Worker holds the Azure
      // key and injects it server-side. See foundry-proxy/worker.js.

      return {
        url: proxyUrl + PROXY_PATH,
        headers,
      };
    },

    /**
     * Parse a single SSE `data:` line into a parsed chunk object.
     *
     * Unlike the OpenRouter provider's pass-through (the OpenRouter client
     * pre-parses), this provider receives raw SSE strings because it owns
     * its own transport. Returns null for [DONE], malformed JSON, or
     * non-`data:` lines. The contract's "input format provider-defined"
     * wording allows this asymmetry (see providers/_interface.js typedef).
     */
    parseStreamChunk(rawLine) {
      return parseSSEDataLine(rawLine);
    },

    /**
     * Translate a non-streaming wire response to the canonical shape.
     *
     * Azure OpenAI v1 JSON shape matches the canonical OpenAI shape
     * ({choices: [{message: {content}}], usage, model, ...}), so this is
     * pass-through. Future non-OpenAI-compatible providers (e.g. Anthropic
     * Messages API on Foundry, Stage 4) will need real translation here.
     */
    parseResponse(json) {
      return json;
    },

    /**
     * Send a streaming chat-completion request to Foundry and dispatch
     * canonical callbacks as chunks arrive.
     *
     * Mirrors window.openRouterClient.sendStreamingRequest(messages, options)
     * in signature and behaviour, so core.js's dispatch can fall through to
     * either provider transparently.
     *
     * Callback contract (verified empirically 2026-05-10):
     *   - onStart(): no args; called once before the first chunk
     *   - onChunk(text: string, parsedChunk: Object): called per chunk that
     *     carries non-empty delta.content. parsedChunk is the full
     *     OpenAI-shape {id, object, created, model, choices, ...} so
     *     downstream consumers can introspect.
     *   - onComplete(fullText: string, responseData: Object): called once
     *     when the stream ends. responseData carries
     *     {model, usage, choices, created, processingTime}. usage is
     *     populated from the final SSE chunk (requires
     *     stream_options.include_usage in the request body).
     *   - onError(error: Error): transport failures or non-2xx HTTP
     *     responses. AbortError is propagated unchanged so core.js's
     *     expected-cancellation detection works.
     *
     * Cancellation: reads options.abortSignal and threads it into fetch.
     */
    async streamRequest(messages, options) {
      const opts = options || {};
      const onStart = typeof opts.onStart === "function" ? opts.onStart : null;
      const onChunk = typeof opts.onChunk === "function" ? opts.onChunk : null;
      const onComplete =
        typeof opts.onComplete === "function" ? opts.onComplete : null;
      const onError = typeof opts.onError === "function" ? opts.onError : null;
      const abortSignal = opts.abortSignal || null;

      try {
        const { url, headers } = this.endpoint(opts.model, opts);
        const body = this.buildRequest(messages, { ...opts, stream: true });

        logInfo("Foundry streaming request", { url, model: opts.model });

        if (onStart) {
          try {
            onStart();
          } catch (callbackErr) {
            logWarn("onStart callback threw:", callbackErr);
          }
        }

        const startTime = Date.now();

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: abortSignal || undefined,
        });

        if (!response.ok) {
          let errorBody = "";
          try {
            errorBody = await response.text();
          } catch (_) {
            errorBody = "<unable to read error body>";
          }
          const err = new Error(
            `Foundry request failed: HTTP ${response.status} — ${errorBody}`,
          );
          err.status = response.status;
          err.body = errorBody;
          throw err;
        }

        if (!response.body) {
          throw new Error("Foundry response has no body — cannot stream");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullText = "";
        let finalChunkData = null;
        let chunkIndex = 0;

        const processParsed = (parsed) => {
          finalChunkData = parsed;
          const choice = parsed && parsed.choices && parsed.choices[0];
          const delta = choice && choice.delta;
          const contentPiece = delta && delta.content;

          // Emit only when content is a non-empty string. Role-only chunks
          // (typically the first) are skipped to avoid empty callbacks.
          if (typeof contentPiece === "string" && contentPiece !== "") {
            fullText += contentPiece;
            if (onChunk) {
              try {
                onChunk(contentPiece, parsed);
              } catch (callbackErr) {
                logWarn("onChunk callback threw:", callbackErr);
              }
            }
            chunkIndex++;
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const { events, remaining } = extractSSEEvents(buffer);
            buffer = remaining;

            for (const eventPayloads of events) {
              for (const parsed of eventPayloads) {
                processParsed(parsed);
              }
            }
          }

          // Drain anything left in the buffer at stream end. Defensive
          // against connections that close without a trailing blank line.
          if (buffer.trim().length > 0) {
            const { events: tailEvents } = extractSSEEvents(buffer + "\n\n");
            for (const eventPayloads of tailEvents) {
              for (const parsed of eventPayloads) {
                processParsed(parsed);
              }
            }
          }
        } finally {
          try {
            reader.releaseLock();
          } catch (_) {
            /* may already be released */
          }
        }

        const elapsedMs = Date.now() - startTime;

        // Compose responseData mirroring the shape core.js's
        // buildFinalResponse expects (model, usage, processingTime).
        // Pull usage from the final chunk if present.
        const responseData = {
          model: (finalChunkData && finalChunkData.model) || opts.model || null,
          usage:
            finalChunkData && finalChunkData.usage
              ? finalChunkData.usage
              : null,
          choices:
            finalChunkData && finalChunkData.choices
              ? finalChunkData.choices
              : null,
          created:
            finalChunkData && finalChunkData.created
              ? finalChunkData.created
              : null,
          processingTime: elapsedMs,
        };

        logInfo("Foundry streaming complete", {
          chunks: chunkIndex,
          chars: fullText.length,
          elapsedMs,
          hasUsage: !!responseData.usage,
        });

        if (onComplete) {
          try {
            onComplete(fullText, responseData);
          } catch (callbackErr) {
            logWarn("onComplete callback threw:", callbackErr);
          }
        }
      } catch (error) {
        // Propagate AbortError unchanged so core.js's
        // expected-cancellation detection treats it correctly.
        if (error && error.name === "AbortError") {
          logDebug("Foundry stream aborted (expected cancellation)");
          if (onError) {
            try {
              onError(error);
            } catch (_) {
              /* suppress to keep AbortError identity */
            }
          }
          throw error;
        }

        logError("Foundry streaming error:", error);
        if (onError) {
          try {
            onError(error);
          } catch (callbackErr) {
            logWarn("onError callback threw:", callbackErr);
          }
        }
        throw error;
      }
    },

    /**
     * Send a non-streaming chat-completion request to Foundry.
     *
     * Mirrors window.openRouterClient.sendRequest(messages, options). Used
     * by core.js's reduced-motion fallback path (_sendNonStreamingFallback).
     */
    async request(messages, options) {
      const opts = options || {};
      const abortSignal = opts.abortSignal || null;

      const { url, headers } = this.endpoint(opts.model, opts);
      const body = this.buildRequest(messages, { ...opts, stream: false });

      logInfo("Foundry non-streaming request", { url, model: opts.model });

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortSignal || undefined,
      });

      if (!response.ok) {
        let errorBody = "";
        try {
          errorBody = await response.text();
        } catch (_) {
          errorBody = "<unable to read error body>";
        }
        const err = new Error(
          `Foundry request failed: HTTP ${response.status} — ${errorBody}`,
        );
        err.status = response.status;
        err.body = errorBody;
        throw err;
      }

      const json = await response.json();
      return this.parseResponse(json);
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
      logInfo("Foundry (azure-openai) provider registered");
    } catch (error) {
      logError("Failed to register Foundry provider:", error);
    }
  } else {
    logError(
      "EmbedProviderRegistry not available — script load order issue. " +
        "providers/_interface.js must load before providers/azure-openai-v1.js.",
    );
  }

  // ============================================================================
  // INITIALISATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Foundry Provider (Stage 2, Task 2.1) loaded");
  logInfo("Provider id: 'azure-openai'");
})();
