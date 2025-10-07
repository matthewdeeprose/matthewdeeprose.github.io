/**
 * @fileoverview Temperature Parameter Implementation
 * @description Implements temperature control with specific validation and descriptions
 */

import { ParameterBase } from "../base/parameter-base.js";
import { createParameterTemplate } from "../templates/parameter-template.js";

export class TemperatureParameter extends ParameterBase {
  constructor() {
    super({
      id: "temperature",
      name: "Response Creativity (Temperature)",
      description:
        "Controls response creativity. Lower values give focused, consistent responses. Higher values increase variety and creativity.",
      validation: {
        min: 0.1,
        max: 2,
        step: 0.1,
      },
      defaultValue: 0.8,
    });
  }

  /**
   * Render the temperature parameter template
   */
  render() {
    const template = createParameterTemplate({
      id: this.id,
      name: this.name,
      description: this.description,
      validation: this.validation,
      defaultValue: this.defaultValue,
    });

    if (this.elements.wrapper) {
      // Clear any existing content
      this.elements.wrapper.innerHTML = "";

      // Move the template content into our wrapper
      while (template.firstChild) {
        this.elements.wrapper.appendChild(template.firstChild);
      }

      // Store element references
      this.elements.control = this.elements.wrapper.querySelector(
        `#${this.id}`
      );
      this.elements.output = this.elements.wrapper.querySelector(
        `#${this.id}-output`
      );
      this.elements.description = this.elements.wrapper.querySelector(
        `#${this.id}-description`
      );
    }
  }

  /**
   * Get description for temperature value
   * @param {number} value - Temperature value
   * @returns {string} Description of the temperature setting
   */
  getValueDescription(value) {
    const tempValue = parseFloat(value);

    if (tempValue <= 0.3) {
      return "Very focused and consistent responses";
    }
    if (tempValue <= 0.7) {
      return "Focused, mostly consistent responses";
    }
    if (tempValue <= 1.3) {
      return "Balanced creativity and consistency";
    }
    if (tempValue <= 1.7) {
      return "More creative and varied responses";
    }
    return "Highly creative and diverse responses";
  }

  /**
   * Validate temperature value
   * @param {number|string} value - Value to validate
   * @returns {number} Validated value
   */
  validateValue(value) {
    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      console.warn("Invalid temperature value:", value);
      return this.defaultValue;
    }

    // Ensure value is within valid range
    return Math.min(
      Math.max(numValue, this.validation.min),
      this.validation.max
    );
  }

  /**
   * Handle input events specific to temperature
   * @param {Event} event - Input event
   */
  handleInput(event) {
    const newValue = this.validateValue(event.target.value);
    this.setValue(newValue);

    // Additional temperature-specific handling can be added here
    console.log("Temperature updated:", {
      value: newValue,
      description: this.getValueDescription(newValue),
    });
  }
}
