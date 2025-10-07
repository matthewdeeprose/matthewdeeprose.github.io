/**
 * @fileoverview Token Counter Validator
 * Provides validation functionality for token counting operations.
 */

import { TokenLogger } from "./token-counter-logger.js";
import { TokenCounterError, ErrorCodes } from "./token-counter-error-types.js";
import { DEFAULT_CONFIG } from "./token-counter-defaults.js";

/**
 * Validator class for token counter operations
 * Handles validation of token counts, request states, and model compatibility
 */
export class TokenValidator {
  /**
   * Create a new TokenValidator instance
   */
  constructor() {
    this.logger = TokenLogger;
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Validate token counts for a request attempt
   *
   * @param {Object} attempt - The attempt to validate
   * @param {Object} previousAttempt - The previous attempt for comparison
   * @returns {Object} Validation results
   * @throws {TokenCounterError} If validation fails
   */
  validateAttempt(attempt, previousAttempt = null) {
    this.logger.log("validator", "Validating attempt", {
      attempt,
      previousAttempt,
    });

    const validation = {
      isValid: true,
      warnings: [],
      anomalies: [],
    };

    try {
      // Validate minimum token requirements
      this.validateMinimumTokens(attempt, validation);

      // Compare with previous attempt if available
      if (previousAttempt && !attempt.isCached) {
        this.validateTokenVariation(attempt, previousAttempt, validation);
      }

      // Check for anomalies
      this.checkForAnomalies(attempt, validation);

      this.logger.log("validator", "Validation complete", validation);
      return validation;
    } catch (error) {
      throw new TokenCounterError(
        "Attempt validation failed",
        ErrorCodes.VALIDATION,
        { attempt, error: error.message }
      );
    }
  }

  /**
   * Validate minimum token requirements
   *
   * @private
   * @param {Object} attempt - The attempt to validate
   * @param {Object} validation - Validation results object
   */
  validateMinimumTokens(attempt, validation) {
    const { minimumTokens } = this.config.validation;

    if (attempt.promptTokens < minimumTokens.prompt) {
      validation.anomalies.push({
        type: "insufficient_prompt_tokens",
        value: attempt.promptTokens,
        minimum: minimumTokens.prompt,
      });
      validation.isValid = false;
    }

    if (attempt.completionTokens < minimumTokens.completion) {
      validation.anomalies.push({
        type: "insufficient_completion_tokens",
        value: attempt.completionTokens,
        minimum: minimumTokens.completion,
      });
      validation.isValid = false;
    }
  }

  /**
   * Validate token count variation between attempts
   *
   * @private
   * @param {Object} current - Current attempt
   * @param {Object} previous - Previous attempt
   * @param {Object} validation - Validation results object
   */
  validateTokenVariation(current, previous, validation) {
    const { variationThreshold } = this.config.validation;

    // Calculate variations
    const promptDiff = this.calculateVariation(
      current.promptTokens,
      previous.promptTokens
    );

    const completionDiff = this.calculateVariation(
      current.completionTokens,
      previous.completionTokens
    );

    // Check for significant variations
    if (promptDiff > variationThreshold) {
      validation.warnings.push({
        type: "prompt_token_variation",
        difference: promptDiff * 100,
        current: current.promptTokens,
        previous: previous.promptTokens,
      });
    }

    if (completionDiff > variationThreshold) {
      validation.warnings.push({
        type: "completion_token_variation",
        difference: completionDiff * 100,
        current: current.completionTokens,
        previous: previous.completionTokens,
      });
    }
  }

  /**
   * Check for anomalies in token counts
   *
   * @private
   * @param {Object} attempt - The attempt to check
   * @param {Object} validation - Validation results object
   */
  checkForAnomalies(attempt, validation) {
    // Check for zero tokens
    if (attempt.promptTokens === 0 || attempt.completionTokens === 0) {
      validation.anomalies.push({
        type: "zero_tokens",
        promptTokens: attempt.promptTokens,
        completionTokens: attempt.completionTokens,
      });
      validation.isValid = false;
    }

    // Check for unusually high token counts
    const totalTokens = attempt.promptTokens + attempt.completionTokens;
    if (totalTokens > attempt.maxTokens) {
      validation.anomalies.push({
        type: "token_limit_exceeded",
        total: totalTokens,
        limit: attempt.maxTokens,
      });
      validation.isValid = false;
    }
  }

  /**
   * Calculate variation between two values
   *
   * @private
   * @param {number} current - Current value
   * @param {number} previous - Previous value
   * @returns {number} Variation ratio
   */
  calculateVariation(current, previous) {
    if (previous === 0) return current > 0 ? 1 : 0;
    return Math.abs(current - previous) / previous;
  }

  /**
   * Validate system prompt token usage
   *
   * @param {Object} params - Validation parameters
   * @param {number} params.tokenCount - Estimated token count
   * @param {number} params.maxContext - Model's max context length
   * @returns {Object} Validation results
   * @throws {TokenCounterError} If validation fails
   */
  validateSystemPrompt({ tokenCount, maxContext }) {
    this.logger.log("validator", "Validating system prompt", {
      tokenCount,
      maxContext,
    });

    const { maxContextRatio } = this.config.systemPrompt;
    const maxAllowed = Math.floor(maxContext * maxContextRatio);

    const validation = {
      isValid: tokenCount <= maxAllowed,
      tokenCount,
      maxAllowed,
      remainingTokens: maxAllowed - tokenCount,
    };

    if (!validation.isValid) {
      throw new TokenCounterError(
        "System prompt exceeds maximum allowed tokens",
        ErrorCodes.SYSTEM_PROMPT,
        validation
      );
    }

    return validation;
  }
}

// Export singleton instance
export const validator = new TokenValidator();
