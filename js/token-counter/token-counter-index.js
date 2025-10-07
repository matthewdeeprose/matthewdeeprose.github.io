/**
 * @fileoverview Token Counter Main Module
 * Provides the main facade for the token counter system with comprehensive
 * token tracking, estimation, and reporting capabilities.
 */

import { TokenLogger } from "./token-counter-logger.js";
import { TokenCounterError, ErrorCodes } from "./token-counter-error-types.js";
import { DEFAULT_CONFIG, EVENT_TYPES } from "./token-counter-defaults.js";
import { validator } from "./token-counter-validator.js";
import { estimator } from "./token-counter-estimator.js";
import { tracker } from "./token-counter-tracker.js";
import { reporter } from "./token-counter-reporter.js";

/**
 * Main TokenCounter class
 * Provides a facade for token counting and tracking functionality
 */
export class TokenCounter {
  static #instance = null;

  /**
   * Get the TokenCounter singleton instance
   *
   * @returns {TokenCounter} Singleton instance
   */
  static getInstance() {
    if (!TokenCounter.#instance) {
      TokenCounter.#instance = new TokenCounter();
    }
    return TokenCounter.#instance;
  }

  /**
   * Create a new TokenCounter instance
   * @throws {Error} If attempting to create multiple instances
   */
  constructor() {
    if (TokenCounter.#instance) {
      throw new Error("Use TokenCounter.getInstance()");
    }

    this.logger = TokenLogger;
    this.config = DEFAULT_CONFIG;
    this.initialize();
  }

  /**
   * Initialize the token counter system
   *
   * @private
   */
  initialize() {
    this.logger.log("main", "Initializing token counter system");
    // Initialization is handled by component constructors
  }

  /**
   * Generate a unique request ID
   *
   * @returns {string} Request identifier
   */
  generateRequestId() {
    return tracker.generateRequestId();
  }

  /**
   * Initialize request tracking
   *
   * @param {string} requestId - Request identifier
   * @param {string} model - Model identifier
   * @param {Array<Object>} messages - Message array
   * @returns {Object} Initial request state
   */
  initializeRequest(requestId, model, messages) {
    this.logger.log("main", "Initializing request tracking", {
      requestId,
      model,
      messageCount: messages.length,
    });

    try {
      return tracker.initializeRequest(requestId, model, messages);
    } catch (error) {
      this.handleError("Failed to initialize request", error);
      throw error;
    }
  }

  /**
   * Record an attempt for a request
   *
   * @param {string} requestId - Request identifier
   * @param {Object} usage - Token usage data
   * @param {string} model - Model identifier
   * @param {boolean} [isCached=false] - Whether response was cached
   * @param {Error} [error=null] - Error if attempt failed
   */
  recordAttempt(requestId, usage, model, isCached = false, error = null) {
    this.logger.log("main", "Recording attempt", {
      requestId,
      model,
      isCached,
    });

    try {
      tracker.recordAttempt(requestId, usage, model, isCached, error);
    } catch (error) {
      this.handleError("Failed to record attempt", error);
      throw error;
    }
  }
  /**
   * Record token usage for a stream chunk
   *
   * @param {string} requestId - Request identifier
   * @param {Object} usage - Token usage data for this chunk
   * @param {string} model - Model identifier
   * @returns {Object} Updated token metrics
   */
  recordStreamChunk(requestId, usage, model) {
    this.logger.log("main", "Recording stream chunk", {
      requestId,
      model,
      usage,
    });

    try {
      // Get or create request state
      let state = tracker.requestHistory.get(requestId);

      if (!state) {
        // Initialize request tracking if not already done
        state = tracker.initializeRequest(requestId, model, []);
      }

      // Update running totals
      if (usage.prompt_tokens) {
        state.totalPromptTokens += usage.prompt_tokens;
      }

      if (usage.completion_tokens) {
        state.totalCompletionTokens += usage.completion_tokens;
      }

      // Update last activity timestamp
      state.lastActivity = Date.now();
      tracker.requestHistory.set(requestId, state);

      return {
        requestId,
        promptTokens: state.totalPromptTokens,
        completionTokens: state.totalCompletionTokens,
      };
    } catch (error) {
      this.handleError("Failed to record stream chunk", error);
      return null;
    }
  }
  /**
   * Track system prompt token usage
   * @param {string} requestId - Request identifier
   * @param {string} systemPrompt - System prompt content
   * @returns {Object} Token usage information
   */
  trackSystemPrompt(requestId, systemPrompt) {
    this.logger.log("main", "Tracking system prompt", { requestId });

    try {
      // If no requestId is provided, generate one
      const actualRequestId = requestId || this.generateRequestId();
      return tracker.trackSystemPrompt(actualRequestId, systemPrompt);
    } catch (error) {
      this.handleError("Failed to track system prompt", error);
      throw error;
    }
  }

  /**
   * Get a usage report for a request
   *
   * @param {string} requestId - Request identifier
   * @returns {Object} Usage report
   */
  getUsageReport(requestId) {
    this.logger.log("main", "Generating usage report", { requestId });

    try {
      const state = this.getRequestState(requestId);
      return reporter.generateReport(state);
    } catch (error) {
      this.handleError("Failed to generate report", error);
      throw error;
    }
  }

  /**
   * Calculate model comparison metrics
   *
   * @param {string} requestId - Request identifier
   * @param {string} modelA - First model to compare
   * @param {string} modelB - Second model to compare
   * @returns {Object} Comparison metrics
   */
  calculateModelDelta(requestId, modelA, modelB) {
    this.logger.log("main", "Calculating model delta", {
      requestId,
      modelA,
      modelB,
    });

    try {
      const state = this.getRequestState(requestId);
      const attemptsA = state.attempts.filter((a) => a.model === modelA);
      const attemptsB = state.attempts.filter((a) => a.model === modelB);

      return {
        promptTokenDelta: this.calculateAverageDelta(
          attemptsA,
          attemptsB,
          "promptTokens"
        ),
        completionTokenDelta: this.calculateAverageDelta(
          attemptsA,
          attemptsB,
          "completionTokens"
        ),
        efficiencyDelta: this.calculateEfficiencyDelta(attemptsA, attemptsB),
      };
    } catch (error) {
      this.handleError("Failed to calculate model delta", error);
      throw error;
    }
  }

  /**
   * Get request state
   *
   * @private
   * @param {string} requestId - Request identifier
   * @returns {Object} Request state
   * @throws {TokenCounterError} If state not found
   */
  getRequestState(requestId) {
    const state = tracker.requestHistory.get(requestId);
    if (!state) {
      throw new TokenCounterError(
        "No state found for request",
        ErrorCodes.REQUEST_ID,
        { requestId }
      );
    }
    return state;
  }

  /**
   * Record token usage for a stream chunk
   *
   * @param {string} requestId - Request identifier
   * @param {Object} usage - Token usage data for this chunk
   * @param {string} model - Model identifier
   * @returns {Object} Updated token metrics
   */
  recordStreamChunk(requestId, usage, model) {
    this.logger.log("main", "Recording stream chunk", {
      requestId,
      model,
      usage,
    });

    try {
      // Get or create request state
      let state = tracker.requestHistory.get(requestId);

      if (!state) {
        // Initialize request tracking if not already done
        state = tracker.initializeRequest(requestId, model, []);
      }

      // Update running totals
      if (usage.prompt_tokens) {
        state.totalPromptTokens += usage.prompt_tokens;
      }

      if (usage.completion_tokens) {
        state.totalCompletionTokens += usage.completion_tokens;
      }

      // Update last activity timestamp
      state.lastActivity = Date.now();
      tracker.requestHistory.set(requestId, state);

      return {
        requestId,
        promptTokens: state.totalPromptTokens,
        completionTokens: state.totalCompletionTokens,
      };
    } catch (error) {
      this.handleError("Failed to record stream chunk", error);
      return null;
    }
  }

  /**
   * Calculate average delta between two sets of attempts
   *
   * @private
   * @param {Array<Object>} attemptsA - First set of attempts
   * @param {Array<Object>} attemptsB - Second set of attempts
   * @param {string} tokenType - Type of tokens to compare
   * @returns {number} Average delta
   */
  calculateAverageDelta(attemptsA, attemptsB, tokenType) {
    const avgA = this.calculateAverage(attemptsA, tokenType);
    const avgB = this.calculateAverage(attemptsB, tokenType);
    return avgB - avgA;
  }

  /**
   * Calculate average token count
   *
   * @private
   * @param {Array<Object>} attempts - Array of attempts
   * @param {string} tokenType - Type of tokens to average
   * @returns {number} Average token count
   */
  calculateAverage(attempts, tokenType) {
    if (attempts.length === 0) return 0;
    const sum = attempts.reduce(
      (total, attempt) => total + (attempt[tokenType] || 0),
      0
    );
    return sum / attempts.length;
  }

  /**
   * Calculate efficiency delta between two sets of attempts
   *
   * @private
   * @param {Array<Object>} attemptsA - First set of attempts
   * @param {Array<Object>} attemptsB - Second set of attempts
   * @returns {number} Efficiency delta
   */
  calculateEfficiencyDelta(attemptsA, attemptsB) {
    const efficiencyA = this.calculateEfficiency(attemptsA);
    const efficiencyB = this.calculateEfficiency(attemptsB);
    return efficiencyB - efficiencyA;
  }

  /**
   * Calculate efficiency for a set of attempts
   *
   * @private
   * @param {Array<Object>} attempts - Array of attempts
   * @returns {number} Efficiency percentage
   */
  calculateEfficiency(attempts) {
    if (attempts.length === 0) return 0;
    const successful = attempts.filter((a) => !a.error).length;
    return (successful / attempts.length) * 100;
  }

  /**
   * Handle errors in a consistent way
   *
   * @private
   * @param {string} message - Error message
   * @param {Error} error - Original error
   */
  handleError(message, error) {
    this.logger.log("main", "Error occurred", {
      message,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        metadata: error.metadata,
      },
    });
  }
}

// Export singleton instance
export const tokenCounter = TokenCounter.getInstance();
