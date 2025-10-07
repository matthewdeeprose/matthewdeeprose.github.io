/**
 * @fileoverview Base Parameter Class - Foundation for all parameter implementations
 * @description Provides core functionality for parameter controls including validation,
 * accessibility features, and state management.
 */

import { a11y } from "../../../accessibility-helpers.js";

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

// Helper functions
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

export class ParameterBase {
  /**
   * @param {Object} config - Parameter configuration
   * @param {string} config.id - Unique identifier for the parameter
   * @param {string} config.name - Display name of the parameter
   * @param {string} config.description - Parameter description
   * @param {Object} config.validation - Validation configuration
   * @param {number} config.validation.min - Minimum allowed value
   * @param {number} config.validation.max - Maximum allowed value
   * @param {number} config.validation.step - Step value for increments
   * @param {number} config.defaultValue - Default parameter value
   */
  constructor(config) {
    logDebug("Constructing ParameterBase:", config.id);

    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.validation = config.validation;
    this.defaultValue = config.defaultValue;
    this.value = this.defaultValue;

    // Element references
    this.elements = {
      control: null,
      output: null,
      description: null,
      container: null,
      wrapper: null,
    };

    // Bind methods
    this.handleInput = this.handleInput.bind(this);

    logDebug("ParameterBase constructed successfully:", {
      id: this.id,
      name: this.name,
      defaultValue: this.defaultValue,
    });
  }

  /**
   * Initialize the parameter
   * @param {HTMLElement} container - Container element for the parameter
   */
  async initialize(container) {
    logInfo("Initialising parameter:", this.id);

    if (!container) {
      logError(
        "Container element is required for parameter initialisation:",
        this.id
      );
      throw new Error(
        "Container element is required for parameter initialisation"
      );
    }

    // Create a wrapper div for this parameter
    const wrapper = document.createElement("div");
    wrapper.className = "parameter-control";
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-labelledby", `${this.id}-label`);

    // Store references
    this.elements.container = container;
    this.elements.wrapper = wrapper;

    // Add wrapper to container
    container.appendChild(wrapper);

    try {
      // Render parameter content
      await this.render();
      this.setupEventListeners();

      logInfo("Parameter initialised successfully:", this.id);
    } catch (error) {
      logError("Failed to initialise parameter:", this.id, error);
      throw error;
    }
  }

  /**
   * Render the parameter template
   * Must be implemented by child classes
   */
  render() {
    logError(
      "render() method must be implemented by child class:",
      this.constructor.name
    );
    throw new Error("render() must be implemented by child class");
  }

  /**
   * Set up event listeners for the parameter
   */
  setupEventListeners() {
    logDebug("Setting up event listeners for parameter:", this.id);

    if (this.elements.control) {
      this.elements.control.addEventListener("input", this.handleInput);
      logDebug("Input event listener attached to control for:", this.id);
    } else {
      logWarn("No control element found for event listener setup:", this.id);
    }
  }

  /**
   * Handle input events
   * @param {Event} event - Input event
   */
  handleInput(event) {
    logDebug(
      "Handling input event for parameter:",
      this.id,
      "Raw value:",
      event.target.value
    );

    const newValue = this.validateValue(event.target.value);
    this.setValue(newValue);
  }

  /**
   * Validate a parameter value
   * @param {number|string} value - Value to validate
   * @returns {number} - Validated value
   */
  validateValue(value) {
    logDebug("Validating value for parameter:", this.id, "Input:", value);

    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      logWarn("Invalid numeric value provided, using default:", {
        parameter: this.id,
        invalidValue: value,
        defaultValue: this.defaultValue,
      });
      return this.defaultValue;
    }

    const validatedValue = Math.min(
      Math.max(numValue, this.validation.min),
      this.validation.max
    );

    if (validatedValue !== numValue) {
      logWarn("Value clamped to validation range:", {
        parameter: this.id,
        originalValue: numValue,
        clampedValue: validatedValue,
        min: this.validation.min,
        max: this.validation.max,
      });
    }

    logDebug("Value validation complete:", {
      parameter: this.id,
      input: value,
      output: validatedValue,
    });

    return validatedValue;
  }

  /**
   * Set the parameter value
   * @param {number} value - New value
   */
  setValue(value) {
    logDebug("Setting value for parameter:", this.id, "New value:", value);

    const validValue = this.validateValue(value);
    const previousValue = this.value;
    this.value = validValue;

    if (this.elements.output) {
      this.elements.output.textContent = validValue;
    }

    this.updateDescription(validValue);
    this.announceValueChange(validValue);

    if (previousValue !== validValue) {
      logInfo("Parameter value changed:", {
        parameter: this.id,
        previousValue: previousValue,
        newValue: validValue,
      });
    }
  }

  /**
   * Get the current parameter value
   * @returns {number} - Current value
   */
  getValue() {
    logDebug(
      "Getting value for parameter:",
      this.id,
      "Current value:",
      this.value
    );
    return this.value;
  }

  /**
   * Update the parameter description
   * @param {number} value - Current value
   */
  updateDescription(value) {
    logDebug("Updating description for parameter:", this.id, "Value:", value);

    if (this.elements.description) {
      try {
        const description = this.getValueDescription(value);
        this.elements.description.textContent = description;
        logDebug("Description updated successfully for parameter:", this.id);
      } catch (error) {
        logError("Failed to update description for parameter:", this.id, error);
      }
    } else {
      logDebug("No description element found for parameter:", this.id);
    }
  }

  /**
   * Get description for a value
   * Must be implemented by child classes
   * @param {number} value - Value to describe
   * @returns {string} - Description
   */
  getValueDescription(value) {
    logError(
      "getValueDescription() method must be implemented by child class:",
      this.constructor.name
    );
    throw new Error("getValueDescription() must be implemented by child class");
  }

  /**
   * Announce value changes to screen readers
   * @param {number} value - New value
   */
  announceValueChange(value) {
    logDebug(
      "Announcing value change for parameter:",
      this.id,
      "Value:",
      value
    );

    try {
      const description = this.getValueDescription(value);
      const announcement = `${this.name} set to ${value}. ${description}`;
      a11y.announceStatus(announcement, "polite");
      logDebug("Value change announced successfully for parameter:", this.id);
    } catch (error) {
      logWarn("Failed to announce value change for parameter:", this.id, error);
    }
  }

  /**
   * Update control state based on model support
   * @param {boolean} isSupported - Whether the parameter is supported
   */
  updateControlState(isSupported) {
    logInfo(
      "Updating control state for parameter:",
      this.id,
      "Supported:",
      isSupported
    );

    if (!this.elements.control || !this.elements.wrapper) {
      logDebug(
        "Skipping control state update - elements not yet initialised for parameter:",
        this.id
      );
      return;
    }

    if (!isSupported) {
      logInfo("Disabling unsupported parameter:", this.id);

      this.elements.control.setAttribute("disabled", "");
      this.elements.wrapper.classList.add("parameter-disabled");
      this.elements.wrapper.setAttribute("aria-disabled", "true");

      // Remove existing status message if it exists
      const existingStatus =
        this.elements.wrapper.querySelector(".parameter-status");
      if (existingStatus) {
        existingStatus.remove();
        logDebug("Removed existing status message for parameter:", this.id);
      }

      // Add status message
      const statusMessage = document.createElement("div");
      statusMessage.className = "parameter-status";
      statusMessage.textContent = "Not supported by selected model";
      this.elements.wrapper.appendChild(statusMessage);

      logDebug("Added unsupported status message for parameter:", this.id);
    } else {
      logInfo("Enabling supported parameter:", this.id);

      this.elements.control.removeAttribute("disabled");
      this.elements.wrapper.classList.remove("parameter-disabled");
      this.elements.wrapper.setAttribute("aria-disabled", "false");

      // Remove any existing status message
      const existingStatus =
        this.elements.wrapper.querySelector(".parameter-status");
      if (existingStatus) {
        existingStatus.remove();
        logDebug("Removed status message for enabled parameter:", this.id);
      }
    }
  }
}
