/**
 * OpenRouter Client Module - Cost
 *
 * Handles cost tracking and calculations for the OpenRouter client.
 * Provides methods for determining if models are free and calculating costs.
 */

import { modelRegistry } from "../model-definitions.js";
import { calculateCost, formatCost } from "../cost-calculator.js";
import { openRouterUtils } from "./openrouter-client-utils.js";

/**
 * Class for handling cost tracking and calculations
 */
export class OpenRouterCost {
  constructor() {
    // Initialize any cost-specific state
  }

  /**
   * Check if a model is free
   * @param {string} responseModel - Model ID from response
   * @param {string} requestModel - Model ID from request
   * @returns {boolean} Whether the model is free
   */
  isFreeModel(responseModel, requestModel) {
    // Check if either the response model or request model indicates this is a free model
    const isFree =
      // Check if the response model ends with :free
      responseModel?.endsWith(":free") ||
      // Check if the request model ends with :free
      requestModel?.endsWith(":free") ||
      // Check if the model exists in registry and is marked as free
      modelRegistry
        .getAllModels()
        .some(
          (model) =>
            model.isFree &&
            (model.id === responseModel ||
              model.id.replace(":free", "") === responseModel)
        );

    openRouterUtils.debug("Checking if model is free", {
      responseModel,
      requestModel,
      isFree,
    });

    return isFree;
  }

  /**
   * Calculate cost for a request
   * @param {string} model - Model ID
   * @param {number} promptTokens - Number of prompt tokens
   * @param {number} completionTokens - Number of completion tokens
   * @param {number} cacheDiscount - Discount factor for cached responses (0-1)
   * @returns {number} Cost in USD
   */
  calculateRequestCost(
    model,
    promptTokens,
    completionTokens,
    cacheDiscount = 0
  ) {
    try {
      // Check if it's a free model first
      if (this.isFreeModel(model, model)) {
        openRouterUtils.debug("Model is free, no cost", { model });
        return 0;
      }

      // Calculate cost using the cost-calculator module
      const cost = calculateCost(
        model,
        promptTokens,
        completionTokens,
        cacheDiscount
      );

      openRouterUtils.debug("Calculated request cost", {
        model,
        promptTokens,
        completionTokens,
        cacheDiscount,
        cost,
      });

      return cost;
    } catch (error) {
      openRouterUtils.error("Error calculating cost", {
        error,
        model,
        promptTokens,
        completionTokens,
      });
      throw error;
    }
  }

  /**
   * Format cost for display
   * @param {number} cost - Cost in USD
   * @returns {string} Formatted cost string
   */
  formatCost(cost) {
    try {
      return formatCost(cost);
    } catch (error) {
      openRouterUtils.error("Error formatting cost", { error, cost });
      return "Error";
    }
  }

  /**
   * Calculate and format cost for a request
   * @param {string} model - Model ID
   * @param {number} promptTokens - Number of prompt tokens
   * @param {number} completionTokens - Number of completion tokens
   * @param {number} cacheDiscount - Discount factor for cached responses (0-1)
   * @returns {string} Formatted cost string
   */
  getFormattedCost(model, promptTokens, completionTokens, cacheDiscount = 0) {
    try {
      // Check if it's a free model first
      if (this.isFreeModel(model, model)) {
        return "Free";
      }

      const cost = this.calculateRequestCost(
        model,
        promptTokens,
        completionTokens,
        cacheDiscount
      );

      return this.formatCost(cost);
    } catch (error) {
      openRouterUtils.error("Error getting formatted cost", {
        error,
        model,
        promptTokens,
        completionTokens,
      });
      return "Error calculating cost";
    }
  }

  /**
   * Calculate total cost for multiple requests
   * @param {Array} requests - Array of request objects with model, promptTokens, and completionTokens
   * @returns {number} Total cost in USD
   */
  calculateTotalCost(requests) {
    try {
      let totalCost = 0;

      requests.forEach((request) => {
        if (!this.isFreeModel(request.model, request.model)) {
          const cost = this.calculateRequestCost(
            request.model,
            request.promptTokens,
            request.completionTokens,
            request.cacheDiscount || 0
          );
          totalCost += cost;
        }
      });

      openRouterUtils.debug("Calculated total cost", {
        requestCount: requests.length,
        totalCost,
      });

      return totalCost;
    } catch (error) {
      openRouterUtils.error("Error calculating total cost", {
        error,
        requests,
      });
      throw error;
    }
  }

  /**
   * Calculate cost breakdown by model
   * @param {Array} requests - Array of request objects with model, promptTokens, and completionTokens
   * @returns {Object} Cost breakdown by model
   */
  calculateCostBreakdown(requests) {
    try {
      const breakdown = {};

      requests.forEach((request) => {
        if (this.isFreeModel(request.model, request.model)) {
          // Track free models separately
          breakdown[request.model] = breakdown[request.model] || {
            cost: 0,
            promptTokens: 0,
            completionTokens: 0,
            requestCount: 0,
            isFree: true,
          };

          breakdown[request.model].promptTokens += request.promptTokens || 0;
          breakdown[request.model].completionTokens +=
            request.completionTokens || 0;
          breakdown[request.model].requestCount += 1;
        } else {
          // Calculate cost for paid models
          const cost = this.calculateRequestCost(
            request.model,
            request.promptTokens,
            request.completionTokens,
            request.cacheDiscount || 0
          );

          breakdown[request.model] = breakdown[request.model] || {
            cost: 0,
            promptTokens: 0,
            completionTokens: 0,
            requestCount: 0,
            isFree: false,
          };

          breakdown[request.model].cost += cost;
          breakdown[request.model].promptTokens += request.promptTokens || 0;
          breakdown[request.model].completionTokens +=
            request.completionTokens || 0;
          breakdown[request.model].requestCount += 1;
        }
      });

      // Add formatted costs
      Object.keys(breakdown).forEach((model) => {
        if (!breakdown[model].isFree) {
          breakdown[model].formattedCost = this.formatCost(
            breakdown[model].cost
          );
        } else {
          breakdown[model].formattedCost = "Free";
        }
      });

      openRouterUtils.debug("Calculated cost breakdown", { breakdown });

      return breakdown;
    } catch (error) {
      openRouterUtils.error("Error calculating cost breakdown", {
        error,
        requests,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const openRouterCost = new OpenRouterCost();
