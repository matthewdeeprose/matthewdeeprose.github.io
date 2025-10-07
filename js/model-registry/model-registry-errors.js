/**
 * @fileoverview Custom error types for the model registry system.
 * Provides specialized error classes for different failure scenarios in the model registry.
 */

/**
 * Base error class for all model registry errors
 */
export class ModelRegistryError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Object} options - Additional error options
   */
  constructor(message, options = {}) {
    super(message);
    this.name = "ModelRegistryError";
    this.timestamp = new Date().toISOString();
    this.code = options.code || "UNKNOWN_ERROR";
    this.details = options.details || {};

    // Ensure the stack trace properly shows the error's origin
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when model validation fails
 */
export class ModelValidationError extends ModelRegistryError {
  /**
   * @param {string} message - Error message
   * @param {Object} options - Additional error options
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = "ModelValidationError";
    this.code = options.code || "VALIDATION_ERROR";
  }
}

/**
 * Error thrown when a model is not found
 */
export class ModelNotFoundError extends ModelRegistryError {
  /**
   * @param {string} modelId - ID of the model that wasn't found
   * @param {Object} options - Additional error options
   */
  constructor(modelId, options = {}) {
    super(`Model not found: ${modelId}`, options);
    this.name = "ModelNotFoundError";
    this.code = options.code || "MODEL_NOT_FOUND";
    this.modelId = modelId;
  }
}

/**
 * Error thrown when a fallback model is invalid
 */
export class InvalidFallbackError extends ModelRegistryError {
  /**
   * @param {string} modelId - ID of the model with invalid fallback
   * @param {string} fallbackId - ID of the invalid fallback model
   * @param {string} reason - Reason for invalidity
   * @param {Object} options - Additional error options
   */
  constructor(modelId, fallbackId, reason, options = {}) {
    super(
      `Invalid fallback model: ${modelId} → ${fallbackId} (${reason})`,
      options
    );
    this.name = "InvalidFallbackError";
    this.code = options.code || "INVALID_FALLBACK";
    this.modelId = modelId;
    this.fallbackId = fallbackId;
    this.reason = reason;
  }
}

/**
 * Error thrown when parameter operations fail
 */
export class ParameterError extends ModelRegistryError {
  /**
   * @param {string} message - Error message
   * @param {Object} options - Additional error options
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = "ParameterError";
    this.code = options.code || "PARAMETER_ERROR";
  }
}

/**
 * Error codes for model registry errors
 */
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
  INVALID_FALLBACK: "INVALID_FALLBACK",
  PARAMETER_ERROR: "PARAMETER_ERROR",
  INITIALIZATION_ERROR: "INITIALIZATION_ERROR",
  POLICY_ERROR: "POLICY_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
};
