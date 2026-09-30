/**
 * @file mathpix-model-capability.js
 * @module MathPixModelCapability
 * @description
 * Parcel EA-4 — the shared model-capability module.
 *
 * ONE home for the send-boundary predicates and the constants they speak, and
 * ONE copy of the known-vision list. Before this file existed the same three
 * questions were answered in four places:
 *
 *   - `isModelPdfCapable` + `NON_PDF_REFUSAL` in mathpix-context-ai.js
 *   - `isModelProviderAvailable` + `PROVIDER_REFUSAL` + `PROVIDER_GROUPS`, also
 *     in mathpix-context-ai.js, placed there with a recorded note that this
 *     module was where they would eventually live
 *   - `isModelVisionCapable` + `KNOWN_VISION_MODELS` in
 *     image-describer/image-describer-controller-model.js
 *   - a VERBATIM COPY of that same predicate and list in
 *     mathpix-scripts/ai-alt-text/alt-text-cloud-adapter.js, whose own comment
 *     recorded the duplication as a follow-up
 *
 * The two vision lists were confirmed byte-identical (27 ids, matching SHA-256)
 * on 26 August 2026 immediately before the collapse, so nothing was lost in
 * merging them. The enhancer's third, shorter copy was already deleted at EA-2b.
 *
 * EA-4 IS A MOVE, NOT AN EDIT. Every decision table below is the one its
 * originating file shipped, comments included — in particular the FF.1
 * asymmetry, the no-authority refusals, and the umbrella fold. The one cell
 * that is genuinely new is "this module itself is absent", which cannot arise
 * on a normally-loaded page: its script tag precedes every consumer. It is
 * handled loudly rather than silently, at each consumer, and never here.
 *
 * MA-5b (28 September 2026) added a fourth predicate, reasoningOffAccepted,
 * and the list it reads: which OpenRouter models the alt-text adapter may send
 * the reasoning off switch to. See REASONING_OFF_ACCEPTED_IDS below.
 *
 * MA-12a (30 September 2026) added outputBudgetFor and the list it reads: the
 * completion-token ceiling the alt-text adapter sends per model. See
 * REASONING_MANDATORY_IDS below.
 *
 * NO DOM, NO network. Every global this consults — EmbedModelSelector,
 * ProviderSwitcher, EmbedProviderLookup — is reached at CALL time and guarded,
 * so this module takes no load-order dependency in either direction beyond
 * loading before the consumers that call into it.
 *
 * @see mathpix-scripts/ai-enhancement/mathpix-context-ai.js (delegating facade)
 * @see mathpix-scripts/ai-alt-text/alt-text-cloud-adapter.js (vision consumer)
 * @see image-describer/image-describer-controller-model.js (vision consumer)
 * @see mathpix-scripts/docs/alt-text/phase-4-roadmap-decisions.md (Decision 9)
 */

const MathPixModelCapability = (function () {
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
      console.error(`[MathPixModelCapability] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[MathPixModelCapability] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[MathPixModelCapability] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[MathPixModelCapability] ${message}`, ...args);
  }

  // ===========================================================================
  // REFUSAL SENTENCES
  // ===========================================================================

  /**
   * Exact refuse message for a resolved model that cannot read a PDF (British
   * spelling). S2F-Q4 settled 22 August 2026: for the PDF case the answer is
   * REFUSE, not strip-and-carry-on. Context auto-fill without the document is
   * fabrication wearing a success state, so a stripped attachment would return
   * eight plausible field values derived from nothing.
   *
   * The sibling constant for the image case is NON_VISION_REFUSAL in
   * alt-text-cloud-adapter.js; the two are worded in parallel on purpose.
   */
  const NON_PDF_REFUSAL =
    "The selected model cannot read PDF files. Choose a different model or provider.";

  /**
   * The one sentence spoken when a model is refused because it does not belong
   * to the ACTIVE provider. Worded in parallel with NON_PDF_REFUSAL above, and
   * exported for the same reason: the suite asserts it by identity rather than
   * by retyping it, so the wording can only change in one place.
   *
   * It reaches speech through the EXISTING notify* reroute at the call sites —
   * both throw into a catch that already ends in showError and its notifyError.
   * No new spoken line, no new live region, no new shared channel.
   */
  const PROVIDER_REFUSAL =
    "The selected model is not available with the current provider. Choose a different model.";

  // ===========================================================================
  // THE UMBRELLA FOLD
  // ===========================================================================

  /**
   * The umbrella fold, matching PROVIDER_GROUPS in
   * openrouter-embed/openrouter-embed-model-selector.js. The switcher offers ONE
   * "Microsoft Foundry" entry with id "azure-openai", but the registry carries
   * two Foundry surfaces — azure-openai/ (chat) and azure-responses/ (responses)
   * — and EmbedProviderLookup.resolve returns the surface, not the switch value.
   *
   * A plain equality against getActive() would therefore drop the six
   * azure-responses ids while Foundry is active, which is the behaviour
   * ProviderSwitcher.filterToActiveProvider has today. This module deliberately
   * does NOT reach into that method, and does not edit it: the fold is owned
   * here so the switcher's own semantics stay untouched.
   */
  const PROVIDER_GROUPS = Object.freeze({
    "azure-openai": Object.freeze(["azure-openai", "azure-responses"]),
  });

  // ===========================================================================
  // KNOWN VISION MODELS — the single source of truth
  // ===========================================================================
  // Belt-and-braces against registries that don't flag vision correctly;
  // includes both OpenRouter-prefixed entries and Foundry-routed entries.
  // Frozen and exported BY REFERENCE, not as a per-consumer copy: two consumers
  // reading the same array is what makes a future drift impossible rather than
  // merely unlikely, and it is the property the guard row asserts.
  const KNOWN_VISION_MODELS = Object.freeze([
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
  ]);

  // ===========================================================================
  // THE REASONING OFF SWITCH — who may receive it (parcel MA-5b)
  // ===========================================================================
  // The 77 OpenRouter ids that DECLARE reasoning optional. Source: the keyless
  // OpenRouter GET /models taken at parcel MA-5 on 28 September 2026, whose
  // `reasoning.mandatory` field was joined against the 154 ids the alt-text
  // picker offers on OpenRouter (ma5-join.mjs): 42 declare it mandatory, 77
  // declare it false (every one of these), 32 carry no reasoning object and 3
  // are absent from the catalogue. Picker order, not sorted.
  //
  // WHY A LIST. The alt-text adapter used to send `reasoning: { enabled: false }`
  // to every OpenRouter model (PB-5b), and anthropic/claude-fable-5, which
  // declares reasoning mandatory, answered it with HTTP 400 (MA-4). Only ids
  // named here receive the switch; any other id, including every Foundry id and
  // every id not in the catalogue, is sent no reasoning field at all, which is
  // the body the adapter sent before PB-5b.
  //
  // MEASURED FOR TWO, DECLARED FOR THE REST. anthropic/claude-sonnet-5 (PB-5b)
  // and anthropic/claude-opus-5 (MA-4) have been MEASURED obeying the switch.
  // The other 75 are here on the catalogue's word alone.
  //
  // OWED: a data-driven replacement. The model-add lane is owed a
  // `reasoning.mandatory` field on each entry in js/model-definitions.js, and
  // this list should then be derived from it rather than kept by hand. Until
  // then a model added to the picker is sent no switch until someone adds it
  // here, which is the safe direction.
  //
  // NOT EXPORTED. Callers ask `reasoningOffAccepted(modelId)`; a row that needs
  // to count or inspect the list reads a COPY from `_reasoningOffAcceptedIds()`,
  // so nothing outside this closure can hold or replace the array itself.
  const REASONING_OFF_ACCEPTED_IDS = Object.freeze([
    "anthropic/claude-haiku-4.5",
    "anthropic/claude-opus-4.1",
    "anthropic/claude-opus-4.5",
    "anthropic/claude-opus-4.6",
    "anthropic/claude-opus-4.8",
    "anthropic/claude-opus-5",
    "anthropic/claude-sonnet-4",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-sonnet-4.6",
    "anthropic/claude-sonnet-5",
    "deepseek/deepseek-v4-flash-vision-exp",
    "baidu/ernie-4.5-vl-424b-a47b",
    "google/gemini-2.5-flash",
    "google/gemini-3-flash-preview",
    "google/gemini-3.1-flash-lite",
    "google/gemma-4-26b-a4b-it",
    "google/gemma-4-31b-it",
    "z-ai/glm-4.5v",
    "z-ai/glm-4.6v",
    "openai/gpt-5.1-codex-mini",
    "openai/gpt-5.3-codex",
    "openai/gpt-5.4",
    "openai/gpt-5.4-image-2",
    "openai/gpt-5.4-mini",
    "openai/gpt-5.4-nano",
    "openai/gpt-5.5",
    "openai/gpt-5.6-luna",
    "openai/gpt-5.6-luna-pro",
    "openai/gpt-5.6-sol",
    "openai/gpt-5.6-sol-pro",
    "openai/gpt-5.6-terra",
    "openai/gpt-5.6-terra-pro",
    "x-ai/grok-4.3",
    "thinkingmachines/inkling",
    "thinkingmachines/inkling-small",
    "moonshotai/kimi-k2.5",
    "moonshotai/kimi-k2.6",
    "moonshotai/kimi-k3",
    "xiaomi/mimo-v2.5",
    "minimax/minimax-m3",
    "mistralai/mistral-medium-3-5",
    "mistralai/mistral-small-2603",
    "google/gemini-3.1-flash-image-preview",
    "google/gemini-3.1-flash-image",
    "google/gemini-3.1-flash-lite-image",
    "nvidia/nemotron-3.5-content-safety",
    "amazon/nova-2-lite-v1",
    "openai/o1",
    "openai/o1-pro",
    "openai/o3",
    "openai/o3-pro",
    "openai/o4-mini",
    "perceptron/perceptron-mk1",
    "qwen/qwen3.5-122b-a10b",
    "qwen/qwen3.5-27b",
    "qwen/qwen3.5-9b",
    "qwen/qwen3.5-flash-02-23",
    "qwen/qwen3.5-plus-02-15",
    "qwen/qwen3.6-35b-a3b",
    "qwen/qwen3.5-35b-a3b",
    "qwen/qwen3.5-397b-a17b",
    "qwen/qwen3.5-plus-20260420",
    "qwen/qwen3.6-27b",
    "qwen/qwen3.6-flash",
    "qwen/qwen3.6-plus",
    "qwen/qwen3.7-flash",
    "qwen/qwen3.7-plus",
    "qwen/qwen3.8-27b",
    "qwen/qwen3.8-flash",
    "rekaai/reka-edge",
    "sakana/sakana-namazu",
    "bytedance-seed/seed-1.6",
    "bytedance-seed/seed-1.6-flash",
    "bytedance-seed/seed-2.0-mini",
    "bytedance-seed/seed-2-1-turbo",
    "bytedance-seed/seed-2.0-code",
    "bytedance-seed/seed-2.0-lite",
  ]);

  // ===========================================================================
  // THE OUTPUT BUDGET — who needs headroom for mandatory reasoning (parcel MA-12a)
  // ===========================================================================
  // The 42 OpenRouter ids the catalogue marks `reasoning.mandatory: true`.
  // Source: the same keyless OpenRouter GET /models taken at parcel MA-5 on
  // 28 September 2026, joined against the 154 ids the alt-text picker offered
  // (ma5-join.mjs; re-derived at MA-12a on 30 September 2026 from
  // .claude/model-add/results/ma5-models-2026-09-28T11-54-51-473Z.json and
  // again from the 30 September catalogue, the same 42 both times). Picker
  // order, not sorted. Disjoint from REASONING_OFF_ACCEPTED_IDS, which holds
  // the 77 that declare it optional.
  //
  // WHY A BUDGET. A mandatory-reasoning model spends completion tokens on
  // reasoning that cannot be switched off, and the embed's shipped max_tokens of
  // 2000 (PB-2) counts them. anthropic/claude-opus-5.5 finished `length` on 4 of
  // 33 cells at exactly 2000 at MA-10, its reasoning (mean 397.6, max 792
  // tokens) sitting inside the ceiling; the PB-3 refusal then withheld all four.
  // Foundry deployments are sent as reasoning models with
  // max_completion_tokens 2000 (MA-11).
  const REASONING_MANDATORY_IDS = Object.freeze([
    "anthropic/claude-fable-5",
    "anthropic/claude-fable-5.1",
    "sakana/fugu-ultra",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-pro-preview",
    "google/gemini-3.1-pro-preview",
    "google/gemini-3.1-pro-preview-customtools",
    "google/gemini-3.5-flash",
    "google/gemini-3.5-flash-lite",
    "google/gemini-3.6-flash",
    "google/gemini-3.7-flash",
    "google/gemini-3.8-flash",
    "z-ai/glm-5.3-flash",
    "openai/gpt-5",
    "openai/gpt-5-image",
    "openai/gpt-5-image-mini",
    "openai/gpt-5.1-codex",
    "openai/gpt-5.1-codex-max",
    "openai/gpt-5.2-codex",
    "openai/gpt-5.4-pro",
    "openai/gpt-5.5-pro",
    "openai/gpt-6-astra",
    "openai/gpt-6-astra-pro",
    "x-ai/grok-4.20-multi-agent",
    "x-ai/grok-4.5",
    "x-ai/grok-4.6",
    "x-ai/grok-build-0.1",
    "moonshotai/kimi-k2.7-code",
    "meta/muse-glimmer-30b",
    "meta/muse-spark-1.1",
    "meta/muse-spark-1.2",
    "meta/muse-spark-1.2-contributor",
    "meta/muse-spark-1.3",
    "meta/muse-spark-1.3-contributor",
    "google/gemini-3-pro-image-preview",
    "google/gemini-3-pro-image",
    "openai/o4-mini-high",
    "qwen/qwen3-vl-235b-a22b-thinking",
    "qwen/qwen3-vl-30b-a3b-thinking",
    "qwen/qwen3-vl-8b-thinking",
    "qwen/qwen3.8-max-0902",
    "stepfun/step-3.7-flash",
  ]);

  // THE TWO 5.5 IDS, KEPT APART FROM THE 42 ON PURPOSE. Neither was in the
  // picker list the MA-5 join ran over (both post-date it: MA-1 recorded
  // opus-5.5 as unregistered on 28 September), so the join cannot return them;
  // the 30 September catalogue declares both mandatory. MEASURED, NOT ONLY
  // DECLARED: anthropic/claude-opus-5.5 reasons on the wire (MA-10: 13,122
  // reasoning tokens over 33 cells, max 792). anthropic/claude-sonnet-5.5
  // declares mandatory and billed 0 reasoning tokens on all 33 cells at MA-10,
  // a catalogue-versus-wire DISAGREEMENT recorded rather than resolved; it is
  // budgeted like its sibling because the declaration is the only signal the
  // catalogue offers and the cost of headroom that goes unused is nil.
  const REASONING_MANDATORY_MEASURED_IDS = Object.freeze([
    "anthropic/claude-opus-5.5",
    "anthropic/claude-sonnet-5.5",
  ]);

  const PROVIDER_ID_FOUNDRY = "foundry";
  const PROVIDER_ID_OPENROUTER = "openrouter";
  const OUTPUT_BUDGET_DEFAULT = 2000;
  const OUTPUT_BUDGET_REASONING = 3000;

  // A model that is both "may be sent reasoning off" and "reasoning mandatory"
  // is a contradiction in the data, and it must not load quietly: one of the
  // two lists would be wrong and the adapter would act on both.
  (function assertListsDisjoint() {
    const accepted = new Set(REASONING_OFF_ACCEPTED_IDS);
    const both = REASONING_MANDATORY_IDS.concat(
      REASONING_MANDATORY_MEASURED_IDS
    ).filter((id) => accepted.has(id));
    if (both.length > 0) {
      throw new Error(
        `MathPixModelCapability: ids in both the reasoning-off accepted list and the mandatory list: ${both.join(", ")}`
      );
    }
  })();

  // ===========================================================================
  // PROVIDER DERIVATION — shared by both prefix-derived predicates
  // ===========================================================================

  /**
   * Derive the routing provider from the id PREFIX. Both prefix-derived
   * predicates below used to spell this ternary out separately, in the two
   * files they came from, with identical comments; it is one function here
   * because two copies of a three-branch decision is exactly how the
   * second-prefix-derivation hazard starts.
   *
   * An explicit azure-openai prefix routes to Foundry's chat surface,
   * azure-responses to Foundry's Responses surface; everything else routes via
   * OpenRouter.
   *
   * @param {string} modelId
   * @returns {string} the provider id to query the selector with
   */
  function _providerFromPrefix(modelId) {
    if (modelId.startsWith("azure-openai/")) return "azure-openai";
    if (modelId.startsWith("azure-responses/")) return "azure-responses";
    return "openrouter";
  }

  // ===========================================================================
  // PDF CAPABILITY RE-CHECK (the send-boundary guard, S2F-D8)
  // ===========================================================================

  /**
   * Can this model id read a PDF attachment? Mirrors isModelVisionCapable below
   * in shape — same prefix-derived provider, same non-empty-list-is-
   * authoritative rule — but NOT in its fallback, because the two capabilities
   * are expressed differently and the asymmetry is load-bearing (see the
   * empty-list and failure branches below).
   *
   * The provider is derived from the id PREFIX, not from ProviderSwitcher: the
   * question this answers is about the id in hand, whatever path chose it.
   *
   * @param {string} modelId - the model id actually about to be sent with.
   * @returns {boolean} true only when the id is positively established as able
   *   to read a PDF for its own provider.
   */
  function isModelPdfCapable(modelId) {
    if (!modelId || typeof modelId !== "string" || !modelId.trim()) return false;

    const providerId = _providerFromPrefix(modelId);

    if (
      !window.EmbedModelSelector ||
      typeof window.EmbedModelSelector.getEligibleModels !== "function"
    ) {
      // Deliberately STRICTER than the vision fallback. That one falls through
      // to the static KNOWN_VISION_MODELS list; there is no equivalent
      // known-PDF list to fall through to here, and inventing one would be a
      // fourth copy of a list this codebase has already watched drift. With no
      // authority to consult, false is the honest answer, and false routes to a
      // clear refusal rather than to the silent strip S2F-Q4 rules out.
      logWarn(
        "isModelPdfCapable: EmbedModelSelector unavailable; refusing rather than assuming capability.",
        { modelId }
      );
      return false;
    }

    let pdfEligible = [];
    try {
      pdfEligible = window.EmbedModelSelector.getEligibleModels({
        providerId,
        capabilities: ["pdf"],
      });
    } catch (error) {
      // Same reasoning as the unavailable branch: no known-PDF list exists, so a
      // thrown selector leaves us with no authority and we refuse.
      logWarn("isModelPdfCapable: the pdf capability query threw:", error);
      return false;
    }

    if (Array.isArray(pdfEligible) && pdfEligible.length > 0) {
      // Foundry-first path: the provider tags PDF as a per-model capability, so
      // a non-empty list is authoritative — in-list means capable, absent means
      // not, and there is no fall-through.
      return pdfEligible.some((model) => model && model.id === modelId);
    }

    // The FF.1 case, and the reason this function cannot simply mirror the
    // vision one. OpenRouter expresses PDF support at the ENGINE / file-upload
    // level (native, mistral-ocr), never as a per-model capability token, so NO
    // OpenRouter model passes a ["pdf"] filter and the list above is empty for
    // the default provider. Capability is therefore a property of the provider
    // there, and the only question left is whether this id BELONGS to the active
    // provider. That membership gate is what stops an OpenRouter id being
    // treated as capable while Foundry is active — the cross-provider borrow
    // _resolveModel's own fallback was written to prevent.
    let unfiltered = [];
    try {
      unfiltered = window.EmbedModelSelector.getEligibleModels({
        providerId,
        capabilities: [],
      });
    } catch (error) {
      logWarn(
        "isModelPdfCapable: getEligibleModels([]) membership check threw:",
        error
      );
      return false;
    }

    return (
      Array.isArray(unfiltered) &&
      unfiltered.some((model) => model && model.id === modelId)
    );
  }

  // ===========================================================================
  // VISION CAPABILITY RE-CHECK (F6 — both halves)
  // ===========================================================================

  /**
   * Vision-capability predicate — the single source of truth for the runtime
   * re-check (Layer 2) AND the population gate's fallback list. Both halves of
   * the F6 decision are preserved:
   *   • provider derivation from the id prefix,
   *   • primary path via EmbedModelSelector.getEligibleModels with the
   *     NON-EMPTY-list-is-authoritative rule (in-list ⇒ vision, absent ⇒ not),
   *   • the EMPTY-list fall-through (a misconfigured / empty selector must NOT
   *     conclude "not vision" — fall through to the static list),
   *   • the thrown-selector fall-through,
   *   • the KNOWN_VISION_MODELS membership fallback.
   *
   * Called pre-send in the Image Describer's generate() and runVerification(),
   * and at the alt-text cloud adapter's own send boundary, to deterministically
   * refuse non-vision models that slip past the population-only gate
   * (show-all-models, restored preference, verification selector, direct
   * callers).
   *
   * @param {string} modelId - The model id actually about to be used.
   * @returns {boolean} true if the model can process images.
   */
  function isModelVisionCapable(modelId) {
    if (!modelId || typeof modelId !== "string") return false;

    const provider = _providerFromPrefix(modelId);

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
          error
        );
      }
    }

    // Fallback: KNOWN_VISION_MODELS membership (module-scope, shared list).
    return KNOWN_VISION_MODELS.includes(modelId);
  }

  // ===========================================================================
  // PROVIDER MEMBERSHIP (parcel EA-2b)
  // ===========================================================================

  /**
   * Is this model served by the provider the user currently has selected?
   *
   * Lives beside isModelPdfCapable because both are send-boundary predicates
   * the enhancer, the multi-pass orchestrator and the pickers all consult. This
   * module is the home the EA-2b comment promised them.
   *
   * Resolution is by EmbedProviderLookup.resolve, which returns the registered
   * provider for a reserved prefix and falls back to OpenRouter for anything
   * unrecognised — so an anthropic/ id resolves to "openrouter" and an
   * azure-responses/ id resolves to "azure-responses". The resolved id is then
   * folded through PROVIDER_GROUPS before comparison.
   *
   * Note it does NOT use _providerFromPrefix: the lookup is a real authority and
   * the prefix derivation is a fallback for questions the lookup cannot answer.
   *
   * @param {string} modelId
   * @returns {boolean} true when the model belongs to the active provider
   */
  function isModelProviderAvailable(modelId) {
    if (!modelId || typeof modelId !== "string" || !modelId.trim()) return false;

    // FAIL OPEN on an ABSENT switcher, and this is deliberately the opposite of
    // isModelPdfCapable's no-authority branch. There, an absent selector means
    // the capability authority was consulted and was not there, so false is the
    // honest answer. Here, an absent ProviderSwitcher means a production script
    // did not load — a page-configuration fault, not a provider finding.
    // Refusing on it would reject EVERY model and take enhancement down
    // completely, which is the outage the FF.1 measurement warns about.
    if (
      !window.ProviderSwitcher ||
      typeof window.ProviderSwitcher.getActive !== "function"
    ) {
      logWarn(
        "Provider membership check skipped: ProviderSwitcher.getActive unavailable. Treating the model as available.",
        { modelId }
      );
      return true;
    }

    let activeId;
    try {
      activeId = window.ProviderSwitcher.getActive();
    } catch (error) {
      // Same reasoning as the absence branch: a throwing switcher is a page
      // fault, not evidence about this model.
      logWarn(
        "Provider membership check skipped: ProviderSwitcher.getActive threw. Treating the model as available.",
        error
      );
      return true;
    }

    // The lookup IS an authority, so its absence is treated like the predicate's
    // own no-authority branch rather than like the switcher's: without it we
    // cannot say which provider serves this id, and guessing is what the
    // second-prefix-derivation hazard is about.
    const lookup = window.EmbedProviderLookup;
    if (!lookup || typeof lookup.resolve !== "function") {
      logWarn(
        "isModelProviderAvailable: EmbedProviderLookup unavailable; refusing rather than assuming membership.",
        { modelId }
      );
      return false;
    }

    let resolved = null;
    try {
      resolved = lookup.resolve(modelId);
    } catch (error) {
      logWarn("isModelProviderAvailable: resolve() threw:", error);
      return false;
    }

    // resolve() returns null for a reserved prefix with no registered provider.
    if (!resolved || typeof resolved.id !== "string") return false;

    const memberIds = PROVIDER_GROUPS[activeId] || [activeId];
    return memberIds.includes(resolved.id);
  }

  // ===========================================================================
  // REASONING OFF SWITCH (parcel MA-5b)
  // ===========================================================================

  /**
   * May this model id be sent `reasoning: { enabled: false }`?
   *
   * Exact membership of REASONING_OFF_ACCEPTED_IDS and nothing else: no prefix
   * derivation, no selector, no fall-through. A model the list does not name is
   * refused the switch, which sends it no reasoning field, and that is the safe
   * direction: withholding the switch costs tokens, sending it to a model that
   * requires reasoning costs the whole request (MA-4).
   *
   * @param {string} modelId - the resolved model id about to be sent.
   * @returns {boolean} true only for an exact listed id; false for anything
   *   else, including undefined, null, a non-string and any Foundry id.
   */
  function reasoningOffAccepted(modelId) {
    if (typeof modelId !== "string" || !modelId) return false;
    return REASONING_OFF_ACCEPTED_IDS.includes(modelId);
  }

  /**
   * A COPY of the accepted list, for guard rows that count or inspect it. A
   * fresh unfrozen array on every call, so a caller can neither mutate nor
   * replace the list the predicate reads. Not for deciding anything: use
   * reasoningOffAccepted.
   *
   * @returns {string[]}
   */
  function _reasoningOffAcceptedIds() {
    return REASONING_OFF_ACCEPTED_IDS.slice();
  }

  // ===========================================================================
  // OUTPUT BUDGET (parcel MA-12a)
  // ===========================================================================

  /**
   * The completion-token ceiling the alt-text adapter should send for this
   * model: 3000 for every Foundry id and for an OpenRouter id whose reasoning
   * is mandatory, 2000 for everything else.
   *
   * Exact membership and exact provider strings, no prefix derivation: an
   * unknown provider, an unlisted id, undefined, null and a non-string all get
   * the 2000 the embed already sends, which is the pre-MA-12a behaviour.
   *
   * @param {string} modelId - the resolved model id about to be sent.
   * @param {string} providerId - "foundry" or "openrouter".
   * @returns {number} 3000 or 2000.
   */
  function outputBudgetFor(modelId, providerId) {
    if (providerId === PROVIDER_ID_FOUNDRY) return OUTPUT_BUDGET_REASONING;
    if (
      providerId === PROVIDER_ID_OPENROUTER &&
      typeof modelId === "string" &&
      (REASONING_MANDATORY_IDS.includes(modelId) ||
        REASONING_MANDATORY_MEASURED_IDS.includes(modelId))
    ) {
      return OUTPUT_BUDGET_REASONING;
    }
    return OUTPUT_BUDGET_DEFAULT;
  }

  /**
   * A COPY of the 42 catalogue-derived mandatory ids, for guard rows that count
   * or inspect them. The two measured 5.5 ids are not in it. Not for deciding
   * anything: use outputBudgetFor.
   *
   * @returns {string[]}
   */
  function _reasoningMandatoryIds() {
    return REASONING_MANDATORY_IDS.slice();
  }

  /**
   * A COPY of the two measured 5.5 ids, for the same purpose.
   *
   * @returns {string[]}
   */
  function _reasoningMandatoryMeasuredIds() {
    return REASONING_MANDATORY_MEASURED_IDS.slice();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  logInfo(
    `MathPixModelCapability ready (${KNOWN_VISION_MODELS.length} known vision models, ${REASONING_OFF_ACCEPTED_IDS.length} models accept the reasoning off switch).`
  );
  logDebug(
    "Capability predicates exposed: pdf, vision, provider membership, reasoning off."
  );

  return {
    isModelPdfCapable,
    isModelVisionCapable,
    isModelProviderAvailable,
    reasoningOffAccepted,
    _reasoningOffAcceptedIds,
    outputBudgetFor,
    _reasoningMandatoryIds,
    _reasoningMandatoryMeasuredIds,
    PROVIDER_GROUPS,
    NON_PDF_REFUSAL,
    PROVIDER_REFUSAL,
    KNOWN_VISION_MODELS,
  };
})();

window.MathPixModelCapability = MathPixModelCapability;
