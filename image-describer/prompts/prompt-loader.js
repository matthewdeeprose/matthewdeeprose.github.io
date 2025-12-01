/**
 * ═══════════════════════════════════════════════════════════════
 * PROMPT LOADER
 * ═══════════════════════════════════════════════════════════════
 *
 * Fetches prompt text files and exposes them as global variables.
 * Using .txt files avoids JavaScript escaping issues entirely.
 *
 * EXPOSES:
 * - window.PROMPT_MARKDOWN
 * - window.PROMPT_WRITING_GUIDE
 * - window.PROMPT_IMAGE_DESCRIPTION
 * - window.promptsLoaded (Promise that resolves when all loaded)
 *
 * VERSION: 1.0.0
 * DATE: 24 November 2025
 * ═══════════════════════════════════════════════════════════════
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
      console.error(`[PromptLoader] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[PromptLoader] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[PromptLoader] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[PromptLoader] ${message}`, ...args);
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Base path for prompt files (relative to HTML file)
   * Adjust if your file structure differs
   */
  const PROMPTS_BASE_PATH = "image-describer/prompts/";

  /**
   * Prompt files to load
   * Each entry maps the global variable name to the filename
   */
  const PROMPT_FILES = {
    PROMPT_MARKDOWN: "prompt-markdown.txt",
    PROMPT_WRITING_GUIDE: "prompt-writing-guide.txt",
    PROMPT_IMAGE_DESCRIPTION: "prompt-image-description.txt",
  };

  // ============================================================================
  // PROMPT LOADER
  // ============================================================================

  /**
   * Fetch a single prompt file
   * @param {string} filename - The filename to fetch
   * @returns {Promise<string>} The file contents
   */
  async function fetchPrompt(filename) {
    const url = PROMPTS_BASE_PATH + filename;
    logDebug(`Fetching: ${url}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      logDebug(`Loaded ${filename}: ${text.length} characters`);

      return text;
    } catch (error) {
      logError(`Failed to load ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Load all prompt files and expose as globals
   * @returns {Promise<Object>} Object with all loaded prompts
   */
  async function loadAllPrompts() {
    logInfo("Loading prompt files...");

    const results = {};
    const errors = [];

    // Load all prompts in parallel
    const loadPromises = Object.entries(PROMPT_FILES).map(
      async ([varName, filename]) => {
        try {
          const content = await fetchPrompt(filename);
          results[varName] = content;

          // Expose as global
          window[varName] = content;
          logDebug(`Exposed window.${varName}`);
        } catch (error) {
          errors.push({ varName, filename, error: error.message });
          // Set to null so code can check for missing prompts
          window[varName] = null;
        }
      }
    );

    await Promise.all(loadPromises);

    // Report results
    const loaded = Object.keys(results).length;
    const total = Object.keys(PROMPT_FILES).length;

    if (errors.length > 0) {
      logWarn(`Loaded ${loaded}/${total} prompts. Errors:`, errors);
    } else {
      logInfo(`All ${total} prompts loaded successfully`);
    }

    return {
      prompts: results,
      errors: errors,
      success: errors.length === 0,
    };
  }

  // ============================================================================
  // AUTO-LOAD ON SCRIPT EXECUTION
  // ============================================================================

  /**
   * Promise that resolves when all prompts are loaded
   * Use: await window.promptsLoaded;
   */
  window.promptsLoaded = loadAllPrompts();

  // Also expose the loader for manual reloading if needed
  window.PromptLoader = {
    reload: loadAllPrompts,
    basePath: PROMPTS_BASE_PATH,
    files: PROMPT_FILES,
  };

  logInfo("Prompt loader initialised - loading prompts...");
})();
