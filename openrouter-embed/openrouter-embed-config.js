/**
 * OpenRouter Embed API - Configuration Module (Stage 4 Phase 2)
 *
 * Provides configuration management for the embed API including:
 * - Pre-configured templates for common use cases
 * - Parameter validation helpers
 * - Preset save/load via localStorage
 * - Configuration comparison utilities
 *
 * @version 1.0.0 (Stage 4 Phase 2)
 * @date 24 November 2025
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
      console.error(`[EmbedConfiguration] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedConfiguration] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedConfiguration] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedConfiguration] ${message}`, ...args);
  }

  // ============================================================================
  // CONFIGURATION TEMPLATES (AC-4.1)
  // ============================================================================

  /**
   * Pre-configured templates for common use cases
   * Models based on model-definitions.js naming conventions
   */
  const CONFIGURATION_TEMPLATES = {
    quick: {
      model: "anthropic/claude-3.5-haiku",
      temperature: 0.9,
      max_tokens: 500,
      top_p: 1.0,
      description: "Fast responses with lower token usage for quick interactions",
    },
    precise: {
      model: "anthropic/claude-3.7-sonnet",
      temperature: 0.3,
      max_tokens: 2000,
      top_p: 0.95,
      description: "Accurate, focused responses for factual queries",
    },
    creative: {
      model: "anthropic/claude-3.7-sonnet",
      temperature: 1.0,
      max_tokens: 2000,
      top_p: 1.0,
      description: "Creative writing and brainstorming with higher variability",
    },
    economical: {
      model: "anthropic/claude-3.5-haiku",
      temperature: 0.7,
      max_tokens: 800,
      top_p: 1.0,
      description: "Cost-effective responses balancing quality and economy",
    },
    analysis: {
      model: "anthropic/claude-3.7-sonnet",
      temperature: 0.2,
      max_tokens: 4000,
      top_p: 0.9,
      description: "Document analysis with detailed, comprehensive output",
    },
    mathpix: {
      model: "anthropic/claude-3.7-sonnet",
      temperature: 0.1,
      max_tokens: 2000,
      top_p: 0.95,
      description: "LaTeX correction and mathematical processing",
    },
  };

  // ============================================================================
  // VALIDATION CONSTANTS
  // ============================================================================

  const VALIDATION_RANGES = {
    temperature: { min: 0.0, max: 2.0 },
    top_p: { min: 0.0, max: 1.0 },
    max_tokens: { min: 1, max: Infinity },
  };

  // ============================================================================
  // EMBED CONFIGURATION CLASS
  // ============================================================================

  class EmbedConfiguration {
    /**
     * Create configuration manager instance
     */
    constructor() {
      this.templates = CONFIGURATION_TEMPLATES;
      this.storageKey = "openrouter_embed_presets";

      logInfo("Configuration manager initialised");
      logDebug("Available templates:", Object.keys(this.templates));
    }

    // ==========================================================================
    // TEMPLATE METHODS (AC-4.1)
    // ==========================================================================

    /**
     * Get a configuration template by name
     *
     * @param {string} name - Template name (quick, precise, creative, economical, analysis, mathpix)
     * @returns {Object|null} Template configuration or null if not found
     */
    getTemplate(name) {
      logDebug(`Getting template: ${name}`);

      if (!name || typeof name !== "string") {
        logWarn("Invalid template name provided");
        return null;
      }

      const template = this.templates[name.toLowerCase()];

      if (!template) {
        logWarn(`Template not found: ${name}`);
        return null;
      }

      // Return a copy to prevent modification of original
      const templateCopy = { ...template };

      logDebug(`Template retrieved: ${name}`, templateCopy);
      return templateCopy;
    }

    /**
     * List all available template names
     *
     * @returns {string[]} Array of template names
     */
    listTemplates() {
      const templateNames = Object.keys(this.templates);
      logDebug(`Available templates: ${templateNames.join(", ")}`);
      return templateNames;
    }

    /**
     * Get all templates with their descriptions
     *
     * @returns {Object} Templates with descriptions
     */
    getTemplatesWithDescriptions() {
      const result = {};

      for (const [name, template] of Object.entries(this.templates)) {
        result[name] = {
          description: template.description,
          model: template.model,
          temperature: template.temperature,
          max_tokens: template.max_tokens,
          top_p: template.top_p,
        };
      }

      return result;
    }

    // ==========================================================================
    // VALIDATION METHODS (AC-4.2)
    // ==========================================================================

    /**
     * Validate temperature value
     *
     * @param {number} value - Temperature to validate (0-2)
     * @returns {boolean} True if valid
     */
    validateTemperature(value) {
      const isValid =
        typeof value === "number" &&
        !isNaN(value) &&
        value >= VALIDATION_RANGES.temperature.min &&
        value <= VALIDATION_RANGES.temperature.max;

      logDebug(`Validating temperature ${value}: ${isValid}`);
      return isValid;
    }

    /**
     * Validate max_tokens value
     *
     * @param {number} value - Max tokens to validate (positive integer)
     * @returns {boolean} True if valid
     */
    validateMaxTokens(value) {
      const isValid =
        typeof value === "number" &&
        !isNaN(value) &&
        Number.isInteger(value) &&
        value >= VALIDATION_RANGES.max_tokens.min;

      logDebug(`Validating max_tokens ${value}: ${isValid}`);
      return isValid;
    }

    /**
     * Validate model identifier
     *
     * @param {string} value - Model identifier to validate
     * @returns {boolean} True if valid (non-empty string)
     */
    validateModel(value) {
      const isValid =
        typeof value === "string" && value.trim().length > 0;

      logDebug(`Validating model ${value}: ${isValid}`);
      return isValid;
    }

    /**
     * Validate top_p value
     *
     * @param {number} value - Top-p to validate (0-1)
     * @returns {boolean} True if valid
     */
    validateTopP(value) {
      const isValid =
        typeof value === "number" &&
        !isNaN(value) &&
        value >= VALIDATION_RANGES.top_p.min &&
        value <= VALIDATION_RANGES.top_p.max;

      logDebug(`Validating top_p ${value}: ${isValid}`);
      return isValid;
    }

    /**
     * Validate a complete configuration object
     *
     * @param {Object} config - Configuration object to validate
     * @returns {Object} Validation result with isValid flag and errors array
     */
    validateConfiguration(config) {
      logDebug("Validating configuration object", config);

      const errors = [];

      // Check if config is an object
      if (!config || typeof config !== "object") {
        return {
          isValid: false,
          errors: ["Configuration must be an object"],
        };
      }

      // Validate each parameter if present
      if (config.temperature !== undefined) {
        if (!this.validateTemperature(config.temperature)) {
          errors.push(
            `Invalid temperature: ${config.temperature} (must be 0-2)`
          );
        }
      }

      if (config.max_tokens !== undefined) {
        if (!this.validateMaxTokens(config.max_tokens)) {
          errors.push(
            `Invalid max_tokens: ${config.max_tokens} (must be positive integer)`
          );
        }
      }

      if (config.model !== undefined) {
        if (!this.validateModel(config.model)) {
          errors.push(
            `Invalid model: ${config.model} (must be non-empty string)`
          );
        }
      }

      if (config.top_p !== undefined) {
        if (!this.validateTopP(config.top_p)) {
          errors.push(`Invalid top_p: ${config.top_p} (must be 0-1)`);
        }
      }

      const isValid = errors.length === 0;

      logDebug(`Configuration validation result: ${isValid}`, {
        errors,
      });

      return {
        isValid,
        errors,
      };
    }

    // ==========================================================================
    // PRESET MANAGEMENT METHODS (AC-4.3)
    // ==========================================================================

    /**
     * Get all presets from localStorage
     *
     * @returns {Object} All saved presets
     * @private
     */
    _getStoredPresets() {
      try {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : {};
      } catch (error) {
        logError("Failed to read presets from storage:", error);
        return {};
      }
    }

    /**
     * Save presets to localStorage
     *
     * @param {Object} presets - Presets object to save
     * @private
     */
    _setStoredPresets(presets) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(presets));
        logDebug("Presets saved to storage");
      } catch (error) {
        logError("Failed to save presets to storage:", error);
        throw new Error("Failed to save preset: Storage error");
      }
    }

    /**
     * Save a configuration preset
     *
     * @param {string} name - Preset name (required, non-empty)
     * @param {Object} config - Configuration to save
     * @returns {boolean} True if saved successfully
     */
    savePreset(name, config) {
      logInfo(`Saving preset: ${name}`);

      // Validate preset name
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        logError("Invalid preset name: must be non-empty string");
        throw new Error("Preset name must be a non-empty string");
      }

      const trimmedName = name.trim();

      // Validate configuration
      if (!config || typeof config !== "object") {
        logError("Invalid configuration object");
        throw new Error("Configuration must be an object");
      }

      // Get existing presets
      const presets = this._getStoredPresets();

      // Check if overwriting
      if (presets[trimmedName]) {
        logWarn(`Overwriting existing preset: ${trimmedName}`);
      }

      // Save the preset (store a copy)
      presets[trimmedName] = { ...config };

      // Persist to storage
      this._setStoredPresets(presets);

      logInfo(`Preset saved: ${trimmedName}`, config);
      return true;
    }

    /**
     * Load a saved preset
     *
     * @param {string} name - Preset name to load
     * @returns {Object|null} Preset configuration or null if not found
     */
    loadPreset(name) {
      logDebug(`Loading preset: ${name}`);

      if (!name || typeof name !== "string") {
        logWarn("Invalid preset name provided");
        return null;
      }

      const trimmedName = name.trim();
      const presets = this._getStoredPresets();

      if (!presets[trimmedName]) {
        logWarn(`Preset not found: ${trimmedName}`);
        return null;
      }

      // Return a copy to prevent modification
      const preset = { ...presets[trimmedName] };

      logInfo(`Preset loaded: ${trimmedName}`, preset);
      return preset;
    }

    /**
     * List all saved preset names
     *
     * @returns {string[]} Array of preset names
     */
    listPresets() {
      const presets = this._getStoredPresets();
      const names = Object.keys(presets);

      logDebug(`Saved presets: ${names.length > 0 ? names.join(", ") : "none"}`);
      return names;
    }

    /**
     * Delete a saved preset
     *
     * @param {string} name - Preset name to delete
     * @returns {boolean} True if deleted, false if not found
     */
    deletePreset(name) {
      logInfo(`Deleting preset: ${name}`);

      if (!name || typeof name !== "string") {
        logWarn("Invalid preset name provided");
        return false;
      }

      const trimmedName = name.trim();
      const presets = this._getStoredPresets();

      if (!presets[trimmedName]) {
        logWarn(`Preset not found for deletion: ${trimmedName}`);
        return false;
      }

      delete presets[trimmedName];
      this._setStoredPresets(presets);

      logInfo(`Preset deleted: ${trimmedName}`);
      return true;
    }

    /**
     * Check if a preset exists
     *
     * @param {string} name - Preset name to check
     * @returns {boolean} True if preset exists
     */
    hasPreset(name) {
      if (!name || typeof name !== "string") {
        return false;
      }

      const presets = this._getStoredPresets();
      const exists = presets.hasOwnProperty(name.trim());

      logDebug(`Preset exists check: ${name} = ${exists}`);
      return exists;
    }

    /**
     * Clear all saved presets
     *
     * @returns {number} Number of presets cleared
     */
    clearAllPresets() {
      const presets = this._getStoredPresets();
      const count = Object.keys(presets).length;

      this._setStoredPresets({});

      logInfo(`Cleared ${count} presets`);
      return count;
    }

    // ==========================================================================
    // CONFIGURATION COMPARISON (AC-4.4)
    // ==========================================================================

    /**
     * Compare two configurations and return differences
     *
     * @param {Object} config1 - First configuration
     * @param {Object} config2 - Second configuration
     * @returns {Object} Diff object with changed, unchanged, and details
     */
    compareConfigurations(config1, config2) {
      logDebug("Comparing configurations");

      // Handle null/undefined inputs
      if (!config1 || typeof config1 !== "object") {
        config1 = {};
      }
      if (!config2 || typeof config2 !== "object") {
        config2 = {};
      }

      const changed = [];
      const unchanged = [];
      const details = {};

      // Get all unique keys from both configs
      const allKeys = new Set([
        ...Object.keys(config1),
        ...Object.keys(config2),
      ]);

      for (const key of allKeys) {
        const val1 = config1[key];
        const val2 = config2[key];

        // Deep comparison for objects
        const areEqual = this._deepEqual(val1, val2);

        if (areEqual) {
          unchanged.push(key);
        } else {
          changed.push(key);
          details[key] = {
            old: val1,
            new: val2,
          };
        }
      }

      const diff = {
        changed,
        unchanged,
        details,
      };

      logDebug("Configuration comparison complete", diff);
      return diff;
    }

    /**
     * Deep equality check for two values
     *
     * @param {*} val1 - First value
     * @param {*} val2 - Second value
     * @returns {boolean} True if values are equal
     * @private
     */
    _deepEqual(val1, val2) {
      // Handle undefined/null
      if (val1 === val2) return true;
      if (val1 === undefined && val2 === undefined) return true;
      if (val1 === null && val2 === null) return true;
      if (val1 === undefined || val2 === undefined) return false;
      if (val1 === null || val2 === null) return false;

      // Type check
      if (typeof val1 !== typeof val2) return false;

      // Handle objects
      if (typeof val1 === "object") {
        // Handle arrays
        if (Array.isArray(val1) && Array.isArray(val2)) {
          if (val1.length !== val2.length) return false;
          return val1.every((item, index) =>
            this._deepEqual(item, val2[index])
          );
        }

        // Handle objects
        if (Array.isArray(val1) !== Array.isArray(val2)) return false;

        const keys1 = Object.keys(val1);
        const keys2 = Object.keys(val2);

        if (keys1.length !== keys2.length) return false;

        return keys1.every((key) =>
          this._deepEqual(val1[key], val2[key])
        );
      }

      // Primitive comparison
      return val1 === val2;
    }

    // ==========================================================================
    // UTILITY METHODS
    // ==========================================================================

    /**
     * Create a configuration object from a template with optional overrides
     *
     * @param {string} templateName - Template name
     * @param {Object} [overrides] - Optional parameter overrides
     * @returns {Object|null} Merged configuration or null if template not found
     */
    createFromTemplate(templateName, overrides = {}) {
      const template = this.getTemplate(templateName);

      if (!template) {
        return null;
      }

      const config = { ...template, ...overrides };

      // Remove description from config (it's metadata, not a parameter)
      delete config.description;

      logDebug(`Created configuration from template: ${templateName}`, config);
      return config;
    }

    /**
     * Get validation ranges for reference
     *
     * @returns {Object} Validation ranges
     */
    getValidationRanges() {
      return { ...VALIDATION_RANGES };
    }

    /**
     * Export all presets as JSON string
     *
     * @returns {string} JSON string of all presets
     */
    exportPresets() {
      const presets = this._getStoredPresets();
      return JSON.stringify(presets, null, 2);
    }

    /**
     * Import presets from JSON string
     *
     * @param {string} jsonString - JSON string of presets
     * @param {boolean} [merge=true] - Whether to merge with existing presets
     * @returns {number} Number of presets imported
     */
    importPresets(jsonString, merge = true) {
      logInfo("Importing presets");

      let imported;
      try {
        imported = JSON.parse(jsonString);
      } catch (error) {
        logError("Failed to parse preset JSON:", error);
        throw new Error("Invalid JSON format");
      }

      if (!imported || typeof imported !== "object") {
        throw new Error("Invalid preset format");
      }

      const currentPresets = merge ? this._getStoredPresets() : {};
      const merged = { ...currentPresets, ...imported };

      this._setStoredPresets(merged);

      const count = Object.keys(imported).length;
      logInfo(`Imported ${count} presets`);
      return count;
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.EmbedConfiguration = EmbedConfiguration;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================

  logInfo("OpenRouter Embed Configuration Module (Stage 4 Phase 2) loaded");
  logInfo("Available class: EmbedConfiguration");
  logInfo("");
  logInfo("Features:");
  logInfo("  - Configuration Templates (AC-4.1)");
  logInfo("  - Validation Helpers (AC-4.2)");
  logInfo("  - Preset Management (AC-4.3)");
  logInfo("  - Configuration Comparison (AC-4.4)");

  console.log("[EmbedConfiguration] Stage 4 Phase 2 loaded");
  console.log("   Usage: const config = new EmbedConfiguration();");
})();
