/**
 * @fileoverview Parameter Registry - Central management of parameter instances
 * @description Manages parameter registration, discovery, and state management
 */

import { ParameterBase } from "./parameter-base.js";

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

export class ParameterRegistry {
  constructor() {
    // Map to store parameter instances
    this.parameters = new Map();

    // Event handlers map
    this.eventHandlers = new Map();

    logInfo("ParameterRegistry initialised");
  }

  /**
   * Register a new parameter
   * @param {string} id - Parameter identifier
   * @param {ParameterBase} parameter - Parameter instance
   */
  register(id, parameter) {
    if (this.parameters.has(id)) {
      throw new Error(`Parameter with id ${id} is already registered`);
    }

    if (!(parameter instanceof ParameterBase)) {
      throw new Error(`Parameter must be an instance of ParameterBase`);
    }

    this.parameters.set(id, parameter);
    logDebug(`Parameter registered: ${id}`, parameter);
    this.notifyListeners("parameterRegistered", { id, parameter });
  }

  /**
   * Get a parameter by ID
   * @param {string} id - Parameter identifier
   * @returns {ParameterBase|undefined} - Parameter instance if found
   */
  getParameter(id) {
    const parameter = this.parameters.get(id);
    logDebug(`Parameter retrieved: ${id}`, parameter ? "found" : "not found");
    return parameter;
  }

  /**
   * Get all registered parameters
   * @returns {Map} - Map of all parameters
   */
  getAllParameters() {
    logDebug(`Retrieving all parameters (${this.parameters.size} total)`);
    return new Map(this.parameters);
  }

  /**
   * Update parameter states based on model support
   * @param {Object} model - Model configuration object
   */
  updateParameterStates(model) {
    if (
      !model ||
      !model.parameterSupport ||
      !model.parameterSupport.supported
    ) {
      logWarn("Invalid model configuration for parameter support");
      return;
    }

    const supportedParams = model.parameterSupport.supported;
    logInfo(`Updating parameter states for model: ${model.id || "unknown"}`);
    logDebug("Supported parameters:", supportedParams);

    this.parameters.forEach((parameter, id) => {
      // Special handling for repetition parameter
      if (id === "repetition") {
        // Enable if either frequency_penalty or presence_penalty is supported
        const isSupported =
          supportedParams.includes("frequency_penalty") ||
          supportedParams.includes("presence_penalty");
        parameter.updateControlState(isSupported);
        logDebug(`Repetition parameter support: ${isSupported}`);
      } else if (id === "pdf-engine") {
        // PDF engine always supported via OpenRouter plugin system
        parameter.updateControlState(true);
        logDebug(`PDF engine parameter: always supported via plugins`);
      } else {
        const isSupported = supportedParams.includes(id);
        parameter.updateControlState(isSupported);
        logDebug(`Parameter ${id} support: ${isSupported}`);
      }
    });

    this.notifyListeners("parameterStatesUpdated", { model });
    logInfo("Parameter states updated successfully");
  }

  /**
   * Validate model capabilities configuration
   * @param {Object} model - Model configuration object
   * @returns {boolean} - Whether the model has valid capabilities
   */
  validateModelCapabilities(model) {
    logDebug("Validating model capabilities for:", model.id || "unknown model");

    if (model.responseFormatCapabilities) {
      // Validate type
      const validTypes = ["none", "standard", "openai", "anthropic"];
      if (!validTypes.includes(model.responseFormatCapabilities.type)) {
        logWarn(
          `Invalid responseFormatCapabilities type for model ${model.id}`
        );
        return false;
      }
      logDebug(
        `Valid responseFormatCapabilities type: ${model.responseFormatCapabilities.type}`
      );
      // Other validation as needed
    }

    logDebug("Model capabilities validation passed");
    return true;
  }

  /**
   * Get current values for all parameters
   * @returns {Object} - Object mapping parameter IDs to their current values
   */
  getCurrentValues() {
    logDebug("Retrieving current values for all parameters");
    const values = {};
    this.parameters.forEach((parameter, id) => {
      values[id] = parameter.getValue();
    });
    logDebug("Current parameter values:", values);
    return values;
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  addEventListener(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
    logDebug(`Event listener added for: ${event}`);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  removeEventListener(event, handler) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(handler);
      logDebug(`Event listener removed for: ${event}`);
    }
  }

  /**
   * Notify all listeners of an event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @private
   */
  notifyListeners(event, data) {
    if (this.eventHandlers.has(event)) {
      const handlerCount = this.eventHandlers.get(event).size;
      logDebug(`Notifying ${handlerCount} listeners for event: ${event}`);

      this.eventHandlers.get(event).forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          logError(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Clear all registered parameters
   */
  clear() {
    const parameterCount = this.parameters.size;
    this.parameters.clear();
    this.notifyListeners("registryCleared", {});
    logInfo(`Registry cleared - ${parameterCount} parameters removed`);
  }
}

// Create and export singleton instance
export const parameterRegistry = new ParameterRegistry();
