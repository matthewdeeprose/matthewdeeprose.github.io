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
