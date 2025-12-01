/**
 * OpenRouter Embed API - Prompt Loader Utility
 *
 * Generic prompt loader for fetching and managing text prompt files.
 * Designed for the embed API with flexible configuration.
 *
 * Features:
 * - Configurable base path for prompt files
 * - Single file and batch loading
 * - Global variable exposure (window[name])
 * - Load status checking
 * - Ready promise for async coordination
 *
 * @version 1.0.0 (Stage 5 Phase 4 Feature 2)
 * @author OpenRouter Embed Development Team
 * @date 29 November 2025
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
      console.error(`[EmbedPromptLoader ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedPromptLoader WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedPromptLoader INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedPromptLoader DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // EMBED PROMPT LOADER CLASS
  // ============================================================================

  class EmbedPromptLoader {
    /**
     * Create a new EmbedPromptLoader instance
     */
    constructor() {
      // Configuration
      this._basePath = "";

      // Storage for loaded prompts
      this._prompts = new Map();

      // Ready promise (resolves after loadAll completes)
      this._readyPromise = null;
      this._readyResolver = null;

      logInfo("EmbedPromptLoader initialised");
    }

    // ==========================================================================
    // CONFIGURATION
    // ==========================================================================

    /**
     * Configure the prompt loader
     *
     * @param {Object} options - Configuration options
     * @param {string} options.basePath - Base path for prompt files
     * @returns {EmbedPromptLoader} This instance for chaining
     */
    configure(options = {}) {
      if (options.basePath !== undefined) {
        // Ensure basePath ends with / if not empty
        let path = options.basePath;
        if (path && !path.endsWith("/")) {
          path += "/";
        }
        this._basePath = path;
        logDebug("Base path configured", { basePath: this._basePath });
      }

      logInfo("Configuration updated", { basePath: this._basePath });
      return this;
    }

    /**
     * Get current base path
     *
     * @returns {string} Current base path
     */
    get basePath() {
      return this._basePath;
    }

    // ==========================================================================
    // SINGLE FILE LOADING
    // ==========================================================================

    /**
     * Load a single prompt file
     *
     * @param {string} name - Name to store the prompt under (also used for global exposure)
     * @param {string} filename - Filename to load (relative to basePath)
     * @returns {Promise<string|null>} The loaded prompt content, or null if loading failed
     */
    async load(name, filename) {
      const url = this._basePath + filename;
      logDebug("Loading prompt...", { name, filename, url });

      try {
        const response = await fetch(url);

        if (!response.ok) {
          logWarn(`Failed to load prompt: HTTP ${response.status}`, {
            name,
            filename,
            url,
            status: response.status,
            statusText: response.statusText,
          });
          return null;
        }

        const content = await response.text();
        logDebug("Prompt loaded", {
          name,
          filename,
          contentLength: content.length,
        });

        // Store internally
        this._prompts.set(name, content);

        // Expose as global variable
        window[name] = content;
        logDebug(`Exposed as window.${name}`);

        logInfo(`Loaded prompt: ${name} (${content.length} characters)`);
        return content;
      } catch (error) {
        logWarn(`Failed to load prompt: ${error.message}`, {
          name,
          filename,
          url,
          error: error.message,
        });
        return null;
      }
    }

    // ==========================================================================
    // BATCH LOADING
    // ==========================================================================

    /**
     * Load multiple prompt files in parallel
     *
     * @param {Object} files - Object mapping names to filenames
     *   Example: { PROMPT_MARKDOWN: 'markdown.txt', PROMPT_GUIDE: 'guide.txt' }
     * @returns {Promise<Object>} Object with all loaded prompts
     */
    async loadAll(files) {
      logInfo("Loading multiple prompts...", {
        count: Object.keys(files).length,
      });

      // Create ready promise
      this._readyPromise = new Promise((resolve) => {
        this._readyResolver = resolve;
      });

      const results = {};
      const errors = [];

      // Load all prompts in parallel
      const loadPromises = Object.entries(files).map(
        async ([name, filename]) => {
          try {
            const content = await this.load(name, filename);
            if (content !== null) {
              results[name] = content;
            } else {
              errors.push({ name, filename, error: "Load returned null" });
            }
          } catch (error) {
            errors.push({ name, filename, error: error.message });
          }
        }
      );

      await Promise.all(loadPromises);

      // Report results
      const loadedCount = Object.keys(results).length;
      const totalCount = Object.keys(files).length;

      if (errors.length > 0) {
        logWarn(`Loaded ${loadedCount}/${totalCount} prompts. Errors:`, errors);
      } else {
        logInfo(`All ${totalCount} prompts loaded successfully`);
      }

      // Resolve ready promise
      if (this._readyResolver) {
        this._readyResolver(results);
      }

      return results;
    }

    // ==========================================================================
    // PROMPT ACCESS
    // ==========================================================================

    /**
     * Get a previously loaded prompt
     *
     * @param {string} name - Name of the prompt to retrieve
     * @returns {string|null} The prompt content, or null if not loaded
     */
    get(name) {
      const content = this._prompts.get(name);
      if (content === undefined) {
        logDebug(`Prompt not found: ${name}`);
        return null;
      }
      logDebug(`Retrieved prompt: ${name}`);
      return content;
    }

    /**
     * Check if specific prompts are loaded
     *
     * @param {string[]} names - Array of prompt names to check
     * @returns {boolean} True if all specified prompts are loaded
     */
    areLoaded(names) {
      if (!Array.isArray(names)) {
        logWarn("areLoaded requires an array of names");
        return false;
      }

      for (const name of names) {
        if (!this._prompts.has(name)) {
          logDebug(`Prompt not loaded: ${name}`);
          return false;
        }
      }

      logDebug("All specified prompts are loaded", { names });
      return true;
    }

    /**
     * Get names of all loaded prompts
     *
     * @returns {string[]} Array of loaded prompt names
     */
    getLoadedNames() {
      const names = Array.from(this._prompts.keys());
      logDebug("Getting loaded prompt names", { count: names.length });
      return names;
    }

    // ==========================================================================
    // CLEANUP
    // ==========================================================================

    /**
     * Clear all loaded prompts and their global references
     */
    clear() {
      logInfo("Clearing all prompts...", { count: this._prompts.size });

      // Remove global references
      for (const name of this._prompts.keys()) {
        if (window[name] !== undefined) {
          delete window[name];
          logDebug(`Removed window.${name}`);
        }
      }

      // Clear internal storage
      this._prompts.clear();

      // Reset ready promise
      this._readyPromise = null;
      this._readyResolver = null;

      logInfo("All prompts cleared");
    }

    // ==========================================================================
    // READY PROMISE
    // ==========================================================================

    /**
     * Promise that resolves after loadAll completes
     * Returns null if loadAll has not been called
     *
     * @returns {Promise<Object>|null} Promise resolving to loaded prompts
     */
    get ready() {
      return this._readyPromise;
    }

    // ==========================================================================
    // UTILITY METHODS
    // ==========================================================================

    /**
     * Get count of loaded prompts
     *
     * @returns {number} Number of loaded prompts
     */
    get loadedCount() {
      return this._prompts.size;
    }

    /**
     * Check if any prompts are loaded
     *
     * @returns {boolean} True if at least one prompt is loaded
     */
    get hasLoadedPrompts() {
      return this._prompts.size > 0;
    }

    /**
     * Get status information
     *
     * @returns {Object} Status object
     */
    getStatus() {
      return {
        basePath: this._basePath,
        loadedCount: this._prompts.size,
        loadedNames: Array.from(this._prompts.keys()),
        hasReadyPromise: this._readyPromise !== null,
      };
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Create singleton instance
  const embedPromptLoader = new EmbedPromptLoader();

  // Expose class and singleton
  window.EmbedPromptLoader = EmbedPromptLoader;
  window.embedPromptLoader = embedPromptLoader;

  logInfo("EmbedPromptLoader module loaded and available globally");
})();
