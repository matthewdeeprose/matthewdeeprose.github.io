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
   * The purpose this seam asks the shared registry about (parcel I5-3).
   *
   * Named rather than inlined for the reason the enhancer and the Context tab
   * each name their own (`AI_ENHANCER_CONFIG.RECOMMENDATION_PURPOSE` at I5-1,
   * `RECOMMENDATION_PURPOSE` in mathpix-context-ai.js at I5-2): a bare string
   * at the call site is a magic value, and the registry REFUSES an
   * unrecognised purpose, so a typo resolves null and reads as "this provider
   * has no preference" rather than as "this file asked the wrong question".
   *
   * It must equal `MathPixModelRegistry.PURPOSES.ALT_TEXT`. It is NOT read off
   * that module, because a capture of a global published by another script is
   * the dead-announcer shape, and because a constant that reads its own
   * expected value from the thing it is checked against can never disagree
   * with it — which is the same reason the suite pins the ids as literals.
   */
  const RECOMMENDATION_PURPOSE = "alt-text";

  /**
   * The model this provider PREFERS for alt text — the ONE read of the shared
   * `window.MathPixModelRegistry` in this file, asking it for the `alt-text`
   * purpose (parcel I5-3; previously a local frozen `PREFERRED_BY_PROVIDER`
   * map, AW-8).
   *
   * THE LOCAL MAP IS DELETED, NOT LEFT BESIDE THIS, and so is the entry that
   * exported it from this module's public API. A second copy holding the same
   * two ids answers identically to the registry, so no behavioural row
   * anywhere could see one — which is exactly how the third copy drifts. The
   * absence is asserted against this file's own source text instead.
   *
   * THE IDS ARE MEASURED, NOT PREFERRED, AND THEY HAVE NOT CHANGED.
   * `anthropic/claude-sonnet-5` on openrouter and `azure-openai/gpt-5.6-sol`
   * on azure-openai, settled across AW-4r to AW-7ck on 3 September 2026 —
   * three survivors over all eleven capacitors images, on the shipped
   * configuration, judged blind by a judge sharing a vendor with none of them,
   * `gpt-5.6-sol` first outright at 18.91 of 20. The openrouter entry is
   * sonnet rather than opus because that round did not separate second from
   * third and sonnet is the cheaper and markedly faster of the pair. The
   * evidence now lives in the registry entry beside the ids, together with the
   * round and the date, rather than in a comment here that a re-point would
   * leave behind.
   *
   * THE DIVERGENCE IS CORRECT AND MUST SURVIVE. Alt text prefers sonnet-5 on
   * openrouter where the `mmd-correction` and `context` purposes both prefer
   * `anthropic/claude-fable-5` on the same provider. Different tasks, measured
   * in different rounds, with different winners. The purpose dimension is what
   * makes that EXPRESSIBLE rather than accidental, and a later parcel must not
   * collapse the three to one value on the grounds that it looks like a
   * tidy-up.
   *
   * AN ENTRY IS A PREFERENCE, NEVER A GUARANTEE. The id it names is used only
   * when it appears in the vision-filtered eligible list for the active
   * provider; `_resolveModel` falls through to `eligible[0]` when it does not.
   * That is unchanged by this parcel.
   *
   * AN UNRECOGNISED PROVIDER RETURNS null, and no cross-provider borrow may be
   * reintroduced here or in the registry. The contract is the one all three
   * seams settled on at AW-36 and it is NOT reopened by this parcel. The
   * refusal a person meets is unchanged in shape too: an unrecognised provider
   * yields an EMPTY eligible list, so `_resolveModel` returns
   * `NO_MODEL_RESOLVED` at the eligible-list gate BEFORE this preference is
   * ever consulted, and `generate` refuses at the send boundary.
   *
   * Reached at CALL time and never captured — the same reason the provider is.
   * A module-scope capture of a global published by another script captures
   * undefined when the script order moves, which is the shape AGENTS.md
   * records ten dead call sites of.
   *
   * @param {string} providerId the ACTIVE provider, passed in by the caller
   * @returns {string|null} a model id, or null for a provider the registry has
   *   no entry for under this purpose, and null when the registry is absent
   */
  function _preferredModelForProvider(providerId) {
    // FAIL CLOSED, NEVER OPEN. A hardcoded id in either branch below would be
    // the private copy this parcel exists to remove, reinstated one
    // indirection further from the resolver and therefore harder to find.
    // null flows into the existing ladder, whose next rung is `eligible[0]` —
    // which is precisely what an absent preference has always meant here.
    const registry = window.MathPixModelRegistry;
    const found =
      registry && typeof registry.recommendedModel === "function"
        ? registry.recommendedModel(RECOMMENDATION_PURPOSE, providerId)
        : null;

    if (!found || typeof found.modelId !== "string") {
      // ONE WARNING COVERING BOTH CAUSES, AND IT NAMES WHICH IT IS, on the
      // I5-1 and I5-2 precedent. The absent-module case is unreachable on a
      // normally loaded page, because the registry's script tag PRECEDES this
      // file's in tools.html — stated as an ORDER and deliberately not as two
      // line numbers, which drift every time another lane edits that file and
      // were already stale within an hour of being written at I5-2. So it is
      // reported loudly rather than silently. Both spellings carry "no
      // preference registered for provider", which is what the suite's rows
      // match on; the clause in front of it is what tells a reader whether to
      // look at the registry's contents or at the page's script order.
      logWarn(
        registry
          ? `_preferredModelForProvider: no preference registered for provider '${providerId}'; returning null rather than borrowing another provider's id.`
          : `_preferredModelForProvider: the shared model registry is absent from the page, so no preference registered for provider '${providerId}'; returning null rather than borrowing another provider's id.`,
      );
      return null;
    }
    return found.modelId;
  }

  /**
   * Is the shared model registry MODULE absent from the page?
   *
   * PARCEL CF-1, 14 September 2026. THE TWO CONDITIONS THIS SEPARATES ARE NOT
   * THE SAME FAULT, AND UNTIL THIS HELPER EXISTED THE RESOLVER COULD NOT TELL
   * THEM APART.
   *
   *   CONDITION A — an absent PREFERENCE for a provider whose eligible list is
   *   healthy. The registry is there and has no alt-text entry for this
   *   provider. Falling through to `eligible[0]` is long-standing behaviour,
   *   it is what an absent preference has always meant here, and CF-1 leaves it
   *   EXACTLY as it was. `_preferredModelForProvider` still returns null for
   *   it, the find below still misses, and `eligible[0]` still wins.
   *
   *   CONDITION B — an absent or unreadable REGISTRY MODULE. The system does
   *   not know what it prefers for ANY purpose on ANY provider. Falling through
   *   is wrong: the measured choice is not merely missing for this provider,
   *   the whole record of measured choices is gone.
   *
   * BOTH ARRIVE AT `_preferredModelForProvider` AS A BARE `null`, which is why
   * the rung could not distinguish them and why this is a SEPARATE predicate
   * rather than a widened return. That helper's signature is unchanged and its
   * two-clause warning is unchanged — three suite rows and one measurement
   * probe read it, and a wider return type would have reached all of them.
   *
   * WHAT IT COST, MEASURED. With the registry deleted from the page,
   * `_resolveModel` resolved `amazon/nova-lite-v1` — the first of 154
   * vision-eligible models — and generation proceeded on it, writing
   * descriptions into the MMD. A person saw and heard NOTHING: no refusal, no
   * toast, no status line, only a console warning. Alt text is the
   * accessibility-critical output of this toolset, so a model nobody measured
   * writing it unannounced is the worst shape this seam can fail in.
   *
   * Reached at CALL time and never captured — the same reason the provider and
   * the registry itself are.
   *
   * @returns {boolean} true when nothing on the page can answer a preference
   */
  function _modelRegistryIsAbsent() {
    const registry = window.MathPixModelRegistry;
    return !registry || typeof registry.recommendedModel !== "function";
  }

  /** Exact refuse message for a non-vision resolved model (British spelling). */
  const NON_VISION_REFUSAL =
    "The selected model cannot process images. Choose a vision-capable model.";

  /**
   * Exact refuse message for an ABSENT REGISTRY MODULE (parcel WL-1,
   * 14 September 2026; British spelling).
   *
   * A SECOND CONSTANT, NOT A REPLACEMENT, AND THAT IS THE WHOLE POINT.
   * `NON_VISION_REFUSAL` is reached by THREE conditions — a caller-supplied
   * non-vision `options.model`, a provider whose eligible vision list is empty,
   * and CF-1's absent registry module — and it is CORRECT for the first two.
   * Replacing its text would have made the vision case start lying, so the
   * sharing is separated at `generate` instead and each condition keeps the
   * sentence that is true of it.
   *
   * WHY THE TAIL IS NOT DROPPED to share one sentence with the Context tab.
   * The first clause is RF-1's, shipped and heard at RF-2, and it names the
   * condition a person can act on. The tail names WHICH workflow stopped, and
   * that is the half that tells someone whether to go and look at their
   * description or at their context fields. A shared sentence would have to
   * lose it.
   *
   * WHAT IT REPLACES, AND WHY CF-1 DID NOT REPLACE IT ITSELF. CF-1 reused
   * `NON_VISION_REFUSAL` for this condition and recorded in its own comment
   * that the wording was KNOWN WRONG — it sends a person hunting for a
   * vision-capable model when no model was selected at all and nothing they can
   * do to the MODEL fixes a page-configuration fault. Correcting it owed a
   * screen-reader listen, which is this parcel.
   */
  const ABSENT_REGISTRY_REFUSAL =
    "No AI model is set up for the AI provider you have selected, so no description can be written.";

  /**
   * The provider stop signals that mean the reply was CUT OFF (parcel PB-3,
   * 27 September 2026). Matched case-insensitively against the embed's
   * top-level `finishReason`, which AW-23 carries through unchanged from the
   * wire on both the streaming and the non-streaming path. OpenRouter
   * normalises every provider's own reason to the OpenAI-canonical "length"
   * (Anthropic's native "max_tokens" arrives as "length"), so one value is the
   * whole list — the same list the enhancer refuses on
   * (PROVIDER_CUT_FINISH_REASONS in mathpix-ai-enhancer.js). A local copy
   * rather than a reach into that module, which sits in another layer.
   *
   * WHY THE ADAPTER AND NOT THE ORCHESTRATOR. The parser never fails: a cut
   * reply parses to whatever sections arrived, and the write stage writes
   * them. Measured at PB-3 by replaying PB-2 cell 11 (190 characters, 1,918 of
   * its 2,000 tokens spent reasoning) through the shipped path: a 41-character
   * title and a 120-character alt text cut mid-word were written to the
   * registry and "Two descriptions written." was spoken as a success. Only the
   * adapter holds the stop signal, so only the adapter can refuse on it.
   */
  const PROVIDER_CUT_FINISH_REASONS = Object.freeze(["length"]);

  /**
   * The `reason` a refused cut-off reply carries on its failed result (PB-3).
   * A field ADDED to the finalised contract result, because the contract's
   * `error` slot is the SPOKEN line and must not carry a new sentence here:
   * the refusal speaks the contract's existing DEFAULT_ERROR_MESSAGE through
   * the orchestrator's existing error path, unchanged. Whether a line is
   * written changed, not its wording (the AW-29 precedent).
   */
  const TRUNCATED_REASON = "truncated";

  /**
   * The `reason` codes the two fixed refusals carry on their failed results
   * (parcel MA-5c-2, 28 September 2026). Added beside PB-3's, for the same
   * reason: the `error` slot is the sentence and must not be parsed to find
   * out which condition refused. The orchestrator maps a failed result to the
   * sentence a person hears by these codes and by `httpStatus`, never by the
   * text. Neither refusal's sentence changes.
   */
  const ABSENT_REGISTRY_REASON = "absent-registry";
  const NON_VISION_REASON = "non-vision";

  /**
   * The HTTP status a thrown send failure carried, or null (MA-5c-2).
   *
   * The two providers throw different shapes, measured in the live tree:
   * the OpenRouter stream client throws an OpenRouterClientError with the
   * status at `metadata.status` (its API_ERROR site), and the Foundry
   * provider throws a plain Error with the status at `status` (both its
   * streaming and its non-streaming request). A dropped connection throws a
   * TypeError with neither. Only an integer of 400 or more counts: anything
   * else is not an HTTP failure and the result carries no status at all.
   *
   * @param {*} error - whatever the send threw
   * @returns {number|null}
   */
  function _httpStatusOf(error) {
    const status =
      error && error.metadata && error.metadata.status != null
        ? error.metadata.status
        : error && error.status;
    return Number.isInteger(status) && status >= 400 ? status : null;
  }

  /**
   * Did the provider say it cut this reply off?
   *
   * An absent, null or non-string reason is NOT a cut: the embed reports null
   * when the wire carried no reason, and refusing on that would refuse every
   * reply from a transport that sends none.
   *
   * @param {Object|null} response - the object `embed.sendRequest` resolved
   * @returns {boolean}
   */
  function _replyWasCutOff(response) {
    const reason = response ? response.finishReason : null;
    return (
      typeof reason === "string" &&
      PROVIDER_CUT_FINISH_REASONS.includes(reason.toLowerCase())
    );
  }

  /**
   * Sentinel returned by _resolveModel when nothing resolves. Chosen as `null`
   * so it flows straight into isModelVisionCapable (which returns false for a
   * non-string), and generate then refuses via the standard send-boundary path.
   */
  const NO_MODEL_RESOLVED = null;

  // ===========================================================================
  // MP-2 — THE USER'S OWN MODEL CHOICE (module scope, not persisted)
  // ===========================================================================
  //
  // MIRRORS mathpix-context-ai.js's MP-1 arrangement exactly, and for the same
  // reasons — module scope rather than a property of an instance, because this
  // module is `"use strict"` and both `_resolveModel` and `generate` are called
  // in ways a `this`-bound read would not survive; and NOT PERSISTED, because
  // the alt-text workflow writes no localStorage key today (confirmed empty at
  // MP-2) and a choice that does not outlive the page cannot be restored under
  // a provider that does not serve it — the strongest available form of the
  // fail-safe the picker owes. The ACTIVE provider itself IS carried between
  // page loads by the browser profile (AGENTS.md § Testing), which is exactly
  // why every check below reads the live predicates rather than trusting
  // anything stored.

  /** The user's own pick, or null. Set only through _setUserModelChoice. */
  let _userModelChoice = null;

  // ---------------------------------------------------------------------------
  // Adapter changes below continue in the RESOLUTION section (_resolveModel).
  // ---------------------------------------------------------------------------

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

  /**
   * Is this model served by the provider the user currently has selected?
   *
   * MP-2's own reach into the shared module, on the SAME facade shape as
   * `isModelVisionCapable` above: reached at CALL time, guarded, false when
   * the authority is absent. Needed for `_resolveUserChoice` and
   * `_setUserModelChoice` — a picker's override list is filtered by
   * `isModelVisionCapable` alone (matching `getEligibleModels`'s own
   * per-provider scoping), but a STORED choice must be re-validated against
   * BOTH predicates on every resolve, because the active provider can change
   * after the choice was made.
   *
   * @param {string} modelId
   * @returns {boolean}
   */
  function _isModelProviderAvailable(modelId) {
    const shared = window.MathPixModelCapability;
    if (!shared || typeof shared.isModelProviderAvailable !== "function") {
      return false;
    }
    return shared.isModelProviderAvailable(modelId);
  }

  /**
   * May the resolved model be sent the reasoning off switch? (parcel MA-5b)
   *
   * Asks the shared module's reasoningOffAccepted, reached at CALL time like
   * every other predicate here, because the capability module may load after
   * this file. If the module or the predicate is absent the answer is false
   * and ONE warning is logged for this send: no switch is the body this adapter
   * sent before PB-5b, so an absent authority costs tokens and never costs the
   * request, which is what sending the switch to a model that requires
   * reasoning does (anthropic/claude-fable-5, HTTP 400, MA-4).
   *
   * @param {string} modelId - the resolved id about to be sent.
   * @returns {boolean}
   */
  function _reasoningOffAccepted(modelId) {
    const shared = window.MathPixModelCapability;
    if (!shared || typeof shared.reasoningOffAccepted !== "function") {
      logWarn(
        "generate(): MathPixModelCapability.reasoningOffAccepted is unavailable, so the reasoning off switch is not sent.",
        { model: modelId },
      );
      return false;
    }
    return shared.reasoningOffAccepted(modelId) === true;
  }

  /**
   * The embed's provider ids, mapped to the two the shared module's
   * outputBudgetFor speaks. Both Foundry surfaces fold to "foundry"; any other
   * id passes through unchanged and earns the 2000 default there.
   */
  const OUTPUT_BUDGET_PROVIDER = Object.freeze({
    openrouter: "openrouter",
    "azure-openai": "foundry",
    "azure-responses": "foundry",
  });

  /**
   * The ceiling this adapter sent before MA-12a, and the one it sends when the
   * shared module cannot name a budget. Written to the embed explicitly rather
   * than left to it, because a reused embed can carry a stale value from an
   * earlier send.
   */
  const HISTORICAL_OUTPUT_BUDGET = 2000;

  /**
   * Write the ceiling onto the embed. setMaxTokens when it exists, an
   * assignment otherwise, the same split as setModel.
   *
   * @param {object} embed - the embed about to send.
   * @param {number} value - the completion-token ceiling.
   */
  function _applyMaxTokens(embed, value) {
    if (typeof embed.setMaxTokens === "function") {
      embed.setMaxTokens(value);
    } else {
      embed.max_tokens = value;
    }
  }

  /**
   * The completion-token ceiling for the resolved model (parcel MA-12a), or
   * null when the shared module cannot say.
   *
   * Reached at CALL time like every other predicate here. If the module or
   * outputBudgetFor is absent the answer is null and ONE warning is logged for
   * this send: the caller then writes HISTORICAL_OUTPUT_BUDGET explicitly.
   *
   * @param {string} modelId - the resolved id about to be sent.
   * @param {object|null} routed - the embed's provider, read after setModel.
   * @returns {number|null}
   */
  function _outputBudget(modelId, routed) {
    const shared = window.MathPixModelCapability;
    if (!shared || typeof shared.outputBudgetFor !== "function") {
      logWarn(
        "generate(): MathPixModelCapability.outputBudgetFor is unavailable, so max_tokens is set to the historical 2000.",
        { model: modelId },
      );
      return null;
    }
    const routedId = routed && typeof routed.id === "string" ? routed.id : null;
    const providerId = Object.prototype.hasOwnProperty.call(
      OUTPUT_BUDGET_PROVIDER,
      routedId,
    )
      ? OUTPUT_BUDGET_PROVIDER[routedId]
      : routedId;
    const budget = shared.outputBudgetFor(modelId, providerId);
    return Number.isFinite(budget) && budget > 0 ? budget : null;
  }

  /**
   * The user's pick, re-validated against the live predicates — or null.
   *
   * THE SECOND OF TWO INDEPENDENT GUARDS (MP-2, mirroring MP-1). The first is
   * the picker's own provider-change rebuild in mathpix-image-manager-ui.js,
   * which clears the pick outright; this one re-asks both send-boundary
   * predicates on every resolve, so the discard does not depend on that
   * handler having fired, having been subscribed, or having run before the
   * click. A single guard that silently stops running is indistinguishable
   * from one that is working.
   *
   * @returns {string|null}
   */
  function _resolveUserChoice() {
    const chosen = _userModelChoice;
    if (!chosen) return null;

    if (!isModelVisionCapable(chosen) || !_isModelProviderAvailable(chosen)) {
      logWarn(
        `_resolveUserChoice: the chosen model '${chosen}' is not served by the active provider or cannot process images; discarding the choice and falling back to the measured preference.`,
      );
      _userModelChoice = null;
      return null;
    }
    return chosen;
  }

  /**
   * Record the user's pick, refusing anything the send would refuse.
   *
   * VALIDATES AT THE CONTROL AS WELL AS AT THE RESOLVER, matching MP-1. The
   * picker only ever offers ids that pass both predicates, so a refusal here
   * means the page state moved underneath the control.
   *
   * @param {string|null} modelId null or "" clears the pick
   * @returns {boolean} true when the choice was recorded or cleared
   */
  function _setUserModelChoice(modelId) {
    if (!modelId) {
      _userModelChoice = null;
      logDebug("Alt-text model choice cleared; the measured preference applies.");
      return true;
    }
    if (typeof modelId !== "string" || !modelId.trim()) {
      logWarn("_setUserModelChoice: refusing a model id that is not a string.", {
        modelId,
      });
      return false;
    }
    if (!isModelVisionCapable(modelId) || !_isModelProviderAvailable(modelId)) {
      logWarn(
        `_setUserModelChoice: refusing '${modelId}' — the active provider does not serve it, or it cannot process images.`,
      );
      return false;
    }
    _userModelChoice = modelId;
    logInfo("Alt-text model choice set by the user", { model: modelId });
    return true;
  }

  /** The user's current pick, or null. Exported so a row can read it. */
  function _getUserModelChoice() {
    return _userModelChoice;
  }

  // ===========================================================================
  // MODEL RESOLUTION (F2 selection — one resolved id, no picker UI)
  // ===========================================================================

  /**
   * Resolve ONE model id to send with. `options.model` wins when supplied;
   * otherwise read the active provider and select a vision model through
   * getEligibleModels({ capabilities: ["vision"] }) (the capability filter is
   * NOT optional), applying the default-pick: prefer the ACTIVE PROVIDER'S
   * preference for the `alt-text` purpose when that id is eligible, else the
   * first eligible model (AW-8 made the rung per-provider; I5-3 moved the
   * lookup onto the shared registry and deleted this file's own map). Reaches
   * ProviderSwitcher and EmbedModelSelector at CALL time with guards; NO embed
   * involved.
   *
   * CF-1 added ONE rung and moved none: an absent registry MODULE returns the
   * sentinel rather than falling through. An absent PREFERENCE on a present
   * registry is untouched and still takes `eligible[0]`.
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

    // MP-2: THE USER'S OWN PICK OUTRANKS THE MEASURED PREFERENCE, and it is
    // the FIRST rung after an explicit override rather than a filter applied
    // to a later one — mirrors mathpix-context-ai.js's MP-1 placement exactly.
    // It can still return null (nothing chosen, or a stale choice the active
    // provider no longer serves), in which case every rung below runs exactly
    // as it did before this parcel. FAIL SAFE, not fail open: the discard
    // narrows the choice back to the measured preference, never widens it to
    // a model nobody checked.
    const userPick = _resolveUserChoice();
    if (userPick) {
      logDebug("_resolveModel: using the user's own pick:", userPick);
      return userPick;
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

    // ---- CF-1: AN ABSENT REGISTRY MODULE REFUSES, IT DOES NOT FALL THROUGH --
    //
    // KEYED ON THE MODULE, NEVER ON A NULL PREFERENCE. That distinction is the
    // whole parcel: a null preference means "this provider has no measured
    // winner", which has always meant take the first eligible model, and an
    // absent module means "nothing on this page knows what any provider
    // prefers". Both reach `_preferredModelForProvider` as a bare null, so a
    // guard written on the preference would refuse for BOTH and silently
    // retire condition A's long-standing behaviour. `_modelRegistryIsAbsent`
    // asks the question the rung actually needs answering.
    //
    // ORDERING, DELIBERATE ON BOTH SIDES. It sits BELOW the explicit
    // `options.model` override, because a caller-supplied id is a deliberate
    // choice that owes the registry nothing. It sits BELOW the eligible-list
    // gate, so that gate's refusal — the shipped one, which row 7 pins — fires
    // first and unchanged when both conditions hold at once.
    //
    // THE SENTINEL, NOT A NEW SURFACE. Returning NO_MODEL_RESOLVED puts this
    // refusal on the path the eligible-list gate already uses:
    // `isModelVisionCapable(null)` is false, `generate` refuses at the send
    // boundary with NO ATTACH AND NO SEND, and the existing status line is
    // written. CF-1 introduces no wording of its own.
    //
    // THE WORDING IS CORRECTED AT WL-1 (14 September 2026), and the correction
    // is made HERE rather than by re-asking the predicate in `generate`.
    // Re-asking would answer the wrong question when BOTH conditions hold at
    // once: the empty-eligible-list gate above returns first and its refusal is
    // the shipped one, so a predicate consulted afterwards would overwrite a
    // correct sentence with this one. Recording the reason on the rung that
    // fired preserves CF-1's deliberate ordering by construction.
    //
    // `opts.reason` IS AN OPTIONAL OUT-PARAMETER AND CHANGES NO SIGNATURE.
    // `_resolveModel` is EXPORTED and read by at least six measurement drives
    // plus the suite, all of which treat the return as a string id or null and
    // pass either `{}` or `{ model }`. Its arity, its return type and every one
    // of those call sites are untouched: a caller that supplies no `reason`
    // simply has nothing written back, which is what all of them do.
    if (_modelRegistryIsAbsent()) {
      if (opts.reason && typeof opts.reason === "object") {
        opts.reason.registryAbsent = true;
      }
      // logError, NOT the logWarn `_preferredModelForProvider` uses for an
      // absent preference. THE TWO PATHS MUST NOT PRODUCE THE SAME MESSAGE:
      // one is a data gap in a module that is present and working, the other
      // is the module missing from the page altogether, and only the second is
      // a page-configuration fault that stops generation.
      logError(
        `_resolveModel: the shared model registry module is absent from the page, so no measured preference can be read for any provider — refusing to generate rather than falling through to the first eligible model. This is a page-configuration fault: check the script order in tools.html.`,
      );
      return NO_MODEL_RESOLVED;
    }

    // Default-pick ladder: the ACTIVE PROVIDER'S preferred id if eligible,
    // else first available. THE RUNG IS UNCHANGED IN SHAPE AND POSITION. AW-8
    // made the id it looks for per-provider; I5-3 moved WHERE that id is read
    // from onto the shared registry, and `preferredId` can now be null for a
    // provider the registry has no alt-text entry for. Do NOT add an early
    // return on a null `preferredId` — the falsy guard below already skips the
    // find, and the fall-through to `eligible[0]` is what an absent preference
    // has always meant here. CF-1's refusal above is keyed on the MODULE and
    // deliberately not on this value, so this rung is reached exactly as often
    // as it was before.
    const preferredId = _preferredModelForProvider(provider);
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
     *   4b. a reply the provider cut off (finishReason "length") → finalise
     *      (SOURCE.CLOUD, error) with reason "truncated" and the raw text kept
     *      (PB-3),
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

      // 1. Resolve the single model id to use. The `reason` object is WL-1's
      //    out-parameter: `_resolveModel` writes into it on the rung that
      //    fired, so the sentence below names the condition that actually
      //    refused rather than one re-derived afterwards.
      const reason = {};
      const resolvedId = _resolveModel({ model: g.model, reason });

      // 2. Send-boundary re-check on the RESOLVED model (F6). Refuse a
      //    non-vision model deterministically — no attach, no send.
      if (!isModelVisionCapable(resolvedId)) {
        // WL-1: ONE OF TWO SENTENCES, chosen by which rung refused. An absent
        // registry module gets the honest sentence; everything else keeps the
        // shipped one, so a genuinely non-vision model is still told exactly
        // what it was told before and the vision advice stays true.
        const refusal = reason.registryAbsent
          ? ABSENT_REGISTRY_REFUSAL
          : NON_VISION_REFUSAL;
        // MA-5c-2: the code travels beside the sentence, chosen by the same
        // rung, so the two can never disagree.
        const refusalReason = reason.registryAbsent
          ? ABSENT_REGISTRY_REASON
          : NON_VISION_REASON;
        logWarn(
          `generate(): refusing resolved model '${String(
            resolvedId,
          )}' at the send boundary`,
          { registryAbsent: !!reason.registryAbsent },
        );
        const refused = contract
          ? contract.finalise(contract.SOURCE.CLOUD, {
              status: contract.STATUS.ERROR,
              error: refusal,
              model: resolvedId,
            })
          : {
              // Defensive last resort only — the contract sibling loads before
              // this adapter, so it is present in practice. Shape matches an
              // error result.
              text: null,
              status: "error",
              duration: null,
              model: resolvedId,
              source: "cloud-llm",
              reasoning: null,
              error: refusal,
            };
        refused.reason = refusalReason;
        return refused;
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

        // ---- PB-5b: reasoning OFF on OpenRouter, never on Foundry ------------
        // With no reasoning field, anthropic/claude-sonnet-5 reasoned on 5 of 6
        // alt-text cells and ran out of tokens on 4 (PB-4); with reasoning off
        // it reasoned on none. So an OpenRouter send asks for it off, through
        // the embed's sendReasoningOff opt-in.
        //
        // Keyed on the provider the RESOLVED model routes to, read off the embed
        // after the model is applied. That is the active provider on every
        // resolved path (the picker and the ladder only offer the active
        // provider's models), and it stays correct for an explicit model
        // override. Assigned on EVERY send, true or false, because the edit view
        // reuses one embed across provider switches. An injected stub with no
        // provider getter is left untouched.
        //
        // MA-5b: AND only when the resolved model accepts the switch. 42 of
        // the 154 OpenRouter ids the picker offers declare reasoning mandatory,
        // and anthropic/claude-fable-5 answered the switch with HTTP 400
        // (MA-4, MA-5). The shared module holds the list of ids that may
        // receive it; every other id is sent no reasoning field.
        if ("provider" in embed) {
          const routed = embed.provider;
          const routedToOpenRouter = !!routed && routed.id === "openrouter";
          const offAccepted = routedToOpenRouter
            ? _reasoningOffAccepted(resolvedId)
            : false;
          const sendOff = routedToOpenRouter && offAccepted;
          embed.sendReasoningOff = sendOff;
          logDebug("generate(): reasoning off switch", {
            provider: routed ? routed.id : null,
            model: resolvedId,
            sendReasoningOff: sendOff,
          });

          // ---- MA-12a: the output budget ---------------------------------------
          // A mandatory-reasoning model spends completion tokens on reasoning that
          // cannot be switched off, and the embed's shipped 2000 counts them:
          // anthropic/claude-opus-5.5 finished `length` on 4 of 33 cells at
          // exactly 2000 (MA-10). The shared module says 3000 for those and for
          // every Foundry id, 2000 otherwise. Assigned on EVERY send for the
          // reason sendReasoningOff is: the edit view reuses one embed across
          // model and provider switches, so a 3000 must not outlive its model.
          // Reaches the wire as max_tokens on OpenRouter and as
          // max_completion_tokens on Foundry, through buildOptions and each
          // provider's buildRequest. When the module cannot name a budget the
          // historical 2000 is written explicitly, never left to the embed.
          const budget = _outputBudget(resolvedId, routed);
          _applyMaxTokens(
            embed,
            budget !== null ? budget : HISTORICAL_OUTPUT_BUDGET,
          );
          logDebug("generate(): output budget", { model: resolvedId, budget });
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

        // 4b. PB-3 — a reply the provider CUT OFF is refused, not written. It
        //     returns the contract's ordinary failed-result shape, so the
        //     orchestrator takes its existing error path: nothing is parsed,
        //     nothing reaches the registry, and ONE error line is spoken — the
        //     contract's existing DEFAULT_ERROR_MESSAGE, so no new sentence.
        //     The raw reply is KEPT in `text` (the contract allows text on an
        //     error result) for anyone diagnosing the refusal, and `reason`
        //     names why. No interface surface shows it: the alt-text lane has
        //     no disclosure for a raw reply, and adding one is a new surface.
        if (_replyWasCutOff(response)) {
          logWarn(
            "generate(): the provider cut the reply off — refusing it rather than writing a partial description",
            {
              finishReason: response.finishReason,
              nativeFinishReason: response.nativeFinishReason ?? null,
              chars: typeof response.text === "string" ? response.text.length : null,
            },
          );
          const refused = contract
            ? contract.finalise(contract.SOURCE.CLOUD, {
                status: contract.STATUS.ERROR,
                error: contract.DEFAULT_ERROR_MESSAGE,
                text: response.text,
                reasoning: response.reasoning,
                duration,
                model: resolvedId,
              })
            : {
                // Defensive last resort (contract absent), matching the
                // catch below.
                text: response.text ?? null,
                status: "error",
                duration,
                model: resolvedId,
                source: "cloud-llm",
                reasoning: response.reasoning ?? null,
                error: "Unknown generation error",
              };
          refused.reason = TRUNCATED_REASON;
          return refused;
        }

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
        const failed = contract
          ? contract.finalise(contract.SOURCE.CLOUD, {
              status: contract.STATUS.ERROR,
              error: message,
              model: resolvedId,
              duration,
            })
          : {
              // Defensive last resort (contract absent).
              text: null,
              status: "error",
              duration,
              model: resolvedId,
              source: "cloud-llm",
              reasoning: null,
              error: message || "Unknown generation error",
            };
        // MA-5c-2: the HTTP status, when there was one. Without it nothing
        // downstream can tell a refusal from a dropped connection, because
        // both arrive here as a bare message. No status, no field.
        const httpStatus = _httpStatusOf(error);
        if (httpStatus !== null) failed.httpStatus = httpStatus;
        return failed;
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
    // THE PER-PROVIDER PREFERENCE (AW-8; repointed at I5-3). The RESOLVER is
    // exported and the map is NOT — because there is no longer a map here to
    // export.
    //
    // `PREFERRED_BY_PROVIDER` WAS EXPORTED HERE UNTIL I5-3 AND HAS BEEN
    // REMOVED WITH IT. The one suite row that read it (runOrchestratorTests'
    // AW-8 block) compared the resolver against the map beside the literal ids
    // it pins, and the literal half is the half that could ever fail: a row
    // comparing a function against the constant that function reads moves both
    // sides together. The rows now pin the same two literals, unchanged, and
    // ask the registry the agreement question instead.
    _preferredModelForProvider,
    // CF-1: the module-presence predicate the refusal rung is keyed on,
    // exported so the suite can assert the rung and the predicate separately.
    // A row driving only `_resolveModel` cannot say WHICH question refused.
    _modelRegistryIsAbsent,
    NON_VISION_REFUSAL,
    // PB-3: the cut-off refusal's reason value and its predicate, exported so
    // a row can drive the predicate directly and match the reason by identity.
    TRUNCATED_REASON,
    _replyWasCutOff,
    // MA-5c-2: the two refusal reason codes, exported so the orchestrator and
    // the rows match them by identity.
    ABSENT_REGISTRY_REASON,
    NON_VISION_REASON,
    // WL-1: the honest sentence for the absent-registry condition, exported so
    // a row can match the spoken line BY IDENTITY rather than by retyping it,
    // and so one patch inverts the product and the rows together.
    ABSENT_REGISTRY_REFUSAL,
    // MP-2: the picker's own write/read pair, exported so
    // mathpix-image-manager-ui.js can record a pick without reaching into
    // module-scope state, and so a suite row can drive the resolver end to end
    // rather than only asserting on the DOM.
    _setUserModelChoice,
    _getUserModelChoice,
    // MP-2: the provider-membership predicate, exported for the same reason
    // isModelVisionCapable already is — the picker's override list is
    // filtered through it so it cannot offer a model the send would refuse.
    _isModelProviderAvailable,
  };
})();

window.MathPixAltTextCloudAdapter = MathPixAltTextCloudAdapter;
