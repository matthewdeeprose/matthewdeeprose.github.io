/**
 * OPENROUTER EMBED LOCAL BACKEND -- Dual-Engine Dispatch
 *
 * Routes local model requests to ONNX (LocalTextModelGateway) or
 * WebLLM (WebLLMTextEngine) based on the registry's engine field.
 * Both engines produce identical result shapes.
 *
 * Depends on: LocalTextModelRegistry (required),
 *   LocalTextModelGateway (ONNX), WebLLMTextEngine (WebLLM),
 *   LocalTextModelManager (optional -- auto-load)
 *
 * Public API (window.EmbedLocalBackend):
 *   isLocalModel(modelId), handleRequest(embed, options),
 *   getAvailableModels()
 *
 * VERSION: 2.0.0 | DATE: 7 April 2026 | PHASE: DE-5
 */

window.EmbedLocalBackendClass = (function () {
  "use strict";

  // ====================================================================
  // LOGGING CONFIGURATION
  // ====================================================================

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
      console.error("[EmbedLocalBackend]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[EmbedLocalBackend]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[EmbedLocalBackend]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[EmbedLocalBackend]", message, ...args);
  }

  // ====================================================================
  // CONSTANTS
  // ====================================================================

  /** Minimum milliseconds between streaming UI renders */
  const RENDER_THROTTLE_MS = 50;

  /** Minimum characters accumulated before triggering a render */
  const RENDER_CHAR_THRESHOLD = 20;

  // ====================================================================
  // HELPERS
  // ====================================================================

  /** Extracts model key from ID, e.g. 'local/phi-3.5-mini' -> 'phi-3.5-mini' */
  function extractModelKey(modelId) {
    return modelId.replace(/^local\//, "");
  }

  /** Builds standardised response object matching cloud response shape. */
  function buildResponse(
    text,
    html,
    modelId,
    tokenCount,
    tokensPerSecond,
    processingTime
  ) {
    return {
      text: text,
      html: html,
      markdown: text,
      raw: {
        choices: [
          {
            message: { content: text },
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: tokenCount,
          total_tokens: tokenCount,
        },
        model: modelId,
      },
      metadata: {
        model: modelId,
        tokens: {
          prompt: 0,
          completion: tokenCount,
          total: tokenCount,
        },
        processingTime: processingTime,
        local: true,
        tokensPerSecond: tokensPerSecond,
      },
    };
  }

  /** Renders markdown to HTML via the embed instance, with fallback. */
  function renderMarkdown(embed, text) {
    if (embed && typeof embed.processMarkdownWithFallback === "function") {
      return embed.processMarkdownWithFallback(text);
    }
    // Minimal fallback -- wrap in a paragraph
    return "<p>" + text.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</p>";
  }

  /** Safely emits an event on the embed instance. */
  function emitEvent(embed, event, data) {
    if (embed && typeof embed._emitEvent === "function") {
      try {
        embed._emitEvent(event, data);
      } catch (err) {
        logDebug("Event emission failed for", event, ":", err.message || err);
      }
    }
  }

  /** Announces a message to screen readers via the embed instance. */
  function announce(embed, message) {
    if (embed && typeof embed.announceToScreenReader === "function") {
      embed.announceToScreenReader(message);
    }
  }

  /** Shows a notification via the embed instance. */
  function notify(embed, message, type) {
    if (embed && embed.showNotifications && embed.notifications) {
      const fn = embed.notifications[type];
      if (typeof fn === "function") {
        fn(message);
      }
    }
  }

  /** Builds OpenAI-compatible messages array for WebLLM handlers. */
  function buildMessagesArray(embed, opts) {
    const messages = [];
    const systemPrompt = embed.systemPrompt || null;
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    // Use pre-built messages if available, otherwise wrap userPrompt
    if (opts.messages && Array.isArray(opts.messages)) {
      // If messages already includes a system message, don't duplicate
      const hasSystem = opts.messages.some(function (m) {
        return m.role === "system";
      });
      if (hasSystem) {
        return opts.messages;
      }
      return messages.concat(opts.messages);
    }
    const userContent = opts.userPrompt || "";
    if (userContent) {
      messages.push({ role: "user", content: userContent });
    }
    return messages;
  }

  // ====================================================================
  // VALIDATION
  // ====================================================================

  /** Validates engine availability and model existence. Returns { modelKey, modelDef, engine, gateway, registry }. */
  function validateRequest(modelId) {
    const reg = window.LocalTextModelRegistry;
    if (!reg) {
      throw new Error(
        "Local model backend requires LocalTextModelRegistry. " +
          "Ensure local-text-model-registry.js is loaded."
      );
    }

    const modelKey = extractModelKey(modelId);
    const modelDef = reg.getModel(modelKey);

    if (!modelDef) {
      const available = reg
        .getEnabled()
        .map(function (m) {
          return m.localModelId;
        })
        .join(", ");
      throw new Error(
        "Unknown local model: " +
          modelId +
          ". Available models: " +
          available
      );
    }

    const engine = modelDef.engine || "onnx";

    // Validate the correct engine is available
    if (engine === "webllm") {
      if (!window.WebLLMTextEngine) {
        throw new Error(
          "WebLLM engine required for " + modelId + ". " +
            "Ensure webllm-text-engine.js is loaded."
        );
      }
    } else {
      // ONNX (default)
      if (!window.LocalTextModelGateway) {
        throw new Error(
          "Local model backend requires LocalTextModelGateway. " +
            "Ensure local-text-model-gateway.js is loaded."
        );
      }
    }

    return {
      modelKey: modelKey,
      modelDef: modelDef,
      engine: engine,
      gateway: window.LocalTextModelGateway || null,
      registry: reg,
    };
  }

  /** Checks model readiness by engine type. Throws if not usable. */
  async function checkModelReadiness(validated) {
    const modelKey = validated.modelKey;
    const modelDef = validated.modelDef;
    const engine = validated.engine;
    const displayName =
      modelDef.userInfo ? modelDef.userInfo.displayName : modelKey;

    if (engine === "webllm") {
      // WebLLM readiness: check loaded state, then cache
      const webllm = window.WebLLMTextEngine;

      if (webllm.isModelLoaded()) {
        // A model is loaded -- check it's the right one
        const loadedId = webllm.getLoadedModelId();
        if (loadedId === modelDef.mlcModelId) {
          logDebug("WebLLM model already loaded:", modelDef.mlcModelId);
          return;
        }
        // Different model loaded -- auto-load will handle swap
      }

      // Not loaded -- check if cached
      const isCached = await webllm.isModelCached(modelDef.mlcModelId);
      if (isCached) {
        logInfo("WebLLM model cached but not loaded -- will auto-load:", modelKey);
        return; // handleRequest will auto-load
      }

      // Not cached -- user needs to download first
      throw new Error(
        displayName +
          " has not been downloaded yet. " +
          "Open Set Up to download it before use."
      );
    } else {
      // ONNX readiness (existing logic)
      const gateway = validated.gateway;
      let status = gateway.getModelStatus(modelKey);

      if (status === "not-downloaded") {
        const isCached = await gateway.isModelCached(modelKey);
        if (isCached) {
          status = "cached";
        }
      }

      if (status === "not-downloaded") {
        throw new Error(
          displayName +
            " has not been downloaded yet. " +
            "Open the Model Manager to download it before use."
        );
      }

      if (status === "downloading" || status === "loading") {
        throw new Error(
          displayName +
            " is currently loading. Please wait and try again."
        );
      }

      logDebug("ONNX model", modelKey, "is ready (status:", status + ")");
    }
  }

  // ====================================================================
  // ONNX HANDLERS
  // ====================================================================

  /** ONNX streaming handler -- throttled UI updates via gateway. */
  async function handleONNXStreaming(embed, options, modelKey, gateway) {
    embed.isStreaming = true;

    let streamBuffer = "";
    let lastRenderTime = 0;
    let charsSinceRender = 0;
    const startTime = performance.now();

    const prompt = options.messages || options.userPrompt;
    const result = await gateway.generateStreaming(modelKey, prompt, {
      maxTokens: embed.max_tokens || 512,
      temperature: embed.temperature !== undefined ? embed.temperature : 0.7,
      systemPrompt: embed.systemPrompt || null,
      onToken: function (token) {
        streamBuffer += token.text;
        charsSinceRender += token.text.length;

        const now = performance.now();
        if (
          now - lastRenderTime >= RENDER_THROTTLE_MS ||
          charsSinceRender >= RENDER_CHAR_THRESHOLD
        ) {
          lastRenderTime = now;
          charsSinceRender = 0;

          const html = renderMarkdown(embed, streamBuffer);
          if (embed.container) {
            embed.container.innerHTML = html;
          }
        }

        if (typeof options.onChunk === "function") {
          options.onChunk({ text: token.text });
        }
      },
    });

    embed.isStreaming = false;

    if (result.status === "error") {
      throw new Error(result.error);
    }

    const processingTime = performance.now() - startTime;

    const finalHtml = renderMarkdown(embed, result.text);
    if (embed.container) {
      embed.container.innerHTML = finalHtml;
    }

    const response = buildResponse(
      result.text,
      finalHtml,
      embed.model,
      result.tokenCount,
      result.tokensPerSecond,
      Math.round(processingTime)
    );

    if (typeof options.onComplete === "function") {
      options.onComplete(response);
    }

    return response;
  }

  /** ONNX non-streaming handler -- single-shot generation via gateway. */
  async function handleONNXNonStreaming(embed, options, modelKey, gateway) {
    const startTime = performance.now();

    const prompt = options.messages || options.userPrompt;
    const result = await gateway.generate(modelKey, prompt, {
      maxTokens: embed.max_tokens || 512,
      temperature: embed.temperature !== undefined ? embed.temperature : 0.7,
      systemPrompt: embed.systemPrompt || null,
    });

    if (result.status === "error") {
      throw new Error(result.error);
    }

    const processingTime = performance.now() - startTime;

    const html = renderMarkdown(embed, result.text);
    if (embed.container) {
      embed.container.innerHTML = html;
    }

    const response = buildResponse(
      result.text,
      html,
      embed.model,
      result.tokenCount,
      result.tokensPerSecond,
      Math.round(processingTime)
    );

    if (typeof options.onComplete === "function") {
      options.onComplete(response);
    }

    return response;
  }

  // ====================================================================
  // WEBLLM HANDLERS
  // ====================================================================

  /** WebLLM streaming handler -- throttled UI updates via engine. */
  async function handleWebLLMStreaming(embed, options, modelKey, modelDef) {
    embed.isStreaming = true;

    let streamBuffer = "";
    let lastRenderTime = 0;
    let charsSinceRender = 0;
    const startTime = performance.now();

    const messages = buildMessagesArray(embed, options);
    const webllm = window.WebLLMTextEngine;

    const result = await webllm.generateStreaming(messages, {
      maxTokens: embed.max_tokens || 512,
      temperature: embed.temperature !== undefined ? embed.temperature : 0.7,
      onToken: function (token) {
        streamBuffer += token.text;
        charsSinceRender += token.text.length;

        const now = performance.now();
        if (
          now - lastRenderTime >= RENDER_THROTTLE_MS ||
          charsSinceRender >= RENDER_CHAR_THRESHOLD
        ) {
          lastRenderTime = now;
          charsSinceRender = 0;

          const html = renderMarkdown(embed, streamBuffer);
          if (embed.container) {
            embed.container.innerHTML = html;
          }
        }

        if (typeof options.onChunk === "function") {
          options.onChunk({ text: token.text });
        }
      },
    });

    embed.isStreaming = false;

    if (result.status === "error") {
      throw new Error(result.error);
    }

    const processingTime = performance.now() - startTime;

    const finalHtml = renderMarkdown(embed, result.text);
    if (embed.container) {
      embed.container.innerHTML = finalHtml;
    }

    const response = buildResponse(
      result.text,
      finalHtml,
      embed.model,
      result.tokenCount,
      result.tokensPerSecond,
      Math.round(processingTime)
    );

    if (typeof options.onComplete === "function") {
      options.onComplete(response);
    }

    return response;
  }

  /** WebLLM non-streaming handler -- single-shot generation via engine. */
  async function handleWebLLMNonStreaming(embed, options, modelKey, modelDef) {
    const startTime = performance.now();

    const messages = buildMessagesArray(embed, options);
    const webllm = window.WebLLMTextEngine;

    const result = await webllm.generate(messages, {
      maxTokens: embed.max_tokens || 512,
      temperature: embed.temperature !== undefined ? embed.temperature : 0.7,
    });

    if (result.status === "error") {
      throw new Error(result.error);
    }

    const processingTime = performance.now() - startTime;

    const html = renderMarkdown(embed, result.text);
    if (embed.container) {
      embed.container.innerHTML = html;
    }

    const response = buildResponse(
      result.text,
      html,
      embed.model,
      result.tokenCount,
      result.tokensPerSecond,
      Math.round(processingTime)
    );

    if (typeof options.onComplete === "function") {
      options.onComplete(response);
    }

    return response;
  }

  /** Ensures WebLLM model is loaded into GPU; auto-loads from cache if needed. */
  async function ensureWebLLMModelLoaded(modelKey, modelDef) {
    const webllm = window.WebLLMTextEngine;

    // Already loaded with the correct model?
    if (webllm.isModelLoaded()) {
      const loadedId = webllm.getLoadedModelId();
      if (loadedId === modelDef.mlcModelId) {
        logDebug("WebLLM model already loaded -- skipping auto-load");
        return;
      }
    }

    // Use the Text Model Manager for state-aware loading if available
    const manager = window.LocalTextModelManager;
    if (manager) {
      logInfo("Auto-loading WebLLM model via manager:", modelKey);
      await manager.loadModel(modelKey);
    } else {
      // Fallback: load directly via engine
      logInfo("Auto-loading WebLLM model directly:", modelDef.mlcModelId);
      await webllm.loadModel(modelDef.mlcModelId);
    }

    logInfo("WebLLM model auto-loaded successfully:", modelKey);
  }

  // ====================================================================
  // PUBLIC API
  // ====================================================================

  /** Returns true if the model ID starts with 'local/'. */
  function isLocalModel(modelId) {
    return typeof modelId === "string" && modelId.startsWith("local/");
  }

  /** Main entry point -- routes to ONNX or WebLLM based on registry engine field. */
  async function handleRequest(embed, options) {
    const opts = options || {};

    // 1. Validate registry, engine availability, and model
    const validated = validateRequest(embed.model);

    // 2. Check model readiness (downloaded/cached)
    await checkModelReadiness(validated);

    // 3. Set embed state
    embed.processing = true;
    embed.lastError = null;

    // 4. Emit beforeRequest event
    emitEvent(embed, "beforeRequest", {
      model: embed.model,
      local: true,
      engine: validated.engine,
    });

    // 5. Announce to screen reader
    announce(embed, "Processing request with local model");

    // 6. Show notification
    notify(embed, "Processing with local model\u2026", "info");

    try {
      let response;

      if (validated.engine === "webllm") {
        // ── WebLLM flow ──────────────────────────────────────
        // Ensure model is loaded into GPU (auto-load if cached)
        await ensureWebLLMModelLoaded(validated.modelKey, validated.modelDef);

        // Route to streaming or non-streaming
        if (
          typeof embed.prefersReducedMotion === "function" &&
          embed.prefersReducedMotion()
        ) {
          logInfo("Reduced motion preferred -- using non-streaming WebLLM generation");
          response = await handleWebLLMNonStreaming(
            embed,
            opts,
            validated.modelKey,
            validated.modelDef
          );
        } else {
          response = await handleWebLLMStreaming(
            embed,
            opts,
            validated.modelKey,
            validated.modelDef
          );
        }
      } else {
        // ── ONNX flow (existing, unchanged) ──────────────────
        if (
          typeof embed.prefersReducedMotion === "function" &&
          embed.prefersReducedMotion()
        ) {
          logInfo("Reduced motion preferred -- using non-streaming generation");
          response = await handleONNXNonStreaming(
            embed,
            opts,
            validated.modelKey,
            validated.gateway
          );
        } else {
          response = await handleONNXStreaming(
            embed,
            opts,
            validated.modelKey,
            validated.gateway
          );
        }
      }

      // 8. Success: update embed state
      embed.lastResponse = response;
      embed.processing = false;

      // 9. Emit afterRequest event
      emitEvent(embed, "afterRequest", {
        model: embed.model,
        local: true,
        engine: validated.engine,
        response: response,
      });

      // 10. Announce completion
      announce(embed, "Response complete");
      notify(embed, "Local model response complete", "success");

      return response;
    } catch (error) {
      // Error path
      embed.lastError = error;
      embed.processing = false;
      embed.isStreaming = false;

      logError("Local request failed:", error.message || error);

      if (typeof opts.onError === "function") {
        opts.onError(error);
      }

      announce(embed, "Error: " + error.message);
      notify(embed, "Local model error: " + error.message, "error");

      throw error;
    }
  }

  /** Returns available local models with engine field for caller dispatch. */
  function getAvailableModels() {
    const reg = window.LocalTextModelRegistry;
    if (!reg) {
      logWarn("LocalTextModelRegistry not available");
      return [];
    }

    return reg.getEnabled().map(function (model) {
      return {
        id: model.localModelId,
        name: model.userInfo ? model.userInfo.displayName : model.key,
        engine: model.engine || "onnx",
        vramMB: model.userInfo ? model.userInfo.downloadSizeMB : 0,
        userInfo: model.userInfo || null,
      };
    });
  }

  // ====================================================================
  // INITIALISATION
  // ====================================================================

  logInfo("Embed Local Backend initialised (dual-engine dispatch)");

  // ====================================================================
  // RETURN PUBLIC API
  // ====================================================================

  return {
    isLocalModel: isLocalModel,
    handleRequest: handleRequest,
    getAvailableModels: getAvailableModels,
  };
})();

// Expose singleton on window
window.EmbedLocalBackend = window.EmbedLocalBackendClass;
