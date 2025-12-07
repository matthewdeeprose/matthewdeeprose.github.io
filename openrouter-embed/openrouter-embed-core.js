/**
 * OpenRouter Embed API - Core Foundation (Stage 6)
 *
 * Lightweight embed API for integrating OpenRouter AI into applications
 * without UI dependencies. Includes streaming, file handling, progress
 * indicators, and retry with exponential backoff.
 *
 * @version 6.0.0 (Stage 6 Phase 1 - Retry Integration)
 * @requires window.openRouterClient
 * @requires window.MarkdownEditor
 * @requires window.notifySuccess, window.notifyError, etc.
 * @requires window.EmbedRetryHandler (optional - for retry support)
 */

// ============================================================================
// LOGGING CONFIGURATION
// ============================================================================

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error(`[OpenRouterEmbed] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[OpenRouterEmbed] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[OpenRouterEmbed] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[OpenRouterEmbed] ${message}`, ...args);
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  model: "anthropic/claude-haiku-4.5",
  systemPrompt: null,
  temperature: 0.7,
  max_tokens: 2000,
  top_p: 1.0,
  showNotifications: true,
  enableLogging: true,
  logLevel: "WARN",
  // Phase 3: Request Control & Accessibility
  respectReducedMotion: true, // Auto-fallback to non-streaming when reduced motion preferred
  allowCancellation: true, // Enable request cancellation support
  // Stage 6 Phase 1: Retry with Exponential Backoff
  retry: {
    enabled: false, // Disabled by default - opt-in for reliability
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    retryableErrors: [
      "ETIMEDOUT",
      "ECONNRESET",
      "ECONNREFUSED",
      "NETWORK_ERROR",
    ],
    onRetry: null, // Callback: (attempt, delay, error) => void
  },
  // Stage 6 Phase 4: Request Debouncing/Throttling
  throttle: {
    debounceDelay: 0, // Debounce delay in ms (0 = disabled)
    throttleInterval: 0, // Min time between requests in ms (0 = disabled)
    maxConcurrent: 1, // Max concurrent requests
    onThrottled: null, // Callback: (waitTime, reason) => boolean
  },
  // Stage 6 Phase 5: Response Caching
  cache: {
    enabled: false, // Disabled by default (opt-in for cost savings)
    maxEntries: 100, // Maximum cached responses
    ttl: 3600000, // Time-to-live in ms (1 hour)
    keyGenerator: null, // Custom key generator: (request) => string
    storage: "memory", // 'memory' or 'sessionStorage'
    excludeModels: [], // Models to never cache
    onCacheHit: null, // Callback: (key, response) => void
    onCacheMiss: null, // Callback: (key) => void
  },
  // Stage 6 Phase 6: Request Preprocessing
  preprocess: {
    enabled: false, // Disabled by default (opt-in)
    processors: [], // Array of {name, processor, priority} to auto-register
  },
  // Stage 6 Phase 7: Request Queue
  queue: {
    enabled: false, // Disabled by default (opt-in)
    maxSize: 50, // Maximum queue size
    concurrency: 1, // Concurrent requests
    defaultPriority: "normal", // 'critical' | 'high' | 'normal' | 'low'
    onQueueChange: null, // Callback: (queueLength) => void
  },
  // Stage 6 Phase 8: Health Monitoring
  health: {
    enabled: false, // Disabled by default (opt-in)
    checkInterval: 30000, // Health check interval (ms)
    timeout: 5000, // Health check timeout (ms)
    unhealthyThreshold: 3, // Consecutive failures before unhealthy
    onStatusChange: null, // Callback: (status) => void
  },
};

// ============================================================================
// FILE UTILITIES
// ============================================================================

// Note: EmbedFileUtils will be loaded from openrouter-embed-file.js
// and available as window.EmbedFileUtils
// File attachment support added in Stage 2

// ============================================================================
// OPENROUTER EMBED CLASS
// ============================================================================

class OpenRouterEmbed {
  /**
   * Create a new OpenRouter Embed instance
   *
   * @param {Object} config - Configuration object
   * @param {string} config.containerId - Required: DOM container ID
   * @param {string} [config.model] - AI model to use
   * @param {string} [config.systemPrompt] - System prompt (null = none)
   * @param {number} [config.temperature] - Temperature (0-1)
   * @param {number} [config.max_tokens] - Max response tokens
   * @param {number} [config.top_p] - Top-p sampling
   * @param {boolean} [config.showNotifications] - Show toast notifications
   * @param {boolean} [config.enableLogging] - Enable console logging
   * @param {string} [config.logLevel] - Log level (ERROR/WARN/INFO/DEBUG)
   */
  constructor(config) {
    logInfo("Initialising OpenRouter Embed API...");

    // Validate configuration
    this.validateConfig(config);

    // Merge with defaults
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Store configuration
    this.containerId = config.containerId;
    this.model = this.config.model;
    this.systemPrompt = this.config.systemPrompt;
    this.temperature = this.config.temperature;
    this.max_tokens = this.config.max_tokens;
    this.top_p = this.config.top_p;
    this.showNotifications = this.config.showNotifications;
    this.enableLogging = this.config.enableLogging;

    // Get container reference
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      throw new Error(
        `Container with ID "${this.containerId}" not found in DOM`
      );
    }

    // Add ARIA live region for accessibility
    this.container.setAttribute("aria-live", "polite");
    this.container.setAttribute("aria-atomic", "true");

    // Component references
    this.client = window.openRouterClient;
    this.markdown = window.MarkdownEditor;
    this.notifications = {
      success: window.notifySuccess,
      error: window.notifyError,
      warning: window.notifyWarning,
      info: window.notifyInfo,
    };
    this.resultsManager = window.uiController?.resultsManager;

    // Validate component availability
    this.validateComponents();

    // State management
    this.processing = false;
    this.lastResponse = null;
    this.lastError = null;
    this._executingQueuedRequest = false;

    // Per-stream promise tracking for concurrent queue support
    this._streamPromises = new Map();

    // File handling state (Stage 2)
    this.currentFile = null;
    this.currentFileBase64 = null;
    this.currentFileAnalysis = null;

    // File utilities (load lazily if not available)
    this.fileUtils = null;
    if (window.EmbedFileUtils) {
      // Pass compression configuration to file utilities
      const fileUtilsConfig = {
        compression: {
          ENABLED: config.enableCompression !== false, // Default true
          SIZE_THRESHOLD: config.compressionThreshold || 200 * 1024, // 200KB
          MAX_WIDTH: config.compressionMaxWidth || 1200,
          MAX_HEIGHT: config.compressionMaxHeight || 900,
          QUALITY: config.compressionQuality || 0.7,
        },
      };

      this.fileUtils = new window.EmbedFileUtils(fileUtilsConfig);
      logDebug("File utilities initialised", {
        compressionEnabled: fileUtilsConfig.compression.ENABLED,
      });
    } else {
      logWarn("EmbedFileUtils not available - file attachment disabled");
    }

    // Streaming state (Stage 3)
    this.isStreaming = false;
    this.streamAbortController = null;
    this.streamBuffer = "";
    this.currentStreamId = null;
    this.streamCancelled = false; // Track user-initiated cancellations

    // Throttling for chunk processing
    this.lastRenderTime = 0;
    this.chunkCounter = 0;
    this.streamContentElement = null;

    // Streaming callbacks
    this.streamingCallbacks = {
      onChunk: null,
      onComplete: null,
      onError: null,
      onProgress: null,
    };

    // Promise resolution for streaming (Issue #1 fix)
    this.streamCompletionPromise = null;
    this.resolveStreamCompletion = null;
    this.rejectStreamCompletion = null;

    // Progress indicator configuration (Stage 4 Phase 1)
    this.showStreamingProgress = config.showStreamingProgress !== false;
    this.progressStyle = config.progressStyle || "detailed"; // 'minimal' or 'detailed'
    this.progressIndicatorPosition = config.progressIndicatorPosition || "top"; // 'top', 'bottom', 'inline'
    this.progressIndicator = null; // Will be initialised when needed

    // Phase 3: Request Control & Accessibility configuration
    this.respectReducedMotion = config.respectReducedMotion !== false; // Default true
    this.allowCancellation = config.allowCancellation !== false; // Default true
    this._requestAbortController = null; // Generic abort controller for non-streaming requests
    this._reducedMotionFallbackActive = false; // Track when reduced motion fallback is in use

    // Phase 4: Debug data collection
    this._debugMode = false;
    this._lastRequestDebug = null;
    this._currentRequestTiming = null;

    // Stage 6 Phase 1: Retry handler integration
    this._retryHandler = null;
    this._retryConfig = { ...DEFAULT_CONFIG.retry, ...config.retry };

    if (this._retryConfig.enabled && window.EmbedRetryHandlerClass) {
      this._retryHandler = new window.EmbedRetryHandlerClass(this._retryConfig);
      logInfo("Retry handler initialised", {
        maxRetries: this._retryConfig.maxRetries,
        initialDelay: this._retryConfig.initialDelay,
      });
    } else if (this._retryConfig.enabled && !window.EmbedRetryHandlerClass) {
      logWarn(
        "Retry enabled but EmbedRetryHandlerClass not available. Load openrouter-embed-retry.js first."
      );
    }

    // Stage 6 Phase 2: Event emitter integration
    this._eventEmitter = null;
    if (window.EmbedEventEmitterClass) {
      this._eventEmitter = new window.EmbedEventEmitterClass();
      logInfo("Event emitter initialised");
    } else {
      logDebug("EmbedEventEmitterClass not available - events disabled");
    }

    // Stage 6 Phase 3: Post-processor integration
    this._postProcessor = null;
    if (window.EmbedPostProcessorClass) {
      this._postProcessor = new window.EmbedPostProcessorClass();
      logInfo("Post-processor initialised");
    } else {
      logDebug(
        "EmbedPostProcessorClass not available - post-processing disabled"
      );
    }

    // Stage 6 Phase 4: Throttle handler integration
    this._throttleHandler = null;
    this._throttleConfig = { ...DEFAULT_CONFIG.throttle, ...config.throttle };
    this._currentThrottleRequestId = null;

    if (window.EmbedThrottleClass) {
      this._throttleHandler = new window.EmbedThrottleClass(
        this._throttleConfig
      );

      // Connect event emitter if available
      if (this._eventEmitter) {
        this._throttleHandler._emitEvent = (event, data) => {
          this._emitEvent(event, data);
        };
      }

      logInfo("Throttle handler initialised", {
        debounceDelay: this._throttleConfig.debounceDelay,
        throttleInterval: this._throttleConfig.throttleInterval,
        maxConcurrent: this._throttleConfig.maxConcurrent,
      });
    } else {
      logDebug("EmbedThrottleClass not available - throttling disabled");
    }

    // Stage 6 Phase 5: Cache handler integration
    this._cacheHandler = null;
    this._cacheConfig = { ...DEFAULT_CONFIG.cache, ...config.cache };

    if (this._cacheConfig.enabled && window.EmbedCacheClass) {
      this._cacheHandler = new window.EmbedCacheClass(this._cacheConfig);

      // Connect event emitter if available
      if (this._eventEmitter) {
        this._cacheHandler._emitEvent = (event, data) => {
          this._emitEvent(event, data);
        };
      }

      logInfo("Cache handler initialised", {
        maxEntries: this._cacheConfig.maxEntries,
        ttl: this._cacheConfig.ttl,
      });
    } else if (this._cacheConfig.enabled && !window.EmbedCacheClass) {
      logWarn(
        "Cache enabled but EmbedCacheClass not available. Load openrouter-embed-cache.js first."
      );
    } else {
      logDebug("EmbedCacheClass not available or cache disabled");
    }

    // Stage 6 Phase 6: Preprocessor integration
    this._preProcessor = null;
    this._preprocessConfig = {
      ...DEFAULT_CONFIG.preprocess,
      ...config.preprocess,
    };

    if (window.EmbedPreProcessorClass) {
      this._preProcessor = new window.EmbedPreProcessorClass();

      // Auto-register configured processors
      if (this._preprocessConfig.processors?.length > 0) {
        for (const proc of this._preprocessConfig.processors) {
          try {
            this._preProcessor.add(proc.name, proc.processor, {
              priority: proc.priority || 100,
              enabled: proc.enabled !== false,
            });
          } catch (e) {
            logWarn(`Failed to register preprocessor '${proc.name}':`, e);
          }
        }
      }

      logInfo("Preprocessor initialised", {
        enabled: this._preprocessConfig.enabled,
        processorCount: this._preProcessor.getProcessorNames().length,
      });
    } else {
      logDebug("EmbedPreProcessorClass not available - preprocessing disabled");
    }

    // Stage 6 Phase 7: Queue handler integration
    this._queueHandler = null;
    this._queueConfig = { ...DEFAULT_CONFIG.queue, ...config.queue };

    if (window.EmbedQueueClass) {
      this._queueHandler = new window.EmbedQueueClass(this._queueConfig);

      // Connect event emitter if available
      if (this._eventEmitter) {
        this._queueHandler._emitEvent = (event, data) => {
          this._emitEvent(event, data);
        };
      }

      // Set executor to use our sendRequest method
      this._queueHandler.setExecutor(async (request) => {
        return await this._executeQueuedRequest(request);
      });

      logInfo("Queue handler initialised", {
        enabled: this._queueConfig.enabled,
        maxSize: this._queueConfig.maxSize,
        concurrency: this._queueConfig.concurrency,
      });
    } else {
      logDebug("EmbedQueueClass not available - queue disabled");
    }

    // Stage 6 Phase 8: Health monitor integration
    this._healthMonitor = null;
    this._healthConfig = { ...DEFAULT_CONFIG.health, ...config.health };

    if (window.EmbedHealthMonitorClass) {
      this._healthMonitor = new window.EmbedHealthMonitorClass(
        this._healthConfig
      );

      // Connect event emitter if available
      if (this._eventEmitter) {
        this._healthMonitor._emitEvent = (event, data) => {
          this._emitEvent(event, data);
        };
      }

      // Auto-start if enabled
      if (this._healthConfig.enabled) {
        this._healthMonitor.start();
      }

      logInfo("Health monitor initialised", {
        enabled: this._healthConfig.enabled,
        checkInterval: this._healthConfig.checkInterval,
      });
    } else {
      logDebug(
        "EmbedHealthMonitorClass not available - health monitoring disabled"
      );
    }

    logInfo("OpenRouter Embed API initialised successfully", {
      containerId: this.containerId,
      model: this.model,
      hasSystemPrompt: !!this.systemPrompt,
      hasFileUtils: !!this.fileUtils,
      streamingEnabled: true,
      respectReducedMotion: this.respectReducedMotion,
      allowCancellation: this.allowCancellation,
      retryEnabled: this._retryConfig.enabled && !!this._retryHandler,
      eventsEnabled: !!this._eventEmitter,
      postProcessorEnabled: !!this._postProcessor,
      throttleEnabled: !!this._throttleHandler,
      cacheEnabled: this._cacheConfig.enabled && !!this._cacheHandler,
      queueEnabled: this._queueConfig.enabled && !!this._queueHandler,
      healthEnabled: this._healthConfig.enabled && !!this._healthMonitor,
    });
  }

  // ==========================================================================
  // VALIDATION METHODS
  // ==========================================================================

  /**
   * Validate configuration object
   * @param {Object} config - Configuration to validate
   * @throws {Error} If configuration is invalid
   */
  validateConfig(config) {
    if (!config) {
      throw new Error("Configuration object is required");
    }

    if (!config.containerId) {
      throw new Error("containerId is required in configuration");
    }

    if (typeof config.containerId !== "string") {
      throw new Error("containerId must be a string");
    }

    // Validate optional parameters
    if (config.temperature !== undefined) {
      if (
        typeof config.temperature !== "number" ||
        config.temperature < 0 ||
        config.temperature > 1
      ) {
        throw new Error("temperature must be a number between 0 and 1");
      }
    }

    if (config.max_tokens !== undefined) {
      if (typeof config.max_tokens !== "number" || config.max_tokens < 1) {
        throw new Error("max_tokens must be a positive number");
      }
    }

    if (config.top_p !== undefined) {
      if (
        typeof config.top_p !== "number" ||
        config.top_p < 0 ||
        config.top_p > 1
      ) {
        throw new Error("top_p must be a number between 0 and 1");
      }
    }

    logDebug("Configuration validated successfully");
  }

  /**
   * Validate required components are available
   * @throws {Error} If required components are missing
   */
  validateComponents() {
    if (!this.client) {
      throw new Error(
        "OpenRouter client not available (window.openRouterClient)"
      );
    }

    if (!this.markdown) {
      throw new Error(
        "Markdown processor not available (window.MarkdownEditor)"
      );
    }

    if (!this.notifications.success || !this.notifications.error) {
      logWarn(
        "Notification system not fully available, some feedback may be limited"
      );
    }

    logDebug("All required components validated");
  }

  // ==========================================================================
  // MESSAGE BUILDING
  // ==========================================================================

  /**
   * Build OpenRouter messages array
   * Handles text-only, image, and PDF content
   * @param {string} userPrompt - User's prompt text
   * @returns {Array} Messages array for OpenRouter API
   */
  buildMessages(userPrompt) {
    logDebug("Building messages array...");

    // Check if file is attached
    if (this.currentFile && this.currentFileBase64) {
      logInfo("Building message with attached file", {
        fileName: this.currentFile.name,
        fileType: this.currentFile.type,
      });

      const { isImage, isPDF } = this.fileUtils.validateFile(this.currentFile);

      let userMessage;

      if (isImage) {
        // Image message format
        userMessage = this.fileUtils.prepareImageContent(
          this.currentFile,
          this.currentFileBase64,
          userPrompt
        );
        logDebug("Built image message");
      } else if (isPDF) {
        // PDF message format
        userMessage = this.fileUtils.preparePDFContent(
          this.currentFile,
          this.currentFileBase64,
          userPrompt
        );
        logDebug("Built PDF message");
      }

      const messages = [];

      // Add system prompt if provided
      if (this.systemPrompt) {
        messages.push({
          role: "system",
          content: this.systemPrompt,
        });
        logDebug("Added system prompt to messages");
      }

      // Add user message with file
      messages.push(userMessage);

      logDebug("Built messages array with file", {
        messageCount: messages.length,
      });

      return messages;
    }

    // No file attached - use text-only format (existing Stage 1 logic)
    logDebug("Building text-only message");

    const messages = [];

    // Add system prompt if provided
    if (this.systemPrompt) {
      messages.push({
        role: "system",
        content: this.systemPrompt,
      });
      logDebug("Added system prompt to messages");
    }

    // Add user message (text only)
    messages.push({
      role: "user",
      content: userPrompt,
    });

    logDebug("Built messages array", { messageCount: messages.length });

    return messages;
  }

  /**
   * Internal non-streaming fallback for reduced motion preference
   *
   * This method provides a true non-streaming request path when the user
   * has requested reduced motion. Unlike sendRequest() which internally
   * uses streaming, this directly calls the non-streaming API.
   *
   * @private
   * @param {Object} options - Request options (same as sendStreamingRequest)
   * @returns {Promise<Object>} Response object
   */
  async _sendNonStreamingFallback(options) {
    const { userPrompt, onComplete, onError } = options;

    logDebug("Executing non-streaming fallback for reduced motion");

    // Set up abort controller for cancellation support
    if (this.allowCancellation) {
      this._requestAbortController = new AbortController();
    }

    this.processing = true;
    this.lastError = null;

    const startTime = performance.now();

    // Show initial notification
    if (this.showNotifications && this.notifications.info) {
      this.notifications.info("Processing request...");
    }

    this.announceToScreenReader("Processing request");

    try {
      // Build messages and options
      const messages = this.buildMessages(userPrompt);
      const requestOptions = this.buildOptions();

      // Add abort signal if cancellation is enabled
      if (this._requestAbortController) {
        requestOptions.abortSignal = this._requestAbortController.signal;
      }

      // Call the client's non-streaming method directly
      logDebug("Calling openRouterClient.sendRequest (non-streaming)...");

      const apiResponse = await this.client.sendRequest(
        messages,
        requestOptions
      );

      // Check if cancelled during request
      if (this._requestAbortController?.signal?.aborted) {
        return { cancelled: true, text: "", reason: "User cancelled" };
      }

      const processingTime = Math.round(performance.now() - startTime);

      // Process the response
      const response = this.processResponse(apiResponse, processingTime);

      // Inject content into container
      this.injectContent(response.html);

      // Store successful response
      this.lastResponse = response;

      // Call completion callback if provided
      if (typeof onComplete === "function") {
        try {
          onComplete(response);
        } catch (callbackError) {
          logWarn("onComplete callback error:", callbackError);
        }
      }

      logInfo("Non-streaming fallback completed successfully", {
        processingTime,
        responseLength: response.text?.length || 0,
      });

      // Show success notification
      if (this.showNotifications && this.notifications.success) {
        this.notifications.success("Request completed successfully");
      }

      return response;
    } catch (error) {
      // Check if this is a cancellation
      if (
        error.name === "AbortError" ||
        this._requestAbortController?.signal?.aborted
      ) {
        logInfo("Request was cancelled (reduced motion fallback)");
        return { cancelled: true, text: "", reason: "User cancelled" };
      }

      this.lastError = error;
      logError("Non-streaming fallback failed:", error);

      // Call error callback if provided
      if (typeof onError === "function") {
        try {
          onError(error);
        } catch (callbackError) {
          logWarn("onError callback error:", callbackError);
        }
      }

      // Show error notification
      if (this.showNotifications && this.notifications.error) {
        this.notifications.error(`Request failed: ${error.message}`);
      }

      this.announceToScreenReader(`Error: ${error.message}`);

      throw error;
    } finally {
      // Cleanup state
      this.processing = false;
      this._requestAbortController = null;
      this._reducedMotionFallbackActive = false;
    }
  }

  /**
   * Build request options for OpenRouter API
   * Includes PDF engine selection if PDF attached
   * @returns {Object} Options object
   */
  buildOptions() {
    logDebug("Building request options...");

    const options = {
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.max_tokens,
      top_p: this.top_p,
    };

    // Add PDF engine if PDF is attached (Stage 2)
    // Using official OpenRouter plugins format per API documentation
    if (
      this.currentFile &&
      this.currentFile.type === "application/pdf" &&
      this.currentFileAnalysis?.engine
    ) {
      const engine = this.currentFileAnalysis.engine;

      // Only add if not 'auto' (which lets OpenRouter choose)
      // Supports explicit 'native', 'pdf-text', and 'mistral-ocr' selection
      if (engine !== "auto") {
        options.plugins = [
          {
            id: "file-parser",
            pdf: {
              engine: engine,
            },
          },
        ];
        logDebug("Added PDF engine using plugins format", { engine });
      }
    }

    logDebug("Built request options", options);

    return options;
  }

  // ==========================================================================
  // CORE REQUEST METHOD
  // ==========================================================================

  /**
   * Send request to OpenRouter API (non-streaming interface)
   *
   * Internally uses streaming for better performance with large files,
   * but presents a simple single-response API to the caller.
   *
   * @param {string} userPrompt - User's prompt text
   * @returns {Promise<Object>} Response object with text, html, metadata
   * @throws {Error} If request fails
   */
  async sendRequest(userPrompt) {
    // Validate input before delegating
    if (!userPrompt?.trim()) {
      throw new Error("User prompt is required");
    }

    // Check if already processing (sendStreamingRequest will also check, but better error message here)
    // Allow concurrent requests when executing from queue (supports queue concurrency > 1)
    if (
      (this.processing || this.isStreaming) &&
      !this._executingQueuedRequest
    ) {
      const error = new Error("Request already in progress");
      logWarn("Attempted to send request while already processing");
      throw error;
    }

    this.lastError = null;

    logInfo("Sending request (using streaming internally for performance)...");

    // Show initial notification
    if (this.showNotifications && this.notifications.info) {
      this.notifications.info("Processing request...");
    }

    this.announceToScreenReader("Processing request");

    const startTime = performance.now();

    try {
      // Use streaming internally for much better performance with large files
      // The throttled rendering fix makes this fast even for big images
      const response = await this.sendStreamingRequest({
        userPrompt: userPrompt,
        // No onChunk callback - we just want the final result
        // The streaming method will still update the UI progressively
      });

      const processingTime = Math.round(performance.now() - startTime);

      logInfo("Request completed successfully", {
        processingTime,
        responseLength: response.text?.length || 0,
      });

      // Show success notification
      if (this.showNotifications && this.notifications.success) {
        this.notifications.success("Request completed successfully");
      }

      return response;
    } catch (error) {
      this.lastError = error;
      logError("Request failed:", error);

      // Show error notification
      if (this.showNotifications && this.notifications.error) {
        this.notifications.error(`Request failed: ${error.message}`);
      }

      this.announceToScreenReader(`Error: ${error.message}`);

      throw error;
    }
  }

  // ==========================================================================
  // STREAMING REQUEST METHOD (STAGE 3)
  // ==========================================================================

  /**
   * Send a streaming request to OpenRouter API with real-time updates
   *
   * @param {Object} options - Request options
   * @param {string} options.userPrompt - User's prompt text
   * @param {Function} [options.onChunk] - Called for each chunk: (chunk) => {}
   * @param {Function} [options.onComplete] - Called when complete: (response) => {}
   * @param {Function} [options.onError] - Called on error: (error) => {}
   * @returns {Promise<Object>} Final response object
   *
   * @example
   * await embed.sendStreamingRequest({
   *   userPrompt: 'Write a story...',
   *   onChunk: (chunk) => console.log('Chunk:', chunk.text),
   *   onComplete: (response) => console.log('Done!', response.text)
   * });
   */
  async sendStreamingRequest(options) {
    // Validation
    const { userPrompt, onChunk, onComplete, onError } = options;

    if (!userPrompt?.trim()) {
      throw new Error("User prompt is required");
    }

    // Prevent concurrent requests
    // Allow concurrent requests when executing from queue (supports queue concurrency > 1)
    if (
      (this.processing || this.isStreaming) &&
      !this._executingQueuedRequest
    ) {
      const message = "Cannot start streaming: request already in progress";
      logWarn(message);
      throw new Error(message);
    }

    // Phase 3: Check reduced motion preference and fallback to non-streaming
    // This provides accessibility compliance for users who prefer reduced motion
    if (this.respectReducedMotion && this.prefersReducedMotion()) {
      logInfo(
        "Reduced motion preferred - falling back to non-streaming request"
      );
      this._reducedMotionFallbackActive = true;

      // Call a simplified non-streaming version that doesn't recurse back to streaming
      return this._sendNonStreamingFallback(options);
    }

    // Create promise that resolves when handleStreamComplete is called
    return new Promise(async (resolve, reject) => {
      // Store promise resolution functions (legacy single-stream support)
      this.streamCompletionPromise = { resolve, reject };

      // Set streaming state
      this.isStreaming = true;
      this.processing = true;
      this.streamBuffer = "";
      this.currentStreamId = this.generateStreamId();
      this.streamAbortController = new AbortController();
      this.streamCancelled = false; // Reset cancellation flag

      // Store promise by streamId for concurrent queue support
      this._streamPromises.set(this.currentStreamId, { resolve, reject });

      // Phase 4: Initialise timing capture for debug data
      this._currentRequestTiming = {
        totalStart: performance.now(),
        validationStart: performance.now(),
        validationEnd: null,
        preparationStart: null,
        preparationEnd: null,
        apiCallStart: null,
        apiCallEnd: null,
        processingStart: null,
        processingEnd: null,
      };

      // Phase 4: Capture memory before request (if available)
      let memoryBefore = null;
      if (performance.memory) {
        memoryBefore = {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
        };
      }
      this._currentRequestTiming.memoryBefore = memoryBefore;

      logInfo("Starting streaming request...", {
        streamId: this.currentStreamId,
      });
      this.announceToScreenReader("Streaming response...");

      // Initialise progress indicator if enabled (Stage 4 Phase 1)
      if (this.showStreamingProgress && window.EmbedProgressIndicator) {
        try {
          this.progressIndicator = new window.EmbedProgressIndicator({
            container: this.container,
            position: this.progressIndicatorPosition,
            style: this.progressStyle,
            enabled: this.showStreamingProgress,
          });
          this.progressIndicator.start();
          logDebug("Progress indicator started");
        } catch (error) {
          logWarn("Failed to initialise progress indicator:", error);
          this.progressIndicator = null;
        }
      }

      // Phase 4: Mark validation complete, preparation start
      if (this._currentRequestTiming) {
        this._currentRequestTiming.validationEnd = performance.now();
        this._currentRequestTiming.preparationStart = performance.now();
      }

      // Stage 6 Phase 6: Preprocess request if enabled
      let processedUserPrompt = userPrompt;
      let processedSystemPrompt = this.systemPrompt;

      if (this._preProcessor && this._preprocessConfig.enabled) {
        try {
          const preprocessed = await this._preProcessor.process({
            userPrompt: userPrompt,
            systemPrompt: this.systemPrompt,
            model: this.model,
            temperature: this.temperature,
            max_tokens: this.max_tokens,
            top_p: this.top_p,
          });

          processedUserPrompt = preprocessed.userPrompt || userPrompt;
          processedSystemPrompt =
            preprocessed.systemPrompt || this.systemPrompt;

          logDebug("Request preprocessed", {
            processors: preprocessed.preprocessed?.processors || [],
            duration: preprocessed.preprocessed?.duration || 0,
          });
        } catch (preprocessError) {
          logWarn(
            "Preprocessing failed, using original input:",
            preprocessError
          );
        }
      }

      // Stage 6 Phase 5: Store userPrompt for cache key generation
      this._lastUserPrompt = processedUserPrompt;

      // Temporarily update systemPrompt if preprocessing changed it
      const originalSystemPrompt = this.systemPrompt;
      if (processedSystemPrompt !== this.systemPrompt) {
        this.systemPrompt = processedSystemPrompt;
      }

      // Build messages and options (reuse existing methods)
      const messages = this.buildMessages(processedUserPrompt);
      const requestOptions = this.buildOptions();

      // Restore original systemPrompt
      this.systemPrompt = originalSystemPrompt;

      // Phase 4: Mark preparation complete
      if (this._currentRequestTiming) {
        this._currentRequestTiming.preparationEnd = performance.now();
      }

      // Debug logging for file handling (Issue #2 debugging)
      if (this.currentFile) {
        logDebug("Streaming with file attachment", {
          fileName: this.currentFile.name,
          fileType: this.currentFile.type,
          hasBase64: !!this.currentFileBase64,
          hasAnalysis: !!this.currentFileAnalysis,
          engine: this.currentFileAnalysis?.engine,
          messagesStructure: JSON.stringify(messages, null, 2),
          optionsStructure: JSON.stringify(requestOptions, null, 2),
        });
      }

      // Store callbacks (Stage 4 Phase 1: added onProgress)
      this.streamingCallbacks = {
        onChunk,
        onComplete,
        onError,
        onProgress: options.onProgress || null,
      };

      // Phase 4: Store request info for debug data
      this._currentRequestTiming.requestInfo = {
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.max_tokens,
        systemPromptLength: this.systemPrompt?.length || 0,
        userPromptLength: userPrompt?.length || 0,
        hasFile: !!this.currentFile,
        fileInfo: this.currentFile
          ? {
              name: this.currentFile.name,
              type: this.currentFile.type,
              size: this.currentFile.size,
              compressionApplied:
                this.currentFileAnalysis?.compressionApplied || false,
            }
          : null,
        streaming: true,
        timestamp: new Date().toISOString(),
      };

      // Stage 6 Phase 5: Check cache before API call
      if (
        this._cacheHandler &&
        this._cacheConfig.enabled &&
        !this.currentFile
      ) {
        const cacheRequest = {
          userPrompt,
          systemPrompt: this.systemPrompt,
          model: this.model,
          temperature: this.temperature,
          max_tokens: this.max_tokens,
        };

        const cachedResponse = this._cacheHandler.get(cacheRequest);
        if (cachedResponse) {
          logInfo("Cache hit - returning cached response");

          // Emit events for cached response
          this._emitEvent("beforeRequest", {
            userPrompt,
            systemPrompt: this.systemPrompt,
            model: this.model,
            options: requestOptions,
            hasFile: false,
            cached: true,
          });

          this._emitEvent("afterRequest", {
            response: cachedResponse.text,
            duration: 0,
            model: this.model,
            cached: true,
          });

          // Display cached content
          this.injectContent(cachedResponse.html);
          this.announceToScreenReader("Response loaded from cache");

          // Cleanup and resolve
          this.cleanupStreamingState();

          if (this.streamCompletionPromise) {
            this.streamCompletionPromise.resolve({
              ...cachedResponse,
              cached: true,
            });
          }

          // Call completion callback if provided
          if (this.streamingCallbacks.onComplete) {
            this.streamingCallbacks.onComplete({
              ...cachedResponse,
              cached: true,
            });
          }

          return;
        }
      }

      // Stage 6 Phase 2: Emit beforeRequest event
      this._emitEvent("beforeRequest", {
        userPrompt,
        systemPrompt: this.systemPrompt,
        model: this.model,
        options: requestOptions,
        hasFile: !!this.currentFile,
      });

      // Capture streamId for closure (needed for concurrent queue support)
      const capturedStreamId = this.currentStreamId;

      // Set up streaming callbacks for OpenRouter client
      const streamingOptions = {
        ...requestOptions,
        stream: true,
        abortSignal: this.streamAbortController.signal,

        onStart: () => {
          logInfo("Stream started");
        },

        onChunk: (chunk, data) => {
          this.handleStreamChunk(chunk, data);
        },

        onComplete: (fullText, responseData) => {
          this.handleStreamComplete(fullText, responseData, capturedStreamId);
        },

        onError: (error) => {
          this.handleStreamError(error, capturedStreamId);
        },
      };

      // Stage 6 Phase 4: Acquire throttle permission if enabled
      if (this._throttleHandler && this.isThrottleEnabled()) {
        try {
          logDebug("Acquiring throttle permission...");
          this._currentThrottleRequestId = await this._throttleHandler.acquire({
            signal: this.streamAbortController?.signal,
          });
          logDebug("Throttle permission acquired", {
            requestId: this._currentThrottleRequestId,
          });
        } catch (error) {
          if (error.name === "AbortError") {
            // Cancelled while waiting for throttle
            logInfo("Request cancelled while waiting for throttle");
            this.cleanupStreamingState();
            if (this.streamCompletionPromise) {
              this.streamCompletionPromise.resolve({
                cancelled: true,
                text: "",
                reason: "Cancelled while throttled",
              });
            }
            return;
          }
          // Throttle rejected the request
          logWarn("Request throttled:", error.message);
          this.cleanupStreamingState();
          if (this.streamCompletionPromise) {
            this.streamCompletionPromise.reject(error);
          }
          return;
        }
      }

      // Phase 4: Mark API call start
      if (this._currentRequestTiming) {
        this._currentRequestTiming.apiCallStart = performance.now();
      }

      // Send streaming request with proper error handling
      // Stage 6 Phase 1: Wrap with retry logic if enabled
      logDebug("Calling openRouterClient.sendStreamingRequest()...");

      const executeStreamingRequest = () => {
        return this.client.sendStreamingRequest(
          messages,
          streamingOptions,
          true
        );
      };

      // Determine if we should use retry
      const shouldRetry = this._retryHandler && this._retryConfig.enabled;

      const requestPromise = shouldRetry
        ? this._executeWithRetry(
            executeStreamingRequest,
            this.streamAbortController?.signal
          )
        : executeStreamingRequest();

      requestPromise.catch((error) => {
        // Check if this is an expected cancellation
        const isAbortError =
          error.name === "AbortError" ||
          this.streamCancelled ||
          error.message?.includes("aborted") ||
          error.message?.includes("BodyStreamBuffer was aborted");

        if (isAbortError) {
          // Expected cancellation - just log debug, don't process as error
          logDebug("Stream aborted (expected cancellation in catch)", {
            errorName: error.name,
            streamCancelled: this.streamCancelled,
            message: error.message,
          });
          // Don't call handleStreamError for expected cancellations
          return;
        }

        // Real errors get full handling
        logError("Client streaming error:", error);
        this.handleStreamError(error);
      });
    });
  }

  /**
   * Process OpenRouter API response
   * @param {Object} apiResponse - Raw API response
   * @param {number} processingTime - Processing time in milliseconds
   * @returns {Object} Processed response object
   */
  processResponse(apiResponse, processingTime) {
    logDebug("Processing API response...");

    // Log response structure for debugging
    logDebug("Response structure:", {
      hasChoices: !!apiResponse?.choices,
      hasMessage: !!apiResponse?.choices?.[0]?.message,
      hasMessageContent: !!apiResponse?.choices?.[0]?.message?.content,
      hasDirectContent: !!apiResponse?.content,
      responseKeys: Object.keys(apiResponse || {}),
    });

    // Extract text content from response - handle both possible structures
    let rawText = "";

    // Try standard OpenRouter API structure first
    if (apiResponse?.choices?.[0]?.message?.content) {
      rawText = apiResponse.choices[0].message.content;
      logDebug("Extracted text from choices structure");
    }
    // Fallback to direct content property
    else if (apiResponse?.content) {
      rawText = apiResponse.content;
      logDebug("Extracted text from direct content property");
    }
    // Last resort: check if response IS the content
    else if (typeof apiResponse === "string") {
      rawText = apiResponse;
      logDebug("Response was a direct string");
    }

    // Validate we got content
    if (!rawText || typeof rawText !== "string") {
      logError("No valid content in API response", {
        responseType: typeof apiResponse,
        rawTextType: typeof rawText,
        response: apiResponse,
      });
      throw new Error("No content received from API");
    }

    logDebug("Extracted text content", {
      length: rawText.length,
      preview: rawText.substring(0, 100),
    });

    // Process markdown to HTML
    let html;
    try {
      // Use MarkdownEditor.render() method
      if (this.markdown && typeof this.markdown.render === "function") {
        html = this.markdown.render(rawText);
        logDebug("Markdown render method called");
      }
      // Fallback to MarkdownEditor.md.render() if available
      else if (
        this.markdown?.md &&
        typeof this.markdown.md.render === "function"
      ) {
        html = this.markdown.md.render(rawText);
        logDebug("Markdown md.render method called");
      }
      // Last resort: plain text
      else {
        logWarn("No markdown processor available, using plain text");
        html = `<pre>${this.escapeHtml(rawText)}</pre>`;
      }

      // Validate that we actually got HTML content
      if (!html || typeof html !== "string") {
        logWarn(
          "Markdown processing returned invalid content, using plain text",
          {
            htmlType: typeof html,
            htmlValue: html,
          }
        );
        html = `<pre>${this.escapeHtml(rawText)}</pre>`;
      } else {
        logDebug("Markdown processed to HTML successfully", {
          htmlLength: html.length,
        });
      }
    } catch (error) {
      logError("Markdown processing failed, using plain text", error);
      // Fallback to plain text with line breaks
      html = `<pre>${this.escapeHtml(rawText)}</pre>`;
    }

    // Extract token usage with fallbacks
    const tokens = {
      prompt: apiResponse?.usage?.prompt_tokens || 0,
      completion: apiResponse?.usage?.completion_tokens || 0,
      total: apiResponse?.usage?.total_tokens || 0,
    };

    // Build response object
    const response = {
      text: rawText,
      html: html,
      markdown: rawText,
      raw: apiResponse,
      metadata: {
        model: apiResponse?.model || "unknown",
        tokens: tokens,
        processingTime: processingTime,
      },
    };

    logInfo("Response processed successfully", {
      textLength: rawText.length,
      htmlLength: html.length,
      tokens: tokens.total,
      model: response.metadata.model,
    });

    return response;
  }

  // ==========================================================================
  // CONTENT INJECTION
  // ==========================================================================

  /**
   * Inject processed content into container
   * @param {string} html - HTML content to inject
   * @throws {Error} If container not available
   */
  injectContent(html) {
    if (!this.container) {
      throw new Error("Container not available");
    }

    logDebug("Injecting content into container...");

    // Preserve progress indicator if it exists (Stage 4 Phase 1)
    const progressElement = this.container.querySelector(
      ".embed-progress-indicator"
    );
    const progressPosition = progressElement
      ? this.container.firstChild === progressElement
        ? "first"
        : "last"
      : null;

    // Inject content
    this.container.innerHTML = html;

    // Re-insert progress indicator if it was preserved (Stage 4 Phase 1)
    if (progressElement && this.isStreaming) {
      if (progressPosition === "first") {
        this.container.insertBefore(progressElement, this.container.firstChild);
      } else {
        this.container.appendChild(progressElement);
      }
      logDebug("Progress indicator preserved during content injection");
    }

    // Announce content update to screen readers
    this.announceToScreenReader("Content updated");

    // Focus management - set focus to container for keyboard navigation
    // Only if container doesn't already have focusable elements
    if (!this.container.querySelector("a, button, input, textarea, select")) {
      this.container.setAttribute("tabindex", "-1");
      this.container.focus();
    }

    logInfo("Content injected successfully");
  }

  /**
   * Clear container content
   */
  clear() {
    if (!this.container) {
      logWarn("Cannot clear content, container not available");
      return;
    }

    logDebug("Clearing container content...");
    this.container.innerHTML = "";
    this.lastResponse = null;

    // Announce to screen reader
    this.announceToScreenReader("Content cleared");

    logInfo("Container cleared");
  }

  // ==========================================================================
  // STREAMING HELPER METHODS (STAGE 3)
  // ==========================================================================

  /**
   * Handle incoming streaming chunk
   * @private
   */
  handleStreamChunk(chunk, data) {
    if (!chunk) return;

    // Always accumulate in buffer
    this.streamBuffer += chunk;

    const now = Date.now();
    const timeSinceLastRender = now - (this.lastRenderTime || 0);
    const chunksSinceLastRender = this.chunkCounter || 0;

    this.chunkCounter = chunksSinceLastRender + 1;

    logDebug("Processing chunk", {
      chunkLength: chunk.length,
      bufferLength: this.streamBuffer.length,
      chunksSinceLastRender: chunksSinceLastRender,
      timeSinceLastRender: timeSinceLastRender,
      preview: chunk.substring(0, 30),
    });

    // Throttle rendering - only render every 50ms OR every 10 chunks
    // This reduces O(n²) to O(n × k) where k << n
    const shouldRender =
      timeSinceLastRender > 50 || chunksSinceLastRender >= 10;

    if (shouldRender) {
      logDebug("Rendering throttled update", {
        trigger: timeSinceLastRender > 50 ? "time" : "chunks",
        chunkCount: chunksSinceLastRender,
        timeMs: timeSinceLastRender,
      });

      // Process markdown and update DOM (expensive operation)
      const html = this.processMarkdownWithFallback(this.streamBuffer);
      this.injectContent(html);

      // Auto-scroll to show new content
      this.scrollToBottom();

      // Reset throttling counters
      this.lastRenderTime = now;
      this.chunkCounter = 0;
    }

    // Update progress indicator (always - this is lightweight)
    if (this.progressIndicator) {
      try {
        this.progressIndicator.update({
          text: chunk,
          fullText: this.streamBuffer,
        });
      } catch (error) {
        logWarn("Progress indicator update failed:", error);
      }
    }

    // Call user callback (always - user may want all chunks)
    if (this.streamingCallbacks.onChunk) {
      this.streamingCallbacks.onChunk({
        text: chunk,
        fullText: this.streamBuffer,
        metadata: {
          chunkIndex: data?.chunkIndex || 0,
          timestamp: now,
          streamId: this.currentStreamId,
          wasRendered: shouldRender, // Indicate if this chunk triggered a render
        },
      });
    }

    // Call onProgress callback if provided (Stage 4 Phase 1)
    if (this.streamingCallbacks.onProgress && this.progressIndicator) {
      try {
        const progressData = this.progressIndicator.getProgressData();
        this.streamingCallbacks.onProgress(progressData);
      } catch (error) {
        logWarn("onProgress callback failed:", error);
      }
    }

    // Stage 6 Phase 2: Emit streamChunk event
    this._emitEvent("streamChunk", {
      chunk,
      buffer: this.streamBuffer,
      chunkIndex: data?.chunkIndex || this.chunkCounter,
    });
  }

  /**
   * Handle streaming completion
   * @private
   * @param {string} fullText - Complete response text
   * @param {Object} responseData - Response metadata
   * @param {string} [streamId] - Stream ID (for concurrent queue support)
   */
  async handleStreamComplete(fullText, responseData, streamId = null) {
    // Use passed streamId or fall back to current (for backwards compatibility)
    const resolveStreamId = streamId || this.currentStreamId;

    logInfo("Stream complete", {
      length: fullText.length,
      streamId: resolveStreamId,
    });

    // Phase 4: Mark API call end, processing start
    if (this._currentRequestTiming) {
      this._currentRequestTiming.apiCallEnd = performance.now();
      this._currentRequestTiming.processingStart = performance.now();
    }

    // Final markdown processing
    const html = this.processMarkdownWithFallback(fullText);
    this.injectContent(html);

    // Build response object
    let response = this.buildFinalResponse(fullText, responseData);

    // Stage 6 Phase 3: Post-process response if post-processor available
    if (this._postProcessor) {
      try {
        const postProcessContext = {
          model: this.model,
          streamId: this.currentStreamId,
          hasFile: !!this.currentFile,
        };
        response = await this._postProcessor.process(
          response,
          postProcessContext
        );
        logDebug("Response post-processed", {
          processors: response.processed?.processors || [],
          duration: response.processed?.duration || 0,
        });

        // Emit responseProcessed event
        this._emitEvent("responseProcessed", {
          processors: response.processed?.processors || [],
          duration: response.processed?.duration || 0,
        });
      } catch (error) {
        logWarn("Post-processing failed, using original response:", error);
      }
    }

    // Phase 4: Mark processing end and build debug data
    if (this._currentRequestTiming) {
      this._currentRequestTiming.processingEnd = performance.now();
      this._buildDebugData(fullText, responseData, response);
    }

    // Call user callback FIRST
    if (this.streamingCallbacks.onComplete) {
      this.streamingCallbacks.onComplete(response);
    }

    // Complete progress indicator (Stage 4 Phase 1)
    if (this.progressIndicator) {
      try {
        this.progressIndicator.complete(responseData);
      } catch (error) {
        logWarn("Progress indicator completion failed:", error);
      }
    }

    // Stage 6 Phase 2: Emit streamComplete and afterRequest events
    this._emitEvent("streamComplete", {
      fullResponse: fullText,
      duration: response.metadata?.processingTime || 0,
    });

    this._emitEvent("afterRequest", {
      response: fullText,
      duration: response.metadata?.processingTime || 0,
      model: this.model,
      cached: false,
    });

    // Stage 6 Phase 5: Cache the response (if caching enabled and no file attached)
    if (this._cacheHandler && this._cacheConfig.enabled && !this.currentFile) {
      const cacheRequest = {
        userPrompt: this._lastUserPrompt, // We need to store this
        systemPrompt: this.systemPrompt,
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.max_tokens,
      };

      try {
        this._cacheHandler.set(cacheRequest, response);
        logDebug("Response cached");
      } catch (error) {
        logWarn("Failed to cache response:", error);
      }
    }

    // Announce completion
    this.announceToScreenReader("Response complete");

    // Resolve per-stream promise if available (for concurrent queue support)
    const streamPromise = this._streamPromises.get(resolveStreamId);
    if (streamPromise) {
      streamPromise.resolve(response);
      this._streamPromises.delete(resolveStreamId);
    } else if (this.streamCompletionPromise) {
      // Fallback: Resolve legacy single-stream promise (Issue #1 fix)
      this.streamCompletionPromise.resolve(response);
    }

    // Cleanup state
    this.cleanupStreamingState();
  }

  /**
   * Handle streaming error
   * @private
   */
  handleStreamError(error, streamId = null) {
    // Use passed streamId or fall back to current (for backwards compatibility)
    const resolveStreamId = streamId || this.currentStreamId;
    // Check if this is an expected cancellation (AbortError)
    const isAbortError =
      error.name === "AbortError" ||
      error.message?.includes("aborted") ||
      error.message?.includes("BodyStreamBuffer was aborted");

    // Only log as error if it's NOT an expected cancellation
    if (isAbortError) {
      logDebug("Stream aborted (expected cancellation in handleStreamError)", {
        errorName: error.name,
        message: error.message,
        alreadyCancelled: this.streamCancelled,
      });
      // Don't process AbortErrors further - they're expected
      return;
    }

    // Real errors get full processing
    logError("Stream error:", error);

    // Phase 4: Build debug data for error case
    if (this._currentRequestTiming) {
      const now = performance.now();
      this._currentRequestTiming.apiCallEnd =
        this._currentRequestTiming.apiCallEnd || now;
      this._currentRequestTiming.processingEnd = now;
      this._buildDebugData(this.streamBuffer, null, null, error);
    }

    // Stage 6 Phase 2: Emit error event
    const retryHandler = this._retryHandler;
    this._emitEvent("error", {
      error,
      retryable: retryHandler ? retryHandler.isRetryable(error) : false,
      attempt: 0,
    });

    // Don't call onError for user-initiated cancellation
    if (this.streamingCallbacks.onError && !this.streamCancelled) {
      this.streamingCallbacks.onError(error);
    }

    // Reject per-stream promise if available (for concurrent queue support)
    if (!this.streamCancelled) {
      const streamPromise = this._streamPromises.get(resolveStreamId);
      if (streamPromise) {
        streamPromise.reject(error);
        this._streamPromises.delete(resolveStreamId);
      } else if (this.streamCompletionPromise) {
        // Fallback: Reject legacy single-stream promise
        this.streamCompletionPromise.reject(error);
      }
    }

    // Cleanup state
    this.cleanupStreamingState();
  }

  /**
   * Process markdown with fallback to plain text
   * Uses markdown-it directly for reliable HTML output
   * @private
   */
  processMarkdownWithFallback(text) {
    try {
      // Priority 1: Use markdown-it directly (most reliable for returning HTML)
      if (window.markdownit) {
        // Create or reuse markdown-it instance
        if (!this._markdownItInstance) {
          this._markdownItInstance = window.markdownit({
            html: true,
            breaks: true,
            linkify: true,
            typographer: true,
          });

          // Add task lists plugin if available
          if (window.markdownitTaskLists) {
            this._markdownItInstance.use(window.markdownitTaskLists);
          }

          logDebug("Created markdown-it instance for embed");
        }

        const html = this._markdownItInstance.render(text);
        if (html && typeof html === "string") {
          return html;
        }
      }

      // Priority 2: Try MarkdownEditor.md.render() if it has a markdown-it instance
      if (this.markdown?.md && typeof this.markdown.md.render === "function") {
        const html = this.markdown.md.render(text);
        if (html && typeof html === "string") {
          return html;
        }
      }
    } catch (error) {
      logWarn("Markdown processing failed, using plain text", error);
    }

    // Fallback to plain text (proven pattern from Stage 1)
    return `<pre>${this.escapeHtml(text)}</pre>`;
  }

  /**
   * Scroll container to show newest content
   * @private
   */
  scrollToBottom() {
    if (!this.container) return;

    // Only auto-scroll if user hasn't manually scrolled up
    const isNearBottom =
      this.container.scrollTop + this.container.clientHeight >=
      this.container.scrollHeight - 50;

    if (isNearBottom) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  /**
   * Build final response object
   * @private
   */
  buildFinalResponse(text, responseData) {
    return {
      text: text,
      html: this.processMarkdownWithFallback(text),
      markdown: text,
      raw: responseData,
      metadata: {
        model: responseData?.model || this.model,
        tokens: responseData?.usage || null,
        streamId: this.currentStreamId,
        processingTime: responseData?.processingTime || 0,
      },
    };
  }

  /**
   * Cancel active streaming request
   *
   * @param {string} [reason='User cancelled'] - Cancellation reason
   *
   * @example
   * embed.cancelStreaming('User clicked stop button');
   */
  cancelStreaming(reason = "User cancelled") {
    if (!this.isStreaming) {
      logWarn("No active stream to cancel");
      return;
    }

    logInfo("Cancelling stream", { reason, streamId: this.currentStreamId });

    // Mark as cancelled BEFORE aborting (Issue #3 fix)
    this.streamCancelled = true;

    try {
      // Abort the request
      if (this.streamAbortController) {
        this.streamAbortController.abort();
      }

      // Stage 6 Phase 2: Emit cancel event
      this._emitEvent("cancel", { reason });

      // Announce cancellation
      this.announceToScreenReader("Streaming cancelled");

      // Resolve promise with partial response (don't call error handlers)
      if (this.streamCompletionPromise) {
        const partialResponse = this.buildFinalResponse(this.streamBuffer, {
          cancelled: true,
          reason,
        });
        this.streamCompletionPromise.resolve(partialResponse);
      }
    } catch (error) {
      logError("Error during cancellation:", error);
      // Even if abort fails, cleanup
    } finally {
      // Always cleanup state
      this.cleanupStreamingState();
    }
  }

  /**
   * Clean up streaming state
   * @private
   */
  cleanupStreamingState() {
    logDebug("Cleaning up streaming state", { streamId: this.currentStreamId });

    // Cleanup progress indicator (Stage 4 Phase 1)
    if (this.progressIndicator) {
      try {
        this.progressIndicator.cleanup();
      } catch (error) {
        logWarn("Progress indicator cleanup failed:", error);
      }
      this.progressIndicator = null;
    }

    // Stage 6 Phase 4: Release throttle slot
    if (this._throttleHandler && this._currentThrottleRequestId) {
      try {
        this._throttleHandler.release(this._currentThrottleRequestId);
        logDebug("Throttle slot released", {
          requestId: this._currentThrottleRequestId,
        });
      } catch (error) {
        logWarn("Failed to release throttle slot:", error);
      }
      this._currentThrottleRequestId = null;
    }

    this.isStreaming = false;
    this.processing = false;
    this.streamAbortController = null;
    this.streamBuffer = "";
    this.currentStreamId = null;

    // Clean up throttling state
    this.lastRenderTime = 0;
    this.chunkCounter = 0;
    this.streamContentElement = null;

    this.streamingCallbacks = {
      onChunk: null,
      onComplete: null,
      onError: null,
      onProgress: null,
    };
  }

  /**
   * Generate unique stream ID
   * @private
   */
  generateStreamId() {
    return `stream_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }

  /**
   * Build comprehensive debug data from request
   * @private
   * @param {string} fullText - Response text
   * @param {Object} responseData - Raw response data
   * @param {Object} response - Processed response object
   * @param {Error} error - Error if request failed
   */
  _buildDebugData(fullText, responseData, response, error = null) {
    const timing = this._currentRequestTiming;
    if (!timing) return;

    // Capture memory after request (if available)
    let memoryAfter = null;
    if (performance.memory) {
      memoryAfter = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
      };
    }

    // Calculate timing durations
    const timingData = {
      validation:
        timing.validationEnd && timing.validationStart
          ? Math.round(timing.validationEnd - timing.validationStart)
          : null,
      preparation:
        timing.preparationEnd && timing.preparationStart
          ? Math.round(timing.preparationEnd - timing.preparationStart)
          : null,
      apiCall:
        timing.apiCallEnd && timing.apiCallStart
          ? Math.round(timing.apiCallEnd - timing.apiCallStart)
          : null,
      processing:
        timing.processingEnd && timing.processingStart
          ? Math.round(timing.processingEnd - timing.processingStart)
          : null,
      total:
        timing.processingEnd && timing.totalStart
          ? Math.round(timing.processingEnd - timing.totalStart)
          : null,
    };

    // Get compression metrics if available
    let compressionData = null;
    if (this.fileUtils && this.currentFileAnalysis?.compressionApplied) {
      compressionData = {
        enabled: true,
        applied: true,
        metrics: this.currentFileAnalysis.compressionMetrics || null,
      };
    } else if (this.fileUtils) {
      compressionData = {
        enabled: this.fileUtils.compressionConfig?.ENABLED || false,
        applied: false,
        metrics: null,
      };
    }

    // Build the debug data object
    this._lastRequestDebug = {
      request: timing.requestInfo || {
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.max_tokens,
        systemPromptLength: this.systemPrompt?.length || 0,
        userPromptLength: 0,
        hasFile: !!this.currentFile,
        fileInfo: null,
        streaming: true,
        timestamp: new Date().toISOString(),
      },
      response: {
        success: !error,
        textLength: fullText?.length || 0,
        tokens: {
          prompt:
            responseData?.usage?.prompt_tokens ||
            response?.metadata?.tokens?.prompt ||
            0,
          completion:
            responseData?.usage?.completion_tokens ||
            response?.metadata?.tokens?.completion ||
            0,
          total:
            responseData?.usage?.total_tokens ||
            response?.metadata?.tokens?.total ||
            0,
        },
        processingTime: timingData.total,
        cached: responseData?.cached || false,
      },
      compression: compressionData,
      timing: timingData,
      memory:
        timing.memoryBefore || memoryAfter
          ? {
              before: timing.memoryBefore,
              after: memoryAfter,
            }
          : null,
      errors: error ? [error.message || String(error)] : null,
    };

    if (this._debugMode) {
      logInfo("Debug data captured:", this._lastRequestDebug);
    } else {
      logDebug("Debug data captured");
    }
  }
  // ==========================================================================
  // FILE HANDLING METHODS (Stage 2)
  // ==========================================================================

  /**
   * Attach a file (image or PDF) for the next request
   *
   * @param {File} file - The file to attach
   * @returns {Promise<Object>} Analysis results
   * @throws {Error} If file utilities not available or file invalid
   */
  async attachFile(file) {
    logInfo("Attaching file...", { name: file.name, size: file.size });

    // Check file utilities available
    if (!this.fileUtils) {
      throw new Error(
        "File utilities not available. Ensure openrouter-embed-file.js is loaded."
      );
    }

    try {
      // Validate file TYPE first (size checked after compression)
      const { isImage } = this.fileUtils.validateFileType(file);
      logDebug("File type validation passed", { isImage });

      // CHECK IF IMAGE SHOULD BE COMPRESSED
      let processedFile = file;
      let compressionResult = null;
      const originalSize = file.size;

      if (
        isImage &&
        this.fileUtils.shouldCompressImage &&
        this.fileUtils.shouldCompressImage(file)
      ) {
        logInfo("Image exceeds threshold, compressing...");

        try {
          compressionResult = await this.fileUtils.compressImage(file);
          processedFile = compressionResult.file;

          logInfo("Compression successful", {
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
            savings: `${compressionResult.savings}%`,
            estimatedTimeSavings: `${compressionResult.estimatedTimeSavings}s`,
          });

          // Show compression notification
          if (this.showNotifications) {
            this.notifications.success(
              `Image optimised: ${(
                compressionResult.originalSize / 1024
              ).toFixed(0)}KB → ` +
                `${(compressionResult.compressedSize / 1024).toFixed(0)}KB. ` +
                `Estimated ${compressionResult.estimatedTimeSavings}s faster!`
            );
          }
        } catch (compressionError) {
          logWarn("Compression failed, using original file", compressionError);

          if (this.showNotifications) {
            this.notifications.warning(
              "Image compression failed. Using original file (processing may be slower)."
            );
          }

          // Fall back to original file
          processedFile = file;
        }
      }

      // Validate PROCESSED file size (after compression or original file)
      try {
        this.fileUtils.validateFileSize(
          processedFile,
          compressionResult ? originalSize : null
        );
        logDebug("File size validation passed", {
          size: processedFile.size,
          wasCompressed: !!compressionResult,
        });
      } catch (sizeError) {
        logError("File size validation failed", {
          size: processedFile.size,
          maxSize: processedFile.type.startsWith("image/") ? "10MB" : "25MB",
        });
        throw sizeError;
      }

      // Validate PROCESSED file size (after compression or original file)
      try {
        this.fileUtils.validateFileSize(
          processedFile,
          compressionResult ? originalSize : null
        );
        logDebug("File size validation passed", {
          size: processedFile.size,
          wasCompressed: !!compressionResult,
        });
      } catch (sizeError) {
        logError("File size validation failed", {
          size: processedFile.size,
          maxSize: processedFile.type.startsWith("image/") ? "10MB" : "25MB",
        });
        throw sizeError;
      }

      // Analyse file (cost, pages, etc.) using PROCESSED file
      const analysis = await this.fileUtils.analyzeFile(processedFile);
      logInfo("File analysis complete", analysis);

      // Check cost and warn if high
      const costLevel = this.fileUtils.shouldWarnAboutCost(analysis.cost);

      if (costLevel === "red" && window.safeConfirm) {
        const confirmed = await window.safeConfirm(
          `This operation may cost ${this.fileUtils.formatCost(
            analysis.cost
          )}. Continue?`,
          "High Cost Warning"
        );

        if (!confirmed) {
          logInfo("File attachment cancelled by user");
          throw new Error("Operation cancelled by user due to high cost");
        }
      } else if (costLevel === "orange" && this.showNotifications) {
        this.notifications.warning(
          `Estimated cost: ${this.fileUtils.formatCost(analysis.cost)}`
        );
      }

      // Convert PROCESSED file to base64
      const base64Data = await this.fileUtils.fileToBase64(processedFile);
      logDebug("File converted to base64", { length: base64Data.length });

      // Store PROCESSED file data
      this.currentFile = processedFile;
      this.currentFileBase64 = base64Data;
      this.currentFileAnalysis = {
        ...analysis,
        compressionApplied: !!compressionResult,
        compressionMetrics: compressionResult || null,
        originalFile: compressionResult ? file : null,
      };

      logInfo("File attached successfully", {
        name: processedFile.name,
        type: processedFile.type,
        size: processedFile.size,
        originalSize: file.size,
        compressed: !!compressionResult,
        estimatedCost: analysis.cost,
      });

      // Notification (if not already shown by compression)
      if (this.showNotifications && !compressionResult) {
        this.notifications.success(
          `File attached: ${processedFile.name} (${(
            processedFile.size / 1024
          ).toFixed(0)} KB)`
        );
      }

      // Screen reader announcement
      const announcement = compressionResult
        ? `Image optimised and attached: ${processedFile.name}`
        : `File attached: ${processedFile.name}`;
      this.announceToScreenReader(announcement);

      return {
        ...analysis,
        compressionApplied: !!compressionResult,
        compressionMetrics: compressionResult || null,
      };
    } catch (error) {
      logError("Failed to attach file", error);

      if (this.showNotifications) {
        this.notifications.error(`Failed to attach file: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Clear the currently attached file
   */
  clearFile() {
    logInfo("Clearing attached file...");

    const hadFile = this.currentFile !== null;

    this.currentFile = null;
    this.currentFileBase64 = null;
    this.currentFileAnalysis = null;

    if (hadFile) {
      logInfo("File cleared");

      if (this.showNotifications) {
        this.notifications.info("File cleared");
      }

      this.announceToScreenReader("File cleared");
    } else {
      logDebug("No file to clear");
    }
  }

  /**
   * Analyse a file without attaching it
   *
   * @param {File} file - The file to analyse
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeFile(file) {
    logInfo("Analysing file (without attaching)...", {
      name: file.name,
      size: file.size,
    });

    if (!this.fileUtils) {
      throw new Error(
        "File utilities not available. Ensure openrouter-embed-file.js is loaded."
      );
    }

    // Validate
    this.fileUtils.validateFile(file);

    // Analyse
    const analysis = await this.fileUtils.analyzeFile(file);

    logInfo("File analysis complete", analysis);

    return analysis;
  }

  // ==========================================================================
  // CONFIGURATION UPDATE METHODS
  // ==========================================================================

  /**
   * Update AI model
   * @param {string} model - Model identifier
   */
  setModel(model) {
    if (typeof model !== "string" || !model.trim()) {
      throw new Error("Model must be a non-empty string");
    }

    const oldModel = this.model;
    this.model = model;
    logInfo(`Model updated: ${oldModel} → ${model}`);
  }

  /**
   * Update temperature
   * @param {number} temperature - Temperature value (0-1)
   */
  setTemperature(temperature) {
    if (typeof temperature !== "number" || temperature < 0 || temperature > 1) {
      throw new Error("Temperature must be a number between 0 and 1");
    }

    const oldTemp = this.temperature;
    this.temperature = temperature;
    logInfo(`Temperature updated: ${oldTemp} → ${temperature}`);
  }

  /**
   * Update max tokens
   * @param {number} maxTokens - Maximum tokens for response
   */
  setMaxTokens(maxTokens) {
    if (typeof maxTokens !== "number" || maxTokens < 1) {
      throw new Error("Max tokens must be a positive number");
    }

    const oldTokens = this.max_tokens;
    this.max_tokens = maxTokens;
    logInfo(`Max tokens updated: ${oldTokens} → ${maxTokens}`);
  }

  /**
   * Update system prompt
   * @param {string|null} prompt - System prompt (null to remove)
   */
  setSystemPrompt(prompt) {
    if (prompt !== null && typeof prompt !== "string") {
      throw new Error("System prompt must be a string or null");
    }

    const hadPrompt = !!this.systemPrompt;
    const hasPrompt = !!prompt;
    this.systemPrompt = prompt;

    if (hadPrompt && !hasPrompt) {
      logInfo("System prompt removed");
    } else if (!hadPrompt && hasPrompt) {
      logInfo("System prompt added");
    } else {
      logInfo("System prompt updated");
    }
  }

  /**
   * Change output container
   * @param {string} containerId - New container ID
   */
  setContainer(containerId) {
    if (typeof containerId !== "string" || !containerId.trim()) {
      throw new Error("Container ID must be a non-empty string");
    }

    const newContainer = document.getElementById(containerId);
    if (!newContainer) {
      throw new Error(`Container with ID "${containerId}" not found in DOM`);
    }

    const oldContainerId = this.containerId;
    this.containerId = containerId;
    this.container = newContainer;

    // Add ARIA live region
    this.container.setAttribute("aria-live", "polite");
    this.container.setAttribute("aria-atomic", "true");

    logInfo(`Container updated: ${oldContainerId} → ${containerId}`);
  }

  // ==========================================================================
  // ACCESSIBILITY HELPERS
  // ==========================================================================

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  announceToScreenReader(message) {
    // Container already has aria-live="polite", so updates announce automatically
    // This is a placeholder for additional announcement logic if needed
    logDebug(`Screen reader announcement: ${message}`);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ==========================================================================
  // REQUEST CONTROL & ACCESSIBILITY (Phase 3)
  // ==========================================================================

  /**
   * Check if user prefers reduced motion
   *
   * Detects the prefers-reduced-motion: reduce media query which indicates
   * the user has requested minimal animation/motion in their system settings.
   *
   * @returns {boolean} True if reduced motion is preferred
   *
   * @example
   * if (embed.prefersReducedMotion()) {
   *   // Use non-streaming or simpler animations
   * }
   */
  prefersReducedMotion() {
    // Check for browser support first
    if (typeof window === "undefined" || !window.matchMedia) {
      logDebug(
        "matchMedia not supported, assuming no reduced motion preference"
      );
      return false;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const prefers = mediaQuery.matches;

    logDebug("Reduced motion preference check", {
      prefersReducedMotion: prefers,
    });

    return prefers;
  }

  /**
   * Cancel an in-flight request (streaming or non-streaming)
   *
   * This is a unified cancellation method that works for both streaming
   * and non-streaming requests. For streaming requests, it delegates to
   * cancelStreaming(). For non-streaming requests or reduced motion fallbacks,
   * it aborts the underlying fetch request.
   *
   * @param {string} [reason='User cancelled'] - Reason for cancellation
   * @returns {boolean} True if a request was cancelled, false if no request in progress
   *
   * @example
   * const wasCancelled = embed.cancelRequest('User clicked stop');
   * console.log(wasCancelled ? 'Request cancelled' : 'No request to cancel');
   */
  cancelRequest(reason = "User cancelled") {
    logDebug("cancelRequest called", {
      reason,
      isStreaming: this.isStreaming,
      processing: this.processing,
      hasStreamController: !!this.streamAbortController,
      hasRequestController: !!this._requestAbortController,
    });

    // If streaming, use existing streaming cancellation
    if (this.isStreaming && this.streamAbortController) {
      this.cancelStreaming(reason);
      return true;
    }

    // If non-streaming request in progress (including reduced motion fallback)
    if (this.processing && this._requestAbortController) {
      logInfo("Cancelling non-streaming request", { reason });

      try {
        this._requestAbortController.abort();
        this.announceToScreenReader("Request cancelled");

        if (this.showNotifications && this.notifications.info) {
          this.notifications.info("Request cancelled");
        }
      } catch (error) {
        logError("Error during request cancellation:", error);
      } finally {
        this._requestAbortController = null;
        this.processing = false;
        this._reducedMotionFallbackActive = false;
      }

      return true;
    }

    logDebug("No request in progress to cancel");
    return false;
  }

  /**
   * Check if a request is currently in progress
   *
   * Returns true for both streaming and non-streaming requests.
   * This is the public API for checking request state.
   *
   * @returns {boolean} True if a request is active
   *
   * @example
   * if (embed.isRequestInProgress()) {
   *   showCancelButton();
   * }
   */
  isRequestInProgress() {
    const inProgress = this.processing || this.isStreaming;
    logDebug("Request in progress check", {
      processing: this.processing,
      isStreaming: this.isStreaming,
      result: inProgress,
    });
    return inProgress;
  }

  /**
   * Get the current AbortController (for advanced usage)
   *
   * Returns the active abort controller for either streaming or
   * non-streaming requests. Returns null if no request is in progress.
   *
   * Note: For most use cases, prefer cancelRequest() instead.
   *
   * @returns {AbortController|null} Current abort controller or null
   *
   * @example
   * const controller = embed.getAbortController();
   * if (controller) {
   *   controller.signal.addEventListener('abort', () => {
   *     console.log('Request was aborted');
   *   });
   * }
   */
  getAbortController() {
    // Return streaming controller if streaming, otherwise request controller
    if (this.isStreaming && this.streamAbortController) {
      return this.streamAbortController;
    }
    return this._requestAbortController;
  }

  // ==========================================================================
  // STATE GETTERS
  // ==========================================================================

  /**
   * Check if request is currently processing
   * @returns {boolean}
   */
  isProcessing() {
    return this.processing;
  }

  /**
   * Get last successful response
   * @returns {Object|null}
   */
  getLastResponse() {
    return this.lastResponse;
  }

  /**
   * Get last error
   * @returns {Error|null}
   */
  getLastError() {
    return this.lastError;
  }

  /**
   * Get current configuration
   * @returns {Object}
   */
  getConfig() {
    return {
      containerId: this.containerId,
      model: this.model,
      systemPrompt: this.systemPrompt,
      temperature: this.temperature,
      max_tokens: this.max_tokens,
      top_p: this.top_p,
      showNotifications: this.showNotifications,
      enableLogging: this.enableLogging,
      // Phase 3 additions
      respectReducedMotion: this.respectReducedMotion,
      allowCancellation: this.allowCancellation,
    };
  }

  // ==========================================================================
  // DEBUG DATA COLLECTION (Phase 4)
  // ==========================================================================

  /**
   * Get debug data from the last request
   *
   * Returns comprehensive debug information including request parameters,
   * response metrics, timing data, compression info, and memory usage.
   * Returns null if no request has been made yet.
   *
   * @returns {Object|null} Debug data object or null
   *
   * @example
   * const debug = embed.getLastRequestDebug();
   * if (debug) {
   *   console.log('API call took:', debug.timing.apiCall, 'ms');
   *   console.log('Tokens used:', debug.response.tokens.total);
   * }
   */
  getLastRequestDebug() {
    return this._lastRequestDebug;
  }

  /**
   * Enable or disable debug mode
   *
   * When enabled, provides verbose logging during requests including
   * detailed timing information and debug data capture notifications.
   *
   * @param {boolean} enabled - Whether to enable debug mode
   *
   * @example
   * embed.setDebugMode(true);
   * await embed.sendRequest('Test prompt');
   * console.log(embed.getLastRequestDebug());
   */
  setDebugMode(enabled) {
    this._debugMode = !!enabled;
    logInfo(`Debug mode ${this._debugMode ? "enabled" : "disabled"}`);
  }

  /**
   * Check if debug mode is currently enabled
   *
   * @returns {boolean} True if debug mode is enabled
   *
   * @example
   * if (embed.isDebugMode()) {
   *   console.log('Verbose logging is active');
   * }
   */
  isDebugMode() {
    return this._debugMode;
  }

  // ==========================================================================
  // RETRY CONFIGURATION & EXECUTION (Stage 6 Phase 1)
  // ==========================================================================

  /**
   * Execute a function with retry logic
   *
   * @private
   * @param {Function} fn - Async function to execute
   * @param {AbortSignal} [signal] - Optional abort signal
   * @returns {Promise<any>} Result of successful execution
   */
  async _executeWithRetry(fn, signal = null) {
    if (!this._retryHandler) {
      // No retry handler, execute directly
      return fn();
    }

    // Create retry callback that shows notifications
    const onRetryCallback = (attempt, delay, error) => {
      logInfo(`Retry attempt ${attempt} in ${delay}ms`, {
        error: error.message,
        status: error.status,
      });

      // Show notification if enabled
      if (this.showNotifications && this.notifications.warning) {
        const seconds = Math.round(delay / 1000);
        this.notifications.warning(
          `Request failed, retrying in ${seconds}s (attempt ${attempt}/${this._retryConfig.maxRetries})...`
        );
      }

      // Announce to screen reader
      this.announceToScreenReader(`Retrying request, attempt ${attempt}`);

      // Call user's onRetry callback if provided
      if (typeof this._retryConfig.onRetry === "function") {
        try {
          this._retryConfig.onRetry(attempt, delay, error);
        } catch (callbackError) {
          logWarn("User onRetry callback error:", callbackError);
        }
      }
    };

    return this._retryHandler.execute(fn, { onRetry: onRetryCallback }, signal);
  }

  /**
   * Configure retry behaviour
   *
   * @param {Object} options - Retry configuration options
   * @param {boolean} [options.enabled] - Enable/disable retry
   * @param {number} [options.maxRetries] - Maximum retry attempts
   * @param {number} [options.initialDelay] - Initial delay in ms
   * @param {number} [options.maxDelay] - Maximum delay cap in ms
   * @param {number} [options.backoffMultiplier] - Delay multiplier
   * @param {boolean} [options.jitter] - Add randomness to delays
   * @param {Function} [options.onRetry] - Callback for retry events
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.configureRetry({
   *   enabled: true,
   *   maxRetries: 5,
   *   onRetry: (attempt, delay, error) => {
   *     console.log(`Retry ${attempt} in ${delay}ms due to: ${error.message}`);
   *   }
   * });
   */
  configureRetry(options) {
    if (!options || typeof options !== "object") {
      logWarn("configureRetry called with invalid options");
      return this;
    }

    // Update local config
    this._retryConfig = { ...this._retryConfig, ...options };

    // Create or update retry handler
    if (this._retryConfig.enabled) {
      if (!window.EmbedRetryHandlerClass) {
        logWarn("Cannot enable retry: EmbedRetryHandlerClass not available");
        return this;
      }

      if (!this._retryHandler) {
        this._retryHandler = new window.EmbedRetryHandlerClass(
          this._retryConfig
        );
        logInfo("Retry handler created");
      } else {
        this._retryHandler.configure(this._retryConfig);
        logInfo("Retry handler updated");
      }
    }

    logDebug("Retry configuration updated", this._retryConfig);
    return this;
  }

  /**
   * Get current retry configuration
   *
   * @returns {Object} Current retry configuration
   *
   * @example
   * const config = embed.getRetryConfig();
   * console.log('Retry enabled:', config.enabled);
   * console.log('Max retries:', config.maxRetries);
   */
  getRetryConfig() {
    return { ...this._retryConfig };
  }

  /**
   * Get retry statistics
   *
   * @returns {Object|null} Retry statistics or null if retry not enabled
   *
   * @example
   * const stats = embed.getRetryStats();
   * if (stats) {
   *   console.log('Total retries:', stats.totalRetries);
   *   console.log('Successful retries:', stats.successfulRetries);
   * }
   */
  getRetryStats() {
    if (!this._retryHandler) {
      return null;
    }
    return this._retryHandler.getStats();
  }

  /**
   * Reset retry statistics
   *
   * @example
   * embed.resetRetryStats();
   */
  resetRetryStats() {
    if (this._retryHandler) {
      this._retryHandler.resetStats();
      logDebug("Retry statistics reset");
    }
  }

  /**
   * Check if retry is currently enabled and available
   *
   * @returns {boolean} True if retry is enabled and handler is available
   *
   * @example
   * if (embed.isRetryEnabled()) {
   *   console.log('Automatic retry is active');
   * }
   */
  isRetryEnabled() {
    return this._retryConfig.enabled && !!this._retryHandler;
  }

  // ==========================================================================
  // EVENT EMITTER API (Stage 6 Phase 2)
  // ==========================================================================

  /**
   * Emit an event (internal helper)
   *
   * @private
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  _emitEvent(event, data) {
    if (this._eventEmitter) {
      try {
        this._eventEmitter.emit(event, data);
      } catch (error) {
        logWarn(`Error emitting event '${event}':`, error);
      }
    }
  }

  /**
   * Subscribe to an event
   *
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function|null} Unsubscribe function, or null if events not available
   *
   * @example
   * const unsubscribe = embed.on('beforeRequest', (data) => {
   *   console.log('Request starting:', data.userPrompt);
   * });
   * // Later: unsubscribe();
   */
  on(event, handler) {
    if (!this._eventEmitter) {
      logWarn("Events not available - EmbedEventEmitterClass not loaded");
      return null;
    }
    return this._eventEmitter.on(event, handler);
  }

  /**
   * Subscribe to an event (one-time only)
   *
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function|null} Unsubscribe function, or null if events not available
   *
   * @example
   * embed.once('streamComplete', (data) => {
   *   console.log('Stream finished:', data.fullResponse.length);
   * });
   */
  once(event, handler) {
    if (!this._eventEmitter) {
      logWarn("Events not available - EmbedEventEmitterClass not loaded");
      return null;
    }
    return this._eventEmitter.once(event, handler);
  }

  /**
   * Unsubscribe from an event
   *
   * @param {string} event - Event name
   * @param {Function} handler - Handler to remove
   * @returns {boolean} True if handler was removed
   *
   * @example
   * embed.off('error', myErrorHandler);
   */
  off(event, handler) {
    if (!this._eventEmitter) {
      return false;
    }
    return this._eventEmitter.off(event, handler);
  }

  /**
   * Remove all event listeners
   *
   * @param {string} [event] - Optional event name. If omitted, removes all listeners.
   *
   * @example
   * embed.removeAllListeners('error'); // Remove error handlers only
   * embed.removeAllListeners();        // Remove all handlers
   */
  removeAllListeners(event) {
    if (this._eventEmitter) {
      this._eventEmitter.removeAllListeners(event);
    }
  }

  /**
   * Get listener count for an event
   *
   * @param {string} event - Event name
   * @returns {number} Number of registered handlers
   */
  listenerCount(event) {
    if (!this._eventEmitter) {
      return 0;
    }
    return this._eventEmitter.listenerCount(event);
  }

  /**
   * Get all registered event names
   *
   * @returns {string[]} Array of event names with at least one handler
   */
  eventNames() {
    if (!this._eventEmitter) {
      return [];
    }
    return this._eventEmitter.eventNames();
  }

  /**
   * Check if events are enabled and available
   *
   * @returns {boolean} True if event emitter is available
   */
  isEventsEnabled() {
    return !!this._eventEmitter;
  }

  // ==========================================================================
  // POST-PROCESSOR API (Stage 6 Phase 3)
  // ==========================================================================

  /**
   * Add a post-processor to the pipeline
   *
   * @param {string} name - Unique processor name
   * @param {Function} processor - Processor function: (response, context) => processedResponse
   * @param {Object} [options] - Processor options
   * @param {number} [options.priority=100] - Execution priority (lower = earlier)
   * @param {boolean} [options.enabled=true] - Whether processor is enabled
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.addPostProcessor('extractData', (response, context) => {
   *   return { ...response, customData: parseData(response.text) };
   * }, { priority: 50 });
   */
  addPostProcessor(name, processor, options = {}) {
    if (!this._postProcessor) {
      logWarn(
        "Post-processor not available - EmbedPostProcessorClass not loaded"
      );
      return this;
    }
    this._postProcessor.add(name, processor, options);
    return this;
  }

  /**
   * Remove a post-processor from the pipeline
   *
   * @param {string} name - Processor name to remove
   * @returns {boolean} True if processor was removed
   *
   * @example
   * embed.removePostProcessor('extractData');
   */
  removePostProcessor(name) {
    if (!this._postProcessor) {
      return false;
    }
    return this._postProcessor.remove(name);
  }

  /**
   * Enable or disable a post-processor
   *
   * @param {string} name - Processor name
   * @param {boolean} enabled - Whether to enable
   * @returns {boolean} True if processor was found and updated
   *
   * @example
   * embed.setPostProcessorEnabled('sanitiseHTML', false);
   */
  setPostProcessorEnabled(name, enabled) {
    if (!this._postProcessor) {
      return false;
    }
    return this._postProcessor.setEnabled(name, enabled);
  }

  /**
   * Get list of registered post-processor names
   *
   * @returns {string[]} Processor names in priority order
   *
   * @example
   * const processors = embed.getPostProcessorNames();
   * console.log('Active processors:', processors.join(', '));
   */
  getPostProcessorNames() {
    if (!this._postProcessor) {
      return [];
    }
    return this._postProcessor.getProcessorNames();
  }

  /**
   * Add a built-in post-processor
   *
   * Convenience method to add one of the built-in processors.
   *
   * @param {string} name - Built-in processor name: 'extractJSON', 'extractLaTeX', 'sanitiseHTML', 'trim'
   * @param {Object} [options] - Processor options (priority, enabled)
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.addBuiltInPostProcessor('extractJSON', { priority: 10 });
   * embed.addBuiltInPostProcessor('sanitiseHTML', { priority: 20 });
   */
  addBuiltInPostProcessor(name, options = {}) {
    if (!this._postProcessor) {
      logWarn(
        "Post-processor not available - EmbedPostProcessorClass not loaded"
      );
      return this;
    }

    const builtIn = window.EmbedPostProcessorClass?.builtIn;
    if (!builtIn || typeof builtIn[name] !== "function") {
      logWarn(`Built-in processor '${name}' not found`);
      return this;
    }

    this._postProcessor.add(name, builtIn[name], options);
    logInfo(`Built-in post-processor '${name}' added`);
    return this;
  }

  /**
   * Check if post-processing is enabled and available
   *
   * @returns {boolean} True if post-processor is available
   *
   * @example
   * if (embed.isPostProcessorEnabled()) {
   *   embed.addBuiltInPostProcessor('extractJSON');
   * }
   */
  isPostProcessorEnabled() {
    return !!this._postProcessor;
  }

  // ==========================================================================
  // THROTTLE API (Stage 6 Phase 4)
  // ==========================================================================

  /**
   * Configure throttle behaviour
   *
   * @param {Object} options - Throttle configuration
   * @param {number} [options.debounceDelay] - Debounce delay in ms (0 = disabled)
   * @param {number} [options.throttleInterval] - Min time between requests in ms (0 = disabled)
   * @param {number} [options.maxConcurrent] - Max concurrent requests
   * @param {Function} [options.onThrottled] - Callback when request is throttled
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.configureThrottle({
   *   throttleInterval: 1000,  // 1 request per second
   *   maxConcurrent: 2,        // Allow 2 concurrent requests
   *   onThrottled: (waitTime, reason) => {
   *     console.log(`Throttled for ${waitTime}ms: ${reason}`);
   *     return true; // Allow waiting (return false to reject)
   *   }
   * });
   */
  configureThrottle(options) {
    if (!options || typeof options !== "object") {
      logWarn("configureThrottle called with invalid options");
      return this;
    }

    // Update local config
    this._throttleConfig = { ...this._throttleConfig, ...options };

    // Create or update throttle handler
    if (!window.EmbedThrottleClass) {
      logWarn("Cannot configure throttle: EmbedThrottleClass not available");
      return this;
    }

    if (!this._throttleHandler) {
      this._throttleHandler = new window.EmbedThrottleClass(
        this._throttleConfig
      );

      // Connect event emitter if available
      if (this._eventEmitter) {
        this._throttleHandler._emitEvent = (event, data) => {
          this._emitEvent(event, data);
        };
      }

      logInfo("Throttle handler created");
    } else {
      this._throttleHandler.configure(this._throttleConfig);
      logInfo("Throttle handler updated");
    }

    logDebug("Throttle configuration updated", this._throttleConfig);
    return this;
  }

  /**
   * Get current throttle configuration
   *
   * @returns {Object} Current throttle configuration
   *
   * @example
   * const config = embed.getThrottleConfig();
   * console.log('Throttle interval:', config.throttleInterval);
   */
  getThrottleConfig() {
    return { ...this._throttleConfig };
  }

  /**
   * Get throttle statistics
   *
   * @returns {Object|null} Throttle statistics or null if throttle not available
   *
   * @example
   * const stats = embed.getThrottleStats();
   * if (stats) {
   *   console.log('Throttled count:', stats.throttledCount);
   *   console.log('Total requests:', stats.totalRequests);
   * }
   */
  getThrottleStats() {
    if (!this._throttleHandler) {
      return null;
    }
    return this._throttleHandler.getStats();
  }

  /**
   * Reset throttle statistics
   *
   * @example
   * embed.resetThrottleStats();
   */
  resetThrottleStats() {
    if (this._throttleHandler) {
      this._throttleHandler.resetStats();
      logDebug("Throttle statistics reset");
    }
  }

  /**
   * Check if throttle is currently enabled and active
   *
   * Throttle is considered enabled if the handler is available AND
   * at least one throttling feature is configured (debounce, throttle interval,
   * or concurrent limit less than Infinity).
   *
   * @returns {boolean} True if throttle is enabled and active
   *
   * @example
   * if (embed.isThrottleEnabled()) {
   *   console.log('Request throttling is active');
   * }
   */
  isThrottleEnabled() {
    return !!(
      this._throttleHandler &&
      (this._throttleConfig.debounceDelay > 0 ||
        this._throttleConfig.throttleInterval > 0 ||
        this._throttleConfig.maxConcurrent < Infinity)
    );
  }

  /**
   * Check if a request can proceed immediately (not throttled)
   *
   * @returns {boolean} True if request can proceed without waiting
   *
   * @example
   * if (embed.canProceedWithRequest()) {
   *   await embed.sendStreamingRequest({ userPrompt: 'Hello' });
   * } else {
   *   console.log('Request would be throttled');
   * }
   */
  canProceedWithRequest() {
    if (!this._throttleHandler) {
      return true; // No throttle = always can proceed
    }
    return this._throttleHandler.canProceed();
  }

  /**
   * Get time until next request is allowed
   *
   * @returns {number} Wait time in ms (0 if can proceed now)
   *
   * @example
   * const waitTime = embed.getThrottleWaitTime();
   * if (waitTime > 0) {
   *   console.log(`Must wait ${waitTime}ms before next request`);
   * }
   */
  getThrottleWaitTime() {
    if (!this._throttleHandler) {
      return 0;
    }
    return this._throttleHandler.getWaitTime();
  }

  // ==========================================================================
  // CACHE API (Stage 6 Phase 5)
  // ==========================================================================

  /**
   * Configure cache behaviour
   *
   * @param {Object} options - Cache configuration
   * @param {boolean} [options.enabled] - Enable caching
   * @param {number} [options.maxEntries] - Maximum cached responses
   * @param {number} [options.ttl] - Time-to-live in ms
   * @param {Function} [options.keyGenerator] - Custom key generator: (request) => string
   * @param {string} [options.storage] - 'memory' or 'sessionStorage'
   * @param {string[]} [options.excludeModels] - Models to never cache
   * @param {Function} [options.onCacheHit] - Callback: (key, response) => void
   * @param {Function} [options.onCacheMiss] - Callback: (key) => void
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.configureCache({
   *   enabled: true,
   *   maxEntries: 50,
   *   ttl: 1800000, // 30 minutes
   *   onCacheHit: (key, response) => {
   *     console.log('Cache hit:', key);
   *   }
   * });
   */
  configureCache(options) {
    if (!options || typeof options !== "object") {
      logWarn("configureCache called with invalid options");
      return this;
    }

    // Update local config
    this._cacheConfig = { ...this._cacheConfig, ...options };

    // Create or update cache handler
    if (this._cacheConfig.enabled) {
      if (!window.EmbedCacheClass) {
        logWarn("Cannot enable cache: EmbedCacheClass not available");
        return this;
      }

      if (!this._cacheHandler) {
        this._cacheHandler = new window.EmbedCacheClass(this._cacheConfig);

        // Connect event emitter if available
        if (this._eventEmitter) {
          this._cacheHandler._emitEvent = (event, data) => {
            this._emitEvent(event, data);
          };
        }

        logInfo("Cache handler created");
      } else {
        this._cacheHandler.configure(this._cacheConfig);
        logInfo("Cache handler updated");
      }
    }

    logDebug("Cache configuration updated", this._cacheConfig);
    return this;
  }

  /**
   * Get current cache configuration
   *
   * @returns {Object} Current cache configuration
   *
   * @example
   * const config = embed.getCacheConfig();
   * console.log('Cache enabled:', config.enabled);
   * console.log('TTL:', config.ttl);
   */
  getCacheConfig() {
    return { ...this._cacheConfig };
  }

  /**
   * Get cache statistics
   *
   * @returns {Object|null} Cache statistics or null if cache not available
   *
   * @example
   * const stats = embed.getCacheStats();
   * if (stats) {
   *   console.log('Cache size:', stats.size);
   *   console.log('Hit rate:', (stats.hitRate * 100).toFixed(1) + '%');
   * }
   */
  getCacheStats() {
    if (!this._cacheHandler) {
      return null;
    }
    return this._cacheHandler.getStats();
  }

  /**
   * Clear all cached responses
   *
   * @example
   * embed.clearCache();
   */
  clearCache() {
    if (this._cacheHandler) {
      this._cacheHandler.clear();
      logDebug("Cache cleared");
    }
  }

  /**
   * Check if cache is currently enabled and available
   *
   * @returns {boolean} True if cache is enabled and handler is available
   *
   * @example
   * if (embed.isCacheEnabled()) {
   *   console.log('Response caching is active');
   * }
   */
  isCacheEnabled() {
    return this._cacheConfig.enabled && !!this._cacheHandler;
  }

  // ==========================================================================
  // PREPROCESSOR API (Stage 6 Phase 6)
  // ==========================================================================

  /**
   * Configure preprocessor behaviour
   *
   * @param {Object} options - Preprocessor configuration
   * @param {boolean} [options.enabled] - Enable preprocessing
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.configurePreprocessor({ enabled: true });
   */
  configurePreprocessor(options) {
    if (!options || typeof options !== "object") {
      logWarn("configurePreprocessor called with invalid options");
      return this;
    }

    this._preprocessConfig = { ...this._preprocessConfig, ...options };
    logDebug("Preprocessor configuration updated", this._preprocessConfig);
    return this;
  }

  /**
   * Add a preprocessor to the pipeline
   *
   * @param {string} name - Unique processor name
   * @param {Function} processor - Processor function: (request, context) => request
   * @param {Object} [options={}] - Processor options
   * @param {number} [options.priority=100] - Priority (lower = earlier)
   * @param {boolean} [options.enabled=true] - Whether processor is enabled
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.addPreprocessor('trim', EmbedPreProcessorClass.builtIn.trim, { priority: 10 });
   */
  addPreprocessor(name, processor, options = {}) {
    if (!this._preProcessor) {
      logWarn("Cannot add preprocessor: EmbedPreProcessorClass not available");
      return this;
    }

    try {
      this._preProcessor.add(name, processor, options);
      logDebug(`Preprocessor '${name}' added`);
    } catch (e) {
      logError(`Failed to add preprocessor '${name}':`, e);
    }

    return this;
  }

  /**
   * Remove a preprocessor from the pipeline
   *
   * @param {string} name - Processor name to remove
   * @returns {boolean} True if processor was removed
   *
   * @example
   * embed.removePreprocessor('trim');
   */
  removePreprocessor(name) {
    if (!this._preProcessor) {
      return false;
    }
    return this._preProcessor.remove(name);
  }

  /**
   * Enable or disable a preprocessor
   *
   * @param {string} name - Processor name
   * @param {boolean} enabled - Whether to enable
   * @returns {boolean} True if processor was found and updated
   *
   * @example
   * embed.setPreprocessorEnabled('sanitise', false);
   */
  setPreprocessorEnabled(name, enabled) {
    if (!this._preProcessor) {
      return false;
    }
    return this._preProcessor.setEnabled(name, enabled);
  }

  /**
   * Get list of registered preprocessor names
   *
   * @returns {string[]} Processor names in priority order
   *
   * @example
   * const processors = embed.getPreprocessorNames();
   * console.log('Active:', processors.join(', '));
   */
  getPreprocessorNames() {
    if (!this._preProcessor) {
      return [];
    }
    return this._preProcessor.getProcessorNames();
  }

  /**
   * Check if preprocessing is currently enabled
   *
   * @returns {boolean} True if preprocessing is enabled and handler is available
   *
   * @example
   * if (embed.isPreprocessorEnabled()) {
   *   console.log('Request preprocessing is active');
   * }
   */
  isPreprocessorEnabled() {
    return this._preprocessConfig.enabled && !!this._preProcessor;
  }

  // ==========================================================================
  // QUEUE API (Stage 6 Phase 7)
  // ==========================================================================

  /**
   * Configure queue behaviour
   *
   * @param {Object} options - Queue configuration
   * @param {boolean} [options.enabled] - Enable/disable queue
   * @param {number} [options.maxSize] - Maximum queue size
   * @param {number} [options.concurrency] - Max concurrent requests
   * @param {string} [options.defaultPriority] - Default priority level
   * @param {Function} [options.onQueueChange] - Queue change callback
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.configureQueue({ enabled: true, concurrency: 2 });
   */
  configureQueue(options) {
    if (!options || typeof options !== "object") {
      logWarn("configureQueue called with invalid options");
      return this;
    }

    // Update local config
    this._queueConfig = { ...this._queueConfig, ...options };

    // Create or update queue handler
    if (this._queueConfig.enabled) {
      if (!window.EmbedQueueClass) {
        logWarn("Cannot enable queue: EmbedQueueClass not available");
        return this;
      }

      if (!this._queueHandler) {
        this._queueHandler = new window.EmbedQueueClass(this._queueConfig);

        // Connect event emitter if available
        if (this._eventEmitter) {
          this._queueHandler._emitEvent = (event, data) => {
            this._emitEvent(event, data);
          };
        }

        // Set executor
        this._queueHandler.setExecutor(async (request) => {
          return await this._executeQueuedRequest(request);
        });

        logInfo("Queue handler created");
      } else {
        this._queueHandler.configure(this._queueConfig);
        logInfo("Queue handler updated");
      }
    }

    logDebug("Queue configuration updated", this._queueConfig);
    return this;
  }

  /**
   * Get current queue configuration
   *
   * @returns {Object} Current queue configuration
   *
   * @example
   * const config = embed.getQueueConfig();
   * console.log('Queue enabled:', config.enabled);
   */
  getQueueConfig() {
    return { ...this._queueConfig };
  }

  /**
   * Add request to queue
   *
   * @param {Object} request - Request data
   * @param {string} [request.userPrompt] - User prompt
   * @param {string} [request.systemPrompt] - System prompt
   * @param {Object} [options={}] - Queue options
   * @param {string} [options.priority='normal'] - Priority level
   * @returns {Promise<Object>} Promise that resolves with response
   *
   * @example
   * const response = await embed.enqueueRequest({
   *   userPrompt: 'Hello'
   * }, { priority: 'high' });
   */
  async enqueueRequest(request, options = {}) {
    if (!this._queueHandler) {
      return Promise.reject(new Error("Queue handler not available"));
    }

    if (!this._queueConfig.enabled) {
      return Promise.reject(new Error("Queue is not enabled"));
    }

    return this._queueHandler.enqueue(request, options);
  }

  /**
   * Get current queue length
   *
   * @returns {number} Number of pending items
   *
   * @example
   * console.log(`${embed.getQueueLength()} items waiting`);
   */
  getQueueLength() {
    if (!this._queueHandler) {
      return 0;
    }
    return this._queueHandler.getLength();
  }

  /**
   * Get queue items for display
   *
   * @returns {Array<Object>} Queue items sorted by priority
   *
   * @example
   * const items = embed.getQueueItems();
   * items.forEach(item => console.log(item.id, item.priority));
   */
  getQueueItems() {
    if (!this._queueHandler) {
      return [];
    }
    return this._queueHandler.getItems();
  }

  /**
   * Clear all queued requests
   *
   * @returns {number} Number of items cleared
   *
   * @example
   * const cleared = embed.clearQueue();
   * console.log(`Cleared ${cleared} items`);
   */
  clearQueue() {
    if (!this._queueHandler) {
      return 0;
    }
    return this._queueHandler.clear();
  }

  /**
   * Pause queue processing
   *
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.pauseQueue();
   */
  pauseQueue() {
    if (this._queueHandler) {
      this._queueHandler.pause();
    }
    return this;
  }

  /**
   * Resume queue processing
   *
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.resumeQueue();
   */
  resumeQueue() {
    if (this._queueHandler) {
      this._queueHandler.resume();
    }
    return this;
  }

  /**
   * Check if queue is paused
   *
   * @returns {boolean} True if paused
   *
   * @example
   * if (embed.isQueuePaused()) {
   *   console.log('Queue is paused');
   * }
   */
  isQueuePaused() {
    if (!this._queueHandler) {
      return false;
    }
    return this._queueHandler.isPaused();
  }

  /**
   * Get queue statistics
   *
   * @returns {Object|null} Queue statistics or null if not available
   *
   * @example
   * const stats = embed.getQueueStats();
   * console.log('Pending:', stats.pending);
   * console.log('Completed:', stats.completed);
   */
  getQueueStats() {
    if (!this._queueHandler) {
      return null;
    }
    return this._queueHandler.getStats();
  }

  /**
   * Check if queue is currently enabled and available
   *
   * @returns {boolean} True if queue is enabled and handler is available
   *
   * @example
   * if (embed.isQueueEnabled()) {
   *   console.log('Request queue is active');
   * }
   */
  isQueueEnabled() {
    return this._queueConfig.enabled && !!this._queueHandler;
  }

  // ==========================================================================
  // HEALTH MONITOR API (Stage 6 Phase 8)
  // ==========================================================================

  /**
   * Configure health monitoring
   *
   * @param {Object} options - Health configuration
   * @param {boolean} [options.enabled] - Enable health monitoring
   * @param {number} [options.checkInterval] - Check interval (ms)
   * @param {number} [options.timeout] - Check timeout (ms)
   * @param {number} [options.unhealthyThreshold] - Failures before unhealthy
   * @param {Function} [options.onStatusChange] - Status change callback
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.configureHealth({
   *   enabled: true,
   *   checkInterval: 60000,
   *   onStatusChange: (status) => console.log('Health:', status.status)
   * });
   */
  configureHealth(options) {
    if (!options || typeof options !== "object") {
      logWarn("configureHealth called with invalid options");
      return this;
    }

    // Update local config
    this._healthConfig = { ...this._healthConfig, ...options };

    // Create or update health monitor
    if (this._healthConfig.enabled) {
      if (!window.EmbedHealthMonitorClass) {
        logWarn(
          "Cannot enable health monitoring: EmbedHealthMonitorClass not available"
        );
        return this;
      }

      if (!this._healthMonitor) {
        this._healthMonitor = new window.EmbedHealthMonitorClass(
          this._healthConfig
        );

        // Connect event emitter if available
        if (this._eventEmitter) {
          this._healthMonitor._emitEvent = (event, data) => {
            this._emitEvent(event, data);
          };
        }

        this._healthMonitor.start();
        logInfo("Health monitor created and started");
      } else {
        this._healthMonitor.configure(this._healthConfig);
        if (!this._healthMonitor.isMonitoring()) {
          this._healthMonitor.start();
        }
        logInfo("Health monitor updated");
      }
    } else if (this._healthMonitor) {
      this._healthMonitor.stop();
      logInfo("Health monitoring stopped");
    }

    logDebug("Health configuration updated", this._healthConfig);
    return this;
  }

  /**
   * Get current health configuration
   *
   * @returns {Object} Current health configuration
   *
   * @example
   * const config = embed.getHealthConfig();
   * console.log('Health enabled:', config.enabled);
   */
  getHealthConfig() {
    return { ...this._healthConfig };
  }

  /**
   * Start health monitoring
   *
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.startHealthMonitoring();
   */
  startHealthMonitoring() {
    if (!this._healthMonitor) {
      logWarn("Health monitor not available");
      return this;
    }
    this._healthMonitor.configure({ enabled: true });
    this._healthMonitor.start();
    this._healthConfig.enabled = true;
    return this;
  }

  /**
   * Stop health monitoring
   *
   * @returns {OpenRouterEmbed} For chaining
   *
   * @example
   * embed.stopHealthMonitoring();
   */
  stopHealthMonitoring() {
    if (!this._healthMonitor) {
      return this;
    }
    this._healthMonitor.stop();
    this._healthConfig.enabled = false;
    return this;
  }

  /**
   * Perform an immediate health check
   *
   * @returns {Promise<Object>} Health status object
   *
   * @example
   * const status = await embed.checkHealth();
   * console.log('Status:', status.status, 'Latency:', status.latency);
   */
  async checkHealth() {
    if (!this._healthMonitor) {
      return {
        status: "unknown",
        latency: 0,
        lastCheck: null,
        consecutiveFailures: 0,
        lastError: new Error("Health monitor not available"),
      };
    }
    return this._healthMonitor.check();
  }

  /**
   * Get current health status
   *
   * @returns {Object} Health status object
   *
   * @example
   * const status = embed.getHealthStatus();
   * if (status.status === 'unhealthy') {
   *   showConnectivityWarning();
   * }
   */
  getHealthStatus() {
    if (!this._healthMonitor) {
      return {
        status: "unknown",
        latency: 0,
        lastCheck: null,
        consecutiveFailures: 0,
        lastError: null,
      };
    }
    return this._healthMonitor.getStatus();
  }

  /**
   * Quick check if API is healthy
   *
   * @returns {boolean} True if API is healthy
   *
   * @example
   * if (embed.isHealthy()) {
   *   await embed.sendRequest(prompt);
   * }
   */
  isHealthy() {
    if (!this._healthMonitor) {
      return true; // Assume healthy if no monitor
    }
    return this._healthMonitor.isHealthy();
  }

  /**
   * Check if health monitoring is enabled
   *
   * @returns {boolean} True if health monitoring is enabled and active
   *
   * @example
   * console.log('Health monitoring:', embed.isHealthMonitorEnabled());
   */
  isHealthMonitorEnabled() {
    return this._healthConfig.enabled && !!this._healthMonitor;
  }

  /**
   * Execute a queued request (internal)
   *
   * This is called by the queue handler to actually send the request.
   * Sets _executingQueuedRequest flag to bypass the _isProcessing guard,
   * allowing queue concurrency > 1 to work correctly.
   *
   * @private
   * @param {Object} request - Request data
   * @returns {Promise<Object>} Response
   */
  async _executeQueuedRequest(request) {
    this._executingQueuedRequest = true;
    try {
      return await this.sendRequest(
        request.userPrompt,
        request.systemPrompt,
        request
      );
    } finally {
      this._executingQueuedRequest = false;
    }
  }
}

// ============================================================================
// GLOBAL EXPOSURE
// ============================================================================

window.OpenRouterEmbed = OpenRouterEmbed;

export { OpenRouterEmbed };
