/**
 * @fileoverview Base module providing common functionality for all MathPix components
 * @module MathPixBaseModule
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Foundation class for the MathPix modular architecture, providing shared functionality
 * and standardised interfaces for all MathPix system components. Implements common
 * patterns for controller integration, notification handling, and resource management.
 *
 * Key Features:
 * - Standardised controller integration pattern
 * - Unified notification system access
 * - Common cleanup and validation interfaces
 * - Consistent logging and error handling
 * - WCAG 2.2 AA accessibility foundation
 *
 * Integration:
 * - Extended by all MathPix UI components
 * - Provides controller reference and element access
 * - Integrates with universal notification system
 * - Supports modular cleanup and lifecycle management
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant base patterns
 * - Notification integration supports screen readers
 * - Provides foundation for accessible component development
 */

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * Determines if logging should occur at the specified level
 * @private
 * @param {number} level - Log level to check
 * @returns {boolean} True if logging should occur
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * Logs error messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

/**
 * Logs warning messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

/**
 * Logs informational messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

/**
 * Logs debug messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

/**
 * @class MathPixBaseModule
 * @description
 * Abstract base class providing common functionality and standardised interfaces
 * for all MathPix system components. Establishes controller integration patterns,
 * notification handling, and resource management foundations.
 *
 * This class implements the foundation for the MathPix modular architecture,
 * ensuring consistent controller access, element management, and cleanup
 * procedures across all components.
 *
 * @example
 * // Extend for custom MathPix components
 * class CustomMathPixComponent extends MathPixBaseModule {
 *   constructor(controller) {
 *     super(controller);
 *     this.customProperty = 'value';
 *   }
 *
 *   customMethod() {
 *     this.showNotification('Custom operation completed', 'success');
 *   }
 * }
 *
 * @see {@link MathPixFileHandler} for file handling implementation
 * @see {@link MathPixResultRenderer} for result rendering implementation
 * @since 1.0.0
 */
class MathPixBaseModule {
  /**
   * Creates a new MathPix base module instance
   *
   * @param {Object} controller - Main MathPix controller instance
   * @param {Object} controller.elements - Cached DOM elements
   * @param {Function} controller.showNotification - Notification method
   * @throws {Error} When controller reference is not provided
   *
   * @example
   * const module = new MathPixBaseModule(mathPixController);
   *
   * @accessibility Controller must support notification system for screen reader compatibility
   * @since 1.0.0
   */
  constructor(controller) {
    if (!controller) {
      throw new Error("Controller reference is required for MathPix modules");
    }

    /**
     * Reference to the main MathPix controller
     * @type {Object}
     * @readonly
     */
    this.controller = controller;

    /**
     * Indicates whether the module has been properly initialised
     * @type {boolean}
     */
    this.isInitialised = false;

    logDebug(`${this.constructor.name} base module created`);
  }

  /**
   * Provides access to controller's cached DOM elements
   *
   * @type {Object}
   * @readonly
   * @description
   * Getter providing standardised access to the controller's cached DOM elements.
   * Returns an empty object if elements are not available, preventing errors
   * in component code.
   *
   * @returns {Object} Dictionary of cached DOM elements keyed by element identifier
   *
   * @example
   * // Access cached elements
   * const fileInput = this.elements['file-input'];
   * const outputContainer = this.elements['output-container'];
   *
   * @since 1.0.0
   */
  get elements() {
    return this.controller.elements || {};
  }

  /**
   * Shows user notifications through the controller's notification system
   *
   * @param {string} message - Notification message to display to user
   * @param {string} [type='info'] - Notification type: 'info', 'success', 'error', 'warning'
   * @returns {void}
   *
   * @description
   * Provides standardised access to the universal notification system through
   * the controller. Falls back to console logging if the controller's notification
   * method is not available. Supports WCAG 2.2 AA accessibility requirements
   * through the underlying notification system.
   *
   * @example
   * // Show success notification
   * this.showNotification('File processed successfully', 'success');
   *
   * // Show error notification
   * this.showNotification('Processing failed', 'error');
   *
   * // Show default info notification
   * this.showNotification('Operation in progress');
   *
   * @accessibility
   * - Integrates with universal notification system supporting screen readers
   * - Notifications are announced to assistive technology
   * - Maintains focus management for keyboard users
   *
   * @since 1.0.0
   */
  showNotification(message, type = "info") {
    if (this.controller.showNotification) {
      return this.controller.showNotification(message, type);
    } else {
      logWarn("Controller notification method not available");
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Performs resource cleanup for the module
   *
   * @returns {void}
   * @abstract
   *
   * @description
   * Base cleanup method that should be overridden in subclasses to perform
   * specific resource cleanup. This includes removing event listeners,
   * clearing timers, revoking blob URLs, and resetting component state.
   *
   * The base implementation provides logging for debugging purposes.
   * Subclasses should call super.cleanup() after performing their
   * specific cleanup operations.
   *
   * @example
   * // Override in subclass
   * cleanup() {
   *   // Perform specific cleanup
   *   this.clearEventListeners();
   *   this.revokeFileBlobs();
   *
   *   // Call parent cleanup
   *   super.cleanup();
   * }
   *
   * @since 1.0.0
   */
  cleanup() {
    logDebug(`${this.constructor.name} cleanup completed`);
  }

  /**
   * Validates that the module is properly configured
   *
   * @returns {boolean} True if module is properly configured and ready for use
   * @abstract
   *
   * @description
   * Base validation method that can be overridden in subclasses to perform
   * specific configuration validation. The base implementation checks for
   * essential controller and elements availability.
   *
   * Subclasses should extend this validation to check for component-specific
   * requirements such as DOM elements, API configuration, or required dependencies.
   *
   * @example
   * // Override in subclass for specific validation
   * validate() {
   *   if (!super.validate()) return false;
   *
   *   // Check component-specific requirements
   *   return !!(this.elements.fileInput && this.apiClient);
   * }
   *
   * @since 1.0.0
   */
  validate() {
    return !!(this.controller && this.controller.elements);
  }

  /**
   * Gets the module's current initialisation status
   *
   * @returns {boolean} True if the module has been successfully initialised
   *
   * @description
   * Provides access to the module's initialisation state. This can be used
   * by the controller or other components to determine if the module is
   * ready for operation.
   *
   * @example
   * if (module.isModuleInitialised()) {
   *   module.performOperation();
   * } else {
   *   console.warn('Module not yet initialised');
   * }
   *
   * @since 1.0.0
   */
  isModuleInitialised() {
    return this.isInitialised;
  }

  /**
   * Gets basic module information for debugging
   *
   * @returns {Object} Object containing module debug information
   * @returns {string} returns.name - Module class name
   * @returns {boolean} returns.initialised - Whether module is initialised
   * @returns {boolean} returns.hasController - Whether controller reference exists
   * @returns {boolean} returns.hasElements - Whether elements are available
   * @returns {boolean} returns.isValid - Whether module validates successfully
   *
   * @description
   * Provides debugging information about the module's current state.
   * Useful for troubleshooting integration issues and verifying module
   * configuration during development and testing.
   *
   * @example
   * const debugInfo = module.getDebugInfo();
   * console.log('Module status:', debugInfo);
   *
   * @since 1.0.0
   */
  getDebugInfo() {
    return {
      name: this.constructor.name,
      initialised: this.isInitialised,
      hasController: !!this.controller,
      hasElements: !!(this.controller && this.controller.elements),
      isValid: this.validate(),
    };
  }
}

export default MathPixBaseModule;
