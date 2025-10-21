/**
 * @fileoverview MathPix Camera Capture - Webcam/Mobile Camera Photo Capture
 * @module MathPixCameraCapture
 * @author MathPix Development Team
 * @version 1.0.0
 * @since Phase 1D
 *
 * @description
 * Manages camera access and photo capture for mathematical content processing.
 * Supports both desktop webcams and mobile device cameras with responsive
 * interface design and comprehensive error handling.
 *
 * Key Features:
 * - Desktop webcam and mobile camera support
 * - Live video preview with capture button
 * - Mobile-optimised interface
 * - Permission management and error handling
 * - Automatic cleanup of camera resources
 * - WCAG 2.2 AA accessibility support
 *
 * Integration:
 * - Extends MathPixBaseModule for controller integration
 * - Routes captured photos to MathPix Text API (same as file upload)
 * - Coordinates with MathPixFileHandler for processing
 * - Integrates with main controller for state management
 *
 * Accessibility:
 * - Keyboard-navigable camera controls
 * - Screen reader announcements for camera state
 * - Clear visual feedback for capture actions
 * - Alternative upload mode always available
 */

import MathPixBaseModule from "./mathpix-base-module.js";

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
 * @class MathPixCameraCapture
 * @extends MathPixBaseModule
 * @description
 * Manages camera access and photo capture for mathematical content processing.
 * Handles both desktop webcams and mobile cameras with responsive design.
 *
 * @example
 * const cameraCapture = new MathPixCameraCapture(controller);
 * await cameraCapture.initialise(videoElement);
 * await cameraCapture.startCamera();
 * const photoFile = await cameraCapture.capturePhoto();
 *
 * @since Phase 1D
 */
class MathPixCameraCapture extends MathPixBaseModule {
  /**
   * Creates a new camera capture instance
   *
   * @param {Object} controller - Main MathPix controller instance
   * @throws {Error} When controller reference is not provided
   *
   * @since Phase 1D
   */
  constructor(controller) {
    super(controller);

    /**
     * Video element for camera preview
     * @type {HTMLVideoElement|null}
     */
    this.videoElement = null;

    /**
     * Canvas for capturing photo frames
     * @type {HTMLCanvasElement|null}
     */
    this.captureCanvas = null;

    /**
     * Canvas 2D context
     * @type {CanvasRenderingContext2D|null}
     */
    this.captureContext = null;

    /**
     * Active media stream from camera
     * @type {MediaStream|null}
     */
    this.mediaStream = null;

    /**
     * Camera active state
     * @type {boolean}
     */
    this.isCameraActive = false;

    /**
     * Preferred camera constraints
     * @type {Object}
     */
    this.cameraConstraints = {
      video: {
        facingMode: "environment", // Prefer rear camera on mobile
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };

    /**
     * Current rotation angle for captured images
     * @type {number}
     * @description Rotation in degrees: 0, 90, 180, 270
     */
    this.rotationAngle = 0;

    /**
     * Preview mirroring state (Phase 1F)
     * @type {boolean}
     * @description True when preview is mirrored (default for natural UX)
     */
    this.isPreviewMirrored = true;

    /**
     * Last captured image reference (Phase 1F)
     * @type {File|null}
     * @description Stores the most recently captured photo for rotate logic
     */
    this.lastCapturedImage = null;

    logDebug("MathPixCameraCapture instance created");
  }

  /**
   * Initialises the camera capture system
   *
   * @param {HTMLVideoElement} videoElement - Video element for camera preview
   * @returns {Promise<boolean>} True if initialisation successful
   * @throws {Error} When video element not provided
   *
   * @example
   * const video = document.getElementById('mathpix-camera-video');
   * await cameraCapture.initialise(video);
   *
   * @since Phase 1D
   */
  async initialise(videoElement) {
    logInfo("Initialising camera capture system...");

    if (!videoElement) {
      throw new Error("Video element is required for camera capture");
    }

    // Store video element reference
    this.videoElement = videoElement;

    // Create hidden canvas for photo capture
    this.captureCanvas = document.createElement("canvas");
    this.captureContext = this.captureCanvas.getContext("2d");

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      logError("Camera API not supported in this browser");
      this.showNotification(
        "Camera not supported in this browser. Please use file upload instead.",
        "error"
      );
      return false;
    }

    this.isInitialised = true;
    logInfo("Camera capture system initialised successfully");

    return true;
  }

  /**
   * Starts the camera and displays live preview
   *
   * @returns {Promise<boolean>} True if camera started successfully
   *
   * @description
   * Requests camera permission and starts video stream. Handles permission
   * denials and hardware errors gracefully.
   *
   * @example
   * const started = await cameraCapture.startCamera();
   * if (started) {
   *   console.log('Camera preview active');
   * }
   *
   * @accessibility Announces camera state to screen readers
   * @since Phase 1D
   */
  async startCamera() {
    logInfo("Starting camera...");

    if (this.isCameraActive) {
      logWarn("Camera already active");
      return true;
    }

    if (!this.isInitialised) {
      logError("Camera system not initialised");
      this.showNotification("Camera system not ready", "error");
      return false;
    }

    try {
      // Request camera access
      this.mediaStream = await navigator.mediaDevices.getUserMedia(
        this.cameraConstraints
      );

      // Attach stream to video element
      this.videoElement.srcObject = this.mediaStream;
      this.videoElement.play();

      this.isCameraActive = true;

      // Phase 1E: Enable camera controls when camera becomes active
      this.enableCaptureControls();

      logInfo("Camera started successfully", {
        tracks: this.mediaStream.getVideoTracks().length,
        settings: this.mediaStream.getVideoTracks()[0]?.getSettings(),
      });

      this.showNotification(
        "Camera ready. Position mathematics in view.",
        "success"
      );

      return true;
    } catch (error) {
      logError("Failed to start camera", {
        error: error.message,
        name: error.name,
      });

      // Provide helpful error messages
      let errorMessage = "Failed to access camera";
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        errorMessage =
          "Camera permission denied. Please allow camera access and try again.";
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        errorMessage = "No camera found. Please use file upload instead.";
      } else if (
        error.name === "NotReadableError" ||
        error.name === "TrackStartError"
      ) {
        errorMessage =
          "Camera is in use by another application. Please close other apps and try again.";
      }

      this.showNotification(errorMessage, "error");

      return false;
    }
  }

  /**
   * Stops the camera and releases resources
   *
   * @returns {void}
   *
   * @description
   * Stops all media tracks and cleans up camera resources. Should be called
   * when switching modes or when camera is no longer needed.
   *
   * @example
   * cameraCapture.stopCamera();
   *
   * @since Phase 1D
   */
  stopCamera() {
    logInfo("Stopping camera...");

    if (!this.isCameraActive) {
      logDebug("Camera not active, nothing to stop");
      return;
    }

    if (this.mediaStream) {
      // Stop all video tracks
      this.mediaStream.getVideoTracks().forEach((track) => {
        track.stop();
        logDebug("Video track stopped", { trackId: track.id });
      });

      // Clear video element
      if (this.videoElement) {
        this.videoElement.srcObject = null;
      }

      this.mediaStream = null;
    }

    this.isCameraActive = false;

    // Phase 1E: Disable camera controls when camera becomes inactive
    this.disableCaptureControls();

    logInfo("Camera stopped successfully");
  }

  /**
   * Enables camera capture controls
   *
   * @returns {void}
   *
   * @description
   * Called when camera becomes active. Enables capture, switch, and rotate buttons.
   * Disables the start button to prevent re-initialization during active session.
   * Updates status text to indicate camera is ready.
   *
   * @private
   * @since Phase 1E
   */
  enableCaptureControls() {
    const captureBtn = this.controller.elements["capture-photo-btn"];
    const switchBtn = this.controller.elements["switch-camera-btn"];
    const rotateBtn = this.controller.elements["rotate-capture-btn"];
    const mirrorBtn = this.controller.elements["mirror-toggle-btn"];
    const startBtn = this.controller.elements["start-camera-btn"];
    const startBtnText = startBtn?.querySelector("#mathpix-start-btn-text");

    if (captureBtn) captureBtn.disabled = false;
    if (switchBtn) switchBtn.disabled = false;
    // Phase 1F: Rotate disabled until photo captured
    if (rotateBtn) rotateBtn.disabled = true;
    // Phase 1F: Enable mirror toggle when camera active
    if (mirrorBtn) mirrorBtn.disabled = false;
    // Phase 1F: Update start button to "Stop Camera"
    if (startBtnText) startBtnText.textContent = "Stop Camera";
    if (startBtn) {
      startBtn.setAttribute("aria-label", "Stop camera");
    }

    this.updateCameraStatus("Camera active - Ready to capture");

    logDebug("Camera capture controls enabled");
  }

  /**
   * Disables camera capture controls
   *
   * @returns {void}
   *
   * @description
   * Called when camera becomes inactive. Disables capture, switch, and rotate buttons.
   * Enables the start button to allow camera re-initialization.
   * Updates status text to indicate camera is inactive.
   *
   * @private
   * @since Phase 1E
   */
  disableCaptureControls() {
    const captureBtn = this.controller.elements["capture-photo-btn"];
    const switchBtn = this.controller.elements["switch-camera-btn"];
    const rotateBtn = this.controller.elements["rotate-capture-btn"];
    const mirrorBtn = this.controller.elements["mirror-toggle-btn"];
    const startBtn = this.controller.elements["start-camera-btn"];
    const startBtnText = startBtn?.querySelector("#mathpix-start-btn-text");

    if (captureBtn) captureBtn.disabled = true;
    if (switchBtn) switchBtn.disabled = true;
    if (rotateBtn) rotateBtn.disabled = true;
    // Phase 1F: Disable mirror toggle when camera inactive
    if (mirrorBtn) mirrorBtn.disabled = true;
    // Phase 1F: Update start button back to "Start Camera"
    if (startBtnText) startBtnText.textContent = "Start Camera";
    if (startBtn) {
      startBtn.setAttribute(
        "aria-label",
        "Start camera to capture mathematics"
      );
    }

    // Phase 1F: Reset state when camera stops
    this.lastCapturedImage = null;
    this.isPreviewMirrored = true;

    this.updateCameraStatus("Camera inactive - Click Start Camera");

    logDebug("Camera capture controls disabled");
  }

  /**
   * Updates camera status text for user feedback
   *
   * @param {string} message - Status message to display
   * @returns {void}
   *
   * @description
   * Updates the status text element with current camera state information.
   * Provides real-time feedback to users about camera readiness and actions.
   *
   * @example
   * this.updateCameraStatus('Capturing photo...');
   * this.updateCameraStatus('Photo captured successfully!');
   *
   * @private
   * @since Phase 1E
   */
  updateCameraStatus(message) {
    const statusElement = this.controller.elements["camera-status"];

    if (statusElement) {
      statusElement.textContent = message;
      logDebug("Camera status updated", { message });
    } else {
      logWarn("Camera status element not found");
    }
  }

  /**
   * Captures a photo from the current video frame
   *
   * @returns {Promise<File>} Captured photo as File object
   * @throws {Error} If camera not active or capture fails
   *
   * @description
   * Captures current video frame to canvas, converts to JPEG blob, and
   * returns as File object compatible with MathPix Text API. Maintains
   * aspect ratio and includes timestamp in filename.
   *
   * **CRITICAL: Handles Image Mirroring AND Rotation**
   * Front-facing cameras show mirrored video for natural user experience,
   * but mathematics must NOT be mirrored for OCR to work. Additionally,
   * users may need to rotate images to correct orientation. This method:
   * 1. Detects if using front camera (user/selfie mode)
   * 2. Flips the captured image horizontally if needed
   * 3. Applies any rotation transformation set by user
   * 4. Ensures mathematics is readable (not backwards or upside down)
   *
   * @example
   * const photoFile = await cameraCapture.capturePhoto();
   * // Process with MathPix Text API
   * await controller.fileHandler.handleUpload(photoFile);
   *
   * @since Phase 1D
   */
  async capturePhoto() {
    logInfo("Capturing photo...", {
      rotation: this.rotationAngle,
      facingMode: this.cameraConstraints.video.facingMode,
    });

    if (!this.isCameraActive) {
      throw new Error("Camera not active. Please start camera first.");
    }

    if (!this.videoElement.videoWidth || !this.videoElement.videoHeight) {
      throw new Error("Video not ready. Please wait for camera to initialise.");
    }

    try {
      // Determine canvas dimensions based on rotation
      const needsDimensionSwap =
        this.rotationAngle === 90 || this.rotationAngle === 270;
      const canvasWidth = needsDimensionSwap
        ? this.videoElement.videoHeight
        : this.videoElement.videoWidth;
      const canvasHeight = needsDimensionSwap
        ? this.videoElement.videoWidth
        : this.videoElement.videoHeight;

      // Set canvas size
      this.captureCanvas.width = canvasWidth;
      this.captureCanvas.height = canvasHeight;

      // CRITICAL: Handle front camera mirroring + rotation
      const isFrontCamera = this.cameraConstraints.video.facingMode === "user";

      // Save canvas state
      this.captureContext.save();

      // Apply transformations in correct order:
      // 1. Move to rotation center point
      // 2. Apply rotation
      // 3. Apply mirroring if front camera
      // 4. Move back to drawing position

      if (this.rotationAngle !== 0 || isFrontCamera) {
        // Move to center for rotation
        this.captureContext.translate(canvasWidth / 2, canvasHeight / 2);

        // Apply rotation
        if (this.rotationAngle !== 0) {
          const radians = (this.rotationAngle * Math.PI) / 180;
          this.captureContext.rotate(radians);
          logDebug("Applied rotation", {
            degrees: this.rotationAngle,
            radians,
          });
        }

        // Apply mirroring for front camera
        if (isFrontCamera) {
          this.captureContext.scale(-1, 1);
          logDebug("Applied mirroring for front camera");
        }

        // Move back to corner for drawing (accounting for rotation)
        const drawWidth = needsDimensionSwap
          ? this.videoElement.videoHeight
          : this.videoElement.videoWidth;
        const drawHeight = needsDimensionSwap
          ? this.videoElement.videoWidth
          : this.videoElement.videoHeight;

        this.captureContext.translate(-drawWidth / 2, -drawHeight / 2);
      }

      // Draw current video frame to canvas
      this.captureContext.drawImage(
        this.videoElement,
        0,
        0,
        this.videoElement.videoWidth,
        this.videoElement.videoHeight
      );

      // Restore canvas state (resets all transformations)
      this.captureContext.restore();

      // Convert canvas to blob (JPEG format)
      const blob = await new Promise((resolve, reject) => {
        this.captureCanvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create image blob"));
            }
          },
          "image/jpeg",
          0.92 // JPEG quality
        );
      });

      // Create File object with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `mathpix-camera-${timestamp}.jpg`;
      const file = new File([blob], fileName, { type: "image/jpeg" });

      // Phase 1F.2: Add capture metadata for transform system
      file.captureMetadata = {
        wasMirrored: this.isPreviewMirrored, // Current mirror state at capture time
        originalFormat: "image/jpeg", // Original format before any transforms
        source: "camera", // Indicates this came from camera capture
        capturedAt: new Date().toISOString(), // Timestamp of capture
      };

      // Phase 1F: Store captured image for rotate button logic
      this.lastCapturedImage = file;

      // Phase 1F: Enable rotate button now that we have a captured image
      const rotateBtn = this.controller.elements["rotate-capture-btn"];
      if (rotateBtn) {
        rotateBtn.disabled = false;
        logDebug("Rotate button enabled after capture");
      }

      logInfo("Photo captured successfully", {
        fileName,
        size: file.size,
        dimensions: `${this.captureCanvas.width}x${this.captureCanvas.height}`,
        wasMirrored: isFrontCamera,
        rotation: this.rotationAngle,
        orientation: isFrontCamera
          ? `corrected (was mirrored)${
              this.rotationAngle ? `, rotated ${this.rotationAngle}°` : ""
            }`
          : this.rotationAngle
          ? `rotated ${this.rotationAngle}°`
          : "original",
      });

      return file;
    } catch (error) {
      logError("Failed to capture photo", { error: error.message });
      throw new Error(`Photo capture failed: ${error.message}`);
    }
  }
  /**
   * Switches between front and rear cameras (mobile)
   *
   * @returns {Promise<boolean>} True if camera switched successfully
   *
   * @description
   * Attempts to switch between front-facing and rear-facing cameras on
   * mobile devices. Gracefully handles devices with only one camera.
   *
   * @example
   * await cameraCapture.switchCamera();
   *
   * @since Phase 1D
   */
  async switchCamera() {
    logInfo("Attempting to switch camera...");

    if (!this.isCameraActive) {
      logWarn("Camera not active, cannot switch");
      return false;
    }

    // Toggle facing mode
    const currentFacing = this.cameraConstraints.video.facingMode;
    const newFacing = currentFacing === "environment" ? "user" : "environment";

    logDebug("Switching camera", {
      from: currentFacing,
      to: newFacing,
    });

    // Stop current camera
    this.stopCamera();

    // Update constraints
    this.cameraConstraints.video.facingMode = newFacing;

    // Start with new camera
    const success = await this.startCamera();

    if (success) {
      const cameraType = newFacing === "environment" ? "rear" : "front";
      this.showNotification(`Switched to ${cameraType} camera`, "success");
    }

    return success;
  }

  /**
   * Rotates the capture orientation by 90 degrees clockwise
   *
   * @returns {void}
   *
   * @description
   * Cycles through rotation angles: 0° → 90° → 180° → 270° → 0°
   * Useful for correcting orientation when device is held at an angle
   * or when captured image needs rotation correction.
   *
   * @example
   * cameraCapture.rotateCapture(); // Rotates 90° clockwise
   *
   * @since Phase 1D
   */
  rotateCapture() {
    this.rotationAngle = (this.rotationAngle + 90) % 360;

    logInfo("Capture rotation updated", {
      angle: this.rotationAngle,
      description: this.getRotationDescription(),
    });

    this.showNotification(`Rotation: ${this.getRotationDescription()}`, "info");
  }

  /**
   * Sets specific rotation angle for capture
   *
   * @param {number} angle - Rotation angle (0, 90, 180, or 270)
   * @throws {Error} If angle is not valid
   *
   * @description
   * Sets the rotation angle to a specific value. Validates that angle
   * is one of the supported values (0, 90, 180, 270 degrees).
   *
   * @example
   * cameraCapture.setRotation(90); // Portrait right
   *
   * @since Phase 1D
   */
  setRotation(angle) {
    if (![0, 90, 180, 270].includes(angle)) {
      throw new Error(
        `Invalid rotation angle: ${angle}. Must be 0, 90, 180, or 270.`
      );
    }

    this.rotationAngle = angle;

    logInfo("Capture rotation set", {
      angle: this.rotationAngle,
      description: this.getRotationDescription(),
    });
  }

  /**
   * Gets human-readable description of current rotation
   *
   * @returns {string} Rotation description
   * @private
   *
   * @since Phase 1D
   */
  getRotationDescription() {
    switch (this.rotationAngle) {
      case 0:
        return "Normal (0°)";
      case 90:
        return "Rotated right (90°)";
      case 180:
        return "Upside down (180°)";
      case 270:
        return "Rotated left (270°)";
      default:
        return `${this.rotationAngle}°`;
    }
  }

  /**
   * Resets rotation to normal orientation
   *
   * @returns {void}
   *
   * @description
   * Resets rotation angle to 0° (normal orientation).
   *
   * @example
   * cameraCapture.resetRotation();
   *
   * @since Phase 1D
   */
  resetRotation() {
    this.rotationAngle = 0;
    logInfo("Capture rotation reset to normal");
    this.showNotification("Rotation reset to normal", "info");
  }

  /**
   * Toggles the preview mirroring state
   *
   * @returns {void}
   *
   * @description
   * Toggles between mirrored and normal preview. This is purely cosmetic
   * and does not affect the captured image orientation. Useful for users
   * who prefer non-mirrored preview display.
   *
   * @example
   * cameraCapture.toggleMirror();
   *
   * @since Phase 1F
   */
  toggleMirror() {
    this.isPreviewMirrored = !this.isPreviewMirrored;

    logInfo("Preview mirror toggled", {
      mirrored: this.isPreviewMirrored,
    });

    // Apply the new mirror state to the preview
    this.applyMirrorState();

    const state = this.isPreviewMirrored ? "mirrored" : "normal";
    this.showNotification(`Preview ${state}`, "info");
  }

  /**
   * Applies the current mirror state to the video preview
   *
   * @returns {void}
   * @private
   *
   * @description
   * Applies CSS transform to mirror wrapper element based on current state.
   * Uses the mirror-wrapper element to ensure transforms don't conflict
   * with browser rendering optimizations.
   *
   * @since Phase 1F
   */
  applyMirrorState() {
    // Find the mirror wrapper element (parent of video element)
    const mirrorWrapper = this.videoElement?.parentElement;

    if (!mirrorWrapper) {
      logWarn("Mirror wrapper element not found");
      return;
    }

    // Apply transform based on mirror state
    if (this.isPreviewMirrored) {
      mirrorWrapper.style.transform = "scaleX(-1)";
      logDebug("Applied mirror transform to preview");
    } else {
      mirrorWrapper.style.transform = "scaleX(1)";
      logDebug("Removed mirror transform from preview");
    }
  }

  /**
   * Validates camera capture configuration
   *
   * @returns {boolean} True if properly configured
   *
   * @description
   * Extends base validation to check camera-specific requirements.
   *
   * @since Phase 1D
   */
  validate() {
    return (
      super.validate() &&
      !!(
        this.videoElement &&
        this.captureCanvas &&
        this.captureContext &&
        this.isInitialised
      )
    );
  }

  /**
   * Cleans up camera capture resources
   *
   * @returns {void}
   *
   * @description
   * Stops camera, removes event listeners, and resets state.
   *
   * @since Phase 1D
   */
  cleanup() {
    // Stop camera if active
    this.stopCamera();

    // Clear references
    this.videoElement = null;
    this.captureCanvas = null;
    this.captureContext = null;
    this.mediaStream = null;

    super.cleanup();
  }

  /**
   * Gets camera capture debug information
   *
   * @returns {Object} Debug information including camera state
   *
   * @since Phase 1D
   */
  getDebugInfo() {
    return {
      ...super.getDebugInfo(),
      isCameraActive: this.isCameraActive,
      hasVideoElement: !!this.videoElement,
      hasCaptureCanvas: !!this.captureCanvas,
      hasMediaStream: !!this.mediaStream,
      videoReady:
        this.videoElement &&
        this.videoElement.videoWidth > 0 &&
        this.videoElement.videoHeight > 0,
      facingMode: this.cameraConstraints.video.facingMode,
      rotationAngle: this.rotationAngle,
      rotationDescription: this.getRotationDescription(),
    };
  }
}

export default MathPixCameraCapture;
