/**
 * OpenRouter Embed API - Post-Processor (Stage 6 Phase 3)
 *
 * Provides a response post-processing pipeline for transforming
 * AI responses, enabling structured data extraction and sanitisation.
 *
 * Features:
 * - Configurable processor pipeline with priority ordering
 * - Built-in processors: JSON extraction, LaTeX extraction, HTML sanitisation, trim
 * - Error isolation (one processor failure doesn't break others)
 * - Async processor support
 * - Enable/disable processors at runtime
 * - Processing metadata tracking
 *
 * @version 1.0.0 (Stage 6 Phase 3)
 * @date 30 November 2025
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
      console.error(`[EmbedPostProcessor ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedPostProcessor WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedPostProcessor INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedPostProcessor DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // BUILT-IN PROCESSORS
  // ============================================================================

  /**
   * Built-in processors for common transformations
   */
  const builtInProcessors = {
    /**
     * Extract JSON from markdown code blocks
     * Looks for ```json ... ``` blocks and parses them
     *
     * @param {Object} response - Response object
     * @param {Object} context - Processing context
     * @returns {Object} Response with extractedJSON array added
     */
    extractJSON: (response, context) => {
      const result = { ...response };
      const jsonBlocks = [];

      // Get text to search
      const text = response.text || response.markdown || "";

      if (!text) {
        result.extractedJSON = jsonBlocks;
        return result;
      }

      // Match ```json ... ``` blocks (case-insensitive, multiline)
      const jsonRegex = /```json\s*([\s\S]*?)```/gi;
      let match;

      while ((match = jsonRegex.exec(text)) !== null) {
        const jsonContent = match[1].trim();
        if (jsonContent) {
          try {
            const parsed = JSON.parse(jsonContent);
            jsonBlocks.push(parsed);
            logDebug("Extracted JSON block", {
              preview: jsonContent.substring(0, 50),
            });
          } catch (e) {
            logDebug("Failed to parse JSON block:", e.message);
          }
        }
      }

      result.extractedJSON = jsonBlocks;
      logDebug(`extractJSON: found ${jsonBlocks.length} JSON block(s)`);

      return result;
    },

    /**
     * Extract LaTeX expressions from response
     * Supports $...$ (inline), $$...$$ (block), \(...\), and \[...\]
     *
     * @param {Object} response - Response object
     * @param {Object} context - Processing context
     * @returns {Object} Response with extractedLaTeX array added
     */
    extractLaTeX: (response, context) => {
      const result = { ...response };
      const latexExpressions = [];

      // Get text to search
      const text = response.text || response.markdown || "";

      if (!text) {
        result.extractedLaTeX = latexExpressions;
        return result;
      }

      // Track positions to avoid double-extraction
      const extractedRanges = [];

      const addIfNotOverlapping = (startIndex, endIndex, expr) => {
        // Check if this range overlaps with any existing extraction
        for (const range of extractedRanges) {
          if (!(endIndex <= range.start || startIndex >= range.end)) {
            return false; // Overlapping
          }
        }
        extractedRanges.push({ start: startIndex, end: endIndex });
        latexExpressions.push(expr);
        return true;
      };

      // Block LaTeX: $$...$$ (must check before inline $...$)
      const blockDollarRegex = /\$\$([\s\S]*?)\$\$/g;
      let match;

      while ((match = blockDollarRegex.exec(text)) !== null) {
        const content = match[1].trim();
        if (content) {
          addIfNotOverlapping(match.index, match.index + match[0].length, {
            type: "block",
            content: content,
            raw: match[0],
          });
        }
      }

      // Block LaTeX: \[...\]
      const blockBracketRegex = /\\\[([\s\S]*?)\\\]/g;

      while ((match = blockBracketRegex.exec(text)) !== null) {
        const content = match[1].trim();
        if (content) {
          addIfNotOverlapping(match.index, match.index + match[0].length, {
            type: "block",
            content: content,
            raw: match[0],
          });
        }
      }

      // Inline LaTeX: $...$ (single dollar, not double)
      // Must not be at start of $$ or end of $$
      const inlineDollarRegex = /(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)/g;

      while ((match = inlineDollarRegex.exec(text)) !== null) {
        const content = match[1].trim();
        if (content) {
          addIfNotOverlapping(match.index, match.index + match[0].length, {
            type: "inline",
            content: content,
            raw: match[0],
          });
        }
      }

      // Inline LaTeX: \(...\)
      const inlineParenRegex = /\\\(([\s\S]*?)\\\)/g;

      while ((match = inlineParenRegex.exec(text)) !== null) {
        const content = match[1].trim();
        if (content) {
          addIfNotOverlapping(match.index, match.index + match[0].length, {
            type: "inline",
            content: content,
            raw: match[0],
          });
        }
      }

      // Sort by position in text
      latexExpressions.sort((a, b) => {
        const posA =
          extractedRanges.find((r) => text.substring(r.start, r.end) === a.raw)
            ?.start || 0;
        const posB =
          extractedRanges.find((r) => text.substring(r.start, r.end) === b.raw)
            ?.start || 0;
        return posA - posB;
      });

      result.extractedLaTeX = latexExpressions;
      logDebug(`extractLaTeX: found ${latexExpressions.length} expression(s)`);

      return result;
    },

    /**
     * Sanitise HTML content (basic XSS prevention)
     * Removes dangerous tags and attributes
     *
     * @param {Object} response - Response object
     * @param {Object} context - Processing context
     * @returns {Object} Response with sanitised html property
     */
    sanitiseHTML: (response, context) => {
      const result = { ...response };

      if (!result.html) {
        return result;
      }

      let html = result.html;

      // Remove dangerous tags completely
      const dangerousTags = [
        "script",
        "iframe",
        "object",
        "embed",
        "form",
        "base",
      ];
      dangerousTags.forEach((tag) => {
        // Remove opening and closing tags plus content for script
        const tagRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
        html = html.replace(tagRegex, "");

        // Remove self-closing or unclosed versions
        const selfClosingRegex = new RegExp(`<${tag}[^>]*\\/?>`, "gi");
        html = html.replace(selfClosingRegex, "");
      });

      // Remove dangerous attributes
      const dangerousAttrs = [
        "onclick",
        "ondblclick",
        "onmousedown",
        "onmouseup",
        "onmouseover",
        "onmousemove",
        "onmouseout",
        "onkeydown",
        "onkeypress",
        "onkeyup",
        "onfocus",
        "onblur",
        "onchange",
        "onsubmit",
        "onreset",
        "onselect",
        "oninput",
        "onload",
        "onerror",
        "onabort",
        "onunload",
        "onresize",
        "onscroll",
      ];

      dangerousAttrs.forEach((attr) => {
        // Match attribute with value in quotes or without
        const attrRegex = new RegExp(
          `\\s*${attr}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]*)`,
          "gi"
        );
        html = html.replace(attrRegex, "");
      });

      // Remove javascript: URLs in href/src attributes
      html = html.replace(
        /(href|src)\s*=\s*["']?\s*javascript:[^"'>\s]*/gi,
        '$1=""'
      );

      // Remove data: URLs in src attributes (potential XSS vector)
      html = html.replace(/src\s*=\s*["']?\s*data:[^"'>\s]*/gi, 'src=""');

      result.html = html;
      logDebug("sanitiseHTML: HTML sanitised");

      return result;
    },

    /**
     * Trim whitespace from text content
     *
     * @param {Object} response - Response object
     * @param {Object} context - Processing context
     * @returns {Object} Response with trimmed text property
     */
    trim: (response, context) => {
      const result = { ...response };

      if (typeof result.text === "string") {
        result.text = result.text.trim();
        logDebug("trim: Text trimmed");
      }

      return result;
    },
  };

  // ============================================================================
  // EMBED POST PROCESSOR CLASS
  // ============================================================================

  class EmbedPostProcessor {
    /**
     * Create a new post-processor instance
     */
    constructor() {
      // Map of processor name -> { name, processor, priority, enabled }
      this._processors = new Map();

      logInfo("EmbedPostProcessor initialised");
    }

    // ==========================================================================
    // PROCESSOR MANAGEMENT
    // ==========================================================================

    /**
     * Add a processor to the pipeline
     *
     * @param {string} name - Unique processor name
     * @param {Function} processor - Processor function: (response, context) => processedResponse
     * @param {Object} [options] - Processor options
     * @param {number} [options.priority=100] - Execution priority (lower = earlier)
     * @param {boolean} [options.enabled=true] - Whether processor is enabled
     * @returns {EmbedPostProcessor} For chaining
     * @throws {Error} If name or processor is invalid
     *
     * @example
     * postProcessor.add('myProcessor', (response, context) => {
     *   return { ...response, custom: 'data' };
     * }, { priority: 50 });
     */
    add(name, processor, options = {}) {
      // Validate parameters
      if (typeof name !== "string" || !name.trim()) {
        throw new Error("Processor name must be a non-empty string");
      }
      if (typeof processor !== "function") {
        throw new Error("Processor must be a function");
      }

      const processorName = name.trim();
      const priority =
        typeof options.priority === "number" ? options.priority : 100;
      const enabled = options.enabled !== false;

      // Warn if overwriting existing processor
      if (this._processors.has(processorName)) {
        logWarn(`Overwriting existing processor '${processorName}'`);
      }

      this._processors.set(processorName, {
        name: processorName,
        processor: processor,
        priority: priority,
        enabled: enabled,
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
     * postProcessor.remove('myProcessor');
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
     * postProcessor.setEnabled('sanitiseHTML', false);
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
     * if (postProcessor.isEnabled('extractJSON')) {
     *   console.log('JSON extraction is active');
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
     * const names = postProcessor.getProcessorNames();
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
     * const info = postProcessor.getProcessor('extractJSON');
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
     * postProcessor.clear();
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
     * Process response through all enabled processors
     *
     * @param {Object} response - Response object with text, html, etc.
     * @param {Object} [context={}] - Additional context for processors
     * @returns {Promise<Object>} Processed response with added metadata
     *
     * @example
     * const processed = await postProcessor.process({
     *   text: 'Response with ```json{"data":1}``` block',
     *   html: '<p>Response</p>'
     * });
     * console.log('Extracted JSON:', processed.extractedJSON);
     */
    async process(response, context = {}) {
      const startTime = performance.now();
      const processedBy = [];

      // Start with a copy of the response
      let result = { ...response };

      // Get enabled processors sorted by priority
      const processors = this._getSortedProcessors().filter((p) => p.enabled);

      logDebug(`Processing response through ${processors.length} processor(s)`);

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
      result.processed = {
        processors: processedBy,
        timestamp: new Date(),
        duration: Math.round(performance.now() - startTime),
      };

      logDebug("Processing complete", {
        processorsRun: processedBy.length,
        duration: result.processed.duration,
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
  EmbedPostProcessor.builtIn = builtInProcessors;

  // ============================================================================
  // SINGLETON INSTANCE
  // ============================================================================

  const embedPostProcessor = new EmbedPostProcessor();

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Expose singleton instance for convenience
  window.EmbedPostProcessor = embedPostProcessor;

  // Also expose class for testing and custom instances
  window.EmbedPostProcessorClass = EmbedPostProcessor;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Post-Processor (Stage 6 Phase 3) loaded");
  logInfo("Available as: window.EmbedPostProcessor (singleton instance)");
  logInfo("Class available as: window.EmbedPostProcessorClass");
  logInfo("Built-in processors: extractJSON, extractLaTeX, sanitiseHTML, trim");
})();
