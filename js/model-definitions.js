// js/model-definitions.js
import { modelRegistry } from "./model-registry/model-registry-index.js";

// Register categories with priorities
modelRegistry.registerCategory("GeneralPurpose", {
  name: "General Purpose",
  description: "Models suitable for a wide range of tasks",
  priority: 100,
});

modelRegistry.registerCategory("FreeTier", {
  name: "Free Tier",
  description: "No-cost options with various capabilities",
  priority: 90,
});

modelRegistry.registerCategory("Vision", {
  name: "Vision Models",
  description: "Specialized for image analysis",
  priority: 80,
});

modelRegistry.registerCategory("Code", {
  name: "Code & Technical",
  description: "Optimized for code and technical content",
  priority: 70,
});

modelRegistry.registerCategory("LargeContext", {
  name: "Large Context",
  description: "Models supporting extended context windows",
  priority: 60,
});

modelRegistry.registerCategory("Specialized", {
  name: "Specialized",
  description: "Models optimized for specific use cases",
  priority: 50,
});

// Register General Purpose models
modelRegistry.registerModel("anthropic/claude-3.7-sonnet", {
  provider: "anthropic",
  name: "Claude 3.7 Sonnet",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Claude 3.7 Sonnet is an advanced large language model with improved reasoning, coding, and problem-solving capabilities. It introduces a hybrid reasoning approach, allowing users to choose between rapid responses and extended, step-by-step processing for complex tasks.",
  costs: {
    input: 3.0, // $3.0/M tokens
    output: 15.0, // $15.0/M tokens
    image: 4.8, // $4.8/K input images
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "tool_calling",
    "multilingual",
    "problem_solving",
    "agentic_workflows",
    "extended_thinking",
    "image",
  ],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3.5-haiku", // Fallback to a more economical Claude model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with hybrid processing capabilities",
    releaseDate: "2025-02-24",
    policyLinks: {
      privacyPolicy: "https://www.anthropic.com/legal/privacy",
      acceptableUse: "https://www.anthropic.com/legal/aup",
      termsOfService: "https://www.anthropic.com/legal/consumer-terms",
      lastUpdated: "2025-02-24",
    },
    bestFor: [
      "complex reasoning tasks",
      "full-stack coding",
      "agentic workflows",
      "multi-step problem solving",
      "mathematical calculations",
      "instruction-following",
    ],
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "include_reasoning",
      "top_k",
      "stop",
      "system-prompt", // Added as requested with hyphen
    ],
    features: ["include_reasoning", "tool_calling", "extended_thinking"],
  },
  accessibility: {
    preferredFor: [
      "complex-problem-solving",
      "code-generation",
      "step-by-step-reasoning",
      "agent-workflows",
    ],
    warnings: [
      "Extended thinking mode may require additional UI feedback for accessibility users",
      "Consider providing progress indicators during extended reasoning",
    ],
    ariaLabels: {
      modelSelect:
        "Claude 3.7 Sonnet - Advanced reasoning model with hybrid processing",
      parameterSection: "Parameter controls for Claude 3.7 Sonnet model",
      statusMessages: {
        processing:
          "Processing with Claude 3.7 Sonnet, this may take a moment for complex tasks",
        complete: "Claude 3.7 Sonnet response complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("meta-llama/llama-3.3-70b-instruct", {
  provider: "meta",
  name: "Llama 3.3 70B Instruct",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "High-performance multilingual model with strong domain expertise",
  costs: {
    input: 0.12,
    output: 0.3,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "finance",
    "academic",
    "technology",
    "science",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar performance characteristics
  isFree: false,
  metadata: {
    categoryDescription:
      "Enterprise-grade multilingual model with domain expertise",
    modelArchitecture: {
      parameters: "70B",
      type: "instruction-tuned",
      generation: "3.3",
    },
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/privacy",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-20",
    },
    languageSupport: [
      "english",
      "german",
      "french",
      "italian",
      "portuguese",
      "hindi",
      "spanish",
      "thai",
    ],
    domainExpertise: {
      finance: 5, // Rating out of 10
      academia: 5,
      technology: 7,
      science: 10,
    },
    bestFor: [
      "multilingual applications",
      "scientific research",
      "technical documentation",
      "financial analysis",
      "academic writing",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "devanagari", "thai"],
    },
  },
  // New parameter support data
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "response_format",
      "repetition_penalty",
      "top_k",
      "min_p",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 1,
        p90: 1.1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
    features: ["structured_outputs", "response_format", "logprobs"],
  },
  // Status tracking (new)
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("anthropic/claude-3.5-haiku", {
  provider: "anthropic",
  name: "Claude 3.5 Haiku",
  category: "GeneralPurpose",
  disabled: false,
  isDefault: false,
  description:
    "Claude 3.5 Haiku features rapid response times and improved capabilities across coding, tool use, and reasoning. Optimized for high interactivity and low latency applications.",
  costs: {
    input: 0.8, // $0.8/M tokens
    output: 4.0, // $4.0/M tokens
  },
  capabilities: [
    "text",
    "code",
    "tool_calling",
    "reasoning",
    "data_extraction",
    "content_moderation",
    "low_latency",
    "function_calling",
  ],
  maxContext: 200000,
  fallbackTo: "meta-llama/llama-3.2-3b-instruct:free", // Fallback to free model
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance model optimized for speed and efficiency",
    releaseDate: "2024-10-22",
    benchmarks: {
      "SWE-bench": "40.6% Verified",
    },
    policyLinks: {
      privacyPolicy: "https://www.anthropic.com/legal/privacy",
      acceptableUse: "https://www.anthropic.com/legal/aup",
      termsOfService: "https://www.anthropic.com/legal/consumer-terms",
      lastUpdated: "2024-11-04",
    },
    bestFor: [
      "user-facing products",
      "specialized sub-agent tasks",
      "real-time content moderation",
      "data extraction",
      "coding tasks",
      "high-interactivity applications",
    ],
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "system-prompt", // Added as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1,
      },
      top_p: {
        p10: 0.95,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "real-time-assistance",
      "interactive-applications",
      "code-documentation",
      "content-moderation",
    ],
    warnings: [
      "Consider response speed when setting up screen reader announcements",
      "Ensure proper feedback for rapid interactions",
    ],
    ariaLabels: {
      modelSelect: "Claude 3.5 Haiku - Fast, efficient general-purpose model",
      parameterSection: "Parameter controls for Claude 3.5 Haiku model",
      statusMessages: {
        processing: "Processing request with high-speed model",
        complete: "Response ready from high-speed model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("anthropic/claude-3-opus", {
  provider: "anthropic",
  name: "Claude 3 Opus",
  category: "GeneralPurpose",
  disabled: true,
  description: "Best quality, highest cost model with extensive capabilities",
  costs: { input: 15.0, output: 75.0 },
  capabilities: ["text", "code", "analysis", "vision"],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3-sonnet",
  isFree: false,
  metadata: {
    categoryDescription: "Premium tier model with highest capabilities",
    modelType: "Large multimodal model",
    releaseDate: "2024-03",
    recommendedUses: [
      "Complex analysis",
      "Advanced reasoning",
      "Image understanding",
      "Code generation",
      "Technical writing",
    ],
    policyLinks: {
      privacyPolicy: "https://www.anthropic.com/legal/privacy",
      acceptableUse: "https://www.anthropic.com/legal/aup",
      termsOfService: "https://www.anthropic.com/legal/consumer-terms",
      lastUpdated: "2025-01-20",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "system-prompt",
    ],
    statistics: {
      temperature: {
        p10: 0.2,
        p50: 0.9,
        p90: 1.0,
        recommended: 0.9,
        description: "Controls response creativity and variability",
      },
      top_p: {
        p10: 0.92,
        p50: 1.0,
        p90: 1.0,
        recommended: 1.0,
        description: "Controls token selection probability threshold",
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 41,
        recommended: 0,
        description: "Limits number of tokens considered for generation",
      },
      frequency_penalty: {
        p10: 0,
        p50: 0.7,
        p90: 1.0,
        recommended: 0.7,
        description: "Reduces repetition based on token frequency",
      },
      presence_penalty: {
        p10: 0,
        p50: 0.7,
        p90: 1.1,
        recommended: 0.7,
        description: "Reduces repetition based on token presence",
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.0,
        p90: 1.0,
        recommended: 1.0,
        description: "Controls direct repetition prevention",
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.02,
        recommended: 0,
        description: "Minimum probability threshold for token selection",
      },
    },
    features: ["tool_calling", "structured_output", "vision_analysis"],
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
  accessibility: {
    preferredFor: [
      "complex-tasks",
      "multimodal-analysis",
      "technical-documentation",
    ],
    ariaLabels: {
      modelSelect:
        "Claude 3 Opus - Premium multimodal model with highest capabilities",
      parameterControls:
        "Parameter controls for Claude 3 Opus - adjust for optimal performance",
    },
    warnings: [
      "High cost model - consider fallback for less demanding tasks",
      "Parameter adjustments may significantly impact cost and performance",
    ],
  },
});
modelRegistry.registerModel("microsoft/phi-4", {
  provider: "microsoft",
  name: "Phi-4",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "14B parameter model optimized for efficient reasoning with limited resources",
  costs: { input: 0.07, output: 0.14 },
  capabilities: ["text", "reasoning", "academic"],
  maxContext: 16384,
  fallbackTo: "meta-llama/llama-3.2-3b-instruct:free",
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient general-purpose model with strong reasoning capabilities",
    parameterCount: "14B",
    languageSupport: ["english"],
    trainingFocus: ["synthetic", "academic", "curated web"],
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/privacy",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-20",
    },
    bestFor: [
      "reasoning",
      "memory-constrained environments",
      "quick responses",
    ],
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "system-prompt",
    ],
    statistics: {
      temperature: {
        p10: 0,
        p50: 0,
        p90: 1,
        defaultValue: 0, // Using p50 as default
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
        defaultValue: 1,
      },
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
        defaultValue: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
        defaultValue: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
        defaultValue: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
        defaultValue: 0,
      },
    },
    features: ["response_format", "stop_sequences"],
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
  accessibility: {
    preferredFor: ["academic-writing", "logical-analysis", "quick-responses"],
    warnings: [],
    ariaLabels: {
      modelSelect: "Phi-4: Efficient reasoning model with 14B parameters",
      parameterSection: "Parameter controls for Phi-4 model",
    },
  },
});

modelRegistry.registerModel("x-ai/grok-vision-beta", {
  provider: "xAI",
  name: "Grok Vision Beta",
  category: "Vision", // Using existing Vision category
  disabled: false,
  description:
    "Grok Vision Beta is xAI's experimental language model with vision capability.",
  costs: {
    input: 5.0, // $5/M tokens
    output: 15.0, // $15/M tokens
    image: 9.0, // $9/K images
  },
  capabilities: ["vision", "text", "multimodal"],
  maxContext: 8192,
  fallbackTo: "meta-llama/llama-3.2-90b-vision-instruct:free", // Similar vision model
  isFree: false,
  metadata: {
    categoryDescription: "Vision models supporting image analysis capabilities",
    releaseDate: "2024-11-19",
    policyLinks: {
      privacyPolicy: "", // Not provided
      acceptableUse: "", // Not provided
      termsOfService: "", // Not provided
      lastUpdated: "2024-11-19",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "response_format",
      "system-prompt", // Added system-prompt support
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "image-description",
      "visual-content-analysis",
      "visual-question-answering",
    ],
    warnings: [
      "Consider processing time for large images",
      "Ensure alt text is provided for all images",
    ],
    ariaLabels: {
      modelSelect: "Grok Vision Beta - Experimental multimodal vision model",
      parameterSection: "Parameter controls for Grok Vision Beta model",
      imageProcessing: "Processing image, please wait for analysis",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Find the Google models section, typically after other Google models like google/gemini-2.0-flash-001
// Insert new content here:

modelRegistry.registerModel("google/gemini-pro-vision", {
  provider: "google",
  name: "Gemini Pro Vision 1.0",
  category: "Vision", // Using our Vision category for multimodal models
  disabled: false,
  description:
    "Google's flagship multimodal model, supporting image and video in text or chat prompts for a text or code response.",
  costs: {
    input: 0.5, // $0.5/M tokens
    output: 1.5, // $1.5/M tokens
    image: 2.5, // $2.5/K images
  },
  capabilities: ["text", "vision", "video", "multimodal", "code", "chat"],
  maxContext: 16384,
  fallbackTo: "meta-llama/llama-3.2-90b-vision-instruct:free", // Similar vision capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal vision models for complex visual analysis",
    releaseDate: "2023-12-13",
    policyLinks: {
      privacyPolicy: "https://cloud.google.com/terms/cloud-privacy-notice",
      acceptableUse: "",
      termsOfService: "https://cloud.google.com/terms",
      lastUpdated: "2023-12-13",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "system-prompt", // Adding system-prompt support
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 1,
        p50: 1,
        p90: 1.06,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 36,
      },
      top_p: {
        p10: 0.82,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "image-description-generation",
      "visual-content-analysis",
      "video-understanding",
      "alt-text-generation",
    ],
    warnings: [
      "Consider processing time for large images or videos",
      "Ensure proper error handling for image processing failures",
    ],
    ariaLabels: {
      modelSelect: "Gemini Pro Vision - Advanced multimodal vision model",
      parameterSection: "Parameter controls for Gemini Pro Vision model",
      statusMessages: {
        processing: "Processing visual content, please wait",
        complete: "Visual analysis complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("amazon/nova-lite-v1", {
  provider: "amazon",
  name: "Nova Lite 1.0",
  category: "Vision",
  disabled: false,
  description:
    "Low-cost multimodal model for efficient processing of images, video, and text",
  costs: {
    input: 0.06,
    output: 0.24,
    image: 0.09, // per 1000 images
  },
  capabilities: ["text", "vision", "video", "document-analysis", "real-time"],
  maxContext: 300000,
  fallbackTo: "meta-llama/llama-3.2-90b-vision-instruct:free",
  isFree: false,
  metadata: {
    categoryDescription:
      "Cost-effective multimodal model for vision and text processing",
    multimodalSupport: {
      images: true,
      video: true,
      videoDuration: "30 minutes",
      imagesPerRequest: "multiple",
    },
    policyLinks: {
      privacyPolicy:
        "https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html",
      acceptableUse:
        "https://docs.aws.amazon.com/nova/latest/userguide/responsible-use.html",
      termsOfService:
        "https://docs.aws.amazon.com/nova/latest/userguide/responsible-use.html",
      lastUpdated: "2025-01-20",
    },
    bestFor: [
      "visual question-answering",
      "document analysis",
      "customer interactions",
      "real-time processing",
    ],
    contextFeatures: {
      maxTokens: 300000,
      mediaHandling: "concurrent",
    },
  },
  // New parameter support data
  parameterSupport: {
    supported: [
      "tools",
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "system-prompt",
    ],
    statistics: {
      temperature: {
        p10: 0.01,
        p50: 0.7,
        p90: 0.8,
        recommended: 0.7,
      },
      top_p: {
        p10: 1.0,
        p50: 1.0,
        p90: 1.0,
        recommended: 1.0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
        recommended: 0,
      },
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
        recommended: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
        recommended: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
        recommended: 1,
      },
    },
    features: ["tool_support", "multimodal_input", "vision_analysis"],
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
  accessibility: {
    preferredFor: [
      "visual-impairment-assistance",
      "document-accessibility-analysis",
      "real-time-image-description",
    ],
    warnings: [],
    ariaLabels: {
      modelSelector:
        "Nova Lite 1.0 - Multimodal vision and text processing model",
      featureList:
        "Supports images, video up to 30 minutes, and document analysis",
    },
  },
});
modelRegistry.registerModel("anthropic/claude-3.5-sonnet", {
  provider: "anthropic",
  name: "Claude 3.5 Sonnet",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Balanced performance and cost with strong capabilities in text, code, and analysis",
  costs: { input: 3.0, output: 15.0 },
  capabilities: [
    "text",
    "code",
    "analysis",
    "tool_calling",
    "function_calling",
    "multilingual",
    "contextual_reasoning",
  ],
  maxContext: 100000,
  fallbackTo: "openai/o1-mini",
  isDefault: false,
  isFree: false,
  responseFormatCapabilities: {
    // Type should be "anthropic" since it uses Claude-specific JSON handling
    type: "anthropic",

    // Features based on our test results
    features: {
      schemaValidation: true, // Can enforce schemas when specified
      strictMode: true, // Works best with strict schema enforcement
      requiresExample: true, // Needs schema example in system message
      supportsNesting: true, // Handles single-level nesting reliably
    },

    // Recommended settings from our testing
    recommendedSettings: {
      temperature: 0.7, // Balances reliability with flexibility
      requiresSystemMessage: true, // Needs system message with schema
      markdownStripping: false, // Doesn't add markdown that needs stripping
    },

    // Optional: Add specific configuration details
    optimalUsage: {
      systemMessage: "Return ONLY raw JSON. Schema: {exact schema example}",
      stopSequence: ["}"], // From test results
      tokenEfficiency: {
        systemMessageTokens: 40, // ~30-50 tokens
        basicResponseTokens: 30, // ~25-40 tokens
        complexResponseTokens: 100, // ~80-120 tokens
      },
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "system-prompt",
    ],
    statistics: {
      temperature: {
        p10: 0,
        p50: 0.9,
        p90: 1,
        defaultValue: 0.9,
        description: "Controls response creativity (0-1)",
      },
      top_p: {
        p10: 0.6,
        p50: 1,
        p90: 1,
        defaultValue: 1,
        description: "Controls token selection probability threshold",
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
        defaultValue: 0,
        description: "Limits token selection pool size",
      },
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
        defaultValue: 0,
        description: "Adjusts frequency-based token selection",
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
        defaultValue: 0,
        description: "Adjusts presence-based token selection",
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
        defaultValue: 1,
        description: "Controls token repetition penalty",
      },
    },
    features: ["tool_calling", "json_mode", "xml_mode", "stream_tokens"],
  },
  // Enhanced metadata
  metadata: {
    categoryDescription:
      "Enterprise-grade model with balanced performance and cost efficiency",
    recommendedUses: [
      "General text generation",
      "Code analysis and generation",
      "Data analysis",
      "Tool-augmented tasks",
      "Business applications",
    ],
    policyLinks: {
      privacyPolicy: "https://www.anthropic.com/legal/privacy",
      acceptableUse: "https://www.anthropic.com/legal/aup",
      termsOfService: "https://www.anthropic.com/legal/consumer-terms",
      lastUpdated: "2025-01-20",
    },
    modelArchitecture: {
      generation: "3.5",
      variant: "Sonnet",
      architecture: "Transformer-based",
    },
    performance: {
      latency: "optimized",
      throughput: "balanced",
      costEfficiency: "high",
    },
  },
  // Accessibility information
  accessibility: {
    preferredFor: [
      "screen-reader users",
      "keyboard-only users",
      "users requiring structured output",
    ],
    warnings: [
      "May require guidance for optimal parameter settings",
      "Consider using lower temperature for more predictable outputs",
    ],
    ariaLabels: {
      modelSelect:
        "Claude 3.5 Sonnet - Balanced performance general-purpose model",
      temperatureControl: "Adjust response creativity - default 0.9",
      topPControl: "Adjust response diversity - default 1.0",
    },
  },

  // Status tracking
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("google/gemini-flash-1.5", {
  provider: "google",
  name: "Gemini Flash 1.5",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "High-speed multimodal model optimized for cost-effective, high-volume processing",
  costs: {
    input: 0.075,
    output: 0.3,
    image: 0.04, // per 1000 images
  },
  capabilities: [
    "text",
    "vision",
    "audio",
    "video",
    "multimodal",
    "classification",
    "summarization",
    "content-generation",
    "technology",
    "trivia",
    "marketing",
    "health",
    "academic",
  ],
  maxContext: 1000000, // 1M tokens
  fallbackTo: "amazon/nova-lite-v1", // Similar multimodal capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance multimodal model for scalable applications",
    modelFeatures: {
      multimodalSupport: {
        images: true,
        audio: true,
        video: true,
        documents: true,
        infographics: true,
        screenshots: true,
      },
    },
    policyLinks: {
      privacyPolicy:
        "https://services.google.com/fh/files/misc/genai_privacy_google_cloud_202308.pdf",
      acceptableUse: "",
      termsOfService: "https://cloud.google.com/retail/data-use-terms?hl=en",
      lastUpdated: "2025-01-20",
    },
    domainExpertise: {
      technology: 1, // Rating out of 10
      trivia: 3,
      marketing: 3,
      health: 3,
      academia: 3,
    },
    performanceCharacteristics: {
      latency: "optimized",
      throughput: "high-volume",
      costEfficiency: "optimized",
      qualityParity: "comparable to Pro models",
    },
    bestFor: [
      "chat assistants",
      "content generation",
      "visual analysis",
      "high-volume processing",
      "latency-sensitive applications",
      "cost-optimized deployments",
    ],
    accessibility: {
      multimodalAnalysis: true,
      documentProcessing: true,
      imageUnderstanding: true,
      responsiveProcessing: true,
    },
    technicalNotes:
      "Designed for high-frequency, high-volume tasks with balanced quality and cost",
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "tools",
      "tool_choice",
      "seed",
      "response_format",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      temperature: {
        p10: 0,
        p50: 0.7,
        p90: 1.21,
      },
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 200,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
  },
});
modelRegistry.registerModel("openai/o1-mini", {
  provider: "openai",
  name: "O1 Mini",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Latest OpenAI model optimized for STEM tasks with enhanced reasoning capabilities",
  costs: {
    input: 3.0, // Updated to $3/M tokens
    output: 12.0, // Updated to $12/M tokens
  },
  capabilities: [
    "text",
    "analysis",
    "math",
    "science",
    "programming",
    "stem",
    "reasoning",
    "physics",
    "chemistry",
    "biology",
  ],
  maxContext: 128000, // Updated to correct context window
  fallbackTo: "google/gemini-2.0-flash-exp:free",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced STEM-focused models with enhanced reasoning capabilities",
    modelArchitecture: {
      family: "O1",
      version: "2024-09-12",
      type: "experimental",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/policies/privacy-policy/",
      acceptableUse: "",
      termsOfService:
        "https://help.openai.com/en/articles/6837156-terms-of-use",
      lastUpdated: "2025-01-20",
    },
    specialFeatures: {
      enhancedReasoning: true,
      advancedThinking: true,
      stemOptimized: true,
    },
    benchmarkPerformance: {
      expertise: "PhD-level",
      domains: ["physics", "chemistry", "biology"],
      accuracy: "consistently high",
    },
    bestFor: [
      "mathematical analysis",
      "scientific computation",
      "programming tasks",
      "STEM research",
      "academic writing",
    ],
    limitations: {
      experimental: true,
      rateLimited: true,
      productionUse: false,
    },
  },
  parameterSupport: {
    supported: [
      "seed",
      "max_tokens",
      "temperature",
      "top_p",
      "frequency_penalty",
      "presence_penalty",
      "logit_bias",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 0.7,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
    features: ["response_format", "structured_output"],
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
    experimentalStatus: "active",
  },
  accessibility: {
    preferredFor: [
      "scientific-documentation",
      "technical-writing",
      "mathematical-notation",
      "code-documentation",
    ],
    warnings: [
      "Experimental model - results may be inconsistent",
      "Rate limiting may affect response time",
      "Not recommended for production use",
    ],
    ariaLabels: {
      modelSelect:
        "O1 Mini - Experimental STEM-focused model with enhanced reasoning",
      parameterSection: "Parameter controls for O1 Mini model",
      statusMessages: {
        rateLimited: "Rate limit reached. Model access temporarily restricted.",
        processingMath:
          "Processing mathematical computation. This may take extra time for accuracy.",
      },
    },
  },
});
modelRegistry.registerModel("microsoft/phi-3-mini-128k-instruct", {
  provider: "Microsoft",
  name: "Phi-3 Mini 128K Instruct",
  category: "FreeTier",
  disabled: false,
  description:
    "Phi-3 Mini is a powerful 3.8B parameter model designed for advanced language understanding, reasoning, and instruction following. Optimized through supervised fine-tuning and preference adjustments, it excels in tasks involving common sense, mathematics, logical reasoning, and code processing. At time of release, Phi-3 Medium demonstrated state-of-the-art performance among lightweight models. This model is static, trained on an offline dataset with an October 2023 cutoff date.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "Language Understanding",
    "Reasoning",
    "Instruction Following",
    "Common Sense Reasoning",
    "Mathematics",
    "Logical Reasoning",
    "Code Processing",
  ],
  maxContext: 128000,
  fallbackTo: null,
  isFree: true,
  metadata: {
    categoryDescription:
      "Conversational AI models designed for interactive and responsive text-based interactions",
    parameterCount: 3800000000,
    trainingApproaches: ["Supervised Fine-Tuning", "Preference Adjustments"],
    datasetCutoff: "October 2023",
    modelType: "Static Offline-Trained Model",
    performanceNote: "State-of-the-art among lightweight models at release",
    policyLinks: {
      privacyPolicy: "https://www.microsoft.com/en-us/privacy/privacystatement",
      acceptableUse: "",
      termsOfService:
        "https://learn.microsoft.com/en-us/legal/microsoft-apis/terms-of-use",
      lastUpdated: "2025-01-20",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.01,
        p50: 0.01,
        p90: 0.01,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
});
modelRegistry.registerModel("openchat/openchat-7b", {
  provider: "OpenChat",
  name: "OpenChat 3.5 7B",
  category: "FreeTier",
  disabled: false,
  description:
    'OpenChat 7B is a library of open-source language models, fine-tuned with "C-RLFT (Conditioned Reinforcement Learning Fine-Tuning)" - a strategy inspired by offline reinforcement learning. It has been trained on mixed-quality data without preference labels. * For OpenChat fine-tuned on Mistral 7B, check out OpenChat 7B. * For OpenChat fine-tuned on Llama 8B, check out OpenChat 8B.',
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "Open-Source Language Modeling",
    "Reinforcement Learning Fine-Tuning",
    "Mixed-Quality Data Training",
  ],
  maxContext: 8192,
  fallbackTo: null,
  isFree: true,
  metadata: {
    categoryDescription:
      "Conversational AI models designed for interactive and responsive text-based interactions",
    parameterCount: 7000000000,
    trainingApproach: "C-RLFT (Conditioned Reinforcement Learning Fine-Tuning)",
    trainingCharacteristics: [
      "Offline Reinforcement Learning Inspired",
      "Mixed-Quality Data Training",
      "No Preference Labels",
    ],
    relatedModels: [
      "OpenChat 7B (Mistral 7B Fine-Tuned)",
      "OpenChat 8B (Llama 8B Fine-Tuned)",
    ],
    policyLinks: {
      privacyPolicy: "https://www.lepton.ai/policies/privacy",
      acceptableUse: "",
      termsOfService: "https://www.lepton.ai/policies/tos",
      lastUpdated: "2025-01-20",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "logit_bias",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.5, p50: 0.5, p90: 0.7 },
      top_a: { p10: 0, p50: 0, p90: 0 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 1, p50: 1, p90: 1 },
    },
  },
});
modelRegistry.registerModel("undi95/toppy-m-7b", {
  provider: "Undi95",
  name: "Toppy M 7B",
  category: "FreeTier",
  disabled: false,
  description:
    "A wild 7B parameter model that merges several models using the new task_arithmetic merge method from mergekit. List of merged models: NousResearch/Nous-Capybara-7B-V1.9, HuggingFaceH4/zephyr-7b-beta, lemonilia/AshhLimaRP-Mistral-7B, Vulkane/120-Days-of-Sodom-LoRA-Mistral-7b, Undi95/Mistral-pippa-sharegpt-7b-qlora. #merge #uncensored",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "Multi-Model Merging",
    "Diverse Conversational Abilities",
    "Flexible Language Modeling",
  ],
  maxContext: 4096,
  fallbackTo: null,
  isFree: true,
  metadata: {
    categoryDescription:
      "Conversational AI models designed for interactive and responsive text-based interactions",
    parameterCount: 7000000000,
    mergeMethod: "task_arithmetic",
    mergedModels: [
      "NousResearch/Nous-Capybara-7B-V1.9",
      "HuggingFaceH4/zephyr-7b-beta",
      "lemonilia/AshhLimaRP-Mistral-7B",
      "Vulkane/120-Days-of-Sodom-LoRA-Mistral-7b",
      "Undi95/Mistral-pippa-sharegpt-7b-qlora",
    ],
    policyLinks: {
      privacyPolicy: "https://www.lepton.ai/policies/privacy",
      acceptableUse: "",
      termsOfService: "https://www.lepton.ai/policies/tos",
      lastUpdated: "2025-01-20",
    },
    tags: ["merge", "uncensored"],
    toolUsed: "mergekit",
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "logit_bias",
      "top_k",
      "min_p",
      "seed",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.760000000000001,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.760000000000001,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.01,
        p50: 0.7,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.6,
        p50: 1,
        p90: 1,
      },
    },
  },
});
modelRegistry.registerModel("nousresearch/hermes-2-pro-llama-3-8b", {
  provider: "nousresearch",
  name: "Hermes 2 Pro (Llama-3 8B)",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Cost-effective model with strong function calling and JSON structuring capabilities",
  costs: {
    input: 0.025,
    output: 0.04,
  },
  capabilities: ["text", "function-calling", "json-mode", "structured-output"],
  maxContext: 131000,
  fallbackTo: "meta-llama/llama-3.2-3b-instruct:free",
  isFree: false,
  metadata: {
    categoryDescription:
      "Economy tier model with specialized structured output features",
    modelBase: {
      architecture: "Llama-3",
      parameters: "8B",
    },
    policyLinks: {
      privacyPolicy: "https://lambdalabs.com/legal/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://lambdalabs.com/legal/terms-of-service",
      lastUpdated: "2025-01-20",
    },
    specialFeatures: ["function calling", "JSON mode", "structured outputs"],
    trainingDetails: {
      baseDataset: "OpenHermes 2.5",
      customDatasets: ["Function Calling", "JSON Mode"],
      dataQuality: "cleaned and updated",
    },
    bestFor: [
      "API integrations",
      "structured data processing",
      "cost-effective deployments",
      "function calling workflows",
    ],
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "response_format",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.7,
        p50: 0.7,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
});
modelRegistry.registerModel("meta-llama/llama-3.2-3b-instruct", {
  provider: "Meta",
  name: "Llama 3.2 3B Instruct",
  category: "FreeTier",
  disabled: false,
  description:
    "Llama 3.2 3B is a 3-billion-parameter multilingual large language model, optimized for advanced natural language processing tasks like dialogue generation, reasoning, and summarization. Designed with the latest transformer architecture, it supports eight languages, including English, Spanish, and Hindi, and is adaptable for additional languages. Trained on 9 trillion tokens, the Llama 3.2 3B model excels in instruction-following, complex reasoning, and tool use. Its balanced performance makes it ideal for applications needing accuracy and efficiency in text generation across multilingual settings.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "Dialogue Generation",
    "Reasoning",
    "Summarization",
    "Multilingual Support",
    "Instruction Following",
    "Tool Use",
  ],
  maxContext: 4096,
  fallbackTo: null,
  isFree: true,
  metadata: {
    categoryDescription:
      "Conversational AI models designed for interactive and responsive text-based interactions",
    languages: ["English", "Spanish", "Hindi", "Five Additional Languages"],
    trainingTokens: 9000000000000,
    parameterCount: 3000000000,
    policyLinks: {
      privacyPolicy: "https://sambanova.ai/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://sambanova.ai/terms-and-conditions",
      lastUpdated: "2025-01-20",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "response_format",
      "repetition_penalty",
      "top_k",
      "min_p",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.5,
        p50: 1,
        p90: 1,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
  },
});
modelRegistry.registerModel("meta-llama/llama-3.2-1b-instruct", {
  provider: "Meta",
  name: "Llama 3.2 1B Instruct",
  category: "FreeTier",
  disabled: false,
  description:
    "Llama 3.2 1B is a 1-billion-parameter language model focused on efficiently performing natural language tasks, such as summarization, dialogue, and multilingual text analysis. Its smaller size allows it to operate efficiently in low-resource environments while maintaining strong task performance. Supporting eight core languages and fine-tunable for more, Llama 1.3B is ideal for businesses or developers seeking lightweight yet powerful AI solutions that can operate in diverse multilingual settings without the high computational demand of larger models.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "Summarization",
    "Dialogue",
    "Multilingual Text Analysis",
    "Low-Resource Environment Processing",
    "Fine-Tuning",
  ],
  maxContext: 4096,
  fallbackTo: null,
  isFree: true,
  metadata: {
    categoryDescription:
      "Conversational AI models designed for interactive and responsive text-based interactions",
    languages: ["Eight Core Languages (Expandable)"],
    parameterCount: 1000000000,
    policyLinks: {
      privacyPolicy: "https://www.lepton.ai/policies/privacy",
      acceptableUse: "",
      termsOfService: "https://www.lepton.ai/policies/tos",
      lastUpdated: "2025-01-20",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "logit_bias",
      "top_k",
      "min_p",
      "seed",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
  },
});
modelRegistry.registerModel("qwen/qwen-2-7b-instruct", {
  provider: "Qwen",
  name: "Qwen 2 7B Instruct",
  category: "FreeTier",
  disabled: true,
  description:
    "Qwen2 7B is a transformer-based model that excels in language understanding, multilingual capabilities, coding, mathematics, and reasoning. It features SwiGLU activation, attention QKV bias, and group query attention. It is pretrained on extensive data with supervised finetuning and direct preference optimization.",
  costs: {
    input: 0.054,
    output: 0.054,
  },
  capabilities: [
    "Language Understanding",
    "Multilingual Support",
    "Coding",
    "Mathematics",
    "Reasoning",
  ],
  maxContext: 8192,
  fallbackTo: null,
  isFree: true,
  metadata: {
    categoryDescription:
      "Conversational AI models designed for interactive and responsive text-based interactions",
    architectureDetails: [
      "SwiGLU Activation",
      "Attention QKV Bias",
      "Group Query Attention",
    ],
    trainingApproaches: [
      "Supervised Fine-Tuning",
      "Direct Preference Optimization",
    ],
    parameterCount: 7000000000,
    policyLinks: {
      privacyPolicy: "https://novita.ai/legal/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://novita.ai/legal/terms-of-service",
      lastUpdated: "2025-01-20",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.4,
        p90: 0.7,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
});
modelRegistry.registerModel("mistralai/mistral-7b-instruct", {
  provider: "Mistral",
  name: "Mistral 7B Instruct",
  category: "FreeTier",
  disabled: false,
  description:
    "A high-performing, industry-standard 7.3B parameter model, with optimizations for speed and context length. Mistral 7B Instruct has multiple version variants, and this is intended to be the latest version.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "High-Performance Language Processing",
    "Optimized Speed",
    "Extended Context Handling",
  ],
  maxContext: 8192,
  fallbackTo: null,
  isFree: true,
  metadata: {
    categoryDescription:
      "Conversational AI models designed for interactive and responsive text-based interactions",
    parameterCount: 7300000000,
    versionNote: "Latest version of Mistral 7B Instruct model",
    optimizationFeatures: ["Speed Optimization", "Extended Context Length"],
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-20",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "logit_bias",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 0.2,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
  },
});
modelRegistry.registerModel("amazon/nova-pro-v1", {
  provider: "amazon",
  name: "Nova Pro 1.0",
  category: "Vision", // Using Vision category since it's a multimodal image model
  disabled: false,
  description:
    "Amazon Nova Pro 1.0 is a capable multimodal model from Amazon focused on providing a combination of accuracy, speed, and cost for a wide range of tasks. As of December 2024, it achieves state-of-the-art performance on key benchmarks including visual question answering (TextVQA) and video understanding (VATEX).",
  costs: {
    input: 0.8, // $0.8/M tokens
    output: 3.2, // $3.2/M tokens
    image: 1.2, // $1.2/K images
  },
  capabilities: [
    "text",
    "vision",
    "visual-qa",
    "document-analysis",
    "financial-documents",
    "multimodal",
  ],
  maxContext: 300000, // 300K context window
  fallbackTo: "meta-llama/llama-3.2-90b-vision-instruct:free", // Similar vision capability
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal vision models for complex visual analysis",
    releaseDate: "2024-12-05",
    policyLinks: {
      privacyPolicy:
        "https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html",
      acceptableUse: "",
      termsOfService:
        "https://docs.aws.amazon.com/bedrock/latest/userguide/responsible-use.html",
      lastUpdated: "2024-12-05",
    },
    bestFor: [
      "visual question answering",
      "document analysis",
      "financial document processing",
      "multimodal tasks",
    ],
  },
  parameterSupport: {
    supported: [
      "tools",
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "system-prompt", // Added system-prompt support
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 1.3,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 1.2,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1.1,
      },
      temperature: {
        p10: 0.01,
        p50: 0.75,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.745,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "visual-impairment-assistance",
      "document-accessibility-analysis",
      "financial-document-processing",
      "image-content-description",
    ],
    warnings: [
      "Consider processing time for complex documents",
      "Video processing not supported",
    ],
    ariaLabels: {
      modelSelect:
        "Nova Pro 1.0 - Advanced multimodal model for visual and document analysis",
      parameterSection: "Parameter controls for Nova Pro model",
      statusMessages: {
        processing:
          "Processing image or document, please wait for detailed analysis",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("mistralai/pixtral-12b", {
  provider: "mistralai",
  name: "Pixtral 12B",
  category: "Vision",
  disabled: false,
  description:
    "A high-performance multimodal model from Mistral AI that excels at instruction following while maintaining strong text capabilities. Features variable image size support, native multimodal training, and strong performance on visual reasoning tasks.",
  costs: {
    input: 0.1, // $0.1/M tokens
    output: 0.1, // $0.1/M tokens
    image: 0.1445, // $0.1445/K images
  },
  capabilities: [
    "vision",
    "text",
    "multimodal",
    "document-analysis",
    "chart-understanding",
    "visual-reasoning",
    "instruction-following",
    "coding",
    "math",
    "variable-image-size",
  ],
  maxContext: 128000, // 128K tokens as specified
  fallbackTo: "meta-llama/llama-3.2-90b-vision-instruct:free", // Fallback to free vision model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal vision models for complex visual analysis",
    modelArchitecture: {
      visionEncoder: "400M parameters",
      multimodalDecoder: "12B parameters",
      baseModel: "Mistral Nemo",
      release: "2024-09-10",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/terms/#privacy-policy",
      acceptableUse: "",
      termsOfService: "https://mistral.ai/terms/#terms-of-use",
      lastUpdated: "2024-09-10",
    },
    license: "Apache 2.0",
    benchmarks: {
      MMMU: "52.5%",
      MMBench: "Competitive with larger models",
    },
    imageCapabilities: {
      variableSize: true,
      aspectRatio: "flexible",
      multipleImages: true,
      patchSize: "16x16",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "logprobs",
      "top_logprobs",
      "seed",
      "logit_bias",
      "top_k",
      "min_p",
      "repetition_penalty",
      "tools",
      "tool_choice",
      "response_format",
      "system-prompt", // Added system-prompt support
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.9,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "image-description-generation",
      "document-accessibility-analysis",
      "chart-interpretation",
      "visual-content-explanation",
      "high-resolution-image-analysis",
    ],
    warnings: [
      "Complex diagrams may require additional processing time",
      "Consider image size impact on token usage",
      "Multiple images will affect context window availability",
    ],
    ariaLabels: {
      modelSelect: "Pixtral 12B - Advanced multimodal vision and text model",
      parameterSection: "Parameter controls for Pixtral 12B model",
      statusMessages: {
        imageProcessing: "Processing image in native resolution",
        multipleImages: "Processing multiple images, please wait",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("meta-llama/llama-3.2-90b-vision-instruct:free", {
  provider: "meta",
  name: "Llama 3.2 90B Vision",
  category: "Vision",
  disabled: true,
  description:
    "Top-tier 90B parameter multimodal model with advanced visual reasoning and language capabilities, optimized for complex image-text comprehension tasks",
  costs: {
    input: 0.0,
    output: 0.0,
    image: 0.0, // per image processing
  },
  capabilities: [
    "vision",
    "text",
    "image-captioning",
    "visual-qa",
    "multimodal",
    "real-time-processing",
    "visual-reasoning",
    "scene-understanding",
    "object-detection",
    "image-text-comprehension",
  ],
  maxContext: 32000,
  fallbackTo: "meta-llama/llama-3.2-3b-instruct:free", // Fallback to free text-only model
  isFree: true,
  metadata: {
    categoryDescription:
      "Advanced multimodal vision models for complex visual analysis",
    modelArchitecture: {
      parameters: "90B",
      type: "multimodal-transformer",
      generation: "3.2",
      training: "pretrained + human feedback",
    },
    policyLinks: {
      privacyPolicy: "https://sambanova.ai/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://sambanova.ai/terms-and-conditions",
      lastUpdated: "2025-01-20",
    },
    releaseDate: "2024-09-25",
    specialFeatures: {
      imageProcessing: {
        description:
          "Advanced image analysis and visual reasoning capabilities",
        multimodalAnalysis: true,
      },
    },
    bestFor: [
      "complex visual analysis",
      "image captioning",
      "visual question answering",
      "real-time image processing",
      "multimodal applications",
      "accessibility applications",
    ],
    performanceCharacteristics: {
      latency: "optimized",
      throughput: "high",
      accuracyLevel: "state-of-the-art",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "seed",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.220000000000002,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 2.00000000000002,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "visual-impairment-assistance",
      "image-description-generation",
      "alt-text-generation",
      "scene-understanding-for-accessibility",
      "visual-content-explanation",
    ],
    warnings: [
      "Large visual inputs may require additional processing time",
      "Consider lower temperature settings for more precise descriptions",
    ],
    ariaLabels: {
      modelSelect:
        "Llama 3.2 90B Vision - Free multimodal model for advanced visual analysis",
      imageProcessing: "Processing image, please wait for detailed description",
      resultDisplay: "Image analysis results",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("deepseek/deepseek-chat", {
  provider: "deepseek",
  name: "DeepSeek Chat",
  category: "Code",
  disabled: false,
  description:
    "Latest DeepSeek model with strong instruction following and coding abilities, trained on nearly 15 trillion tokens",
  costs: { input: 0.14, output: 0.28 },
  capabilities: [
    "code",
    "text",
    "programming",
    "academia",
    "technology",
    "legal",
    "marketing",
    "seo",
  ],
  maxContext: 64000, // Updated with correct context window
  fallbackTo: "cohere/command-r7b-12-2024",
  isFree: false,
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "logprobs",
      "top_logprobs",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "logit_bias",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0, p50: 0, p90: 1 },
      top_a: { p10: 0, p50: 0, p90: 0 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 1, p50: 1, p90: 1 },
    },
  },
  metadata: {
    releaseDate: "2023-12-26",
    trainingTokens: "15 trillion",
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-20",
    },
    domainExpertise: {
      programming: 1, // Ranking out of categories
      academia: 1,
      technology: 2,
      legal: 2,
      marketing: 2,
      seo: 2,
    },
  },
});
modelRegistry.registerModel("microsoft/phi-3.5-mini-128k-instruct", {
  provider: "microsoft",
  name: "Phi-3.5 Mini 128K Instruct",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Lightweight but powerful model with strong reasoning capabilities",
  costs: {
    input: 0.1,
    output: 0.1,
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "math",
    "common-sense",
    "long-context",
    "instruction-following",
  ],
  maxContext: 128000,
  fallbackTo: "microsoft/phi-4", // Similar architecture and capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient model with state-of-the-art performance in its size class",
    modelArchitecture: {
      parameters: "3.8B",
      type: "decoder-only",
      transformerType: "dense",
      generation: "3.5",
    },
    policyLinks: {
      privacyPolicy: "https://www.microsoft.com/en-us/privacy/privacystatement",
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-01-20",
    },
    trainingDetails: {
      datasets: ["phi-3 synthetic", "filtered web data"],
      optimizations: [
        "supervised fine-tuning",
        "proximal policy optimization",
        "direct preference optimization",
      ],
      focus: ["high quality", "reasoning-dense", "safety measures"],
    },
    benchmarkPerformance: {
      notableFor: [
        "common sense reasoning",
        "language understanding",
        "mathematical computation",
        "code generation",
        "long context handling",
        "logical reasoning",
      ],
      performanceNote: "State-of-the-art among models <13B parameters",
    },
    bestFor: [
      "resource-efficient deployments",
      "reasoning tasks",
      "mathematical problems",
      "code generation",
      "instruction-following tasks",
    ],
    accessibility: {
      efficientProcessing: true,
      preciseInstructions: true,
      robustReasoning: true,
      resourceEfficient: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
});
modelRegistry.registerModel("mistralai/mistral-nemo", {
  provider: "mistralai",
  name: "Mistral Nemo",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Collaborative Mistral-NVIDIA multilingual model with function calling support",
  costs: {
    input: 0.035,
    output: 0.08,
  },
  capabilities: ["text", "multilingual", "function-calling", "trivia"],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.2-3b-instruct",
  isFree: false,
  metadata: {
    categoryDescription:
      "Versatile multilingual model with enterprise features",
    modelArchitecture: {
      parameters: "12B",
      collaboration: ["Mistral AI", "NVIDIA"],
      license: "Apache 2.0",
    },
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-20",
    },
    languageSupport: [
      "english",
      "french",
      "german",
      "spanish",
      "italian",
      "portuguese",
      "chinese",
      "japanese",
      "korean",
      "arabic",
      "hindi",
    ],
    domainExpertise: {
      trivia: 8,
    },
    bestFor: [
      "multilingual applications",
      "function calling workflows",
      "trivia applications",
      "international deployments",
      "API integrations",
    ],
    accessibility: {
      multilingualSupport: true,
      scriptSupport: [
        "latin",
        "chinese",
        "japanese",
        "korean",
        "arabic",
        "devanagari",
      ],
      functionCalling: true,
      internationalization: true,
    },
    technicalFeatures: {
      functionCalling: {
        supported: true,
        license: "Apache 2.0",
        integration: "standard",
      },
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "tools",
      "tool_choice",
      "seed",
      "min_p",
      "logit_bias",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1.1,
      },
      temperature: {
        p10: 0.7,
        p50: 0.9,
        p90: 1,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
  },
});
modelRegistry.registerModel("openai/gpt-4o-mini", {
  provider: "openai",
  name: "GPT-4o Mini",
  category: "GeneralPurpose",
  disabled: false,
  description: "Cost-effective multimodal model with SOTA performance",
  costs: {
    input: 0.15,
    output: 0.6,
    image: 7.225, // per 1000 images
  },
  capabilities: [
    "text",
    "vision",
    "multimodal",
    "finance",
    "trivia",
    "translation",
    "legal",
    "marketing",
    // +6 additional categories
  ],
  maxContext: 128000,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar capabilities at comparable price
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal model with optimal cost-performance ratio",
    modelFeatures: {
      multimodalSupport: {
        images: true,
        textToText: true,
        imageToText: true,
      },
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/policies/privacy-policy/",
      acceptableUse: "https://openai.com/policies/usage-policies/",
      termsOfService: "https://openai.com/policies/terms-of-use/",
      lastUpdated: "2025-01-20",
    },
    domainExpertise: {
      finance: 1, // Rating out of 10
      trivia: 2,
      translation: 2,
      legal: 2,
      marketing: 2,
      // +6 additional categories
    },
    benchmarks: {
      mmlu: 82,
      chatPreference: "Ranks above GPT-4 on common leaderboards",
    },
    costEfficiency: {
      comparison: {
        gpt35Turbo: "60% cheaper",
        note: "More affordable than frontier models",
      },
    },
    bestFor: [
      "cost-sensitive enterprise deployments",
      "multimodal applications",
      "financial analysis",
      "translation tasks",
      "legal documentation",
      "marketing content",
    ],
    accessibility: {
      multimodalAnalysis: true,
      costEffective: true,
      highPerformance: true,
      imageUnderstanding: true,
    },
    technicalNotes:
      "Optimized for balance of performance and cost-effectiveness",
  },
  responseFormatCapabilities: {
    type: "openai",
    features: {
      schemaValidation: true,
      strictMode: true,
      requiresExample: false, // OpenAI models don't require examples in system message
      supportsNesting: true, // Handles nested structures well
      additionalPropertiesRequired: true, // Must specify additionalProperties: false
      requiresAllFields: true, // All properties must be in required array
    },
    recommendedSettings: {
      temperature: 0.1, // Based on test results
      requiresSystemMessage: false,
      markdownStripping: false, // Produces clean JSON without markdown
      maxNestingDepth: 5, // Suggested max nesting for reliable results
    },
    constraints: {
      noNumericConstraints: true, // Cannot use min/max numeric constraints
      enumPreferred: true, // Use enums for restricted string values
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "response_format",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.45,
        p50: 1,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
});
modelRegistry.registerModel("qwen/qwen-2.5-72b-instruct", {
  provider: "qwen",
  name: "Qwen 2.5 72B Instruct",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Advanced multilingual model with strong capabilities in coding, mathematics, and structured data",
  costs: { input: 0.23, output: 0.4 },
  capabilities: [
    "text",
    "code",
    "math",
    "multilingual",
    "structured_data",
    "json",
    "long_context",
  ],
  maxContext: 32768,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Enterprise-grade model with extensive multilingual support",
    languages: [
      "Chinese",
      "English",
      "French",
      "Spanish",
      "Portuguese",
      "German",
      "Italian",
      "Russian",
      "Japanese",
      "Korean",
      "Vietnamese",
      "Thai",
      "Arabic",
    ],
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-20",
    },
    maxGeneration: 8192,
    specializations: ["coding", "mathematics", "structured_data"],
    license: "Tongyi Qianwen LICENSE AGREEMENT",
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.001,
        p50: 0.001,
        p90: 0.8,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.95,
        p50: 1,
        p90: 1,
      },
    },
  },
});
modelRegistry.registerModel("mistralai/mistral-tiny", {
  provider: "mistralai",
  name: "Mistral Tiny",
  category: "GeneralPurpose",
  disabled: false,
  description: "Cost-effective model optimized for batch processing tasks",
  costs: { input: 0.25, output: 0.25 },
  capabilities: ["text", "batch_processing"],
  maxContext: 32000,
  fallbackTo: "meta-llama/llama-3.2-3b-instruct:free",
  isFree: false,
  metadata: {
    categoryDescription: "Efficient model for high-volume processing",
    baseModel: "Mistral-7B-v0.2",
    optimizedFor: ["batch_processing", "high_volume"],
    policyLinks: {
      privacyPolicy: "https://mistral.ai/terms/#privacy-policy",
      acceptableUse: "",
      termsOfService: "https://mistral.ai/terms/#terms-of-use",
      lastUpdated: "2025-01-20",
    },
    useCase:
      "Large batch processing where cost efficiency is prioritized over complex reasoning",
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "response_format",
      "seed",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0.2,
        p50: 0.2,
        p90: 0.2,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0.4,
        p50: 0.4,
        p90: 0.4,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 0.5,
        p90: 0.5,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 0.9,
        p90: 1,
      },
    },
  },
});
modelRegistry.registerModel("infermatic/mn-inferor-12b", {
  provider: "Infermatic",
  name: "Mistral Nemo Inferor 12B",
  category: "Chat",
  disabled: false,
  description:
    "Inferor 12B is a merge of top roleplay models, expert on immersive narratives and storytelling. This model was merged using the Model Stock merge method using anthracite-org/magnum-v4-12b as a base.",
  costs: {
    input: 0.25,
    output: 0.5,
  },
  capabilities: [
    "Roleplay",
    "Immersive Narrative Generation",
    "Storytelling",
    "Advanced Narrative Composition",
  ],
  maxContext: 32000,
  fallbackTo: null,
  isFree: false,
  metadata: {
    categoryDescription:
      "Conversational AI models designed for interactive and responsive text-based interactions",
    parameterCount: 12000000000,
    mergeMethod: "Model Stock",
    baseModel: "anthracite-org/magnum-v4-12b",
    policyLinks: {
      privacyPolicy: "https://infermatic.ai/privacy-policy/",
      acceptableUse: "",
      termsOfService: "https://infermatic.ai/terms-and-conditions/",
      lastUpdated: "2025-01-20",
    },
    specialtySectors: [
      "Narrative Generation",
      "Creative Writing",
      "Roleplay Scenarios",
    ],
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "logit_bias",
      "top_k",
      "min_p",
      "seed",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.05,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 1.1,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.01,
        p50: 0.7,
        p90: 1.5,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 41,
      },
      top_p: {
        p10: 0.99,
        p50: 1,
        p90: 1,
      },
    },
  },
});
modelRegistry.registerModel("minimax/minimax-01", {
  provider: "minimax",
  name: "MiniMax-Text-01",
  category: "LargeContext",
  disabled: false,
  description:
    "Ultra-long context model with 456B parameters using hybrid Lightning Attention architecture",
  costs: {
    input: 0.2, // per 1M tokens
    output: 1.1, // per 1M tokens
  },
  capabilities: [
    "text",
    "long_context",
    "agent_systems",
    "memory_persistence",
    "multi_agent",
    "lightning_attention",
  ],
  maxContext: 4000000, // 4M tokens
  fallbackTo: "google/gemini-pro-1.5", // Similar large context model
  isFree: false,
  metadata: {
    categoryDescription: "Models supporting extensive context windows",
    modelArchitecture: {
      totalParameters: "456B",
      activeParameters: "45.9B",
      attention: [
        "Lightning Attention",
        "Softmax Attention",
        "Mixture-of-Experts",
      ],
      type: "hybrid",
      generation: "2025-01",
    },
    policyLinks: {
      privacyPolicy: "https://intl.minimaxi.com/protocol/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://intl.minimaxi.com/protocol/terms-of-service",
      lastUpdated: "2025-01-20",
    },
    specialFeatures: {
      contextWindow: {
        tokens: 4000000,
        comparison: "20-32x larger than typical models",
      },
      optimization: {
        clusterTraining: true,
        concurrentComputing: true,
        infrastructureReuse: true,
      },
    },
    bestFor: [
      "ai agent systems",
      "long-term memory tasks",
      "multi-agent communication",
      "extended context processing",
      "sustained conversations",
    ],
    accessibility: {
      longContextRetention: true,
      memoryPersistence: true,
      multiAgentSupport: true,
      efficientProcessing: true,
    },
    technicalNotes:
      "Uses novel Lightning Attention mechanism for efficient processing of ultra-long contexts",
    releaseDate: "2025-01-15",
  },
  parameterSupport: {
    supported: ["max_tokens", "temperature", "top_p", "system-prompt"],
    statistics: {
      temperature: {
        p10: 0.7,
        p50: 1,
        p90: 1,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
  },
});
modelRegistry.registerModel("mistralai/codestral-2501", {
  provider: "mistralai",
  name: "Codestral 25.01",
  category: "Code",
  disabled: false,
  description:
    "Cutting-edge code-specialized model with rapid completion and fill-in-the-middle capabilities",
  costs: {
    input: 0.3,
    output: 0.9,
  },
  capabilities: [
    "code",
    "code-completion",
    "fill-in-middle",
    "code-correction",
    "test-generation",
    "multi-language",
    "low-latency",
  ],
  maxContext: 256000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialized code-focused models with advanced capabilities",
    modelArchitecture: {
      version: "25.01",
      features: ["improved tokenizer", "efficient architecture"],
      generation: "2x faster than predecessor",
    },
    languageSupport: {
      count: 80,
      type: "programming languages",
      coverage: "comprehensive",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/terms/#privacy-policy",
      acceptableUse: "",
      termsOfService: "https://mistral.ai/terms/#terms-of-use",
      lastUpdated: "2025-01-20",
    },
    specializations: {
      fim: "State of the art for Fill-in-Middle tasks",
      codeCompletion: "Enhanced speed and accuracy",
      testGeneration: "Automated test creation",
      codeCorrection: "Real-time error detection and fixing",
    },
    useCase: {
      primary: ["software development", "code maintenance", "testing"],
      bestFor: [
        "rapid code completion",
        "test automation",
        "code refactoring",
        "bug fixing",
        "fill-in-middle tasks",
      ],
    },
    accessibility: {
      lowLatency: true,
      rapidResponse: true,
      contextAware: true,
      multiLanguageSupport: true,
    },
    performanceNote: "Leader in coding capabilities for its weight class",
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "response_format",
      "seed",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 0,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
});
modelRegistry.registerModel("qwen/qwen-2-vl-72b-instruct", {
  provider: "qwen",
  name: "Qwen2-VL 72B Instruct",
  category: "Vision",
  disabled: false,
  description:
    "Advanced multimodal model with state-of-the-art performance in visual understanding, video processing, and multilingual support",
  costs: {
    input: 0.4, // $0.4/M tokens
    output: 0.4, // $0.4/M tokens
    image: 0.578, // $0.578/K images
  },
  capabilities: [
    "vision",
    "video",
    "text",
    "multilingual",
    "agent-systems",
    "mobile-operation",
    "robotics-control",
    "document-analysis",
    "mathematical-reasoning",
    "video-qa",
    "real-time-interaction",
  ],
  maxContext: 4096,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Fallback to strong general model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal vision models for complex visual analysis",
    modelArchitecture: {
      type: "Vision Transformer (ViT)",
      features: [
        "Naive Dynamic Resolution",
        "Multimodal Rotary Position Embedding (M-ROPE)",
        "Enhanced Video Processing",
      ],
      videoCapabilities: {
        maxDuration: "20+ minutes",
        processingType: "continuous",
      },
    },
    policyLinks: {
      privacyPolicy: "https://hyperbolic.xyz/privacy",
      termsOfService: "https://hyperbolic.xyz/terms",
      lastUpdated: "2025-01-20",
    },
    languageSupport: [
      "english",
      "chinese",
      "japanese",
      "korean",
      "arabic",
      "vietnamese",
      "european-languages",
    ],
    domainExpertise: {
      documentAnalysis: 9,
      mathReasoning: 9,
      videoProcessing: 9,
      multilingual: 8,
      agentOperations: 8,
    },
    bestFor: [
      "complex visual analysis",
      "long video understanding",
      "multilingual document processing",
      "robotic control systems",
      "mobile device automation",
      "mathematical problem solving",
    ],
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "logprobs",
      "top_logprobs",
      "seed",
      "logit_bias",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "screen-reader-compatible-descriptions",
      "multilingual-content-analysis",
      "document-accessibility-evaluation",
      "video-content-description",
      "mobile-accessibility-testing",
      "robotic-assistance-systems",
    ],
    warnings: [
      "May require guidance for optimal parameter settings",
      "Video processing may take additional time",
      "Complex mathematical content may need verification",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen2-VL 72B - Advanced multimodal model with extensive accessibility features",
      videoProcessing:
        "Processing video content, please wait for detailed description",
      imageProcessing: "Analyzing image for accessible description",
      resultDisplay: "Analysis results with accessibility annotations",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("sophosympatheia/rogue-rose-103b-v0.2:free", {
  provider: "sophosympatheia",
  name: "Rogue Rose 103B v0.2",
  category: "FreeTier",
  disabled: true,
  description:
    "Large-scale model excelling in roleplay and storytelling, created through frankenmerge of two 70B architectures",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "roleplay",
    "storytelling",
    "creative_writing",
    "narrative_generation",
    "character_interaction",
    "scene_description",
  ],
  maxContext: 4096,
  fallbackTo: null,
  isFree: true,
  metadata: {
    categoryDescription: "Free tier models for creative applications",
    modelArchitecture: {
      parameters: "103B",
      layers: 120,
      base: "xwin-stellarbright-erp-70b-v2",
      type: "frankenmerge",
      version: "0.2",
      releaseDate: "2024-01-18",
    },
    policyLinks: {
      privacyPolicy: "",
      termsOfService: "",
      lastUpdated: "2025-01-20",
    },
    specialFeatures: {
      creative: "Advanced narrative capabilities",
      mergeType: "Custom 70B architecture combination",
    },
  },
  parameterSupport: {
    supported: ["max_tokens", "temperature", "top_p", "system-prompt"],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.7,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.17,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 1.1,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1.11,
      },
      temperature: {
        p10: 0.8,
        p50: 1,
        p90: 1.15,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 41,
      },
      top_p: {
        p10: 0.99,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "creative-writing-assistance",
      "narrative-description",
      "character-voice-consistency",
      "scene-setting-description",
    ],
    warnings: [
      "May exhibit scene logic inconsistencies",
      "Consider lower temperature for more consistent outputs",
    ],
    ariaLabels: {
      modelSelect: "Rogue Rose 103B - Free creative writing model",
      parameterSection: "Parameter controls for Rogue Rose model",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("deepseek/deepseek-r1-distill-llama-70b", {
  provider: "deepseek",
  name: "DeepSeek R1 Distill Llama 70B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A distilled large language model based on Llama-3.3-70B-Instruct, using outputs from DeepSeek R1. Features competitive performance on mathematical and coding benchmarks.",
  costs: {
    input: 0.23,
    output: 0.69,
  },
  capabilities: ["text", "mathematics", "coding", "reasoning"],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct",
  isFree: false,
  metadata: {
    categoryDescription: "High-performance models for general tasks",
    baseModel: "Llama-3.3-70B-Instruct",
    benchmarks: {
      "AIME 2024": "70.0 pass@1",
      "MATH-500": "94.5 pass@1",
      CodeForces: "Rating 1633",
    },
    releaseDate: "2025-01-23",
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-23",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 0.7,
        p90: 1,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("liquid/lfm-3b", {
  provider: "liquid",
  name: "LFM 3B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "High-performance 3B parameter model optimized for mobile and edge applications, outperforming many larger models while maintaining efficiency",
  costs: {
    input: 0.02,
    output: 0.02,
  },
  capabilities: [
    "text",
    "mobile-optimization",
    "edge-computing",
    "instruction-following",
    "efficient-inference",
  ],
  maxContext: 32768,
  fallbackTo: "microsoft/phi-3-mini-128k-instruct",
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient general-purpose model optimized for edge deployment",
    modelArchitecture: {
      parameters: "3B",
      release: "2025-01-25",
      type: "lightweight-transformer",
    },
    policyLinks: {
      privacyPolicy: "https://liquid.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://liquid.ai/terms",
      lastUpdated: "2025-01-20",
    },
    bestFor: [
      "mobile applications",
      "edge devices",
      "resource-constrained environments",
      "text-based applications",
    ],
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "mobile-accessibility",
      "low-latency-responses",
      "offline-processing",
      "resource-efficient-deployment",
    ],
    warnings: [
      "Consider network connectivity requirements",
      "Verify edge device compatibility",
    ],
    ariaLabels: {
      modelSelect: "LFM 3B - Efficient model for mobile and edge applications",
      parameterSection: "Parameter controls for LFM 3B model",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("liquid/lfm-7b", {
  provider: "liquid",
  name: "LFM 7B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Best-in-class multilingual model specializing in English, Arabic, and Japanese. Features low memory footprint and fast inference speed.",
  costs: {
    input: 0.01,
    output: 0.01,
  },
  capabilities: [
    "text",
    "chat",
    "multilingual",
    "fast_inference",
    "low_memory",
  ],
  maxContext: 32768,
  fallbackTo: "meta-llama/llama-3.2-3b-instruct:free",
  isFree: false,
  metadata: {
    categoryDescription: "Multilingual model optimized for chat interactions",
    releaseDate: "2025-01-25",
    architecture: "Liquid Foundation Model (LFM)",
    languages: ["english", "arabic", "japanese"],
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-20",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "multilingual-chat",
      "low-resource-environments",
      "fast-response-requirements",
    ],
    ariaLabels: {
      modelSelect:
        "LFM 7B - Fast multilingual model for English, Arabic, and Japanese",
      parameterSection: "Parameter controls for LFM 7B model",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("perplexity/sonar", {
  provider: "perplexity",
  name: "Sonar",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Lightweight, affordable, fast model optimized for question-answering with citation support and customizable sources. Designed for companies seeking to integrate lightweight Q&A features with speed optimization.",
  costs: {
    input: 1.0, // $1 per million tokens
    output: 1.0, // $1 per million tokens
    requests: 5.0, // $5 per thousand requests
  },
  capabilities: [
    "text",
    "question-answering",
    "citations",
    "custom-sources",
    "fast-inference",
    "lightweight",
  ],
  maxContext: 127072, // 127K context window
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar lightweight but powerful model
  isFree: false,
  metadata: {
    categoryDescription:
      "High-efficiency models optimized for Q&A applications",
    modelFeatures: {
      citationSupport: true,
      sourceCustomization: true,
      optimizedFor: ["speed", "q&a", "affordability"],
    },
    policyLinks: {
      privacyPolicy: "https://www.perplexity.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://www.perplexity.ai/terms",
      lastUpdated: "2025-01-27",
    },
    releaseDate: "2025-01-27",
    bestFor: [
      "question-answering systems",
      "citation-required applications",
      "speed-critical deployments",
      "cost-sensitive implementations",
      "source verification needs",
    ],
    contextFeatures: {
      maxTokens: 127072,
      efficiency: "Optimized for rapid processing",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "frequency_penalty",
      "presence_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 1,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "rapid-response-requirements",
      "source-verification-needs",
      "citation-dependent-content",
      "cost-effective-deployments",
    ],
    warnings: [
      "Consider response speed when setting up screen reader announcements",
      "Verify citation formatting for screen reader compatibility",
    ],
    ariaLabels: {
      modelSelect:
        "Perplexity Sonar - Fast, lightweight model with citation support",
      parameterSection: "Parameter controls for Sonar model",
      citationSection: "Source and citation controls",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("deepseek/deepseek-r1-distill-qwen-14b", {
  provider: "deepseek",
  name: "DeepSeek R1 Distill Qwen 14B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Highly capable distilled model excelling in mathematical reasoning and problem-solving, with optimized performance for reasoning tasks. Features efficient processing with low latency and high throughput.",
  costs: {
    input: 1.6, // $1.6/M tokens
    output: 1.6, // $1.6/M tokens
  },
  capabilities: [
    "text",
    "mathematical-reasoning",
    "problem-solving",
    "logical-analysis",
    "instruction-following",
    "low-latency",
    "high-throughput",
  ],
  maxContext: 131072, // 131K tokens
  fallbackTo: "microsoft/phi-3.5-mini-128k-instruct", // Similar reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance model with specialized mathematical and reasoning capabilities",
    modelArchitecture: {
      baseModel: "Qwen-14B",
      type: "distilled",
      generation: "R1",
    },
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-20",
    },
    performanceMetrics: {
      latency: "0.73s",
      throughput: "170.8 tokens/second",
      maxOutput: 2000,
    },
    bestFor: [
      "mathematical problem solving",
      "logical reasoning",
      "complex analysis",
      "time-sensitive applications",
      "high-throughput processing",
    ],
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.6,
        p50: 1,
        p90: 1,
      },
      top_p: {
        p10: 0.95,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
    features: ["response_format", "include_reasoning"],
  },
  accessibility: {
    preferredFor: [
      "step-by-step-reasoning",
      "mathematical-explanations",
      "clear-logical-breakdowns",
      "high-speed-responses",
    ],
    warnings: [
      "Consider enabling include_reasoning for clearer explanations",
      "Lower temperature recommended for precise mathematical tasks",
    ],
    ariaLabels: {
      modelSelect:
        "DeepSeek R1 Distill Qwen 14B - Specialized mathematical reasoning model",
      parameterSection: "Parameter controls for DeepSeek model",
      statusMessages: {
        processing:
          "Processing mathematical computation, please wait for step-by-step explanation",
        completed: "Mathematical analysis complete, displaying results",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("perplexity/sonar-reasoning", {
  provider: "perplexity",
  name: "Sonar Reasoning",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Advanced reasoning model with built-in web search capabilities, based on DeepSeek R1. Features long chain-of-thought reasoning and is hosted in US datacenters.",
  costs: {
    input: 1.0, // $1/M tokens
    output: 5.0, // $5/M tokens
    request: 5.0, // $5/K requests
  },
  capabilities: [
    "reasoning",
    "chain-of-thought",
    "web-search",
    "long-context",
    "uncensored",
  ],
  maxContext: 127000,
  fallbackTo: "deepseek/deepseek-chat", // Similar reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription: "Advanced reasoning model with integrated web search",
    modelArchitecture: {
      base: "DeepSeek R1",
      features: ["web search", "chain of thought", "long context"],
      hosting: "US datacenters",
    },
    policyLinks: {
      privacyPolicy: "https://perplexity.ai/privacy",
      acceptableUse: "https://perplexity.ai/policies",
      termsOfService: "https://perplexity.ai/terms",
      lastUpdated: "2025-01-29",
    },
    bestFor: [
      "complex reasoning tasks",
      "research queries",
      "long-form analysis",
      "web-augmented responses",
      "chain-of-thought explanations",
    ],
    technicalNotes:
      "Built-in web search capabilities with long chain-of-thought reasoning",
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "include_reasoning",
      "top_k",
      "frequency_penalty",
      "presence_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.5,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
    features: ["include_reasoning", "chain_of_thought"],
  },
  accessibility: {
    preferredFor: [
      "detailed-explanations",
      "step-by-step-reasoning",
      "research-assistance",
      "complex-analysis",
    ],
    warnings: [
      "Web search results may require additional processing time",
      "Consider lower temperature for more consistent outputs",
    ],
    ariaLabels: {
      modelSelect:
        "Sonar Reasoning - Advanced reasoning model with web search capabilities",
      parameterSection: "Parameter controls for Sonar Reasoning model",
      searchStatus: "Web search in progress, please wait for complete analysis",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("deepseek/deepseek-r1-distill-qwen-32b", {
  provider: "deepseek",
  name: "DeepSeek R1 Distill Qwen 32B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A distilled large language model based on Qwen 2.5 32B, using outputs from DeepSeek R1. It outperforms OpenAI's o1-mini across various benchmarks, achieving new state-of-the-art results for dense models.",
  costs: {
    input: 0.12, // $0.12/M tokens
    output: 0.18, // $0.18/M tokens
  },
  capabilities: [
    "text",
    "mathematics",
    "coding",
    "reasoning",
    "instruction_following",
    "structured_output",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar performance characteristics
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance distilled model with strong mathematical capabilities",
    modelArchitecture: {
      baseModel: "Qwen 2.5 32B",
      distillation: "DeepSeek R1",
      release: "2025-01-29",
    },
    benchmarks: {
      "AIME 2024": "72.6 pass@1",
      "MATH-500": "94.3 pass@1",
      CodeForces: "Rating 1691",
    },
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-29",
    },
    bestFor: [
      "mathematical computation",
      "coding tasks",
      "reasoning problems",
      "structured outputs",
      "instruction following",
    ],
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "structured_outputs",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.19,
        p50: 0.6,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.95,
        p50: 1,
        p90: 1,
      },
    },
    features: ["include_reasoning", "structured_output", "logprobs"],
  },
  accessibility: {
    preferredFor: [
      "mathematical-content",
      "code-documentation",
      "step-by-step-reasoning",
      "structured-responses",
    ],
    warnings: [
      "Consider lower temperature for precise mathematical computations",
      "Enable include_reasoning for clearer step-by-step explanations",
    ],
    ariaLabels: {
      modelSelect:
        "DeepSeek R1 Distill Qwen 32B - High performance model with mathematical expertise",
      parameterSection: "Parameter controls for DeepSeek R1 model",
      statusMessages: {
        computing:
          "Computing mathematical solution. This may take extra time for accuracy.",
        reasoning: "Generating detailed step-by-step explanation.",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("mistralai/mistral-small-24b-instruct-2501", {
  provider: "mistralai",
  name: "Mistral Small 3",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Mistral Small 3 is a 24B-parameter language model optimized for low-latency performance across common AI tasks. Released under the Apache 2.0 license, it features both pre-trained and instruction-tuned versions designed for efficient local deployment. The model achieves 81% accuracy on the MMLU benchmark and performs competitively with larger models like Llama 3.3 70B and Qwen 32B, while operating at three times the speed on equivalent hardware.",
  costs: {
    input: 0.07, // $0.07 per million tokens
    output: 0.14, // $0.14 per million tokens
  },
  capabilities: [
    "text",
    "instruction-following",
    "low-latency",
    "local-deployment",
    "structured-output",
    "efficient-inference",
    "benchmarking",
  ],
  maxContext: 32768,
  fallbackTo: "meta-llama/llama-3.2-3b-instruct:free", // Fallback to free model
  isFree: false,
  metadata: {
    categoryDescription: "High-performance models with balanced capabilities",
    modelArchitecture: {
      parameters: "24B",
      type: "instruction-tuned",
      generation: "Small 3",
      release: "2025-01-30",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/terms/#privacy-policy",
      acceptableUse: "",
      termsOfService: "https://mistral.ai/terms/#terms-of-use",
      lastUpdated: "2025-01-30",
    },
    benchmarks: {
      MMLU: "81%",
      speedComparison: "3x faster than comparable models",
    },
    license: "Apache 2.0",
    bestFor: [
      "low-latency applications",
      "local deployments",
      "efficient inference",
      "balanced performance tasks",
    ],
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "logit_bias",
      "structured_outputs",
      "logprobs",
      "top_logprobs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1.05,
      },
      temperature: {
        p10: 0.5,
        p50: 0.7,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.95,
        p50: 1,
        p90: 1,
      },
    },
    features: ["structured_outputs", "response_format"],
  },
  accessibility: {
    preferredFor: [
      "time-sensitive-applications",
      "interactive-responses",
      "efficient-processing",
      "local-accessibility-tools",
    ],
    warnings: [
      "Consider latency requirements for real-time accessibility tools",
      "Verify local deployment requirements if used offline",
    ],
    ariaLabels: {
      modelSelect: "Mistral Small 3 - Fast, efficient 24B parameter model",
      parameterSection: "Parameter controls for Mistral Small 3",
      statusMessages: {
        processing: "Processing with optimized speed",
        localDeployment: "Using local deployment settings",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("deepseek/deepseek-r1-distill-qwen-1.5b", {
  provider: "deepseek",
  name: "DeepSeek R1 Distill Qwen 1.5B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A highly efficient 1.5B parameter model distilled from Qwen 2.5 Math using DeepSeek R1 outputs. Excels at mathematical reasoning and achieves competitive performance comparable to larger frontier models.",
  costs: {
    input: 0.18, // $0.18 per million tokens
    output: 0.18, // $0.18 per million tokens
  },
  capabilities: [
    "mathematics",
    "reasoning",
    "instruction-following",
    "mathematical_proofs",
    "efficient_inference",
    "low_resource",
  ],
  maxContext: 131072,
  fallbackTo: "microsoft/phi-3-mini-128k-instruct", // Similar small efficient model
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient general-purpose model with strong mathematical capabilities",
    modelArchitecture: {
      parameters: "1.5B",
      type: "distilled",
      baseModel: "Qwen 2.5 Math 1.5B",
      distillationTeacher: "DeepSeek R1",
    },
    benchmarkPerformance: {
      "AIME 2024": {
        "pass@1": 28.9,
        "cons@64": 52.7,
      },
      "MATH-500": {
        "pass@1": 83.9,
      },
    },
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-31",
    },
    bestFor: [
      "mathematical problem solving",
      "efficient deployments",
      "resource-constrained environments",
      "mathematical proofs",
      "reasoning tasks",
    ],
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "mathematical-content",
      "step-by-step-reasoning",
      "proof-verification",
      "educational-explanations",
    ],
    warnings: [
      "Mathematical notation may need additional formatting for screen readers",
      "Consider using response_format parameter for structured mathematical output",
    ],
    ariaLabels: {
      modelSelect:
        "DeepSeek R1 Distill Qwen 1.5B - Efficient mathematical reasoning model",
      parameterSection: "Parameter controls for DeepSeek R1 model",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("qwen/qwen-max", {
  provider: "qwen",
  name: "Qwen-Max",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Qwen-Max, based on Qwen2.5, provides the best inference performance among Qwen models, especially for complex multi-step tasks. It's a large-scale MoE model that has been pretrained on over 20 trillion tokens and further post-trained with curated Supervised Fine-Tuning (SFT) and Reinforcement Learning from Human Feedback (RLHF) methodologies. The parameter count is unknown.",
  costs: {
    input: 1.6, // $1.6/M tokens
    output: 6.4, // $6.4/M tokens
  },
  capabilities: [
    "text",
    "complex_tasks",
    "multi_step_reasoning",
    "moe", // Mixture of Experts
    "tool_calling",
  ],
  maxContext: 32768,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Fallback to reliable general model
  isFree: false,
  metadata: {
    categoryDescription:
      "Large-scale language models for general purpose tasks",
    modelArchitecture: {
      base: "Qwen2.5",
      type: "MoE",
      trainingTokens: "20+ trillion",
      trainingMethods: ["SFT", "RLHF"],
    },
    policyLinks: {
      privacyPolicy: "https://help.aliyun.com/document_detail/175619.html",
      acceptableUse: "",
      termsOfService:
        "https://terms.alicdn.com/legal-agreement/terms/product_id/12670002.html",
      lastUpdated: "2025-02-01",
    },
    releaseDate: "2025-02-01",
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "response_format",
      "presence_penalty",
      "system-prompt",
    ],
    // Not including statistics since none were provided
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("qwen/qwen-plus", {
  provider: "qwen",
  name: "Qwen Plus",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Qwen-Plus, based on the Qwen2.5 foundation model, is a 131K context model with a balanced performance, speed, and cost combination.",
  costs: {
    input: 0.4, // $0.4/M tokens
    output: 1.2, // $1.2/M tokens
  },
  capabilities: ["text"], // We know it can do text as it's described as a chat model
  maxContext: 131072, // 131K context explicitly stated
  isFree: false, // Has costs defined, so not free
  metadata: {
    releaseDate: "2025-02-01", // "Created Feb 1, 2025"
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "response_format",
      "presence_penalty",
      "system-prompt",
    ],
  },
  // Basic status tracking (required by our system)
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("qwen/qwen-turbo", {
  provider: "qwen",
  name: "Qwen-Turbo",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Qwen-Turbo, based on Qwen2.5, is a 1M context model that provides fast speed and low cost, suitable for simple tasks.",
  costs: {
    input: 0.05, // $0.05/M tokens
    output: 0.2, // $0.2/M tokens
  },
  capabilities: ["text"], // Only confirming text capability as it was implied
  maxContext: 1000000, // 1M context as specified
  fallbackTo: null, // Not specified in provided data
  isFree: false, // Has costs specified
  metadata: {
    releaseDate: "2025-02-01", // Created Feb 1, 2025 as provided
    policyLinks: {
      privacyPolicy: "", // Not provided
      acceptableUse: "", // Not provided
      termsOfService: "", // Not provided
      lastUpdated: "2025-02-01",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "response_format",
      "presence_penalty",
      "system-prompt",
    ],
  },
  // Only including status tracking as it's required by the system
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("aion-labs/aion-1.0-mini", {
  provider: "aion-labs",
  name: "Aion-1.0-Mini",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Aion-1.0-Mini 32B parameter model is a distilled version of the DeepSeek-R1 model, designed for strong performance in reasoning domains such as mathematics, coding, and logic. It is a modified variant of a FuseAI model that outperforms R1-Distill-Qwen-32B and R1-Distill-Llama-70B, with benchmark results available on its Hugging Face page, independently replicated for verification.",
  costs: {
    input: 0.8, // $0.8/M tokens
    output: 2.4, // $2.4/M tokens
  },
  capabilities: ["mathematics", "coding", "logic", "reasoning"],
  maxContext: 16384,
  fallbackTo: "deepseek/deepseek-r1-distill-qwen-32b",
  isFree: false,
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "include_reasoning",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.255,
        p50: 0.85,
        p90: 0.955,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("aion-labs/aion-1.0", {
  provider: "aion-labs",
  name: "Aion-1.0",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Aion-1.0 is a multi-model system designed for high performance across various tasks, including reasoning and coding. It is built on DeepSeek-R1, augmented with additional models and techniques such as Tree of Thoughts (ToT) and Mixture of Experts (MoE). It is Aion Lab's most powerful reasoning model.",
  costs: {
    input: 8.0, // $8/M tokens
    output: 24.0, // $24/M tokens
  },
  capabilities: [
    "reasoning",
    "coding",
    "multi-model",
    "tree_of_thoughts",
    "mixture_of_experts",
  ],
  maxContext: 16384,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Suggesting a fallback to a reliable model with similar capabilities
  isFree: false,
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "include_reasoning",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.03,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.01,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.22,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1.006,
      },
      temperature: {
        p10: 0.6,
        p50: 1,
        p90: 1.154,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 8.20000000000001,
      },
      top_p: {
        p10: 0.95,
        p50: 1,
        p90: 1,
      },
    },
  },
  // Required by our system but no data provided, using minimal required fields
  metadata: {
    releaseDate: "2025-02-04", // Only date we know
  },
  // Required by our system
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("aion-labs/aion-rp-llama-3.1-8b", {
  provider: "aion-labs",
  name: "Aion-RP 1.0 (8B)",
  category: "GeneralPurpose", // Using this category since it's a base model for text generation
  disabled: false,
  description:
    "Aion-RP-Llama-3.1-8B ranks the highest in the character evaluation portion of the RPBench-Auto benchmark, a roleplaying-specific variant of Arena-Hard-Auto, where LLMs evaluate each other's responses. It is a fine-tuned base model rather than an instruct model, designed to produce more natural and varied writing.",
  costs: {
    input: 0.2, // $0.2/M tokens
    output: 0.2, // $0.2/M tokens
  },
  capabilities: ["text", "roleplay", "creative_writing"],
  maxContext: 32768,
  parameterSupport: {
    supported: ["max_tokens", "temperature", "top_p", "system-prompt"],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.009,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.045,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 1.1,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1.11,
      },
      temperature: {
        p10: 0.8,
        p50: 0.865,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 38.9,
      },
      top_p: {
        p10: 0.991,
        p50: 1,
        p90: 1,
      },
    },
  },
  metadata: {
    releaseDate: "2025-02-04",
  },
  // Required by our system, using minimal required fields since no additional info provided
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("qwen/qwen-vl-plus:free", {
  provider: "qwen",
  name: "Qwen VL Plus",
  category: "FreeTier", // Using FreeTier since it's explicitly marked as free
  disabled: false,
  description:
    "Qwen's Enhanced Large Visual Language Model. Significantly upgraded for detailed recognition capabilities and text recognition abilities, supporting ultra-high pixel resolutions up to millions of pixels and extreme aspect ratios for image input. It delivers significant performance across a broad range of visual tasks.",
  costs: {
    input: 0, // Confirmed as $0/M tokens
    output: 0, // Confirmed as $0/M tokens
  },
  capabilities: [
    "text",
    "vision",
    "visual-recognition",
    "text-recognition",
    "high-resolution",
  ],
  maxContext: 7500, // Explicitly provided
  isFree: true, // Confirmed in model name and pricing
  metadata: {
    releaseDate: "2025-02-05", // From "Created Feb 5, 2025"
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "response_format",
      "presence_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 1,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
  // Required by our system but keeping minimal since no specific info provided
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("google/gemini-2.0-flash-001", {
  provider: "google",
  name: "Gemini Flash 2.0",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Gemini Flash 2.0 offers a significantly faster time to first token (TTFT) compared to Gemini Flash 1.5, while maintaining quality on par with larger models like Gemini Pro 1.5. It introduces notable enhancements in multimodal understanding, coding capabilities, complex instruction following, and function calling. These advancements come together to deliver more seamless and robust agentic experiences.",
  costs: {
    input: 0.1, // $0.1/M tokens
    output: 0.4, // $0.4/M tokens
  },
  capabilities: ["legal", "health", "translation", "finance"],
  maxContext: 1000000, // 1M tokens
  fallbackTo: "meta-llama/llama-3.2-3b-instruct:free", // Fallback to free model
  isFree: false,
  metadata: {
    releaseDate: "2025-02-05", // Created Feb 5, 2025
    domainExpertise: {
      legal: 5, // Rating out of 10
      health: 7, // Rating out of 10
      translation: 10, // Rating out of 10
      finance: 10, // Rating out of 10
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "response_format",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
  },
  // Required by our system, using minimal defaults since not provided
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("deepseek/deepseek-r1-distill-llama-8b", {
  provider: "deepseek",
  name: "DeepSeek R1 Distill Llama 8B",
  category: "GeneralPurpose", // Since it's a general language model
  disabled: false,
  description:
    "DeepSeek R1 Distill Llama 8B is a distilled large language model based on Llama-3.1-8B-Instruct, using outputs from DeepSeek R1. The model combines advanced distillation techniques to achieve high performance across multiple benchmarks.",
  costs: {
    input: 0.04, // $0.04/M tokens
    output: 0.04, // $0.04/M tokens
  },
  capabilities: ["text", "mathematics", "coding"],
  maxContext: 32000,
  fallbackTo: "microsoft/phi-3-mini-128k-instruct", // Similar size model with math capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance distilled model with strong mathematical capabilities",
    modelArchitecture: {
      baseModel: "Llama-3.1-8B-Instruct",
      distillation: "DeepSeek R1",
      release: "2025-02-07",
    },
    benchmarks: {
      "AIME 2024": {
        "pass@1": 50.4,
      },
      "MATH-500": {
        "pass@1": 89.1,
      },
      CodeForces: {
        Rating: 1205,
      },
    },
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-02-07",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "system-prompt",
    ],
    // Not including statistics as they weren't provided
  },
  // Required by our system
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("allenai/llama-3.1-tulu-3-405b", {
  provider: "allenai",
  name: "Llama 3.1 Tulu 3 405B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Tülu 3 405B is the largest model in the Tülu 3 family, applying fully open post-training recipes at a 405B parameter scale. Built on the Llama 3.1 405B base, it leverages Reinforcement Learning with Verifiable Rewards (RLVR) to enhance instruction following, MATH, GSM8K, and IFEval performance. As part of Tülu 3's fully open-source approach, it offers state-of-the-art capabilities while surpassing prior open-weight models like Llama 3.1 405B Instruct and Nous Hermes 3 405B on multiple benchmarks.",
  costs: {
    input: 5.0, // $5/M tokens
    output: 10.0, // $10/M tokens
  },
  capabilities: ["text", "math", "instruction_following", "problem_solving"],
  maxContext: 16000,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Fallback to reliable general model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced language model with strong mathematical capabilities",
    releaseDate: "2025-02-08",
    trainingApproaches: [
      "Supervised Fine-Tuning",
      "Direct Preference Optimization",
      "Reinforcement Learning with Verifiable Rewards",
    ],
    policyLinks: {
      privacyPolicy: "https://sambanova.ai/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://sambanova.ai/model-demo-tou",
      lastUpdated: "2025-02-08",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 0.8,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("deepseek/deepseek-r1", {
  provider: "deepseek",
  name: "DeepSeek R1",
  category: "GeneralPurpose", // Using this as it's a large general model
  disabled: false,
  description:
    "DeepSeek R1 is a 671B parameter model (37B active) offering performance on par with OpenAI o1, with open-source reasoning tokens. MIT licensed for distillation and commercial use.",
  costs: {
    input: 0.8, // $0.8/M tokens
    output: 2.4, // $2.4/M tokens
  },
  capabilities: [
    "text",
    "health",
    "programming",
    "reasoning",
    "structured_output",
  ],
  maxContext: 128000,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Suggesting a fallback to another strong general model
  isFree: false,
  metadata: {
    categoryDescription: "High-performance open-source language model",
    modelArchitecture: {
      parameters: "671B",
      activeParameters: "37B",
      release: "2025-01-20",
    },
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-20",
    },
    license: "MIT",
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "repetition_penalty",
      "response_format",
      "structured_outputs",
      "min_p",
      "system-prompt", // Added as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.97,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "health-content",
      "programming-documentation",
      "technical-writing",
      "structured-outputs",
    ],
    warnings: [
      "Consider using lower temperature for health-related content",
      "Enable reasoning tokens for complex technical explanations",
    ],
    ariaLabels: {
      modelSelect: "DeepSeek R1 - Open source high performance model",
      parameterSection: "Parameter controls for DeepSeek R1 model",
      statusMessages: {
        processing: "Processing with DeepSeek R1, focusing on accuracy",
        reasoningEnabled: "Reasoning mode enabled for detailed explanations",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

// Find the FreeTier section and add this new model:

modelRegistry.registerModel("deepseek/deepseek-chat:free", {
  provider: "deepseek",
  name: "DeepSeek V3",
  category: "FreeTier",
  disabled: true,
  description:
    "DeepSeek-V3 is the latest model from the DeepSeek team, building upon the instruction following and coding abilities of the previous versions. Pre-trained on nearly 15 trillion tokens, the reported evaluations reveal that the model outperforms other open-source models and rivals leading closed-source models.",
  costs: {
    input: 0, // Free model
    output: 0, // Free model
  },
  capabilities: ["text", "coding", "instruction_following", "long_context"],
  maxContext: 131072, // 131K context window
  fallbackTo: null, // No fallback needed for free model
  isFree: true,
  metadata: {
    categoryDescription: "No-cost models with competitive capabilities",
    modelArchitecture: {
      type: "MoE",
      totalParameters: "671B",
      activeParameters: "37B",
      trainingTokens: "14.8T",
    },
    releaseDate: "2024-12-26",
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2024-12-26",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "top_a",
      "system-prompt", // Added as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 0.7,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "code-documentation",
      "technical-writing",
      "instruction-following",
      "long-form-content",
    ],
    warnings: [
      "Consider latency when working with very long contexts",
      "Verify output quality for critical documentation",
    ],
    ariaLabels: {
      modelSelect: "DeepSeek V3 - Free high-performance model",
      parameterSection: "Parameter controls for DeepSeek V3",
      statusMessages: {
        processing: "Processing with DeepSeek V3, optimized for speed",
        complete: "Processing complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("deepseek/deepseek-r1:free", {
  provider: "deepseek",
  name: "DeepSeek R1",
  category: "FreeTier", // Using FreeTier since it's explicitly free
  disabled: true,
  description:
    "DeepSeek R1 is a 671B parameter open-source model with 37B active parameters. Performance comparable to OpenAI o1, with fully open reasoning tokens. Released under MIT license.",
  costs: {
    input: 0, // $0/M tokens as specified
    output: 0, // $0/M tokens as specified
  },
  capabilities: [
    "text",
    "reasoning",
    "mathematics",
    "coding",
    "instruction_following",
  ],
  maxContext: 163840, // As specified
  fallbackTo: null, // No fallback needed as it's a free model
  isFree: true,
  metadata: {
    categoryDescription: "No-cost models with enterprise-grade capabilities",
    modelArchitecture: {
      parameters: "671B",
      activeParameters: "37B",
      type: "MIT licensed",
      release: "2025-01-20",
    },
    policyLinks: {
      privacyPolicy: "https://deepinfra.com/docs/data",
      acceptableUse: "",
      termsOfService: "https://deepinfra.com/terms",
      lastUpdated: "2025-01-20",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "include_reasoning",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "top_a",
      "logprobs",
      "min_p",
      "repetition_penalty",
      "system-prompt", // Adding system-prompt support
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.5,
        p50: 0.9,
        p90: 1.05,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.98,
        p50: 1,
        p90: 1,
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
  accessibility: {
    preferredFor: [
      "step-by-step-reasoning",
      "open-source-applications",
      "educational-use",
      "cost-sensitive-deployments",
    ],
    warnings: [],
    ariaLabels: {
      modelSelect:
        "DeepSeek R1 - Free open-source model with reasoning capabilities",
      parameterSection: "Parameter controls for DeepSeek R1 model",
    },
  },
});

// Find the section where other models are registered, and add this new registration:

modelRegistry.registerModel(
  "cognitivecomputations/dolphin3.0-r1-mistral-24b:free",
  {
    provider: "cognitivecomputations",
    name: "Dolphin 3.0 R1 Mistral 24B",
    category: "FreeTier", // Using FreeTier since it's marked as free
    disabled: true,
    description:
      "Dolphin 3.0 R1 is the next generation of the Dolphin series of instruct-tuned models. Designed to be the ultimate general purpose local model, enabling coding, math, agentic, function calling, and general use cases. The R1 version has been trained for 3 epochs to reason using 800k reasoning traces from the Dolphin-R1 dataset.",
    costs: {
      input: 0, // Confirmed as $0/M tokens
      output: 0, // Confirmed as $0/M tokens
    },
    capabilities: [
      "text",
      "coding",
      "math",
      "reasoning",
      "function_calling",
      "general_purpose",
    ],
    maxContext: 32768, // 32,768 as specified
    fallbackTo: null, // No fallback needed for free model
    isFree: true, // Marked as free
    metadata: {
      releaseDate: "2025-02-13", // From "Created Feb 13, 2025"
      policyLinks: {
        privacyPolicy: "", // Not provided
        acceptableUse: "", // Not provided
        termsOfService: "", // Not provided
        lastUpdated: "2025-02-13",
      },
    },
    parameterSupport: {
      supported: [
        "max_tokens",
        "temperature",
        "top_p",
        "include_reasoning",
        "stop",
        "frequency_penalty",
        "presence_penalty",
        "seed",
        "top_k",
        "min_p",
        "repetition_penalty",
        "logprobs",
        "logit_bias",
        "top_logprobs",
        "system-prompt", // Added system-prompt support
      ],
      statistics: {
        frequency_penalty: {
          p10: 0,
          p50: 0,
          p90: 0,
        },
        min_p: {
          p10: 0,
          p50: 0,
          p90: 0,
        },
        presence_penalty: {
          p10: 0,
          p50: 0,
          p90: 0,
        },
        repetition_penalty: {
          p10: 1,
          p50: 1,
          p90: 1,
        },
        temperature: {
          p10: 0.002,
          p50: 1,
          p90: 1,
        },
        top_a: {
          p10: 0,
          p50: 0,
          p90: 0,
        },
        top_k: {
          p10: 0,
          p50: 0,
          p90: 0,
        },
        top_p: {
          p10: 0.9,
          p50: 1,
          p90: 1,
        },
      },
    },
    status: {
      isAvailable: true,
      lastCheck: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
    },
    accessibility: {
      preferredFor: [
        "general-purpose-tasks",
        "coding-assistance",
        "mathematical-computation",
        "reasoning-tasks",
        "function-calling-workflows",
      ],
      warnings: [],
      ariaLabels: {
        modelSelect: "Dolphin 3.0 R1 Mistral 24B - Free general-purpose model",
        parameterSection: "Parameter controls for Dolphin model",
        statusMessages: {
          processing: "Processing with Dolphin model",
          complete: "Processing complete",
        },
      },
    },
  },
);
modelRegistry.registerModel("meta-llama/llama-guard-3-8b", {
  provider: "meta",
  name: "Llama Guard 3 8B",
  category: "GeneralPurpose", // Using general purpose since it's a core text model
  disabled: false,
  description:
    "Llama Guard 3 is a Llama-3.1-8B pretrained model, fine-tuned for content safety classification. It can classify content in both LLM inputs (prompt classification) and LLM responses (response classification), generating text that indicates whether content is safe or unsafe along with violated content categories.",
  costs: {
    input: 0.3, // $0.3/M tokens
    output: 0.3, // $0.3/M tokens
  },
  capabilities: [
    "content_moderation",
    "multilingual",
    "safety_classification",
    "tool_safety",
    "prompt_classification",
    "response_classification",
  ],
  maxContext: 16384,
  fallbackTo: "meta-llama/llama-3.2-3b-instruct:free", // Fallback to free model
  isFree: false,
  metadata: {
    categoryDescription: "Content safety and moderation model",
    releaseDate: "2025-02-12",
    languages: ["english", "plus-7-others"], // 8 languages total as specified
    policyLinks: {
      privacyPolicy: "https://ai.meta.com/privacy/",
      acceptableUse: "",
      termsOfService: "https://ai.meta.com/terms/",
      lastUpdated: "2025-02-12",
    },
    specialFeatures: {
      taxonomyAlignment: "MLCommons standardized hazards",
      toolSupport: ["search", "code_interpreter"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "system-prompt", // Added as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "content-safety-validation",
      "multilingual-safety-checks",
      "tool-interaction-safety",
      "code-safety-analysis",
    ],
    warnings: [
      "Safety classifications should be reviewed by humans",
      "Multiple languages may affect response clarity",
    ],
    ariaLabels: {
      modelSelect: "Llama Guard 3 8B - Content safety classification model",
      parameterSection: "Parameter controls for Llama Guard 3",
      statusMessages: {
        processing: "Analyzing content safety, please wait",
        complete: "Content safety analysis complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("perplexity/r1-1776", {
  provider: "perplexity",
  name: "R1 1776",
  category: "GeneralPurpose", // Using general purpose since it's a chat model with broad capabilities
  disabled: false,
  description:
    "R1 1776 is a version of DeepSeek-R1 post-trained to provide unbiased, accurate, and factual information while maintaining strong reasoning capabilities. This offline chat model features comprehensive multilingual support and advanced mathematical reasoning abilities.",
  costs: {
    input: 2.0, // $2/M tokens
    output: 8.0, // $8/M tokens
  },
  capabilities: ["text", "math", "reasoning", "multilingual", "offline_chat"],
  maxContext: 128000, // 128K context as specified
  fallbackTo: "anthropic/claude-3.5-sonnet", // Fallback to reliable general model
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance language models with advanced reasoning capabilities",
    releaseDate: "2025-02-19", // From "Created Feb 19, 2025"
    policyLinks: {
      privacyPolicy: "https://www.perplexity.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://www.perplexity.ai/terms",
      lastUpdated: "2025-02-19",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "include_reasoning",
      "top_k",
      "frequency_penalty",
      "presence_penalty",
      "system-prompt", // Added system-prompt support
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.2,
        p50: 1,
        p90: 1,
      },
      top_a: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.936,
        p50: 1,
        p90: 1,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "mathematical-content",
      "multilingual-content",
      "reasoning-tasks",
      "factual-responses",
    ],
    warnings: [
      "Consider lower temperature for precise mathematical computations",
      "Use system prompts to guide response format for better accessibility",
    ],
    ariaLabels: {
      modelSelect:
        "R1 1776 - Advanced reasoning model with comprehensive multilingual support",
      parameterSection: "Parameter controls for R1 1776 model",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("google/gemini-2.0-flash-lite-001", {
  provider: "google",
  name: "Gemini 2.0 Flash Lite",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Gemini 2.0 Flash Lite offers a significantly faster time to first token (TTFT) compared to Gemini Flash 1.5, while maintaining quality on par with larger models like Gemini Pro 1.5, all at extremely economical token prices.",
  costs: {
    input: 0.075, // $0.075/M input tokens
    output: 0.3, // $0.3/M output tokens
  },
  capabilities: ["text", "dialogue", "reasoning", "low_latency"],
  maxContext: 1048576, // 1,048,576 context window
  fallbackTo: "meta-llama/llama-3.2-3b-instruct:free", // Using same fallback as other models
  isFree: false,
  metadata: {
    categoryDescription:
      "High-speed model with excellent quality-to-cost ratio",
    releaseDate: "2025-02-25",
    policyLinks: {
      privacyPolicy: "https://ai.google.dev/privacy",
      termsOfService: "https://ai.google.dev/terms",
    },
    bestFor: [
      "user-facing applications",
      "high-interactivity interfaces",
      "data processing",
      "general-purpose tasks",
      "cost-sensitive applications",
    ],
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1,
      },
      top_p: {
        p10: 0.95,
        p50: 1,
        p90: 1,
      },
    },
    features: ["structured_outputs", "response_format"],
  },
  accessibility: {
    preferredFor: [
      "real-time-assistance",
      "interactive-applications",
      "cost-sensitive-contexts",
    ],
    warnings: [
      "Configure appropriate timeouts for responses",
      "Ensure proper feedback for fast interactions",
    ],
    ariaLabels: {
      modelSelect:
        "Gemini 2.0 Flash Lite - Fast, economical general-purpose model",
      parameterSection: "Parameter controls for Gemini 2.0 Flash Lite model",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("qwen/qwen2.5-32b-instruct", {
  provider: "qwen",
  name: "Qwen2.5 32B Instruct",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Instruction-tuned variant of the latest Qwen large language model series with enhanced instruction-following capabilities, improved coding and mathematics proficiency, and robust handling of structured data.",
  costs: {
    input: 0.79,
    output: 0.79,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "code",
    "mathematics",
    "structured_data",
    "long_context",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar performance model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multilingual model with long context support",
    modelArchitecture: {
      parameters: "32.5B",
      type: "instruction-tuned",
      generation: "2.5",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-03-03",
    },
    languageSupport: [
      "english",
      "chinese",
      "french",
      "spanish",
      "portuguese",
      "german",
      "italian",
      "russian",
      "japanese",
      "korean",
      "vietnamese",
      "thai",
      "arabic",
    ],
    domainExpertise: {
      coding: 8,
      mathematics: 8,
      general: 7,
      multilingual: 8,
      structured_data: 7,
    },
    bestFor: [
      "multilingual applications",
      "coding tasks",
      "mathematical reasoning",
      "structured data handling",
      "long context processing",
      "JSON generation",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "chinese",
        "cyrillic",
        "japanese",
        "korean",
        "arabic",
        "thai",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "response_format",
      "top_logprobs",
      "logprobs",
      "logit_bias",
      "seed",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["response_format", "logprobs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "code-documentation",
      "mathematical-content",
      "complex-structured-data",
    ],
    warnings: [
      "Ensure appropriate context for long documents",
      "Provide clear instructions for structured outputs",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen2.5 32B Instruct - Multilingual model with 131K context",
      parameterSection: "Parameter controls for Qwen2.5 model",
      statusMessages: {
        processing: "Processing request with Qwen model",
        complete: "Response ready from Qwen model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("perplexity/sonar-deep-research", {
  provider: "perplexity",
  name: "Sonar Deep Research",
  category: "ResearchAssistant",
  disabled: false,
  description:
    "Research-focused model designed for multi-step retrieval, synthesis, and reasoning across complex topics. Autonomously searches, reads, and evaluates sources to generate comprehensive reports.",
  costs: {
    input: 2.0,
    output: 8.0,
    // Additional cost information provided
    additionalCosts: {
      searches: 5.0, // $5 per 1000 searches
      reasoning: 3.0, // $3 per 1M reasoning tokens
    },
  },
  capabilities: [
    "text",
    "research",
    "citation",
    "synthesis",
    "reasoning",
    "multi_step",
    "source_evaluation",
    "long_context",
  ],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3-opus-20240229", // Similar high-capability research model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced research and synthesis model with source evaluation",
    modelArchitecture: {
      type: "research-focused",
      generation: "sonar",
    },
    policyLinks: {
      privacyPolicy: "https://www.perplexity.ai/privacy",
      termsOfService: "https://www.perplexity.ai/terms",
      lastUpdated: "2025-03-07",
    },
    domainExpertise: {
      research: 9,
      synthesis: 9,
      citation: 8,
      reasoning: 8,
      finance: 7,
      technology: 7,
      health: 7,
      current_events: 8,
    },
    bestFor: [
      "comprehensive research reports",
      "multi-source synthesis",
      "complex topic analysis",
      "domain-specific research",
      "source evaluation",
      "literature review",
    ],
    accessibility: {
      multilingualSupport: true,
      citationFormat: true,
      structuredOutput: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "top_k",
      "frequency_penalty",
      "presence_penalty",
      "system-prompt", // Adding system-prompt support
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.5,
        p90: 0.8,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 10,
        p50: 40,
        p90: 50,
      },
    },
    features: ["reasoning", "include_reasoning", "system-prompt"],
    unique: ["reasoning", "include_reasoning"],
  },
  accessibility: {
    preferredFor: [
      "research-synthesis",
      "document-analysis",
      "source-validation",
      "comprehensive-reports",
    ],
    warnings: [
      "Costs may increase significantly with multiple searches",
      "Consider limiting search depth for cost-sensitive applications",
      "Provide clear research questions for optimal results",
      "Specify citation format needs explicitly",
    ],
    ariaLabels: {
      modelSelect:
        "Perplexity Sonar Deep Research - Research-focused model with 200K context",
      parameterSection: "Parameter controls for Sonar Deep Research model",
      statusMessages: {
        processing: "Conducting research with Sonar Deep Research model",
        searching: "Performing searches and evaluating sources",
        reasoning: "Synthesizing information from sources",
        complete: "Research report ready from Sonar model",
      },
    },
    pricingDisclosures: [
      "Input tokens include both user prompt and citation processing",
      "Additional costs apply for searches ($5 per 1000 searches)",
      "Separate reasoning costs of $3 per million tokens",
    ],
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("perplexity/sonar-pro", {
  provider: "perplexity",
  name: "Sonar Pro",
  category: "Research", // Categorizing as Research based on its capabilities
  disabled: false,
  description:
    "Advanced model with extensive search capabilities, double the citations per search, and a large context window for handling nuanced searches and follow-up questions.",
  costs: {
    input: 3.0,
    output: 15.0,
  },
  capabilities: [
    "text",
    "dialogue",
    "search",
    "citations",
    "long_context",
    "research",
  ],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3-5-sonnet", // Similar premium model with research capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced search and research model with extensive citation capabilities",
    modelArchitecture: {
      type: "search-optimized",
      generation: "Pro",
    },
    policyLinks: {
      privacyPolicy: "https://www.perplexity.ai/privacy",
      termsOfService: "https://www.perplexity.ai/terms",
      lastUpdated: "2025-03-07",
    },
    languageSupport: ["english"],
    domainExpertise: {
      research: 9,
      search: 9,
      general: 8,
      citation: 9,
    },
    bestFor: [
      "in-depth research",
      "multi-step queries",
      "citation-heavy content",
      "extended research sessions",
      "nuanced searches",
      "follow-up questions",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: true,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "frequency_penalty",
      "presence_penalty",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.8,
        p50: 0.95,
        p90: 1.0,
      },
      top_k: {
        p10: 30,
        p50: 50,
        p90: 100,
      },
    },
    features: ["system-prompt", "top_k"],
  },
  accessibility: {
    preferredFor: [
      "research-content",
      "factual-queries",
      "citation-needed-content",
      "complex-information-seeking",
    ],
    warnings: [
      "Higher cost per token - use judiciously for research tasks",
      "Consider Medium or Low search context modes for cost savings",
      "Citations may require manual verification",
    ],
    ariaLabels: {
      modelSelect: "Sonar Pro - Advanced research model with 200K context",
      parameterSection: "Parameter controls for Sonar Pro model",
      statusMessages: {
        processing: "Processing research request with Sonar Pro",
        complete: "Research response ready from Sonar Pro",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("perplexity/sonar-reasoning-pro", {
  provider: "perplexity",
  name: "Sonar Reasoning Pro",
  category: "ReasoningModels", // You might need to create this category if it doesn't exist
  disabled: false,
  description:
    "Premier reasoning model powered by DeepSeek R1 with Chain of Thought (CoT). Designed for advanced use cases with in-depth, multi-step queries and comprehensive citations.",
  costs: {
    input: 2.0, // $2/M input tokens
    output: 8.0, // $8/M output tokens
  },
  capabilities: ["text", "reasoning", "search", "citations", "long_context"],
  maxContext: 128000,
  fallbackTo: "anthropic/claude-3-5-sonnet", // Similar reasoning capability model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with real-time search capabilities",
    modelArchitecture: {
      baseModel: "DeepSeek R1",
      type: "reasoning-enhanced",
      features: ["Chain of Thought", "Internet search", "Citations"],
    },
    policyLinks: {
      privacyPolicy: "https://www.perplexity.ai/privacy",
      acceptableUse: "https://www.perplexity.ai/acceptable-use",
      termsOfService: "https://www.perplexity.ai/terms",
      lastUpdated: "2025-03-07",
    },
    languageSupport: [
      "english", // Primary language support
    ],
    domainExpertise: {
      reasoning: 9,
      research: 8,
      analysis: 8,
      factual_knowledge: 9,
      current_events: 8,
    },
    bestFor: [
      "complex reasoning tasks",
      "real-time research",
      "factual analysis",
      "in-depth investigations",
      "cited responses",
      "market analysis",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: true,
      scriptSupport: ["latin"],
      citationSupport: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "top_k",
      "frequency_penalty",
      "presence_penalty",
      "system-prompt", // Added system-prompt for consistency
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      temperature: {
        p10: 0.2,
        p50: 0.7,
        p90: 0.9,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 10,
        p50: 40,
        p90: 80,
      },
    },
    features: ["reasoning", "include_reasoning", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "research-based-content",
      "fact-checking",
      "complex-analysis",
      "market-reports",
    ],
    warnings: [
      "Citations should be verified for accessibility",
      "Search results may contain mixed content accessibility",
      "Ensure appropriate context for reasoning paths",
    ],
    ariaLabels: {
      modelSelect:
        "Sonar Reasoning Pro - Advanced reasoning model with citations",
      parameterSection: "Parameter controls for Sonar Reasoning Pro model",
      statusMessages: {
        processing:
          "Processing research and reasoning request with Sonar Reasoning Pro",
        complete:
          "Research and reasoning response ready from Sonar Reasoning Pro",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("microsoft/phi-4-multimodal-instruct", {
  provider: "microsoft",
  name: "Phi 4 Multimodal Instruct",
  category: "MultimodalVision",
  disabled: false,
  description:
    "A versatile 5.6B parameter foundation model combining advanced reasoning and instruction-following capabilities across both text and visual inputs, optimised for edge and mobile deployments.",
  costs: {
    input: 0.05,
    output: 0.1,
    image: 0.1769, // per 1K images
  },
  capabilities: [
    "text",
    "images",
    "speech",
    "multilingual",
    "mathematics",
    "science",
    "document_reasoning",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3-5-sonnet", // Similar multimodal performance model
  isFree: false,
  metadata: {
    categoryDescription:
      "Multimodal model with vision, text, and audio capabilities",
    modelArchitecture: {
      parameters: "5.6B",
      type: "multimodal-instruct",
      generation: "4",
    },
    policyLinks: {
      privacyPolicy:
        "https://learn.microsoft.com/en-us/legal/cognitive-services/openai/data-privacy",
      acceptableUse: "https://www.microsoft.com/en-us/servicesagreement/",
      termsOfService:
        "https://www.microsoft.com/en-us/licensing/product-licensing/products",
      lastUpdated: "2025-03-08",
    },
    languageSupport: [
      "english",
      "arabic",
      "chinese",
      "french",
      "german",
      "japanese",
      "spanish",
    ],
    domainExpertise: {
      vision: 8,
      speech: 8,
      mathematics: 9,
      science: 8,
      document_reasoning: 8,
      multilingual: 7,
    },
    bestFor: [
      "edge computing",
      "mobile applications",
      "document analysis",
      "mathematical reasoning",
      "chart understanding",
      "multimodal processing",
      "speech recognition",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "arabic", "chinese", "japanese"],
      speechToText: true,
      imageUnderstanding: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
    },
    features: [
      "response_format",
      "top_k",
      "min_p",
      "system-prompt",
      "multimodal",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-impairment-assistance",
      "mathematical-content",
      "multilingual-content",
      "document-processing",
      "mobile-applications",
    ],
    warnings: [
      "Visual input optimised primarily for English content",
      "May require optimisation for edge deployment scenarios",
    ],
    ariaLabels: {
      modelSelect:
        "Phi 4 Multimodal Instruct - Vision and text model with 131K context",
      parameterSection: "Parameter controls for Phi 4 Multimodal model",
      statusMessages: {
        processing: "Processing multimodal request with Phi 4 model",
        complete: "Response ready from Phi 4 Multimodal model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("thedrummer/skyfall-36b-v2", {
  provider: "thedrummer",
  name: "Skyfall 36B V2",
  category: "Creative", // Categorizing as Creative based on its capabilities
  disabled: false,
  description:
    "Enhanced iteration of Mistral Small 2501, fine-tuned for improved creativity, nuanced writing, role-playing, and coherent storytelling.",
  costs: {
    input: 0.5,
    output: 0.5,
  },
  capabilities: [
    "text",
    "creative_writing",
    "storytelling",
    "roleplay",
    "dialogue",
  ],
  maxContext: 32768,
  fallbackTo: "anthropic/claude-3-sonnet", // Similar creative-oriented model
  isFree: false,
  metadata: {
    categoryDescription: "Specialised model for creative content generation",
    modelArchitecture: {
      parameters: "36B",
      type: "fine-tuned",
      baseModel: "Mistral Small 2501",
      version: "2",
    },
    policyLinks: {
      privacyPolicy: "",
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-03-10",
    },
    languageSupport: ["english"],
    domainExpertise: {
      creative_writing: 9,
      roleplay: 9,
      storytelling: 9,
      general: 7,
    },
    bestFor: [
      "creative writing",
      "narrative development",
      "character roleplay",
      "dialogue generation",
      "story continuation",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "presence_penalty",
      "frequency_penalty",
      "repetition_penalty",
      "top_k",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0.1,
        p90: 0.3,
      },
      presence_penalty: {
        p10: 0,
        p50: 0.1,
        p90: 0.3,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.3,
      },
      temperature: {
        p10: 0.7,
        p50: 0.9,
        p90: 1.2,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 40,
        p50: 60,
        p90: 100,
      },
    },
    features: ["repetition_penalty", "top_k", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "creative-writing",
      "narrative-development",
      "character-dialogue",
      "roleplay-scenarios",
    ],
    warnings: [
      "Optimised for creative content rather than factual accuracy",
      "May exhibit narrative bias in storytelling",
    ],
    ariaLabels: {
      modelSelect: "Skyfall 36B V2 - Creative writing and roleplaying model",
      parameterSection: "Parameter controls for Skyfall creative model",
      statusMessages: {
        processing: "Generating creative content with Skyfall model",
        complete: "Creative response ready from Skyfall model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("latitudegames/wayfarer-large-70b-llama-3.3", {
  provider: "latitudegames",
  name: "Wayfarer Large 70B Llama 3.3",
  category: "CreativeWriting", // Most appropriate category for a roleplay/text-adventure model
  disabled: false,
  description:
    "A roleplay and text-adventure model fine-tuned from Meta's Llama-3.3-70B-Instruct. Optimized for narrative-driven scenarios with realistic stakes, conflicts, and consequences.",
  costs: {
    input: 0.7,
    output: 0.7,
  },
  capabilities: [
    "text",
    "storytelling",
    "roleplay",
    "narrative",
    "gaming",
    "interactive_fiction",
    "long_context",
  ],
  maxContext: 128000,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Falls back to its base model
  isFree: false,
  metadata: {
    categoryDescription: "Specialized narrative and roleplay model",
    modelArchitecture: {
      parameters: "70B",
      type: "fine-tuned",
      baseModel: "Meta's Llama-3.3-70B-Instruct",
    },
    policyLinks: {
      privacyPolicy: "https://latitude.io/privacy", // Replace with actual URL when available
      acceptableUse: "https://latitude.io/acceptable-use", // Replace with actual URL when available
      termsOfService: "https://latitude.io/terms", // Replace with actual URL when available
      lastUpdated: "2025-03-10",
    },
    languageSupport: ["english"],
    domainExpertise: {
      storytelling: 9,
      roleplay: 9,
      gaming: 8,
      narrative: 9,
      general: 6,
    },
    bestFor: [
      "interactive fiction",
      "text adventure games",
      "roleplay scenarios",
      "narrative-driven applications",
      "gaming experiences",
      "storytelling with consequences",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "presence_penalty",
      "frequency_penalty",
      "repetition_penalty",
      "top_k",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0.1,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0.1,
        p90: 0.5,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.05,
        p90: 1.2,
      },
      temperature: {
        p10: 0.7,
        p50: 0.8,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 40,
        p50: 50,
        p90: 100,
      },
    },
    features: ["top_k", "repetition_penalty", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "interactive-storylines",
      "game-narrative",
      "roleplay-scenarios",
      "fiction-writing",
    ],
    warnings: [
      "May create challenging narrative scenarios",
      "Best used with clear instructions for the desired fiction style",
      "Designed to include consequences and conflicts in stories",
    ],
    ariaLabels: {
      modelSelect:
        "Wayfarer Large 70B - Narrative and roleplay model with 128K context",
      parameterSection: "Parameter controls for Wayfarer storytelling model",
      statusMessages: {
        processing: "Creating narrative with Wayfarer model",
        complete: "Story ready from Wayfarer model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("thedrummer/anubis-pro-105b-v1", {
  provider: "thedrummer",
  name: "Anubis Pro 105B V1",
  category: "CreativeWriting", // Based on the description focusing on narrative and roleplay
  disabled: false,
  description:
    "An expanded and refined variant of Meta's Llama 3.3 70B with 50% additional layers, enhanced for narrative, roleplay, and instructional tasks with superior emotional intelligence and creativity.",
  costs: {
    input: 0.8,
    output: 0.8,
  },
  capabilities: [
    "text",
    "dialogue",
    "creative_writing",
    "roleplay",
    "emotional_intelligence",
    "reasoning",
  ],
  maxContext: 64000,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Based on its origin from this model
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialised for creative writing, narrative and roleplay scenarios",
    modelArchitecture: {
      parameters: "105B",
      type: "fine-tuned",
      generation: "1.0",
      baseModel: "Meta's Llama 3.3 70B (expanded)",
    },
    policyLinks: {
      privacyPolicy: "",
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-03-10",
    },
    languageSupport: ["english"],
    domainExpertise: {
      creative_writing: 9,
      roleplay: 9,
      instruction_following: 8,
      emotional_intelligence: 8,
      dialogue: 8,
      reasoning: 7,
    },
    bestFor: [
      "creative writing",
      "character roleplay",
      "narrative generation",
      "emotionally nuanced interactions",
      "extended reasoning tasks",
      "instructional scenarios",
    ],
    accessibility: {
      multilingualSupport: false, // No specific mention of multilingual capabilities
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "presence_penalty",
      "frequency_penalty",
      "repetition_penalty",
      "system-prompt", // Added system-prompt as standard
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.03,
        p90: 1.1,
      },
      temperature: {
        p10: 0.7,
        p50: 0.8,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1.0,
      },
      top_k: {
        p10: 40,
        p50: 50,
        p90: 100,
      },
    },
    features: ["system-prompt", "top_k", "repetition_penalty"],
  },
  accessibility: {
    preferredFor: [
      "creative-writing",
      "roleplay-scenarios",
      "character-development",
      "narrative-content",
      "emotionally-nuanced-content",
    ],
    warnings: [
      "May produce verbose responses for creative tasks",
      "Optimised for narrative rather than factual content",
      "Provide clear character parameters for roleplay scenarios",
    ],
    ariaLabels: {
      modelSelect:
        "Anubis Pro 105B V1 - Specialised for creative writing and roleplay",
      parameterSection: "Parameter controls for Anubis Pro model",
      statusMessages: {
        processing: "Processing creative writing request with Anubis Pro model",
        complete: "Creative response ready from Anubis Pro model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("google/gemma-3-27b-it", {
  provider: "google",
  name: "Gemma 3 27B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Google's latest open source multimodal model that supports vision-language input with text outputs, handles up to 128k token context windows, and offers improved math, reasoning, and chat capabilities.",
  costs: {
    input: 0.1,
    output: 0.2,
    image: 0.0256, // per 1K images
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "multimodal",
    "vision",
    "mathematics",
    "reasoning",
    "structured_output",
    "function_calling",
    "long_context",
  ],
  maxContext: 131072,
  fallbackTo: "google/gemini-pro", // Similar model from same provider
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal model with extensive language support",
    modelArchitecture: {
      parameters: "27B",
      type: "instruction-tuned",
      generation: "3",
    },
    policyLinks: {
      privacyPolicy: "https://policies.google.com/privacy",
      acceptableUse: "https://policies.google.com/terms/service-specific",
      termsOfService: "https://policies.google.com/terms",
      lastUpdated: "2025-03-12",
    },
    languageSupport: ["multilingual", "140+ languages"],
    domainExpertise: {
      vision: 8,
      mathematics: 7,
      reasoning: 8,
      general: 8,
      multilingual: 9,
      structured_data: 7,
    },
    bestFor: [
      "multimodal applications",
      "image understanding",
      "multilingual tasks",
      "mathematical reasoning",
      "structured outputs",
      "function calling",
      "long context processing",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["multiple scripts", "140+ languages"],
      imageDescriptionCapability: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
      temperature: {
        p10: 0.2,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
    },
    features: ["response_format", "multimodal", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "image-understanding",
      "multilingual-content",
      "mathematical-content",
      "structured-outputs",
    ],
    warnings: [
      "Provide clear alt text for images when used with vision capabilities",
      "Consider language complexity when using multiple languages",
    ],
    ariaLabels: {
      modelSelect: "Gemma 3 27B - Multimodal model with 131K context",
      parameterSection: "Parameter controls for Gemma 3 model",
      statusMessages: {
        processing: "Processing request with Gemma model",
        complete: "Response ready from Gemma model",
        imageProcessing: "Analysing image with Gemma model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("google/gemma-3-27b-it:free", {
  provider: "google",
  name: "Gemma 3 27B (free)",
  category: "GeneralPurpose",
  disabled: true,
  description:
    "Google's latest open source model with multimodality support, 96K context window, and improved math, reasoning, and chat capabilities.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "code",
    "mathematics",
    "structured_data",
    "vision",
    "long_context",
  ],
  maxContext: 96000,
  fallbackTo: "mistralai/mistral-large-2:latest", // Similar performance model
  isFree: true,
  metadata: {
    categoryDescription: "Multimodal model with extensive language support",
    modelArchitecture: {
      parameters: "27B",
      type: "instruction-tuned",
      generation: "3",
    },
    policyLinks: {
      privacyPolicy: "https://ai.google.dev/gemma/docs/privacy",
      acceptableUse: "https://ai.google.dev/gemma/docs/use-policy",
      termsOfService: "https://ai.google.dev/gemma/terms",
      lastUpdated: "2025-03-12",
    },
    languageSupport: [
      "over 140 languages", // Specific languages not enumerated in the description
    ],
    domainExpertise: {
      coding: 7,
      mathematics: 8,
      general: 8,
      multilingual: 9,
      structured_data: 8,
      vision: 7,
    },
    bestFor: [
      "multilingual applications",
      "vision-language tasks",
      "mathematical reasoning",
      "structured outputs",
      "function calling",
      "long context processing",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      visionSupport: true,
      scriptSupport: [
        "latin",
        "chinese",
        "cyrillic",
        "japanese",
        "korean",
        "arabic",
        "thai",
        "devanagari",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 40,
        p50: 40,
        p90: 40,
      },
      min_p: {
        p10: 0.05,
        p50: 0.05,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
    },
    features: [
      "structured_outputs",
      "response_format",
      "logprobs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "vision-language-tasks",
      "mathematical-content",
      "complex-structured-data",
    ],
    warnings: [
      "Ensure image descriptions for vision inputs",
      "Provide clear instructions for structured outputs",
    ],
    ariaLabels: {
      modelSelect: "Gemma 3 27B (free) - Multimodal model with 96K context",
      parameterSection: "Parameter controls for Gemma 3 model",
      statusMessages: {
        processing: "Processing request with free Gemma 3 model",
        complete: "Response ready from Gemma 3 model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("rekaai/reka-flash-3:free", {
  provider: "rekaai",
  name: "Reka Flash 3 (free)",
  category: "GeneralPurpose",
  disabled: true,
  description:
    "A general-purpose, instruction-tuned large language model with 21 billion parameters, excelling at general chat, coding tasks, instruction-following, and function calling.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "instruction-following",
    "function-calling",
    "reasoning",
  ],
  maxContext: 32768,
  fallbackTo: "openai/gpt-3.5-turbo", // Similar free model as fallback
  isFree: true,
  metadata: {
    categoryDescription:
      "Free general-purpose model with explicit reasoning capabilities",
    modelArchitecture: {
      parameters: "21B",
      type: "instruction-tuned",
      generation: "3",
    },
    policyLinks: {
      privacyPolicy: "https://reka.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://reka.ai/terms",
      lastUpdated: "2025-03-12",
      license: "Apache 2.0",
    },
    languageSupport: ["english"],
    domainExpertise: {
      coding: 7,
      general: 7,
      reasoning: 8,
      function_calling: 7,
    },
    bestFor: [
      "general chat",
      "coding tasks",
      "instruction-following",
      "function calling",
      "low-latency applications",
      "local deployments",
      "on-device applications",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: true,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 40,
        p50: 60,
        p90: 80,
      },
      min_p: {
        p10: 0.05,
        p50: 0.1,
        p90: 0.2,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "general-content",
      "code-documentation",
      "explicit-reasoning-tasks",
    ],
    warnings: [
      "Limited multilingual capabilities - primarily English focused",
      "May include reasoning tags in output when reasoning parameter is enabled",
    ],
    ariaLabels: {
      modelSelect: "Reka Flash 3 - Free model with explicit reasoning",
      parameterSection: "Parameter controls for Reka Flash model",
      statusMessages: {
        processing: "Processing request with Reka Flash model",
        complete: "Response ready from Reka Flash model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel(
  "tokyotech-llm/llama-3.1-swallow-70b-instruct-v0.3",
  {
    provider: "tokyotech-llm",
    name: "Llama 3.1 Swallow 70B Instruct V0.3",
    category: "GeneralPurpose",
    disabled: false,
    description:
      "Enhanced Llama 3.1 70B model with improved Japanese language capabilities whilst maintaining English language performance. Built through continual pre-training and instruction tuning with Japanese-focused data.",
    costs: {
      input: 0.6,
      output: 1.2,
    },
    capabilities: [
      "text",
      "multilingual",
      "dialogue",
      "code",
      "mathematics",
      "japanese",
    ],
    maxContext: 16384,
    fallbackTo: "meta-llama/llama-3.1-70b-instruct", // Similar base model
    isFree: false,
    metadata: {
      categoryDescription: "Multilingual model with Japanese specialisation",
      modelArchitecture: {
        parameters: "70B",
        type: "instruction-tuned",
        base: "Llama 3.1",
        version: "0.3",
      },
      policyLinks: {
        privacyPolicy: "",
        acceptableUse: "",
        termsOfService: "",
        lastUpdated: "2025-03-12",
      },
      languageSupport: ["english", "japanese"],
      domainExpertise: {
        coding: 7,
        mathematics: 7,
        general: 7,
        japanese: 9,
        english: 8,
      },
      bestFor: [
        "japanese language processing",
        "bilingual applications (Japanese/English)",
        "coding tasks",
        "mathematical content",
      ],
      accessibility: {
        multilingualSupport: true,
        languageDetection: true,
        scriptSupport: ["latin", "japanese"],
      },
    },
    parameterSupport: {
      supported: [
        "max_tokens",
        "temperature",
        "top_p",
        "top_k",
        "stop",
        "system-prompt", // Added system-prompt as standard
      ],
      statistics: {
        temperature: {
          p10: 0.1,
          p50: 0.7,
          p90: 1.0,
        },
        top_p: {
          p10: 0.9,
          p50: 1.0,
          p90: 1.0,
        },
        top_k: {
          p10: 40,
          p50: 80,
          p90: 100,
        },
      },
      features: ["top_k", "system-prompt"],
    },
    accessibility: {
      preferredFor: [
        "japanese-content",
        "japanese-english-bilingual",
        "code-documentation",
        "mathematical-content",
      ],
      warnings: [
        "Set appropriate language in system prompt for best results",
        "Consider context window limitations for lengthy Japanese text",
      ],
      ariaLabels: {
        modelSelect:
          "Llama 3.1 Swallow 70B - Japanese-specialised model with 16K context",
        parameterSection: "Parameter controls for Swallow model",
        statusMessages: {
          processing: "Processing request with Swallow model",
          complete: "Response ready from Swallow model",
        },
      },
    },
    status: {
      isAvailable: true,
      lastCheck: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
    },
  },
);

// Add this after your existing model registrations but before validateAllFallbacks()

modelRegistry.registerModel("openai/gpt-4o-search-preview", {
  provider: "openai",
  name: "GPT-4o Search Preview",
  category: "SearchSpecialist", // You may need to add this category if it doesn't exist
  disabled: false,
  description:
    "Specialized model for web search in Chat Completions, trained to understand and execute web search queries.",
  costs: {
    input: 2.5,
    output: 10,
    images: {
      input: 3.613, // per 1000 images
    },
    requests: 35, // per 1000 requests
  },
  capabilities: [
    "text",
    "search",
    "web_search",
    "structured_outputs",
    "long_context",
  ],
  maxContext: 128000,
  fallbackTo: "openai/gpt-4o", // Similar base model as fallback
  isFree: false,
  metadata: {
    categoryDescription: "Specialized web search model",
    modelArchitecture: {
      type: "search-focused",
      generation: "4o",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/policies/privacy-policy",
      acceptableUse: "https://openai.com/policies/usage-policies",
      termsOfService: "https://openai.com/policies/terms-of-use",
      lastUpdated: "2025-03-12",
    },
    languageSupport: ["english", "multilingual"],
    domainExpertise: {
      web_search: 9,
      information_retrieval: 9,
      general: 8,
    },
    bestFor: [
      "web search integration",
      "information retrieval",
      "research assistance",
      "query understanding",
      "structured outputs",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added system-prompt as you mentioned previously
    ],
    statistics: {
      temperature: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
    features: ["structured_outputs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "search-assistance",
      "research-tasks",
      "information-retrieval",
      "query-translation",
    ],
    warnings: [
      "Limited parameter support compared to standard GPT-4o",
      "Optimized for search queries, may have reduced creative capabilities",
    ],
    ariaLabels: {
      modelSelect: "GPT-4o Search Preview - Specialized web search model",
      parameterSection: "Parameter controls for GPT-4o Search Preview model",
      statusMessages: {
        processing: "Processing search query with GPT-4o Search Preview",
        complete: "Search results ready from GPT-4o Search Preview",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("openai/gpt-4o-mini-search-preview", {
  provider: "openai",
  name: "GPT-4o-mini Search Preview",
  category: "SearchSpecialist", // Assuming you have or want to create this category
  disabled: false,
  description:
    "Specialized model for web search in Chat Completions, trained to understand and execute web search queries.",
  costs: {
    input: 0.15,
    output: 0.6,
    image: 0.217, // per 1000 input images
    requests: 27.5, // per 1000 requests
  },
  capabilities: ["text", "search", "structured_outputs"],
  maxContext: 128000,
  fallbackTo: "openai/gpt-4o", // Similar OpenAI model
  isFree: false,
  metadata: {
    categoryDescription:
      "AI specialized for search interactions and query processing",
    modelArchitecture: {
      parameters: "Unknown",
      type: "search-specialized",
      generation: "4o-mini",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/policies/privacy-policy",
      acceptableUse: "https://openai.com/policies/usage-policies",
      termsOfService: "https://openai.com/policies/terms-of-use",
      lastUpdated: "2025-03-12",
    },
    languageSupport: [
      "english",
      // Add other languages if known
    ],
    domainExpertise: {
      search: 9,
      general: 7,
      structured_data: 7,
    },
    bestFor: [
      "web search integration",
      "query understanding",
      "search result processing",
      "structured outputs",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin"], // Add others if supported
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      temperature: {
        p10: 0.0,
        p50: 0.0,
        p90: 0.0,
      },
      // No statistics provided for other parameters
    },
    features: ["response_format", "structured_outputs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "search-related-queries",
      "information-retrieval",
      "structured-outputs",
    ],
    warnings: [
      "Limited parameter options compared to standard models",
      "Specialized for search queries rather than general conversation",
    ],
    ariaLabels: {
      modelSelect: "GPT-4o-mini Search Preview - Web search specialist model",
      parameterSection:
        "Limited parameter controls for search specialist model",
      statusMessages: {
        processing: "Processing search request with GPT-4o-mini",
        complete: "Search results ready from GPT-4o-mini",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("cohere/command-a", {
  provider: "cohere",
  name: "Command A",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "An open-weights 111B parameter model with a 256k context window focused on delivering great performance across agentic, multilingual, and coding use cases, excelling in business-critical tasks.",
  costs: {
    input: 2.5,
    output: 10,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "code",
    "agentic",
    "long_context",
    "structured_outputs",
  ],
  maxContext: 256000,
  fallbackTo: "anthropic/claude-3-opus", // Similar high-performance model
  isFree: false,
  metadata: {
    categoryDescription:
      "High-capacity agentic model with extensive multilingual support",
    modelArchitecture: {
      parameters: "111B",
      type: "open-weights",
    },
    policyLinks: {
      privacyPolicy: "https://cohere.com/privacy",
      acceptableUse: "https://cohere.com/acceptable-use",
      termsOfService: "https://cohere.com/terms",
      lastUpdated: "2025-03-13",
    },
    languageSupport: ["english", "multilingual"],
    domainExpertise: {
      coding: 8,
      general: 8,
      multilingual: 9,
      agentic: 9,
      structured_data: 8,
    },
    bestFor: [
      "agentic applications",
      "multilingual content",
      "coding applications",
      "complex reasoning",
      "business operations",
      "structured outputs",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "seed",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added system-prompt
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 1,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.5,
      },
      top_p: {
        p10: 0.5,
        p50: 0.9,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
    },
    features: [
      "response_format",
      "structured_outputs",
      "system-prompt",
      "top_k",
    ],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "code-generation",
      "agentic-tasks",
      "structured-data-tasks",
    ],
    warnings: [
      "Higher cost for output tokens - consider for high-value tasks",
      "Long context window may require careful prompt engineering",
    ],
    ariaLabels: {
      modelSelect:
        "Cohere Command A - 111B parameter multilingual and agentic model",
      parameterSection: "Parameter controls for Command A model",
      statusMessages: {
        processing: "Processing request with Command A model",
        complete: "Response ready from Command A model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

// Find where other models are registered and add this new model registration

modelRegistry.registerModel("google/gemma-3-12b-it:free", {
  provider: "google",
  name: "Gemma 3 12B (free)",
  category: "GeneralPurpose",
  disabled: true,
  description:
    "Multimodal model supporting vision-language input with text outputs, handling context windows up to 128k tokens, and understanding over 140 languages, with improved math, reasoning, and chat capabilities.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "vision",
    "multilingual",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "structured_output",
    "function_calling",
    "long_context",
  ],
  maxContext: 131072,
  fallbackTo: "google/gemini-1.5-flash-latest", // Similar Google model
  isFree: true,
  metadata: {
    categoryDescription:
      "Free multimodal model with vision capabilities and long context support",
    modelArchitecture: {
      parameters: "12B",
      type: "instruction-tuned",
      generation: "3",
    },
    policyLinks: {
      privacyPolicy: "https://policies.google.com/privacy",
      acceptableUse: "https://policies.google.com/terms/service-specific",
      termsOfService: "https://policies.google.com/terms",
      lastUpdated: "2025-03-13",
    },
    languageSupport: ["multilingual", "140+ languages"],
    domainExpertise: {
      coding: 7,
      mathematics: 7,
      general: 8,
      multilingual: 8,
      structured_data: 7,
      vision: 7,
    },
    bestFor: [
      "multimodal applications",
      "vision-language tasks",
      "coding tasks",
      "mathematical reasoning",
      "structured outputs",
      "function calling",
      "long context processing",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      visionSupport: true,
      scriptSupport: ["multiple", "140+ languages"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.0,
        p90: 1.1,
      },
    },
    features: [
      "logprobs",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "code-documentation",
      "mathematical-content",
      "vision-language-tasks",
      "free-tier-applications",
    ],
    warnings: [
      "Free tier may have usage limits",
      "Ensure appropriate prompting for vision tasks",
      "Provide clear instructions for structured outputs",
    ],
    ariaLabels: {
      modelSelect: "Gemma 3 12B - Free multimodal model with 131K context",
      parameterSection: "Parameter controls for Gemma 3 model",
      statusMessages: {
        processing: "Processing request with free Gemma model",
        complete: "Response ready from Gemma model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("ai21/jamba-1.6-mini", {
  provider: "ai21",
  name: "Jamba Mini 1.6",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A hybrid foundation model combining State Space Models (Mamba) with Transformer attention mechanisms, excelling in extremely long-context tasks and superior inference efficiency.",
  costs: {
    input: 0.2,
    output: 0.4,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "structured_data",
    "long_context",
    "tool_use",
    "json",
  ],
  maxContext: 256000,
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Similar performance model with long context
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient hybrid model with extensive long context support",
    modelArchitecture: {
      parameters: "12B active (52B total)",
      type: "hybrid",
      architecture: "Mamba + Transformer",
      generation: "1.6",
    },
    policyLinks: {
      privacyPolicy: "https://www.ai21.com/privacy-policy",
      acceptableUse: "https://www.ai21.com/acceptable-use",
      termsOfService: "https://www.ai21.com/terms-of-use",
      lastUpdated: "2025-03-13",
    },
    languageSupport: [
      "english",
      "spanish",
      "french",
      "portuguese",
      "italian",
      "dutch",
      "german",
      "arabic",
      "hebrew",
    ],
    domainExpertise: {
      rag: 8,
      question_answering: 8,
      general: 7,
      multilingual: 7,
      structured_data: 7,
      tool_use: 7,
    },
    bestFor: [
      "retrieval-augmented generation",
      "grounded question answering",
      "long context processing",
      "JSON generation",
      "tool use integration",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "arabic", "hebrew"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "system-prompt", // Added system-prompt for consistency
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["tools", "tool_choice", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "long-document-processing",
      "question-answering",
      "tool-integration",
    ],
    warnings: [
      "Configure appropriate tool schemas for best results",
      "Consider response time with very long contexts",
    ],
    ariaLabels: {
      modelSelect: "AI21 Jamba Mini 1.6 - Hybrid model with 256K context",
      parameterSection: "Parameter controls for Jamba Mini model",
      statusMessages: {
        processing: "Processing request with Jamba Mini model",
        complete: "Response ready from Jamba Mini model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("ai21/jamba-1.6-large", {
  provider: "ai21",
  name: "Jamba 1.6 Large",
  category: "AdvancedModel",
  disabled: false,
  description:
    "High-performance hybrid foundation model combining State Space Models (Mamba) with Transformer attention mechanisms, excelling in extremely long-context handling and structured outputs.",
  costs: {
    input: 2,
    output: 8,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "tools",
    "long_context",
    "structured_data",
  ],
  maxContext: 256000,
  fallbackTo: "openai/gpt-4o", // Similar high-performance model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced hybrid model with exceptional long context support",
    modelArchitecture: {
      parameters: "94B active (398B total)",
      type: "hybrid-foundation",
      generation: "1.6",
      architecture: "Mamba + Transformer",
    },
    policyLinks: {
      privacyPolicy: "https://www.ai21.com/privacy-policy",
      termsOfService: "https://www.ai21.com/terms-of-use",
      lastUpdated: "2025-03-13",
    },
    languageSupport: [
      "english",
      "spanish",
      "french",
      "portuguese",
      "italian",
      "dutch",
      "german",
      "arabic",
      "hebrew",
    ],
    domainExpertise: {
      long_context: 9,
      structured_data: 8,
      general: 8,
      multilingual: 7,
      tool_use: 8,
    },
    bestFor: [
      "very long document processing",
      "tool use applications",
      "structured JSON output",
      "high performance needs",
      "enterprise applications",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "arabic", "hebrew"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1.0,
        p90: 1.0,
      },
    },
    features: ["tools", "tool_choice", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "long-document-processing",
      "structured-data-output",
      "complex-tool-interactions",
      "multilingual-content",
    ],
    warnings: [
      "Higher cost for inputs and outputs",
      "Ensure clear tool definitions for best performance",
    ],
    ariaLabels: {
      modelSelect: "Jamba 1.6 Large - Advanced model with 256K context",
      parameterSection: "Parameter controls for Jamba model",
      statusMessages: {
        processing: "Processing request with AI21 Jamba model",
        complete: "Response ready from AI21 Jamba model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

// Find where other models are registered and add this new model registration

modelRegistry.registerModel("google/gemma-3-4b-it:free", {
  provider: "google",
  name: "Gemma 3 4B (free)",
  category: "GeneralPurpose",
  disabled: true,
  description:
    "Gemma 3 introduces multimodality, supporting vision-language input and text outputs. It handles context windows up to 128k tokens, understands over 140 languages, and offers improved math, reasoning, and chat capabilities.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "multimodal",
    "vision",
    "math",
    "reasoning",
    "structured_output",
    "function_calling",
  ],
  maxContext: 131072,
  fallbackTo: "google/gemini-1.5-pro-001", // Similar model from same provider
  isFree: true,
  metadata: {
    categoryDescription:
      "Free multimodal model with vision-language capabilities",
    modelArchitecture: {
      parameters: "4B",
      type: "instruction-tuned",
      generation: "3",
    },
    policyLinks: {
      privacyPolicy: "https://policies.google.com/privacy",
      acceptableUse: "https://policies.google.com/terms/service-specific",
      termsOfService: "https://policies.google.com/terms",
      lastUpdated: "2025-03-13",
    },
    languageSupport: [
      "multilingual", // 140+ languages according to description
    ],
    domainExpertise: {
      vision: 7,
      mathematics: 7,
      general: 6,
      multilingual: 8,
      structured_data: 7,
    },
    bestFor: [
      "free applications",
      "multimodal tasks",
      "vision-language processing",
      "mathematical reasoning",
      "multilingual content",
      "structured outputs",
      "function calling",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      visionFeatures: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 10,
        p50: 40,
        p90: 100,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
    },
    features: ["logprobs", "system-prompt", "vision-input"],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "image-analysis",
      "vision-language-tasks",
      "mathematical-content",
      "structured-outputs",
    ],
    warnings: [
      "Vision features may require alt text for accessibility",
      "Provide clear textual descriptions for any visual inputs",
    ],
    ariaLabels: {
      modelSelect:
        "Gemma 3 4B - Free multimodal model with vision capabilities",
      parameterSection: "Parameter controls for Gemma 3 model",
      statusMessages: {
        processing: "Processing request with Gemma 3 model",
        complete: "Response ready from Gemma 3 model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("google/gemma-3-1b-it:free", {
  provider: "google",
  name: "Gemma 3 1B (free)",
  category: "GeneralPurpose",
  disabled: true,
  description:
    "The smallest of the new Gemma 3 family. It handles context windows up to 32k tokens, understands over 140 languages, and offers improved math, reasoning, and chat capabilities, including structured outputs and function calling.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "mathematics",
    "reasoning",
    "structured_outputs",
    "function_calling",
  ],
  maxContext: 32000,
  fallbackTo: "meta-llama/llama-3-8b-instruct:free", // Similar performance free model
  isFree: true,
  metadata: {
    categoryDescription:
      "Free lightweight multilingual model with broad language support",
    modelArchitecture: {
      parameters: "1B",
      type: "instruction-tuned",
      generation: "3",
    },
    policyLinks: {
      privacyPolicy: "https://policies.google.com/privacy",
      acceptableUse: "https://policies.google.com/terms/service-specific",
      termsOfService: "https://policies.google.com/terms",
      lastUpdated: "2025-03-14",
    },
    languageSupport: [
      "english",
      "multilingual", // Supports over 140 languages
    ],
    domainExpertise: {
      coding: 5,
      mathematics: 6,
      general: 6,
      multilingual: 7,
      structured_data: 6,
    },
    bestFor: [
      "lightweight applications",
      "multilingual content",
      "mathematical reasoning",
      "structured outputs",
      "function calling",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "cyrillic",
        "chinese",
        "japanese",
        "korean",
        "arabic",
        "thai",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 10,
        p50: 40,
        p90: 80,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.03,
        p90: 1.1,
      },
    },
    features: ["logprobs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "lightweight-applications",
      "mathematical-reasoning",
      "function-calling",
    ],
    warnings: [
      "Note: This model is not multimodal",
      "Best for simpler tasks due to smaller size",
    ],
    ariaLabels: {
      modelSelect: "Gemma 3 1B - Free multilingual model with 32K context",
      parameterSection: "Parameter controls for Gemma 3 model",
      statusMessages: {
        processing: "Processing request with free Gemma model",
        complete: "Response ready from Gemma model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("allenai/olmo-2-0325-32b-instruct", {
  provider: "allenai",
  name: "Olmo 2 32B Instruct",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A supervised instruction-finetuned model excelling in complex reasoning and instruction-following tasks across diverse benchmarks.",
  costs: {
    input: 1.0,
    output: 1.5,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "instruction_following",
    "mathematics",
  ],
  maxContext: 4096,
  fallbackTo: "anthropic/claude-3-haiku", // Similar performance model
  isFree: false,
  metadata: {
    categoryDescription:
      "Research-oriented model with strong reasoning capabilities",
    modelArchitecture: {
      parameters: "32B",
      type: "instruction-finetuned",
      generation: "2",
      release: "March 2025",
    },
    policyLinks: {
      privacyPolicy: "https://allenai.org/privacy-policy",
      acceptableUse: "https://allenai.org/acceptable-use",
      termsOfService: "https://allenai.org/terms",
      lastUpdated: "2025-03-14",
    },
    languageSupport: ["english"],
    domainExpertise: {
      reasoning: 8,
      mathematics: 7,
      general: 7,
      instruction_following: 8,
    },
    bestFor: [
      "complex reasoning tasks",
      "mathematical problem solving",
      "instruction following",
      "research applications",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "presence_penalty",
      "frequency_penalty",
      "repetition_penalty",
      "top_k",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
      temperature: {
        p10: 0.2,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.8,
        p50: 0.9,
        p90: 1.0,
      },
      top_k: {
        p10: 20,
        p50: 40,
        p90: 100,
      },
    },
    features: ["repetition_penalty", "top_k", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning",
      "mathematical-problems",
      "research-applications",
    ],
    warnings: [
      "Limited multilingual capabilities",
      "Optimised primarily for English content",
      "Moderate context length of 4096 tokens",
    ],
    ariaLabels: {
      modelSelect:
        "Olmo 2 32B Instruct - Reasoning-focused model with 4K context",
      parameterSection: "Parameter controls for Olmo 2 model",
      statusMessages: {
        processing: "Processing request with Olmo 2 model",
        complete: "Response ready from Olmo 2 model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("steelskull/l3.3-electra-r1-70b", {
  provider: "steelskull",
  name: "L3.3 Electra R1 70B",
  category: "CreativeWriting", // Assuming the best category based on character insights focus
  disabled: false,
  description:
    "Built on a DeepSeek R1 Distill base, Electra-R1 integrates specialized components for intelligent, coherent responses with deep character insights and advanced reasoning capabilities.",
  costs: {
    input: 0.7,
    output: 0.7,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "character_development",
    "creative_writing",
    "long_context",
  ],
  maxContext: 128000,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar size model
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialized model for character-driven creative content",
    modelArchitecture: {
      parameters: "70B",
      type: "instruction-tuned",
      generation: "L3.3",
      base: "DeepSeek R1 Distill",
    },
    policyLinks: {
      privacyPolicy: "", // Not provided
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-03-15",
    },
    domainExpertise: {
      creative_writing: 9,
      character_development: 9,
      reasoning: 8,
      dialogue: 8,
      general: 7,
    },
    bestFor: [
      "creative writing",
      "character development",
      "narrative exploration",
      "dialogue creation",
      "deep character insights",
      "character motivations",
    ],
    accessibility: {
      multilingualSupport: false, // Not specified in the details
      languageDetection: false, // Not specified in the details
      scriptSupport: ["latin"], // Assuming default support
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "presence_penalty",
      "frequency_penalty",
      "repetition_penalty",
      "top_k",
      "system-prompt", // Added system-prompt as previously requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      temperature: {
        p10: 0.7,
        p50: 0.8,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 40,
        p50: 50,
        p90: 60,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.05,
        p90: 1.1,
      },
    },
    features: ["repetition_penalty", "top_k", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "creative-writing",
      "character-development",
      "narrative-exploration",
      "dialogue-creation",
    ],
    warnings: [
      "Optimized for creative content and character development",
      "May provide detailed character insights that could be verbose for some users",
    ],
    ariaLabels: {
      modelSelect:
        "L3.3 Electra R1 70B - Specialized for character development",
      parameterSection: "Parameter controls for Electra model",
      statusMessages: {
        processing: "Processing request with Electra model",
        complete: "Response ready from Electra model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("open-r1/olympiccoder-32b:free", {
  provider: "open-r1",
  name: "OlympicCoder 32B (free)",
  category: "Code",
  disabled: true,
  description:
    "High-performing open-source model fine-tuned for competitive programming and complex coding tasks with advanced reasoning capabilities.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "code",
    "competitive_programming",
    "reasoning",
    "problem_solving",
    "chain_of_thought",
  ],
  maxContext: 32768,
  fallbackTo: "meta-llama/llama-3-70b-instruct:free", // Similar free model with coding capabilities
  isFree: true,
  metadata: {
    categoryDescription:
      "Specialised free model for competitive programming and algorithmic challenges",
    modelArchitecture: {
      parameters: "32B",
      type: "fine-tuned",
      datasetSize: "~100,000 chain-of-thought programming samples",
    },
    policyLinks: {
      privacyPolicy: "",
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-03-15",
    },
    languageSupport: ["english"],
    domainExpertise: {
      coding: 9,
      competitive_programming: 10,
      algorithms: 9,
      mathematics: 8,
      general: 6,
    },
    bestFor: [
      "competitive programming tasks",
      "algorithm challenges",
      "olympiad programming problems",
      "step-by-step code reasoning",
      "complex problem solving",
      "CodeForces-style challenges",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt as per our requirements
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.6,
        p90: 0.9,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 20,
        p50: 40,
        p90: 80,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.05,
        p90: 1.2,
      },
    },
    features: ["reasoning", "include_reasoning", "logprobs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "code-challenges",
      "programming-competitions",
      "algorithm-explanation",
      "step-by-step-coding",
    ],
    warnings: [
      "Best suited for coding tasks rather than general content",
      "Provides detailed reasoning which may be verbose for simple tasks",
    ],
    ariaLabels: {
      modelSelect: "OlympicCoder 32B - Free competitive programming specialist",
      parameterSection: "Parameter controls for OlympicCoder model",
      statusMessages: {
        processing: "Processing code challenge with OlympicCoder",
        complete: "Code solution ready from OlympicCoder",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("open-r1/olympiccoder-7b:free", {
  provider: "open-r1",
  name: "OlympicCoder 7B (free)",
  category: "CodeGeneration",
  disabled: true,
  description:
    "Open-source language model fine-tuned on competitive programming problems with strong chain-of-thought reasoning and code generation capabilities for olympiad-level coding challenges.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "problem_solving",
    "competitive_programming",
  ],
  maxContext: 32768,
  fallbackTo: "meta-llama/llama-3-8b-instruct:free", // Reasonable free fallback
  isFree: true,
  metadata: {
    categoryDescription:
      "Specialised code generation model for competitive programming",
    modelArchitecture: {
      parameters: "7B",
      type: "fine-tuned",
      baseModel: "OlympicCoder",
      trainingData: "CodeForces-CoTs dataset",
    },
    policyLinks: {
      privacyPolicy: "",
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-03-15",
    },
    languageSupport: ["english"],
    domainExpertise: {
      coding: 9,
      competitive_programming: 9,
      problem_solving: 8,
      general: 5,
      reasoning: 8,
    },
    bestFor: [
      "olympiad-level coding problems",
      "competitive programming",
      "algorithmic challenges",
      "chain-of-thought code reasoning",
      "code competitions",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 40,
        p50: 50,
        p90: 100,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "repetition_penalty",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "competitive-programming",
      "algorithmic-challenges",
      "coding-competitions",
      "learning-to-code",
    ],
    warnings: [
      "Best suited for competitive programming challenges",
      "May include detailed reasoning steps when prompted",
    ],
    ariaLabels: {
      modelSelect:
        "OlympicCoder 7B - Free competitive programming model with 32K context",
      parameterSection: "Parameter controls for OlympicCoder model",
      statusMessages: {
        processing: "Processing code generation with OlympicCoder",
        complete: "Code solution ready from OlympicCoder",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("mistralai/mistral-small-3.1-24b-instruct", {
  provider: "mistralai",
  name: "Mistral Small 3.1 24B Instruct",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Advanced 24B parameter model with multimodal capabilities, supporting text reasoning, vision tasks, programming, and multilingual support with a 128k token context window.",
  costs: {
    input: 0.1,
    output: 0.3,
    image: 0.926, // Per thousand input images
  },
  capabilities: [
    "text",
    "vision",
    "multilingual",
    "dialogue",
    "code",
    "mathematics",
    "long_context",
    "multimodal",
  ],
  maxContext: 128000,
  fallbackTo: "anthropic/claude-3-opus-20240229", // Similar performance model
  isFree: false,
  metadata: {
    categoryDescription:
      "Versatile multimodal model with strong reasoning capabilities",
    modelArchitecture: {
      parameters: "24B",
      type: "instruction-tuned",
      generation: "3.1",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy/",
      acceptableUse: "https://mistral.ai/acceptable-use/",
      termsOfService: "https://mistral.ai/terms/",
      lastUpdated: "2025-03-17",
    },
    domainExpertise: {
      vision: 8,
      coding: 7,
      mathematics: 8,
      general: 8,
      multilingual: 7,
    },
    bestFor: [
      "multimodal applications",
      "image analysis",
      "coding tasks",
      "mathematical reasoning",
      "long document comprehension",
      "privacy-sensitive deployments",
      "function calling",
    ],
    accessibility: {
      multilingualSupport: true,
      visionSupport: true,
      languageDetection: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "presence_penalty",
      "frequency_penalty",
      "repetition_penalty",
      "top_k",
      "stop",
      "response_format",
      "structured_outputs",
      "seed",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["response_format", "structured_outputs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "image-analysis",
      "code-documentation",
      "mathematical-content",
    ],
    warnings: [
      "Provide alt text when submitting images for analysis",
      "Ensure appropriate context for long documents",
      "Provide clear instructions for structured outputs",
    ],
    ariaLabels: {
      modelSelect:
        "Mistral Small 3.1 24B Instruct - Multimodal model with 128K context",
      parameterSection: "Parameter controls for Mistral Small model",
      statusMessages: {
        processing: "Processing request with Mistral model",
        complete: "Response ready from Mistral model",
        processingImage: "Analysing image with Mistral model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("mistralai/mistral-small-3.1-24b-instruct:free", {
  provider: "mistralai",
  name: "Mistral Small 3.1 24B (free)",
  category: "GeneralPurpose",
  disabled: true,
  description:
    "A free 24B parameter model with advanced multimodal capabilities, featuring state-of-the-art performance in text reasoning, vision tasks, programming, and multilingual support.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "code",
    "mathematics",
    "vision",
    "tools",
    "long_context",
  ],
  maxContext: 128000,
  fallbackTo: "anthropic/claude-3-haiku", // Similar performance free model
  isFree: true,
  metadata: {
    categoryDescription:
      "Free multimodal model with tool support and long context",
    modelArchitecture: {
      parameters: "24B",
      type: "instruction-tuned",
      generation: "3.1",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy/",
      acceptableUse: "https://mistral.ai/acceptable-use/",
      termsOfService: "https://mistral.ai/terms/",
      lastUpdated: "2025-03-17",
    },
    languageSupport: [
      "english",
      "french",
      "german",
      "spanish",
      "italian",
      "portuguese",
      "dutch",
      "polish",
      "russian",
      "japanese",
      "chinese",
      "korean",
      "arabic",
    ],
    domainExpertise: {
      coding: 7,
      mathematics: 7,
      general: 7,
      multilingual: 7,
      vision: 6,
      tools: 8,
    },
    bestFor: [
      "conversational agents",
      "function calling",
      "long-document comprehension",
      "privacy-sensitive deployments",
      "image analysis",
      "multilingual applications",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "cyrillic",
        "chinese",
        "japanese",
        "korean",
        "arabic",
      ],
      visionSupport: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt as standard practice
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
    },
    features: ["tools", "tool_choice", "vision", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "cost-sensitive-applications",
      "tool-augmented-chat",
      "image-description",
      "international-audiences",
    ],
    warnings: [
      "Free tier may have rate limitations",
      "Provide clear instructions when using tool calling",
      "Include descriptive alt-text when submitting images",
    ],
    ariaLabels: {
      modelSelect:
        "Mistral Small 3.1 24B - Free model with vision and tool capabilities",
      parameterSection: "Parameter controls for Mistral Small model",
      statusMessages: {
        processing: "Processing request with free Mistral model",
        complete: "Response ready from Mistral model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("featherless/qwerky-72b:free", {
  provider: "featherless",
  name: "Qwerky 72b (free)",
  category: "FreeTier",
  disabled: false,
  description:
    "A linear-attention RWKV variant of the Qwen 2.5 72B model, optimized for reduced computational cost while maintaining competitive performance on standard benchmarks.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "efficient_inference",
    "long_context",
  ],
  maxContext: 32768,
  fallbackTo: "google/gemini-2.0-flash-thinking-experimental:free", // Similar free model
  isFree: true,
  metadata: {
    categoryDescription:
      "Free model with large parameter count and efficient inference",
    modelArchitecture: {
      parameters: "72B",
      type: "RWKV-linear-attention",
      generation: "Qwen 2.5 variant",
    },
    policyLinks: {
      privacyPolicy: "",
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-03-20",
    },
    languageSupport: [
      "english",
      "chinese",
      "french",
      "spanish",
      "portuguese",
      "german",
      "italian",
      "russian",
      "japanese",
      "korean",
      "vietnamese",
      "thai",
      "arabic",
    ],
    domainExpertise: {
      general: 7,
      multilingual: 7,
      efficiency: 9,
    },
    bestFor: [
      "efficient large-context processing",
      "multilingual applications",
      "resource-constrained environments",
      "cost-sensitive applications",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "chinese",
        "cyrillic",
        "japanese",
        "korean",
        "arabic",
        "thai",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "top_k",
      "min_p",
      "seed",
      "system-prompt", // Added system-prompt as previously requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
    },
    features: ["repetition_penalty", "top_k", "min_p", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "resource-constrained-environments",
      "budget-sensitive-applications",
    ],
    warnings: [
      "Free tier may have usage limitations",
      "Response times may vary under high load",
    ],
    ariaLabels: {
      modelSelect: "Qwerky 72b - Free multilingual model with 32K context",
      parameterSection: "Parameter controls for Qwerky model",
      statusMessages: {
        processing: "Processing request with free Qwerky model",
        complete: "Response ready from Qwerky model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("deepseek/deepseek-chat-v3-0324", {
  provider: "deepseek",
  name: "DeepSeek V3 0324",
  category: "SpecializedModels", // Using SpecializedModels due to its finance specialty
  disabled: false,
  description:
    "A 685B-parameter mixture-of-experts model, the latest iteration of the flagship chat model family from the DeepSeek team with strong finance capabilities.",
  costs: {
    input: 0.27,
    output: 1.1,
  },
  capabilities: ["text", "finance", "programming", "tool_use", "long_context"],
  maxContext: 64000,
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Reasonable fallback based on capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialized finance and programming model with long context support",
    modelArchitecture: {
      parameters: "685B",
      type: "mixture-of-experts",
      generation: "V3",
    },
    policyLinks: {
      privacyPolicy: "https://deepseek.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://deepseek.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-03-24",
    },
    domainExpertise: {
      finance: 9,
      programming: 7,
      general: 7,
    },
    bestFor: [
      "financial analysis",
      "financial modelling",
      "coding tasks",
      "tool usage",
    ],
    accessibility: {
      multilingualSupport: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "logprobs",
      "top_logprobs",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "logit_bias",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["tools", "response_format", "logprobs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "financial-content",
      "code-generation",
      "financial-analysis",
    ],
    warnings: [
      "Ensure appropriate context for finance-related queries",
      "Provide clear instructions for tool usage",
    ],
    ariaLabels: {
      modelSelect: "DeepSeek V3 0324 - Finance specialist with 64K context",
      parameterSection: "Parameter controls for DeepSeek V3 model",
      statusMessages: {
        processing: "Processing request with DeepSeek model",
        complete: "Response ready from DeepSeek model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("qwen/qwen2.5-vl-32b-instruct:free", {
  provider: "qwen",
  name: "Qwen2.5 VL 32B Instruct (free)",
  category: "Multimodal",
  disabled: false,
  description:
    "A multimodal vision-language model fine-tuned for enhanced mathematical reasoning, structured outputs, and visual problem-solving capabilities.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "vision",
    "multilingual",
    "mathematics",
    "structured_data",
    "code",
    "image_analysis",
    "video_analysis",
  ],
  maxContext: 8192,
  fallbackTo: "google/gemini-2.0-flash-thinking-experimental", // Similar multimodal capability
  isFree: true,
  metadata: {
    categoryDescription:
      "Free multimodal vision-language model with mathematical reasoning",
    modelArchitecture: {
      parameters: "32B",
      type: "multimodal-instruction-tuned",
      generation: "2.5",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-03-24",
    },
    languageSupport: ["english", "chinese"],
    domainExpertise: {
      vision: 9,
      mathematics: 8,
      general: 7,
      code: 7,
      structured_data: 7,
    },
    bestFor: [
      "visual analysis",
      "object recognition",
      "text interpretation in images",
      "mathematical reasoning with visual context",
      "video analysis",
      "structured outputs",
    ],
    accessibility: {
      imageDescriptionCapability: true,
      objectRecognition: true,
      textInImageDetection: true,
      videoAnalysis: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "response_format",
      "presence_penalty",
      "stop",
      "frequency_penalty",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1.0,
        p90: 1.0,
      },
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.0,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
    },
    features: ["response_format", "logprobs", "system-prompt", "vision"],
  },
  accessibility: {
    preferredFor: [
      "alt-text-generation",
      "image-description",
      "video-content-analysis",
      "mathematical-visual-reasoning",
      "accessible-image-understanding",
    ],
    warnings: [
      "Ensure visual content is properly formatted and within size limits",
      "Consider providing additional context for complex images",
      "May require clear instructions for structured outputs",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen2.5 VL 32B Instruct - Free multimodal vision-language model",
      parameterSection: "Parameter controls for Qwen2.5 VL model",
      statusMessages: {
        processing: "Processing request with Qwen VL model",
        complete: "Response ready from Qwen VL model",
        imageProcessing: "Analyzing image with Qwen VL model",
        videoProcessing: "Analyzing video with Qwen VL model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("google/gemini-2.5-pro-exp-03-25:free", {
  provider: "google",
  name: "Gemini Pro 2.5 Experimental",
  category: "GeneralPurpose",
  disabled: true,
  description:
    "Google's state-of-the-art AI model with enhanced reasoning capabilities, designed for advanced tasks in reasoning, coding, mathematics, and scientific domains.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "reasoning",
    "dialogue",
    "code",
    "mathematics",
    "structured_data",
    "long_context",
    "tools",
  ],
  maxContext: 1000000,
  fallbackTo: "anthropic/claude-3-5-sonnet", // Similar performance model
  isFree: true,
  metadata: {
    categoryDescription:
      "Experimental high-performance model with extreme context length",
    modelArchitecture: {
      parameters: "unknown", // Not specified in the provided information
      type: "experimental",
      generation: "2.5",
    },
    policyLinks: {
      privacyPolicy: "https://policies.google.com/privacy",
      acceptableUse: "https://policies.google.com/terms/service-specific",
      termsOfService: "https://policies.google.com/terms",
      lastUpdated: "2025-03-25",
    },
    languageSupport: [
      "english",
      // Other languages not specified in the provided information
    ],
    domainExpertise: {
      coding: 9,
      mathematics: 9,
      reasoning: 9,
      general: 8,
      structured_data: 8,
    },
    bestFor: [
      "advanced reasoning tasks",
      "coding challenges",
      "mathematical problem-solving",
      "scientific analysis",
      "extremely long context processing",
      "tool use",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "universal"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "code-generation",
      "mathematical-analysis",
      "scientific-content",
      "extremely-large-documents",
    ],
    warnings: [
      "Experimental model may produce unexpected results",
      "Provide clear instructions for best performance",
      "Consider using standard model for critical applications",
    ],
    ariaLabels: {
      modelSelect: "Gemini Pro 2.5 Experimental - Free model with 1M context",
      parameterSection:
        "Parameter controls for Gemini 2.5 Pro Experimental model",
      statusMessages: {
        processing: "Processing request with Gemini Experimental model",
        complete: "Response ready from Gemini Experimental model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

// Find where other models are registered and add this new model registration

modelRegistry.registerModel("qwen/qwen2.5-vl-3b-instruct:free", {
  provider: "qwen",
  name: "Qwen2.5 VL 3B Instruct (free)",
  category: "MultimodalVision",
  disabled: false,
  description:
    "A free multimodal LLM from the Qwen Team with state-of-the-art image understanding, agent capabilities, and multilingual support.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "images",
    "multilingual",
    "dialogue",
    "visual_understanding",
    "agent",
  ],
  maxContext: 64000,
  fallbackTo: "google/gemini-2.0-flash-thinking-experimental:free", // Similar multimodal model
  isFree: true,
  metadata: {
    categoryDescription: "Vision-language model with agent capabilities",
    modelArchitecture: {
      parameters: "3B",
      type: "multimodal-instruction-tuned",
      generation: "2.5",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-03-26",
    },
    languageSupport: [
      "english",
      "chinese",
      "french",
      "spanish",
      "portuguese",
      "german",
      "italian",
      "russian",
      "japanese",
      "korean",
      "vietnamese",
      "arabic",
    ],
    domainExpertise: {
      visual_understanding: 8,
      agent_capabilities: 7,
      multilingual: 8,
      general: 6,
    },
    bestFor: [
      "image analysis",
      "document understanding",
      "mobile/robot operation",
      "visual question answering",
      "multilingual image content",
      "math reasoning with visuals",
    ],
    accessibility: {
      multilingualSupport: true,
      imageTextRecognition: true,
      scriptSupport: [
        "latin",
        "chinese",
        "cyrillic",
        "japanese",
        "korean",
        "arabic",
        "vietnamese",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.03,
        p90: 1.1,
      },
    },
    features: ["top_k", "min_p", "repetition_penalty", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "image-description",
      "document-understanding",
      "visual-accessibility",
      "multilingual-image-content",
    ],
    warnings: [
      "Provide alt-text for images as a fallback",
      "Use descriptive prompts for better image understanding",
    ],
    ariaLabels: {
      modelSelect: "Qwen2.5 VL 3B Instruct - Free multimodal vision model",
      parameterSection: "Parameter controls for Qwen2.5 VL model",
      statusMessages: {
        processing: "Processing image and text with Qwen vision model",
        complete: "Response ready from Qwen vision model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("mistral/ministral-8b", {
  provider: "mistral",
  name: "Ministral 8B",
  category: "EdgeComputing", // New category for on-device/edge models - you may need to register this category if it doesn't exist
  disabled: false,
  description:
    "State-of-the-art language model optimized for on-device and edge computing with efficient performance for knowledge-intensive tasks, commonsense reasoning, and function-calling.",
  costs: {
    input: 0.1,
    output: 0.1,
  },
  capabilities: [
    "text",
    "function_calling",
    "tools",
    "long_context",
    "on_device",
    "edge_computing",
    "structured_outputs",
  ],
  maxContext: 131072,
  fallbackTo: "mistral/mistral-7b-instruct", // Similar provider model as fallback
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient model for edge computing and on-device applications",
    modelArchitecture: {
      parameters: "8B",
      type: "instruction-tuned",
      generation: "ministral",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy/",
      acceptableUse: "https://mistral.ai/terms/",
      termsOfService: "https://mistral.ai/terms/",
      lastUpdated: "2025-03-31",
    },
    languageSupport: [
      "english",
      // Add other languages if specified
    ],
    domainExpertise: {
      on_device: 9,
      edge_computing: 9,
      local_processing: 8,
      function_calling: 8,
      commonsense_reasoning: 7,
      general: 6,
    },
    bestFor: [
      "on-device applications",
      "offline translation",
      "smart assistants",
      "autonomous robotics",
      "local analytics",
      "privacy-focused applications",
      "function-calling",
      "multi-step agentic workflows",
    ],
    accessibility: {
      offlineSupport: true,
      lowLatency: true,
      privacyPreserving: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "response_format",
      "structured_outputs",
      "seed",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "function_calling",
      "structured_outputs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "offline-applications",
      "low-latency-requirements",
      "privacy-sensitive-contexts",
      "edge-computing",
      "function-calling",
    ],
    warnings: [
      "Optimised for on-device use but can be accessed via API",
      "Consider bandwidth implications for large context processing",
    ],
    ariaLabels: {
      modelSelect: "Ministral 8B - Edge computing model with 131K context",
      parameterSection: "Parameter controls for Ministral model",
      statusMessages: {
        processing: "Processing request with Ministral model",
        complete: "Response ready from Ministral model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

// Find where other models are registered and add this new model registration

modelRegistry.registerModel("all-hands/openhands-lm-32b-v0.1", {
  provider: "all-hands",
  name: "OpenHands LM 32B V0.1",
  category: "CodingSpecialist", // This seems most appropriate based on description
  disabled: false,
  description:
    "A 32B open-source coding model fine-tuned from Qwen2.5-Coder-32B-Instruct, optimized for autonomous software development agents with strong performance on SWE-Bench Verified.",
  costs: {
    input: 2.6,
    output: 3.4,
  },
  capabilities: [
    "text",
    "code",
    "software_development",
    "long_context",
    "autonomous_agents",
  ],
  maxContext: 16384, // From the provided details
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Parent model would be reasonable fallback
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialized autonomous coding model with long context support",
    modelArchitecture: {
      parameters: "32B",
      type: "fine-tuned",
      generation: "v0.1",
      baseModel: "Qwen2.5-Coder-32B-Instruct",
    },
    policyLinks: {
      privacyPolicy: "https://openhands.ai/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://openhands.ai/terms", // Replace with actual URL when available
      lastUpdated: "2025-04-02",
    },
    languageSupport: [
      "english", // Assuming English support based on description
    ],
    domainExpertise: {
      coding: 9,
      software_development: 9,
      autonomous_agents: 8,
      general: 5,
    },
    bestFor: [
      "autonomous software development",
      "coding tasks",
      "long-horizon code reasoning",
      "large codebase tasks",
      "SWE-Bench tasks",
    ],
    accessibility: {
      multilingualSupport: false, // Assuming based on coding focus
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "system-prompt", // Including system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "code-documentation",
      "software-development",
      "autonomous-coding-agents",
      "large-codebase-analysis",
    ],
    warnings: [
      "Research preview - may have limitations in certain coding domains",
      "May produce repetitive output in some scenarios",
    ],
    ariaLabels: {
      modelSelect:
        "OpenHands LM 32B V0.1 - Specialized coding model with 16K context",
      parameterSection: "Parameter controls for OpenHands coding model",
      statusMessages: {
        processing: "Processing coding request with OpenHands model",
        complete: "Code response ready from OpenHands model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("google/gemini-2.5-pro-preview-03-25", {
  provider: "google",
  name: "Gemini 2.5 Pro Preview",
  category: "Advanced",
  disabled: false,
  description:
    "Google's state-of-the-art AI model with advanced reasoning, coding, mathematics, and scientific capabilities. Features 'thinking' capabilities for enhanced accuracy and nuanced context handling.",
  costs: {
    input: 1.25,
    output: 10.0,
  },
  capabilities: [
    "text",
    "reasoning",
    "coding",
    "mathematics",
    "scientific",
    "long_context",
    "tools",
    "structured_data",
  ],
  maxContext: 1000000,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar capability model
  isFree: false,
  metadata: {
    categoryDescription: "Advanced reasoning model with million-token context",
    modelArchitecture: {
      parameters: "Unknown", // Not specified in the provided information
      type: "preview",
      generation: "2.5",
    },
    policyLinks: {
      privacyPolicy: "https://policies.google.com/privacy",
      acceptableUse: "https://policies.google.com/terms/service-specific",
      termsOfService: "https://policies.google.com/terms",
      lastUpdated: "2025-04-04",
    },
    languageSupport: [
      "english",
      "multilingual", // Assuming multilingual support, update if incorrect
    ],
    domainExpertise: {
      coding: 9,
      mathematics: 9,
      reasoning: 9,
      scientific: 9,
      general: 8,
    },
    bestFor: [
      "complex reasoning tasks",
      "scientific research assistance",
      "coding projects",
      "mathematical problem-solving",
      "massive document analysis",
      "tool use",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "universal"], // Assuming universal script support
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "tools",
      "tool_choice",
      "seed",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "scientific-content",
      "mathematical-analysis",
      "large-document-processing",
    ],
    warnings: [
      "Higher output cost may affect budget planning",
      "Very large context may require specific structuring for accessibility",
      "Ensure clear instructions for tool use scenarios",
    ],
    ariaLabels: {
      modelSelect:
        "Gemini 2.5 Pro Preview - Google's advanced reasoning model with million-token context",
      parameterSection: "Parameter controls for Gemini 2.5 Pro Preview model",
      statusMessages: {
        processing: "Processing request with Gemini model",
        complete: "Response ready from Gemini model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("mistral/ministral-8b", {
  provider: "mistral",
  name: "Ministral 8B",
  category: "EfficientModels",
  disabled: false,
  description:
    "A state-of-the-art language model optimised for on-device and edge computing with excellent knowledge-intensive tasks and commonsense reasoning capabilities.",
  costs: {
    input: 0.1,
    output: 0.1,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "function_calling",
    "tools",
    "long_context",
    "edge_computing",
  ],
  maxContext: 131072,
  fallbackTo: "mistral/mistral-small-latest", // Similar smaller mistral model
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient model optimised for on-device and edge computing",
    modelArchitecture: {
      parameters: "8B",
      type: "edge-optimised",
      generation: "2025",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy/",
      acceptableUse: "https://mistral.ai/terms/",
      termsOfService: "https://mistral.ai/terms/",
      lastUpdated: "2025-03-31",
    },
    languageSupport: ["english", "french", "german", "spanish", "italian"],
    domainExpertise: {
      edge_computing: 9,
      reasoning: 8,
      general: 7,
      function_calling: 8,
      tools: 7,
    },
    bestFor: [
      "on-device applications",
      "offline translation",
      "smart assistants",
      "autonomous robotics",
      "local analytics",
      "function calling",
      "multi-step workflows",
    ],
    accessibility: {
      multilingualSupport: true,
      offlineCapability: true,
      lowLatency: true,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "response_format",
      "structured_outputs",
      "seed",
      "system-prompt", // Added system-prompt
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 0.9,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "offline-applications",
      "edge-computing",
      "privacy-sensitive-tasks",
      "function-calling",
      "local-assistants",
    ],
    warnings: [
      "While supporting long context, performance may vary with extremely large inputs",
      "Optimise tool definitions for best function calling results",
    ],
    ariaLabels: {
      modelSelect:
        "Ministral 8B - Efficient model for on-device and edge computing",
      parameterSection: "Parameter controls for Ministral model",
      statusMessages: {
        processing: "Processing request with Ministral model",
        complete: "Response ready from Ministral model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("all-hands/openhands-lm-32b-v0.1", {
  provider: "all-hands",
  name: "OpenHands LM 32B V0.1",
  category: "CodeGeneration",
  disabled: false,
  description:
    "A 32B open-source coding model fine-tuned from Qwen2.5-Coder-32B-Instruct using reinforcement learning. Optimized for autonomous software development agents with strong performance on SWE-Bench Verified.",
  costs: {
    input: 2.6,
    output: 3.4,
  },
  capabilities: [
    "code",
    "tools",
    "tool_calling",
    "long_context",
    "codebases",
    "software_agents",
  ],
  maxContext: 16384, // From the provided details
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Similar base model
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialised model for coding and software development",
    modelArchitecture: {
      parameters: "32B",
      type: "code-specialized",
      generation: "0.1",
      baseModel: "Qwen2.5-Coder-32B-Instruct",
    },
    policyLinks: {
      privacyPolicy: "https://openhands.ai/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://openhands.ai/terms", // Replace with actual URL when available
      lastUpdated: "2025-04-02",
    },
    languageSupport: ["english", "programming"],
    domainExpertise: {
      coding: 9,
      software_development: 9,
      code_agents: 8,
      general: 6,
    },
    bestFor: [
      "autonomous software development",
      "coding tasks",
      "large codebase analysis",
      "long-horizon code reasoning",
      "offline agent workflows",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin", "programming"],
      offlineCapable: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "top_k",
      "min_p",
      "seed",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.3,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.8,
        p50: 0.95,
        p90: 1.0,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
    },
    features: ["tools", "tool_choice", "repetition_penalty", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "code-generation",
      "coding-assistance",
      "software-development",
      "agent-workflows",
    ],
    warnings: [
      "Optimised for coding tasks, may be less effective for general content",
      "Potential for repetition in non-code contexts",
      "Best results with clear coding instructions",
    ],
    ariaLabels: {
      modelSelect: "OpenHands LM 32B V0.1 - Specialised coding model",
      parameterSection: "Parameter controls for OpenHands coding model",
      statusMessages: {
        processing: "Processing code request with OpenHands model",
        complete: "Code response ready from OpenHands model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("meta-llama/llama-4-scout", {
  provider: "meta-llama",
  name: "Llama 4 Scout",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A mixture-of-experts (MoE) language model with multimodal capabilities supporting text, images, and code across 12 languages with an exceptional 327K context window.",
  costs: {
    input: 0.08,
    output: 0.3,
    image: 0.3342, // Cost per 1000 input images
  },
  capabilities: [
    "text",
    "image",
    "multilingual",
    "dialogue",
    "code",
    "visual_reasoning",
  ],
  maxContext: 327680,
  fallbackTo: "anthropic/claude-3-5-sonnet", // Similar performance multimodal model
  isFree: false,
  metadata: {
    categoryDescription:
      "Multimodal mixture-of-experts model with massive context support",
    modelArchitecture: {
      parameters: "17B activated (109B total)",
      type: "mixture-of-experts",
      generation: "4",
      experts: 16,
    },
    policyLinks: {
      privacyPolicy: "https://ai.meta.com/llama/privacy/",
      acceptableUse: "https://ai.meta.com/llama/use-policy/",
      termsOfService: "https://ai.meta.com/llama/license/",
      lastUpdated: "2025-04-05",
    },
    languageSupport: [
      "english",
      // Add other 11 languages when specified
    ],
    domainExpertise: {
      coding: 7,
      visual_reasoning: 8,
      general: 7,
      multilingual: 7,
      trivia: 5,
      science: 7,
    },
    bestFor: [
      "assistant-style interaction",
      "visual reasoning",
      "multilingual tasks",
      "code generation",
      "image understanding",
      "scientific content",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      visualCapabilities: true,
      imageDescriptions: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "tools",
      "tool_choice",
      "structured_outputs",
      "system-prompt", // Added system-prompt
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      temperature: {
        p10: 0.2,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1.1,
        p90: 1.2,
      },
    },
    features: [
      "response_format",
      "tools",
      "structured_outputs",
      "system-prompt",
      "min_p",
    ],
  },
  accessibility: {
    preferredFor: [
      "image-understanding",
      "visual-accessibility",
      "multilingual-content",
      "scientific-content",
    ],
    warnings: [
      "May require clear image descriptions for optimal visual understanding",
      "Specify language preference explicitly for multilingual outputs",
    ],
    ariaLabels: {
      modelSelect: "Llama 4 Scout - Multimodal model with visual capabilities",
      parameterSection: "Parameter controls for Llama 4 Scout model",
      statusMessages: {
        processing: "Processing request with Llama 4 Scout model",
        complete: "Response ready from Llama 4 Scout model",
        processingSlow: "Still processing images with Llama 4 Scout...",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("meta-llama/llama-4-maverick", {
  provider: "meta-llama",
  name: "Llama 4 Maverick",
  category: "MultiModal",
  disabled: false,
  description:
    "A high-capacity multimodal language model with mixture-of-experts architecture supporting text and image input across multiple languages.",
  costs: {
    input: 0.18,
    output: 0.6,
    image: 0.6684,
  },
  capabilities: [
    "text",
    "image-input",
    "multilingual",
    "dialogue",
    "code",
    "reasoning",
    "vision-language",
    "long_context",
    "tools",
    "structured_outputs",
  ],
  maxContext: 1048576,
  fallbackTo: "anthropic/claude-3-5-sonnet", // Similar multimodal capability
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal model with mixture-of-experts architecture",
    modelArchitecture: {
      parameters: "17B active (400B total)",
      type: "mixture-of-experts",
      generation: "4",
      experts: 128,
    },
    policyLinks: {
      privacyPolicy: "https://ai.meta.com/llama/privacy/",
      acceptableUse: "https://ai.meta.com/llama/use-policy/",
      termsOfService: "https://ai.meta.com/llama/license/",
      lastUpdated: "2025-04-05",
    },
    knowledgeCutoff: "2024-08",
    languageSupport: [
      "english",
      "spanish",
      "french",
      "german",
      "italian",
      "portuguese",
      "dutch",
      "chinese",
      "japanese",
      "korean",
      "arabic",
      "hindi",
    ],
    domainExpertise: {
      trivia: 4,
      marketing: 4,
      seo: 4,
      legal: 8,
      science: 9,
      academia: 9,
      vision_language: 9,
    },
    bestFor: [
      "multimodal applications",
      "image reasoning",
      "long context processing",
      "assistant-like behavior",
      "academic content",
      "scientific analysis",
      "legal content",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      imageDescription: true,
      scriptSupport: [
        "latin",
        "chinese",
        "japanese",
        "korean",
        "arabic",
        "devanagari",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "tools",
      "tool_choice",
      "structured_outputs",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.2,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.2,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 1,
        p50: 40,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.05,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
    },
    features: [
      "response_format",
      "system-prompt",
      "tools",
      "structured_outputs",
      "vision-input",
    ],
  },
  accessibility: {
    preferredFor: [
      "multimodal-content",
      "image-analysis",
      "scientific-content",
      "academic-research",
      "legal-documents",
    ],
    warnings: [
      "Ensure images have appropriate alt text before sending",
      "Provide clear context for image analysis",
      "Consider reduced response times for very large contexts",
    ],
    ariaLabels: {
      modelSelect: "Meta Llama 4 Maverick - Multimodal model with 1M context",
      parameterSection: "Parameter controls for Llama 4 Maverick model",
      imageInput: "Image input for Llama 4 Maverick analysis",
      statusMessages: {
        processing: "Processing multimodal request with Llama 4 Maverick",
        complete: "Multimodal response ready from Llama 4 Maverick",
        imageProcessing: "Analysing image with Llama 4 Maverick",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("nvidia/llama-3.1-nemotron-ultra-253b-v1:free", {
  provider: "nvidia",
  name: "Llama 3.1 Nemotron Ultra 253B v1 (free)",
  category: "GeneralPurpose",
  disabled: true,
  description:
    "A large language model optimised for advanced reasoning, human-interactive chat, retrieval-augmented generation (RAG), and tool-calling tasks. Derived from Meta's Llama-3.1-405B-Instruct with Neural Architecture Search customisations.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "rag",
    "tool_calling",
    "long_context",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.1-8b-instruct", // Free alternative model
  isFree: true,
  metadata: {
    categoryDescription: "Advanced reasoning model with long context support",
    modelArchitecture: {
      parameters: "253B",
      type: "instruction-tuned",
      generation: "3.1",
      baseModel: "Meta's Llama-3.1-405B-Instruct",
    },
    policyLinks: {
      privacyPolicy:
        "https://www.nvidia.com/en-gb/about-nvidia/privacy-policy/",
      acceptableUse:
        "https://www.nvidia.com/en-gb/about-nvidia/acceptable-use-policy/",
      termsOfService: "https://www.nvidia.com/en-gb/about-nvidia/terms-of-use/",
      lastUpdated: "2025-04-08",
    },
    domainExpertise: {
      reasoning: 9,
      dialogue: 8,
      rag: 8,
      tool_use: 8,
    },
    bestFor: [
      "advanced reasoning tasks",
      "interactive dialogue",
      "retrieval-augmented generation",
      "tool-calling applications",
      "long context processing",
    ],
    accessibility: {
      multilingualSupport: true,
      requiresDetailedSystemPrompts: true,
    },
    usageNotes:
      "You must include detailed thinking instructions in the system prompt to enable reasoning capabilities.",
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 80,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.03,
        p90: 1.1,
      },
    },
    features: ["reasoning", "logprobs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "chat-applications",
      "document-analysis",
      "tool-integration",
    ],
    warnings: [
      "Requires detailed system prompts for optimal reasoning",
      "Specify desired reasoning steps explicitly",
      "Large model may have slightly longer response times",
    ],
    ariaLabels: {
      modelSelect:
        "NVIDIA Llama 3.1 Nemotron Ultra 253B - Free reasoning model with 131K context",
      parameterSection: "Parameter controls for NVIDIA Nemotron model",
      statusMessages: {
        processing: "Processing request with NVIDIA reasoning model",
        complete: "Response ready from NVIDIA model",
      },
    },
    systemPromptRecommendation:
      "Include explicit instructions for step-by-step thinking in system prompts for best reasoning results.",
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("nvidia/llama-3.3-nemotron-super-49b-v1:free", {
  provider: "nvidia",
  name: "Llama 3.3 Nemotron Super 49B v1 (free)",
  category: "GeneralPurpose",
  disabled: true,
  description:
    "A large language model optimised for advanced reasoning, conversational interactions, retrieval-augmented generation (RAG), and tool-calling tasks. Derived from Meta's Llama-3.3-70B-Instruct with enhanced efficiency and reduced memory requirements.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "tool_use",
    "rag",
    "long_context",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Based on original model
  isFree: true,
  metadata: {
    categoryDescription:
      "Free advanced reasoning model with long context support",
    modelArchitecture: {
      parameters: "49B",
      type: "instruction-tuned",
      generation: "3.3",
      baseModel: "Llama-3.3-70B-Instruct",
    },
    policyLinks: {
      privacyPolicy:
        "https://www.nvidia.com/en-gb/about-nvidia/privacy-policy/",
      acceptableUse:
        "https://www.nvidia.com/en-gb/about-nvidia/acceptable-use-policy/",
      termsOfService: "https://www.nvidia.com/en-gb/about-nvidia/terms-of-use/",
      lastUpdated: "2025-04-08",
    },
    languageSupport: ["english", "multilingual"],
    domainExpertise: {
      reasoning: 8,
      dialogue: 7,
      rag: 8,
      tool_use: 7,
      general: 7,
    },
    bestFor: [
      "advanced reasoning tasks",
      "conversational applications",
      "retrieval-augmented generation",
      "tool-calling tasks",
      "long context processing",
      "budget-conscious applications",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "common"],
    },
    usageNotes:
      "Include detailed thinking in the system prompt to enable reasoning capabilities.",
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt as needed
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.2,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 40,
        p50: 50,
        p90: 60,
      },
      min_p: {
        p10: 0.05,
        p50: 0.1,
        p90: 0.2,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.05,
        p90: 1.1,
      },
    },
    features: ["reasoning", "tool_use", "rag", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "reasoning-tasks",
      "conversation-agents",
      "rag-applications",
      "tool-calling-systems",
      "budget-constrained-projects",
    ],
    warnings: [
      "Requires explicit system prompt instructions for best reasoning results",
      "May require tweaking parameters for optimal performance",
    ],
    ariaLabels: {
      modelSelect:
        "Llama 3.3 Nemotron Super 49B - Free reasoning model with 131K context",
      parameterSection: "Parameter controls for Nemotron model",
      statusMessages: {
        processing: "Processing request with free Nemotron model",
        complete: "Response ready from Nemotron model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("nvidia/llama-3.1-nemotron-nano-8b-v1:free", {
  provider: "nvidia",
  name: "Llama 3.1 Nemotron Nano 8B v1",
  category: "GeneralPurpose",
  disabled: true,
  description:
    "A compact large language model optimised for reasoning tasks, conversational interactions, retrieval-augmented generation (RAG), and tool-calling applications.",
  costs: {
    input: 0,
    output: 0,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "rag",
    "tool_calls",
    "long_context",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3-8b-instruct", // Similar performance model
  isFree: true,
  metadata: {
    categoryDescription: "Free compact model with reasoning capabilities",
    modelArchitecture: {
      parameters: "8B",
      type: "instruction-tuned",
      generation: "3.1",
      baseModel: "Meta's Llama-3.1-8B-Instruct",
    },
    policyLinks: {
      privacyPolicy:
        "https://www.nvidia.com/en-gb/about-nvidia/privacy-policy/",
      acceptableUse:
        "https://www.nvidia.com/en-gb/about-nvidia/acceptable-use-policy/",
      termsOfService:
        "https://www.nvidia.com/en-gb/about-nvidia/terms-of-service/",
      lastUpdated: "2025-04-08",
    },
    languageSupport: ["english"],
    domainExpertise: {
      reasoning: 7,
      conversational: 7,
      rag: 7,
      tool_calling: 6,
      general: 6,
    },
    bestFor: [
      "reasoning tasks",
      "conversational applications",
      "retrieval-augmented generation",
      "tool-calling applications",
      "local deployment",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
    specialNotes:
      "Requires detailed thinking in the system prompt to enable reasoning capabilities.",
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.8,
        p50: 0.95,
        p90: 1.0,
      },
      top_k: {
        p10: 30,
        p50: 40,
        p90: 50,
      },
      min_p: {
        p10: 0.05,
        p50: 0.1,
        p90: 0.2,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.05,
        p90: 1.1,
      },
    },
    features: ["top_k", "min_p", "repetition_penalty", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "reasoning-tasks",
      "conversational-applications",
      "rag-systems",
      "tool-calling-applications",
    ],
    warnings: [
      "Requires detailed thinking in system prompt for reasoning",
      "Best performance with clear instructions",
    ],
    ariaLabels: {
      modelSelect:
        "Llama 3.1 Nemotron Nano 8B - Free reasoning model with 131K context",
      parameterSection: "Parameter controls for NVIDIA Llama model",
      statusMessages: {
        processing: "Processing request with NVIDIA model",
        complete: "Response ready from NVIDIA model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

// Add this new model registration near other model registrations

modelRegistry.registerModel("x-ai/grok-3-beta", {
  provider: "x-ai",
  name: "Grok 3 Beta",
  category: "EnterpriseGrade",
  disabled: false,
  description:
    "xAI's flagship model excelling at enterprise use cases like data extraction, coding, and text summarization. Features deep domain knowledge in finance, healthcare, law, and science.",
  costs: {
    input: 3,
    output: 15,
  },
  capabilities: [
    "text",
    "code",
    "data_extraction",
    "summarization",
    "enterprise",
    "structured_tasks",
    "long_context",
    "domain_knowledge",
    "tools",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3-opus-20240229", // Similar high-end enterprise model
  isFree: false,
  metadata: {
    categoryDescription: "Enterprise-grade model with deep domain expertise",
    modelArchitecture: {
      parameters: "Unknown", // Not specified in the details
      type: "enterprise-specialised",
      generation: "3",
      variant: "Beta",
    },
    policyLinks: {
      privacyPolicy: "https://x.ai/privacy",
      acceptableUse: "https://x.ai/use-policy",
      termsOfService: "https://x.ai/terms",
      lastUpdated: "2025-04-09",
    },
    languageSupport: [
      "english",
      // Add others if known
    ],
    domainExpertise: {
      finance: 9,
      healthcare: 9,
      law: 9,
      science: 9,
      coding: 8,
      data_analysis: 8,
      general: 8,
    },
    bestFor: [
      "enterprise applications",
      "data extraction",
      "coding tasks",
      "text summarization",
      "domain-specific tasks",
      "financial analysis",
      "legal research",
      "scientific research",
      "healthcare applications",
    ],
    accessibility: {
      multilingualSupport: true, // Assumption based on enterprise focus
      languageDetection: true,
      scriptSupport: ["latin", "others"], // Add specific scripts if known
    },
    specialFeatures: {
      routingOptions:
        "Supports throughput-optimised routing with provider: { sort: throughput } parameter",
      benchmarks: "Outperforms on GPQA, LCB, and MMLU-Pro benchmarks",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "logprobs",
      "top_logprobs",
      "response_format",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["tools", "response_format", "logprobs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "enterprise-content",
      "domain-specific-content",
      "code-documentation",
      "data-analysis",
      "complex-structured-tasks",
    ],
    warnings: [
      "High output cost may impact affordability",
      "Ensure tool definitions are clearly structured",
      "Consider performance implications for long-context tasks",
    ],
    ariaLabels: {
      modelSelect: "Grok 3 Beta - Enterprise model with 131K context",
      parameterSection: "Parameter controls for Grok 3 Beta model",
      statusMessages: {
        processing: "Processing request with Grok 3 Beta model",
        complete: "Response ready from Grok 3 Beta model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
  providerOptions: {
    defaultRouting: "base", // Default endpoint
    routingOptions: {
      throughput: {
        description:
          "Optimised for throughput with potentially faster response times",
        providerParam: { sort: "throughput" },
        ariaLabel: "Use faster xAI endpoint optimised for throughput",
      },
    },
  },
});

modelRegistry.registerModel("x-ai/grok-3-mini-beta", {
  provider: "x-ai",
  name: "Grok 3 Mini Beta",
  category: "ReasoningModels", // Suggesting a category based on its reasoning focus
  disabled: false,
  description:
    "A lightweight, smaller thinking model that processes before responding, ideal for reasoning-heavy tasks and math-specific use cases.",
  costs: {
    input: 0.3,
    output: 0.5,
  },
  capabilities: [
    "text",
    "reasoning",
    "mathematics",
    "puzzle_solving",
    "thinking_traces",
    "long_context",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3-5-sonnet", // Similar reasoning capability
  isFree: false,
  metadata: {
    categoryDescription: "Models with enhanced reasoning capabilities",
    modelArchitecture: {
      parameters: "Mini",
      type: "reasoning-focused",
      generation: "3",
    },
    policyLinks: {
      privacyPolicy: "https://x.ai/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://x.ai/terms", // Replace with actual URL when available
      lastUpdated: "2025-04-09",
    },
    languageSupport: ["english"],
    domainExpertise: {
      reasoning: 9,
      mathematics: 8,
      puzzle_solving: 8,
      general: 6,
    },
    bestFor: [
      "mathematical reasoning",
      "logical puzzles",
      "step-by-step problem solving",
      "quantitative analysis",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning", // Special Grok parameter
      "include_reasoning", // Special Grok parameter
      "stop",
      "seed",
      "logprobs",
      "top_logprobs",
      "response_format",
      "system-prompt", // Adding system-prompt support
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1.0,
        p90: 1.0,
      },
    },
    features: [
      "response_format",
      "logprobs",
      "system-prompt",
      "reasoning",
      "include_reasoning",
    ],
    specialParameters: {
      reasoning: {
        default: { effort: "low" },
        options: [{ effort: "low" }, { effort: "medium" }, { effort: "high" }],
        description: "Controls the reasoning effort applied during generation",
      },
      include_reasoning: {
        default: false,
        description: "When true, includes the reasoning trace in the response",
      },
    },
  },
  accessibility: {
    preferredFor: [
      "mathematical-content",
      "reasoning-tasks",
      "problem-solving",
      "step-by-step-explanations",
    ],
    warnings: [
      "Enable 'high' reasoning for complex problems",
      "Set include_reasoning: true to improve explainability for assistive technology users",
    ],
    ariaLabels: {
      modelSelect:
        "Grok 3 Mini Beta - Reasoning-focused model with 131K context",
      parameterSection: "Parameter controls for Grok 3 Mini Beta model",
      statusMessages: {
        processing: "Processing with Grok reasoning model",
        complete: "Response ready from Grok reasoning model",
        thinking: "Grok model is reasoning through your request",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
  specialRouting: {
    defaultEndpoint: "base",
    alternativeEndpoints: [
      {
        name: "throughput",
        description: "Faster endpoint with potentially lower quality reasoning",
        provider_settings: { sort: "throughput" },
      },
    ],
  },
});

modelRegistry.registerModel("alfredpros/codellama-7b-instruct-solidity", {
  provider: "alfredpros",
  name: "CodeLLaMa 7B Instruct Solidity",
  category: "Coding",
  disabled: false,
  description:
    "A finetuned 7 billion parameters Code LLaMA - Instruct model specialised for generating Solidity smart contracts using 4-bit QLoRA finetuning.",
  costs: {
    input: 0.8,
    output: 1.2,
  },
  capabilities: ["text", "code", "solidity", "smart_contracts", "blockchain"],
  maxContext: 4096,
  fallbackTo: "meta-llama/llama-3-8b-instruct", // Generic fallback with coding capability
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialised model for Solidity smart contract development",
    modelArchitecture: {
      parameters: "7B",
      type: "instruction-tuned",
      baseModel: "CodeLLaMA",
      finetuningMethod: "QLoRA",
    },
    policyLinks: {
      privacyPolicy: "",
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-04-14",
    },
    languageSupport: ["english", "solidity"],
    domainExpertise: {
      coding: 7,
      solidity: 9,
      smart_contracts: 9,
      blockchain: 8,
      general: 5,
    },
    bestFor: [
      "solidity smart contract development",
      "ethereum blockchain programming",
      "smart contract auditing",
      "blockchain application development",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "top_k",
      "min_p",
      "seed",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 0.9,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
    },
    features: ["repetition_penalty", "top_k", "min_p", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "solidity-development",
      "smart-contract-generation",
      "blockchain-code",
    ],
    warnings: [
      "Specialised for Solidity code only",
      "Limited context window (4096 tokens)",
      "May not perform well for general-purpose tasks",
    ],
    ariaLabels: {
      modelSelect: "CodeLLaMa 7B Solidity - Smart contract specialist model",
      parameterSection: "Parameter controls for Solidity code generation",
      statusMessages: {
        processing: "Processing Solidity code request",
        complete: "Solidity code generation complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("eleutherai/llemma_7b", {
  provider: "eleutherai",
  name: "Llemma 7B",
  category: "Mathematics", // Specialized model for mathematics
  disabled: false,
  description:
    "A language model specialized for mathematics, initialized with Code Llama 7B weights and trained on the Proof-Pile-2 for 200B tokens. Particularly strong at chain-of-thought mathematical reasoning and using computational tools.",
  costs: {
    input: 0.8,
    output: 1.2,
  },
  capabilities: ["mathematics", "reasoning", "code", "chain-of-thought"],
  maxContext: 4096,
  fallbackTo: "anthropic/claude-3-haiku", // Fallback to a model with good reasoning capability
  isFree: false,
  metadata: {
    categoryDescription: "Specialized mathematical reasoning model",
    modelArchitecture: {
      parameters: "7B",
      type: "fine-tuned",
      baseModel: "Code Llama 7B",
    },
    policyLinks: {
      privacyPolicy: "https://www.eleuther.ai/privacy-policy",
      termsOfService: "https://www.eleuther.ai/terms-of-service",
      lastUpdated: "2025-04-14",
    },
    languageSupport: ["english", "mathematics", "python"],
    domainExpertise: {
      mathematics: 9,
      coding: 7,
      reasoning: 8,
      general: 5,
    },
    bestFor: [
      "mathematical problem-solving",
      "chain-of-thought reasoning",
      "computational mathematics",
      "python coding for mathematics",
      "formal theorem proving",
    ],
    accessibility: {
      latexSupport: true,
      codeHighlighting: true,
      mathNotation: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "top_k",
      "min_p",
      "seed",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 40,
        p50: 50,
        p90: 60,
      },
      min_p: {
        p10: 0.01,
        p50: 0.05,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
    },
    features: ["repetition_penalty", "top_k", "min_p", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "mathematical-content",
      "computational-tasks",
      "step-by-step-reasoning",
      "formal-proofs",
    ],
    warnings: [
      "Specialised for mathematics - may underperform on general tasks",
      "Limited context window (4096 tokens)",
      "Prefers structured mathematical problems",
    ],
    ariaLabels: {
      modelSelect: "Llemma 7B - Specialised mathematical reasoning model",
      parameterSection: "Parameter controls for Llemma mathematics model",
      statusMessages: {
        processing: "Processing mathematical query with Llemma model",
        complete: "Mathematical solution ready from Llemma model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("openai/gpt-4.1-nano", {
  provider: "openai",
  name: "GPT-4.1 Nano",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "The fastest and cheapest model in the GPT-4.1 series, offering exceptional performance with a 1M token context window. Ideal for low-latency tasks like classification or autocompletion.",
  costs: {
    input: 0.1,
    output: 0.4,
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "low_latency",
    "tools",
    "long_context",
    "classification",
    "translation",
  ],
  maxContext: 1047576,
  fallbackTo: "anthropic/claude-3-5-sonnet", // Similar performance model
  isFree: false,
  metadata: {
    categoryDescription: "Fast, efficient model with long context support",
    modelArchitecture: {
      parameters: "Unknown", // Not provided in the details
      type: "instruction-tuned",
      generation: "4.1",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/policies/privacy-policy",
      acceptableUse: "https://openai.com/policies/usage-policies",
      termsOfService: "https://openai.com/policies/terms-of-use",
      lastUpdated: "2025-04-14",
    },
    benchmarks: {
      MMLU: "80.1%",
      GPQA: "50.3%",
      "Aider polyglot coding": "9.8%",
    },
    domainExpertise: {
      coding: 6,
      classification: 8,
      translation: 7,
      general: 7,
      autocompletion: 8,
      low_latency: 9,
    },
    bestFor: [
      "classification tasks",
      "autocompletion",
      "low-latency applications",
      "translation tasks",
      "long context processing",
      "tool usage",
    ],
    accessibility: {
      multilingualSupport: true,
      translationQuality: "High",
      responseSpeed: "Very Fast",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "response_format",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      temperature: {
        p10: 0.2,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["tools", "response_format", "logprobs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "translation-tasks",
      "quick-responses",
      "simple-classification",
      "autocompletion",
    ],
    warnings: [
      "Optimize prompt length to reduce costs with large context window",
      "Best for applications requiring speed over complex reasoning",
    ],
    ariaLabels: {
      modelSelect: "GPT-4.1 Nano - Fast model with 1M context",
      parameterSection: "Parameter controls for GPT-4.1 Nano model",
      statusMessages: {
        processing: "Processing request with GPT-4.1 Nano model",
        complete: "Response ready from GPT-4.1 Nano model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("openai/gpt-4.1-mini", {
  provider: "openai",
  name: "GPT-4.1 Mini",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Mid-sized model delivering performance competitive with GPT-4o at substantially lower latency and cost, with a 1 million token context window.",
  costs: {
    input: 0.4,
    output: 1.6,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "code",
    "vision",
    "tool_use",
    "long_context",
  ],
  maxContext: 1047576,
  fallbackTo: "anthropic/claude-3-haiku", // Similar performance tier model
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient, mid-sized multimodal model with long context support",
    modelArchitecture: {
      parameters: "N/A", // Not publicly disclosed
      type: "instruction-tuned",
      generation: "4.1",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/policies/privacy-policy",
      acceptableUse: "https://openai.com/policies/usage-policies",
      termsOfService: "https://openai.com/policies/terms-of-use",
      lastUpdated: "2025-04-14",
    },
    languageSupport: ["english", "multilingual"],
    domainExpertise: {
      coding: 7,
      mathematics: 7,
      general: 8,
      multilingual: 7,
      vision: 7,
      tool_use: 8,
    },
    benchmarks: {
      hardInstructionEvals: "45.1%",
      multiChallenge: "35.8%",
      ifEval: "84.1%",
      aiderPolyglotDiff: "31.6%",
    },
    bestFor: [
      "interactive applications",
      "performance-sensitive use cases",
      "coding tasks",
      "multimodal applications",
      "long context processing",
      "tool use applications",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "multilingual"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "response_format",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "tool_choice",
      "response_format",
      "logprobs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "low-latency-applications",
      "cost-sensitive-deployments",
      "code-generation",
      "vision-understanding",
      "tool-use-scenarios",
    ],
    warnings: [
      "Set appropriate temperature for creative tasks",
      "Provide clear instructions for tool use",
    ],
    ariaLabels: {
      modelSelect: "GPT-4.1 Mini - Efficient model with 1M context",
      parameterSection: "Parameter controls for GPT-4.1 Mini model",
      statusMessages: {
        processing: "Processing request with GPT-4.1 Mini",
        complete: "Response ready from GPT-4.1 Mini",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("openai/gpt-4.1", {
  provider: "openai",
  name: "GPT-4.1",
  category: "PremiumModels",
  disabled: false,
  description:
    "OpenAI's flagship large language model optimised for advanced instruction following, real-world software engineering, and long-context reasoning with a 1 million token context window.",
  costs: {
    input: 2.0,
    output: 8.0,
  },
  capabilities: [
    "text",
    "code",
    "tools",
    "long_context",
    "instruction_following",
    "multimodal",
    "document_analysis",
  ],
  maxContext: 1047576,
  fallbackTo: "openai/gpt-4o", // Reasonable fallback to an earlier OpenAI model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced model with exceptional coding and long context capabilities",
    modelArchitecture: {
      parameters: "Unknown", // OpenAI hasn't disclosed this
      type: "instruction-tuned",
      generation: "4.1",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/policies/privacy-policy",
      acceptableUse: "https://openai.com/policies/usage-policies",
      termsOfService: "https://openai.com/policies/terms-of-use",
      lastUpdated: "2025-04-14",
    },
    languageSupport: [
      "english",
      "multilingual", // Assuming it has broad language support like previous models
    ],
    domainExpertise: {
      coding: 9,
      mathematics: 8,
      general: 9,
      multilingual: 8,
      structured_data: 8,
    },
    bestFor: [
      "software engineering",
      "coding with precise diffs",
      "agent implementations",
      "IDE tooling",
      "enterprise knowledge retrieval",
      "long document analysis",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "chinese",
        "cyrillic",
        "japanese",
        "korean",
        "arabic",
        "thai",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "response_format",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["tools", "response_format", "logprobs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "code-generation",
      "technical-documentation",
      "complex-reasoning",
      "tool-augmented-tasks",
    ],
    warnings: [
      "Higher cost than other models",
      "Ensure clear instructions for complex tasks",
      "Consider token usage with very long contexts",
    ],
    ariaLabels: {
      modelSelect: "GPT-4.1 - Premium OpenAI model with 1M token context",
      parameterSection: "Parameter controls for GPT-4.1 model",
      statusMessages: {
        processing: "Processing request with GPT-4.1 model",
        complete: "Response ready from GPT-4.1 model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("qwen/qwen2.5-coder-7b-instruct", {
  provider: "qwen",
  name: "Qwen2.5 Coder 7B Instruct",
  category: "CodeSpecialist", // Assuming you have this category, create if needed
  disabled: false,
  description:
    "7B parameter instruction-tuned model optimized for code generation, reasoning, and bug fixing with support for multiple programming languages.",
  costs: {
    input: 0.2,
    output: 0.2,
  },
  capabilities: [
    "text",
    "code",
    "code_generation",
    "code_explanation",
    "code_debugging",
    "multilingual_code",
    "long_context",
  ],
  maxContext: 32768,
  fallbackTo: "anthropic/claude-3-haiku", // Similar performance code model - adjust as needed
  isFree: false,
  metadata: {
    categoryDescription: "Specialized code generation and reasoning model",
    modelArchitecture: {
      parameters: "7B",
      type: "instruction-tuned",
      generation: "2.5",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-04-15",
      license: "Apache 2.0",
    },
    languageSupport: [
      "english",
      "python",
      "javascript",
      "typescript",
      "java",
      "c++",
      "rust",
      "go",
      "php",
      "c#",
      "sql",
      "html",
      "css",
    ],
    domainExpertise: {
      coding: 9,
      code_explanation: 8,
      debugging: 8,
      general: 6,
      multilingual_code: 8,
    },
    bestFor: [
      "code generation",
      "code reasoning",
      "bug fixing",
      "code explanation",
      "agentic coding workflows",
      "programming assistance",
    ],
    accessibility: {
      codeFormatSupport: true,
      syntaxHighlighting: true,
      codeDocumentation: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.6,
        p90: 0.9,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 40,
        p50: 50,
        p90: 60,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1.03,
        p90: 1.1,
      },
    },
    features: ["top_k", "min_p", "repetition_penalty", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "code-assistance",
      "programming-help",
      "debugging-support",
      "technical-documentation",
    ],
    warnings: [
      "Specify programming language for best results",
      "Provide context for complex code tasks",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen2.5 Coder 7B Instruct - Specialized coding model with 32K context",
      parameterSection: "Parameter controls for Qwen2.5 Coder model",
      statusMessages: {
        processing: "Processing code request with Qwen Coder model",
        complete: "Code response ready from Qwen Coder model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("openai/o4-mini", {
  provider: "openai",
  name: "o4 Mini",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A compact reasoning model in the o-series, optimized for fast, cost-efficient performance while retaining strong multimodal and agentic capabilities with tool use support.",
  costs: {
    input: 1.1,
    output: 4.4,
    image: 0.8415, // per 1000 input images
  },
  capabilities: [
    "text",
    "vision",
    "tools",
    "code",
    "mathematics",
    "reasoning",
    "structured_data",
    "long_context",
  ],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3-opus", // Similar reasoning capability
  isFree: false,
  metadata: {
    categoryDescription:
      "Fast multimodal model with reasoning, tool use, and code capabilities",
    modelArchitecture: {
      parameters: "Mini",
      type: "reasoning",
      generation: "4",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/policies/privacy-policy",
      acceptableUse: "https://openai.com/policies/usage-policies",
      termsOfService: "https://openai.com/policies/terms-of-use",
      lastUpdated: "2025-04-16",
    },
    languageSupport: ["english", "multilingual"],
    domainExpertise: {
      coding: 9,
      mathematics: 9,
      general: 8,
      reasoning: 9,
      vision: 8,
      structured_data: 8,
    },
    bestFor: [
      "tool use",
      "coding tasks",
      "mathematical reasoning",
      "structured data handling",
      "visual problem solving",
      "high-throughput scenarios",
      "latency-critical applications",
    ],
    accessibility: {
      multilingualSupport: true,
      visionCapabilities: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added system-prompt as standard
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
    },
    features: [
      "tools",
      "response_format",
      "structured_outputs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "code-generation",
      "mathematical-content",
      "visual-problem-solving",
      "tool-use",
      "structured-outputs",
    ],
    warnings: [
      "Higher output cost compared to input cost",
      "Ensure clear instructions for structured outputs",
      "Tool definitions should be well-specified",
    ],
    ariaLabels: {
      modelSelect:
        "OpenAI o4 Mini - Fast reasoning model with visual capabilities",
      parameterSection: "Parameter controls for o4 Mini model",
      statusMessages: {
        processing: "Processing request with o4 Mini model",
        complete: "Response ready from o4 Mini model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("openai/o4-mini-high", {
  provider: "openai",
  name: "o4 Mini High",
  category: "AIAssistant",
  disabled: false,
  description:
    "OpenAI o4-mini with reasoning_effort set to high. A compact reasoning model with strong multimodal and agentic capabilities, optimized for fast, cost-efficient performance.",
  costs: {
    input: 1.1,
    output: 4.4,
    image: 0.8415,
  },
  capabilities: [
    "text",
    "vision",
    "reasoning",
    "code",
    "tool_use",
    "structured_outputs",
    "long_context",
  ],
  maxContext: 200000,
  fallbackTo: "openai/gpt-4o", // Similar capabilities but more widely available
  isFree: false,
  metadata: {
    categoryDescription:
      "Reasoning-focused multimodal assistant with high reasoning effort",
    modelArchitecture: {
      parameters: "Mini",
      type: "reasoning",
      generation: "4",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/policies/privacy-policy",
      acceptableUse: "https://openai.com/policies/usage-policies",
      termsOfService: "https://openai.com/policies/terms-of-use",
      lastUpdated: "2025-04-16",
    },
    languageSupport: ["english", "multilingual"],
    domainExpertise: {
      coding: 8,
      mathematics: 9,
      reasoning: 9,
      visual_understanding: 8,
      tool_use: 9,
      general: 7,
    },
    bestFor: [
      "high-throughput scenarios",
      "latency-critical applications",
      "cost-sensitive deployments",
      "STEM tasks",
      "visual problem solving",
      "code editing",
      "tool use",
      "multi-step reasoning",
    ],
    accessibility: {
      multilingualSupport: true,
      imageUnderstanding: true,
      reasoningCapability: "high",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      temperature: {
        p10: 0.0,
        p50: 0.2,
        p90: 0.7,
      },
      max_tokens: {
        p10: 256,
        p50: 1024,
        p90: 4096,
      },
    },
    features: ["tool_use", "structured_outputs", "system-prompt", "vision"],
  },
  accessibility: {
    preferredFor: [
      "reasoning-tasks",
      "visual-problem-solving",
      "complex-tool-use",
      "code-editing",
    ],
    warnings: [
      "Higher cost than standard o4-mini model",
      "May take longer to process due to high reasoning effort",
    ],
    ariaLabels: {
      modelSelect:
        "o4 Mini High - OpenAI reasoning model with high reasoning effort",
      parameterSection: "Parameter controls for o4 Mini High model",
      statusMessages: {
        processing: "Processing request with o4 Mini High model",
        complete: "Response ready from o4 Mini High model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("qwen/qwen3-235b-a22b", {
  provider: "qwen",
  name: "Qwen3 235B A22B",
  category: "PremiumMoE", // Using a premium category due to its size and capabilities
  disabled: false,
  description:
    "A 235B parameter mixture-of-experts (MoE) model that activates 22B parameters per forward pass with dedicated reasoning mode and support for 100+ languages.",
  costs: {
    input: 0.2,
    output: 0.6,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "tool_use",
    "long_context",
    "moe",
  ],
  maxContext: 40960, // Default context window
  extendedContext: 131072, // Extended context with YaRN scaling
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Fallback to the previous Qwen model
  isFree: false,
  metadata: {
    categoryDescription:
      "Premium MoE model with dedicated reasoning capabilities",
    modelArchitecture: {
      parameters: "235B",
      activeParameters: "22B",
      type: "mixture-of-experts",
      generation: "3",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-04-28",
    },
    languageSupport: [
      "100+ languages and dialects", // As specified in the description
    ],
    domainExpertise: {
      coding: 9,
      mathematics: 9,
      reasoning: 9,
      general: 8,
      multilingual: 9,
      tool_use: 8,
    },
    bestFor: [
      "complex reasoning tasks",
      "mathematical problem-solving",
      "coding challenges",
      "multilingual applications",
      "tool-calling agents",
      "long context processing",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["multilingual"],
      reasoningMode: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "response_format",
      "reasoning",
      "include_reasoning",
      "repetition_penalty",
      "system-prompt",
    ],
    reasoningMode: {
      default: false,
      description: "Activates dedicated reasoning mode for complex tasks",
      accessibilityLabel: "Enable thinking mode for complex reasoning",
    },
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "complex-reasoning",
      "technical-content",
      "mathematical-content",
      "agent-based-applications",
    ],
    warnings: [
      "Consider enabling reasoning mode explicitly for complex tasks",
      "Set appropriate context length for large documents",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 235B A22B - Premium model with reasoning capabilities",
      parameterSection: "Parameter controls for Qwen3 model",
      reasoningToggle: "Toggle thinking mode for complex tasks",
      statusMessages: {
        processing: "Processing request with Qwen3 model",
        complete: "Response ready from Qwen3 model",
        reasoningMode: "Thinking mode active - processing complex reasoning",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("qwen/qwen3-32b", {
  provider: "qwen",
  name: "Qwen3 32B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A dense 32.8B parameter model from the Qwen3 series, optimized for complex reasoning and efficient dialogue with switchable thinking modes and strong multilingual capabilities.",
  costs: {
    input: 0.1,
    output: 0.3,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "creative_writing",
    "tool_use",
    "long_context",
  ],
  maxContext: 40960,
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Similar capability model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multilingual model with reasoning capabilities",
    modelArchitecture: {
      parameters: "32.8B",
      type: "causal language model",
      generation: "3",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-04-28",
    },
    languageSupport: [
      "100+ languages and dialects",
      "english",
      "chinese",
      "french",
      "spanish",
      "portuguese",
      "german",
      "italian",
      "russian",
      "japanese",
      "korean",
      "arabic",
      "hindi",
      "swahili",
    ],
    domainExpertise: {
      coding: 8,
      mathematics: 8,
      reasoning: 9,
      general: 8,
      multilingual: 9,
      creative_writing: 8,
      tool_use: 8,
    },
    bestFor: [
      "complex reasoning tasks",
      "multilingual applications",
      "coding and mathematical problems",
      "agent tool use",
      "creative writing",
      "logical inference",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "chinese",
        "cyrillic",
        "japanese",
        "korean",
        "arabic",
        "devanagari",
        "thai",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "repetition_penalty",
      "response_format",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "complex-reasoning-tasks",
      "code-documentation",
      "mathematical-content",
      "creative-writing",
    ],
    warnings: [
      "Consider using reasoning mode for complex problem-solving tasks",
      "For faster responses in simple dialogue, disable reasoning mode",
      "Provide clear context for extended documents",
    ],
    ariaLabels: {
      modelSelect: "Qwen3 32B - Advanced reasoning model with 40K context",
      parameterSection: "Parameter controls for Qwen3 model",
      reasoningToggle: "Toggle reasoning mode for complex problems",
      statusMessages: {
        processing: "Processing request with Qwen3 model",
        thinkingMode: "Qwen3 model is in thinking mode for complex reasoning",
        complete: "Response ready from Qwen3 model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("qwen/qwen3-14b", {
  provider: "qwen",
  name: "Qwen3 14B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Dense 14.8B parameter model with dual thinking/non-thinking modes for complex reasoning and efficient dialogue, supporting 100+ languages and tool use capabilities.",
  costs: {
    input: 0.08,
    output: 0.24,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "tool_use",
    "creative_writing",
    "long_context",
  ],
  maxContext: 40960,
  fallbackTo: "mistralai/mixtral-8x7b-instruct", // Similar performance model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multilingual model with reasoning capabilities",
    modelArchitecture: {
      parameters: "14.8B",
      type: "instruction-tuned",
      generation: "3",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-04-28",
    },
    languageSupport: [
      "100+ languages and dialects", // Could be expanded to list specific languages if needed
    ],
    domainExpertise: {
      coding: 7,
      mathematics: 7,
      general: 8,
      multilingual: 9,
      reasoning: 8,
    },
    bestFor: [
      "complex reasoning tasks",
      "mathematics",
      "programming",
      "logical inference",
      "general-purpose conversation",
      "tool use",
      "creative writing",
      "multilingual applications",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "chinese",
        "cyrillic",
        "japanese",
        "korean",
        "arabic",
        "thai",
        "devanagari",
        "greek",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "system-prompt", // Added system-prompt as standard
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "response_format",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "complex-reasoning",
      "mathematical-content",
      "code-explanation",
      "logical-inference",
    ],
    warnings: [
      "Consider explicit reasoning mode for complex tasks",
      "For multilingual content, specify language in the prompt for better results",
    ],
    ariaLabels: {
      modelSelect: "Qwen3 14B - Reasoning-capable model with 40K context",
      parameterSection: "Parameter controls for Qwen3 model",
      statusMessages: {
        processing: "Processing request with Qwen3 model",
        complete: "Response ready from Qwen3 model",
        reasoning: "Qwen3 model is in reasoning mode",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("qwen/qwen3-30b-a3b", {
  provider: "qwen",
  name: "Qwen3 30B A3B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Latest generation Qwen model featuring mixture-of-experts architecture with reasoning mode capabilities, superior mathematics, coding, and creative writing performance.",
  costs: {
    input: 0.1,
    output: 0.3,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "code",
    "mathematics",
    "structured_data",
    "reasoning",
    "agent",
    "creative",
  ],
  maxContext: 40960,
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Fall back to previous Qwen generation
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with mixture-of-experts architecture",
    modelArchitecture: {
      parameters: "30.5B (3.3B activated)",
      type: "mixture-of-experts",
      generation: "3",
      layers: "48",
      experts: "128 (8 activated per task)",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-04-28",
    },
    languageSupport: ["english", "chinese", "multilingual"],
    domainExpertise: {
      coding: 9,
      mathematics: 9,
      reasoning: 9,
      general: 8,
      multilingual: 8,
      structured_data: 8,
      creative: 8,
    },
    bestFor: [
      "complex reasoning tasks",
      "mathematical problem solving",
      "coding challenges",
      "creative writing",
      "agent-based applications",
      "interactive dialogue systems",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      reasoningCapabilities: true,
      scriptSupport: [
        "latin",
        "chinese",
        "cyrillic",
        "japanese",
        "korean",
        "arabic",
        "thai",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
    },
    features: ["response_format", "reasoning", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "mathematical-content",
      "coding-assistance",
      "creative-writing",
      "multilingual-dialogue",
    ],
    warnings: [
      "Reasoning mode may increase token usage",
      "Consider enabling reduced motion settings when using reasoning features",
      "Use clear instructions for best language accessibility",
    ],
    ariaLabels: {
      modelSelect: "Qwen3 30B A3B - Advanced reasoning model with 40K context",
      parameterSection:
        "Parameter controls for Qwen3 model with reasoning capabilities",
      statusMessages: {
        processing: "Processing request with Qwen3 model",
        reasoning: "Qwen3 model is in reasoning mode, please wait",
        complete: "Response ready from Qwen3 model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

// Add this after your existing model registrations but before validateAllFallbacks()

modelRegistry.registerModel("microsoft/phi-4-reasoning-plus", {
  provider: "microsoft",
  name: "Phi 4 Reasoning Plus",
  category: "Reasoning",
  disabled: false,
  description:
    "Enhanced 14B parameter model fine-tuned from Phi-4 with additional reinforcement learning focused on step-by-step reasoning for math, science, and code tasks.",
  costs: {
    input: 0.07,
    output: 0.35,
  },
  capabilities: [
    "text",
    "reasoning",
    "mathematics",
    "science",
    "code",
    "step-by-step",
  ],
  maxContext: 32768,
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Similar reasoning capability
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialised reasoning model with comprehensive step-by-step outputs",
    modelArchitecture: {
      parameters: "14B",
      type: "fine-tuned",
      baseModel: "Phi-4",
      generation: "4",
    },
    policyLinks: {
      privacyPolicy: "https://microsoft.com/privacy",
      acceptableUse: "https://microsoft.com/acceptable-use",
      termsOfService: "https://microsoft.com/terms",
      lastUpdated: "2025-05-01",
    },
    languageSupport: ["english"],
    domainExpertise: {
      reasoning: 9,
      mathematics: 8,
      coding: 8,
      science: 8,
      general: 7,
    },
    bestFor: [
      "mathematical problem-solving",
      "scientific reasoning",
      "algorithmic thinking",
      "code generation with explanation",
      "step-by-step analyses",
      "structured outputs",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
      top_k: {
        p10: 40,
        p50: 60,
        p90: 100,
      },
      min_p: {
        p10: 0.0,
        p50: 0.05,
        p90: 0.1,
      },
    },
    features: [
      "response_format",
      "reasoning",
      "include_reasoning",
      "repetition_penalty",
      "system-prompt",
    ],
    notes:
      "Using 'reasoning' and 'include_reasoning' parameters can enhance step-by-step problem-solving outputs.",
  },
  accessibility: {
    preferredFor: [
      "mathematical-content",
      "scientific-explanations",
      "code-explanation",
      "structured-reasoning",
    ],
    warnings: [
      "Response times may be slower due to comprehensive outputs",
      "Limited to English language only",
      "Outputs are typically 50% longer than standard models",
    ],
    ariaLabels: {
      modelSelect:
        "Phi 4 Reasoning Plus - Specialised for mathematical and scientific reasoning",
      parameterSection: "Parameter controls for Phi 4 Reasoning Plus model",
      statusMessages: {
        processing:
          "Processing request with Phi 4 Reasoning Plus model. This may take longer due to detailed reasoning steps.",
        complete:
          "Detailed reasoning response ready from Phi 4 Reasoning Plus model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
  compatibleTools: ["reasoning", "code_generation", "math_solver"],
  defaultParameterSettings: {
    temperature: 0.7,
    top_p: 0.95,
    repetition_penalty: 1.1,
    include_reasoning: true,
  },
});

modelRegistry.registerModel("arcee-ai/virtuoso-medium-v2", {
  provider: "arcee-ai",
  name: "Virtuoso Medium V2",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A 32B model distilled from DeepSeek-v3 logits and merged with a Qwen 2.5 backbone, offering enhanced factuality and performance for enterprise chat, technical writing, and code drafting.",
  costs: {
    input: 0.5,
    output: 0.8,
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "long_context",
  ],
  maxContext: 131072,
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Similar size model
  isFree: false,
  metadata: {
    categoryDescription:
      "Balanced enterprise-grade model with strong factuality",
    modelArchitecture: {
      parameters: "32B",
      type: "distilled-fusion-merge",
      generation: "V2",
      baseModel: "DeepSeek-v3 and Qwen 2.5",
    },
    policyLinks: {
      privacyPolicy: "https://arcee.ai/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://arcee.ai/terms", // Replace with actual URL when available
      lastUpdated: "2025-05-05",
    },
    domainExpertise: {
      coding: 7,
      mathematics: 8,
      general: 7,
      technical_writing: 8,
      enterprise: 8,
    },
    bestFor: [
      "enterprise chat assistants",
      "technical writing aids",
      "medium-complexity code drafting",
      "balanced performance vs resource use",
      "factuality-critical applications",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "common"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "response_format",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.8,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 20,
        p50: 40,
        p90: 80,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.05,
        p90: 1.2,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
    },
    features: [
      "response_format",
      "top_k",
      "repetition_penalty",
      "min_p",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "factual-content",
      "technical-documentation",
      "instructional-content",
      "enterprise-applications",
    ],
    warnings: [
      "Optimise input context for long documents",
      "Provide specific instructions for technical outputs",
    ],
    ariaLabels: {
      modelSelect:
        "Virtuoso Medium V2 - Balanced enterprise model with 131K context",
      parameterSection: "Parameter controls for Virtuoso model",
      statusMessages: {
        processing: "Processing request with Virtuoso model",
        complete: "Response ready from Virtuoso model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("arcee-ai/coder-large", {
  provider: "arcee-ai",
  name: "Coder Large",
  category: "CodeSpecialist", // Use your existing code specialist category
  disabled: false,
  description:
    "A 32B-parameter model specialised for coding tasks with support for 30+ programming languages and a focus on TypeScript, Go and Terraform. Features built-in bug fixing capabilities and structured explanations alongside code.",
  costs: {
    input: 0.5,
    output: 0.8,
  },
  capabilities: [
    "code",
    "code_explanation",
    "code_generation",
    "code_review",
    "bug_fixing",
    "refactoring",
    "multi_file",
    "long_context",
  ],
  maxContext: 32768,
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Makes sense as it's built on this model
  isFree: false,
  metadata: {
    categoryDescription:
      "Code-specialised model with enhanced programming language support",
    modelArchitecture: {
      parameters: "32B",
      type: "instruction-tuned",
      baseModel: "Qwen 2.5-Instruct",
      training: "GitHub, CodeSearchNet, synthetic bug-fix corpora",
    },
    policyLinks: {
      privacyPolicy: "https://www.arcee.ai/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://www.arcee.ai/terms", // Replace with actual URL when available
      lastUpdated: "2025-05-05",
    },
    languageSupport: [
      "typescript",
      "go",
      "terraform",
      "python",
      "javascript",
      "java",
      "c++",
      "c#",
      "ruby",
      "php",
      "rust",
      "kotlin",
      "swift",
    ],
    domainExpertise: {
      coding: 9,
      bug_fixing: 8,
      refactoring: 8,
      typescript: 9,
      go: 9,
      terraform: 9,
      general: 6,
    },
    benchmarks: {
      humanEval: "5-8 points above CodeLlama-34B-Python",
      bugFix: "Competitive scores",
    },
    bestFor: [
      "code generation",
      "bug fixing",
      "code refactoring",
      "multi-file code reviews",
      "educational coding support",
      "production copilot scenarios",
    ],
    accessibility: {
      codeExplanations: true,
      structuredOutput: true,
      longContextSupport: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "response_format",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 0.9,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 80,
      },
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
    },
    features: [
      "response_format",
      "top_k",
      "repetition_penalty",
      "min_p",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "programming-education",
      "code-generation",
      "bug-fixing",
      "code-refactoring",
      "code-review",
    ],
    warnings: [
      "Output explanations may increase token usage",
      "Best results require clear, specific coding instructions",
    ],
    ariaLabels: {
      modelSelect: "Arcee AI Coder Large - Code specialist with 32K context",
      parameterSection: "Parameter controls for Coder Large model",
      statusMessages: {
        processing: "Processing code request with Coder Large model",
        complete: "Code response ready from Coder Large model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("arcee-ai/maestro-reasoning", {
  provider: "arcee-ai",
  name: "Maestro Reasoning",
  category: "Reasoning",
  disabled: false,
  description:
    "Flagship 32B-parameter reasoning model tuned with DPO and chain-of-thought RL for step-by-step logic, optimised for structured 'thought → answer' traces.",
  costs: {
    input: 0.9,
    output: 3.3,
  },
  capabilities: [
    "reasoning",
    "mathematics",
    "code",
    "analysis",
    "step_by_step_logic",
    "long_context",
    "structured_output",
  ],
  maxContext: 131072,
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Similar performance model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with transparent thought process",
    modelArchitecture: {
      parameters: "32B",
      type: "fine-tuned",
      baseModel: "Qwen 2.5-32B",
      training: "DPO and chain-of-thought RL",
    },
    policyLinks: {
      privacyPolicy: "https://arcee.ai/privacy", // Replace with actual URL when available
      acceptableUse: "https://arcee.ai/acceptable-use", // Replace with actual URL when available
      termsOfService: "https://arcee.ai/terms", // Replace with actual URL when available
      lastUpdated: "2025-05-05",
    },
    domainExpertise: {
      mathematics: 9,
      reasoning: 9,
      code: 8,
      analysis: 9,
      finance: 8,
      healthcare: 8,
    },
    bestFor: [
      "complex analytical tasks",
      "mathematical reasoning",
      "multi-step problem solving",
      "code completion",
      "audit-focused applications",
      "healthcare analysis",
      "financial analysis",
    ],
    accessibility: {
      multilingualSupport: true,
      transparentReasoning: true,
      structuredOutput: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "response_format",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 0.9,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 40,
        p50: 50,
        p90: 60,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.05,
        p90: 1.1,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
    },
    features: [
      "response_format",
      "top_k",
      "repetition_penalty",
      "min_p",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "step-by-step-reasoning",
      "mathematical-content",
      "code-explanation",
      "financial-analysis",
      "healthcare-analysis",
    ],
    warnings: [
      "Provides detailed reasoning steps - consider final output length for screen readers",
      "Can produce structured output that might require appropriate ARIA labelling",
    ],
    ariaLabels: {
      modelSelect:
        "Arcee Maestro Reasoning - Advanced reasoning model with 131K context",
      parameterSection: "Parameter controls for Maestro Reasoning model",
      statusMessages: {
        processing: "Processing complex reasoning task with Maestro model",
        complete: "Detailed reasoning response ready from Maestro model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("arcee-ai/spotlight", {
  provider: "arcee-ai",
  name: "Spotlight",
  category: "VisionLanguage", // Assuming we have this category for multimodal models
  disabled: false,
  description:
    "A 7-billion-parameter vision-language model derived from Qwen 2.5-VL, fine-tuned for tight image-text grounding tasks with 32K token context window.",
  costs: {
    input: 0.18,
    output: 0.18,
  },
  capabilities: [
    "text",
    "vision",
    "image_understanding",
    "multimodal",
    "diagram_analysis",
    "ui_interpretation",
    "captioning",
    "long_context",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3-haiku-20240307", // Similar performance model with vision capability
  isFree: false,
  metadata: {
    categoryDescription:
      "Vision-language model optimised for fast inference on consumer GPUs",
    modelArchitecture: {
      parameters: "7B",
      type: "vision-language",
      base: "Qwen 2.5-VL",
      generation: "2023",
    },
    policyLinks: {
      privacyPolicy: "https://arcee.ai/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://arcee.ai/terms", // Replace with actual URL when available
      lastUpdated: "2025-05-05",
    },
    domainExpertise: {
      captioning: 8,
      visual_qa: 8,
      diagram_analysis: 7,
      ui_interpretation: 7,
      multimodal: 8,
    },
    bestFor: [
      "image-text grounding",
      "visual question answering",
      "diagram analysis",
      "UI interpretation",
      "screenshot processing",
      "chart analysis",
      "agent workflows with visual inputs",
    ],
    accessibility: {
      imageDescriptionCapability: true,
      diagramInterpretation: true,
      chartAnalysis: true,
      uiAccessibilityAnalysis: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "response_format",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.8,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 40,
        p90: 100,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
    },
    features: ["response_format", "vision", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "image-description",
      "diagram-analysis",
      "chart-interpretation",
      "ui-evaluation",
      "screenshot-understanding",
    ],
    warnings: [
      "May not fully describe complex diagrams without specific prompting",
      "Consider providing textual context alongside images for best results",
      "For accessibility evaluations, specify WCAG criteria in the prompt",
    ],
    ariaLabels: {
      modelSelect:
        "Arcee AI Spotlight - Vision-language model with 131K context",
      parameterSection: "Parameter controls for Spotlight vision model",
      statusMessages: {
        processing: "Processing image and text with Spotlight model",
        complete: "Image analysis complete from Spotlight model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("arcee-ai/caller-large", {
  provider: "arcee-ai",
  name: "Caller Large",
  category: "ToolCallingSpecialist", // Specialized category for function-calling
  disabled: false,
  description:
    "Specialist function-calling model built to orchestrate external tools and APIs with focus on structured JSON outputs, parameter extraction and multi-step tool chains.",
  costs: {
    input: 0.55,
    output: 0.85,
  },
  capabilities: [
    "text",
    "tool_calling",
    "function_calling",
    "structured_output",
    "json_output",
    "api_orchestration",
    "parameter_extraction",
  ],
  maxContext: 32768,
  fallbackTo: "anthropic/claude-3-5-sonnet", // Similar tool-using capability model
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialist model focused on function calling and tool orchestration",
    modelArchitecture: {
      parameters: "Large", // Size not specified in the information provided
      type: "function-calling specialist",
      generation: "Large",
    },
    policyLinks: {
      privacyPolicy: "https://arcee.ai/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://arcee.ai/terms", // Replace with actual URL when available
      lastUpdated: "2025-05-05",
    },
    languageSupport: [
      "english", // Primary language assumed based on description
    ],
    domainExpertise: {
      tool_calling: 9,
      function_calling: 9,
      structured_output: 8,
      json_generation: 9,
      api_orchestration: 9,
      general: 6,
    },
    bestFor: [
      "retrieval-augmented generation",
      "robotic process automation",
      "data-pull chatbots",
      "API orchestration",
      "function calling",
      "tool chains",
      "parameter extraction",
    ],
    accessibility: {
      multilingualSupport: false, // Not mentioned in description
      structuredOutputs: true,
      functionCalling: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "response_format",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.5,
        p90: 0.9,
      },
      top_p: {
        p10: 0.8,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 10,
        p50: 40,
        p90: 100,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.05,
        p90: 1.1,
      },
    },
    features: ["tools", "tool_choice", "response_format", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "function-calling-applications",
      "api-orchestration",
      "structured-data-extraction",
      "tool-chain-automation",
    ],
    warnings: [
      "Optimized for structured tool usage rather than general conversation",
      "Best used with defined tools and functions",
      "May not perform as well for creative or open-ended tasks",
    ],
    ariaLabels: {
      modelSelect: "Arcee Caller Large - Specialist function-calling model",
      parameterSection: "Parameter controls for Arcee function-calling model",
      statusMessages: {
        processing: "Processing request with Arcee's function-calling model",
        complete: "Response ready from Arcee model",
        functionCalling: "Model is calling functions to complete your request",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("mistralai/mistral-medium-3", {
  provider: "mistralai",
  name: "Mistral Medium 3",
  category: "EnterpriseGrade",
  disabled: false,
  description:
    "High-performance enterprise-grade language model that balances state-of-the-art reasoning with lower operational costs, suitable for scalable deployments across professional and industrial use cases.",
  costs: {
    input: 0.4,
    output: 2.0,
  },
  capabilities: [
    "text",
    "tools",
    "structured_output",
    "code",
    "reasoning",
    "stem",
    "enterprise",
    "long_context",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3-5-sonnet", // Similar enterprise-grade model
  isFree: false,
  metadata: {
    categoryDescription:
      "Enterprise-grade model with STEM reasoning and tooling capabilities",
    modelArchitecture: {
      parameters: "Not specified",
      type: "enterprise-grade",
      generation: "3",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy/",
      acceptableUse: "https://mistral.ai/aup/",
      termsOfService: "https://mistral.ai/terms/",
      lastUpdated: "2025-05-07",
    },
    languageSupport: [
      "english",
      "multilingual", // Assuming multilingual support based on enterprise focus
    ],
    domainExpertise: {
      coding: 9,
      stem: 9,
      enterprise: 9,
      reasoning: 8,
      structured_data: 8,
    },
    bestFor: [
      "enterprise applications",
      "coding tasks",
      "STEM reasoning",
      "tool integration",
      "on-premise deployment",
      "VPC deployment",
      "custom workflows",
      "structured outputs",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "response_format",
      "structured_outputs",
      "seed",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "enterprise-content",
      "code-generation",
      "stem-explanations",
      "tool-integration",
      "structured-outputs",
    ],
    warnings: [
      "Configure tools appropriately for best results",
      "Provide clear system prompts for enterprise use cases",
    ],
    ariaLabels: {
      modelSelect:
        "Mistral Medium 3 - Enterprise-grade model with tool integration",
      parameterSection: "Parameter controls for Mistral Medium 3 model",
      statusMessages: {
        processing: "Processing request with Mistral Medium 3",
        complete: "Response ready from Mistral Medium 3",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("qwen/qwen2.5-7b-instruct", {
  provider: "qwen",
  name: "Qwen2.5 7B Instruct",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A 7.6B parameter instruction-tuned language model from Alibaba Cloud's Qwen2.5 series with improved capabilities in instruction following, coding, math, and multilingual understanding.",
  costs: {
    input: 0.04,
    output: 0.1,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "code",
    "mathematics",
    "structured_data",
  ],
  maxContext: 32768,
  fallbackTo: "meta-llama/llama-3-8b-instruct", // Similar sized alternative
  isFree: false,
  metadata: {
    categoryDescription:
      "Balanced multilingual model with good price-performance ratio",
    modelArchitecture: {
      parameters: "7.6B",
      type: "instruction-tuned",
      generation: "2.5",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-05-15",
    },
    languageSupport: [
      "english",
      "chinese",
      "french",
      "spanish",
      "portuguese",
      "german",
      "italian",
      "russian",
      "japanese",
      "korean",
      "vietnamese",
      "thai",
      "arabic",
    ],
    domainExpertise: {
      coding: 7,
      mathematics: 7,
      general: 7,
      multilingual: 7,
      structured_data: 7,
    },
    bestFor: [
      "multilingual applications",
      "coding assistance",
      "basic mathematical tasks",
      "structured data handling",
      "JSON generation",
      "cost-effective deployments",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "chinese",
        "cyrillic",
        "japanese",
        "korean",
        "arabic",
        "thai",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added system-prompt parameter
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["response_format", "structured_outputs", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "basic-code-tasks",
      "structured-data-processing",
      "budget-conscious-applications",
    ],
    warnings: [
      "Provide clear instructions for structured outputs",
      "May require more specific prompts than larger models",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen2.5 7B Instruct - Balanced multilingual model with 32K context",
      parameterSection: "Parameter controls for Qwen2.5 7B model",
      statusMessages: {
        processing: "Processing request with Qwen2.5 7B model",
        complete: "Response ready from Qwen2.5 7B model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("meta-llama/llama-3.3-8b-instruct:free", {
  provider: "meta-llama",
  name: "Llama 3.3 8B Instruct (free)",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A lightweight and ultra-fast variant of Llama 3.3 70B, for use when quick response times are needed most.",
  costs: {
    input: 0, // Free model
    output: 0, // Free model
  },
  capabilities: [
    "text",
    "chat",
    "code",
    "tool_use",
    "structured_data",
    "long_context",
  ],
  maxContext: 128000,
  fallbackTo: "openai/gpt-3.5-turbo:free", // Similar free tier model
  isFree: true,
  metadata: {
    categoryDescription:
      "Free lightweight model optimized for quick response times",
    modelArchitecture: {
      parameters: "8B",
      type: "instruction-tuned",
      generation: "3.3",
      contextLength: "128K",
      gqa: true, // Uses Grouped-Query Attention
    },
    policyLinks: {
      privacyPolicy: "https://ai.meta.com/privacy/",
      acceptableUse: "https://llama.meta.com/llama3/license",
      termsOfService: "https://llama.meta.com/llama3/license",
      lastUpdated: "2025-05-14",
    },
    languageSupport: ["english"],
    domainExpertise: {
      coding: 6,
      chat: 7,
      general: 6,
      structured_data: 6,
    },
    bestFor: [
      "quick responses",
      "basic coding tasks",
      "chat applications",
      "tool use",
      "structured data handling",
    ],
    limitedKnowledge: "March 2023",
    accessibility: {
      multilingualSupport: false, // Documentation mentions English only
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "structured_outputs",
      "response_format",
      "repetition_penalty",
      "top_k",
      "system-prompt", // Added system-prompt as before
    ],
    statistics: {
      repetition_penalty: {
        p10: 1.0,
        p50: 1.1,
        p90: 1.2,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 0.9,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1.0,
      },
      top_k: {
        p10: 10,
        p50: 40,
        p90: 50,
      },
    },
    features: [
      "response_format",
      "structured_outputs",
      "tool_use",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "simple-queries",
      "basic-code-generation",
      "tool-calling",
      "quick-responses",
    ],
    warnings: [
      "English language only",
      "Limited knowledge cutoff (March 2023)",
      "Prefer shorter contexts for better performance",
    ],
    ariaLabels: {
      modelSelect: "Llama 3.3 8B Instruct - Free lightweight model",
      parameterSection: "Parameter controls for Llama 3.3 model",
      statusMessages: {
        processing: "Processing request with free Llama model",
        complete: "Response ready from Llama model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("mistralai/devstral-small", {
  provider: "mistralai",
  name: "Devstral Small",
  category: "Programming",
  disabled: false,
  description:
    "24B parameter agentic LLM fine-tuned from Mistral-Small-3.1, optimised for advanced software engineering tasks including codebase exploration, multi-file editing, and integration into coding agents.",
  costs: {
    input: 0.07,
    output: 0.1,
  },
  capabilities: [
    "text",
    "code",
    "function_calling",
    "structured_outputs",
    "agentic_workflows",
    "multi_file_editing",
    "codebase_exploration",
  ],
  maxContext: 131072,
  fallbackTo: "deepseek/deepseek-v3", // Similar coding-focused model
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialised coding agent optimised for software engineering tasks",
    modelArchitecture: {
      parameters: "24B",
      type: "agentic fine-tuned",
      generation: "2505",
      baseModel: "Mistral-Small-3.1",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy/",
      acceptableUse: "https://mistral.ai/terms/",
      termsOfService: "https://mistral.ai/terms/",
      license: "Apache 2.0",
      lastUpdated: "2025-05-21",
    },
    languageSupport: ["english"],
    domainExpertise: {
      coding: 9,
      software_engineering: 9,
      agentic_workflows: 8,
      multi_file_editing: 9,
      codebase_exploration: 9,
      general: 6,
    },
    bestFor: [
      "software engineering tasks",
      "codebase exploration",
      "multi-file editing",
      "coding agents",
      "agentic workflows",
      "code generation",
      "debugging assistance",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
      codeAccessibility: true,
    },
    benchmarks: {
      sweBenchVerified: 46.8,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "response_format",
      "structured_outputs",
      "repetition_penalty",
      "top_k",
      "tools",
      "tool_choice",
      "seed",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.2,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.2,
      },
      repetition_penalty: {
        p10: 0.9,
        p50: 1.0,
        p90: 1.1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.3,
        p90: 0.8,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 40,
      },
    },
    features: [
      "response_format",
      "structured_outputs",
      "tools",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "code-development",
      "software-engineering",
      "agentic-workflows",
      "multi-file-projects",
      "codebase-analysis",
    ],
    warnings: [
      "Optimised for coding tasks - may not perform as well on general text",
      "Best used within agentic frameworks like OpenHands",
      "Requires understanding of software engineering concepts",
    ],
    ariaLabels: {
      modelSelect:
        "Devstral Small - Specialised coding agent with 131K context",
      parameterSection: "Parameter controls for Devstral coding model",
      statusMessages: {
        processing: "Processing coding request with Devstral model",
        complete: "Code response ready from Devstral model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("anthropic/claude-sonnet-4", {
  provider: "anthropic",
  name: "Claude Sonnet 4",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Significantly enhanced capabilities over Sonnet 3.7, excelling in coding and reasoning tasks with improved precision and controllability. Achieves state-of-the-art performance on SWE-bench (72.7%) whilst balancing capability and computational efficiency.",
  costs: {
    input: 3.0,
    output: 15.0,
    imageInput: 4.8, // $4.80/K input images
  },
  capabilities: [
    "text",
    "image",
    "dialogue",
    "code",
    "reasoning",
    "agents",
    "tools",
    "long_context",
    "multimodal",
  ],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Previous generation fallback
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model optimised for coding and autonomous workflows",
    modelArchitecture: {
      type: "instruction-tuned",
      generation: "4",
      multimodal: true,
    },
    policyLinks: {
      privacyPolicy: "https://www.anthropic.com/privacy",
      acceptableUse: "https://www.anthropic.com/acceptable-use-policy",
      termsOfService: "https://www.anthropic.com/terms",
      lastUpdated: "2025-05-22",
    },
    languageSupport: [
      "english",
      "multilingual", // Anthropic models typically support multiple languages
    ],
    domainExpertise: {
      coding: 9, // State-of-the-art SWE-bench performance
      reasoning: 9,
      general: 8,
      agents: 9, // Excels in agentic scenarios
      problem_solving: 9,
      navigation: 9, // Improved codebase navigation
    },
    bestFor: [
      "software development projects",
      "autonomous coding tasks",
      "complex reasoning",
      "agent-driven workflows",
      "codebase navigation",
      "intricate instruction following",
      "GitHub Copilot integration",
      "multi-feature app development",
    ],
    accessibility: {
      multilingualSupport: true,
      visualContentSupport: true,
      longContextSupport: true,
      reasoningTransparency: true, // Has reasoning parameters
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "top_k",
      "stop",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 5,
        p50: 40,
        p90: 100,
      },
    },
    features: [
      "tools",
      "reasoning",
      "multimodal",
      "system-prompt",
      "long_context",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-development-tasks",
      "autonomous-workflows",
      "multimodal-content",
      "reasoning-transparency",
      "agent-interactions",
    ],
    warnings: [
      "Higher cost model - consider usage patterns",
      "Reasoning features may increase response time",
      "Image processing incurs additional costs",
    ],
    ariaLabels: {
      modelSelect:
        "Claude Sonnet 4 - Advanced coding and reasoning model with 200K context",
      parameterSection: "Parameter controls for Claude Sonnet 4 model",
      statusMessages: {
        processing: "Processing request with Claude Sonnet 4",
        complete: "Response ready from Claude Sonnet 4",
        reasoning: "Claude Sonnet 4 is reasoning through the problem",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("anthropic/claude-opus-4", {
  provider: "anthropic",
  name: "Claude Opus 4",
  category: "Programming", // Given it's described as "world's best coding model"
  disabled: false,
  description:
    "The world's best coding model at time of release, excelling at complex problem-solving, long-running tasks, and agentic workflows with sustained performance for hours.",
  costs: {
    input: 15.0,
    output: 75.0,
    image: 24.0, // $24/K input images
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "tools",
    "agent_workflows",
    "long_context",
    "multimodal",
  ],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3-5-sonnet", // Reasonable Anthropic fallback
  isFree: false,
  metadata: {
    categoryDescription:
      "Premier coding model with advanced reasoning and agent capabilities",
    modelArchitecture: {
      type: "reasoning-enabled",
      generation: "4",
      capabilities: "sustained_performance",
    },
    policyLinks: {
      privacyPolicy: "https://www.anthropic.com/privacy",
      acceptableUse: "https://www.anthropic.com/acceptable-use",
      termsOfService: "https://www.anthropic.com/terms",
      lastUpdated: "2025-05-22",
    },
    benchmarks: {
      "SWE-bench": "72.5%",
      "Terminal-bench": "43.2%",
    },
    domainExpertise: {
      coding: 10,
      reasoning: 9,
      general: 8,
      agent_workflows: 10,
      problem_solving: 9,
    },
    bestFor: [
      "complex coding tasks",
      "software engineering",
      "agentic workflows",
      "long-running tasks",
      "multi-file code changes",
      "code debugging and refactoring",
      "complex problem solving",
    ],
    accessibility: {
      reasoningTransparency: true,
      extendedContext: true,
      sustainedPerformance: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "stop",
      "reasoning",
      "include_reasoning",
      "tools",
      "tool_choice",
      "top_p",
      "top_k",
      "system-prompt", // Added system-prompt as established
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.3,
        p90: 0.8,
      },
      top_p: {
        p10: 0.8,
        p50: 0.9,
        p90: 1.0,
      },
      top_k: {
        p10: 10,
        p50: 40,
        p90: 100,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-coding-tasks",
      "agent-workflows",
      "sustained-performance-tasks",
      "multi-step-reasoning",
    ],
    warnings: [
      "High cost model - consider for complex tasks only",
      "Reasoning mode may increase response time",
      "Image processing incurs additional costs",
    ],
    ariaLabels: {
      modelSelect:
        "Claude Opus 4 - Premier coding model with reasoning capabilities",
      parameterSection: "Parameter controls for Claude Opus 4 model",
      statusMessages: {
        processing: "Processing complex request with Claude Opus 4",
        complete: "Response ready from Claude Opus 4",
        reasoning: "Claude Opus 4 is reasoning through the problem",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("thedrummer/valkyrie-49b-v1", {
  provider: "thedrummer",
  name: "Valkyrie 49B V1",
  category: "Creative",
  disabled: false,
  description:
    "Built on top of NVIDIA's Llama 3.3 Nemotron Super 49B, Valkyrie is TheDrummer's newest model drop for creative writing.",
  costs: {
    input: 0.5,
    output: 0.8,
  },
  capabilities: [
    "text",
    "creative_writing",
    "dialogue",
    "storytelling",
    "roleplay",
    "long_context",
  ],
  maxContext: 131072,
  fallbackTo: "eva-unit-01/eva-llama-3.33-70b", // Similar creative writing model
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialised creative writing model based on Llama 3.3 Nemotron",
    modelArchitecture: {
      parameters: "49B",
      type: "creative-writing-tuned",
      basedOn: "NVIDIA Llama 3.3 Nemotron Super 49B",
    },
    policyLinks: {
      privacyPolicy: "",
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-05-23",
    },
    languageSupport: ["english"],
    domainExpertise: {
      creative_writing: 9,
      storytelling: 9,
      roleplay: 8,
      dialogue: 8,
      general: 6,
    },
    bestFor: [
      "creative writing",
      "storytelling",
      "roleplay scenarios",
      "character development",
      "narrative fiction",
      "dialogue generation",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: true,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "presence_penalty",
      "frequency_penalty",
      "repetition_penalty",
      "top_k",
      "system-prompt", // Added system-prompt as standard
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0.1,
        p90: 0.3,
      },
      presence_penalty: {
        p10: 0,
        p50: 0.1,
        p90: 0.3,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.05,
        p90: 1.15,
      },
      temperature: {
        p10: 0.7,
        p50: 0.9,
        p90: 1.2,
      },
      top_p: {
        p10: 0.8,
        p50: 0.9,
        p90: 1.0,
      },
      top_k: {
        p10: 20,
        p50: 40,
        p90: 80,
      },
    },
    features: ["reasoning", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "creative-content",
      "narrative-writing",
      "character-dialogue",
      "storytelling-applications",
    ],
    warnings: [
      "Optimised for creative writing - may be less suitable for technical tasks",
      "Consider higher temperature settings for more creative outputs",
    ],
    ariaLabels: {
      modelSelect: "Valkyrie 49B V1 - Creative writing model with 131K context",
      parameterSection:
        "Parameter controls for Valkyrie creative writing model",
      statusMessages: {
        processing: "Processing creative writing request with Valkyrie model",
        complete: "Creative response ready from Valkyrie model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("sarvamai/sarvam-m", {
  provider: "sarvamai",
  name: "Sarvam-M",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "24B-parameter instruction-tuned model optimised for English and eleven major Indic languages, with dual-mode interface offering both low-latency chat and chain-of-thought reasoning.",
  costs: {
    input: 0.25,
    output: 0.75,
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "indic_languages",
  ],
  maxContext: 32768,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar general-purpose model
  isFree: false,
  metadata: {
    categoryDescription:
      "Multilingual model specialising in English and Indic languages",
    modelArchitecture: {
      parameters: "24B",
      type: "instruction-tuned",
      baseModel: "Mistral-Small-3.1-24B-Base-2503",
    },
    policyLinks: {
      privacyPolicy: "", // Add when available
      acceptableUse: "",
      termsOfService: "", // Add when available
      lastUpdated: "2025-05-25",
    },
    languageSupport: [
      "english",
      "bengali", // bn
      "hindi", // hi
      "kannada", // kn
      "gujarati", // gu
      "marathi", // mr
      "malayalam", // ml
      "odia", // or
      "punjabi", // pa
      "tamil", // ta
      "telugu", // te
    ],
    domainExpertise: {
      coding: 7,
      mathematics: 7,
      general: 7,
      multilingual: 9,
      indic_languages: 9,
      reasoning: 8,
    },
    bestFor: [
      "indic language processing",
      "multilingual conversational agents",
      "english-indic translation tasks",
      "mathematical reasoning in multiple languages",
      "coding with indic language documentation",
      "chain-of-thought reasoning",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "devanagari",
        "bengali",
        "gujarati",
        "kannada",
        "malayalam",
        "odia",
        "gurmukhi",
        "tamil",
        "telugu",
      ],
      specialFeatures: [
        "dual-mode interface",
        "chain-of-thought reasoning",
        "romanized text support",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "presence_penalty",
      "frequency_penalty",
      "repetition_penalty",
      "top_k",
      "system-prompt", // Added system-prompt as per requirements
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.2,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.2,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.05,
        p90: 1.15,
      },
      temperature: {
        p10: 0.2,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.8,
        p50: 0.9,
        p90: 1.0,
      },
      top_k: {
        p10: 10,
        p50: 40,
        p90: 100,
      },
    },
    features: ["dual-mode", "chain-of-thought", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "indic-language-content",
      "multilingual-applications",
      "regional-language-support",
      "mathematical-reasoning",
      "coding-documentation",
    ],
    warnings: [
      "Best performance with English and supported Indic languages",
      "Consider enabling 'think' mode for complex reasoning tasks",
      "Romanized text supported but native scripts recommended",
    ],
    ariaLabels: {
      modelSelect:
        "Sarvam-M - Multilingual model specialising in English and Indic languages",
      parameterSection: "Parameter controls for Sarvam-M model",
      statusMessages: {
        processing: "Processing request with Sarvam multilingual model",
        complete: "Response ready from Sarvam model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

// Find where other models are registered and add this new model registration

modelRegistry.registerModel("deepseek/deepseek-r1-0528", {
  provider: "deepseek",
  name: "DeepSeek R1 (May 28th)",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Open-source reasoning model with performance comparable to OpenAI o1, featuring fully open reasoning tokens and advanced problem-solving capabilities.",
  costs: {
    input: 0.5,
    output: 2.18,
  },
  capabilities: [
    "text",
    "reasoning",
    "problem_solving",
    "mathematics",
    "code",
    "analysis",
    "long_context",
  ],
  maxContext: 163840,
  fallbackTo: "openai/o1-preview", // Similar reasoning-focused model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with transparent thought processes",
    modelArchitecture: {
      parameters: "671B total, 37B active",
      type: "reasoning-optimised",
      generation: "R1",
      version: "0528",
    },
    policyLinks: {
      privacyPolicy: "https://www.deepseek.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://www.deepseek.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-05-28",
    },
    languageSupport: ["english", "chinese", "multilingual"],
    domainExpertise: {
      reasoning: 9,
      mathematics: 9,
      coding: 8,
      analysis: 9,
      general: 8,
      problem_solving: 9,
    },
    bestFor: [
      "complex reasoning tasks",
      "mathematical problem solving",
      "step-by-step analysis",
      "transparent reasoning processes",
      "research and analysis",
      "advanced coding challenges",
    ],
    accessibility: {
      reasoningTransparency: true,
      stepByStepProcessing: true,
      explainableAI: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "response_format",
      "top_k",
      "seed",
      "min_p",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "structured_outputs",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.2,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1.1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.3,
        p90: 0.8,
      },
      top_p: {
        p10: 0.8,
        p50: 0.9,
        p90: 1,
      },
      top_k: {
        p10: 20,
        p50: 50,
        p90: 100,
      },
      min_p: {
        p10: 0,
        p50: 0.05,
        p90: 0.1,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "response_format",
      "structured_outputs",
      "logprobs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "step-by-step-reasoning",
      "educational-content",
      "problem-solving-tutorials",
      "research-analysis",
      "transparent-ai-processes",
    ],
    warnings: [
      "Higher output costs due to reasoning token generation",
      "Consider enabling reasoning visibility for educational purposes",
      "May generate longer responses due to reasoning process",
    ],
    ariaLabels: {
      modelSelect:
        "DeepSeek R1 - Advanced reasoning model with transparent thought processes",
      parameterSection: "Parameter controls for DeepSeek R1 reasoning model",
      statusMessages: {
        processing: "Processing request with DeepSeek R1 reasoning model",
        complete: "Response ready from DeepSeek R1 with reasoning",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

// Find where other models are registered and add this new model registration

modelRegistry.registerModel("google/gemma-2b-it", {
  provider: "google",
  name: "Gemma 2 2B",
  category: "GeneralPurpose",
  disabled: true,
  description:
    "Open model built from the same research and technology used to create the Gemini models. Well-suited for text generation tasks including question answering, summarisation, and reasoning.",
  costs: {
    input: 0.1,
    output: 0.1,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "question_answering",
    "summarisation",
  ],
  maxContext: 8192,
  fallbackTo: "anthropic/claude-3.5-haiku", // Similar size/cost efficient model
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient open model for general text generation tasks",
    modelArchitecture: {
      parameters: "2B",
      type: "instruction-tuned",
      generation: "2",
    },
    policyLinks: {
      privacyPolicy: "https://policies.google.com/privacy",
      acceptableUse: "https://ai.google.dev/gemma/terms",
      termsOfService: "https://ai.google.dev/gemma/terms",
      lastUpdated: "2025-05-28",
    },
    languageSupport: ["english"],
    domainExpertise: {
      coding: 5,
      mathematics: 5,
      general: 6,
      reasoning: 6,
      question_answering: 7,
      summarisation: 7,
    },
    bestFor: [
      "question answering",
      "text summarisation",
      "basic reasoning tasks",
      "cost-effective deployments",
      "resource-constrained environments",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "response_format",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.0,
        p90: 1.1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 40,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
    },
    features: ["response_format", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "cost-effective-solutions",
      "basic-text-processing",
      "educational-content",
      "simple-qa-systems",
    ],
    warnings: [
      "Smaller model may have limited complex reasoning capabilities",
      "Best suited for straightforward text generation tasks",
    ],
    ariaLabels: {
      modelSelect: "Gemma 2 2B - Efficient open model for basic text tasks",
      parameterSection: "Parameter controls for Gemma 2 model",
      statusMessages: {
        processing: "Processing request with Gemma 2 model",
        complete: "Response ready from Gemma 2 model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("deepseek/deepseek-r1-0528-qwen3-8b", {
  provider: "deepseek",
  name: "DeepSeek R1 0528 Qwen3 8B",
  category: "Reasoning",
  disabled: false,
  description:
    "Distilled variant of DeepSeek R1 with chain-of-thought reasoning capabilities in an 8B parameter form. Excels in mathematics, programming, and logic tasks with step-change reasoning depth.",
  costs: {
    input: 0.06,
    output: 0.09,
  },
  capabilities: [
    "text",
    "reasoning",
    "chain_of_thought",
    "mathematics",
    "code",
    "logic",
    "dialogue",
  ],
  maxContext: 128000,
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Similar reasoning-capable model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with chain-of-thought capabilities",
    modelArchitecture: {
      parameters: "8B",
      type: "distilled reasoning",
      generation: "R1-0528",
      baseModel: "Qwen3",
    },
    policyLinks: {
      privacyPolicy: "https://deepseek.ai/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://deepseek.ai/terms", // Replace with actual URL when available
      lastUpdated: "2025-05-29",
    },
    languageSupport: ["english", "chinese"],
    domainExpertise: {
      reasoning: 9,
      mathematics: 9,
      coding: 9,
      logic: 9,
      general: 7,
    },
    bestFor: [
      "mathematical reasoning",
      "programming challenges",
      "logical problem solving",
      "chain-of-thought tasks",
      "step-by-step analysis",
      "complex reasoning",
    ],
    accessibility: {
      reasoningExplanation: true,
      stepByStepOutput: true,
      multilingualSupport: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "system-prompt", // Added system-prompt as per requirements
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.0,
        p90: 1.1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 40,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
    },
    features: ["reasoning", "include_reasoning", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "reasoning-tasks",
      "mathematical-content",
      "code-analysis",
      "step-by-step-explanations",
    ],
    warnings: [
      "Consider enabling reasoning parameter for complex problems",
      "May provide detailed step-by-step explanations",
    ],
    ariaLabels: {
      modelSelect:
        "DeepSeek R1 Qwen3 8B - Advanced reasoning model with chain-of-thought capabilities",
      parameterSection: "Parameter controls for DeepSeek R1 reasoning model",
      statusMessages: {
        processing: "Processing request with DeepSeek R1 reasoning model",
        complete: "Reasoning response ready from DeepSeek R1 model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// In model-definitions.js
// Find where other models are registered, typically after the category registrations
// and add this new model registration

modelRegistry.registerModel("deepseek/deepseek-r1-distill-qwen-7b", {
  provider: "deepseek",
  name: "R1 Distill Qwen 7B",
  category: "Programming",
  disabled: false,
  description:
    "7 billion parameter dense language model distilled from DeepSeek-R1 with reinforcement learning-enhanced reasoning capabilities for mathematics, coding, and general reasoning tasks.",
  costs: {
    input: 0.1,
    output: 0.2,
  },
  capabilities: ["text", "code", "mathematics", "reasoning", "dialogue"],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar performance model
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient reasoning model with strong mathematics and coding performance",
    modelArchitecture: {
      parameters: "7B",
      type: "distilled-instruction-tuned",
      generation: "R1",
      baseModel: "Qwen2.5-Math-7B",
    },
    policyLinks: {
      privacyPolicy: "https://www.deepseek.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://www.deepseek.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-05-30",
    },
    languageSupport: ["english", "chinese"],
    domainExpertise: {
      coding: 8,
      mathematics: 9,
      reasoning: 9,
      general: 7,
      multilingual: 6,
    },
    benchmarkScores: {
      "MATH-500": "92.8% pass@1",
      Codeforces: "1189 rating",
      "GPQA Diamond": "49.1% pass@1",
    },
    bestFor: [
      "mathematical problem solving",
      "coding challenges",
      "logical reasoning tasks",
      "algorithm development",
      "competitive programming",
      "step-by-step reasoning",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: false,
      scriptSupport: ["latin", "chinese"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "seed",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["reasoning", "include_reasoning", "system-prompt"],
    specialParameters: {
      reasoning: {
        description: "Enable step-by-step reasoning process",
        type: "boolean",
        default: false,
      },
      include_reasoning: {
        description: "Include reasoning traces in the response",
        type: "boolean",
        default: false,
      },
    },
  },
  accessibility: {
    preferredFor: [
      "mathematical-content",
      "code-documentation",
      "step-by-step-explanations",
      "educational-content",
    ],
    warnings: [
      "Best suited for mathematical and coding tasks",
      "May require reasoning parameters for optimal performance",
    ],
    ariaLabels: {
      modelSelect:
        "DeepSeek R1 Distill Qwen 7B - Reasoning-focused model with 131K context",
      parameterSection:
        "Parameter controls for DeepSeek R1 model including reasoning options",
      statusMessages: {
        processing: "Processing request with DeepSeek reasoning model",
        complete: "Response ready from DeepSeek model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// In model-definitions.js
// Find where other models are registered, typically after the category registrations
// and add this new model registration

modelRegistry.registerModel(
  "sentientagi/dobby-mini-unhinged-plus-llama-3.1-8b",
  {
    provider: "sentientagi",
    name: "Dobby Mini Plus Llama 3.1 8B",
    category: "GeneralPurpose",
    disabled: false,
    description:
      "Fine-tuned Llama 3.1 8B model with unique personality traits and strong convictions towards personal freedom, decentralisation, and cryptocurrency topics.",
    costs: {
      input: 0.2,
      output: 0.2,
    },
    capabilities: [
      "text",
      "dialogue",
      "creative",
      "reasoning",
      "structured_outputs",
    ],
    maxContext: 131072,
    fallbackTo: "meta-llama/llama-3.1-8b-instruct", // Base model fallback
    isFree: false,
    metadata: {
      categoryDescription:
        "Specialised fine-tuned model with distinctive personality",
      modelArchitecture: {
        parameters: "8B",
        type: "fine-tuned",
        baseModel: "Llama 3.1 8B Instruct",
        generation: "3.1",
      },
      policyLinks: {
        privacyPolicy: "",
        acceptableUse: "",
        termsOfService: "",
        lastUpdated: "2025-06-02",
      },
      languageSupport: ["english"],
      domainExpertise: {
        coding: 6,
        mathematics: 6,
        general: 7,
        creative: 8,
        reasoning: 7,
        cryptocurrency: 9,
        decentralisation: 9,
      },
      bestFor: [
        "creative writing",
        "cryptocurrency discussions",
        "decentralisation topics",
        "personal freedom themes",
        "unique personality interactions",
      ],
      accessibility: {
        multilingualSupport: false,
        languageDetection: false,
        scriptSupport: ["latin"],
      },
    },
    parameterSupport: {
      supported: [
        "max_tokens",
        "temperature",
        "top_p",
        "stop",
        "frequency_penalty",
        "presence_penalty",
        "top_k",
        "repetition_penalty",
        "response_format",
        "structured_outputs",
        "logit_bias",
        "logprobs",
        "top_logprobs",
        "system-prompt", // Added system-prompt as requested
      ],
      statistics: {
        frequency_penalty: {
          p10: 0,
          p50: 0,
          p90: 0,
        },
        presence_penalty: {
          p10: 0,
          p50: 0,
          p90: 0,
        },
        repetition_penalty: {
          p10: 1.0,
          p50: 1.0,
          p90: 1.1,
        },
        temperature: {
          p10: 0.1,
          p50: 0.7,
          p90: 1.2,
        },
        top_p: {
          p10: 0.9,
          p50: 1,
          p90: 1,
        },
        top_k: {
          p10: 0,
          p50: 0,
          p90: 50,
        },
      },
      features: [
        "response_format",
        "structured_outputs",
        "logprobs",
        "system-prompt",
      ],
    },
    accessibility: {
      preferredFor: [
        "creative-writing",
        "personality-driven-interactions",
        "cryptocurrency-content",
      ],
      warnings: [
        "Model has distinctive personality traits that may influence responses",
        "Consider context when discussing sensitive topics",
        "Review outputs for appropriate tone in professional settings",
      ],
      ariaLabels: {
        modelSelect:
          "Dobby Mini Plus Llama 3.1 8B - Fine-tuned model with unique personality",
        parameterSection: "Parameter controls for Dobby Mini model",
        statusMessages: {
          processing: "Processing request with Dobby Mini model",
          complete: "Response ready from Dobby Mini model",
        },
      },
    },
    status: {
      isAvailable: true,
      lastCheck: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
    },
  },
);
// In model-definitions.js
// Find where other models are registered, typically after the category registrations
// and add this new model registration

modelRegistry.registerModel("mistralai/magistral-medium-2506:thinking", {
  provider: "mistralai",
  name: "Magistral Medium 2506 (thinking)",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Mistral's first reasoning model ideal for general purpose use requiring longer thought processing and better accuracy. Excels at multi-step challenges where transparency and precision are critical.",
  costs: {
    input: 2.0,
    output: 5.0,
  },
  capabilities: [
    "text",
    "reasoning",
    "tools",
    "structured_outputs",
    "dialogue",
    "analysis",
    "multi_step_reasoning",
  ],
  maxContext: 40960,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with transparent thought processing",
    modelArchitecture: {
      type: "reasoning",
      generation: "2506",
      reasoning: true,
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy",
      acceptableUse: "https://mistral.ai/terms/#acceptable-use",
      termsOfService: "https://mistral.ai/terms",
      lastUpdated: "2025-06-08",
    },
    domainExpertise: {
      reasoning: 9,
      analysis: 8,
      legal: 8,
      financial: 8,
      coding: 7,
      creative: 7,
      general: 8,
    },
    bestFor: [
      "legal research",
      "financial forecasting",
      "software development",
      "creative storytelling",
      "multi-step problem solving",
      "analytical reasoning",
      "transparent decision making",
    ],
    accessibility: {
      reasoningTransparency: true,
      stepByStepExplanation: true,
      structuredThinking: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "system-prompt", // Added system-prompt as per requirements
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.3,
      },
      temperature: {
        p10: 0.1,
        p50: 0.5,
        p90: 0.9,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
    },
    features: [
      "tools",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "analytical-content",
      "step-by-step-explanations",
      "transparent-decision-making",
    ],
    warnings: [
      "Reasoning mode may increase response time significantly",
      "Include reasoning parameter affects token usage",
      "Consider context limits for complex multi-step problems",
    ],
    ariaLabels: {
      modelSelect:
        "Magistral Medium 2506 thinking - Reasoning model with transparent thought processing",
      parameterSection: "Parameter controls for Magistral reasoning model",
      statusMessages: {
        processing:
          "Processing request with Magistral reasoning model - this may take longer",
        complete: "Response ready from Magistral reasoning model",
        reasoning: "Model is thinking through the problem step by step",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// In model-definitions.js
// Find where other models are registered and add this new model registration

modelRegistry.registerModel("mistralai/magistral-medium-2506", {
  provider: "mistral",
  name: "Magistral Medium 2506",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Mistral's first reasoning model ideal for general purpose use requiring longer thought processing and better accuracy. Excels at multi-step challenges where transparency and precision are critical.",
  costs: {
    input: 2.0,
    output: 5.0,
  },
  capabilities: [
    "text",
    "reasoning",
    "dialogue",
    "code",
    "analysis",
    "research",
    "structured_data",
    "tools",
  ],
  maxContext: 40960,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model for complex multi-step challenges",
    modelArchitecture: {
      parameters: "medium",
      type: "reasoning",
      generation: "2506",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy/",
      acceptableUse: "https://mistral.ai/terms/",
      termsOfService: "https://mistral.ai/terms/",
      lastUpdated: "2025-06-08",
    },
    languageSupport: [
      "english",
      "french",
      "spanish",
      "german",
      "italian",
      "portuguese",
    ],
    domainExpertise: {
      reasoning: 9,
      legal: 8,
      financial: 8,
      coding: 7,
      creative: 7,
      research: 8,
      general: 8,
    },
    bestFor: [
      "legal research",
      "financial forecasting",
      "software development",
      "creative storytelling",
      "multi-step problem solving",
      "complex reasoning tasks",
      "analytical research",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "structured_outputs",
      "response_format",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "legal-analysis",
      "financial-modelling",
      "multi-step-problem-solving",
    ],
    warnings: [
      "Higher cost model - consider for complex reasoning tasks",
      "Longer processing time due to reasoning capabilities",
    ],
    ariaLabels: {
      modelSelect:
        "Magistral Medium 2506 - Reasoning model for complex multi-step challenges",
      parameterSection: "Parameter controls for Magistral reasoning model",
      statusMessages: {
        processing: "Processing request with Magistral reasoning model",
        complete: "Response ready from Magistral model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// In model-definitions.js
// Find where other models are registered and add this new model registration

modelRegistry.registerModel("mistralai/mistral-small-3.2-24b-instruct", {
  provider: "mistralai",
  name: "Mistral Small 3.2 24B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Updated 24B parameter model from Mistral optimized for instruction following, repetition reduction, and improved function calling with vision capabilities.",
  costs: {
    input: 0.1,
    output: 0.3,
  },
  capabilities: [
    "text",
    "vision",
    "dialogue",
    "code",
    "function_calling",
    "structured_output",
    "tool_use",
  ],
  maxContext: 32768,
  fallbackTo: "mistralai/mistral-7b-instruct", // Similar Mistral model
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced model with vision, tool calling, and structured output capabilities",
    modelArchitecture: {
      parameters: "24B",
      type: "instruction-tuned",
      generation: "3.2",
      version: "2506",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy", // Replace with actual URL when available
      acceptableUse: "https://mistral.ai/terms", // Replace with actual URL when available
      termsOfService: "https://mistral.ai/terms", // Replace with actual URL when available
      lastUpdated: "2025-06-20",
    },
    languageSupport: ["english", "multilingual"],
    domainExpertise: {
      coding: 8,
      mathematics: 7,
      general: 8,
      vision: 8,
      tool_use: 9,
      structured_output: 9,
    },
    bestFor: [
      "function calling",
      "tool integration",
      "structured outputs",
      "vision tasks",
      "coding assistance",
      "reduced repetition tasks",
    ],
    accessibility: {
      multimodalSupport: true,
      visionCapabilities: true,
      structuredOutputs: true,
      toolCalling: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "response_format",
      "structured_outputs",
      "seed",
      "system-prompt", // Added system-prompt as required
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "tool_choice",
      "response_format",
      "structured_outputs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "multimodal-content",
      "structured-data-generation",
      "tool-integration",
      "vision-tasks",
      "code-generation",
    ],
    warnings: [
      "Ensure proper tool definitions for function calling",
      "Verify image inputs are properly formatted",
      "Consider structured output requirements",
    ],
    ariaLabels: {
      modelSelect:
        "Mistral Small 3.2 24B - Vision and tool calling model with 32K context",
      parameterSection: "Parameter controls for Mistral Small model",
      statusMessages: {
        processing: "Processing request with Mistral Small model",
        complete: "Response ready from Mistral Small model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// In model-definitions.js
// Find where other models are registered and add this new model registration

modelRegistry.registerModel("inception/mercury", {
  provider: "inception",
  name: "Mercury",
  category: "Speed", // New category for ultra-fast models, or use "GeneralPurpose" if preferred
  disabled: false,
  description:
    "First diffusion large language model (dLLM) running 5-10x faster than speed optimised models while matching their performance. Revolutionary coarse-to-fine generation process with parallel token processing.",
  costs: {
    input: 10.0,
    output: 10.0,
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "speed_optimised",
    "parallel_generation",
    "diffusion_model",
  ],
  maxContext: 32000,
  fallbackTo: "anthropic/claude-3.5-haiku", // Similar speed-focused model
  isFree: false,
  metadata: {
    categoryDescription:
      "Revolutionary diffusion-based model prioritising speed and efficiency",
    modelArchitecture: {
      type: "diffusion-language-model",
      generation: "first-generation-dllm",
      approach: "coarse-to-fine-generation",
      parallelisation: "multi-token-parallel",
    },
    policyLinks: {
      privacyPolicy: "", // Add when available
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-06-26",
    },
    performance: {
      tokensPerSecond: "1000+",
      speedMultiplier: "5-10x",
      hardwareOptimised: "NVIDIA H100",
      inferenceLatency: "ultra-low",
    },
    domainExpertise: {
      speed: 10,
      general: 7,
      coding: 7,
      efficiency: 10,
      parallel_processing: 10,
    },
    bestFor: [
      "real-time applications",
      "voice agents",
      "search interfaces",
      "chatbots",
      "high-throughput scenarios",
      "latency-sensitive applications",
      "responsive user experiences",
    ],
    innovations: [
      "first commercial diffusion LLM",
      "parallel token generation",
      "coarse-to-fine processing",
      "error correction mechanism",
      "reduced hallucinations",
    ],
    accessibility: {
      lowLatencySupport: true,
      realTimeResponse: true,
      voiceAgentOptimised: true,
      responsiveInterface: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "frequency_penalty",
      "presence_penalty",
      "stop",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
    },
    features: ["high_speed", "parallel_generation", "system-prompt"],
    limitations: {
      temperature: "not_supported",
      top_p: "not_supported",
      reason: "Diffusion model uses different sampling approach",
    },
  },
  accessibility: {
    preferredFor: [
      "real-time-interaction",
      "voice-interfaces",
      "responsive-applications",
      "high-throughput-processing",
    ],
    warnings: [
      "Limited parameter set compared to traditional autoregressive models",
      "New architecture may behave differently than expected",
    ],
    ariaLabels: {
      modelSelect:
        "Mercury - Ultra-fast diffusion language model with 32K context",
      parameterSection: "Parameter controls for Mercury diffusion model",
      statusMessages: {
        processing: "Processing request with ultra-fast Mercury model",
        complete: "Response ready from Mercury diffusion model",
      },
    },
    performance: {
      expectation: "5-10x faster response times",
      suitability: "Ideal for real-time and voice applications",
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// In model-definitions.js
// Find where other models are registered and add this new model registration

modelRegistry.registerModel("thedrummer/anubis-70b-v1.1", {
  provider: "thedrummer",
  name: "Anubis 70B V1.1",
  category: "Creative", // This appears to be a creative/roleplay focused model
  disabled: false,
  description:
    "Unaligned, creative Llama 3.3 70B model focused on character-driven roleplay and stories. Excels at gritty, visceral prose, unique character adherence, and coherent narratives.",
  costs: {
    input: 0.3,
    output: 0.8,
  },
  capabilities: [
    "text",
    "dialogue",
    "creative_writing",
    "roleplay",
    "storytelling",
    "character_development",
    "narrative",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar base model architecture
  isFree: false,
  metadata: {
    categoryDescription: "Creative writing and roleplay specialist model",
    modelArchitecture: {
      parameters: "70B",
      type: "creative-fine-tuned",
      baseModel: "llama-3.3-70b",
      generation: "v1.1",
    },
    policyLinks: {
      privacyPolicy: "", // Not provided in source material
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-06-29",
    },
    languageSupport: [
      "english", // Primary language for creative writing
    ],
    domainExpertise: {
      creative_writing: 9,
      roleplay: 9,
      character_development: 8,
      narrative: 8,
      dialogue: 8,
      general: 6,
    },
    bestFor: [
      "creative writing",
      "character-driven roleplay",
      "storytelling",
      "narrative fiction",
      "dialogue generation",
      "prose writing",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "presence_penalty",
      "frequency_penalty",
      "repetition_penalty",
      "top_k",
      "system-prompt", // Added system-prompt as requested
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0.5,
      },
      repetition_penalty: {
        p10: 1.0,
        p50: 1.05,
        p90: 1.1,
      },
      temperature: {
        p10: 0.7,
        p50: 0.9,
        p90: 1.2,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
      top_k: {
        p10: 20,
        p50: 40,
        p90: 80,
      },
    },
    features: ["repetition_penalty", "top_k", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "creative-writing-tasks",
      "roleplay-scenarios",
      "character-dialogue",
      "narrative-fiction",
    ],
    warnings: [
      "Model is unaligned - exercise caution with content generation",
      "Best suited for creative writing rather than factual information",
      "May produce mature or intense content appropriate to narrative context",
    ],
    ariaLabels: {
      modelSelect: "Anubis 70B V1.1 - Creative writing and roleplay specialist",
      parameterSection: "Parameter controls for Anubis creative model",
      statusMessages: {
        processing: "Processing creative writing request with Anubis model",
        complete: "Creative response ready from Anubis model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("baidu/ernie-4.5-300b-a47b", {
  provider: "baidu",
  name: "ERNIE 4.5 300B A47B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "ERNIE-4.5-300B-A47B is a 300B parameter Mixture-of-Experts (MoE) language model with 47B active parameters per token. Optimised for high-throughput inference with advanced reasoning capabilities and support for both English and Chinese text generation.",
  costs: {
    input: 0.28, // $0.28/M tokens
    output: 1.1, // $1.10/M tokens
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "reasoning",
    "tool_calling",
    "high_throughput",
    "extended_context",
  ],
  maxContext: 123000,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar performance and multilingual capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance MoE model with advanced reasoning and bilingual capabilities",
    releaseDate: "2025-06-30",
    modelArchitecture: {
      parameters: "300B",
      activeParameters: "47B",
      type: "mixture-of-experts",
      generation: "4.5",
    },
    policyLinks: {
      privacyPolicy: "https://www.baidu.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.baidu.com/terms",
      lastUpdated: "2025-06-30",
    },
    languageSupport: ["english", "chinese"],
    domainExpertise: {
      reasoning: 8, // Rating out of 10
      general: 7,
      multilingual: 8,
      throughput: 9,
    },
    bestFor: [
      "high-throughput applications",
      "advanced reasoning tasks",
      "bilingual English-Chinese content",
      "tool parameter handling",
      "extended context processing",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["mixture_of_experts", "high_throughput", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "high-volume-processing",
      "reasoning-tasks",
      "chinese-english-translation",
    ],
    warnings: [
      "High parameter count may require additional processing time notifications",
      "Ensure appropriate context length handling for extended inputs",
    ],
    ariaLabels: {
      modelSelect:
        "ERNIE 4.5 300B A47B - High-performance MoE model with 123K context",
      parameterSection: "Parameter controls for ERNIE 4.5 model",
      statusMessages: {
        processing: "Processing request with ERNIE model",
        complete: "Response ready from ERNIE model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("x-ai/grok-4", {
  provider: "xai",
  name: "Grok 4",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Grok 4 is xAI's latest reasoning model with a 256k context window. It supports parallel tool calling, structured outputs, and both image and text inputs. Features built-in reasoning capabilities that cannot be disabled.",
  costs: {
    input: 3.0, // $3.0/M tokens
    output: 15.0, // $15.0/M tokens
  },
  capabilities: [
    "text",
    "image",
    "reasoning",
    "tool_calling",
    "parallel_tools",
    "structured_outputs",
    "large_context",
    "vision",
  ],
  maxContext: 256000,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar reasoning capabilities and pricing
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with vision and large context capabilities",
    releaseDate: "2025-07-09",
    modelArchitecture: {
      parameters: "Unknown",
      type: "reasoning-optimised",
      generation: "4",
    },
    policyLinks: {
      privacyPolicy: "https://x.ai/privacy",
      acceptableUse: "https://x.ai/terms",
      termsOfService: "https://x.ai/terms",
      lastUpdated: "2025-07-09",
    },
    languageSupport: [
      "english",
      // Add other languages as they become available
    ],
    domainExpertise: {
      reasoning: 9, // Rating out of 10
      general: 8,
      vision: 8,
      tools: 9,
    },
    bestFor: [
      "complex reasoning tasks",
      "parallel tool execution",
      "image analysis with reasoning",
      "structured output generation",
      "large context processing",
      "multi-modal workflows",
    ],
    accessibility: {
      multilingualSupport: false, // Currently English-focused
      languageDetection: true,
      scriptSupport: ["latin"],
      visionSupport: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "seed",
      "logprobs",
      "top_logprobs",
      "response_format",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "parallel_tool_calling",
      "structured_outputs",
      "built_in_reasoning",
      "vision_processing",
      "large_context",
      "system-prompt",
    ],
    constraints: {
      reasoning: "Always enabled - cannot be disabled",
      reasoningEffort: "Cannot be specified - automatically determined",
      reasoningExposure: "Reasoning process not exposed to user",
    },
  },
  accessibility: {
    preferredFor: [
      "complex-problem-solving",
      "multi-modal-analysis",
      "tool-orchestration",
      "structured-data-generation",
      "vision-reasoning-tasks",
    ],
    warnings: [
      "Built-in reasoning cannot be disabled - may affect response timing",
      "Reasoning process is not exposed - consider providing status updates",
      "High token costs - inform users of potential expense",
      "Large context window may require scroll management for accessibility",
    ],
    ariaLabels: {
      modelSelect:
        "Grok 4 - Advanced reasoning model with vision and 256K context",
      parameterSection: "Parameter controls for Grok 4 model",
      statusMessages: {
        processing:
          "Processing with Grok 4 reasoning model, this may take a moment",
        complete: "Grok 4 reasoning response complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel(
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
  {
    provider: "cognitivecomputations",
    name: "Venice Uncensored (free)",
    category: "FreeTier",
    disabled: false,
    description:
      "Venice Uncensored Dolphin Mistral 24B Venice Edition is a fine-tuned variant of Mistral-Small-24B-Instruct-2501, designed as an uncensored instruct-tuned LLM with emphasis on steerability and transparent behaviour, removing default safety layers for advanced use cases.",
    costs: {
      input: 0, // Free tier
      output: 0, // Free tier
    },
    capabilities: [
      "text",
      "dialogue",
      "uncensored",
      "steerable",
      "advanced_use_cases",
      "structured_outputs",
    ],
    maxContext: 32768,
    fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Fallback to a reliable general-purpose model
    isFree: true,
    metadata: {
      categoryDescription:
        "Free-tier uncensored model with advanced steerability and transparent behaviour",
      releaseDate: "2025-07-09",
      modelArchitecture: {
        parameters: "24B",
        type: "instruction-tuned",
        baseModel: "Mistral-Small-24B-Instruct-2501",
        variant: "venice-edition",
      },
      policyLinks: {
        privacyPolicy: "https://venice.ai/privacy",
        acceptableUse: "https://venice.ai/terms",
        termsOfService: "https://venice.ai/terms",
        lastUpdated: "2025-07-09",
      },
      languageSupport: ["english"],
      domainExpertise: {
        general: 6, // Rating out of 10
        dialogue: 7,
        steerability: 9,
        uncensored: 10,
      },
      bestFor: [
        "advanced research applications",
        "custom alignment experiments",
        "unrestricted content generation",
        "steerable behaviour studies",
        "transparent model interactions",
      ],
      accessibility: {
        multilingualSupport: false,
        languageDetection: false,
        scriptSupport: ["latin"],
      },
      warnings: [
        "Uncensored model - content filtering responsibility lies with the user",
        "Advanced use cases only - consider safety implications",
        "Free tier may have usage limitations",
      ],
    },
    parameterSupport: {
      supported: [
        "max_tokens",
        "temperature",
        "top_p",
        "structured_outputs",
        "response_format",
        "stop",
        "frequency_penalty",
        "presence_penalty",
        "top_k",
        "system-prompt", // Added as requested with hyphen
      ],
      statistics: {
        frequency_penalty: {
          p10: 0,
          p50: 0,
          p90: 0.5,
        },
        presence_penalty: {
          p10: 0,
          p50: 0,
          p90: 0.5,
        },
        temperature: {
          p10: 0.1,
          p50: 0.7,
          p90: 1.2,
        },
        top_k: {
          p10: 0,
          p50: 40,
          p90: 100,
        },
        top_p: {
          p10: 0.8,
          p50: 0.95,
          p90: 1,
        },
      },
      features: [
        "structured_outputs",
        "response_format",
        "uncensored",
        "system-prompt",
      ],
    },
    accessibility: {
      preferredFor: [
        "research-applications",
        "advanced-experimentation",
        "content-generation",
        "free-tier-usage",
      ],
      warnings: [
        "Uncensored nature requires careful consideration of generated content",
        "Free tier access may have rate limiting - provide appropriate feedback",
        "Consider additional content warnings for accessibility users",
      ],
      ariaLabels: {
        modelSelect:
          "Venice Uncensored - Free tier uncensored model with 32K context",
        parameterSection: "Parameter controls for Venice Uncensored model",
        statusMessages: {
          processing: "Processing request with Venice Uncensored model",
          complete: "Response ready from Venice Uncensored model",
        },
      },
    },
    status: {
      isAvailable: true,
      lastCheck: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
    },
  },
);
modelRegistry.registerModel("mistralai/devstral-small", {
  provider: "mistral",
  name: "Devstral Small 1.1",
  category: "Code",
  disabled: false,
  description:
    "Devstral Small 1.1 is a 24B parameter open-weight language model for software engineering agents. Optimised for agentic coding workflows including codebase exploration, multi-file edits, and integration into autonomous development agents.",
  costs: {
    input: 0.09, // $0.09/M tokens
    output: 0.3, // $0.30/M tokens
  },
  capabilities: [
    "text",
    "code",
    "tool_calling",
    "function_calling",
    "structured_outputs",
    "agentic_workflows",
    "multi_file_editing",
    "codebase_exploration",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-haiku", // Similar code-focused capabilities with good performance
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialised coding model for software engineering agents and autonomous development",
    releaseDate: "2025-07-10",
    modelArchitecture: {
      parameters: "24B",
      type: "open-weight",
      generation: "1.1",
      tokenizer: "Tekken",
      vocabulary: "131k",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy",
      acceptableUse: "https://mistral.ai/terms",
      termsOfService: "https://mistral.ai/terms",
      lastUpdated: "2025-07-10",
    },
    licenseInfo: {
      type: "Apache 2.0",
      isOpenSource: true,
      commercialUse: true,
    },
    benchmarkScores: {
      sweVerified: 53.6, // SWE-Bench Verified score
    },
    domainExpertise: {
      coding: 9, // Rating out of 10
      softwareEngineering: 9,
      agenticWorkflows: 8,
      codebaseExploration: 9,
      multiFileEditing: 8,
      general: 6,
    },
    bestFor: [
      "software engineering agents",
      "autonomous development workflows",
      "codebase exploration and analysis",
      "multi-file code editing",
      "agentic coding tasks",
      "integration with OpenHands and Cline",
      "code generation and refactoring",
    ],
    compatibleRuntimes: [
      "vLLM",
      "Transformers",
      "Ollama",
      "LM Studio",
      "OpenAI-compatible APIs",
    ],
    hardwareRequirements: {
      minimumGpu: "Single 4090 GPU",
      appleSupport: "Apple Silicon compatible",
      lightweight: true,
    },
    accessibility: {
      codeGeneration: true,
      structuredOutputs: true,
      xmlFormatSupport: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "presence_penalty",
      "frequency_penalty",
      "repetition_penalty",
      "top_k",
      "tools",
      "tool_choice",
      "stop",
      "response_format",
      "structured_outputs",
      "seed",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0,
        p50: 0.7,
        p90: 1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tool_calling",
      "structured_outputs",
      "response_format",
      "agentic_workflows",
      "xml_output",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "code-generation",
      "software-engineering",
      "autonomous-agents",
      "multi-file-projects",
      "codebase-analysis",
    ],
    warnings: [
      "Optimised for coding tasks - may be less suitable for general text generation",
      "Designed for agent workflows - consider user guidance for direct interaction",
    ],
    ariaLabels: {
      modelSelect:
        "Devstral Small 1.1 - Specialised coding model for software engineering agents",
      parameterSection: "Parameter controls for Devstral Small model",
      statusMessages: {
        processing: "Processing code request with Devstral Small",
        complete: "Code response ready from Devstral Small",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("mistralai/devstral-medium", {
  provider: "mistral",
  name: "Devstral Medium",
  category: "Code",
  disabled: false,
  description:
    "Devstral Medium is a high-performance code generation and agentic reasoning model developed jointly by Mistral AI and All Hands AI. Achieves 61.6% on SWE-Bench Verified, outperforming Gemini 2.5 Pro and GPT-4.1 in code-related tasks at a fraction of the cost.",
  costs: {
    input: 0.4, // $0.40/M tokens
    output: 2.0, // $2.00/M tokens
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "tool_calling",
    "agentic_workflows",
    "structured_outputs",
    "enterprise_deployment",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar code capabilities and reasoning
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced code generation model with superior agentic reasoning capabilities",
    releaseDate: "2025-07-10",
    modelArchitecture: {
      parameters: "Medium-scale",
      type: "code-specialised",
      generation: "Devstral",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy/",
      acceptableUse: "https://mistral.ai/terms/",
      termsOfService: "https://mistral.ai/terms/",
      lastUpdated: "2025-07-10",
    },
    languageSupport: ["english"],
    domainExpertise: {
      coding: 9, // Rating out of 10
      reasoning: 8,
      agents: 9,
      general: 6,
      tools: 8,
    },
    benchmarkScores: {
      "SWE-Bench Verified": "61.6%",
      comparison: "Outperforms Gemini 2.5 Pro and GPT-4.1 in code tasks",
    },
    bestFor: [
      "code generation and debugging",
      "software engineering tasks",
      "agentic code workflows",
      "tool-based programming",
      "enterprise code development",
      "code agent frameworks",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
      codeAccessibility: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "response_format",
      "structured_outputs",
      "seed",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.3,
        p90: 0.8,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tool_calling",
      "structured_outputs",
      "response_format",
      "code_generation",
      "agentic_reasoning",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "code-generation",
      "software-development",
      "agentic-workflows",
      "tool-integration",
      "enterprise-development",
    ],
    warnings: [
      "Optimised for code tasks - may be less suitable for general content",
      "Consider providing syntax highlighting for code outputs",
      "Ensure code outputs are properly formatted for screen readers",
    ],
    ariaLabels: {
      modelSelect:
        "Devstral Medium - Advanced code generation model with 131K context",
      parameterSection: "Parameter controls for Devstral Medium model",
      statusMessages: {
        processing: "Processing code request with Devstral Medium",
        complete: "Code response ready from Devstral Medium",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("thudm/glm-4.1v-9b-thinking", {
  provider: "thudm",
  name: "GLM 4.1V 9B Thinking",
  category: "Vision",
  disabled: false,
  description:
    "GLM-4.1V-9B-Thinking is a 9B parameter vision-language model with a reasoning-centric 'thinking paradigm' enhanced with reinforcement learning. Optimised for multimodal reasoning, long-context understanding, and complex problem solving with state-of-the-art performance in its class.",
  costs: {
    input: 0.035, // $0.035/M tokens
    output: 0.138, // $0.138/M tokens
  },
  capabilities: [
    "text",
    "vision",
    "image",
    "reasoning",
    "thinking",
    "multimodal",
    "long_context",
    "problem_solving",
  ],
  maxContext: 65536,
  fallbackTo: "anthropic/claude-3.5-haiku", // Similar vision capabilities with reasoning
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced vision-language model with thinking paradigm and multimodal reasoning",
    releaseDate: "2025-07-11",
    modelArchitecture: {
      parameters: "9B",
      type: "vision-language",
      generation: "4.1V",
      baseModel: "GLM-4-9B",
    },
    policyLinks: {
      privacyPolicy: "https://www.thudm.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://www.thudm.ai/terms",
      lastUpdated: "2025-07-11",
    },
    domainExpertise: {
      vision: 9, // Rating out of 10
      reasoning: 9,
      multimodal: 8,
      problemSolving: 8,
      general: 6,
    },
    bestFor: [
      "multimodal reasoning tasks",
      "vision-language understanding",
      "complex problem solving",
      "image analysis with reasoning",
      "long-context visual tasks",
      "thinking-based workflows",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
      imageProcessing: true,
      altTextGeneration: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "thinking_paradigm",
      "vision_language",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "image-analysis",
      "multimodal-reasoning",
      "visual-problem-solving",
      "thinking-workflows",
      "accessible-image-description",
    ],
    warnings: [
      "Reasoning mode may require additional processing time - provide appropriate feedback",
      "Vision capabilities require accessible image descriptions for screen readers",
      "Thinking paradigm may generate verbose reasoning chains - consider summarisation for accessibility",
    ],
    ariaLabels: {
      modelSelect:
        "GLM 4.1V 9B Thinking - Vision-language model with reasoning capabilities and 65K context",
      parameterSection:
        "Parameter controls for GLM 4.1V Thinking model including reasoning options",
      statusMessages: {
        processing:
          "Processing request with GLM Thinking model - reasoning in progress",
        complete: "Response ready from GLM Thinking model",
        reasoning:
          "Model is engaged in thinking process - this may take longer",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("moonshotai/kimi-k2", {
  provider: "moonshotai",
  name: "Kimi K2",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Kimi K2 is a large-scale Mixture-of-Experts (MoE) language model with 1 trillion total parameters and 32 billion active per forward pass. Optimised for agentic capabilities including advanced tool use, reasoning, and code synthesis with exceptional performance on coding and reasoning benchmarks.",
  costs: {
    input: 0.57, // $0.57/M tokens
    output: 2.3, // $2.30/M tokens
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "tool_calling",
    "agentic_workflows",
    "long_context",
    "advanced_synthesis",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar agentic and reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced MoE model optimised for agentic workflows and code synthesis",
    releaseDate: "2025-07-11",
    modelArchitecture: {
      parameters: "1T",
      activeParameters: "32B",
      type: "mixture-of-experts",
      generation: "K2",
      optimizer: "MuonClip",
    },
    policyLinks: {
      privacyPolicy: "https://www.moonshot.cn/privacy",
      acceptableUse: "",
      termsOfService: "https://www.moonshot.cn/terms",
      lastUpdated: "2025-07-11",
    },
    benchmarkPerformance: {
      coding: ["LiveCodeBench", "SWE-bench"],
      reasoning: ["ZebraLogic", "GPQA"],
      toolUse: ["Tau2", "AceBench"],
    },
    domainExpertise: {
      coding: 9, // Rating out of 10
      reasoning: 9,
      toolUse: 9,
      agentic: 8,
      general: 7,
    },
    bestFor: [
      "agentic workflows",
      "advanced code synthesis",
      "complex reasoning tasks",
      "tool-based applications",
      "long-context processing",
      "benchmark-grade performance",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "tool_choice",
      "mixture_of_experts",
      "agentic_workflows",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "agentic-applications",
      "code-generation",
      "complex-reasoning",
      "tool-integration",
      "long-context-tasks",
    ],
    warnings: [
      "High parameter count may require additional processing time for complex agentic workflows",
      "Tool calling operations should include clear progress indicators for accessibility",
      "Long context processing may benefit from progress updates",
    ],
    ariaLabels: {
      modelSelect:
        "Kimi K2 - Advanced MoE model optimised for agentic workflows with 131K context",
      parameterSection:
        "Parameter controls for Kimi K2 model including tool calling options",
      statusMessages: {
        processing: "Processing agentic workflow with Kimi K2",
        complete: "Kimi K2 agentic response complete",
        toolCalling: "Kimi K2 executing tool operations",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("switchpoint/router", {
  provider: "switchpoint",
  name: "Switchpoint Router",
  category: "Specialized",
  disabled: false,
  description:
    "Switchpoint AI's intelligent router that automatically analyses your request and directs it to the optimal AI from an ever-evolving library of models. As the world of LLMs advances, the router gets smarter, ensuring you always benefit from the industry's newest models without changing your workflow.",
  costs: {
    input: 0.85, // $0.85/M tokens
    output: 3.4, // $3.40/M tokens
  },
  capabilities: [
    "text",
    "routing",
    "model_selection",
    "reasoning",
    "adaptive",
    "multi_model",
    "optimisation",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Fallback to a reliable general-purpose model
  isFree: false,
  metadata: {
    categoryDescription:
      "Intelligent routing system that selects optimal models for each request",
    releaseDate: "2025-07-11",
    modelArchitecture: {
      type: "routing-system",
      approach: "intelligent-selection",
      generation: "dynamic",
    },
    policyLinks: {
      privacyPolicy: "https://switchpoint.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://switchpoint.ai/terms",
      lastUpdated: "2025-07-11",
    },
    domainExpertise: {
      routing: 10, // Rating out of 10
      adaptability: 9,
      optimisation: 8,
      general: 8,
    },
    bestFor: [
      "dynamic model selection",
      "optimal performance routing",
      "adaptive AI workflows",
      "future-proof applications",
      "model agnostic solutions",
      "performance optimisation",
    ],
    accessibility: {
      multilingualSupport: true, // Depends on routed model
      languageDetection: true,
      scriptSupport: ["latin", "various"], // Depends on selected model
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "reasoning",
      "include_reasoning",
      "stop",
      "top_k",
      "seed",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "adaptive_routing",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "adaptive-workflows",
      "performance-optimisation",
      "model-agnostic-applications",
      "future-proof-solutions",
    ],
    warnings: [
      "Router may select different underlying models, ensure consistent UI feedback",
      "Response characteristics may vary based on selected model",
      "Consider providing routing transparency for accessibility users",
    ],
    ariaLabels: {
      modelSelect:
        "Switchpoint Router - Intelligent model selection with 131K context",
      parameterSection: "Parameter controls for Switchpoint Router",
      statusMessages: {
        processing: "Analysing request and selecting optimal model",
        complete: "Response ready from selected optimal model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen3-235b-a22b-07-25", {
  provider: "qwen",
  name: "Qwen3 235B A22B 2507",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Qwen3-235B-A22B-Instruct-2507 is a multilingual, instruction-tuned mixture-of-experts language model with 22B active parameters per forward pass. Optimised for general-purpose text generation, instruction following, logical reasoning, mathematics, code, and tool usage with native 262K context support.",
  costs: {
    input: 0.12, // $0.12/M tokens
    output: 0.59, // $0.59/M tokens
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "reasoning",
    "mathematics",
    "code",
    "tool_calling",
    "structured_outputs",
    "long_context",
    "instruction_following",
  ],
  maxContext: 262144,
  fallbackTo: "qwen/qwen2.5-32b-instruct", // Fallback to smaller Qwen model in same family
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multilingual MoE model with extended context and reasoning capabilities",
    releaseDate: "2025-07-21",
    modelArchitecture: {
      parameters: "235B",
      activeParameters: "22B",
      type: "mixture-of-experts-instruct",
      generation: "3",
      variant: "2507",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy",
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms",
      lastUpdated: "2025-07-21",
    },
    languageSupport: [
      "english",
      "chinese",
      "french",
      "spanish",
      "portuguese",
      "german",
      "italian",
      "russian",
      "japanese",
      "korean",
      "vietnamese",
      "thai",
      "arabic",
    ],
    domainExpertise: {
      reasoning: 9, // Rating out of 10
      mathematics: 9,
      coding: 8,
      general: 8,
      multilingual: 9,
      long_context: 9,
    },
    bestFor: [
      "complex reasoning tasks",
      "mathematical problem solving",
      "multilingual applications",
      "long-context processing",
      "coding and development",
      "tool usage and structured outputs",
      "instruction following",
      "knowledge-intensive tasks",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "chinese",
        "cyrillic",
        "japanese",
        "korean",
        "arabic",
        "thai",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "structured_outputs",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "repetition_penalty",
      "response_format",
      "min_p",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "mixture_of_experts",
      "structured_outputs",
      "tool_calling",
      "long_context",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "complex-reasoning",
      "mathematical-content",
      "code-documentation",
      "long-document-analysis",
      "structured-data-processing",
    ],
    warnings: [
      "Large context window may require progress indicators for long documents",
      "Complex reasoning tasks may benefit from step-by-step progress feedback",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 235B A22B - Advanced multilingual model with 262K context",
      parameterSection: "Parameter controls for Qwen3 model",
      statusMessages: {
        processing: "Processing request with Qwen3 model",
        complete: "Response ready from Qwen3 model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("google/gemini-2.5-flash-lite", {
  provider: "google",
  name: "Gemini 2.5 Flash Lite",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Gemini 2.5 Flash-Lite is a lightweight reasoning model optimised for ultra-low latency and cost efficiency. Offers improved throughput and faster token generation with optional multi-pass reasoning capabilities via the Reasoning API parameter.",
  costs: {
    input: 0.1, // $0.10/M tokens
    output: 0.4, // $0.40/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "structured_outputs",
    "low_latency",
    "cost_efficient",
    "high_throughput",
  ],
  maxContext: 1048576,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar performance characteristics
  isFree: false,
  metadata: {
    categoryDescription:
      "Ultra-fast lightweight reasoning model with optional advanced thinking",
    releaseDate: "2025-07-22",
    modelArchitecture: {
      type: "lightweight-reasoning",
      generation: "2.5",
      optimisation: "flash-lite",
    },
    policyLinks: {
      privacyPolicy: "https://policies.google.com/privacy",
      acceptableUse:
        "https://policies.google.com/terms/generative-ai/use-policy",
      termsOfService: "https://policies.google.com/terms",
      lastUpdated: "2025-07-22",
    },
    languageSupport: [
      "english",
      "multilingual", // Google models typically support many languages
    ],
    domainExpertise: {
      reasoning: 7, // Rating out of 10
      general: 8,
      speed: 10,
      efficiency: 10,
    },
    bestFor: [
      "ultra-low latency applications",
      "cost-efficient processing",
      "high-throughput scenarios",
      "optional advanced reasoning",
      "structured output generation",
      "tool-assisted workflows",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "multilingual"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "seed",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "tool_calling",
      "ultra_low_latency",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "real-time-applications",
      "cost-sensitive-projects",
      "high-volume-processing",
      "tool-assisted-workflows",
    ],
    warnings: [
      "Reasoning mode disabled by default for speed - enable via include_reasoning parameter",
      "Consider latency requirements when enabling advanced reasoning features",
    ],
    ariaLabels: {
      modelSelect:
        "Gemini 2.5 Flash Lite - Ultra-fast lightweight model with 1M context",
      parameterSection: "Parameter controls for Gemini 2.5 Flash Lite model",
      statusMessages: {
        processing: "Processing request with Gemini Flash Lite model",
        complete: "Response ready from Gemini Flash Lite model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen3-coder", {
  provider: "qwen",
  name: "Qwen3 Coder",
  category: "Code",
  disabled: false,
  description:
    "Qwen3-Coder-480B-A35B-Instruct is a Mixture-of-Experts (MoE) code generation model optimised for agentic coding tasks including function calling, tool use, and long-context reasoning over repositories. Features 480 billion total parameters with 35 billion active per forward pass.",
  costs: {
    input: 1.0, // $1.0/M tokens
    output: 5.0, // $5.0/M tokens
  },
  capabilities: [
    "text",
    "code",
    "tool_calling",
    "function_calling",
    "agentic_workflows",
    "repository_reasoning",
    "structured_outputs",
    "long_context",
  ],
  maxContext: 1000000,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar capabilities for code and reasoning
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced MoE code generation model with agentic capabilities and million-token context",
    releaseDate: "2025-07-23",
    modelArchitecture: {
      parameters: "480B",
      activeParameters: "35B",
      type: "mixture-of-experts",
      generation: "3",
      experts: "160 total, 8 active",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-07-23",
    },
    languageSupport: ["english", "chinese"],
    domainExpertise: {
      coding: 10, // Rating out of 10
      tool_calling: 9,
      repository_analysis: 9,
      agentic_workflows: 9,
      general: 6,
    },
    bestFor: [
      "agentic coding tasks",
      "function calling and tool use",
      "repository-wide reasoning",
      "long-context code analysis",
      "structured code generation",
      "complex coding workflows",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "seed",
      "presence_penalty",
      "stop",
      "frequency_penalty",
      "logprobs",
      "top_logprobs",
      "logit_bias",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "logprobs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "code-generation",
      "agentic-workflows",
      "repository-analysis",
      "function-calling",
      "structured-outputs",
    ],
    warnings: [
      "Extremely large context window may require extended processing time",
      "Tool calling features may need additional UI feedback for accessibility users",
      "Consider providing progress indicators for repository-wide analysis tasks",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 Coder - Advanced MoE coding model with 1M context and tool calling",
      parameterSection: "Parameter controls for Qwen3 Coder model",
      statusMessages: {
        processing:
          "Processing coding request with Qwen3 Coder, this may take time for complex tasks",
        complete: "Qwen3 Coder response complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("z-ai/glm-4-32b", {
  provider: "z-ai",
  name: "GLM 4 32B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "GLM 4 32B is a cost-effective foundation language model with significantly enhanced capabilities in tool use, online search, and code-related intelligent tasks. Developed by the same lab behind the THUDM models, it excels at complex reasoning and provides exceptional value for comprehensive AI applications.",
  costs: {
    input: 0.1, // $0.10/M tokens
    output: 0.1, // $0.10/M tokens
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "tool_calling",
    "search",
    "problem_solving",
    "multilingual",
    "cost_effective",
  ],
  maxContext: 128000,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar reasoning capabilities and multilingual support
  isFree: false,
  metadata: {
    categoryDescription:
      "Cost-effective foundation model with enhanced reasoning and tool capabilities",
    releaseDate: "2025-07-24",
    modelArchitecture: {
      parameters: "32B",
      type: "foundation-enhanced",
      generation: "4",
    },
    policyLinks: {
      privacyPolicy: "https://z.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://z.ai/terms",
      lastUpdated: "2025-07-24",
    },
    languageSupport: ["english", "chinese"],
    domainExpertise: {
      reasoning: 8, // Rating out of 10
      coding: 9,
      toolUse: 9,
      general: 8,
      costEfficiency: 10,
    },
    bestFor: [
      "cost-effective AI applications",
      "complex coding tasks",
      "tool integration and automation",
      "online search and research",
      "mathematical reasoning",
      "bilingual English-Chinese content",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.6,
        p90: 1.0,
      },
      top_p: {
        p10: 0.8,
        p50: 0.95,
        p90: 1.0,
      },
    },
    features: [
      "tool_calling",
      "search_integration",
      "cost_effective",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "cost-conscious-development",
      "tool-integration",
      "coding-assistance",
      "research-tasks",
    ],
    warnings: [
      "Ensure appropriate tool permissions when using tool calling features",
      "Consider rate limiting for cost-effective usage patterns",
    ],
    ariaLabels: {
      modelSelect:
        "GLM 4 32B - Cost-effective model with enhanced tool capabilities and 128K context",
      parameterSection: "Parameter controls for GLM 4 32B model",
      statusMessages: {
        processing: "Processing request with GLM 4 32B model",
        complete: "Response ready from GLM 4 32B model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen3-235b-a22b-thinking-2507", {
  provider: "qwen",
  name: "Qwen3 235B A22B Thinking 2507",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "High-performance open-weight Mixture-of-Experts (MoE) language model optimised for complex reasoning tasks. Activates 22B of its 235B parameters per forward pass with native support for up to 262,144 tokens. This thinking-only variant excels at structured logical reasoning, mathematics, science, and long-form generation.",
  costs: {
    input: 0.13, // $0.13/M tokens
    output: 0.6, // $0.60/M tokens
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "reasoning",
    "thinking_mode",
    "tool_calling",
    "mathematics",
    "science",
    "code",
    "long_context",
    "agentic_workflows",
    "structured_reasoning",
  ],
  maxContext: 262144,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning MoE model with thinking mode and extended context",
    releaseDate: "2025-07-25",
    modelArchitecture: {
      parameters: "235B",
      activeParameters: "22B",
      type: "mixture-of-experts-thinking",
      generation: "3",
      license: "Apache 2.0",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy",
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms",
      lastUpdated: "2025-07-25",
    },
    languageSupport: ["english", "chinese", "multilingual"],
    domainExpertise: {
      reasoning: 9, // Rating out of 10
      mathematics: 9,
      science: 9,
      coding: 8,
      general: 8,
      thinking: 10,
    },
    benchmarkPerformance: {
      aime: "high",
      superGPQA: "high",
      liveCodeBench: "high",
      mmluRedux: "high",
    },
    bestFor: [
      "complex reasoning tasks",
      "mathematical problems",
      "scientific analysis",
      "step-by-step thinking",
      "long-form generation",
      "agentic workflows",
      "structured logical reasoning",
      "high-token outputs",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
      thinkingModeSupport: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "response_format",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "thinking_mode",
      "include_reasoning",
      "tool_calling",
      "response_format",
      "logprobs",
      "mixture_of_experts",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "mathematical-content",
      "scientific-analysis",
      "step-by-step-thinking",
      "multilingual-reasoning",
      "long-form-content",
    ],
    warnings: [
      "Thinking mode may produce extended reasoning chains - provide appropriate UI feedback",
      "High token output capability may require progress indicators",
      "Consider timeout handling for complex reasoning tasks",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 235B A22B Thinking 2507 - Advanced reasoning model with 262K context and thinking mode",
      parameterSection:
        "Parameter controls for Qwen3 Thinking model including reasoning options",
      statusMessages: {
        processing:
          "Processing with Qwen3 Thinking model - complex reasoning may take additional time",
        complete: "Qwen3 Thinking model response complete",
        thinkingMode:
          "Model is in thinking mode - step-by-step reasoning in progress",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("z-ai/glm-4.5-air", {
  provider: "z-ai",
  name: "GLM 4.5 Air",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "GLM-4.5-Air is the lightweight variant of the flagship GLM model family, purpose-built for agent-centric applications. Features compact MoE architecture with hybrid inference modes including thinking mode for advanced reasoning and non-thinking mode for real-time interaction.",
  costs: {
    input: 0.2, // $0.20/M tokens
    output: 1.1, // $1.10/M tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "tool_calling",
    "agent_workflows",
    "hybrid_inference",
    "real_time_interaction",
  ],
  maxContext: 128000,
  fallbackTo: "anthropic/claude-3.5-haiku", // Similar lightweight, fast model
  isFree: false,
  metadata: {
    categoryDescription:
      "Lightweight MoE model optimised for agent applications with hybrid reasoning modes",
    releaseDate: "2025-07-25",
    modelArchitecture: {
      parameters: "compact",
      type: "mixture-of-experts",
      generation: "4.5",
      variant: "air",
    },
    policyLinks: {
      privacyPolicy: "https://www.zhipuai.cn/privacy",
      acceptableUse: "",
      termsOfService: "https://www.zhipuai.cn/terms",
      lastUpdated: "2025-07-25",
    },
    domainExpertise: {
      reasoning: 7, // Rating out of 10
      agents: 9,
      real_time: 8,
      general: 7,
      tools: 8,
    },
    bestFor: [
      "agent-centric applications",
      "real-time interactions",
      "tool calling workflows",
      "hybrid reasoning tasks",
      "lightweight deployments",
      "interactive agents",
    ],
    accessibility: {
      agentSupport: true,
      realTimeOptimised: true,
      hybridModes: ["thinking", "non-thinking"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tool_calling",
      "reasoning_control",
      "hybrid_inference",
      "agent_workflows",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "agent-applications",
      "real-time-chat",
      "tool-integration",
      "reasoning-workflows",
    ],
    warnings: [
      "Thinking mode may require progress indicators for accessibility users",
      "Consider mode switching notifications for screen reader users",
    ],
    ariaLabels: {
      modelSelect:
        "GLM 4.5 Air - Lightweight agent model with hybrid reasoning modes",
      parameterSection: "Parameter controls for GLM 4.5 Air model",
      reasoningControls: "Reasoning mode controls - thinking or non-thinking",
      statusMessages: {
        processing: "Processing with GLM 4.5 Air",
        thinkingMode:
          "GLM 4.5 Air processing in thinking mode - this may take longer",
        nonThinkingMode: "GLM 4.5 Air processing in real-time mode",
        complete: "Response ready from GLM 4.5 Air",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add these model registrations to model-definitions.js
// Insert these before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("baidu/ernie-4.5-300b-a47b", {
  provider: "baidu",
  name: "ERNIE 4.5 300B A47B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "ERNIE-4.5-300B-A47B is a 300B parameter Mixture-of-Experts (MoE) language model with 47B active parameters per token. Optimised for high-throughput inference with advanced reasoning capabilities and support for both English and Chinese text generation.",
  costs: {
    input: 0.28, // $0.28/M tokens
    output: 1.1, // $1.10/M tokens
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "reasoning",
    "tool_calling",
    "high_throughput",
    "extended_context",
  ],
  maxContext: 123000,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar performance and multilingual capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance MoE model with advanced reasoning and bilingual capabilities",
    releaseDate: "2025-06-30",
    modelArchitecture: {
      parameters: "300B",
      activeParameters: "47B",
      type: "mixture-of-experts",
      generation: "4.5",
    },
    policyLinks: {
      privacyPolicy: "https://www.baidu.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.baidu.com/terms",
      lastUpdated: "2025-06-30",
    },
    languageSupport: ["english", "chinese"],
    domainExpertise: {
      reasoning: 8, // Rating out of 10
      general: 7,
      multilingual: 8,
      throughput: 9,
    },
    bestFor: [
      "high-throughput applications",
      "advanced reasoning tasks",
      "bilingual English-Chinese content",
      "tool parameter handling",
      "extended context processing",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: ["mixture_of_experts", "high_throughput", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "multilingual-content",
      "high-volume-processing",
      "reasoning-tasks",
      "chinese-english-translation",
    ],
    warnings: [
      "High parameter count may require additional processing time notifications",
      "Ensure appropriate context length handling for extended inputs",
    ],
    ariaLabels: {
      modelSelect:
        "ERNIE 4.5 300B A47B - High-performance MoE model with 123K context",
      parameterSection: "Parameter controls for ERNIE 4.5 model",
      statusMessages: {
        processing: "Processing request with ERNIE model",
        complete: "Response ready from ERNIE model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

modelRegistry.registerModel("z-ai/glm-4.5", {
  provider: "z-ai",
  name: "GLM 4.5",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "GLM-4.5 is a flagship foundation model purpose-built for agent-based applications. Features Mixture-of-Experts (MoE) architecture with hybrid inference modes including 'thinking mode' for complex reasoning and 'non-thinking mode' for instant responses.",
  costs: {
    input: 0.6, // $0.60/M tokens
    output: 2.2, // $2.20/M tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "tool_calling",
    "agent_workflows",
    "code",
    "hybrid_inference",
    "thinking_mode",
  ],
  maxContext: 128000,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar agent and reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Agent-focused model with hybrid reasoning modes and tool integration",
    releaseDate: "2025-07-25",
    modelArchitecture: {
      parameters: "Unknown", // Not specified in description
      type: "mixture-of-experts",
      generation: "4.5",
    },
    policyLinks: {
      privacyPolicy: "https://www.zhipuai.cn/privacy",
      acceptableUse: "",
      termsOfService: "https://www.zhipuai.cn/terms",
      lastUpdated: "2025-07-25",
    },
    languageSupport: ["english", "chinese"],
    domainExpertise: {
      reasoning: 9, // Rating out of 10
      agents: 9,
      code: 8,
      tools: 9,
      general: 7,
    },
    bestFor: [
      "agent-based applications",
      "complex reasoning tasks",
      "tool integration workflows",
      "code generation",
      "hybrid inference scenarios",
      "thinking-mode analysis",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "tool_calling",
      "thinking_mode",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "agent-workflows",
      "complex-reasoning",
      "tool-integration",
      "code-generation",
      "thinking-analysis",
    ],
    warnings: [
      "Thinking mode may require extended processing time - provide appropriate feedback",
      "Tool integration requires clear status indicators for accessibility users",
    ],
    ariaLabels: {
      modelSelect:
        "GLM 4.5 - Agent-focused model with thinking mode and 128K context",
      parameterSection:
        "Parameter controls for GLM 4.5 model including reasoning options",
      statusMessages: {
        processing:
          "Processing with GLM 4.5, thinking mode may take additional time",
        complete: "GLM 4.5 response complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen3-30b-a3b-instruct-2507", {
  provider: "qwen",
  name: "Qwen3 30B A3B Instruct 2507",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Qwen3-30B-A3B-Instruct-2507 is a 30.5B-parameter mixture-of-experts language model with 3.3B active parameters per inference. Designed for high-quality instruction following, multilingual understanding, and agentic tool use with competitive performance across reasoning, coding, and alignment benchmarks.",
  costs: {
    input: 0.2, // $0.20/M tokens
    output: 0.8, // $0.80/M tokens
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "reasoning",
    "code",
    "tool_calling",
    "instruction_following",
    "agentic_workflows",
    "structured_outputs",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar performance and multilingual capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "High-efficiency MoE model optimised for instruction following and agentic workflows",
    releaseDate: "2025-07-29",
    modelArchitecture: {
      parameters: "30.5B",
      activeParameters: "3.3B",
      type: "mixture-of-experts-instruct",
      generation: "3",
      variant: "2507",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-07-29",
    },
    languageSupport: [
      "english",
      "chinese",
      "multilingual", // Qwen models typically support many languages
    ],
    domainExpertise: {
      reasoning: 8, // Rating out of 10 - strong on AIME, ZebraLogic
      coding: 8, // Strong on MultiPL-E, LiveCodeBench
      instruction_following: 9, // Designed for high-quality instruction following
      alignment: 8, // Good performance on IFEval, WritingBench
      general: 7,
    },
    benchmarkPerformance: {
      reasoning: ["AIME", "ZebraLogic"],
      coding: ["MultiPL-E", "LiveCodeBench"],
      alignment: ["IFEval", "WritingBench"],
    },
    bestFor: [
      "instruction following tasks",
      "agentic tool use",
      "multilingual applications",
      "reasoning and logic problems",
      "coding tasks",
      "structured output generation",
      "alignment-sensitive applications",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese", "multilingual"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "response_format",
      "presence_penalty",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "response_format",
      "mixture_of_experts",
      "instruction_tuned",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "instruction-following-tasks",
      "multilingual-content",
      "reasoning-problems",
      "code-generation",
      "agentic-workflows",
      "structured-outputs",
    ],
    warnings: [
      "MoE architecture may require brief processing time for complex reasoning tasks",
      "Ensure clear instruction formatting for optimal performance",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 30B A3B Instruct 2507 - MoE model with 131K context, optimised for instruction following",
      parameterSection: "Parameter controls for Qwen3 Instruct model",
      statusMessages: {
        processing: "Processing request with Qwen3 Instruct model",
        complete: "Response ready from Qwen3 Instruct model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("mistralai/codestral-2508", {
  provider: "mistralai",
  name: "Codestral 2508",
  category: "Code",
  disabled: false,
  description:
    "Mistral's cutting-edge language model for coding released end of July 2025. Codestral specialises in low-latency, high-frequency tasks such as fill-in-the-middle (FIM), code correction and test generation.",
  costs: {
    input: 0.3, // $0.30/M tokens
    output: 0.9, // $0.90/M tokens
  },
  capabilities: [
    "text",
    "code",
    "fill_in_middle",
    "code_correction",
    "test_generation",
    "tool_calling",
    "structured_outputs",
    "low_latency",
  ],
  maxContext: 256000,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Strong coding capabilities as fallback
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialised coding model with fill-in-the-middle and low-latency capabilities",
    releaseDate: "2025-07-31",
    modelArchitecture: {
      type: "instruction-tuned",
      generation: "2508",
      specialisation: "coding",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy-policy/",
      acceptableUse: "https://mistral.ai/terms/",
      termsOfService: "https://mistral.ai/terms/",
      lastUpdated: "2025-08-01",
    },
    domainExpertise: {
      coding: 9, // Rating out of 10
      fillInMiddle: 10,
      testGeneration: 9,
      codeCorrection: 9,
      general: 6,
    },
    bestFor: [
      "fill-in-the-middle code completion",
      "code correction and debugging",
      "automated test generation",
      "low-latency coding tasks",
      "high-frequency code operations",
      "structured code outputs",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.3,
        p90: 0.7, // Lower temps for code generation
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1,
      },
    },
    features: [
      "fill_in_middle",
      "structured_outputs",
      "tool_calling",
      "low_latency",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "code-completion",
      "automated-testing",
      "code-debugging",
      "interactive-coding",
      "code-generation",
    ],
    warnings: [
      "Optimised for coding tasks - may be less suitable for general text",
      "Fill-in-the-middle functionality requires specific prompt formatting",
    ],
    ariaLabels: {
      modelSelect:
        "Codestral 2508 - Specialised coding model with 256K context",
      parameterSection: "Parameter controls for Codestral 2508 model",
      statusMessages: {
        processing: "Processing code request with Codestral model",
        complete: "Code response ready from Codestral model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("anthropic/claude-opus-4.1", {
  provider: "anthropic",
  name: "Claude Opus 4.1",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Claude Opus 4.1 is Anthropic's flagship model with enhanced performance in coding, reasoning, and agentic tasks. Achieves 74.5% on SWE-bench Verified with notable gains in multi-file code refactoring, debugging precision, and detail-oriented reasoning. Supports extended thinking up to 64K tokens.",
  costs: {
    input: 15.0, // $15.0/M tokens
    output: 75.0, // $75.0/M tokens
    image: 24.0, // $24.0/K input images
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "tool_calling",
    "multilingual",
    "problem_solving",
    "agentic_workflows",
    "extended_thinking",
    "image",
    "debugging",
    "refactoring",
    "research",
    "data_analysis",
  ],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Fallback to other advanced Claude model
  isFree: false,
  metadata: {
    categoryDescription:
      "Flagship model with superior coding, reasoning, and agentic capabilities",
    releaseDate: "2025-08-05",
    modelArchitecture: {
      parameters: "Unknown", // Not specified in provided data
      type: "instruction-tuned",
      generation: "4.1",
    },
    policyLinks: {
      privacyPolicy: "https://www.anthropic.com/legal/privacy",
      acceptableUse: "https://www.anthropic.com/legal/aup",
      termsOfService: "https://www.anthropic.com/legal/consumer-terms",
      lastUpdated: "2025-08-05",
    },
    benchmarkScores: {
      "SWE-bench Verified": 74.5, // Percentage score
    },
    bestFor: [
      "complex coding tasks",
      "multi-file code refactoring",
      "debugging precision",
      "agentic workflows",
      "research and analysis",
      "tool-assisted reasoning",
      "extended thinking tasks",
      "detailed problem solving",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "chinese",
        "japanese",
        "korean",
        "arabic",
        "cyrillic",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "stop",
      "reasoning",
      "include_reasoning",
      "tools",
      "tool_choice",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      temperature: {
        p10: 0,
        p50: 1,
        p90: 1.1,
      },
    },
    features: [
      "include_reasoning",
      "tool_calling",
      "extended_thinking",
      "advanced_coding",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-problem-solving",
      "advanced-code-generation",
      "multi-step-reasoning",
      "agent-workflows",
      "research-tasks",
      "debugging-assistance",
    ],
    warnings: [
      "Extended thinking mode may require additional UI feedback for accessibility users",
      "Consider providing progress indicators during extended reasoning",
      "High token costs - ensure cost awareness for accessibility users",
    ],
    ariaLabels: {
      modelSelect:
        "Claude Opus 4.1 - Flagship model with superior coding and reasoning capabilities",
      parameterSection: "Parameter controls for Claude Opus 4.1 model",
      statusMessages: {
        processing:
          "Processing with Claude Opus 4.1, this may take a moment for complex tasks",
        complete: "Claude Opus 4.1 response complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("openai/gpt-oss-20b", {
  provider: "openai",
  name: "GPT OSS 20B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "GPT OSS 20B is an open-weight 21B parameter model with Mixture-of-Experts architecture and 3.6B active parameters per forward pass. Optimised for lower-latency inference and consumer hardware deployment, featuring reasoning level configuration and agentic capabilities.",
  costs: {
    input: 0.05, // $0.05/M tokens
    output: 0.2, // $0.20/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "function_calling",
    "structured_outputs",
    "agentic_workflows",
    "fine_tuning",
    "open_source",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar reasoning capabilities and performance
  isFree: false,
  metadata: {
    categoryDescription:
      "Open-source MoE model optimised for efficient reasoning and tool use",
    releaseDate: "2025-08-05",
    modelArchitecture: {
      parameters: "21B",
      activeParameters: "3.6B",
      type: "mixture-of-experts",
      license: "Apache 2.0",
      openSource: true,
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/policies/privacy-policy",
      acceptableUse: "https://openai.com/policies/usage-policies",
      termsOfService: "https://openai.com/policies/terms-of-use",
      lastUpdated: "2025-08-05",
    },
    languageSupport: ["english"],
    domainExpertise: {
      reasoning: 7, // Rating out of 10
      general: 6,
      toolUse: 8,
      agentic: 7,
      efficiency: 9,
    },
    bestFor: [
      "agentic workflows",
      "tool calling applications",
      "reasoning tasks",
      "structured output generation",
      "fine-tuning projects",
      "resource-constrained deployments",
      "open-source applications",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: true,
      scriptSupport: ["latin"],
      openSourceBenefits: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "response_format",
      "structured_outputs",
      "seed",
      "min_p",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "logprobs",
      "open_source",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "agentic-applications",
      "tool-integration",
      "reasoning-workflows",
      "open-source-projects",
      "resource-efficient-deployment",
    ],
    warnings: [
      "Reasoning mode may require additional processing time indicators",
      "Consider providing clear feedback during tool calling operations",
      "Open-source nature allows for custom modifications and deployments",
    ],
    ariaLabels: {
      modelSelect:
        "GPT OSS 20B - Open-source MoE model with reasoning and tool calling",
      parameterSection: "Parameter controls for GPT OSS 20B model",
      statusMessages: {
        processing: "Processing request with GPT OSS 20B model",
        complete: "Response ready from GPT OSS 20B model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("openai/gpt-oss-120b", {
  provider: "openai",
  name: "GPT OSS 120B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "GPT OSS 120B is an open-weight, 117B-parameter Mixture-of-Experts (MoE) language model optimised for high-reasoning, agentic, and general-purpose production use cases. It activates 5.1B parameters per forward pass and supports configurable reasoning depth with full chain-of-thought access.",
  costs: {
    input: 0.1, // $0.10/M tokens
    output: 0.5, // $0.50/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "function_calling",
    "structured_outputs",
    "chain_of_thought",
    "agentic_workflows",
    "browsing",
    "high_efficiency",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar reasoning capabilities and performance
  isFree: false,
  metadata: {
    categoryDescription:
      "Open-weight MoE model with advanced reasoning and tool use capabilities",
    releaseDate: "2025-08-05",
    modelArchitecture: {
      parameters: "117B",
      activeParameters: "5.1B",
      type: "mixture-of-experts",
      openWeight: true,
      quantization: "MXFP4",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy",
      acceptableUse: "https://openai.com/usage-policies",
      termsOfService: "https://openai.com/terms",
      lastUpdated: "2025-08-05",
    },
    languageSupport: ["english", "multilingual"],
    domainExpertise: {
      reasoning: 9, // Rating out of 10
      general: 8,
      toolUse: 9,
      efficiency: 10,
      agentic: 9,
    },
    bestFor: [
      "agentic workflows",
      "high-reasoning tasks",
      "tool and function calling",
      "structured output generation",
      "chain-of-thought reasoning",
      "production applications",
      "resource-efficient deployment",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "multilingual"],
      openWeight: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "tools",
      "tool_choice",
      "logprobs",
      "top_logprobs",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "tool_calling",
      "structured_outputs",
      "chain_of_thought",
      "open_weight",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "agentic-workflows",
      "reasoning-tasks",
      "tool-calling",
      "structured-outputs",
      "chain-of-thought-reasoning",
    ],
    warnings: [
      "Reasoning mode may require extended processing time - provide appropriate progress feedback",
      "Tool calling requires careful accessibility labelling for screen readers",
      "Consider timeout handling for complex reasoning tasks",
    ],
    ariaLabels: {
      modelSelect:
        "GPT OSS 120B - Open-weight MoE model with advanced reasoning and 131K context",
      parameterSection: "Parameter controls for GPT OSS 120B model",
      statusMessages: {
        processing: "Processing with GPT OSS 120B reasoning model",
        reasoningActive: "GPT OSS 120B performing extended reasoning",
        complete: "Response ready from GPT OSS 120B model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("openai/gpt-oss-20b:free", {
  provider: "openai",
  name: "GPT-OSS-20B (Free)",
  category: "FreeTier",
  disabled: false,
  description:
    "Open-weight 21B parameter MoE model with 3.6B active parameters, released under Apache 2.0 licence. Optimised for lower-latency inference and consumer hardware deployment with reasoning capabilities and function calling support.",
  costs: {
    input: 0, // Free tier
    output: 0, // Free tier
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "structured_outputs",
    "function_calling",
    "agentic_workflows",
    "open_source",
    "low_latency",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-haiku", // Similar context size and capabilities but also free-friendly
  isFree: true,
  metadata: {
    categoryDescription:
      "Open-source MoE model with reasoning and tool calling capabilities",
    releaseDate: "2025-08-05",
    modelArchitecture: {
      parameters: "21B",
      activeParameters: "3.6B",
      type: "mixture-of-experts",
      licence: "Apache 2.0",
      openSource: true,
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy",
      acceptableUse: "https://openai.com/usage-policies",
      termsOfService: "https://openai.com/terms",
      lastUpdated: "2025-08-05",
    },
    languageSupport: [
      "english", // Primary language, add others if confirmed
    ],
    domainExpertise: {
      reasoning: 7, // Rating out of 10
      general: 6,
      tools: 8,
      agentic: 7,
    },
    bestFor: [
      "free-tier applications",
      "open-source deployments",
      "reasoning tasks",
      "function calling",
      "structured outputs",
      "consumer hardware deployment",
      "low-latency applications",
    ],
    accessibility: {
      multilingualSupport: false, // Update if more languages confirmed
      languageDetection: false,
      scriptSupport: ["latin"],
      openSource: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "open_source",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "free-tier-usage",
      "reasoning-tasks",
      "structured-outputs",
      "open-source-projects",
      "function-calling",
    ],
    warnings: [
      "Free tier model - usage may be subject to rate limits",
      "Open-source deployment requires technical setup",
      "Reasoning mode may require additional processing time indicators",
    ],
    ariaLabels: {
      modelSelect:
        "GPT-OSS-20B Free - Open-source MoE model with reasoning capabilities",
      parameterSection: "Parameter controls for GPT-OSS-20B model",
      statusMessages: {
        processing: "Processing request with GPT-OSS-20B model",
        complete: "Response ready from GPT-OSS-20B model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("openai/gpt-5-nano", {
  provider: "openai",
  name: "GPT-5 Nano",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "GPT-5-Nano is the smallest and fastest variant in the GPT-5 system, optimised for developer tools, rapid interactions, and ultra-low latency environments. Successor to GPT-4.1-nano with retained instruction-following and safety features.",
  costs: {
    input: 0.05, // $0.05/M tokens
    output: 0.4, // $0.40/M tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "tool_calling",
    "structured_outputs",
    "low_latency",
    "developer_tools",
    "instruction_following",
  ],
  maxContext: 400000,
  fallbackTo: "anthropic/claude-3.5-haiku", // Similar fast, cost-effective model
  isFree: false,
  metadata: {
    categoryDescription:
      "Ultra-fast lightweight model optimised for real-time applications",
    releaseDate: "2025-08-07",
    modelArchitecture: {
      parameters: "nano",
      type: "instruction-tuned",
      generation: "5",
      variant: "nano",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy",
      acceptableUse: "https://openai.com/usage-policies",
      termsOfService: "https://openai.com/terms",
      lastUpdated: "2025-08-07",
    },
    languageSupport: ["english", "multilingual"],
    domainExpertise: {
      developer_tools: 8, // Rating out of 10
      rapid_response: 9,
      cost_efficiency: 9,
      reasoning: 5, // Limited compared to larger variants
      general: 6,
    },
    bestFor: [
      "developer tools and IDE integration",
      "rapid prototyping",
      "real-time applications",
      "cost-sensitive applications",
      "simple instruction following",
      "structured data generation",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "cyrillic", "chinese", "arabic"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      // Conservative estimates for nano model
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tool_calling",
      "structured_outputs",
      "low_latency",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "developer-tooling",
      "real-time-chat",
      "cost-sensitive-applications",
      "rapid-prototyping",
    ],
    warnings: [
      "Limited reasoning depth compared to larger GPT-5 variants",
      "Consider user feedback for complex reasoning tasks",
    ],
    ariaLabels: {
      modelSelect:
        "GPT-5 Nano - Ultra-fast lightweight model with 400K context",
      parameterSection: "Parameter controls for GPT-5 Nano model",
      statusMessages: {
        processing: "Processing request with GPT-5 Nano (ultra-fast)",
        complete: "Response ready from GPT-5 Nano",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("openai/gpt-5-mini", {
  provider: "openai",
  name: "GPT-5 Mini",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "GPT-5 Mini is a compact version of GPT-5, designed to handle lighter-weight reasoning tasks with reduced latency and cost. It provides the same instruction-following and safety-tuning benefits as GPT-5, serving as the successor to OpenAI's o4-mini model.",
  costs: {
    input: 0.25, // $0.25/M tokens
    output: 2.0, // $2.0/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "dialogue",
    "instruction_following",
    "safety_tuned",
    "structured_outputs",
    "low_latency",
  ],
  maxContext: 400000,
  fallbackTo: "anthropic/claude-3.5-haiku", // Similar lightweight, cost-effective model
  isFree: false,
  metadata: {
    categoryDescription:
      "Lightweight reasoning model with reduced latency and cost",
    releaseDate: "2025-08-07",
    modelArchitecture: {
      parameters: "Mini",
      type: "instruction-tuned",
      generation: "5",
      variant: "compact",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy",
      acceptableUse: "https://openai.com/usage-policies",
      termsOfService: "https://openai.com/terms",
      lastUpdated: "2025-08-07",
    },
    languageSupport: [
      "english",
      "multilingual", // GPT models typically support multiple languages
    ],
    domainExpertise: {
      reasoning: 7, // Rating out of 10
      general: 8,
      instruction_following: 9,
      cost_efficiency: 9,
      latency: 9,
    },
    bestFor: [
      "lightweight reasoning tasks",
      "cost-sensitive applications",
      "low-latency requirements",
      "instruction following",
      "tool calling workflows",
      "structured data generation",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "cyrillic", "chinese", "arabic", "devanagari"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      // Conservative defaults for new model
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1.0,
        p90: 1.0,
      },
    },
    features: [
      "tool_calling",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "cost-sensitive-applications",
      "low-latency-requirements",
      "tool-calling-workflows",
      "structured-data-tasks",
    ],
    warnings: [
      "Reduced model size may impact performance on highly complex reasoning tasks",
      "Consider GPT-5 for more demanding applications",
    ],
    ariaLabels: {
      modelSelect: "GPT-5 Mini - Lightweight reasoning model with 400K context",
      parameterSection: "Parameter controls for GPT-5 Mini model",
      statusMessages: {
        processing: "Processing request with GPT-5 Mini",
        complete: "Response ready from GPT-5 Mini",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("openai/gpt-5-chat", {
  provider: "openai",
  name: "GPT-5 Chat",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "GPT-5 Chat is designed for advanced, natural, multimodal, and context-aware conversations for enterprise applications. Features enhanced reasoning capabilities and extended context understanding.",
  costs: {
    input: 1.25, // $1.25/M tokens
    output: 10.0, // $10.0/M tokens
  },
  capabilities: [
    "text",
    "multimodal",
    "dialogue",
    "reasoning",
    "enterprise",
    "context_aware",
    "structured_outputs",
    "advanced_conversation",
  ],
  maxContext: 400000,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar advanced reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Next-generation conversational AI for enterprise applications",
    releaseDate: "2025-08-07",
    modelArchitecture: {
      parameters: "undisclosed",
      type: "transformer",
      generation: "5",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy",
      acceptableUse: "https://openai.com/policies/usage-policies",
      termsOfService: "https://openai.com/policies/terms-of-use",
      lastUpdated: "2025-08-07",
    },
    languageSupport: [
      "english",
      "spanish",
      "french",
      "german",
      "italian",
      "portuguese",
      "dutch",
      "russian",
      "japanese",
      "chinese",
      "korean",
      "arabic",
    ],
    domainExpertise: {
      conversation: 10, // Rating out of 10
      reasoning: 9,
      enterprise: 9,
      multimodal: 8,
      general: 9,
    },
    bestFor: [
      "enterprise applications",
      "advanced conversations",
      "multimodal interactions",
      "context-aware responses",
      "structured data generation",
      "complex reasoning tasks",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "cyrillic",
        "chinese",
        "japanese",
        "korean",
        "arabic",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      seed: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      max_tokens: {
        p10: 100,
        p50: 1000,
        p90: 4000,
      },
    },
    features: [
      "structured_outputs",
      "response_format",
      "multimodal",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "enterprise-applications",
      "multimodal-content",
      "advanced-reasoning",
      "structured-data-generation",
    ],
    warnings: [
      "Large context window may require extended processing time",
      "Enterprise features may need additional configuration",
      "Multimodal capabilities require appropriate input handling",
    ],
    ariaLabels: {
      modelSelect:
        "GPT-5 Chat - Advanced conversational AI with 400K context for enterprise",
      parameterSection: "Parameter controls for GPT-5 Chat model",
      statusMessages: {
        processing: "Processing request with GPT-5 Chat model",
        complete: "Response ready from GPT-5 Chat model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("ai21/jamba-large-1.7", {
  provider: "ai21",
  name: "Jamba Large 1.7",
  category: "LargeContext",
  disabled: false,
  description:
    "Jamba Large 1.7 is built on a hybrid SSM-Transformer architecture with a 256K context window, offering improved grounding, instruction-following, and efficiency. Delivers accurate, contextually grounded responses with better steerability than previous versions.",
  costs: {
    input: 2.0, // $2.0/M tokens
    output: 8.0, // $8.0/M tokens
  },
  capabilities: [
    "text",
    "tool_calling",
    "long_context",
    "grounding",
    "instruction_following",
    "contextual_faithfulness",
    "steerability",
  ],
  maxContext: 256000,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar context capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Hybrid SSM-Transformer model with exceptional long context handling",
    releaseDate: "2025-08-08",
    modelArchitecture: {
      type: "hybrid-ssm-transformer",
      generation: "1.7",
      contextWindow: "256K",
    },
    policyLinks: {
      privacyPolicy: "https://www.ai21.com/privacy-policy",
      acceptableUse: "https://www.ai21.com/terms-of-use",
      termsOfService: "https://www.ai21.com/terms-of-use",
      lastUpdated: "2025-08-08",
    },
    domainExpertise: {
      finance: 8, // Rating out of 10
      healthcare: 7,
      retail: 6,
      education: 7,
      research: 8,
      general: 7,
    },
    bestFor: [
      "investment research",
      "digital banking support",
      "M&A due diligence",
      "medical publication generation",
      "procurement and RFP processing",
      "brand-aligned content creation",
      "personalised tutoring",
      "grants applications",
      "long document analysis",
    ],
    useCases: {
      finance: [
        "investment research",
        "digital banking support chatbot",
        "M&A due diligence",
      ],
      healthcare: [
        "procurement (RFP creation & response review)",
        "medical publication and reports generation",
      ],
      retail: [
        "brand-aligned product description generation",
        "conversational AI",
      ],
      education: ["personalised chatbot tutor", "grants applications"],
    },
    accessibility: {
      longContextSupport: true,
      contextualFaithfulness: true,
      steerabilityFeatures: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 0.95,
        p90: 1.0,
      },
    },
    features: [
      "tool_calling",
      "response_format",
      "long_context",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "long-document-processing",
      "contextual-analysis",
      "domain-specific-applications",
      "tool-assisted-workflows",
    ],
    warnings: [
      "Large context windows may require extended processing time",
      "Consider providing progress indicators for long document analysis",
      "Tool calling responses may need structured presentation for accessibility",
    ],
    ariaLabels: {
      modelSelect: "Jamba Large 1.7 - Hybrid SSM-Transformer with 256K context",
      parameterSection: "Parameter controls for Jamba Large model",
      statusMessages: {
        processing:
          "Processing request with Jamba Large model, may take longer for large contexts",
        complete: "Response ready from Jamba Large model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("ai21/jamba-mini-1.7", {
  provider: "ai21",
  name: "Jamba Mini 1.7",
  category: "LargeContext",
  disabled: false,
  description:
    "Jamba Mini 1.7 is a compact and efficient member of the Jamba open model family with SSM-Transformer hybrid architecture. Features improved grounding and instruction-following capabilities whilst maintaining a 256K context window despite its compact size.",
  costs: {
    input: 0.2, // $0.20/M tokens
    output: 0.4, // $0.40/M tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "tool_calling",
    "instruction_following",
    "grounding",
    "extended_context",
    "hybrid_architecture",
  ],
  maxContext: 256000,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar instruction-following capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Compact model with hybrid architecture and extended context capabilities",
    releaseDate: "2025-08-08",
    modelArchitecture: {
      parameters: "Mini",
      type: "SSM-Transformer hybrid",
      generation: "1.7",
    },
    policyLinks: {
      privacyPolicy: "https://www.ai21.com/privacy-policy",
      acceptableUse: "https://www.ai21.com/responsible-ai",
      termsOfService: "https://www.ai21.com/terms-of-use",
      lastUpdated: "2025-08-08",
    },
    languageSupport: ["english"],
    domainExpertise: {
      grounding: 8, // Rating out of 10
      instruction_following: 8,
      general: 7,
      efficiency: 9,
    },
    bestFor: [
      "instruction-following tasks",
      "grounded responses",
      "extended context processing",
      "efficient inference",
      "tool-assisted workflows",
      "contextual dialogue",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: true,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tool_calling",
      "response_format",
      "hybrid_architecture",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "instruction-following",
      "tool-assisted-tasks",
      "extended-context-analysis",
      "efficient-processing",
    ],
    warnings: [
      "Extended context window may require appropriate memory management",
      "Hybrid architecture benefits may not be immediately apparent in simple tasks",
    ],
    ariaLabels: {
      modelSelect: "Jamba Mini 1.7 - Compact hybrid model with 256K context",
      parameterSection: "Parameter controls for Jamba Mini model",
      statusMessages: {
        processing: "Processing request with Jamba Mini model",
        complete: "Response ready from Jamba Mini model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("z-ai/glm-4.5v", {
  provider: "z-ai",
  name: "GLM 4.5V",
  category: "Vision",
  disabled: false,
  description:
    "GLM-4.5V is a vision-language foundation model for multimodal agent applications. Built on a 106B parameter MoE architecture with 12B activated parameters, it excels in video understanding, image Q&A, OCR, document parsing, web coding, grounding, and spatial reasoning with hybrid thinking modes.",
  costs: {
    input: 0.6, // $0.60/M tokens
    output: 1.8, // $1.80/M tokens
  },
  capabilities: [
    "text",
    "image",
    "video",
    "vision",
    "document_parsing",
    "ocr",
    "web_coding",
    "grounding",
    "spatial_reasoning",
    "gui_agent",
    "reasoning",
    "tool_calling",
  ],
  maxContext: 65536,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar vision and reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced vision-language model with hybrid reasoning and multimodal agent capabilities",
    releaseDate: "2025-08-11",
    modelArchitecture: {
      parameters: "106B",
      activeParameters: "12B",
      type: "mixture-of-experts",
      generation: "4.5V",
      modality: "vision-language",
    },
    policyLinks: {
      privacyPolicy: "https://z-ai.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://z-ai.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-08-11",
    },
    modalitySupport: [
      "text",
      "image",
      "video",
      "documents",
      "screenshots",
      "gui_elements",
    ],
    domainExpertise: {
      vision: 9, // Rating out of 10
      reasoning: 8,
      web_development: 8,
      document_analysis: 9,
      gui_automation: 8,
      spatial_reasoning: 9,
    },
    bestFor: [
      "web page coding from screenshots",
      "complex document interpretation",
      "video understanding and analysis",
      "GUI agent automation",
      "image recognition and reasoning",
      "grounding and object localisation",
      "OCR and document parsing",
      "educational problem solving",
    ],
    accessibility: {
      visionSupport: true,
      documentAccessibility: true,
      screenReaderCompatible: true,
      altTextGeneration: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "vision_language",
      "hybrid_reasoning",
      "tool_calling",
      "multimodal_agent",
      "thinking_mode",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "vision-tasks",
      "document-accessibility",
      "web-development",
      "educational-content",
      "gui-automation",
    ],
    warnings: [
      "Ensure alt text is provided for images when using vision capabilities",
      "Consider reasoning mode impact on response time for accessibility users",
      "Provide progress indicators during video processing",
    ],
    ariaLabels: {
      modelSelect:
        "GLM 4.5V - Vision-language model with 65K context and hybrid reasoning",
      parameterSection: "Parameter controls for GLM 4.5V vision model",
      statusMessages: {
        processing: "Processing multimodal content with GLM 4.5V",
        complete: "GLM 4.5V response ready",
        reasoning: "GLM 4.5V thinking mode active - processing may take longer",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("mistralai/mistral-medium-3.1", {
  provider: "mistralai",
  name: "Mistral Medium 3.1",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Enterprise-grade language model with frontier-level capabilities at 8� lower cost than traditional large models. Optimised for coding, STEM reasoning, and enterprise adaptation with support for hybrid deployments.",
  costs: {
    input: 0.4, // $0.40/M tokens
    output: 2.0, // $2.00/M tokens
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "tool_calling",
    "structured_outputs",
    "enterprise",
    "multimodal",
    "STEM",
  ],
  maxContext: 262144,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar enterprise capabilities and performance
  isFree: false,
  metadata: {
    categoryDescription:
      "Cost-efficient enterprise model with frontier-level capabilities",
    releaseDate: "2025-08-13",
    modelArchitecture: {
      parameters: "Medium",
      type: "instruction-tuned",
      generation: "3.1",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy",
      acceptableUse: "https://mistral.ai/terms",
      termsOfService: "https://mistral.ai/terms",
      lastUpdated: "2025-08-13",
    },
    domainExpertise: {
      coding: 8, // Rating out of 10
      STEM: 8,
      reasoning: 8,
      enterprise: 9,
      general: 7,
    },
    bestFor: [
      "enterprise applications",
      "coding and development",
      "STEM reasoning tasks",
      "structured output generation",
      "cost-sensitive deployments",
      "hybrid cloud environments",
    ],
    accessibility: {
      enterpriseFeatures: true,
      structuredOutputs: true,
      hybridDeployment: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "response_format",
      "structured_outputs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tool_calling",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "enterprise-applications",
      "code-generation",
      "STEM-content",
      "structured-data-output",
      "cost-sensitive-applications",
    ],
    warnings: [
      "Consider cost implications for high-volume applications",
      "Ensure structured output validation for enterprise workflows",
    ],
    ariaLabels: {
      modelSelect:
        "Mistral Medium 3.1 - Enterprise model with 262K context and cost efficiency",
      parameterSection: "Parameter controls for Mistral Medium 3.1 model",
      statusMessages: {
        processing: "Processing request with Mistral Medium model",
        complete: "Response ready from Mistral Medium model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("baidu/ernie-4.5-vl-28b-a3b", {
  provider: "baidu",
  name: "ERNIE 4.5 VL 28B A3B",
  category: "Vision",
  disabled: false,
  description:
    "A powerful multimodal Mixture-of-Experts chat model featuring 28B total parameters with 3B activated per token. Delivers exceptional text and vision understanding through innovative heterogeneous MoE structure with modality-isolated routing and advanced cross-modal reasoning capabilities.",
  costs: {
    input: 0.14, // $0.14/M tokens
    output: 0.56, // $0.56/M tokens
  },
  capabilities: [
    "text",
    "vision",
    "image",
    "multimodal",
    "reasoning",
    "dialogue",
    "cross_modal",
    "extended_context",
  ],
  maxContext: 30000,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar vision and reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal MoE model with vision understanding and cross-modal reasoning",
    releaseDate: "2025-08-12",
    modelArchitecture: {
      parameters: "28B",
      activeParameters: "3B",
      type: "multimodal-mixture-of-experts",
      generation: "4.5",
      modalityRouting: "isolated",
    },
    policyLinks: {
      privacyPolicy: "https://www.baidu.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.baidu.com/terms",
      lastUpdated: "2025-08-12",
    },
    languageSupport: ["english", "chinese"],
    domainExpertise: {
      vision: 9, // Rating out of 10
      reasoning: 8,
      multimodal: 9,
      general: 7,
    },
    bestFor: [
      "image analysis and understanding",
      "cross-modal reasoning tasks",
      "vision-language applications",
      "multimodal content generation",
      "visual question answering",
      "image-text alignment tasks",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
      visionSupport: true,
      imageDescriptionCapable: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "multimodal",
      "vision",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "vision-tasks",
      "multimodal-content",
      "image-analysis",
      "cross-modal-reasoning",
      "visual-accessibility-descriptions",
    ],
    warnings: [
      "Ensure image descriptions are provided for accessibility when processing visual content",
      "Consider providing text alternatives for vision-based outputs",
      "Reasoning mode may require additional processing time notifications",
    ],
    ariaLabels: {
      modelSelect:
        "ERNIE 4.5 VL 28B A3B - Multimodal vision model with 30K context",
      parameterSection: "Parameter controls for ERNIE 4.5 VL model",
      statusMessages: {
        processing: "Processing multimodal request with ERNIE VL model",
        complete: "Multimodal response ready from ERNIE VL model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("baidu/ernie-4.5-21b-a3b", {
  provider: "baidu",
  name: "ERNIE 4.5 21B A3B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A sophisticated Mixture-of-Experts (MoE) model with 21B total parameters and 3B activated per token. Features exceptional multimodal understanding through heterogeneous MoE structures with modality-isolated routing and advanced post-training optimisation techniques.",
  costs: {
    input: 0.07, // $0.07/M tokens
    output: 0.28, // $0.28/M tokens
  },
  capabilities: [
    "text",
    "multimodal_understanding",
    "dialogue",
    "reasoning",
    "efficient_inference",
    "extended_context",
    "parallel_collaboration",
  ],
  maxContext: 120000,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar context length and capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient MoE model with multimodal understanding and advanced routing",
    releaseDate: "2025-08-12",
    modelArchitecture: {
      parameters: "21B",
      activeParameters: "3B",
      type: "mixture-of-experts",
      generation: "4.5",
      contextLength: "131K",
    },
    policyLinks: {
      privacyPolicy: "https://www.baidu.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.baidu.com/terms",
      lastUpdated: "2025-08-12",
    },
    trainingTechniques: [
      "SFT", // Supervised Fine-Tuning
      "DPO", // Direct Preference Optimisation
      "UPO", // Unified Preference Optimisation
    ],
    domainExpertise: {
      multimodal: 8, // Rating out of 10
      efficiency: 9,
      reasoning: 7,
      general: 7,
    },
    bestFor: [
      "multimodal understanding tasks",
      "efficient high-throughput processing",
      "extended context applications",
      "resource-constrained environments",
      "parallel processing workflows",
    ],
    accessibility: {
      multimodalSupport: true,
      efficientProcessing: true,
      contextualUnderstanding: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "mixture_of_experts",
      "multimodal_routing",
      "efficient_inference",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "multimodal-content",
      "efficient-processing",
      "extended-context-tasks",
      "resource-optimisation",
    ],
    warnings: [
      "Multimodal features may require additional processing time",
      "Ensure appropriate context management for extended inputs",
    ],
    ariaLabels: {
      modelSelect:
        "ERNIE 4.5 21B A3B - Efficient MoE model with 120K context and multimodal understanding",
      parameterSection: "Parameter controls for ERNIE 4.5 21B model",
      statusMessages: {
        processing: "Processing request with efficient ERNIE model",
        complete: "Response ready from ERNIE model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("deepseek/deepseek-chat-v3.1", {
  provider: "deepseek",
  name: "DeepSeek V3.1",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "DeepSeek-V3.1 is a large hybrid reasoning model with 671B parameters and 37B active parameters. Features dual thinking and non-thinking modes, extended context support up to 128K tokens, and optimised performance for tool use, code generation, and agentic workflows.",
  costs: {
    input: 0.2, // $0.20/M tokens
    output: 0.8, // $0.80/M tokens
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "tool_calling",
    "dialogue",
    "agentic_workflows",
    "structured_outputs",
    "hybrid_reasoning",
    "extended_context",
  ],
  maxContext: 163840,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar reasoning and tool capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced hybrid reasoning model with thinking and non-thinking modes",
    releaseDate: "2025-08-21",
    modelArchitecture: {
      parameters: "671B",
      activeParameters: "37B",
      type: "hybrid-reasoning",
      generation: "3.1",
      contextExtension: "128K",
    },
    policyLinks: {
      privacyPolicy: "https://www.deepseek.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.deepseek.com/terms",
      lastUpdated: "2025-08-21",
    },
    languageSupport: ["english", "chinese"],
    domainExpertise: {
      reasoning: 9, // Rating out of 10
      coding: 9,
      toolUse: 8,
      research: 8,
      general: 8,
    },
    bestFor: [
      "agentic workflows",
      "code generation and debugging",
      "structured tool calling",
      "research tasks",
      "complex reasoning problems",
      "search agents",
      "code agents",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "logprobs",
      "top_logprobs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "tool_choice",
      "response_format",
      "logprobs",
      "hybrid_reasoning",
      "thinking_mode",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "code-generation",
      "agentic-workflows",
      "tool-calling-applications",
      "research-assistance",
    ],
    warnings: [
      "Hybrid reasoning mode may require additional processing time",
      "Consider providing progress indicators for thinking mode operations",
      "Extended context may need memory management considerations",
    ],
    ariaLabels: {
      modelSelect:
        "DeepSeek V3.1 - Hybrid reasoning model with 163K context and tool calling",
      parameterSection: "Parameter controls for DeepSeek V3.1 model",
      statusMessages: {
        processing:
          "Processing with DeepSeek V3.1, may use thinking mode for complex tasks",
        complete: "Response ready from DeepSeek V3.1",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("nousresearch/hermes-4-405b", {
  provider: "nousresearch",
  name: "Hermes 4 405B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Hermes 4 is a large-scale reasoning model built on Meta-Llama-3.1-405B with hybrid reasoning capabilities. Features internal deliberation with think traces, expanded post-training on 60B tokens emphasising reasoning, and support for structured outputs including JSON mode and function calling.",
  costs: {
    input: 0.2, // $0.20/M tokens
    output: 0.8, // $0.80/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "dialogue",
    "code",
    "mathematics",
    "science",
    "structured_outputs",
    "function_calling",
    "extended_thinking",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar Llama-based architecture
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with hybrid deliberation and structured output capabilities",
    releaseDate: "2025-01-01", // Approximate based on available info
    modelArchitecture: {
      parameters: "405B",
      type: "instruction-tuned",
      baseModel: "Meta-Llama-3.1-405B",
      generation: "4",
      postTrainingTokens: "60B",
    },
    policyLinks: {
      privacyPolicy: "https://nousresearch.com/privacy",
      acceptableUse: "",
      termsOfService: "https://nousresearch.com/terms",
      lastUpdated: "2025-01-01",
    },
    languageSupport: [
      "english",
      "multilingual", // Based on Llama heritage
    ],
    domainExpertise: {
      reasoning: 9, // Rating out of 10 - key strength
      mathematics: 8,
      code: 8,
      science: 8,
      general: 8,
    },
    bestFor: [
      "complex reasoning tasks",
      "mathematical problem solving",
      "code generation and analysis",
      "STEM applications",
      "structured data generation",
      "function calling workflows",
      "logical reasoning challenges",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "tool_calling",
      "structured_outputs",
      "function_calling",
      "logprobs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "mathematical-problem-solving",
      "code-analysis",
      "structured-output-generation",
      "tool-calling-workflows",
    ],
    warnings: [
      "Reasoning mode may require extended processing time - consider progress indicators",
      "Large model may need additional feedback for accessibility users during processing",
    ],
    ariaLabels: {
      modelSelect:
        "Hermes 4 405B - Advanced reasoning model with hybrid deliberation capabilities",
      parameterSection:
        "Parameter controls for Hermes 4 model including reasoning options",
      statusMessages: {
        processing:
          "Processing with Hermes 4 - reasoning mode may take additional time",
        complete: "Hermes 4 response complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("nousresearch/hermes-4-70b", {
  provider: "nousresearch",
  name: "Hermes 4 70B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Hermes 4 70B is a hybrid reasoning model from Nous Research, built on Meta-Llama-3.1-70B. Features hybrid mode allowing direct responses or explicit reasoning traces. Trained with expanded post-training corpus emphasising verified reasoning data for improvements in mathematics, coding, STEM, logic, and structured outputs.",
  costs: {
    input: 0.093, // $0.093/M tokens
    output: 0.373, // $0.373/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "code",
    "mathematics",
    "stem",
    "logic",
    "tool_calling",
    "function_calling",
    "structured_outputs",
    "json_mode",
    "schema_adherence",
    "hybrid_reasoning",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar architecture and capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Hybrid reasoning model with explicit thinking traces and enhanced steerability",
    releaseDate: "2025-01-01", // Estimated based on creation date format
    modelArchitecture: {
      parameters: "70B",
      baseModel: "Meta-Llama-3.1-70B",
      type: "hybrid-reasoning",
      generation: "4",
    },
    policyLinks: {
      privacyPolicy: "https://nousresearch.com/privacy",
      acceptableUse: "",
      termsOfService: "https://nousresearch.com/terms",
      lastUpdated: "2025-01-01",
    },
    domainExpertise: {
      reasoning: 9, // Rating out of 10
      mathematics: 8,
      coding: 8,
      stem: 8,
      logic: 9,
      general: 7,
    },
    bestFor: [
      "mathematical problem solving",
      "coding with reasoning traces",
      "STEM applications",
      "logical reasoning tasks",
      "structured output generation",
      "function calling workflows",
      "JSON schema adherence",
    ],
    accessibility: {
      reasoningSupport: true,
      explicitThinking: true,
      reducedRefusals: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "hybrid_reasoning",
      "include_reasoning",
      "tool_calling",
      "structured_outputs",
      "json_mode",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "reasoning-tasks",
      "mathematical-content",
      "code-generation",
      "structured-data",
      "tool-workflows",
    ],
    warnings: [
      "Reasoning mode may produce longer responses requiring scroll indicators",
      "Explicit thinking traces should be clearly labelled for screen readers",
    ],
    ariaLabels: {
      modelSelect:
        "Hermes 4 70B - Hybrid reasoning model with explicit thinking traces",
      parameterSection:
        "Parameter controls for Hermes 4 model including reasoning options",
      statusMessages: {
        processing:
          "Processing request with Hermes 4 model, reasoning traces may be included",
        complete: "Hermes 4 response complete with reasoning analysis",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("x-ai/grok-code-fast-1", {
  provider: "x-ai",
  name: "Grok Code Fast 1",
  category: "Code",
  disabled: false,
  description:
    "A speedy and economical reasoning model that excels at agentic coding with visible reasoning traces in responses. Designed for high-quality developer workflows with transparent decision-making processes.",
  costs: {
    input: 0.2, // $0.20/M tokens
    output: 1.5, // $1.50/M tokens
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "tool_calling",
    "agentic_workflows",
    "structured_outputs",
    "visible_reasoning",
    "developer_workflows",
  ],
  maxContext: 256000,
  fallbackTo: "anthropic/claude-3.5-haiku", // Economical alternative with coding capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Fast coding model with visible reasoning traces and agentic capabilities",
    releaseDate: "2025-08-26",
    modelArchitecture: {
      type: "reasoning-optimised",
      generation: "1",
      specialisation: "agentic-coding",
    },
    policyLinks: {
      privacyPolicy: "https://x.ai/privacy",
      acceptableUse: "https://x.ai/terms",
      termsOfService: "https://x.ai/terms",
      lastUpdated: "2025-08-26",
    },
    languageSupport: ["english"],
    domainExpertise: {
      coding: 9, // Rating out of 10
      reasoning: 8,
      agentic: 9,
      general: 6,
    },
    bestFor: [
      "agentic coding workflows",
      "code generation with reasoning",
      "developer tool integration",
      "transparent decision-making",
      "structured code outputs",
      "debugging with explanations",
    ],
    accessibility: {
      reasoningVisibility: true,
      codeStructure: true,
      stepByStepExplanations: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "logprobs",
      "top_logprobs",
      "stop",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      temperature: {
        p10: 0.1,
        p50: 0.3,
        p90: 0.8,
      },
      top_p: {
        p10: 0.8,
        p50: 0.9,
        p90: 1,
      },
    },
    features: [
      "tools",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "visible_reasoning_traces",
      "agentic_coding",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "coding-tasks",
      "agentic-workflows",
      "reasoning-transparency",
      "developer-tools",
    ],
    warnings: [
      "Reasoning traces may be verbose - consider scroll management for accessibility",
      "Tool integration requires clear status feedback for screen readers",
    ],
    ariaLabels: {
      modelSelect:
        "Grok Code Fast 1 - Speedy coding model with visible reasoning and 256K context",
      parameterSection: "Parameter controls for Grok Code Fast 1 model",
      statusMessages: {
        processing: "Processing coding request with Grok Code Fast 1",
        complete: "Grok Code Fast 1 response ready with reasoning traces",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen3-30b-a3b-thinking-2507", {
  provider: "qwen",
  name: "Qwen3 30B A3B Thinking 2507",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Qwen3-30B-A3B-Thinking-2507 is a 30B parameter Mixture-of-Experts reasoning model optimised for complex tasks requiring extended multi-step thinking. Designed specifically for 'thinking mode' with internal reasoning traces separated from final answers.",
  costs: {
    input: 0.071, // $0.071/M tokens
    output: 0.285, // $0.285/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "multilingual",
    "mathematics",
    "science",
    "code",
    "extended_thinking",
    "structured_reasoning",
    "agentic_workflows",
  ],
  maxContext: 262144,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with separated thinking and response modes",
    releaseDate: "2025-07-01", // Inferred from 2507 designation
    modelArchitecture: {
      parameters: "30B",
      activeParameters: "A3B", // Mixture of Experts with A3B activation
      type: "mixture-of-experts-reasoning",
      generation: "3",
      variant: "thinking",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy",
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms",
      lastUpdated: "2025-07-01",
    },
    languageSupport: [
      "english",
      "chinese",
      "multilingual", // Based on Qwen series multilingual capabilities
    ],
    domainExpertise: {
      reasoning: 9, // Rating out of 10 - primary focus
      mathematics: 8,
      science: 8,
      coding: 8,
      general: 7,
      multilingual: 7,
    },
    bestFor: [
      "complex reasoning tasks",
      "multi-step problem solving",
      "mathematical proofs",
      "scientific analysis",
      "competitive programming",
      "agentic applications",
      "structured long-context reasoning",
      "research applications",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
      reasoningSupport: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "response_format",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "reasoning_mode",
      "include_reasoning",
      "tool_calling",
      "response_format",
      "logprobs",
      "extended_thinking",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "step-by-step-problem-solving",
      "mathematical-content",
      "scientific-analysis",
      "competitive-programming",
      "research-applications",
    ],
    warnings: [
      "Reasoning mode may produce longer responses requiring scroll indicators",
      "Extended thinking processes may need progress feedback for accessibility users",
      "Consider providing summaries for complex reasoning chains",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 30B A3B Thinking - Advanced reasoning model with 262K context",
      parameterSection:
        "Parameter controls for Qwen3 Thinking model including reasoning options",
      statusMessages: {
        processing:
          "Processing with Qwen3 Thinking model, extended reasoning in progress",
        complete: "Qwen3 Thinking response complete with reasoning trace",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen3-max", {
  provider: "qwen",
  name: "Qwen3 Max",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Qwen3-Max is an updated release built on the Qwen3 series with major improvements in reasoning, instruction following, multilingual support, and long-tail knowledge coverage. Delivers higher accuracy in mathematics, coding, logic, and science tasks with reduced hallucinations and optimised for RAG and tool calling.",
  costs: {
    input: 1.2, // $1.20/M tokens
    output: 6.0, // $6.00/M tokens
  },
  capabilities: [
    "text",
    "multilingual",
    "dialogue",
    "reasoning",
    "code",
    "mathematics",
    "science",
    "tool_calling",
    "rag_optimised",
    "long_context",
    "instruction_following",
  ],
  maxContext: 256000,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar reasoning and instruction-following capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multilingual model with superior reasoning and instruction-following capabilities",
    releaseDate: "2025-09-05",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      generation: "3",
      variant: "Max",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-09-05",
    },
    languageSupport: [
      "english",
      "chinese",
      "multilingual_100plus", // Supports over 100 languages
    ],
    domainExpertise: {
      reasoning: 9, // Rating out of 10
      mathematics: 9,
      coding: 9,
      science: 9,
      instruction_following: 9,
      multilingual: 9,
      general: 8,
    },
    bestFor: [
      "complex reasoning tasks",
      "mathematical problem solving",
      "advanced coding projects",
      "scientific analysis",
      "multilingual applications",
      "instruction-following tasks",
      "RAG applications",
      "tool calling workflows",
      "long-context processing",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese", "multilingual"],
      enhancedFeatures: [
        "reduced_hallucinations",
        "improved_instruction_following",
        "better_translation_quality",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "presence_penalty",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tool_calling",
      "response_format",
      "rag_optimised",
      "multilingual_enhanced",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "multilingual-content",
      "mathematical-analysis",
      "code-generation",
      "scientific-research",
      "instruction-following",
    ],
    warnings: [
      "Large context window may require memory considerations for accessibility tools",
      "High-quality responses may take longer - consider progress indicators",
      "Tool calling features require appropriate UI feedback for screen readers",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 Max - Advanced reasoning model with 256K context and 100+ language support",
      parameterSection: "Parameter controls for Qwen3 Max model",
      statusMessages: {
        processing: "Processing complex request with Qwen3 Max",
        complete: "High-quality response ready from Qwen3 Max",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("moonshotai/kimi-k2-0905", {
  provider: "moonshotai",
  name: "Kimi K2 0905",
  category: "Code",
  disabled: false,
  description:
    "Kimi K2 0905 is a large-scale Mixture-of-Experts (MoE) language model with 1 trillion total parameters and 32 billion active per forward pass. Optimised for agentic coding, advanced tool use, and reasoning with support for long-context inference up to 256k tokens.",
  costs: {
    input: 0.296, // $0.296/M tokens
    output: 1.185, // $1.185/M tokens
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "tool_calling",
    "agentic_workflows",
    "long_context",
    "structured_outputs",
    "frontend_coding",
    "web_development",
  ],
  maxContext: 262144,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar agentic and coding capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced MoE model specialised for agentic coding and tool use",
    releaseDate: "2025-09-04",
    modelArchitecture: {
      parameters: "1T",
      activeParameters: "32B",
      type: "mixture-of-experts",
      generation: "K2",
      version: "0905",
    },
    policyLinks: {
      privacyPolicy: "https://www.moonshot.cn/privacy",
      acceptableUse: "",
      termsOfService: "https://www.moonshot.cn/terms",
      lastUpdated: "2025-09-04",
    },
    languageSupport: ["english", "chinese"],
    domainExpertise: {
      coding: 9, // Rating out of 10
      reasoning: 8,
      tool_use: 9,
      agentic_workflows: 9,
      frontend: 8,
      general: 7,
    },
    bestFor: [
      "agentic coding workflows",
      "advanced tool use",
      "frontend development",
      "web development",
      "3D programming",
      "long-context code analysis",
      "code synthesis",
      "structured output generation",
    ],
    benchmarkPerformance: {
      liveCodeBench: "high",
      sweBench: "high",
      zebraLogic: "high",
      gpqa: "high",
      tau2: "high",
      aceBench: "high",
    },
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "structured_outputs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "structured_outputs",
      "response_format",
      "logprobs",
      "mixture_of_experts",
      "agentic_workflows",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "code-generation",
      "agentic-workflows",
      "tool-integration",
      "frontend-development",
      "long-context-analysis",
    ],
    warnings: [
      "Large parameter count may require extended processing time for complex tasks",
      "Provide clear progress indicators for agentic workflow operations",
      "Consider timeout adjustments for long-context operations",
    ],
    ariaLabels: {
      modelSelect:
        "Kimi K2 0905 - Agentic coding model with 262K context and tool calling",
      parameterSection: "Parameter controls for Kimi K2 model",
      statusMessages: {
        processing: "Processing with Kimi K2 - agentic coding in progress",
        complete: "Kimi K2 agentic response complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("nvidia/nemotron-nano-9b-v2", {
  provider: "nvidia",
  name: "Nemotron Nano 9B V2",
  category: "FreeTier",
  disabled: false,
  description:
    "NVIDIA-Nemotron-Nano-9B-v2 is a unified large language model designed for both reasoning and non-reasoning tasks. It generates reasoning traces before providing final responses, with controllable reasoning capabilities via system prompts.",
  costs: {
    input: 0, // $0/M tokens
    output: 0, // $0/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "structured_outputs",
    "dialogue",
    "controllable_reasoning",
    "unified_tasks",
  ],
  maxContext: 128000,
  fallbackTo: "anthropic/claude-3.5-haiku", // Free fallback with similar reasoning capabilities
  isFree: true,
  metadata: {
    categoryDescription:
      "Free reasoning-capable model with controllable thinking process",
    releaseDate: "2025-09-05",
    modelArchitecture: {
      parameters: "9B",
      type: "unified reasoning model",
      generation: "v2",
    },
    policyLinks: {
      privacyPolicy:
        "https://www.nvidia.com/en-us/about-nvidia/privacy-policy/",
      acceptableUse: "",
      termsOfService:
        "https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf",
      lastUpdated: "2025-09-05",
    },
    languageSupport: ["english"],
    domainExpertise: {
      reasoning: 8, // Rating out of 10
      general: 6,
      structured_output: 7,
      tool_calling: 7,
    },
    bestFor: [
      "reasoning tasks with transparent thinking",
      "structured output generation",
      "tool-calling workflows",
      "educational reasoning demonstrations",
      "controllable response formats",
    ],
    accessibility: {
      multilingualSupport: false,
      languageDetection: false,
      scriptSupport: ["latin"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      // Note: Limited parameter set, so fewer statistics needed
      reasoning: {
        p10: 0,
        p50: 1,
        p90: 1,
      },
      include_reasoning: {
        p10: 0,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "reasoning_control",
      "tool_calling",
      "structured_outputs",
      "controllable_thinking",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "reasoning-demonstrations",
      "educational-content",
      "structured-output-tasks",
      "tool-calling-workflows",
    ],
    warnings: [
      "Reasoning traces may be lengthy - consider providing progress indicators",
      "Free tier model may have usage limitations",
      "Reasoning mode can be disabled via system prompt for faster responses",
    ],
    ariaLabels: {
      modelSelect:
        "Nemotron Nano 9B V2 - Free reasoning model with controllable thinking process",
      parameterSection:
        "Parameter controls for Nemotron model including reasoning options",
      statusMessages: {
        processing:
          "Processing with Nemotron model, generating reasoning trace",
        complete: "Nemotron response complete with reasoning trace",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen-plus-2025-07-28", {
  provider: "qwen",
  name: "Qwen Plus 0728",
  category: "LargeContext",
  disabled: false,
  description:
    "Qwen Plus 0728, based on the Qwen3 foundation model, is a 1 million context hybrid reasoning model with a balanced performance, speed, and cost combination. Optimised for extended context processing with advanced reasoning capabilities.",
  costs: {
    input: 0.4, // $0.40/M tokens
    output: 1.2, // $1.20/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "structured_outputs",
    "extended_context",
    "hybrid_reasoning",
    "multilingual",
  ],
  maxContext: 1000000,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar reasoning capabilities but smaller context
  isFree: false,
  metadata: {
    categoryDescription:
      "Ultra-long context model with hybrid reasoning and balanced performance",
    releaseDate: "2025-07-28",
    modelArchitecture: {
      parameters: "Qwen3",
      type: "hybrid-reasoning",
      generation: "Plus",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-07-28",
    },
    domainExpertise: {
      reasoning: 8, // Rating out of 10
      general: 7,
      extended_context: 10,
      performance: 7,
      cost_efficiency: 8,
    },
    bestFor: [
      "ultra-long document processing",
      "extended context reasoning",
      "large-scale text analysis",
      "multi-document synthesis",
      "tool-assisted workflows",
      "structured output generation",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese", "multilingual"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "presence_penalty",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "hybrid_reasoning",
      "ultra_long_context",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "extended-document-analysis",
      "multi-document-reasoning",
      "large-context-processing",
      "structured-data-extraction",
    ],
    warnings: [
      "Ultra-long context may require extended processing time",
      "Consider chunked processing for very large inputs to improve accessibility",
      "Progress indicators recommended for long context operations",
    ],
    ariaLabels: {
      modelSelect: "Qwen Plus 0728 - 1 million context hybrid reasoning model",
      parameterSection: "Parameter controls for Qwen Plus model",
      statusMessages: {
        processing:
          "Processing request with Qwen Plus model - extended context may take longer",
        complete: "Response ready from Qwen Plus model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen-plus-2025-07-28:thinking", {
  provider: "qwen",
  name: "Qwen Plus 0728 (thinking)",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Qwen Plus 0728 is a hybrid reasoning model based on the Qwen3 foundation model with 1 million context window. Offers balanced performance, speed, and cost with advanced reasoning capabilities and structured output support.",
  costs: {
    input: 0.4, // $0.40/M tokens
    output: 4.0, // $4.00/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "structured_outputs",
    "extended_thinking",
    "ultra_long_context",
    "hybrid_reasoning",
    "multilingual",
  ],
  maxContext: 1000000,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Ultra-long context reasoning model with hybrid processing capabilities",
    releaseDate: "2025-09-08",
    modelArchitecture: {
      parameters: "Unknown", // Not specified in provided information
      type: "hybrid-reasoning",
      generation: "3",
      contextWindow: "1M tokens",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-09-08",
    },
    languageSupport: [
      "english",
      "chinese",
      "multilingual", // Qwen models typically support multiple languages
    ],
    domainExpertise: {
      reasoning: 9, // Rating out of 10 - hybrid reasoning model
      general: 8,
      structured_outputs: 8,
      long_context: 10, // 1M context is exceptional
      cost_efficiency: 7,
    },
    bestFor: [
      "ultra-long context processing",
      "hybrid reasoning tasks",
      "structured output generation",
      "tool-assisted workflows",
      "complex multi-step reasoning",
      "document analysis with full context retention",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
      longContextSupport: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "presence_penalty",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "hybrid_reasoning",
      "include_reasoning",
      "structured_outputs",
      "tool_calling",
      "ultra_long_context",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "ultra-long-document-analysis",
      "complex-reasoning-tasks",
      "structured-data-generation",
      "multi-step-workflows",
      "tool-assisted-processing",
    ],
    warnings: [
      "Ultra-long context may require extended processing time - provide appropriate progress feedback",
      "Reasoning mode may require additional UI indicators for accessibility users",
      "Consider response size warnings for very long context inputs",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen Plus 0728 (thinking) - Hybrid reasoning model with 1M context",
      parameterSection: "Parameter controls for Qwen Plus thinking model",
      statusMessages: {
        processing:
          "Processing with Qwen Plus reasoning model, this may take additional time for complex reasoning",
        complete: "Qwen Plus reasoning response complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("meituan/longcat-flash-chat", {
  provider: "meituan",
  name: "LongCat Flash Chat",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "LongCat-Flash-Chat is a large-scale Mixture-of-Experts (MoE) model with 560B total parameters and 27B average active parameters. Features shortcut-connected MoE design for high throughput and optimised for conversational and agentic tasks with strong tool use capabilities.",
  costs: {
    input: 0.15, // $0.15/M tokens
    output: 0.75, // $0.75/M tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "code",
    "tool_calling",
    "agentic_workflows",
    "long_context",
    "high_throughput",
    "instruction_following",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar conversational and reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance MoE conversational model with advanced tool use capabilities",
    releaseDate: "2025-09-09",
    modelArchitecture: {
      parameters: "560B",
      activeParameters: "27B average (18.6B-31.3B range)",
      type: "mixture-of-experts",
      design: "shortcut-connected MoE",
    },
    policyLinks: {
      privacyPolicy: "https://www.meituan.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://www.meituan.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-09-09",
    },
    languageSupport: [
      "english",
      "chinese", // Meituan is Chinese company, likely supports Chinese
    ],
    domainExpertise: {
      conversation: 9, // Rating out of 10
      reasoning: 8,
      coding: 8,
      tool_use: 9,
      agentic_tasks: 9,
      instruction_following: 8,
    },
    bestFor: [
      "conversational applications",
      "agentic workflows",
      "tool use and function calling",
      "multi-step interactions",
      "instruction following",
      "coding assistance",
      "long context processing",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "tool_choice",
      "logprobs",
      "mixture_of_experts",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "conversational-interfaces",
      "agentic-applications",
      "tool-integration",
      "multi-step-workflows",
    ],
    warnings: [
      "Large parameter count may require additional processing time feedback",
      "Tool use functionality should include clear status indicators for accessibility",
    ],
    ariaLabels: {
      modelSelect:
        "LongCat Flash Chat - Conversational MoE model with 131K context and tool calling",
      parameterSection: "Parameter controls for LongCat Flash Chat model",
      statusMessages: {
        processing: "Processing conversational request with LongCat model",
        complete: "Response ready from LongCat model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen3-next-80b-a3b-instruct", {
  provider: "qwen",
  name: "Qwen3 Next 80B A3B Instruct",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Qwen3-Next-80B-A3B-Instruct is an instruction-tuned chat model optimised for fast, stable responses without 'thinking' traces. Excels at complex reasoning, code generation, knowledge QA, and multilingual tasks with high throughput and stability on ultra-long inputs and multi-turn dialogues.",
  costs: {
    input: 0.14, // $0.14/M tokens
    output: 1.4, // $1.40/M tokens
  },
  capabilities: [
    "text",
    "code",
    "reasoning",
    "multilingual",
    "dialogue",
    "tool_calling",
    "long_context",
    "rag",
    "agentic_workflows",
    "high_throughput",
  ],
  maxContext: 262144,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar performance and capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "High-throughput instruction-tuned model optimised for production workflows",
    releaseDate: "2025-09-11",
    modelArchitecture: {
      parameters: "80B",
      activeParameters: "A3B", // Efficient parameter activation
      type: "instruction-tuned",
      generation: "3-Next",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-09-11",
    },
    languageSupport: [
      "english",
      "chinese",
      "french",
      "spanish",
      "portuguese",
      "german",
      "italian",
      "russian",
      "japanese",
      "korean",
      "vietnamese",
      "thai",
      "arabic",
    ],
    domainExpertise: {
      coding: 9, // Rating out of 10
      reasoning: 9,
      general: 8,
      multilingual: 9,
      throughput: 10,
    },
    bestFor: [
      "production workflows",
      "agentic systems",
      "RAG applications",
      "code generation",
      "multi-turn conversations",
      "ultra-long context processing",
      "deterministic outputs",
      "tool integration",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: [
        "latin",
        "chinese",
        "cyrillic",
        "japanese",
        "korean",
        "arabic",
        "thai",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "top_k",
      "seed",
      "min_p",
      "response_format",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tool_calling",
      "response_format",
      "logprobs",
      "high_throughput",
      "deterministic_outputs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "production-workflows",
      "agentic-systems",
      "multilingual-content",
      "code-documentation",
      "long-context-tasks",
      "deterministic-responses",
    ],
    warnings: [
      "Ultra-long context processing may require extended processing time",
      "Provide clear progress indicators for complex multi-turn dialogues",
      "Consider response chunking for very long outputs",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 Next 80B A3B Instruct - High-throughput model with 262K context",
      parameterSection: "Parameter controls for Qwen3 Next model",
      statusMessages: {
        processing: "Processing request with Qwen3 Next model",
        complete: "Response ready from Qwen3 Next model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen-plus-2025-07-28", {
  provider: "qwen",
  name: "Qwen Plus 0728",
  category: "LargeContext",
  disabled: false,
  description:
    "Qwen Plus 0728, based on the Qwen3 foundation model, is a 1 million context hybrid reasoning model with a balanced performance, speed, and cost combination. Optimised for extended context processing with advanced reasoning capabilities.",
  costs: {
    input: 0.4, // $0.40/M tokens
    output: 1.2, // $1.20/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "structured_outputs",
    "extended_context",
    "hybrid_reasoning",
    "multilingual",
  ],
  maxContext: 1000000,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar reasoning capabilities but smaller context
  isFree: false,
  metadata: {
    categoryDescription:
      "Ultra-long context model with hybrid reasoning and balanced performance",
    releaseDate: "2025-07-28",
    modelArchitecture: {
      parameters: "Qwen3",
      type: "hybrid-reasoning",
      generation: "Plus",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-07-28",
    },
    domainExpertise: {
      reasoning: 8, // Rating out of 10
      general: 7,
      extended_context: 10,
      performance: 7,
      cost_efficiency: 8,
    },
    bestFor: [
      "ultra-long document processing",
      "extended context reasoning",
      "large-scale text analysis",
      "multi-document synthesis",
      "tool-assisted workflows",
      "structured output generation",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese", "multilingual"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "presence_penalty",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "hybrid_reasoning",
      "ultra_long_context",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "extended-document-analysis",
      "multi-document-reasoning",
      "large-context-processing",
      "structured-data-extraction",
    ],
    warnings: [
      "Ultra-long context may require extended processing time",
      "Consider chunked processing for very large inputs to improve accessibility",
      "Progress indicators recommended for long context operations",
    ],
    ariaLabels: {
      modelSelect: "Qwen Plus 0728 - 1 million context hybrid reasoning model",
      parameterSection: "Parameter controls for Qwen Plus model",
      statusMessages: {
        processing:
          "Processing request with Qwen Plus model - extended context may take longer",
        complete: "Response ready from Qwen Plus model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen-plus-2025-07-28:thinking", {
  provider: "qwen",
  name: "Qwen Plus 0728 (thinking)",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Qwen Plus 0728 is a hybrid reasoning model based on the Qwen3 foundation model with 1 million context window. Offers balanced performance, speed, and cost with advanced reasoning capabilities and structured output support.",
  costs: {
    input: 0.4, // $0.40/M tokens
    output: 4.0, // $4.00/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "tool_calling",
    "structured_outputs",
    "extended_thinking",
    "ultra_long_context",
    "hybrid_reasoning",
    "multilingual",
  ],
  maxContext: 1000000,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Ultra-long context reasoning model with hybrid processing capabilities",
    releaseDate: "2025-09-08",
    modelArchitecture: {
      parameters: "Unknown", // Not specified in provided information
      type: "hybrid-reasoning",
      generation: "3",
      contextWindow: "1M tokens",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-09-08",
    },
    languageSupport: [
      "english",
      "chinese",
      "multilingual", // Qwen models typically support multiple languages
    ],
    domainExpertise: {
      reasoning: 9, // Rating out of 10 - hybrid reasoning model
      general: 8,
      structured_outputs: 8,
      long_context: 10, // 1M context is exceptional
      cost_efficiency: 7,
    },
    bestFor: [
      "ultra-long context processing",
      "hybrid reasoning tasks",
      "structured output generation",
      "tool-assisted workflows",
      "complex multi-step reasoning",
      "document analysis with full context retention",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
      longContextSupport: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "presence_penalty",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "hybrid_reasoning",
      "include_reasoning",
      "structured_outputs",
      "tool_calling",
      "ultra_long_context",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "ultra-long-document-analysis",
      "complex-reasoning-tasks",
      "structured-data-generation",
      "multi-step-workflows",
      "tool-assisted-processing",
    ],
    warnings: [
      "Ultra-long context may require extended processing time - provide appropriate progress feedback",
      "Reasoning mode may require additional UI indicators for accessibility users",
      "Consider response size warnings for very long context inputs",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen Plus 0728 (thinking) - Hybrid reasoning model with 1M context",
      parameterSection: "Parameter controls for Qwen Plus thinking model",
      statusMessages: {
        processing:
          "Processing with Qwen Plus reasoning model, this may take additional time for complex reasoning",
        complete: "Qwen Plus reasoning response complete",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("qwen/qwen3-next-80b-a3b-thinking", {
  provider: "qwen",
  name: "Qwen3 Next 80B A3B Thinking",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Qwen3-Next-80B-A3B-Thinking is a reasoning-first chat model that outputs structured thinking traces by default. Designed for complex multi-step problems including mathematical proofs, code synthesis, debugging, logic puzzles, and agentic planning with enhanced stability during long reasoning chains.",
  costs: {
    input: 0.14, // $0.14/M tokens
    output: 1.4, // $1.40/M tokens
  },
  capabilities: [
    "text",
    "reasoning",
    "code",
    "mathematics",
    "tool_calling",
    "agent_workflows",
    "multilingual",
    "structured_thinking",
    "long_context",
    "step_by_step_reasoning",
  ],
  maxContext: 262144,
  fallbackTo: "anthropic/claude-3.7-sonnet", // Similar reasoning capabilities and extended thinking features
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with structured thinking traces and multi-step problem solving",
    releaseDate: "2025-09-11",
    modelArchitecture: {
      parameters: "80B",
      activeParameters: "3B", // A3B indicates 3B active parameters
      type: "reasoning-first",
      generation: "3-next",
    },
    policyLinks: {
      privacyPolicy: "https://qwenlabs.com/privacy", // Replace with actual URL when available
      acceptableUse: "",
      termsOfService: "https://qwenlabs.com/terms", // Replace with actual URL when available
      lastUpdated: "2025-09-11",
    },
    languageSupport: [
      "english",
      "chinese",
      "multilingual", // Based on description mentioning multilingual evaluations
    ],
    domainExpertise: {
      reasoning: 9, // Rating out of 10 - primary strength
      mathematics: 9,
      coding: 8,
      general: 7,
      logic: 9,
      planning: 8,
    },
    bestFor: [
      "mathematical proofs",
      "complex reasoning tasks",
      "code synthesis and debugging",
      "logic puzzles",
      "agentic planning workflows",
      "multi-step problem solving",
      "structured thinking processes",
      "tool-assisted workflows",
    ],
    accessibility: {
      multilingualSupport: true,
      languageDetection: true,
      scriptSupport: ["latin", "chinese"],
      reasoningSupport: true, // Special feature for this model
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "top_k",
      "seed",
      "min_p",
      "response_format",
      "logprobs",
      "logit_bias",
      "top_logprobs",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0.05,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1.1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.0,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 40,
      },
      top_p: {
        p10: 0.8,
        p50: 0.9,
        p90: 1,
      },
    },
    features: [
      "structured_thinking",
      "include_reasoning",
      "tool_calling",
      "response_format",
      "logprobs",
      "reasoning_traces",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "step-by-step-reasoning",
      "mathematical-content",
      "code-generation",
      "complex-problem-solving",
      "structured-thinking",
      "agent-workflows",
    ],
    warnings: [
      "Thinking mode generates structured reasoning traces by default",
      "May produce longer responses due to detailed reasoning steps",
      "Consider providing progress indicators for extended reasoning tasks",
      "Reasoning traces may require additional screen reader navigation support",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 Next 80B A3B Thinking - Reasoning-first model with 262K context",
      parameterSection: "Parameter controls for Qwen3 Next Thinking model",
      statusMessages: {
        processing:
          "Processing with Qwen3 thinking model, generating structured reasoning",
        complete:
          "Qwen3 thinking model response complete with reasoning traces",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration to model-definitions.js
// Insert this before the modelRegistry.validateAllFallbacks(); line

modelRegistry.registerModel("arcee-ai/afm-4.5b", {
  provider: "arcee-ai",
  name: "AFM 4.5B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "AFM-4.5B is a 4.5 billion parameter instruction-tuned language model developed by Arcee AI. Trained on 8 trillion tokens with emphasis on mathematical reasoning and code generation. Optimised for efficiency and adaptability across deployment environments.",
  costs: {
    input: 0.1, // $0.10/M tokens
    output: 0.4, // $0.40/M tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "mathematics",
    "creative_writing",
    "retrieval",
    "customizable",
    "efficient_inference",
  ],
  maxContext: 65536,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Fallback to larger model with similar capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Efficient 4.5B parameter model optimised for deployment flexibility and customisation",
    releaseDate: "2025-09-16",
    modelArchitecture: {
      parameters: "4.5B",
      type: "instruction-tuned",
      architecture: "decoder-only transformer",
      specialFeatures: "grouped query attention, ReLU� activation",
    },
    policyLinks: {
      privacyPolicy: "https://www.arcee.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://www.arcee.ai/terms",
      lastUpdated: "2025-09-16",
    },
    trainingData: {
      totalTokens: "8T",
      generalData: "6.5T",
      specialisedData: "1.5T",
      focus: "mathematical reasoning and code generation",
    },
    domainExpertise: {
      general: 7, // Rating out of 10
      mathematics: 8,
      code: 8,
      creative: 7,
      efficiency: 9,
    },
    bestFor: [
      "cost-effective deployment",
      "mathematical reasoning",
      "code generation",
      "creative writing",
      "chat applications",
      "fine-tuning and customisation",
      "edge device deployment",
    ],
    accessibility: {
      deploymentFlexibility: true,
      resourceEfficient: true,
      customisationFriendly: true,
    },
  },
  parameterSupport: {
    supported: [
      "structured_outputs",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "system-prompt", // Added as requested with hyphen
    ],
    statistics: {
      frequency_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      min_p: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      presence_penalty: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      repetition_penalty: {
        p10: 1,
        p50: 1,
        p90: 1,
      },
      temperature: {
        p10: 0.1,
        p50: 0.7,
        p90: 1.1,
      },
      top_k: {
        p10: 0,
        p50: 0,
        p90: 0,
      },
      top_p: {
        p10: 0.9,
        p50: 1,
        p90: 1,
      },
    },
    features: [
      "structured_outputs",
      "response_format",
      "efficient_inference",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "cost-conscious-deployment",
      "mathematical-content",
      "code-assistance",
      "creative-projects",
      "chat-applications",
    ],
    warnings: [
      "Smaller parameter count may require more specific prompting for complex tasks",
      "Consider cost-benefit analysis for high-volume applications",
    ],
    ariaLabels: {
      modelSelect:
        "AFM 4.5B - Efficient instruction-tuned model with 65K context",
      parameterSection: "Parameter controls for AFM 4.5B model",
      statusMessages: {
        processing: "Processing request with AFM model",
        complete: "Response ready from AFM model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this entry to model-definitions.js in the appropriate section

modelRegistry.registerModel("qwen/qwen3-max", {
  provider: "qwen",
  name: "Qwen3 Max",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Advanced instruction-tuned model with major improvements in reasoning, multilingual support, and long-tail knowledge coverage. Delivers higher accuracy in mathematics, coding, logic, and science tasks while following complex instructions reliably. Optimised for retrieval-augmented generation (RAG) and tool calling with reduced hallucinations and enhanced response quality for open-ended Q&A, writing, and conversation.",
  costs: {
    input: 1.2, // Per million tokens
    output: 6.0, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "mathematics",
    "multilingual",
    "reasoning",
    "tool_calling",
  ],
  maxContext: 256000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance general-purpose model with advanced reasoning capabilities",
    releaseDate: "2025-09-23",
    modelArchitecture: {
      type: "instruction-tuned",
      series: "Qwen3",
    },
    policyLinks: {
      privacyPolicy:
        "https://www.alibabacloud.com/help/en/dashscope/privacy-policy",
      acceptableUse: "",
      termsOfService:
        "https://www.alibabacloud.com/help/en/dashscope/terms-of-service",
      lastUpdated: "2025-09-23",
    },
    languageSupport: ["English", "Chinese", "Multilingual (100+ languages)"],
    domainExpertise: {
      mathematics: 9,
      coding: 9,
      reasoning: 9,
      multilingual: 10,
      science: 8,
      writing: 8,
    },
    bestFor: [
      "complex reasoning tasks",
      "multilingual translation",
      "mathematics and science",
      "coding assistance",
      "instruction following",
      "retrieval-augmented generation",
      "tool calling applications",
      "creative writing",
    ],
    accessibility: {
      multilingualSupport: true,
      complexInstructionHandling: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "presence_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "advanced_reasoning",
      "multilingual_support",
      "tool_calling",
      "rag_optimisation",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "multilingual-applications",
      "educational-assistance",
      "research-support",
    ],
    warnings: [
      "High output costs may impact accessibility for extended conversations",
      "Complex reasoning capabilities require clear instruction formatting",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 Max - Advanced reasoning model with 256,000 token context",
      parameterSection: "Parameter controls for Qwen3 Max model",
      statusMessages: {
        processing: "Processing request with Qwen3 Max reasoning model",
        complete: "Response ready from Qwen3 Max model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this Qwen3 VL model registration entry
modelRegistry.registerModel("qwen/qwen3-vl-235b-a22b-instruct", {
  provider: "qwen",
  name: "Qwen3 VL 235B A22B Instruct",
  category: "Vision",
  disabled: false,
  description:
    "Advanced open-weight multimodal model that unifies strong text generation with comprehensive visual understanding across images and video. Specialised for vision-language tasks including VQA, document parsing, chart extraction, and multilingual OCR. Features robust perception capabilities, spatial understanding, and long-form visual comprehension with competitive performance on multimodal benchmarks. Supports agentic interaction, tool use, GUI automation, and visual coding workflows whilst maintaining strong text-only performance.",
  costs: {
    input: 0.7,
    output: 2.8,
    image: 0.7,
  },
  capabilities: [
    "text",
    "vision",
    "dialogue",
    "multilingual",
    "code",
    "tool_calling",
    "reasoning",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal model for vision-language tasks and visual reasoning",
    releaseDate: "2025-09-23",
    modelArchitecture: {
      parameters: "235B",
      type: "instruction-tuned",
      multimodal: true,
      videoSupport: true,
      spatialUnderstanding: true,
    },
    policyLinks: {
      privacyPolicy: "https://qwenlm.github.io/",
      acceptableUse: "",
      termsOfService: "https://qwenlm.github.io/",
      lastUpdated: "2025-09-23",
    },
    languageSupport: ["english", "chinese", "multilingual"],
    domainExpertise: {
      documentAnalysis: 9,
      visualReasoning: 9,
      codeGeneration: 8,
      OCR: 9,
      spatialUnderstanding: 9,
      guiAutomation: 8,
    },
    bestFor: [
      "visual question answering",
      "document analysis and parsing",
      "chart and table extraction",
      "multilingual OCR",
      "GUI automation tasks",
      "visual coding workflows",
      "video analysis and temporal queries",
      "spatial and embodied AI tasks",
    ],
    accessibility: {
      visualDescriptions:
        "Supports generating detailed image descriptions for accessibility",
      documentParsing: "Excellent for parsing and describing visual documents",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "presence_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "advanced_vision_processing",
      "video_understanding",
      "tool_integration",
      "structured_outputs",
      "reasoning_capabilities",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-content-analysis",
      "document-accessibility-enhancement",
      "gui-automation-assistance",
      "multilingual-text-recognition",
    ],
    warnings: [
      "Large model may have slower response times",
      "Video processing requires adequate bandwidth",
      "Complex visual scenes may need detailed prompting for optimal accessibility descriptions",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 VL 235B A22B Instruct - Advanced multimodal vision model with 131K context",
      parameterSection:
        "Parameter controls for Qwen3 VL 235B A22B Instruct vision model",
      statusMessages: {
        processing:
          "Processing visual content with Qwen3 VL 235B A22B Instruct",
        complete: "Visual analysis complete from Qwen3 VL 235B A22B Instruct",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert the following model registration entry:

modelRegistry.registerModel("qwen/qwen3-vl-235b-a22b-thinking", {
  provider: "qwen",
  name: "Qwen3 VL 235B A22B Thinking",
  category: "Vision",
  disabled: false,
  description:
    "Advanced multimodal model combining 235B parameter architecture with A22B thinking capabilities. Specialises in visual reasoning across images and video with optimised STEM and mathematics performance. Features robust spatial understanding, temporal video analysis, and agentic tool interaction. Excels at visual coding workflows, GUI automation, document analysis, and multilingual OCR whilst maintaining strong text-only performance comparable to flagship language models.",
  costs: {
    input: 0.7,
    output: 8.4,
    image: 0.7,
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "mathematics",
    "reasoning",
    "tool_calling",
    "code",
    "multilingual",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal vision model with thinking capabilities",
    releaseDate: "2025-09-23",
    modelArchitecture: {
      parameters: "235B",
      type: "multimodal-thinking",
      thinkingComponent: "A22B",
      modalitySupport: ["text", "image", "video"],
      specialisations: [
        "visual-reasoning",
        "spatial-understanding",
        "temporal-analysis",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://qwen.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://qwen.ai/terms",
      lastUpdated: "2025-09-23",
    },
    languageSupport: ["english", "chinese", "multilingual-ocr"],
    domainExpertise: {
      mathematics: 9,
      visualReasoning: 10,
      spatialUnderstanding: 9,
      documentAnalysis: 9,
      codeGeneration: 8,
      temporalAnalysis: 9,
    },
    bestFor: [
      "visual reasoning and analysis",
      "STEM problem solving",
      "document AI and OCR",
      "GUI automation and testing",
      "visual coding workflows",
      "video temporal analysis",
      "multimodal research tasks",
      "spatial understanding tasks",
    ],
    accessibility: {
      visualDescriptions:
        "Excellent for generating detailed visual descriptions",
      documentProcessing: "Advanced OCR and document structure analysis",
      codeAssistance: "Visual debugging and UI accessibility auditing",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "presence_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "advanced-reasoning",
      "multimodal-processing",
      "tool-integration",
      "structured-outputs",
      "thinking-transparency",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-content-analysis",
      "document-accessibility-auditing",
      "ui-automation-testing",
      "stem-education-support",
      "visual-coding-assistance",
    ],
    warnings: [
      "Large model may have slower response times for complex visual analysis",
      "High cost per token - consider usage optimisation for extended sessions",
      "Ensure video content is appropriately formatted for temporal analysis",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 VL 235B A22B Thinking - Advanced multimodal vision model with 131K context",
      parameterSection:
        "Parameter controls for Qwen3 VL 235B A22B Thinking multimodal model",
      statusMessages: {
        processing:
          "Processing multimodal request with Qwen3 VL 235B A22B Thinking",
        complete: "Multimodal analysis ready from Qwen3 VL 235B A22B Thinking",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this entry to model-definitions.js

modelRegistry.registerModel("deepseek/deepseek-v3.1-terminus", {
  provider: "deepseek",
  name: "DeepSeek V3.1 Terminus",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Advanced hybrid reasoning model with 671B parameters (37B active) that supports both thinking and non-thinking modes. Optimised for coding, tool calling, and agentic workflows with enhanced language consistency and reasoning efficiency. Features structured tool calling, code agents, and search agents, making it suitable for research, development, and complex reasoning tasks.",
  costs: {
    input: 0.27,
    output: 1.0,
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "reasoning",
    "tool_calling",
    "mathematics",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with hybrid architecture and tool calling",
    releaseDate: "2025-09-22",
    modelArchitecture: {
      parameters: "671B (37B active)",
      type: "hybrid-reasoning",
      features: [
        "thinking-mode",
        "non-thinking-mode",
        "FP8-microscaling",
        "long-context-training",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://deepseek.com/privacy",
      acceptableUse: "",
      termsOfService: "https://deepseek.com/terms",
      lastUpdated: "2025-09-22",
    },
    bestFor: [
      "code generation",
      "reasoning tasks",
      "tool calling",
      "agentic workflows",
      "research applications",
      "search agents",
    ],
    domainExpertise: {
      coding: 9,
      reasoning: 9,
      toolUse: 9,
      research: 8,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "response_format",
      "logprobs",
      "top_logprobs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning-control",
      "tool-calling",
      "structured-output",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "code-development",
      "research-tasks",
      "reasoning-problems",
      "tool-integration",
      "agent-workflows",
    ],
    warnings: [
      "Large model may have longer response times",
      "Complex reasoning mode may require additional processing time",
      "Tool calling features require careful configuration",
    ],
    ariaLabels: {
      modelSelect:
        "DeepSeek V3.1 Terminus - Advanced hybrid reasoning model with 131K context",
      parameterSection: "Parameter controls for DeepSeek V3.1 Terminus",
      statusMessages: {
        processing: "Processing request with DeepSeek V3.1 Terminus",
        complete: "Response ready from DeepSeek V3.1 Terminus",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry:

modelRegistry.registerModel("thedrummer/cydonia-24b-v4.1", {
  provider: "thedrummer",
  name: "Cydonia 24B V4.1",
  category: "Specialized",
  disabled: false,
  description:
    "Specialised creative writing model based on Mistral Small 3.2 24B, optimised for prose generation with excellent mood and nuance. Praised for maintaining creativity across multiple responses whilst avoiding purple prose. Excels at roleplay and character dialogue with strong focus and memory retention.",
  costs: {
    input: 0.15, // Per million tokens
    output: 0.5, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "creative_writing",
    "roleplay",
    "multilingual",
  ],
  maxContext: 131072,
  fallbackTo: "mistralai/mistral-small",
  isFree: false,
  metadata: {
    categoryDescription:
      "Creative writing specialist with exceptional prose quality",
    releaseDate: "2024-09-27",
    modelArchitecture: {
      parameters: "24B",
      type: "instruction-tuned",
      baseModel: "Mistral Small 3.2 24B",
      specialisation: "creative_writing",
    },
    policyLinks: {
      privacyPolicy: "",
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2024-09-27",
    },
    bestFor: [
      "creative writing",
      "prose generation",
      "roleplay scenarios",
      "character dialogue",
      "storytelling",
      "mood and atmosphere",
    ],
    domainExpertise: {
      creativeWriting: 9,
      proseQuality: 9,
      characterDevelopment: 8,
      consistency: 9,
      roleplay: 8,
    },
    accessibility: {
      strengths: [
        "Consistent creative output",
        "Avoids repetitive patterns",
        "Strong narrative focus",
      ],
      considerations: [
        "Optimised for creative tasks rather than factual accuracy",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "frequency_penalty",
      "min_p",
      "presence_penalty",
      "repetition_penalty",
      "seed",
      "stop",
      "top_k",
      "logit_bias",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: ["creative_consistency", "prose_quality", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "creative-writing",
      "roleplay-scenarios",
      "character-development",
      "narrative-generation",
    ],
    warnings: [
      "Optimised for creative writing rather than factual accuracy",
      "May not be suitable for technical or analytical tasks",
    ],
    ariaLabels: {
      modelSelect:
        "Cydonia 24B V4.1 - Creative writing specialist with 131K context",
      parameterSection: "Parameter controls for Cydonia 24B V4.1",
      statusMessages: {
        processing: "Processing creative writing request with Cydonia 24B V4.1",
        complete: "Creative response ready from Cydonia 24B V4.1",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry in model-definitions.js

modelRegistry.registerModel("deepseek/deepseek-v3.2-exp", {
  provider: "deepseek",
  name: "DeepSeek V3.2 Exp",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "An experimental large language model featuring DeepSeek Sparse Attention (DSA) for improved efficiency in long-context scenarios. Optimised for reasoning, coding, and agentic tool-use tasks whilst maintaining performance comparable to V3.1. Primarily research-oriented for exploring efficient transformer architectures.",
  costs: {
    input: 0.27, // Per million tokens
    output: 0.41, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "code",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 163840,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Experimental general-purpose model with advanced sparse attention mechanisms",
    releaseDate: "2025-09-29",
    modelArchitecture: {
      parameters: "Unknown",
      type: "experimental-instruction-tuned",
      specialFeatures: [
        "DeepSeek Sparse Attention (DSA)",
        "fine-grained sparse attention",
      ],
      optimisedFor: [
        "long-context scenarios",
        "training efficiency",
        "inference efficiency",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://deepseek.com/privacy",
      acceptableUse: "",
      termsOfService: "https://deepseek.com/terms",
      lastUpdated: "2025-09-29",
    },
    bestFor: [
      "experimental research",
      "long-context processing",
      "reasoning tasks",
      "coding assistance",
      "tool integration",
      "architectural exploration",
    ],
    domainExpertise: {
      reasoning: 8,
      coding: 8,
      toolUse: 8,
      longContext: 9,
      research: 9,
    },
    accessibility: {
      supportedContextLengths: ["standard", "extended", "maximum"],
      optimisations: ["sparse attention", "efficiency focused"],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "tool_calling",
      "reasoning_support",
      "sparse_attention",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "research-tasks",
      "long-context-analysis",
      "reasoning-workflows",
      "coding-assistance",
      "experimental-development",
    ],
    warnings: [
      "Experimental model - performance may vary compared to stable releases",
      "Optimised for efficiency rather than maximum accuracy in some domains",
      "Research-oriented - may have different behaviour patterns than production models",
    ],
    ariaLabels: {
      modelSelect:
        "DeepSeek V3.2 Exp - Experimental reasoning and coding model with 163K context window",
      parameterSection:
        "Parameter controls for DeepSeek V3.2 Exp experimental model",
      statusMessages: {
        processing:
          "Processing request with DeepSeek V3.2 Exp experimental model",
        complete: "Response ready from DeepSeek V3.2 Exp",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("anthropic/claude-sonnet-4.5", {
  provider: "anthropic",
  name: "Claude Sonnet 4.5",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Anthropic's most advanced Sonnet model, optimised for real-world agents and coding workflows. Delivers state-of-the-art performance on coding benchmarks with enhanced agentic capabilities including improved tool orchestration, speculative parallel execution, and efficient context management. Designed for extended autonomous operation with fact-based progress tracking across sessions.",
  costs: {
    input: 3.0, // Per million tokens
    output: 15.0, // Per million tokens
    image: 4800.0, // Per million images ($4.80/K)
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "reasoning",
    "tool_calling",
    "vision",
    "mathematics",
    "multilingual",
  ],
  maxContext: 1000000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced general-purpose model with superior coding and agentic capabilities",
    releaseDate: "2025-09-29",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      specialFeatures: [
        "agentic_workflows",
        "tool_orchestration",
        "speculative_execution",
        "context_tracking",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://www.anthropic.com/privacy",
      acceptableUse: "https://www.anthropic.com/acceptable-use-policy",
      termsOfService: "https://www.anthropic.com/terms",
      lastUpdated: "2025-09-29",
    },
    domainExpertise: {
      coding: 10,
      cybersecurity: 9,
      research: 9,
      financialAnalysis: 8,
      systemDesign: 9,
      autonomousAgents: 10,
    },
    bestFor: [
      "software engineering",
      "cybersecurity analysis",
      "financial analysis",
      "research agents",
      "autonomous workflows",
      "multi-context operations",
      "long-running tasks",
    ],
    accessibility: {
      contextAwareness: "excellent",
      tokenUsageTracking: "enhanced",
      progressTracking: "fact-based",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "stop",
      "reasoning",
      "include_reasoning",
      "tools",
      "tool_choice",
      "top_p",
      "top_k",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning-mode",
      "tool-orchestration",
      "context-tracking",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "autonomous-agents",
      "coding-workflows",
      "multi-session-tasks",
      "research-analysis",
      "cybersecurity-assessment",
    ],
    warnings: [
      "High token consumption due to advanced reasoning capabilities",
      "Premium pricing model - monitor usage for cost control",
      "Complex tool interactions may require careful prompt design",
    ],
    ariaLabels: {
      modelSelect:
        "Claude Sonnet 4.5 - Advanced agentic model with 1M context window",
      parameterSection:
        "Parameter controls for Claude Sonnet 4.5 advanced features",
      statusMessages: {
        processing:
          "Processing request with Claude Sonnet 4.5 advanced reasoning",
        complete:
          "Response ready from Claude Sonnet 4.5 with enhanced capabilities",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert GLM 4.6 model registration
modelRegistry.registerModel("z-ai/glm-4.6", {
  provider: "Z.AI",
  name: "GLM 4.6",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Advanced general-purpose model with expanded 200K context window, superior coding performance, and enhanced reasoning capabilities. Optimised for complex agentic tasks, tool integration, and refined writing with improved alignment to human preferences in style and readability.",
  costs: {
    input: 0.6, // Per million tokens
    output: 2.2, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "reasoning",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar general-purpose capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Versatile model excelling across coding, reasoning, and agent applications",
    releaseDate: "2025-09-30",
    modelArchitecture: {
      parameters: "Unknown", // Parameter count not specified
      type: "instruction-tuned",
      contextWindow: "200K tokens (expanded from 128K)",
      specialFeatures: [
        "tool integration",
        "agentic capabilities",
        "enhanced reasoning",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://z-ai.com/privacy",
      acceptableUse: "",
      termsOfService: "https://z-ai.com/terms",
      lastUpdated: "2025-09-30",
    },
    domainExpertise: {
      coding: 9,
      reasoning: 9,
      agentDevelopment: 9,
      writing: 8,
      rolePlaying: 8,
    },
    bestFor: [
      "complex agentic tasks",
      "code generation and optimisation",
      "advanced reasoning problems",
      "tool-integrated applications",
      "content writing and role-playing",
      "agent framework integration",
    ],
    accessibility: {
      contextSize:
        "Large 200K context suitable for complex multi-turn conversations",
      performanceNotes:
        "Optimised for sustained reasoning across extended interactions",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "system-prompt", // Always add this with hyphen
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "tool_calling",
      "reasoning_support",
      "agentic_capabilities",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "coding-assistance",
      "reasoning-tasks",
      "agent-development",
      "content-writing",
      "role-playing",
      "tool-integration",
    ],
    warnings: [
      "Large context window may require careful token management for optimal performance",
      "Tool calling features require proper implementation for accessibility compliance",
    ],
    ariaLabels: {
      modelSelect:
        "GLM 4.6 - Advanced general-purpose model with 200K context and tool integration",
      parameterSection:
        "Parameter controls for GLM 4.6 including reasoning and tool settings",
      statusMessages: {
        processing:
          "Processing request with GLM 4.6 advanced reasoning capabilities",
        complete:
          "Response ready from GLM 4.6 with enhanced reasoning and coding optimisation",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry:

modelRegistry.registerModel("openai/gpt-5-pro", {
  provider: "openai",
  name: "GPT-5 Pro",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "OpenAI's most advanced model offering major improvements in reasoning, code quality, and user experience. Optimised for complex tasks requiring step-by-step reasoning, instruction following, and accuracy in high-stakes use cases. Features test-time routing capabilities and advanced prompt understanding with reduced hallucination and sycophancy.",
  costs: {
    input: 15.0, // Per million tokens
    output: 120.0, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "reasoning",
    "mathematics",
    "tool_calling",
  ],
  maxContext: 400000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced flagship model for complex reasoning and high-stakes applications",
    releaseDate: "2025-10-06",
    modelArchitecture: {
      type: "instruction-tuned",
      features: [
        "test-time-routing",
        "advanced-reasoning",
        "structured-outputs",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy",
      acceptableUse: "https://openai.com/usage-policies",
      termsOfService: "https://openai.com/terms",
      lastUpdated: "2025-10-06",
    },
    bestFor: [
      "complex reasoning tasks",
      "high-stakes applications",
      "advanced code generation",
      "instruction following",
      "step-by-step problem solving",
      "health-related analysis",
    ],
    domainExpertise: {
      reasoning: 10,
      coding: 9,
      writing: 9,
      mathematics: 9,
      instruction_following: 10,
    },
    accessibility: {
      supportsScreenReaders: true,
      providesStructuredOutput: true,
      followsInstructions: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "seed",
      "max_tokens",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "advanced-reasoning",
      "test-time-routing",
      "structured-outputs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "high-stakes-applications",
      "detailed-instruction-following",
      "structured-problem-solving",
    ],
    warnings: [
      "High output costs may impact accessibility for extended conversations",
      "Advanced reasoning features require clear, well-structured prompts",
    ],
    ariaLabels: {
      modelSelect:
        "GPT-5 Pro - Advanced reasoning model with 400K context window",
      parameterSection: "Parameter controls for GPT-5 Pro advanced reasoning",
      statusMessages: {
        processing: "Processing complex reasoning request with GPT-5 Pro",
        complete: "Advanced reasoning response ready from GPT-5 Pro",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this into model-definitions.js

modelRegistry.registerModel("google/gemini-2.5-flash-image", {
  provider: "google",
  name: "Gemini 2.5 Flash Image (Nano Banana)",
  category: "Vision",
  disabled: false,
  description:
    "State-of-the-art image generation model with contextual understanding, capable of image generation, edits, and multi-turn conversations. Features advanced aspect ratio control and optimised performance for visual tasks.",
  costs: {
    input: 0.3, // Per million tokens
    output: 2.5, // Per million tokens
    image: 1.238, // Per thousand input images
  },
  capabilities: ["text", "dialogue", "vision"],
  maxContext: 32768,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced image generation with conversational capabilities",
    releaseDate: "2025-10-07",
    modelArchitecture: {
      parameters: "Unknown",
      type: "multimodal-generation",
      specialFeatures: [
        "image_generation",
        "aspect_ratio_control",
        "contextual_understanding",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://policies.google.com/privacy",
      acceptableUse: "https://policies.google.com/terms",
      termsOfService: "https://policies.google.com/terms",
      lastUpdated: "2025-10-07",
    },
    imageSupport: {
      inputCost: 1.238, // Per thousand images
      outputCost: 0.03, // Per thousand images
      aspectRatioControl: true,
      supportedFormats: ["standard_image_formats"],
    },
    bestFor: [
      "image generation",
      "image editing",
      "visual conversations",
      "contextual image creation",
      "multi-turn visual dialogue",
    ],
    accessibility: {
      imageAltTextGeneration: true,
      visualDescriptionCapable: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "response_format",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: ["image_generation", "aspect_ratio_control", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "visual-content-creation",
      "accessible-image-generation",
      "descriptive-visual-dialogue",
    ],
    warnings: [
      "Generated images may require manual accessibility review",
      "Consider providing alternative text descriptions for generated content",
      "Visual outputs may need additional context for screen reader users",
    ],
    ariaLabels: {
      modelSelect:
        "Gemini 2.5 Flash Image - Advanced image generation model with 32K context window",
      parameterSection:
        "Parameter controls for Gemini 2.5 Flash Image generation",
      statusMessages: {
        processing: "Generating visual content with Gemini 2.5 Flash Image",
        complete: "Visual response ready from Gemini 2.5 Flash Image",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this registration entry for Baidu ERNIE 4.5 21B A3B Thinking model
modelRegistry.registerModel("baidu/ernie-4.5-21b-a3b-thinking", {
  provider: "baidu",
  name: "ERNIE 4.5 21B A3B Thinking",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Baidu's upgraded lightweight MoE model with enhanced reasoning capabilities. Optimised for logical puzzles, mathematics, science, coding, text generation, and expert-level academic benchmarks with efficient tool usage and 128K context understanding.",
  costs: {
    input: 0.07, // Per million tokens
    output: 0.28, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "mathematics",
    "code",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with specialised thinking capabilities",
    releaseDate: "2025-10-09",
    modelArchitecture: {
      parameters: "21B",
      type: "instruction-tuned",
      architecture: "MoE (Mixture of Experts)",
      specialFeatures: ["thinking_capability", "long_context"],
    },
    policyLinks: {
      privacyPolicy: "https://www.baidu.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.baidu.com/terms",
      lastUpdated: "2025-10-09",
    },
    languageSupport: [
      "English",
      "Chinese (Simplified)",
      "Chinese (Traditional)",
    ],
    domainExpertise: {
      reasoning: 9,
      mathematics: 9,
      coding: 8,
      science: 8,
      textGeneration: 8,
      academicWork: 9,
    },
    bestFor: [
      "logical puzzles",
      "mathematical reasoning",
      "scientific analysis",
      "coding tasks",
      "academic benchmarks",
      "complex reasoning tasks",
    ],
    accessibility: {
      reasoningTransparency: "Enhanced with thinking capability output",
      contextHandling: "Optimised for long-form academic content",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "logit_bias",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning_transparency",
      "thinking_capability",
      "tool_integration",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "academic-research",
      "mathematical-analysis",
      "logical-reasoning",
      "scientific-computation",
      "complex-problem-solving",
    ],
    warnings: [
      "Reasoning output may be verbose for simple queries",
      "Include reasoning parameter may affect response times",
      "Complex mathematical notation may require careful formatting",
    ],
    ariaLabels: {
      modelSelect:
        "ERNIE 4.5 21B A3B Thinking - Advanced reasoning model with 131K context window",
      parameterSection:
        "Parameter controls for ERNIE 4.5 21B A3B Thinking model",
      statusMessages: {
        processing: "Processing request with ERNIE 4.5 21B A3B Thinking model",
        complete: "Response ready from ERNIE 4.5 21B A3B Thinking model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration entry to model-definitions.js

modelRegistry.registerModel("nvidia/llama-3.3-nemotron-super-49b-v1.5", {
  provider: "nvidia",
  name: "Llama 3.3 Nemotron Super 49B V1.5",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A 49B-parameter, English-centric reasoning and chat model optimised for agentic workflows. Features advanced tool calling, mathematical reasoning, and code generation capabilities with 128K context support. Employs distillation-driven Neural Architecture Search for efficient single-GPU deployment whilst preserving instruction following and chain-of-thought quality.",
  costs: {
    input: 0.1,
    output: 0.4,
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 131072,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model optimised for agentic workflows and tool calling",
    releaseDate: "2024-10-10",
    modelArchitecture: {
      parameters: "49B",
      type: "instruction-tuned",
      baseModel: "Llama-3.3-70B-Instruct",
      optimisations:
        "Neural Architecture Search with distillation for efficiency",
      deployment: "Single-GPU optimised (H100/H200)",
    },
    policyLinks: {
      privacyPolicy:
        "https://www.nvidia.com/en-us/about-nvidia/privacy-policy/",
      acceptableUse: "",
      termsOfService:
        "https://www.nvidia.com/en-us/about-nvidia/terms-of-service/",
      lastUpdated: "2024-10-10",
    },
    trainingData: {
      postTraining: [
        "SFT across mathematics, code, science, and multi-turn chat",
      ],
      reinforcementLearning: [
        "RPO for alignment",
        "RLVR for step-wise reasoning",
        "iterative DPO for tool-use refinement",
      ],
      specialisation: "Agentic workflows, RAG, tool calling",
    },
    domainExpertise: {
      mathematics: 9,
      coding: 9,
      reasoning: 9,
      toolUse: 9,
      science: 8,
    },
    benchmarkResults: {
      MATH500: "97.4% pass@1",
      "AIME-2024": "87.5%",
      "AIME-2025": "82.71%",
      GPQA: "71.97%",
      LiveCodeBench: "73.58%",
      "MMLU-Pro (CoT)": "79.53%",
    },
    bestFor: [
      "agentic workflows",
      "mathematical reasoning",
      "code generation",
      "tool calling applications",
      "RAG systems",
      "long-context analysis",
      "step-wise reasoning tasks",
    ],
    accessibility: {
      reasoningModes: "Explicit reasoning on/off controls available",
      inferenceEfficiency: "Optimised for high tokens/second with reduced VRAM",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "top_k",
      "seed",
      "min_p",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "tool_calling",
      "reasoning_control",
      "agentic_workflows",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "mathematical-reasoning",
      "code-generation",
      "tool-calling-applications",
      "agentic-workflows",
      "long-context-analysis",
    ],
    warnings: [
      "Reasoning mode complexity may require careful parameter tuning",
      "Tool calling features require proper validation for accessibility",
      "High-performance model may have longer response times for complex reasoning",
    ],
    ariaLabels: {
      modelSelect:
        "Llama 3.3 Nemotron Super 49B V1.5 - Advanced reasoning model with 128K context and tool calling",
      parameterSection:
        "Parameter controls for Llama 3.3 Nemotron Super 49B V1.5",
      statusMessages: {
        processing: "Processing request with Llama 3.3 Nemotron Super 49B V1.5",
        complete: "Response ready from Llama 3.3 Nemotron Super 49B V1.5",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert Qwen3 VL 8B Instruct model registration
modelRegistry.registerModel("qwen/qwen3-vl-8b-instruct", {
  provider: "qwen",
  name: "Qwen3 VL 8B Instruct",
  category: "Vision",
  disabled: false,
  description:
    "Advanced multimodal vision-language model optimised for high-fidelity understanding across text, images, and video. Features Interleaved-MRoPE for long-horizon temporal reasoning, DeepStack for fine-grained visual-text alignment, and text-timestamp alignment for precise event localisation. Supports native 256K context extensible to 1M tokens, with robust OCR coverage across 32 languages and enhanced performance under varied visual conditions.",
  costs: {
    input: 0.18, // Per million tokens
    output: 0.69, // Per million tokens
    image: 0.18, // Vision processing uses input rate
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "multilingual",
    "reasoning",
    "tool_calling",
  ],
  maxContext: 262144,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Multimodal vision-language model for advanced visual understanding",
    releaseDate: "2025-10-14",
    modelArchitecture: {
      parameters: "8B",
      type: "instruction-tuned",
      multimodal: true,
      contextExtensible: "1M tokens",
      specialFeatures: [
        "Interleaved-MRoPE",
        "DeepStack alignment",
        "Text-timestamp alignment",
        "Dynamic media processing",
      ],
    },
    policyLinks: {
      privacyPolicy:
        "https://www.alibabacloud.com/help/en/model-studio/privacy-policy",
      acceptableUse: "",
      termsOfService:
        "https://www.alibabacloud.com/help/en/model-studio/terms-of-service",
      lastUpdated: "2025-10-14",
    },
    languageSupport: ["english", "chinese", "multilingual-ocr"],
    domainExpertise: {
      visualReasoning: 9,
      documentAnalysis: 9,
      spatialUnderstanding: 8,
      temporalReasoning: 9,
      guiControl: 8,
      ocrAccuracy: 9,
    },
    bestFor: [
      "document parsing",
      "visual question answering",
      "spatial reasoning",
      "GUI control",
      "video analysis",
      "multimodal understanding",
      "temporal reasoning",
      "multilingual OCR",
    ],
    accessibility: {
      visionModelNotice:
        "Requires image descriptions for visually impaired users",
      ocrSupport: "Supports text extraction from images in 32 languages",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "top_k",
      "seed",
      "min_p",
      "response_format",
      "tools",
      "tool_choice",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "multimodal_fusion",
      "temporal_reasoning",
      "visual_text_alignment",
      "structured_outputs",
      "tool_calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-content-analysis",
      "document-accessibility",
      "gui-automation",
      "multilingual-ocr",
      "spatial-reasoning-tasks",
    ],
    warnings: [
      "Vision models require alternative text descriptions for accessibility",
      "GUI control features may need keyboard navigation alternatives",
      "Image content should be described for screen reader users",
      "Video analysis output should include timestamp descriptions",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 VL 8B Instruct - Multimodal vision model with 262K context window",
      parameterSection:
        "Parameter controls for Qwen3 VL 8B Instruct multimodal model",
      statusMessages: {
        processing: "Processing multimodal request with Qwen3 VL 8B Instruct",
        complete: "Multimodal analysis ready from Qwen3 VL 8B Instruct",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this entry to model-definitions.js

modelRegistry.registerModel("qwen/qwen3-vl-8b-thinking", {
  provider: "qwen",
  name: "Qwen3 VL 8B Thinking",
  category: "Vision",
  disabled: false,
  description:
    "Advanced reasoning-optimised multimodal model specialising in visual and textual reasoning across complex scenes, documents, and temporal sequences. Features enhanced multimodal alignment, long-context processing up to 256K tokens (expandable to 1M), and deliberate reasoning pathways for complex visual analysis, STEM problem-solving, and multi-step video understanding.",
  costs: {
    input: 0.18,
    output: 2.1,
    image: 0.18,
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "mathematics",
    "reasoning",
    "multilingual",
    "tool_calling",
  ],
  maxContext: 256000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal reasoning model with enhanced visual-language fusion",
    releaseDate: "2025-10-14",
    modelArchitecture: {
      parameters: "8B",
      type: "reasoning-optimised multimodal",
      specialFeatures: [
        "Interleaved-MRoPE",
        "timestamp-aware embeddings",
        "enhanced multimodal alignment",
        "deliberate reasoning pathways",
      ],
      contextExpansion: "1M tokens",
    },
    policyLinks: {
      privacyPolicy: "https://qwen.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://qwen.ai/terms",
      lastUpdated: "2025-10-14",
    },
    languageSupport: ["english", "chinese", "multilingual"],
    domainExpertise: {
      visualReasoning: 9,
      scientificAnalysis: 8,
      mathematicalReasoning: 8,
      videoUnderstanding: 9,
      documentAnalysis: 8,
      temporalGrounding: 9,
    },
    bestFor: [
      "visual reasoning tasks",
      "STEM problem solving",
      "scientific visual analysis",
      "video understanding",
      "document analysis with OCR",
      "multimodal research",
      "complex scene interpretation",
    ],
    accessibility: {
      visualContentSupport: true,
      ocrCapabilities: true,
      multimodalAccessibility: "enhanced",
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "presence_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "advanced_reasoning",
      "multimodal_fusion",
      "temporal_grounding",
      "visual_analysis",
      "tool_calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-reasoning-tasks",
      "multimodal-analysis",
      "stem-education",
      "research-applications",
      "document-accessibility",
    ],
    warnings: [
      "Visual content processing may require detailed descriptions for screen reader users",
      "Complex reasoning outputs may need structured presentation for cognitive accessibility",
      "Video analysis features require alternative text descriptions for accessibility compliance",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 VL 8B Thinking - Advanced multimodal reasoning model with 256K context window",
      parameterSection:
        "Parameter controls for Qwen3 VL 8B Thinking multimodal model",
      statusMessages: {
        processing: "Processing multimodal request with Qwen3 VL 8B Thinking",
        complete: "Multimodal analysis complete from Qwen3 VL 8B Thinking",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add Claude Haiku 4.5 model registration
modelRegistry.registerModel("anthropic/claude-haiku-4.5", {
  provider: "anthropic",
  name: "Claude Haiku 4.5",
  category: "GeneralPurpose",
  isDefault: true,
  disabled: false,
  description:
    "Anthropic's fastest and most efficient model, delivering near-frontier intelligence at a fraction of the cost and latency of larger Claude models. Excels at reasoning, coding, and tool-assisted workflows with extended thinking capabilities and exceptional responsiveness for real-time applications.",
  costs: {
    input: 1.0, // Per million tokens
    output: 5.0, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "reasoning",
    "tool_calling",
    "mathematics",
  ],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance general purpose model optimised for speed and efficiency",
    releaseDate: "2025-10-15",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      specialFeatures: [
        "extended-thinking",
        "controllable-reasoning-depth",
        "tool-assisted-workflows",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://www.anthropic.com/privacy",
      acceptableUse: "https://www.anthropic.com/acceptable-use-policy",
      termsOfService: "https://www.anthropic.com/terms",
      lastUpdated: "2025-10-15",
    },
    domainExpertise: {
      coding: 9,
      reasoning: 9,
      toolUse: 10,
      realTimeApplications: 10,
    },
    bestFor: [
      "real-time applications",
      "high-volume processing",
      "coding and development",
      "tool-assisted workflows",
      "sub-agent deployment",
      "parallelised execution",
    ],
    accessibility: {
      fastResponse: true,
      suitableForRealTime: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "stop",
      "reasoning",
      "include_reasoning",
      "tools",
      "tool_choice",
      "top_p",
      "top_k",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "extended-thinking",
      "controllable-reasoning",
      "tool-integration",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "real-time-applications",
      "high-volume-processing",
      "rapid-prototyping",
      "interactive-coding",
    ],
    warnings: [
      "Optimised for speed - may have different reasoning patterns than larger models",
      "Consider latency requirements when selecting reasoning depth",
    ],
    ariaLabels: {
      modelSelect:
        "Claude Haiku 4.5 - Fast, efficient frontier-level model with 200K context",
      parameterSection: "Parameter controls for Claude Haiku 4.5",
      statusMessages: {
        processing: "Processing request with Claude Haiku 4.5",
        complete: "Response ready from Claude Haiku 4.5",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this registration entry into model-definitions.js

modelRegistry.registerModel("openai/gpt-5-image-mini", {
  provider: "openai",
  name: "GPT-5 Image Mini",
  category: "Vision",
  disabled: false,
  description:
    "Advanced multimodal model combining GPT-5 Mini language capabilities with GPT Image 1 Mini for efficient image generation. Features superior instruction following, text rendering, and detailed image editing with reduced latency and cost. Excels at high-quality visual creation whilst maintaining strong text understanding, making it ideal for applications requiring both efficient image generation and text processing at scale.",
  costs: {
    input: 2.5, // Per million tokens
    output: 2.0, // Per million tokens
    image: 3.0, // Per million input images
    imageOutput: 8.0, // Per million output images
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "tool_calling",
    "reasoning",
    "image_generation",
    "multimodal",
  ],
  maxContext: 400000,
  fallbackTo: "openai/gpt-4o",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal model with integrated image generation and vision capabilities",
    releaseDate: "2025-10-16",
    modelArchitecture: {
      parameters: "Unknown",
      type: "multimodal-instruct",
      components: ["GPT-5 Mini", "GPT Image 1 Mini"],
      nativeMultimodal: true,
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy",
      acceptableUse: "https://openai.com/usage-policies",
      termsOfService: "https://openai.com/terms",
      lastUpdated: "2025-10-16",
    },
    bestFor: [
      "image generation",
      "visual content creation",
      "multimodal applications",
      "text and image processing",
      "instruction following",
      "image editing",
      "scalable visual workflows",
    ],
    domainExpertise: {
      imageGeneration: 9,
      textUnderstanding: 8,
      instructionFollowing: 9,
      imageEditing: 8,
      multimodalReasoning: 8,
    },
    accessibility: {
      imageAltTextGeneration: true,
      visualDescriptionSupport: true,
      structuredOutputs: true,
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "seed",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "advanced_reasoning",
      "structured_outputs",
      "multimodal_generation",
      "tool_calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-content-creation",
      "accessible-image-generation",
      "multimodal-applications",
      "assistive-technology-integration",
    ],
    warnings: [
      "Image generation may require additional alt text descriptions for accessibility",
      "Visual content should be reviewed for colour contrast and readability",
      "Generated images may need manual accessibility validation",
    ],
    ariaLabels: {
      modelSelect:
        "GPT-5 Image Mini - Advanced multimodal model with 400K context and image generation",
      parameterSection:
        "Parameter controls for GPT-5 Image Mini multimodal model",
      statusMessages: {
        processing: "Processing multimodal request with GPT-5 Image Mini",
        complete: "Multimodal response ready from GPT-5 Image Mini",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this registration entry for Deep Cogito Cogito V2 Preview Llama 405B
modelRegistry.registerModel("deepcogito/cogito-v2-preview-llama-405b", {
  provider: "deep_cogito",
  name: "Cogito V2 Preview Llama 405B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Dense hybrid reasoning model that combines direct answering capabilities with advanced self-reflection. Represents a significant step toward frontier intelligence with dense architecture delivering performance competitive with leading closed models. Advanced reasoning system optimised for exceptional capabilities through policy improvement and massive scale.",
  costs: {
    input: 3.5, // Per million tokens
    output: 3.5, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "tool_calling",
    "mathematics",
    "code",
  ],
  maxContext: 32768,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model with frontier intelligence capabilities",
    releaseDate: "2025-10-17",
    modelArchitecture: {
      parameters: "405B",
      type: "instruction-tuned",
      architecture: "dense hybrid reasoning",
      specialFeatures: [
        "self-reflection",
        "policy improvement",
        "advanced reasoning",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://deepcogito.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://deepcogito.ai/terms",
      lastUpdated: "2025-10-17",
    },
    bestFor: [
      "advanced reasoning tasks",
      "self-reflective analysis",
      "complex problem solving",
      "tool-assisted workflows",
      "frontier intelligence applications",
    ],
    domainExpertise: {
      reasoning: 10,
      problemSolving: 9,
      mathematics: 8,
      analysis: 9,
    },
    accessibility: {
      strengths: [
        "detailed explanations",
        "step-by-step reasoning",
        "self-reflection capabilities",
      ],
      considerations: [
        "large model responses",
        "advanced reasoning complexity",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "tools",
      "tool_choice",
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "advanced_reasoning",
      "self_reflection",
      "tool_integration",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "detailed-reasoning-tasks",
      "step-by-step-analysis",
      "complex-problem-solving",
      "educational-explanations",
    ],
    warnings: [
      "Large model may produce lengthy responses requiring scrolling",
      "Advanced reasoning outputs may be complex for some users",
      "Tool calling features require additional interface considerations",
    ],
    ariaLabels: {
      modelSelect:
        "Cogito V2 Preview Llama 405B - Advanced reasoning model with 32K context and self-reflection capabilities",
      parameterSection:
        "Parameter controls for Cogito V2 Preview Llama 405B reasoning model",
      statusMessages: {
        processing:
          "Processing advanced reasoning request with Cogito V2 Preview Llama 405B",
        complete: "Reasoning response ready from Cogito V2 Preview Llama 405B",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this registration entry into model-definitions.js

modelRegistry.registerModel("ibm-granite/granite-4.0-h-micro", {
  provider: "ibm-granite",
  name: "Granite 4.0 Micro",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A 3B parameter long-context instruction model from IBM's Granite 4 family, specifically optimised for tool calling and enterprise applications. Features improved instruction following capabilities and supports 12 languages including English, German, Spanish, French, Japanese, Portuguese, Arabic, Czech, Italian, Korean, Dutch, and Chinese. Designed for diverse business applications with strong tool-use capabilities.",
  costs: {
    input: 0.017,
    output: 0.11,
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "multilingual",
    "tool_calling",
    "reasoning",
  ],
  maxContext: 131000,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct",
  isFree: false,
  metadata: {
    categoryDescription:
      "Versatile instruction-following model with enterprise focus",
    releaseDate: "2025-10-20",
    modelArchitecture: {
      parameters: "3B",
      type: "instruction-tuned",
      contextLength: 131000,
      specialisation: "Long context tool calling",
      trainingTechniques: [
        "supervised finetuning",
        "reinforcement learning",
        "model merging",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://www.ibm.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.ibm.com/terms",
      lastUpdated: "2025-10-20",
    },
    languageSupport: [
      "English",
      "German",
      "Spanish",
      "French",
      "Japanese",
      "Portuguese",
      "Arabic",
      "Czech",
      "Italian",
      "Korean",
      "Dutch",
      "Chinese",
    ],
    trainingData: {
      sources: ["open source instruction datasets", "synthetic datasets"],
      license: "Apache 2.0",
      trainingApproach: "Diverse techniques with structured chat format",
    },
    domainExpertise: {
      enterprise: 9,
      toolCalling: 9,
      codeGeneration: 7,
      multilingual: 8,
      summarisation: 8,
    },
    bestFor: [
      "enterprise applications",
      "tool calling tasks",
      "multilingual dialogue",
      "code assistance",
      "text summarisation",
      "question answering",
      "retrieval augmented generation",
      "function calling",
    ],
    accessibility: {
      modelSize: "compact",
      responseLatency: "fast",
      multilingualSupport: "extensive",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "seed",
      "repetition_penalty",
      "frequency_penalty",
      "presence_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "enterprise_optimised",
      "tool_calling",
      "multilingual",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "enterprise-applications",
      "tool-calling-tasks",
      "multilingual-support",
      "code-assistance",
      "business-workflows",
    ],
    warnings: [
      "3B parameter model may have limitations with highly complex reasoning tasks compared to larger models",
      "Tool calling capabilities require proper function definitions and validation",
      "Performance may vary significantly across the 12 supported languages",
    ],
    ariaLabels: {
      modelSelect:
        "Granite 4.0 Micro - 3B parameter enterprise model with 131K context and tool calling",
      parameterSection: "Parameter controls for Granite 4.0 Micro model",
      statusMessages: {
        processing: "Processing request with Granite 4.0 Micro",
        complete: "Response ready from Granite 4.0 Micro",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry:

modelRegistry.registerModel("liquid/lfm-2.2-6b", {
  provider: "liquid",
  name: "LFM2-2.6B",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "LFM2 is a new generation of hybrid model developed by Liquid AI, specifically designed for edge AI and on-device deployment. It sets a new standard in terms of quality, speed, and memory efficiency, making it ideal for resource-constrained environments.",
  costs: {
    input: 0.05, // Per million tokens
    output: 0.1, // Per million tokens
  },
  capabilities: ["text", "dialogue", "efficiency", "edge_deployment"],
  maxContext: 32768,
  fallbackTo: "anthropic/claude-3.5-haiku", // Similar efficiency-focused model
  isFree: false,
  metadata: {
    categoryDescription: "Efficient hybrid model optimised for edge deployment",
    releaseDate: "2025-10-20",
    modelArchitecture: {
      parameters: "2.6B",
      type: "hybrid",
      optimisedFor: "edge_deployment",
      memoryEfficient: true,
    },
    policyLinks: {
      privacyPolicy: "https://liquid.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://liquid.ai/terms",
      lastUpdated: "2025-10-20",
    },
    bestFor: [
      "edge AI applications",
      "on-device deployment",
      "resource-constrained environments",
      "mobile applications",
      "low-latency inference",
    ],
    domainExpertise: {
      efficiency: 9,
      edgeDeployment: 10,
      generalPurpose: 7,
    },
    accessibility: {
      lowResourceRequirements: true,
      mobileOptimised: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: ["efficiency_optimised", "edge_deployment", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "low-resource-environments",
      "mobile-applications",
      "edge-computing",
      "real-time-processing",
    ],
    warnings: [
      "Smaller parameter count may limit complex reasoning capabilities",
      "Optimised for efficiency over maximum performance",
    ],
    ariaLabels: {
      modelSelect:
        "LFM2-2.6B - Efficient hybrid model with 32K context, optimised for edge deployment",
      parameterSection: "Parameter controls for LFM2-2.6B edge-optimised model",
      statusMessages: {
        processing: "Processing request with LFM2-2.6B efficient model",
        complete: "Response ready from LFM2-2.6B edge model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry into model-definitions.js

modelRegistry.registerModel("liquid/lfm2-8b-a1b", {
  provider: "liquid",
  name: "LFM2-8B-A1B",
  category: "Specialized",
  disabled: false,
  description:
    "Liquid AI's on-device Mixture-of-Experts model optimised for mobile and embedded systems. Features 8.3B total parameters with only 1.5B active per token, delivering efficient performance under tight memory and latency constraints. Specialised for instruction-following, mathematics, multilingual tasks, and code generation while maintaining competitive quality comparable to 3-4B dense models.",
  costs: {
    input: 0.05, // Per million tokens
    output: 0.1, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "mathematics",
    "multilingual",
    "reasoning",
  ],
  maxContext: 32768,
  fallbackTo: "meta-llama/llama-3.2-3b-instruct",
  isFree: false,
  metadata: {
    categoryDescription:
      "Optimised for on-device and resource-constrained environments",
    releaseDate: "2025-10-20",
    modelArchitecture: {
      parameters: "8.3B",
      activeParameters: "1.5B",
      type: "mixture-of-experts",
      expertCount: 32,
      activeExperts: 4,
      backbone: "LFM2 with gated short-convolution and grouped-query attention",
      contextLength: "32K tokens",
      vocabularySize: "65,536",
      pretrainingTokens: "~12T tokens",
    },
    policyLinks: {
      privacyPolicy: "https://www.liquid.ai/privacy",
      acceptableUse: "https://www.liquid.ai/lfm-open-license",
      termsOfService: "https://www.liquid.ai/terms",
      lastUpdated: "2025-10-20",
    },
    trainingData: {
      pretrainingTokens: "~12T tokens",
      architecture: "Sparse MoE with adaptive routing bias",
      specialOptimisation: "On-device execution with XNNPACK optimization",
    },
    languageSupport: ["English", "Multilingual (details not specified)"],
    domainExpertise: {
      mathematics: 8,
      coding: 7,
      instructionFollowing: 8,
      multilingualTasks: 7,
      onDeviceOptimisation: 9,
    },
    bestFor: [
      "On-device applications",
      "Mobile development",
      "Embedded systems",
      "Resource-constrained environments",
      "Mathematics problems",
      "Code generation",
      "Multilingual tasks",
      "Instruction following",
    ],
    accessibility: {
      deviceRequirements: "Optimised for phones, laptops, and embedded systems",
      performanceCharacteristics: "Low latency and memory usage",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "mixture-of-experts",
      "on-device-optimisation",
      "sparse-routing",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "on-device-applications",
      "mobile-development",
      "resource-constrained-environments",
      "embedded-systems",
      "edge-computing",
    ],
    warnings: [
      "Performance may vary significantly across different device hardware configurations",
      "Requires compatible on-device runtime for optimal performance",
      "Active parameter limitation may affect performance on highly complex tasks",
    ],
    ariaLabels: {
      modelSelect:
        "LFM2-8B-A1B - On-device Mixture-of-Experts model with 32K context",
      parameterSection: "Parameter controls for LFM2-8B-A1B on-device model",
      statusMessages: {
        processing: "Processing request with LFM2-8B-A1B on-device model",
        complete: "Response ready from LFM2-8B-A1B",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this registration entry for Qwen3-VL-32B-Instruct
modelRegistry.registerModel("qwen/qwen3-vl-32b-instruct", {
  provider: "qwen",
  name: "Qwen3 VL 32B Instruct",
  category: "Vision",
  disabled: false,
  description:
    "Large-scale multimodal vision-language model with 32 billion parameters, designed for high-precision understanding and reasoning across text, images, and video. Features robust OCR in 32 languages, fine-grained spatial reasoning, and optimised agentic interaction for complex real-world multimodal tasks.",
  costs: {
    input: 0.35,
    output: 1.1,
    image: 0.35,
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "multilingual",
    "reasoning",
    "tool_calling",
  ],
  maxContext: 262144,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription: "Advanced multimodal model for vision-language tasks",
    releaseDate: "2025-10-23",
    modelArchitecture: {
      parameters: "32B",
      type: "instruction-tuned",
      specialFeatures: [
        "Interleaved-MRoPE architecture",
        "DeepStack architecture",
        "Multimodal fusion optimisation",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://qwen.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://qwen.ai/terms",
      lastUpdated: "2025-10-23",
    },
    languageSupport: ["english", "chinese", "multilingual-ocr"],
    domainExpertise: {
      visualReasoning: 9,
      documentAnalysis: 9,
      videoUnderstanding: 8,
      spatialAnalysis: 9,
      multilingualOCR: 9,
    },
    bestFor: [
      "multimodal analysis",
      "visual reasoning",
      "document processing",
      "video understanding",
      "multilingual OCR",
      "spatial analysis",
      "agentic interaction",
    ],
    accessibility: {
      visualDescriptionSupport: true,
      multimodalAccessibility: true,
      documentParsingAid: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "frequency_penalty",
      "min_p",
      "presence_penalty",
      "repetition_penalty",
      "seed",
      "stop",
      "top_k",
      "logit_bias",
      "response_format",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "multimodal_processing",
      "vision_understanding",
      "structured_outputs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-content-analysis",
      "document-accessibility-enhancement",
      "multimodal-interaction",
      "spatial-reasoning-assistance",
    ],
    warnings: [
      "Visual content processing may require alternative text descriptions for screen readers",
      "OCR accuracy may vary with image quality and resolution",
    ],
    ariaLabels: {
      modelSelect:
        "Qwen3 VL 32B Instruct - Multimodal vision-language model with 262K context",
      parameterSection:
        "Parameter controls for Qwen3 VL 32B Instruct multimodal model",
      statusMessages: {
        processing: "Processing multimodal request with Qwen3 VL 32B Instruct",
        complete: "Multimodal response ready from Qwen3 VL 32B Instruct",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this MiniMax M2 free tier model entry
modelRegistry.registerModel("minimax/minimax-m2:free", {
  provider: "minimax",
  name: "MiniMax M2 (Free)",
  category: "FreeTier",
  disabled: false,
  description:
    "Compact, high-efficiency large language model optimised for end-to-end coding and agentic workflows. Delivers near-frontier intelligence across general reasoning, tool use, and multi-step task execution with 10 billion activated parameters and exceptional cost efficiency.",
  costs: {
    input: 0.0,
    output: 0.0,
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "reasoning",
    "tool_calling",
    "mathematics",
    "multilingual",
  ],
  maxContext: 204800,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: true,
  metadata: {
    categoryDescription: "High-performance model available at no cost",
    releaseDate: "2025-10-23",
    modelArchitecture: {
      parameters: "10B",
      totalParameters: "230B",
      type: "instruction-tuned",
      activationEfficient: true,
      optimisedFor: "coding and agentic workflows",
    },
    policyLinks: {
      privacyPolicy: "https://www.minimaxi.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.minimaxi.com/terms",
      lastUpdated: "2025-10-23",
    },
    domainExpertise: {
      coding: 9,
      reasoning: 8,
      mathematics: 8,
      agenticWorkflows: 9,
      toolUse: 8,
    },
    benchmarkResults: {
      "SWE-Bench Verified": "strong performance",
      "Multi-SWE-Bench": "strong performance",
      "Terminal-Bench": "strong performance",
      BrowseComp: "competitive performance",
      GAIA: "competitive performance",
    },
    bestFor: [
      "code generation",
      "multi-file editing",
      "agentic workflows",
      "developer assistance",
      "reasoning-driven applications",
      "multi-step task execution",
      "cost-efficient deployment",
    ],
    accessibility: {
      lowLatency: true,
      highConcurrency: true,
      costEfficient: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "tool_choice",
      "tools",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning-mode",
      "tool-calling",
      "code-optimisation",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "coding-assistance",
      "agentic-workflows",
      "cost-sensitive-applications",
      "high-throughput-scenarios",
      "developer-tools",
    ],
    warnings: [
      "Optimised for technical and coding tasks - may require additional context for general conversational use",
      "Free tier model - performance may vary during high-demand periods",
    ],
    ariaLabels: {
      modelSelect:
        "MiniMax M2 Free - Coding and agentic workflow model with 204,800 context window",
      parameterSection: "Parameter controls for MiniMax M2 Free model",
      statusMessages: {
        processing: "Processing coding request with MiniMax M2 Free",
        complete: "Code generation response ready from MiniMax M2 Free",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry for OpenAI gpt-oss-safeguard-20b
modelRegistry.registerModel("openai/gpt-oss-safeguard-20b", {
  provider: "openai",
  name: "GPT OSS Safeguard 20B",
  category: "Specialized",
  disabled: false,
  description:
    "A specialised safety reasoning model built upon GPT OSS 20B, designed for Trust & Safety workflows. This 21B-parameter Mixture-of-Experts model excels at content classification, policy enforcement, and safety labelling with custom policy interpretation capabilities. Optimised for lower latency in safety tasks whilst maintaining sophisticated reasoning for nuanced content decisions.",
  costs: {
    input: 0.075,
    output: 0.3,
  },
  capabilities: ["text", "dialogue", "reasoning", "tool_calling"],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription: "Purpose-built safety and content moderation model",
    releaseDate: "2025-10-29",
    modelArchitecture: {
      parameters: "21B",
      type: "safety-tuned-reasoning",
      architecture: "Mixture-of-Experts (MoE)",
      baseModel: "gpt-oss-20b",
      specialisation: "Trust & Safety workflows",
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy",
      acceptableUse: "https://openai.com/usage-policies",
      termsOfService: "https://openai.com/terms",
      lastUpdated: "2025-10-29",
    },
    domainExpertise: {
      safetyClassification: 10,
      contentModeration: 10,
      policyInterpretation: 9,
      trustAndSafety: 10,
      reasoning: 8,
    },
    bestFor: [
      "content moderation",
      "safety classification",
      "policy enforcement",
      "Trust & Safety workflows",
      "custom policy interpretation",
      "real-time content filtering",
    ],
    accessibility: {
      safetyFeatures: [
        "Custom policy adherence",
        "Explainable safety decisions",
        "Auditability support",
        "Contextual reasoning",
      ],
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "seed",
      "response_format",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning-channels",
      "policy-interpretation",
      "safety-classification",
      "custom-taxonomy-support",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "content-moderation",
      "safety-workflows",
      "policy-enforcement",
      "trust-and-safety-systems",
    ],
    warnings: [
      "Specialised for safety tasks - may not perform optimally for general conversation",
      "Requires well-structured policy prompts for optimal performance",
      "Best suited for Trust & Safety professionals with policy writing experience",
    ],
    ariaLabels: {
      modelSelect:
        "GPT OSS Safeguard 20B - Safety reasoning model with 131K context for Trust & Safety workflows",
      parameterSection:
        "Parameter controls for GPT OSS Safeguard 20B safety model",
      statusMessages: {
        processing:
          "Processing safety classification request with GPT OSS Safeguard 20B",
        complete: "Safety analysis complete from GPT OSS Safeguard 20B",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert in model-definitions.js under Vision Models section

modelRegistry.registerModel("nvidia/nemotron-nano-12b-v2-vl", {
  provider: "nvidia",
  name: "Nemotron Nano 12B 2 VL",
  category: "Vision",
  disabled: false,
  description:
    "Advanced 12-billion-parameter multimodal reasoning model optimised for video understanding and document intelligence. Features hybrid Transformer-Mamba architecture combining transformer-level accuracy with memory-efficient sequence modelling for enhanced throughput and reduced latency. Specialises in optical character recognition, chart reasoning, and multimodal comprehension with leading performance on OCRBench v2 and strong results across vision-language benchmarks.",
  costs: {
    input: 0.2,
    output: 0.6,
    image: 0.2,
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "reasoning",
    "mathematics",
    "multilingual",
    "tool_calling",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Multimodal reasoning model with advanced video and document understanding capabilities",
    releaseDate: "2024-10-28",
    modelArchitecture: {
      parameters: "12B",
      type: "instruction-tuned",
      architecture: "Hybrid Transformer-Mamba",
      specialFeatures: [
        "Efficient Video Sampling (EVS)",
        "Multi-image document processing",
        "Memory-efficient sequence modelling",
      ],
    },
    policyLinks: {
      privacyPolicy:
        "https://www.nvidia.com/en-us/about-nvidia/privacy-policy/",
      acceptableUse:
        "https://www.nvidia.com/en-us/about-nvidia/acceptable-use-policy/",
      termsOfService: "https://www.nvidia.com/en-us/about-nvidia/terms-of-use/",
      lastUpdated: "2024-10-28",
    },
    trainingData: {
      sources: ["NVIDIA-curated synthetic datasets"],
      optimisedFor: [
        "Optical character recognition",
        "Chart reasoning",
        "Multimodal comprehension",
      ],
      license: "NVIDIA Open License",
    },
    domainExpertise: {
      vision: 9,
      mathematics: 8,
      documentProcessing: 9,
      videoAnalysis: 8,
      reasoning: 8,
    },
    benchmarkResults: {
      "OCRBench v2": "Leading performance",
      "MMMU/MathVista/AI2D Average": "~74",
      "Video-MME": "Strong performance",
    },
    bestFor: [
      "Video understanding and analysis",
      "Document intelligence and OCR",
      "Chart and diagram reasoning",
      "Mathematical visual reasoning",
      "Multi-image document processing",
      "Long-form video analysis with cost efficiency",
    ],
    accessibility: {
      visualProcessing: "Excellent OCR and document accessibility support",
      videoDescription: "Advanced video content analysis capabilities",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "top_k",
      "seed",
      "min_p",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning-support",
      "video-processing",
      "document-intelligence",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "document-accessibility-analysis",
      "visual-content-description",
      "ocr-text-extraction",
      "chart-data-interpretation",
      "video-content-analysis",
    ],
    warnings: [
      "Video processing may require significant computational resources",
      "Image quality affects OCR accuracy - ensure high-resolution inputs for optimal results",
      "Complex mathematical notation may require careful formatting verification",
    ],
    ariaLabels: {
      modelSelect:
        "Nemotron Nano 12B 2 VL - Multimodal reasoning model with 131K context optimised for video and document analysis",
      parameterSection:
        "Parameter controls for Nemotron Nano 12B 2 VL multimodal model",
      statusMessages: {
        processing: "Processing multimodal request with Nemotron Nano 12B 2 VL",
        complete: "Multimodal analysis complete from Nemotron Nano 12B 2 VL",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this registration entry into model-definitions.js

modelRegistry.registerModel("mistralai/voxtral-small-24b-2507", {
  provider: "mistralai",
  name: "Voxtral Small 24B 2507",
  category: "Specialized",
  disabled: false,
  description:
    "Enhanced version of Mistral Small 3 with state-of-the-art audio input capabilities whilst retaining best-in-class text performance. Specialised for speech transcription, translation, and comprehensive audio understanding tasks.",
  costs: {
    input: 0.1, // Per million tokens
    output: 0.3, // Per million tokens
    audio: 100.0, // Per million seconds
  },
  capabilities: ["text", "dialogue", "audio", "multilingual", "tool_calling"],
  maxContext: 32000,
  fallbackTo: "mistralai/mistral-small",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal model with audio processing capabilities",
    releaseDate: "2025-10-30",
    modelArchitecture: {
      parameters: "24B",
      type: "instruction-tuned",
      audioSupport: true,
      baseModel: "Mistral Small 3",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy-policy/",
      acceptableUse: "https://mistral.ai/terms-of-use/",
      termsOfService: "https://mistral.ai/terms-of-use/",
      lastUpdated: "2025-10-30",
    },
    languageSupport: ["multilingual"],
    domainExpertise: {
      audioProcessing: 9,
      speechTranscription: 9,
      translation: 8,
      textGeneration: 8,
    },
    bestFor: [
      "speech transcription",
      "audio understanding",
      "multilingual translation",
      "audio-text integration",
      "voice assistant applications",
    ],
    accessibility: {
      audioAccessibility: true,
      speechProcessing: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "audio_processing",
      "structured_outputs",
      "tool_calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "audio-transcription",
      "voice-interfaces",
      "accessibility-applications",
      "multilingual-communication",
    ],
    warnings: [
      "Audio processing may require additional bandwidth considerations",
      "Audio input costs are significantly higher than text input",
    ],
    ariaLabels: {
      modelSelect:
        "Voxtral Small 24B 2507 - Audio-enhanced model with 32K context for speech and text processing",
      parameterSection: "Parameter controls for Voxtral Small 24B 2507",
      statusMessages: {
        processing:
          "Processing request with Voxtral Small 24B 2507 multimodal capabilities",
        complete: "Response ready from Voxtral Small 24B 2507",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry into model-definitions.js

modelRegistry.registerModel("perplexity/sonar-pro-search", {
  provider: "perplexity",
  name: "Sonar Pro Search",
  category: "Specialized",
  disabled: false,
  description:
    "Perplexity's most advanced agentic search system designed for deeper reasoning and analysis. Features autonomous, multi-step reasoning that plans and executes entire research workflows using tools. Exclusively optimised for comprehensive research tasks with web search integration and structured outputs.",
  costs: {
    input: 3.0, // Per million tokens
    output: 15.0, // Per million tokens
    requests: 18.0, // Per thousand requests
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "tool_calling",
    "web_search",
    "research",
    "multilingual",
    "structured_outputs",
  ],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription: "Advanced agentic search model for research workflows",
    releaseDate: "2025-10-30",
    modelArchitecture: {
      type: "agentic-search",
      searchCapabilities: "multi-step autonomous reasoning",
      toolIntegration: "advanced workflow execution",
    },
    policyLinks: {
      privacyPolicy: "https://perplexity.ai/privacy",
      acceptableUse: "https://perplexity.ai/terms",
      termsOfService: "https://perplexity.ai/terms",
      lastUpdated: "2025-10-30",
    },
    bestFor: [
      "research workflows",
      "in-depth analysis",
      "multi-step reasoning",
      "information synthesis",
      "academic research",
      "professional analysis",
      "web-based research",
      "structured information gathering",
    ],
    accessibility: {
      searchMode: "agentic",
      workflowSupport: true,
      structuredOutput: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "frequency_penalty",
      "presence_penalty",
      "web_search_options",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "agentic_search",
      "multi_step_reasoning",
      "web_search_integration",
      "structured_outputs",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "research-workflows",
      "academic-analysis",
      "professional-research",
      "in-depth-investigation",
      "multi-step-reasoning-tasks",
    ],
    warnings: [
      "Request-based pricing model requires careful usage monitoring",
      "Advanced agentic features may require additional time for complex workflows",
      "Web search results depend on current internet accessibility",
    ],
    ariaLabels: {
      modelSelect:
        "Sonar Pro Search - Advanced agentic search model with 200K context for research workflows",
      parameterSection:
        "Parameter controls for Sonar Pro Search agentic reasoning",
      statusMessages: {
        processing: "Processing agentic search workflow with Sonar Pro Search",
        complete: "Research workflow completed by Sonar Pro Search",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry into model-definitions.js

modelRegistry.registerModel("mistralai/codestral-embed-2505", {
  provider: "mistralai",
  name: "Codestral Embed 2505",
  category: "Code",
  disabled: false,
  description:
    "Specialised embedding model designed specifically for code, optimised for embedding code databases, repositories, and powering coding assistants with state-of-the-art retrieval capabilities.",
  costs: {
    input: 0.15, // Per million tokens
    output: 0.0, // Per million tokens
  },
  capabilities: ["text", "code"],
  maxContext: 8192,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription: "Code embedding and retrieval specialist",
    releaseDate: "2025-10-30",
    modelArchitecture: {
      parameters: "Unknown",
      type: "embedding-optimised",
      specialisation: "code-embedding",
      retrievalCapabilities: "state-of-the-art",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy",
      acceptableUse: "https://mistral.ai/terms",
      termsOfService: "https://mistral.ai/terms",
      lastUpdated: "2025-10-30",
    },
    bestFor: [
      "code database embedding",
      "repository indexing",
      "coding assistant retrieval",
      "semantic code search",
      "code similarity analysis",
    ],
    domainExpertise: {
      codeEmbedding: 10,
      retrieval: 9,
      semanticSearch: 9,
    },
    accessibility: {
      embeddingtSupport: "optimised for code representation",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "response_format",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: ["code-embedding", "retrieval-optimised", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "code-database-embedding",
      "repository-indexing",
      "semantic-code-search",
      "coding-assistant-backends",
    ],
    warnings: [
      "Embedding model - generates vector representations, not text responses",
      "Optimised for code retrieval rather than code generation",
    ],
    ariaLabels: {
      modelSelect:
        "Codestral Embed 2505 - Code embedding specialist with 8K context",
      parameterSection: "Parameter controls for Codestral Embed 2505",
      statusMessages: {
        processing: "Processing embedding request with Codestral Embed 2505",
        complete: "Code embedding ready from Codestral Embed 2505",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this registration entry to model-definitions.js:

modelRegistry.registerModel("amazon/nova-premier-v1", {
  provider: "amazon",
  name: "Nova Premier 1.0",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Amazon's most capable multimodal model optimised for complex reasoning tasks and serving as an excellent teacher for distilling custom models. Combines advanced reasoning capabilities with multimodal understanding for sophisticated problem-solving applications.",
  costs: {
    input: 2.5,
    output: 12.5,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "vision",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 1000000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription: "Premium multimodal reasoning model for complex tasks",
    releaseDate: "2025-10-31",
    modelArchitecture: {
      type: "multimodal-instruction-tuned",
      capabilities: "reasoning, vision, tool-calling",
    },
    policyLinks: {
      privacyPolicy: "https://aws.amazon.com/privacy/",
      acceptableUse: "",
      termsOfService: "https://aws.amazon.com/terms/",
      lastUpdated: "2025-10-31",
    },
    bestFor: [
      "complex reasoning tasks",
      "model distillation",
      "multimodal applications",
      "advanced problem-solving",
    ],
    domainExpertise: {
      reasoning: 9,
      multimodal: 8,
      teaching: 9,
    },
    accessibility: {
      screenReaderOptimised: true,
      highContrastSupport: true,
      keyboardNavigable: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "tools",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "complex-reasoning",
      "multimodal-processing",
      "tool-calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "multimodal-analysis",
      "model-distillation",
      "advanced-problem-solving",
    ],
    warnings: [
      "High output costs may impact accessibility for extended conversations",
      "Complex reasoning responses may require additional processing time",
    ],
    ariaLabels: {
      modelSelect:
        "Nova Premier 1.0 - Amazon's premium multimodal reasoning model with 1 million token context",
      parameterSection: "Parameter controls for Nova Premier 1.0",
      statusMessages: {
        processing:
          "Processing complex reasoning request with Nova Premier 1.0",
        complete: "Advanced reasoning response ready from Nova Premier 1.0",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.registerModel("moonshotai/kimi-k2-thinking", {
  provider: "moonshotai",
  name: "Kimi K2 Thinking",
  category: "Specialized",
  disabled: false,
  description:
    "Moonshot AI's most advanced open reasoning model featuring agentic, long-horizon reasoning capabilities. Built on a trillion-parameter Mixture-of-Experts architecture that activates 32 billion parameters per forward pass. Optimised for persistent step-by-step thought, dynamic tool invocation, and complex reasoning workflows spanning hundreds of turns. Excels at autonomous research, coding, and analytical tasks with stable multi-agent behaviour.",
  costs: {
    input: 0.6,
    output: 2.5,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "tool_calling",
    "code",
    "mathematics",
    "multilingual",
  ],
  maxContext: 262144,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription: "Advanced reasoning model with agentic capabilities",
    releaseDate: "2025-11-06",
    modelArchitecture: {
      parameters: "32B active (1T total MoE)",
      type: "mixture-of-experts",
      specialFeatures: [
        "MuonClip optimisation",
        "Agentic reasoning",
        "Long-horizon planning",
        "Multi-turn stability",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://moonshot.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://moonshot.ai/terms",
      lastUpdated: "2025-11-06",
    },
    trainingData: {
      benchmarks: ["HLE", "BrowseComp", "SWE-Multilingual", "LiveCodeBench"],
      capabilities: "200-300 tool calls without drift",
    },
    languageSupport: ["English", "Chinese", "Multilingual"],
    domainExpertise: {
      reasoning: 10,
      coding: 9,
      research: 9,
      analysis: 9,
      planning: 9,
      toolUse: 10,
    },
    bestFor: [
      "autonomous research",
      "complex reasoning workflows",
      "agentic tasks",
      "multi-turn analysis",
      "coding projects",
      "analytical writing",
      "tool-assisted problem solving",
    ],
    accessibility: {
      cognitiveLoad: "high",
      responseComplexity: "detailed",
      processingTime: "extended",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "tool_choice",
      "tools",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "agentic_reasoning",
      "tool_calling",
      "long_horizon_planning",
      "multi_turn_stability",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "reasoning-tasks",
      "research-assistance",
      "coding-projects",
      "complex-analysis",
      "multi-step-workflows",
      "tool-assisted-tasks",
    ],
    warnings: [
      "Extended response times due to complex reasoning processes",
      "High cognitive load - responses may be detailed and technical",
      "Tool calling may require additional setup and permissions",
      "Long-form outputs may need scrolling or pagination support",
    ],
    ariaLabels: {
      modelSelect:
        "Kimi K2 Thinking - Advanced reasoning model with 262K context and agentic capabilities",
      parameterSection:
        "Parameter controls for Kimi K2 Thinking reasoning model",
      statusMessages: {
        processing:
          "Processing complex reasoning request with Kimi K2 Thinking",
        complete: "Detailed reasoning response ready from Kimi K2 Thinking",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this entry to model-definitions.js
modelRegistry.registerModel("moonshotai/kimi-linear-48b-a3b-instruct", {
  provider: "moonshotai",
  name: "Kimi Linear 48B A3B Instruct",
  category: "LargeContext",
  disabled: false,
  description:
    "Advanced hybrid linear attention architecture optimised for long-context processing with Kimi Delta Attention (KDA). Delivers superior performance and hardware efficiency, reducing KV cache requirements by 75% and boosting decoding throughput by 6x for contexts up to 1M tokens. Specialised for extended document analysis and memory-efficient processing.",
  costs: {
    input: 0.3, // Per million tokens
    output: 0.6, // Per million tokens
  },
  capabilities: ["text", "dialogue", "reasoning", "multilingual"],
  maxContext: 1048576, // 1M+ context window
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar long-context capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Optimised for extended context processing and memory efficiency",
    releaseDate: "2025-11-08",
    modelArchitecture: {
      parameters: "48B",
      type: "instruction-tuned",
      attentionMechanism: "hybrid-linear",
      specialFeatures: [
        "Kimi Delta Attention (KDA)",
        "Finite-state RNN memory",
        "75% KV cache reduction",
        "6x decoding throughput improvement",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://moonshotai.com/privacy",
      acceptableUse: "",
      termsOfService: "https://moonshotai.com/terms",
      lastUpdated: "2025-11-08",
    },
    bestFor: [
      "long-context document analysis",
      "extended conversation processing",
      "memory-efficient inference",
      "large-scale text processing",
      "context-intensive reasoning tasks",
    ],
    domainExpertise: {
      longContextProcessing: 10,
      memoryEfficiency: 9,
      documentAnalysis: 8,
      conversationalAI: 7,
    },
    accessibility: {
      processingComplexity: "optimised-for-long-context",
      memoryRequirements: "reduced-kv-cache",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "frequency_penalty",
      "min_p",
      "presence_penalty",
      "repetition_penalty",
      "seed",
      "stop",
      "top_k",
      "logit_bias",
      "structured_outputs",
      "response_format",
      "logprobs",
      "top_logprobs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "hybrid_linear_attention",
      "kimi_delta_attention",
      "memory_optimisation",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "long-context-processing",
      "document-analysis",
      "extended-conversations",
      "memory-efficient-inference",
    ],
    warnings: [
      "Processing very long contexts may require additional time",
      "Hybrid architecture may behave differently than traditional attention models",
    ],
    ariaLabels: {
      modelSelect:
        "Kimi Linear 48B A3B Instruct - Long-context optimised model with 1M+ token context window",
      parameterSection: "Parameter controls for Kimi Linear 48B A3B Instruct",
      statusMessages: {
        processing:
          "Processing long-context request with Kimi Linear 48B A3B Instruct",
        complete:
          "Long-context response ready from Kimi Linear 48B A3B Instruct",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this GPT-5.1 Chat model registration
modelRegistry.registerModel("openai/gpt-5.1-chat", {
  provider: "openai",
  name: "GPT-5.1 Chat",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Fast, lightweight member of the GPT-5.1 family optimised for low-latency chat whilst retaining strong general intelligence. Features adaptive reasoning that selectively engages deeper thinking for complex queries, improving accuracy on mathematics, coding, and multi-step tasks without compromising conversational responsiveness. Designed for high-throughput, interactive workloads where consistency and speed are prioritised.",
  costs: {
    input: 1.25, // Per million tokens
    output: 10.0, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 128000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced general-purpose model optimised for interactive applications",
    releaseDate: "2025-11-13",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      specialFeatures: [
        "adaptive-reasoning",
        "low-latency-optimised",
        "structured-outputs",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy/",
      acceptableUse: "https://openai.com/policies/usage-policies/",
      termsOfService: "https://openai.com/terms/",
      lastUpdated: "2025-11-13",
    },
    trainingData: {
      cutoffDate: "2024-10",
      sources: ["web-crawl", "curated-datasets", "code-repositories"],
      specialisedDomains: ["mathematics", "coding", "reasoning-tasks"],
    },
    bestFor: [
      "interactive chat applications",
      "low-latency conversations",
      "mathematical problem solving",
      "code generation and debugging",
      "multi-step reasoning tasks",
      "high-throughput workloads",
    ],
    domainExpertise: {
      mathematics: 9,
      coding: 9,
      reasoning: 9,
      conversation: 10,
      responsiveness: 10,
    },
    accessibility: {
      responseLatency: "optimised",
      consistencyRating: "high",
    },
  },
  parameterSupport: {
    supported: [
      "structured_outputs",
      "response_format",
      "seed",
      "max_tokens",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "tool_choice",
      "tools",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "structured-outputs",
      "tool-calling",
      "adaptive-reasoning",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "interactive-applications",
      "real-time-conversations",
      "mathematical-problem-solving",
      "coding-assistance",
      "multi-step-reasoning",
    ],
    warnings: [
      "High output token costs may impact accessibility for extended conversations",
      "Adaptive reasoning may introduce slight latency variation for complex queries",
    ],
    ariaLabels: {
      modelSelect:
        "GPT-5.1 Chat - Fast conversational model with 128K context optimised for interactive applications",
      parameterSection: "Parameter controls for GPT-5.1 Chat model",
      statusMessages: {
        processing: "Processing request with GPT-5.1 Chat adaptive reasoning",
        complete: "Response ready from GPT-5.1 Chat",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry into model-definitions.js

modelRegistry.registerModel("openai/gpt-5.1", {
  provider: "openai",
  name: "GPT-5.1",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "OpenAI's latest frontier-grade model offering enhanced general-purpose reasoning, adaptive computation allocation, and improved instruction adherence. Features refined conversational alignment with clearer explanations, reduced jargon, and consistent performance gains across mathematical, coding, and structured analysis workloads. Optimised for both simple queries and complex multi-step problems with superior tool-use reliability.",
  costs: {
    input: 1.25, // Per million tokens
    output: 10.0, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "code",
    "mathematics",
    "tool_calling",
    "web_search",
    "structured_outputs",
  ],
  maxContext: 400000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced general-purpose reasoning with adaptive computation",
    releaseDate: "2025-11-13",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      adaptiveReasoning: true,
      structuredOutputs: true,
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy",
      acceptableUse: "https://openai.com/usage-policies",
      termsOfService: "https://openai.com/terms",
      lastUpdated: "2025-11-13",
    },
    bestFor: [
      "complex reasoning tasks",
      "mathematical problem solving",
      "coding assistance",
      "structured analysis",
      "long-form content generation",
      "tool-assisted workflows",
      "technical explanations",
    ],
    domainExpertise: {
      mathematics: 9,
      coding: 9,
      reasoning: 10,
      analysis: 9,
      conversation: 9,
    },
    accessibility: {
      reducedJargon: true,
      clearerExplanations: true,
      adaptiveComplexity: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "structured_outputs",
      "response_format",
      "seed",
      "max_tokens",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "logit_bias",
      "logprobs",
      "top_logprobs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "adaptive_reasoning",
      "structured_outputs",
      "tool_calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "technical-explanations",
      "step-by-step-reasoning",
      "adaptive-complexity-responses",
      "tool-assisted-workflows",
    ],
    warnings: [
      "High computational cost for complex reasoning tasks",
      "May provide extensive detail that could overwhelm users seeking brief answers",
    ],
    ariaLabels: {
      modelSelect:
        "GPT-5.1 - Advanced reasoning model with 400,000 token context",
      parameterSection: "Parameter controls for GPT-5.1 reasoning model",
      statusMessages: {
        processing: "Processing request with GPT-5.1 adaptive reasoning",
        complete: "Response ready from GPT-5.1 with structured analysis",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});

// xAI Grok 4.1 Fast - Free tier agentic tool calling model
modelRegistry.registerModel("x-ai/grok-4.1-fast", {
  provider: "xAI",
  name: "Grok 4.1 Fast",
  category: "FreeTier",
  disabled: false,
  description:
    "xAI's best agentic tool calling model optimised for real-world applications including customer support and deep research. Features a massive 2M context window with optional reasoning capabilities that can be enabled or disabled via API parameters.",
  costs: {
    input: 0.0, // Per million tokens
    output: 0.0, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "tool_calling",
    "reasoning",
    "multilingual",
  ],
  maxContext: 2000000, // 2M context window
  fallbackTo: "meta-llama/llama-3.3-70b-instruct", // Similar capability free alternative
  isFree: true,
  metadata: {
    categoryDescription: "Free tier model with advanced agentic capabilities",
    releaseDate: "2025-11-19",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      specialFeatures: [
        "agentic_reasoning",
        "tool_calling",
        "large_context",
        "configurable_reasoning",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://x.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://x.ai/terms",
      lastUpdated: "2025-11-19",
    },
    domainExpertise: {
      customerSupport: 9,
      research: 9,
      toolCalling: 10,
      reasoning: 9,
    },
    bestFor: [
      "customer support automation",
      "deep research tasks",
      "agentic workflows",
      "tool calling applications",
      "long document analysis",
      "multi-step reasoning",
    ],
    accessibility: {
      screenReaderOptimised: true,
      keyboardNavigation: true,
      highContrast: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "seed",
      "logprobs",
      "top_logprobs",
      "response_format",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "agentic_reasoning",
      "configurable_reasoning",
      "advanced_tool_calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "customer-support",
      "research-tasks",
      "tool-calling",
      "long-context-analysis",
      "agentic-workflows",
    ],
    warnings: [
      "Reasoning mode may increase response time significantly",
      "Large context window may impact processing speed for screen readers",
      "Tool calling responses may require additional navigation considerations",
    ],
    ariaLabels: {
      modelSelect:
        "Grok 4.1 Fast - Free agentic tool calling model with 2M context window",
      parameterSection:
        "Parameter controls for Grok 4.1 Fast including reasoning toggle",
      statusMessages: {
        processing: "Processing agentic request with Grok 4.1 Fast",
        complete: "Agentic response ready from Grok 4.1 Fast",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry for AllenAI Olmo 3 7B Think

modelRegistry.registerModel("allenai/olmo-3-7b-think", {
  provider: "allenai",
  name: "Olmo 3 7B Think",
  category: "Specialized",
  disabled: false,
  description:
    "Research-oriented language model in the Olmo family designed for advanced reasoning and instruction-driven tasks. Excels at multi-step problem solving, logical inference, and maintaining coherent conversational context. Developed by Ai2 under Apache 2.0 licence, supporting transparent experimentation and providing a capable foundation for academic research and practical NLP workflows.",
  costs: {
    input: 0.12,
    output: 0.2,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "mathematics",
    "tool_calling",
  ],
  maxContext: 65536,
  fallbackTo: "meta-llama/llama-3.1-8b-instruct",
  isFree: false,
  metadata: {
    categoryDescription:
      "Research-focused reasoning model with transparent open-source development",
    releaseDate: "2025-11-21",
    modelArchitecture: {
      parameters: "7B",
      type: "instruction-tuned",
      license: "Apache 2.0",
      openSource: true,
    },
    policyLinks: {
      privacyPolicy: "https://allenai.org/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://allenai.org/terms",
      lastUpdated: "2025-11-21",
    },
    bestFor: [
      "multi-step problem solving",
      "logical inference",
      "academic research",
      "advanced reasoning tasks",
      "NLP workflows",
    ],
    accessibility: {
      transparency: "Fully open-source under Apache 2.0",
      research: "Designed for transparent experimentation",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "frequency_penalty",
      "min_p",
      "presence_penalty",
      "repetition_penalty",
      "seed",
      "stop",
      "top_k",
      "logit_bias",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning",
      "structured_outputs",
      "open_source",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "academic-research",
      "reasoning-tasks",
      "problem-solving",
      "research-experimentation",
    ],
    warnings: [
      "Research model may require specific prompting techniques for optimal reasoning performance",
      "Open-source model may have different safety considerations compared to commercial models",
    ],
    ariaLabels: {
      modelSelect:
        "Olmo 3 7B Think - Research-oriented reasoning model with 65,536 token context",
      parameterSection:
        "Parameter controls for Olmo 3 7B Think reasoning model",
      statusMessages: {
        processing: "Processing request with Olmo 3 7B Think reasoning model",
        complete: "Response ready from Olmo 3 7B Think reasoning model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert in model-definitions.js under GeneralPurpose category

modelRegistry.registerModel("allenai/olmo-3-7b-instruct", {
  provider: "allenai",
  name: "Olmo 3 7B Instruct",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A supervised instruction-fine-tuned variant optimised for instruction-following, question-answering, and natural conversational dialogue. Developed by AI2 with an open training pipeline, it delivers strong performance across everyday NLP tasks whilst remaining accessible and easy to integrate. Built under Apache 2.0 licence for transparent, community-friendly applications.",
  costs: {
    input: 0.1, // Per million tokens
    output: 0.2, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 65536,
  fallbackTo: "meta-llama/llama-3.1-8b-instruct",
  isFree: false,
  metadata: {
    categoryDescription:
      "Versatile instruction-tuned model for everyday NLP tasks",
    releaseDate: "2025-11-21",
    modelArchitecture: {
      parameters: "7B",
      type: "instruction-tuned",
      license: "Apache 2.0",
      trainingApproach: "supervised instruction fine-tuning",
    },
    policyLinks: {
      privacyPolicy: "https://allenai.org/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://allenai.org/terms",
      lastUpdated: "2025-11-21",
    },
    trainingData: {
      sources: ["high-quality instruction datasets"],
      approach: "open training pipeline",
      transparency: "fully documented",
    },
    bestFor: [
      "instruction-following tasks",
      "question-answering systems",
      "conversational dialogue",
      "everyday NLP applications",
      "community-driven projects",
    ],
    domainExpertise: {
      instruction_following: 8,
      conversation: 7,
      general_knowledge: 7,
      accessibility: 8,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "frequency_penalty",
      "min_p",
      "presence_penalty",
      "repetition_penalty",
      "seed",
      "stop",
      "top_k",
      "logit_bias",
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "tool_calling",
      "structured_outputs",
      "instruction_following",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "instruction-following-tasks",
      "conversational-interfaces",
      "educational-applications",
      "community-projects",
    ],
    warnings: [
      "7B parameter model may have limitations with highly complex reasoning tasks",
      "Performance may vary on specialised domain knowledge outside training data",
    ],
    ariaLabels: {
      modelSelect:
        "Olmo 3 7B Instruct - Open-source instruction-tuned model with 65K context",
      parameterSection: "Parameter controls for Olmo 3 7B Instruct model",
      statusMessages: {
        processing: "Processing request with Olmo 3 7B Instruct",
        complete: "Response ready from Olmo 3 7B Instruct",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration entry to model-definitions.js

modelRegistry.registerModel("allenai/olmo-3-32b-think", {
  provider: "allenai",
  name: "Olmo 3 32B Think",
  category: "Specialized",
  disabled: false,
  description:
    "A specialised 32-billion-parameter model purpose-built for deep reasoning, complex logic chains, and advanced instruction-following scenarios. Developed by Ai2 under Apache 2.0 licence, offering full transparency across weights, code, and training methodology with strong performance on demanding evaluation tasks.",
  costs: {
    input: 0.2, // Per million tokens
    output: 0.35, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "mathematics",
    "multilingual",
    "tool_calling",
  ],
  maxContext: 65536,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct",
  isFree: false,
  metadata: {
    categoryDescription: "Advanced reasoning and logic-focused model",
    releaseDate: "2024-11-21",
    modelArchitecture: {
      parameters: "32B",
      type: "instruction-tuned",
      license: "Apache 2.0",
      specialization: "reasoning-optimised",
      transparency: "full-weights-and-training-data",
    },
    policyLinks: {
      privacyPolicy: "https://allenai.org/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://allenai.org/terms",
      lastUpdated: "2024-11-21",
    },
    trainingData: {
      transparency: "full",
      openSource: true,
      license: "Apache 2.0",
    },
    domainExpertise: {
      reasoning: 9,
      logic: 9,
      instruction_following: 8,
      conversation: 7,
      mathematics: 8,
    },
    bestFor: [
      "deep reasoning tasks",
      "complex logic chains",
      "advanced instruction following",
      "demanding evaluation tasks",
      "nuanced conversational reasoning",
      "transparent ai research",
    ],
    accessibility: {
      openSource: true,
      transparency: "full methodology available",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "frequency_penalty",
      "min_p",
      "presence_penalty",
      "repetition_penalty",
      "seed",
      "stop",
      "top_k",
      "logit_bias",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning-chains",
      "structured-outputs",
      "logic-analysis",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "academic-research",
      "complex-problem-solving",
      "logical-reasoning-tasks",
      "transparent-ai-applications",
    ],
    warnings: [
      "Optimised for reasoning tasks - may be slower for simple queries",
      "32B parameter size requires consideration for response time expectations",
    ],
    ariaLabels: {
      modelSelect:
        "Olmo 3 32B Think - Specialised reasoning model with 65,536 token context",
      parameterSection:
        "Parameter controls for Olmo 3 32B Think reasoning model",
      statusMessages: {
        processing: "Processing reasoning request with Olmo 3 32B Think",
        complete: "Reasoning response ready from Olmo 3 32B Think",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert Claude Opus 4.5 registration
modelRegistry.registerModel("anthropic/claude-opus-4.5", {
  provider: "anthropic",
  name: "Claude Opus 4.5",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Anthropic's frontier reasoning model optimised for complex software engineering, agentic workflows, and long-horizon computer use. Features strong multimodal capabilities, competitive performance across real-world coding and reasoning benchmarks, and improved robustness to prompt injection. Designed to operate efficiently across varied effort levels with configurable token efficiency controls.",
  costs: {
    input: 5.0, // Per million tokens
    output: 25.0, // Per million tokens
    image: 10.0, // Per thousand web searches/multimodal operations
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "reasoning",
    "tool_calling",
    "vision",
    "multilingual",
  ],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced frontier model for complex reasoning and software engineering tasks",
    releaseDate: "2025-11-24",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      specialFeatures: [
        "Verbosity control parameter",
        "Advanced tool use",
        "Extended context management",
        "Multi-agent coordination",
        "Prompt injection robustness",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://www.anthropic.com/privacy",
      acceptableUse: "https://www.anthropic.com/usage-policy",
      termsOfService: "https://www.anthropic.com/terms",
      lastUpdated: "2025-11-24",
    },
    domainExpertise: {
      softwareEngineering: 10,
      reasoning: 10,
      debugging: 9,
      planning: 9,
      autonomousResearch: 9,
      browserAutomation: 8,
    },
    bestFor: [
      "complex software engineering",
      "agentic workflows",
      "long-horizon computer use",
      "autonomous research",
      "debugging and troubleshooting",
      "multi-step planning",
      "browser and spreadsheet manipulation",
    ],
    accessibility: {
      tokenEfficiencyControl: true,
      structuredReasoning: true,
      reliableExecution: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "stop",
      "reasoning",
      "include_reasoning",
      "tool_choice",
      "tools",
      "structured_outputs",
      "response_format",
      "verbosity",
      "top_k",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "verbosity_control",
      "advanced_reasoning",
      "structured_outputs",
      "tool_calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "software-engineering",
      "complex-reasoning",
      "agentic-workflows",
      "computer-automation",
      "multi-step-planning",
    ],
    warnings: [
      "High token costs for output generation",
      "Advanced model requires careful prompt engineering for optimal results",
      "Verbosity parameter affects both response quality and token usage",
    ],
    ariaLabels: {
      modelSelect:
        "Claude Opus 4.5 - Frontier reasoning model with 200K context optimised for software engineering and agentic workflows",
      parameterSection:
        "Parameter controls for Claude Opus 4.5 including verbosity and reasoning options",
      statusMessages: {
        processing: "Processing complex reasoning request with Claude Opus 4.5",
        complete: "Advanced reasoning response ready from Claude Opus 4.5",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry:

modelRegistry.registerModel("tngtech/tng-r1t-chimera", {
  provider: "tng",
  name: "TNG R1T Chimera",
  category: "Specialized",
  disabled: false,
  description:
    "An experimental LLM specialised in creative storytelling and character interaction. This derivative of the original TNG/DeepSeek-R1T-Chimera features enhanced emotional intelligence, improved reasoning consistency, and superior tool calling capabilities. Designed for creative applications with a pleasant, engaging personality.",
  costs: {
    input: 0.3, // Per million tokens
    output: 1.2, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "creative_writing",
    "reasoning",
    "tool_calling",
  ],
  maxContext: 163840,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialised model optimised for creative storytelling and character interactions",
    releaseDate: "2025-11-26",
    modelArchitecture: {
      type: "instruction-tuned",
      baseModel: "DeepSeek-R1T-Chimera",
      specialisation: "creative_storytelling",
    },
    policyLinks: {
      privacyPolicy: "",
      acceptableUse: "https://huggingface.co/microsoft/MAI-DS-R1",
      termsOfService: "",
      lastUpdated: "2025-11-26",
    },
    domainExpertise: {
      creative_writing: 9,
      character_development: 9,
      emotional_intelligence: 8,
      reasoning: 7,
    },
    benchmarkScores: {
      eqBench3: 1305,
    },
    bestFor: [
      "creative storytelling",
      "character interaction",
      "dialogue systems",
      "creative writing",
      "narrative development",
    ],
    accessibility: {
      emotionalIntelligence:
        "High EQ-Bench3 score supports empathetic interactions",
      reasoningClarity: "Improved think-token consistency aids comprehension",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "repetition_penalty",
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning_consistency",
      "tool_calling",
      "creative_personality",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "creative-writing",
      "character-interaction",
      "dialogue-systems",
      "narrative-development",
    ],
    warnings: [
      "Experimental model may have unpredictable creative outputs",
      "Follow Microsoft MAI-DS-R1 guidelines for responsible usage",
      "Model may be slower than standard alternatives",
    ],
    ariaLabels: {
      modelSelect:
        "TNG R1T Chimera - Creative storytelling model with 163,840 token context",
      parameterSection: "Parameter controls for TNG R1T Chimera creative model",
      statusMessages: {
        processing: "Processing creative request with TNG R1T Chimera",
        complete: "Creative response ready from TNG R1T Chimera",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry:
modelRegistry.registerModel("prime-intellect/intellect-3", {
  provider: "prime_intellect",
  name: "INTELLECT-3",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A highly efficient 106B-parameter Mixture-of-Experts model (12B active) built from GLM-4.5-Air-Base with advanced reinforcement learning optimisation. Delivers state-of-the-art performance across mathematics, coding, scientific reasoning, and multi-step problem solving whilst maintaining efficient inference through its specialised MoE architecture.",
  costs: {
    input: 0.2, // Per million tokens
    output: 1.1, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "multilingual",
    "tool_calling",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced reasoning model optimised for complex problem-solving",
    releaseDate: "2025-11-27",
    modelArchitecture: {
      parameters: "106B",
      activeParameters: "12B",
      type: "mixture-of-experts",
      baseModel: "GLM-4.5-Air-Base",
      trainingMethods: ["supervised-fine-tuning", "reinforcement-learning"],
      architecture: "transformer-moe",
    },
    policyLinks: {
      privacyPolicy: "https://primeintellect.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://primeintellect.ai/terms",
      lastUpdated: "2025-11-27",
    },
    domainExpertise: {
      mathematics: 9,
      coding: 9,
      science: 8,
      reasoning: 9,
      problemSolving: 9,
    },
    bestFor: [
      "multi-step problem solving",
      "mathematical reasoning",
      "code generation and analysis",
      "scientific analysis",
      "structured task completion",
      "complex logical reasoning",
    ],
    accessibility: {
      reasoningTransparency: "Supports explicit reasoning traces",
      structuredOutputs: "Enhanced structured response formatting",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "tools",
      "tool_choice",
      "response_format",
      "structured_outputs",
      "min_p",
      "seed",
      "stop",
      "logit_bias",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning-traces",
      "structured-outputs",
      "tool-calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "mathematical-problem-solving",
      "code-analysis-and-generation",
      "scientific-reasoning",
      "multi-step-logical-tasks",
      "structured-data-processing",
    ],
    warnings: [
      "Complex reasoning tasks may require longer processing times",
      "Structured outputs may need careful validation for accessibility compliance",
    ],
    ariaLabels: {
      modelSelect:
        "INTELLECT-3 - Advanced reasoning model with 131,072 token context",
      parameterSection: "Parameter controls for INTELLECT-3 reasoning model",
      statusMessages: {
        processing: "Processing complex reasoning request with INTELLECT-3",
        complete: "Reasoning response ready from INTELLECT-3",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this registration entry for DeepSeek V3.2
modelRegistry.registerModel("deepseek/deepseek-v3.2", {
  provider: "deepseek",
  name: "DeepSeek V3.2",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Advanced large language model optimised for computational efficiency and reasoning performance. Features DeepSeek Sparse Attention (DSA) for cost-effective long-context processing and reinforcement learning post-training. Achieves GPT-5 class performance with gold-medal results on 2025 IMO and IOI competitions. Specialised for agentic tool-use workflows with controllable reasoning behaviour.",
  costs: {
    input: 0.28,
    output: 0.4,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "tool_calling",
    "mathematics",
    "code",
    "multilingual",
  ],
  maxContext: 163840,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "High-performance reasoning model with sparse attention optimisation",
    releaseDate: "2025-12-01",
    modelArchitecture: {
      parameters: "Large-scale",
      type: "instruction-tuned",
      specialFeatures: [
        "DeepSeek Sparse Attention (DSA)",
        "Reinforcement learning post-training",
        "Agentic task synthesis pipeline",
        "Controllable reasoning behaviour",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://www.deepseek.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.deepseek.com/terms",
      lastUpdated: "2025-12-01",
    },
    domainExpertise: {
      mathematics: 10,
      reasoning: 10,
      competitiveProgramming: 10,
      toolIntegration: 9,
      longContextAnalysis: 9,
    },
    bestFor: [
      "complex reasoning tasks",
      "mathematical problem solving",
      "agentic workflows",
      "tool-integrated applications",
      "competitive programming",
      "long-context analysis with efficiency",
    ],
    accessibility: {
      reasoningControl:
        "Boolean parameter for enabling/disabling reasoning mode",
      sparseAttention: "Optimised for efficient long-context processing",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "tool_choice",
      "tools",
      "response_format",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "logprobs",
      "top_logprobs",
      "seed",
      "top_k",
      "repetition_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning_control",
      "sparse_attention",
      "tool_integration",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "reasoning-tasks",
      "mathematical-problem-solving",
      "tool-integrated-workflows",
      "competitive-programming",
      "long-context-efficiency",
    ],
    warnings: [
      "High computational model may have longer response times",
      "Reasoning mode may significantly increase token usage",
      "Tool-calling features require careful prompt structure",
    ],
    ariaLabels: {
      modelSelect:
        "DeepSeek V3.2 - Advanced reasoning model with 163,840 context window and sparse attention optimisation",
      parameterSection:
        "Parameter controls for DeepSeek V3.2 including reasoning enablement",
      statusMessages: {
        processing:
          "Processing request with DeepSeek V3.2 reasoning capabilities",
        complete: "Response ready from DeepSeek V3.2 with reasoning analysis",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this registration entry for DeepSeek V3.2 Speciale
modelRegistry.registerModel("deepseek/deepseek-v3.2-speciale", {
  provider: "deepseek",
  name: "DeepSeek V3.2 Speciale",
  category: "Specialized",
  disabled: false,
  description:
    "High-compute variant of DeepSeek V3.2 optimised for maximum reasoning and agentic performance. Built on DeepSeek Sparse Attention (DSA) for efficient long-context processing with scaled post-training reinforcement learning. Delivers exceptional performance on complex reasoning workloads while maintaining strong coding and tool-use reliability through large-scale agentic task synthesis.",
  costs: {
    input: 0.28, // Per million tokens
    output: 0.4, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "code",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 163840, // Context window size
  fallbackTo: "deepseek/deepseek-v3", // Base model variant
  isFree: false,
  metadata: {
    categoryDescription:
      "High-compute reasoning-optimised model with advanced agentic capabilities",
    releaseDate: "2025-12-01",
    modelArchitecture: {
      parameters: "671B", // Based on DeepSeek V3 architecture
      type: "instruction-tuned",
      attentionMechanism: "DeepSeek Sparse Attention (DSA)",
      specialFeatures: [
        "scaled-post-training-rl",
        "agentic-task-synthesis",
        "long-context-processing",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://www.deepseek.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.deepseek.com/terms",
      lastUpdated: "2025-12-01",
    },
    trainingData: {
      cutoffDate: "2025-11",
      specializedFor: ["reasoning", "agentic-tasks", "tool-use"],
      postTraining: "scaled-reinforcement-learning",
    },
    languageSupport: [
      "english",
      "chinese",
      "spanish",
      "french",
      "german",
      "japanese",
      "korean",
      "russian",
    ],
    domainExpertise: {
      reasoning: 10,
      mathematics: 9,
      coding: 9,
      agenticTasks: 10,
      toolUse: 9,
      problemSolving: 10,
    },
    bestFor: [
      "complex reasoning tasks",
      "agentic workflows",
      "advanced problem solving",
      "tool integration",
      "long-context analysis",
      "research assistance",
    ],
    accessibility: {
      reasoning_assistance: "Optimised for complex logical reasoning support",
      long_context:
        "Efficient processing of extended documents and conversations",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "logprobs",
      "top_logprobs",
      "system-prompt", // Always add this with hyphen
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning_control",
      "include_reasoning",
      "advanced_sampling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "research-assistance",
      "agentic-workflows",
      "advanced-problem-solving",
    ],
    warnings: [
      "High-compute model may have longer response times for complex reasoning tasks",
      "Reasoning parameter controls may affect response structure and verbosity",
    ],
    ariaLabels: {
      modelSelect:
        "DeepSeek V3.2 Speciale - High-compute reasoning model with 163K context window",
      parameterSection:
        "Parameter controls for DeepSeek V3.2 Speciale reasoning model",
      statusMessages: {
        processing:
          "Processing complex reasoning request with DeepSeek V3.2 Speciale",
        complete:
          "Advanced reasoning response ready from DeepSeek V3.2 Speciale",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert the registration entry for Arcee AI Trinity Mini
modelRegistry.registerModel("arcee-ai/trinity-mini", {
  provider: "arcee_ai",
  name: "Trinity Mini",
  category: "LargeContext",
  disabled: false,
  description:
    "A highly optimised 26B-parameter sparse mixture-of-experts model with 3B active parameters. Features 128 experts with 8 active per token, engineered for efficient reasoning over extended contexts up to 131K tokens. Specialised for robust function calling and multi-step agent workflows with advanced reasoning capabilities.",
  costs: {
    input: 0.045,
    output: 0.15,
  },
  capabilities: ["text", "dialogue", "reasoning", "tool_calling", "code"],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Extended context model optimised for complex reasoning tasks",
    releaseDate: "2025-12-01",
    modelArchitecture: {
      parameters: "26B",
      activeParameters: "3B",
      type: "sparse-mixture-of-experts",
      experts: {
        total: 128,
        activePerToken: 8,
      },
      specialFeatures: [
        "Efficient long-context reasoning",
        "Robust function calling",
        "Multi-step agent workflows",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://arcee.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://arcee.ai/terms",
      lastUpdated: "2025-12-01",
    },
    bestFor: [
      "long-context reasoning",
      "function calling",
      "multi-step agents",
      "workflow automation",
      "complex reasoning tasks",
    ],
    domainExpertise: {
      reasoning: 9,
      agentWorkflows: 9,
      functionCalling: 9,
      longContext: 9,
    },
    accessibility: {
      complexityLevel: "advanced",
      recommendedFor: "experienced users requiring sophisticated reasoning",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "temperature",
      "max_tokens",
      "top_k",
      "top_p",
      "tool_choice",
      "tools",
      "structured_outputs",
      "response_format",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning-mode",
      "function-calling",
      "structured-outputs",
      "multi-step-workflows",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "agent-development",
      "function-calling-applications",
      "long-context-analysis",
    ],
    warnings: [
      "Mixture-of-experts architecture may have variable response patterns",
      "Advanced reasoning features require careful prompt engineering",
      "Large context window may impact response time for very long inputs",
    ],
    ariaLabels: {
      modelSelect:
        "Trinity Mini - Sparse mixture-of-experts model with 131K context for reasoning and agent workflows",
      parameterSection: "Parameter controls for Trinity Mini reasoning model",
      statusMessages: {
        processing: "Processing reasoning request with Trinity Mini",
        complete: "Reasoning response ready from Trinity Mini",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry in model-definitions.js

modelRegistry.registerModel("mistralai/mistral-large-2512", {
  provider: "mistralai",
  name: "Mistral Large 3 2512",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Mistral's most capable frontier model featuring a granular mixture-of-experts architecture with 41B active parameters and 675B total parameters. Delivers enterprise-grade multimodal capabilities across text and images, with reliable long-context performance up to 256K tokens. Optimised for document analysis, coding assistance, content creation, and agentic workflows under Apache 2.0 licence.",
  costs: {
    input: 0.5, // Per million tokens
    output: 1.5, // Per million tokens
    image: 0.5, // Image processing capability
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "code",
    "multilingual",
    "reasoning",
    "tool_calling",
  ],
  maxContext: 262144,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced frontier model with multimodal and enterprise capabilities",
    releaseDate: "2025-12-01",
    modelArchitecture: {
      parameters: "41B active (675B total)",
      type: "mixture-of-experts",
      architecture: "granular mixture-of-experts",
      licence: "Apache 2.0",
      activeParameters: "41B",
      totalParameters: "675B",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy/",
      acceptableUse: "https://mistral.ai/terms/",
      termsOfService: "https://mistral.ai/terms/",
      lastUpdated: "2025-12-01",
    },
    languageSupport: [
      "english",
      "french",
      "german",
      "spanish",
      "italian",
      "portuguese",
      "russian",
      "chinese",
      "japanese",
      "korean",
      "multilingual",
    ],
    domainExpertise: {
      enterprise: 9,
      coding: 8,
      analysis: 9,
      reasoning: 9,
      multimodal: 8,
    },
    bestFor: [
      "document analysis and summarisation",
      "enterprise AI assistants",
      "agentic workflows",
      "coding assistance",
      "content creation",
      "workflow automation",
      "long-context reasoning",
      "multimodal tasks",
    ],
    accessibility: {
      longContext: "Excellent for processing lengthy documents",
      multimodal: "Supports both text and image inputs",
      enterprise: "Designed for professional accessibility standards",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "structured_outputs",
      "tool_calling",
      "multimodal_processing",
      "long_context",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "enterprise-workflows",
      "long-document-analysis",
      "multimodal-reasoning",
      "coding-assistance",
      "content-creation",
      "agentic-automation",
    ],
    warnings: [
      "Large context window requires careful prompt structuring for optimal performance",
      "Multimodal capabilities may require additional processing time",
      "Enterprise features benefit from structured input formatting",
    ],
    ariaLabels: {
      modelSelect:
        "Mistral Large 3 2512 - Advanced frontier model with 262K context and multimodal capabilities",
      parameterSection: "Parameter controls for Mistral Large 3 2512",
      statusMessages: {
        processing:
          "Processing request with Mistral Large 3 2512 frontier model",
        complete: "Response ready from Mistral Large 3 2512",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry into model-definitions.js

modelRegistry.registerModel("amazon/nova-2-lite-v1", {
  provider: "amazon",
  name: "Nova 2 Lite",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A fast, cost-effective reasoning model optimised for everyday workloads. Processes text, images, and videos to generate text responses with standout capabilities in document processing, video information extraction, code generation, and multi-step agentic workflows.",
  costs: {
    input: 0.3, // Per million tokens
    output: 2.5, // Per million tokens
    image: 0.0, // Included in base pricing
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "code",
    "reasoning",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 1000000, // 1M context window
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar multimodal reasoning capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Versatile multimodal model for diverse reasoning tasks",
    releaseDate: "2025-12-02",
    modelArchitecture: {
      parameters: "Unknown",
      type: "multimodal-reasoning",
      supportsVideo: true,
      supportsImages: true,
      agenticWorkflows: true,
    },
    policyLinks: {
      privacyPolicy: "https://aws.amazon.com/privacy/",
      acceptableUse: "https://aws.amazon.com/aup/",
      termsOfService: "https://aws.amazon.com/service-terms/",
      lastUpdated: "2025-12-02",
    },
    languageSupport: ["english", "multilingual"],
    domainExpertise: {
      documentProcessing: 9,
      videoAnalysis: 8,
      codeGeneration: 7,
      reasoning: 8,
      multiStepWorkflows: 9,
    },
    bestFor: [
      "document processing",
      "video information extraction",
      "code generation",
      "multi-step workflows",
      "grounded question answering",
      "everyday reasoning tasks",
    ],
    accessibility: {
      visualContentDescriptions: true,
      multimodalProcessing: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "tool_choice",
      "tools",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning",
      "tool_calling",
      "multimodal_processing",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "document-analysis",
      "video-content-description",
      "code-generation-assistance",
      "multi-step-reasoning",
    ],
    warnings: [
      "Video processing may require additional processing time",
      "Large context window may affect response times",
      "Tool calling capabilities require careful prompt design for accessibility",
    ],
    ariaLabels: {
      modelSelect:
        "Nova 2 Lite - Amazon's multimodal reasoning model with 1M context",
      parameterSection: "Parameter controls for Nova 2 Lite multimodal model",
      statusMessages: {
        processing: "Processing multimodal request with Nova 2 Lite",
        complete: "Multimodal response ready from Nova 2 Lite",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// EssentialAI Rnj 1 Instruct - Programming and Scientific Reasoning Model
modelRegistry.registerModel("essentialai/rnj-1-instruct", {
  provider: "essentialai",
  name: "Rnj 1 Instruct",
  category: "Code",
  disabled: false,
  description:
    "An 8-billion parameter dense, open-weight model specialised for programming, mathematics, and scientific reasoning. Demonstrates strong performance across multiple programming languages, tool-use workflows, and agentic execution environments with optimised capabilities for complex technical tasks.",
  costs: {
    input: 0.15, // Per million tokens
    output: 0.15, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "tool_calling",
  ],
  maxContext: 32768,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct",
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialised model for programming and scientific reasoning tasks",
    releaseDate: "2025-12-07",
    modelArchitecture: {
      parameters: "8B",
      type: "instruction-tuned",
      architecture: "dense",
      weight: "open-weight",
      trainingFocus: ["programming", "mathematics", "scientific_reasoning"],
    },
    policyLinks: {
      privacyPolicy: "",
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2025-12-07",
    },
    domainExpertise: {
      programming: 9,
      mathematics: 9,
      scientific_reasoning: 9,
      tool_usage: 8,
      agentic_workflows: 8,
    },
    bestFor: [
      "programming tasks",
      "mathematical problem solving",
      "scientific reasoning",
      "tool-use workflows",
      "agentic execution environments",
      "multi-language programming",
    ],
    accessibility: {
      codeFormatting: "Supports structured code output for screen readers",
      mathematicalNotation: "Compatible with assistive mathematics tools",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "top_k",
      "repetition_penalty",
      "logit_bias",
      "min_p",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "structured_outputs",
      "tool_calling",
      "multi_language_programming",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "technical-documentation",
      "code-generation",
      "mathematical-analysis",
      "scientific-research",
      "automated-workflows",
    ],
    warnings: [
      "Complex technical outputs may require additional formatting for screen readers",
      "Mathematical expressions should be verified with assistive calculation tools",
    ],
    ariaLabels: {
      modelSelect:
        "Rnj 1 Instruct - Programming and scientific reasoning model with 32K context",
      parameterSection:
        "Parameter controls for Rnj 1 Instruct programming model",
      statusMessages: {
        processing: "Processing technical request with Rnj 1 Instruct",
        complete: "Technical response ready from Rnj 1 Instruct",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry into model-definitions.js

modelRegistry.registerModel("z-ai/glm-4.6v", {
  provider: "Z.AI",
  name: "GLM 4.6V",
  category: "Vision",
  disabled: false,
  description:
    "Large multimodal model optimised for high-fidelity visual understanding and long-context reasoning across images, documents, and mixed media. Processes complex page layouts and charts directly as visual inputs, supports native multimodal function calling, and enables interleaved image-text generation with UI reconstruction workflows including screenshot-to-HTML synthesis.",
  costs: {
    input: 0.3, // Per million tokens
    output: 0.9, // Per million tokens
    image: 0.3, // Image processing at input rate
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "tool_calling",
    "reasoning",
    "multilingual",
  ],
  maxContext: 131072,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal model for visual understanding and document analysis",
    releaseDate: "2025-12-08",
    modelArchitecture: {
      parameters: "Unknown",
      type: "multimodal-instruction-tuned",
      visualProcessing: "native",
      contextLength: "131K tokens",
    },
    policyLinks: {
      privacyPolicy: "https://z-ai.tech/privacy",
      acceptableUse: "",
      termsOfService: "https://z-ai.tech/terms",
      lastUpdated: "2025-12-08",
    },
    languageSupport: ["English", "Chinese", "Multiple languages"],
    domainExpertise: {
      visualUnderstanding: 9,
      documentAnalysis: 9,
      uiReconstruction: 8,
      chartProcessing: 8,
      mixedMediaAnalysis: 9,
    },
    bestFor: [
      "Visual document analysis",
      "Screenshot processing",
      "Chart and graph interpretation",
      "UI reconstruction workflows",
      "Mixed media understanding",
      "Long-context visual reasoning",
    ],
    accessibility: {
      requiresImageInput: true,
      visualContentDependent: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "top_k",
      "seed",
      "min_p",
      "response_format",
      "tools",
      "tool_choice",
      "structured_outputs",
      "logit_bias",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "multimodal_reasoning",
      "visual_processing",
      "tool_integration",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-document-analysis",
      "ui-reconstruction",
      "multimodal-workflows",
    ],
    warnings: [
      "Requires visual input for optimal performance - may not be suitable for users who cannot provide images",
      "Visual content interpretation may need alternative text descriptions for accessibility",
      "Screenshot analysis features may require additional context for users with visual impairments",
    ],
    ariaLabels: {
      modelSelect:
        "GLM 4.6V - Multimodal vision model with 131K context for visual understanding and document analysis",
      parameterSection: "Parameter controls for GLM 4.6V multimodal model",
      statusMessages: {
        processing: "Processing multimodal request with GLM 4.6V",
        complete: "Visual analysis response ready from GLM 4.6V",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry for Mistral Devstral 2 2512 (free)
modelRegistry.registerModel("mistralai/devstral-2512:free", {
  provider: "mistralai",
  name: "Devstral 2 2512 (free)",
  category: "FreeTier",
  disabled: false,
  description:
    "State-of-the-art open-source model by Mistral AI specialising in agentic coding. This 123B-parameter dense transformer excels at exploring codebases and orchestrating changes across multiple files whilst maintaining architecture-level context. Capable of tracking framework dependencies, detecting failures, and retrying with corrections for complex tasks like bug fixing and modernising legacy systems.",
  costs: {
    input: 0.0,
    output: 0.0,
  },
  capabilities: ["text", "dialogue", "code", "reasoning", "tool_calling"],
  maxContext: 262144,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct",
  isFree: true,
  metadata: {
    categoryDescription:
      "Free coding specialist with enterprise-grade capabilities",
    releaseDate: "2025-12-09",
    modelArchitecture: {
      parameters: "123B",
      type: "dense-transformer",
      contextWindow: "256K",
      specialisation: "agentic-coding",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy/",
      acceptableUse: "",
      termsOfService: "https://mistral.ai/terms/",
      lastUpdated: "2025-12-09",
      licenseType: "Modified MIT",
    },
    domainExpertise: {
      coding: 10,
      architecture: 9,
      debugging: 9,
      legacyModernisation: 8,
      enterpriseDevelopment: 9,
    },
    bestFor: [
      "codebase exploration",
      "multi-file orchestration",
      "bug fixing",
      "legacy system modernisation",
      "enterprise codebase optimisation",
      "architectural planning",
      "dependency management",
    ],
    accessibility: {
      codeReaderFriendly: true,
      structuredOutput: true,
      enterpriseAccessible: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "agentic_coding",
      "multi_file_orchestration",
      "dependency_tracking",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "enterprise-development",
      "codebase-modernisation",
      "architectural-planning",
      "dependency-management",
      "multi-file-coordination",
    ],
    warnings: [
      "Advanced coding model - may be complex for beginners",
      "Optimised for large-scale enterprise projects",
      "Requires structured prompting for best results",
    ],
    ariaLabels: {
      modelSelect:
        "Devstral 2 2512 (free) - Enterprise agentic coding model with 262K context",
      parameterSection: "Parameter controls for Devstral 2 2512 coding model",
      statusMessages: {
        processing: "Processing coding request with Devstral 2 2512",
        complete:
          "Code analysis and recommendations ready from Devstral 2 2512",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert the following model registration entry:

modelRegistry.registerModel("mistralai/devstral-2512", {
  provider: "mistralai",
  name: "Devstral 2 2512",
  category: "Code",
  disabled: false,
  description:
    "State-of-the-art open-source model specialising in agentic coding with 123B parameters. Optimised for exploring codebases and orchestrating changes across multiple files whilst maintaining architecture-level context. Excels at tracking framework dependencies, detecting failures, and implementing corrections for complex tasks like bug fixing and modernising legacy systems.",
  costs: {
    input: 0.15, // Per million tokens
    output: 0.6, // Per million tokens
  },
  capabilities: ["text", "dialogue", "code", "reasoning", "tool_calling"],
  maxContext: 262144,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Specialised coding model for enterprise-level development tasks",
    releaseDate: "2025-12-09",
    modelArchitecture: {
      parameters: "123B",
      type: "dense-transformer",
      contextWindow: "256K",
      license: "Modified MIT",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy-policy",
      acceptableUse: "https://mistral.ai/terms-of-use",
      termsOfService: "https://mistral.ai/terms-of-use",
      lastUpdated: "2025-12-09",
    },
    languageSupport: [
      "multiple-programming-languages",
      "framework-specific-syntax",
      "enterprise-codebases",
    ],
    domainExpertise: {
      programming: 10,
      codebaseAnalysis: 10,
      bugFixing: 9,
      legacySystemModernisation: 9,
      architecturalPlanning: 9,
    },
    bestFor: [
      "agentic coding tasks",
      "multi-file codebase exploration",
      "enterprise-level development",
      "bug fixing and debugging",
      "legacy system modernisation",
      "framework dependency management",
    ],
    accessibility: {
      codeNavigation: "Enhanced support for screen readers in code contexts",
      structuredOutputs:
        "Supports structured JSON responses for IDE integration",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "repetition_penalty",
      "response_format",
      "tools",
      "tool_choice",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "structured_outputs",
      "tool_calling",
      "agentic_coding",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "code-development",
      "debugging-assistance",
      "architectural-planning",
      "legacy-modernisation",
    ],
    warnings: [
      "Complex code suggestions may require careful review",
      "Large context responses may take longer to process with screen readers",
    ],
    ariaLabels: {
      modelSelect:
        "Devstral 2 2512 - Specialised coding model with 262K context window",
      parameterSection: "Parameter controls for Devstral 2 2512 coding model",
      statusMessages: {
        processing: "Processing coding request with Devstral 2 2512",
        complete: "Code response ready from Devstral 2 2512",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert GPT-5.2 registration
modelRegistry.registerModel("openai/gpt-5.2", {
  provider: "openai",
  name: "GPT-5.2",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Latest frontier-grade model in the GPT-5 series, offering enhanced agentic and long context performance with adaptive reasoning capabilities. Excels across mathematics, coding, science, and tool calling workloads with improved coherent long-form responses and reliable tool use.",
  costs: {
    input: 1.75,
    output: 14.0,
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 400000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced frontier model with adaptive reasoning and broad task coverage",
    releaseDate: "2025-12-10",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      features: [
        "adaptive_reasoning",
        "agentic_performance",
        "long_context_optimised",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy/",
      acceptableUse: "https://openai.com/policies/usage-policies/",
      termsOfService: "https://openai.com/terms/",
      lastUpdated: "2025-12-10",
    },
    bestFor: [
      "agentic workflows",
      "complex reasoning tasks",
      "long-form content generation",
      "advanced mathematics",
      "sophisticated coding projects",
      "scientific analysis",
      "tool integration workflows",
    ],
    domainExpertise: {
      mathematics: 9,
      coding: 9,
      reasoning: 10,
      science: 9,
      toolUse: 9,
    },
    accessibility: {
      costConsiderations:
        "Premium pricing model suitable for complex, high-value tasks",
      performanceNotes:
        "Adaptive reasoning may result in variable response times",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "adaptive_reasoning",
      "agentic_performance",
      "structured_outputs",
      "tool_calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "agentic-workflows",
      "complex-reasoning",
      "long-context-analysis",
      "advanced-mathematics",
      "scientific-research",
      "tool-integration",
    ],
    warnings: [
      "Premium pricing model with significantly higher costs than standard models",
      "Adaptive reasoning may result in variable response times",
      "Requires careful prompt engineering for optimal agentic behaviour",
    ],
    ariaLabels: {
      modelSelect:
        "GPT-5.2 - Advanced frontier model with 400K context and adaptive reasoning capabilities",
      parameterSection:
        "Parameter controls for GPT-5.2 including reasoning and tool options",
      statusMessages: {
        processing: "Processing request with GPT-5.2 using adaptive reasoning",
        complete: "Response ready from GPT-5.2",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this GPT-5.2 Pro model registration entry
modelRegistry.registerModel("openai/gpt-5.2-pro", {
  provider: "openai",
  name: "GPT-5.2 Pro",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "OpenAI's most advanced model offering significant improvements in agentic coding and long context performance. Optimised for complex tasks requiring step-by-step reasoning, instruction following, and accuracy in high-stakes use cases. Features enhanced prompt understanding, test-time routing capabilities, and substantial reductions in hallucination and sycophancy.",
  costs: {
    input: 21.0, // Per million tokens
    output: 168.0, // Per million tokens
    webSearch: 10.0, // Per thousand web searches
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "reasoning",
    "tool_calling",
    "multilingual",
    "web_search",
  ],
  maxContext: 400000,
  fallbackTo: "openai/gpt-4o",
  isFree: false,
  metadata: {
    categoryDescription:
      "Premier general-purpose model with advanced reasoning capabilities",
    releaseDate: "2025-12-10",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      features: [
        "test-time-routing",
        "advanced-prompt-understanding",
        "agentic-reasoning",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy",
      acceptableUse: "https://openai.com/usage-policies",
      termsOfService: "https://openai.com/terms",
      lastUpdated: "2025-12-10",
    },
    specialCapabilities: {
      webSearch: {
        enabled: true,
        costPer1K: 10.0,
        description: "Real-time web search integration",
      },
      testTimeRouting: {
        enabled: true,
        description: "Dynamic routing based on task complexity",
      },
    },
    bestFor: [
      "complex reasoning tasks",
      "agentic coding workflows",
      "high-stakes decision making",
      "long-form writing projects",
      "health-related analysis",
      "instruction-following applications",
    ],
    domainExpertise: {
      coding: 10,
      reasoning: 10,
      writing: 9,
      health: 8,
      mathematics: 9,
    },
    accessibility: {
      enhancedAccuracy: "Reduced hallucination for reliable information",
      complexityHandling: "Excellent for users requiring detailed explanations",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning-control",
      "structured-outputs",
      "tool-integration",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "high-accuracy-requirements",
      "complex-reasoning-tasks",
      "professional-coding-assistance",
      "detailed-explanations",
      "long-context-analysis",
    ],
    warnings: [
      "Premium pricing may limit accessibility for frequent use",
      "Web search feature incurs additional costs",
      "Extended context processing may result in longer response times",
    ],
    ariaLabels: {
      modelSelect:
        "GPT-5.2 Pro - OpenAI's most advanced model with 400,000 token context and enhanced reasoning capabilities",
      parameterSection:
        "Advanced parameter controls for GPT-5.2 Pro including reasoning and tool options",
      statusMessages: {
        processing:
          "Processing complex request with GPT-5.2 Pro's advanced reasoning capabilities",
        complete:
          "Detailed response ready from GPT-5.2 Pro with enhanced accuracy",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry into model-definitions.js

modelRegistry.registerModel("openai/gpt-5.2-chat", {
  provider: "OpenAI",
  name: "GPT-5.2 Chat",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Fast, lightweight member of the GPT-5.2 family, optimised for low-latency chat whilst retaining strong general intelligence. Features adaptive reasoning that selectively 'thinks' on harder queries, improving accuracy on mathematics, coding, and multi-step tasks without slowing typical conversations. Designed for high-throughput, interactive workloads where responsiveness and consistency matter more than deep deliberation.",
  costs: {
    input: 1.75, // Per million tokens
    output: 14, // Per million tokens
    webSearch: 10000, // Per million tokens ($10/K)
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "mathematics",
    "reasoning",
    "tool_calling",
  ],
  maxContext: 128000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Fast, conversational general intelligence optimised for interactive workloads",
    releaseDate: "2025-12-10",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      specialFeatures: ["adaptive-reasoning", "low-latency", "web-search"],
    },
    policyLinks: {
      privacyPolicy: "https://openai.com/privacy",
      acceptableUse: "https://openai.com/usage-policies",
      termsOfService: "https://openai.com/terms",
      lastUpdated: "2025-12-10",
    },
    bestFor: [
      "interactive chat conversations",
      "low-latency applications",
      "mathematics and coding tasks",
      "high-throughput workloads",
      "instruction following",
      "multi-step reasoning",
    ],
    domainExpertise: {
      mathematics: 8,
      coding: 8,
      conversation: 9,
      reasoning: 8,
      responsiveness: 10,
    },
    accessibility: {
      fastResponse: true,
      consistentOutput: true,
      conversationalTone: true,
    },
  },
  parameterSupport: {
    supported: [
      "seed",
      "max_tokens",
      "response_format",
      "structured_outputs",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "structured-outputs",
      "tool-calling",
      "web-search",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "fast-response-applications",
      "interactive-dialogue-systems",
      "real-time-assistance",
      "conversational-interfaces",
    ],
    warnings: [
      "High output costs may impact budget-sensitive applications",
      "Web search functionality incurs additional charges",
    ],
    ariaLabels: {
      modelSelect: "GPT-5.2 Chat - Fast conversational AI with 128K context",
      parameterSection: "Parameter controls for GPT-5.2 Chat",
      statusMessages: {
        processing: "Processing request with GPT-5.2 Chat",
        complete: "Response ready from GPT-5.2 Chat",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry into model-definitions.js

modelRegistry.registerModel("xiaomi/mimo-v2-flash:free", {
  provider: "xiaomi",
  name: "MiMo-V2-Flash (free)",
  category: "FreeTier",
  disabled: false,
  description:
    "Open-source Mixture-of-Experts foundation language model with 309B total parameters and 15B active parameters. Features hybrid attention architecture with hybrid-thinking toggle and 256K context window. Excels at reasoning, coding, and agent scenarios, ranking #1 amongst open-source models on SWE-bench Verified and Multilingual benchmarks.",
  costs: {
    input: 0.0,
    output: 0.0,
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "reasoning",
    "mathematics",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 262144,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct",
  isFree: true,
  metadata: {
    categoryDescription:
      "High-performance free tier model with advanced reasoning capabilities",
    releaseDate: "2024-12-14",
    modelArchitecture: {
      parameters: "309B total, 15B active",
      type: "mixture-of-experts",
      architecture: "hybrid attention",
      expertCount: "multiple",
      features: ["hybrid-thinking toggle", "256K context window"],
    },
    policyLinks: {
      privacyPolicy: "https://www.mi.com/global/policy",
      acceptableUse: "",
      termsOfService: "https://www.mi.com/global/service",
      lastUpdated: "2024-12-14",
    },
    languageSupport: ["English", "Chinese", "Multilingual"],
    domainExpertise: {
      coding: 10,
      reasoning: 10,
      agents: 9,
      mathematics: 8,
      multilingual: 8,
    },
    bestFor: [
      "software engineering tasks",
      "complex reasoning problems",
      "coding assistance",
      "agent development",
      "multilingual coding",
      "cost-effective high performance",
    ],
    accessibility: {
      screenReaderOptimised: true,
      highContrastSupport: true,
      keyboardNavigation: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "response_format",
      "tools",
      "tool_choice",
      "frequency_penalty",
      "presence_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning_toggle",
      "tool_calling",
      "hybrid_thinking",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "cost-conscious-developers",
      "educational-coding-tasks",
      "reasoning-heavy-workflows",
      "multilingual-development",
    ],
    warnings: [
      "Free tier model may have usage limitations or queue times during peak periods",
      "Performance may vary compared to premium alternatives for highly specialised tasks",
    ],
    ariaLabels: {
      modelSelect:
        "MiMo-V2-Flash free - High-performance open-source reasoning model with 256K context",
      parameterSection:
        "Parameter controls for MiMo-V2-Flash including reasoning and tool settings",
      statusMessages: {
        processing: "Processing request with MiMo-V2-Flash free model",
        complete: "Response ready from MiMo-V2-Flash free model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry into model-definitions.js

modelRegistry.registerModel("allenai/olmo-3.1-32b-think:free", {
  provider: "allenai",
  name: "Olmo 3.1 32B Think",
  category: "FreeTier",
  disabled: false,
  description:
    "A 32-billion-parameter model specialised in deep reasoning, complex multi-step logic, and advanced instruction following. Built on the Olmo 3 series with refined reasoning behaviour and strong performance across demanding evaluations and conversational tasks. Developed by Ai2 under Apache 2.0 licence with full transparency in model weights, code, and training methodology.",
  costs: {
    input: 0.0,
    output: 0.0,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "mathematics",
    "multilingual",
    "tool_calling",
    "code",
  ],
  maxContext: 65536,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct",
  isFree: true,
  metadata: {
    categoryDescription:
      "Free-tier model optimised for advanced reasoning tasks",
    releaseDate: "2025-12-16",
    modelArchitecture: {
      parameters: "32B",
      type: "instruction-tuned",
      licence: "Apache 2.0",
      reasoningOptimised: true,
    },
    policyLinks: {
      privacyPolicy: "https://allenai.org/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://allenai.org/terms",
      lastUpdated: "2025-12-16",
    },
    bestFor: [
      "deep reasoning",
      "complex multi-step logic",
      "advanced instruction following",
      "demanding evaluations",
      "conversational tasks",
    ],
    domainExpertise: {
      reasoning: 9,
      logic: 9,
      conversation: 8,
      instruction_following: 9,
    },
    accessibility: {
      openSource: true,
      transparentTraining: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "frequency_penalty",
      "min_p",
      "presence_penalty",
      "repetition_penalty",
      "seed",
      "stop",
      "top_k",
      "logit_bias",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning",
      "structured_outputs",
      "include_reasoning",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "complex-reasoning-tasks",
      "multi-step-problem-solving",
      "advanced-instruction-following",
      "conversational-ai",
    ],
    warnings: [
      "Free tier model may have usage limitations during peak times",
      "Reasoning processes may require additional processing time",
    ],
    ariaLabels: {
      modelSelect:
        "Olmo 3.1 32B Think - Free reasoning-optimised model with 65K context",
      parameterSection:
        "Parameter controls for Olmo 3.1 32B Think reasoning model",
      statusMessages: {
        processing: "Processing reasoning request with Olmo 3.1 32B Think",
        complete: "Reasoning response ready from Olmo 3.1 32B Think",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this entry to model-definitions.js

modelRegistry.registerModel("mistralai/mistral-small-creative", {
  provider: "mistralai",
  name: "Mistral Small Creative",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "An experimental small model specialised for creative writing, narrative generation, roleplay, and character-driven dialogue. Optimised for conversational agents and general-purpose instruction following with enhanced creative capabilities.",
  costs: {
    input: 0.1, // Per million tokens
    output: 0.3, // Per million tokens
  },
  capabilities: ["text", "dialogue", "tool_calling", "reasoning"],
  maxContext: 32768,
  fallbackTo: "mistralai/mistral-7b-instruct",
  isFree: false,
  metadata: {
    categoryDescription: "Versatile model with creative writing specialisation",
    releaseDate: "2025-12-16",
    modelArchitecture: {
      parameters: "22B",
      type: "instruction-tuned",
      specialisation: "creative-writing",
    },
    policyLinks: {
      privacyPolicy: "https://mistral.ai/privacy-policy/",
      acceptableUse: "https://mistral.ai/acceptable-use-policy/",
      termsOfService: "https://mistral.ai/terms-of-use/",
      lastUpdated: "2025-12-16",
    },
    bestFor: [
      "creative writing",
      "narrative generation",
      "roleplay scenarios",
      "character-driven dialogue",
      "conversational agents",
    ],
    domainExpertise: {
      creative_writing: 9,
      dialogue_generation: 8,
      general_conversation: 7,
      instruction_following: 7,
    },
    accessibility: {
      experimentalModel: true,
      creativeOptimisation: true,
    },
  },
  parameterSupport: {
    supported: ["tools", "tool_choice", "system-prompt"],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "creative_writing_optimised",
      "narrative_generation",
      "tool_integration",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "creative-writing",
      "narrative-generation",
      "roleplay-scenarios",
      "character-dialogue",
      "conversational-interfaces",
    ],
    warnings: [
      "Experimental model - performance may vary across different use cases",
      "Optimised for creative tasks - may require specific prompting for technical content",
    ],
    ariaLabels: {
      modelSelect:
        "Mistral Small Creative - Experimental creative writing model with 32,768 token context",
      parameterSection: "Parameter controls for Mistral Small Creative model",
      statusMessages: {
        processing: "Generating creative response with Mistral Small Creative",
        complete: "Creative response ready from Mistral Small Creative",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert the following registration entry for Z.AI GLM-4.7
modelRegistry.registerModel("z-ai/glm-4.7", {
  provider: "z-ai",
  name: "GLM 4.7",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Z.AI's latest flagship model featuring enhanced programming capabilities and stable multi-step reasoning. Demonstrates significant improvements in executing complex agent tasks, tool calling, and code generation with superior front-end aesthetics. Optimised for agentic coding, web UI generation, and high-quality dialogue with structured output support.",
  costs: {
    input: 0.44, // Per million tokens
    output: 1.74, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "reasoning",
    "tool_calling",
    "multilingual",
    "mathematics",
  ],
  maxContext: 202752,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced flagship model with comprehensive coding and reasoning capabilities",
    releaseDate: "2024-12-22",
    modelArchitecture: {
      parameters: "Unknown",
      type: "instruction-tuned",
      specialFeatures: [
        "thinking_modes",
        "context_caching",
        "structured_output",
        "streaming_responses",
      ],
    },
    policyLinks: {
      privacyPolicy: "",
      acceptableUse: "",
      termsOfService: "",
      lastUpdated: "2024-12-22",
    },
    domainExpertise: {
      coding: 9,
      reasoning: 8,
      agentTasks: 9,
      webDevelopment: 9,
      toolUsing: 8,
    },
    bestFor: [
      "agentic coding",
      "web UI generation",
      "complex problem collaboration",
      "multi-step reasoning tasks",
      "tool integration",
      "structured output generation",
      "professional presentation creation",
    ],
    accessibility: {
      contextWindow: "202K tokens supporting extended conversations",
      streamingSupport:
        "Real-time response streaming for better user experience",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "thinking_modes",
      "tool_calling",
      "structured_output",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "agentic-coding-tasks",
      "multi-step-reasoning",
      "web-ui-development",
      "complex-problem-solving",
    ],
    warnings: [
      "Large context window may require extended processing time",
      "Tool calling features require proper API key configuration",
      "Reasoning mode may impact response timing for accessibility tools",
    ],
    ariaLabels: {
      modelSelect:
        "GLM 4.7 - Advanced reasoning and coding model with 202K context window",
      parameterSection:
        "Parameter controls for GLM 4.7 including reasoning and tool options",
      statusMessages: {
        processing: "Processing request with GLM 4.7 reasoning capabilities",
        complete: "Response ready from GLM 4.7 with enhanced reasoning",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this model registration entry to model-definitions.js

modelRegistry.registerModel("minimax/minimax-m2.1", {
  provider: "MiniMax",
  name: "MiniMax M2.1",
  category: "Code",
  disabled: false,
  description:
    "A lightweight, state-of-the-art large language model optimised for coding, agentic workflows, and modern application development. With only 10 billion activated parameters, M2.1 delivers exceptional real-world capability whilst maintaining outstanding latency, scalability, and cost efficiency. Features leading multilingual coding performance and serves as a versatile agent 'brain' for IDEs and coding tools.",
  costs: {
    input: 0.3, // Per million tokens
    output: 1.2, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "code",
    "multilingual",
    "reasoning",
    "tool_calling",
  ],
  maxContext: 204800,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Cutting-edge coding model with agentic workflow optimisation",
    releaseDate: "2025-12-23",
    modelArchitecture: {
      parameters: "10B",
      type: "instruction-tuned",
      activatedParameters: "10B",
      specialFeatures: [
        "reasoning preservation",
        "agentic workflows",
        "multilingual coding",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://www.minimaxi.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.minimaxi.com/terms",
      lastUpdated: "2025-12-23",
    },
    languageSupport: [
      "multilingual coding languages",
      "major systems languages",
      "application development languages",
    ],
    domainExpertise: {
      coding: 9,
      agenticWorkflows: 9,
      multilingual: 8,
      applicationDevelopment: 9,
      reasoning: 8,
    },
    benchmarkScores: {
      "Multi-SWE-Bench": 49.4,
      "SWE-Bench Multilingual": 72.5,
    },
    bestFor: [
      "coding assistance",
      "agentic workflows",
      "modern application development",
      "IDE integration",
      "coding tool development",
      "multilingual programming",
      "general-purpose assistance",
    ],
    accessibility: {
      supportsReasoningPreservation: true,
      optimisedForLatency: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning",
      "include_reasoning",
      "tools",
      "tool_choice",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "coding-assistance",
      "agent-workflows",
      "multilingual-development",
      "ide-integration",
      "low-latency-applications",
    ],
    warnings: [
      "MiniMax highly recommends preserving reasoning between turns for optimal performance",
      "Use reasoning_details parameter to maintain reasoning quality across conversations",
      "Consider cost implications for high-frequency agentic workflows",
    ],
    ariaLabels: {
      modelSelect:
        "MiniMax M2.1 - Lightweight coding and agentic workflow model with 204,800 token context",
      parameterSection:
        "Parameter controls for MiniMax M2.1 including reasoning preservation",
      statusMessages: {
        processing: "Processing coding request with MiniMax M2.1",
        complete: "Coding response ready from MiniMax M2.1",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add ByteDance Seed 1.6 registration
modelRegistry.registerModel("bytedance-seed/seed-1.6", {
  provider: "bytedance-seed",
  name: "Seed 1.6",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "Advanced general-purpose model with multimodal capabilities and adaptive deep thinking. Features Adaptive Chain-of-Thought (AdaCoT) for optimised reasoning performance, supporting visual understanding, GUI interaction, and complex reasoning tasks with a 256K context window.",
  costs: {
    input: 0.25, // Per million tokens
    output: 2.0, // Per million tokens
    image: 0.25, // Assuming same as input for image processing
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "reasoning",
    "code",
    "multilingual",
    "tool_calling",
  ],
  maxContext: 262144,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal model with adaptive reasoning capabilities",
    releaseDate: "2025-12-23",
    modelArchitecture: {
      parameters: "23B", // Active parameters
      type: "mixture-of-experts",
      totalParameters: "230B",
      specialFeatures: [
        "Adaptive Chain-of-Thought (AdaCoT)",
        "Multimodal pre-training",
        "Long-context training",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://www.bytedance.com/privacy",
      acceptableUse: "",
      termsOfService: "https://www.bytedance.com/terms",
      lastUpdated: "2025-12-23",
    },
    trainingData: {
      stages: [
        "Text-only pre-training (web pages, books, papers, code)",
        "Multimodal mixed continual training (MMCT)",
        "Long-context continual training (LongCT) 32K→256K",
      ],
      contextExtension: "Progressive extension from 32K to 256K tokens",
    },
    languageSupport: ["English", "Chinese", "Multilingual"],
    domainExpertise: {
      reasoning: 9,
      multimodal: 9,
      programming: 8,
      visualUnderstanding: 9,
      adaptiveThinking: 10,
    },
    bestFor: [
      "adaptive reasoning tasks",
      "multimodal understanding",
      "GUI interaction",
      "visual analysis",
      "complex problem solving",
      "long-context processing",
    ],
    accessibility: {
      visualProcessing: "Supports image analysis with detailed descriptions",
      cognitiveLoad: "Adaptive thinking reduces unnecessary complexity",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "frequency_penalty",
      "max_tokens",
      "temperature",
      "top_p",
      "tool_choice",
      "tools",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "adaptive_reasoning",
      "multimodal_processing",
      "long_context",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-content-analysis",
      "adaptive-problem-solving",
      "gui-interaction-tasks",
      "complex-reasoning-workflows",
    ],
    warnings: [
      "High output costs may impact extended conversations",
      "Image processing capabilities require careful prompt design for accessibility",
      "Adaptive thinking features may need explanation for users with cognitive differences",
    ],
    ariaLabels: {
      modelSelect:
        "Seed 1.6 - Multimodal model with adaptive reasoning and 256K context",
      parameterSection:
        "Parameter controls for Seed 1.6 adaptive reasoning model",
      statusMessages: {
        processing: "Processing request with Seed 1.6 adaptive reasoning",
        complete: "Response ready from Seed 1.6 with reasoning analysis",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this into model-definitions.js

modelRegistry.registerModel("bytedance-seed/seed-1.6-flash", {
  provider: "bytedance-seed",
  name: "Seed 1.6 Flash",
  category: "Vision",
  disabled: false,
  description:
    "Ultra-fast multimodal deep thinking model by ByteDance Seed, supporting both text and visual understanding. Features competitive pricing and exceptional speed, particularly optimised for batch and cache prompts. Designed for rapid multimodal processing with comprehensive reasoning capabilities.",
  costs: {
    input: 0.075, // Per million tokens
    output: 0.3, // Per million tokens
    image: 0.075, // Vision processing supported
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "reasoning",
    "multimodal",
    "tool_calling",
  ],
  maxContext: 262144, // 256K context window
  fallbackTo: "anthropic/claude-3.5-sonnet", // Similar multimodal vision capabilities
  isFree: false,
  metadata: {
    categoryDescription:
      "Fast multimodal model optimised for visual understanding and reasoning",
    releaseDate: "2025-12-23",
    modelArchitecture: {
      type: "instruction-tuned",
      contextWindow: "262K",
      maxOutput: "16K tokens",
      optimisations: ["batch processing", "cache prompts"],
    },
    policyLinks: {
      privacyPolicy: "https://www.volcengine.com/docs/6348/68918",
      acceptableUse: "",
      termsOfService: "https://www.volcengine.com/docs/6348/68916",
      lastUpdated: "2025-12-23",
    },
    languageSupport: ["english", "chinese", "multilingual"],
    domainExpertise: {
      vision: 9,
      reasoning: 8,
      speed: 10,
      costEfficiency: 10,
      multimodal: 9,
    },
    bestFor: [
      "fast multimodal processing",
      "visual understanding tasks",
      "cost-effective AI solutions",
      "large document analysis",
      "reasoning with visual context",
    ],
    accessibility: {
      visualProcessing: "Supports image analysis and visual reasoning",
      largeContext: "Extended context window for comprehensive responses",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "frequency_penalty",
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "structured_outputs",
      "response_format",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "multimodal_reasoning",
      "visual_understanding",
      "tool_calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-content-analysis",
      "fast-multimodal-tasks",
      "cost-conscious-projects",
      "large-context-processing",
    ],
    warnings: [
      "Visual content processing may require additional context for screen reader users",
      "High-speed responses may require processing time indicators for cognitive accessibility",
    ],
    ariaLabels: {
      modelSelect:
        "Seed 1.6 Flash - Ultra-fast multimodal model with 262K context window",
      parameterSection: "Parameter controls for Seed 1.6 Flash model",
      statusMessages: {
        processing: "Processing multimodal request with Seed 1.6 Flash",
        complete: "Multimodal response ready from Seed 1.6 Flash",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this to model-definitions.js in the Vision Models section
modelRegistry.registerModel("bytedance-seed/seedream-4.5", {
  provider: "bytedance_seed",
  name: "ByteDance Seed: Seedream 4.5",
  category: "Vision",
  disabled: false,
  description:
    "Advanced image generation model from ByteDance with comprehensive improvements over Seedream 4.0. Excels in editing consistency, subject detail preservation, lighting and colour tone accuracy, portrait refinement, and small-text rendering. Features enhanced multi-image composition capabilities and superior visual aesthetics for professional creative work.",
  costs: {
    input: 0.0, // Per million tokens
    output: 9.581, // Per million tokens
    image: 0.04, // Per output image
  },
  capabilities: ["text", "vision", "multilingual", "dialogue"],
  maxContext: 4096,
  fallbackTo: "openai/dalle-3",
  isFree: false,
  metadata: {
    categoryDescription:
      "Professional image generation and editing with advanced typography capabilities",
    releaseDate: "2025-12-23",
    modelArchitecture: {
      type: "diffusion-based",
      specialisation: "image_generation",
      improvements:
        "Enhanced editing consistency, multi-image composition, text rendering",
    },
    policyLinks: {
      privacyPolicy: "https://www.bytedance.com/en/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://www.bytedance.com/en/terms-of-service",
      lastUpdated: "2025-12-23",
    },
    bestFor: [
      "professional image generation",
      "image editing and manipulation",
      "poster and typography design",
      "multi-image composition",
      "brand visual creation",
      "product photography enhancement",
      "marketing material design",
      "portrait refinement",
    ],
    domainExpertise: {
      imageGeneration: 9,
      typography: 8,
      portraitWork: 8,
      brandDesign: 9,
      imageEditing: 9,
      textRendering: 8,
    },
    languageSupport: [
      "English",
      "Chinese (Simplified)",
      "Chinese (Traditional)",
    ],
  },
  parameterSupport: {
    supported: [
      "frequency_penalty",
      "max_tokens",
      "temperature",
      "top_p",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "image_generation",
      "image_editing",
      "typography_control",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "professional-design-work",
      "marketing-content-creation",
      "brand-visual-development",
      "educational-material-design",
    ],
    warnings: [
      "Generated images require alt text for accessibility compliance",
      "Text in generated images must meet WCAG contrast requirements",
      "Complex visual compositions may need additional descriptive content",
      "Consider providing text-based alternatives for critical information in images",
    ],
    ariaLabels: {
      modelSelect:
        "Seedream 4.5 - Advanced image generation model with 4K context window",
      parameterSection: "Image generation controls for Seedream 4.5",
      statusMessages: {
        processing: "Generating image with Seedream 4.5",
        complete: "Image generated by Seedream 4.5 ready for review",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this entry to model-definitions.js

modelRegistry.registerModel("allenai/olmo-3.1-32b-instruct", {
  provider: "allenai",
  name: "Olmo 3.1 32B Instruct",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "A large-scale, 32-billion-parameter instruction-tuned language model optimised for high-performance conversational AI, multi-turn dialogue, and practical instruction following. Developed by AI2 under Apache 2.0 licence, this model demonstrates strong capabilities across reasoning and coding benchmarks whilst maintaining robust chat interactions and responsiveness to complex user directions.",
  costs: {
    input: 0.2, // Per million tokens
    output: 0.6, // Per million tokens
  },
  capabilities: ["text", "dialogue", "code", "reasoning", "tool_calling"],
  maxContext: 65536,
  fallbackTo: "meta-llama/llama-3.3-70b-instruct",
  isFree: false,
  metadata: {
    categoryDescription:
      "Versatile instruction-tuned model for conversational AI and reasoning tasks",
    releaseDate: "2026-01-06",
    modelArchitecture: {
      parameters: "32B",
      type: "instruction-tuned",
      licence: "Apache 2.0",
      openSource: true,
    },
    policyLinks: {
      privacyPolicy: "https://allenai.org/privacy",
      acceptableUse: "",
      termsOfService: "https://allenai.org/terms",
      lastUpdated: "2026-01-06",
    },
    bestFor: [
      "conversational ai",
      "multi-turn dialogue",
      "instruction following",
      "reasoning tasks",
      "coding assistance",
      "complex user directions",
    ],
    accessibility: {
      openSource: true,
      transparentDevelopment: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "repetition_penalty",
      "top_k",
      "seed",
      "min_p",
      "response_format",
      "tools",
      "tool_choice",
      "structured_outputs",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "instruction_following",
      "multi_turn_dialogue",
      "tool_calling",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "conversational-interfaces",
      "instruction-following-tasks",
      "multi-turn-dialogue",
      "reasoning-applications",
      "open-source-projects",
    ],
    warnings: [
      "Large model may require longer processing times for complex requests",
      "Tool calling capabilities require proper parameter configuration",
    ],
    ariaLabels: {
      modelSelect:
        "Olmo 3.1 32B Instruct - Instruction-tuned conversational AI with 65K context window",
      parameterSection: "Parameter controls for Olmo 3.1 32B Instruct",
      statusMessages: {
        processing: "Processing request with Olmo 3.1 32B Instruct",
        complete: "Response ready from Olmo 3.1 32B Instruct",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry:

modelRegistry.registerModel("allenai/molmo-2-8b:free", {
  provider: "allenai",
  name: "Molmo2 8B (free)",
  category: "FreeTier",
  disabled: false,
  description:
    "Open vision-language model from Allen Institute for AI, specialised for image, video, and multi-image understanding with grounding capabilities. Built on Qwen3-8B with SigLIP 2 vision backbone, excelling at short video analysis, counting, and captioning whilst remaining competitive on long-video tasks.",
  costs: {
    input: 0.0,
    output: 0.0,
    image: 0.0,
  },
  capabilities: ["text", "dialogue", "vision", "multilingual", "reasoning"],
  maxContext: 36864,
  fallbackTo: "anthropic/claude-3-haiku",
  isFree: true,
  metadata: {
    categoryDescription:
      "Free tier vision-language model optimised for video understanding",
    releaseDate: "2026-01-09",
    modelArchitecture: {
      parameters: "8B",
      type: "vision-language",
      baseModel: "Qwen3-8B",
      visionBackbone: "SigLIP 2",
      specialisation: "Video and image understanding with grounding",
    },
    policyLinks: {
      privacyPolicy: "https://allenai.org/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://allenai.org/terms",
      lastUpdated: "2026-01-09",
    },
    languageSupport: [
      "English",
      "Chinese",
      "Spanish",
      "French",
      "German",
      "Japanese",
      "Korean",
    ],
    domainExpertise: {
      videoAnalysis: 9,
      imageCaptioning: 9,
      objectCounting: 9,
      visualGrounding: 8,
      multimodalReasoning: 8,
    },
    bestFor: [
      "video understanding",
      "image captioning",
      "object counting",
      "visual grounding",
      "multi-image analysis",
      "short video processing",
    ],
    accessibility: {
      supportsAltText: true,
      visualDescriptions: true,
      videoTranscription: false,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "frequency_penalty",
      "min_p",
      "presence_penalty",
      "repetition_penalty",
      "seed",
      "stop",
      "top_k",
      "logit_bias",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "vision-language",
      "video-understanding",
      "grounding",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-content-analysis",
      "accessibility-descriptions",
      "video-comprehension",
      "image-understanding",
    ],
    warnings: [
      "Video processing may require additional time for complex scenes",
      "Ensure alternative text provided for vision-impaired users when using visual outputs",
    ],
    ariaLabels: {
      modelSelect:
        "Molmo2 8B free - Vision-language model with 36,864 token context",
      parameterSection: "Parameter controls for Molmo2 8B vision model",
      statusMessages: {
        processing: "Processing visual content with Molmo2 8B",
        complete: "Visual analysis ready from Molmo2 8B",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry for Z.AI GLM 4.7 Flash
modelRegistry.registerModel("z-ai/glm-4.7-flash", {
  provider: "z-ai",
  name: "GLM 4.7 Flash",
  category: "Code",
  disabled: false,
  description:
    "A 30B-class state-of-the-art model optimised for agentic coding use cases. Features strengthened coding capabilities, long-horizon task planning, and tool collaboration with leading performance amongst open-source models of similar size.",
  costs: {
    input: 0.07, // Per million tokens
    output: 0.4, // Per million tokens
  },
  capabilities: ["text", "dialogue", "code", "reasoning", "tool_calling"],
  maxContext: 200000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced coding-focused model with agentic capabilities",
    releaseDate: "2026-01-19",
    modelArchitecture: {
      parameters: "30B",
      type: "instruction-tuned",
      optimisation: "agentic coding workflows",
      specialFeatures: ["long-horizon task planning", "tool collaboration"],
    },
    policyLinks: {
      privacyPolicy: "https://novita.ai/legal/privacy-policy",
      acceptableUse: "",
      termsOfService: "https://chat.z.ai/legal-agreement/terms-of-service",
      lastUpdated: "2026-01-19",
    },
    bestFor: [
      "agentic coding workflows",
      "long-horizon task planning",
      "tool collaboration",
      "complex software development",
      "automated programming tasks",
    ],
    domainExpertise: {
      coding: 9,
      taskPlanning: 8,
      toolIntegration: 9,
      reasoning: 8,
    },
    accessibility: {
      codeGeneration: "Optimised for readable, well-structured code output",
      taskBreakdown: "Excels at breaking complex tasks into manageable steps",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "tools",
      "tool_choice",
      "response_format",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "repetition_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning_support",
      "tool_integration",
      "agentic_workflows",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "agentic-coding",
      "task-planning",
      "tool-collaboration",
      "software-development",
      "automated-programming",
    ],
    warnings: [
      "Specialised for coding workflows - may be less suitable for general conversation",
      "Tool calling capabilities require careful prompt engineering for accessibility compliance",
    ],
    ariaLabels: {
      modelSelect:
        "GLM 4.7 Flash - Agentic coding model with 200K context window",
      parameterSection: "Parameter controls for GLM 4.7 Flash coding model",
      statusMessages: {
        processing: "Processing coding request with GLM 4.7 Flash",
        complete: "Coding response ready from GLM 4.7 Flash",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this entry to the model registry
modelRegistry.registerModel("liquid/lfm-2.5-1.2b-instruct:free", {
  provider: "liquid",
  name: "LFM2.5-1.2B-Instruct (free)",
  category: "FreeTier",
  disabled: false,
  description:
    "A compact, high-performance instruction-tuned model optimised for fast on-device AI deployment. Delivers strong chat quality despite its efficient 1.2B parameter footprint, with specialised edge inference capabilities and broad runtime support for resource-constrained environments.",
  costs: {
    input: 0.0,
    output: 0.0,
  },
  capabilities: ["text", "dialogue"],
  maxContext: 32768,
  fallbackTo: "meta-llama/llama-3.2-1b-instruct",
  isFree: true,
  metadata: {
    categoryDescription: "Free tier model optimised for lightweight deployment",
    releaseDate: "2026-01-20",
    modelArchitecture: {
      parameters: "1.2B",
      type: "instruction-tuned",
      optimisedFor: "edge-inference",
      deployment: "on-device",
    },
    policyLinks: {
      privacyPolicy: "https://liquid.ai/privacy",
      acceptableUse: "",
      termsOfService: "https://liquid.ai/terms",
      lastUpdated: "2026-01-20",
    },
    bestFor: [
      "edge deployment",
      "on-device inference",
      "lightweight chat applications",
      "resource-constrained environments",
      "mobile applications",
    ],
    accessibility: {
      lowResourceUsage: true,
      fastInference: true,
      batteryEfficient: true,
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: ["lightweight-deployment", "edge-optimised", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "mobile-applications",
      "edge-computing",
      "battery-sensitive-devices",
      "bandwidth-limited-environments",
    ],
    warnings: [
      "Limited capability due to compact size - may not perform as well on complex reasoning tasks",
      "Best suited for straightforward dialogue and basic text processing",
    ],
    ariaLabels: {
      modelSelect:
        "LFM2.5-1.2B-Instruct free model - Compact chat model with 32K context optimised for edge deployment",
      parameterSection: "Parameter controls for LFM2.5-1.2B-Instruct model",
      statusMessages: {
        processing:
          "Processing request with LFM2.5-1.2B-Instruct edge-optimised model",
        complete: "Response ready from LFM2.5-1.2B-Instruct model",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this entry to model-definitions.js

modelRegistry.registerModel("liquid/lfm-2.5-1.2b-thinking:free", {
  provider: "liquid",
  name: "LFM2.5-1.2B-Thinking (free)",
  category: "FreeTier",
  disabled: false,
  description:
    "Lightweight reasoning-focused model optimised for agentic tasks, data extraction, and RAG applications. Designed to deliver high-quality thinking responses whilst running efficiently on edge devices with support for long context processing.",
  costs: {
    input: 0.0,
    output: 0.0,
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 32768,
  fallbackTo: "anthropic/claude-3.5-haiku",
  isFree: true,
  metadata: {
    categoryDescription: "High-quality reasoning model available at no cost",
    releaseDate: "2026-01-20",
    modelArchitecture: {
      parameters: "1.2B",
      type: "instruction-tuned",
      specialisation: "reasoning-optimised",
      edgeCompatible: true,
    },
    policyLinks: {
      privacyPolicy: "https://liquidai.com/privacy",
      acceptableUse: "",
      termsOfService: "https://liquidai.com/terms",
      lastUpdated: "2026-01-20",
    },
    bestFor: [
      "agentic task processing",
      "data extraction workflows",
      "retrieval-augmented generation",
      "edge device deployment",
      "reasoning-intensive applications",
    ],
    domainExpertise: {
      reasoning: 8,
      dataExtraction: 9,
      agenticTasks: 9,
      edgeDeployment: 10,
      efficiency: 9,
    },
    accessibility: {
      cognitiveLoad: "low",
      processingSpeed: "fast",
      resourceRequirements: "minimal",
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "temperature",
      "top_p",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "seed",
      "top_k",
      "min_p",
      "repetition_penalty",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning-focused",
      "edge-optimised",
      "agentic-tasks",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "cost-conscious-development",
      "edge-computing-applications",
      "reasoning-tasks",
      "data-processing-workflows",
    ],
    warnings: [
      "Smaller model may have limitations with highly complex reasoning tasks",
      "Performance may vary on resource-constrained edge devices",
    ],
    ariaLabels: {
      modelSelect:
        "LFM2.5-1.2B-Thinking - Free lightweight reasoning model with 32K context",
      parameterSection: "Parameter controls for LFM2.5-1.2B-Thinking model",
      statusMessages: {
        processing: "Processing reasoning request with LFM2.5-1.2B-Thinking",
        complete: "Reasoning response ready from LFM2.5-1.2B-Thinking",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Insert this model registration entry for Writer Palmyra X5
modelRegistry.registerModel("writer/palmyra-x5", {
  provider: "writer",
  name: "Palmyra X5",
  category: "LargeContext",
  disabled: false,
  description:
    "Writer's most advanced model, purpose-built for building and scaling AI agents across the enterprise. Delivers industry-leading speed and efficiency with context windows up to 1 million tokens, powered by a novel transformer architecture and hybrid attention mechanisms. Optimised for processing large volumes of enterprise data and scaling AI agent workflows.",
  costs: {
    input: 0.6, // Per million tokens
    output: 6.0, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "reasoning",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 1040000,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Ultra-large context model specialised for enterprise AI agent deployment",
    releaseDate: "2026-01-21",
    modelArchitecture: {
      parameters: "Unknown",
      type: "hybrid-attention-transformer",
      specialFeatures: [
        "Novel transformer architecture",
        "Hybrid attention mechanisms",
        "Optimised inference speed",
        "Enterprise-scale processing",
      ],
    },
    policyLinks: {
      privacyPolicy: "https://writer.com/privacy-policy/",
      acceptableUse: "https://writer.com/acceptable-use-policy/",
      termsOfService: "https://writer.com/terms/",
      lastUpdated: "2026-01-21",
    },
    domainExpertise: {
      enterprise: 10,
      workflowAutomation: 9,
      documentProcessing: 9,
      agentDevelopment: 10,
      dataAnalysis: 8,
    },
    bestFor: [
      "enterprise AI agent development",
      "large document processing",
      "complex workflow automation",
      "enterprise data analysis",
      "multi-step reasoning tasks",
    ],
    accessibility: {
      enterpriseCompliance: "WCAG 2.2 AA compliant interface",
      largeContextSupport: "Optimised for extended document processing",
    },
  },
  parameterSupport: {
    supported: [
      "max_tokens",
      "temperature",
      "top_p",
      "top_k",
      "stop",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: ["enterprise-optimised", "hybrid-attention", "system-prompt"],
  },
  accessibility: {
    preferredFor: [
      "enterprise-workflows",
      "large-document-analysis",
      "ai-agent-development",
      "complex-reasoning-tasks",
    ],
    warnings: [
      "Higher output costs due to enterprise-grade capabilities",
      "Requires careful prompt engineering for optimal agent performance",
    ],
    ariaLabels: {
      modelSelect:
        "Palmyra X5 - Enterprise AI agent model with 1.04 million token context",
      parameterSection: "Parameter controls for Palmyra X5 enterprise model",
      statusMessages: {
        processing: "Processing enterprise request with Palmyra X5",
        complete: "Enterprise response ready from Palmyra X5",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
// Add this entry to model-definitions.js - MoonshotAI Kimi K2.5
modelRegistry.registerModel("moonshotai/kimi-k2.5", {
  provider: "moonshotai",
  name: "Kimi K2.5",
  category: "GeneralPurpose",
  disabled: false,
  description:
    "MoonshotAI's native multimodal model delivering state-of-the-art visual coding capability and self-directed agent swarm paradigm. Built on Kimi K2 with continued pretraining over approximately 15T mixed visual and text tokens, optimised for general reasoning, visual coding, and agentic tool-calling.",
  costs: {
    input: 0.6, // Per million tokens
    output: 3.0, // Per million tokens
  },
  capabilities: [
    "text",
    "dialogue",
    "vision",
    "code",
    "reasoning",
    "tool_calling",
    "multilingual",
  ],
  maxContext: 262144,
  fallbackTo: "anthropic/claude-3.5-sonnet",
  isFree: false,
  metadata: {
    categoryDescription:
      "Advanced multimodal model with visual coding and agentic capabilities",
    releaseDate: "2026-01-27",
    modelArchitecture: {
      parameters: "Unknown",
      type: "multimodal-instruction-tuned",
      baseModel: "Kimi K2",
      trainingTokens: "15T mixed visual and text tokens",
    },
    policyLinks: {
      privacyPolicy: "https://www.moonshot.cn/privacy",
      acceptableUse: "",
      termsOfService: "https://www.moonshot.cn/terms",
      lastUpdated: "2026-01-27",
    },
    trainingData: {
      sources: "Mixed visual and text tokens",
      size: "15T tokens",
      cutoffDate: "2026-01-01",
    },
    languageSupport: ["English", "Chinese", "Japanese", "Korean"],
    domainExpertise: {
      visualCoding: 9,
      agenticWorkflows: 9,
      generalReasoning: 8,
      multimodalProcessing: 9,
      toolCalling: 9,
    },
    bestFor: [
      "visual coding tasks",
      "agentic workflows",
      "multimodal reasoning",
      "tool-calling applications",
      "agent swarm coordination",
    ],
    accessibility: {
      visionSupport: true,
      multimodalInterface: true,
      structuredOutputs: true,
    },
  },
  parameterSupport: {
    supported: [
      "reasoning",
      "include_reasoning",
      "max_tokens",
      "stop",
      "frequency_penalty",
      "presence_penalty",
      "structured_outputs",
      "response_format",
      "tool_choice",
      "tools",
      "system-prompt",
    ],
    statistics: {
      frequency_penalty: { p10: 0, p50: 0, p90: 0 },
      min_p: { p10: 0, p50: 0, p90: 0 },
      presence_penalty: { p10: 0, p50: 0, p90: 0 },
      repetition_penalty: { p10: 1, p50: 1, p90: 1 },
      temperature: { p10: 0.1, p50: 0.7, p90: 1.1 },
      top_k: { p10: 0, p50: 0, p90: 0 },
      top_p: { p10: 0.9, p50: 1, p90: 1 },
    },
    features: [
      "reasoning-support",
      "structured-outputs",
      "tool-calling",
      "multimodal",
      "system-prompt",
    ],
  },
  accessibility: {
    preferredFor: [
      "visual-coding-tasks",
      "multimodal-analysis",
      "agent-coordination",
      "structured-outputs",
    ],
    warnings: [
      "High output costs may require careful token management",
      "Advanced features may need familiarisation for optimal use",
      "Multimodal processing may require specific input formatting",
    ],
    ariaLabels: {
      modelSelect:
        "Kimi K2.5 - Multimodal model with visual coding and agent capabilities, 262K context",
      parameterSection: "Parameter controls for Kimi K2.5 multimodal model",
      statusMessages: {
        processing: "Processing multimodal request with Kimi K2.5",
        complete: "Multimodal response ready from Kimi K2.5",
      },
    },
  },
  status: {
    isAvailable: true,
    lastCheck: new Date().toISOString(),
    errorCode: null,
    errorMessage: null,
  },
});
modelRegistry.validateAllFallbacks();
export { modelRegistry };
window.modelRegistry = modelRegistry;
