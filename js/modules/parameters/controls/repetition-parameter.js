/**
 * @fileoverview RepetitionParameter Class Implementation
 * @description Manages both presence and frequency penalties as a unified repetition control
 */

import { ParameterBase } from "../base/parameter-base.js";
import { createParameterTemplate } from "../templates/parameter-template.js";
import { a11y } from "../../../accessibility-helpers.js";

// Logging configuration (module level)
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

export class RepetitionParameter extends ParameterBase {
  constructor() {
    super({
      id: "repetition",
      name: "Response Variety (Repetition Control)",
      description:
        "Controls how varied the AI's word and phrase choices will be.",
      validation: {
        min: -2.0,
        max: 2.0,
        step: 0.1,
      },
      defaultValue: {
        frequency: 0.0,
        presence: 0.0,
      },
    });

    logDebug(
      "RepetitionParameter constructor initialised with default configuration"
    );

    // Bind methods for event handling
    this.handleFrequencyInput = this.handleFrequencyInput.bind(this);
    this.handlePresenceInput = this.handlePresenceInput.bind(this);
    this.updateSliderLabel = this.updateSliderLabel.bind(this);
  }

  /**
   * Render the parameter template
   */
  render() {
    logDebug("RepetitionParameter render method started");

    // Create wrapper first
    const wrapper = document.createElement("div");
    wrapper.className = "parameter-control";
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-labelledby", `${this.id}-label`);

    // Store wrapper reference immediately
    this.elements.wrapper = wrapper;

    // Create all the inner content
    wrapper.innerHTML = `
      <div class="control-header">
        <label id="${this.id}-label">${this.name}</label>
        <span class="current-value" aria-live="polite">
          Current: <output id="${this.id}-output">Balanced (0.0, 0.0)</output>
        </span>
      </div>
  
      <div class="slider-container">
        <div class="repetition-sliders">
          <!-- Word Variety Slider -->
          <div class="repetition-slider">
            <label for="word-variety">Word Variety</label>
            <input 
              type="range" 
              id="word-variety"
              class="repetition-input"
              min="${this.validation.min}"
              max="${this.validation.max}"
              step="${this.validation.step}"
              value="${this.defaultValue.frequency}"
              aria-describedby="repetition-description word-variety-label"
            />
            <div class="slider-labels">
              <span id="RepSimilar">More Similar</span>
              <span id="RepBalanced">Balanced</span>
              <span id="RepVaried">More Varied</span>
            </div>
            <div id="word-variety-label" class="slider-value">
              Word variety: <output for="word-variety">${this.defaultValue.frequency.toFixed(
                1
              )}</output>
            </div>
          </div>
  
          <!-- Phrase Variety Slider -->
          <div class="repetition-slider">
            <label for="phrase-variety">Phrase Variety</label>
            <input 
              type="range" 
              id="phrase-variety"
              class="repetition-input"
              min="${this.validation.min}"
              max="${this.validation.max}"
              step="${this.validation.step}"
              value="${this.defaultValue.presence}"
              aria-describedby="repetition-description phrase-variety-label"
            />
            <div class="slider-labels">
              <span>More Similar</span>
              <span>Balanced</span>
              <span>More Varied</span>
            </div>
            <div id="phrase-variety-label" class="slider-value">
              Phrase variety: <output for="phrase-variety">${this.defaultValue.presence.toFixed(
                1
              )}</output>
            </div>
          </div>
        </div>
      </div>
  
      <div id="${this.id}-description" class="parameter-description">
        ${this.description}
      </div>
      <div class="parameter-status"></div>
    `;

    // Store element references after HTML is created
    this.elements.output = wrapper.querySelector(`#${this.id}-output`);
    this.elements.wordVariety = wrapper.querySelector("#word-variety");
    this.elements.phraseVariety = wrapper.querySelector("#phrase-variety");
    this.elements.description = wrapper.querySelector(
      `#${this.id}-description`
    );
    this.elements.status = wrapper.querySelector(".parameter-status");

    logDebug("RepetitionParameter DOM elements created and referenced");

    // Add to container if available
    if (this.elements.container) {
      this.elements.container.appendChild(wrapper);
      logDebug("RepetitionParameter wrapper added to container");
    }
  }

  /**
   * Initialize the parameter
   * @param {HTMLElement} container - Container element
   */
  initialize(container) {
    if (!container) {
      logError("RepetitionParameter: Container is required");
      return;
    }

    logInfo("RepetitionParameter initialising with container");

    try {
      this.elements.container = container;
      this.render();
      this.setupEventListeners();

      // Initialize with default values
      this.value = {
        frequency: this.defaultValue.frequency,
        presence: this.defaultValue.presence,
      };

      // Double-check elements are found
      const requiredElements = ["wordVariety", "phraseVariety", "output"];
      const missingElements = requiredElements.filter(
        (el) => !this.elements[el]
      );

      if (missingElements.length > 0) {
        throw new Error(
          `Missing required elements: ${missingElements.join(", ")}`
        );
      }

      this.updateCombinedOutput(this.value.frequency, this.value.presence);
      logInfo("RepetitionParameter successfully initialised");
    } catch (error) {
      logError("RepetitionParameter initialisation failed:", error);
      throw error;
    }
  }

  /**
   * Validate parameter value
   * @param {number} value - Value to validate
   * @returns {number} - Validated value
   */
  validateValue(value) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      logDebug("RepetitionParameter: Invalid value provided, returning 0.0");
      return 0.0;
    }
    const validatedValue = Math.min(
      Math.max(numValue, this.validation.min),
      this.validation.max
    );

    if (validatedValue !== numValue) {
      logDebug(
        `RepetitionParameter: Value ${numValue} clamped to ${validatedValue}`
      );
    }

    return validatedValue;
  }

  /**
   * Handle frequency penalty input
   * @param {Event} event - Input event
   */
  handleFrequencyInput(event) {
    const newValue = this.validateValue(event.target.value);
    this.value = {
      ...this.value,
      frequency: newValue,
    };
    logDebug(`RepetitionParameter: Frequency value updated to ${newValue}`);
    this.updateCombinedOutput(newValue, this.value.presence);
    this.updateSliderLabel("frequency", newValue);
  }

  /**
   * Handle presence penalty input
   * @param {Event} event - Input event
   */
  handlePresenceInput(event) {
    const newValue = this.validateValue(event.target.value);
    this.value = {
      ...this.value,
      presence: newValue,
    };
    logDebug(`RepetitionParameter: Presence value updated to ${newValue}`);
    this.updateCombinedOutput(this.value.frequency, newValue);
    this.updateSliderLabel("presence", newValue);
  }

  /**
   * Update slider label with current value
   * @param {string} type - Type of penalty (frequency/presence)
   * @param {number} value - Current value
   */
  updateSliderLabel(type, value) {
    // Map the type to the correct element ID
    const elementId = type === "frequency" ? "word-variety" : "phrase-variety";

    // Find the output element within the label div
    const outputElement = this.elements.wrapper.querySelector(
      `#${elementId}-label output`
    );

    if (outputElement) {
      // Update the output value
      outputElement.textContent = value.toFixed(1);

      // Also update the form association
      outputElement.setAttribute("for", elementId);

      // Update ARIA live region for screen readers
      const varietyType = type === "frequency" ? "word" : "phrase";
      const announcement = `${varietyType} variety set to ${value.toFixed(1)}`;
      a11y.announceStatus(announcement, "polite");

      logDebug(
        `RepetitionParameter: Updated ${varietyType} variety label to ${value.toFixed(
          1
        )}`
      );
    } else {
      logWarn(`Output element not found for ${elementId}-label`);
    }
  }

  /**
   * Update combined output display
   * @param {number} frequency - Frequency penalty value
   * @param {number} presence - Presence penalty value
   */
  updateCombinedOutput(frequency, presence) {
    if (this.elements.output) {
      const displayText = `Balanced (${frequency.toFixed(
        1
      )}, ${presence.toFixed(1)})`;
      this.elements.output.textContent = displayText;

      logDebug(
        `RepetitionParameter: Combined output updated to "${displayText}"`
      );

      // Update ARIA description
      this.updateDescription({ frequency, presence });
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    logDebug("RepetitionParameter: Setting up event listeners");

    const frequencySlider =
      this.elements.wrapper.querySelector("#word-variety");
    const presenceSlider =
      this.elements.wrapper.querySelector("#phrase-variety");

    if (frequencySlider) {
      frequencySlider.addEventListener("input", this.handleFrequencyInput);

      // Add keyboard support
      frequencySlider.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") {
          e.target.value =
            parseFloat(e.target.value) + parseFloat(this.validation.step);
          this.handleFrequencyInput(e);
        } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
          e.target.value =
            parseFloat(e.target.value) - parseFloat(this.validation.step);
          this.handleFrequencyInput(e);
        }
      });
      logDebug(
        "RepetitionParameter: Frequency slider event listeners attached"
      );
    }

    if (presenceSlider) {
      presenceSlider.addEventListener("input", this.handlePresenceInput);

      // Add keyboard support
      presenceSlider.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") {
          e.target.value =
            parseFloat(e.target.value) + parseFloat(this.validation.step);
          this.handlePresenceInput(e);
        } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
          e.target.value =
            parseFloat(e.target.value) - parseFloat(this.validation.step);
          this.handlePresenceInput(e);
        }
      });
      logDebug("RepetitionParameter: Presence slider event listeners attached");
    }
  }

  /**
   * Get current parameter values for both penalties
   * @returns {Object} Object containing both penalty values
   */
  getValue() {
    // Debug log for element state
    logDebug("RepetitionParameter getting values, elements:", {
      wrapper: this.elements.wrapper,
      wordVariety: this.elements.wrapper?.querySelector("#word-variety"),
      phraseVariety: this.elements.wrapper?.querySelector("#phrase-variety"),
    });

    try {
      // Get word variety (frequency penalty) value
      const wordVarietyElement =
        this.elements.wrapper?.querySelector("#word-variety");
      const frequencyValue = wordVarietyElement
        ? this.validateValue(parseFloat(wordVarietyElement.value))
        : this.defaultValue.frequency;

      // Get phrase variety (presence penalty) value
      const phraseVarietyElement =
        this.elements.wrapper?.querySelector("#phrase-variety");
      const presenceValue = phraseVarietyElement
        ? this.validateValue(parseFloat(phraseVarietyElement.value))
        : this.defaultValue.presence;

      // Validate both values are numbers
      if (isNaN(frequencyValue) || isNaN(presenceValue)) {
        logWarn("RepetitionParameter: Invalid values detected, using defaults");
        return {
          frequency_penalty: this.defaultValue.frequency,
          presence_penalty: this.defaultValue.presence,
        };
      }

      const values = {
        frequency_penalty: frequencyValue,
        presence_penalty: presenceValue,
      };

      // Debug log the returned values
      logDebug("RepetitionParameter getValue returning:", values);
      return values;
    } catch (error) {
      // Log error and return defaults if anything goes wrong
      logError("RepetitionParameter: Error getting values:", error);
      return {
        frequency_penalty: this.defaultValue.frequency,
        presence_penalty: this.defaultValue.presence,
      };
    }
  }

  /**
   * Update description based on current values
   * @param {Object} values - Current penalty values
   */
  updateDescription(values) {
    if (!this.elements.description) return;

    const description = this.getValueDescription(values);
    this.elements.description.textContent = description;

    // Announce significant changes
    if (Math.abs(values.frequency) > 1.5 || Math.abs(values.presence) > 1.5) {
      a11y.announceStatus(`Note: ${description}`, "polite");
      logInfo(`RepetitionParameter: Significant value change - ${description}`);
    }
  }

  /**
   * Get description for current values
   * @param {Object} values - Current penalty values
   * @returns {string} Description
   */
  getValueDescription({ frequency, presence }) {
    let description = this.description;

    // Add specific guidance based on current values
    if (frequency > 1.0 && presence > 1.0) {
      description +=
        " Current settings will strongly encourage varied language.";
    } else if (frequency < -1.0 && presence < -1.0) {
      description +=
        " Current settings will encourage more repetitive language.";
    } else if (Math.abs(frequency) <= 0.2 && Math.abs(presence) <= 0.2) {
      description += " Current settings maintain balanced language variety.";
    }

    return description;
  }
  /**
   * Update control state based on model support
   * @param {boolean} isSupported - Whether the parameter is supported
   */
  updateControlState(isSupported) {
    if (!this.elements.wrapper) return;

    logInfo(
      `RepetitionParameter: Updating control state - supported: ${isSupported}`
    );

    // Store current enabled state before updating
    const wasEnabled =
      !this.elements.wrapper.classList.contains("parameter-disabled");

    // Update base state by calling parent class method
    super.updateControlState(isSupported);

    // Get slider elements
    const frequencySlider =
      this.elements.wrapper.querySelector("#word-variety");
    const presenceSlider =
      this.elements.wrapper.querySelector("#phrase-variety");

    // Update disabled state of sliders
    if (frequencySlider) {
      frequencySlider.disabled = !isSupported;
      // Update ARIA attributes
      frequencySlider.setAttribute("aria-disabled", !isSupported);
    }

    if (presenceSlider) {
      presenceSlider.disabled = !isSupported;
      // Update ARIA attributes
      presenceSlider.setAttribute("aria-disabled", !isSupported);
    }

    // If state changed, announce to screen readers
    if (wasEnabled !== isSupported) {
      const message = isSupported
        ? "Repetition controls now available for selected model"
        : "Repetition controls not supported by selected model";
      logInfo(`RepetitionParameter: State change - ${message}`);
      // a11y.announceStatus(message, "polite");
    }

    // Update status message
    if (this.elements.status) {
      if (!isSupported) {
        this.elements.status.textContent = "Not supported by selected model";
        this.elements.status.setAttribute("role", "alert");
      } else {
        this.elements.status.textContent = "";
        this.elements.status.removeAttribute("role");
      }
    }

    // Update overall container ARIA labels
    if (this.elements.wrapper) {
      this.elements.wrapper.setAttribute("aria-disabled", !isSupported);
      if (!isSupported) {
        this.elements.wrapper.setAttribute(
          "aria-label",
          `${this.name} - Not supported by current model`
        );
      } else {
        this.elements.wrapper.removeAttribute("aria-label");
      }
    }
  }
}
