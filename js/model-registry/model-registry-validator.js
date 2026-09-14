/**
 * @fileoverview Validation utilities for the model registry system.
 * Provides validation for model configurations, fallbacks, and other aspects.
 */

import { logger } from "./model-registry-logger.js";
import { utils } from "./model-registry-utils.js";
import { DEFAULT_CONFIG } from "./model-registry-config.js";
import { ModelValidationError } from "./model-registry-errors.js";

/**
 * The two unit strings a `costs.meters` entry may carry.
 *
 * PINNED IN TWO PLACES ON PURPOSE, AND A PROOF ROW HOLDS THEM TOGETHER. The capture side
 * lives in .claude/model-add/pricing.mjs (METER_UNIT), an ES module in a tool directory the
 * shipped app must never import; this file is a shipped ES module the tool cannot import
 * either, because it pulls in the whole registry. Two copies of a vocabulary is two chances
 * for it to drift, so prove-modality.mjs reads the literal strings out of BOTH files and
 * reddens when they disagree — a cross-file pin, the prove-wcag22-criteria.mjs arrangement.
 */
const KNOWN_METER_UNITS = ["usd-per-million-tokens", "usd-per-request"];

/** The only two cost keys any validator has ever enforced, and the only two every consumer reads. */
const VALIDATED_COST_KEYS = ["input", "output"];

/**
 * Cost keys that exist in the registry today and are knowingly tolerated: `image` has one
 * user-visible reader (js/modules/model-manager.js), `video` is a hard-coded 0 on 150 entries
 * that nothing reads, and `meters` is validated above. Everything else is reported.
 */
const REPORTED_COST_KEYS = ["image", "video", "meters"];


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
      // Non-fatal findings. `issues` sets isValid:false and makes registerModel throw;
      // a warning must never do that, because the things worth reporting here are on
      // hundreds of entries that predate any gate.
      warnings: [],
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

    // Validate the unit-tagged meter block, and REPORT any cost key nothing validates.
    //
    // WHY EVERY FATAL CHECK BELOW IS GUARDED ON `meters` BEING PRESENT. `registerModel` in
    // model-registry-core.js THROWS a ModelValidationError when this returns isValid:false,
    // and js/model-definitions.js is 478 top-level registerModel calls in one module — so a
    // rule that rejected a single existing entry would abort the module and take the entire
    // registry, and the app, with it. No entry in the file carries `costs.meters` today, so
    // the fatal path is reachable only by an entry written after this check existed.
    //
    // THE UNRECOGNISED-KEY PATH IS DELIBERATELY NOT FATAL, for the same reason. Measured
    // 11 September 2026, `costs` across the registry carries sixteen distinct key names —
    // input, output, image, video, audio, webSearch, requests, file, request, additionalCosts,
    // images, imageInput, imageOutput, cacheRead, cacheCreation, pdf — of which exactly TWO
    // are validated and exactly THREE are read by any consumer. Refusing the other thirteen
    // would refuse 204 entries. They are reported instead, which is what turns "absorbed
    // silently" into "visible", and that was the hole: a camelCase `imageOutput`, a
    // "// Per million seconds" comment on a per-token figure, and three `audio: 0.0` entries
    // all arrived without a single gate objecting.
    if (config.costs && typeof config.costs === "object") {
      const meters = config.costs.meters;

      if (meters !== undefined) {
        if (meters === null || typeof meters !== "object" || Array.isArray(meters)) {
          result.isValid = false;
          result.issues.push({
            type: "invalid_cost_meters",
            message: "costs.meters must be an object keyed by the catalogue's own meter name",
            field: "costs.meters",
          });
        } else {
          for (const [meterName, meter] of Object.entries(meters)) {
            // A BARE NUMBER IS REFUSED, not coerced. The whole point of this block is that a
            // figure carries its unit; accepting `audio: 100` here would recreate the field
            // whose unit had to be guessed from a comment that was wrong.
            if (!meter || typeof meter !== "object" || Array.isArray(meter)) {
              result.isValid = false;
              result.issues.push({
                type: "invalid_cost_meter",
                message: `costs.meters.${meterName} must be an object of the form { value, unit }`,
                field: `costs.meters.${meterName}`,
              });
              continue;
            }
            if (typeof meter.value !== "number" || !Number.isFinite(meter.value)) {
              result.isValid = false;
              result.issues.push({
                type: "invalid_cost_meter_value",
                message: `costs.meters.${meterName}.value must be a finite number`,
                field: `costs.meters.${meterName}.value`,
              });
            }
            if (!KNOWN_METER_UNITS.includes(meter.unit)) {
              result.isValid = false;
              result.issues.push({
                type: "invalid_cost_meter_unit",
                message: `costs.meters.${meterName}.unit must be one of ${KNOWN_METER_UNITS.join(", ")} — got ${JSON.stringify(meter.unit)}`,
                field: `costs.meters.${meterName}.unit`,
              });
            }
          }
        }
      }

      const unrecognised = Object.keys(config.costs).filter(
        (k) => !VALIDATED_COST_KEYS.includes(k) && !REPORTED_COST_KEYS.includes(k)
      );
      if (unrecognised.length > 0) {
        result.warnings.push({
          type: "unrecognised_cost_keys",
          message: `costs carries key(s) nothing validates or renders: ${unrecognised.join(", ")}. A cost key with no reader and no unit is free data.`,
          field: "costs",
          keys: unrecognised,
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
