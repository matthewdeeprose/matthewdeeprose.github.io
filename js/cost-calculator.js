/**
 * Cost Calculator Module
 *
 * Handles all cost-related calculations and formatting for API transactions.
 * Provides precise cost calculations based on input/output tokens, supports
 * cache-based discounts, and offers detailed cost breakdowns. Integrates with
 * the configuration module to access model-specific pricing data and ensures
 * accurate financial tracking across the application.
 *
 * Key features:
 * - Token-based cost calculation for API models
 * - Currency formatting with 4-decimal precision
 * - Cache discount handling
 * - Detailed cost breakdown reporting
 */

import { CONFIG } from "./config.js";

// Logging configuration (at module level)
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

// Helper functions for logging
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

/**
 * Formats a cost value to a user-friendly string with currency symbol
 * @param {number} cost - The cost to format
 * @returns {string} Formatted cost string (e.g. "$0.0492")
 */
export function formatCost(cost) {
  // Return "Free" when cost is 0
  if (cost === 0) {
    logDebug("Cost formatting: returning 'Free' for zero cost");
    return "Free";
  }

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 10,
  }).format(cost);

  logDebug(`Cost formatting: ${cost} formatted as ${formatted}`);
  return formatted;
}

/**
 * Calculates the total cost for an API transaction
 * @param {string} modelId - The model identifier
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @param {number} [cacheDiscount=0] - Discount factor for cached responses (0-1)
 * @returns {number} Total cost in USD
 * @throws {Error} If model not found or invalid parameters
 */
export function calculateCost(
  modelId,
  inputTokens,
  outputTokens,
  cacheDiscount = 0
) {
  logInfo(
    `Calculating cost for model: ${modelId}, input tokens: ${inputTokens}, output tokens: ${outputTokens}, cache discount: ${cacheDiscount}`
  );

  // Input validation
  if (
    !modelId ||
    inputTokens < 0 ||
    outputTokens < 0 ||
    cacheDiscount < 0 ||
    cacheDiscount > 1
  ) {
    logError("Invalid parameters provided to calculateCost", {
      modelId,
      inputTokens,
      outputTokens,
      cacheDiscount,
    });
    throw new Error("Invalid parameters provided to calculateCost");
  }

  // Get model costs
  const modelCosts = CONFIG.COSTS[modelId];
  logDebug("Cost calculation details:", {
    modelId,
    modelCosts,
    inputTokens,
    outputTokens,
    cacheDiscount,
    allCosts: CONFIG.COSTS,
  });

  if (!modelCosts) {
    logError(`Model ${modelId} not found in cost configuration`);
    throw new Error(`Model ${modelId} not found in cost configuration`);
  }

  // Check if it's a free model (both input and output costs are 0)
  if (modelCosts.input === 0 && modelCosts.output === 0) {
    logInfo(`Model ${modelId} is free - returning zero cost`);
    return 0;
  }

  // Calculate base costs per million tokens
  const inputCost = (inputTokens / 1_000_000) * modelCosts.input;
  const outputCost = (outputTokens / 1_000_000) * modelCosts.output;

  logDebug(
    `Base cost calculation: input cost ${inputCost}, output cost ${outputCost}`
  );

  // Apply cache discount if applicable
  const totalCost =
    cacheDiscount > 0
      ? inputCost * 0.5 * cacheDiscount + outputCost // Only input costs are discounted for cache hits
      : inputCost + outputCost;

  if (cacheDiscount > 0) {
    logInfo(
      `Applied cache discount of ${cacheDiscount} - total cost: ${totalCost}`
    );
  } else {
    logDebug(`No cache discount applied - total cost: ${totalCost}`);
  }

  return totalCost;
}

/**
 * Gets a detailed breakdown of costs for an API transaction
 * @param {string} modelId - The model identifier
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @param {number} [cacheDiscount=0] - Discount factor for cached responses (0-1)
 * @returns {Object} Detailed cost breakdown
 * @throws {Error} If model not found or invalid parameters
 */
export function getCostBreakdown(
  modelId,
  inputTokens,
  outputTokens,
  cacheDiscount = 0
) {
  logInfo(`Generating cost breakdown for model: ${modelId}`);

  // Get model costs
  const modelCosts = CONFIG.COSTS[modelId];
  if (!modelCosts) {
    logError(`Model ${modelId} not found in cost configuration`);
    throw new Error(`Model ${modelId} not found in cost configuration`);
  }

  // Calculate base input cost
  const baseInputCost = (inputTokens / 1_000_000) * modelCosts.input;

  // Calculate actual input cost after cache discount
  const actualInputCost =
    cacheDiscount > 0 ? baseInputCost * 0.5 * cacheDiscount : baseInputCost;

  // Calculate output cost
  const outputCost = (outputTokens / 1_000_000) * modelCosts.output;

  // Calculate total
  const totalCost = actualInputCost + outputCost;

  const breakdown = {
    model: modelId,
    inputTokens,
    outputTokens,
    cacheDiscount,
    breakdown: {
      baseInputCost: formatCost(baseInputCost),
      actualInputCost: formatCost(actualInputCost),
      outputCost: formatCost(outputCost),
      cacheSavings: formatCost(baseInputCost - actualInputCost),
    },
    totalCost: formatCost(totalCost),
    rawTotalCost: totalCost, // Unformatted for calculations
  };

  logDebug("Cost breakdown generated:", breakdown);

  return breakdown;
}
