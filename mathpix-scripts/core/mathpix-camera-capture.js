/**
 * @fileoverview MathPix Camera Capture - Thin adapter over UniversalCameraCapture
 * @module MathPixCameraCapture
 * @version 2.0.0
 * @since Phase 1D (refactored Phase 8)
 *
 * @description
 * Adapts the standalone UniversalCameraCapture module for the MathPix controller
 * architecture. Delegates all camera logic to the universal module whilst maintaining
 * backwards compatibility with the MathPixBaseModule interface.
 */

import MathPixBaseModule from "./mathpix-base-module.js";

// UniversalCameraCapture loaded via <script> tag — available as window.UniversalCameraCapture
const UniversalCameraCapture = window.UniversalCameraCapture;

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

/**
 * @class MathPixCameraCapture
 * @extends MathPixBaseModule
 * @description
 * Thin adapter that delegates all camera operations to UniversalCameraCapture
 * whilst maintaining backwards compatibility with the MathPix controller system.
 *
 * @example
 * const cameraCapture = new MathPixCameraCapture(controller);
 * await cameraCapture.initialise(videoElement);
 * await cameraCapture.startCamera();
 * const photoFile = await cameraCapture.capturePhoto();
 *
 * @since 2.0.0
 */
class MathPixCameraCapture extends MathPixBaseModule {
  /**
   * Creates a new MathPix camera capture adapter
   * @param {Object} controller - Main MathPix controller instance
   */
  constructor(controller) {
    super(controller);

    /** @type {UniversalCameraCapture|null} */
    this.camera = null;

    logDebug("MathPixCameraCapture adapter created");
  }

  /**
   * Initialises the camera capture system via UniversalCameraCapture
   *
   * @param {HTMLVideoElement} videoElement - Video element for camera preview
   * @returns {Promise<boolean>} True if initialisation successful
   */
  async initialise(videoElement) {
    logInfo("Initialising MathPix camera adapter...");

    if (!videoElement) {
      throw new Error("Video element is required for camera capture");
    }

    try {
      this.camera = new UniversalCameraCapture({
        videoElement,
        fileNamePrefix: "mathpix-camera",
        onCapture: null, // Capture is handled by controller, not auto-routed
        onStatusChange: (message) => this.updateCameraStatus(message),
        onNotification: (message, type) => this.showNotification(message, type),
        labels: {
          startCamera: "Start Camera",
          stopCamera: "Stop Camera",
          cameraReady: "Camera active - Ready to capture",
          cameraInactive: "Camera inactive - Click Start Camera",
          startAriaLabel: "Start camera to capture mathematics",
          stopAriaLabel: "Stop camera",
        },
        controls: {
          captureBtn: this.controller.elements["capture-photo-btn"],
          switchBtn: this.controller.elements["switch-camera-btn"],
          rotateBtn: this.controller.elements["rotate-capture-btn"],
          mirrorBtn: this.controller.elements["mirror-toggle-btn"],
          startBtn: this.controller.elements["start-camera-btn"],
          startBtnText: this.controller.elements[
            "start-camera-btn"
          ]?.querySelector("#mathpix-start-btn-text"),
          statusElement: this.controller.elements["camera-status"],
        },
      });

      const success = await this.camera.initialise();
      this.isInitialised = success;

      logInfo("MathPix camera adapter initialised", { success });
      return success;
    } catch (error) {
      logError("Failed to initialise camera adapter", error);
      this.showNotification(
        "Camera not supported in this browser. Please use file upload instead.",
        "error",
      );
      return false;
    }
  }

  /**
   * Updates camera status text element
   * @param {string} message - Status message
   * @private
   */
  updateCameraStatus(message) {
    const statusElement = this.controller.elements["camera-status"];
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  // =========================================================================
  // DELEGATED METHODS — same public API as before
  // =========================================================================

  /** @returns {Promise<boolean>} */
  async startCamera() {
    return this.camera ? this.camera.startCamera() : false;
  }

  /** @returns {void} */
  stopCamera() {
    if (this.camera) this.camera.stopCamera();
  }

  /** @returns {Promise<File>} */
  async capturePhoto() {
    if (!this.camera) throw new Error("Camera system not initialised");
    return this.camera.capturePhoto();
  }

  /** @returns {Promise<boolean>} */
  async switchCamera() {
    return this.camera ? this.camera.switchCamera() : false;
  }

  /** @returns {void} */
  rotateCapture() {
    if (this.camera) this.camera.rotateCapture();
  }

  /** @param {number} angle */
  setRotation(angle) {
    if (this.camera) this.camera.setRotation(angle);
  }

  /** @returns {void} */
  resetRotation() {
    if (this.camera) this.camera.resetRotation();
  }

  /** @returns {string} */
  getRotationDescription() {
    return this.camera ? this.camera.getRotationDescription() : "Normal (0°)";
  }

  /** @returns {void} */
  toggleMirror() {
    if (this.camera) this.camera.toggleMirror();
  }

  // =========================================================================
  // PROPERTY ACCESSORS — maintain backwards compatibility
  // =========================================================================

  /** @type {boolean} */
  get isCameraActive() {
    return this.camera ? this.camera.isCameraActive : false;
  }

  /** @type {number} */
  get rotationAngle() {
    return this.camera ? this.camera.rotationAngle : 0;
  }

  /** @type {boolean} */
  get isPreviewMirrored() {
    return this.camera ? this.camera.isPreviewMirrored : true;
  }

  /** @type {File|null} */
  get lastCapturedImage() {
    return this.camera ? this.camera.lastCapturedImage : null;
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  /** @returns {boolean} */
  validate() {
    return super.validate() && !!(this.camera && this.camera.validate());
  }

  /** @returns {void} */
  cleanup() {
    if (this.camera) this.camera.cleanup();
    this.camera = null;
    super.cleanup();
  }

  /** @returns {Object} */
  getDebugInfo() {
    return {
      ...super.getDebugInfo(),
      adapterVersion: "2.0.0",
      universalCamera: this.camera ? this.camera.getDebugInfo() : null,
    };
  }
}

export default MathPixCameraCapture;
