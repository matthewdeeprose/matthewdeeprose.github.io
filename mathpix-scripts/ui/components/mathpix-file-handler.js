/**
 * @fileoverview MathPix File Handler - Comprehensive file upload, validation, and preview management
 * @module MathPixFileHandler
 * @requires MathPixBaseModule
 * @requires MATHPIX_CONFIG
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Handles all file-related operations for the MathPix mathematics OCR system including upload
 * processing, file validation, responsive image previews, and user confirmation workflows.
 *
 * Key Features:
 * - Multi-format file validation (JPEG, PNG, WebP, PDF)
 * - Responsive image preview with aspect ratio preservation
 * - User confirmation workflow for processing control
 * - Blob URL management and cleanup
 * - Integration with MathPix API credential validation
 * - Comprehensive error handling with user-friendly messaging
 *
 * Integration:
 * - Extends MathPixBaseModule for shared functionality and logging
 * - Coordinates with MathPixController for API access and processing
 * - Uses MATHPIX_CONFIG for file limits and supported formats
 * - Integrates with notification system for user feedback
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant file upload interface
 * - Keyboard navigation support for all interactive elements
 * - Screen reader compatible with proper ARIA labels
 * - Focus management for modal and preview interactions
 */

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * @function shouldLog
 * @description Determines if logging should occur based on configuration
 * @param {number} level - Log level to check
 * @returns {boolean} True if logging should proceed
 * @private
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * @function logError
 * @description Logs error-level messages when appropriate
 * @param {string} message - Primary error message
 * @param {...*} args - Additional arguments for detailed error context
 * @private
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

/**
 * @function logWarn
 * @description Logs warning-level messages when appropriate
 * @param {string} message - Primary warning message
 * @param {...*} args - Additional arguments for warning context
 * @private
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

/**
 * @function logInfo
 * @description Logs informational messages when appropriate
 * @param {string} message - Primary information message
 * @param {...*} args - Additional arguments for information context
 * @private
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

/**
 * @function logDebug
 * @description Logs debug-level messages when appropriate
 * @param {string} message - Primary debug message
 * @param {...*} args - Additional arguments for debug context
 * @private
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

import MathPixBaseModule from "../../core/mathpix-base-module.js";
import MATHPIX_CONFIG from "../../core/mathpix-config.js";
import MathPixImageTransformer from "../../core/mathpix-image-transformer.js";

/**
 * @class MathPixFileHandler
 * @extends MathPixBaseModule
 * @description Manages all file-related operations for MathPix mathematics OCR processing
 *
 * This class handles the complete file lifecycle from initial upload through preview
 * generation to processing confirmation. It provides comprehensive file validation,
 * responsive preview capabilities, and user confirmation workflows whilst maintaining
 * WCAG 2.2 AA accessibility compliance throughout.
 *
 * @example
 * const fileHandler = new MathPixFileHandler(mathPixController);
 * const success = await fileHandler.handleUpload(selectedFile);
 * if (success) {
 *   console.log('File ready for processing');
 * }
 *
 * @see {@link MathPixBaseModule} for inherited functionality
 * @see {@link MathPixController} for integration patterns
 * @since 1.0.0
 */
class MathPixFileHandler extends MathPixBaseModule {
  /**
   * @constructor
   * @description Initialises the MathPix File Handler with configuration and state management
   * @param {MathPixController} controller - Parent controller for coordination and API access
   * @throws {Error} If controller is not provided or invalid
   *
   * @example
   * const controller = new MathPixController();
   * const fileHandler = new MathPixFileHandler(controller);
   *
   * @accessibility Ensures all file handling maintains keyboard navigation support
   * @since 1.0.0
   */
  constructor(controller) {
    super(controller);

    /**
     * @member {Array<string>} supportedTypes
     * @description MIME types supported for mathematical content processing
     * @readonly
     */
    this.supportedTypes = MATHPIX_CONFIG.SUPPORTED_TYPES;

    /**
     * @member {number} maxFileSize
     * @description Maximum file size in bytes (typically 10MB)
     * @readonly
     */
    this.maxFileSize = MATHPIX_CONFIG.MAX_FILE_SIZE;

    /**
     * @member {File|null} currentUploadedFile
     * @description Currently selected file awaiting processing
     */
    this.currentUploadedFile = null;

    /**
     * @member {string|null} currentFileBlob
     * @description Blob URL for current file preview (requires cleanup)
     */
    this.currentFileBlob = null;

    /**
     * @member {Object} previewTransforms
     * @description Tracks preview transform state for camera-captured images
     * @property {number} rotation - Current rotation in degrees (0, 90, 180, 270)
     * @property {boolean} flipped - Whether image is horizontally flipped
     * @property {boolean} hasTransforms - Whether any transforms are pending application
     * @property {File|null} transformedFile - Regenerated file after canvas transforms (null until processing)
     */
    this.previewTransforms = {
      rotation: 0,
      flipped: false,
      hasTransforms: false,
      transformedFile: null,
    };

    /**
     * @member {MathPixImageTransformer} imageTransformer
     * @description Image transformer for applying canvas-based transforms
     */
    this.imageTransformer = new MathPixImageTransformer(this.controller);

    this.isInitialised = true;

    logInfo("MathPix File Handler initialised", {
      supportedTypes: this.supportedTypes,
      maxFileSize: this.maxFileSize,
    });
  }

  /**
   * @method handleUpload
   * @description Processes file upload with comprehensive validation and preview generation
   *
   * Manages the complete file upload workflow including validation, preview generation,
   * API credential verification, and user confirmation workflow preparation. Supports
   * both immediate processing and confirmation-based workflows.
   *
   * @param {File} file - The file selected by the user for processing
   * @returns {Promise<boolean>} True if file is ready for processing, false if validation failed
   * @throws {Error} If file processing encounters unexpected errors
   *
   * @example
   * const fileInput = document.getElementById('file-input');
   * const file = fileInput.files[0];
   * const success = await fileHandler.handleUpload(file);
   * if (success) {
   *   // File is validated and preview displayed
   *   // User can now confirm processing
   * }
   *
   * @accessibility Announces upload status to screen readers via notification system
   * @since 1.0.0
   */
  async handleUpload(file) {
    logInfo("File upload started", { fileName: file.name, size: file.size });

    try {
      // Validate file against supported types and size limits
      const validation = this.validateFile(file);
      if (!validation.valid) {
        this.showNotification(validation.message, "error");
        return false;
      }

      // Store current file for preview and processing
      this.currentUploadedFile = file;

      // Reset transform state for new file
      this.resetTransformState();

      // UNIFIED DROP ZONE: Hide PDF interface when switching to image processing
      this.hidePDFInterfaceForImageUpload();

      // Generate responsive image preview for visual files
      if (file.type.startsWith("image/")) {
        this.displayResponsiveImagePreview(file);

        // Show transform controls for camera-captured images
        this.updateTransformControlsVisibility();

        // Apply initial mirror state if from camera
        this.applyInitialMirrorState();
      }

      // Verify API credentials are configured before offering processing
      if (
        !this.controller.apiClient ||
        !this.controller.apiClient.appId ||
        !this.controller.apiClient.apiKey
      ) {
        this.showNotification(
          "Please configure your MathPix API credentials first.",
          "error",
        );
        return false;
      }

      // Use confirmation workflow for user control over processing
      if (MATHPIX_CONFIG.PHASE_4?.REQUIRE_FILE_CONFIRMATION !== false) {
        logInfo("File uploaded successfully - waiting for user confirmation", {
          fileName: file.name,
          fileSize: file.size,
          confirmationRequired: true,
        });

        this.showNotification(
          `File "${file.name}" ready for processing. Click "Process with MathPix" to continue.`,
          "info",
        );

        // Processing continues when user clicks confirmation button
        return true;
      }

      // Legacy immediate processing mode (when confirmation disabled)
      logWarn("Immediate processing mode - confirmation workflow disabled");
      return await this.controller.processConfirmedFile(file);
    } catch (error) {
      logError("File upload failed", error);
      this.showNotification(`Upload failed: ${error.message}`, "error");
      return false;
    }
  }

  /**
   * @method validateFile
   * @description Validates uploaded file against system requirements and constraints
   *
   * Performs comprehensive validation including file presence, MIME type verification,
   * and size limit enforcement. Returns detailed validation results for user feedback.
   *
   * @param {File} file - File object to validate
   * @returns {Object} Validation result object
   * @returns {boolean} returns.valid - Whether file passed all validation checks
   * @returns {string} returns.message - Detailed message for failed validation
   *
   * @example
   * const validation = fileHandler.validateFile(selectedFile);
   * if (!validation.valid) {
   *   console.error('Validation failed:', validation.message);
   * }
   *
   * @since 1.0.0
   */
  validateFile(file) {
    if (!file) {
      return { valid: false, message: "No file provided" };
    }

    if (!this.supportedTypes.includes(file.type)) {
      return {
        valid: false,
        message: `Unsupported file type: ${
          file.type
        }. Supported: ${this.supportedTypes.join(", ")}`,
      };
    }

    if (file.size > this.maxFileSize) {
      return {
        valid: false,
        message: `File too large: ${this.formatFileSize(file.size)} (max 10MB)`,
      };
    }

    logDebug("File validation passed", { type: file.type, size: file.size });
    return { valid: true };
  }

  /**
   * @method displayResponsiveImagePreview
   * @description Creates responsive image preview with aspect ratio preservation
   *
   * Generates an accessible image preview with file information display and processing
   * confirmation workflow. Handles blob URL creation and cleanup whilst maintaining
   * responsive design across all device sizes.
   *
   * @param {File} file - Image file to preview
   * @throws {Error} If preview generation fails or required DOM elements are missing
   *
   * @example
   * if (file.type.startsWith('image/')) {
   *   fileHandler.displayResponsiveImagePreview(file);
   * }
   *
   * @accessibility
   * - Provides descriptive alt text for preview images
   * - Maintains keyboard navigation for interactive elements
   * - Announces file information to screen readers
   * @since 1.0.0
   */
  displayResponsiveImagePreview(file) {
    logInfo("Displaying responsive image preview", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    try {
      // Locate required DOM elements for preview display
      const previewContainer = document.getElementById(
        "mathpix-image-preview-container",
      );
      const imageElement = document.getElementById("mathpix-image-preview");
      const fileInfoElement = document.getElementById("mathpix-file-info");
      const openOriginalBtn = document.getElementById(
        "mathpix-open-original-btn",
      );

      if (
        !previewContainer ||
        !imageElement ||
        !fileInfoElement ||
        !openOriginalBtn
      ) {
        logError("Preview HTML elements not found in DOM");
        return;
      }

      // Clean up any existing blob URL to prevent memory leaks
      if (this.currentFileBlob) {
        URL.revokeObjectURL(this.currentFileBlob);
      }

      // Create object URL for responsive preview display
      const imageUrl = URL.createObjectURL(file);
      this.currentFileBlob = imageUrl;

      // Configure image element with accessibility attributes
      imageElement.src = imageUrl;
      imageElement.alt = `Preview of ${file.name}`;
      imageElement.style.display = "block";

      // Populate file information with formatted details and screen reader context
      fileInfoElement.innerHTML = `
        <strong>
          <span class="sr-only">Filename: </span>${file.name}
        </strong><br>
        <span class="sr-only">File size: </span>${this.formatFileSize(
          file.size,
        )} | <span class="sr-only">File type: </span>${this.getFileTypeDescription(
          file.type,
        )}
      `;

      // Configure buttons based on confirmation workflow settings
      if (MATHPIX_CONFIG.PHASE_4?.SHOW_CONFIRMATION_BUTTON !== false) {
        // Hide original view button initially - shown after confirmation
        openOriginalBtn.style.display = "none";

        // Add process confirmation button for user control
        this.addProcessConfirmationButton(previewContainer, file);
      } else {
        // Legacy behaviour - immediate original view availability
        openOriginalBtn.style.display = "inline-block";
        openOriginalBtn.onclick = () => this.openOriginalInNewWindow(file);
        openOriginalBtn.setAttribute(
          "aria-label",
          `Open original ${file.name} in new window`,
        );
      }

      // Display preview container with responsive layout
      previewContainer.style.display = "block";
      this.controller.elements.imagePreviewContainer = previewContainer;

      // Phase 2: Show processing options panel with saved preferences
      if (
        this.controller.uiManager &&
        this.controller.uiManager.showProcessingOptions
      ) {
        this.controller.uiManager.showProcessingOptions();
        logDebug("Processing options panel shown with image preview");
      }

      // Note: File upload success is already announced by handleUpload() via showNotification()
      // No need for additional screen reader announcement here to avoid duplicates

      // Scroll to preview container and set focus to image after DOM updates complete
      // Using instant scroll due to mode switch and layout changes (hide camera, show preview)
      // Wait for DOM to fully update before scrolling and focusing
      setTimeout(() => {
        // Scroll to the preview container (shows top of preview section)
        previewContainer.scrollIntoView({
          behavior: "instant",
          block: "start",
        });

        // Set focus to the preview image for screen reader navigation
        // This positions screen reader at the image, so arrow down continues naturally
        // through file info → button
        imageElement.setAttribute("tabindex", "-1");
        imageElement.focus();

        logDebug("Scrolled to preview container and set focus to image", {
          scrollBehavior: "instant",
          scrollTarget: "#mathpix-image-preview-container",
          block: "start",
          focusTarget: "#mathpix-image-preview",
          reason: "Mode switch from camera requires instant scroll",
          screenReaderFlow: "image → file info → button",
        });
      }, 150); // 150ms ensures mode switch and DOM updates complete

      logDebug("Responsive image preview displayed successfully", {
        previewUrl: imageUrl,
        fileName: file.name,
        confirmationWorkflow:
          MATHPIX_CONFIG.PHASE_4?.SHOW_CONFIRMATION_BUTTON !== false,
      });
    } catch (error) {
      logError("Failed to display responsive image preview", error);
      this.showNotification("Failed to create image preview", "error");
    }
  }

  /**
   * @method openOriginalInNewWindow
   * @description Opens original uploaded file in new browser window/tab
   *
   * Creates a blob URL for the original file and opens it in a new window with
   * appropriate accessibility attributes. Handles popup blocking gracefully
   * and manages blob URL cleanup.
   *
   * @param {File} file - Original uploaded file to display
   * @throws {Error} If window opening fails or blob creation encounters errors
   *
   * @example
   * const openBtn = document.getElementById('open-original');
   * openBtn.onclick = () => fileHandler.openOriginalInNewWindow(currentFile);
   *
   * @accessibility
   * - Sets descriptive window title for screen readers
   * - Provides user feedback for popup blocking scenarios
   * - Maintains focus management when returning to main window
   * @since 1.0.0
   */
  openOriginalInNewWindow(file) {
    // Validate input - must be a File or Blob object
    const fileToOpen =
      file instanceof File || file instanceof Blob
        ? file
        : this.currentUploadedFile;

    if (
      !fileToOpen ||
      !(fileToOpen instanceof File || fileToOpen instanceof Blob)
    ) {
      logError("Cannot open original file - no valid file available", {
        providedType: file ? typeof file : "undefined",
        providedValue: file,
        currentUploadedFile: this.currentUploadedFile,
      });
      this.showNotification("No file available to display", "warning");
      return;
    }

    logInfo("Opening original file in new window", {
      fileName: fileToOpen.name || "unnamed",
      fileSize: fileToOpen.size,
    });

    try {
      // Create blob URL for original file access
      const originalUrl = URL.createObjectURL(fileToOpen);

      // Open in new window/tab with accessibility support
      const newWindow = window.open(originalUrl, "_blank");

      if (newWindow) {
        // Set descriptive window title for screen reader users
        const fileName = fileToOpen.name || "Original File";
        newWindow.document.title = `Original: ${fileName}`;

        // Clean up blob URL after window loads to prevent memory leaks
        newWindow.addEventListener("load", () => {
          setTimeout(() => {
            URL.revokeObjectURL(originalUrl);
          }, 1000); // Small delay to ensure image loads completely
        });

        logDebug("Original file opened in new window successfully");
      } else {
        // Handle popup blocking with user-friendly feedback
        this.showNotification(
          "Please allow popups to view original file",
          "warning",
        );
        logWarn("Failed to open new window - popup may be blocked");
      }
    } catch (error) {
      logError("Failed to open original file in new window", error);
      this.showNotification("Failed to open original file", "error");
    }
  }

  /**
   * @method addProcessConfirmationButton
   * @description Adds user confirmation button for processing control
   *
   * Creates or updates a confirmation button that allows users to explicitly
   * control when file processing begins. Maintains accessibility standards
   * and integrates with existing preview container layout.
   *
   * @param {HTMLElement} previewContainer - Container element for the preview interface
   * @param {File} file - File that will be processed upon confirmation
   * @throws {Error} If button creation fails or container is invalid
   *
   * @example
   * // Automatically called during preview generation
   * this.addProcessConfirmationButton(previewContainer, uploadedFile);
   *
   * @accessibility
   * - Provides descriptive aria-label for screen readers
   * - Maintains keyboard navigation compatibility
   * - Uses semantic button element with proper type
   * @since 1.0.0
   */
  addProcessConfirmationButton(previewContainer, file) {
    logDebug("Adding process confirmation button", {
      fileName: file.name,
      fileSize: file.size,
    });

    // Check for existing button to avoid duplicates
    let confirmBtn = previewContainer.querySelector(
      ".mathpix-process-confirm-btn",
    );

    if (!confirmBtn) {
      // Create new confirmation button with proper accessibility
      confirmBtn = document.createElement("button");
      confirmBtn.className =
        "mathpix-process-confirm-btn mathpix-open-original-btn"; // Reuse styling
      confirmBtn.type = "button";

      // Locate actions container for proper layout integration
      const actionsContainer = previewContainer.querySelector(
        ".mathpix-preview-actions",
      );
      if (actionsContainer) {
        actionsContainer.appendChild(confirmBtn);
      } else {
        // Fallback - add directly to container
        previewContainer.appendChild(confirmBtn);
      }
    }

    // Configure button with accessibility and functionality

    confirmBtn.innerHTML = `
<svg aria-hidden="true" height="21" width="21" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)">
    <path d="m11.5779891 4.55941656c1.1699828.91516665 1.9220109 2.34005226 1.9220109 3.94058344 0 .48543539-.0691781.95471338-.1982137 1.39851335.3339576-.25026476.748773-.39851335 1.1982137-.39851335 1.1045695 0 2 .8954305 2 2s-.8954305 2-2 2c-1.104407 0-10.16182706 0-11 0-1.65685425 0-3-1.3431458-3-3 0-1.65685425 1.34314575-3 3-3 .03335948 0 .06659179.00054449.09968852.00162508.242805-1.19819586.9140534-2.24091357 1.84691265-2.96132058"/>
    <path d="m6.5 2.5 2-2 2 2"/>
    <path d="m8.5.5v9"/>
  </g>
</svg>
Process with MathPix
`;
    confirmBtn.setAttribute(
      "aria-label",
      `Process ${file.name} with MathPix OCR`,
    );
    confirmBtn.onclick = (e) => {
      e.preventDefault();
      this.controller.confirmAndProcessFile(file);
    };
    confirmBtn.style.display = "inline-flex";

    logDebug("Process confirmation button added successfully", {
      fileName: file.name,
      buttonText: confirmBtn.textContent.trim(),
    });
  }

  /**
   * @method formatFileSize
   * @description Formats file size in bytes to human-readable format
   *
   * Converts byte values to appropriate units (Bytes, KB, MB, GB) with
   * consistent decimal formatting for user-friendly display.
   *
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size string (e.g., "2.5 MB", "1.0 KB")
   *
   * @example
   * const sizeText = fileHandler.formatFileSize(2048); // Returns "2.0 KB"
   * const largeSizeText = fileHandler.formatFileSize(1572864); // Returns "1.5 MB"
   *
   * @since 1.0.0
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    const value = bytes / Math.pow(k, i);

    // For whole numbers, show .0 for consistency (except Bytes)
    if (i > 0 && value === Math.floor(value)) {
      return value.toFixed(1) + " " + sizes[i];
    }

    return parseFloat(value.toFixed(1)) + " " + sizes[i];
  }

  /**
   * @method getFileTypeDescription
   * @description Converts MIME type to user-friendly file type description
   *
   * Provides human-readable descriptions for supported file types,
   * improving user understanding of file compatibility.
   *
   * @param {string} mimeType - MIME type identifier (e.g., "image/jpeg")
   * @returns {string} User-friendly description (e.g., "JPEG Image")
   *
   * @example
   * const description = fileHandler.getFileTypeDescription("image/png");
   * console.log(description); // "PNG Image"
   *
   * @since 1.0.0
   */
  getFileTypeDescription(mimeType) {
    /**
     * @constant {Object} typeMap
     * @description Mapping of MIME types to user-friendly descriptions
     * @readonly
     */
    const typeMap = {
      "image/jpeg": "JPEG Image",
      "image/png": "PNG Image",
      "image/webp": "WebP Image",
      "application/pdf": "PDF Document",
    };

    return typeMap[mimeType] || "Unknown";
  }

  /**
   * @method cleanup
   * @description Performs comprehensive resource cleanup and state reset
   *
   * Releases blob URLs, resets file state, hides preview elements, and calls
   * parent cleanup. Essential for preventing memory leaks and maintaining
   * clean application state.
   *
   * @throws {Error} If cleanup operations encounter unexpected failures
   *
   * @example
   * // Automatically called when switching modes or on errors
   * fileHandler.cleanup();
   *
   * @since 1.0.0
   */
  cleanup() {
    // Release blob URLs to prevent memory leaks
    if (this.currentFileBlob) {
      URL.revokeObjectURL(this.currentFileBlob);
      this.currentFileBlob = null;
    }

    // Reset file state to initial conditions
    this.currentUploadedFile = null;

    // Hide preview elements to maintain clean UI state
    const previewContainer = document.getElementById(
      "mathpix-image-preview-container",
    );
    if (previewContainer) {
      previewContainer.style.display = "none";
    }

    // Phase 2: Hide processing options panel when cleaning up
    if (
      this.controller.uiManager &&
      this.controller.uiManager.hideProcessingOptions
    ) {
      this.controller.uiManager.hideProcessingOptions();
      logDebug("Processing options panel hidden during cleanup");
    }

    // Call parent cleanup for inherited functionality
    super.cleanup();
    logDebug("File handler cleanup completed");
  }

  /**
   * @method getCurrentFile
   * @description Retrieves currently loaded file reference with transform application
   *
   * WYSIWYG Principle: If user has applied transforms to the preview (rotate/flip),
   * this method applies those transforms to the actual file using canvas operations.
   * The transformed file is cached to avoid redundant processing.
   *
   * @returns {Promise<File|null>} Current uploaded file (transformed if applicable) or null
   *
   * @example
   * const currentFile = await fileHandler.getCurrentFile();
   * if (currentFile) {
   *   console.log('File loaded:', currentFile.name);
   * }
   *
   * @since 1.0.0
   * @since 1.0.1 - Added async transform application for WYSIWYG behavior
   */
  async getCurrentFile() {
    // Return null if no file loaded
    if (!this.currentUploadedFile) {
      return null;
    }

    // Step 4C: Apply transforms if user has adjusted preview
    if (this.previewTransforms.hasTransforms) {
      // Use cached transformed file if already generated
      if (this.previewTransforms.transformedFile) {
        logDebug("Returning cached transformed file");
        return this.previewTransforms.transformedFile;
      }

      // Apply canvas-based transforms to match preview
      logInfo("Applying canvas transforms to file before processing", {
        rotation: this.previewTransforms.rotation,
        flipped: this.previewTransforms.flipped,
      });

      try {
        const transformedFile = await this.imageTransformer.applyTransforms(
          this.currentUploadedFile,
          this.previewTransforms,
        );

        // Cache transformed file to avoid redundant processing
        this.previewTransforms.transformedFile = transformedFile;

        logInfo("Canvas transforms applied successfully", {
          originalName: this.currentUploadedFile.name,
          transformedName: transformedFile.name,
          originalSize: this.currentUploadedFile.size,
          transformedSize: transformedFile.size,
        });

        this.showNotification("Preview transforms applied to file", "success");

        return transformedFile;
      } catch (error) {
        logError("Failed to apply transforms to file", error);
        this.showNotification(
          `Transform application failed: ${error.message}. Using original file.`,
          "warning",
        );

        // Fallback: return original file if transform fails
        return this.currentUploadedFile;
      }
    }

    // No transforms needed - return original file
    return this.currentUploadedFile;
  }

  /**
   * @method hasFile
   * @description Checks if a file is currently loaded for processing
   *
   * @returns {boolean} True if file is loaded, false otherwise
   *
   * @example
   * if (fileHandler.hasFile()) {
   *   // Enable processing options
   *   enableProcessingControls();
   * }
   *
   * @since 1.0.0
   */
  hasFile() {
    return !!this.currentUploadedFile;
  }

  /**
   * @method hidePDFInterfaceForImageUpload
   * @description Hides PDF interface when user switches to image processing
   *
   * UNIFIED DROP ZONE: When user uploads an image after working with PDF,
   * this indicates intent to switch to image processing workflow.
   * Cleans up PDF interface to prevent confusion and maintain clear UX.
   *
   * @returns {void}
   * @private
   * @since 2.1.1 - Unified drop zone implementation
   */
  hidePDFInterfaceForImageUpload() {
    // Hide the main PDF interface container
    const pdfInterface = document.getElementById("mathpix-pdf-interface");
    if (pdfInterface && pdfInterface.style.display !== "none") {
      pdfInterface.style.display = "none";
      logDebug("PDF interface hidden for image processing workflow");
    }

    // Reset PDF handler state if available
    if (this.controller.pdfHandler) {
      // Clear PDF file state to avoid confusion
      this.controller.pdfHandler.currentPDFFile = null;
      this.controller.pdfHandler.currentProcessingOptions = null;
      this.controller.pdfHandler.currentPDFId = null;
      this.controller.pdfHandler.currentPDFResults = null;

      logDebug("PDF handler state cleared for image processing");
    }

    // Ensure main image interface is visible
    const imageInterface = document.getElementById("mathpix-main-interface");
    if (imageInterface) {
      imageInterface.style.display = "block";
      logDebug("Image interface restored for image processing");
    }

    // Reset unified drop zone to show image state
    if (this.controller.pdfHandler?.resetDropZoneToInitial) {
      this.controller.pdfHandler.resetDropZoneToInitial();
    }
  }

  /**
   * @method handleClipboardPaste
   * @description Processes clipboard paste events for direct image processing
   *
   * Extracts image data from clipboard (e.g., from Windows Snipping Tool,
   * macOS screenshots, or other clipboard sources) and processes it through
   * the standard file validation workflow. This enables seamless copy-paste
   * workflows for mathematical content capture.
   *
   * Workflow:
   * 1. Extract clipboard items from paste event
   * 2. Locate first image item in clipboard data
   * 3. Convert to File object with descriptive naming
   * 4. Process through standard validation pipeline
   * 5. Announce action to screen readers for accessibility
   *
   * @param {ClipboardEvent} event - Browser paste event containing clipboard data
   * @returns {Promise<void>}
   * @throws {Error} If clipboard processing fails or no image found
   *
   * @example
   * // Called automatically when paste event occurs in MathPix mode
   * document.addEventListener('paste', (e) => {
   *   if (mathPixModeActive) {
   *     await fileHandler.handleClipboardPaste(e);
   *   }
   * });
   *
   * @accessibility
   * - Announces paste action to screen readers
   * - Provides clear feedback for missing image data
   * - Integrates with existing notification system
   * @since 2.2.0 - Clipboard paste feature
   */
  async handleClipboardPaste(event) {
    logInfo("[MathPixFileHandler] Processing clipboard paste");

    try {
      // Extract clipboard items from paste event
      const clipboardItems = event.clipboardData?.items;
      if (!clipboardItems || clipboardItems.length === 0) {
        logWarn("[MathPixFileHandler] No clipboard data found");
        this.showNotification("No image data found in clipboard", "warning");
        return;
      }

      // Locate first image item in clipboard contents
      let imageItem = null;
      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.startsWith("image/")) {
          imageItem = item;
          logDebug(
            `[MathPixFileHandler] Found image in clipboard: ${item.type}`,
          );
          break;
        }
      }

      if (!imageItem) {
        logWarn("[MathPixFileHandler] No image found in clipboard data");
        this.showNotification(
          "Please paste an image (no image found in clipboard)",
          "warning",
        );
        return;
      }

      // Convert clipboard image to File object for processing
      const blob = imageItem.getAsFile();
      if (!blob) {
        logError("[MathPixFileHandler] Failed to get file from clipboard item");
        this.showNotification(
          "Failed to extract image from clipboard",
          "error",
        );
        return;
      }

      // Create File object with descriptive name and proper MIME type
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const extension = blob.type.split("/")[1] || "png";
      const fileName = `pasted-image-${timestamp}.${extension}`;

      const file = new File([blob], fileName, {
        type: blob.type,
        lastModified: Date.now(),
      });

      logInfo(
        `[MathPixFileHandler] Created file from clipboard: ${fileName} (${blob.type}, ${blob.size} bytes)`,
      );

      // Announce to screen readers for accessibility
      this.announceToScreenReader(`Image pasted from clipboard: ${fileName}`);

      // Process pasted file through standard validation workflow
      await this.handleUpload(file);
    } catch (error) {
      logError("[MathPixFileHandler] Error handling clipboard paste:", error);
      this.showNotification("Failed to process pasted image", "error");
    }
  }

  /**
   * @method announceToScreenReader
   * @description Creates accessible announcement for screen reader users
   *
   * Generates a temporary live region element to announce important actions
   * to screen reader users without interrupting their workflow. The element
   * is automatically removed after announcement to maintain clean DOM.
   *
   * Uses ARIA live region with 'polite' setting to avoid interrupting
   * current screen reader announcements whilst ensuring message is conveyed.
   *
   * @param {string} message - Message to announce to screen reader users
   * @returns {void}
   *
   * @example
   * fileHandler.announceToScreenReader('File uploaded successfully');
   * fileHandler.announceToScreenReader('Processing complete');
   *
   * @accessibility
   * - WCAG 2.2 AA compliant status announcements
   * - Non-interrupting polite live region
   * - Temporary DOM insertion prevents clutter
   * - sr-only class ensures visual hiding
   * @since 2.2.0 - Clipboard paste feature
   */
  announceToScreenReader(message) {
    const announcement = document.createElement("div");
    announcement.setAttribute("role", "status");
    announcement.setAttribute("aria-live", "polite");
    announcement.className = "sr-only";
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove announcement element after screen reader processes it
    setTimeout(() => {
      if (announcement.parentNode) {
        document.body.removeChild(announcement);
      }
    }, 1000);

    logDebug(`[MathPixFileHandler] Screen reader announcement: ${message}`);
  }

  /**
   * @method resetTransformState
   * @description Resets transform state to default values for new file
   * @returns {void}
   * @private
   * @since 1.0.0
   */
  resetTransformState() {
    this.previewTransforms = {
      rotation: 0,
      flipped: false,
      hasTransforms: false,
      transformedFile: null,
    };
    logDebug("Transform state reset");
  }

  /**
   * @method updateTransformControlsVisibility
   * @description Shows or hides transform controls based on file source
   *
   * Transform controls are only shown for camera-captured images to allow
   * users to adjust orientation before processing. Uploaded files don't
   * typically need these controls as users can rotate them before upload.
   *
   * @returns {void}
   * @private
   * @since 1.0.0
   */
  updateTransformControlsVisibility() {
    const transformControls = this.controller.elements["transform-controls"];
    if (!transformControls) {
      logWarn("Transform controls element not found");
      return;
    }

    const isCameraCapture =
      this.currentUploadedFile?.captureMetadata?.source === "camera";

    if (isCameraCapture) {
      transformControls.style.display = "flex";
      logDebug("Transform controls shown for camera capture");
    } else {
      transformControls.style.display = "none";
      logDebug("Transform controls hidden for uploaded file");
    }
  }

  /**
   * @method applyInitialMirrorState
   * @description Applies initial CSS transform if image was captured with mirrored preview
   *
   * When camera captures with mirrored preview (selfie mode), the captured image
   * is un-mirrored by default. This method re-applies the mirror state so the
   * preview matches what the user saw in the camera, maintaining WYSIWYG principle.
   *
   * @returns {void}
   * @private
   * @since 1.0.0
   */
  applyInitialMirrorState() {
    const preview = this.controller.elements["image-preview"];
    if (!preview || !this.currentUploadedFile?.captureMetadata) {
      return;
    }

    const wasMirrored = this.currentUploadedFile.captureMetadata.wasMirrored;
    if (wasMirrored) {
      // Apply horizontal flip to match camera preview
      this.previewTransforms.flipped = true;
      this.previewTransforms.hasTransforms = true;
      this.updatePreviewTransform();
      this.updateTransformStateDisplay();
      logInfo("Applied initial mirror state to preview");
    }
  }

  /**
   * @method rotatePreview
   * @description Rotates preview image 90° clockwise using CSS transform
   *
   * Provides instant visual feedback by applying CSS transforms only.
   * Actual canvas-based rotation is deferred until user clicks "Process".
   * Rotation cycles through 0° → 90° → 180° → 270° → 0°.
   *
   * @returns {void}
   * @public
   * @since 1.0.0
   */
  rotatePreview() {
    // Increment rotation by 90°, wrapping at 360°
    this.previewTransforms.rotation =
      (this.previewTransforms.rotation + 90) % 360;
    this.previewTransforms.hasTransforms =
      this.previewTransforms.rotation !== 0 || this.previewTransforms.flipped;

    this.updatePreviewTransform();
    this.updateTransformStateDisplay();

    logInfo(`Preview rotated to ${this.previewTransforms.rotation}°`);
    this.showNotification(
      `Preview rotated to ${this.previewTransforms.rotation}°`,
      "info",
    );
  }

  /**
   * @method flipPreview
   * @description Flips preview image horizontally using CSS transform
   *
   * Provides instant visual feedback by applying CSS transforms only.
   * Actual canvas-based flip is deferred until user clicks "Process".
   * Flipping is a toggle operation (flip → unflip → flip).
   *
   * @returns {void}
   * @public
   * @since 1.0.0
   */
  flipPreview() {
    // Toggle flip state
    this.previewTransforms.flipped = !this.previewTransforms.flipped;
    this.previewTransforms.hasTransforms =
      this.previewTransforms.rotation !== 0 || this.previewTransforms.flipped;

    this.updatePreviewTransform();
    this.updateTransformStateDisplay();

    const state = this.previewTransforms.flipped ? "flipped" : "unflipped";
    logInfo(`Preview ${state} horizontally`);
    this.showNotification(`Preview ${state} horizontally`, "info");
  }

  /**
   * @method updatePreviewTransform
   * @description Updates CSS transform on preview image element
   *
   * Combines rotation and flip transforms into a single CSS transform string.
   * Order matters: rotation is applied before flip for correct visual result.
   *
   * @returns {void}
   * @private
   * @since 1.0.0
   */
  updatePreviewTransform() {
    const preview = this.controller.elements["image-preview"];
    if (!preview) {
      logWarn("Image preview element not found");
      return;
    }

    const cssTransform = this.imageTransformer.getCSSTransform(
      this.previewTransforms.rotation,
      this.previewTransforms.flipped,
    );

    preview.style.transform = cssTransform;

    // Phase 1F.2: Adjust image constraints for 90°/270° rotations
    // When rotated 90° or 270°, the image dimensions are swapped
    // We need to reduce max-width to prevent vertical overflow
    const isRotatedVertical =
      this.previewTransforms.rotation === 90 ||
      this.previewTransforms.rotation === 270;

    if (isRotatedVertical) {
      // Swap dimensions: limit width more strictly for portrait orientation
      preview.style.maxWidth = "250px";
      preview.style.maxHeight = "400px";
    } else {
      // Normal landscape orientation
      preview.style.maxWidth = "400px";
      preview.style.maxHeight = "300px";
    }

    logDebug(`Applied CSS transform: ${cssTransform}`, {
      rotation: this.previewTransforms.rotation,
      isRotatedVertical,
      maxWidth: preview.style.maxWidth,
      maxHeight: preview.style.maxHeight,
    });
  }

  /**
   * @method updateTransformStateDisplay
   * @description Updates transform state text display for user feedback
   *
   * Provides human-readable description of current transforms applied to preview.
   * This helps users understand what adjustments have been made before processing.
   *
   * @returns {void}
   * @private
   * @since 1.0.0
   */
  updateTransformStateDisplay() {
    const stateDisplay = this.controller.elements["transform-state"];
    if (!stateDisplay) {
      logWarn("Transform state display element not found");
      return;
    }

    const description = this.imageTransformer.getTransformDescription(
      this.previewTransforms.rotation,
      this.previewTransforms.flipped,
    );

    stateDisplay.textContent = description;
    logDebug(`Transform state display updated: ${description}`);
  }
}

export default MathPixFileHandler;
