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
 * @see mathpix-scripts/core/mathpix-model-capability.js (EA-4 — isModelVisionCapable and KNOWN_VISION_MODELS now live there, shared with the Image Describer)
 * @see image-describer/image-describer-controller-model.js (F6 source, and the other consumer of the shared list)
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
   * PREFERRED MODEL PER PROVIDER — the measured best on each service (AW-8,
   * 4 September 2026).
   *
   * WHAT CHANGED AND WHY. This was a single `DEFAULT_MODEL` of
   * `anthropic/claude-haiku-4.5`, mirroring the Image Describer's economical
   * default. Four measured rounds put that choice at the BOTTOM of the field:
   * AW-4r ranked eight models on three images, AW-5 held the model still and
   * varied the configuration, AW-6x widened to six models with a fresh judge,
   * and **AW-7c (commit `025ecdd`) settled it** — three survivors over all
   * eleven capacitors images, on the shipped configuration, judged blind by a
   * judge chosen to share a vendor with none of them. Its result:
   * `azure-openai/gpt-5.6-sol` first at 18.91 of 20, ahead of
   * `anthropic/claude-opus-5` and `anthropic/claude-sonnet-5`. The first place
   * is settled arithmetically — it beats the best case even of the model with
   * an unjudged cell — while second and third are NOT separated by that round.
   *
   * So the openrouter entry is `claude-sonnet-5` rather than `claude-opus-5`:
   * where the evidence does not separate two models it is not this map's job
   * to invent a separation, and sonnet is the cheaper and markedly faster of
   * the pair. The azure entry is the measured winner outright.
   *
   * ONLY TWO KEYS ARE NEEDED, and that is measured rather than assumed.
   *
   * ⚠ THE REASON GIVEN HERE WAS FALSE, AND IS CORRECTED AT AW-36 (comment
   * only — no behaviour in this file changes). It read: "`ProviderSwitcher.
   * KNOWN_PROVIDERS` carries exactly `openrouter` and `azure-openai`, so
   * `getActive()` returns nothing else." `getActive()` reads
   * `localStorage.getItem("selectedProvider")` and returns ANY non-null string
   * verbatim, with no membership test anywhere in it — the validation lives in
   * `setActive` alone, and `setActive` is not the only writer of that key.
   * AW-35 measured it on the live page: with `selectedProvider` set to
   * `azure-inference`, `getActive()` returned `"azure-inference"`. Four
   * ordinary routes reach that state — a profile carried over from a
   * superseded build (three of the six `RESERVED_PROVIDER_PREFIXES` are never
   * migrated), another page on the same un-namespaced origin, the `storage`
   * event handler (which does not validate `event.newValue` either), and the
   * standing AW-19 persistent-profile trap.
   *
   * TWO KEYS REMAIN CORRECT, for a different and stronger reason: this map is
   * a PREFERENCE consulted only against the vision-filtered eligible list, so
   * an id absent from it costs nothing. An unrecognised provider yields an
   * EMPTY eligible list, `_resolveModel` returns `NO_MODEL_RESOLVED` (null),
   * and `generate` refuses at the send boundary. The refusal is real and was
   * measured; only the premise above was wrong.
   *
   * `azure-responses` needs no key: it is never an ACTIVE provider, and the
   * `PROVIDER_GROUPS`
   * fold that makes its models eligible under `azure-openai` happens inside
   * `getEligibleModels`, on the eligible side of the ladder rather than this
   * one. A key for it would map to an `azure-openai/` id that could never be
   * eligible under its own provider id, so it would always miss and fall
   * through — a line that reads like coverage and provides none.
   *
   * An entry is a PREFERENCE, never a guarantee: it is used only when the id
   * is in the vision-filtered eligible list for the active provider, and the
   * ladder falls through to `eligible[0]` when it is not.
   */
  const PREFERRED_BY_PROVIDER = Object.freeze({
    openrouter: "anthropic/claude-sonnet-5",
    "azure-openai": "azure-openai/gpt-5.6-sol",
  });

  /** Exact refuse message for a non-vision resolved model (British spelling). */
  const NON_VISION_REFUSAL =
    "The selected model cannot process images. Choose a vision-capable model.";

  /**
   * Sentinel returned by _resolveModel when nothing resolves. Chosen as `null`
   * so it flows straight into isModelVisionCapable (which returns false for a
   * non-string), and generate then refuses via the standard send-boundary path.
   */
  const NO_MODEL_RESOLVED = null;

  /**
   * Returned in place of the shared list when the capability module is absent.
   * Frozen and module-scope so the getter below never hands back a fresh array
   * per access, which would make an identity assertion meaningless.
   */
  const EMPTY_VISION_LIST = Object.freeze([]);

  // ===========================================================================
  // KNOWN VISION MODELS — no longer here
  // ===========================================================================
  // The 27-entry list this file used to carry, copied verbatim from
  // image-describer-controller-model.js, MOVED to
  // mathpix-scripts/core/mathpix-model-capability.js at parcel EA-4. The two
  // copies were confirmed byte-identical immediately before the collapse, so
  // nothing was lost in merging them, and the drift this file's own comment
  // warned about can no longer happen: both consumers now read ONE frozen array
  // by reference.

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
  // VISION CAPABILITY RE-CHECK (F6 — both halves, now shared)
  // ===========================================================================

  /**
   * The shared capability module, reached at CALL time. Returns null (with an
   * ERROR) if absent — its script tag precedes this file in tools.html, so an
   * absence is a page-configuration fault rather than a capability result.
   */
  function _capability() {
    const c = window.MathPixModelCapability;
    if (!c || typeof c.isModelVisionCapable !== "function") {
      logError(
        "MathPixModelCapability unavailable at call time — the shared vision predicate cannot be consulted",
      );
      return null;
    }
    return c;
  }

  /**
   * Vision-capability predicate — MOVED to
   * mathpix-scripts/core/mathpix-model-capability.js at parcel EA-4, together
   * with the 27-entry KNOWN_VISION_MODELS list this file used to carry a
   * verbatim copy of. Both halves of the F6 decision moved with it unchanged:
   * the prefix-derived provider, the non-empty-list-is-authoritative rule, the
   * EMPTY-list fall-through, the thrown-selector fall-through and the
   * membership fallback. Read the decision table there.
   *
   * This wrapper survives because the 2.3 guard and the orchestrator suite
   * drive `MathPixAltTextCloudAdapter.isModelVisionCapable` directly, and this
   * parcel changes no consumer.
   *
   * @deprecated Use window.MathPixModelCapability.isModelVisionCapable.
   * @param {string} modelId - The model id actually about to be used.
   * @returns {boolean} true if the model can process images. False when the
   *   shared module is absent — with no authority to consult, a refusal is the
   *   honest answer, and generate() then refuses via the standard send boundary.
   */
  function isModelVisionCapable(modelId) {
    const cap = _capability();
    if (!cap) return false;
    return cap.isModelVisionCapable(modelId);
  }

  // ===========================================================================
  // MODEL RESOLUTION (F2 selection — one resolved id, no picker UI)
  // ===========================================================================

  /**
   * Resolve ONE model id to send with. `options.model` wins when supplied;
   * otherwise read the active provider and select a vision model through
   * getEligibleModels({ capabilities: ["vision"] }) (the capability filter is
   * NOT optional), applying the default-pick: prefer the ACTIVE PROVIDER'S
   * entry in PREFERRED_BY_PROVIDER when that id is eligible, else the first
   * eligible model (AW-8; this rung read a single cross-provider DEFAULT_MODEL
   * before). Reaches ProviderSwitcher and
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

    // Default-pick ladder: the ACTIVE PROVIDER'S preferred id if eligible,
    // else first available. The rung is unchanged in shape and position; only
    // the id it looks for is now per-provider (AW-8).
    const preferredId = PREFERRED_BY_PROVIDER[provider];
    const preferred = preferredId
      ? eligible.find((m) => m && m.id === preferredId)
      : undefined;
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
     *   2b. APPLY the resolved model to the embed (AW-1) — after the re-check,
     *      so a refused model never reaches the embed, and before the attach,
     *      so the send provably goes out on the id the result reports,
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

        // ---- Apply the resolved model to the embed (AW-1, 31 August 2026) ---
        // THE DEFECT THIS CLOSES. Everything above resolves, re-checks and
        // records `resolvedId`, and the finalised result reports it as the model
        // used — but nothing ever told the embed. `sendRequest` reads
        // `this.model`, and the edit view constructs its embed with no `model`
        // key at all (mathpix-image-manager-ui.js `_constructEditAltEmbed`), so
        // the send went out on the embed-core default. Measured 31 August 2026
        // in a Node shim with ProviderSwitcher forced to 'azure-openai':
        // result.model read "azure-openai/gpt-5.4-mini" while the model at send
        // read the stub's untouched sentinel. The two agreed only by accident,
        // whenever the resolution happened to land on the default id.
        //
        // PLACED AFTER the send-boundary re-check and BEFORE attachFile, so a
        // refused model can never reach the embed at all — the refusal path
        // returns above this line and leaves `embed.model` exactly as it found
        // it, which is what the zero canary in the suite asserts.
        //
        // setModel WHEN IT EXISTS, a direct assignment otherwise. This is not
        // defensive padding: the suite's stub embeds, and any future caller
        // injecting a plain object, expose only attachFile and sendRequest, so a
        // bare `embed.setModel(...)` would throw a TypeError straight into the
        // catch below and turn what should be a successful generate into a
        // contract error. The real OpenRouterEmbed carries setModel, which
        // validates the id and logs the transition, so the live path takes that
        // branch and the stubs take the assignment.
        //
        // Scoped deliberately: the ONLY pre-existing adapter row that calls
        // generate() is the send-boundary refusal row, and it refuses above this
        // line, so a bare call would not have reddened it. The row that would go
        // red is the no-setModel one added with this fix, which exists for
        // exactly that reason.
        if (typeof embed.setModel === "function") {
          embed.setModel(resolvedId);
        } else {
          embed.model = resolvedId;
        }
        logDebug("generate(): applied the resolved model to the embed", {
          model: resolvedId,
          via: typeof embed.setModel === "function" ? "setModel" : "assignment",
        });

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
    /**
     * The shared frozen list, BY REFERENCE — deliberately not a copy. Before
     * EA-4 this exported `Object.freeze(list.slice())`, defending a local array
     * that no longer exists; a copy now would defeat the very property the
     * collapse bought, which is that this adapter and the Image Describer read
     * the same array identity and cannot drift.
     *
     * @deprecated Use window.MathPixModelCapability.KNOWN_VISION_MODELS.
     */
    get KNOWN_VISION_MODELS() {
      const cap = _capability();
      return cap ? cap.KNOWN_VISION_MODELS : EMPTY_VISION_LIST;
    },
    PREFERRED_BY_PROVIDER,
    NON_VISION_REFUSAL,
  };
})();

window.MathPixAltTextCloudAdapter = MathPixAltTextCloudAdapter;
