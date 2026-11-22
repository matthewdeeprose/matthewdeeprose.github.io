/**
 * OpenRouter Embed API - Foundry FLUX.2 image provider (FI-3)
 *
 * Makes an image from a prompt, with or without reference pictures, through the Foundry
 * proxy's FLUX route (POST <proxy base>/flux/v1/flux-2-pro | flux-2-flex). Self-registers
 * with `window.EmbedProviderRegistry`.
 *
 * The Make an image tool reaches this through the image module (FI-6). It is not a chat
 * provider: FLUX ids never enter `modelRegistry` and no chat list can reach it, which is why
 * no reserved prefix is added elsewhere.
 *
 * The proxy base is BORROWED from the registered `azure-openai` provider's endpoint() URL
 * and only if that URL still ends in the chat suffix; otherwise requestImage refuses.
 * The token rides as `x-user-token`, as the proxy expects.
 *
 * @version 1.1.0 (FI-FOLD)
 * @date 21 November 2026
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
      console.error(`[EmbedFoundryFluxProvider ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedFoundryFluxProvider WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedFoundryFluxProvider INFO] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const PROVIDER_ID = "foundry-flux";
  // The chat provider whose endpoint() URL the proxy base is borrowed from.
  const FOUNDRY_CHAT_PROVIDER_ID = "azure-openai";
  const FOUNDRY_CHAT_SUFFIX = "/openai/v1/chat/completions";
  const TOKEN_HEADER = "x-user-token";
  // The EntraAuth scope name; the same value the chat provider and TikZ Studio use.
  const ENTRA_SCOPE_NAME = "foundry";
  const TOKEN_REJECTED_EVENT = "entra:token-rejected";
  const HTTP_UNAUTHORISED = 401;
  const OUTPUT_FORMAT = "png";
  const OUTPUT_MIME_TYPE = "image/png";
  const IMAGES_PER_REQUEST = 1;
  // Longer than the one 117 s cold reply measured in FI-1.
  const CLIENT_TIMEOUT_MS = 330000;
  // Microsoft documents the first reference as `input_image` and later ones as
  // `input_image_2`, `input_image_3` and so on.
  const REFERENCE_FIELD = "input_image";

  const SHAPES = Object.freeze({
    square: Object.freeze({ id: "square", width: 1024, height: 1024 }),
    "landscape-4-3": Object.freeze({ id: "landscape-4-3", width: 1024, height: 768 }),
    "portrait-3-4": Object.freeze({ id: "portrait-3-4", width: 768, height: 1024 }),
    "wide-16-9": Object.freeze({ id: "wide-16-9", width: 1024, height: 576 }),
  });

  // referenceLimit: flex 2 is MEASURED (FI-3 arm E2: both pictures showed in the result;
  // more than 2 was not tried). pro 3 is MEASURED (FI-M1 B1 and B2, 21 November 2026: with two
  // and with three pictures, every picture showed in the result). The ceiling was NOT found:
  // the measurement stopped at 3. Microsoft documents up to 8 for pro and 10 for flex.
  const MODELS = Object.freeze([
    Object.freeze({
      id: "FLUX.2-pro",
      displayName: "FLUX.2 [pro]",
      routePath: "/flux/v1/flux-2-pro",
      referenceLimit: 3,
    }),
    Object.freeze({
      id: "FLUX.2-flex",
      displayName: "FLUX.2 [flex]",
      routePath: "/flux/v1/flux-2-flex",
      referenceLimit: 2,
    }),
  ]);

  const MESSAGES = Object.freeze({
    NOT_STREAMED: "FLUX replies are not streamed",
    NOT_SIGNED_IN:
      "You are not signed in to Foundry, so no image was made. Sign in on the Set Up page, then try again.",
    PROXY_SHAPE_CHANGED: "proxy URL shape changed; refusing rather than guessing",
  });

  // ============================================================================
  // HELPERS
  // ============================================================================

  function findModel(id) {
    return MODELS.find((m) => m.id === id) || null;
  }

  function fail(extra) {
    return Object.assign(
      {
        ok: false,
        provider: PROVIDER_ID,
        model: null,
        images: [],
        skipped: 0,
        status: null,
        ms: 0,
        error: "",
      },
      extra
    );
  }

  /** Reference pictures as raw base64 (arm E1: raw base64 is accepted; a data: prefix is cut off). */
  function toRawBase64(reference) {
    if (typeof reference !== "string") return "";
    const commaAt = reference.indexOf(",");
    return /^data:/i.test(reference) && commaAt >= 0
      ? reference.slice(commaAt + 1)
      : reference;
  }

  function referenceList(reference) {
    if (reference === undefined || reference === null || reference === "") return [];
    const list = Array.isArray(reference) ? reference : [reference];
    return list.map(toRawBase64).filter((r) => r !== "");
  }

  function referenceFieldName(index) {
    return index === 0 ? REFERENCE_FIELD : `${REFERENCE_FIELD}_${index + 1}`;
  }

  /** The caller's signal and a timeout, combined. */
  function combinedSignal(callerSignal, timeoutMs) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) abort();
      else callerSignal.addEventListener("abort", abort, { once: true });
    }
    const timer = setTimeout(abort, timeoutMs);
    return {
      signal: controller.signal,
      done() {
        clearTimeout(timer);
        if (callerSignal) callerSignal.removeEventListener("abort", abort);
      },
    };
  }

  // ============================================================================
  // PROVIDER
  // ============================================================================

  const provider = {
    id: PROVIDER_ID,
    models: MODELS,
    shapes: SHAPES,

    /**
     * @param {Array} _messages - unused: FLUX takes a prompt, not a chat
     * @param {{model: string, prompt: string, shapeId?: string, reference?: string|string[]}} options
     * @returns {Object} the FLUX request body
     */
    buildRequest(_messages, options) {
      const opts = options || {};
      const shape = SHAPES[opts.shapeId === undefined ? "square" : opts.shapeId];
      if (!shape) throw new Error(`Unknown shape "${opts.shapeId}"`);

      const body = {
        model: opts.model,
        prompt: opts.prompt,
        width: shape.width,
        height: shape.height,
        output_format: OUTPUT_FORMAT,
        num_images: IMAGES_PER_REQUEST,
      };
      // input_image is present ONLY when a reference is given.
      referenceList(opts.reference).forEach((raw, index) => {
        body[referenceFieldName(index)] = raw;
      });
      return body;
    },

    /**
     * The route URL and headers. Lifts the proxy base from the azure-openai provider,
     * guarded: refuses rather than guessing when the URL shape has changed.
     */
    endpoint(model) {
      const entry = findModel(model);
      if (!entry) throw new Error(`Model "${model}" is not a FLUX model`);

      const registry = window.EmbedProviderRegistry;
      const chat =
        registry && typeof registry.get === "function"
          ? registry.get(FOUNDRY_CHAT_PROVIDER_ID)
          : null;
      if (!chat || typeof chat.endpoint !== "function") {
        throw new Error(
          `The "${FOUNDRY_CHAT_PROVIDER_ID}" provider is not registered; ${MESSAGES.PROXY_SHAPE_CHANGED}.`
        );
      }

      const chatEndpoint = chat.endpoint(model, {});
      const chatUrl = chatEndpoint && chatEndpoint.url;
      if (
        typeof chatUrl !== "string" ||
        chatUrl.length <= FOUNDRY_CHAT_SUFFIX.length ||
        chatUrl.slice(-FOUNDRY_CHAT_SUFFIX.length) !== FOUNDRY_CHAT_SUFFIX
      ) {
        throw new Error(MESSAGES.PROXY_SHAPE_CHANGED);
      }

      const base = chatUrl.slice(0, -FOUNDRY_CHAT_SUFFIX.length);
      const token = chatEndpoint.headers && chatEndpoint.headers[TOKEN_HEADER];
      const headers = { "Content-Type": "application/json" };
      if (token) headers[TOKEN_HEADER] = token;
      return { url: base + entry.routePath, headers };
    },

    parseStreamChunk() {
      throw new Error(MESSAGES.NOT_STREAMED);
    },

    parseResponse(json) {
      const core = window.ModalityCore;
      if (!core || typeof core.normaliseImagesReply !== "function") {
        throw new Error("ModalityCore.normaliseImagesReply is not available");
      }
      return core.normaliseImagesReply(json, { mimeType: OUTPUT_MIME_TYPE });
    },

    capabilities: {
      images: true,
      streaming: false,
      pdf: false,
      reasoning: false,
      toolCalls: false,
    },

    /**
     * Make one image. NEVER REJECTS. No retry, no other model, no other provider.
     *
     * @param {{model: string, prompt: string, shapeId?: string,
     *          reference?: string|string[], signal?: AbortSignal}} request
     * @returns {Promise<{ok: boolean, provider: string, model: string, images: Object[],
     *          skipped: number, status: number|null, ms: number, error: string}>}
     */
    async requestImage(request) {
      const req = request || {};
      const started = Date.now();
      const base = { model: req.model || null };

      const entry = findModel(req.model);
      if (!entry) {
        return fail({
          ...base,
          error: `Model "${req.model}" is not on the FLUX list. One of: ${MODELS.map((m) => m.id).join(", ")}.`,
        });
      }
      const shapeId = req.shapeId === undefined ? "square" : req.shapeId;
      if (!Object.prototype.hasOwnProperty.call(SHAPES, shapeId)) {
        return fail({
          ...base,
          error: `Shape "${shapeId}" is not known. One of: ${Object.keys(SHAPES).join(", ")}.`,
        });
      }
      if (typeof req.prompt !== "string" || req.prompt.trim() === "") {
        return fail({ ...base, error: "A prompt is needed, so no image was made." });
      }
      const refs = referenceList(req.reference);
      if (refs.length > entry.referenceLimit) {
        return fail({
          ...base,
          error: `${entry.displayName} takes at most ${entry.referenceLimit} reference picture(s); got ${refs.length}. No image was made.`,
        });
      }

      const entra = window.EntraAuth;
      if (entra && typeof entra.isSignedIn === "function" && entra.isSignedIn() !== true) {
        return fail({ ...base, error: MESSAGES.NOT_SIGNED_IN });
      }

      let timing = null;
      try {
        if (entra && typeof entra.ensureFresh === "function") await entra.ensureFresh(ENTRA_SCOPE_NAME);

        const target = provider.endpoint(entry.id);
        const body = provider.buildRequest([], {
          model: entry.id,
          prompt: req.prompt,
          shapeId,
          reference: req.reference,
        });

        timing = combinedSignal(req.signal, CLIENT_TIMEOUT_MS);
        const res = await window.fetch(target.url, {
          method: "POST",
          headers: target.headers,
          body: JSON.stringify(body),
          signal: timing.signal,
        });
        const text = await res.text();
        const ms = Date.now() - started;

        if (!res.ok) {
          // Same rule as the chat provider: only a 401 on a request that carried a token.
          if (res.status === HTTP_UNAUTHORISED && target.headers && target.headers[TOKEN_HEADER]) {
            window.dispatchEvent(new CustomEvent(TOKEN_REJECTED_EVENT));
          }
          return fail({
            ...base,
            status: res.status,
            ms,
            error: `HTTP ${res.status}: ${text.slice(0, 500)}`,
          });
        }

        let json = null;
        try {
          json = JSON.parse(text);
        } catch (parseError) {
          return fail({ ...base, status: res.status, ms, error: "The reply was not JSON." });
        }
        const result = provider.parseResponse(json);
        return {
          ok: result.images.length > 0,
          provider: PROVIDER_ID,
          model: entry.id,
          images: result.images,
          skipped: result.skipped,
          status: res.status,
          ms,
          error: result.images.length > 0 ? "" : "The reply held no image.",
        };
      } catch (error) {
        logWarn("requestImage failed:", error);
        return fail({
          ...base,
          ms: Date.now() - started,
          error: (error && error.message) || String(error),
        });
      } finally {
        if (timing) timing.done();
      }
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
      logInfo("Foundry FLUX provider registered with EmbedProviderRegistry");
    } catch (error) {
      logError("Failed to register Foundry FLUX provider:", error);
    }
  } else {
    logError(
      "EmbedProviderRegistry not available — script load order issue. " +
        "providers/_interface.js must load before providers/foundry-flux.js."
    );
  }
})();
