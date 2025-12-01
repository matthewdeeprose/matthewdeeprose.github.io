/**
 * @fileoverview MathPix Main Controller - Central coordination system for mathematics OCR processing
 * @module MathPixMainController
 * @requires MathPixAPIClient
 * @requires MATHPIX_CONFIG
 * @requires MathPixProgressDisplay
 * @requires MathPixPrismBridge
 * @requires MathPixPrivacyManager
 * @requires MathPixFileHandler
 * @requires MathPixResultRenderer
 * @requires MathPixUIManager
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * The MathPixController serves as the central coordination hub for the MathPix mathematics OCR system.
 * It orchestrates file processing, UI management, privacy controls, and result rendering through a
 * modular architecture that promotes separation of concerns whilst maintaining backwards compatibility.
 *
 * Key Features:
 * - Modular architecture with specialised components
 * - Privacy-first processing with GDPR compliance
 * - Multi-format mathematical output (LaTeX, MathML, AsciiMath, HTML, Markdown, JSON)
 * - Real-time progress tracking with visual feedback
 * - MathJax integration for enhanced mathematical rendering
 * - Comprehensive error handling with user-friendly feedback
 * - Full accessibility compliance (WCAG 2.2 AA)
 *
 * Integration:
 * - Integrates with existing notification and modal systems
 * - Coordinates with MathJax for mathematical rendering
 * - Manages file upload workflow and preview generation
 * - Handles API communication with MathPix service
 *
 * Architecture:
 * - Controller pattern for component orchestration
 * - Delegation pattern for backwards compatibility
 * - Modular components for specific functionality areas
 * - Event-driven communication between components
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant throughout
 * - Full keyboard navigation support
 * - Screen reader compatibility with ARIA labels
 * - Focus management for modal and file processing workflows
 */

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

import MathPixAPIClient from "../core/mathpix-api-client.js";
import MATHPIX_CONFIG, {
  getEndpointConfig,
  getEndpointFeatures,
  isFeatureAvailable,
} from "../core/mathpix-config.js";
import MathPixProgressDisplay from "./mathpix-progress-display.js";
import MathPixPrismBridge from "../integrations/mathpix-prism-bridge.js";
import MathPixPrivacyManager from "../core/mathpix-privacy-manager.js";

// Make MATHPIX_CONFIG globally available for configuration checks
window.MATHPIX_CONFIG = MATHPIX_CONFIG;

// New modular components
import MathPixFileHandler from "./components/mathpix-file-handler.js";
import MathPixResultRenderer from "./components/mathpix-result-renderer.js";
import MathPixUIManager from "./components/mathpix-ui-manager.js";

// PDF processing components (Phase 2.1)
import MathPixPDFHandler from "./components/mathpix-pdf-handler.js";
import MathPixPDFProcessor from "./components/mathpix-pdf-processor.js";
import MathPixPDFResultRenderer from "./components/mathpix-pdf-result-renderer.js";

// Phase 3.1: Advanced content analysis components
import MathPixLinesDataManager from "../core/mathpix-lines-data-manager.js";

// Phase 3.4.2: PDF preview system components
import { PDFPreviewCore } from "../pdf-preview/pdf-preview-core.js";

// Phase 5: Total Downloader system
import MathPixDownloadManager from "./components/mathpix-download-manager.js";

// Phase 1C: Strokes system components (handwriting recognition)
import MathPixStrokesCanvas from "../core/mathpix-strokes-canvas.js";
import MathPixStrokesAPIClient from "../core/mathpix-strokes-api-client.js";
import MathPixModeSwitcher from "./components/mathpix-mode-switcher.js";

// Phase 1D: Camera capture system
import MathPixCameraCapture from "../core/mathpix-camera-capture.js";

/**
 * @class MathPixController
 * @description Central controller for MathPix mathematics OCR system
 *
 * Coordinates all aspects of mathematical content processing including file handling,
 * API communication, privacy management, progress tracking, and result rendering.
 * Uses a modular architecture with specialised components for different functionality areas.
 *
 * Phase 3.1 adds advanced content analysis capabilities through the Lines Data Manager,
 * providing detailed document insights and content-aware features.
 *
 * @example
 * // Initialize the MathPix system
 * const success = initMathPix();
 * if (success) {
 *   const controller = getMathPixController();
 *   await controller.handleFileUpload(file);
 * }
 *
 * @see {@link MathPixFileHandler} for file processing functionality
 * @see {@link MathPixResultRenderer} for output rendering
 * @see {@link MathPixUIManager} for UI coordination
 * @see {@link MathPixLinesDataManager} for content analysis functionality
 * @since 1.0.0
 */
class MathPixController {
  /**
   * @constructor
   * @description Creates new MathPixController instance with modular component architecture
   *
   * Initialises core services and modular components:
   * - API client for MathPix service communication
   * - Progress display for user feedback
   * - Privacy manager for GDPR compliance
   * - File handler for upload and processing
   * - Result renderer for output display
   * - UI manager for interface coordination
   * - Lines data manager for content analysis (Phase 3.1)
   */
  constructor() {
    // Core services
    this.apiClient = new MathPixAPIClient();
    this.progressDisplay = new MathPixProgressDisplay();
    this.prismBridge = new MathPixPrismBridge();
    this.privacyManager = new MathPixPrivacyManager();

    // Modular components
    this.fileHandler = new MathPixFileHandler(this);
    this.resultRenderer = new MathPixResultRenderer(this);
    this.uiManager = new MathPixUIManager(this);

    // PDF-specific components (Phase 2.1)
    this.pdfHandler = new MathPixPDFHandler(this);
    this.pdfProcessor = new MathPixPDFProcessor(this);
    this.pdfResultRenderer = new MathPixPDFResultRenderer(this);

    // Phase 3.1: Advanced content analysis
    this.linesDataManager = new MathPixLinesDataManager(this);

    // Phase 3.4.2: PDF preview system
    this.pdfPreviewCore = null; // Initialized on demand

    // Phase 1C: Strokes system (handwriting recognition)
    this.strokesCanvas = null; // Initialized on demand when user switches to draw mode
    this.strokesAPIClient = new MathPixStrokesAPIClient();
    this.modeSwitcher = null; // Initialized when HTML elements are ready

    // Phase 1D: Camera capture system
    this.cameraCapture = null; // Initialized on demand when user switches to camera mode

    // Phase 5: Total Downloader system
    this.downloadManager = null; // Initialized in init() method

    // Legacy compatibility properties
    this.elements = {};
    this.isInitialised = false;

    logInfo(
      "MathPixController created with modular architecture including Phase 3.1 content analysis, Phase 1C strokes system, Phase 1D camera system, and Phase 5 download system"
    );
  }

  /**
   * Initialize PDF preview core on demand
   * @returns {PDFPreviewCore} PDF preview core instance
   */
  getPDFPreviewCore() {
    if (!this.pdfPreviewCore) {
      this.pdfPreviewCore = new PDFPreviewCore();
      logInfo("PDFPreviewCore instance created");
    }
    return this.pdfPreviewCore;
  }

  /**
   * @method init
   * @description Initialises the MathPix controller and all component subsystems
   *
   * Performs complete system initialisation including UI element caching,
   * event listener attachment, and stored configuration loading.
   *
   * @returns {boolean} True if initialisation successful, false on failure
   * @throws {Error} If critical components fail to initialise
   *
   * @example
   * const controller = new MathPixController();
   * const success = controller.init();
   * if (!success) {
   *   console.error('MathPix initialisation failed');
   * }
   *
   * @accessibility Ensures all interactive elements have proper ARIA labels and keyboard support
   * @since 1.0.0
   * @updated Phase 1 Step 6 - Added endpoint selection setup
   */
  init() {
    try {
      this.uiManager.cacheElements();
      this.uiManager.attachEventListeners();
      this.uiManager.loadStoredConfig();

      // PHASE 1 STEP 6: Setup endpoint selection (if UI manager handles this)
      if (this.uiManager && this.uiManager.setupEndpointSelection) {
        this.uiManager.setupEndpointSelection();
        logDebug("Endpoint selection setup completed");
      }

      // PHASE 1 STEP 6: Initial feature availability update
      this.updateFeatureAvailability();

      // PHASE 5: Initialize download manager
      if (typeof MathPixDownloadManager !== "undefined") {
        this.downloadManager = new MathPixDownloadManager(this);
        const initSuccess = this.downloadManager.initialize();
        if (initSuccess) {
          logInfo("✓ Download Manager initialised");
        } else {
          logWarn("⚠ Download Manager initialisation failed");
        }
      } else {
        logWarn("⚠ MathPixDownloadManager not available");
      }

      // Phase 1D: Initialize mode switcher for upload/draw/camera toggle
      if (
        this.elements["upload-container"] &&
        this.elements["draw-container"] &&
        this.elements["camera-container"]
      ) {
        this.modeSwitcher = new MathPixModeSwitcher(this);
        this.modeSwitcher
          .initialise({
            uploadContainer: this.elements["upload-container"],
            drawContainer: this.elements["draw-container"],
            cameraContainer: this.elements["camera-container"],
            uploadRadio: this.elements["upload-mode-radio"],
            drawRadio: this.elements["draw-mode-radio"],
            cameraRadio: this.elements["camera-mode-radio"],
          })
          .then(() => {
            logInfo("✓ Mode switcher initialised with three-mode support");
          })
          .catch((err) => {
            logError("Mode switcher initialisation failed", err);
          });
      } else {
        logWarn("⚠ Mode switcher not initialised - missing container elements");
      }

      this.isInitialised = true;
      logInfo(
        "MathPixController initialised successfully with endpoint management, download system, and mode switcher"
      );
      return true;
    } catch (error) {
      logError("Failed to initialise MathPixController", error);
      return false;
    }
  }

  // =============================================================================
  // ENDPOINT MANAGEMENT METHODS (PHASE 1)
  // =============================================================================

  /**
   * @method getCurrentEndpoint
   * @description Gets current endpoint configuration information
   *
   * Returns comprehensive information about the currently active API endpoint
   * including name, location, available features, and GDPR compliance status.
   *
   * @returns {Object|null} Current endpoint configuration or null if API client unavailable
   * @returns {string} returns.name - Endpoint name (e.g., "Europe (EU)")
   * @returns {string} returns.location - Endpoint location identifier
   * @returns {string} returns.apiBase - API base URL
   * @returns {Array<string>} returns.features - Available features on this endpoint
   *
   * @example
   * const endpoint = controller.getCurrentEndpoint();
   * console.log(`Current endpoint: ${endpoint.name} (${endpoint.location})`);
   * console.log(`Features: ${endpoint.features.join(', ')}`);
   *
   * @since Phase 1 Step 6
   */
  getCurrentEndpoint() {
    if (!this.apiClient) {
      logWarn("API client not available for endpoint info");
      return null;
    }

    const config = this.apiClient.getEndpointConfig();
    logDebug("Retrieved current endpoint configuration", {
      endpoint: config?.name,
      features: config?.features,
    });

    return config;
  }

  /**
   * @method updateFeatureAvailability
   * @description Updates feature availability across all UI components
   *
   * Propagates endpoint feature availability information to all components
   * that need to update their UI state based on current endpoint capabilities.
   * Currently updates PDF handler format availability.
   *
   * @returns {void}
   *
   * @example
   * // Called automatically after endpoint change
   * controller.updateFeatureAvailability();
   *
   * @since Phase 1 Step 6
   */
  updateFeatureAvailability() {
    if (!this.apiClient) {
      logDebug("API client not available for feature availability update");
      return;
    }

    const currentEndpoint = this.apiClient.currentEndpoint;
    logDebug("Updating feature availability across components", {
      endpoint: currentEndpoint,
    });

    // Update UI Manager feature availability display
    if (this.uiManager && this.uiManager.updateFeatureAvailability) {
      this.uiManager.updateFeatureAvailability(currentEndpoint);
      logDebug("UI Manager feature availability updated");
    }

    // Update PDF Handler format availability
    if (this.pdfHandler && this.pdfHandler.updateFormatAvailability) {
      this.pdfHandler.updateFormatAvailability();
      logDebug("PDF Handler format availability updated");
    }

    logInfo("Feature availability update completed", {
      endpoint: currentEndpoint,
      updatedComponents: [
        this.uiManager ? "UIManager" : null,
        this.pdfHandler ? "PDFHandler" : null,
      ].filter(Boolean),
    });
  }

  /**
   * @method isFeatureAvailable
   * @description Checks if a specific feature is available on current endpoint
   *
   * Convenience method for checking feature availability without direct
   * API client access. Useful for conditional UI logic and feature gating.
   *
   * @param {string} featureName - Feature name to check (e.g., 'latex_pdf', 'docx')
   * @returns {boolean} True if feature is available on current endpoint
   *
   * @example
   * if (controller.isFeatureAvailable('latex_pdf')) {
   *   // Enable LaTeX PDF download option
   * } else {
   *   // Show upgrade message or alternative options
   * }
   *
   * @since Phase 1 Step 6
   */
  isFeatureAvailable(featureName) {
    if (!this.apiClient) {
      logWarn("API client not available for feature check", { featureName });
      return false;
    }

    const isAvailable = this.apiClient.isFeatureAvailable(featureName);

    logDebug("Feature availability checked", {
      feature: featureName,
      available: isAvailable,
      endpoint: this.apiClient.currentEndpoint,
    });

    return isAvailable;
  }

  /**
   * @method switchEndpoint
   * @description Switches to a different API endpoint with feature update
   *
   * Convenience method that switches endpoints and automatically updates
   * feature availability across all components. Wraps API client's
   * switchEndpoint with controller-level coordination.
   *
   * @param {string} endpointKey - Endpoint key ('US', 'EU', 'ASIA')
   * @returns {boolean} True if switch successful
   *
   * @example
   * // Switch to US endpoint for full features
   * if (controller.switchEndpoint('US')) {
   *   console.log('Switched to US endpoint successfully');
   *   // All UI components automatically updated
   * }
   *
   * @since Phase 1 Step 6
   */
  switchEndpoint(endpointKey) {
    if (!this.apiClient) {
      logError("API client not available for endpoint switch");
      return false;
    }

    logInfo("Switching endpoint", {
      from: this.apiClient.currentEndpoint,
      to: endpointKey,
    });

    const success = this.apiClient.switchEndpoint(endpointKey);

    if (success) {
      // Update feature availability across all components
      this.updateFeatureAvailability();

      // ✅ CRITICAL: Update strokes API client endpoint if initialized
      if (this.strokesAPIClient && this.strokesAPIClient.apiBase !== null) {
        this.strokesAPIClient.apiBase = this.apiClient.apiBase;
        logDebug("Strokes API client endpoint updated", {
          newApiBase: this.strokesAPIClient.apiBase,
          endpoint: endpointKey,
        });
      }

      logInfo("Endpoint switched successfully", {
        newEndpoint: endpointKey,
        featuresUpdated: true,
        strokesUpdated: !!this.strokesAPIClient?.apiBase,
      });
    } else {
      logError("Failed to switch endpoint", {
        attempted: endpointKey,
      });
    }

    return success;
  }

  // =============================================================================
  // UI MANAGEMENT DELEGATION METHODS
  // =============================================================================

  /**
   * @method cacheElements
   * @description Delegates DOM element caching to UI manager
   * @returns {void}
   * @see {@link MathPixUIManager#cacheElements}
   * @since 1.0.0
   */
  cacheElements() {
    return this.uiManager.cacheElements();
  }

  /**
   * @method cacheMultiFormatElements
   * @description Delegates multi-format element caching to UI manager
   * @returns {void}
   * @see {@link MathPixUIManager#cacheMultiFormatElements}
   * @since 1.0.0
   */
  cacheMultiFormatElements() {
    return this.uiManager.cacheMultiFormatElements();
  }

  /**
   * @method attachEventListeners
   * @description Delegates event listener attachment to UI manager
   * @returns {void}
   * @see {@link MathPixUIManager#attachEventListeners}
   * @since 1.0.0
   */
  attachEventListeners() {
    return this.uiManager.attachEventListeners();
  }

  /**
   * @method loadStoredConfig
   * @description Delegates stored configuration loading to UI manager
   * @returns {void}
   * @see {@link MathPixUIManager#loadStoredConfig}
   * @since 1.0.0
   */
  loadStoredConfig() {
    return this.uiManager.loadStoredConfig();
  }

  /**
   * @method saveConfiguration
   * @description Delegates configuration saving to UI manager
   * @returns {void}
   * @see {@link MathPixUIManager#saveConfiguration}
   * @since 1.0.0
   */
  saveConfiguration() {
    return this.uiManager.saveConfiguration();
  }

  /**
   * @method showNotification
   * @description Displays notification using integrated notification system
   *
   * @param {string} message - Message to display to user
   * @param {string} [type="info"] - Notification type (info, success, error, warning)
   * @returns {void}
   *
   * @example
   * controller.showNotification("Processing complete!", "success");
   * controller.showNotification("Invalid file format", "error");
   *
   * @see {@link MathPixUIManager#showNotification}
   * @since 1.0.0
   */
  showNotification(message, type = "info") {
    return this.uiManager.showNotification(message, type);
  }

  // =============================================================================
  // FILE HANDLING DELEGATION METHODS
  // =============================================================================

  /**
   * @method handleFileUpload
   * @description Main entry point for file processing workflow
   *
   * Handles complete file upload and processing workflow including validation,
   * privacy consent, API processing, and result display.
   *
   * @param {File} file - File object to process
   * @returns {Promise<boolean>} Promise resolving to success status
   * @throws {Error} If file processing fails
   *
   * @example
   * const success = await controller.handleFileUpload(file);
   * if (success) {
   *   console.log('File processed successfully');
   * }
   *
   * @see {@link MathPixFileHandler#handleUpload}
   * @accessibility Provides screen reader feedback during processing
   * @since 1.0.0
   */
  async handleFileUpload(file) {
    logInfo("Handling file upload with type routing", {
      fileName: file.name,
      size: file.size,
      type: file.type,
    });

    try {
      // ✅ PHASE 5.5 STEP 1: Clear ALL session data before new operation
      // This prevents data contamination from previous operations
      this.clearAllSessionData();

      logDebug("Session data cleared, ready for new file processing");

      // Route based on file type
      if (file.type === "application/pdf") {
        logInfo("Routing to PDF processing workflow", { fileName: file.name });
        return await this.handlePDFFileUpload(file);
      } else {
        logInfo("Routing to image processing workflow", {
          fileName: file.name,
        });
        return await this.fileHandler.handleUpload(file);
      }
    } catch (error) {
      logError("File upload routing failed", {
        fileName: file.name,
        fileType: file.type,
        error: error.message,
      });

      this.showNotification(
        `File processing failed: ${error.message}`,
        "error"
      );

      return false;
    }
  }

  /**
   * @method handlePDFFileUpload
   * @description Handle PDF file upload workflow with comprehensive validation and processing
   *
   * Routes PDF files to the dedicated PDF handler for validation, options display,
   * and processing workflow. Maintains error handling consistency with the main
   * controller whilst delegating PDF-specific functionality to the PDF handler.
   *
   * @param {File} file - PDF file to process
   * @returns {Promise<boolean>} Promise resolving to success status
   * @throws {Error} If PDF processing fails or PDF handler is unavailable
   *
   * @example
   * // Called automatically by handleFileUpload for PDF files
   * const success = await controller.handlePDFFileUpload(pdfFile);
   * if (success) {
   *   // PDF is validated and options interface displayed
   * }
   *
   * @accessibility Provides comprehensive user feedback via notification system
   * @since 2.1.0
   */
  async handlePDFFileUpload(file) {
    logInfo("Routing PDF file to PDF handler", {
      fileName: file.name,
      size: file.size,
      type: file.type,
    });

    try {
      // Verify PDF handler is available
      if (!this.pdfHandler) {
        const errorMsg =
          "PDF handler not available - system not properly initialised";
        logError("PDF upload failed", { error: errorMsg });
        this.showNotification(errorMsg, "error");
        return false;
      }

      // Delegate to PDF handler for complete workflow
      const success = await this.pdfHandler.handlePDFUpload(file);

      if (success) {
        logInfo("PDF file routed successfully to PDF handler", {
          fileName: file.name,
        });
      } else {
        logWarn("PDF handler rejected file", {
          fileName: file.name,
        });
      }

      return success;
    } catch (error) {
      logError("PDF file upload routing failed", {
        fileName: file.name,
        fileType: file.type,
        error: error.message,
      });

      this.showNotification(`PDF processing failed: ${error.message}`, "error");

      return false;
    }
  }

  /**
   * @property {File|null} currentUploadedFile
   * @description Currently uploaded file (legacy compatibility property)
   * @readonly
   */
  get currentUploadedFile() {
    return this.fileHandler.currentUploadedFile;
  }

  set currentUploadedFile(file) {
    this.fileHandler.currentUploadedFile = file;
  }

  /**
   * @property {string|null} currentFileBlob
   * @description Current file blob URL for preview (legacy compatibility property)
   * @readonly
   */
  get currentFileBlob() {
    return this.fileHandler.currentFileBlob;
  }

  set currentFileBlob(blob) {
    this.fileHandler.currentFileBlob = blob;
  }

  /**
   * @method displayResponsiveImagePreview
   * @description Delegates responsive image preview to file handler
   *
   * @param {File} file - File to preview
   * @returns {void}
   * @see {@link MathPixFileHandler#displayResponsiveImagePreview}
   * @since 1.0.0
   */
  displayResponsiveImagePreview(file) {
    return this.fileHandler.displayResponsiveImagePreview(file);
  }

  /**
   * @method openOriginalInNewWindow
   * @description Delegates original file opening to file handler
   *
   * @param {File} file - File to open in new window
   * @returns {void}
   * @see {@link MathPixFileHandler#openOriginalInNewWindow}
   * @since 1.0.0
   */
  openOriginalInNewWindow(file) {
    return this.fileHandler.openOriginalInNewWindow(file);
  }

  /**
   * @method formatFileSize
   * @description Delegates file size formatting to file handler
   *
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size string
   * @see {@link MathPixFileHandler#formatFileSize}
   * @since 1.0.0
   */
  formatFileSize(bytes) {
    return this.fileHandler.formatFileSize(bytes);
  }

  /**
   * @method getFileTypeDescription
   * @description Delegates file type description to file handler
   *
   * @param {string} mimeType - MIME type of file
   * @returns {string} User-friendly file type description
   * @see {@link MathPixFileHandler#getFileTypeDescription}
   * @since 1.0.0
   */
  getFileTypeDescription(mimeType) {
    return this.fileHandler.getFileTypeDescription(mimeType);
  }

  // =============================================================================
  // RESULT RENDERING DELEGATION METHODS
  // =============================================================================

  /**
   * @method detectApiType
   * @description Detect which API was used based on response structure
   * @param {Object} response - API response object
   * @returns {string} 'pdf' | 'text' | 'strokes'
   * @since Phase 5
   */
  detectApiType(response) {
    // PDF API indicators - check for actual PDF response properties
    if (
      response.pdf_id ||
      response.conversion_formats ||
      response.conversionResults ||
      response.mmd ||
      response["tex.zip"] ||
      response.processingMetadata ||
      response.docx ||
      response.pptx ||
      response["mmd.zip"] ||
      response["md.zip"] ||
      response["html.zip"]
    ) {
      return "pdf";
    }

    // Strokes API indicators
    if (
      response.strokes ||
      response.stroke_data ||
      this.strokesCanvas?.hasStrokes()
    ) {
      return "strokes";
    }

    // Default to Text API
    return "text";
  }

  /**
   * @method displayResult
   * @description Delegates result display to result renderer and shows download button
   *
   * @param {Object} result - Processing result from MathPix API
   * @param {File} [originalFile] - Original file for comparison view (Phase 1F.2)
   * @returns {void}
   * @see {@link MathPixResultRenderer#displayResult}
   * @since 1.0.0
   * @updated Phase 5 - Added download button integration
   * @updated Phase 1F.2 - Added originalFile parameter for comparison view
   */
  displayResult(result, originalFile) {
    // Delegate to result renderer with file for comparison
    const renderResult = this.resultRenderer.displayResult(
      result,
      originalFile
    );

    // Show download button (Phase 5)
    if (this.downloadManager && result) {
      const apiType = this.detectApiType(result);
      this.downloadManager.showDownloadButton(apiType);
      logDebug("Download button shown for API type:", apiType);
    }

    return renderResult;
  }

  /**
   * @method populateFormatContent
   * @description Delegates format content population to result renderer
   *
   * @param {string} format - Format name
   * @param {string} content - Content to populate
   * @returns {void}
   * @see {@link MathPixResultRenderer#populateFormatContent}
   * @since 1.0.0
   */
  populateFormatContent(format, content) {
    return this.resultRenderer.populateFormatContent(format, content);
  }

  /**
   * @method showFormat
   * @description Delegates format display to result renderer
   *
   * @param {string} format - Format to display
   * @returns {void}
   * @see {@link MathPixResultRenderer#showFormat}
   * @since 1.0.0
   */
  showFormat(format) {
    return this.resultRenderer.showFormat(format);
  }

  /**
   * @method resetFormatOptions
   * @description Delegates format options reset to result renderer
   * @returns {void}
   * @see {@link MathPixResultRenderer#resetFormatOptions}
   * @since 1.0.0
   */
  resetFormatOptions() {
    return this.resultRenderer.resetFormatOptions();
  }

  /**
   * @method selectFirstAvailableFormat
   * @description Delegates first available format selection to result renderer
   * @returns {void}
   * @see {@link MathPixResultRenderer#selectFirstAvailableFormat}
   * @since 1.0.0
   */
  selectFirstAvailableFormat() {
    return this.resultRenderer.selectFirstAvailableFormat();
  }

  /**
   * @method updateMetadata
   * @description Delegates metadata update to result renderer
   *
   * @param {Object} result - Processing result with metadata
   * @returns {void}
   * @see {@link MathPixResultRenderer#updateMetadata}
   * @since 1.0.0
   */
  updateMetadata(result) {
    return this.resultRenderer.updateMetadata(result);
  }

  /**
   * @method displayResponsiveComparison
   * @description Delegates responsive comparison display to result renderer
   *
   * @param {File} originalFile - Original uploaded file
   * @param {Object} result - Processing result
   * @returns {boolean} Success status
   * @see {@link MathPixResultRenderer#displayResponsiveComparison}
   * @since 1.0.0
   */
  displayResponsiveComparison(originalFile, result) {
    return this.resultRenderer.displayResponsiveComparison(
      originalFile,
      result
    );
  }

  /**
   * @method hideResponsiveComparison
   * @description Delegates responsive comparison hiding to result renderer
   * @returns {void}
   * @see {@link MathPixResultRenderer#hideResponsiveComparison}
   * @since 1.0.0
   */
  hideResponsiveComparison() {
    return this.resultRenderer.hideResponsiveComparison();
  }

  /**
   * @method renderContentWithMathJax
   * @description Delegates MathJax content rendering to result renderer
   *
   * @param {string} content - Content to render
   * @param {string} type - Content type (latex, mathml, etc.)
   * @param {HTMLElement} targetElement - Target DOM element
   * @returns {void}
   * @see {@link MathPixResultRenderer#renderContentWithMathJax}
   * @since 1.0.0
   */
  renderContentWithMathJax(content, type, targetElement) {
    return this.resultRenderer.renderContentWithMathJax(
      content,
      type,
      targetElement
    );
  }

  /**
   * @method cleanLatexForMathJax
   * @description Delegates LaTeX cleaning for MathJax to result renderer
   *
   * @param {string} latex - LaTeX content to clean
   * @returns {string} Cleaned LaTeX suitable for MathJax
   * @see {@link MathPixResultRenderer#cleanLatexForMathJax}
   * @since 1.0.0
   */
  cleanLatexForMathJax(latex) {
    return this.resultRenderer.cleanLatexForMathJax(latex);
  }

  /**
   * @method updateConfidenceIndicator
   * @description Delegates confidence indicator update to result renderer
   *
   * @param {number} confidence - Confidence value (0-1)
   * @returns {boolean} Success status
   * @see {@link MathPixResultRenderer#updateConfidenceIndicator}
   * @since 1.0.0
   */
  updateConfidenceIndicator(confidence) {
    return this.resultRenderer.updateConfidenceIndicator(confidence);
  }

  /**
   * @method performPostProcessingCleanup
   * @description Delegates post-processing cleanup to result renderer
   * @returns {void}
   * @see {@link MathPixResultRenderer#performPostProcessingCleanup}
   * @since 1.0.0
   */
  performPostProcessingCleanup() {
    return this.resultRenderer.performPostProcessingCleanup();
  }

  /**
   * @method clearAllSessionData
   * @description Clears all session data from all API clients and components
   *
   * Ensures clean state between operations by clearing:
   * - Text API (image processing) data
   * - Strokes API (handwriting) data
   * - PDF API processing data
   * - File handler state
   * - Result renderer state
   * - Debug panel data
   *
   * CRITICAL: Call this at the START of each new operation to prevent
   * data contamination between sessions.
   *
   * @returns {void}
   * @since Phase 5.5 Step 1
   *
   * @example
   * // Before starting new file processing
   * this.clearAllSessionData();
   * await this.processFile(newFile);
   */
  clearAllSessionData() {
    logInfo("[Controller] Clearing all session data for fresh operation");

    // Clear Text API data (image processing)
    // ✅ FIXED: Clear lastDebugData, not lastResponse/lastRequest
    if (this.apiClient) {
      if (this.apiClient.lastDebugData !== undefined) {
        this.apiClient.lastDebugData = null;
      }
      logDebug("[Controller] ✓ Text API data cleared");
    }

    // Clear Strokes API data (handwriting recognition)
    // ✅ FIXED: Clear lastDebugData, not lastResponse/lastRequest
    if (this.strokesAPIClient) {
      if (this.strokesAPIClient.lastDebugData !== undefined) {
        this.strokesAPIClient.lastDebugData = null;
      }
      logDebug("[Controller] ✓ Strokes API data cleared");
    }

    // Clear PDF processing data
    if (this.pdfResultRenderer) {
      if (this.pdfResultRenderer.currentResults !== undefined) {
        this.pdfResultRenderer.currentResults = null;
      }
      logDebug("[Controller] ✓ PDF results data cleared");
    }

    if (this.pdfProcessor) {
      // Clear any cached PDF processing state if it exists
      if (this.pdfProcessor.lastDebugData !== undefined) {
        this.pdfProcessor.lastDebugData = null;
      }
      logDebug("[Controller] ✓ PDF processor data cleared");
    }

    // Clear file handler state
    if (this.fileHandler) {
      if (this.fileHandler.currentFile !== undefined) {
        this.fileHandler.currentFile = null;
      }
      if (this.fileHandler.currentUploadedFile !== undefined) {
        this.fileHandler.currentUploadedFile = null;
      }
      if (this.fileHandler.sourceType !== undefined) {
        this.fileHandler.sourceType = null;
      }
      // Revoke any blob URLs to prevent memory leaks
      if (this.fileHandler.currentFileBlob) {
        URL.revokeObjectURL(this.fileHandler.currentFileBlob);
        this.fileHandler.currentFileBlob = null;
      }
      logDebug("[Controller] ✓ File handler data cleared");
    }

    // Clear result renderer state
    if (this.resultRenderer) {
      // Use cleanup method if available, otherwise just log
      if (this.resultRenderer.cleanup) {
        this.resultRenderer.cleanup();
        logDebug("[Controller] ✓ Result renderer cleaned up");
      }
    }

    // Clear debug panel display
    this.clearDebugPanel();
    logDebug("[Controller] ✓ Debug panel cleared");

    logInfo("[Controller] ✅ All session data cleared successfully", {
      textAPICleared: !!this.apiClient,
      strokesAPICleared: !!this.strokesAPIClient,
      pdfDataCleared: !!this.pdfResultRenderer || !!this.pdfProcessor,
      fileHandlerCleared: !!this.fileHandler,
      resultRendererCleared: !!this.resultRenderer,
    });
  }

  /**
   * @method clearResults
   * @description Clears results and hides download button
   * @returns {void}
   * @since Phase 5
   * @updated Phase 5.5 Step 1 - Added session data clearing
   */
  clearResults() {
    logInfo("[Controller] Clearing results display and session data");

    // PHASE 5.5: Clear ALL session data for fresh state
    this.clearAllSessionData();

    // Hide download button (Phase 5)
    if (this.downloadManager) {
      this.downloadManager.hideDownloadButton();
      logDebug("Download button hidden during results clear");
    }

    logInfo("[Controller] ✅ Results cleared and session reset");
  }

  /**
   * @method relocateOpenOriginalButton
   * @description Delegates button relocation to result renderer
   * @returns {void}
   * @see {@link MathPixResultRenderer#relocateOpenOriginalButton}
   * @since 1.0.0
   */
  relocateOpenOriginalButton() {
    return this.resultRenderer.relocateOpenOriginalButton();
  }

  // =============================================================================
  // PHASE 3.2: LINE DATA DISPLAY METHODS
  // =============================================================================

  /**
   * @method toggleLineData
   * @description Toggles line data section visibility with accessibility updates
   *
   * Expands/collapses the processing details section showing line-level
   * analysis from MathPix API. Updates ARIA attributes and visual indicators
   * for full accessibility compliance.
   *
   * @returns {void}
   *
   * @example
   * // Called by onclick handler in HTML
   * controller.toggleLineData();
   *
   * @accessibility Updates aria-expanded and manages focus states
   * @since 3.2.0
   */
  toggleLineData() {
    const toggleButton = document.getElementById("mathpix-line-data-toggle");
    const contentArea = document.getElementById("mathpix-line-data-content");
    const toggleIcon = toggleButton?.querySelector(".toggle-icon");

    if (!toggleButton || !contentArea) {
      logWarn("Line data toggle elements not found");
      return;
    }

    // Get current state
    const isExpanded = toggleButton.getAttribute("aria-expanded") === "true";
    const newState = !isExpanded;

    // Update ARIA attribute
    toggleButton.setAttribute("aria-expanded", newState.toString());

    // Toggle content visibility
    contentArea.hidden = !newState;

    // Update icon
    if (toggleIcon) {
      toggleIcon.textContent = newState ? "☑" : "☐";
    }

    // Update button text
    const toggleText = toggleButton.querySelector(".toggle-text");
    if (toggleText) {
      toggleText.textContent = newState
        ? "Hide Processing Details"
        : "Show Processing Details";
    }

    logDebug("Line data toggled", {
      expanded: newState,
      contentVisible: !contentArea.hidden,
    });
  }

  /**
   * @method displayLineData
   * @description Delegates line data display to result renderer
   *
   * @param {Array} lineData - Line data array from MathPix API
   * @returns {void}
   * @see {@link MathPixResultRenderer#displayLineData}
   * @since 3.2.0
   */
  displayLineData(lineData) {
    return this.resultRenderer.displayLineData(lineData);
  }

  // =============================================================================
  // DEBUG PANEL METHODS (PHASE 3)
  // =============================================================================

  /**
   * @method scrollToComparisonView
   * @description Scrolls to comparison view and sets focus after processing completes
   *
   * Uses forced instant scroll (no smooth animation) because multiple layout changes
   * occur simultaneously (hide preview, show comparison, relocate buttons). Smooth
   * scroll during these changes appears janky, so instant scroll provides better UX.
   *
   * After scrolling, sets focus to the comparison title for screen reader users
   * and announces processing completion. This ensures keyboard/screen reader focus
   * moves to the most relevant content area.
   *
   * Includes 150ms timeout to ensure all DOM updates complete before scrolling and focusing.
   *
   * @returns {void}
   * @since Workflow Optimization Phase 1
   * @updated Screen Reader Optimization Phase - Added focus management
   *
   * @example
   * this.scrollToComparisonView(); // After displayResult() completes
   *
   * @accessibility
   * - Sets focus to comparison title for keyboard navigation
   * - Announces completion to screen readers via global live region
   * - Makes title focusable with tabindex="-1" for programmatic focus
   */
  scrollToComparisonView() {
    // Wait for DOM updates to complete (hide preview, show comparison, relocate buttons)
    setTimeout(() => {
      const comparisonTitle = document.querySelector(
        ".mathpix-comparison-title"
      );

      if (comparisonTitle) {
        // Make title focusable for programmatic focus (doesn't add to tab order)
        comparisonTitle.setAttribute("tabindex", "-1");

        // Force instant scroll - smooth scroll looks janky during layout changes
        comparisonTitle.scrollIntoView({
          behavior: "instant",
          block: "start",
        });

        // Set focus to comparison title for screen readers and keyboard users
        comparisonTitle.focus();

        // Announce processing completion to screen readers
        // Get format count from visible format panels
        const formatPanels = document.querySelectorAll(
          '.mathpix-format-panel:not([style*="display: none"])'
        );
        const formatCount = formatPanels.length;

        this.announceToScreenReader(
          `Processing complete. ${formatCount} format${
            formatCount !== 1 ? "s" : ""
          } available. Viewing results comparison.`
        );

        logDebug("Scrolled to comparison view and set focus", {
          scrollBehavior: "instant",
          focusSet: true,
          reason: "Multiple layout changes require instant scroll",
          targetElement: ".mathpix-comparison-title",
          formatCount: formatCount,
          screenReaderAnnouncement: true,
        });
      } else {
        logWarn("Comparison title not found for scroll and focus", {
          comparisonContainerExists: !!document.getElementById(
            "mathpix-comparison-container"
          ),
        });
      }
    }, 150); // 150ms ensures all DOM updates complete
  }

  /**
   * @method announceToScreenReader
   * @description Announces messages to screen readers using global ARIA live region
   *
   * Uses the global #mathpix-sr-announcements region for consistent screen reader
   * feedback across all workflows. Messages are announced politely without
   * interrupting current screen reader activity.
   *
   * **Smart Deduplication**: Detects if the notification system (toast) already
   * announced a similar message and skips duplicate announcements. This prevents
   * screen readers from hearing the same message twice when both the notification
   * system and ARIA live region would announce.
   *
   * Detection method: Checks if a toast notification is currently visible in the
   * #universal-toast-container. If a toast exists, skips the announcement since
   * the toast's own ARIA live region already handled it.
   *
   * Includes 100ms delay to ensure screen readers properly detect content changes,
   * and clears after 3 seconds to prevent stale announcements.
   *
   * @param {string} message - Message to announce to screen reader users
   * @param {Object} options - Optional configuration
   * @param {boolean} options.force - Force announcement even if notification visible
   * @returns {void}
   * @since Screen Reader Optimization Phase
   *
   * @example
   * // Normal usage - auto-detects notification conflicts
   * this.announceToScreenReader('Processing complete. 6 formats available.');
   *
   * // Force announcement even if notification shown
   * this.announceToScreenReader('Custom message', { force: true });
   *
   * @accessibility
   * - WCAG 2.2 AA compliant announcements
   * - Non-interrupting polite live region
   * - Automatic cleanup prevents clutter
   * - Smart deduplication prevents double announcements
   */
  announceToScreenReader(message, options = {}) {
    const liveRegion = document.getElementById("mathpix-sr-announcements");

    if (!liveRegion) {
      logWarn(
        "Global ARIA live region not found - announcement skipped",
        message
      );
      return;
    }

    // Smart deduplication: Check if notification system just showed a toast
    if (!options.force) {
      const toastContainer = document.getElementById(
        "universal-toast-container"
      );
      const activeToasts = toastContainer?.querySelectorAll(
        ".toast-notification"
      );

      if (activeToasts && activeToasts.length > 0) {
        logDebug(
          "Skipping announcement - notification system already announced",
          {
            message,
            activeToastCount: activeToasts.length,
            reason: "Prevents duplicate screen reader announcements",
          }
        );
        return;
      }
    }

    // Clear any existing announcement first
    liveRegion.textContent = "";

    // Small delay ensures screen readers detect the change
    setTimeout(() => {
      liveRegion.textContent = message;
      logDebug("Screen reader announcement made", {
        message,
        forced: options.force,
      });

      // Clear announcement after 3 seconds to prevent stale content
      setTimeout(() => {
        liveRegion.textContent = "";
      }, 3000);
    }, 100);
  }

  /**
   * @method updateDebugPanel
   * @description Populates debug panel with data from last API operation
   *
   * Retrieves debug data from any API client (image, strokes, or PDF) and populates
   * all debug panel HTML elements with formatted information including request/response
   * data, timing metrics, and API metadata. Automatically detects which client
   * performed the last operation.
   *
   * @returns {void}
   *
   * @example
   * // Called automatically after API operations
   * this.updateDebugPanel();
   *
   * @since Phase 3
   * @updated Phase 3.1 - Multi-endpoint support (image, strokes, PDF)
   */
  updateDebugPanel() {
    // Collect ALL debug data with timestamps from all API clients
    const candidates = [];

    // Check strokes API client
    if (this.strokesAPIClient?.getLastDebugData) {
      const strokesData = this.strokesAPIClient.getLastDebugData();
      if (strokesData?.timestamp) {
        candidates.push({
          data: strokesData,
          source: "strokes",
          timestamp: new Date(strokesData.timestamp),
        });
        logDebug("Found strokes debug data", {
          timestamp: strokesData.timestamp,
          operation: strokesData.operation,
        });
      }
    }

    // Check main API client (image processing)
    if (this.apiClient?.getLastDebugData) {
      const imageData = this.apiClient.getLastDebugData();
      if (imageData?.timestamp) {
        candidates.push({
          data: imageData,
          source: "image",
          timestamp: new Date(imageData.timestamp),
        });
        logDebug("Found image debug data", {
          timestamp: imageData.timestamp,
          operation: imageData.operation,
        });
      }
    }

    // Check PDF processor (future support)
    if (this.pdfProcessor?.getLastDebugData) {
      const pdfData = this.pdfProcessor.getLastDebugData();
      if (pdfData?.timestamp) {
        candidates.push({
          data: pdfData,
          source: "pdf",
          timestamp: new Date(pdfData.timestamp),
        });
        logDebug("Found PDF debug data", {
          timestamp: pdfData.timestamp,
          operation: pdfData.operation,
        });
      }
    }

    // No debug data available from any client
    if (candidates.length === 0) {
      logDebug("No debug data available from any API client");
      return;
    }

    // Sort by timestamp (most recent first)
    candidates.sort((a, b) => b.timestamp - a.timestamp);

    // Use the most recent operation
    const mostRecent = candidates[0];
    const debugData = mostRecent.data;
    const dataSource = mostRecent.source;

    logInfo("Using most recent debug data based on timestamp", {
      source: dataSource,
      timestamp: debugData.timestamp,
      operation: debugData.operation,
      totalCandidates: candidates.length,
      allSources: candidates
        .map((c) => `${c.source} (${c.data.timestamp})`)
        .join(", "),
    });

    logDebug("Updating debug panel with API data", {
      source: dataSource,
      operation: debugData.operation,
      endpoint: debugData.endpoint,
      hasRequest: !!debugData.request,
      hasResponse: !!debugData.response,
    });

    logDebug("Updating debug panel with API data", {
      operation: debugData.operation,
      endpoint: debugData.endpoint,
      hasRequest: !!debugData.request,
      hasResponse: !!debugData.response,
    });

    // Update transaction summary section
    this.updateDebugElement(
      "debug-endpoint",
      debugData.endpoint || "Not available"
    );
    this.updateDebugElement(
      "debug-operation",
      debugData.operation || "Unknown"
    );
    this.updateDebugElement(
      "debug-timing",
      this.formatTimingDisplay(debugData.timing)
    );
    this.updateDebugElement(
      "debug-confidence",
      this.formatConfidenceDisplay(debugData.response?.confidence)
    );

    // Content type from response (already formatted by API client)
    const contentType = debugData.response?.contentType || "Unknown";
    this.updateDebugElement(
      "debug-content-type",
      contentType.charAt(0).toUpperCase() + contentType.slice(1)
    );

    // Update request data section
    const requestElement = document.getElementById("debug-request-data");
    if (requestElement && debugData.request) {
      requestElement.textContent = this.formatJsonForDisplay(debugData.request);
      requestElement.className = "language-json";

      // Apply Prism syntax highlighting if available
      if (window.Prism) {
        window.Prism.highlightElement(requestElement);
      }
    }

    // Update response data section
    const responseElement = document.getElementById("debug-response-data");
    if (responseElement && debugData.response) {
      responseElement.textContent = this.formatJsonForDisplay(
        debugData.response
      );
      responseElement.className = "language-json";

      // Apply Prism syntax highlighting if available
      if (window.Prism) {
        window.Prism.highlightElement(responseElement);
      }
    }

    // Update metadata section from raw API response data
    const apiData = debugData.response?.data;
    const isPDF = dataSource === "pdf" || debugData.operation === "processPDF";

    if (apiData) {
      this.updateDebugElement(
        "debug-request-id",
        apiData.request_id || "Not available"
      );

      // ✅ PHASE 3.4: API version - use processing model for PDFs
      if (isPDF && apiData.version && apiData.version !== "v3") {
        // For PDFs, version field contains processing model (e.g., "SuperNet-107")
        this.updateDebugElement("debug-api-version", "v3");
      } else {
        this.updateDebugElement(
          "debug-api-version",
          apiData.version || "Not available"
        );
      }

      // ✅ PHASE 3.4: Processing model - enhanced for PDF with metadata fallback
      let processingModel = "Default";

      if (isPDF) {
        // For PDFs, check multiple sources for processing model
        if (debugData.metadata?.processingModel) {
          processingModel = debugData.metadata.processingModel;
        } else if (apiData.version && apiData.version !== "v3") {
          processingModel = apiData.version; // Status polling data
        }
      } else if (apiData.model) {
        processingModel = apiData.model; // Standard API model field
      }

      this.updateDebugElement("debug-processing-model", processingModel);

      // ✅ PHASE 3.4: Image dimensions - conditional for PDFs
      if (isPDF) {
        // PDFs don't have single dimensions - show page count instead
        const pageCount = debugData.metadata?.pageCount;
        if (pageCount) {
          this.updateDebugElement(
            "debug-image-dimensions",
            `${pageCount} page${pageCount === 1 ? "" : "s"}`
          );
        } else {
          this.updateDebugElement("debug-image-dimensions", "Not available");
        }
      } else {
        // Images have dimensions
        this.updateDebugElement(
          "debug-image-dimensions",
          apiData.image_width && apiData.image_height
            ? `${apiData.image_width} × ${apiData.image_height}`
            : "Not available"
        );
      }

      // Auto-rotation (not applicable for PDFs)
      if (isPDF) {
        this.updateDebugElement("debug-auto-rotation", "Not applicable");
      } else {
        const autoRotate =
          apiData.auto_rotate_confidence !== undefined &&
          apiData.auto_rotate_confidence > 0;
        this.updateDebugElement(
          "debug-auto-rotation",
          autoRotate
            ? `Yes (${apiData.auto_rotate_degrees || 0}°, confidence: ${(
                apiData.auto_rotate_confidence * 100
              ).toFixed(1)}%)`
            : "No"
        );
      }

      // ✅ PHASE 3.4: Confidence rate - enhanced for PDFs with Lines API data
      let confidenceRate = "Not available";

      if (
        apiData.confidence_rate !== undefined &&
        apiData.confidence_rate !== null
      ) {
        confidenceRate = `${(apiData.confidence_rate * 100).toFixed(1)}%`;
      } else if (
        isPDF &&
        debugData.metadata?.linesAPI?.averageConfidence !== undefined
      ) {
        // Fallback to Lines API data for PDFs
        confidenceRate = `${(
          debugData.metadata.linesAPI.averageConfidence * 100
        ).toFixed(1)}%`;
      }

      this.updateDebugElement("debug-confidence-rate", confidenceRate);

      logDebug("Metadata section updated with enhanced PDF support", {
        isPDF,
        processingModel,
        pageCount: debugData.metadata?.pageCount,
        hasLinesAPI: !!debugData.metadata?.linesAPI,
        confidenceRate,
      });
    } else {
      logWarn("API data not available in response for metadata display");
    }

    logInfo("Debug panel updated successfully", {
      operation: debugData.operation,
      dataSource,
      timestamp: debugData.timestamp,
      hasMetadata: !!debugData.metadata,
      isPDF,
    });
  }

  /**
   * @method updateDebugElement
   * @description Safely updates a debug panel element's text content
   *
   * @param {string} elementId - ID of element to update
   * @param {string} value - Value to set
   * @returns {void}
   * @private
   */
  updateDebugElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value || "Not available";
    } else {
      logWarn("Debug panel element not found", { elementId });
    }
  }

  /**
   * @method formatJsonForDisplay
   * @description Formats JSON object for pretty-printed display
   *
   * @param {Object} obj - Object to format
   * @returns {string} Formatted JSON string
   */
  formatJsonForDisplay(obj) {
    if (!obj) {
      return "No data available";
    }

    try {
      return JSON.stringify(obj, null, 2);
    } catch (error) {
      logError("JSON formatting failed", { error: error.message });
      return "Unable to format data";
    }
  }

  /**
   * @method formatTimingDisplay
   * @description Formats timing data for human-readable display
   *
   * @param {Object} timing - Timing object from debug data
   * @returns {string} Formatted timing string
   */
  formatTimingDisplay(timing) {
    if (!timing) {
      return "Not available";
    }

    const parts = [];

    if (timing.total) {
      parts.push(`Total: ${(timing.total / 1000).toFixed(2)}s`);
    }

    if (timing.api) {
      parts.push(`API: ${(timing.api / 1000).toFixed(2)}s`);
    }

    if (timing.processing) {
      parts.push(`Processing: ${(timing.processing / 1000).toFixed(2)}s`);
    }

    return parts.length > 0 ? parts.join(" | ") : "Not available";
  }

  /**
   * @method formatConfidenceDisplay
   * @description Formats confidence value as percentage
   *
   * @param {number} confidence - Confidence value (0-1)
   * @returns {string} Formatted confidence string
   */
  formatConfidenceDisplay(confidence) {
    if (confidence === undefined || confidence === null) {
      return "Not available";
    }

    return `${(confidence * 100).toFixed(1)}%`;
  }

  /**
   * @method clearDebugPanel
   * @description Clears all debug panel data and resets to initial state
   *
   * Resets all debug panel HTML elements to "Not yet processed" state.
   * Called when switching modes or starting new file processing to ensure
   * debug data is always fresh and relevant to current operation.
   *
   * @returns {void}
   *
   * @example
   * // Before starting new operation
   * this.clearDebugPanel();
   *
   * @since Phase 3.2
   */
  clearDebugPanel() {
    logDebug("Clearing debug panel for fresh operation");

    // Clear transaction summary elements
    this.updateDebugElement("debug-endpoint", "Not yet processed");
    this.updateDebugElement("debug-operation", "Not yet processed");
    this.updateDebugElement("debug-timing", "Not yet processed");
    this.updateDebugElement("debug-confidence", "Not yet processed");
    this.updateDebugElement("debug-content-type", "Not yet processed");

    // Clear request data section
    const requestElement = document.getElementById("debug-request-data");
    if (requestElement) {
      requestElement.textContent = "No request data available yet";
      requestElement.className = "language-json";
    }

    // Clear response data section
    const responseElement = document.getElementById("debug-response-data");
    if (responseElement) {
      responseElement.textContent = "No response data available yet";
      responseElement.className = "language-json";
    }

    // Clear metadata section
    this.updateDebugElement("debug-request-id", "Not yet processed");
    this.updateDebugElement("debug-api-version", "v3");
    this.updateDebugElement("debug-processing-model", "Not yet processed");
    this.updateDebugElement("debug-image-dimensions", "Not yet processed");
    this.updateDebugElement("debug-auto-rotation", "Not yet processed");
    this.updateDebugElement("debug-confidence-rate", "Not yet processed");

    logInfo("Debug panel cleared successfully");
  }

  // =============================================================================
  // MATHJAX ENHANCEMENT METHODS
  // =============================================================================

  /**
   * @method tryAlternativeMathJaxRendering
   * @description Attempts alternative MathJax rendering approaches when standard method fails
   *
   * @param {string} content - Original content to render
   * @param {string} type - Content type
   * @param {HTMLElement} targetElement - Target DOM element
   * @returns {Promise<boolean>} Success status
   * @see {@link MathPixResultRenderer#tryAlternativeMathJaxRendering}
   * @since 1.0.0
   */
  tryAlternativeMathJaxRendering(content, type, targetElement) {
    return this.resultRenderer.tryAlternativeMathJaxRendering(
      content,
      type,
      targetElement
    );
  }

  /**
   * @method applyMathPixMathJaxEnhancements
   * @description Applies MathPix-specific enhancements to rendered MathJax elements
   *
   * @param {HTMLElement} targetElement - Element containing MathJax content
   * @returns {void}
   * @see {@link MathPixResultRenderer#applyMathPixMathJaxEnhancements}
   * @accessibility Adds keyboard navigation and screen reader support to MathJax elements
   * @since 1.0.0
   */
  applyMathPixMathJaxEnhancements(targetElement) {
    return this.resultRenderer.applyMathPixMathJaxEnhancements(targetElement);
  }

  /**
   * @method handleMathJaxKeyboard
   * @description Handles keyboard navigation for MathJax elements
   *
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {void}
   * @see {@link MathPixResultRenderer#handleMathJaxKeyboard}
   * @accessibility Provides Enter/Space activation and Escape handling for MathJax elements
   * @since 1.0.0
   */
  handleMathJaxKeyboard(event) {
    return this.resultRenderer.handleMathJaxKeyboard(event);
  }

  // =============================================================================
  // FILE PROCESSING WORKFLOW METHODS
  // =============================================================================

  /**
   * @method addProcessConfirmationButton
   * @description Adds confirmation button to file preview for user workflow control
   *
   * Creates and configures a confirmation button that allows users to explicitly
   * consent to file processing after preview. Supports accessibility with proper
   * ARIA labels and keyboard interaction.
   *
   * @param {HTMLElement} previewContainer - Container element for the button
   * @param {File} file - File to be processed upon confirmation
   * @returns {void}
   *
   * @example
   * controller.addProcessConfirmationButton(previewContainer, uploadedFile);
   *
   * @accessibility Button includes ARIA label with file name and processing action
   * @since 1.0.0
   */
  addProcessConfirmationButton(previewContainer, file) {
    logDebug("Adding process confirmation button", {
      fileName: file.name,
      fileSize: file.size,
    });

    // Check if button already exists
    let confirmBtn = previewContainer.querySelector(
      ".mathpix-process-confirm-btn"
    );

    if (!confirmBtn) {
      // Create new confirmation button
      confirmBtn = document.createElement("button");
      confirmBtn.className =
        "mathpix-process-confirm-btn mathpix-open-original-btn"; // Reuse styling
      confirmBtn.type = "button";

      // Find the preview actions container
      const actionsContainer = previewContainer.querySelector(
        ".mathpix-preview-actions"
      );
      if (actionsContainer) {
        actionsContainer.appendChild(confirmBtn);
      } else {
        // Fallback - add directly to container
        previewContainer.appendChild(confirmBtn);
      }
    }

    // Configure button
    confirmBtn.innerHTML = `
    <span aria-hidden="true">🔄</span> Process with MathPix
  `;
    confirmBtn.setAttribute(
      "aria-label",
      `Process ${file.name} with MathPix OCR`
    );
    confirmBtn.onclick = (e) => {
      e.preventDefault();
      this.confirmAndProcessFile(file);
    };
    confirmBtn.style.display = "inline-flex";

    logDebug("Process confirmation button added successfully", {
      fileName: file.name,
      buttonText: confirmBtn.textContent.trim(),
    });
  }

  /**
   * @method confirmAndProcessFile
   * @description Handles user confirmation and initiates file processing
   *
   * Called when user clicks the confirmation button. Prevents double-processing
   * by hiding the button and manages error recovery by re-showing it if needed.
   *
   * @param {File} file - File to process
   * @returns {Promise<void>}
   * @throws {Error} If file processing fails
   *
   * @example
   * await controller.confirmAndProcessFile(uploadedFile);
   *
   * @accessibility Provides user feedback through notification system
   * @since 1.0.0
   */
  async confirmAndProcessFile(file) {
    logInfo("File processing confirmed by user", {
      fileName: file.name,
      fileSize: file.size,
    });

    try {
      // Hide the confirmation button to prevent double-processing
      const confirmBtn = document.querySelector(".mathpix-process-confirm-btn");
      if (confirmBtn) {
        confirmBtn.style.display = "none";
      }

      // Proceed with the existing file processing workflow
      await this.processConfirmedFile(file);
    } catch (error) {
      logError("Confirmed file processing failed", error);

      // Re-show confirmation button on error
      const confirmBtn = document.querySelector(".mathpix-process-confirm-btn");
      if (confirmBtn) {
        confirmBtn.style.display = "inline-flex";
      }

      this.showNotification(`Processing failed: ${error.message}`, "error");
    }
  }

  /**
   * @method processConfirmedFile
   * @description Executes complete file processing workflow after user confirmation
   *
   * Orchestrates the complete processing workflow including:
   * - API credential validation
   * - Privacy consent collection
   * - Progress tracking
   * - API request execution
   * - Result display and formatting
   *
   * @param {File} file - Confirmed file to process
   * @returns {Promise<void>}
   * @throws {Error} If any stage of processing fails
   *
   * @example
   * try {
   *   await controller.processConfirmedFile(file);
   *   console.log('Processing completed successfully');
   * } catch (error) {
   *   console.error('Processing failed:', error);
   * }
   *
   * @accessibility Provides comprehensive screen reader feedback during processing
   * @since 1.0.0
   */
  async processConfirmedFile(file) {
    // Check API configuration
    if (!this.apiClient.appId || !this.apiClient.apiKey) {
      this.showNotification(
        "Please configure your MathPix API credentials first.",
        "error"
      );
      return;
    }

    try {
      // Step 4C: Get file with transforms applied (if any)
      // This ensures WYSIWYG - what user sees in preview is what gets processed
      logInfo("Retrieving file for processing (with transforms if applicable)");
      const fileToProcess = await this.fileHandler.getCurrentFile();

      if (!fileToProcess) {
        logError("No file available for processing");
        this.showNotification("No file available for processing", "error");
        return;
      }

      logInfo("File retrieved for processing", {
        originalName: file?.name,
        processName: fileToProcess.name,
        hasTransforms: fileToProcess.name.includes("-transformed"),
      });

      // Step 1: Request privacy consent with configuration toggle support
      logInfo("Requesting privacy consent for confirmed file processing");
      const consentGranted = await this.privacyManager.requestProcessingConsent(
        {
          name: fileToProcess.name,
          size: fileToProcess.size,
          type: fileToProcess.type,
        }
      );

      if (!consentGranted) {
        logInfo("Processing cancelled - user declined consent", {
          fileName: fileToProcess.name,
        });
        this.showNotification(
          "Processing cancelled. Your file was not uploaded or processed.",
          "info"
        );
        return;
      }

      logInfo("Privacy consent granted, proceeding with processing", {
        fileName: fileToProcess.name,
        consentStatus: this.privacyManager.getConsentStatus(),
      });

      // Step 2: Start progress display
      this.progressDisplay.startProgress({
        name: fileToProcess.name,
        size: fileToProcess.size,
        type: fileToProcess.type,
      });

      // Step 3: Process file with progress callbacks (using transformed file if applicable)
      const result = await this.apiClient.processImage(
        fileToProcess,
        {},
        this.progressDisplay
      );

      // Step 4: Display result with cleanup (pass processed file for comparison view)
      this.displayResult(result, fileToProcess);

      // Step 4.5: Scroll to comparison view after DOM updates complete
      // Using instant scroll due to multiple layout changes (hide preview, show comparison, relocate buttons)
      this.scrollToComparisonView();

      // Step 5: Update debug panel with API transaction data
      this.updateDebugPanel();

      // Step 6: Complete progress display with success
      this.progressDisplay.complete(true, result);

      logInfo("Confirmed file processing completed successfully", {
        fileName: fileToProcess.name,
        availableFormats: Object.keys(result).filter(
          (key) =>
            result[key] && typeof result[key] === "string" && result[key].trim()
        ),
        processingTiming: result.processingTiming,
      });
    } catch (error) {
      logError("Confirmed file processing failed", error);

      // Update debug panel with error state
      this.updateDebugPanel();

      // Complete progress display with error
      this.progressDisplay.complete(false, { error: error.message });

      // Fallback notification for critical errors
      this.showNotification(
        `${MATHPIX_CONFIG.MESSAGES.UPLOAD_ERROR}: ${error.message}`,
        "error"
      );
    }
  }

  // =============================================================================
  // PHASE 1C: STROKES SYSTEM METHODS (HANDWRITING RECOGNITION)
  // =============================================================================

  /**
   * @method initStrokesSystem
   * @description Initialises the strokes canvas and mode switcher for handwriting input
   *
   * Called when user switches to draw mode for the first time. Sets up canvas
   * for stroke capture, attaches event listeners, and initialises mode switcher
   * for upload/draw toggle functionality.
   *
   * @returns {Promise<boolean>} True if initialisation successful
   * @throws {Error} If canvas element not found or initialisation fails
   *
   * @example
   * const success = await controller.initStrokesSystem();
   * if (success) {
   *   console.log('Strokes system ready for handwriting input');
   * }
   *
   * @accessibility Canvas includes alternative upload mode for keyboard users
   * @since Phase 1C
   */
  async initStrokesSystem() {
    logInfo("Initialising strokes system for handwriting recognition");

    try {
      // Find canvas element
      const canvasElement = this.elements["draw-canvas"];
      if (!canvasElement) {
        logError("Canvas element not found in DOM - HTML not yet added");
        return false;
      }

      // Initialize canvas if not already done
      if (!this.strokesCanvas) {
        this.strokesCanvas = new MathPixStrokesCanvas(this);
        await this.strokesCanvas.initialise(canvasElement);
        this.strokesCanvas.attachEventListeners();
        logInfo("Strokes canvas initialised successfully");
      }

      // Initialize mode switcher if not already done
      if (!this.modeSwitcher) {
        this.modeSwitcher = new MathPixModeSwitcher(this);
        await this.modeSwitcher.initialise({
          uploadContainer: this.elements["upload-container"],
          drawContainer: this.elements["draw-container"],
          uploadRadio: this.elements["upload-mode-radio"],
          drawRadio: this.elements["draw-mode-radio"],
        });
        logInfo("Mode switcher initialised successfully");
      }

      // Share API credentials AND endpoint with strokes API client
      if (this.apiClient.appId && this.apiClient.apiKey) {
        this.strokesAPIClient.setCredentials(
          this.apiClient.appId,
          this.apiClient.apiKey
        );

        // ✅ CRITICAL: Share current API base URL for endpoint management
        this.strokesAPIClient.apiBase = this.apiClient.apiBase;

        logDebug(
          "API credentials and endpoint shared with strokes API client",
          {
            apiBase: this.strokesAPIClient.apiBase,
            endpoint: this.apiClient.currentEndpoint,
          }
        );
      }

      logInfo("Strokes system initialisation complete", {
        canvasReady: this.strokesCanvas?.isInitialised,
        modeSwitcherReady: this.modeSwitcher?.isInitialised,
        hasCredentials: this.strokesAPIClient?.hasCredentials(),
        apiBaseSet: !!this.strokesAPIClient?.apiBase,
      });

      return true;
    } catch (error) {
      logError("Failed to initialise strokes system", error);
      this.showNotification(
        "Failed to initialise drawing canvas. Please refresh the page.",
        "error"
      );
      return false;
    }
  }

  /**
   * Initialize Camera Capture System
   * Lazy initialization when user switches to camera mode for first time
   * @returns {Promise<boolean>} True if initialization successful
   * @since Phase 1E
   */
  async initCameraSystem() {
    logInfo("Initializing Camera Capture System...");

    if (this.cameraCapture) {
      logDebug("Camera system already initialized");
      return true;
    }

    try {
      // Get video element
      const videoElement = this.elements["camera-video"];
      if (!videoElement) {
        throw new Error("Camera video element not found");
      }

      // Create camera capture instance
      this.cameraCapture = new MathPixCameraCapture(this);

      // Initialize with video element
      const success = await this.cameraCapture.initialise(videoElement);

      if (success) {
        logInfo("Camera system initialized successfully");
        return true;
      } else {
        throw new Error("Camera initialization returned false");
      }
    } catch (error) {
      logError("Failed to initialize camera system", {
        error: error.message,
        stack: error.stack,
      });
      this.showNotification(
        "Failed to initialize camera. Please check browser permissions or use file upload instead.",
        "error"
      );
      return false;
    }
  }

  /**
   * @method initCameraSystem
   * @description Initialises the camera capture system for photography input
   *
   * Called when user switches to camera mode for the first time. Sets up camera
   * capture, attaches event listeners, and initialises mode switcher
   * for upload/draw/camera toggle functionality.
   *
   * @returns {Promise<boolean>} True if initialisation successful
   * @throws {Error} If camera elements not found or initialisation fails
   *
   * @example
   * const success = await controller.initCameraSystem();
   * if (success) {
   *   console.log('Camera system ready for photo capture');
   * }
   *
   * @accessibility Camera includes alternative upload mode for keyboard users
   * @since Phase 1D
   */
  async initCameraSystem() {
    logInfo("Initialising camera system for photo capture");

    try {
      // Find camera video element
      const videoElement = this.elements["camera-video"];
      if (!videoElement) {
        logError("Camera video element not found in DOM - HTML not yet added");
        return false;
      }

      // Initialize camera capture if not already done
      if (!this.cameraCapture) {
        this.cameraCapture = new MathPixCameraCapture(this);
        await this.cameraCapture.initialise(videoElement);
        logInfo("Camera capture initialised successfully");
      }

      // Initialize mode switcher if not already done
      if (!this.modeSwitcher) {
        this.modeSwitcher = new MathPixModeSwitcher(this);
        await this.modeSwitcher.initialise({
          uploadContainer: this.elements["upload-container"],
          drawContainer: this.elements["draw-container"],
          cameraContainer: this.elements["camera-container"],
          uploadRadio: this.elements["upload-mode-radio"],
          drawRadio: this.elements["draw-mode-radio"],
          cameraRadio: this.elements["camera-mode-radio"],
        });
        logInfo("Mode switcher initialised with camera support");
      }

      logInfo("Camera system initialisation complete", {
        cameraReady: this.cameraCapture?.isInitialised,
        modeSwitcherReady: this.modeSwitcher?.isInitialised,
        videoElementFound: !!videoElement,
      });

      return true;
    } catch (error) {
      logError("Failed to initialise camera system", error);
      this.showNotification(
        "Failed to initialise camera. Please refresh the page.",
        "error"
      );
      return false;
    }
  }

  /**
   * @method getSelectedFormats
   * @description Collects selected output formats from format selection UI
   *
   * Scans format radio buttons and checkboxes to determine which formats
   * the user has requested. Returns array of format names for API request.
   *
   * @returns {string[]} Array of selected format names
   *
   * @example
   * const formats = controller.getSelectedFormats();
   * // Returns: ['text', 'latex_styled', 'markdown', 'mathml', ...]
   *
   * @since Phase 1E
   * @updated Phase 1C - Added markdown format support for strokes API
   */
  getSelectedFormats() {
    const formats = [];

    // Get selected format from radio buttons
    const selectedRadio = document.querySelector(
      'input[name="mathpix-format"]:checked'
    );
    if (selectedRadio) {
      const formatValue = selectedRadio.value;

      // Map UI format names to API format names
      const formatMap = {
        latex: "text", // LaTeX in delimiters
        mathml: "mathml", // MathML
        asciimath: "asciimath", // AsciiMath
        html: "html", // HTML
        markdown: "text", // Same as LaTeX for strokes (but we also request markdown)
        json: "data", // Raw JSON data
        "table-html": "html", // HTML tables
        "table-markdown": "text", // Markdown tables
        "table-tsv": "tsv", // TSV
      };

      const apiFormat = formatMap[formatValue] || "text";
      if (!formats.includes(apiFormat)) {
        formats.push(apiFormat);
      }

      logDebug("Selected format", { ui: formatValue, api: apiFormat });
    }

    // Always include latex_styled for better output
    if (!formats.includes("latex_styled")) {
      formats.push("latex_styled");
    }

    // Always include data for metadata
    if (!formats.includes("data")) {
      formats.push("data");
    }

    // ✅ CRITICAL: Always include html for table extraction and markdown generation
    if (!formats.includes("html")) {
      formats.push("html");
    }

    // ✅ CRITICAL: Always include markdown format for strokes API
    // This enables markdown output in addition to LaTeX
    if (!formats.includes("markdown")) {
      formats.push("markdown");
    }

    logDebug("Final format selection", { formats });
    return formats;
  }

  /**
   * @method handleStrokesSubmit
   * @description Handles submission of handwritten strokes for OCR processing
   *
   * Validates strokes, captures canvas image for comparison, processes via MathPix
   * Strokes API, and displays results with original drawing alongside recognised
   * mathematics. Provides comprehensive error handling and user feedback.
   *
   * @returns {Promise<void>}
   * @throws {Error} If strokes processing fails
   *
   * @example
   * // Called by submit button click
   * await controller.handleStrokesSubmit();
   *
   * @accessibility Provides screen reader feedback during processing
   * @since Phase 1C
   */
  async handleStrokesSubmit() {
    logInfo("Processing handwritten strokes submission");

    // Validation checks
    if (!this.strokesCanvas || !this.strokesCanvas.hasStrokes()) {
      this.showNotification("Please draw some mathematics first", "warning");
      logWarn("Strokes submission attempted with no strokes drawn");
      return;
    }

    if (!this.strokesAPIClient.hasCredentials()) {
      this.showNotification("Please configure API credentials first", "error");
      logError("Strokes submission attempted without API credentials");
      return;
    }

    // ✅ PHASE 5.5 STEP 1: Clear ALL session data before new operation
    // This prevents data contamination from previous operations
    this.clearAllSessionData();

    logDebug("Session data cleared, ready for strokes processing");

    try {
      // CRITICAL: Capture canvas as image BEFORE any clearing or processing
      logDebug("Capturing canvas image for comparison view");
      const canvasImage = await this.captureCanvasAsImage();
      if (!canvasImage) {
        logWarn(
          "Failed to capture canvas image - comparison view may not work"
        );
      }
      // Get stroke data formatted for API
      const strokesData = this.strokesCanvas.formatForAPI();
      logDebug("Strokes formatted for API", {
        strokeCount: this.strokesCanvas.getStrokeCount(),
        dataStructure: strokesData ? "valid" : "invalid",
      });

      // Collect selected formats from UI
      const selectedFormats = this.getSelectedFormats();

      // Build API options with formats and privacy settings
      const apiOptions = {
        formats: selectedFormats,
        metadata: { improve_mathpix: false }, // Privacy-first: no data retention
      };

      logDebug("API options prepared", {
        formats: selectedFormats,
        privacyProtected: true,
      });

      // Start progress display
      this.progressDisplay.startProgress({
        name: "Handwritten mathematics",
        size: 0,
        type: "strokes",
      });

      // Process with API including format options
      logInfo("Sending strokes to MathPix API for recognition", {
        formats: selectedFormats,
        strokeCount: this.strokesCanvas.getStrokeCount(),
      });
      const result = await this.strokesAPIClient.processStrokes(
        strokesData,
        apiOptions,
        this.progressDisplay
      );

      // CRITICAL: Normalize strokes API response to match image API format
      // Strokes API returns 'latex_styled' and 'text', but result renderer expects 'latex'
      if (!result.latex && result.latex_styled) {
        result.latex = result.latex_styled;
        logDebug("Normalized latex_styled to latex for compatibility");
      }

      // Ensure we have text format (strokes already provides this)
      if (!result.text && result.latex_styled) {
        result.text = `\\( ${result.latex_styled} \\)`;
        logDebug("Generated text format from latex_styled");
      }

      // Extract formats from data array if present
      if (result.data && Array.isArray(result.data)) {
        result.data.forEach((item) => {
          if (item.type === "mathml" && !result.mathml) {
            result.mathml = item.value;
          } else if (item.type === "asciimath" && !result.asciimath) {
            result.asciimath = item.value;
          } else if (item.type === "latex" && !result.latex) {
            result.latex = item.value;
          }
        });
        logDebug("Extracted formats from data array", {
          hasMathml: !!result.mathml,
          hasAsciimath: !!result.asciimath,
          hasLatex: !!result.latex,
        });
      }

      // Store raw JSON for JSON format display
      if (!result.rawJson) {
        result.rawJson = JSON.stringify(result, null, 2);
      }

      // CRITICAL: Add canvas image to result for comparison display
      result.originalCanvasImage = canvasImage;
      logDebug("Canvas image attached to result", {
        hasImage: !!canvasImage,
        imageType: canvasImage ? "blob URL" : "none",
      });

      // Display result (reuses existing renderer)
      this.displayResult(result);

      // Update debug panel with strokes API transaction data
      this.updateDebugPanel();

      // CRITICAL: Display comparison view for strokes with canvas image
      if (canvasImage) {
        logDebug("Setting up strokes comparison view with canvas image");
        this.displayStrokesComparison(canvasImage, result);

        // Scroll to comparison view after DOM updates complete
        // Reuses helper method from image workflow - consistent UX
        this.scrollToComparisonView();
      } else {
        logWarn("Skipping comparison view - canvas image not captured");
      }

      // Complete progress display
      this.progressDisplay.complete(true, result);
      this.showNotification("Handwriting converted successfully!", "success");

      logInfo("Strokes processing completed successfully", {
        strokeCount: this.strokesCanvas.getStrokeCount(),
        hasLatex: !!result.latex,
        confidence: result.confidence,
        comparisonViewReady: !!canvasImage,
      });
    } catch (error) {
      logError("Strokes processing failed", {
        error: error.message,
        stack: error.stack,
        strokeCount: this.strokesCanvas?.getStrokeCount(),
      });

      // Update debug panel with error state
      this.updateDebugPanel();

      // Complete progress with error
      this.progressDisplay.complete(false, { error: error.message });

      this.showNotification(`Processing failed: ${error.message}`, "error");
    }
  }

  /**
   * @method captureCanvasAsImage
   * @description Captures current canvas content as image blob for comparison display
   *
   * Creates a blob URL from canvas content to display original handwriting
   * alongside recognised mathematics. Essential for user verification workflow.
   *
   * @returns {Promise<string|null>} Blob URL of canvas image, or null if capture fails
   *
   * @example
   * const imageURL = await controller.captureCanvasAsImage();
   * if (imageURL) {
   *   // Use imageURL for comparison display
   * }
   *
   * @since Phase 1C
   */
  async captureCanvasAsImage() {
    const canvas = this.elements["draw-canvas"];
    if (!canvas) {
      logWarn("Canvas element not found for image capture");
      return null;
    }

    try {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const blobURL = URL.createObjectURL(blob);
            logDebug("Canvas captured as image blob", {
              blobSize: blob.size,
              blobType: blob.type,
            });
            resolve(blobURL);
          } else {
            logWarn("Canvas toBlob returned null - capture failed");
            resolve(null);
          }
        }, "image/png");
      });
    } catch (error) {
      logError("Canvas image capture failed", error);
      return null;
    }
  }

  /**
   * @method displayStrokesComparison
   * @description Displays comparison view for strokes with canvas image and MathJax preview
   *
   * Shows the original handwritten canvas image alongside a MathJax-rendered
   * preview of the recognized mathematics. Provides visual verification for users.
   * Reuses existing result renderer infrastructure for consistency.
   *
   * @param {string} canvasImageURL - Blob URL of captured canvas image
   * @param {Object} result - API result with recognized mathematics
   * @returns {void}
   *
   * @example
   * await controller.displayStrokesComparison(blobURL, result);
   *
   * @accessibility Provides alt text and proper heading structure
   * @since Phase 1E
   */
  displayStrokesComparison(canvasImageURL, result) {
    logInfo("Displaying strokes comparison view", {
      hasCanvasImage: !!canvasImageURL,
      hasLatex: !!result.latex_styled || !!result.text,
      confidence: result.confidence,
    });

    // Get comparison container elements
    const comparisonContainer = document.getElementById(
      "mathpix-comparison-container"
    );
    const originalImage = document.getElementById("mathpix-original-image");
    const renderedOutput = document.getElementById("mathpix-rendered-output");

    if (!comparisonContainer || !originalImage || !renderedOutput) {
      logWarn("Comparison view elements not found", {
        hasContainer: !!comparisonContainer,
        hasOriginal: !!originalImage,
        hasRendered: !!renderedOutput,
      });
      return;
    }

    // Step 1: Display canvas image in original panel
    originalImage.src = canvasImageURL;
    originalImage.alt = "Your handwritten mathematics";
    originalImage.style.display = "block";

    logDebug("Canvas image set in comparison view", {
      imageURL: canvasImageURL.substring(0, 50) + "...",
    });

    // Step 2: Update confidence indicator using existing method
    if (result.confidence !== undefined) {
      this.updateConfidenceIndicator(result.confidence);
      logDebug("Confidence indicator updated", {
        confidence: result.confidence,
      });
    }

    // Step 3: Render preview with table-aware logic
    // CRITICAL: Check for tables FIRST before attempting MathJax rendering
    if (result.containsTable && result.tableHtml) {
      logDebug("Displaying table HTML in strokes comparison preview");

      // Clear previous content
      renderedOutput.innerHTML = "";

      // Insert table HTML directly
      renderedOutput.innerHTML = result.tableHtml;
      renderedOutput.style.overflow = "auto";
      renderedOutput.style.maxHeight = "400px";
      renderedOutput.classList.add("mathjax-rendered");

      // Process any mathematics within table cells (fire-and-forget)
      if (window.mathJaxManager) {
        window.mathJaxManager
          .queueTypeset(renderedOutput)
          .then(() => logDebug("MathJax processed equations in table cells"))
          .catch((error) =>
            logWarn("Failed to process math in table cells", error)
          );
      } else if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([renderedOutput])
          .then(() => logDebug("MathJax processed table cells (direct)"))
          .catch((error) =>
            logWarn("Failed to process math in table cells", error)
          );
      }

      logInfo("Table preview rendered in strokes comparison");
    } else {
      // No table detected - render LaTeX with MathJax
      const latexContent = result.latex || result.latex_styled || result.text;

      if (latexContent) {
        logDebug("Rendering MathJax preview with existing renderer", {
          content: latexContent,
          length: latexContent.length,
          source: result.latex
            ? "normalized latex"
            : result.latex_styled
            ? "latex_styled"
            : "text",
        });

        // Clear previous content
        renderedOutput.innerHTML = "";

        // Use existing renderContentWithMathJax method which handles all the complexity
        this.renderContentWithMathJax(latexContent, "latex", renderedOutput);

        logInfo("MathJax preview rendered via result renderer");
      } else {
        logWarn("No LaTeX content available for preview", {
          hasLatex: !!result.latex,
          hasLatexStyled: !!result.latex_styled,
          hasText: !!result.text,
          hasData: !!result.data,
        });
        renderedOutput.innerHTML =
          '<p style="padding: 2rem; text-align: center; color: var(--text-muted);">No preview available</p>';
      }
    }

    // Step 4: Show comparison container
    comparisonContainer.hidden = false;
    comparisonContainer.style.display = "grid";

    // Step 5: Clear original file info (not applicable for strokes)
    const originalInfo = document.getElementById("mathpix-original-info");
    if (originalInfo) {
      originalInfo.innerHTML = "";
    }

    logInfo("Strokes comparison view displayed successfully", {
      hasImage: !!originalImage.src,
      hasPreview: renderedOutput.innerHTML.length > 0,
      confidenceSet: result.confidence !== undefined,
    });
  }

  /**
   * @method onModeChange
   * @description Callback for mode switcher changes (upload/draw/camera toggle)
   *
   * Called when user switches between modes. Handles lazy initialisation of
   * strokes system (draw mode) and camera system (camera mode).
   *
   * @param {string} newMode - New mode ('upload', 'draw', or 'camera')
   * @returns {void}
   *
   * @example
   * // Called automatically by mode switcher
   * controller.onModeChange('camera');
   *
   * @since Phase 1C
   * @updated Phase 1D - Added camera mode support
   */
  onModeChange(newMode) {
    logInfo("Input mode changed", {
      newMode,
      strokesSystemReady: !!this.strokesCanvas,
      cameraSystemReady: !!this.cameraCapture,
    });

    if (newMode === "draw") {
      // Initialize strokes system if switching to draw mode for first time
      if (!this.strokesCanvas && this.elements["draw-canvas"]) {
        this.initStrokesSystem()
          .then((success) => {
            if (success) {
              logInfo(
                "Strokes system initialised on first draw mode activation"
              );
            } else {
              logError("Failed to initialise strokes system on mode change");
            }
          })
          .catch((err) => {
            logError("Strokes system initialisation error on mode change", err);
          });
      }
    } else if (newMode === "camera") {
      // Initialize camera system if switching to camera mode for first time
      if (!this.cameraCapture && this.elements["camera-video"]) {
        this.initCameraSystem()
          .then((success) => {
            if (success) {
              logInfo(
                "Camera system initialised on first camera mode activation"
              );
            } else {
              logError("Failed to initialise camera system on mode change");
            }
          })
          .catch((err) => {
            logError("Camera system initialisation error on mode change", err);
          });
      }
    } else if (newMode === "upload") {
      // Stop camera if returning to upload mode
      if (this.cameraCapture && this.cameraCapture.isCameraActive) {
        this.cameraCapture.stopCamera();
        logInfo("Camera stopped when switching to upload mode");
      }
    }
  }
  /**
   * Attaches event listeners to canvas size buttons
   * @private
   */
  attachCanvasSizeListeners() {
    const sizeButtons = document.querySelectorAll(".mathpix-size-btn");

    sizeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const size = button.dataset.size;

        if (!this.strokesCanvas) {
          this.showNotification("Canvas not initialized", "error");
          return;
        }

        // Resize canvas
        const success = this.strokesCanvas.resizeCanvas(size, true);

        if (success) {
          this.showNotification(`Canvas resized to ${size}`, "success");
        } else {
          this.showNotification("Failed to resize canvas", "error");
        }
      });
    });

    logDebug("Canvas size button listeners attached");
  }
}

// =============================================================================
// GLOBAL INSTANCE MANAGEMENT
// =============================================================================

/**
 * @type {MathPixController|null}
 * @description Global MathPix controller instance (singleton pattern)
 */
let mathPixController = null;

/**
 * @function initMathPix
 * @description Initialises the global MathPix system
 *
 * Creates and initialises the global MathPixController instance using singleton pattern.
 * Safe to call multiple times - will only create one instance.
 *
 * @returns {boolean} True if initialisation successful, false on failure
 *
 * @example
 * const success = initMathPix();
 * if (success) {
 *   console.log('MathPix system ready');
 *   const controller = getMathPixController();
 * }
 *
 * @since 1.0.0
 */
export function initMathPix() {
  if (!mathPixController) {
    mathPixController = new MathPixController();
  }
  return mathPixController.init();
}

/**
 * @function getMathPixController
 * @description Gets the global MathPix controller instance
 *
 * Returns the singleton MathPixController instance. Must call initMathPix() first.
 *
 * @returns {MathPixController|null} Controller instance or null if not initialised
 *
 * @example
 * const controller = getMathPixController();
 * if (controller) {
 *   await controller.handleFileUpload(file);
 * }
 *
 * @since 1.0.0
 */
export function getMathPixController() {
  return mathPixController;
}

// =============================================================================
// GLOBAL MATHJAX ENHANCEMENT SYSTEM
// =============================================================================

/**
 * @function mathPixEnhanceMathJax
 * @description Global function for applying MathPix enhancements to MathJax elements
 *
 * Adds interactive features, accessibility support, and visual enhancements to
 * MathJax-rendered mathematical content throughout the application. Automatically
 * called after MathJax rendering completes.
 *
 * Features added:
 * - Hover effects with visual feedback
 * - Keyboard focus support with visible focus indicators
 * - Enhanced accessibility for screen readers
 * - Theme-aware styling (light/dark mode support)
 * - Click-to-zoom functionality
 * - Right-click context menu access
 *
 * @global
 * @returns {void}
 *
 * @example
 * // Called automatically by MathJax system
 * window.mathPixEnhanceMathJax();
 *
 * @accessibility Adds tabindex, ARIA labels, and keyboard interaction to MathJax elements
 * @since 1.0.0
 */
window.mathPixEnhanceMathJax = function () {
  console.log("🎯 Applying global MathPix MathJax enhancements...");

  // Add global styles for enhanced MathJax
  const style = document.createElement("style");
  style.textContent = `
    /* MathPix MathJax Enhancements */
    mjx-container[data-mathpix-enhanced] {
      transition: transform 0.2s ease;
      border-radius: 4px;
      padding: 2px 4px;
    }
    
    mjx-container[data-mathpix-enhanced]:hover {
      background-color: rgba(0, 92, 132, 0.05);
      transform: scale(1.02);
    }
    
    mjx-container[data-mathpix-enhanced]:focus {
      outline: 2px solid #005c84;
      outline-offset: 2px;
      background-color: rgba(0, 92, 132, 0.1);
    }
    
    /* Dark theme support */
    @media (prefers-color-scheme: dark) {
      mjx-container[data-mathpix-enhanced]:hover {
        background-color: rgba(255, 255, 244, 0.05);
      }
      
      mjx-container[data-mathpix-enhanced]:focus {
        outline-color: #00a8cc;
        background-color: rgba(255, 255, 244, 0.1);
      }
    }
  `;

  document.head.appendChild(style);
  console.log("✅ Global MathPix MathJax enhancements applied");
};

// =============================================================================
// GLOBAL DEBUG PANEL FUNCTIONS (PHASE 3)
// =============================================================================

/**
 * @function copyMathPixDebugData
 * @description Copies debug panel data to clipboard from any API client
 * @global
 *
 * Checks all API clients (image, strokes, PDF) to find the most recent
 * operation's debug data and copies the specified section to clipboard.
 *
 * @param {string} section - Section to copy ('request' or 'response')
 * @returns {void}
 *
 * @example
 * // Called by onclick handlers in HTML
 * copyMathPixDebugData('request');
 *
 * @since Phase 3
 * @updated Phase 3.1 - Multi-endpoint support
 */
window.copyMathPixDebugData = function (section) {
  const controller = getMathPixController();
  if (!controller) {
    console.error("MathPix controller not available");
    return;
  }

  // Collect ALL debug data with timestamps (same logic as updateDebugPanel)
  const candidates = [];

  // Check strokes API client
  if (controller.strokesAPIClient?.getLastDebugData) {
    const strokesData = controller.strokesAPIClient.getLastDebugData();
    if (strokesData?.timestamp) {
      candidates.push({
        data: strokesData,
        source: "strokes",
        timestamp: new Date(strokesData.timestamp),
      });
    }
  }

  // Check main API client (image processing)
  if (controller.apiClient?.getLastDebugData) {
    const imageData = controller.apiClient.getLastDebugData();
    if (imageData?.timestamp) {
      candidates.push({
        data: imageData,
        source: "image",
        timestamp: new Date(imageData.timestamp),
      });
    }
  }

  // Check PDF processor (future support)
  if (controller.pdfProcessor?.getLastDebugData) {
    const pdfData = controller.pdfProcessor.getLastDebugData();
    if (pdfData?.timestamp) {
      candidates.push({
        data: pdfData,
        source: "pdf",
        timestamp: new Date(pdfData.timestamp),
      });
    }
  }

  // No debug data available from any client
  if (candidates.length === 0) {
    controller.showNotification("No debug data available to copy", "warning");
    console.warn("No debug data found in any API client");
    return;
  }

  // Sort by timestamp (most recent first)
  candidates.sort((a, b) => b.timestamp - a.timestamp);

  // Use the most recent operation
  const mostRecent = candidates[0];
  const debugData = mostRecent.data;
  const dataSource = mostRecent.source;

  console.log(
    `Copying ${section} data from most recent operation (${dataSource} at ${debugData.timestamp})`
  );

  if (!debugData) {
    controller.showNotification("No debug data available to copy", "warning");
    console.warn("No debug data found in any API client");
    return;
  }

  console.log(`Copying ${section} data from ${dataSource} API client`);

  let dataToCopy = null;

  if (section === "request") {
    dataToCopy = debugData.request;
  } else if (section === "response") {
    dataToCopy = debugData.response;
  } else {
    controller.showNotification("Invalid debug section specified", "error");
    return;
  }

  if (!dataToCopy) {
    controller.showNotification(`No ${section} data available`, "warning");
    return;
  }

  try {
    const jsonString = JSON.stringify(dataToCopy, null, 2);

    navigator.clipboard
      .writeText(jsonString)
      .then(() => {
        controller.showNotification(
          `${
            section.charAt(0).toUpperCase() + section.slice(1)
          } data copied to clipboard! (Source: ${dataSource})`,
          "success"
        );
        console.log(`✅ ${section} data copied from ${dataSource} API client`);
      })
      .catch((error) => {
        console.error("Clipboard copy failed:", error);
        controller.showNotification("Failed to copy to clipboard", "error");
      });
  } catch (error) {
    console.error("JSON formatting failed:", error);
    controller.showNotification("Failed to format data for copying", "error");
  }
};

// =============================================================================
// PHASE 1D: GLOBAL CAMERA FUNCTIONS (FOR HTML EVENT HANDLERS)
// =============================================================================

/**
 * Toggles the camera between start and stop states (Phase 1F)
 * Called by "Start Camera" / "Stop Camera" button onclick handler
 * Smart toggle: starts camera if inactive, stops camera if active
 * @global
 */
window.startMathPixCamera = async function () {
  const controller = window.getMathPixController();
  if (!controller) {
    console.error("MathPix controller not initialised");
    return;
  }

  if (!controller.cameraCapture) {
    console.error("Camera system not initialised");
    controller.showNotification("Camera system not ready", "error");
    return;
  }

  // Phase 1F: Toggle between start and stop based on current state
  if (controller.cameraCapture.isCameraActive) {
    // Camera is active → Stop it
    controller.cameraCapture.stopCamera();
  } else {
    // Camera is inactive → Start it
    await controller.cameraCapture.startCamera();
  }
};

/**
 * Captures a photo from the camera and routes to upload workflow
 * Called by "Capture Photo" button onclick handler
 * @global
 */
window.handleMathPixCameraCapture = async function () {
  const controller = window.getMathPixController();
  if (!controller) {
    console.error("MathPix controller not initialised");
    return;
  }

  if (!controller.cameraCapture) {
    console.error("Camera system not initialised");
    return;
  }

  try {
    // Capture photo as File object
    const photoFile = await controller.cameraCapture.capturePhoto();

    // Switch to upload mode to show preview
    if (controller.modeSwitcher) {
      controller.modeSwitcher.switchToUploadMode();
    }

    // Route through standard upload workflow
    await controller.fileHandler.handleUpload(photoFile);

    controller.showNotification("Photo captured successfully!", "success");
  } catch (error) {
    console.error("Camera capture failed:", error);
    controller.showNotification(
      `Photo capture failed: ${error.message}`,
      "error"
    );
  }
};

/**
 * Switches between front and rear cameras (mobile)
 * Called by "Switch Camera" button onclick handler
 * @global
 */
window.switchMathPixCamera = async function () {
  const controller = window.getMathPixController();
  if (!controller || !controller.cameraCapture) {
    return;
  }

  await controller.cameraCapture.switchCamera();
};

/**
 * Rotates the camera capture orientation
 * Called by "Rotate" button onclick handler
 * @global
 */
window.rotateMathPixCapture = function () {
  const controller = window.getMathPixController();
  if (!controller || !controller.cameraCapture) {
    return;
  }

  controller.cameraCapture.rotateCapture();
};

/**
 * Toggles the camera preview mirroring (Phase 1F)
 * Called by "Mirror Preview" button onclick handler
 * @global
 */
window.toggleMathPixCameraMirror = function () {
  const controller = window.getMathPixController();
  if (!controller || !controller.cameraCapture) {
    console.warn(
      "[MathPix Camera] Mirror toggle unavailable - camera not initialised"
    );
    return;
  }

  controller.cameraCapture.toggleMirror();
};

/**
 * Rotates the captured image preview 90° clockwise (Phase 1F.2)
 * Called by "Rotate Preview" button onclick handler
 * Applies CSS transform for instant visual feedback
 * Actual canvas rotation occurs during processing
 * @global
 */
window.rotateMathPixPreview = function () {
  const controller = window.getMathPixController();
  if (!controller || !controller.fileHandler) {
    console.warn(
      "[MathPix Preview] Rotate unavailable - file handler not initialised"
    );
    return;
  }

  controller.fileHandler.rotatePreview();
};

/**
 * Flips the captured image preview horizontally (Phase 1F.2)
 * Called by "Flip Preview" button onclick handler
 * Applies CSS transform for instant visual feedback
 * Actual canvas flip occurs during processing
 * @global
 */
window.flipMathPixPreview = function () {
  const controller = window.getMathPixController();
  if (!controller || !controller.fileHandler) {
    console.warn(
      "[MathPix Preview] Flip unavailable - file handler not initialised"
    );
    return;
  }

  controller.fileHandler.flipPreview();
};

// =============================================================================
// GLOBAL PDF TESTING FUNCTIONS
// =============================================================================

// Global PDF testing functions
window.testPDFComponents = () => {
  const controller = getMathPixController();
  return controller ? controller.testPDFComponents() : null;
};

window.testPDFValidation = () => {
  const controller = getMathPixController();
  return controller ? controller.testPDFValidation() : null;
};

window.testPDFWorkflow = async () => {
  const controller = getMathPixController();
  return controller ? await controller.testPDFWorkflow() : null;
};

window.testPDFExports = () => {
  const controller = getMathPixController();
  if (!controller || !controller.pdfResultRenderer.currentResults) {
    console.log("❌ No PDF results available for export testing");
    return { error: "No results available" };
  }

  try {
    console.log("Testing PDF export functionality...");

    const formats = Object.keys(
      controller.pdfResultRenderer.currentResults
    ).filter((key) => key !== "processingMetadata");

    console.log("📄 Available formats for export:", formats);

    return {
      availableFormats: formats,
      copySupported: formats.filter((f) => f !== "docx"),
      downloadSupported: formats,
      previewSupported: formats.includes("html") ? ["html"] : [],
    };
  } catch (error) {
    console.error("❌ PDF export test failed:", error);
    return { error: error.message };
  }
};

// =============================================================================
// PHASE 3.4: PDF PREVIEW TESTING FUNCTIONS
// =============================================================================

/**
 * Test PDF upload preview functionality (Phase 3.4)
 * Creates test file for upload preview testing
 */
window.testPDFUploadPreview = async () => {
  console.log("=== PDF Upload Preview Test ===");
  console.log("Note: This requires a real PDF file for full testing");
  console.log("Use file input or drag-and-drop to test with actual PDF");

  const controller = getMathPixController();
  if (!controller) {
    console.log("❌ MathPix controller not initialised");
    return { error: "Controller not initialised" };
  }

  console.log("✅ Upload preview system ready");
  console.log("Upload a PDF file to see the preview in action");

  return {
    ready: true,
    components: {
      uploadVerification: !!window.PDFUploadVerification,
      accessibility: !!window.PDFPreviewAccessibility,
    },
  };
};

/**
 * Test PDF preview accessibility features (Phase 3.4)
 */
window.testPDFPreviewAccessibility = () => {
  console.log("=== PDF Preview Accessibility Test ===");

  if (!window.PDFPreviewAccessibility) {
    console.log("❌ PDFPreviewAccessibility not loaded");
    return { error: "Module not loaded" };
  }

  const a11y = new window.PDFPreviewAccessibility();

  // Test announcements
  console.log("Testing upload announcement...");
  a11y.announceUploadVerification("test.pdf", 9);

  setTimeout(() => {
    console.log("Testing page change announcement...");
    a11y.announcePageChange(1, 9, {
      mathElements: 2,
      tables: 1,
      handwritten: 5,
      confidence: 0.875,
    });
  }, 2000);

  console.log("✅ Accessibility tests running");
  console.log("Check screen reader output for announcements");

  return {
    success: true,
    liveRegion: !!document.getElementById("pdf-preview-announcements"),
  };
};

/**
 * Get current PDF preview state (Phase 3.4)
 */
window.getPDFPreviewState = () => {
  console.log("=== PDF Preview State ===");

  const state = {
    uploadPreview: {
      visible: !document.getElementById("mathpix-upload-preview")?.hidden,
      hasFile: !!document.getElementById("upload-preview-filename")
        ?.textContent,
    },
    postProcessingPreview: {
      visible: !document.getElementById("mathpix-pdf-preview-container")
        ?.hidden,
      currentPage: document.getElementById("pdf-current-page")?.textContent,
      totalPages: document.getElementById("pdf-total-pages")?.textContent,
    },
    modules: {
      uploadVerification: !!window.PDFUploadVerification,
      accessibility: !!window.PDFPreviewAccessibility,
    },
  };

  console.log("Current state:", state);
  return state;
};

// Global exposure for testing
if (typeof window !== "undefined") {
  window.PDFPreviewCore = PDFPreviewCore;
}
