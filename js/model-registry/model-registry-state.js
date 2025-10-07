/**
 * @fileoverview State management for the model registry system.
 * Manages the internal state of models, categories, and parameter defaults.
 */

import { logger } from "./model-registry-logger.js";
import { utils } from "./model-registry-utils.js";
import { DEFAULT_CONFIG, EVENT_TYPES } from "./model-registry-config.js";
import { ModelNotFoundError } from "./model-registry-errors.js";

/**
 * ModelRegistryState class for managing the internal state of the model registry
 */
export class ModelRegistryState {
  /**
   * @param {Object} options - State configuration options
   */
  constructor(options = {}) {
    // Initialize state containers
    this.models = new Map();
    this.categories = new Map();
    this.parameterDefaults = new Map();
    this.modelCapabilities = new Map();

    // Event listeners
    this.eventListeners = new Map();
    for (const eventType of Object.values(EVENT_TYPES)) {
      this.eventListeners.set(eventType, []);
    }

    // Initialization flag
    this.initialized = false;

    logger.debug("ModelRegistryState initialized");
  }

  /**
   * Add an event listener
   * @param {string} eventType - Event type
   * @param {Function} listener - Event listener function
   * @returns {Function} Function to remove the listener
   */
  addEventListener(eventType, listener) {
    if (!Object.values(EVENT_TYPES).includes(eventType)) {
      logger.warn(`Unknown event type: ${eventType}`);
      return () => {};
    }

    const listeners = this.eventListeners.get(eventType);
    listeners.push(listener);
    this.eventListeners.set(eventType, listeners);

    // Return function to remove the listener
    return () => {
      const updatedListeners = this.eventListeners
        .get(eventType)
        .filter((l) => l !== listener);
      this.eventListeners.set(eventType, updatedListeners);
    };
  }

  /**
   * Dispatch an event
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @private
   */
  _dispatchEvent(eventType, data) {
    if (!Object.values(EVENT_TYPES).includes(eventType)) {
      logger.warn(`Cannot dispatch unknown event type: ${eventType}`);
      return;
    }

    const listeners = this.eventListeners.get(eventType);
    listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        logger.error(`Error in event listener for ${eventType}`, { error });
      }
    });
  }

  /**
   * Set a model in the registry
   * @param {string} id - Model identifier
   * @param {Object} model - Model configuration
   */
  setModel(id, model) {
    this.models.set(id, model);
    this._dispatchEvent(
      model.isNew ? EVENT_TYPES.MODEL_REGISTERED : EVENT_TYPES.MODEL_UPDATED,
      { id, model }
    );

    // Remove isNew flag if it exists
    if (model.isNew) {
      const updatedModel = { ...model };
      delete updatedModel.isNew;
      this.models.set(id, updatedModel);
    }
  }

  /**
   * Get a model from the registry
   * @param {string} id - Model identifier
   * @param {boolean} silent - Whether to return null instead of throwing an error
   * @returns {Object|null} Model configuration or null if not found and silent is true
   * @throws {ModelNotFoundError} If the model is not found and silent is false
   */
  getModel(id, silent = false) {
    return utils.getModelSafely(this.models, id, silent);
  }

  /**
   * Remove a model from the registry
   * @param {string} id - Model identifier
   * @returns {boolean} Whether the model was removed
   */
  removeModel(id) {
    const model = this.getModel(id, true);
    if (!model) return false;

    const result = this.models.delete(id);
    if (result) {
      this._dispatchEvent(EVENT_TYPES.MODEL_REMOVED, { id, model });
    }

    return result;
  }

  /**
   * Set a category in the registry
   * @param {string} id - Category identifier
   * @param {Object} category - Category configuration
   */
  setCategory(id, category) {
    const existing = this.categories.has(id);
    this.categories.set(id, category);

    this._dispatchEvent(
      existing ? EVENT_TYPES.CATEGORY_UPDATED : EVENT_TYPES.CATEGORY_REGISTERED,
      { id, category }
    );
  }

  /**
   * Get a category from the registry
   * @param {string} id - Category identifier
   * @returns {Object|null} Category configuration or null if not found
   */
  getCategory(id) {
    return this.categories.get(id) || null;
  }

  /**
   * Remove a category from the registry
   * @param {string} id - Category identifier
   * @returns {boolean} Whether the category was removed
   */
  removeCategory(id) {
    const category = this.getCategory(id);
    if (!category) return false;

    const result = this.categories.delete(id);
    if (result) {
      this._dispatchEvent(EVENT_TYPES.CATEGORY_REMOVED, { id, category });
    }

    return result;
  }

  /**
   * Set parameter defaults for a model
   * @param {string} modelId - Model identifier
   * @param {Object} defaults - Default parameter values
   */
  setParameterDefaults(modelId, defaults) {
    this.parameterDefaults.set(modelId, {
      ...defaults,
      lastUpdated: new Date().toISOString(),
    });

    this._dispatchEvent(EVENT_TYPES.PARAMETER_DEFAULTS_UPDATED, {
      modelId,
      defaults,
    });
  }

  /**
   * Get parameter defaults for a model
   * @param {string} modelId - Model identifier
   * @returns {Object|null} Default parameter values or null if not found
   */
  getParameterDefaults(modelId) {
    return this.parameterDefaults.get(modelId) || null;
  }

  /**
   * Set model capabilities
   * @param {string} modelId - Model identifier
   * @param {Object} capabilities - Model capabilities
   */
  setModelCapabilities(modelId, capabilities) {
    this.modelCapabilities.set(modelId, {
      ...capabilities,
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Get model capabilities
   * @param {string} modelId - Model identifier
   * @returns {Object|null} Model capabilities or null if not found
   */
  getModelCapabilities(modelId) {
    return this.modelCapabilities.get(modelId) || null;
  }

  /**
   * Update model status
   * @param {string} modelId - Model identifier
   * @param {Object} status - New status information
   * @returns {boolean} Whether the status was updated
   */
  updateModelStatus(modelId, status) {
    const model = this.getModel(modelId, true);
    if (!model) return false;

    const updatedModel = {
      ...model,
      status: {
        ...model.status,
        ...status,
        lastCheck: new Date().toISOString(),
      },
    };

    this.setModel(modelId, updatedModel);

    this._dispatchEvent(EVENT_TYPES.STATUS_CHANGED, {
      modelId,
      status: updatedModel.status,
      previousStatus: model.status,
    });

    return true;
  }

  /**
   * Update model fallback
   * @param {string} modelId - Model identifier
   * @param {string|null} fallbackId - Fallback model identifier
   * @returns {boolean} Whether the fallback was updated
   */
  updateModelFallback(modelId, fallbackId) {
    const model = this.getModel(modelId, true);
    if (!model) return false;

    const previousFallback = model.fallbackTo;

    const updatedModel = {
      ...model,
      fallbackTo: fallbackId,
    };

    this.setModel(modelId, updatedModel);

    this._dispatchEvent(EVENT_TYPES.FALLBACK_UPDATED, {
      modelId,
      fallbackId,
      previousFallback,
    });

    return true;
  }

  /**
   * Get all models
   * @returns {Array} Array of all models
   */
  getAllModels() {
    return Array.from(this.models.values());
  }

  /**
   * Get all categories
   * @returns {Array} Array of all categories
   */
  getAllCategories() {
    return Array.from(this.categories.values());
  }

  /**
   * Get all models in a category
   * @param {string} categoryId - Category identifier
   * @param {boolean} includeDisabled - Whether to include disabled models
   * @returns {Array} Array of models in the category
   */
  getModelsByCategory(categoryId, includeDisabled = false) {
    return this.getAllModels().filter((model) => {
      return (
        model.category === categoryId && (includeDisabled || !model.disabled)
      );
    });
  }

  /**
   * Get all models with a specific capability
   * @param {string} capability - Capability to filter by
   * @param {boolean} includeDisabled - Whether to include disabled models
   * @returns {Array} Array of models with the capability
   */
  getModelsByCapability(capability, includeDisabled = false) {
    return this.getAllModels().filter((model) => {
      return (
        model.capabilities.includes(capability) &&
        (includeDisabled || !model.disabled)
      );
    });
  }

  /**
   * Get the default model for a category
   * @param {string} categoryId - Category identifier
   * @returns {Object|null} Default model for the category or null if none found
   */
  getDefaultModelForCategory(categoryId) {
    const models = this.getModelsByCategory(categoryId);

    // First try to find a model marked as default
    const defaultModel = models.find((model) => model.isDefault);
    if (defaultModel) return defaultModel;

    // Then try to find a free model
    const freeModel = models.find((model) => model.isFree);
    if (freeModel) return freeModel;

    // Otherwise return the first model
    return models.length > 0 ? models[0] : null;
  }

  /**
   * Clear all state
   */
  clear() {
    this.models.clear();
    this.categories.clear();
    this.parameterDefaults.clear();
    this.modelCapabilities.clear();

    logger.debug("ModelRegistryState cleared");
  }
}

// Create and export a singleton instance
export const state = new ModelRegistryState();
