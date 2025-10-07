/**
 * @fileoverview Parameter Controller
 * @description Main controller for managing parameter interactions and model integration
 */

import { parameterRegistry } from "./base/parameter-registry.js";
import { RepetitionParameter } from "./controls/repetition-parameter.js";
import { TemperatureParameter } from "./controls/temperature.js";
import { TopPParameter } from "./controls/top-p.js";
import { MaxTokensParameter } from "./controls/max-tokens.js";
import { SystemPromptParameter } from "./controls/system-prompt.js";
import { PDFEngineParameter } from "./controls/parameter-pdf-engine.js";

import { a11y } from "../../accessibility-helpers.js";

// Logging configuration (module scope)
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

// Current logging configuration
let currentLogLevel = DEFAULT_LOG_LEVEL;

// Override flags
if (ENABLE_ALL_LOGGING) {
  currentLogLevel = LOG_LEVELS.DEBUG;
}
if (DISABLE_ALL_LOGGING) {
  currentLogLevel = -1; // Below all levels
}

// Helper methods to check if logging should occur
const shouldLog = (level) => {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= currentLogLevel;
};

// Logging functions
const logError = (message, ...args) => {
  if (shouldLog(LOG_LEVELS.ERROR)) {
    console.error(`[ParameterController] ${message}`, ...args);
  }
};

const logWarn = (message, ...args) => {
  if (shouldLog(LOG_LEVELS.WARN)) {
    console.warn(`[ParameterController] ${message}`, ...args);
  }
};

const logInfo = (message, ...args) => {
  if (shouldLog(LOG_LEVELS.INFO)) {
    console.log(`[ParameterController] ${message}`, ...args);
  }
};

const logDebug = (message, ...args) => {
  if (shouldLog(LOG_LEVELS.DEBUG)) {
    console.log(`[ParameterController DEBUG] ${message}`, ...args);
  }
};

export class ParameterController {
  constructor() {
    this.initialized = false;
    this.container = null;
  }

  /**
   * Initialize the parameter controller
   */
  initialize() {
    logInfo("Starting initialisation...", {
      alreadyInitialised: this.initialized,
      containerExists: !!this.container,
    });

    // Find the processing-options container for parameters
    const inputControls = document.querySelector(".input-controls");
    if (!inputControls) {
      logError("Could not find .input-controls container", {
        availableElements: document.querySelectorAll(".input-controls"),
      });
      return false;
    }

    this.container = inputControls.querySelector(".processing-options");
    if (!this.container) {
      logError("Could not find .processing-options container", {
        parentHTML: inputControls.innerHTML,
      });
      return false;
    }

    // Clear existing content
    this.container.innerHTML = "";

    try {
      logInfo("Container found, proceeding with initialisation");

      // Initialize parameters
      this.initializeParameters();

      // Set up registry event listeners
      this.setupRegistryListeners();

      this.initialized = true;
      logInfo("Initialisation complete", {
        containerHTML: this.container.innerHTML,
        initialised: this.initialized,
      });
      return true;
    } catch (error) {
      logError("Initialisation failed:", error, {
        stack: error.stack,
        containerState: this.container ? "exists" : "missing",
        initialised: this.initialized,
      });
      this.initialized = false;
      return false;
    }
  }

  /**
   * Initialize individual parameters
   */
  initializeParameters() {
    logInfo("Setting up parameters...");

    try {
      // Create and initialize parameters one by one
      logDebug("Creating system prompt parameter");
      const systemPromptParam = new SystemPromptParameter();
      parameterRegistry.register("system-prompt", systemPromptParam);
      systemPromptParam.initialize(this.container);

      logDebug("Creating repetition parameter");
      const repetitionParam = new RepetitionParameter();
      parameterRegistry.register("repetition", repetitionParam);
      repetitionParam.initialize(this.container);

      logDebug("Creating temperature parameter");
      const temperatureParam = new TemperatureParameter();
      parameterRegistry.register("temperature", temperatureParam);
      temperatureParam.initialize(this.container);

      logDebug("Creating top-p parameter");
      const topPParam = new TopPParameter();
      parameterRegistry.register("top_p", topPParam);
      topPParam.initialize(this.container);

      logDebug("Creating max-tokens parameter");
      const maxTokensParam = new MaxTokensParameter();
      parameterRegistry.register("max_tokens", maxTokensParam);
      maxTokensParam.initialize(this.container);

      logDebug("Creating PDF engine parameter");
      const pdfEngineParam = new PDFEngineParameter();
      parameterRegistry.register("pdf-engine", pdfEngineParam);
      pdfEngineParam.initialize(this.container);

      logInfo("Parameters initialised successfully");
    } catch (error) {
      logError("Error initialising parameters:", error);
      a11y.announceStatus(
        "Error initialising parameter controls. Please refresh the page.",
        "assertive"
      );
      throw error; // Re-throw to allow caller to handle
    }
  }

  /**
   * Set up parameter registry event listeners
   */
  setupRegistryListeners() {
    parameterRegistry.addEventListener(
      "parameterRegistered",
      ({ id, parameter }) => {
        logDebug(`Parameter registered: ${id}`);
      }
    );

    parameterRegistry.addEventListener(
      "parameterStatesUpdated",
      ({ model }) => {
        logDebug("Parameter states updated for model:", model.id);
      }
    );

    parameterRegistry.addEventListener("registryCleared", () => {
      logInfo("Parameter registry cleared");
      // Clear container when registry is cleared
      if (this.container) {
        this.container.innerHTML = "";
      }
    });
  }

  /**
   * Update parameters based on selected model
   * @param {Object} model - Model configuration object
   */
  updateParametersForModel(model) {
    logDebug("Updating parameters for model:", {
      modelId: model?.id,
      initialised: this.initialized,
      containerExists: !!this.container,
      parameterCount: this.container?.children?.length,
    });

    if (!this.initialized) {
      logWarn("Not initialised", {
        stack: new Error().stack,
      });
      return;
    }

    try {
      parameterRegistry.updateParameterStates(model);
    } catch (error) {
      logError("Error updating parameters:", {
        error,
        stack: error.stack,
        model: model?.id,
      });
      a11y.announceStatus("Error updating parameter controls", "assertive");
    }
  }

  /**
   * Get value of a specific parameter
   * @param {string} id - Parameter identifier
   * @returns {any} Parameter value or undefined if not found
   */
  getParameterValue(id) {
    if (!this.initialized) {
      logWarn("Not initialised");
      return undefined;
    }

    try {
      const parameter = parameterRegistry.getParameter(id);
      if (!parameter) {
        logWarn(`Parameter ${id} not found`);
        return undefined;
      }
      return parameter.getValue();
    } catch (error) {
      logError(`Error getting value for parameter ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Get current parameter values
   * @returns {Object} Current parameter values
   */
  getParameterValues() {
    if (!this.initialized) {
      logWarn("Not initialised");
      return {};
    }

    try {
      const values = parameterRegistry.getCurrentValues();
      logDebug("Initial parameter values:", values);

      // Filter out disabled parameters
      const filteredValues = {};
      const parameters = parameterRegistry.getAllParameters();

      parameters.forEach((parameter, id) => {
        // Check if parameter's wrapper has disabled state
        const isDisabled =
          parameter.elements.wrapper?.classList.contains("parameter-disabled");
        if (!isDisabled && values[id] !== undefined) {
          filteredValues[id] = values[id];
        }
      });

      logDebug("Filtered parameter values:", {
        before: values,
        after: filteredValues,
        disabledParams: Object.keys(values).filter(
          (key) => !filteredValues[key]
        ),
      });

      // Ensure max_tokens is included in the values
      if (values.max_tokens) {
        values.max_tokens = parseInt(values.max_tokens);
      }

      // Handle repetition parameter values
      if (values.repetition) {
        logDebug("Processing repetition values:", values.repetition);
        if (
          typeof values.repetition.frequency_penalty === "number" &&
          typeof values.repetition.presence_penalty === "number"
        ) {
          values.frequency_penalty = values.repetition.frequency_penalty;
          values.presence_penalty = values.repetition.presence_penalty;
          logDebug("Updated values with penalties:", values);
        } else {
          logWarn("Invalid repetition parameter values");
          values.frequency_penalty = 0;
          values.presence_penalty = 0;
        }
        delete values.repetition;
      }

      return values;
    } catch (error) {
      logError("Error getting parameter values:", error);
      return {};
    }
  }

  /**
   * Reset parameters to default values
   */
  resetParameters() {
    if (!this.initialized) {
      logWarn("Not initialised");
      return;
    }

    try {
      const parameters = parameterRegistry.getAllParameters();
      parameters.forEach((parameter) => {
        if (parameter instanceof RepetitionParameter) {
          // Handle repetition parameter's dual values
          parameter.setValue({
            frequency: parameter.defaultValue.frequency,
            presence: parameter.defaultValue.presence,
          });
          logDebug(
            "Reset repetition parameter to defaults:",
            parameter.defaultValue
          );
        } else {
          // Handle all other parameters
          parameter.setValue(parameter.defaultValue);
        }
      });

      // Announce reset to screen readers
      a11y.announceStatus(
        "All parameters have been reset to their default values",
        "polite"
      );
    } catch (error) {
      logError("Error resetting parameters:", error);
      a11y.announceStatus("Error resetting parameters", "assertive");
    }
  }

  /**
   * Clean up controller resources
   */
  destroy() {
    if (this.initialized) {
      parameterRegistry.clear();
      if (this.container) {
        this.container.innerHTML = "";
      }
      this.initialized = false;
    }
  }
}

// Export singleton instance
export const parameterController = new ParameterController();
