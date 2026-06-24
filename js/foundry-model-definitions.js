// js/foundry-model-definitions.js
//
// Microsoft Foundry (azure-openai/*) routed model variants for the
// OpenRouter Embed library. These are the SAME upstream OpenAI models as their
// `openai/*` OpenRouter siblings, but routed via the Foundry adapter (see
// js/providers/azure-openai-v1.js) at the `azure-openai/<deployment>` prefix.
//
// WHY A SEPARATE FILE + FACTORY
// -----------------------------
// Each Foundry entry carries substantial INVARIANT scaffold — the `(Foundry)`
// name suffix, the `metadata.routing` block, the Cloudflare-Worker proxy notes,
// the Microsoft policy links, the proxyUrl accessibility warnings. Declaring
// four models verbatim would quadruple that boilerplate. `createFoundryModel`
// keeps the invariants in one place and parameterises only the per-model parts.
//
// LOADING / ORDERING
// ------------------
// `js/model-definitions.js` is an ES module imported by `js/config.js`; it is
// NOT a <script> tag, and it exposes the singleton as `window.modelRegistry` at
// its end. This file imports the SAME registry singleton and is imported by
// `js/config.js` IMMEDIATELY AFTER `js/model-definitions.js`, so when these
// `registerModel` calls run: (a) the registry exists, (b) the categories exist,
// and (c) the OpenRouter sibling ids used as `fallbackTo` are already
// registered (so `autoValidateFallbacks` resolves them).
//
// MIGRATION NOTE: the `azure-openai/gpt-5.4-mini` entry previously lived inline
// in `js/model-definitions.js` (Stage 2 Task 2.6). It moved here unchanged —
// the factory reproduces its stored shape field-for-field (verify with the
// structural-equivalence snippet in the task's verification steps; `status.
// lastCheck` is volatile per registration and is excluded from that compare).

import { modelRegistry } from "./model-registry/model-registry-index.js";

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
    console.error(`[FoundryModels] ${message}`, ...args);
}
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[FoundryModels] ${message}`, ...args);
}
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[FoundryModels] ${message}`, ...args);
}
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[FoundryModels] ${message}`, ...args);
}

// ============================================================================
// SHARED INVARIANTS
// ============================================================================

// Microsoft / Azure policy documentation — identical for every Foundry model.
const MICROSOFT_POLICY_LINKS = {
  privacyPolicy:
    "https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/data-privacy",
  acceptableUse: "https://www.microsoft.com/en-us/servicesagreement",
  termsOfService: "https://azure.microsoft.com/en-us/support/legal/",
  lastUpdated: "2026-05-16",
};

// Generic parameter-statistics percentiles. Carried over verbatim from the
// original gpt-5.4-mini entry; shared by every Foundry variant (these are
// transport-agnostic defaults, not per-model measurements).
const FOUNDRY_PARAM_STATISTICS = {
  frequency_penalty: { p10: 0, p50: 0, p90: 0 },
  min_p: { p10: 0, p50: 0, p90: 0 },
  presence_penalty: { p10: 0, p50: 0, p90: 0 },
  repetition_penalty: { p10: 1, p50: 1, p90: 1 },
  temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
  top_k: { p10: 0, p50: 0, p90: 0 },
  top_p: { p10: 0.9, p50: 1, p90: 1 },
};

// The proxy-required warning names the provider id the user must configure —
// 'azure-openai' for chat models, 'azure-responses' for the Responses surface
// — so a screen-reader user is told the correct id. The proxy-missing warning
// (below) is invariant; the third (image support) is per-model and passed via
// `imageSupportNote`.
function warningProxyRequired(providerId) {
  return (
    "Requires Foundry proxy URL configured via OpenRouterEmbed constructor's `providers` option " +
    `or via embed.configureProvider('${providerId}', {...}).`
  );
}

function warningProxyMissing(fallbackTo) {
  const target = fallbackTo || "the OpenRouter sibling";
  return (
    "If proxy URL is missing, the adapter throws 'providerConfig.proxyUrl is required' — " +
    `falls back to fallbackTo (${target} via OpenRouter) only if the consumer wires that fallback ` +
    "explicitly; the registry's fallback is informational only."
  );
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Build a `{ id, config }` pair for a Microsoft Foundry routed model variant,
 * ready to pass to `modelRegistry.registerModel(id, config)`.
 *
 * The returned `config` reproduces the canonical Foundry entry shape (string
 * `capabilities` array, `costs:{input,output}`, rich `metadata` /
 * `parameterSupport` / `accessibility` / `status` blocks). Invariant scaffold
 * (routing block, policy links, proxy warnings, `(Foundry)` suffix, derived
 * `metadata.accessibility`, aria labels) is generated here; per-model values
 * are taken from the parameters.
 *
 * @param {Object}   p
 * @param {string}   p.deploymentName      Foundry deployment name (e.g. "gpt-4o-mini").
 *                                         Becomes the `azure-openai/<name>` id and routing.deployment.
 * @param {string}   p.displayName         Human-readable name; suffixed with " (Foundry)".
 * @param {string}   p.description         Short description prose.
 * @param {string[]} p.capabilities        Capability strings. Presence of "vision" = vision-capable;
 *                                         "reasoning" = reasoning-capable; "tool_calling" = tool use.
 * @param {Object}   p.costs               { input, output } USD per 1M tokens.
 * @param {number}   p.maxContext          Context window in tokens.
 * @param {?string}  p.fallbackTo          OpenRouter sibling id for failover, or null.
 * @param {string}   p.releaseDate         Upstream model release date (ISO).
 * @param {string}   p.categoryDescription Category blurb for the registry.
 * @param {string[]} p.bestFor             "Best for" use-case list (metadata).
 * @param {string[]} p.preferredFor        Accessibility preferredFor list.
 * @param {string[]} p.supportedParams     parameterSupport.supported entries.
 * @param {string[]} p.features            parameterSupport.features entries.
 * @param {string}   p.imageSupportNote    Third accessibility warning (image/vision status).
 * @param {string}   [p.upstreamProvider="openai"]   Upstream vendor (the `provider` field).
 * @param {string}   [p.category="GeneralPurpose"]
 * @param {boolean}  [p.disabled=false]
 * @param {boolean}  [p.isFree=false]
 * @param {string}   [p.region="UK South (accesstools-foundry-uk)"]
 * @param {string}   [p.workerName="openrouter-embed-foundry-proxy"]
 * @param {Object}   [p.modelArchitecture] metadata.modelArchitecture (defaults to the mini/efficiency shape).
 * @param {Object}   [p.policyLinks=MICROSOFT_POLICY_LINKS]
 * @param {string}   [p.apiSurface="chat"] Which Foundry API surface this deployment serves:
 *                                         "chat" → azure-openai provider (/openai/v1/chat/completions);
 *                                         "responses" → azure-responses provider (/openai/v1/responses).
 *                                         Drives the id prefix, routing.provider, and the proxy-required warning.
 * @returns {{ id: string, config: Object }}
 */
function createFoundryModel({
  // Required (per-model)
  deploymentName,
  displayName,
  description,
  capabilities,
  costs,
  maxContext,
  fallbackTo,
  releaseDate,
  categoryDescription,
  bestFor,
  preferredFor,
  supportedParams,
  features,
  imageSupportNote,

  // Optional with defaults
  upstreamProvider = "openai",
  category = "GeneralPurpose",
  disabled = false,
  isFree = false,
  region = "UK South (accesstools-foundry-uk)",
  workerName = "openrouter-embed-foundry-proxy",
  modelArchitecture = {
    parameters: "Unknown",
    type: "instruction-tuned",
    optimisedFor: "efficiency-at-scale",
  },
  policyLinks = MICROSOFT_POLICY_LINKS,
  apiSurface = "chat",
}) {
  if (!deploymentName || !displayName) {
    logError(
      "createFoundryModel: deploymentName and displayName are required",
      { deploymentName, displayName }
    );
    throw new Error(
      "createFoundryModel requires deploymentName and displayName"
    );
  }

  // One provider id drives every prefix-coupled spot below (id, routing,
  // proxy warning). "chat"/absent → "azure-openai" keeps existing defs
  // byte-identical; "responses" → "azure-responses".
  const providerId =
    apiSurface === "responses" ? "azure-responses" : "azure-openai";

  const id = `${providerId}/${deploymentName}`;
  const name = `${displayName} (Foundry)`;
  const caps = Array.isArray(capabilities) ? capabilities : [];

  // Derived accessibility flags — single source of truth is the capabilities
  // array, so a model can never claim vision in one field and deny it in
  // another (CLAUDE.md tier/field-consistency discipline).
  const hasVision = caps.includes("vision");
  const hasReasoning = caps.includes("reasoning");
  const hasToolCalling = caps.includes("tool_calling");

  // Context label for aria text: 400000 -> "400K", 1050000 -> "1050K".
  const contextLabel = `${Math.round(maxContext / 1000)}K`;

  const config = {
    provider: upstreamProvider,
    name,
    category,
    disabled,
    description,
    costs,
    capabilities: caps,
    maxContext,
    fallbackTo,
    isFree,
    metadata: {
      categoryDescription,
      releaseDate,
      modelArchitecture,
      routing: {
        provider: providerId,
        deployment: deploymentName,
        proxyVia: `Cloudflare Worker (${workerName})`,
        region,
      },
      policyLinks,
      bestFor,
      accessibility: {
        multimodalSupport: hasVision,
        reasoningCapabilities: hasReasoning,
        toolIntegrationSupport: hasToolCalling,
      },
    },
    parameterSupport: {
      supported: supportedParams,
      statistics: FOUNDRY_PARAM_STATISTICS,
      features,
    },
    accessibility: {
      preferredFor,
      warnings: [
        warningProxyRequired(providerId),
        warningProxyMissing(fallbackTo),
        imageSupportNote,
      ],
      ariaLabels: {
        modelSelect: `${displayName} routed via Microsoft Foundry — ${contextLabel} context window, same upstream model as the OpenRouter variant`,
        parameterSection: `Parameter controls for ${name} — reasoning, tool use, and output formatting`,
        statusMessages: {
          processing: `Processing request with ${displayName} via Microsoft Foundry`,
          complete: `Response ready from ${name}`,
        },
      },
    },
    status: {
      isAvailable: true,
      lastCheck: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
    },
  };

  return { id, config };
}

// ============================================================================
// MODEL DECLARATIONS
// ============================================================================
//
// Order matches `Get-FoundryDeployments` output: mini, 4o-mini, nano, full.
//
// VISION — all four deployments empirically verified on Foundry (31 May 2026,
// real Image Describer requests):
//   gpt-5.4-mini  vision  TRUE  (verified Task 2.6, re-confirmed 31 May 2026)
//   gpt-4o-mini   vision  TRUE  (verified 31 May 2026)
//   gpt-5.4-nano  vision  TRUE  (verified 31 May 2026; was initially registered
//                                vision FALSE conservatively, flipped this follow-up)
//   gpt-5.4       vision  TRUE  (verified 31 May 2026)
// "reasoning" is included ONLY for gpt-5.4-mini (its original entry had it).
// The three new entries omit "reasoning" pending confirmation — see follow-ups.
//
// COSTS: sourced from the in-repo OpenRouter sibling entries in
// js/model-definitions.js (which encode OpenAI public pricing). Foundry billing
// may differ; treat as a proxy until reconciled against Foundry invoices.

const FOUNDRY_MODELS = [
  // ── gpt-5.4-mini (migrated unchanged from model-definitions.js; PDF verified 23 June 2026) ──
  createFoundryModel({
    deploymentName: "gpt-5.4-mini",
    displayName: "GPT-5.4 Mini",
    description:
      "Same upstream model as openai/gpt-5.4-mini, routed via Microsoft Foundry instead of OpenRouter. Available because the test deployment (accesstools-foundry-uk, UK South) is funded by a Visual Studio Enterprise £150/month credit. Supports text and image inputs with strong reasoning, coding, and tool use. Use this entry when explicit Foundry routing is required (data-residency, credit-funded budget, or testing the adapter); use openai/gpt-5.4-mini otherwise.",
    // Source: OpenAI public pricing as of 2026-05-16; Foundry billing may vary
    costs: { input: 0.75, output: 4.5 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "reasoning",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
      "pdf",
    ],
    maxContext: 400000,
    fallbackTo: "openai/gpt-5.4-mini",
    releaseDate: "2026-03-17",
    categoryDescription:
      "Efficient general-purpose model routed via Microsoft Foundry — same upstream as openai/gpt-5.4-mini, different transport",
    bestFor: [
      "Foundry-funded production workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
      "credit-budgeted high-throughput applications",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "credit-budgeted-deployments",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "reasoning-support",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this Foundry deployment (Task 2.6 smoke test, re-confirmed 31 May 2026). An earlier project note claimed this deployment rejected images; that claim was falsified on re-verification — vision works correctly.",
  }),

  // ── gpt-4o-mini (vision-capable, low-cost multimodal; PDF deliberately omitted — transmits but reads blind on this deployment, an Azure per-deployment quirk; sibling gpt-4o reads) ──
  createFoundryModel({
    deploymentName: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    description:
      "OpenAI's cost-effective multimodal model, routed via Microsoft Foundry instead of OpenRouter. Vision-capable, with solid general-purpose text, coding, and tool use at a low price point. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use this entry when explicit Foundry routing is required and image inputs are needed; use openai/gpt-4o-mini otherwise.",
    // Source: OpenAI public pricing as of 2026-05-31; Foundry billing may vary
    costs: { input: 0.15, output: 0.6 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
    ],
    maxContext: 128000,
    fallbackTo: "openai/gpt-4o-mini",
    releaseDate: "2024-07-18",
    categoryDescription:
      "Cost-effective multimodal model routed via Microsoft Foundry — same upstream as openai/gpt-4o-mini, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "cost-efficiency",
    },
    bestFor: [
      "cost-sensitive multimodal applications",
      "Foundry-funded production workloads",
      "UK data residency requirements",
      "image description and OCR-adjacent tasks",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "cost-sensitive-multimodal",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this Foundry deployment via a real Image Describer request (31 May 2026).",
  }),

  // ── gpt-5.4-nano (new — vision verified 31 May 2026; PDF verified 23 June 2026) ──
  createFoundryModel({
    deploymentName: "gpt-5.4-nano",
    displayName: "GPT-5.4 Nano",
    description:
      "The most lightweight, cost-efficient GPT-5.4 variant, routed via Microsoft Foundry. Optimised for speed-critical, high-volume tasks (classification, extraction, ranking). Empirically verified to support vision and text generation (31 May 2026). Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use openai/gpt-5.4-nano for OpenRouter routing.",
    // Source: OpenAI public pricing as of 2026-05-31; Foundry billing may vary
    costs: { input: 0.2, output: 1.25 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
      "pdf",
    ],
    maxContext: 400000,
    fallbackTo: "openai/gpt-5.4-nano",
    releaseDate: "2026-03-17",
    categoryDescription:
      "Lightweight, cost-efficient model routed via Microsoft Foundry — same upstream as openai/gpt-5.4-nano, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "speed-and-efficiency",
    },
    bestFor: [
      "high-volume classification and extraction",
      "speed-critical low-latency tasks",
      "Foundry-funded batch workloads",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "high-volume-low-latency",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this Foundry deployment via a real Image Describer request (31 May 2026). The earlier conservative default (vision disabled, pending verification) has been resolved.",
  }),

  // ── gpt-5.4 (new — full-size flagship, vision-capable; PDF verified 23 June 2026) ──
  createFoundryModel({
    deploymentName: "gpt-5.4",
    displayName: "GPT-5.4",
    description:
      "OpenAI's frontier GPT-5.4 model, routed via Microsoft Foundry instead of OpenRouter. Large context with strong reasoning, coding, document understanding, and multimodal (image) analysis. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use this entry when explicit Foundry routing is required; use openai/gpt-5.4 otherwise.",
    // Source: OpenAI public pricing as of 2026-05-31; Foundry billing may vary
    costs: { input: 2.5, output: 15.0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
      "pdf",
    ],
    maxContext: 1050000,
    fallbackTo: "openai/gpt-5.4",
    releaseDate: "2026-03-05",
    categoryDescription:
      "Frontier-class general-purpose model routed via Microsoft Foundry — same upstream as openai/gpt-5.4, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "unified-instruction-tuned",
      optimisedFor: "frontier-general-purpose",
    },
    bestFor: [
      "high-context reasoning and synthesis",
      "production-quality code generation",
      "multimodal analysis",
      "Foundry-funded flagship workloads",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "high-context-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this Foundry deployment via a real Image Describer request (31 May 2026).",
  }),

  // ── gpt-oss-120b (new — OpenAI open-weight, OpenAI-OSS format, text reasoning) ──
  createFoundryModel({
    deploymentName: "gpt-oss-120b",
    displayName: "GPT-OSS 120B",
    description:
      "OpenAI's open-weight 120B reasoning model, routed via Microsoft Foundry. Format 'OpenAI-OSS' — serves on the same OpenAI-v1 surface as the GPT deployments, so it routes through the existing Foundry adapter unchanged. Text-only reasoning model; emits chain-of-thought in a separate reasoning_content field. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling — Foundry-only.",
    // Source: provisional — Foundry/OpenAI-OSS pricing not yet reconciled. Treat as placeholder until confirmed against Foundry invoices.
    costs: { input: 0, output: 0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "reasoning",
      "mathematics",
      "multilingual",
    ],
    maxContext: 128000,
    fallbackTo: null,
    releaseDate: "2025-08-05",
    categoryDescription:
      "OpenAI open-weight reasoning model routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "120B (open-weight MoE)",
      type: "reasoning-instruction-tuned",
      optimisedFor: "open-weight-reasoning",
    },
    bestFor: [
      "technical and reasoning-heavy tasks",
      "Foundry-funded open-weight workloads",
      "UK data residency requirements",
      "cost-controlled reasoning where an open-weight model suffices",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "open-weight-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "reasoning-support",
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only model — no image input support. Reasoning output is returned in a separate reasoning_content field, empirically verified via a real request through the Foundry proxy (2 June 2026).",
  }),

  // ── gpt-5 (vision verified 4 June 2026; PDF verified 23 June 2026 — initially registered text-only) ──
  // Empirically (Phase A): serves 200 on the OpenAI-v1 surface, but REJECTS
  // temperature/top_p (400) → reasoning model. The GPT-5.x line is NON-UNIFORM:
  // 5.1/5.2/5.4 accept temperature, only bare gpt-5 rejects it. The anchored
  // /^gpt-5$/i pattern in azure-openai-v1.js drops sampling params for THIS id only.
  // Template: gpt-5.4-mini (reasoning) but TEXT-ONLY (no vision capability/feature).
  createFoundryModel({
    deploymentName: "gpt-5",
    displayName: "GPT-5",
    description:
      "OpenAI's GPT-5 flagship reasoning model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A deploy-and-classify). Rejects temperature/top_p — treated as a reasoning model. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry.",
    // provisional, pending Foundry invoice reconciliation — no in-repo sibling exists
    costs: { input: 1.25, output: 10.0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "reasoning",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
      "pdf",
    ],
    maxContext: 400000,
    fallbackTo: null,
    releaseDate: "2025-08-07",
    categoryDescription:
      "GPT-5 flagship reasoning model routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    bestFor: [
      "reasoning-heavy and multi-step problem solving",
      "Foundry-funded flagship workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "high-context-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "reasoning-support",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this deployment via the Image Describer (4 June 2026). Initially registered text-only pending this verification (cf. gpt-oss-120b, which proved text-only).",
  }),

  // ── gpt-5.1 (vision verified 4 June 2026; PDF verified 23 June 2026 — initially registered text-only) ──
  // Empirically (Phase A): serves 200 and ACCEPTS temperature/top_p → NOT a
  // reasoning model, no REASONING_MODEL_PATTERNS entry. Template: gpt-5.4
  // (non-reasoning) but TEXT-ONLY (no vision capability, no vision-inputs feature).
  createFoundryModel({
    deploymentName: "gpt-5.1",
    displayName: "GPT-5.1",
    description:
      "OpenAI's GPT-5.1 frontier model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use openai/gpt-5.1 for OpenRouter routing.",
    // Source: in-repo openai/gpt-5.1 sibling costs
    costs: { input: 1.25, output: 10.0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
      "pdf",
    ],
    maxContext: 400000,
    fallbackTo: "openai/gpt-5.1",
    releaseDate: "2025-11-13",
    categoryDescription:
      "Frontier-class general-purpose model routed via Microsoft Foundry — same upstream as openai/gpt-5.1, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "unified-instruction-tuned",
      optimisedFor: "frontier-general-purpose",
    },
    bestFor: [
      "high-context reasoning and synthesis",
      "production-quality code generation",
      "Foundry-funded flagship workloads",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "high-context-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this deployment via the Image Describer (4 June 2026). Initially registered text-only pending this verification (cf. gpt-oss-120b, which proved text-only).",
  }),

  // ── gpt-5.2 (vision verified 4 June 2026; PDF verified 23 June 2026 — initially registered text-only) ──
  // Empirically (Phase A): serves 200 and ACCEPTS temperature/top_p → NOT a
  // reasoning model, no REASONING_MODEL_PATTERNS entry. Template: gpt-5.4
  // (non-reasoning) but TEXT-ONLY (no vision capability, no vision-inputs feature).
  createFoundryModel({
    deploymentName: "gpt-5.2",
    displayName: "GPT-5.2",
    description:
      "OpenAI's GPT-5.2 frontier model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use openai/gpt-5.2 for OpenRouter routing.",
    // Source: in-repo openai/gpt-5.2 sibling costs
    costs: { input: 1.75, output: 14.0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
      "pdf",
    ],
    maxContext: 400000,
    fallbackTo: "openai/gpt-5.2",
    releaseDate: "2025-12-11",
    categoryDescription:
      "Frontier-class general-purpose model routed via Microsoft Foundry — same upstream as openai/gpt-5.2, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "unified-instruction-tuned",
      optimisedFor: "frontier-general-purpose",
    },
    bestFor: [
      "high-context reasoning and synthesis",
      "production-quality code generation",
      "Foundry-funded flagship workloads",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "high-context-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this deployment via the Image Describer (4 June 2026). Initially registered text-only pending this verification (cf. gpt-oss-120b, which proved text-only).",
  }),

  // ── gpt-4.1 (vision verified 6 June 2026; PDF verified 23 June 2026 — initially registered text-only) ──
  // Empirically (Phase A batch 2): serves 200 and ACCEPTS temperature/top_p →
  // NOT a reasoning model, no REASONING_MODEL_PATTERNS entry. Template: gpt-5.4
  // (non-reasoning) but TEXT-ONLY (no vision capability, no vision-inputs feature).
  createFoundryModel({
    deploymentName: "gpt-4.1",
    displayName: "GPT-4.1",
    description:
      "OpenAI's GPT-4.1 flagship model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A batch-2 deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. Optimised for instruction following, software engineering, and long-context reasoning. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use openai/gpt-4.1 for OpenRouter routing.",
    // Source: in-repo openai/gpt-4.1 sibling costs
    costs: { input: 2.0, output: 8.0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
      "pdf",
    ],
    maxContext: 1047576,
    fallbackTo: "openai/gpt-4.1",
    releaseDate: "2025-04-14",
    categoryDescription:
      "Flagship general-purpose model routed via Microsoft Foundry — same upstream as openai/gpt-4.1, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "frontier-general-purpose",
    },
    bestFor: [
      "instruction following and software engineering",
      "long-context reasoning and synthesis",
      "Foundry-funded flagship workloads",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "high-context-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this deployment via the Image Describer (6 June 2026). Initially registered text-only pending this verification.",
  }),

  // ── gpt-4.1-mini (vision verified 6 June 2026; PDF verified 23 June 2026 — initially registered text-only) ──
  // Empirically (Phase A batch 2): serves 200 and ACCEPTS temperature/top_p →
  // NOT a reasoning model. Template: gpt-5.4 (non-reasoning) but TEXT-ONLY.
  createFoundryModel({
    deploymentName: "gpt-4.1-mini",
    displayName: "GPT-4.1 Mini",
    description:
      "OpenAI's GPT-4.1 Mini model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A batch-2 deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. Mid-sized, delivering strong performance at lower latency and cost. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use openai/gpt-4.1-mini for OpenRouter routing.",
    // Source: in-repo openai/gpt-4.1-mini sibling costs
    costs: { input: 0.4, output: 1.6 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
      "pdf",
    ],
    maxContext: 1047576,
    fallbackTo: "openai/gpt-4.1-mini",
    releaseDate: "2025-04-14",
    categoryDescription:
      "Mid-sized, cost-effective model routed via Microsoft Foundry — same upstream as openai/gpt-4.1-mini, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "cost-efficiency",
    },
    bestFor: [
      "cost-sensitive general-purpose applications",
      "mid-tier coding and instruction following",
      "Foundry-funded production workloads",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "cost-sensitive-general-purpose",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this deployment via the Image Describer (6 June 2026). Initially registered text-only pending this verification.",
  }),

  // ── gpt-4.1-nano (vision verified 6 June 2026; PDF verified 23 June 2026 — initially registered text-only) ──
  // Empirically (Phase A batch 2): serves 200 and ACCEPTS temperature/top_p →
  // NOT a reasoning model. Template: gpt-5.4 (non-reasoning) but TEXT-ONLY.
  createFoundryModel({
    deploymentName: "gpt-4.1-nano",
    displayName: "GPT-4.1 Nano",
    description:
      "OpenAI's GPT-4.1 Nano model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A batch-2 deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. The fastest, most cost-efficient GPT-4.1 variant, ideal for low-latency classification and extraction. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use openai/gpt-4.1-nano for OpenRouter routing.",
    // Source: in-repo openai/gpt-4.1-nano sibling costs
    costs: { input: 0.1, output: 0.4 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
      "pdf",
    ],
    maxContext: 1047576,
    fallbackTo: "openai/gpt-4.1-nano",
    releaseDate: "2025-04-14",
    categoryDescription:
      "Fastest, most cost-efficient GPT-4.1 variant routed via Microsoft Foundry — same upstream as openai/gpt-4.1-nano, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "speed-and-efficiency",
    },
    bestFor: [
      "high-volume classification and extraction",
      "speed-critical low-latency tasks",
      "Foundry-funded batch workloads",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "high-volume-low-latency",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this deployment via the Image Describer (6 June 2026). Initially registered text-only pending this verification.",
  }),

  // ── gpt-4o (vision verified 6 June 2026; PDF verified 23 June 2026 — initially registered text-only) ──
  // Empirically (Phase A batch 2): serves 200 and ACCEPTS temperature/top_p →
  // NOT a reasoning model. Template: gpt-5.4 (non-reasoning) but TEXT-ONLY.
  // No openai/gpt-4o sibling registered in js/model-definitions.js → fallbackTo
  // null, provisional costs (no in-repo sibling to source from).
  createFoundryModel({
    deploymentName: "gpt-4o",
    displayName: "GPT-4o",
    description:
      "OpenAI's GPT-4o model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A batch-2 deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry.",
    // provisional, pending Foundry invoice reconciliation — no in-repo sibling exists
    costs: { input: 2.5, output: 10.0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
      "pdf",
    ],
    maxContext: 128000,
    fallbackTo: null,
    releaseDate: "2024-11-20",
    categoryDescription:
      "General-purpose model routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "general-purpose",
    },
    bestFor: [
      "general-purpose text generation and dialogue",
      "Foundry-funded production workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "general-purpose-workloads",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this deployment via the Image Describer (6 June 2026). Initially registered text-only pending this verification.",
  }),

  // ── o4-mini (vision verified 6 June 2026; PDF verified 23 June 2026 — initially registered text-only) ──
  // Empirically (Phase A batch 2): serves 200 but REJECTS temperature/top_p
  // (400) → reasoning model. NO new REASONING_MODEL_PATTERNS entry needed — the
  // EXISTING /^o4.*$/i pattern in azure-openai-v1.js already matches "o4-mini".
  // Template: gpt-5.4-mini (reasoning) but TEXT-ONLY (no vision capability/feature).
  createFoundryModel({
    deploymentName: "o4-mini",
    displayName: "o4 Mini",
    description:
      "OpenAI's o4-mini compact reasoning model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A batch-2 deploy-and-classify). Rejects temperature/top_p — treated as a reasoning model (matched by the existing o4 pattern in the adapter). Optimised for fast, cost-efficient multi-step reasoning. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use openai/o4-mini for OpenRouter routing.",
    // Source: in-repo openai/o4-mini sibling costs
    costs: { input: 1.1, output: 4.4 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "reasoning",
      "mathematics",
      "tool_calling",
      "vision",
      "multilingual",
      "pdf",
    ],
    maxContext: 200000,
    fallbackTo: "openai/o4-mini",
    releaseDate: "2025-04-16",
    categoryDescription:
      "Compact reasoning model routed via Microsoft Foundry — same upstream as openai/o4-mini, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "cost-efficient-reasoning",
    },
    bestFor: [
      "fast, cost-efficient multi-step reasoning",
      "agentic and tool-using workflows",
      "Foundry-funded reasoning workloads",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "cost-efficient-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    features: [
      "structured-outputs",
      "tool-calling",
      "reasoning-support",
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified on this deployment via the Image Describer (6 June 2026). Initially registered text-only pending this verification.",
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // FORMAT-SURVEY BATCH + PHI FAMILY (eleven non-OpenAI-format deployments)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // The Phase A format survey empirically proved that Format: xAI, DeepSeek,
  // Cohere, Meta, and Microsoft models ALL serve on the OpenAI-v1 surface
  // (/openai/v1/chat/completions) through the existing Worker and azure-openai
  // adapter — the original Stage 5 assumption of a separate /models/ surface is
  // retired for these formats. ALL register TEXT-ONLY. Every model in this batch
  // ACCEPTS temperature/top_p — including the reasoning ones (DeepSeek-R1,
  // Phi-4-reasoning, Phi-4-mini-reasoning, grok-4-1-fast-reasoning); the
  // reject-sampling-params behaviour is a GPT-5/o-series trait, NOT general, so
  // no REASONING_MODEL_PATTERNS entry is added and none accidentally matches
  // these ids. Reasoning entries mirror gpt-oss-120b's non-pattern reasoning
  // template (reasoning capability + reasoning supportedParams/features).

  // ── grok-4-1-fast-reasoning (xAI format — reasoning, text-only) ──────────
  createFoundryModel({
    deploymentName: "grok-4-1-fast-reasoning",
    displayName: "Grok 4.1 Fast (Reasoning)",
    upstreamProvider: "xAI",
    description:
      "xAI's Grok 4.1 Fast (reasoning variant), routed via Microsoft Foundry. Format 'xAI' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey), so it needs no separate transport. Accepts temperature/top_p. Text-only reasoning model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use x-ai/grok-4.1-fast for OpenRouter routing.",
    // Source: in-repo x-ai/grok-4.1-fast sibling costs
    costs: { input: 0.0, output: 0.0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "reasoning",
      "mathematics",
      "multilingual",
    ],
    maxContext: 2000000,
    fallbackTo: "x-ai/grok-4.1-fast",
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Fast reasoning model (xAI format) routed via Microsoft Foundry — same upstream as x-ai/grok-4.1-fast, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "fast-reasoning",
    },
    bestFor: [
      "fast multi-step reasoning",
      "Foundry-funded reasoning workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "fast-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "reasoning-support",
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only: image input empirically rejected/not processed (probe verified, June 2026).",
  }),

  // ── grok-4-1-fast-non-reasoning (xAI format — non-reasoning, text-only) ──
  createFoundryModel({
    deploymentName: "grok-4-1-fast-non-reasoning",
    displayName: "Grok 4.1 Fast (Non-Reasoning)",
    upstreamProvider: "xAI",
    description:
      "xAI's Grok 4.1 Fast (non-reasoning variant), routed via Microsoft Foundry. Format 'xAI' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only general-purpose model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use x-ai/grok-4.1-fast for OpenRouter routing.",
    // Source: in-repo x-ai/grok-4.1-fast sibling costs
    costs: { input: 0.0, output: 0.0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "multilingual",
    ],
    maxContext: 2000000,
    fallbackTo: "x-ai/grok-4.1-fast",
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Fast general-purpose model (xAI format) routed via Microsoft Foundry — same upstream as x-ai/grok-4.1-fast, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "fast-general-purpose",
    },
    bestFor: [
      "fast general-purpose generation",
      "Foundry-funded production workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "fast-general-purpose",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only: image input empirically rejected/not processed (probe verified, June 2026).",
  }),

  // ── DeepSeek-V3.1 (DeepSeek format — non-reasoning, text-only) ───────────
  createFoundryModel({
    deploymentName: "DeepSeek-V3.1",
    displayName: "DeepSeek V3.1",
    upstreamProvider: "deepseek",
    description:
      "DeepSeek's V3.1 model, routed via Microsoft Foundry. Format 'DeepSeek' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only general-purpose model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use deepseek/deepseek-chat-v3.1 for OpenRouter routing.",
    // Source: in-repo deepseek/deepseek-chat-v3.1 sibling costs
    costs: { input: 0.2, output: 0.8 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "multilingual",
    ],
    maxContext: 163840,
    fallbackTo: "deepseek/deepseek-chat-v3.1",
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "General-purpose model (DeepSeek format) routed via Microsoft Foundry — same upstream as deepseek/deepseek-chat-v3.1, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "general-purpose",
    },
    bestFor: [
      "general-purpose text generation and dialogue",
      "Foundry-funded production workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "general-purpose-workloads",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only: image input empirically rejected/not processed (probe verified, June 2026). Probe returned 200 but the image was not visible to the model (content-verified false positive).",
  }),

  // ── DeepSeek-R1 (DeepSeek format — reasoning, text-only) ─────────────────
  createFoundryModel({
    deploymentName: "DeepSeek-R1",
    displayName: "DeepSeek R1",
    upstreamProvider: "deepseek",
    description:
      "DeepSeek's R1 reasoning model, routed via Microsoft Foundry. Format 'DeepSeek' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only reasoning model; emits chain-of-thought in a separate reasoning_content field (empirically verified, same as gpt-oss-120b). Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use deepseek/deepseek-r1 for OpenRouter routing.",
    // Source: in-repo deepseek/deepseek-r1 sibling costs
    costs: { input: 0.8, output: 2.4 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "reasoning",
      "mathematics",
      "multilingual",
    ],
    maxContext: 128000,
    fallbackTo: "deepseek/deepseek-r1",
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Reasoning model (DeepSeek format) routed via Microsoft Foundry — same upstream as deepseek/deepseek-r1, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "open-weight-reasoning",
    },
    bestFor: [
      "technical and reasoning-heavy tasks",
      "Foundry-funded reasoning workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "open-weight-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "reasoning-support",
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only: image input empirically rejected/not processed (probe verified, June 2026).",
  }),

  // ── cohere-command-a (Cohere format — non-reasoning, text-only) ──────────
  createFoundryModel({
    deploymentName: "cohere-command-a",
    displayName: "Cohere Command A",
    upstreamProvider: "cohere",
    description:
      "Cohere's Command A model, routed via Microsoft Foundry. Format 'Cohere' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only general-purpose model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use cohere/command-a for OpenRouter routing.",
    // Source: in-repo cohere/command-a sibling costs
    costs: { input: 2.5, output: 10.0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "multilingual",
    ],
    maxContext: 256000,
    fallbackTo: "cohere/command-a",
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Enterprise general-purpose model (Cohere format) routed via Microsoft Foundry — same upstream as cohere/command-a, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "enterprise-general-purpose",
    },
    bestFor: [
      "enterprise general-purpose generation",
      "Foundry-funded production workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "enterprise-general-purpose",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only: image input empirically rejected/not processed (probe verified, June 2026).",
  }),

  // ── Llama-3.3-70B-Instruct (Meta format — non-reasoning, text-only) ──────
  createFoundryModel({
    deploymentName: "Llama-3.3-70B-Instruct",
    displayName: "Llama 3.3 70B Instruct",
    upstreamProvider: "meta-llama",
    description:
      "Meta's Llama 3.3 70B Instruct model, routed via Microsoft Foundry. Format 'Meta' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only general-purpose model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use meta-llama/llama-3.3-70b-instruct for OpenRouter routing.",
    // Source: in-repo meta-llama/llama-3.3-70b-instruct sibling costs
    costs: { input: 0.12, output: 0.3 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "multilingual",
    ],
    maxContext: 131072,
    fallbackTo: "meta-llama/llama-3.3-70b-instruct",
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "General-purpose model (Meta format) routed via Microsoft Foundry — same upstream as meta-llama/llama-3.3-70b-instruct, different transport",
    modelArchitecture: {
      parameters: "70B",
      type: "instruction-tuned",
      optimisedFor: "general-purpose",
    },
    bestFor: [
      "general-purpose text generation and dialogue",
      "open-weight production workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "general-purpose-workloads",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only: image input empirically rejected/not processed (probe verified, June 2026).",
  }),

  // ── Phi-4 (Microsoft format — non-reasoning, text-only) ──────────────────
  createFoundryModel({
    deploymentName: "Phi-4",
    displayName: "Phi-4",
    upstreamProvider: "microsoft",
    description:
      "Microsoft's Phi-4 model, routed via Microsoft Foundry. Format 'Microsoft' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only general-purpose model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use microsoft/phi-4 for OpenRouter routing.",
    // Source: in-repo microsoft/phi-4 sibling costs
    costs: { input: 0.07, output: 0.14 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "multilingual",
    ],
    maxContext: 16384,
    fallbackTo: "microsoft/phi-4",
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Small efficient general-purpose model (Microsoft format) routed via Microsoft Foundry — same upstream as microsoft/phi-4, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "small-model-efficiency",
    },
    bestFor: [
      "cost-efficient general-purpose generation",
      "Foundry-funded production workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "small-model-efficiency",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only: image input empirically rejected/not processed (probe verified, June 2026).",
  }),

  // ── Phi-4-mini-instruct (Microsoft format — non-reasoning, text-only) ────
  // No openai-routed sibling registered (microsoft/phi-4-mini-instruct absent).
  createFoundryModel({
    deploymentName: "Phi-4-mini-instruct",
    displayName: "Phi-4 Mini Instruct",
    upstreamProvider: "microsoft",
    description:
      "Microsoft's Phi-4 Mini Instruct model, routed via Microsoft Foundry. Format 'Microsoft' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only general-purpose model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry.",
    // provisional — Foundry MaaS pricing not yet reconciled (no in-repo sibling)
    costs: { input: 0, output: 0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "multilingual",
    ],
    maxContext: 128000, // conservative default pending verification
    fallbackTo: null,
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Small general-purpose model (Microsoft format) routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "small-model-efficiency",
    },
    bestFor: [
      "low-latency cost-efficient generation",
      "Foundry-funded batch workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "small-model-efficiency",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only: image input empirically rejected/not processed (probe verified, June 2026).",
  }),

  // ── Phi-4-multimodal-instruct (Microsoft format — vision verified 6 June 2026) ──
  // Multimodal by spec; vision empirically verified via a no-escape descriptive
  // probe with a real image. Initially registered text-only on an ambiguous
  // degenerate-pixel probe — that was an escape-phrase false negative.
  createFoundryModel({
    deploymentName: "Phi-4-multimodal-instruct",
    displayName: "Phi-4 Multimodal Instruct",
    upstreamProvider: "microsoft",
    description:
      "Microsoft's Phi-4 Multimodal Instruct model, routed via Microsoft Foundry. Format 'Microsoft' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Multimodal by specification, but registered TEXT-ONLY here pending real-image vision verification (see imageSupportNote). Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use microsoft/phi-4-multimodal-instruct for OpenRouter routing.",
    // Source: in-repo microsoft/phi-4-multimodal-instruct sibling costs (text input/output only)
    costs: { input: 0.05, output: 0.1 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "vision",
      "multilingual",
    ],
    maxContext: 131072,
    fallbackTo: "microsoft/phi-4-multimodal-instruct",
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Small multimodal-by-spec model (Microsoft format) routed via Microsoft Foundry — same upstream as microsoft/phi-4-multimodal-instruct, registered text-only pending vision verification",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "small-model-efficiency",
    },
    bestFor: [
      "cost-efficient general-purpose generation",
      "Foundry-funded production workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "small-model-efficiency",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision empirically verified (6 June 2026) via a no-escape descriptive probe with a real image — accurate chart description with ~1680 image prompt tokens confirming ingestion. Note: escape-phrase probes produce a false negative on this model; the v1 surface also serves it from a distinct vision stack (response model field reads 'vision').",
  }),

  // ── Phi-4-reasoning (Microsoft format — reasoning, text-only) ────────────
  // No exact sibling — in-repo microsoft/phi-4-reasoning-plus is a distinct SKU.
  createFoundryModel({
    deploymentName: "Phi-4-reasoning",
    displayName: "Phi-4 Reasoning",
    upstreamProvider: "microsoft",
    description:
      "Microsoft's Phi-4 Reasoning model, routed via Microsoft Foundry. Format 'Microsoft' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only reasoning model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered (the in-repo microsoft/phi-4-reasoning-plus is a distinct SKU) — Foundry-only entry.",
    // provisional — Foundry MaaS pricing not yet reconciled (no in-repo sibling)
    costs: { input: 0, output: 0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "reasoning",
      "mathematics",
      "multilingual",
    ],
    maxContext: 128000, // conservative default pending verification
    fallbackTo: null,
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Small reasoning model (Microsoft format) routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "small-model-reasoning",
    },
    bestFor: [
      "cost-efficient reasoning tasks",
      "Foundry-funded reasoning workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "small-model-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "reasoning-support",
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only: image input empirically rejected/not processed (probe verified, June 2026).",
  }),

  // ── Phi-4-mini-reasoning (Microsoft format — reasoning, text-only) ───────
  // No openai-routed sibling registered (microsoft/phi-4-mini-reasoning absent).
  createFoundryModel({
    deploymentName: "Phi-4-mini-reasoning",
    displayName: "Phi-4 Mini Reasoning",
    upstreamProvider: "microsoft",
    description:
      "Microsoft's Phi-4 Mini Reasoning model, routed via Microsoft Foundry. Format 'Microsoft' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only reasoning model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry.",
    // provisional — Foundry MaaS pricing not yet reconciled (no in-repo sibling)
    costs: { input: 0, output: 0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "reasoning",
      "mathematics",
      "multilingual",
    ],
    maxContext: 128000, // conservative default pending verification
    fallbackTo: null,
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Small reasoning model (Microsoft format) routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "small-model-reasoning",
    },
    bestFor: [
      "low-latency cost-efficient reasoning",
      "Foundry-funded reasoning workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "small-model-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "reasoning-support",
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only: image input empirically rejected/not processed (probe verified, June 2026).",
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // NEW CHAT DEPLOYMENTS (June 2026) — four GlobalStandard chat models on
  // accesstools-foundry-uk, azure-openai /openai/v1 surface
  // ══════════════════════════════════════════════════════════════════════════
  //
  // All four are sampling-param chat models on the EXISTING azure-openai surface
  // — no provider/transport change. reasoning=false for all four (none is a
  // dedicated reasoning SKU); toolCalls=false (mirrors the text-only grounding
  // siblings). Llama-4-Maverick registers vision=true as a HYPOTHESIS (Llama 4
  // Maverick is multimodal by spec and the OpenRouter sibling is multimodal) —
  // pending an Image Describer smoke test; the other three register text-only.
  //
  // upstreamProvider is set to the vendor (matching the registry's existing
  // provider-id convention — "meta-llama"/"deepseek"/"moonshotai"/"mistralai")
  // so each groups with its OpenRouter cousins. This is a DELIBERATE deviation
  // from the earlier Foundry entries above, which left `provider` defaulted to
  // "openai". Costs/maxContext/releaseDate are sourced from each model's in-repo
  // OpenRouter sibling (a public-pricing proxy; Foundry billing may differ).

  // ── Llama-4-Maverick-17B-128E-Instruct-FP8 (Meta format — vision HYPOTHESIS) ──
  createFoundryModel({
    deploymentName: "Llama-4-Maverick-17B-128E-Instruct-FP8",
    displayName: "Llama 4 Maverick 17B 128E Instruct FP8",
    upstreamProvider: "meta-llama",
    description:
      "Meta's Llama 4 Maverick (17B active / 400B total, 128-expert MoE, FP8), routed via Microsoft Foundry. Format 'Meta' — serves on the OpenAI-v1 surface through the existing Foundry adapter (no transport change). Accepts temperature/top_p. Registered vision-capable as a HYPOTHESIS (Llama 4 Maverick is multimodal by specification and the OpenRouter sibling meta-llama/llama-4-maverick supports image input) — NOT yet empirically verified on this Foundry deployment. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use meta-llama/llama-4-maverick for OpenRouter routing.",
    // Source: in-repo meta-llama/llama-4-maverick sibling costs (input/output only; the sibling's image cost is omitted per the Foundry entry shape)
    costs: { input: 0.18, output: 0.6 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "vision",
      "multilingual",
    ],
    maxContext: 1048576,
    fallbackTo: "meta-llama/llama-4-maverick",
    releaseDate: "2025-04-05",
    categoryDescription:
      "Multimodal MoE model (Meta format) routed via Microsoft Foundry — same upstream as meta-llama/llama-4-maverick, different transport",
    modelArchitecture: {
      parameters: "17B active (400B total)",
      type: "mixture-of-experts",
      optimisedFor: "multimodal-general-purpose",
    },
    bestFor: [
      "multimodal applications and image reasoning",
      "long-context processing",
      "Foundry-funded production workloads",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "multimodal-general-purpose",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision verified on Foundry via the Image Describer (piston image, ~6s, 19 June 2026).",
  }),

  // ── DeepSeek-V3.2 (DeepSeek format — non-reasoning, text-only; supersedes V3.1) ──
  createFoundryModel({
    deploymentName: "DeepSeek-V3.2",
    displayName: "DeepSeek V3.2",
    upstreamProvider: "deepseek",
    description:
      "DeepSeek's V3.2 model, routed via Microsoft Foundry. Format 'DeepSeek' — serves on the OpenAI-v1 surface through the existing Foundry adapter (no transport change). Accepts temperature/top_p. Supersedes the Deprecating DeepSeek-V3.1 Foundry deployment. Registered text-only and non-reasoning for this integration (the upstream model also offers reasoning and tool use — NOT claimed here pending verification). Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use deepseek/deepseek-v3.2 for OpenRouter routing.",
    // Source: in-repo deepseek/deepseek-v3.2 sibling costs
    costs: { input: 0.28, output: 0.4 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "multilingual",
    ],
    maxContext: 163840,
    fallbackTo: "deepseek/deepseek-v3.2",
    releaseDate: "2025-12-01",
    categoryDescription:
      "General-purpose model (DeepSeek format) routed via Microsoft Foundry — same upstream as deepseek/deepseek-v3.2, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "general-purpose",
    },
    bestFor: [
      "general-purpose text generation and dialogue",
      "Foundry-funded production workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "general-purpose-workloads",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only: registered without vision capability (consistent with the DeepSeek-V3.1 sibling it supersedes). Image input not verified on this Foundry deployment.",
  }),

  // ── Kimi-K2.5 (MoonshotAI format — non-reasoning, text-only; NEW publisher) ──
  createFoundryModel({
    deploymentName: "Kimi-K2.5",
    displayName: "Kimi K2.5",
    upstreamProvider: "moonshotai",
    description:
      "MoonshotAI's Kimi K2.5 model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (no transport change). Accepts temperature/top_p. Registered text-only and non-reasoning for this integration. (The OpenRouter sibling moonshotai/kimi-k2.5 is natively multimodal upstream, but vision is NOT claimed here until verified on the Foundry deployment.) Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use moonshotai/kimi-k2.5 for OpenRouter routing.",
    // Source: in-repo moonshotai/kimi-k2.5 sibling costs
    costs: { input: 0.6, output: 3.0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "multilingual",
    ],
    maxContext: 262144,
    fallbackTo: "moonshotai/kimi-k2.5",
    releaseDate: "2026-01-27",
    categoryDescription:
      "General-purpose model (MoonshotAI format) routed via Microsoft Foundry — same upstream as moonshotai/kimi-k2.5, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "general-purpose",
    },
    bestFor: [
      "general-purpose text generation and dialogue",
      "Foundry-funded production workloads",
      "UK data residency requirements",
      "testing the Foundry adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "general-purpose-workloads",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only in this registration: registered without vision capability pending verification. The OpenRouter sibling moonshotai/kimi-k2.5 is natively multimodal upstream — vision is a candidate for a follow-up smoke test.",
  }),

  // ── Mistral-Large-3 (Mistral AI format — non-reasoning, text-only; NEW publisher) ──
  createFoundryModel({
    deploymentName: "Mistral-Large-3",
    displayName: "Mistral Large 3",
    upstreamProvider: "mistralai",
    description:
      "Mistral AI's Mistral Large 3 frontier model (41B active / 675B total, granular MoE), routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (no transport change). Accepts temperature/top_p. Registered text-only and non-reasoning for this integration. (The OpenRouter sibling mistralai/mistral-large-2512 'Mistral Large 3 2512' is multimodal upstream, but vision is NOT claimed here until verified on the Foundry deployment.) Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Use mistralai/mistral-large-2512 for OpenRouter routing.",
    // Source: in-repo mistralai/mistral-large-2512 ("Mistral Large 3 2512") sibling costs
    costs: { input: 0.5, output: 1.5 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "mathematics",
      "multilingual",
    ],
    maxContext: 262144,
    fallbackTo: "mistralai/mistral-large-2512",
    releaseDate: "2025-12-01",
    categoryDescription:
      "Frontier general-purpose model (Mistral AI format) routed via Microsoft Foundry — same upstream as mistralai/mistral-large-2512, different transport",
    modelArchitecture: {
      parameters: "41B active (675B total)",
      type: "mixture-of-experts",
      optimisedFor: "frontier-general-purpose",
    },
    bestFor: [
      "frontier general-purpose generation",
      "document analysis and coding assistance",
      "Foundry-funded production workloads",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "frontier-general-purpose",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "system-prompt",
    ],
    imageSupportNote:
      "Text-only in this registration: registered without vision capability pending verification. The OpenRouter sibling mistralai/mistral-large-2512 is multimodal upstream — vision is a candidate for a follow-up smoke test.",
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // RESPONSES-API SURFACE (six Codex/pro deployments — apiSurface: "responses")
  // ══════════════════════════════════════════════════════════════════════════
  //
  // These six are Responses-API-ONLY: they 400 "operation is unsupported" on
  // /openai/v1/chat/completions and speak only /openai/v1/responses. They route
  // through the azure-responses provider (providers/azure-openai-responses.js,
  // Task 2), so `apiSurface: "responses"` gives them the `azure-responses/`
  // prefix and routing. Text-only this integration — NO "vision", NO
  // "tool_calling" (both untested → honest omission; gpt-5-pro vision is
  // Task 5). Costs are provisional {0,0}; fallbackTo null (Foundry-only).
  //
  // SAMPLING SPLIT (must stay in sync with SAMPLING_PARAMS_ALLOWED in
  // providers/azure-openai-responses.js): only gpt-5.3-codex accepts
  // temperature/top_p and emits NO reasoning item; the other five reject
  // sampling params and emit a reasoning item (surfaced as nothing, D3).

  // ── gpt-5-pro (Responses — reasoning + vision, image input wired Task 5b) ──
  createFoundryModel({
    apiSurface: "responses",
    deploymentName: "gpt-5-pro",
    displayName: "GPT-5 Pro",
    description:
      "OpenAI's GPT-5 Pro frontier reasoning model, routed via Microsoft Foundry on the Responses API surface (/openai/v1/responses) — it is Responses-API-only and 400s on chat/completions. Rejects temperature/top_p (reasoning model). Vision-enabled: image input is wired through the azure-responses adapter's input_image translation and verified end-to-end by a live Foundry call (Task 5b). Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry.",
    // provisional — Foundry MaaS pricing not reconciled (no in-repo sibling)
    costs: { input: 0, output: 0 },
    capabilities: [
      "text",
      "dialogue",
      "code",
      "reasoning",
      "mathematics",
      "multilingual",
      "vision",
      "pdf",
    ],
    maxContext: 400000, // GPT-5 family value (matches gpt-5/gpt-5.1/gpt-5.2 entries)
    fallbackTo: null,
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Frontier reasoning model (Responses API) routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "frontier-reasoning",
    },
    bestFor: [
      "frontier reasoning and multi-step problem solving",
      "Foundry-funded reasoning workloads",
      "UK data residency requirements",
      "testing the Responses-API adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "frontier-reasoning",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "reasoning-support",
      "system-prompt",
    ],
    imageSupportNote:
      "gpt-5-pro is vision-enabled: image input is wired through the azure-responses adapter (input_image translation) and verified end-to-end by a live Foundry image round-trip (Task 5b). The Responses Codex deployments likewise accept image input (input_image), verified this session.",
  }),

  // ── gpt-5-codex (Responses — reasoning; reads images and PDFs) ──
  createFoundryModel({
    apiSurface: "responses",
    deploymentName: "gpt-5-codex",
    displayName: "GPT-5 Codex",
    description:
      "OpenAI's GPT-5 Codex agentic-coding model, routed via Microsoft Foundry on the Responses API surface (/openai/v1/responses) — it is Responses-API-only and 400s on chat/completions. Rejects temperature/top_p (reasoning model); emits a reasoning item (surfaced as nothing, D3). Reads images and PDFs via the Responses surface (image input plus server-side PDF extraction). Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry.",
    // provisional — Foundry MaaS pricing not reconciled (no in-repo sibling)
    costs: { input: 0, output: 0 },
    capabilities: ["text", "dialogue", "code", "reasoning", "vision", "pdf"],
    maxContext: 400000, // GPT-5 family value (matches gpt-5/gpt-5.1/gpt-5.2 entries)
    fallbackTo: null,
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Agentic-coding reasoning model (Responses API) routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "agentic-coding",
    },
    bestFor: [
      "agentic and multi-step coding tasks",
      "Foundry-funded coding workloads",
      "UK data residency requirements",
      "testing the Responses-API adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "agentic-coding",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "reasoning-support",
      "system-prompt",
    ],
    imageSupportNote:
      "Image input verified via the Responses surface (input_image) this session — the model describes diagrams and reads visible labels. The earlier ‘text-only, vision out of scope’ note is superseded.",
  }),

  // ── gpt-5.1-codex (Responses — reasoning; reads images and PDFs) ──
  createFoundryModel({
    apiSurface: "responses",
    deploymentName: "gpt-5.1-codex",
    displayName: "GPT-5.1 Codex",
    description:
      "OpenAI's GPT-5.1 Codex agentic-coding model, routed via Microsoft Foundry on the Responses API surface (/openai/v1/responses) — it is Responses-API-only and 400s on chat/completions. Rejects temperature/top_p (reasoning model); emits a reasoning item (surfaced as nothing, D3). Reads images and PDFs via the Responses surface (image input plus server-side PDF extraction). Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry.",
    // provisional — Foundry MaaS pricing not reconciled (no in-repo sibling)
    costs: { input: 0, output: 0 },
    capabilities: ["text", "dialogue", "code", "reasoning", "vision", "pdf"],
    maxContext: 400000, // GPT-5 family value (matches gpt-5/gpt-5.1/gpt-5.2 entries)
    fallbackTo: null,
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Agentic-coding reasoning model (Responses API) routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "agentic-coding",
    },
    bestFor: [
      "agentic and multi-step coding tasks",
      "Foundry-funded coding workloads",
      "UK data residency requirements",
      "testing the Responses-API adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "agentic-coding",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "reasoning-support",
      "system-prompt",
    ],
    imageSupportNote:
      "Image input verified via the Responses surface (input_image) this session — the model describes diagrams and reads visible labels. The earlier ‘text-only, vision out of scope’ note is superseded.",
  }),

  // ── gpt-5.1-codex-mini (Responses — reasoning; reads images and PDFs) ──
  createFoundryModel({
    apiSurface: "responses",
    deploymentName: "gpt-5.1-codex-mini",
    displayName: "GPT-5.1 Codex Mini",
    description:
      "OpenAI's GPT-5.1 Codex Mini agentic-coding model, routed via Microsoft Foundry on the Responses API surface (/openai/v1/responses) — it is Responses-API-only and 400s on chat/completions. Rejects temperature/top_p (reasoning model); emits a reasoning item (surfaced as nothing, D3). Smaller, lower-latency Codex variant. Reads images and PDFs via the Responses surface (image input plus server-side PDF extraction). Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry.",
    // provisional — Foundry MaaS pricing not reconciled (no in-repo sibling)
    costs: { input: 0, output: 0 },
    capabilities: ["text", "dialogue", "code", "reasoning", "vision", "pdf"],
    maxContext: 400000, // GPT-5 family value (matches gpt-5/gpt-5.1/gpt-5.2 entries)
    fallbackTo: null,
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Compact agentic-coding reasoning model (Responses API) routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "agentic-coding",
    },
    bestFor: [
      "low-latency agentic coding tasks",
      "Foundry-funded coding workloads",
      "UK data residency requirements",
      "testing the Responses-API adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "agentic-coding",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "reasoning-support",
      "system-prompt",
    ],
    imageSupportNote:
      "Image input verified via the Responses surface (input_image) this session — the model describes diagrams and reads visible labels. The earlier ‘text-only, vision out of scope’ note is superseded.",
  }),

  // ── gpt-5.2-codex (Responses — reasoning; reads images and PDFs) ──
  createFoundryModel({
    apiSurface: "responses",
    deploymentName: "gpt-5.2-codex",
    displayName: "GPT-5.2 Codex",
    description:
      "OpenAI's GPT-5.2 Codex agentic-coding model, routed via Microsoft Foundry on the Responses API surface (/openai/v1/responses) — it is Responses-API-only and 400s on chat/completions. Rejects temperature/top_p (reasoning model); emits a reasoning item (surfaced as nothing, D3). Reads images and PDFs via the Responses surface (image input plus server-side PDF extraction). Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry.",
    // provisional — Foundry MaaS pricing not reconciled (no in-repo sibling)
    costs: { input: 0, output: 0 },
    capabilities: ["text", "dialogue", "code", "reasoning", "vision", "pdf"],
    maxContext: 400000, // GPT-5 family value (matches gpt-5/gpt-5.1/gpt-5.2 entries)
    fallbackTo: null,
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Agentic-coding reasoning model (Responses API) routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "agentic-coding",
    },
    bestFor: [
      "agentic and multi-step coding tasks",
      "Foundry-funded coding workloads",
      "UK data residency requirements",
      "testing the Responses-API adapter end-to-end",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "agentic-coding",
      "adapter-smoke-testing",
    ],
    supportedParams: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "reasoning-support",
      "system-prompt",
    ],
    imageSupportNote:
      "Image input verified via the Responses surface (input_image) this session — the model describes diagrams and reads visible labels. The earlier ‘text-only, vision out of scope’ note is superseded.",
  }),

  // ── gpt-5.3-codex (Responses — NON-reasoning, accepts temperature/top_p; reads images and PDFs) ──
  // The lone Responses model that accepts sampling params and emits NO
  // reasoning item (phase:"final_answer" only). temperature/top_p allowed here
  // ONLY — must stay in sync with SAMPLING_PARAMS_ALLOWED in
  // providers/azure-openai-responses.js.
  createFoundryModel({
    apiSurface: "responses",
    deploymentName: "gpt-5.3-codex",
    displayName: "GPT-5.3 Codex",
    description:
      "OpenAI's GPT-5.3 Codex agentic-coding model, routed via Microsoft Foundry on the Responses API surface (/openai/v1/responses) — it is Responses-API-only and 400s on chat/completions. UNLIKE the other Responses Codex models, it ACCEPTS temperature/top_p and emits NO reasoning item (phase:\"final_answer\" only), so it is registered without the reasoning capability. Reads images and PDFs via the Responses surface (image input plus server-side PDF extraction). Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry.",
    // provisional — Foundry MaaS pricing not reconciled (no in-repo sibling)
    costs: { input: 0, output: 0 },
    capabilities: ["text", "dialogue", "code", "vision", "pdf"],
    maxContext: 400000, // GPT-5 family value (matches gpt-5/gpt-5.1/gpt-5.2 entries)
    fallbackTo: null,
    releaseDate: null, // not authoritatively known — null per factory unknown-date handling
    categoryDescription:
      "Agentic-coding model (Responses API, standard sampling) routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      optimisedFor: "agentic-coding",
    },
    bestFor: [
      "agentic and multi-step coding tasks",
      "coding workloads needing sampling control (temperature/top_p)",
      "Foundry-funded coding workloads",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "agentic-coding",
      "adapter-smoke-testing",
    ],
    // temperature/top_p allowed here only — must stay in sync with
    // SAMPLING_PARAMS_ALLOWED in providers/azure-openai-responses.js. No
    // reasoning/include_reasoning: this model emits no reasoning item.
    supportedParams: [
      "temperature",
      "top_p",
      "seed",
      "max_tokens",
      "response_format",
      "system-prompt",
    ],
    features: [
      "system-prompt",
    ],
    imageSupportNote:
      "Image input verified via the Responses surface (input_image) this session — the model describes diagrams and reads visible labels. The earlier ‘text-only, vision out of scope’ note is superseded.",
  }),
];

// ============================================================================
// REGISTRATION
// ============================================================================

let registered = 0;
FOUNDRY_MODELS.forEach(({ id, config }) => {
  try {
    modelRegistry.registerModel(id, config);
    registered += 1;
    logDebug(`Registered Foundry model: ${id}`);
  } catch (error) {
    logError(`Failed to register Foundry model ${id}:`, error);
  }
});

logInfo(
  `Foundry model registration complete: ${registered}/${FOUNDRY_MODELS.length} registered`
);

export { createFoundryModel };
