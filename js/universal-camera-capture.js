/**
 * @fileoverview Universal Camera Capture - Reusable Webcam/Mobile Camera Photo Capture
 * @module UniversalCameraCapture
 * @version 1.0.0
 *
 * @description
 * Standalone camera capture module with zero framework dependencies.
 * Supports desktop webcams and mobile device cameras with comprehensive
 * error handling, image rotation, mirroring correction, and accessible controls.
 *
 * Designed for reuse across multiple features (MathPix OCR, image description,
 * document scanning, etc.) via a callback-driven configuration pattern.
 *
 * Key Features:
 * - Desktop webcam and mobile camera support (front/rear switching)
 * - Live video preview with photo capture to File object
 * - Image rotation (0°/90°/180°/270°) and front-camera mirror correction
 * - Optional automatic button state management via controls config
 * - Callback-driven architecture — no controller or base class coupling
 * - WCAG 2.2 AA accessibility support
 *
 * @example
 * // Minimal usage
 * const camera = new UniversalCameraCapture({
 *   videoElement: document.getElementById('my-video'),
 *   onNotification: (msg, type) => console.log(`[${type}] ${msg}`)
 * });
 * await camera.initialise();
 * await camera.startCamera();
 * const photo = await camera.capturePhoto();
 *
 * @example
 * // Full usage with button management
 * const camera = new UniversalCameraCapture({
 *   videoElement: document.getElementById('camera-video'),
 *   onCapture: (file) => processImage(file),
 *   onStatusChange: (message) => updateStatusText(message),
 *   onNotification: (message, type) => notifyUser(message, type),
 *   fileNamePrefix: 'scan',
 *   jpegQuality: 0.92,
 *   labels: {
 *     startCamera: 'Start Camera',
 *     stopCamera: 'Stop Camera',
 *     cameraReady: 'Camera active - Ready to capture',
 *     cameraInactive: 'Camera inactive - Click Start Camera',
 *     startAriaLabel: 'Start camera to capture image',
 *     stopAriaLabel: 'Stop camera'
 *   },
 *   controls: {
 *     captureBtn: document.getElementById('capture-btn'),
 *     switchBtn: document.getElementById('switch-btn'),
 *     rotateBtn: document.getElementById('rotate-btn'),
 *     mirrorBtn: document.getElementById('mirror-btn'),
 *     startBtn: document.getElementById('start-btn'),
 *     startBtnText: document.getElementById('start-btn-text'),
 *     statusElement: document.getElementById('camera-status')
 *   }
 * });
 */

(function () {
  "use strict";

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
   * Default labels for camera UI elements
   * @constant {Object}
   * @private
   */
  const DEFAULT_LABELS = {
    startCamera: "Start Camera",
    stopCamera: "Stop Camera",
    cameraReady: "Camera active - Ready to capture",
    cameraInactive: "Camera inactive - Click Start Camera",
    startAriaLabel: "Start camera to capture image",
    stopAriaLabel: "Stop camera",
  };

  /**
   * @class UniversalCameraCapture
   * @description
   * Standalone camera capture system supporting desktop webcams and mobile cameras.
   * Uses a callback-driven configuration pattern with no framework dependencies.
   *
   * All side effects (notifications, status updates, post-capture actions) are
   * routed through configurable callbacks, making this module reusable across
   * any feature that needs camera input.
   *
   * @since 1.0.0
   */
  class UniversalCameraCapture {
    /**
     * Creates a new universal camera capture instance
     *
     * @param {Object} config - Configuration object
     * @param {HTMLVideoElement} config.videoElement - Video element for camera preview
     * @param {Function} [config.onCapture] - Callback when photo is captured, receives File
     * @param {Function} [config.onStatusChange] - Callback for status text updates, receives message string
     * @param {Function} [config.onNotification] - Callback for user notifications, receives (message, type)
     * @param {string} [config.fileNamePrefix='camera-capture'] - Prefix for captured photo filenames
     * @param {number} [config.jpegQuality=0.92] - JPEG compression quality (0-1)
     * @param {Object} [config.labels] - Customisable UI label strings
     * @param {string} [config.labels.startCamera] - Start button text
     * @param {string} [config.labels.stopCamera] - Stop button text
     * @param {string} [config.labels.cameraReady] - Status text when camera is active
     * @param {string} [config.labels.cameraInactive] - Status text when camera is inactive
     * @param {string} [config.labels.startAriaLabel] - ARIA label for start state
     * @param {string} [config.labels.stopAriaLabel] - ARIA label for stop state
     * @param {Object} [config.controls] - Optional DOM element references for automatic button state management
     * @param {HTMLButtonElement} [config.controls.captureBtn] - Capture photo button
     * @param {HTMLButtonElement} [config.controls.switchBtn] - Switch camera button
     * @param {HTMLButtonElement} [config.controls.rotateBtn] - Rotate capture button
     * @param {HTMLButtonElement} [config.controls.mirrorBtn] - Mirror toggle button
     * @param {HTMLButtonElement} [config.controls.startBtn] - Start/stop camera button
     * @param {HTMLElement} [config.controls.startBtnText] - Text element inside start button
     * @param {HTMLElement} [config.controls.statusElement] - Status text display element
     * @throws {Error} When videoElement is not provided in config
     *
     * @since 1.0.0
     */
    constructor(config = {}) {
      if (!config.videoElement) {
        throw new Error(
          "UniversalCameraCapture: videoElement is required in config",
        );
      }

      /**
       * Video element for camera preview
       * @type {HTMLVideoElement}
       */
      this.videoElement = config.videoElement;

      /**
       * Callback invoked when a photo is captured
       * @type {Function|null}
       */
      this.onCapture = config.onCapture || null;

      /**
       * Callback invoked when camera status changes
       * @type {Function|null}
       */
      this.onStatusChange = config.onStatusChange || null;

      /**
       * Callback invoked for user-facing notifications
       * @type {Function|null}
       */
      this.onNotification = config.onNotification || null;

      /**
       * Prefix for generated capture filenames
       * @type {string}
       */
      this.fileNamePrefix = config.fileNamePrefix || "camera-capture";

      /**
       * JPEG compression quality for captured photos
       * @type {number}
       */
      this.jpegQuality = config.jpegQuality || 0.92;

      /**
       * UI label strings (merged with defaults)
       * @type {Object}
       */
      this.labels = { ...DEFAULT_LABELS, ...(config.labels || {}) };

      /**
       * Optional DOM control elements for automatic state management
       * @type {Object|null}
       */
      this.controls = config.controls || null;

      /**
       * Canvas for capturing photo frames (created internally)
       * @type {HTMLCanvasElement|null}
       */
      this.captureCanvas = null;

      /**
       * Canvas 2D rendering context
       * @type {CanvasRenderingContext2D|null}
       */
      this.captureContext = null;

      /**
       * Active media stream from camera
       * @type {MediaStream|null}
       */
      this.mediaStream = null;

      /**
       * Whether the camera is currently streaming
       * @type {boolean}
       */
      this.isCameraActive = false;

      /**
       * Whether the module has been successfully initialised
       * @type {boolean}
       */
      this.isInitialised = false;

      /**
       * Preferred camera constraints for getUserMedia
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
       * Current rotation angle for captured images (0, 90, 180, 270)
       * @type {number}
       */
      this.rotationAngle = 0;

      /**
       * Whether the preview is currently mirrored
       * @type {boolean}
       */
      this.isPreviewMirrored = true;

      /**
       * Reference to the most recently captured photo
       * @type {File|null}
       */
      this.lastCapturedImage = null;

      logDebug("UniversalCameraCapture instance created");
    }

    // ===========================================================================
    // LIFECYCLE METHODS
    // ===========================================================================

    /**
     * Initialises the camera capture system
     *
     * @returns {Promise<boolean>} True if initialisation successful
     *
     * @description
     * Creates the internal capture canvas and checks for browser camera API
     * support. Must be called before startCamera().
     *
     * @example
     * const ready = await camera.initialise();
     * if (ready) {
     *   await camera.startCamera();
     * }
     *
     * @since 1.0.0
     */
    async initialise() {
      logInfo("Initialising universal camera capture system...");

      // Create hidden canvas for photo capture
      this.captureCanvas = document.createElement("canvas");
      this.captureContext = this.captureCanvas.getContext("2d");

      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        logError("Camera API not supported in this browser");
        this.notify(
          "Camera not supported in this browser. Please use file upload instead.",
          "error",
        );
        return false;
      }

      this.isInitialised = true;
      logInfo("Universal camera capture system initialised successfully");

      return true;
    }

    /**
     * Cleans up all camera resources
     *
     * @returns {void}
     *
     * @description
     * Stops the camera, releases media tracks, and clears all references.
     * Should be called when the camera feature is no longer needed.
     *
     * @example
     * camera.cleanup();
     *
     * @since 1.0.0
     */
    cleanup() {
      this.stopCamera();

      this.captureCanvas = null;
      this.captureContext = null;
      this.mediaStream = null;
      this.lastCapturedImage = null;

      logDebug("UniversalCameraCapture cleanup completed");
    }

    // ===========================================================================
    // CAMERA START / STOP
    // ===========================================================================

    /**
     * Starts the camera and displays live preview
     *
     * @returns {Promise<boolean>} True if camera started successfully
     *
     * @description
     * Requests camera permission and starts the video stream. Handles
     * permission denials and hardware errors with descriptive messages
     * routed through the onNotification callback.
     *
     * @example
     * const started = await camera.startCamera();
     * if (started) {
     *   console.log('Camera preview active');
     * }
     *
     * @accessibility Announces camera state via onStatusChange callback
     * @since 1.0.0
     */
    async startCamera() {
      logInfo("Starting camera...");

      if (this.isCameraActive) {
        logWarn("Camera already active");
        return true;
      }

      if (!this.isInitialised) {
        logError("Camera system not initialised");
        this.notify("Camera system not ready", "error");
        return false;
      }

      try {
        // Request camera access
        this.mediaStream = await navigator.mediaDevices.getUserMedia(
          this.cameraConstraints,
        );

        // Attach stream to video element
        this.videoElement.srcObject = this.mediaStream;
        this.videoElement.play();

        this.isCameraActive = true;

        // Enable controls if provided
        this.enableCaptureControls();

        logInfo("Camera started successfully", {
          tracks: this.mediaStream.getVideoTracks().length,
          settings: this.mediaStream.getVideoTracks()[0]?.getSettings(),
        });

        this.notify("Camera ready. Position content in view.", "success");

        return true;
      } catch (error) {
        logError("Failed to start camera", {
          error: error.message,
          name: error.name,
        });

        // Provide helpful error messages based on error type
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

        this.notify(errorMessage, "error");

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
     * camera.stopCamera();
     *
     * @since 1.0.0
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

        // Clear video element source
        if (this.videoElement) {
          this.videoElement.srcObject = null;
        }

        this.mediaStream = null;
      }

      this.isCameraActive = false;

      // Disable controls if provided
      this.disableCaptureControls();

      logInfo("Camera stopped successfully");
    }

    /**
     * Toggles camera between started and stopped states
     *
     * @returns {Promise<boolean>} True if camera is now active
     *
     * @description
     * Convenience method for start/stop toggle buttons. Checks current state
     * and calls the appropriate method.
     *
     * @example
     * // Wire to a single toggle button
     * toggleBtn.onclick = () => camera.toggleCamera();
     *
     * @since 1.0.0
     */
    async toggleCamera() {
      if (this.isCameraActive) {
        this.stopCamera();
        return false;
      } else {
        return this.startCamera();
      }
    }

    // ===========================================================================
    // PHOTO CAPTURE
    // ===========================================================================

    /**
     * Captures a photo from the current video frame
     *
     * @returns {Promise<File>} Captured photo as a File object
     * @throws {Error} If camera not active or capture fails
     *
     * @description
     * Captures the current video frame to an internal canvas, applying
     * rotation and front-camera mirror correction as needed, then converts
     * to a JPEG File object.
     *
     * **Image orientation handling:**
     * 1. Detects if using front camera (user/selfie mode)
     * 2. Flips the captured image horizontally if front camera (corrects mirror)
     * 3. Applies any rotation transformation set by user
     * 4. Ensures content is readable (not backwards or rotated incorrectly)
     *
     * The returned File includes a `captureMetadata` property with orientation
     * details for downstream processing.
     *
     * @example
     * const photoFile = await camera.capturePhoto();
     * console.log(photoFile.name); // 'camera-capture-2026-02-26T10-30-00-000Z.jpg'
     * console.log(photoFile.captureMetadata.source); // 'camera'
     *
     * @since 1.0.0
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
        throw new Error(
          "Video not ready. Please wait for camera to initialise.",
        );
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

        // CRITICAL: Mirror capture to match what user saw in preview
        // Uses isPreviewMirrored (the actual CSS state) rather than
        // facingMode, because: (a) desktop browsers may not report
        // facingMode accurately, (b) the user can toggle mirroring
        // manually, and (c) the preview defaults to mirrored regardless
        // of camera. This ensures captured image === preview image.
        const shouldMirrorCapture = this.isPreviewMirrored;

        // Save canvas state
        this.captureContext.save();

        // Apply transformations in correct order:
        // 1. Move to rotation centre point
        // 2. Apply rotation
        // 3. Apply mirroring if preview was mirrored
        // 4. Move back to drawing position

        if (this.rotationAngle !== 0 || shouldMirrorCapture) {
          // Move to centre for rotation
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

          // Apply mirroring to match preview
          if (shouldMirrorCapture) {
            this.captureContext.scale(-1, 1);
            logDebug("Applied mirroring to match preview");
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
          this.videoElement.videoHeight,
        );

        // Restore canvas state (resets all transformations)
        this.captureContext.restore();

        // Convert canvas to blob (JPEG format)
        const blob = await new Promise((resolve, reject) => {
          this.captureCanvas.toBlob(
            (b) => {
              if (b) {
                resolve(b);
              } else {
                reject(new Error("Failed to create image blob"));
              }
            },
            "image/jpeg",
            this.jpegQuality,
          );
        });

        // Create File object with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `${this.fileNamePrefix}-${timestamp}.jpg`;
        const file = new File([blob], fileName, { type: "image/jpeg" });

        // Attach capture metadata for downstream consumers
        file.captureMetadata = {
          wasMirrored: this.isPreviewMirrored,
          originalFormat: "image/jpeg",
          source: "camera",
          capturedAt: new Date().toISOString(),
        };

        // Store captured image reference
        this.lastCapturedImage = file;

        // Enable rotate button now that we have a captured image
        if (this.controls?.rotateBtn) {
          this.controls.rotateBtn.disabled = false;
          logDebug("Rotate button enabled after capture");
        }

        logInfo("Photo captured successfully", {
          fileName,
          size: file.size,
          dimensions: `${this.captureCanvas.width}x${this.captureCanvas.height}`,
          wasMirrored: shouldMirrorCapture,
          rotation: this.rotationAngle,
          orientation: shouldMirrorCapture
            ? `mirrored to match preview${
                this.rotationAngle ? `, rotated ${this.rotationAngle}°` : ""
              }`
            : this.rotationAngle
              ? `rotated ${this.rotationAngle}°`
              : "original",
        });

        // Invoke capture callback if provided
        if (this.onCapture) {
          this.onCapture(file);
        }

        return file;
      } catch (error) {
        logError("Failed to capture photo", { error: error.message });
        throw new Error(`Photo capture failed: ${error.message}`);
      }
    }

    // ===========================================================================
    // CAMERA SWITCHING (FRONT / REAR)
    // ===========================================================================

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
     * await camera.switchCamera();
     *
     * @since 1.0.0
     */
    async switchCamera() {
      logInfo("Attempting to switch camera...");

      if (!this.isCameraActive) {
        logWarn("Camera not active, cannot switch");
        return false;
      }

      // Toggle facing mode
      const currentFacing = this.cameraConstraints.video.facingMode;
      const newFacing =
        currentFacing === "environment" ? "user" : "environment";

      logDebug("Switching camera", { from: currentFacing, to: newFacing });

      // Stop current camera
      this.stopCamera();

      // Update constraints
      this.cameraConstraints.video.facingMode = newFacing;

      // Start with new camera
      const success = await this.startCamera();

      if (success) {
        const cameraType = newFacing === "environment" ? "rear" : "front";
        this.notify(`Switched to ${cameraType} camera`, "success");
      }

      return success;
    }

    // ===========================================================================
    // ROTATION
    // ===========================================================================

    /**
     * Rotates the capture orientation by 90 degrees clockwise
     *
     * @returns {void}
     *
     * @description
     * Cycles through rotation angles: 0° → 90° → 180° → 270° → 0°
     * Useful for correcting orientation when device is held at an angle.
     *
     * @example
     * camera.rotateCapture(); // Rotates 90° clockwise
     *
     * @since 1.0.0
     */
    rotateCapture() {
      this.rotationAngle = (this.rotationAngle + 90) % 360;

      logInfo("Capture rotation updated", {
        angle: this.rotationAngle,
        description: this.getRotationDescription(),
      });

      this.notify(`Rotation: ${this.getRotationDescription()}`, "info");
    }

    /**
     * Sets a specific rotation angle for capture
     *
     * @param {number} angle - Rotation angle (0, 90, 180, or 270)
     * @throws {Error} If angle is not a valid value
     *
     * @example
     * camera.setRotation(90); // Portrait right
     *
     * @since 1.0.0
     */
    setRotation(angle) {
      if (![0, 90, 180, 270].includes(angle)) {
        throw new Error(
          `Invalid rotation angle: ${angle}. Must be 0, 90, 180, or 270.`,
        );
      }

      this.rotationAngle = angle;

      logInfo("Capture rotation set", {
        angle: this.rotationAngle,
        description: this.getRotationDescription(),
      });
    }

    /**
     * Resets rotation to normal orientation (0°)
     *
     * @returns {void}
     *
     * @example
     * camera.resetRotation();
     *
     * @since 1.0.0
     */
    resetRotation() {
      this.rotationAngle = 0;
      logInfo("Capture rotation reset to normal");
      this.notify("Rotation reset to normal", "info");
    }

    /**
     * Gets human-readable description of current rotation
     *
     * @returns {string} Rotation description
     *
     * @since 1.0.0
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

    // ===========================================================================
    // MIRROR TOGGLE
    // ===========================================================================

    /**
     * Toggles the preview mirroring state
     *
     * @returns {void}
     *
     * @description
     * Toggles between mirrored and normal preview display. This is purely
     * cosmetic for the live preview and does not affect the captured image
     * orientation (front-camera correction is always applied on capture).
     *
     * @example
     * camera.toggleMirror();
     *
     * @since 1.0.0
     */
    toggleMirror() {
      this.isPreviewMirrored = !this.isPreviewMirrored;

      logInfo("Preview mirror toggled", { mirrored: this.isPreviewMirrored });

      this.applyMirrorState();

      const state = this.isPreviewMirrored ? "mirrored" : "normal";
      this.notify(`Preview ${state}`, "info");
    }

    /**
     * Applies the current mirror state to the video preview
     *
     * @returns {void}
     * @private
     *
     * @description
     * Applies CSS transform to the mirror wrapper element (parent of video)
     * based on current mirror state.
     *
     * @since 1.0.0
     */
    applyMirrorState() {
      // Find the mirror wrapper element (parent of video element)
      const mirrorWrapper = this.videoElement?.parentElement;

      if (!mirrorWrapper) {
        logWarn("Mirror wrapper element not found");
        return;
      }

      if (this.isPreviewMirrored) {
        mirrorWrapper.style.transform = "scaleX(-1)";
        logDebug("Applied mirror transform to preview");
      } else {
        mirrorWrapper.style.transform = "scaleX(1)";
        logDebug("Removed mirror transform from preview");
      }
    }

    // ===========================================================================
    // CONTROL STATE MANAGEMENT (OPTIONAL)
    // ===========================================================================

    /**
     * Enables capture-related controls when camera becomes active
     *
     * @returns {void}
     * @private
     *
     * @description
     * Called automatically when camera starts. If controls were provided in
     * config, enables capture/switch/mirror buttons, disables rotate (until
     * a photo is captured), and updates start button text/ARIA label.
     * Also updates status text.
     *
     * If no controls were provided, only the onStatusChange callback is invoked.
     *
     * @since 1.0.0
     */
    enableCaptureControls() {
      if (this.controls) {
        const {
          captureBtn,
          switchBtn,
          rotateBtn,
          mirrorBtn,
          startBtn,
          startBtnText,
        } = this.controls;

        if (captureBtn) captureBtn.disabled = false;
        if (switchBtn) switchBtn.disabled = false;
        // Rotate disabled until photo captured
        if (rotateBtn) rotateBtn.disabled = true;
        if (mirrorBtn) mirrorBtn.disabled = false;
        // Update start button to show "Stop Camera"
        if (startBtnText) startBtnText.textContent = this.labels.stopCamera;
        if (startBtn) {
          startBtn.setAttribute("aria-label", this.labels.stopAriaLabel);
        }

        logDebug("Camera capture controls enabled");
      }

      this.updateStatus(this.labels.cameraReady);
    }

    /**
     * Disables capture-related controls when camera becomes inactive
     *
     * @returns {void}
     * @private
     *
     * @description
     * Called automatically when camera stops. If controls were provided in
     * config, disables capture/switch/rotate/mirror buttons and resets
     * start button text/ARIA label. Also resets internal state.
     *
     * @since 1.0.0
     */
    disableCaptureControls() {
      if (this.controls) {
        const {
          captureBtn,
          switchBtn,
          rotateBtn,
          mirrorBtn,
          startBtn,
          startBtnText,
        } = this.controls;

        if (captureBtn) captureBtn.disabled = true;
        if (switchBtn) switchBtn.disabled = true;
        if (rotateBtn) rotateBtn.disabled = true;
        if (mirrorBtn) mirrorBtn.disabled = true;
        // Reset start button to show "Start Camera"
        if (startBtnText) startBtnText.textContent = this.labels.startCamera;
        if (startBtn) {
          startBtn.setAttribute("aria-label", this.labels.startAriaLabel);
        }

        logDebug("Camera capture controls disabled");
      }

      // Reset state when camera stops
      this.lastCapturedImage = null;
      this.isPreviewMirrored = true;

      this.updateStatus(this.labels.cameraInactive);
    }

    // ===========================================================================
    // INTERNAL HELPERS
    // ===========================================================================

    /**
     * Routes a notification to the configured callback
     *
     * @param {string} message - Notification message
     * @param {string} [type='info'] - Notification type: 'info', 'success', 'error', 'warning'
     * @returns {void}
     * @private
     *
     * @since 1.0.0
     */
    notify(message, type = "info") {
      if (this.onNotification) {
        this.onNotification(message, type);
      } else {
        logInfo(`[${type.toUpperCase()}] ${message}`);
      }
    }

    /**
     * Updates camera status text via callback and optional controls element
     *
     * @param {string} message - Status message
     * @returns {void}
     * @private
     *
     * @since 1.0.0
     */
    updateStatus(message) {
      // Update the status DOM element if provided in controls
      if (this.controls?.statusElement) {
        this.controls.statusElement.textContent = message;
      }

      // Also invoke the callback
      if (this.onStatusChange) {
        this.onStatusChange(message);
      }

      logDebug("Camera status updated", { message });
    }

    // ===========================================================================
    // VALIDATION & DEBUG
    // ===========================================================================

    /**
     * Validates that the camera system is properly configured
     *
     * @returns {boolean} True if properly configured and ready for use
     *
     * @since 1.0.0
     */
    validate() {
      return !!(
        this.videoElement &&
        this.captureCanvas &&
        this.captureContext &&
        this.isInitialised
      );
    }

    /**
     * Gets camera capture debug information
     *
     * @returns {Object} Debug information including camera state and configuration
     *
     * @example
     * console.log(camera.getDebugInfo());
     *
     * @since 1.0.0
     */
    getDebugInfo() {
      return {
        name: "UniversalCameraCapture",
        isInitialised: this.isInitialised,
        isCameraActive: this.isCameraActive,
        hasVideoElement: !!this.videoElement,
        hasCaptureCanvas: !!this.captureCanvas,
        hasMediaStream: !!this.mediaStream,
        hasControls: !!this.controls,
        hasCallbacks: {
          onCapture: !!this.onCapture,
          onStatusChange: !!this.onStatusChange,
          onNotification: !!this.onNotification,
        },
        videoReady:
          this.videoElement &&
          this.videoElement.videoWidth > 0 &&
          this.videoElement.videoHeight > 0,
        facingMode: this.cameraConstraints.video.facingMode,
        rotationAngle: this.rotationAngle,
        rotationDescription: this.getRotationDescription(),
        isPreviewMirrored: this.isPreviewMirrored,
        fileNamePrefix: this.fileNamePrefix,
        jpegQuality: this.jpegQuality,
      };
    }
  }

  // Global exposure for script-tag usage
  window.UniversalCameraCapture = UniversalCameraCapture;
})();
