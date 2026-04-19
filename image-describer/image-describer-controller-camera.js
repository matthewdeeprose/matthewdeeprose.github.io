/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER CONTROLLER — CAMERA CAPTURE SUB-MODULE
 * ═══════════════════════════════════════════════════════════════
 *
 * Camera capture, photo orientation adjustment, and related UI
 * for the Image Describer controller.
 *
 * Mixed into window.ImageDescriberController via Object.assign.
 * Must load AFTER image-describer-controller.js (core).
 *
 * VERSION: 1.0.0
 * DATE: 31 March 2026
 * PHASE: Refactor — controller extraction
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[IDC-Camera] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[IDC-Camera] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[IDC-Camera] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[IDC-Camera] ${message}`, ...args);
  }

  // ============================================================================
  // CAMERA CAPTURE METHODS
  // ============================================================================

  const methods = {

    // ========================================================================
    // CAMERA CAPTURE (Phase 2E.2)
    // ========================================================================

    /**
     * Initialise camera capture system
     * Called lazily when camera <details> is first opened
     */
    async initCamera() {
      logInfo("Initialising camera capture");

      // Check if UniversalCameraCapture is available
      if (typeof window.UniversalCameraCapture === "undefined") {
        logError("UniversalCameraCapture not loaded");
        this.showCameraUnavailable();
        return;
      }

      // Check for video element
      if (!this.elements.cameraVideo) {
        logError("Camera video element not found");
        this.showCameraUnavailable();
        return;
      }

      try {
        this.cameraInstance = new window.UniversalCameraCapture({
          videoElement: this.elements.cameraVideo,
          fileNamePrefix: "imgdesc-camera",
          jpegQuality: 0.92,
          onCapture: (file) => {
            this.showCapturedPreview(file);
          },
          onStatusChange: (message) => {
            if (this.elements.cameraStatusText) {
              this.elements.cameraStatusText.textContent = message;
            }
          },
          onNotification: (message, type) => {
            if (type === "error") {
              if (window.notifyError) window.notifyError(message);
              logError("Camera notification:", message);
            } else {
              if (window.notifyInfo) window.notifyInfo(message);
              logInfo("Camera notification:", message);
            }
          },
          controls: {
            captureBtn: this.elements.cameraCaptureBtn,
            switchBtn: this.elements.cameraSwitchBtn,
            mirrorBtn: this.elements.cameraMirrorBtn,
            startBtn: this.elements.cameraStartBtn,
            startBtnText: this.elements.cameraStartText,
            statusElement: this.elements.cameraStatus,
          },
          labels: {
            startCamera: "Start Camera",
            stopCamera: "Stop Camera",
            cameraReady: "Camera active — ready to capture",
            cameraInactive: "Camera inactive",
            startAriaLabel: "Start camera to capture image",
            stopAriaLabel: "Stop camera",
          },
        });

        const ready = await this.cameraInstance.initialise();

        if (!ready) {
          logWarn("Camera initialisation failed — not supported");
          this.showCameraUnavailable();
          return;
        }

        this.cameraInitialised = true;
        logInfo("Camera capture initialised successfully");
      } catch (error) {
        logError("Camera initialisation error:", error);
        this.showCameraUnavailable();
      }
    },

    /**
     * Show "camera unavailable" message and hide controls
     */
    showCameraUnavailable() {
      if (this.elements.cameraControls) {
        this.elements.cameraControls.hidden = true;
      }
      if (this.elements.cameraInfo) {
        this.elements.cameraInfo.hidden = true;
      }
      if (this.elements.cameraUnavailable) {
        this.elements.cameraUnavailable.hidden = false;
      }
      // Hide video
      if (this.elements.cameraVideo) {
        this.elements.cameraVideo.hidden = true;
      }
    },

    /**
     * Toggle camera start/stop
     */
    async toggleCamera() {
      if (!this.cameraInstance) {
        logWarn("Camera not initialised");
        return;
      }

      // If we have a captured preview showing, clean it up first
      if (this.capturedPhotoFile) {
        this.discardCapturedPhoto();
      }

      await this.cameraInstance.toggleCamera();

      // Manage video tabindex based on camera state
      if (this.elements.cameraVideo) {
        this.elements.cameraVideo.tabIndex = this.cameraInstance.isCameraActive
          ? 0
          : -1;
      }
    },

    /**
     * Capture photo from camera
     */
    async capturePhoto() {
      if (!this.cameraInstance) {
        logWarn("Camera not initialised");
        return;
      }

      try {
        await this.cameraInstance.capturePhoto();
        // onCapture callback handles the rest (showCapturedPreview)
      } catch (error) {
        logError("Photo capture failed:", error);
        if (window.notifyError) {
          window.notifyError("Failed to capture photo. Please try again.");
        }
      }
    },

    /**
     * Toggle camera mirror
     */
    toggleCameraMirror() {
      if (!this.cameraInstance) return;
      this.cameraInstance.toggleMirror();
    },

    /**
     * Switch front/rear camera
     */
    async switchCamera() {
      if (!this.cameraInstance) return;
      await this.cameraInstance.switchCamera();
    },

    /**
     * Show captured photo in camera preview area for orientation adjustment
     * @param {File} file - Captured photo File from UniversalCameraCapture
     */
    showCapturedPreview(file) {
      logInfo("Showing captured photo preview for adjustment");

      // Store the raw captured file
      this.capturedPhotoFile = file;
      this.postCaptureRotation = 0;
      this.postCaptureFlipped = false;

      // Create object URL for preview
      if (this.capturedPhotoUrl) {
        URL.revokeObjectURL(this.capturedPhotoUrl);
      }
      this.capturedPhotoUrl = URL.createObjectURL(file);

      // Hide video, show captured image
      if (this.elements.cameraVideo) {
        this.elements.cameraVideo.hidden = true;
      }
      if (this.elements.cameraCaptured) {
        this.elements.cameraCaptured.src = this.capturedPhotoUrl;
        this.elements.cameraCaptured.hidden = false;
        this.elements.cameraCaptured.style.transform = "";
      }

      // Hide camera controls, show adjust controls
      if (this.elements.cameraControls) {
        this.elements.cameraControls.hidden = true;
      }
      if (this.elements.cameraAdjust) {
        this.elements.cameraAdjust.hidden = false;
      }

      // Announce to screen reader
      this.announceCameraStatus(
        "Photo captured. Adjust orientation if needed, then confirm.",
      );

      // Move focus to confirm button
      if (this.elements.cameraConfirmBtn) {
        this.elements.cameraConfirmBtn.focus();
      }

      logDebug("Captured preview shown", {
        fileName: file.name,
        size: file.size,
      });
    },

    /**
     * Rotate captured photo 90° clockwise (CSS preview)
     */
    rotateCapturedPhoto() {
      this.postCaptureRotation = (this.postCaptureRotation + 90) % 360;
      this.applyCapturedPreviewTransform();

      const description =
        this.postCaptureRotation === 0
          ? "Image returned to original orientation"
          : `Image rotated to ${this.postCaptureRotation} degrees`;
      const flipNote = this.postCaptureFlipped ? ", flipped horizontally" : "";

      this.announceCameraStatus(description + flipNote);
      logDebug("Post-capture rotation:", this.postCaptureRotation);
    },

    /**
     * Flip captured photo horizontally (CSS preview)
     */
    flipCapturedPhoto() {
      this.postCaptureFlipped = !this.postCaptureFlipped;
      this.applyCapturedPreviewTransform();

      const flipState = this.postCaptureFlipped
        ? "Image flipped horizontally"
        : "Image flip removed";
      const rotationNote =
        this.postCaptureRotation !== 0
          ? `, rotated ${this.postCaptureRotation} degrees`
          : "";

      this.announceCameraStatus(flipState + rotationNote);
      logDebug("Post-capture flip:", this.postCaptureFlipped);
    },

    /**
     * Apply CSS transforms to captured photo preview
     * Provides instant visual feedback without modifying pixel data
     */
    applyCapturedPreviewTransform() {
      if (!this.elements.cameraCaptured) return;

      const transforms = [];
      if (this.postCaptureRotation !== 0) {
        transforms.push(`rotate(${this.postCaptureRotation}deg)`);
      }
      if (this.postCaptureFlipped) {
        transforms.push("scaleX(-1)");
      }

      this.elements.cameraCaptured.style.transform =
        transforms.length > 0 ? transforms.join(" ") : "";
    },

    /**
     * Confirm captured photo — apply transforms to pixel data and send to pipeline
     */
    async confirmCapturedPhoto() {
      if (!this.capturedPhotoFile) {
        logWarn("No captured photo to confirm");
        return;
      }

      logInfo("Confirming captured photo", {
        rotation: this.postCaptureRotation,
        flipped: this.postCaptureFlipped,
      });

      try {
        // Apply canvas transforms to produce the final corrected file
        const finalFile = await this.applyTransformsToFile(
          this.capturedPhotoFile,
          this.postCaptureRotation,
          this.postCaptureFlipped,
        );

        // Clean up camera preview state
        this.discardCapturedPhoto();

        // Collapse camera section
        if (this.elements.cameraSection) {
          this.elements.cameraSection.open = false;
        }

        // Enter standard pipeline with orientation-corrected image
        await this.handleFileSelect(finalFile);

        // Announce and notify
        this.announceCameraStatus("Photo ready for description");
        if (window.notifySuccess) {
          window.notifySuccess("Photo ready for description");
        }

        // Move focus to generate area
        if (this.elements.generateBtn) {
          this.elements.generateBtn.focus();
        }

        logInfo("Captured photo confirmed and sent to pipeline");
      } catch (error) {
        logError("Failed to confirm captured photo:", error);
        if (window.notifyError) {
          window.notifyError("Failed to process photo. Please try again.");
        }
      }
    },

    /**
     * Retake photo — discard captured image and restart camera
     */
    async retakePhoto() {
      logInfo("Retaking photo");

      this.discardCapturedPhoto();

      // Show video, hide captured image
      this.resetCameraUIToLiveMode();

      // Restart camera
      if (this.cameraInstance) {
        await this.cameraInstance.startCamera();

        // Manage video tabindex
        if (this.elements.cameraVideo) {
          this.elements.cameraVideo.tabIndex = this.cameraInstance
            .isCameraActive
            ? 0
            : -1;
        }
      }

      // Announce
      this.announceCameraStatus("Photo discarded, camera restarting");

      // Move focus to capture button
      if (this.elements.cameraCaptureBtn) {
        this.elements.cameraCaptureBtn.focus();
      }
    },

    /**
     * Discard captured photo state and clean up resources
     */
    discardCapturedPhoto() {
      if (this.capturedPhotoUrl) {
        URL.revokeObjectURL(this.capturedPhotoUrl);
        this.capturedPhotoUrl = null;
      }
      this.capturedPhotoFile = null;
      this.postCaptureRotation = 0;
      this.postCaptureFlipped = false;

      // Clear captured image
      if (this.elements.cameraCaptured) {
        this.elements.cameraCaptured.src = "";
        this.elements.cameraCaptured.style.transform = "";
        this.elements.cameraCaptured.hidden = true;
      }
    },

    /**
     * Reset camera UI to live preview mode
     * Shows video + camera controls, hides captured image + adjust controls
     */
    resetCameraUIToLiveMode() {
      if (this.elements.cameraVideo) {
        this.elements.cameraVideo.hidden = false;
      }
      if (this.elements.cameraCaptured) {
        this.elements.cameraCaptured.hidden = true;
      }
      if (this.elements.cameraControls) {
        this.elements.cameraControls.hidden = false;
      }
      if (this.elements.cameraAdjust) {
        this.elements.cameraAdjust.hidden = true;
      }
    },

    /**
     * Announce a message via the camera status aria-live region
     * @param {string} message - Message to announce
     */
    announceCameraStatus(message) {
      if (this.elements.cameraStatusText) {
        this.elements.cameraStatusText.textContent = message;
      }
    },

    /**
     * Apply rotation and flip to a File, returns a new File with transforms baked in
     * Uses canvas to produce pixel-accurate output
     *
     * @param {File} file - Source image file
     * @param {number} rotation - Degrees (0, 90, 180, 270)
     * @param {boolean} flipped - Whether to flip horizontally
     * @returns {Promise<File>} Transformed image file
     */
    async applyTransformsToFile(file, rotation, flipped) {
      // No changes needed — return original
      if (rotation === 0 && !flipped) return file;

      logDebug("Applying transforms to file", { rotation, flipped });

      return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
          const needsSwap = rotation === 90 || rotation === 270;
          const canvas = document.createElement("canvas");
          canvas.width = needsSwap ? img.height : img.width;
          canvas.height = needsSwap ? img.width : img.height;

          const ctx = canvas.getContext("2d");
          ctx.save();

          // Move to centre for transforms
          ctx.translate(canvas.width / 2, canvas.height / 2);

          // Apply rotation
          if (rotation !== 0) {
            ctx.rotate((rotation * Math.PI) / 180);
          }

          // Apply horizontal flip
          if (flipped) {
            ctx.scale(-1, 1);
          }

          // Draw image centred
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          ctx.restore();

          // Convert to blob — use JPEG for photos from camera
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const newFile = new File([blob], file.name, {
                  type: file.type || "image/jpeg",
                });
                // Preserve and extend capture metadata
                if (file.captureMetadata) {
                  newFile.captureMetadata = {
                    ...file.captureMetadata,
                    postProcessRotation: rotation,
                    postProcessFlipped: flipped,
                  };
                }
                // Clean up the object URL created for the Image
                URL.revokeObjectURL(img.src);
                resolve(newFile);
              } else {
                URL.revokeObjectURL(img.src);
                reject(new Error("Failed to create transformed image"));
              }
            },
            file.type || "image/jpeg",
            0.92,
          );
        };

        img.onerror = () => {
          URL.revokeObjectURL(img.src);
          reject(new Error("Failed to load image for transform"));
        };

        img.src = URL.createObjectURL(file);
      });
    },

    /**
     * Clean up camera resources
     * Called on resetForNewImage, clearFile, and tool switch
     */
    cleanupCamera() {
      logDebug("Cleaning up camera resources");

      // Discard any captured photo
      this.discardCapturedPhoto();

      // Reset camera UI to live mode (in case we were in adjust state)
      this.resetCameraUIToLiveMode();

      // Stop and clean up camera instance
      if (this.cameraInstance) {
        this.cameraInstance.cleanup();
      }

      // Reset tabindex on video
      if (this.elements.cameraVideo) {
        this.elements.cameraVideo.tabIndex = -1;
      }

      // Note: we don't null cameraInstance or cameraInitialised
      // so the camera can be restarted without full reinitialisation

      logDebug("Camera cleanup complete");
    },
  };

  // ============================================================================
  // MIX INTO CONTROLLER
  // ============================================================================

  if (window.ImageDescriberController) {
    Object.assign(window.ImageDescriberController, methods);
    logInfo("Camera capture methods loaded");
  } else {
    logError("ImageDescriberController not found — camera methods not loaded");
  }
})();
