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

// The app element carries the current mode, so CSS can hide the panels that
// belong to Upload but sit outside its container (parcel 10b).
const APP_ELEMENT_ID = "mathpix-app";
const MODE_ATTRIBUTE = "data-mathpix-mode";

// The result regions Upload, Draw and Photo share (parcel 10d).
const SHARED_RESULT_REGION_IDS = Object.freeze([
  "mathpix-image-preview-container",
  "mathpix-comparison-container",
  "mathpix-output-container",
]);

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
     * Current active mode ('upload', 'draw', 'camera', or 'convert')
     * @type {string}
     */
    this.currentMode = "upload"; // Default to upload mode

    /**
     * What each mode left showing in the shared result regions (parcel 10d)
     * @type {Map<string, {displays: Object, result: *, file: *}>}
     */
    this._resultsLeftByMode = new Map();

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
     * Camera container element
     * @type {HTMLElement|null}
     */
    this.cameraContainer = null;

    /**
     * Convert mode container element (Phase 6.3)
     * @type {HTMLElement|null}
     */
    this.convertContainer = null;

    /**
     * Resume mode container element (Phase 8.2)
     * @type {HTMLElement|null}
     */
    this.resumeContainer = null;

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
     * Camera mode radio button
     * @type {HTMLInputElement|null}
     */
    this.cameraRadio = null;

    /**
     * Convert mode radio button (Phase 6.3)
     * @type {HTMLInputElement|null}
     */
    this.convertRadio = null;

    /**
     * Resume mode radio button (Phase 8.2)
     * @type {HTMLInputElement|null}
     */
    this.resumeRadio = null;

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
   * @param {HTMLElement} uiElements.cameraContainer - Camera mode container
   * @param {HTMLInputElement} uiElements.uploadRadio - Upload radio button
   * @param {HTMLInputElement} uiElements.drawRadio - Draw radio button
   * @param {HTMLInputElement} uiElements.cameraRadio - Camera radio button
   *
   * @returns {Promise<boolean>} True if initialisation successful
   *
   * @throws {Error} When required UI elements are not provided
   *
   * @example
   * const elements = {
   *   uploadContainer: document.getElementById('mathpixUploadContainer'),
   *   drawContainer: document.getElementById('mathpixDrawContainer'),
   *   cameraContainer: document.getElementById('mathpixCameraContainer'),
   *   uploadRadio: document.getElementById('mathpixUploadMode'),
   *   drawRadio: document.getElementById('mathpixDrawMode'),
   *   cameraRadio: document.getElementById('mathpixCameraMode')
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
      "cameraContainer",
      "uploadRadio",
      "drawRadio",
      "cameraRadio",
    ];
    const missing = required.filter((key) => !uiElements[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required UI elements: ${missing.join(", ")}`);
    }

    // Store element references
    this.uploadContainer = uiElements.uploadContainer;
    this.drawContainer = uiElements.drawContainer;
    this.cameraContainer = uiElements.cameraContainer;
    this.uploadRadio = uiElements.uploadRadio;
    this.drawRadio = uiElements.drawRadio;
    this.cameraRadio = uiElements.cameraRadio;

    // Phase 6.3: Convert mode elements (optional - graceful fallback)
    this.convertContainer =
      uiElements.convertContainer ||
      document.getElementById("mathpix-convert-mode-container");
    this.convertRadio =
      uiElements.convertRadio ||
      document.getElementById("mathpix-convert-mode-radio");

    // Phase 8.2: Resume mode elements (optional - graceful fallback)
    this.resumeContainer =
      uiElements.resumeContainer ||
      document.getElementById("mathpix-resume-mode-container");
    this.resumeRadio =
      uiElements.resumeRadio ||
      document.getElementById("mathpix-resume-mode-radio");

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

    // Phase 8A-9 D-8: restore chemistry DOM ownership before clearing
    this._onModeExit(this.currentMode);

    // ✅ Clear any previous results before switching
    this.clearPreviousResults();

    // Update state
    this.currentMode = "upload";
    this._markCurrentMode();

    // Update UI visibility (using style.display to override inline styles)
    if (this.uploadContainer) this.uploadContainer.style.display = "";
    if (this.drawContainer) this.drawContainer.style.display = "none";
    if (this.cameraContainer) this.cameraContainer.style.display = "none";
    if (this.convertContainer) this.convertContainer.style.display = "none";
    if (this.resumeContainer) this.resumeContainer.style.display = "none";

    // Update radio button state
    if (this.uploadRadio) this.uploadRadio.checked = true;
    if (this.drawRadio) this.drawRadio.checked = false;
    if (this.cameraRadio) this.cameraRadio.checked = false;
    if (this.convertRadio) this.convertRadio.checked = false;
    if (this.resumeRadio) this.resumeRadio.checked = false;

    // Notify user
    this.showNotification("Upload mode active", "info");

    // Trigger mode change callback if available
    this.triggerModeChangeCallback("upload");
    this._restoreResults("upload");

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

    // Phase 8A-9 D-8: restore chemistry DOM ownership before clearing
    this._onModeExit(this.currentMode);

    // ✅ Clear any previous results before switching
    this.clearPreviousResults();

    // Update state
    this.currentMode = "draw";
    this._markCurrentMode();

    // Update UI visibility (using style.display to override inline styles)
    if (this.uploadContainer) this.uploadContainer.style.display = "none";
    if (this.drawContainer) this.drawContainer.style.display = "";
    if (this.cameraContainer) this.cameraContainer.style.display = "none";
    if (this.convertContainer) this.convertContainer.style.display = "none";
    if (this.resumeContainer) this.resumeContainer.style.display = "none";

    // Update radio button state
    if (this.uploadRadio) this.uploadRadio.checked = false;
    if (this.drawRadio) this.drawRadio.checked = true;
    if (this.cameraRadio) this.cameraRadio.checked = false;
    if (this.convertRadio) this.convertRadio.checked = false;
    if (this.resumeRadio) this.resumeRadio.checked = false;

    // Notify user
    this.showNotification(
      "Draw mode active. Use mouse or touch to draw mathematics.",
      "info"
    );

    // Trigger mode change callback if available
    this.triggerModeChangeCallback("draw");
    this._restoreResults("draw");

    logInfo("Switched to draw mode");
  }

  /**
   * Switches to camera mode
   *
   * @returns {void}
   *
   * @description
   * Transitions interface to camera mode, showing camera controls and
   * hiding upload/draw interfaces. Initialises camera if needed.
   *
   * @example
   * modeSwitcher.switchToCameraMode();
   *
   * @accessibility Announces mode change and provides camera instructions
   *
   * @since Phase 1D
   */
  switchToCameraMode() {
    logDebug("Switching to camera mode");

    // Phase 8A-9 D-8: restore chemistry DOM ownership before clearing
    this._onModeExit(this.currentMode);

    // ✅ Clear any previous results before switching
    this.clearPreviousResults();

    // Update state
    this.currentMode = "camera";
    this._markCurrentMode();

    // Update UI visibility (using style.display to override inline styles)
    if (this.uploadContainer) this.uploadContainer.style.display = "none";
    if (this.drawContainer) this.drawContainer.style.display = "none";
    if (this.cameraContainer) this.cameraContainer.style.display = "";
    if (this.convertContainer) this.convertContainer.style.display = "none";
    if (this.resumeContainer) this.resumeContainer.style.display = "none";

    // Update radio button state
    if (this.uploadRadio) this.uploadRadio.checked = false;
    if (this.drawRadio) this.drawRadio.checked = false;
    if (this.cameraRadio) this.cameraRadio.checked = true;
    if (this.convertRadio) this.convertRadio.checked = false;
    if (this.resumeRadio) this.resumeRadio.checked = false;

    // Notify user
    this.showNotification(
      "Camera mode active. Click 'Start Camera' to begin.",
      "info"
    );

    // Trigger mode change callback if available
    this.triggerModeChangeCallback("camera");
    this._restoreResults("camera");

    logInfo("Switched to camera mode");
  }

  /**
   * Switches to convert mode (Phase 6.3)
   *
   * @returns {void}
   *
   * @description
   * Transitions interface to convert mode, showing MMD input interface
   * and hiding other mode containers.
   *
   * @example
   * modeSwitcher.switchToConvertMode();
   *
   * @accessibility Announces mode change to screen readers
   *
   * @since Phase 6.3
   */
  switchToConvertMode() {
    logDebug("Switching to convert mode");

    // Phase 8A-9 D-8: restore chemistry DOM ownership before clearing
    this._onModeExit(this.currentMode);

    // ✅ Clear any previous results before switching
    this.clearPreviousResults();

    // Update state
    this.currentMode = "convert";
    this._markCurrentMode();

    // Update UI visibility (using style.display to override inline styles)
    if (this.uploadContainer) this.uploadContainer.style.display = "none";
    if (this.drawContainer) this.drawContainer.style.display = "none";
    if (this.cameraContainer) this.cameraContainer.style.display = "none";
    if (this.convertContainer) this.convertContainer.style.display = "";
    if (this.resumeContainer) this.resumeContainer.style.display = "none";

    // Update radio button state
    if (this.uploadRadio) this.uploadRadio.checked = false;
    if (this.drawRadio) this.drawRadio.checked = false;
    if (this.cameraRadio) this.cameraRadio.checked = false;
    if (this.convertRadio) this.convertRadio.checked = true;
    if (this.resumeRadio) this.resumeRadio.checked = false;

    // Notify user
    this.showNotification(
      "Convert mode active. Paste or upload MMD content to convert.",
      "info"
    );

    // Trigger mode change callback if available
    this.triggerModeChangeCallback("convert");
    this._restoreResults("convert");

    logInfo("Switched to convert mode");
  }

  /**
   * Switches to resume mode (Phase 8.2)
   *
   * @returns {void}
   *
   * @description
   * Transitions interface to resume mode, showing ZIP upload interface
   * for restoring previous MathPix sessions.
   *
   * @example
   * modeSwitcher.switchToResumeMode();
   *
   * @accessibility Announces mode change to screen readers
   *
   * @since Phase 8.2
   */
  switchToResumeMode() {
    logDebug("Switching to resume mode");

    // Phase 8A-9 D-8: restore chemistry DOM ownership before clearing
    this._onModeExit(this.currentMode);

    // Clear any previous results before switching
    this.clearPreviousResults();

    // Update state
    this.currentMode = "resume";
    this._markCurrentMode();

    // Update UI visibility (using style.display to override inline styles).
    // Phase 8A-8 Stage 3: removed a stale duplicate line that set
    // `resumeContainer.style.display = "none"` immediately after setting
    // it to "" — the restorer's own show() call later made things appear
    // to work, but the inline `display: none` lingered until show() ran.
    if (this.uploadContainer) this.uploadContainer.style.display = "none";
    if (this.drawContainer) this.drawContainer.style.display = "none";
    if (this.cameraContainer) this.cameraContainer.style.display = "none";
    if (this.convertContainer) this.convertContainer.style.display = "none";
    if (this.resumeContainer) this.resumeContainer.style.display = "";

    // Update radio button state
    if (this.uploadRadio) this.uploadRadio.checked = false;
    if (this.drawRadio) this.drawRadio.checked = false;
    if (this.cameraRadio) this.cameraRadio.checked = false;
    if (this.convertRadio) this.convertRadio.checked = false;
    if (this.resumeRadio) this.resumeRadio.checked = true;

    // Show session restorer
    const restorer = window.getMathPixSessionRestorer?.();
    if (restorer) {
      restorer.show();

      // Phase 8A-8 Stage 3: explicitly initialise the resume panel's
      // tab state rather than relying on whatever state happened to
      // persist from a previous session/mode. Use the last-viewed tab
      // (set by switchTab() on each call) or "mmd" as the deterministic
      // fallback. See CLAUDE.md "Mode-switcher invariant".
      if (typeof restorer.switchTab === "function") {
        const targetTab = restorer._lastResumeTab || "mmd";
        try {
          restorer.switchTab(targetTab);
        } catch (err) {
          logWarn("switchToResumeMode: restorer.switchTab threw", err);
        }
      }
    }

    // Notify user
    this.showNotification(
      "Resume mode active. Upload a ZIP archive to restore a previous session.",
      "info"
    );

    // Trigger mode change callback if available
    this.triggerModeChangeCallback("resume");
    this._restoreResults("resume");

    logInfo("Switched to resume mode");
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
   * Phase 8A-9 D-8: Central mode-exit hook. Called at the top of every
   * switchToXxxMode() BEFORE clearPreviousResults(). This is the single
   * place where canonical-DOM-ownership restoration happens (and where
   * any future cleanup step goes).
   *
   * If you add a new mode that takes DOM custody of chemistry elements,
   * update this method to restore on exit.
   *
   * @private
   * @param {string} prevMode - The mode being exited
   */
  _onModeExit(prevMode) {
    // Restore chemistry elements to their canonical panel
    // (#mathpix-output-smiles) if PDF mode moved them into #panel-chemistry.
    // This is idempotent — safe to call even when no move occurred.
    try {
      const pdfRenderer = this.controller?.pdfResultRenderer;
      if (pdfRenderer && typeof pdfRenderer._restoreChemistryToCanonical === "function") {
        pdfRenderer._restoreChemistryToCanonical();
      }
    } catch (error) {
      logWarn("_onModeExit: chemistry restore failed", error);
    }
  }

  /**
   * Clears all visible results and previews from previous mode
   *
   * @private
   * @returns {void}
   *
   * @description
   * Hides all result containers to provide clean state when switching modes.
   * Prevents confusion from stale results persisting across mode changes.
   *
   * @since 1.0.0
   */
  clearPreviousResults() {
    logDebug("Clearing previous results for mode switch");
    this._rememberResults(this.currentMode);

    // PDF results are not hidden: 10b's rule keeps them out of other modes (parcel 10d).
    const containersToHide = [
      "mathpix-image-preview-container", // Image preview
    ];

    containersToHide.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = "none";
        logDebug(`Hidden result container: ${id}`);
      }
    });

    // Call result renderer cleanup if available
    if (
      this.controller &&
      this.controller.resultRenderer &&
      typeof this.controller.resultRenderer.hideForModeSwitch === "function"
    ) {
      try {
        this.controller.resultRenderer.hideForModeSwitch();
        logDebug("Result renderer cleanup completed");
      } catch (error) {
        logWarn("Result renderer cleanup failed", error);
      }
    }

    logDebug("Previous results cleared successfully");
  }

  /**
   * Records the current mode on the app element, so CSS can hide Upload's
   * PDF workspace and upload check while another mode is showing.
   *
   * @private
   * @returns {void}
   */
  _markCurrentMode() {
    const app = document.getElementById(APP_ELEMENT_ID);
    if (app) app.setAttribute(MODE_ATTRIBUTE, this.currentMode);
  }

  /**
   * Records what the mode being left was showing in the shared result
   * regions, with the result and file it belongs to (parcel 10d). A mode
   * showing nothing leaves its earlier record alone.
   *
   * @private
   * @param {string} mode - The mode being left
   * @returns {void}
   */
  _rememberResults(mode) {
    const displays = {};
    let showing = false;
    for (const id of SHARED_RESULT_REGION_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      displays[id] = el.style.display;
      if (el.checkVisibility()) showing = true;
    }
    if (!showing) return;
    this._resultsLeftByMode.set(mode, {
      displays,
      result: this.controller?.resultRenderer?.currentResult ?? null,
      file: this.controller?.fileHandler?.currentUploadedFile ?? null,
    });
  }

  /**
   * Shows again what this mode left in the shared result regions, but only
   * if the same result and file are still current: if another mode has
   * shown its own since, this mode comes back empty (parcel 10d). A record
   * is used once.
   *
   * @private
   * @param {string} mode - The mode just entered
   * @returns {void}
   */
  _restoreResults(mode) {
    const record = this._resultsLeftByMode.get(mode);
    if (!record) return;
    this._resultsLeftByMode.delete(mode);
    const stillCurrent =
      record.result ===
        (this.controller?.resultRenderer?.currentResult ?? null) &&
      record.file ===
        (this.controller?.fileHandler?.currentUploadedFile ?? null);
    if (!stillCurrent) return;
    for (const [id, value] of Object.entries(record.displays)) {
      const el = document.getElementById(id);
      if (el) el.style.display = value;
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
   * Checks if currently in camera mode
   *
   * @returns {boolean} True if in camera mode
   *
   * @example
   * if (modeSwitcher.isCameraMode()) {
   *   console.log('Currently in camera mode');
   * }
   *
   * @since Phase 1D
   */
  isCameraMode() {
    return this.currentMode === "camera";
  }

  /**
   * Checks if currently in convert mode
   *
   * @returns {boolean} True if in convert mode
   *
   * @example
   * if (modeSwitcher.isConvertMode()) {
   *   console.log('Currently in convert mode');
   * }
   *
   * @since Phase 6.3
   */
  isConvertMode() {
    return this.currentMode === "convert";
  }

  /**
   * Checks if currently in resume mode
   *
   * @returns {boolean} True if in resume mode
   *
   * @example
   * if (modeSwitcher.isResumeMode()) {
   *   console.log('Currently in resume mode');
   * }
   *
   * @since Phase 8.2
   */
  isResumeMode() {
    return this.currentMode === "resume";
  }

  /**
   * Sets mode programmatically
   *
   * @param {string} mode - Mode to set ('upload', 'draw', or 'camera')
   * @returns {boolean} True if mode was changed
   *
   * @throws {Error} When invalid mode specified
   *
   * @example
   * modeSwitcher.setMode('camera');
   *
   * @since 1.0.0
   */
  setMode(mode) {
    if (
      mode !== "upload" &&
      mode !== "draw" &&
      mode !== "camera" &&
      mode !== "convert" &&
      mode !== "resume"
    ) {
      throw new Error(
        `Invalid mode: ${mode}. Must be 'upload', 'draw', 'camera', 'convert', or 'resume'`
      );
    }

    if (mode === this.currentMode) {
      logDebug("Already in requested mode", { mode });
      return false;
    }

    if (mode === "upload") {
      this.switchToUploadMode();
    } else if (mode === "draw") {
      this.switchToDrawMode();
    } else if (mode === "camera") {
      this.switchToCameraMode();
    } else if (mode === "convert") {
      this.switchToConvertMode();
    } else if (mode === "resume") {
      this.switchToResumeMode();
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
        this.cameraContainer &&
        this.convertContainer &&
        this.resumeContainer &&
        this.uploadRadio &&
        this.drawRadio &&
        this.cameraRadio &&
        this.convertRadio &&
        this.resumeRadio &&
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
      hasCameraContainer: !!this.cameraContainer,
      hasConvertContainer: !!this.convertContainer,
      hasResumeContainer: !!this.resumeContainer,
      hasUploadRadio: !!this.uploadRadio,
      hasDrawRadio: !!this.drawRadio,
      hasCameraRadio: !!this.cameraRadio,
      hasConvertRadio: !!this.convertRadio,
      hasResumeRadio: !!this.resumeRadio,
      uploadRadioChecked: this.uploadRadio?.checked || false,
      drawRadioChecked: this.drawRadio?.checked || false,
      cameraRadioChecked: this.cameraRadio?.checked || false,
      convertRadioChecked: this.convertRadio?.checked || false,
      resumeRadioChecked: this.resumeRadio?.checked || false,
      hasEventListeners: this.hasEventListeners,
    };
  }
}

export default MathPixModeSwitcher;
