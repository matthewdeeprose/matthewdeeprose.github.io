/**
 * @fileoverview Parameter Template Generator
 * @description Generates consistent HTML templates for parameter controls
 * maintaining accessibility and styling compatibility
 */

/**
 * Generate parameter control template
 * @param {Object} config - Parameter configuration
 * @param {string} config.id - Parameter ID
 * @param {string} config.name - Parameter name
 * @param {string} config.description - Parameter description
 * @param {Object} config.validation - Validation configuration
 * @param {number} config.validation.min - Minimum value
 * @param {number} config.validation.max - Maximum value
 * @param {number} config.validation.step - Step value
 * @param {number} config.defaultValue - Default value
 * @returns {HTMLElement} Parameter control container
 */
export function createParameterTemplate(config) {
  // Create main container
  const container = document.createElement("div");
  container.className = "parameter-control";
  container.setAttribute("role", "region");
  container.setAttribute("aria-labelledby", `${config.id}-label`);

  // Create header with label and current value
  const header = document.createElement("div");
  header.className = "control-header";

  const label = document.createElement("label");
  label.id = `${config.id}-label`;
  label.setAttribute("for", config.id);
  label.textContent = config.name;

  const valueContainer = document.createElement("span");
  valueContainer.className = "current-value";
  valueContainer.setAttribute("aria-live", "polite");
  valueContainer.innerHTML = `Current: <output for="${config.id}" id="${config.id}-output">${config.defaultValue}</output>`;

  header.appendChild(label);
  header.appendChild(valueContainer);

  // Create slider container
  const sliderContainer = document.createElement("div");
  sliderContainer.className = "slider-container";

  // Create range input
  const input = document.createElement("input");
  input.type = "range";
  input.id = config.id;
  input.min = config.validation.min;
  input.max = config.validation.max;
  input.step = config.validation.step;
  input.value = config.defaultValue;
  input.setAttribute("aria-describedby", `${config.id}-description`);

  // Create slider labels
  const sliderLabels = document.createElement("div");
  sliderLabels.className = "slider-labels";

  // Create labels based on min/max values
  const minLabel = document.createElement("span");
  minLabel.textContent = `Focused (${config.validation.min})`;

  const midValue =
    (config.validation.max - config.validation.min) / 2 + config.validation.min;
  const midLabel = document.createElement("span");
  midLabel.textContent = `Balanced (${midValue})`;

  const maxLabel = document.createElement("span");
  maxLabel.textContent = `Creative (${config.validation.max})`;

  sliderLabels.appendChild(minLabel);
  sliderLabels.appendChild(midLabel);
  sliderLabels.appendChild(maxLabel);

  sliderContainer.appendChild(input);
  sliderContainer.appendChild(sliderLabels);

  // Create description
  const description = document.createElement("div");
  description.id = `${config.id}-description`;
  description.className = "parameter-description";
  description.textContent = config.description;

  // Handle extra content if provided
  if (config.extraContent) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = config.extraContent;
    while (tempDiv.firstChild) {
      container.appendChild(tempDiv.firstChild);
    }
  } else {
    // Default slider layout
    container.appendChild(header);
    container.appendChild(sliderContainer);
    container.appendChild(description);
  }

  return container;
}

/**
 * Create status message element
 * @param {string} message - Status message
 * @returns {HTMLElement} Status message element
 */
export function createStatusMessage(message) {
  const status = document.createElement("div");
  status.className = "parameter-status";
  status.textContent = message;
  return status;
}

/**
 * Update parameter description
 * @param {string} id - Parameter ID
 * @param {string} description - New description
 */
export function updateParameterDescription(id, description) {
  const descElement = document.getElementById(`${id}-description`);
  if (descElement) {
    descElement.textContent = description;
  }
}

/**
 * Update parameter value display
 * @param {string} id - Parameter ID
 * @param {number|string} value - New value
 */
export function updateParameterValue(id, value) {
  const output = document.getElementById(`${id}-output`);
  if (output) {
    output.textContent = value;
  }
}
