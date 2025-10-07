/**
 * @fileoverview MathPix Mode Switcher - Upload/Draw Mode Toggle
 * @module MathPixModeSwitcher
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Manages switching between upload and drawing modes in the MathPix interface.
 * Provides seamless transitions, state management, and UI coordination for
 * different input methods.
 *
 * Key Features:
 * - Radio button mode selection (Upload/Draw)
 * - Container visibility management
 * - Mode-specific cleanup and initialisation
 * - State persistence and restoration
 * - Event delegation and coordination
 * - WCAG 2.2 AA accessibility support
 *
 * Integration:
 * - Extends MathPixBaseModule for controller integration
 * - Coordinates with MathPixFileHandler (upload mode)
 * - Coordinates with MathPixStrokesCanvas (draw mode)
 * - Integrates with main controller for state management
 *
 * Accessibility:
 * - Keyboard-navigable mode selection
 * - Screen reader announcements for mode changes
 * - Clear focus management during transitions
 */

import MathPixBaseModule from "../../core/mathpix-base-module.js";

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
 * @class MathPixModeSwitcher
 * @extends MathPixBaseModule
 * @description
 * Manages mode switching between file upload and canvas drawing interfaces.
 * Handles UI transitions, state management, and coordination with other
 * MathPix components.
 *
 * @example
 * const modeSwitcher = new MathPixModeSwitcher(controller);
 * await modeSwitcher.initialise(uiElements);
 * modeSwitcher.switchToDrawMode();
 *
 * @since 1.0.0
 */
class MathPixModeSwitcher extends MathPixBaseModule {
  /**
   * Creates a new mode switcher instance
   *
   * @param {Object} controller - Main MathPix controller instance
   * @throws {Error} When controller reference is not provided
   *
   * @since 1.0.0
   */
  constructor(controller) {
    super(controller);

    /**
     * Current active mode ('upload' or 'draw')
     * @type {string}
     */
    this.currentMode = "upload"; // Default to upload mode

    /**
     * Upload container element
     * @type {HTMLElement|null}
     */
    this.uploadContainer = null;

    /**
     * Draw container element
     * @type {HTMLElement|null}
     */
    this.drawContainer = null;

    /**
     * Upload mode radio button
     * @type {HTMLInputElement|null}
     */
    this.uploadRadio = null;

    /**
     * Draw mode radio button
     * @type {HTMLInputElement|null}
     */
    this.drawRadio = null;

    /**
     * Flag indicating if event listeners are attached
     * @type {boolean}
     */
    this.hasEventListeners = false;

    logDebug("MathPixModeSwitcher instance created");
  }

  /**
   * Initialises the mode switcher with UI elements
   *
   * @param {Object} uiElements - UI element references
   * @param {HTMLElement} uiElements.uploadContainer - Upload mode container
   * @param {HTMLElement} uiElements.drawContainer - Draw mode container
   * @param {HTMLInputElement} uiElements.uploadRadio - Upload radio button
   * @param {HTMLInputElement} uiElements.drawRadio - Draw radio button
   *
   * @returns {Promise<boolean>} True if initialisation successful
   *
   * @throws {Error} When required UI elements are not provided
   *
   * @example
   * const elements = {
   *   uploadContainer: document.getElementById('mathpixUploadContainer'),
   *   drawContainer: document.getElementById('mathpixDrawContainer'),
   *   uploadRadio: document.getElementById('mathpixUploadMode'),
   *   drawRadio: document.getElementById('mathpixDrawMode')
   * };
   * await modeSwitcher.initialise(elements);
   *
   * @since 1.0.0
   */
  async initialise(uiElements) {
    logInfo("Initialising mode switcher...");

    // Validate required elements
    if (!uiElements) {
      throw new Error("UI elements object is required");
    }

    const required = [
      "uploadContainer",
      "drawContainer",
      "uploadRadio",
      "drawRadio",
    ];
    const missing = required.filter((key) => !uiElements[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required UI elements: ${missing.join(", ")}`);
    }

    // Store element references
    this.uploadContainer = uiElements.uploadContainer;
    this.drawContainer = uiElements.drawContainer;
    this.uploadRadio = uiElements.uploadRadio;
    this.drawRadio = uiElements.drawRadio;

    // Attach event listeners
    this.attachEventListeners();

    // Set initial mode (upload by default)
    this.switchToUploadMode();

    this.isInitialised = true;
    logInfo("Mode switcher initialised successfully");

    return true;
  }

  /**
   * Attaches event listeners to radio buttons
   *
   * @private
   * @returns {void}
   *
   * @description
   * Event listener attachment is handled by MathPixUIManager to prevent
   * duplicate listeners. This method is retained for API compatibility but
   * performs no action. UI Manager calls switchToUploadMode() and
   * switchToDrawMode() directly when radio buttons change.
   *
   * @accessibility Uses native radio button behavior for keyboard navigation
   *
   * @since 1.0.0
   */
  attachEventListeners() {
    if (this.hasEventListeners) {
      logDebug("Event listeners already managed by UI Manager");
      return;
    }

    // Event listeners are managed by MathPixUIManager to prevent duplicates
    // UI Manager attaches listeners to radio buttons and calls:
    // - this.switchToUploadMode() when upload radio clicked
    // - this.switchToDrawMode() when draw radio clicked
    logDebug("Mode switcher delegating event handling to UI Manager");

    this.hasEventListeners = true;
  }

  /**
   * Switches to upload mode
   *
   * @returns {void}
   *
   * @description
   * Transitions interface to upload mode, showing upload controls and
   * hiding drawing canvas. Performs cleanup of draw mode if needed.
   *
   * @example
   * modeSwitcher.switchToUploadMode();
   *
   * @accessibility Announces mode change to screen readers
   *
   * @since 1.0.0
   */
  switchToUploadMode() {
    logDebug("Switching to upload mode");

    // Update state
    this.currentMode = "upload";

    // Update UI visibility (using style.display to override inline styles)
    if (this.uploadContainer) this.uploadContainer.style.display = "";
    if (this.drawContainer) this.drawContainer.style.display = "none";

    // Update radio button state
    if (this.uploadRadio) this.uploadRadio.checked = true;
    if (this.drawRadio) this.drawRadio.checked = false;

    // Notify user
    this.showNotification("Upload mode active", "info");

    // Trigger mode change callback if available
    this.triggerModeChangeCallback("upload");

    logInfo("Switched to upload mode");
  }

  /**
   * Switches to draw mode
   *
   * @returns {void}
   *
   * @description
   * Transitions interface to draw mode, showing drawing canvas and
   * hiding upload controls. Initialises canvas if needed.
   *
   * @example
   * modeSwitcher.switchToDrawMode();
   *
   * @accessibility Announces mode change and provides drawing instructions
   *
   * @since 1.0.0
   */
  switchToDrawMode() {
    logDebug("Switching to draw mode");

    // Update state
    this.currentMode = "draw";

    // Update UI visibility (using style.display to override inline styles)
    if (this.uploadContainer) this.uploadContainer.style.display = "none";
    if (this.drawContainer) this.drawContainer.style.display = "";

    // Update radio button state
    if (this.uploadRadio) this.uploadRadio.checked = false;
    if (this.drawRadio) this.drawRadio.checked = true;

    // Notify user
    this.showNotification(
      "Draw mode active. Use mouse or touch to draw mathematics.",
      "info"
    );

    // Trigger mode change callback if available
    this.triggerModeChangeCallback("draw");

    logInfo("Switched to draw mode");
  }

  /**
   * Triggers mode change callback in controller
   *
   * @private
   * @param {string} newMode - The new active mode
   * @returns {void}
   *
   * @description
   * Notifies the controller of mode changes for coordination with other components.
   *
   * @since 1.0.0
   */
  triggerModeChangeCallback(newMode) {
    if (this.controller && typeof this.controller.onModeChange === "function") {
      try {
        this.controller.onModeChange(newMode);
        logDebug("Mode change callback triggered", { newMode });
      } catch (error) {
        logError("Mode change callback failed", error);
      }
    }
  }

  /**
   * Gets the current active mode
   *
   * @returns {string} Current mode ('upload' or 'draw')
   *
   * @example
   * const mode = modeSwitcher.getCurrentMode();
   * console.log(`Current mode: ${mode}`);
   *
   * @since 1.0.0
   */
  getCurrentMode() {
    return this.currentMode;
  }

  /**
   * Checks if currently in upload mode
   *
   * @returns {boolean} True if in upload mode
   *
   * @example
   * if (modeSwitcher.isUploadMode()) {
   *   console.log('Currently in upload mode');
   * }
   *
   * @since 1.0.0
   */
  isUploadMode() {
    return this.currentMode === "upload";
  }

  /**
   * Checks if currently in draw mode
   *
   * @returns {boolean} True if in draw mode
   *
   * @example
   * if (modeSwitcher.isDrawMode()) {
   *   console.log('Currently in draw mode');
   * }
   *
   * @since 1.0.0
   */
  isDrawMode() {
    return this.currentMode === "draw";
  }

  /**
   * Sets mode programmatically
   *
   * @param {string} mode - Mode to set ('upload' or 'draw')
   * @returns {boolean} True if mode was changed
   *
   * @throws {Error} When invalid mode specified
   *
   * @example
   * modeSwitcher.setMode('draw');
   *
   * @since 1.0.0
   */
  setMode(mode) {
    if (mode !== "upload" && mode !== "draw") {
      throw new Error(`Invalid mode: ${mode}. Must be 'upload' or 'draw'`);
    }

    if (mode === this.currentMode) {
      logDebug("Already in requested mode", { mode });
      return false;
    }

    if (mode === "upload") {
      this.switchToUploadMode();
    } else {
      this.switchToDrawMode();
    }

    return true;
  }

  /**
   * Validates mode switcher configuration
   *
   * @returns {boolean} True if properly configured
   *
   * @description
   * Extends base validation to check mode-specific requirements.
   *
   * @since 1.0.0
   */
  validate() {
    return (
      super.validate() &&
      !!(
        this.uploadContainer &&
        this.drawContainer &&
        this.uploadRadio &&
        this.drawRadio &&
        this.isInitialised
      )
    );
  }

  /**
   * Cleans up mode switcher resources
   *
   * @returns {void}
   *
   * @description
   * Removes event listeners and resets state.
   *
   * @since 1.0.0
   */
  cleanup() {
    // Remove event listeners if needed
    // Note: We don't remove them as they're attached to radio buttons
    // that persist across mode switches

    this.currentMode = "upload";
    super.cleanup();
  }

  /**
   * Gets mode switcher debug information
   *
   * @returns {Object} Debug information including current mode and element states
   *
   * @since 1.0.0
   */
  getDebugInfo() {
    return {
      ...super.getDebugInfo(),
      currentMode: this.currentMode,
      hasUploadContainer: !!this.uploadContainer,
      hasDrawContainer: !!this.drawContainer,
      hasUploadRadio: !!this.uploadRadio,
      hasDrawRadio: !!this.drawRadio,
      uploadRadioChecked: this.uploadRadio?.checked || false,
      drawRadioChecked: this.drawRadio?.checked || false,
      hasEventListeners: this.hasEventListeners,
    };
  }
}

export default MathPixModeSwitcher;
