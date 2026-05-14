/**
 * OpenRouter Embed API - Model Selector (Stage 5 Phase 5)
 *
 * Provides capability-based model selection with cost awareness
 * for OpenRouter Embed API.
 *
 * @version 1.0.0 (Stage 5 Phase 5)
 * @date 30 November 2025
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
      console.error(`[EmbedModelSelector ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedModelSelector WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedModelSelector INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedModelSelector DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  /**
   * Default configuration
   */
  const DEFAULT_CONFIG = {
    preferredModels: [],
    requiredCapabilities: [],
    preferredCapabilities: [],
    fallbackModel: "anthropic/claude-3.5-haiku",
    costPreference: "balanced", // 'cheapest' | 'balanced' | 'best'
    excludeModels: [],
    visionRequired: null, // null = auto-detect
    streamingRequired: null, // null = auto-detect
  };

  /**
   * Capability mapping - maps capability names to model property checks
   * Supports both array-based capabilities and property-based features
   */
  const CAPABILITY_MAPPING = {
    vision: (model) =>
      model.capabilities?.includes("image") ||
      model.capabilities?.includes("vision") ||
      model.supportsImages === true,
    streaming: (model) =>
      model.supportsStreaming !== false && model.disabled !== true,
    pdf: (model) =>
      model.capabilities?.includes("pdf") || model.supportsPDF === true,
    function_calling: (model) =>
      model.capabilities?.includes("tool_calling") ||
      model.capabilities?.includes("function_calling") ||
      model.supportsFunctions === true ||
      model.supportsTools === true,
    json_mode: (model) =>
      model.capabilities?.includes("json_mode") ||
      model.supportsJsonMode === true,
    long_context: (model) => (model.maxContext || 0) > 100000,
    text: (model) =>
      model.capabilities?.includes("text") || model.disabled !== true,
    code: (model) => model.capabilities?.includes("code"),
    reasoning: (model) =>
      model.capabilities?.includes("reasoning") ||
      model.capabilities?.includes("extended_thinking"),
    multilingual: (model) => model.capabilities?.includes("multilingual"),
  };

  /**
   * Stage 2 Task 2.3 — Provider-level capability alias table.
   *
   * Translates tool-facing capability names (e.g. 'vision', 'function_calling')
   * to the provider contract's strict field names ('images', 'toolCalls' —
   * see providers/_interface.js ProviderCapabilities typedef). Only used for
   * provider-level (A7 layer 1) gating. Model-level (layer 2) lookup uses
   * the existing CAPABILITY_MAPPING above, which already handles these
   * spellings against model.capabilities arrays.
   *
   * Unknown capability names fall through to a raw provider.capabilities[name]
   * check (see _providerHasCapabilities). Grow this table when new aliases
   * are encountered.
   *
   * Provisional location: may move to providers/_interface.js if we adopt a
   * canonical capability vocabulary at Stage 4/5. Until then, lives here so
   * 2.3 doesn't touch the provider contract.
   */
  const PROVIDER_CAPABILITY_ALIASES = {
    // Vision / image inputs
    vision: "images",
    image: "images",
    images: "images",
    // Tool / function calling
    tool_calling: "toolCalls",
    function_calling: "toolCalls",
    toolCalls: "toolCalls",
    // Reasoning / extended thinking
    extended_thinking: "reasoning",
    reasoning: "reasoning",
    // Direct pass-through (canonical names)
    streaming: "streaming",
    pdf: "pdf",
  };

  /**
   * Stage 2 Task 2.3 — Provider human-readable labels.
   *
   * Provisional. May move to a Provider.label contract field at Stage 4 when
   * 'anthropic-foundry' needs distinguishing from 'azure-openai' in UI labels.
   * Override per-instance via EmbedModelSelector.setProviderLabel(id, label).
   */
  const PROVIDER_LABELS = {
    "openrouter": "OpenRouter",
    "azure-openai": "Microsoft Foundry",
    "azure-inference": "Foundry (Inference)",   // Stage 5 placeholder
    "anthropic-foundry": "Claude via Foundry",  // Stage 4 placeholder
  };

  /**
   * Cost tier thresholds (per 1M tokens, combined input/output average)
   */
  const COST_TIERS = {
    LOW_MAX: 1.0, // < $1 per 1M tokens
    MEDIUM_MAX: 10.0, // $1-10 per 1M tokens
    // > $10 = high
  };

  // ============================================================================
  // MODEL SELECTOR CLASS
  // ============================================================================

  /**
   * EmbedModelSelector - Capability-based model selection
   */
  class EmbedModelSelector {
    constructor() {
      this._config = { ...DEFAULT_CONFIG };
      this._lastSelection = null;
      logInfo("EmbedModelSelector initialised");
      // Stage 2 Task 2.3 — per-instance label override map. Populated via
      // setProviderLabel(id, label); read via _getProviderLabel(id).
      this._providerLabelOverrides = {};
    }

    // ==========================================================================
    // CONFIGURATION
    // ==========================================================================

    /**
     * Configure the model selector
     * @param {Object} options - Configuration options
     * @returns {EmbedModelSelector} This instance for chaining
     */
    configure(options = {}) {
      if (options.preferredModels !== undefined) {
        this._config.preferredModels = Array.isArray(options.preferredModels)
          ? [...options.preferredModels]
          : [];
      }

      if (options.requiredCapabilities !== undefined) {
        this._config.requiredCapabilities = Array.isArray(
          options.requiredCapabilities
        )
          ? [...options.requiredCapabilities]
          : [];
      }

      if (options.preferredCapabilities !== undefined) {
        this._config.preferredCapabilities = Array.isArray(
          options.preferredCapabilities
        )
          ? [...options.preferredCapabilities]
          : [];
      }

      if (options.fallbackModel !== undefined) {
        this._config.fallbackModel = options.fallbackModel;
      }

      if (options.costPreference !== undefined) {
        if (["cheapest", "balanced", "best"].includes(options.costPreference)) {
          this._config.costPreference = options.costPreference;
        } else {
          logWarn(
            `Invalid costPreference '${options.costPreference}', using 'balanced'`
          );
          this._config.costPreference = "balanced";
        }
      }

      if (options.excludeModels !== undefined) {
        this._config.excludeModels = Array.isArray(options.excludeModels)
          ? [...options.excludeModels]
          : [];
      }

      if (options.visionRequired !== undefined) {
        this._config.visionRequired = options.visionRequired;
      }

      if (options.streamingRequired !== undefined) {
        this._config.streamingRequired = options.streamingRequired;
      }

      logDebug("Configuration updated:", this._config);
      return this;
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
      return { ...this._config };
    }

    /**
     * Reset to default configuration
     * @returns {EmbedModelSelector} This instance for chaining
     */
    reset() {
      this._config = { ...DEFAULT_CONFIG };
      this._lastSelection = null;
      logInfo("Configuration reset to defaults");
      return this;
    }

    /**
     * Stage 2 Task 2.3 — Override the human-readable label for a provider.
     *
     * Provisional API; may be superseded by a Provider.label contract field
     * at Stage 4. Pass null or undefined as the label to reset to the
     * built-in default from PROVIDER_LABELS.
     *
     * @param {string} providerId
     * @param {string|null} label - New label, or null to reset
     * @returns {EmbedModelSelector} For chaining
     *
     * @example
     * window.EmbedModelSelector.setProviderLabel('azure-openai', 'My Foundry');
     * window.EmbedModelSelector.setProviderLabel('azure-openai', null);  // reset
     */
    setProviderLabel(providerId, label) {
      if (typeof providerId !== "string" || !providerId.trim()) {
        logWarn("setProviderLabel: providerId must be a non-empty string");
        return this;
      }
      const id = providerId.trim();
      if (label === null || label === undefined) {
        delete this._providerLabelOverrides[id];
        logDebug(`Provider label override removed: '${id}'`);
      } else if (typeof label === "string" && label.trim()) {
        this._providerLabelOverrides[id] = label.trim();
        logDebug(
          `Provider label override set: '${id}' → '${label.trim()}'`
        );
      } else {
        logWarn(
          `setProviderLabel: label must be a non-empty string or null (provider: '${id}')`
        );
      }
      return this;
    }

    // ==========================================================================
    // MODEL REGISTRY ACCESS
    // ==========================================================================

    /**
     * Get the model registry (if available)
     * @returns {Object|null} Model registry or null
     */
    _getRegistry() {
      return window.modelRegistry || null;
    }

    /**
     * Get all available models from registry
     * @returns {Array} Array of model objects with id property
     */
    _getAllModels() {
      const registry = this._getRegistry();

      if (!registry) {
        logDebug("Model registry not available, using fallback");
        return [];
      }

      try {
        // Try getAllModels method
        if (typeof registry.getAllModels === "function") {
          const models = registry.getAllModels();
          return models.filter((m) => !m.disabled);
        }

        // Alternative: iterate categories
        if (typeof registry.getAllCategories === "function") {
          const categories = registry.getAllCategories();
          const models = [];
          categories.forEach((cat) => {
            if (typeof registry.getModelsByCategory === "function") {
              const categoryModels = registry.getModelsByCategory(cat.id);
              models.push(...categoryModels.filter((m) => !m.disabled));
            }
          });
          return models;
        }

        logWarn("Could not retrieve models from registry");
        return [];
      } catch (error) {
        logError("Error accessing model registry:", error);
        return [];
      }
    }

    /**
     * Get a specific model by ID
     * @param {string} modelId - Model ID
     * @returns {Object|null} Model object or null
     */
    _getModel(modelId) {
      const registry = this._getRegistry();

      if (!registry) {
        return null;
      }

      try {
        if (typeof registry.getModel === "function") {
          return registry.getModel(modelId);
        }
        return null;
      } catch (error) {
        logError(`Error getting model ${modelId}:`, error);
        return null;
      }
    }

    // ==========================================================================
    // PROVIDER-AWARE HELPERS (Stage 2 Task 2.3)
    // ==========================================================================

    /**
     * Get the human-readable label for a provider. Override takes precedence;
     * falls back to PROVIDER_LABELS; last-resort fallback humanises the id.
     * @private
     */
    _getProviderLabel(providerId) {
      if (
        this._providerLabelOverrides &&
        this._providerLabelOverrides[providerId]
      ) {
        return this._providerLabelOverrides[providerId];
      }
      if (PROVIDER_LABELS[providerId]) {
        return PROVIDER_LABELS[providerId];
      }
      // Last-resort: humanise the id ('foo-bar' → 'Foo Bar')
      return providerId
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
    }

    /**
     * Check whether a provider's capability flags satisfy a list of requested
     * tool-facing capability names. Translates names via PROVIDER_CAPABILITY_ALIASES.
     * Unknown names fall through to a raw provider.capabilities[name] check.
     * @private
     */
    _providerHasCapabilities(provider, capabilities) {
      if (!Array.isArray(capabilities) || capabilities.length === 0) {
        return true;
      }
      const caps = (provider && provider.capabilities) || {};
      return capabilities.every((toolCap) => {
        const lowered =
          typeof toolCap === "string" ? toolCap.toLowerCase() : "";
        const translated =
          PROVIDER_CAPABILITY_ALIASES[lowered] || lowered;
        return caps[translated] === true;
      });
    }

    /**
     * Resolve a model to its library routing provider via EmbedProviderLookup.
     * Returns null if lookup is unavailable or the model lacks a valid id.
     * Note: uses model.id prefix, NOT model.provider (which is upstream vendor).
     * @private
     */
    _resolveProviderForModel(model) {
      if (!model || typeof model.id !== "string") return null;
      const lookup = window.EmbedProviderLookup;
      if (!lookup || typeof lookup.resolve !== "function") return null;
      return lookup.resolve(model.id);
    }

    /**
     * Determine if a provider is "available" on a given embed instance.
     *
     * Order matters: the bad-embed check runs FIRST, before the openrouter
     * special-case. A malformed embed (missing the isProviderConfigured method)
     * cannot tell us anything about availability, so we return false for all
     * providers — including openrouter. For a properly-constructed embed,
     * openrouter is always available (its API key lives in localStorage and
     * isn't gated by the providerConfig mechanism — embed.isProviderConfigured
     * always returns false for it). Other providers are available when
     * configureProvider() has been called for them.
     * @private
     */
    _isProviderAvailable(embed, providerId) {
      if (!embed || typeof embed.isProviderConfigured !== "function") {
        return false;
      }
      if (providerId === "openrouter") return true;
      return embed.isProviderConfigured(providerId);
    }

    // ==========================================================================
    // CAPABILITY DETECTION
    // ==========================================================================

    /**
     * Check if a model has specific capabilities
     * @param {string} modelId - Model ID to check
     * @param {string[]} capabilities - Required capabilities
     * @returns {boolean} True if model has all capabilities
     */
    hasCapabilities(modelId, capabilities) {
      if (!Array.isArray(capabilities) || capabilities.length === 0) {
        return true;
      }

      const model = this._getModel(modelId);
      if (!model) {
        logDebug(`Model ${modelId} not found in registry`);
        return false;
      }

      return capabilities.every((cap) => {
        const checker = CAPABILITY_MAPPING[cap.toLowerCase()];
        if (checker) {
          return checker(model);
        }
        // Unknown capability - check if in capabilities array
        return model.capabilities?.includes(cap.toLowerCase()) || false;
      });
    }

    /**
     * Check if a model object has specific capabilities
     * @param {Object} model - Model object
     * @param {string[]} capabilities - Required capabilities
     * @returns {boolean} True if model has all capabilities
     */
    _modelHasCapabilities(model, capabilities) {
      if (!Array.isArray(capabilities) || capabilities.length === 0) {
        return true;
      }

      return capabilities.every((cap) => {
        const checker = CAPABILITY_MAPPING[cap.toLowerCase()];
        if (checker) {
          return checker(model);
        }
        return model.capabilities?.includes(cap.toLowerCase()) || false;
      });
    }

    /**
     * Get all models with specific capabilities
     * @param {string[]} capabilities - Required capabilities
     * @returns {string[]} Array of model IDs
     */
    getModelsWithCapabilities(capabilities) {
      const allModels = this._getAllModels();

      if (!Array.isArray(capabilities) || capabilities.length === 0) {
        return allModels.map((m) => m.id);
      }

      return allModels
        .filter((model) => this._modelHasCapabilities(model, capabilities))
        .map((m) => m.id);
    }

    // ==========================================================================
    // PROVIDER-AWARE QUERY API (Stage 2 Task 2.3)
    // ==========================================================================
    // Two-step selection support for consumer UIs:
    //   Step 1: getEligibleProviders({capabilities, embed}) returns which
    //           providers can serve the tool's needs (A7 layer 1 gate).
    //   Step 2: getEligibleModels({providerId, capabilities, embed}) returns
    //           models from the chosen provider that pass the model-level
    //           capability gate (A7 layer 2).
    //
    // Existing methods (selectModel, hasCapabilities, getModelsWithCapabilities)
    // remain provider-agnostic and unchanged for backwards compatibility.

    /**
     * Return providers whose capabilities meet the requested set, optionally
     * gated by which providers are configured on a specific embed instance.
     *
     * Implements A7 layer 1: provider-level capability gating. Provider labels
     * come from the internal PROVIDER_LABELS table, overrideable via
     * setProviderLabel().
     *
     * @param {Object} [opts]
     * @param {string[]} [opts.capabilities=[]] Tool-facing capability names
     *                                          (e.g. ['vision', 'streaming']).
     *                                          Translated via PROVIDER_CAPABILITY_ALIASES.
     * @param {Object} [opts.embed] OpenRouterEmbed instance. If supplied, each
     *                              result has its `configured` field populated
     *                              and configured providers sort first.
     * @returns {Array<{id, label, configured, capabilities}>}
     *
     * Edge cases:
     *   - EmbedProviderRegistry not loaded → returns []
     *   - capabilities array empty → returns all registered providers
     *   - embed not supplied → configured field is null on every result
     *   - embed supplied but malformed (no isProviderConfigured method) →
     *     configured field is false on every result (we cannot verify)
     *   - Capability not in alias table → checks raw against provider.capabilities
     *
     * @example
     * // All vision-capable providers, with configured-ness for this embed
     * window.EmbedModelSelector.getEligibleProviders({
     *   capabilities: ['vision'],
     *   embed: myEmbed
     * });
     */
    getEligibleProviders({ capabilities = [], embed } = {}) {
      const registry = window.EmbedProviderRegistry;
      if (!registry || typeof registry.list !== "function") {
        logDebug("EmbedProviderRegistry unavailable, returning []");
        return [];
      }

      const ids = registry.list();
      // Truthy embed → produce a boolean `configured` value (via _isProviderAvailable,
      // which itself returns false if the embed is malformed). No embed → null.
      const hasEmbed = !!embed;

      const results = [];
      for (const id of ids) {
        const provider = registry.get(id);
        if (!provider) continue;

        if (!this._providerHasCapabilities(provider, capabilities)) continue;

        results.push({
          id,
          label: this._getProviderLabel(id),
          configured: hasEmbed
            ? this._isProviderAvailable(embed, id)
            : null,
          capabilities: { ...(provider.capabilities || {}) },
        });
      }

      // Sort: configured first (when embed supplied), then alphabetically by label
      if (hasEmbed) {
        results.sort((a, b) => {
          if (a.configured !== b.configured) {
            return a.configured ? -1 : 1;
          }
          return a.label.localeCompare(b.label);
        });
      } else {
        results.sort((a, b) => a.label.localeCompare(b.label));
      }

      logDebug(
        `getEligibleProviders: ${results.length} of ${ids.length} eligible`,
        { capabilities, hasEmbed }
      );
      return results;
    }

    /**
     * Return models registered to the given provider that meet the requested
     * capabilities. Excludes disabled models. Returns full model objects from
     * the registry with providerId injected.
     *
     * Implements A7 layer 2: model-level capability gating. Uses the existing
     * CAPABILITY_MAPPING via _modelHasCapabilities (which already handles
     * 'vision', 'function_calling', etc. against model.capabilities arrays).
     *
     * @param {Object} opts
     * @param {string} opts.providerId Library provider id ('openrouter' / 'azure-openai')
     * @param {string[]} [opts.capabilities=[]] Tool-facing capability names
     * @param {Object} [opts.embed] OpenRouterEmbed instance. If supplied and
     *                              the provider isn't available on this embed,
     *                              returns [] (except openrouter, which is
     *                              always available).
     * @returns {Array<Object>} Full model objects with providerId injected
     *
     * Edge cases:
     *   - window.modelRegistry not loaded → returns []
     *   - providerId missing/blank → returns []
     *   - No models match the provider → returns []
     *   - Model has disabled:true → excluded
     *   - capabilities array empty → returns all enabled models for that provider
     *
     * @example
     * window.EmbedModelSelector.getEligibleModels({
     *   providerId: 'azure-openai',
     *   capabilities: ['vision']
     * });
     */
    getEligibleModels({ providerId, capabilities = [], embed } = {}) {
      if (typeof providerId !== "string" || !providerId.trim()) {
        logWarn("getEligibleModels: providerId is required");
        return [];
      }
      const id = providerId.trim();

      // Gate by configured-ness if embed supplied
      if (embed && typeof embed.isProviderConfigured === "function") {
        if (!this._isProviderAvailable(embed, id)) {
          logDebug(
            `getEligibleModels: provider '${id}' not available on embed, returning []`
          );
          return [];
        }
      }

      const registry = window.modelRegistry;
      if (!registry || typeof registry.getAllModels !== "function") {
        logDebug("window.modelRegistry unavailable, returning []");
        return [];
      }

      const allModels = registry.getAllModels();

      const results = [];
      for (const model of allModels) {
        if (!model || model.disabled === true) continue;

        // Provider gate: does this model's id-prefix resolve to the target provider?
        const modelProvider = this._resolveProviderForModel(model);
        if (!modelProvider || modelProvider.id !== id) continue;

        // Model-level capability gate (reuses existing CAPABILITY_MAPPING)
        if (!this._modelHasCapabilities(model, capabilities)) continue;

        // Inject providerId into the returned model object (shallow copy to
        // avoid mutating the registry's stored object)
        results.push({ ...model, providerId: id });
      }

      logDebug(
        `getEligibleModels: ${results.length} models for provider '${id}'`,
        { capabilities, totalScanned: allModels.length }
      );
      return results;
    }

    // ==========================================================================
    // COST TIER CLASSIFICATION
    // ==========================================================================

    /**
     * Calculate average cost for a model
     * @param {Object} model - Model object
     * @returns {number} Average cost per 1M tokens
     */
    _calculateAverageCost(model) {
      if (!model.costs) {
        return 0;
      }

      const inputCost = model.costs.input || 0;
      const outputCost = model.costs.output || 0;

      // Assume 1:2 input:output ratio for "average" cost
      return (inputCost + outputCost * 2) / 3;
    }

    /**
     * Get cost tier for a model
     * @param {string} modelId - Model ID to check
     * @returns {'low'|'medium'|'high'} Cost tier
     */
    getCostTier(modelId) {
      const model = this._getModel(modelId);

      if (!model) {
        logDebug(`Model ${modelId} not found, defaulting to 'medium' tier`);
        return "medium";
      }

      // Check if model is free
      if (model.isFree === true) {
        return "low";
      }

      const avgCost = this._calculateAverageCost(model);

      if (avgCost < COST_TIERS.LOW_MAX) {
        return "low";
      } else if (avgCost < COST_TIERS.MEDIUM_MAX) {
        return "medium";
      } else {
        return "high";
      }
    }

    /**
     * Get cost tier for a model object
     * @param {Object} model - Model object
     * @returns {'low'|'medium'|'high'} Cost tier
     */
    _getModelCostTier(model) {
      if (model.isFree === true) {
        return "low";
      }

      const avgCost = this._calculateAverageCost(model);

      if (avgCost < COST_TIERS.LOW_MAX) {
        return "low";
      } else if (avgCost < COST_TIERS.MEDIUM_MAX) {
        return "medium";
      } else {
        return "high";
      }
    }

    // ==========================================================================
    // MODEL SELECTION
    // ==========================================================================

    /**
     * Select the best model for given requirements
     * @param {Object} options - Selection options
     * @param {string[]} [options.capabilities] - Required capabilities
     * @param {string} [options.costPreference] - Cost preference override
     * @param {boolean} [options.includeMetadata] - Include selection metadata
     * @returns {string|Object} Model ID or selection result with metadata
     */
    selectModel(options = {}) {
      const capabilities = options.capabilities || [];
      const costPreference =
        options.costPreference || this._config.costPreference;
      const includeMetadata = options.includeMetadata || false;

      logDebug("Selecting model with options:", {
        capabilities,
        costPreference,
      });

      // Get all models
      let candidates = this._getAllModels();
      const totalCandidates = candidates.length;

      // Handle case when no models available
      if (candidates.length === 0) {
        logWarn("No models available, using fallback model");
        const result = this._createSelectionResult(
          this._config.fallbackModel,
          "fallback",
          capabilities,
          false,
          0
        );
        return includeMetadata ? result : result.model;
      }

      // Filter by exclusions
      candidates = candidates.filter(
        (m) => !this._config.excludeModels.includes(m.id)
      );

      // Filter by required capabilities
      if (capabilities.length > 0) {
        candidates = candidates.filter((m) =>
          this._modelHasCapabilities(m, capabilities)
        );
      }

      // If no candidates match, use fallback
      if (candidates.length === 0) {
        logWarn(
          `No models match requirements [${capabilities.join(
            ", "
          )}], using fallback`
        );
        const result = this._createSelectionResult(
          this._config.fallbackModel,
          "fallback",
          capabilities,
          false,
          totalCandidates
        );
        return includeMetadata ? result : result.model;
      }

      // Check preferred models first
      for (const preferredId of this._config.preferredModels) {
        const preferred = candidates.find((m) => m.id === preferredId);
        if (preferred) {
          logDebug(`Selected preferred model: ${preferredId}`);
          const result = this._createSelectionResult(
            preferredId,
            "preferred",
            capabilities,
            true,
            totalCandidates
          );
          return includeMetadata ? result : result.model;
        }
      }

      // Sort by cost preference
      candidates = this._sortByCostPreference(candidates, costPreference);

      // Select best match
      const selected = candidates[0];
      logDebug(`Selected model by cost preference: ${selected.id}`);

      const result = this._createSelectionResult(
        selected.id,
        "cost_match",
        capabilities,
        true,
        totalCandidates
      );

      this._lastSelection = result;

      return includeMetadata ? result : result.model;
    }

    /**
     * Sort candidates by cost preference
     * @param {Array} candidates - Candidate models
     * @param {string} preference - Cost preference
     * @returns {Array} Sorted candidates
     */
    _sortByCostPreference(candidates, preference) {
      const tierOrder = {
        cheapest: { low: 0, medium: 1, high: 2 },
        balanced: { medium: 0, low: 1, high: 2 },
        best: { high: 0, medium: 1, low: 2 },
      };

      const order = tierOrder[preference] || tierOrder.balanced;

      return [...candidates].sort((a, b) => {
        const tierA = this._getModelCostTier(a);
        const tierB = this._getModelCostTier(b);
        const orderDiff = order[tierA] - order[tierB];

        if (orderDiff !== 0) {
          return orderDiff;
        }

        // Same tier - sort by actual cost
        const costA = this._calculateAverageCost(a);
        const costB = this._calculateAverageCost(b);

        if (preference === "cheapest") {
          return costA - costB;
        } else if (preference === "best") {
          return costB - costA;
        }

        // Balanced - prefer middle ground
        return costA - costB;
      });
    }

    /**
     * Create selection result object
     * @param {string} modelId - Selected model ID
     * @param {string} reason - Selection reason
     * @param {string[]} requiredCapabilities - Required capabilities
     * @param {boolean} matchedRequirements - Whether requirements were matched
     * @param {number} candidatesConsidered - Number of candidates
     * @returns {Object} Selection result
     */
    _createSelectionResult(
      modelId,
      reason,
      requiredCapabilities,
      matchedRequirements,
      candidatesConsidered
    ) {
      const model = this._getModel(modelId);
      const capabilities = model?.capabilities || [];

      return {
        model: modelId,
        reason: reason,
        capabilities: capabilities,
        costTier: this.getCostTier(modelId),
        matchedRequirements: matchedRequirements,
        requiredCapabilities: requiredCapabilities,
        candidatesConsidered: candidatesConsidered,
        timestamp: Date.now(),
      };
    }

    /**
     * Get the last selection result
     * @returns {Object|null} Last selection result or null
     */
    getLastSelection() {
      return this._lastSelection ? { ...this._lastSelection } : null;
    }
  }

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const embedModelSelector = new EmbedModelSelector();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.EmbedModelSelector = embedModelSelector;

  // Also expose the class for testing
  window.EmbedModelSelectorClass = EmbedModelSelector;

  logInfo("EmbedModelSelector loaded and ready");
})();
