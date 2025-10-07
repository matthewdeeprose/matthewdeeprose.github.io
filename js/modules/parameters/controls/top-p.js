/**
 * @fileoverview Top P Parameter Implementation
 * @description Implements top_p (nucleus sampling) control with specific validation and descriptions
 */

import { ParameterBase } from "../base/parameter-base.js";
import { createParameterTemplate } from "../templates/parameter-template.js";

export class TopPParameter extends ParameterBase {
  constructor() {
    super({
      id: "top-p",
      name: "Response Diversity (Top P)",
      description: "Adjusts how varied the model's word choices can be.",
      validation: {
        min: 0,
        max: 1,
        step: 0.05,
      },
      defaultValue: 1.0,
    });
  }

  /**
   * Render the top_p parameter template
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
   * Get description for top_p value
   * @param {number} value - Top P value
   * @returns {string} Description of the top_p setting
   */
  getValueDescription(value) {
    const topPValue = parseFloat(value);

    if (topPValue <= 0.2) {
      return "Very focused on highest probability tokens, producing more deterministic responses";
    }
    if (topPValue <= 0.5) {
      return "Balanced focus on likely outcomes while maintaining some variation";
    }
    if (topPValue <= 0.8) {
      return "Moderate diversity in responses with good balance of creativity";
    }
    return "Maximum diversity in token selection, allowing for most creative responses";
  }

  /**
   * Validate top_p value
   * @param {number|string} value - Value to validate
   * @returns {number} Validated value
   * @throws {Error} If value is invalid
   */
  validateValue(value) {
    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      console.warn("Invalid top_p value:", value);
      return this.defaultValue;
    }

    // Ensure value is within valid range
    if (numValue < 0 || numValue > 1) {
      console.warn("Top P value out of range:", numValue);
      return Math.min(
        Math.max(numValue, this.validation.min),
        this.validation.max
      );
    }

    return numValue;
  }

  /**
   * Handle input events specific to top_p
   * @param {Event} event - Input event
   */
  handleInput(event) {
    const newValue = this.validateValue(event.target.value);
    this.setValue(newValue);

    // Additional top_p-specific handling can be added here
    console.log("Top P updated:", {
      value: newValue,
      description: this.getValueDescription(newValue),
    });
  }
}
