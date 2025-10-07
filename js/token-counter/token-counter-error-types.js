/**
 * @fileoverview Token Counter Error Types
 * Defines custom error types for the token counter system
 * with enhanced error information and accessibility support.
 */

/**
 * Custom error class for token counter related errors
 * Includes additional context for better error handling and debugging
 */
export class TokenCounterError extends Error {
  /**
   * Create a new TokenCounterError
   *
   * @param {string} message - Human-readable error message
   * @param {string} code - Error code for programmatic handling
   * @param {Object} [metadata={}] - Additional error context
   */
  constructor(message, code, metadata = {}) {
    super(message);

    // Maintain proper error inheritance chain
    Object.setPrototypeOf(this, TokenCounterError.prototype);

    this.name = "TokenCounterError";
    this.code = code;
    this.metadata = metadata;

    // Capture stack trace for better debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TokenCounterError);
    }
  }

  /**
   * Get a formatted string representation of the error
   * Enhances accessibility by providing clear error context
   *
   * @returns {string} Formatted error message
   */
  toString() {
    return `${this.name}[${this.code}]: ${this.message}`;
  }
}

// Common error codes
export const ErrorCodes = {
  INITIALIZATION_ERROR: "INITIALIZATION_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  ESTIMATION_ERROR: "ESTIMATION_ERROR",
  TRACKING_ERROR: "TRACKING_ERROR",
  REQUEST_ID_ERROR: "REQUEST_ID_ERROR",
  SYSTEM_PROMPT_ERROR: "SYSTEM_PROMPT_ERROR",
};
