/**
 * @file alt-text-cloud-adapter.js
 * @module MathPixAltTextCloudAdapter
 * @description
 * Phase 2 Stage 2, Parcel 2.3 — the CLOUD generation adapter for the MathPix
 * AI-description orchestrator. Reads the active provider, selects a
 * vision-capable model, RE-CHECKS vision capability at the send boundary on the
 * RESOLVED model (F6 — both halves), attaches and sends an image through the
 * OpenRouter Embed, and finalises the raw result through the parcel 2.1
 * contract.
 *
 * ── The send boundary (F6) ─────────────────────────────────────────────────
 * A model can slip past the population-only vision gate (an explicit `model`
 * option, a restored preference, a direct caller). So this adapter re-checks
 * `isModelVisionCapable(resolvedId)` immediately before it attaches or sends.
 * On a non-vision resolved model it REFUSES by returning a contract
 * `status:"error"` result — it NEVER calls a controller `showError` /
 * `announceStatus` / `return`, because none of those can run standalone here.
 * The refuse happens BEFORE any attach or send.
 *
 * ── Injection ──────────────────────────────────────────────────────────────
 * The module attaches to `window` at definition time, but an INSTANCE reaches
 * the embed only through injection: `create({ embed })` bakes the embed, and
 * `generate({ image, prompt, model })` uses it. The vision re-check and the
 * model resolution reach NO embed — they consult `window.EmbedModelSelector`
 * and the static list — so they run in a headless / stubbed context where no
 * embed is passed (this is what the 2.3 guard drives).
 *
 * ── Confirmed embed seam (Phase A) ─────────────────────────────────────────
 *   • attach — `embed.attachFile(file)` (the image equivalent of the context
 *     tab's `attachPDF`; the public method validates + compresses + hangs the
 *     file/base64/analysis on the embed). Takes a File/Blob.
 *   • send   — `embed.sendRequest(userPrompt)` (the same layer the Image
 *     Describer generate path and the context tab's `sendWithTimeout` wrapper
 *     use; streams internally, resolves the final object). `sendWithTimeout` is
 *     a caller-side timeout wrapper, NOT an embed method — no timeout is baked
 *     in here.
 *   • raw success shape — `{ text, html, markdown, raw, metadata, reasoning? }`.
 *     `text` and `reasoning` (reasoning models only) are top-level. `model` and
 *     `processingTime` come back under `metadata`, but this adapter does NOT
 *     trust them: it captures `duration` itself with `Date.now()` either side of
 *     the send and sets `model` to the resolved id it actually sent.
 *   • failure — `attachFile` / `sendRequest` THROW an Error; the catch maps
 *     `error.message` into the contract `error` slot (finalise supplies
 *     DEFAULT_ERROR_MESSAGE when the message is empty).
 *
 * Reaches every global (`EmbedModelSelector`, `ProviderSwitcher`,
 * `MathPixAltTextGenerationContract`) at CALL time with a guard, so load order
 * cannot bite. Pure otherwise: no DOM, no `title` attribute.
 *
 * @see mathpix-scripts/ai-alt-text/alt-text-generation-contract.js (2.1 — finalise/STATUS/SOURCE)
 * @see image-describer/image-describer-controller-model.js (F6 source — isModelVisionCapable, KNOWN_VISION_MODELS)
 * @see openrouter-embed/openrouter-embed-model-selector.js (getEligibleModels)
 * @see openrouter-embed/provider-switcher.js (getActive)
 */

const MathPixAltTextCloudAdapter = (function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Logging (per CLAUDE.md § Logging Standards — IIFE pattern)
  // ---------------------------------------------------------------------------

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
      console.error(`[AltTextCloudAdapter] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AltTextCloudAdapter] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AltTextCloudAdapter] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AltTextCloudAdapter] ${message}`, ...args);
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /**
   * Default / preferred model id for the resolution ladder. Mirrors the
   * reference's DEFAULT_MODEL in image-describer-controller-model.js — the
   * economical Claude Haiku. Used by _resolveModel to prefer it when eligible.
   */
  const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";

  /** Exact refuse message for a non-vision resolved model (British spelling). */
  const NON_VISION_REFUSAL =
    "The selected model cannot process images. Choose a vision-capable model.";

  /**
   * Sentinel returned by _resolveModel when nothing resolves. Chosen as `null`
   * so it flows straight into isModelVisionCapable (which returns false for a
   * non-string), and generate then refuses via the standard send-boundary path.
   */
  const NO_MODEL_RESOLVED = null;

  // ===========================================================================
  // KNOWN VISION MODELS
  // ===========================================================================
  // COPIED VERBATIM from image-describer-controller-model.js (KNOWN_VISION_MODELS).
  // This duplicates a list that DRIFTS — every time a Foundry deployment's vision
  // flag flips, both copies must be edited. FOLLOW-UP (recorded, not built here):
  // reconcile the two into ONE shared vision-capability source in a later phase.
  // Belt-and-braces against registries that don't flag vision correctly; includes
  // both OpenRouter-prefixed entries and Foundry-routed entries.
  const KNOWN_VISION_MODELS = [
    // OpenRouter — Anthropic Claude models (all recent versions support vision)
    "anthropic/claude-sonnet-4.6",
    "anthropic/claude-opus-4.6",
    "anthropic/claude-haiku-4.5",
    // OpenRouter — OpenAI GPT-4 vision models
    "openai/gpt-4-vision-preview",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/gpt-4-turbo",
    // OpenRouter — Google Gemini models
    "google/gemini-pro-vision",
    "google/gemini-1.5-pro",
    "google/gemini-1.5-flash",
    "google/gemini-2.0-flash-001",
    "google/gemini-2.5-pro-preview",
    "google/gemini-2.5-flash-preview",
    // Foundry — Azure OpenAI deployments (Task 3.5b)
    "azure-openai/gpt-5.4-mini",
    // Foundry — vision-capable additions (factory registration, post-Stage-3b).
    // All four Foundry deployments empirically verified vision-capable
    // (31 May 2026); gpt-5.4-nano was added here once its conservative
    // vision: false default was flipped in js/foundry-model-definitions.js.
    "azure-openai/gpt-4o-mini",
    "azure-openai/gpt-5.4",
    "azure-openai/gpt-5.4-nano",
    // Foundry — GPT-5.x flagships, vision verified via Image Describer
    // (4 June 2026); initially registered text-only in f9ef566, flipped
    // once vision: true landed in js/foundry-model-definitions.js.
    "azure-openai/gpt-5",
    "azure-openai/gpt-5.1",
    "azure-openai/gpt-5.2",
    // Foundry — GPT-4.1 family, GPT-4o, and o4-mini, vision verified via
    // Image Describer (6 June 2026); initially registered text-only in
    // d1f6cfc, flipped once vision: true landed in
    // js/foundry-model-definitions.js.
    "azure-openai/gpt-4.1",
    "azure-openai/gpt-4.1-mini",
    "azure-openai/gpt-4.1-nano",
    "azure-openai/gpt-4o",
    "azure-openai/o4-mini",
    // Foundry — Phi-4 Multimodal, vision verified via Image Describer
    // (6 June 2026); initially registered text-only in 683f2fb on an
    // ambiguous degenerate-pixel probe (escape-phrase false negative),
    // flipped once vision: true landed in js/foundry-model-definitions.js.
    // The other ten batch-3 models remain confirmed text-only.
    "azure-openai/Phi-4-multimodal-instruct",
    // Foundry — Responses-API surface (azure-responses provider). gpt-5-pro
    // vision verified via a live Foundry call (Task 5b); the five Codex
    // deployments remain text-only.
    "azure-responses/gpt-5-pro",
  ];

  // ---------------------------------------------------------------------------
  // Global reach helpers (reach at CALL time, guarded)
  // ---------------------------------------------------------------------------

  /** The 2.1 contract, reached at call time. Returns null (with a WARN) if absent. */
  function _contract() {
    const c = window.MathPixAltTextGenerationContract;
    if (!c || typeof c.finalise !== "function") {
      logWarn(
        "MathPixAltTextGenerationContract unavailable at call time — cannot finalise",
      );
      return null;
    }
    return c;
  }

  // ===========================================================================
  // VISION CAPABILITY RE-CHECK (F6 — both halves)
  // ===========================================================================

  /**
   * Vision-capability predicate — COPIED from image-describer-controller-model.js
   * (isModelVisionCapable), retargeted to standalone module scope. Both halves
   * of the F6 decision are preserved:
   *   • provider derivation from the id prefix,
   *   • primary path via EmbedModelSelector.getEligibleModels with the
   *     NON-EMPTY-list-is-authoritative rule (in-list ⇒ vision, absent ⇒ not),
   *   • the EMPTY-list fall-through (a misconfigured / empty selector must NOT
   *     conclude "not vision" — fall through to the static list),
   *   • the thrown-selector fall-through,
   *   • the KNOWN_VISION_MODELS membership fallback.
   *
   * The controller's `showError` / `announceStatus` / `return` are NOT copied —
   * they are controller-coupled and cannot run standalone. Reaches
   * window.EmbedModelSelector at CALL time with the reference's guard, so it
   * runs headless (no embed required).
   *
   * @param {string} modelId - The model id actually about to be used.
   * @returns {boolean} true if the model can process images.
   */
  function isModelVisionCapable(modelId) {
    if (!modelId || typeof modelId !== "string") return false;

    // Derive the provider the same way the gate does: an explicit azure-openai
    // prefix routes to Foundry's chat surface, azure-responses to Foundry's
    // Responses surface; everything else routes via OpenRouter.
    const provider = modelId.startsWith("azure-openai/")
      ? "azure-openai"
      : modelId.startsWith("azure-responses/")
      ? "azure-responses"
      : "openrouter";

    // Primary: EmbedModelSelector vision eligibility (same source as the gate).
    if (
      window.EmbedModelSelector &&
      typeof window.EmbedModelSelector.getEligibleModels === "function"
    ) {
      try {
        const eligible = window.EmbedModelSelector.getEligibleModels({
          providerId: provider,
          capabilities: ["vision"],
        });
        if (Array.isArray(eligible) && eligible.length > 0) {
          // Non-empty list is authoritative: in-list => vision, absent => not.
          return eligible.some((m) => m && m.id === modelId);
        }
        // Empty list (selector misconfigured / nothing registered) — do NOT
        // conclude "not vision"; fall through to the membership fallback.
      } catch (error) {
        logWarn(
          "isModelVisionCapable: getEligibleModels failed, using fallback:",
          error,
        );
      }
    }

    // Fallback: KNOWN_VISION_MODELS membership (module-scope, shared list).
    return KNOWN_VISION_MODELS.includes(modelId);
  }

  // ===========================================================================
  // MODEL RESOLUTION (F2 selection — one resolved id, no picker UI)
  // ===========================================================================

  /**
   * Resolve ONE model id to send with. `options.model` wins when supplied;
   * otherwise read the active provider and select a vision model through
   * getEligibleModels({ capabilities: ["vision"] }) (the capability filter is
   * NOT optional), applying the reference's default-pick: prefer DEFAULT_MODEL
   * when eligible, else the first eligible model. Reaches ProviderSwitcher and
   * EmbedModelSelector at CALL time with guards; NO embed involved.
   *
   * @param {Object} [options]
   * @param {string} [options.model] - Explicit model id override.
   * @returns {string|null} A resolved model id, or NO_MODEL_RESOLVED (null) if
   *   nothing resolves (generate then refuses via the send-boundary re-check).
   */
  function _resolveModel(options) {
    const opts = options || {};

    // Explicit override wins.
    if (typeof opts.model === "string" && opts.model.trim()) {
      logDebug("_resolveModel: using explicit model option:", opts.model);
      return opts.model;
    }

    // Active provider (default 'openrouter' when the switcher is absent).
    const provider =
      window.ProviderSwitcher &&
      typeof window.ProviderSwitcher.getActive === "function"
        ? window.ProviderSwitcher.getActive()
        : "openrouter";

    // Vision-filtered eligible models for the active provider.
    let eligible = [];
    if (
      window.EmbedModelSelector &&
      typeof window.EmbedModelSelector.getEligibleModels === "function"
    ) {
      try {
        eligible = window.EmbedModelSelector.getEligibleModels({
          providerId: provider,
          capabilities: ["vision"],
        });
      } catch (error) {
        logWarn("_resolveModel: getEligibleModels failed:", error);
        eligible = [];
      }
    } else {
      logWarn("_resolveModel: EmbedModelSelector unavailable");
    }

    if (!Array.isArray(eligible) || eligible.length === 0) {
      logWarn(
        `_resolveModel: no eligible vision models for provider '${provider}' — returning sentinel`,
      );
      return NO_MODEL_RESOLVED;
    }

    // Default-pick ladder: preferred id if eligible, else first available.
    const preferred = eligible.find((m) => m && m.id === DEFAULT_MODEL);
    const resolved = preferred ? preferred.id : eligible[0].id;
    logDebug(
      `_resolveModel: resolved '${resolved}' for provider '${provider}' (${eligible.length} eligible)`,
    );
    return resolved;
  }

  // ===========================================================================
  // FACTORY — bind an injected embed
  // ===========================================================================

  /**
   * Create a cloud adapter instance bound to an INJECTED embed. The embed is
   * the only runtime dependency the generate path reaches beyond the guarded
   * globals; the re-check and resolution never touch it.
   *
   * @param {Object} [options]
   * @param {Object} options.embed - An OpenRouterEmbed-shaped instance exposing
   *   `attachFile(file)` and `sendRequest(prompt)`.
   * @returns {Object} instance with `generate(options)`.
   */
  function create(options) {
    const opts = options || {};
    const embed = opts.embed || null;

    if (!embed) {
      logWarn(
        "create(): no embed injected — generate() will error until one is supplied",
      );
    }

    /**
     * Generate an alt-text description for one image through the cloud embed,
     * returning a finalised 2.1 contract result.
     *
     * Order (send boundary enforced BEFORE any attach/send):
     *   1. resolve the model,
     *   2. re-check vision on the RESOLVED model — refuse (contract error) if
     *      false, with NO attach and NO send,
     *   3. attach the image,
     *   4. time + await the send,
     *   5. success → finalise(SOURCE.CLOUD, success),
     *   6. catch  → finalise(SOURCE.CLOUD, error).
     *
     * @param {Object} genOptions
     * @param {File|Blob} genOptions.image - The image to attach + describe.
     * @param {string} genOptions.prompt - The user prompt for the send.
     * @param {string} [genOptions.model] - Explicit model id override.
     * @returns {Promise<Object>} A finalised GenerationResult (contract 2.1).
     */
    async function generate(genOptions) {
      const g = genOptions || {};
      const contract = _contract();

      // 1. Resolve the single model id to use.
      const resolvedId = _resolveModel({ model: g.model });

      // 2. Send-boundary re-check on the RESOLVED model (F6). Refuse a
      //    non-vision model deterministically — no attach, no send.
      if (!isModelVisionCapable(resolvedId)) {
        logWarn(
          `generate(): refusing non-vision resolved model '${String(
            resolvedId,
          )}' at the send boundary`,
        );
        if (contract) {
          return contract.finalise(contract.SOURCE.CLOUD, {
            status: contract.STATUS.ERROR,
            error: NON_VISION_REFUSAL,
            model: resolvedId,
          });
        }
        // Defensive last resort only — the contract sibling loads before this
        // adapter, so it is present in practice. Shape matches an error result.
        return {
          text: null,
          status: "error",
          duration: null,
          model: resolvedId,
          source: "cloud-llm",
          reasoning: null,
          error: NON_VISION_REFUSAL,
        };
      }

      // A resolved, vision-capable model — proceed to attach + send.
      let sendStart = null;
      let duration = null;
      try {
        if (!embed || typeof embed.attachFile !== "function") {
          throw new Error(
            "Cloud embed is unavailable (no attachFile) — cannot generate",
          );
        }

        // 3. Attach the image.
        logDebug("generate(): attaching image to embed");
        await embed.attachFile(g.image);

        if (typeof embed.sendRequest !== "function") {
          throw new Error(
            "Cloud embed is unavailable (no sendRequest) — cannot generate",
          );
        }

        // 4. Time the send with Date.now() either side.
        logDebug("generate(): sending request via embed.sendRequest");
        sendStart = Date.now();
        const response = await embed.sendRequest(g.prompt);
        duration = Date.now() - sendStart;

        // 5. Success — map the confirmed raw fields into the contract. `text`
        //    and `reasoning` are top-level on the raw response; `duration` and
        //    `model` are the adapter's own (its timing, the resolved id).
        logDebug("generate(): send succeeded", { duration });
        if (contract) {
          return contract.finalise(contract.SOURCE.CLOUD, {
            text: response ? response.text : null,
            reasoning: response ? response.reasoning : null,
            duration,
            model: resolvedId,
            status: contract.STATUS.SUCCESS,
          });
        }
        // Defensive last resort (contract absent).
        return {
          text: response ? response.text ?? null : null,
          status: "success",
          duration,
          model: resolvedId,
          source: "cloud-llm",
          reasoning: response ? response.reasoning ?? null : null,
        };
      } catch (error) {
        // 6. Failure — map the caught message. finalise supplies
        //    DEFAULT_ERROR_MESSAGE when the message is empty. Duration is the
        //    send time when the send itself threw; null when attach threw first.
        if (sendStart != null && duration == null) {
          duration = Date.now() - sendStart;
        }
        const message = error && error.message ? error.message : "";
        logError("generate(): send failed", message || error);
        if (contract) {
          return contract.finalise(contract.SOURCE.CLOUD, {
            status: contract.STATUS.ERROR,
            error: message,
            model: resolvedId,
            duration,
          });
        }
        // Defensive last resort (contract absent).
        return {
          text: null,
          status: "error",
          duration,
          model: resolvedId,
          source: "cloud-llm",
          reasoning: null,
          error: message || "Unknown generation error",
        };
      }
    }

    return { generate };
  }

  logInfo("MathPixAltTextCloudAdapter ready (cloud generation adapter)");

  return {
    create,
    // Send-boundary re-check + resolution exposed at module level so they run
    // headless (no embed) — the 2.3 guard drives these directly.
    isModelVisionCapable,
    _resolveModel,
    // Frozen reference copy of the copied list for tests.
    KNOWN_VISION_MODELS: Object.freeze(KNOWN_VISION_MODELS.slice()),
    DEFAULT_MODEL,
    NON_VISION_REFUSAL,
  };
})();

window.MathPixAltTextCloudAdapter = MathPixAltTextCloudAdapter;
