/**
 * @fileoverview Token Usage Reporter
 * Provides comprehensive reporting and analysis functionality for token usage
 * with accessibility-focused output formatting.
 */

import { TokenLogger } from "./token-counter-logger.js";
import { TokenCounterError, ErrorCodes } from "./token-counter-error-types.js";
import { DEFAULT_CONFIG } from "./token-counter-defaults.js";

/**
 * TokenReporter class
 * Handles report generation and usage analysis
 */
export class TokenReporter {
  /**
   * Create a new TokenReporter instance
   */
  constructor() {
    this.logger = TokenLogger;
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Generate a comprehensive usage report
   *
   * @param {Object} state - Request state object
   * @returns {Object} Detailed usage report
   * @throws {TokenCounterError} If report generation fails
   */
  generateReport(state) {
    this.logger.log("reporter", "Generating usage report", {
      requestId: state.requestId,
    });

    try {
      const report = {
        requestId: state.requestId,
        duration: Date.now() - state.startTime,
        initialModel: state.initialModel,
        currentModel: state.currentModel,
        totalAttempts: state.attempts.length,
        totalPromptTokens: state.totalPromptTokens,
        totalCompletionTokens: state.totalCompletionTokens,
        modelChanges: this.formatModelChanges(state.modelChanges),
        tokenEfficiency: this.calculateTokenEfficiency(state),
        attempts: this.formatAttempts(state.attempts),
        estimatedVsActual: this.compareEstimatedVsActual(state),
        performance: this.analyzePerformance(state),
        systemPromptAnalysis: this.analyzeSystemPrompt(state),
        summary: this.generateSummary(state),
      };

      this.logger.log("reporter", "Report generated", { report });
      return report;
    } catch (error) {
      throw new TokenCounterError(
        "Failed to generate usage report",
        ErrorCodes.REPORTING,
        { requestId: state.requestId, error: error.message }
      );
    }
  }

  /**
   * Format model changes for reporting
   *
   * @private
   * @param {Array<Object>} modelChanges - Array of model change records
   * @returns {Array<Object>} Formatted model changes
   */
  formatModelChanges(modelChanges) {
    return modelChanges.map((change) => ({
      timestamp: change.timestamp,
      from: change.from,
      to: change.to,
      metrics: {
        promptTokens: change.previousMetrics.promptTokens,
        completionTokens: change.previousMetrics.completionTokens,
        total:
          change.previousMetrics.promptTokens +
          change.previousMetrics.completionTokens,
      },
      duration:
        change.timestamp -
        (modelChanges[modelChanges.indexOf(change) - 1]?.timestamp ||
          change.timestamp),
    }));
  }

  /**
   * Calculate token efficiency metrics
   *
   * @private
   * @param {Object} state - Request state
   * @returns {Object} Efficiency metrics
   */
  calculateTokenEfficiency(state) {
    const successfulAttempts = state.attempts.filter((a) => !a.error);
    if (successfulAttempts.length === 0)
      return { percentage: 0, rating: "N/A" };

    const successful = this.sumTokens(successfulAttempts);
    const total = this.sumTokens(state.attempts);

    const efficiency =
      total.total === 0 ? 0 : (successful.total / total.total) * 100;

    return {
      percentage: efficiency,
      rating: this.getEfficiencyRating(efficiency),
      breakdown: {
        successful,
        total,
        wasted: {
          prompt: total.prompt - successful.prompt,
          completion: total.completion - successful.completion,
          total: total.total - successful.total,
        },
      },
    };
  }

  /**
   * Sum token counts from attempts
   *
   * @private
   * @param {Array<Object>} attempts - Array of attempts
   * @returns {Object} Token sums
   */
  sumTokens(attempts) {
    return attempts.reduce(
      (sum, attempt) => ({
        prompt: sum.prompt + (attempt.promptTokens || 0),
        completion: sum.completion + (attempt.completionTokens || 0),
        total:
          sum.total +
          (attempt.promptTokens || 0) +
          (attempt.completionTokens || 0),
      }),
      { prompt: 0, completion: 0, total: 0 }
    );
  }

  /**
   * Get efficiency rating based on percentage
   *
   * @private
   * @param {number} efficiency - Efficiency percentage
   * @returns {string} Efficiency rating
   */
  getEfficiencyRating(efficiency) {
    const { performance } = this.config;
    if (efficiency >= performance.efficiency.excellent) return "Excellent";
    if (efficiency >= performance.efficiency.good) return "Good";
    if (efficiency >= performance.efficiency.fair) return "Fair";
    if (efficiency >= performance.efficiency.poor) return "Poor";
    return "Critical";
  }

  /**
   * Format attempts for reporting
   *
   * @private
   * @param {Array<Object>} attempts - Array of attempts
   * @returns {Array<Object>} Formatted attempts
   */
  formatAttempts(attempts) {
    return attempts.map((attempt, index) => ({
      index: index + 1,
      timestamp: attempt.timestamp,
      model: attempt.model,
      tokens: {
        prompt: attempt.promptTokens,
        completion: attempt.completionTokens,
        total: attempt.promptTokens + attempt.completionTokens,
      },
      cached: attempt.isCached,
      error: attempt.error,
      duration:
        attempt.timestamp -
        (attempts[index - 1]?.timestamp || attempt.timestamp),
    }));
  }

  /**
   * Compare estimated vs actual token usage
   *
   * @private
   * @param {Object} state - Request state
   * @returns {Object} Comparison metrics
   */
  compareEstimatedVsActual(state) {
    const difference = state.totalPromptTokens - state.estimatedInitialTokens;
    const percentageOff =
      state.estimatedInitialTokens === 0
        ? 0
        : (Math.abs(difference) / state.estimatedInitialTokens) * 100;

    return {
      estimated: state.estimatedInitialTokens,
      actual: state.totalPromptTokens,
      difference,
      percentageOff,
      accuracy: Math.max(0, 100 - percentageOff),
    };
  }

  /**
   * Analyze performance metrics
   *
   * @private
   * @param {Object} state - Request state
   * @returns {Object} Performance analysis
   */
  analyzePerformance(state) {
    const totalDuration = Date.now() - state.startTime;
    const averageAttemptDuration =
      state.attempts.length === 0 ? 0 : totalDuration / state.attempts.length;

    return {
      totalDuration,
      averageAttemptDuration,
      successRate: this.calculateSuccessRate(state.attempts),
      tokenRate: this.calculateTokenRate(state, totalDuration),
      modelEfficiency: this.calculateModelEfficiency(state),
    };
  }

  /**
   * Calculate success rate from attempts
   *
   * @private
   * @param {Array<Object>} attempts - Array of attempts
   * @returns {Object} Success rate metrics
   */
  calculateSuccessRate(attempts) {
    const total = attempts.length;
    const successful = attempts.filter((a) => !a.error).length;
    const percentage = total === 0 ? 0 : (successful / total) * 100;

    return {
      successful,
      total,
      percentage,
    };
  }

  /**
   * Calculate token processing rate
   *
   * @private
   * @param {Object} state - Request state
   * @param {number} duration - Total duration
   * @returns {Object} Token rate metrics
   */
  calculateTokenRate(state, duration) {
    const totalTokens = state.totalPromptTokens + state.totalCompletionTokens;
    const tokensPerSecond =
      duration === 0 ? 0 : totalTokens / (duration / 1000);

    return {
      tokensPerSecond,
      tokensPerMinute: tokensPerSecond * 60,
    };
  }

  /**
   * Calculate model-specific efficiency
   *
   * @private
   * @param {Object} state - Request state
   * @returns {Object} Model efficiency metrics
   */
  calculateModelEfficiency(state) {
    const modelStats = new Map();

    state.attempts.forEach((attempt) => {
      const stats = modelStats.get(attempt.model) || {
        attempts: 0,
        successful: 0,
        tokens: { prompt: 0, completion: 0 },
      };

      stats.attempts++;
      if (!attempt.error) stats.successful++;
      stats.tokens.prompt += attempt.promptTokens;
      stats.tokens.completion += attempt.completionTokens;

      modelStats.set(attempt.model, stats);
    });

    return Array.from(modelStats.entries()).map(([model, stats]) => ({
      model,
      successRate: (stats.successful / stats.attempts) * 100,
      tokenUsage: stats.tokens,
      attempts: stats.attempts,
    }));
  }

  /**
   * Analyze system prompt usage
   *
   * @private
   * @param {Object} state - Request state
   * @returns {Object} System prompt analysis
   */
  analyzeSystemPrompt(state) {
    if (!state.systemPromptTokens) return null;

    return {
      tokenCount: state.systemPromptTokens,
      percentageOfTotal:
        state.totalPromptTokens === 0
          ? 0
          : (state.systemPromptTokens / state.totalPromptTokens) * 100,
    };
  }

  /**
   * Generate a human-readable summary
   *
   * @private
   * @param {Object} state - Request state
   * @returns {string} Summary text
   */
  generateSummary(state) {
    const totalTokens = state.totalPromptTokens + state.totalCompletionTokens;
    const efficiency = this.calculateTokenEfficiency(state);
    const duration = (Date.now() - state.startTime) / 1000;

    return [
      `Request ${state.requestId} completed in ${duration.toFixed(2)} seconds`,
      `Used ${totalTokens} total tokens (${state.totalPromptTokens} prompt, ${state.totalCompletionTokens} completion)`,
      `Achieved ${efficiency.percentage.toFixed(1)}% token efficiency (${
        efficiency.rating
      })`,
      `Made ${state.attempts.length} attempts with ${state.modelChanges.length} model changes`,
      state.systemPromptTokens
        ? `System prompt used ${state.systemPromptTokens} tokens`
        : null,
    ]
      .filter(Boolean)
      .join(". ");
  }
}

// Export singleton instance
export const reporter = new TokenReporter();
