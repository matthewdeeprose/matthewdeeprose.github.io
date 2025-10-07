/**
 * @fileoverview Main entry point for the model registry system.
 * Provides a facade for the model registry functionality.
 */

import { ModelRegistryCore } from "./model-registry-core.js";
import { logger } from "./model-registry-logger.js";
import { utils } from "./model-registry-utils.js";
import { state } from "./model-registry-state.js";
import { validator } from "./model-registry-validator.js";
import { accessibility } from "./model-registry-accessibility.js";
import {
  DEFAULT_CONFIG,
  EVENT_TYPES,
  CAPABILITIES,
  PARAMETER_FEATURES,
  STATUS_CODES,
  ACCESSIBILITY_PREFERENCES,
} from "./model-registry-config.js";
import {
  ModelRegistryError,
  ModelValidationError,
  ModelNotFoundError,
  InvalidFallbackError,
  ParameterError,
  ErrorCodes,
} from "./model-registry-errors.js";

/**
 * Create and configure the model registry instance
 * @param {Object} options - Configuration options
 * @returns {ModelRegistryCore} Configured model registry instance
 */
function createModelRegistry(options = {}) {
  const registry = new ModelRegistryCore(options);

  // Initialize the registry
  registry.initialize(options);

  return registry;
}

// Create the singleton instance
const modelRegistry = createModelRegistry({
  autoValidateFallbacks: true,
  autoCorrectFallbacks: true,
});

// Export the singleton instance as the default export
export default modelRegistry;

// Export the singleton instance as a named export for backward compatibility
export { modelRegistry };

// Export utility classes and constants for advanced usage
export {
  ModelRegistryCore,
  logger,
  utils,
  state,
  validator,
  accessibility,
  DEFAULT_CONFIG,
  EVENT_TYPES,
  CAPABILITIES,
  PARAMETER_FEATURES,
  STATUS_CODES,
  ACCESSIBILITY_PREFERENCES,
  ModelRegistryError,
  ModelValidationError,
  ModelNotFoundError,
  InvalidFallbackError,
  ParameterError,
  ErrorCodes,
};
