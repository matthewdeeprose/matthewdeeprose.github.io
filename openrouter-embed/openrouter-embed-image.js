/**
 * OpenRouter Embed API - image module (FI-5)
 *
 * One `generate()` for both image providers, reading the Set Up switch:
 *   - OpenRouter: exactly ONE direct request to the chat-completions road. No retry, no
 *     fallback model, no cache, no announcement. It deliberately does NOT use the shared
 *     OpenRouter client or request handler, which re-send a failed request to `fallbackTo`,
 *     return cached replies and announce by themselves.
 *   - Microsoft Foundry: delegates to the registered `foundry-flux` provider.
 *
 * The Make an image tool calls this (FI-6). It has no DOM, no announcements and no notify*():
 * the caller owns every word the person sees. Every global is resolved at call time, so script
 * load order only matters when a function is CALLED.
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
      console.error(`[EmbedImage ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedImage WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedImage INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedImage DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const PROVIDER = Object.freeze({
    OPENROUTER: "openrouter",
    FOUNDRY: "azure-openai",
  });
  const FLUX_PROVIDER_ID = "foundry-flux";

  const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
  const OPENROUTER_TITLE = "Accessibility Tools MVP";
  const API_KEY_STORAGE_KEY = "openrouter_api_key";
  const CLIENT_TIMEOUT_MS = 300000;

  const IMAGE_MODALITY = "image";
  const DEFAULT_MIME_TYPE = "image/png";
  const MAX_REFERENCE_PIXELS = 1000000;
  const OPENROUTER_REFERENCE_LIMIT = 1;
  const ERROR_TEXT_CHARS = 500;

  const STYLE_BASE_PATH = "openrouter-embed/prompts/image/";
  const STYLE_NAME_PREFIX = "EMBED_IMAGE_STYLE_";
  const NO_STYLE_ID = "none";

  const STYLES = Object.freeze([
    Object.freeze({ id: NO_STYLE_ID, label: "No style" }),
    Object.freeze({ id: "photo", label: "Photograph" }),
    Object.freeze({ id: "line-diagram", label: "Line diagram" }),
    Object.freeze({ id: "flat-illustration", label: "Flat illustration" }),
    Object.freeze({ id: "3d-render", label: "3D render" }),
    Object.freeze({ id: "infographic", label: "Infographic" }),
    Object.freeze({ id: "watercolour", label: "Watercolour" }),
  ]);

  // aspectRatio is what OpenRouter's image_config takes; null for square (never sent).
  const SHAPES = Object.freeze({
    square: Object.freeze({ id: "square", aspectRatio: null }),
    "landscape-4-3": Object.freeze({ id: "landscape-4-3", aspectRatio: "4:3" }),
    "portrait-3-4": Object.freeze({ id: "portrait-3-4", aspectRatio: "3:4" }),
    "wide-16-9": Object.freeze({ id: "wide-16-9", aspectRatio: "16:9" }),
  });
  const DEFAULT_SHAPE_ID = "square";

  // What was MEASURED, per OpenRouter model, from live sends (FI-5 arm E). A model with no
  // entry here has not been measured: no price estimate, no reference picture, and only the
  // square shape. Never fill this from documentation.
  //   usdPerImage      : the charge `usage.cost` reported for one image
  //   measuredOn       : the date of the send
  //   acceptsReference : a reference picture was sent and the result followed it
  //   shapes           : non-square shape ids whose result matched the asked ratio
  // FI-5 arm E, 20 November 2026, 7 live sends from Node. `acceptsReference: false` means NOT
  // MEASURED, not "refused". `shapes: []` for gpt-5-image-mini is measured: it returned 1024x1024
  // for 4:3, 3:4 and 16:9 asks. google/gemini-3.1-flash-lite-image returned 1408x768 for a plain
  // square ask (no image_config sent), so "square" is not guaranteed for it.
  // FI-M1, 21 November 2026, live sends from Node: five more Gemini rows. "Matched" means the
  // result's shape was within 2% of the asked ratio. Four of the five Gemini models measured here
  // returned about 16:9 for a SQUARE ask, so a 16:9 match is weak evidence on its own: it is listed only
  // where the 16:9 result was also a different size from the square one.
  // gemini-nano-banana-2.1 has `shapes: []` by ruling: its 16:9 result was the same size as its
  // square result, so the ask changed nothing. gemini-3.1-flash-image's 16:9 is one send each
  // (weak). openai/gpt-5-image has NO row: it answered with an error and returned no image.
  const MEASURED = Object.freeze({
    "openai/gpt-5-image-mini": Object.freeze({
      usdPerImage: 0.0411,
      measuredOn: "2026-11-20",
      acceptsReference: true,
      shapes: Object.freeze([]),
    }),
    "openai/gpt-5.4-image-2": Object.freeze({
      usdPerImage: 0.2247,
      measuredOn: "2026-11-20",
      acceptsReference: false,
      shapes: Object.freeze([]),
    }),
    "google/gemini-3.1-flash-lite-image": Object.freeze({
      usdPerImage: 0.0336,
      measuredOn: "2026-11-20",
      acceptsReference: false,
      shapes: Object.freeze([]),
    }),
    "google/gemini-2.5-flash-image": Object.freeze({
      usdPerImage: 0.0387,
      measuredOn: "2026-11-21",
      acceptsReference: true,
      shapes: Object.freeze(["wide-16-9"]),
    }),
    "google/gemini-nano-banana-2.1": Object.freeze({
      usdPerImage: 0.0354,
      measuredOn: "2026-11-21",
      acceptsReference: true,
      shapes: Object.freeze([]),
    }),
    "google/gemini-3.1-flash-image": Object.freeze({
      usdPerImage: 0.0672,
      measuredOn: "2026-11-21",
      acceptsReference: true,
      shapes: Object.freeze(["wide-16-9"]),
    }),
    "google/gemini-3.1-flash-image-preview": Object.freeze({
      usdPerImage: 0.0682,
      measuredOn: "2026-11-21",
      acceptsReference: false,
      shapes: Object.freeze([]),
    }),
    "google/gemini-3-pro-image": Object.freeze({
      usdPerImage: 0.1361,
      measuredOn: "2026-11-21",
      acceptsReference: false,
      shapes: Object.freeze([]),
    }),
  });

  const MESSAGES = Object.freeze({
    NO_KEY:
      "No OpenRouter key is saved, so no image was made. Add your key on the Set Up page, then try again.",
    NO_PROVIDER: "The provider switch is not available, so no image was made.",
    NEED_PROMPT: "A prompt is needed, so no image was made.",
    NO_IMAGE: "The reply held no image.",
    // FI-FOLD: a provider error carried inside an HTTP 200 (FI-M1: openai/gpt-5-image, code 502).
    // The provider's own message text is deliberately not shown.
    PROVIDER_ERROR: (code) =>
      `The provider could not make an image with this model (error ${code}). Try another model.`,
    NOT_JSON: "The reply was not JSON.",
    STYLES_FAILED: "The style wording could not be loaded, so no image was made.",
  });

  // ============================================================================
  // HELPERS
  // ============================================================================

  function fail(extra) {
    return Object.assign(
      {
        ok: false,
        provider: null,
        model: null,
        images: [],
        skipped: 0,
        promptSent: "",
        cost: null,
        status: null,
        ms: 0,
        error: "",
      },
      extra
    );
  }

  function activeProvider() {
    const switcher = window.ProviderSwitcher;
    if (!switcher || typeof switcher.getActive !== "function") return null;
    return switcher.getActive();
  }

  function registryEntries() {
    const registry = window.modelRegistry;
    if (!registry || typeof registry.getAllModels !== "function") return [];
    return registry.getAllModels();
  }

  function fluxProvider() {
    const registry = window.EmbedProviderRegistry;
    if (!registry || typeof registry.get !== "function") return null;
    return registry.get(FLUX_PROVIDER_ID) || null;
  }

  function measuredFor(id) {
    return Object.prototype.hasOwnProperty.call(MEASURED, id) ? MEASURED[id] : null;
  }

  function openRouterImageEntries() {
    const core = window.ModalityCore;
    if (!core || typeof core.canOutput !== "function") return [];
    return registryEntries().filter(
      (entry) => entry && !entry.disabled && core.canOutput(entry, IMAGE_MODALITY)
    );
  }

  function listForOpenRouter() {
    return openRouterImageEntries().map((entry) => {
      const measured = measuredFor(entry.id);
      return {
        id: entry.id,
        displayName: entry.name || entry.displayName || entry.id,
        provider: PROVIDER.OPENROUTER,
        acceptsReference: !!(measured && measured.acceptsReference === true),
        referenceLimit:
          measured && measured.acceptsReference === true ? OPENROUTER_REFERENCE_LIMIT : 0,
        shapes: [DEFAULT_SHAPE_ID].concat((measured && measured.shapes) || []),
        estimate: measured
          ? { usdPerImage: measured.usdPerImage, measuredOn: measured.measuredOn }
          : null,
      };
    });
  }

  function listForFoundry() {
    const flux = fluxProvider();
    if (!flux || !Array.isArray(flux.models)) return [];
    const shapeIds = flux.shapes ? Object.keys(flux.shapes) : [DEFAULT_SHAPE_ID];
    return flux.models.map((model) => ({
      id: model.id,
      displayName: model.displayName || model.id,
      provider: PROVIDER.FOUNDRY,
      acceptsReference: model.referenceLimit > 0,
      referenceLimit: model.referenceLimit,
      shapes: shapeIds.slice(),
      estimate: null,
    }));
  }

  function listFor(provider) {
    if (provider === PROVIDER.OPENROUTER) return listForOpenRouter();
    if (provider === PROVIDER.FOUNDRY) return listForFoundry();
    return [];
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
  // STYLES (own prompt-loader instance, never the shared singleton)
  // ============================================================================

  let styleLoader = null;
  let styleLoadPromise = null;

  function styleName(id) {
    return STYLE_NAME_PREFIX + id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  }

  async function loadStyles() {
    if (styleLoadPromise) return styleLoadPromise;
    styleLoadPromise = (async () => {
      const LoaderClass = window.EmbedPromptLoader;
      if (typeof LoaderClass !== "function") return false;
      const loader = new LoaderClass();
      loader.configure({ basePath: STYLE_BASE_PATH });
      const withFiles = STYLES.filter((style) => style.id !== NO_STYLE_ID);
      const loaded = await Promise.all(
        withFiles.map((style) => loader.load(styleName(style.id), `${style.id}.txt`))
      );
      if (loaded.some((text) => typeof text !== "string" || text.trim() === "")) {
        return false;
      }
      styleLoader = loader;
      return true;
    })();
    const ok = await styleLoadPromise;
    if (!ok) styleLoadPromise = null; // let a later call try again
    return ok;
  }

  function styleSuffix(styleId) {
    if (!styleLoader) return "";
    const text = styleLoader.get(styleName(styleId));
    return typeof text === "string" ? text.trim() : "";
  }

  // ============================================================================
  // REFERENCE PICTURES
  // ============================================================================

  function dataUrlToBlob(dataUrl) {
    const commaAt = dataUrl.indexOf(",");
    const header = dataUrl.slice(0, commaAt);
    const mime = (/^data:([^;,]+)/i.exec(header) || [])[1] || DEFAULT_MIME_TYPE;
    const binary = atob(dataUrl.slice(commaAt + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  const BASE64_CHUNK_BYTES = 0x8000;

  async function blobToDataUrl(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += BASE64_CHUNK_BYTES) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + BASE64_CHUNK_BYTES));
    }
    return `data:${blob.type || DEFAULT_MIME_TYPE};base64,${btoa(binary)}`;
  }

  /**
   * The ONLY place that touches pixels: decode, and if over the cap redraw smaller as PNG.
   * Returns { shrunk: false } when the picture is already within the cap.
   */
  async function shrinkIfLarger(blob, maxPixels) {
    const bitmap = await window.createImageBitmap(blob);
    const pixels = bitmap.width * bitmap.height;
    if (pixels <= maxPixels) {
      if (typeof bitmap.close === "function") bitmap.close();
      return { shrunk: false };
    }
    const scale = Math.sqrt(maxPixels / pixels);
    // Floor, so the result can never land above the cap.
    const width = Math.max(1, Math.floor(bitmap.width * scale));
    const height = Math.max(1, Math.floor(bitmap.height * scale));
    const canvas = new window.OffscreenCanvas(width, height);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    if (typeof bitmap.close === "function") bitmap.close();
    const png = await canvas.convertToBlob({ type: DEFAULT_MIME_TYPE });
    return { shrunk: true, blob: png };
  }

  /**
   * @param {File|Blob|string} input - a File, a Blob or a data URL
   * @param {{maxPixels?: number}} [options] - maxPixels is for tests; the default is the cap
   * @returns {Promise<string>} a data URL, at most `maxPixels` pixels
   */
  async function prepareReference(input, options) {
    const maxPixels =
      options && typeof options.maxPixels === "number" ? options.maxPixels : MAX_REFERENCE_PIXELS;
    const isDataUrl = typeof input === "string" && /^data:/i.test(input);
    if (!isDataUrl && !(input && typeof input === "object" && typeof input.size === "number")) {
      throw new Error("The reference picture must be a File, a Blob or a data URL.");
    }
    const blob = isDataUrl ? dataUrlToBlob(input) : input;
    const result = await shrinkIfLarger(blob, maxPixels);
    if (result.shrunk) return blobToDataUrl(result.blob);
    return isDataUrl ? input : blobToDataUrl(blob);
  }

  // ============================================================================
  // GENERATE
  // ============================================================================

  function buildOpenRouterBody(entry, promptSent, shapeId, referenceUrl, measured) {
    const core = window.ModalityCore;
    const content = referenceUrl
      ? [
          { type: "text", text: promptSent },
          { type: "image_url", image_url: { url: referenceUrl } },
        ]
      : promptSent;
    const body = Object.assign(
      { model: entry.id, messages: [{ role: "user", content }] },
      core.requestAdditions(entry, { wantImage: true }),
      { usage: { include: true } }
    );
    const shape = SHAPES[shapeId];
    const honoured = measured && Array.isArray(measured.shapes) && measured.shapes.includes(shapeId);
    if (shape.aspectRatio && honoured) {
      body.image_config = { aspect_ratio: shape.aspectRatio };
    }
    return body;
  }

  async function sendToOpenRouter(entry, promptSent, shapeId, referenceUrl, signal) {
    const started = Date.now();
    const base = { provider: PROVIDER.OPENROUTER, model: entry.id, promptSent };

    // Read at call time; never printed, never kept.
    const key = window.localStorage && window.localStorage.getItem(API_KEY_STORAGE_KEY);
    if (!key) return fail({ ...base, error: MESSAGES.NO_KEY });

    const body = buildOpenRouterBody(entry, promptSent, shapeId, referenceUrl, measuredFor(entry.id));
    const timing = combinedSignal(signal, CLIENT_TIMEOUT_MS);
    try {
      const res = await window.fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": (window.location && window.location.href) || "",
          "X-Title": OPENROUTER_TITLE,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: timing.signal,
      });
      const text = await res.text();
      const ms = Date.now() - started;

      if (!res.ok) {
        return fail({
          ...base,
          status: res.status,
          ms,
          error: `HTTP ${res.status}: ${text.slice(0, ERROR_TEXT_CHARS)}`,
        });
      }

      let json = null;
      try {
        json = JSON.parse(text);
      } catch (parseError) {
        return fail({ ...base, status: res.status, ms, error: MESSAGES.NOT_JSON });
      }

      const choice = json && json.choices && json.choices[0];
      const message = choice && choice.message;
      const result = window.ModalityCore.normaliseMessage(message);
      const cost = json.usage && typeof json.usage.cost === "number" ? json.usage.cost : null;
      const hasImage = result.images.length > 0;
      const providerError = choice && choice.error && typeof choice.error === "object" ? choice.error : null;
      if (!hasImage && providerError) {
        const code = providerError.code === undefined || providerError.code === null ? "unknown" : providerError.code;
        return fail({
          ...base,
          status: res.status,
          ms,
          cost,
          error: MESSAGES.PROVIDER_ERROR(code),
        });
      }
      return {
        ok: hasImage,
        provider: PROVIDER.OPENROUTER,
        model: entry.id,
        images: result.images,
        skipped: 0,
        promptSent,
        cost,
        status: res.status,
        ms,
        error: hasImage ? "" : result.refusal || MESSAGES.NO_IMAGE,
      };
    } finally {
      timing.done();
    }
  }

  /**
   * Make one image. NEVER REJECTS. No retry, no other model, no other provider.
   *
   * @param {{prompt: string, styleId?: string, shapeId?: string,
   *          reference?: File|Blob|string, model: string, signal?: AbortSignal}} request
   * @returns {Promise<{ok: boolean, provider: string|null, model: string|null, images: Object[],
   *          skipped: number, promptSent: string, cost: number|null, status: number|null,
   *          ms: number, error: string}>}
   */
  async function generate(request) {
    const req = request || {};
    const started = Date.now();
    try {
      // The provider is read ONCE, here.
      const provider = activeProvider();
      if (provider !== PROVIDER.OPENROUTER && provider !== PROVIDER.FOUNDRY) {
        return fail({ model: req.model || null, error: MESSAGES.NO_PROVIDER });
      }
      const base = { provider, model: req.model || null };

      // Never cross the streams: the model must belong to the active provider.
      const entryInfo = listFor(provider).find((m) => m.id === req.model);
      if (!entryInfo) {
        return fail({
          ...base,
          error: `Model "${req.model}" is not an image model for the active provider (${provider}), so no image was made.`,
        });
      }

      if (typeof req.prompt !== "string" || req.prompt.trim() === "") {
        return fail({ ...base, error: MESSAGES.NEED_PROMPT });
      }
      const shapeId = req.shapeId === undefined ? DEFAULT_SHAPE_ID : req.shapeId;
      if (!Object.prototype.hasOwnProperty.call(SHAPES, shapeId)) {
        return fail({
          ...base,
          error: `Shape "${shapeId}" is not known. One of: ${Object.keys(SHAPES).join(", ")}.`,
        });
      }
      const styleId = req.styleId === undefined ? NO_STYLE_ID : req.styleId;
      if (!STYLES.some((style) => style.id === styleId)) {
        return fail({
          ...base,
          error: `Style "${styleId}" is not known. One of: ${STYLES.map((s) => s.id).join(", ")}.`,
        });
      }

      let promptSent = req.prompt;
      if (styleId !== NO_STYLE_ID) {
        if (!(await loadStyles())) return fail({ ...base, error: MESSAGES.STYLES_FAILED });
        promptSent = `${req.prompt} ${styleSuffix(styleId)}`;
      }

      let referenceUrl = null;
      const hasReference = req.reference !== undefined && req.reference !== null && req.reference !== "";
      if (hasReference) {
        if (!entryInfo.acceptsReference) {
          return fail({
            ...base,
            promptSent,
            error: `${entryInfo.displayName} has not been shown to follow a reference picture, so no image was made.`,
          });
        }
        referenceUrl = await prepareReference(req.reference);
      }

      if (provider === PROVIDER.OPENROUTER) {
        const entry = openRouterImageEntries().find((e) => e.id === req.model);
        return await sendToOpenRouter(entry, promptSent, shapeId, referenceUrl, req.signal);
      }

      const flux = fluxProvider();
      if (!flux || typeof flux.requestImage !== "function") {
        return fail({ ...base, promptSent, error: "The Foundry image provider is not loaded, so no image was made." });
      }
      const result = await flux.requestImage({
        model: req.model,
        prompt: promptSent,
        shapeId,
        reference: referenceUrl || undefined,
        signal: req.signal,
      });
      return Object.assign({}, result, { promptSent, cost: null });
    } catch (error) {
      logWarn("generate failed:", error);
      return fail({
        model: req.model || null,
        ms: Date.now() - started,
        error: (error && error.message) || String(error),
      });
    }
  }

  // ============================================================================
  // toFile
  // ============================================================================

  /**
   * @param {{image_url: {url: string}}} image - one entry of a result's `images`
   * @param {string} [filename]
   * @returns {File}
   */
  function toFile(image, filename) {
    const url = image && image.image_url && image.image_url.url;
    if (typeof url !== "string" || !/^data:/i.test(url)) {
      throw new Error("The image has no data URL.");
    }
    const blob = dataUrlToBlob(url);
    const extension = (blob.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
    return new File([blob], filename || `image.${extension}`, { type: blob.type });
  }

  // ============================================================================
  // DESCRIBE (FI-7): alt text written from the picture
  // ============================================================================
  //
  // One request through a FRESH headless OpenRouterEmbed per call. The shared client may
  // re-send to a fallback model and may answer from its cache; both are acceptable for a
  // description, and the caller sees the model that was asked for. The model is the
  // MEASURED `alt-text` model for the ACTIVE provider and never the other provider's.
  // The prompt of the picture is deliberately NOT an input: a prompt in context invites the
  // model to copy it. The caller owns the sink element (this file touches no page element)
  // and passes the embed's own quietening options, so every word the person sees or hears
  // stays with the caller.

  const DESCRIBE_PURPOSE = "alt-text";
  const DESCRIBE_PROMPT_FILE = "describe-alt.txt";
  const DESCRIBE_PROMPT_NAME = "EMBED_IMAGE_DESCRIBE_ALT";
  // The measured budget: reasoning is mandatory on the wire for the OpenRouter model, and a
  // 2,000-token ceiling cut 4 of 33 measured replies (mathpix-model-registry.js, alt-text).
  const DESCRIBE_MAX_TOKENS = 3000;
  const FOUNDRY_MODEL_PREFIX = "azure-openai/";
  const VISION_CAPABILITY = "vision";

  const DESCRIBE_MESSAGES = Object.freeze({
    NO_SINK: "No place was given for the description to be made, so none was made.",
    NO_PICTURE: "There is no picture to describe, so no description was made.",
    NO_MODEL: "No description model has been measured for this provider, so no description was made.",
    PROMPT_FAILED: "The description wording could not be loaded, so no description was made.",
    EMBED_MISSING: "The description engine is not loaded, so no description was made.",
    EMPTY: "The reply held no description.",
    CANCELLED: "The description was cancelled.",
  });

  let describeLoader = null;
  let describeLoadPromise = null;

  async function loadDescribePrompt() {
    if (describeLoadPromise) return describeLoadPromise;
    describeLoadPromise = (async () => {
      const LoaderClass = window.EmbedPromptLoader;
      if (typeof LoaderClass !== "function") return null;
      const loader = new LoaderClass();
      loader.configure({ basePath: STYLE_BASE_PATH });
      const text = await loader.load(DESCRIBE_PROMPT_NAME, DESCRIBE_PROMPT_FILE);
      if (typeof text !== "string" || text.trim() === "") return null;
      describeLoader = loader;
      return text.trim();
    })();
    const text = await describeLoadPromise;
    if (!text) describeLoadPromise = null; // let a later call try again
    return text;
  }

  function describeFail(extra) {
    return Object.assign(
      { ok: false, provider: null, model: null, text: "", cost: null, cancelled: false, ms: 0, error: "" },
      extra
    );
  }

  /** A model id belongs to Foundry by its prefix, and to OpenRouter otherwise. */
  function belongsTo(modelId, provider) {
    const isFoundry = modelId.startsWith(FOUNDRY_MODEL_PREFIX);
    return provider === PROVIDER.FOUNDRY ? isFoundry : !isFoundry;
  }

  /** The measured alt-text model, if it is registered, enabled, takes pictures and is this provider's. */
  function describeModelFor(provider) {
    const registry = window.MathPixModelRegistry;
    const found =
      registry && typeof registry.recommendedModel === "function"
        ? registry.recommendedModel(DESCRIBE_PURPOSE, provider)
        : null;
    if (!found || typeof found.modelId !== "string") return null;
    const entry = registryEntries().find((e) => e && e.id === found.modelId);
    if (!entry || entry.disabled) return null;
    // The "vision" capability, as the alt-text adapter filters. NOT ModalityCore.canAccept:
    // that fails open to text-only for an entry with no recorded modalities, and the Foundry
    // entries record none.
    if (!Array.isArray(entry.capabilities) || !entry.capabilities.includes(VISION_CAPABILITY)) return null;
    if (!belongsTo(found.modelId, provider)) return null;
    return found.modelId;
  }

  /**
   * Describe one picture. NEVER REJECTS. No other model, no other provider.
   *
   * @param {{image: {image_url: {url: string}}|File|Blob, containerId: string,
   *          embedOptions?: Object, signal?: AbortSignal}} request
   * @returns {Promise<{ok: boolean, provider: string|null, model: string|null, text: string,
   *          cost: number|null, cancelled: boolean, ms: number, error: string}>}
   */
  async function describe(request) {
    const req = request || {};
    const started = Date.now();
    let embed = null;
    let onAbort = null;
    try {
      // The provider is read ONCE, here.
      const provider = activeProvider();
      if (provider !== PROVIDER.OPENROUTER && provider !== PROVIDER.FOUNDRY) {
        return describeFail({ error: MESSAGES.NO_PROVIDER });
      }
      if (typeof req.containerId !== "string" || req.containerId === "") {
        return describeFail({ provider, error: DESCRIBE_MESSAGES.NO_SINK });
      }
      if (!req.image) return describeFail({ provider, error: DESCRIBE_MESSAGES.NO_PICTURE });

      const model = describeModelFor(provider);
      if (!model) return describeFail({ provider, error: DESCRIBE_MESSAGES.NO_MODEL });
      const base = { provider, model };

      const prompt = await loadDescribePrompt();
      if (!prompt) return describeFail({ ...base, error: DESCRIBE_MESSAGES.PROMPT_FAILED });

      const EmbedClass = window.OpenRouterEmbed;
      if (typeof EmbedClass !== "function") {
        return describeFail({ ...base, error: DESCRIBE_MESSAGES.EMBED_MISSING });
      }
      const file = req.image.image_url ? toFile(req.image, "picture.png") : req.image;

      embed = new EmbedClass(
        Object.assign({}, req.embedOptions, {
          containerId: req.containerId,
          model,
          showNotifications: false,
          showStreamingProgress: false,
          max_tokens: DESCRIBE_MAX_TOKENS,
        })
      );
      if (req.signal) {
        onAbort = () => embed.cancelRequest("Cancelled");
        if (req.signal.aborted) return describeFail({ ...base, cancelled: true, error: DESCRIBE_MESSAGES.CANCELLED });
        req.signal.addEventListener("abort", onAbort, { once: true });
      }

      await embed.attachFile(file);
      const response = await embed.sendRequest(prompt);
      const ms = Date.now() - started;

      if ((req.signal && req.signal.aborted) || (response && response.cancelled)) {
        return describeFail({ ...base, ms, cancelled: true, error: DESCRIBE_MESSAGES.CANCELLED });
      }
      const text = response && typeof response.text === "string" ? response.text.trim() : "";
      if (text === "") return describeFail({ ...base, ms, error: DESCRIBE_MESSAGES.EMPTY });
      const usage = response.metadata && response.metadata.tokens;
      const cost = usage && typeof usage.cost === "number" ? usage.cost : null;
      return { ok: true, ...base, text, cost, cancelled: false, ms, error: "" };
    } catch (error) {
      logWarn("describe failed:", error);
      const cancelled = !!(req.signal && req.signal.aborted);
      return describeFail({
        provider: activeProvider(),
        ms: Date.now() - started,
        cancelled,
        error: cancelled ? DESCRIBE_MESSAGES.CANCELLED : (error && error.message) || String(error),
      });
    } finally {
      if (req.signal && onAbort) req.signal.removeEventListener("abort", onAbort);
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  const api = Object.freeze({
    describe,
    styles: STYLES,
    shapes: SHAPES,
    measured: MEASURED,
    maxReferencePixels: MAX_REFERENCE_PIXELS,
    listModels() {
      return listFor(activeProvider());
    },
    loadStyles,
    prepareReference,
    generate,
    toFile,
  });

  window.OpenRouterEmbedImage = api;
  logInfo("OpenRouterEmbedImage ready");
})();
