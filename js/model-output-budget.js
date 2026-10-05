/**
 * @file model-output-budget.js
 * @module ModelOutputBudget
 * @description
 * Parcel H-17 (2 October 2026) — the shared output-token resolver.
 *
 * A tool's `max_tokens` should follow the model it is actually sending to, not be
 * one fixed number for every model. Each tool declares ONE generous ceiling and a
 * fallback; this module returns the smaller of that ceiling and the model's own
 * published output limit.
 *
 *   for(modelId, { toolCeiling, fallback, promptTokens?, contextMargin? })
 *     1. the model's own ceiling, from the generated data (js/model-output-ceilings.js)
 *        ONLY (H-21b, 4 October 2026):
 *          min(toolCeiling, that ceiling)
 *        The registry's metadata.maxOutputTokens is deliberately NOT read. On the Foundry
 *        entries it holds a REQUEST SETTING chosen for the Captions Fixer (16000 for
 *        azure-openai/gpt-5.6-sol and gpt-6-sol, "CHOICES for round cf-9 to MEASURE, not
 *        probe readings", js/foundry-model-definitions.js), not the model's limit. H-19a
 *        read it as a ceiling and cut the MathPix enhancer's request from 32,768 to 16,000.
 *        Do not restore the read; a real Foundry ceiling belongs in the generated data.
 *     2. no ceiling known anywhere: min(toolCeiling, fallback)
 *     3. if promptTokens is given and a context length is known (generated contextLength
 *        first, else registry maxContext): also capped at
 *          contextLength - promptTokens - contextMargin   (margin defaults to 512)
 *        and when that room is below 1 the budget is 1 and contextExhausted is true;
 *        the caller decides what to do, it must not be sent silently.
 *     4. never more than toolCeiling, never less than 1.
 *     limitedBy names the limit that bound the result.
 *     A non-string or empty id, a non-positive-integer toolCeiling or fallback, or a
 *     negative or fractional promptTokens or contextMargin THROWS: that is a caller bug
 *     and should be loud, not clamped into a plausible number.
 *
 * There is NO list of model ids here and none must be added: the data is generated
 * from the live OpenRouter model list by .claude/model-ceilings/build-ceilings.mjs.
 *
 * Both the generated data (window.ModelOutputCeilings) and the registry
 * (window.modelRegistry, an ES module that loads AFTER this file) are reached at CALL
 * time, never at load. An absent registry or a throwing getModel means "not known".
 * If the data file is absent the resolver says so once. Data older than 14 days is
 * reported once, naming the command that refreshes it.
 *
 * NO DOM, NO network.
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Logging (per AGENTS.md § Logging Standards — IIFE pattern)
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
      console.error(`[ModelOutputBudget] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ModelOutputBudget] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ModelOutputBudget] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ModelOutputBudget] ${message}`, ...args);
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /** Where a resolved budget came from. */
  const SOURCE = Object.freeze({ MODEL: "model", FALLBACK: "fallback" });

  /** Which data supplied a model's ceiling or context length. */
  const FROM = Object.freeze({ GENERATED: "generated", REGISTRY: "registry" });

  /** Which limit produced the final budget. */
  const LIMITED_BY = Object.freeze({
    TOOL: "tool",
    MODEL: "model",
    FALLBACK: "fallback",
    CONTEXT: "context",
  });

  const MIN_BUDGET = 1;

  /** Tokens kept back from the context window; the margin Chat already uses (chat/chat-core.js). */
  const DEFAULT_CONTEXT_MARGIN = 512;

  /** Generated data older than this is reported once. */
  const STALE_AFTER_DAYS = 14;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const REFRESH_COMMAND = "node .claude/model-ceilings/build-ceilings.mjs --apply";

  let warnedDataAbsent = false;
  let warnedDataStale = false;

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  const isPositiveInteger = (v) =>
    typeof v === "number" && Number.isInteger(v) && v >= MIN_BUDGET;

  const isNonNegativeInteger = (v) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0;

  function assertModelId(modelId) {
    if (typeof modelId !== "string" || modelId.trim() === "") {
      throw new TypeError("ModelOutputBudget: modelId must be a non-empty string");
    }
  }

  function assertArguments(modelId, toolCeiling, fallback, promptTokens, contextMargin) {
    assertModelId(modelId);
    if (!isPositiveInteger(toolCeiling)) {
      throw new TypeError("ModelOutputBudget: toolCeiling must be a positive integer");
    }
    if (!isPositiveInteger(fallback)) {
      throw new TypeError("ModelOutputBudget: fallback must be a positive integer");
    }
    if (promptTokens !== undefined && !isNonNegativeInteger(promptTokens)) {
      throw new TypeError("ModelOutputBudget: promptTokens must be a non-negative integer");
    }
    if (!isNonNegativeInteger(contextMargin)) {
      throw new TypeError("ModelOutputBudget: contextMargin must be a non-negative integer");
    }
  }

  /**
   * Warn once if the generated data is old. An absent or unparseable capturedAt
   * produces NO warning: age cannot be judged, and the data's absence is reported elsewhere.
   */
  function checkFreshness(data) {
    if (warnedDataStale || !data || typeof data.capturedAt !== "string") return;
    const captured = Date.parse(data.capturedAt);
    if (Number.isNaN(captured)) return;
    const ageDays = (Date.now() - captured) / MS_PER_DAY;
    if (ageDays <= STALE_AFTER_DAYS) return;
    warnedDataStale = true;
    logWarn(
      `Generated ceilings data is ${Math.floor(ageDays)} days old (captured ${data.capturedAt}); refresh with: ${REFRESH_COMMAND}`,
    );
  }

  /** The generated data's entry for this id, or null. */
  function generatedEntryFor(modelId) {
    const data = window.ModelOutputCeilings;
    if (!data || !data.entries) {
      if (!warnedDataAbsent) {
        warnedDataAbsent = true;
        logWarn("Generated ceilings data is absent; models rely on the fallback (and the registry for context length)");
      }
      return null;
    }
    checkFreshness(data);
    // Own properties only: an id such as "constructor" must not resolve to Object's.
    if (!Object.prototype.hasOwnProperty.call(data.entries, modelId)) return null;
    return data.entries[modelId] || null;
  }

  /**
   * The registry's entry for this id, or null. Read at CALL time (the registry is an ES
   * module that loads after this file); an absent registry or a throwing getModel is "not known".
   */
  function registryEntryFor(modelId) {
    try {
      const registry = window.modelRegistry;
      if (!registry || typeof registry.getModel !== "function") return null;
      const entry = registry.getModel(modelId, true);
      return entry && typeof entry === "object" ? entry : null;
    } catch (error) {
      logDebug("Registry lookup failed", modelId, error);
      return null;
    }
  }

  /** The model's own ceiling: the generated data only. The registry's metadata.maxOutputTokens is a request setting, not a limit (see the header). */
  function ceilingFor(generated) {
    if (generated && isPositiveInteger(generated.maxOutputTokens)) {
      return { value: generated.maxOutputTokens, from: FROM.GENERATED };
    }
    return { value: null, from: null };
  }

  /** The model's context length: generated data first, then the registry's maxContext. */
  function contextFor(generated, registryEntry) {
    if (generated && isPositiveInteger(generated.contextLength)) {
      return { value: generated.contextLength, from: FROM.GENERATED };
    }
    const declared = registryEntry && registryEntry.maxContext;
    if (isPositiveInteger(declared)) return { value: declared, from: FROM.REGISTRY };
    return { value: null, from: null };
  }

  function lookup(modelId) {
    const generated = generatedEntryFor(modelId);
    const registryEntry = registryEntryFor(modelId);
    return {
      ceiling: ceilingFor(generated),
      context: contextFor(generated, registryEntry),
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * @param {string} modelId
   * @param {{ toolCeiling: number, fallback: number, promptTokens?: number, contextMargin?: number }} options
   * @returns {{
   *   budget: number, source: "model"|"fallback", modelCeiling: number|null,
   *   modelCeilingFrom: "generated"|null,
   *   contextLength: number|null, contextFrom: "generated"|"registry"|null,
   *   limitedBy: "tool"|"model"|"fallback"|"context", contextExhausted: boolean
   * }}
   */
  function describe(
    modelId,
    { toolCeiling, fallback, promptTokens, contextMargin = DEFAULT_CONTEXT_MARGIN } = {},
  ) {
    assertArguments(modelId, toolCeiling, fallback, promptTokens, contextMargin);
    const { ceiling, context } = lookup(modelId);

    let budget;
    let source;
    let limitedBy;
    if (ceiling.value === null) {
      source = SOURCE.FALLBACK;
      budget = Math.min(toolCeiling, fallback);
      limitedBy = fallback < toolCeiling ? LIMITED_BY.FALLBACK : LIMITED_BY.TOOL;
    } else {
      source = SOURCE.MODEL;
      budget = Math.min(toolCeiling, ceiling.value);
      limitedBy = ceiling.value < toolCeiling ? LIMITED_BY.MODEL : LIMITED_BY.TOOL;
    }

    // Room left for the answer. Only when the caller says how big the prompt is AND the
    // context length is known; otherwise the budget is exactly what it always was.
    let contextExhausted = false;
    if (promptTokens !== undefined && context.value !== null) {
      const room = context.value - promptTokens - contextMargin;
      if (room < MIN_BUDGET) {
        budget = MIN_BUDGET;
        limitedBy = LIMITED_BY.CONTEXT;
        contextExhausted = true;
      } else if (room < budget) {
        budget = room;
        limitedBy = LIMITED_BY.CONTEXT;
      }
    }

    const result = {
      budget,
      source,
      modelCeiling: ceiling.value,
      modelCeilingFrom: ceiling.from,
      contextLength: context.value,
      contextFrom: context.from,
      limitedBy,
      contextExhausted,
    };
    logDebug("Resolved", modelId, result);
    return result;
  }

  /** The number of tokens to send as `max_tokens` for this model. */
  function forModel(modelId, options) {
    return describe(modelId, options).budget;
  }

  /** The model's context length in tokens, or null when neither source knows it (e.g. `local/…`). */
  function contextLength(modelId) {
    assertModelId(modelId);
    return lookup(modelId).context.value;
  }

  window.ModelOutputBudget = Object.freeze({
    for: forModel,
    describe,
    contextLength,
    SOURCE,
  });

  logInfo("Model output budget resolver ready");
})();
