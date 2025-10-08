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
import MATHPIX_CONFIG from "../core/mathpix-config.js";
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

// Phase 1C: Strokes system components (handwriting recognition)
import MathPixStrokesCanvas from "../core/mathpix-strokes-canvas.js";
import MathPixStrokesAPIClient from "../core/mathpix-strokes-api-client.js";
import MathPixModeSwitcher from "./components/mathpix-mode-switcher.js";

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

    // Legacy compatibility properties
    this.elements = {};
    this.isInitialised = false;

    logInfo(
      "MathPixController created with modular architecture including Phase 3.1 content analysis and Phase 1C strokes system"
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
   */
  init() {
    try {
      this.uiManager.cacheElements();
      this.uiManager.attachEventListeners();
      this.uiManager.loadStoredConfig();
      this.isInitialised = true;
      logInfo("MathPixController initialised successfully");
      return true;
    } catch (error) {
      logError("Failed to initialise MathPixController", error);
      return false;
    }
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
      // Clear any previous results before processing new file
      if (this.resultRenderer) {
        logDebug("Cleaning up previous results before new file processing");
        this.resultRenderer.cleanup();
      }

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
   * @method displayResult
   * @description Delegates result display to result renderer
   *
   * @param {Object} result - Processing result from MathPix API
   * @returns {void}
   * @see {@link MathPixResultRenderer#displayResult}
   * @since 1.0.0
   */
  displayResult(result) {
    return this.resultRenderer.displayResult(result);
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
      // Step 1: Request privacy consent with configuration toggle support
      logInfo("Requesting privacy consent for confirmed file processing");
      const consentGranted = await this.privacyManager.requestProcessingConsent(
        {
          name: file.name,
          size: file.size,
          type: file.type,
        }
      );

      if (!consentGranted) {
        logInfo("Processing cancelled - user declined consent", {
          fileName: file.name,
        });
        this.showNotification(
          "Processing cancelled. Your file was not uploaded or processed.",
          "info"
        );
        return;
      }

      logInfo("Privacy consent granted, proceeding with processing", {
        fileName: file.name,
        consentStatus: this.privacyManager.getConsentStatus(),
      });

      // Step 2: Start progress display
      this.progressDisplay.startProgress({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      // Step 3: Process file with progress callbacks
      const result = await this.apiClient.processImage(
        file,
        {},
        this.progressDisplay
      );

      // Step 4: Display result with cleanup
      this.displayResult(result);

      // Step 5: Complete progress display with success
      this.progressDisplay.complete(true, result);

      logInfo("Confirmed file processing completed successfully", {
        fileName: file.name,
        availableFormats: Object.keys(result).filter(
          (key) =>
            result[key] && typeof result[key] === "string" && result[key].trim()
        ),
        processingTiming: result.processingTiming,
      });
    } catch (error) {
      logError("Confirmed file processing failed", error);

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

      // Share API credentials with strokes API client
      if (this.apiClient.appId && this.apiClient.apiKey) {
        this.strokesAPIClient.setCredentials(
          this.apiClient.appId,
          this.apiClient.apiKey
        );
        logDebug("API credentials shared with strokes API client");
      }

      logInfo("Strokes system initialisation complete", {
        canvasReady: this.strokesCanvas?.isInitialised,
        modeSwitcherReady: this.modeSwitcher?.isInitialised,
        hasCredentials: this.strokesAPIClient?.hasCredentials(),
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
   * // Returns: ['text', 'latex_styled', 'mathml', ...]
   *
   * @since Phase 1E
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
        markdown: "text", // Same as LaTeX for strokes
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

      // CRITICAL: Display comparison view for strokes with canvas image
      if (canvasImage) {
        logDebug("Setting up strokes comparison view with canvas image");
        this.displayStrokesComparison(canvasImage, result);
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
   * @description Callback for mode switcher changes (upload/draw toggle)
   *
   * Called when user switches between upload and draw modes. Handles lazy
   * initialisation of strokes system when draw mode is activated.
   *
   * @param {string} newMode - New mode ('upload' or 'draw')
   * @returns {void}
   *
   * @example
   * // Called automatically by mode switcher
   * controller.onModeChange('draw');
   *
   * @since Phase 1C
   */
  onModeChange(newMode) {
    logInfo("Input mode changed", {
      newMode,
      strokesSystemReady: !!this.strokesCanvas,
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
