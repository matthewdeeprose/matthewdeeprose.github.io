import { modelRegistry } from "../model-registry/model-registry-index.js";

export class RequestValidator {
  validateRequest(messages, options) {
    const errors = [];

    if (!messages || !Array.isArray(messages)) {
      errors.push("Messages must be an array");
    }

    if (!options.model) {
      errors.push("Model must be specified");
    } else {
      const modelConfig = modelRegistry.getModel(options.model);
      if (!modelConfig) {
        errors.push(`Model ${options.model} not found`);
      }
    }

    if (options.temperature !== undefined) {
      const temp = parseFloat(options.temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        errors.push("Temperature must be between 0 and 2");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
