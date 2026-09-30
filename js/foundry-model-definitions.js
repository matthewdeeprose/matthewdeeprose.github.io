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

// Every fallbackTo in this file is now either null or another Foundry
// deployment (register item 107 — never cross the streams), so this warning
// can no longer say "via OpenRouter". It said exactly that until 14 September
// 2026, in two ways that were both wrong: a repaired entry read "falls back to
// (azure-openai/DeepSeek-V3.2 via OpenRouter)", naming a Foundry deployment as
// an OpenRouter one, and an entry with no fallback at all read "falls back to
// (the OpenRouter sibling via OpenRouter)", inventing one. This is a THIRD
// copy of the sentence item 107 tracks, alongside model-registry-accessibility
// .js and model-registry-utils.js, and it is the copy those two do not cover
// because it is built here rather than from the stored field.
function warningProxyMissing(fallbackTo) {
  const base =
    "If proxy URL is missing, the adapter throws 'providerConfig.proxyUrl is required'";
  if (!fallbackTo) {
    return `${base} — no fallback model is registered for this deployment.`;
  }
  return (
    `${base} — falls back to ${fallbackTo}, itself a Microsoft Foundry ` +
    "deployment, only if the consumer wires that fallback explicitly; the " +
    "registry's fallback is informational only."
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
 * @param {string}   [p.reasoningEffort]   The reasoning effort this model's requests should carry.
 *                                         Stored at metadata.reasoningEffort; absent when not given.
 * @param {number}   [p.maxOutputTokens]   The output limit (integer) this model's requests should carry.
 *                                         Stored at metadata.maxOutputTokens; absent when not given.
 *                                         Both live under metadata because registerModel keeps a fixed
 *                                         list of top-level keys and spreads metadata whole (stage ro).
 * @param {string}   [p.retiresOn]         The date Microsoft retires this model, "YYYY-MM-DD".
 *                                         Stored at metadata.retiresOn; absent when not given. From
 *                                         that date (UTC) the model registers DISABLED, so the pickers
 *                                         stop offering it with no human act. An explicit
 *                                         `disabled: true` still wins. Set it only where the catalogue
 *                                         status is Deprecating: a GenerallyAvailable model's date can
 *                                         still move out, and discover.mjs's drift row checks it (parcel 51).
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

  // Optional with NO default: a registration that omits them gains no key.
  reasoningEffort,
  maxOutputTokens,
  retiresOn,
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

  // A model past its retirement date registers disabled, so nothing offers a
  // deployment Microsoft has switched off. Today is read in UTC, the same clock
  // discover.mjs uses for the catalogue's dates.
  const retired =
    retiresOn !== undefined &&
    FoundryModelFactory.isRetiredOn(retiresOn, todayUtcIso());
  if (retired) {
    logInfo(`${id} retired on ${retiresOn}; registered disabled`);
  }

  const config = {
    provider: upstreamProvider,
    name,
    category,
    disabled: disabled || retired,
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

  // Per-model request options go on metadata, the one block registerModel
  // keeps whole. Reached through the exported object so a proof can patch it.
  FoundryModelFactory.copyRequestOptions(config.metadata, {
    reasoningEffort,
    maxOutputTokens,
  });

  // Only a date actually supplied is stored, so every other registration
  // stores exactly what it stored before parcel 51.
  if (retiresOn !== undefined) config.metadata.retiresOn = retiresOn;

  return { id, config };
}

// The shape a retirement date must take. ISO dates in this form compare
// correctly as strings, which is why isRetiredOn needs no Date parsing.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Today's date in UTC, "YYYY-MM-DD".
 *
 * @returns {string}
 */
function todayUtcIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Has a model reached its retirement date? The date to compare against is a
 * parameter, not read from the clock here, so a check can test both sides of
 * a retirement date without faking the clock.
 *
 * A malformed date is logged and treated as NOT retired: the model stays
 * offered, and discover.mjs's drift row reports the mismatch. Throwing instead
 * would abort the whole Foundry list, because the list is built in one array
 * literal outside registerFoundryModels' per-model try.
 *
 * @param {string} retiresOn The retirement date, "YYYY-MM-DD".
 * @param {string} todayIso  The date to compare against, "YYYY-MM-DD".
 * @returns {boolean} true when todayIso is on or after retiresOn.
 */
function isRetiredOn(retiresOn, todayIso) {
  if (!ISO_DATE_PATTERN.test(retiresOn) || !ISO_DATE_PATTERN.test(todayIso)) {
    logError("isRetiredOn: dates must be YYYY-MM-DD", { retiresOn, todayIso });
    return false;
  }
  return todayIso >= retiresOn;
}

/**
 * Copy a registration's declared request options onto its metadata. Only a
 * value actually supplied is copied, so a registration declaring neither
 * stores exactly what it stored before stage ro.
 *
 * @param {Object} metadata The config.metadata block being built.
 * @param {{ reasoningEffort?: string, maxOutputTokens?: number }} options
 * @returns {Object} The same metadata object.
 */
function copyRequestOptions(metadata, { reasoningEffort, maxOutputTokens }) {
  if (reasoningEffort !== undefined) metadata.reasoningEffort = reasoningEffort;
  if (maxOutputTokens !== undefined) metadata.maxOutputTokens = maxOutputTokens;
  return metadata;
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

// REQUEST OPTIONS FOR gpt-5.6-sol (stage ro, 28 September 2026). These two are
// CHOICES for round cf-9 to MEASURE, not probe readings, so they break the
// adapter's rule that a registry field driving the wire be probe-derived
// (openrouter-embed/providers/azure-openai-v1.js, "WHY ENUMERATED AND NOT
// REGISTRY-DERIVED") on purpose and say so here. Round cf-8 (27 September
// 2026) stopped at sol's first chunk: both sends hit the 4,000-token reply
// limit with 3,678 and 4,000 of those tokens spent on reasoning. The probe sent
// the effort omitted, "medium" and "high", never "low"; cf-9's first chunk is
// the first send of "low". Treat both as unmeasured until cf-9 reports.
const GPT_5_6_SOL_REASONING_EFFORT = "low";
const GPT_5_6_SOL_MAX_OUTPUT_TOKENS = 16000;

// REQUEST OPTIONS FOR gpt-6-sol (stage ro-2, 30 September 2026). The same two
// values as gpt-5.6-sol above, and the same standing: CHOICES for round cf-10 to
// MEASURE, not probe readings. The one thing the probe did read is that
// gpt-6-sol's probe of 27 September 2026 (results/probe-gpt-6-sol-2026-09-27.json,
// 13 requests) accepted the effort omitted, explicit-default and explicit-high,
// and saw 0 reasoning tokens on every effort row, on a trivial prompt. "low" has
// never been sent to gpt-6-sol; cf-10's first chunk is the first send of it, and
// a 400 there costs nothing. Without them gpt-6-sol would go out at the 4,000
// token default with no effort, the shape that stopped cf-8 at its first chunk.
const GPT_6_SOL_REASONING_EFFORT = "low";
const GPT_6_SOL_MAX_OUTPUT_TOKENS = 16000;

// Built by a function, not held as a literal, so that
// FoundryModelFactory.registerFoundryModels() can rebuild every registration
// through the factory (stage ro's proof, prove-request-options.mjs).
const buildFoundryModels = () => [
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
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5.4-mini". Same-vendor Foundry peer at the same 400K
    // context with an identical behaviour-capability set (vision, pdf,
    // reasoning, tool_calling).
    fallbackTo: "azure-openai/gpt-5",
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

  // ── gpt-4o-mini (vision-capable, low-cost multimodal; PDF deliberately omitted — transmits but reads blind on this deployment, an Azure per-deployment quirk; sibling gpt-4o behaves the same, verified 14 July 2026) ──
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
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-4o-mini". Its own successor in the same OpenAI mini tier -
    // 8x the context, adds pdf, keeps vision and tool_calling.
    fallbackTo: "azure-openai/gpt-4.1-mini",
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
      "The most lightweight, cost-efficient GPT-5.4 variant, routed via Microsoft Foundry. Optimised for speed-critical, high-volume tasks (classification, extraction, ranking). Empirically verified to support vision and text generation (31 May 2026). Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5.4-nano". Same generation one tier up, same 400K context,
    // strict capability superset.
    fallbackTo: "azure-openai/gpt-5.4-mini",
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
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5.4". No Foundry deployment pairs tool_calling with a
    // context at or above 1050000. gpt-5.5 matches the context but is
    // registered without tool_calling, so it would silently drop tool use.
    fallbackTo: null,
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
      "OpenAI's GPT-5.1 frontier model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5.1". Its direct successor - same 400K context, identical
    // capabilities.
    fallbackTo: "azure-openai/gpt-5.2",
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
      "OpenAI's GPT-5.2 frontier model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5.2". Its direct successor - 2.6x the context, identical
    // capabilities.
    fallbackTo: "azure-openai/gpt-5.4",
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
      "OpenAI's GPT-4.1 flagship model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A batch-2 deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. Optimised for instruction following, software engineering, and long-context reasoning. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-4.1". Next-generation OpenAI flagship on Foundry -
    // identical capabilities, marginally larger context.
    fallbackTo: "azure-openai/gpt-5.4",
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
      "OpenAI's GPT-4.1 Mini model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A batch-2 deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. Mid-sized, delivering strong performance at lower latency and cost. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-4.1-mini". Same family and generation one tier up, same
    // context and capabilities.
    fallbackTo: "azure-openai/gpt-4.1",
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
      "OpenAI's GPT-4.1 Nano model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A batch-2 deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. The fastest, most cost-efficient GPT-4.1 variant, ideal for low-latency classification and extraction. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-4.1-nano". Same family and generation one tier up, same
    // context and capabilities.
    fallbackTo: "azure-openai/gpt-4.1-mini",
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

  // ── gpt-4o (vision verified 6 June 2026; PDF deliberately omitted — transmits but reads blind on this deployment, an Azure per-deployment quirk, verified 14 July 2026; the earlier "PDF verified 23 June 2026" claim is superseded) ──
  // Empirically (Phase A batch 2): serves 200 and ACCEPTS temperature/top_p →
  // NOT a reasoning model. Template: gpt-5.4 (non-reasoning) but TEXT-ONLY.
  // No openai/gpt-4o sibling registered in js/model-definitions.js → fallbackTo
  // null, provisional costs (no in-repo sibling to source from).
  createFoundryModel({
    deploymentName: "gpt-4o",
    displayName: "GPT-4o",
    description:
      "OpenAI's GPT-4o model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A batch-2 deploy-and-classify). Accepts temperature/top_p — standard sampling, not a reasoning model. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry. PDF is transmitted to this deployment but read blind (an Azure per-deployment quirk, verified 14 July 2026), so the pdf capability token is omitted.",
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
      "OpenAI's o4-mini compact reasoning model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A batch-2 deploy-and-classify). Rejects temperature/top_p — treated as a reasoning model (matched by the existing o4 pattern in the adapter). Optimised for fast, cost-efficient multi-step reasoning. Registered text-only pending an image smoke test. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. Microsoft retires this model on 19 November 2026, after which it is no longer offered here.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "openai/o4-mini". The current OpenAI mini-tier reasoning deployment on
    // Foundry - 2x the context, identical capabilities.
    fallbackTo: "azure-openai/gpt-5.4-mini",
    // Catalogue: Deprecating, no newer version (discover.mjs, 28 September
    // 2026). Parcel 51: from this date the model registers disabled.
    retiresOn: "2026-11-19",
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
      "xAI's Grok 4.1 Fast (reasoning variant), routed via Microsoft Foundry. Format 'xAI' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey), so it needs no separate transport. Accepts temperature/top_p. Text-only reasoning model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "x-ai/grok-4.1-fast". Nothing else on Foundry reaches its 2000000
    // context. Its non-reasoning sibling matches the context but drops
    // reasoning, so it fails the superset test.
    fallbackTo: null,
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
      "xAI's Grok 4.1 Fast (non-reasoning variant), routed via Microsoft Foundry. Format 'xAI' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only general-purpose model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "x-ai/grok-4.1-fast". The reasoning variant of the same xAI deployment
    // pair - same 2000000 context, strict capability superset. Note it emits
    // reasoning tokens this variant does not, so a substitution costs more;
    // that is accepted because no closer peer exists.
    fallbackTo: "azure-openai/grok-4-1-fast-reasoning",
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
      "DeepSeek's V3.1 model, routed via Microsoft Foundry. Format 'DeepSeek' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only general-purpose model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // DEAD DEPLOYMENT. Register item 101: a real chat-completion call through the
    // app's own Worker route returned HTTP 410 `model_deprecated` on 14 September
    // 2026, with a gpt-4o-mini control answering 200 in the same run. Disabled so
    // the picker stops offering a model that cannot answer.
    disabled: true,
    // Repointed 14 September 2026 (item 106 — never cross the provider streams).
    // Was "deepseek/deepseek-chat-v3.1", an OpenRouter id a Foundry user cannot
    // reach. Now the Foundry deployment that this entry's own successor supersedes
    // it with. NOTE the value is the REGISTRY ID, not the bare deployment name:
    // getFallbackModel resolves via Map.get on an exact key, and Foundry entries
    // register under `azure-openai/<deploymentName>`.
    fallbackTo: "azure-openai/DeepSeek-V3.2",
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
      "DeepSeek's R1 reasoning model, routed via Microsoft Foundry. Format 'DeepSeek' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only reasoning model; emits chain-of-thought in a separate reasoning_content field (empirically verified, same as gpt-oss-120b). Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // DEAD DEPLOYMENT. Register item 101: a real chat-completion call through the
    // app's own Worker route returned HTTP 410 `model_deprecated` on 14 September
    // 2026, with a gpt-4o-mini control answering 200 in the same run. Disabled so
    // the picker stops offering a model that cannot answer.
    disabled: true,
    // Repointed 14 September 2026 (item 106 — never cross the provider streams).
    // Was "deepseek/deepseek-r1", an OpenRouter id a Foundry user cannot reach.
    // gpt-oss-120b is the closest Foundry reasoning deployment: same 128000
    // context, text-only, GA with no published retirement date, identical
    // supportedParams/features, and the same reasoning_content mechanism this
    // entry's own description already names. NOT DeepSeek-V3.2, which is
    // registered explicitly non-reasoning. NOTE the value is the REGISTRY ID —
    // see the equivalent note on DeepSeek-V3.1 above.
    fallbackTo: "azure-openai/gpt-oss-120b",
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
      "Cohere's Command A model, routed via Microsoft Foundry. Format 'Cohere' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only general-purpose model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "cohere/command-a". The only Cohere deployment on Foundry. Every
    // capability-and-context match is another vendor's model, which is a
    // substitution the user did not choose.
    fallbackTo: null,
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
      "Meta's Llama 3.3 70B Instruct model, routed via Microsoft Foundry. Format 'Meta' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only general-purpose model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "meta-llama/llama-3.3-70b-instruct". Meta's next-generation Foundry
    // deployment - 8x the context and adds vision.
    fallbackTo: "azure-openai/Llama-4-Maverick-17B-128E-Instruct-FP8",
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
      "Microsoft's Phi-4 model, routed via Microsoft Foundry. Format 'Microsoft' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Text-only general-purpose model. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "microsoft/phi-4". Same Microsoft Phi-4 family, 8x the context, strict
    // capability superset, and the only Phi sibling carrying a measured
    // price rather than the unpriced 0/0 of item 89.
    fallbackTo: "azure-openai/Phi-4-multimodal-instruct",
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
      "Microsoft's Phi-4 Multimodal Instruct model, routed via Microsoft Foundry. Format 'Microsoft' — empirically serves on the OpenAI-v1 surface through the existing Foundry adapter (Phase A format survey). Accepts temperature/top_p. Multimodal by specification, but registered TEXT-ONLY here pending real-image vision verification (see imageSupportNote). Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "microsoft/phi-4-multimodal-instruct". The only Phi deployment with
    // vision, so no same-vendor target satisfies the superset test; every
    // alternative is another vendor's model.
    fallbackTo: null,
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
      "Meta's Llama 4 Maverick (17B active / 400B total, 128-expert MoE, FP8), routed via Microsoft Foundry. Format 'Meta' — serves on the OpenAI-v1 surface through the existing Foundry adapter (no transport change). Accepts temperature/top_p. Registered vision-capable as a HYPOTHESIS (Llama 4 Maverick is multimodal by specification and the OpenRouter sibling meta-llama/llama-4-maverick supports image input) — NOT yet empirically verified on this Foundry deployment. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "meta-llama/llama-4-maverick". Meta's largest Foundry deployment - no
    // same-vendor peer reaches its 1048576 context.
    fallbackTo: null,
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
      "DeepSeek's V3.2 model, routed via Microsoft Foundry. Format 'DeepSeek' — serves on the OpenAI-v1 surface through the existing Foundry adapter (no transport change). Accepts temperature/top_p. Supersedes the Deprecating DeepSeek-V3.1 Foundry deployment. Registered text-only and non-reasoning for this integration (the upstream model also offers reasoning and tool use — NOT claimed here pending verification). Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "deepseek/deepseek-v3.2". The only enabled DeepSeek deployment; its
    // two siblings are disabled, and a disabled target is not a repair.
    fallbackTo: null,
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
      "MoonshotAI's Kimi K2.5 model, routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (no transport change). Accepts temperature/top_p. Registered text-only and non-reasoning for this integration. (The OpenRouter sibling moonshotai/kimi-k2.5 is natively multimodal upstream, but vision is NOT claimed here until verified on the Foundry deployment.) Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "moonshotai/kimi-k2.5". The only Moonshot deployment on Foundry. Every
    // capability-and-context match is another vendor's model.
    fallbackTo: null,
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
      "Mistral AI's Mistral Large 3 frontier model (41B active / 675B total, granular MoE), routed via Microsoft Foundry. Serves on the OpenAI-v1 surface through the existing Foundry adapter (no transport change). Accepts temperature/top_p. Registered text-only and non-reasoning for this integration. (The OpenRouter sibling mistralai/mistral-large-2512 'Mistral Large 3 2512' is multimodal upstream, but vision is NOT claimed here until verified on the Foundry deployment.) Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
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
    // Repointed for register item 107 (never cross the streams): was
    // "mistralai/mistral-large-2512". The only Mistral deployment on
    // Foundry. Every capability-and-context match is another vendor's model.
    fallbackTo: null,
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

  // ── gpt-5-mini (chat — reasoning; registered 28 August 2026) ──
  // Measured 27-28 August 2026 by .claude/foundry-catalogue/probe.mjs:
  // requires max_completion_tokens; REFUSES temperature, top_p and both
  // penalties; accepts all three reasoning-effort variants (omitted,
  // explicit default, explicit high) so it needs NO forced effort value.
  // image accepted-reads (INCONCLUSIVE — the token budget bound), pdf accepted-reads.
  // "reasoning" capability: reasoning tokens observed directly (64)
  createFoundryModel({
    deploymentName: "gpt-5-mini",
    displayName: "GPT-5 Mini",
    description:
      "Compact GPT-5 family model balancing capability and cost. Reads images and PDF attachments. Routed via Microsoft Foundry, serving on the OpenAI-v1 surface through the existing Foundry adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 27-28 August 2026: reads images; reads PDF attachments. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
    // Source: in-repo openai/gpt-5-mini sibling costs
    costs: { input: 0.25, output: 2.0 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "vision",
      "pdf",
    ],
    maxContext: 400000,
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5-mini". Same generation one tier up, same 400K context,
    // adds tool_calling.
    fallbackTo: "azure-openai/gpt-5",
    releaseDate: "2025-08-07",
    categoryDescription:
      "Compact GPT-5 family model routed via Microsoft Foundry — same upstream as openai/gpt-5-mini, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "cost-efficiency",
    },
    bestFor: [
      "everyday chat and general assistance",
      "questions over uploaded documents",
      "budget-conscious image description",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "cost-efficiency",
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
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision measured on this deployment 27-28 August 2026: median accepted-reads over three sampled runs (spread 0.00-1.00).",
  }),

  // ── gpt-5-nano (chat — reasoning; registered 28 August 2026) ──
  // Measured 27-28 August 2026 by .claude/foundry-catalogue/probe.mjs:
  // requires max_completion_tokens; REFUSES temperature, top_p and both
  // penalties; accepts all three reasoning-effort variants (omitted,
  // explicit default, explicit high) so it needs NO forced effort value.
  // image accepted-reads, pdf accepted-reads.
  // "reasoning" capability: reasoning tokens observed directly (64, 100, 100)
  createFoundryModel({
    deploymentName: "gpt-5-nano",
    displayName: "GPT-5 Nano",
    description:
      "Smallest GPT-5 family model; fast and inexpensive. Strong image and PDF reading for its size. Routed via Microsoft Foundry, serving on the OpenAI-v1 surface through the existing Foundry adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 27-28 August 2026: reads images; reads PDF attachments. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
    // Source: in-repo openai/gpt-5-nano sibling costs
    costs: { input: 0.05, output: 0.4 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "vision",
      "pdf",
    ],
    maxContext: 400000,
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5-nano". Same generation one tier up, same context and
    // capabilities.
    fallbackTo: "azure-openai/gpt-5-mini",
    releaseDate: "2025-08-07",
    categoryDescription:
      "Smallest GPT-5 family model routed via Microsoft Foundry — same upstream as openai/gpt-5-nano, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "efficiency-at-scale",
    },
    bestFor: [
      "quick, low-latency tasks",
      "high-volume batch work",
      "first drafts and rough summaries",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "efficiency-at-scale",
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
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision measured on this deployment 27-28 August 2026: median accepted-reads over three sampled runs (spread 1.00-1.00).",
  }),

  // ── o3 (chat — reasoning; registered 28 August 2026) ──
  // Measured 27-28 August 2026 by .claude/foundry-catalogue/probe.mjs:
  // requires max_completion_tokens; REFUSES temperature, top_p and both
  // penalties; accepts all three reasoning-effort variants (omitted,
  // explicit default, explicit high) so it needs NO forced effort value.
  // image accepted-partial, pdf accepted-reads.
  // "reasoning" capability: INDIRECT — no reasoning tokens on a trivial
  // prompt, but all four sampling parameters refused, which is the v1
  // adapter's own reasoning-model signature.
  createFoundryModel({
    deploymentName: "o3",
    displayName: "o3",
    description:
      "Reasoning specialist. Handles PDFs well; image understanding present but text inside images reads unreliably. Routed via Microsoft Foundry, serving on the OpenAI-v1 surface through the existing Foundry adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 27-28 August 2026: engages with images but transcribes small text in them unreliably; reads PDF attachments. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry. Microsoft retires this model on 19 November 2026, after which it is no longer offered here.",
    // provisional — Foundry MaaS pricing not reconciled (no in-repo sibling)
    costs: { input: 0, output: 0 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "code",
      "vision",
      "pdf",
    ],
    maxContext: 200000, // o-series family value (matches the o4-mini entry)
    fallbackTo: null,
    // Catalogue: Deprecating, no newer version (discover.mjs, 28 September
    // 2026). Parcel 51: from this date the model registers disabled.
    retiresOn: "2026-11-19",
    releaseDate: "2025-04-16",
    categoryDescription:
      "Reasoning model routed via Microsoft Foundry — no OpenRouter sibling registered, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "multi-step-reasoning",
    },
    bestFor: [
      "multi-step reasoning and analysis",
      "planning and decomposition tasks",
      "document analysis",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "multi-step-reasoning",
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
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision measured 27-28 August 2026: median accepted-partial over three sampled runs — the model engages with the image but transcribes small bitmap text unreliably, reading the fixture word as \"TOILET\" identically across all three.",
  }),

  // ── gpt-5.5 (chat — reasoning; registered 28 August 2026) ──
  // Measured 27-28 August 2026 by .claude/foundry-catalogue/probe.mjs:
  // requires max_completion_tokens; REFUSES temperature, top_p and both
  // penalties; accepts all three reasoning-effort variants (omitted,
  // explicit default, explicit high) so it needs NO forced effort value.
  // image accepted-reads, pdf accepted-reads.
  // "reasoning" capability: reasoning tokens observed directly (7, 7)
  createFoundryModel({
    deploymentName: "gpt-5.5",
    displayName: "GPT-5.5",
    description:
      "Previous-generation flagship; strong all-round capability including image and PDF reading. Routed via Microsoft Foundry, serving on the OpenAI-v1 surface through the existing Foundry adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 27-28 August 2026: reads images; reads PDF attachments. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
    // Source: in-repo openai/gpt-5.5 sibling costs
    costs: { input: 5.0, output: 30.0 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "vision",
      "pdf",
    ],
    maxContext: 1050000,
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5.5". Nothing on Foundry pairs vision, pdf and reasoning
    // with a context at or above 1050000. gpt-5.4 matches the context but is
    // registered without reasoning.
    fallbackTo: null,
    releaseDate: "2026-04-24",
    categoryDescription:
      "Previous-generation flagship routed via Microsoft Foundry — same upstream as openai/gpt-5.5, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "general-purpose-capability",
    },
    bestFor: [
      "complex drafting and analysis",
      "work where the 5.6 family is unnecessary",
      "mixed text, image and document tasks",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "general-purpose-capability",
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
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision measured on this deployment 27-28 August 2026: median accepted-reads over three sampled runs (spread 1.00-1.00).",
  }),

  // ── gpt-5.6-terra (chat — reasoning; registered 28 August 2026) ──
  // Measured 27-28 August 2026 by .claude/foundry-catalogue/probe.mjs:
  // requires max_completion_tokens; REFUSES temperature, top_p and both
  // penalties; accepts all three reasoning-effort variants (omitted,
  // explicit default, explicit high) so it needs NO forced effort value.
  // image accepted-reads, pdf accepted-partial.
  // "reasoning" capability: INDIRECT — no reasoning tokens on a trivial
  // prompt, but all four sampling parameters refused, which is the v1
  // adapter's own reasoning-model signature.
  createFoundryModel({
    deploymentName: "gpt-5.6-terra",
    displayName: "GPT-5.6 Terra",
    description:
      "Current flagship family. Full image reading; PDF handling present but weaker than its siblings in testing. Routed via Microsoft Foundry, serving on the OpenAI-v1 surface through the existing Foundry adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 27-28 August 2026: reads images; reads PDF attachments less reliably than its siblings. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
    // Source: in-repo openai/gpt-5.6-terra sibling costs
    costs: { input: 2.5, output: 15.0 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "vision",
      "pdf",
    ],
    maxContext: 1000000,
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5.6-terra". Largest member of the same 5.6 flagship
    // family, same context and capabilities. Its own description records
    // weaker PDF handling than its siblings, so sol is the upgrade rather
    // than the sideways move.
    fallbackTo: "azure-openai/gpt-5.6-sol",
    releaseDate: "2026-07-09",
    categoryDescription:
      "Current-generation flagship routed via Microsoft Foundry — same upstream as openai/gpt-5.6-terra, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "general-purpose-capability",
    },
    bestFor: [
      "demanding general-purpose work",
      "image-led tasks",
      "prefer Luna or Sol for document-heavy work",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "general-purpose-capability",
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
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision measured on this deployment 27-28 August 2026: median accepted-reads over three sampled runs (spread 1.00-1.00).",
  }),

  // ── gpt-5.6-luna (chat — reasoning; registered 28 August 2026) ──
  // Measured 27-28 August 2026 by .claude/foundry-catalogue/probe.mjs:
  // requires max_completion_tokens; REFUSES temperature, top_p and both
  // penalties; accepts all three reasoning-effort variants (omitted,
  // explicit default, explicit high) so it needs NO forced effort value.
  // image accepted-reads, pdf accepted-reads.
  // "reasoning" capability: INDIRECT — no reasoning tokens on a trivial
  // prompt, but all four sampling parameters refused, which is the v1
  // adapter's own reasoning-model signature.
  createFoundryModel({
    deploymentName: "gpt-5.6-luna",
    displayName: "GPT-5.6 Luna",
    description:
      "Current flagship family; strong across text, images and PDFs. Routed via Microsoft Foundry, serving on the OpenAI-v1 surface through the existing Foundry adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 27-28 August 2026: reads images; reads PDF attachments. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
    // Source: in-repo openai/gpt-5.6-luna sibling costs
    costs: { input: 1.0, output: 6.0 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "vision",
      "pdf",
    ],
    maxContext: 1000000,
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5.6-luna". Largest member of the same 5.6 flagship family,
    // same context and capabilities. Chosen over terra, whose entry records
    // weaker PDF handling.
    fallbackTo: "azure-openai/gpt-5.6-sol",
    releaseDate: "2026-07-09",
    categoryDescription:
      "Current-generation flagship routed via Microsoft Foundry — same upstream as openai/gpt-5.6-luna, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "general-purpose-capability",
    },
    bestFor: [
      "demanding mixed-content work",
      "document-heavy tasks",
      "the default choice in this tier",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "general-purpose-capability",
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
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision measured on this deployment 27-28 August 2026: median accepted-reads over three sampled runs (spread 1.00-1.00).",
  }),

  // ── gpt-5.6-sol (chat — reasoning; registered 28 August 2026) ──
  // Measured 27-28 August 2026 by .claude/foundry-catalogue/probe.mjs:
  // requires max_completion_tokens; REFUSES temperature, top_p and both
  // penalties; accepts all three reasoning-effort variants (omitted,
  // explicit default, explicit high) so it needs NO forced effort value.
  // image accepted-reads, pdf accepted-reads.
  // "reasoning" capability: INDIRECT — no reasoning tokens on a trivial
  // prompt, but all four sampling parameters refused, which is the v1
  // adapter's own reasoning-model signature.
  createFoundryModel({
    deploymentName: "gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    description:
      "Current flagship family; strong across text, images and PDFs. Routed via Microsoft Foundry, serving on the OpenAI-v1 surface through the existing Foundry adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 27-28 August 2026: reads images; reads PDF attachments. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
    // Source: in-repo openai/gpt-5.6-sol sibling costs
    costs: { input: 5.0, output: 30.0 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "vision",
      "pdf",
    ],
    maxContext: 1000000,
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5.6-sol". The previous OpenAI flagship on Foundry at the
    // same capability set and a marginally larger context.
    fallbackTo: "azure-openai/gpt-5.5",
    releaseDate: "2026-07-09",
    categoryDescription:
      "Current-generation flagship routed via Microsoft Foundry — same upstream as openai/gpt-5.6-sol, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "general-purpose-capability",
    },
    bestFor: [
      "demanding mixed-content work",
      "document-heavy tasks",
      "same tier as Luna — pick by cost or availability",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "general-purpose-capability",
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
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision measured on this deployment 27-28 August 2026: median accepted-reads over three sampled runs (spread 1.00-1.00).",
    // Stage ro: choices for round cf-9 to measure; see the two constants above
    // the list. One of two registrations that declare either; gpt-6-sol is the
    // other (stage ro-2).
    reasoningEffort: GPT_5_6_SOL_REASONING_EFFORT,
    maxOutputTokens: GPT_5_6_SOL_MAX_OUTPUT_TOKENS,
  }),

  // ── gpt-6-astra (chat — reasoning; deployed AND registered 17 September 2026) ──
  // Parcel 11-foundry-add-sweep. Deployed by this parcel, then probed BEFORE
  // registration — the order parcel 9 made mandatory when it retired the family
  // wildcards ("ADDING A DEPLOYMENT WITHOUT PROBING IT IS NOW THE FAILURE MODE").
  // Measured 17 September 2026 by .claude/foundry-catalogue/probe.mjs, 13
  // requests, artefact results/probe-gpt-6-astra-2026-09-17.json:
  //   token field : max_completion_tokens (max_tokens refused,
  //                 unsupported_parameter)
  //   sampling    : ALL FOUR refused — temperature unsupported_value ("Only the
  //                 default (1) value is supported"), top_p / presence_penalty /
  //                 frequency_penalty unsupported_parameter. The mixed code pair
  //                 is the same shape the rest of the estate shows.
  //   image       : accepted-reads, 3 of 3 runs, sentinel named, spread 1.00-1.00
  //   pdf         : accepted-reads
  //   effort triad: omitted / explicit-default / explicit-high ALL accepted, so
  //                 it needs no forced effort value.
  // Hidden reasoning spend on the image task was 37 / 50 / 44 completion tokens
  // across the three runs and never returned empty at a high cap, so the
  // STANDARD REASONING_BUDGET_FLOOR (1024) is sufficient and the HIGH floor
  // (2048) is deliberately not used — same reasoning as the five added on
  // 29 August 2026.
  // "reasoning" capability: INDIRECT, on the v1 adapter's own signature (all
  // four sampling parameters refused), not on observed reasoning tokens.
  createFoundryModel({
    deploymentName: "gpt-6-astra",
    displayName: "GPT-6 Astra",
    description:
      "Newest flagship on this resource, for demanding end-to-end work — advanced analysis, software engineering, deep research and document creation. Routed via Microsoft Foundry, serving on the OpenAI-v1 surface through the existing Foundry adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 17 September 2026: reads images; reads PDF attachments. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
    // Source: Azure retail price list (prices.azure.com/api/retail/prices),
    // serviceName "Foundry Models", product "Azure OpenAI GPT6", meters
    // "6-astra ShortCo Inp Std Gl 1M Tokens" / "6-astra ShortCo Opt Std Gl 1M
    // Tokens", Global Standard, USD per 1M, effective 2026-09-01, read 27
    // September 2026 (parcel 46's price-rerun.json). RE-SOURCED 27 September
    // 2026, parcel 47: this comment previously cited the in-repo OpenRouter
    // sibling openai/gpt-6-astra, which crossed the provider streams (register
    // item 107). The figure is unchanged — Azure's list and the sibling agree.
    // LongCo rates also exist (20 / 75); this entry records the ShortCo rate.
    costs: { input: 10.0, output: 50.0 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "vision",
      "pdf",
    ],
    // Source: OpenAI's model page, https://developers.openai.com/api/docs/models/gpt-6-astra,
    // read 27 September 2026 ("1,050,000 context window"; "Maximum input
    // tokens: 922,000"; "128,000 max output tokens"). The Foundry catalogue row
    // carries no context field. RE-SOURCED 27 September 2026, parcel 47: this
    // comment previously cited the OpenRouter sibling; the figure is unchanged.
    maxContext: 1050000,
    // Never cross the provider streams (register item 107): a Foundry entry
    // falls back to a Foundry sibling, never to the OpenRouter one.
    // CHANGED 27 September 2026, parcel 47, from azure-openai/gpt-5.6-sol, which
    // the shipped fallback suitability rule REFUSES on the context floor:
    // gpt-5.6-sol declares 1000000 against astra's 1050000. The corrector did
    // not replace it, so the authored fallback had been dead since this entry
    // was registered. Of the 35 enabled Foundry chat entries other than astra,
    // exactly three pass the rule: gpt-5.5, gpt-6-luna and gpt-6-sol. gpt-6-sol
    // is the same generation and reads images and PDFs fully on its own probe
    // (luna's PDF read is partial). Chain: gpt-6-astra -> gpt-6-sol -> gpt-5.5
    // -> (end). Measured by .claude/measurements/p47-foundry-provenance-pin-and-
    // astra/astra-fallback-check.mjs.
    fallbackTo: "azure-openai/gpt-6-sol",
    releaseDate: "2026-09-03",
    categoryDescription:
      "Newest-generation flagship routed via Microsoft Foundry — same upstream as openai/gpt-6-astra, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "general-purpose-capability",
    },
    bestFor: [
      "the most demanding general-purpose work",
      "advanced analysis and deep research",
      "mixed image and document tasks",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "general-purpose-capability",
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
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision measured on this deployment 17 September 2026: median accepted-reads over three sampled runs (spread 1.00-1.00), sentinel named in all three.",
  }),

  // ── gpt-6-luna (chat — reasoning; deployed 27 September 2026 by the owner, registered the same day) ──
  // Parcel 46. Probed BEFORE registration. Measured 27 September 2026 by
  // .claude/foundry-catalogue/probe.mjs, 13 requests, artefact
  // results/probe-gpt-6-luna-2026-09-27.json:
  //   token field : max_completion_tokens (max_tokens refused,
  //                 unsupported_parameter)
  //   sampling    : ALL FOUR refused — temperature unsupported_value ("Only the
  //                 default (1) value is supported"), top_p / presence_penalty /
  //                 frequency_penalty unsupported_parameter.
  //   image       : median accepted-reads over 3 runs (partial / reads / reads,
  //                 ratio spread 0.67-0.83, sentinel named)
  //   pdf         : accepted-PARTIAL, one run, ratio 0.50 ("HELLO" for HEPDOC).
  //                 Kept as "pdf" on the probe's own rule (partial or better is
  //                 capable) and the gpt-5.6-terra precedent; the description
  //                 says it reads PDFs less reliably.
  //   effort triad: omitted / explicit-default / explicit-high ALL accepted.
  // Hidden reasoning spend on the image task was 1460 / 471 / 1161 completion
  // tokens and never returned empty at a high cap. TWO OF THREE RUNS EXCEED the
  // standard REASONING_BUDGET_FLOOR (1024), so this deployment takes the HIGH
  // floor (2048), unlike astra and sol.
  // "reasoning" capability: on the v1 adapter's own signature (all four sampling
  // parameters refused), and here ALSO observed directly — 6 reasoning tokens
  // on the explicit-high row.
  createFoundryModel({
    deploymentName: "gpt-6-luna",
    displayName: "GPT-6 Luna",
    description:
      "OpenAI's most efficient GPT-6 model, for focused, high-volume tasks. Routed via Microsoft Foundry, serving on the OpenAI-v1 surface through the existing Foundry adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 27 September 2026: reads images; reads PDF attachments less reliably than its siblings. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
    // Source: Azure retail price list (prices.azure.com/api/retail/prices),
    // serviceName "Foundry Models", product "Azure OpenAI GPT6", meters
    // "6-luna ShortCo Inp Std Gl 1M Tokens" / "6-luna ShortCo Opt Std Gl 1M
    // Tokens", Global Standard, USD per 1M, effective 2026-09-01, read 27
    // September 2026. THE FIRST ENTRY IN THIS FILE PRICED FROM AZURE rather than
    // from an OpenRouter sibling or OpenAI's list. LongCo rates also exist
    // (0.2 / 0.75), applying above 272K input tokens per OpenAI's model page;
    // this entry records the ShortCo rate only.
    costs: { input: 0.1, output: 0.5 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "vision",
      "pdf",
    ],
    // Source: OpenAI's model page, https://developers.openai.com/api/docs/models/gpt-6-luna,
    // read 27 September 2026 ("1,050,000 context window"). The Foundry
    // catalogue row carries no context field.
    maxContext: 1050000,
    // Never cross the provider streams (register item 107): a Foundry entry
    // falls back to a Foundry sibling, never to the OpenRouter one.
    // CHANGED 28 September 2026, parcel 48, from azure-openai/gpt-5.5. The
    // comment here then said gpt-5.5 was the only eligible target; that was
    // false once gpt-6-sol and gpt-6-astra were registered. Of the 35 enabled
    // Foundry chat entries other than luna, exactly three pass the shipped
    // fallback suitability rule: gpt-6-sol ($2 / $10, 20x luna's input price),
    // gpt-5.5 ($5 / $30, 50x) and gpt-6-astra ($10 / $50, 100x). The gpt-5.6
    // family sits at 1000000 and is refused on the context floor. gpt-6-sol is
    // the cheapest eligible target and the same generation, and reads PDFs fully
    // where luna's read is partial. Chain: gpt-6-luna -> gpt-6-sol -> gpt-5.5
    // -> (end). Measured by .claude/measurements/p48-foundry-descriptions-and-
    // luna-fallback/luna-fallback-check.mjs.
    // REACHABILITY, measured the same day (that folder's drive-foundry-429.mjs):
    // a rate limit on luna in Chat does NOT reach this fallback on either motion
    // setting — with motion on the embed retries luna itself, with reduced motion
    // the send fails with no retry and no fallback — because the fallback walk
    // is entered only from the OpenRouter client, which a Foundry send never calls.
    fallbackTo: "azure-openai/gpt-6-sol",
    releaseDate: "2026-09-22",
    categoryDescription:
      "Newest-generation efficient model routed via Microsoft Foundry",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "efficiency-at-scale",
    },
    bestFor: [
      "focused, high-volume tasks",
      "low-cost image reading",
      "everyday work where cost matters most",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "cost-efficiency",
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
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision measured on this deployment 27 September 2026: median accepted-reads over three sampled runs (spread 0.67-0.83), sentinel named.",
  }),

  // ── gpt-6-sol (chat — reasoning; deployed 27 September 2026 by the owner, registered the same day) ──
  // Parcel 46. Probed BEFORE registration. Measured 27 September 2026 by
  // .claude/foundry-catalogue/probe.mjs, 13 requests, artefact
  // results/probe-gpt-6-sol-2026-09-27.json:
  //   token field : max_completion_tokens (max_tokens refused,
  //                 unsupported_parameter)
  //   sampling    : ALL FOUR refused — temperature unsupported_value ("Only the
  //                 default (1) value is supported"), top_p / presence_penalty /
  //                 frequency_penalty unsupported_parameter.
  //   image       : accepted-reads, 3 of 3 runs, ratio 0.83 each, sentinel named
  //   pdf         : accepted-reads, ratio 1.00
  //   effort triad: omitted / explicit-default / explicit-high ALL accepted.
  // Hidden reasoning spend on the image task was 222 / 267 / 162 completion
  // tokens and never returned empty at a high cap, so the STANDARD
  // REASONING_BUDGET_FLOOR (1024) is sufficient.
  // "reasoning" capability: INDIRECT, on the v1 adapter's own signature (all
  // four sampling parameters refused), not on observed reasoning tokens (0 on
  // every effort row).
  createFoundryModel({
    deploymentName: "gpt-6-sol",
    displayName: "GPT-6 Sol",
    description:
      "GPT-6 model built for complex coding and agentic workflows, at a fraction of Astra's price. Routed via Microsoft Foundry, serving on the OpenAI-v1 surface through the existing Foundry adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 27 September 2026: reads images; reads PDF attachments. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
    // Source: Azure retail price list (prices.azure.com/api/retail/prices),
    // serviceName "Foundry Models", product "Azure OpenAI GPT6", meters
    // "6-sol ShortCo Inp Std Gl 1M Tokens" / "6-sol ShortCo Opt Std Gl 1M
    // Tokens", Global Standard, USD per 1M, effective 2026-09-01, read 27
    // September 2026. Priced from Azure, as gpt-6-luna above. LongCo rates also
    // exist (4 / 15), applying above 272K input tokens per OpenAI's model page;
    // this entry records the ShortCo rate only.
    costs: { input: 2.0, output: 10.0 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "vision",
      "pdf",
    ],
    // Source: OpenAI's model page, https://developers.openai.com/api/docs/models/gpt-6-sol,
    // read 27 September 2026 ("1,050,000 context window"; the same page gives
    // 922,000 max input tokens). The Foundry catalogue row carries no context
    // field.
    maxContext: 1050000,
    // Never cross the provider streams (register item 107). CORRECTED 28
    // September 2026, parcel 48: this comment said gpt-5.5 was the only Foundry
    // chat entry the fallback suitability rule accepts here. It is not: gpt-5.5,
    // gpt-6-luna and gpt-6-astra all pass. gpt-5.5 is kept, because luna's PDF
    // read is partial and astra is 5x this entry's price. gpt-5.5 declares no
    // onward fallback, so the chain terminates.
    fallbackTo: "azure-openai/gpt-5.5",
    releaseDate: "2026-09-22",
    categoryDescription:
      "Newest-generation mid-tier model routed via Microsoft Foundry",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "general-purpose-capability",
    },
    bestFor: [
      "complex coding and agentic workflows",
      "demanding mixed-content work",
      "document-heavy tasks",
      "UK data residency requirements",
    ],
    preferredFor: [
      "foundry-routed-workloads",
      "uk-data-residency",
      "general-purpose-capability",
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
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision measured on this deployment 27 September 2026: median accepted-reads over three sampled runs (spread 0.83-0.83), sentinel named in all three.",
    // Stage ro-2: choices for round cf-10 to measure; see the two constants above
    // the list.
    reasoningEffort: GPT_6_SOL_REASONING_EFFORT,
    maxOutputTokens: GPT_6_SOL_MAX_OUTPUT_TOKENS,
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // RESPONSES-API SURFACE (eight Codex/pro deployments — apiSurface: "responses")
  // ══════════════════════════════════════════════════════════════════════════
  //
  // These eight route through the azure-responses provider
  // (providers/azure-openai-responses.js, Task 2), so `apiSurface: "responses"`
  // gives them the `azure-responses/` prefix and routing.
  //
  // The six original members are Responses-API-ONLY: they 400 "operation is
  // unsupported" on /openai/v1/chat/completions. THAT WAS NOT RE-TESTED for the
  // two added on 28 August 2026 (gpt-5.4-pro, gpt-5.1-codex-max) — both were
  // probed on the Responses surface only, which they serve, so the
  // chat-rejection claim is NOT made about them.
  //
  // VISION and PDF are PER-ENTRY facts on this surface, each recorded in its
  // own entry against the measurement that established it — they are not a
  // property of the surface and must not be summarised here. TOOL_CALLING
  // remains untested across every member and is omitted everywhere.
  //
  // SAMPLING SPLIT (must stay in sync with SAMPLING_PARAMS_ALLOWED in
  // providers/azure-openai-responses.js): only gpt-5.3-codex accepts
  // temperature/top_p and emits NO reasoning item; every other member rejects
  // sampling params. Confirmed 28 August 2026 for the two added that day —
  // both refused all four sampling parameters.
  //
  // REASONING EFFORT: gpt-5-pro remains the ONLY member needing a forced
  // "high" (REASONING_EFFORT_HIGH_ONLY in the provider). Both 28 August
  // additions accepted all three effort variants, so neither joins it.

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
      "frequency_penalty",
      "presence_penalty",
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
  // ── gpt-5.4-pro (Responses — reasoning + vision + pdf; registered 28 August
  //    2026, pdf resolved 30 August 2026) ──
  // Measured 27-28 August 2026 by .claude/foundry-catalogue/probe.mjs:
  // requires max_completion_tokens; REFUSES temperature, top_p and both
  // penalties; accepts all three reasoning-effort variants (omitted,
  // explicit default, explicit high) so it needs NO forced effort value.
  // image accepted-reads, pdf errored (transport timeout, not a refusal).
  // "reasoning" capability: reasoning tokens observed directly (19, 11, 14)
  createFoundryModel({
    apiSurface: "responses",
    deploymentName: "gpt-5.4-pro",
    displayName: "GPT-5.4 Pro",
    description:
      "Pro-tier reasoning model on the Responses surface. Reads images and PDFs. Routed via Microsoft Foundry on the Responses API surface (/openai/v1/responses) through the azure-responses adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 27-28 August 2026: reads images. PDF RESOLVED 30 August 2026 — accepted-reads, 6/6 sentinel characters on an image-only fixture, 363 input and 2935 output tokens. The two earlier attempts were TRANSPORT TIMEOUTS, not refusals: re-running at a 600s ceiling returned a clean 200 well inside the standing token budget, so latency was the whole cause. Attribution is unattributed — this surface preprocesses the attachment, so the read cannot be assigned to the model rather than the platform. Available on the credit-funded accesstools-foundry-uk (UK South) deployment.",
    // Source: in-repo openai/gpt-5.4-pro sibling costs
    costs: { input: 30.0, output: 180.0 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "vision",
      // Added 30 August 2026. The 28 August registration withheld this token
      // because the probe had TIMED OUT twice on the transport — an absence of
      // evidence, not evidence of absence. Re-run at a 600s ceiling it returned
      // accepted-reads, 6/6 sentinel characters, 363 input and 2935 output
      // tokens: comfortably inside the standing budget, so latency was the
      // whole cause and no cap was ever binding. Artefact:
      // results/probe-retry-gpt-5.4-pro-2026-08-30.json.
      "pdf",
    ],
    maxContext: 1050000,
    // Repointed for register item 107 (never cross the streams): was
    // "openai/gpt-5.4-pro". No Responses deployment matches its 1050000
    // context, and no Foundry deployment on either surface offers the pro
    // tier's extended reasoning. A non-pro substitute would silently remove
    // exactly what the tier is chosen for.
    fallbackTo: null,
    releaseDate: "2026-03-05",
    categoryDescription:
      "Pro-tier reasoning model (Responses API) routed via Microsoft Foundry — same upstream as openai/gpt-5.4-pro, different transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "frontier-reasoning",
    },
    bestFor: [
      "the hardest reasoning tasks",
      "work alongside gpt-5-pro",
      "image-bearing analysis",
      "UK data residency requirements",
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
      "vision-inputs",
      "system-prompt",
    ],
    imageSupportNote:
      "Vision measured on this deployment 27-28 August 2026: median accepted-reads over three sampled runs (spread 1.00-1.00).",
  }),

  // ── gpt-5.1-codex-max (Responses — reasoning + pdf + vision; registered 28
  //    August 2026, vision resolved 30 August 2026 at tier accepted-partial) ──
  // Measured 27-28 August 2026 by .claude/foundry-catalogue/probe.mjs:
  // requires max_completion_tokens; REFUSES temperature, top_p and both
  // penalties; accepts all three reasoning-effort variants (omitted,
  // explicit default, explicit high) so it needs NO forced effort value.
  // image accepted-blind (INCONCLUSIVE — the token budget bound), pdf accepted-reads.
  // "reasoning" capability: reasoning tokens observed directly (64, 64)
  createFoundryModel({
    apiSurface: "responses",
    deploymentName: "gpt-5.1-codex-max",
    displayName: "GPT-5.1 Codex Max",
    description:
      "Large Codex-family coding model on the Responses surface. Reads images, but transcribes bitmap text unreliably. Routed via Microsoft Foundry on the Responses API surface (/openai/v1/responses) through the azure-responses adapter. Rejects temperature/top_p (reasoning model) and requires max_completion_tokens. Measured 27-28 August 2026: reads PDF attachments; image reading was UNVERIFIED because the probe's token budget bound before an answer was emitted. RESOLVED 30 August 2026 at a 64000 budget — accepted-partial, unanimous across three sampled runs, transcribing the six-character fixture as TOILET, TOLLEUM and TOLTEEU (2/6, 4/6, 3/6). It engages with image content; it does not transcribe reliably. The earlier binding is now explained rather than inferred: one run spent 19,176 output tokens, above the standing 16000 cap, so that cap was the cause. Available on the credit-funded accesstools-foundry-uk (UK South) deployment. No OpenRouter sibling registered — Foundry-only entry.",
    // provisional — Foundry MaaS pricing not reconciled (no in-repo sibling)
    costs: { input: 0, output: 0 },
    capabilities: [
      "text",
      "dialogue",
      "reasoning",
      "code",
      "pdf",
      // Added 30 August 2026 at tier accepted-PARTIAL, and the tier is the
      // point: three sampled runs all returned accepted-partial (2/6, 4/6, 3/6
      // sentinel characters), so the model demonstrably engages with image
      // content while transcribing bitmap text unreliably. The 28 August
      // registration withheld this token because the 16000-token budget bound
      // before an answer was emitted — a cap that binds is indistinguishable
      // in the verdict from a model that cannot do the task. Re-run at 64000
      // one sample spent 19,176 output tokens, above the old cap, which
      // measures the binding rather than inferring it. Artefact:
      // results/probe-retry-gpt-5.1-codex-max-2026-08-30.json.
      "vision",
    ],
    maxContext: 400000, // GPT-5 family value (matches the gpt-5.1-codex entry)
    fallbackTo: null,
    releaseDate: "2025-12-04",
    categoryDescription:
      "Large agentic-coding reasoning model (Responses API) routed via Microsoft Foundry — no OpenRouter sibling, Foundry-only transport",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-instruction-tuned",
      optimisedFor: "agentic-coding",
    },
    bestFor: [
      "substantial code generation",
      "code review and refactoring",
      "agentic and multi-step coding tasks",
      "UK data residency requirements",
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
      "Vision RESOLVED 30 August 2026 at tier accepted-PARTIAL — it reads images and transcribes bitmap text unreliably. Three sampled runs all returned accepted-partial, rendering the six-character fixture as TOILET, TOLLEUM and TOLTEEU (2/6, 4/6, 3/6). Use it for image content; do not rely on it to transcribe text in an image. This supersedes the 28 August wording, which read that vision was UNVERIFIED because two of three runs consumed the whole 16,000-token budget and returned nothing — that reading was correct at the time and the cause is now measured rather than inferred: re-run at 64,000, one sample spent 19,176 output tokens, above the old cap, so the cap was the whole cause and no run was ever blind.",
  }),
];

// ============================================================================
// REGISTRATION
// ============================================================================

/**
 * Build the list through the factory and register every entry. Runs once at
 * load; a proof may run it again after patching FoundryModelFactory.
 *
 * @returns {number} How many registrations succeeded.
 */
function registerFoundryModels() {
  const models = buildFoundryModels();
  let registered = 0;
  models.forEach(({ id, config }) => {
    try {
      modelRegistry.registerModel(id, config);
      registered += 1;
      logDebug(`Registered Foundry model: ${id}`);
    } catch (error) {
      logError(`Failed to register Foundry model ${id}:`, error);
    }
  });

  logInfo(
    `Foundry model registration complete: ${registered}/${models.length} registered`
  );
  return registered;
}

// The seam object. The factory reaches its field copy through it, so a patch
// here changes what the next registration stores.
const FoundryModelFactory = {
  createFoundryModel,
  copyRequestOptions,
  isRetiredOn,
  registerFoundryModels,
};

FoundryModelFactory.registerFoundryModels();

export { createFoundryModel, FoundryModelFactory };
