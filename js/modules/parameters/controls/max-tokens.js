/**
 * @fileoverview Max Tokens Parameter Implementation
 * @description Implements max tokens control with hybrid input system and cost estimation.
 * Provides numeric input, slider, and preset buttons with full accessibility support.
 */

import { ParameterBase } from "../base/parameter-base.js";
import { createParameterTemplate } from "../templates/parameter-template.js";
import { calculateCost, formatCost } from "../../../cost-calculator.js";
import { modelRegistry } from "../../../model-registry/model-registry-index.js";
import { a11y } from "../../../accessibility-helpers.js";

export class MaxTokensParameter extends ParameterBase {
  constructor() {
    super({
      id: "max-tokens",
      name: "Maximum Response Length",
      description:
        "Controls maximum length of AI responses. Longer responses cost more tokens.",
      validation: {
        min: 1,
        max: 4096,
        step: 1,
      },
      defaultValue: 1024,
    });

    // Bind methods
    this.handleNumericInput = this.handleNumericInput.bind(this);
    this.handleSliderInput = this.handleSliderInput.bind(this);
    this.handlePresetClick = this.handlePresetClick.bind(this);

    // Track current model for cost calculations
    this.currentModel = null;
  }

  /**
   * Initialize the parameter
   * @param {HTMLElement} container - Container element for the parameter
   */
  initialize(container) {
    if (!container) {
      console.error("MaxTokensParameter: Container is null");
      return;
    }

    this.elements.container = container;
    this.render();
    this.setupEventListeners();

    // Initialize with current model if available
    const currentModel = modelRegistry.getSelectedModel();
    if (currentModel) {
      this.updateControlState(currentModel);
    }
  }

  /**
   * Render the parameter template
   */
  render() {
    if (!this.elements.container) return;

    // Create wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "parameter-control";
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-labelledby", `${this.id}-label`);

    // Create header with label and value display
    const header = this.createHeader();

    // Create input group with numeric input and presets
    const inputGroup = this.createInputGroup();

    // Create slider control
    const sliderContainer = this.createSliderControl();

    // Create description
    const description = this.createDescription();

    // Assemble the template
    wrapper.appendChild(header);
    wrapper.appendChild(inputGroup);
    wrapper.appendChild(sliderContainer);
    wrapper.appendChild(description);

    // Store element references
    this.elements.wrapper = wrapper;
    this.elements.control = wrapper.querySelector(`#${this.id}-number`);
    this.elements.slider = wrapper.querySelector(`#${this.id}-slider`);
    this.elements.output = wrapper.querySelector(`#${this.id}-output`);
    this.elements.description = wrapper.querySelector(
      `#${this.id}-description`
    );
    this.elements.costEstimate = wrapper.querySelector(".cost-estimate");
    this.elements.availableTokens = wrapper.querySelector(".available-tokens");

    // Add to container
    this.elements.container.appendChild(wrapper);

    // Initialize cost estimate if model is set
    if (this.currentModel) {
      this.updateCostEstimate(this.value || this.defaultValue);
    }
  }

  /**
   * Create header element
   * @returns {HTMLElement} Header element
   */
  createHeader() {
    const header = document.createElement("div");
    header.className = "control-header";

    const label = document.createElement("label");
    label.id = `${this.id}-label`;
    label.setAttribute("for", `${this.id}-number`);
    label.textContent = this.name;

    const valueContainer = document.createElement("span");
    valueContainer.className = "current-value";
    valueContainer.setAttribute("aria-live", "polite");
    valueContainer.innerHTML = `Current: <output for="${this.id}-number" id="${this.id}-output">${this.defaultValue}</output> tokens`;

    header.appendChild(label);
    header.appendChild(valueContainer);
    return header;
  }

  /**
   * Create input group with numeric input and presets
   * @returns {HTMLElement} Input group element
   */
  createInputGroup() {
    const inputGroup = document.createElement("div");
    inputGroup.className = "tokens-input-group";

    // Create numeric input control
    const numericControl = document.createElement("div");
    numericControl.className = "numeric-control";

    const numericInput = document.createElement("input");
    numericInput.type = "number";
    numericInput.id = `${this.id}-number`;
    numericInput.min = this.validation.min;
    numericInput.max = this.validation.max;
    numericInput.value = this.defaultValue;
    numericInput.setAttribute(
      "aria-describedby",
      `${this.id}-description ${this.id}-limit`
    );

    const limitIndicator = document.createElement("span");
    limitIndicator.id = `${this.id}-limit`;
    limitIndicator.className = "limit-indicator";
    limitIndicator.innerHTML = `/ <span class="available-tokens">${this.validation.max}</span>`;

    numericControl.appendChild(numericInput);
    numericControl.appendChild(limitIndicator);

    // Create preset buttons
    const presetButtons = document.createElement("div");
    presetButtons.className = "preset-buttons";
    presetButtons.setAttribute("role", "group");
    presetButtons.setAttribute("aria-label", "Quick length presets");

    [25, 50, 75].forEach((percent) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.preset = percent;
      button.textContent = `${percent}%`;
      button.setAttribute("aria-label", `Set to ${percent}% of maximum length`);
      presetButtons.appendChild(button);
    });

    inputGroup.appendChild(numericControl);
    inputGroup.appendChild(presetButtons);
    return inputGroup;
  }

  /**
   * Create slider control
   * @returns {HTMLElement} Slider container element
   */
  createSliderControl() {
    const sliderContainer = document.createElement("div");
    sliderContainer.className = "slider-container";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.id = `${this.id}-slider`;
    slider.min = this.validation.min;
    slider.max = this.validation.max;
    slider.step = this.validation.step;
    slider.value = this.defaultValue;
    slider.setAttribute("aria-labelledby", `${this.id}-label`);
    slider.setAttribute("aria-describedby", `${this.id}-description`);

    const sliderLabels = document.createElement("div");
    sliderLabels.className = "slider-labels";
    ["Short", "Medium", "Long"].forEach((label) => {
      const span = document.createElement("span");
      span.textContent = label;
      sliderLabels.appendChild(span);
    });

    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(sliderLabels);
    return sliderContainer;
  }

  /**
   * Create description element
   * @returns {HTMLElement} Description element
   */
  createDescription() {
    const description = document.createElement("div");
    description.id = `${this.id}-description`;
    description.className = "parameter-description";
    description.textContent = this.description;

    const costEstimate = document.createElement("span");
    costEstimate.className = "cost-estimate";
    description.appendChild(costEstimate);

    return description;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    if (this.elements.control) {
      this.elements.control.addEventListener("input", this.handleNumericInput);
    }

    if (this.elements.slider) {
      this.elements.slider.addEventListener("input", this.handleSliderInput);
    }

    const presetButtons = this.elements.wrapper.querySelectorAll(
      ".preset-buttons button"
    );
    presetButtons.forEach((button) => {
      button.addEventListener("click", this.handlePresetClick);
    });
  }

  /**
   * Handle numeric input changes
   * @param {Event} event - Input event
   */
  handleNumericInput(event) {
    const newValue = parseInt(this.validateValue(event.target.value));
    this.updateAllControls(newValue);
  }

  /**
   * Handle slider input changes
   * @param {Event} event - Input event
   */
  handleSliderInput(event) {
    const newValue = parseInt(this.validateValue(event.target.value));
    this.updateAllControls(newValue);
  }

  /**
   * Handle preset button clicks
   * @param {Event} event - Click event
   */
  handlePresetClick(event) {
    const percent = parseInt(event.target.dataset.preset);
    const newValue = Math.round((this.validation.max * percent) / 100);
    this.updateAllControls(newValue);
  }

  /**
   * Update all control elements with new value
   * @param {number} value - New value
   */
  updateAllControls(value) {
    const validValue = this.validateValue(value);

    // Update numeric input
    if (this.elements.control) {
      this.elements.control.value = validValue;
    }

    // Update slider
    if (this.elements.slider) {
      this.elements.slider.value = validValue;
    }

    // Update output display
    if (this.elements.output) {
      this.elements.output.textContent = validValue;
    }

    // Update value and descriptions
    this.value = parseInt(validValue);
    this.updateDescription(validValue);

    // Update cost estimate
    if (this.currentModel) {
      this.updateCostEstimate(validValue);
    }

    // Announce change
    this.announceValueChange(validValue);
  }

  /**
   * Update the cost estimate display
   * @param {number} outputTokens - Number of output tokens
   */
  updateCostEstimate(outputTokens) {
    if (!this.elements.costEstimate || !this.currentModel) return;

    try {
      const cost = calculateCost(this.currentModel, 0, outputTokens);
      const formattedCost = formatCost(cost);

      this.elements.costEstimate.textContent = ` Estimated cost: ${formattedCost}`;
      this.elements.costEstimate.setAttribute(
        "aria-label",
        `Estimated cost for ${outputTokens} tokens: ${formattedCost}`
      );
    } catch (error) {
      console.warn("Could not calculate cost estimate:", error);
      this.elements.costEstimate.textContent = "";
      this.elements.costEstimate.removeAttribute("aria-label");
    }
  }

  /**
   * Get description for token value
   * @param {number} value - Token value
   * @returns {string} Description
   */
  getValueDescription(value) {
    const percent = Math.round((value / this.validation.max) * 100);
    if (percent <= 25) return "Short, concise responses";
    if (percent <= 50) return "Moderate length responses";
    if (percent <= 75) return "Detailed responses";
    return "Very detailed, comprehensive responses";
  }

  /**
   * Update control state based on model support
   * @param {Object} model - Model configuration
   */
  updateControlState(isSupported) {
    const previousModel = this.currentModel;

    // Get current model from registry
    const selectedModel = modelRegistry.getSelectedModel();
    if (selectedModel) {
      this.currentModel = selectedModel.id;
      const maxContextSize = selectedModel.maxContext || 4096;

      // Update validation max
      this.validation.max = maxContextSize;

      // Update control attributes
      if (this.elements.control) {
        this.elements.control.max = maxContextSize;
      }
      if (this.elements.slider) {
        this.elements.slider.max = maxContextSize;
      }
      if (this.elements.availableTokens) {
        this.elements.availableTokens.textContent = maxContextSize;
      }

      // Update current value if needed
      const currentValue = this.value || this.defaultValue;
      const validValue = this.validateValue(currentValue);
      this.updateAllControls(validValue);

      // Force cost estimate update if model changed
      if (previousModel !== this.currentModel) {
        this.updateCostEstimate(validValue);
      }
    } else {
      if (this.elements.costEstimate) {
        this.elements.costEstimate.textContent = "";
        this.elements.costEstimate.removeAttribute("aria-label");
      }
      this.currentModel = null;
    }

    // Call parent's updateControlState
    super.updateControlState(isSupported);
  }
}
