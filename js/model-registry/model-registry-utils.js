/**
 * @fileoverview Utility functions for the model registry system.
 * Provides helper methods for common operations used across the model registry.
 */

import { ModelNotFoundError } from "./model-registry-errors.js";

/**
 * Utility functions for the model registry
 */
export const utils = {
  /**
   * Check if a value is defined and not null
   * @param {*} value - Value to check
   * @returns {boolean} Whether the value is defined and not null
   */
  isDefined(value) {
    return value !== undefined && value !== null;
  },

  /**
   * Check if an object has all required properties
   * @param {Object} obj - Object to check
   * @param {Array<string>} requiredProps - Array of required property names
   * @returns {Array<string>} Array of missing property names
   */
  getMissingProperties(obj, requiredProps) {
    if (!obj || typeof obj !== "object") {
      return requiredProps;
    }

    return requiredProps.filter((prop) => !this.isDefined(obj[prop]));
  },

  /**
   * Safely get a model from a Map, throwing an error if not found
   * @param {Map} modelsMap - Map of models
   * @param {string} modelId - ID of the model to get
   * @param {boolean} silent - Whether to return null instead of throwing an error
   * @returns {Object|null} The model or null if not found and silent is true
   * @throws {ModelNotFoundError} If the model is not found and silent is false
   */
  getModelSafely(modelsMap, modelId, silent = false) {
    const model = modelsMap.get(modelId);

    if (!model && !silent) {
      throw new ModelNotFoundError(modelId);
    }

    return model || null;
  },

  /**
   * Calculate overlap between two sets
   * @param {Set|Array} setA - First set
   * @param {Set|Array} setB - Second set
   * @returns {number} Overlap score (0-1)
   */
  calculateSetOverlap(setA, setB) {
    const a = setA instanceof Set ? setA : new Set(setA);
    const b = setB instanceof Set ? setB : new Set(setB);

    if (a.size === 0 || b.size === 0) return 0;

    const intersection = new Set([...a].filter((x) => b.has(x)));
    return intersection.size / Math.max(a.size, b.size);
  },

  /**
   * Create a deep copy of an object
   * @param {Object} obj - Object to copy
   * @returns {Object} Deep copy of the object
   */
  deepCopy(obj) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (obj instanceof Array) {
      return obj.map((item) => this.deepCopy(item));
    }

    if (obj instanceof Set) {
      return new Set([...obj].map((item) => this.deepCopy(item)));
    }

    if (obj instanceof Map) {
      return new Map(
        [...obj.entries()].map(([key, value]) => [key, this.deepCopy(value)])
      );
    }

    const copy = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = this.deepCopy(obj[key]);
      }
    }

    return copy;
  },

  /**
   * Merge objects deeply
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  },

  /**
   * Check if a value is an object
   * @param {*} item - Value to check
   * @returns {boolean} Whether the value is an object
   */
  isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
  },

  /**
   * Validate a URL
   * @param {string} url - URL to validate
   * @returns {boolean} Whether the URL is valid
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Format a date as ISO string or use a custom format
   * @param {Date|string} date - Date to format
   * @param {Function} formatter - Custom formatter function
   * @returns {string} Formatted date
   */
  formatDate(date, formatter = null) {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "Invalid Date";
    }

    if (typeof formatter === "function") {
      return formatter(dateObj);
    }

    return dateObj.toISOString();
  },

  /**
   * Generate ARIA labels for model information
   * @param {Object} model - Model configuration
   * @returns {Object} ARIA labels
   */
  generateAriaLabels(model) {
    if (!model) return {};

    return {
      modelName: `Model: ${model.name}`,
      provider: `Provider: ${model.provider}`,
      category: `Category: ${model.category}`,
      description: model.description,
      ...(model.isFree ? { pricing: "Free tier model" } : {}),
      ...(model.disabled ? { status: "This model is currently disabled" } : {}),
      ...(model.fallbackTo
        ? { fallback: `Falls back to ${model.fallbackTo} if unavailable` }
        : {}),
    };
  },
};
