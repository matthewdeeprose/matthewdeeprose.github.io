/**
 * @fileoverview Core functionality for the model registry system.
 * Implements the main model registry functionality using the other modules.
 */

import { logger } from "./model-registry-logger.js";
import { utils } from "./model-registry-utils.js";
import { state } from "./model-registry-state.js";
import { validator } from "./model-registry-validator.js";
import { accessibility } from "./model-registry-accessibility.js";
import { DEFAULT_CONFIG, EVENT_TYPES } from "./model-registry-config.js";
import {
  ModelValidationError,
  ModelNotFoundError,
  InvalidFallbackError,
} from "./model-registry-errors.js";

/**
 * ModelRegistryCore class implementing the main model registry functionality
 */
export class ModelRegistryCore {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      autoValidateFallbacks: options.autoValidateFallbacks !== false,
      autoCorrectFallbacks: options.autoCorrectFallbacks !== false,
      a11yHelper: options.a11yHelper || null,
    };

    // Initialize accessibility with the a11y helper if provided
    if (this.options.a11yHelper) {
      Object.assign(accessibility, { a11yHelper: this.options.a11yHelper });
    }

    // Initialization flag
    this.initialized = false;

    logger.debug("ModelRegistryCore initialized with options", this.options);
  }

  /**
   * Initialize the model registry
   * @param {Object} options - Initialization options
   */
  initialize(options = {}) {
    if (this.initialized) {
      logger.warn("ModelRegistry already initialized");
      return;
    }

    logger.info("Initializing ModelRegistry");

    // Add event listeners
    this._setupEventListeners();

    this.initialized = true;
    logger.info("ModelRegistry initialization complete");
  }

  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Listen for model status changes
    state.addEventListener(EVENT_TYPES.STATUS_CHANGED, (data) => {
      logger.debug("Model status changed", data);
      accessibility.announceStatusChange(data.modelId, data.status);
    });

    // Listen for model registrations
    state.addEventListener(EVENT_TYPES.MODEL_REGISTERED, (data) => {
      logger.debug("Model registered", data);
      accessibility.announceModelRegistration(data.id, data.model);
    });
  }

  /**
   * Validate model configuration
   * @param {Object} config - Model configuration to validate
   * @returns {boolean} Whether the configuration is valid
   * @private
   */
  _validateModelConfig(config) {
    const validation = validator.validateModelConfig(config);

    if (!validation.isValid) {
      logger.modelValidationError(
        config.name || "Unknown model",
        validation.issues
      );
      return false;
    }

    return true;
  }

  /**
   * Register a model with enhanced parameter support data and policy links
   * @param {string} id - Model identifier
   * @param {Object} config - Model configuration
   */
  registerModel(id, config) {
    // Validate required fields first
    if (!id || !config) {
      logger.error("Model registration failed: Missing ID or configuration");
      throw new ModelValidationError("Missing ID or configuration");
    }

    // Validate essential model properties
    if (!this._validateModelConfig(config)) {
      logger.error(
        `Model registration failed for ${id}: Invalid configuration`
      );
      throw new ModelValidationError(`Invalid configuration for model ${id}`);
    }

    // Maintain backward compatibility with existing model data
    const baseModel = {
      id,
      provider: config.provider,
      name: config.name,
      category: config.category,
      disabled: config.disabled || false,
      description: config.description,
      costs: config.costs,
      capabilities: config.capabilities || [],
      maxContext: config.maxContext,
      fallbackTo: config.fallbackTo,
      isFree: config.isFree || false,
      isDefault: config.isDefault || false,
      metadata: config.metadata || {},
    };

    // Safely handle policy links if they exist
    const policyLinks = {
      privacyPolicy: config.metadata?.policyLinks?.privacyPolicy || null,
      acceptableUse: config.metadata?.policyLinks?.acceptableUse || null,
      termsOfService: config.metadata?.policyLinks?.termsOfService || null,
      lastUpdated: config.metadata?.policyLinks?.lastUpdated || null,
    };

    // Only include policy links if at least one exists
    const hasPolicyLinks = Object.values(policyLinks).some(
      (link) => link !== null
    );

    // Add enhanced parameter support data
    const enhancedModel = {
      ...baseModel,
      parameterSupport: {
        supported: config.parameterSupport?.supported || [],
        statistics: config.parameterSupport?.statistics || {},
        features: config.parameterSupport?.features || [],
      },
      status: {
        isAvailable: config.status?.isAvailable ?? true,
        lastCheck: config.status?.lastCheck || new Date().toISOString(),
        errorCode: config.status?.errorCode || null,
        errorMessage: config.status?.errorMessage || null,
      },
      accessibility: {
        preferredFor: config.accessibility?.preferredFor || [],
        warnings: config.accessibility?.warnings || [],
        ariaLabels: {
          ...config.accessibility?.ariaLabels,
          ...(hasPolicyLinks && {
            policyLinks: `Policy documentation for ${config.name}`,
          }),
        },
      },
      metadata: {
        ...baseModel.metadata,
        ...(hasPolicyLinks && { policyLinks }),
      },
      isNew: true, // Flag to indicate this is a new model
    };

    // Store the model
    state.setModel(id, enhancedModel);

    // Auto-register category if new
    if (!state.getCategory(config.category)) {
      this.registerCategory(config.category, {
        name: config.category,
        description: config.metadata?.categoryDescription,
      });
    }

    // Store parameter capabilities
    if (config.parameterSupport?.statistics) {
      state.setModelCapabilities(id, {
        parameters: config.parameterSupport.statistics,
        lastUpdated: new Date().toISOString(),
      });
    }

    logger.info(`Model registered: ${id}`, {
      provider: config.provider,
      category: config.category,
    });

    return enhancedModel;
  }

  /**
   * Register parameter defaults for a specific model
   * @param {string} modelId - Model identifier
   * @param {Object} defaults - Default parameter values
   */
  registerParameterDefaults(modelId, defaults) {
    // Validate model exists
    if (!state.getModel(modelId, true)) {
      logger.warn(
        `Cannot register parameter defaults for unknown model: ${modelId}`
      );
      return;
    }

    state.setParameterDefaults(modelId, defaults);

    logger.debug(`Parameter defaults registered for ${modelId}`, {
      parameters: Object.keys(defaults),
    });
  }

  /**
   * Register a category with metadata
   * @param {string} id - Category identifier
   * @param {Object} config - Category configuration
   */
  registerCategory(id, config) {
    // Validate required fields
    if (!id || !config || !config.name) {
      logger.error(
        "Category registration failed: Missing ID, configuration, or name"
      );
      return;
    }

    const categoryConfig = {
      id,
      name: config.name,
      description: config.description,
      priority: config.priority || 0,
      metadata: {
        displayOrder: config.metadata?.displayOrder,
        groupingStrategy: config.metadata?.groupingStrategy,
        accessibilityNotes: config.metadata?.accessibilityNotes,
      },
    };

    state.setCategory(id, categoryConfig);

    logger.debug(`Category registered: ${id}`, {
      name: config.name,
    });

    return categoryConfig;
  }

  /**
   * Validate all model fallbacks
   * Should be called after all models are registered
   */
  validateAllFallbacks() {
    const models = state.getAllModels();
    const validation = validator.validateAllFallbacks(
      (id, silent) => state.getModel(id, silent),
      models
    );

    if (!validation.isValid) {
      logger.warn(
        "Invalid fallback configurations found:",
        Array.from(validation.invalidFallbacks.entries())
          .map(([id, info]) => `${id} → ${info.fallbackId} (${info.reason})`)
          .join("\n")
      );

      // Auto-fix invalid fallbacks if enabled
      if (this.options.autoCorrectFallbacks) {
        validation.invalidFallbacks.forEach((info, modelId) => {
          const model = state.getModel(modelId);
          if (model) {
            const automaticFallback = validator.findBestFallbackMatch(
              model,
              models
            );

            if (automaticFallback) {
              logger.info(`Fallback correction for ${modelId}:`, {
                original: model.fallbackTo,
                reason: info.reason,
                newFallback: automaticFallback,
              });

              state.updateModelFallback(modelId, automaticFallback);
            } else {
              logger.warn(`No suitable fallback found for ${modelId}:`, {
                original: model.fallbackTo,
                reason: info.reason,
              });

              state.updateModelFallback(modelId, null);
            }
          }
        });
      }
    }

    return validation;
  }

  /**
   * Get a model's configuration and capabilities
   * @param {string} id - Model identifier
   * @param {boolean} silent - Whether to return null instead of throwing an error
   * @returns {Object|null} Model configuration or null if not found and silent is true
   * @throws {ModelNotFoundError} If the model is not found and silent is false
   */
  getModel(id, silent = false) {
    return state.getModel(id, silent);
  }

  /**
   * Get policy links for a model
   * @param {string} modelId - Model identifier
   * @returns {Object|null} Policy links or null if not found
   */
  getPolicyLinks(modelId) {
    const model = this.getModel(modelId, true);
    return model?.metadata?.policyLinks || null;
  }

  /**
   * Check if a model has policy documentation
   * @param {string} modelId - Model identifier
   * @returns {boolean} True if model has any policy links
   */
  hasPolicyDocs(modelId) {
    const links = this.getPolicyLinks(modelId);
    return (
      links &&
      Object.values(links).some((link) => link && typeof link === "string")
    );
  }

  /**
   * Validate policy URLs for a model
   * @param {string} modelId - Model identifier
   * @returns {Object} Validation results
   */
  validatePolicyUrls(modelId) {
    const links = this.getPolicyLinks(modelId);
    return validator.validatePolicyUrls(links);
  }

  /**
   * Get accessibility labels for policy links
   * @param {string} modelId - Model identifier
   * @returns {Object} ARIA labels for policy links
   */
  getPolicyAriaLabels(modelId) {
    const model = this.getModel(modelId, true);
    if (!model) return {};

    return accessibility.generatePolicyAriaLabels(model);
  }

  /**
   * Get all models in a specific category
   * @param {string} category - Category identifier
   * @param {boolean} includeDisabled - Whether to include disabled models
   * @returns {Array} Array of models in the category
   */
  getModelsByCategory(category, includeDisabled = false) {
    return state.getModelsByCategory(category, includeDisabled);
  }

  /**
   * Get the fallback model for a given model
   * @param {string} modelId - Model identifier
   * @returns {Object|null} Fallback model or null if none available
   */
  getFallbackModel(modelId) {
    const model = this.getModel(modelId, true);
    return model?.fallbackTo ? this.getModel(model.fallbackTo, true) : null;
  }

  /**
   * Get all categories sorted by priority
   * @returns {Array} Sorted array of categories
   */
  getAllCategories() {
    return state.getAllCategories().sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get all models in the registry
   * @returns {Array} Array of all models
   */
  getAllModels() {
    return state.getAllModels();
  }

  /**
   * Get parameter capabilities for a model
   * @param {string} modelId - Model identifier
   * @returns {Object|null} Parameter capabilities or null if not found
   */
  getParameterCapabilities(modelId) {
    return state.getModelCapabilities(modelId);
  }

  /**
   * Get recommended parameter values for a model
   * @param {string} modelId - Model identifier
   * @param {string} parameterName - Parameter name
   * @returns {Object|null} Recommended values or null if not found
   */
  getParameterRecommendations(modelId, parameterName) {
    const capabilities = state.getModelCapabilities(modelId);
    if (!capabilities?.parameters?.[parameterName]) return null;

    const stats = capabilities.parameters[parameterName];
    return {
      default: stats.p50, // Use median as default
      min: stats.p10,
      max: stats.p90,
      recommended: stats.recommended || stats.p50,
      constraints: this.getParameterConstraints(parameterName),
    };
  }

  /**
   * Get parameter constraints
   * @param {string} parameterName - Parameter name
   * @returns {Object} Parameter constraints
   */
  getParameterConstraints(parameterName) {
    return DEFAULT_CONFIG.parameterConstraints[parameterName] || {};
  }

  /**
   * Check if a model supports a specific feature
   * @param {string} modelId - Model identifier
   * @param {string} feature - Feature name
   * @returns {boolean} True if feature is supported
   */
  supportsFeature(modelId, feature) {
    const model = this.getModel(modelId, true);
    return model?.parameterSupport?.features?.includes(feature) || false;
  }

  /**
   * Get supported parameters for a model
   * @param {string} modelId - Model identifier
   * @returns {Array} Array of supported parameters
   */
  getSupportedParameters(modelId) {
    const model = this.getModel(modelId, true);
    return model?.parameterSupport?.supported || [];
  }

  /**
   * Check model availability and status
   * @param {string} modelId - Model identifier
   * @returns {Object} Model status information
   */
  getModelStatus(modelId) {
    const model = this.getModel(modelId, true);
    if (!model) return { isAvailable: false, reason: "Model not found" };

    return {
      isAvailable: model.status.isAvailable,
      lastCheck: model.status.lastCheck,
      errorCode: model.status.errorCode,
      errorMessage: model.status.errorMessage,
      isDeprecated: model.metadata?.isDeprecated || false,
      maintenanceScheduled: model.metadata?.maintenanceScheduled || false,
    };
  }

  /**
   * Update model status
   * @param {string} modelId - Model identifier
   * @param {Object} status - New status information
   */
  updateModelStatus(modelId, status) {
    state.updateModelStatus(modelId, status);
  }

  /**
   * Get accessibility information for a model
   * @param {string} modelId - Model identifier
   * @returns {Object} Accessibility information
   */
  getAccessibilityInfo(modelId) {
    const model = this.getModel(modelId, true);
    if (!model) return null;

    return accessibility.getAccessibilityInfo(model);
  }

  /**
   * Get currently selected model
   * @returns {Object|null} Currently selected model or null if none selected
   */
  getSelectedModel() {
    const select = document.querySelector("#model-select");
    if (!select) return null;
    return this.getModel(select.value, true);
  }

  /**
   * Add keyboard navigation to model selector
   * @param {string} selectorId - ID of the select element
   * @param {Function} onModelChange - Callback for model change
   */
  addKeyboardNavigation(selectorId, onModelChange) {
    const selectElement = document.querySelector(selectorId);
    if (!selectElement) {
      logger.warn(
        `Cannot add keyboard navigation: Element not found: ${selectorId}`
      );
      return;
    }

    accessibility.addKeyboardNavigation(selectElement, onModelChange);
  }

  /**
   * Enhance model selector with accessibility attributes
   * @param {string} selectorId - ID of the select element
   */
  enhanceModelSelector(selectorId) {
    const selectElement = document.querySelector(selectorId);
    if (!selectElement) {
      logger.warn(
        `Cannot enhance model selector: Element not found: ${selectorId}`
      );
      return;
    }

    accessibility.enhanceModelSelector(selectElement, state.getAllModels());
  }
}
