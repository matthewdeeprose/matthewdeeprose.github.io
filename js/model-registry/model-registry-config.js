/**
 * @fileoverview Configuration constants for the model registry system.
 * Provides default values, constraints, and configuration options.
 */

/**
 * Default configuration values for the model registry
 */
export const DEFAULT_CONFIG = {
  /**
   * Default parameter constraints
   */
  parameterConstraints: {
    temperature: { min: 0, max: 2, step: 0.1, default: 0.7 },
    top_p: { min: 0, max: 1, step: 0.05, default: 0.9 },
    top_k: { min: 0, max: 100, step: 1, default: 40 },
    presence_penalty: { min: -2, max: 2, step: 0.1, default: 0 },
    frequency_penalty: { min: -2, max: 2, step: 0.1, default: 0 },
    repetition_penalty: { min: 0, max: 2, step: 0.1, default: 1 },
    min_p: { min: 0, max: 1, step: 0.05, default: 0.05 },
  },

  /**
   * Default model configuration
   */
  defaultModelConfig: {
    disabled: false,
    isFree: false,
    isDefault: false,
    capabilities: [],
    maxContext: 4096,
    parameterSupport: {
      supported: [],
      statistics: {},
      features: [],
    },
    status: {
      isAvailable: true,
      lastCheck: null,
      errorCode: null,
      errorMessage: null,
    },
    accessibility: {
      preferredFor: [],
      warnings: [],
      ariaLabels: {},
    },
    metadata: {},
  },

  /**
   * Default category configuration
   */
  defaultCategoryConfig: {
    priority: 0,
    metadata: {
      displayOrder: null,
      groupingStrategy: "alphabetical",
      accessibilityNotes: null,
    },
  },

  /**
   * Required fields for model configuration
   */
  requiredModelFields: [
    "provider",
    "name",
    "category",
    "description",
    "capabilities",
  ],

  /**
   * Required fields for category configuration
   */
  requiredCategoryFields: ["name"],

  /**
   * Default ARIA labels for policy links
   */
  policyAriaLabels: {
    privacyPolicy: "Privacy Policy",
    acceptableUse: "Acceptable Use Policy",
    termsOfService: "Terms of Service",
    updated: "Last Updated",
  },
};

/**
 * Model capability types
 */
export const CAPABILITIES = {
  TEXT_GENERATION: "text-generation",
  CHAT: "chat",
  EMBEDDINGS: "embeddings",
  IMAGE_GENERATION: "image-generation",
  CODE_GENERATION: "code-generation",
  CODE_COMPLETION: "code-completion",
  FUNCTION_CALLING: "function-calling",
  TOOL_USE: "tool-use",
  VISION: "vision",
  AUDIO_TRANSCRIPTION: "audio-transcription",
  AUDIO_GENERATION: "audio-generation",
};

/**
 * Model parameter features
 */
export const PARAMETER_FEATURES = {
  TEMPERATURE: "temperature",
  TOP_P: "top_p",
  TOP_K: "top_k",
  PRESENCE_PENALTY: "presence_penalty",
  FREQUENCY_PENALTY: "frequency_penalty",
  REPETITION_PENALTY: "repetition_penalty",
  MIN_P: "min_p",
  STOP_SEQUENCES: "stop_sequences",
  MAX_TOKENS: "max_tokens",
  SEED: "seed",
};

/**
 * Model status codes
 */
export const STATUS_CODES = {
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  MAINTENANCE: "maintenance",
  DEPRECATED: "deprecated",
  RATE_LIMITED: "rate_limited",
  QUOTA_EXCEEDED: "quota_exceeded",
  UNKNOWN: "unknown",
};

/**
 * Accessibility preference categories
 */
export const ACCESSIBILITY_PREFERENCES = {
  SCREEN_READER: "screen-reader",
  KEYBOARD_NAVIGATION: "keyboard-navigation",
  COGNITIVE: "cognitive-assistance",
  LOW_VISION: "low-vision",
  MOTOR: "motor-assistance",
  HEARING: "hearing-assistance",
};

/**
 * Event types for the model registry
 */
export const EVENT_TYPES = {
  MODEL_REGISTERED: "model-registered",
  MODEL_UPDATED: "model-updated",
  MODEL_REMOVED: "model-removed",
  CATEGORY_REGISTERED: "category-registered",
  CATEGORY_UPDATED: "category-updated",
  CATEGORY_REMOVED: "category-removed",
  FALLBACK_UPDATED: "fallback-updated",
  STATUS_CHANGED: "status-changed",
  PARAMETER_DEFAULTS_UPDATED: "parameter-defaults-updated",
};
