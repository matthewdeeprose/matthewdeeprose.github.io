/**
 * @fileoverview Token Counter Default Configuration
 * Provides default settings and constants for the token counter system.
 */

/**
 * Default configuration settings for the token counter system
 * @type {Object}
 */
export const DEFAULT_CONFIG = {
  /**
   * Debug settings
   */
  debug: {
    enabled: false,
    logLevel: "info",
    includeTrace: true,
  },

  /**
   * Token estimation constants
   */
  estimation: {
    // Base system overhead (varies by model but typically 10-15 tokens)
    baseSystemOverhead: 15,

    // Role-specific token counts
    roleTokens: {
      system: 4,
      user: 4,
      assistant: 4,
      default: 3,
    },

    // Word length multipliers for token estimation
    wordMultipliers: {
      short: 1, // <= 2 chars
      medium: 1.2, // <= 4 chars
      long: 2, // <= 8 chars
      default: 3, // > 8 chars (divided by this number)
    },

    // Special content overhead tokens
    specialContent: {
      codeBlock: 10,
      jsonSchema: 10,
      messageSeparator: 5,
    },
  },

  /**
   * Validation settings
   */
  validation: {
    // Threshold for token count variation warnings (20%)
    variationThreshold: 0.2,

    // Minimum tokens required for valid response
    minimumTokens: {
      prompt: 1,
      completion: 1,
    },
  },

  /**
   * System prompt settings
   */
  systemPrompt: {
    // Maximum allowed tokens as a fraction of model's max context
    maxContextRatio: 0.25, // 25% of max context

    // Default max context if model info unavailable
    defaultMaxContext: 4096,
  },

  /**
   * Request tracking settings
   */
  tracking: {
    // How long to keep request history (in milliseconds)
    historyRetention: 24 * 60 * 60 * 1000, // 24 hours

    // Maximum number of attempts to track per request
    maxAttemptsPerRequest: 100,
  },

  /**
   * Performance thresholds
   */
  performance: {
    // Token efficiency thresholds
    efficiency: {
      excellent: 95, // 95% or higher
      good: 80, // 80-94%
      fair: 60, // 60-79%
      poor: 40, // Below 60%
    },
  },
};

/**
 * Error codes for token counter operations
 * @type {Object}
 */
export const ERROR_CODES = {
  INITIALIZATION: "INITIALIZATION_ERROR",
  VALIDATION: "VALIDATION_ERROR",
  ESTIMATION: "ESTIMATION_ERROR",
  TRACKING: "TRACKING_ERROR",
  REQUEST_ID: "REQUEST_ID_ERROR",
  SYSTEM_PROMPT: "SYSTEM_PROMPT_ERROR",
};

/**
 * Event types for token counter system
 * @type {Object}
 */
export const EVENT_TYPES = {
  REQUEST_INITIALIZED: "request_initialized",
  ATTEMPT_RECORDED: "attempt_recorded",
  MODEL_CHANGED: "model_changed",
  METRICS_RESET: "metrics_reset",
  VALIDATION_FAILED: "validation_failed",
  SYSTEM_PROMPT_TRACKED: "system_prompt_tracked",
};
