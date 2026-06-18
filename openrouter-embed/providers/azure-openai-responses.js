/**
 * OpenRouter Embed API - Microsoft Foundry Responses-API Provider
 * (Responses-API workstream, Task 2)
 *
 * Concrete provider implementing the contract from `providers/_interface.js`
 * for Azure AI Foundry's OpenAI **Responses** surface (`/openai/v1/responses`).
 * Provider id is 'azure-responses' (the prefix reserved in Task 1). Self-
 * registers with `window.EmbedProviderRegistry` on load.
 *
 * This is a SIBLING of `azure-openai-v1.js`, not a modification of it
 * (decision D1). It mirrors that file exactly for the IIFE + logging scaffold,
 * the `readProviderConfig` precedence, the transport fetch + SSE loop, and the
 * AbortError-propagated-unchanged contract. ONLY the wire format differs:
 *
 *   - Endpoint: POST {proxyUrl}/openai/v1/responses (not /chat/completions).
 *   - Request body: `instructions` (system) + `input` (user/assistant) instead
 *     of `messages`; `max_output_tokens` instead of max_tokens /
 *     max_completion_tokens; NO `stream_options` (usage arrives natively).
 *   - Stream: text rides ONE event type, `response.output_text.delta` (read
 *     `delta`); `response.completed` carries the final response + usage.
 *   - Non-stream: text = concatenation of
 *     output[type==="message"].content[type==="output_text"].text — NOT
 *     choices[].message.content.
 *   - Usage keys: input_tokens / output_tokens / total_tokens /
 *     output_tokens_details.reasoning_tokens.
 *
 * Scope (Task 2): TEXT path only. The five Codex deployments are text-only;
 * gpt-5-pro vision (input_image mapping + the model-level vision flag) is
 * Task 5 and lands buildRequest image handling AND the flag together, never
 * apart (lessons 27/28). Provider-level capabilities.images is `true` because
 * the SURFACE accepts input_image, but buildRequest ships no image mapping in
 * this task and every model def is images:false until Task 5, so no image can
 * reach this adapter — the model-level gate prevents a silent strip.
 *
 * Configuration: arrives via `options.providerConfig` from core.js, falling
 * back to the same localStorage keys the Set Up tool writes for the v1
 * provider, then a hardcoded default — identical precedence to v1.
 *
 * @version 1.0.0 (Responses-API workstream, Task 2)
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
      console.error(`[EmbedFoundryResponsesProvider ERROR] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedFoundryResponsesProvider WARN] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedFoundryResponsesProvider INFO] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedFoundryResponsesProvider DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  // Responses-API path on the Foundry proxy. The Worker forwards
  // POST /openai/v1/responses to
  // https://<resource>.openai.azure.com/openai/v1/responses. Worker
  // passthrough is live and inherits the abort-signal handling.
  const PROXY_PATH = "/openai/v1/responses";

  // localStorage keys for the user-configured proxy URL and optional user
  // token. Shared with the v1 provider — both Foundry surfaces sit behind the
  // same Worker, so the Set Up tool's single config applies to both.
  const LS_PROXY_URL_KEY = "foundryProxyUrl";
  const LS_USER_TOKEN_KEY = "foundry-user-token";

  // Built-in last-resort proxy URL. Matches the project's deployed Worker, the
  // same default the v1 provider carries. Hits this only when neither
  // providerConfig.proxyUrl nor localStorage yields a non-empty string.
  const DEFAULT_PROXY_URL =
    "https://openrouter-embed-foundry-proxy.matthewdeeprose.workers.dev";

  // SSE [DONE] terminator marker — harmless if the Responses surface never
  // emits it; kept for symmetry with the v1 SSE reader.
  const SSE_DONE_MARKER = "[DONE]";

  // Responses streaming event types we care about. Every OTHER event
  // (response.created, response.in_progress, response.output_item.added,
  // response.content_part.added, response.reasoning*, etc.) is structural and
  // carries no caller-visible text.
  const EVENT_OUTPUT_TEXT_DELTA = "response.output_text.delta";
  const EVENT_RESPONSE_COMPLETED = "response.completed";
  // Streaming event carrying the model's own reasoning-summary text, in deltas.
  // streamRequest forwards these through onReasoning as summary text (Reasoning
  // Disclosure). Distinct from the structural events that only drive the
  // content-free liveness heartbeat.
  const EVENT_REASONING_SUMMARY_DELTA = "response.reasoning_summary_text.delta";

  // Deployments that ACCEPT `temperature` / `top_p` on the Responses surface.
  // This is the inverse of v1's REASONING_MODEL_PATTERNS: on /responses the
  // Codex/pro family is reasoning-first and rejects sampling params, so the
  // allow-list is the lone exception rather than the strip-list.
  //
  // `gpt-5.3-codex` is the SINGLE allow; the other five (gpt-5-codex,
  // gpt-5.1-codex, gpt-5.2-codex, gpt-5-pro, and any future Codex/pro
  // deployment) strip `temperature` and `top_p` from the wire body.
  //
  // SYNC NOTE: Task 3's declarative `supportedParams` on the model definitions
  // is the selector-facing twin of this set — the two encode the SAME single
  // exception and MUST stay in sync. Change one, change the other.
  const SAMPLING_PARAMS_ALLOWED = new Set(["gpt-5.3-codex"]);

  // Reasoning-aware output floor. Reasoning models on the Responses surface
  // spend their output budget on HIDDEN reasoning tokens before any visible
  // answer (a trivial gpt-5-pro prompt already burns ~192; a real describe
  // ~2048). On a small max_output_tokens the reasoning plus the answer exceed
  // the cap and the model returns a completed-but-EMPTY response. We therefore
  // floor max_output_tokens to this value for reasoning models so reasoning has
  // headroom. It is a CAP, not a spend — unused tokens are never billed — so a
  // generous floor is safe; tune later if a heavier describe needs more.
  const REASONING_OUTPUT_FLOOR = 16000;

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  /**
   * Read a non-empty trimmed string from localStorage, or null on miss /
   * failure. Swallows errors (private browsing, disabled storage, quota) so the
   * provider falls through to the next precedence tier instead of throwing.
   *
   * @param {string} key
   * @returns {string|null}
   * @private
   */
  function readLocalStorageString(key) {
    try {
      const raw = localStorage.getItem(key);
      if (typeof raw !== "string") return null;
      const trimmed = raw.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch (err) {
      logDebug(`localStorage read failed for '${key}'; treating as missing`, err);
      return null;
    }
  }

  /**
   * Resolve the proxy URL + optional user token for the next request.
   *
   * Precedence (mirrors v1's readProviderConfig — providerConfig wins):
   *   1. options.providerConfig.{proxyUrl,userToken} if explicitly passed and
   *      non-empty (explicit caller intent always wins).
   *   2. localStorage.getItem('foundryProxyUrl' / 'foundry-user-token') written
   *      by the Set Up tool. Read fresh on every call — no in-memory cache.
   *   3. Hardcoded DEFAULT_PROXY_URL fallback (proxy URL only; no default user
   *      token — the request omits x-user-token when none is configured).
   *
   * Never throws: the hardcoded default guarantees a usable proxy URL.
   *
   * @param {Object} options
   * @returns {{proxyUrl: string, userToken: string|null, source: string}}
   * @private
   */
  function readProviderConfig(options) {
    const cfg = (options && options.providerConfig) || null;

    // Proxy URL precedence: providerConfig → localStorage → hardcoded.
    let proxyUrl = null;
    let proxyUrlSource = null;
    if (cfg && typeof cfg.proxyUrl === "string" && cfg.proxyUrl.trim()) {
      proxyUrl = cfg.proxyUrl.trim();
      proxyUrlSource = "providerConfig";
    } else {
      const fromStorage = readLocalStorageString(LS_PROXY_URL_KEY);
      if (fromStorage) {
        proxyUrl = fromStorage;
        proxyUrlSource = "localStorage";
      } else {
        proxyUrl = DEFAULT_PROXY_URL;
        proxyUrlSource = "default";
      }
    }
    // Normalise: strip trailing slash so PROXY_PATH concatenation is clean.
    proxyUrl = proxyUrl.replace(/\/+$/, "");

    // User token precedence: providerConfig → localStorage → null.
    let userToken = null;
    if (cfg && typeof cfg.userToken === "string" && cfg.userToken.trim()) {
      userToken = cfg.userToken.trim();
    } else {
      userToken = readLocalStorageString(LS_USER_TOKEN_KEY);
    }

    logDebug("Responses provider config resolved", {
      proxyUrlSource,
      hasUserToken: !!userToken,
    });

    return { proxyUrl, userToken, source: proxyUrlSource };
  }

  /**
   * Whether a stripped deployment id is allowed to send `temperature` /
   * `top_p` on the Responses surface. Inverse of v1's isReasoningModel: here
   * the allow-list is the exception. Called with the STRIPPED deployment id
   * (e.g. "gpt-5.3-codex"), not the prefixed library id.
   *
   * @param {string} strippedDeploymentId
   * @returns {boolean}
   * @private
   */
  function samplingParamsAllowed(strippedDeploymentId) {
    if (typeof strippedDeploymentId !== "string" || !strippedDeploymentId) {
      return false;
    }
    return SAMPLING_PARAMS_ALLOWED.has(strippedDeploymentId);
  }

  /**
   * Whether the given model is a reasoning model, read from the SINGLE source of
   * truth — the model registry capability list (the six Responses defs carry
   * "reasoning" on gpt-5-pro and the four reasoning Codex deployments;
   * gpt-5.3-codex deliberately omits it, matching SAMPLING_PARAMS_ALLOWED).
   * Used to apply REASONING_OUTPUT_FLOOR in buildRequest.
   *
   * Accepts either the prefixed library id (`azure-responses/gpt-5-pro`) or a
   * bare deployment name. Defensive: getModel is called in silent mode (returns
   * null on miss, never throws); any failure (registry absent, lookup error)
   * degrades to false so a non-reasoning caller value is left untouched.
   *
   * @param {string} modelId
   * @returns {boolean}
   * @private
   */
  function isReasoningModel(modelId) {
    if (typeof modelId !== "string" || !modelId) return false;
    try {
      const reg = window.modelRegistry;
      if (!reg || typeof reg.getModel !== "function") return false;
      let def = reg.getModel(modelId, true);
      if (!def && !modelId.startsWith("azure-responses/")) {
        def = reg.getModel("azure-responses/" + modelId, true);
      }
      const caps = def && Array.isArray(def.capabilities) ? def.capabilities : null;
      return !!(caps && caps.includes("reasoning"));
    } catch (err) {
      logDebug(
        "reasoning-capability lookup failed; treating as non-reasoning",
        err,
      );
      return false;
    }
  }

  /**
   * Flatten a message `content` value into a plain text string. Handles the
   * string form (the common case this task) and an array of parts, reading
   * `.text` (or `.content`) from each. Non-text parts (e.g. a future
   * input_image) contribute nothing — image handling is Task 5.
   *
   * @param {string|Array|*} content
   * @returns {string}
   * @private
   */
  function extractText(content) {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      let out = "";
      for (const part of content) {
        if (typeof part === "string") {
          out += part;
        } else if (part && typeof part === "object") {
          if (typeof part.text === "string") out += part.text;
          else if (typeof part.content === "string") out += part.content;
        }
      }
      return out;
    }
    return "";
  }

  /**
   * Build the Responses `content[]` array for a single non-system message,
   * translating canonical chat-completions content into Responses content
   * parts (plan §4).
   *
   * Two regimes, chosen by whether the message carries any image part:
   *
   *   1. Text-only (string content, OR an array with no image_url part) →
   *      EXISTING Task 2 behaviour byte-for-byte: a single
   *      `{ type:"input_text", text }` where `text` is `extractText(content)`
   *      (a string passes through unchanged; a text-only array concatenates).
   *      This branch must never change — the whole Task 2-4 text path and its
   *      assertions depend on it.
   *
   *   2. Multimodal (array WITH at least one image_url part) → an
   *      order-preserving translation of each part:
   *        - { type:"text", text:T }                  → { type:"input_text",  text:T }
   *        - { type:"image_url", image_url:{ url:U } } → { type:"input_image", image_url:U }
   *      The Responses surface takes `input_image.image_url` as a bare data-URL
   *      STRING (plan §4 / the OpenAI Responses surface), so the nested `{ url }`
   *      is unwrapped to its string. A bare-string `image_url` is also tolerated.
   *
   * Inert until Task 5b: no Responses model def is images-eligible yet, so no
   * image part can reach this adapter today. This is purely the translation
   * machinery, ready for the model-level vision flag to be flipped in 5b.
   *
   * @param {string|Array|*} content
   * @returns {Array<Object>}
   * @private
   */
  function buildInputContent(content) {
    // Regime 1a: string content → single input_text (existing behaviour).
    if (!Array.isArray(content)) {
      return [{ type: "input_text", text: extractText(content) }];
    }

    // Regime 1b: array with NO image part → preserve the existing text-only
    // behaviour byte-for-byte (concatenate every text part into ONE input_text).
    const hasImage = content.some(
      (p) => p && typeof p === "object" && p.type === "image_url",
    );
    if (!hasImage) {
      return [{ type: "input_text", text: extractText(content) }];
    }

    // Regime 2: multimodal → translate each part, order-preserving.
    const out = [];
    for (const part of content) {
      if (typeof part === "string") {
        out.push({ type: "input_text", text: part });
        continue;
      }
      if (!part || typeof part !== "object") continue;

      if (part.type === "image_url") {
        // Extract the data-URL STRING from the nested { url } (or a bare string).
        const url =
          part.image_url && typeof part.image_url === "object"
            ? part.image_url.url
            : typeof part.image_url === "string"
              ? part.image_url
              : null;
        if (typeof url === "string" && url) {
          out.push({ type: "input_image", image_url: url });
        }
      } else if (typeof part.text === "string") {
        // type:"text" (or any text-bearing part) → input_text.
        out.push({ type: "input_text", text: part.text });
      } else if (typeof part.content === "string") {
        out.push({ type: "input_text", text: part.content });
      }
    }
    return out;
  }

  /**
   * Walk a Responses `output[]` array and concatenate the assistant text.
   *
   * The text lives in output items of `type === "message"`, inside their
   * `content[]` entries of `type === "output_text"`. Reasoning items
   * (`{type:"reasoning", summary:[]}`) are walked PAST and surface nothing
   * (decision D3 — the summary arrives empty). This is deliberately NOT
   * choices[].message.content (that is the chat surface — failure mode #5).
   *
   * @param {Array} outputArr
   * @returns {string}
   * @private
   */
  function extractOutputText(outputArr) {
    if (!Array.isArray(outputArr)) return "";
    let out = "";
    for (const item of outputArr) {
      if (item && item.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c && c.type === "output_text" && typeof c.text === "string") {
            out += c.text;
          }
        }
      }
      // D3: reasoning items are parsed (skipped) and surface nothing.
    }
    return out;
  }

  /**
   * Walk a Responses output[] array and assemble the reasoning summary text.
   *
   * The summary lives on the output item of type "reasoning", in its summary[]
   * entries, each carrying a `text` string (the non-streaming counterpart of the
   * response.reasoning_summary_text.delta stream events). Returns "" when no
   * reasoning item or no summary text is present, so a non-reasoning model, or a
   * reasoning model that emitted no summary, yields nothing and the caller
   * renders nothing (fail safe).
   *
   * @param {Array} outputArr
   * @returns {string}
   * @private
   */
  function extractReasoningSummary(outputArr) {
    if (!Array.isArray(outputArr)) return "";
    let out = "";
    for (const item of outputArr) {
      if (item && item.type === "reasoning" && Array.isArray(item.summary)) {
        for (const s of item.summary) {
          if (s && typeof s.text === "string") out += s.text;
        }
      }
    }
    return out;
  }

  /**
   * Read the four token counts off a Responses `usage` object, normalising
   * absent/non-numeric fields to safe values. Returns the raw numbers; callers
   * shape them into the per-path canonical key set (see buildResponse usage
   * note in parseResponse / streamRequest).
   *
   * Wire keys: input_tokens, output_tokens, total_tokens, and
   * output_tokens_details.reasoning_tokens.
   *
   * @param {Object} rawUsage
   * @returns {{input:number, output:number, total:number, reasoning:(number|null)}}
   * @private
   */
  function readWireUsage(rawUsage) {
    const u = rawUsage && typeof rawUsage === "object" ? rawUsage : {};
    const input = typeof u.input_tokens === "number" ? u.input_tokens : 0;
    const output = typeof u.output_tokens === "number" ? u.output_tokens : 0;
    const total =
      typeof u.total_tokens === "number" ? u.total_tokens : input + output;
    const reasoning =
      u.output_tokens_details &&
      typeof u.output_tokens_details.reasoning_tokens === "number"
        ? u.output_tokens_details.reasoning_tokens
        : null;
    return { input, output, total, reasoning };
  }

  /**
   * Parse a single SSE `data:` line into a parsed event object.
   *
   * Returns null for the [DONE] terminator, malformed JSON (logged as warn), or
   * non-`data:` lines. Each Responses SSE event carries one JSON object per
   * data line; the object's `type` field identifies the event. We read only the
   * `data:` payload — the parallel `event:` line is redundant with `.type`.
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
   * Pull complete SSE events out of a buffer string. An event ends at a blank
   * line (`\n\n`). Within each event, `data:` lines carry the payload; other
   * line types (event:, id:, retry:, comments) are ignored. Identical
   * mechanics to the v1 reader — only the per-event payload shape differs.
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
    id: "azure-responses",

    /**
     * Provider-level capability flags — what the Responses API SURFACE can
     * support, NOT what any specific deployment offers. Per-deployment
     * variation is declared in config.models[i].capabilities (decision A7).
     *
     *   - images: true reflects that the surface accepts `input_image` content
     *     parts. buildRequest ships NO image mapping this task, and every
     *     Responses model def is images:false until Task 5, so the model-level
     *     gate prevents any image reaching this adapter (no silent strip).
     *   - pdf: false — Foundry has uneven PDF support; the library extracts
     *     text client-side.
     *   - reasoning: true — the Codex/pro family is reasoning-first.
     *   - toolCalls: false — out of scope for this workstream.
     */
    capabilities: {
      streaming: true,
      images: true,
      pdf: false,
      reasoning: true,
      toolCalls: false,
    },

    /**
     * Translate canonical request options to an Azure OpenAI **Responses**
     * request body.
     *
     * Translations applied:
     *   - Registry prefix stripped from `options.model`: `azure-responses/` →
     *     bare deployment name. Azure expects raw deployment names; a prefixed
     *     id surfaces as HTTP 404 DeploymentNotFound (failure mode #2). The
     *     bare name is carried in body `model` (failure mode #4 — confirmed by
     *     live smoke; a wrong field 404s).
     *   - system message → `instructions` (string).
     *   - user/assistant messages → `input` item-array. Text content keeps the
     *     `input_text` shape; image-bearing arrays translate to
     *     `input_text` / `input_image` parts (Task 5a, see buildInputContent).
     *     Inert until 5b flips a model to vision-eligible.
     *   - max_tokens → `max_output_tokens` (NOT max_tokens, NOT
     *     max_completion_tokens), with the double-build pass-through below.
     *   - reasoning.effort → `reasoning: { effort }` only when explicitly set;
     *     no invented default (Azure applies the deployment default).
     *   - Per-model sampling strip: `temperature` / `top_p` dropped unless the
     *     stripped deployment is in SAMPLING_PARAMS_ALLOWED.
     *   - NO `stream_options` — usage arrives natively on the Responses
     *     surface (unlike v1, which must request include_usage).
     */
    buildRequest(messages, options) {
      logDebug("Building Foundry Responses request body");

      // Strip the `azure-responses/` registry prefix before sending to Azure.
      // No-op if the caller already passed a bare deployment name.
      const deploymentName =
        typeof options.model === "string"
          ? options.model.replace(/^azure-responses\//, "")
          : options.model;

      // Split messages: system → instructions; the rest → input items.
      const systemParts = [];
      const inputItems = [];
      const msgs = Array.isArray(messages) ? messages : [];
      for (const m of msgs) {
        if (!m || typeof m !== "object") continue;
        if (m.role === "system") {
          // System → instructions (always text; flattened to a string).
          const text = extractText(m.content);
          if (text) systemParts.push(text);
        } else {
          // Assistant history is preserved as a role-tagged item. Text-only
          // content keeps the Task 2 shape byte-for-byte; an image-bearing
          // array is translated to input_text / input_image parts (Task 5a).
          // No model is vision-eligible until 5b, so this is inert today.
          inputItems.push({
            role: m.role === "assistant" ? "assistant" : "user",
            content: buildInputContent(m.content),
          });
        }
      }

      const body = {
        model: deploymentName,
        input: inputItems,
      };
      if (systemParts.length > 0) {
        body.instructions = systemParts.join("\n\n");
      }

      // max_tokens → max_output_tokens (this task), OR pass through an existing
      // max_output_tokens value directly.
      //
      // buildRequest runs TWICE per streaming request: once via core's
      // buildOptions, then again inside streamRequest with stream:true added.
      // On the second pass `max_tokens` is already gone (renamed on pass 1), so
      // without the else-if pass-through the token cap silently vanishes — this
      // is exactly v1's Task 2.5b bug (failure mode #1). `max_tokens` wins if
      // both are somehow set (the rename always takes precedence).
      let requestedOutputCap = null;
      if (typeof options.max_tokens === "number") {
        requestedOutputCap = options.max_tokens;
      } else if (typeof options.max_output_tokens === "number") {
        requestedOutputCap = options.max_output_tokens;
      }

      // Reasoning-aware floor. Reasoning models burn output budget on hidden
      // reasoning before any visible answer, so a small cap yields a
      // completed-but-empty response (see REASONING_OUTPUT_FLOOR). Floor the cap
      // to give reasoning headroom — even when the caller set no cap, since a
      // reasoning model with no budget starves immediately. Non-reasoning models
      // keep the caller's value untouched (and omit the key entirely if unset).
      //
      // Applied AFTER the rename so it covers the double-build pass-through path:
      // on pass 2 `max_output_tokens` already carries the floored value, and
      // Math.max(floor, floor) is idempotent.
      if (isReasoningModel(options.model)) {
        body.max_output_tokens = Math.max(
          requestedOutputCap || 0,
          REASONING_OUTPUT_FLOOR,
        );
      } else if (requestedOutputCap !== null) {
        body.max_output_tokens = requestedOutputCap;
      }

      // reasoning.effort pass-through. Only when explicitly set — no invented
      // default; Azure applies the deployment's own default otherwise.
      if (
        options.reasoning &&
        typeof options.reasoning === "object" &&
        options.reasoning.effort !== undefined &&
        options.reasoning.effort !== null
      ) {
        body.reasoning = { effort: options.reasoning.effort };
      }

      // reasoning.summary. Request the model's own summary of its reasoning so a
      // caller can surface it (decision D1). Reasoning-capable models only; a
      // non-reasoning deployment never receives the key. Default "auto"; an explicit
      // options.reasoning.summary (for example "detailed") overrides. Built onto the
      // same body.reasoning object so it coexists with any effort set above.
      if (isReasoningModel(options.model)) {
        const summaryVerbosity =
          options.reasoning &&
          typeof options.reasoning === "object" &&
          typeof options.reasoning.summary === "string" &&
          options.reasoning.summary.trim()
            ? options.reasoning.summary.trim()
            : "auto";
        body.reasoning = body.reasoning || {};
        body.reasoning.summary = summaryVerbosity;
      }

      // Per-model sampling-parameter strip. On the Responses surface the
      // Codex/pro family rejects temperature/top_p; SAMPLING_PARAMS_ALLOWED is
      // the lone exception (currently gpt-5.3-codex). Drop both unless allowed.
      const allowSampling = samplingParamsAllowed(deploymentName);
      if (typeof options.temperature === "number" && allowSampling) {
        body.temperature = options.temperature;
      }
      if (typeof options.top_p === "number" && allowSampling) {
        body.top_p = options.top_p;
      }

      // Single DEBUG log per drop, only when something was actually dropped.
      if (!allowSampling) {
        const droppedTemperature = typeof options.temperature === "number";
        const droppedTopP = typeof options.top_p === "number";
        if (droppedTemperature || droppedTopP) {
          logDebug(
            `Sampling params not accepted for '${deploymentName}' — dropped`,
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
        // NO stream_options — the Responses surface returns usage natively on
        // the response.completed event (contrast v1's include_usage).
      }

      logDebug("Foundry Responses request body built", {
        keys: Object.keys(body),
      });
      return body;
    },

    /**
     * Compute the proxy URL + headers for a Responses request.
     *
     * The proxy forwards /openai/v1/responses to the configured Foundry
     * resource with the Azure key injected server-side. We never send the Azure
     * key ourselves — only the optional user token. Proxy URL + user token
     * resolution: see readProviderConfig (providerConfig → localStorage →
     * hardcoded default). Never throws.
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

      // No `Authorization: Bearer <key>` — the Worker holds the Azure key.

      return {
        url: proxyUrl + PROXY_PATH,
        headers,
      };
    },

    /**
     * Parse a single SSE `data:` line into a canonical delta, or null.
     *
     * The text rides ONE event type, `response.output_text.delta`: read the
     * `delta` payload key (ignore `obfuscation`) and emit `{ text: delta }`.
     * Every other event — including response.completed and all structural
     * events — yields no delta (returns null). Completion + usage are handled
     * inside streamRequest's loop, which sees the raw event objects directly.
     */
    parseStreamChunk(rawLine) {
      const parsed = parseSSEDataLine(rawLine);
      if (!parsed || typeof parsed !== "object") return null;
      if (
        parsed.type === EVENT_OUTPUT_TEXT_DELTA &&
        typeof parsed.delta === "string"
      ) {
        return { text: parsed.delta };
      }
      // response.completed is terminal (its usage + assembled output are handled
      // inside streamRequest) — never a heartbeat.
      if (parsed.type === EVENT_RESPONSE_COMPLETED) return null;
      // Every OTHER Responses event is structural (response.created,
      // response.in_progress, response.reasoning*, *_part.added, …). During a
      // long reasoning phase these are the ONLY events that arrive, so surface
      // them as a CONTENTLESS liveness heartbeat — this lets the UI show a
      // "reasoning" state instead of looking frozen for minutes. No reasoning
      // summary TEXT is surfaced here (decision D3 stays); the marker carries
      // liveness only.
      if (typeof parsed.type === "string" && parsed.type.startsWith("response.")) {
        return { progress: true, phase: "reasoning" };
      }
      return null;
    },

    /**
     * Translate a non-streaming Responses wire response to the canonical shape
     * core.js's processResponse() consumes.
     *
     * processResponse reads `choices[0].message.content` for the text and
     * `usage.prompt_tokens` / `.completion_tokens` / `.total_tokens` for the
     * token counts, then builds `metadata.tokens = {prompt, completion, total}`.
     * v1's parseResponse is a pass-through because its wire IS that shape; here
     * we WALK the Responses wire (output[] + input_tokens/...) and re-emit the
     * SAME canonical OpenAI-chat shape, swapping only the wire walk and the
     * usage keys. This keeps cost calc, the debug panel, and the Image
     * Describer strip-telemetry working unchanged.
     */
    parseResponse(json) {
      const text = extractOutputText(json && json.output);

      // Fail loudly on a completed-but-EMPTY or incomplete response. A reasoning
      // model can exhaust its output budget on hidden reasoning before emitting
      // any visible text; the wire then carries no output_text (and often
      // status:"incomplete" with incomplete_details.reason "max_output_tokens").
      // Surfacing this as an error — rather than silently returning "" — is what
      // lets the controller report failure instead of "generated successfully".
      const status =
        json && typeof json.status === "string" ? json.status : null;
      if (!text || text.trim() === "" || status === "incomplete") {
        const modelName = (json && json.model) || "unknown";
        const reason =
          json &&
          json.incomplete_details &&
          json.incomplete_details.reason
            ? json.incomplete_details.reason
            : null;
        throw new Error(
          `azure-responses model '${modelName}' returned no output (status: ${
            status || "unknown"
          }, reason: ${
            reason || "n/a"
          }) — token budget likely exhausted by reasoning; raise max output tokens.`,
        );
      }

      const { input, output, total, reasoning } = readWireUsage(
        json && json.usage,
      );

      const usage = {
        prompt_tokens: input,
        completion_tokens: output,
        total_tokens: total,
      };
      if (reasoning !== null) {
        // Record reasoning tokens for downstream telemetry (D3 surfaces no
        // reasoning text, but the meter is preserved).
        usage.reasoning_tokens = reasoning;
      }

      const result = {
        model: (json && json.model) || null,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: text },
            finish_reason: "stop",
          },
        ],
        usage,
      };

      // Reasoning summary (Reasoning Disclosure). Attach only when the model
      // actually returned summary text; absent otherwise so the caller renders
      // nothing. Core (Task 2) reads this through for the non-streaming path.
      const reasoningSummary = extractReasoningSummary(json && json.output);
      if (reasoningSummary && reasoningSummary.trim() !== "") {
        result.reasoning = reasoningSummary;
      }

      return result;
    },

    /**
     * Send a streaming Responses request to Foundry and dispatch canonical
     * callbacks as chunks arrive. Mirrors v1's streamRequest signature and
     * behaviour so core.js's dispatch falls through transparently.
     *
     * Callback contract:
     *   - onStart(): once before the first chunk.
     *   - onChunk(text: string, parsedEvent: Object): per output_text.delta
     *     event carrying non-empty text. First arg is the delta string (core's
     *     handleStreamChunk wraps it into a {text} chunk for consumers).
     *   - onComplete(fullText: string, responseData: Object): once at stream
     *     end. responseData = {model, usage, processingTime}; usage is the
     *     CANONICAL {prompt, completion, total} shape so buildFinalResponse's
     *     verbatim `metadata.tokens = responseData.usage` yields
     *     metadata.tokens.prompt (contrast parseResponse's OpenAI-key shape —
     *     the two paths feed two different core normalisers).
     *   - onError(error: Error): transport / non-2xx failures. AbortError is
     *     propagated UNCHANGED so core's expected-cancellation detection works.
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
      // Liveness heartbeat callback (optional). Fired on structural events that
      // arrive while the model is reasoning before it emits visible text, so a
      // caller can show a "reasoning" state rather than a frozen UI.
      const onReasoning =
        typeof opts.onReasoning === "function" ? opts.onReasoning : null;
      const abortSignal = opts.abortSignal || null;

      try {
        const { url, headers } = this.endpoint(opts.model, opts);
        const body = this.buildRequest(messages, { ...opts, stream: true });

        logInfo("Foundry Responses streaming request", {
          url,
          model: opts.model,
        });

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
            `Foundry Responses request failed: HTTP ${response.status} — ${errorBody}`,
          );
          err.status = response.status;
          err.body = errorBody;
          throw err;
        }

        if (!response.body) {
          throw new Error("Foundry Responses response has no body — cannot stream");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullText = "";
        let finalResponsePayload = null;
        let chunkIndex = 0;

        const processParsed = (parsed) => {
          if (!parsed || typeof parsed !== "object") return;
          const type = parsed.type;

          if (type === EVENT_OUTPUT_TEXT_DELTA) {
            const delta = parsed.delta;
            if (typeof delta === "string" && delta !== "") {
              fullText += delta;
              if (onChunk) {
                try {
                  onChunk(delta, parsed);
                } catch (callbackErr) {
                  logWarn("onChunk callback threw:", callbackErr);
                }
              }
              chunkIndex++;
            }
          } else if (type === EVENT_RESPONSE_COMPLETED) {
            // The completed event carries the full response object, including
            // usage and the assembled output. We read usage from it.
            finalResponsePayload = parsed.response || null;
          } else if (type === EVENT_REASONING_SUMMARY_DELTA) {
            // Summary delta. The model's own reasoning summary, arriving in a late
            // burst near the end. Forward the TEXT through onReasoning with a typed
            // payload. fullText (the answer buffer) is never touched, so the summary
            // cannot leak into the description. A non-string or empty delta falls back
            // to the content-free heartbeat so liveness is preserved.
            if (onReasoning) {
              try {
                const summaryDelta =
                  typeof parsed.delta === "string" ? parsed.delta : "";
                if (summaryDelta !== "") {
                  onReasoning({ type: "summary", text: summaryDelta });
                } else {
                  onReasoning({ phase: "reasoning", type });
                }
              } catch (callbackErr) {
                logWarn("onReasoning (summary) callback threw:", callbackErr);
              }
            }
          } else if (typeof type === "string" && type.startsWith("response.")) {
            // Structural event (response.in_progress, response.reasoning*,
            // *_part.added, …). During a long reasoning phase these are the
            // only events that arrive — fire a CONTENTLESS liveness heartbeat
            // so the caller can show a "reasoning" state. No buffer change, no
            // summary text (D3 stays).
            if (onReasoning) {
              try {
                onReasoning({ phase: "reasoning", type });
              } catch (callbackErr) {
                logWarn("onReasoning callback threw:", callbackErr);
              }
            }
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

          // Drain anything left at stream end (connection closed without a
          // trailing blank line).
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

        // Fail loudly on an empty/incomplete stream (mirrors parseResponse). A
        // reasoning model can exhaust its output budget on hidden reasoning, so
        // the terminal response.completed arrives with status:"incomplete" (or
        // the accumulated text buffer is empty). Surface this through the error
        // path — never complete with an empty buffer, which would read as
        // success downstream. Thrown here, it is caught below and routed to
        // onError + rethrow exactly like a transport failure.
        const finalStatus =
          finalResponsePayload &&
          typeof finalResponsePayload.status === "string"
            ? finalResponsePayload.status
            : null;
        if (finalStatus === "incomplete" || fullText.trim() === "") {
          const modelName =
            (finalResponsePayload && finalResponsePayload.model) ||
            opts.model ||
            "unknown";
          const reason =
            finalResponsePayload &&
            finalResponsePayload.incomplete_details &&
            finalResponsePayload.incomplete_details.reason
              ? finalResponsePayload.incomplete_details.reason
              : null;
          throw new Error(
            `azure-responses model '${modelName}' returned no output (status: ${
              finalStatus || "unknown"
            }, reason: ${
              reason || "n/a"
            }) — token budget likely exhausted by reasoning; raise max output tokens.`,
          );
        }

        // Normalise usage into the CANONICAL {prompt, completion, total} shape
        // (what core's processResponse produces for metadata.tokens), so
        // buildFinalResponse's verbatim assignment exposes metadata.tokens.prompt.
        let usage = null;
        if (finalResponsePayload && finalResponsePayload.usage) {
          const { input, output, total, reasoning } = readWireUsage(
            finalResponsePayload.usage,
          );
          usage = { prompt: input, completion: output, total: total };
          if (reasoning !== null) usage.reasoning_tokens = reasoning;
        }

        const responseData = {
          model:
            (finalResponsePayload && finalResponsePayload.model) ||
            opts.model ||
            null,
          usage,
          processingTime: elapsedMs,
        };

        logInfo("Foundry Responses streaming complete", {
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
        // Propagate AbortError unchanged so core's expected-cancellation
        // detection treats it correctly (failure mode #3).
        if (error && error.name === "AbortError") {
          logDebug("Foundry Responses stream aborted (expected cancellation)");
          if (onError) {
            try {
              onError(error);
            } catch (_) {
              /* suppress to keep AbortError identity */
            }
          }
          throw error;
        }

        logError("Foundry Responses streaming error:", error);
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
     * Send a non-streaming Responses request to Foundry. Mirrors v1's
     * request(messages, options). Used by core's reduced-motion fallback path.
     */
    async request(messages, options) {
      const opts = options || {};
      const abortSignal = opts.abortSignal || null;

      const { url, headers } = this.endpoint(opts.model, opts);
      const body = this.buildRequest(messages, { ...opts, stream: false });

      logInfo("Foundry Responses non-streaming request", {
        url,
        model: opts.model,
      });

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
          `Foundry Responses request failed: HTTP ${response.status} — ${errorBody}`,
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
      logInfo("Foundry Responses (azure-responses) provider registered");
    } catch (error) {
      logError("Failed to register Foundry Responses provider:", error);
    }
  } else {
    logError(
      "EmbedProviderRegistry not available — script load order issue. " +
        "providers/_interface.js must load before providers/azure-openai-responses.js.",
    );
  }

  // ============================================================================
  // INITIALISATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Foundry Responses Provider (Task 2) loaded");
  logInfo("Provider id: 'azure-responses'");
})();
