/**
 * OpenRouter Embed API - Pre-Processor (Stage 6 Phase 6)
 *
 * Provides a request pre-processing pipeline for transforming
 * requests before they're sent, enabling standardised request
 * preparation, input sanitisation, and context injection.
 *
 * Features:
 * - Configurable processor pipeline with priority ordering
 * - Built-in processors: sanitiseInput, addTimestamp, trim
 * - Error isolation (one processor failure doesn't break others)
 * - Async processor support
 * - Enable/disable processors at runtime
 * - Processing metadata tracking
 *
 * @version 1.0.0 (Stage 6 Phase 6)
 * @date 01 December 2025
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[EmbedPreProcessor ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedPreProcessor WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedPreProcessor INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedPreProcessor DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // BUILT-IN PROCESSORS
  // ============================================================================

  /**
   * Built-in processors for common request transformations
   */
  const builtInProcessors = {
    /**
     * Sanitise user input by removing potentially dangerous content
     * Removes null bytes, control characters, and normalises whitespace
     *
     * @param {Object} request - Request object
     * @param {Object} context - Processing context
     * @returns {Object} Request with sanitised userPrompt
     */
    sanitiseInput: (request, context) => {
      const result = { ...request };

      if (!result.userPrompt || typeof result.userPrompt !== "string") {
        return result;
      }

      let sanitised = result.userPrompt;

      // Remove null bytes (security risk)
      sanitised = sanitised.replace(/\0/g, "");

      // Remove control characters except newlines and tabs
      // eslint-disable-next-line no-control-regex
      sanitised = sanitised.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

      // Normalise multiple spaces to single space (but preserve newlines)
      sanitised = sanitised.replace(/[^\S\n]+/g, " ");

      // Remove leading/trailing whitespace from each line
      sanitised = sanitised
        .split("\n")
        .map((line) => line.trim())
        .join("\n");

      result.userPrompt = sanitised;

      logDebug("sanitiseInput: input sanitised", {
        originalLength: request.userPrompt.length,
        sanitisedLength: sanitised.length,
      });

      return result;
    },

    /**
     * Add timestamp to system prompt for context
     * Useful for time-sensitive queries
     *
     * @param {Object} request - Request object
     * @param {Object} context - Processing context
     * @returns {Object} Request with timestamp added to systemPrompt
     */
    addTimestamp: (request, context) => {
      const result = { ...request };

      const now = new Date();
      const timestamp = now.toISOString();
      const dateString = now.toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const timeString = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const timestampNote = `[Current date and time: ${dateString} at ${timeString} (${timestamp})]`;

      if (result.systemPrompt) {
        result.systemPrompt = `${result.systemPrompt}\n\n${timestampNote}`;
      } else {
        result.systemPrompt = timestampNote;
      }

      logDebug("addTimestamp: timestamp added", { timestamp });

      return result;
    },

    /**
     * Trim whitespace from prompts
     * Simple utility processor for clean input
     *
     * @param {Object} request - Request object
     * @param {Object} context - Processing context
     * @returns {Object} Request with trimmed prompts
     */
    trim: (request, context) => {
      const result = { ...request };

      if (result.userPrompt && typeof result.userPrompt === "string") {
        result.userPrompt = result.userPrompt.trim();
      }

      if (result.systemPrompt && typeof result.systemPrompt === "string") {
        result.systemPrompt = result.systemPrompt.trim();
      }

      logDebug("trim: prompts trimmed");

      return result;
    },

    /**
     * Validate and normalise model selection
     * Ensures model string is properly formatted
     *
     * @param {Object} request - Request object
     * @param {Object} context - Processing context
     * @returns {Object} Request with normalised model
     */
    normaliseModel: (request, context) => {
      const result = { ...request };

      if (result.model && typeof result.model === "string") {
        // Trim whitespace
        result.model = result.model.trim();

        // Convert to lowercase for consistency
        result.model = result.model.toLowerCase();
      }

      logDebug("normaliseModel: model normalised", { model: result.model });

      return result;
    },

    /**
     * Clamp numeric parameters to valid ranges
     * Ensures temperature, top_p, and max_tokens are within bounds
     *
     * @param {Object} request - Request object
     * @param {Object} context - Processing context
     * @returns {Object} Request with clamped parameters
     */
    clampParameters: (request, context) => {
      const result = { ...request };

      // Temperature: 0.0 to 2.0
      if (typeof result.temperature === "number") {
        result.temperature = Math.max(0, Math.min(2, result.temperature));
      }

      // Top-p: 0.0 to 1.0
      if (typeof result.top_p === "number") {
        result.top_p = Math.max(0, Math.min(1, result.top_p));
      }

      // Max tokens: 1 to reasonable max (128k)
      if (typeof result.max_tokens === "number") {
        result.max_tokens = Math.max(1, Math.min(128000, result.max_tokens));
      }

      logDebug("clampParameters: parameters clamped", {
        temperature: result.temperature,
        top_p: result.top_p,
        max_tokens: result.max_tokens,
      });

      return result;
    },
  };

  // ============================================================================
  // EMBED PRE-PROCESSOR CLASS
  // ============================================================================

  /**
   * Request pre-processing pipeline manager
   *
   * Manages a chain of processors that transform requests before
   * they're sent to the API. Processors are executed in priority order.
   *
   * @example
   * const preProcessor = new EmbedPreProcessor();
   *
   * // Add custom processor
   * preProcessor.add('addContext', (request, context) => {
   *   return { ...request, context: context.extra };
   * }, { priority: 5 });
   *
   * // Add built-in processor
   * preProcessor.add('sanitise', EmbedPreProcessor.builtIn.sanitiseInput);
   *
   * // Process request
   * const processed = await preProcessor.process({
   *   userPrompt: 'Hello world',
   *   systemPrompt: 'You are helpful'
   * });
   */
  class EmbedPreProcessor {
    /**
     * Create a new EmbedPreProcessor instance
     */
    constructor() {
      /**
       * Map of processor name to processor entry
       * @private
       * @type {Map<string, {name: string, processor: Function, priority: number, enabled: boolean}>}
       */
      this._processors = new Map();

      logDebug("EmbedPreProcessor instance created");
    }

    // ==========================================================================
    // PROCESSOR MANAGEMENT
    // ==========================================================================

    /**
     * Add a processor to the pipeline
     *
     * @param {string} name - Unique processor name
     * @param {Function} processor - Processor function: (request, context) => request
     * @param {Object} [options={}] - Processor options
     * @param {number} [options.priority=100] - Priority (lower = earlier, default 100)
     * @param {boolean} [options.enabled=true] - Whether processor is enabled
     * @returns {EmbedPreProcessor} For chaining
     * @throws {Error} If name or processor is invalid
     *
     * @example
     * // Add with default priority
     * preProcessor.add('myProcessor', (req) => ({ ...req, modified: true }));
     *
     * // Add with high priority (runs early)
     * preProcessor.add('validate', validateFn, { priority: 10 });
     *
     * // Add disabled (can enable later)
     * preProcessor.add('debug', debugFn, { enabled: false });
     */
    add(name, processor, options = {}) {
      // Validate name
      if (typeof name !== "string" || !name.trim()) {
        throw new Error("Processor name must be a non-empty string");
      }

      // Validate processor
      if (typeof processor !== "function") {
        throw new Error("Processor must be a function");
      }

      const processorName = name.trim();
      const { priority = 100, enabled = true } = options;

      // Validate priority
      if (typeof priority !== "number" || !Number.isFinite(priority)) {
        throw new Error("Priority must be a finite number");
      }

      // Store processor entry
      this._processors.set(processorName, {
        name: processorName,
        processor,
        priority,
        enabled: !!enabled,
      });

      logDebug(`Processor '${processorName}' added`, { priority, enabled });

      return this;
    }

    /**
     * Remove a processor from the pipeline
     *
     * @param {string} name - Processor name to remove
     * @returns {boolean} True if processor was removed, false if not found
     *
     * @example
     * preProcessor.remove('myProcessor');
     */
    remove(name) {
      if (typeof name !== "string" || !name.trim()) {
        logWarn("remove() called with invalid name");
        return false;
      }

      const processorName = name.trim();
      const removed = this._processors.delete(processorName);

      if (removed) {
        logDebug(`Processor '${processorName}' removed`);
      } else {
        logDebug(`Processor '${processorName}' not found for removal`);
      }

      return removed;
    }

    /**
     * Enable or disable a processor
     *
     * @param {string} name - Processor name
     * @param {boolean} enabled - Whether to enable
     * @returns {boolean} True if processor was found and updated
     *
     * @example
     * preProcessor.setEnabled('sanitiseInput', false);
     */
    setEnabled(name, enabled) {
      if (typeof name !== "string" || !name.trim()) {
        logWarn("setEnabled() called with invalid name");
        return false;
      }

      const processorName = name.trim();
      const processorEntry = this._processors.get(processorName);

      if (!processorEntry) {
        logDebug(`Processor '${processorName}' not found`);
        return false;
      }

      processorEntry.enabled = !!enabled;
      logDebug(
        `Processor '${processorName}' ${enabled ? "enabled" : "disabled"}`
      );

      return true;
    }

    /**
     * Check if a processor is enabled
     *
     * @param {string} name - Processor name
     * @returns {boolean} True if enabled, false if disabled or not found
     *
     * @example
     * if (preProcessor.isEnabled('sanitiseInput')) {
     *   console.log('Input sanitisation is active');
     * }
     */
    isEnabled(name) {
      if (typeof name !== "string" || !name.trim()) {
        return false;
      }

      const processorEntry = this._processors.get(name.trim());
      return processorEntry ? processorEntry.enabled : false;
    }

    /**
     * Get list of registered processor names (sorted by priority)
     *
     * @returns {string[]} Processor names in priority order
     *
     * @example
     * const names = preProcessor.getProcessorNames();
     * console.log('Active processors:', names.join(', '));
     */
    getProcessorNames() {
      return this._getSortedProcessors().map((p) => p.name);
    }

    /**
     * Get processor info
     *
     * @param {string} name - Processor name
     * @returns {Object|null} Processor info or null if not found
     *
     * @example
     * const info = preProcessor.getProcessor('sanitiseInput');
     * console.log('Priority:', info.priority);
     */
    getProcessor(name) {
      if (typeof name !== "string" || !name.trim()) {
        return null;
      }

      const processorEntry = this._processors.get(name.trim());
      if (!processorEntry) {
        return null;
      }

      // Return copy without the processor function for safety
      return {
        name: processorEntry.name,
        priority: processorEntry.priority,
        enabled: processorEntry.enabled,
      };
    }

    /**
     * Remove all processors
     *
     * @example
     * preProcessor.clear();
     */
    clear() {
      const count = this._processors.size;
      this._processors.clear();
      logDebug(`All processors cleared (${count} removed)`);
    }

    // ==========================================================================
    // PROCESSING
    // ==========================================================================

    /**
     * Process request through all enabled processors
     *
     * @param {Object} request - Request object with userPrompt, systemPrompt, etc.
     * @param {Object} [context={}] - Additional context for processors
     * @returns {Promise<Object>} Processed request with added metadata
     *
     * @example
     * const processed = await preProcessor.process({
     *   userPrompt: '  Hello world  ',
     *   systemPrompt: 'You are helpful'
     * });
     * console.log('Processed prompt:', processed.userPrompt);
     * console.log('Processors run:', processed.preprocessed.processors);
     */
    async process(request, context = {}) {
      const startTime = performance.now();
      const processedBy = [];

      // Start with a copy of the request
      let result = { ...request };

      // Get enabled processors sorted by priority
      const processors = this._getSortedProcessors().filter((p) => p.enabled);

      logDebug(`Processing request through ${processors.length} processor(s)`);

      // Process through each enabled processor
      for (const { name, processor } of processors) {
        try {
          logDebug(`Running processor '${name}'`);

          // Handle both sync and async processors
          const processed = await Promise.resolve(processor(result, context));

          // Validate processor returned an object
          if (processed && typeof processed === "object") {
            result = processed;
            processedBy.push(name);
          } else {
            logWarn(`Processor '${name}' returned invalid result, skipping`);
          }
        } catch (error) {
          // Log error but continue to next processor (error isolation)
          logError(`Processor '${name}' failed:`, error);
          // Continue processing - don't add to processedBy
        }
      }

      // Add processing metadata
      result.preprocessed = {
        processors: processedBy,
        timestamp: new Date(),
        duration: Math.round(performance.now() - startTime),
      };

      logDebug("Preprocessing complete", {
        processorsRun: processedBy.length,
        duration: result.preprocessed.duration,
      });

      return result;
    }

    // ==========================================================================
    // INTERNAL METHODS
    // ==========================================================================

    /**
     * Get processors sorted by priority (lower = earlier)
     *
     * @private
     * @returns {Array} Sorted processor entries
     */
    _getSortedProcessors() {
      return Array.from(this._processors.values()).sort(
        (a, b) => a.priority - b.priority
      );
    }
  }

  // ============================================================================
  // ATTACH BUILT-IN PROCESSORS
  // ============================================================================

  // Attach built-in processors as static property
  EmbedPreProcessor.builtIn = builtInProcessors;

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const embedPreProcessor = new EmbedPreProcessor();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Expose singleton instance for convenience
  window.EmbedPreProcessor = embedPreProcessor;

  // Also expose class for testing and custom instances
  window.EmbedPreProcessorClass = EmbedPreProcessor;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Pre-Processor (Stage 6 Phase 6) loaded");
  logInfo("Available as: window.EmbedPreProcessor (singleton instance)");
  logInfo("Class available as: window.EmbedPreProcessorClass");
  logInfo(
    "Built-in processors: sanitiseInput, addTimestamp, trim, normaliseModel, clampParameters"
  );
})();
