/**
 * @fileoverview Token Usage Tracker
 * Manages token usage tracking, request history, and usage statistics
 * with comprehensive logging and validation.
 */

import { TokenLogger } from "./token-counter-logger.js";
import { TokenCounterError, ErrorCodes } from "./token-counter-error-types.js";
import { DEFAULT_CONFIG, EVENT_TYPES } from "./token-counter-defaults.js";
import { validator } from "./token-counter-validator.js";
import { estimator } from "./token-counter-estimator.js";

/**
 * TokenTracker class
 * Handles request tracking and token usage monitoring
 */
export class TokenTracker {
  /**
   * Create a new TokenTracker instance
   */
  constructor() {
    this.logger = TokenLogger;
    this.config = DEFAULT_CONFIG;
    this.requestHistory = new Map();
    this.currentRequestId = 0;

    // Clean up old requests periodically
    this.setupCleanupInterval();
  }

  /**
   * Generate a unique request ID
   *
   * @returns {string} Unique request identifier
   */
  generateRequestId() {
    const requestId = `req_${Date.now()}_${++this.currentRequestId}`;
    this.logger.log("tracker", "Generated request ID", { requestId });
    return requestId;
  }

  /**
   * Initialize request tracking
   *
   * @param {string} requestId - Request identifier
   * @param {string} model - Model identifier
   * @param {Array<Object>} messages - Message array
   * @returns {Object} Initial request state
   * @throws {TokenCounterError} If initialization fails
   */
  initializeRequest(requestId, model, messages) {
    this.logger.log("tracker", "Initializing request", {
      requestId,
      model,
      messages,
    });

    try {
      const estimatedTokens = estimator.estimateTokens(messages);

      const initialState = {
        requestId,
        initialModel: model,
        currentModel: model,
        attempts: [],
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        modelChanges: [],
        startTime: Date.now(),
        estimatedInitialTokens: estimatedTokens,
        systemPromptTokens: null,
        lastActivity: Date.now(),
      };

      this.requestHistory.set(requestId, initialState);
      this.emitEvent(EVENT_TYPES.REQUEST_INITIALIZED, {
        requestId,
        state: initialState,
      });

      return initialState;
    } catch (error) {
      throw new TokenCounterError(
        "Failed to initialize request tracking",
        ErrorCodes.INITIALIZATION,
        { requestId, model, error: error.message }
      );
    }
  }

  /**
   * Record an attempt for a request
   *
   * @param {string} requestId - Request identifier
   * @param {Object} usage - Token usage data
   * @param {string} model - Model identifier
   * @param {boolean} [isCached=false] - Whether the response was cached
   * @param {Error} [error=null] - Error if attempt failed
   * @throws {TokenCounterError} If recording fails
   */
  recordAttempt(requestId, usage, model, isCached = false, error = null) {
    this.logger.log("tracker", "Recording attempt", {
      requestId,
      usage,
      model,
      isCached,
    });

    const state = this.requestHistory.get(requestId);
    if (!state) {
      throw new TokenCounterError(
        "No state found for request",
        ErrorCodes.TRACKING,
        { requestId }
      );
    }

    try {
      const attempt = this.createAttemptRecord(usage, model, isCached, error);

      // Validate attempt
      const previousAttempt = state.attempts[state.attempts.length - 1];
      const validation = validator.validateAttempt(attempt, previousAttempt);

      if (!validation.isValid) {
        this.emitEvent(EVENT_TYPES.VALIDATION_FAILED, {
          requestId,
          validation,
          attempt,
        });
      }

      // Handle model changes
      if (state.currentModel !== model) {
        this.handleModelChange(state, model);
      }

      // Update state
      this.updateStateWithAttempt(state, attempt, isCached);

      // Record activity
      state.lastActivity = Date.now();
      this.requestHistory.set(requestId, state);

      this.emitEvent(EVENT_TYPES.ATTEMPT_RECORDED, {
        requestId,
        attempt,
        state,
      });
    } catch (error) {
      throw new TokenCounterError(
        "Failed to record attempt",
        ErrorCodes.TRACKING,
        { requestId, error: error.message }
      );
    }
  }

  /**
   * Create an attempt record
   *
   * @private
   * @param {Object} usage - Token usage data
   * @param {string} model - Model identifier
   * @param {boolean} isCached - Whether response was cached
   * @param {Error} error - Error if attempt failed
   * @returns {Object} Attempt record
   */
  createAttemptRecord(usage, model, isCached, error) {
    return {
      timestamp: Date.now(),
      model,
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      isCached,
      error: error
        ? {
            message: error.message,
            status: error.status,
            metadata: error.metadata,
          }
        : null,
    };
  }

  /**
   * Handle model change in request state
   *
   * @private
   * @param {Object} state - Current request state
   * @param {string} newModel - New model identifier
   */
  handleModelChange(state, newModel) {
    const previousMetrics = {
      model: state.currentModel,
      promptTokens: state.totalPromptTokens,
      completionTokens: state.totalCompletionTokens,
      timestamp: Date.now(),
    };

    state.modelChanges.push({
      from: state.currentModel,
      to: newModel,
      timestamp: Date.now(),
      previousMetrics,
    });

    // Reset counters for new model
    state.totalPromptTokens = 0;
    state.totalCompletionTokens = 0;
    state.currentModel = newModel;

    this.emitEvent(EVENT_TYPES.MODEL_CHANGED, {
      requestId: state.requestId,
      from: previousMetrics.model,
      to: newModel,
      metrics: previousMetrics,
    });
  }

  /**
   * Update state with attempt data
   *
   * @private
   * @param {Object} state - Current request state
   * @param {Object} attempt - Attempt record
   * @param {boolean} isCached - Whether response was cached
   */
  updateStateWithAttempt(state, attempt, isCached) {
    state.attempts.push(attempt);

    if (!isCached) {
      state.totalPromptTokens += attempt.promptTokens;
      state.totalCompletionTokens += attempt.completionTokens;
    }
  }

  /**
   * Track system prompt token usage
   *
   * @param {string} requestId - Request identifier
   * @param {string} systemPrompt - System prompt content
   * @returns {Object} Token usage information
   * @throws {TokenCounterError} If tracking fails
   */
  trackSystemPrompt(requestId, systemPrompt) {
    this.logger.log("tracker", "Tracking system prompt", { requestId });

    try {
      // Check if request state exists
      const state = this.requestHistory.get(requestId);

      // Create a temporary state if none exists
      if (!state) {
        this.logger.log(
          "tracker",
          "No state found for request, creating temporary state",
          { requestId }
        );
        // Create a temporary state just for token estimation
        const tempState = {
          requestId,
          initialModel: "temporary",
          currentModel: "temporary",
          attempts: [],
          totalPromptTokens: 0,
          totalCompletionTokens: 0,
          modelChanges: [],
          startTime: Date.now(),
          estimatedInitialTokens: 0,
          systemPromptTokens: null,
          lastActivity: Date.now(),
          isTemporary: true, // Flag to mark this as temporary
        };

        // Store the temporary state
        this.requestHistory.set(requestId, tempState);
      }

      // Estimate tokens
      const estimatedTokens = estimator.estimateTokens([
        { role: "system", content: systemPrompt },
      ]);

      // Update the state (whether it was existing or temporary)
      const currentState = this.requestHistory.get(requestId);
      currentState.systemPromptTokens = estimatedTokens;
      currentState.lastActivity = Date.now();
      this.requestHistory.set(requestId, currentState);

      this.emitEvent(EVENT_TYPES.SYSTEM_PROMPT_TRACKED, {
        requestId,
        estimatedTokens,
        isTemporaryState: currentState.isTemporary || false,
      });

      return {
        estimatedTokens,
        maxAllowed: this.config.systemPrompt.defaultMaxContext,
        isTemporaryState: currentState.isTemporary || false,
      };
    } catch (error) {
      throw new TokenCounterError(
        "Failed to track system prompt",
        ErrorCodes.SYSTEM_PROMPT,
        { requestId, error: error.message }
      );
    }
  }

  /**
   * Set up interval to clean up old requests
   *
   * @private
   */
  setupCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const retentionPeriod = this.config.tracking.historyRetention;

      for (const [requestId, state] of this.requestHistory.entries()) {
        if (now - state.lastActivity > retentionPeriod) {
          this.requestHistory.delete(requestId);
          this.logger.log("tracker", "Cleaned up old request", { requestId });
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Emit an event for the token counter system
   *
   * @private
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  emitEvent(type, data) {
    this.logger.log("tracker", "Emitting event", { type, data });
    // Event handling can be expanded here
  }
}

// Export singleton instance
export const tracker = new TokenTracker();
