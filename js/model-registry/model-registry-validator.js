/**
 * @fileoverview Validation utilities for the model registry system.
 * Provides validation for model configurations, fallbacks, and other aspects.
 */

import { logger } from "./model-registry-logger.js";
import { utils } from "./model-registry-utils.js";
import { DEFAULT_CONFIG } from "./model-registry-config.js";
import { ModelValidationError } from "./model-registry-errors.js";

/**
 * ModelRegistryValidator class for validating model registry data
 */
export class ModelRegistryValidator {
  /**
   * Validate model configuration
   * @param {Object} config - Model configuration to validate
   * @returns {Object} Validation result with isValid and issues properties
   */
  validateModelConfig(config) {
    const result = {
      isValid: true,
      issues: [],
    };

    // Check for required fields
    const missingFields = utils.getMissingProperties(
      config,
      DEFAULT_CONFIG.requiredModelFields
    );

    if (missingFields.length > 0) {
      result.isValid = false;
      result.issues.push({
        type: "missing_fields",
        message: `Missing required fields: ${missingFields.join(", ")}`,
        fields: missingFields,
      });
    }

    // Validate capabilities
    if (
      !Array.isArray(config.capabilities) ||
      config.capabilities.length === 0
    ) {
      result.isValid = false;
      result.issues.push({
        type: "invalid_capabilities",
        message: "Model must have at least one capability",
        field: "capabilities",
      });
    }

    // Validate costs for non-free models
    if (!config.isFree) {
      if (
        !config.costs ||
        typeof config.costs.input !== "number" ||
        typeof config.costs.output !== "number"
      ) {
        result.isValid = false;
        result.issues.push({
          type: "invalid_costs",
          message: "Non-free model must have valid cost configuration",
          field: "costs",
        });
      }
    }

    // Validate maxContext
    if (typeof config.maxContext !== "number" || config.maxContext <= 0) {
      result.isValid = false;
      result.issues.push({
        type: "invalid_max_context",
        message: "Model must have valid maxContext value",
        field: "maxContext",
      });
    }

    // Validate parameter support
    if (config.parameterSupport) {
      if (!Array.isArray(config.parameterSupport.supported)) {
        result.isValid = false;
        result.issues.push({
          type: "invalid_parameter_support",
          message: "Invalid parameter support configuration",
          field: "parameterSupport.supported",
        });
      }
    }

    // Validate fallback if specified
    if (config.fallbackTo && typeof config.fallbackTo !== "string") {
      result.isValid = false;
      result.issues.push({
        type: "invalid_fallback",
        message: "Fallback model must be specified as a string ID",
        field: "fallbackTo",
      });
    }

    return result;
  }

  /**
   * Validate category configuration
   * @param {Object} config - Category configuration to validate
   * @returns {Object} Validation result with isValid and issues properties
   */
  validateCategoryConfig(config) {
    const result = {
      isValid: true,
      issues: [],
    };

    // Check for required fields
    const missingFields = utils.getMissingProperties(
      config,
      DEFAULT_CONFIG.requiredCategoryFields
    );

    if (missingFields.length > 0) {
      result.isValid = false;
      result.issues.push({
        type: "missing_fields",
        message: `Missing required fields: ${missingFields.join(", ")}`,
        fields: missingFields,
      });
    }

    return result;
  }

  /**
   * Validate model fallbacks
   * @param {Function} getModel - Function to get a model by ID
   * @param {Array} models - Array of models to validate fallbacks for
   * @returns {Object} Validation result with invalidFallbacks map
   */
  validateAllFallbacks(getModel, models) {
    const invalidFallbacks = new Map();

    models.forEach((model) => {
      if (model.fallbackTo) {
        const fallbackModel = getModel(model.fallbackTo, true);
        if (!fallbackModel) {
          invalidFallbacks.set(model.id, {
            fallbackId: model.fallbackTo,
            reason: "not_found",
            message: `Fallback model not found: ${model.fallbackTo}`,
          });
        } else if (fallbackModel.disabled) {
          invalidFallbacks.set(model.id, {
            fallbackId: model.fallbackTo,
            reason: "disabled",
            message: `Fallback model is disabled: ${model.fallbackTo}`,
          });
        } else if (fallbackModel.id === model.id) {
          invalidFallbacks.set(model.id, {
            fallbackId: model.fallbackTo,
            reason: "self_reference",
            message: `Model cannot fallback to itself: ${model.id}`,
          });
        }
      }
    });

    return {
      isValid: invalidFallbacks.size === 0,
      invalidFallbacks,
    };
  }

  /**
   * Calculate capability overlap between two models
   * @param {Object} modelA - First model
   * @param {Object} modelB - Second model
   * @returns {number} Overlap score (0-1)
   */
  calculateCapabilityOverlap(modelA, modelB) {
    return utils.calculateSetOverlap(modelA.capabilities, modelB.capabilities);
  }

  /**
   * Find best fallback match for a model
   * @param {Object} model - Model configuration
   * @param {Array} candidates - Array of candidate models
   * @returns {string|null} Best matching model ID or null
   */
  findBestFallbackMatch(model, candidates) {
    // Skip if model is already free tier
    if (model.isFree) return null;

    const validCandidates = candidates.filter(
      (m) =>
        m.id !== model.id &&
        !m.disabled &&
        // Prioritize models in same category
        (m.category === model.category || m.isFree)
    );

    if (validCandidates.length === 0) return null;

    // Sort candidates by:
    // 1. Free tier preference
    // 2. Same category preference
    // 3. Capability overlap
    return (
      validCandidates
        .map((candidate) => ({
          id: candidate.id,
          score: this.calculateCapabilityOverlap(model, candidate),
          isFree: candidate.isFree,
          sameCategory: candidate.category === model.category,
        }))
        .sort((a, b) => {
          // Prioritize free models
          if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
          // Then same category
          if (a.sameCategory !== b.sameCategory) return a.sameCategory ? -1 : 1;
          // Then capability overlap
          return b.score - a.score;
        })[0]?.id || null
    );
  }

  /**
   * Validate policy URLs for a model
   * @param {Object} policyLinks - Policy links to validate
   * @returns {Object} Validation results
   */
  validatePolicyUrls(policyLinks) {
    if (!policyLinks) {
      return {
        valid: true,
        message: "No policy links to validate",
        issues: [],
        checkedUrls: [],
      };
    }

    const validation = {
      valid: true,
      issues: [],
      checkedUrls: [],
    };

    // Check each link
    Object.entries(policyLinks).forEach(([type, url]) => {
      if (url && typeof url === "string" && type !== "lastUpdated") {
        try {
          const parsedUrl = new URL(url);
          validation.checkedUrls.push({
            type,
            url: parsedUrl.href,
          });
        } catch (e) {
          validation.valid = false;
          validation.issues.push({
            type,
            url,
            error: "Invalid URL format",
          });
        }
      }
    });

    return validation;
  }

  /**
   * Validate parameter values against constraints
   * @param {Object} parameters - Parameter values to validate
   * @param {Array} supportedParameters - Array of supported parameter names
   * @returns {Object} Validation results
   */
  validateParameterValues(parameters, supportedParameters) {
    const result = {
      isValid: true,
      issues: [],
    };

    if (!parameters || typeof parameters !== "object") {
      result.isValid = false;
      result.issues.push({
        type: "invalid_parameters",
        message: "Parameters must be an object",
      });
      return result;
    }

    // Check for unsupported parameters
    const unsupportedParams = Object.keys(parameters).filter(
      (param) => !supportedParameters.includes(param)
    );

    if (unsupportedParams.length > 0) {
      result.issues.push({
        type: "unsupported_parameters",
        message: `Unsupported parameters: ${unsupportedParams.join(", ")}`,
        parameters: unsupportedParams,
      });
      // This is a warning, not an error
    }

    // Validate parameter values against constraints
    Object.entries(parameters).forEach(([param, value]) => {
      if (!supportedParameters.includes(param)) {
        // Already handled above
        return;
      }

      const constraints = DEFAULT_CONFIG.parameterConstraints[param];
      if (!constraints) {
        // No constraints defined for this parameter
        return;
      }

      if (typeof value !== "number") {
        result.isValid = false;
        result.issues.push({
          type: "invalid_parameter_type",
          message: `Parameter ${param} must be a number`,
          parameter: param,
          value,
        });
        return;
      }

      if (value < constraints.min || value > constraints.max) {
        result.isValid = false;
        result.issues.push({
          type: "parameter_out_of_range",
          message: `Parameter ${param} must be between ${constraints.min} and ${constraints.max}`,
          parameter: param,
          value,
          min: constraints.min,
          max: constraints.max,
        });
      }
    });

    return result;
  }
}

// Create and export a singleton instance
export const validator = new ModelRegistryValidator();
