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
      // An unregistered id is refused by the registry itself: getModel throws
      // ModelNotFoundError when not called silently, and that throw leaves this
      // method before any errors array could be returned (measured at parcels
      // 22 and 29: an unregistered id announced 0 and threw). The former
      // `if (!modelConfig)` branch below this call could therefore never run and
      // was removed at the parcel-38 fold; the call is kept because the throw IS
      // the behaviour.
      modelRegistry.getModel(options.model);
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
