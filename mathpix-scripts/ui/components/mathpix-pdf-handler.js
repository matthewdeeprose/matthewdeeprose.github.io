/**
 * @fileoverview MathPix PDF Handler - Comprehensive PDF file upload, validation, and processing management
 * @module MathPixPDFHandler
 * @requires MathPixBaseModule
 * @requires MATHPIX_CONFIG
 * @author MathPix Development Team
 * @version 2.1.0
 * @since 2.1.0
 *
 * @description
 * Handles all PDF-specific operations for the MathPix mathematics OCR system including PDF
 * upload processing, document validation, processing options management, and user confirmation workflows.
 *
 * Key Features:
 * - PDF document validation (up to 512MB)
 * - Processing options configuration (page ranges, output formats)
 * - User confirmation workflow for processing control
 * - Integration with MathPix PDF API endpoints
 * - Comprehensive error handling with user-friendly messaging
 * - Full accessibility compliance (WCAG 2.2 AA)
 *
 * Integration:
 * - Extends MathPixBaseModule for shared functionality and logging
 * - Coordinates with MathPixController for API access and processing
 * - Uses MATHPIX_CONFIG for PDF limits and supported formats
 * - Integrates with notification system for user feedback
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant PDF upload interface
 * - Keyboard navigation support for all interactive elements
 * - Screen reader compatible with proper ARIA labels
 * - Focus management for modal and processing workflows
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
import MATHPIX_CONFIG, {
  getEndpointConfig,
  getEndpointFeatures,
  isFeatureAvailable,
  getFormatInfo,
} from "../../core/mathpix-config.js";
// Phase 3.4: PDF Preview imports
import { PDFUploadVerification } from "../../pdf-preview/pdf-preview-upload-verification.js";
import { PDFPreviewAccessibility } from "../../pdf-preview/pdf-preview-accessibility.js";

/**
 * SVG Icon Registry for PDF Handler
 * Uses currentColor to inherit text colour from parent elements
 * All icons are 21x21 for consistent sizing
 * @constant {Object}
 */
const ICONS = {
  upload:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m11.5 4.5-3.978-4-4.022 4"/><path d="m7.522.521v11.979"/><path d="m.5 9v4.5c0 1.1045695.8954305 2 2 2h10c1.1045695 0 2-.8954305 2-2v-4.5"/></g></svg>',
  search:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="8.5" r="5"/><path d="m17.571 17.5-5.571-5.5"/></g></svg>',
  hourglass:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="matrix(-1 0 0 1 19 2)"><circle cx="8.5" cy="8.5" r="8"/><path d="m8.5 5.5v4h-3.5"/></g></svg>',
  gear: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m7.5.5c.35132769 0 .69661025.02588228 1.03404495.07584411l.50785434 1.53911115c.44544792.12730646.86820077.30839026 1.26078721.53578009l1.4600028-.70360861c.5166435.39719686.9762801.86487779 1.3645249 1.388658l-.7293289 1.44720284c.2201691.39604534.3936959.82158734.5131582 1.2692035l1.5298263.5338186c.0390082.29913986.0591302.60421522.0591302.91399032 0 .35132769-.0258823.69661025-.0758441 1.03404495l-1.5391112.50785434c-.1273064.44544792-.3083902.86820077-.5357801 1.26078721l.7036087 1.4600028c-.3971969.5166435-.8648778.9762801-1.388658 1.3645249l-1.4472029-.7293289c-.39604532.2201691-.82158732.3936959-1.26920348.5131582l-.5338186 1.5298263c-.29913986.0390082-.60421522.0591302-.91399032.0591302-.35132769 0-.69661025-.0258823-1.03404495-.0758441l-.50785434-1.5391112c-.44544792-.1273064-.86820077-.3083902-1.26078723-.5357801l-1.46000277.7036087c-.51664349-.3971969-.97628006-.8648778-1.36452491-1.388658l.72932886-1.4472029c-.2203328-.39633993-.39395403-.82222042-.51342462-1.27020241l-1.52968981-.53381682c-.03892294-.29882066-.05900023-.60356226-.05900023-.91299317 0-.35132769.02588228-.69661025.07584411-1.03404495l1.53911115-.50785434c.12730646-.44544792.30839026-.86820077.53578009-1.26078723l-.70360861-1.46000277c.39719686-.51664349.86487779-.97628006 1.388658-1.36452491l1.44720284.72932886c.39633995-.2203328.82222044-.39395403 1.27020243-.51342462l.53381682-1.52968981c.29882066-.03892294.60356226-.05900023.91299317-.05900023z" stroke-width=".933"/><circle cx="7.5" cy="7.5" r="3"/></g></svg>',
  inbox:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2.5 1.5)"><path d="m10 3h2.3406038c.4000282 0 .7615663.23839685.9191451.6060807l2.7402511 6.3939193v4c0 1.1045695-.8954305 2-2 2h-12c-1.1045695 0-2-.8954305-2-2v-4l2.74025113-6.3939193c.15757879-.36768385.51911692-.6060807.91914503-.6060807h2.34060384"/><path d="m11 6.086-3 2.914-3-2.914"/><path d="m8 0v9"/><path d="m0 10h4c.55228475 0 1 .4477153 1 1v1c0 .5522847.44771525 1 1 1h4c.5522847 0 1-.4477153 1-1v-1c0-.5522847.4477153-1 1-1h4"/></g></svg>',
  checkCircle:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><circle cx="8.5" cy="8.5" r="8"/><path d="m5.5 9.5 2 2 5-5"/></g></svg>',
  document:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)"><path d="m12.5 12.5v-7l-5-5h-5c-1.1045695 0-2 .8954305-2 2v10c0 1.1045695.8954305 2 2 2h8c1.1045695 0 2-.8954305 2-2z"/><path d="m2.5 7.5h5"/><path d="m2.5 9.5h7"/><path d="m2.5 11.5h3"/><path d="m7.5.5v3c0 1.1045695.8954305 2 2 2h3"/></g></svg>',
};

/**
 * Get an SVG icon by name with accessibility attributes
 * @param {string} name - Icon name from ICONS registry
 * @param {Object} [options] - Options
 * @param {string} [options.className] - Additional CSS class
 * @returns {string} SVG HTML string with aria-hidden
 */
function getIcon(name, options = {}) {
  const svg = ICONS[name];
  if (!svg) {
    logWarn(`Unknown icon requested: ${name}`);
    return "";
  }

  const className = options.className
    ? ` class="icon ${options.className}"`
    : ' class="icon"';
  return svg.replace("<svg", `<svg aria-hidden="true"${className}`);
}

/**
 * @class MathPixPDFHandler
 * @extends MathPixBaseModule
 * @description Manages all PDF-specific operations for MathPix document processing
 *
 * This class handles the complete PDF workflow from initial upload through processing
 * options configuration to result management. It provides comprehensive PDF validation,
 * user-friendly processing options, and confirmation workflows whilst maintaining
 * WCAG 2.2 AA accessibility compliance throughout.
 *
 * @example
 * const pdfHandler = new MathPixPDFHandler(mathPixController);
 * const success = await pdfHandler.handlePDFUpload(pdfFile);
 * if (success) {
 *   console.log('PDF ready for processing');
 * }
 *
 * @see {@link MathPixBaseModule} for inherited functionality
 * @see {@link MathPixController} for integration patterns
 * @since 2.1.0
 */
class MathPixPDFHandler extends MathPixBaseModule {
  /**
   * @constructor
   * @description Initialises the MathPix PDF Handler with configuration and state management
   * @param {MathPixController} controller - Parent controller for coordination and API access
   * @throws {Error} If controller is not provided or invalid
   *
   * @example
   * const controller = new MathPixController();
   * const pdfHandler = new MathPixPDFHandler(controller);
   *
   * @accessibility Ensures all PDF handling maintains keyboard navigation support
   * @since 2.1.0
   */
  constructor(controller) {
    super(controller);

    /**
     * @member {File|null} currentPDFFile
     * @description Currently selected PDF file awaiting processing
     */
    this.currentPDFFile = null;

    /**
     * @member {PDFUploadVerification} uploadVerification
     * @description Phase 3.4: Upload preview verification system
     */
    this.uploadVerification = new PDFUploadVerification();

    /**
     * @member {PDFPreviewAccessibility} pdfAccessibility
     * @description Phase 3.4: PDF preview accessibility features
     */
    this.pdfAccessibility = new PDFPreviewAccessibility();

    /**
     * @member {Object|null} currentProcessingOptions
     * @description Current PDF processing options (page range, formats)
     */
    this.currentProcessingOptions = null;

    /**
     * @member {string|null} currentPDFId
     * @description Current PDF processing ID from API
     */
    this.currentPDFId = null;

    /**
     * @member {Object|null} currentPDFResults
     * @description Current PDF processing results
     */
    this.currentPDFResults = null;

    /**
     * @member {number} maxPDFSize
     * @description Maximum PDF file size in bytes (512MB)
     * @readonly
     */
    this.maxPDFSize = MATHPIX_CONFIG.PDF_PROCESSING.MAX_PDF_SIZE;

    /**
     * @member {Array<string>} supportedPDFFormats
     * @description Supported output formats for PDF processing
     * @readonly
     */
    this.supportedPDFFormats =
      MATHPIX_CONFIG.PDF_PROCESSING.SUPPORTED_PDF_FORMATS;

    // Initialize HTML preview toggle state
    this.htmlToggleState = null;

    this.isInitialised = true;

    logInfo("MathPix PDF Handler initialised", {
      maxPDFSize: this.maxPDFSize,
      supportedFormats: this.supportedPDFFormats,
    });
  }

  /**
   * @method setupSelectAllFormats
   * @description Sets up select all formats functionality
   * @returns {void}
   * @since 3.1.0
   */
  setupSelectAllFormats() {
    console.log("🔧 setupSelectAllFormats called - checking DOM elements");

    const selectAllCheckbox = document.getElementById("select-all-formats");
    const formatCheckboxes = document.querySelectorAll(
      '.mathpix-format-checkbox input[type="checkbox"]:not(#select-all-formats)'
    );

    console.log("📋 Elements found:", {
      selectAllCheckbox: !!selectAllCheckbox,
      formatCheckboxesCount: formatCheckboxes.length,
      currentOptionsExists: !!this.currentProcessingOptions,
    });

    if (!selectAllCheckbox) {
      console.error(
        "❌ CRITICAL: Select all formats checkbox not found in DOM!"
      );
      logWarn("Select all formats checkbox not found");
      return false;
    }

    // Initialize processing options if missing
    if (!this.currentProcessingOptions) {
      this.currentProcessingOptions = {
        page_range: "all",
        formats: [
          "mmd",
          "md",
          "html",
          "tex.zip",
          "docx",
          "pptx",
          "pdf",
          "mmd.zip",
          "md.zip",
          "html.zip",
        ],
      };
      console.log(
        "🎯 Initialized currentProcessingOptions:",
        this.currentProcessingOptions
      );
    }

    // Remove any existing listeners (prevent duplicates)
    const existingHandler = selectAllCheckbox._selectAllHandler;
    if (existingHandler) {
      selectAllCheckbox.removeEventListener("change", existingHandler);
      console.log("🧹 Removed existing event listener");
    }

    // Create new event handler
    const selectAllHandler = (e) => {
      const isChecked = e.target.checked;
      console.log("🔄 Select All Change Event FIRED:", { isChecked });

      formatCheckboxes.forEach((checkbox, index) => {
        // Skip MMD (always required and disabled)
        if (checkbox.id === "pdf-format-mmd") {
          console.log(`📌 Skipping ${checkbox.id} (always required)`);
          return;
        }

        // Skip disabled checkboxes
        if (checkbox.disabled) {
          console.log(`🚫 Skipping ${checkbox.id} (disabled)`);
          return;
        }

        // Set checkbox state
        const oldChecked = checkbox.checked;
        checkbox.checked = isChecked;
        console.log(`✅ Setting ${checkbox.id}: ${oldChecked} → ${isChecked}`);
      });

      // CRITICAL: Update formats immediately
      this.updateSelectedFormats();

      console.log(
        "🎯 Processing options after select all:",
        this.currentProcessingOptions
      );
    };

    // Attach the event listener
    selectAllCheckbox.addEventListener("change", selectAllHandler);
    selectAllCheckbox._selectAllHandler = selectAllHandler; // Store reference for cleanup

    // Handle individual checkbox changes
    formatCheckboxes.forEach((checkbox) => {
      // Remove existing listener if any
      if (checkbox._updateHandler) {
        checkbox.removeEventListener("change", checkbox._updateHandler);
      }

      const updateHandler = () => {
        console.log(
          `📋 Individual checkbox changed: ${checkbox.id} = ${checkbox.checked}`
        );
        this.updateSelectAllState();
        this.updateSelectedFormats();
      };

      checkbox.addEventListener("change", updateHandler);
      checkbox._updateHandler = updateHandler; // Store reference
    });

    console.log("✅ setupSelectAllFormats completed successfully");
    logDebug("Select all formats functionality initialized");
    return true;
  }

  /**
   * @method forceSetupSelectAll
   * @description Force setup of select all functionality for debugging
   * @returns {boolean} Success status
   * @since 3.1.0
   */
  forceSetupSelectAll() {
    console.log(
      "🔧 FORCE SETUP: Manually initializing Select All functionality"
    );

    // Force call setup
    const success = this.setupSelectAllFormats();

    if (success) {
      // Test immediately
      const selectAll = document.getElementById("select-all-formats");
      if (selectAll) {
        console.log("🧪 Testing Select All functionality...");
        selectAll.checked = true;
        selectAll.dispatchEvent(new Event("change"));

        console.log("📊 Test results:", {
          processingOptions: this.currentProcessingOptions,
          selectAllChecked: selectAll.checked,
        });
      }
    }

    return success;
  }

  /**
   * @method updateSelectAllState
   * @description Updates select all checkbox state based on individual checkboxes
   * @returns {void}
   * @since 3.1.0
   */
  updateSelectAllState() {
    const selectAllCheckbox = document.getElementById("select-all-formats");
    const formatCheckboxes = document.querySelectorAll(
      '.mathpix-format-checkbox input[type="checkbox"]:not(#select-all-formats)'
    );

    if (!selectAllCheckbox) return;

    const enabledCheckboxes = Array.from(formatCheckboxes).filter(
      (cb) => !cb.disabled && cb.id !== "pdf-format-mmd"
    );
    const checkedCount = enabledCheckboxes.filter((cb) => cb.checked).length;

    if (checkedCount === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === enabledCheckboxes.length) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    }
  }

  /**
   * @method handlePDFUpload
   * @description Processes PDF file upload with comprehensive validation and options setup
   *
   * Manages the complete PDF upload workflow including validation, options display,
   * API credential verification, and user confirmation workflow preparation.
   *
   * @param {File} pdfFile - The PDF file selected by the user for processing
   * @returns {Promise<boolean>} True if PDF is ready for processing, false if validation failed
   * @throws {Error} If PDF processing encounters unexpected errors
   *
   * @example
   * const pdfInput = document.getElementById('pdf-input');
   * const pdfFile = pdfInput.files[0];
   * const success = await pdfHandler.handlePDFUpload(pdfFile);
   * if (success) {
   *   // PDF is validated and options displayed
   *   // User can now configure and confirm processing
   * }
   *
   * @accessibility Announces upload status to screen readers via notification system
   * @since 2.1.0
   */
  async handlePDFUpload(pdfFile) {
    logInfo("PDF upload started with Phase 3.4 preview", {
      fileName: pdfFile.name,
      size: pdfFile.size,
    });

    try {
      // Step 1: Validate PDF file against requirements
      const validation = this.validatePDFFile(pdfFile);
      if (!validation.valid) {
        this.showNotification(validation.message, "error");
        return false;
      }

      // Step 2: Verify API credentials are configured
      if (
        !this.controller.apiClient ||
        !this.controller.apiClient.appId ||
        !this.controller.apiClient.apiKey
      ) {
        this.showNotification(
          "Please configure your MathPix API credentials first.",
          "error"
        );
        return false;
      }

      // Step 3: PHASE 3.4 - Show upload preview for user verification
      const previewConfirmed =
        await this.showUploadPreviewAndWaitForConfirmation(pdfFile);

      if (!previewConfirmed) {
        // User cancelled during preview
        logInfo("User cancelled PDF upload during preview");
        return false;
      }

      // Step 4: User confirmed - store file and continue with processing workflow
      this.currentPDFFile = pdfFile;

      // Step 4b: Check for existing session with matching filename
      const persistence = window.getMathPixMMDPersistence?.();
      if (persistence) {
        persistence.checkForExistingSession(pdfFile.name);
      }

      // Step 5: Display PDF processing options interface
      this.displayPDFOptions(pdfFile);

      // Phase 4: Format-aware logging and notification
      const formatInfo = getFormatInfo(pdfFile.type);
      const formatName = formatInfo?.displayName || "Document";

      logInfo("Document uploaded successfully - options displayed", {
        fileName: pdfFile.name,
        fileSize: pdfFile.size,
        format: formatName,
      });

      this.showNotification(
        `${formatName} "${pdfFile.name}" ready. Configure processing options and click "Process ${formatName}".`,
        "success"
      );

      return true;
    } catch (error) {
      logError("PDF upload failed", error);
      this.showNotification(`PDF upload failed: ${error.message}`, "error");
      return false;
    }
  }

  /**
   * @method showUploadPreviewAndWaitForConfirmation
   * @description Shows PDF upload preview and waits for user confirmation or cancellation (Phase 3.4)
   *
   * Displays the first page of the PDF immediately after file selection, allowing users
   * to verify they've selected the correct file before proceeding with processing.
   * Returns a promise that resolves based on user action.
   *
   * @param {File} pdfFile - PDF file to preview
   * @returns {Promise<boolean>} Promise resolving to true if confirmed, false if cancelled
   *
   * @example
   * const confirmed = await this.showUploadPreviewAndWaitForConfirmation(file);
   * if (confirmed) {
   *   // Proceed with processing
   * }
   *
   * @accessibility Announces preview status to screen readers
   * @since 3.4.0
   */
  async showUploadPreviewAndWaitForConfirmation(pdfFile) {
    // Phase 4: Get format information for conditional preview
    const formatInfo = getFormatInfo(pdfFile.type);
    const formatName = formatInfo?.displayName || "Document";

    logInfo("Showing upload preview for user verification", {
      fileName: pdfFile.name,
      size: pdfFile.size,
      format: formatName,
      showPdfPreview: formatInfo?.showPdfPreview,
    });

    try {
      // Phase 4: Conditional preview based on format
      if (formatInfo?.showPdfPreview) {
        // PDF format - show full PDF preview
        return new Promise((resolve) => {
          this.uploadVerification.showUploadPreview(
            pdfFile,
            // onConfirm callback - user confirmed file is correct
            (confirmedFile) => {
              logInfo("User confirmed document upload", {
                fileName: confirmedFile.name,
                format: formatName,
              });

              // Announce confirmation to screen readers
              if (this.pdfAccessibility) {
                this.pdfAccessibility.announce(
                  `${formatName} ${confirmedFile.name} confirmed. Proceeding to processing options.`
                );
              }

              resolve(true);
            },
            // onCancel callback - user cancelled
            () => {
              logInfo("User cancelled document upload during preview");

              // Announce cancellation to screen readers
              if (this.pdfAccessibility) {
                this.pdfAccessibility.announce(
                  `${formatName} upload cancelled.`
                );
              }

              resolve(false);
            }
          );
        });
      } else {
        // Non-PDF format (DOCX, PPTX) - show simple file info preview
        return await this.showSimpleFilePreview(pdfFile, formatInfo);
      }
    } catch (error) {
      logError("Document upload preview failed", error);

      // Notify user of preview failure
      if (window.notifyWarning) {
        window.notifyWarning(
          `Could not preview ${formatName}. You can still proceed with processing.`
        );
      }

      // Ask user if they want to proceed without preview
      const proceedAnyway = await this.askUserToProceedWithoutPreview(pdfFile);
      return proceedAnyway;
    }
  }

  /**
   * @method askUserToProceedWithoutPreview
   * @description Asks user if they want to proceed when preview fails (Phase 3.4)
   *
   * @param {File} pdfFile - PDF file that failed to preview
   * @returns {Promise<boolean>} Promise resolving to user's decision
   * @private
   * @since 3.4.0
   */
  async askUserToProceedWithoutPreview(pdfFile) {
    const message = `Could not preview PDF "${pdfFile.name}". Proceed with processing anyway?`;
    const title = "Preview Unavailable";

    // Use existing modal system if available, otherwise fallback to confirm
    if (window.safeConfirm) {
      return await window.safeConfirm(message, title);
    } else {
      return confirm(message);
    }
  }

  /**
   * @method validatePDFFile
   * @description Validates PDF files against MathPix PDF processing requirements
   *
   * Performs comprehensive validation including file presence, MIME type verification,
   * and size limit enforcement specific to PDF processing requirements.
   *
   * @param {File} pdfFile - PDF file object to validate
   * @returns {Object} Validation result object
   * @returns {boolean} returns.valid - Whether PDF passed all validation checks
   * @returns {string} returns.message - Detailed message for failed validation
   *
   * @example
   * const validation = pdfHandler.validatePDFFile(selectedPDF);
   * if (!validation.valid) {
   *   console.error('PDF validation failed:', validation.message);
   * }
   *
   * @since 2.1.0
   */
  validatePDFFile(pdfFile) {
    if (!pdfFile) {
      return { valid: false, message: "No file provided" };
    }

    // Phase 4: Multi-format support - Check against array of supported types
    if (!MATHPIX_CONFIG.SUPPORTED_TYPES.includes(pdfFile.type)) {
      const supportedNames = MATHPIX_CONFIG.SUPPORTED_TYPES.map(
        (mime) => getFormatInfo(mime)?.name
      )
        .filter((name) => name && !name.startsWith("image"))
        .join(", ");

      return {
        valid: false,
        message: `Unsupported file type: ${pdfFile.type}. Supported document formats: ${supportedNames}.`,
      };
    }

    // Phase 4: Use format-specific size limit
    const formatInfo = getFormatInfo(pdfFile.type);
    const maxSize = formatInfo?.maxSize || this.maxPDFSize;
    const formatName = formatInfo?.displayName || "Document";

    if (pdfFile.size > maxSize) {
      const sizeMB = (pdfFile.size / 1024 / 1024).toFixed(1);
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0);
      return {
        valid: false,
        message: `${formatName} too large: ${sizeMB}MB (max ${maxSizeMB}MB)`,
      };
    }

    logDebug("Document validation passed", {
      name: pdfFile.name,
      type: pdfFile.type,
      format: formatName,
      size: pdfFile.size,
    });
    return { valid: true };
  }

  /**
   * @method displayPDFOptions
   * @description Displays PDF processing options interface
   *
   * Shows the processing options UI including page range selection,
   * output format choices, and processing actions. Also ensures the
   * main PDF interface container is visible.
   *
   * @param {File} pdfFile - PDF file to configure processing for
   * @returns {void}
   *
   * @accessibility Ensures all options maintain keyboard navigation
   * @since 2.1.0
   * @updated Phase 1 Step 5 - Added format availability checking
   */
  displayPDFOptions(pdfFile) {
    const pdfOptionsContainer = document.getElementById("mathpix-pdf-options");
    if (!pdfOptionsContainer) {
      logError("PDF options container not found");
      return;
    }

    // Phase 4: Get format information for UI updates
    const formatInfo = getFormatInfo(pdfFile.type);
    const formatName = formatInfo?.displayName || "Document";

    // Show the main PDF interface container
    const pdfInterface = document.getElementById("mathpix-pdf-interface");
    if (pdfInterface) {
      pdfInterface.style.display = "block";
      logDebug("Main PDF interface now visible");
    } else {
      logWarn("Main PDF interface container not found");
    }

    // Phase 4: Update process button text to be format-aware
    const processBtn = document.getElementById("mathpix-pdf-process-btn");
    if (processBtn) {
      // Clear ALL existing text nodes (prevents duplication)
      Array.from(processBtn.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .forEach((node) => node.remove());

      // Add new text node with format-aware content
      const textNode = document.createTextNode(`Process ${formatName}`);

      // Insert text AFTER SVG icon (icon comes first)
      const svg = processBtn.querySelector("svg");
      if (svg) {
        processBtn.insertBefore(textNode, svg.nextSibling);
      } else {
        processBtn.appendChild(textNode);
      }

      logDebug(`Process button text updated to: Process ${formatName}`);
    }

    // Hide the main image interface to avoid conflicts
    const imageInterface = document.getElementById("mathpix-main-interface");
    if (imageInterface) {
      imageInterface.style.display = "none";
      logDebug("Image interface hidden for PDF processing");
    }

    // Show the PDF options interface
    pdfOptionsContainer.style.display = "block";

    // Initialize default processing options FIRST (will be overridden by HTML checkbox states)
    this.currentProcessingOptions = {
      page_range: "all",
      formats: [
        "mmd",
        "md",
        "html",
        "tex.zip",
        "docx",
        "pptx",
        "pdf",
        "mmd.zip",
        "md.zip",
        "html.zip",
      ], // All available formats by default
    };

    // Update file information in the interface
    this.updatePDFFileInfo(pdfFile);

    // PHASE 1 STEP 5: Update format availability based on current endpoint
    this.updateFormatAvailability();

    // Set up event listeners for options (including Select All)
    this.attachPDFOptionsListeners();

    // ✅ Feature 3: Sync processing options with actual HTML checkbox states
    // This ensures HTML defaults (all formats checked) are respected
    this.updateSelectedFormats();

    // ✅ ACTION POINT 2: Scroll to start of PDF options after user confirms upload
    // Force instant scroll due to simultaneous show/hide operations that make smooth scroll look janky
    setTimeout(() => {
      pdfOptionsContainer.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
      logDebug(
        "Scrolled to PDF options interface (instant scroll due to layout changes)"
      );
    }, 150);

    logDebug("PDF options interface displayed with format availability", {
      fileName: pdfFile.name,
      initialFormats: this.currentProcessingOptions.formats,
      currentEndpoint: this.controller.apiClient?.currentEndpoint || "unknown",
    });
  }

  /**
   * @method updatePDFFileInfo
   * @description Updates PDF file information in the unified main drop zone
   *
   * UNIFIED DROP ZONE: Uses main mathpix-drop-zone instead of PDF-specific zone
   * to eliminate duplicate UI elements and provide consistent user experience.
   *
   * @param {File} pdfFile - PDF file to display information for
   * @returns {void}
   * @private
   * @since 2.1.0
   * @updated 2.1.1 - Unified drop zone implementation
   */
  updatePDFFileInfo(pdfFile) {
    // UNIFIED DROP ZONE: Use main drop zone instead of PDF-specific drop zone
    const mainDropZone = document.getElementById("mathpix-drop-zone");
    const pdfUploadContainer = document.querySelector(
      ".mathpix-pdf-upload-container"
    );

    // Hide the entire PDF upload container to eliminate duplication
    if (pdfUploadContainer) {
      pdfUploadContainer.style.display = "none";
      logDebug("PDF upload container hidden for unified UX");
    }

    // Update main drop zone to show PDF state
    if (mainDropZone) {
      const instructions = mainDropZone.querySelector("p");
      if (instructions) {
        instructions.innerHTML = `
        <svg
                  aria-hidden="true"
                  height="40"
                  width="40"
                  viewBox="0 0 21 21"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g
                    fill="none"
                    fill-rule="evenodd"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    transform="translate(2 4)"
                  >
                    <path
                      d="m15.5 4.5c.000802-1.10737712-.8946285-2.00280762-1.999198-2.00280762l-5.000802.00280762-2-2h-4c-.55228475 0-1 .44771525-1 1v.99719238 2.00280762"
                    />
                    <path
                      d="m.81056316 5.74177845 1.31072322 5.24326075c.22257179.8903496 1.02254541 1.5149608 1.94029301 1.5149608h8.87667761c.9177969 0 1.7178001-.6246768 1.9403251-1.5150889l1.3108108-5.24508337c.1339045-.53580596-.1919011-1.07871356-.727707-1.21261805-.079341-.0198283-.1608148-.02983749-.2425959-.02983749l-13.43852073.00188666c-.55228474.00007754-.99985959.44785564-.99985959 1.00014038 0 .08170931.01003737.16310922.02985348.24237922z"
                    />
                  </g>
                </svg>
        Selected Document: ${pdfFile.name}
        <br />
        <span class="help-text">Size: ${this.formatFileSize(
          pdfFile.size
        )} | Select to choose a different file</span>
      `;
        logDebug("Main drop zone updated with document file information", {
          fileName: pdfFile.name,
          fileSize: pdfFile.size,
        });
      }
    } else {
      logWarn("Main drop zone not found for PDF file info update");
    }
  }

  /**
   * @method attachPDFOptionsListeners
   * @description Attaches event listeners for PDF processing options
   *
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  attachPDFOptionsListeners() {
    // Set up page range change listeners
    const pageRangeInputs = document.querySelectorAll(
      'input[name="pdf-page-range"]'
    );
    pageRangeInputs.forEach((input) => {
      input.addEventListener("change", (e) => {
        this.handlePageRangeChange(e.target.value);
      });
    });

    // Set up format checkbox listeners
    const formatCheckboxes = document.querySelectorAll(
      'input[type="checkbox"][id^="pdf-format-"]'
    );
    formatCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.updateSelectedFormats();
      });
    });

    // Set up select all formats functionality (Phase 3.1)
    this.setupSelectAllFormats();

    // Set up delimiter controls (Phase 5, Feature 1)
    this.initializeDelimiterControls();

    // Set up process button listener
    const processButton = document.getElementById("mathpix-pdf-process-btn");
    if (processButton) {
      processButton.addEventListener("click", () => {
        this.processPDFWithOptions();
      });
    }

    // Set up cancel button listener
    const cancelButton = document.getElementById("mathpix-pdf-cancel-btn");
    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        this.cancelPDFProcessing();
      });
    }

    logDebug(
      "PDF options event listeners attached including delimiter controls"
    );
  }

  /**
   * @method initializeDelimiterControls
   * @description Initializes delimiter control event listeners and preview functionality
   *
   * Sets up radio button listeners for delimiter preset selection and input field
   * listeners for custom delimiter entry with real-time preview updates.
   *
   * @returns {void}
   * @private
   * @since 5.0.0
   */
  initializeDelimiterControls() {
    const delimiterRadios = document.querySelectorAll(
      'input[name="pdf-math-delimiters"]'
    );
    const customContainer = document.getElementById("pdf-custom-delimiters");

    if (!delimiterRadios.length || !customContainer) {
      logWarn("Delimiter controls not found in DOM");
      return;
    }

    // Set up radio button change listeners
    delimiterRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.value === "custom") {
          customContainer.style.display = "block";
          this.updateDelimiterPreviews();
        } else {
          customContainer.style.display = "none";
        }
        logDebug("Delimiter preset changed", { preset: radio.value });
      });
    });

    // Set up custom delimiter input listeners for real-time preview
    const delimiterInputs = [
      "pdf-inline-delim-start",
      "pdf-inline-delim-end",
      "pdf-display-delim-start",
      "pdf-display-delim-end",
    ];

    delimiterInputs.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", () => {
          this.updateDelimiterPreviews();
        });
      }
    });

    logDebug("Delimiter controls initialized");
  }

  /**
   * @method updateDelimiterPreviews
   * @description Updates delimiter preview displays with current input values
   *
   * Reads custom delimiter input values and updates preview code elements
   * to show users exactly how their delimiters will appear in output.
   *
   * @returns {void}
   * @private
   * @since 5.0.0
   */
  updateDelimiterPreviews() {
    const inlineStart =
      document.getElementById("pdf-inline-delim-start")?.value || "$";
    const inlineEnd =
      document.getElementById("pdf-inline-delim-end")?.value || "$";
    const displayStart =
      document.getElementById("pdf-display-delim-start")?.value || "$$";
    const displayEnd =
      document.getElementById("pdf-display-delim-end")?.value || "$$";

    const inlinePreview = document.getElementById("inline-preview");
    const displayPreview = document.getElementById("display-preview");

    if (inlinePreview) {
      inlinePreview.textContent = `${inlineStart}x^2${inlineEnd}`;
    }

    if (displayPreview) {
      displayPreview.textContent = `${displayStart}E = mc^2${displayEnd}`;
    }

    logDebug("Delimiter previews updated", {
      inline: [inlineStart, inlineEnd],
      display: [displayStart, displayEnd],
    });
  }

  /**
   * @method collectDelimiterPreferences
   * @description Collects user's maths delimiter preferences from UI
   *
   * Reads the delimiter radio button selection and custom inputs (if applicable),
   * returning an object ready to be spread into the API request parameters.
   *
   * Supports three modes:
   * 1. Preset (markdown/latex) - Uses MATHPIX_CONFIG presets
   * 2. Custom - Uses user-specified delimiters from input fields
   * 3. Default - Falls back to markdown preset if nothing selected
   *
   * @returns {Object} Delimiter configuration for API
   * @returns {Array<string>} returns.math_inline_delimiters - Inline maths delimiters [start, end]
   * @returns {Array<string>} returns.math_display_delimiters - Display maths delimiters [start, end]
   *
   * @example
   * const delimConfig = this.collectDelimiterPreferences();
   * // Returns: {
   * //   math_inline_delimiters: ["$", "$"],
   * //   math_display_delimiters: ["$$", "$$"]
   * // }
   *
   * @private
   * @since 5.0.0
   */
  collectDelimiterPreferences() {
    const delimiterChoice =
      document.querySelector('input[name="pdf-math-delimiters"]:checked')
        ?.value || "markdown";

    logDebug("Collecting delimiter preferences", { choice: delimiterChoice });

    if (delimiterChoice === "custom") {
      // Collect custom delimiters from input fields
      const inlineStart =
        document.getElementById("pdf-inline-delim-start")?.value?.trim() || "$";
      const inlineEnd =
        document.getElementById("pdf-inline-delim-end")?.value?.trim() || "$";
      const displayStart =
        document.getElementById("pdf-display-delim-start")?.value?.trim() ||
        "$$";
      const displayEnd =
        document.getElementById("pdf-display-delim-end")?.value?.trim() || "$$";

      const config = {
        math_inline_delimiters: [inlineStart, inlineEnd],
        math_display_delimiters: [displayStart, displayEnd],
      };

      logInfo("Using custom delimiters", config);
      return config;
    }

    // Use preset from MATHPIX_CONFIG
    const preset = MATHPIX_CONFIG.MATH_DELIMITER_PRESETS[delimiterChoice];

    if (!preset) {
      logWarn("Unknown delimiter preset, using markdown default", {
        choice: delimiterChoice,
      });
      // Fallback to markdown if preset not found
      const fallback = MATHPIX_CONFIG.MATH_DELIMITER_PRESETS.markdown;
      return {
        math_inline_delimiters: fallback.inline,
        math_display_delimiters: fallback.display,
      };
    }

    const config = {
      math_inline_delimiters: preset.inline,
      math_display_delimiters: preset.display,
    };

    logInfo("Using delimiter preset", { preset: delimiterChoice, config });
    return config;
  }

  /**
   * @method collectNumberingPreferences
   * @description Collects user's equation and section numbering preferences from UI
   *
   * Implements two key behaviours:
   * 1. Auto-enables idiomatic arrays when equation tags are enabled
   * 2. Ensures section numbering options are mutually exclusive
   *
   * Supports three section numbering modes:
   * - Preserve: Keep existing section numbers (default)
   * - Auto: Generate sequential section numbering
   * - Remove: Strip all section numbering
   *
   * @returns {Object} Numbering configuration for API
   * @returns {boolean} [returns.include_equation_tags] - Include equation numbering
   * @returns {boolean} [returns.idiomatic_eqn_arrays] - Use idiomatic environments
   * @returns {boolean} [returns.auto_number_sections] - Auto-number sections
   * @returns {boolean} [returns.remove_section_numbering] - Remove section numbers
   * @returns {boolean} [returns.preserve_section_numbering] - Keep existing numbers
   *
   * @example
   * const config = handler.collectNumberingPreferences();
   * // Returns: {
   * //   include_equation_tags: true,
   * //   idiomatic_eqn_arrays: true,  // Auto-enabled
   * //   preserve_section_numbering: true
   * // }
   *
   * @private
   * @since 5.0.0 (Phase 5, Feature 2)
   */
  collectNumberingPreferences() {
    const config = {};

    // Equation numbering checkboxes
    const includeEquationTags =
      document.getElementById("pdf-equation-tags")?.checked || false;
    const idiomaticArrays =
      document.getElementById("pdf-idiomatic-arrays")?.checked || false;

    if (includeEquationTags) {
      config.include_equation_tags = true;
      // Auto-enable idiomatic arrays for better equation numbering
      config.idiomatic_eqn_arrays = true;
      logDebug("Equation tags enabled, auto-enabling idiomatic arrays");
    } else if (idiomaticArrays) {
      // User wants idiomatic arrays without equation tags
      config.idiomatic_eqn_arrays = true;
      logDebug("Idiomatic arrays enabled without equation tags");
    }

    // Section numbering (mutually exclusive radio buttons)
    const sectionChoice =
      document.querySelector('input[name="pdf-section-numbering"]:checked')
        ?.value || "preserve";

    switch (sectionChoice) {
      case "auto":
        config.auto_number_sections = true;
        config.preserve_section_numbering = false;
        config.remove_section_numbering = false;
        logDebug("Section numbering: auto-generate");
        break;

      case "remove":
        config.auto_number_sections = false;
        config.preserve_section_numbering = false;
        config.remove_section_numbering = true;
        logDebug("Section numbering: remove existing");
        break;

      case "preserve":
      default:
        config.auto_number_sections = false;
        config.preserve_section_numbering = true;
        config.remove_section_numbering = false;
        logDebug("Section numbering: preserve existing");
        break;
    }

    logInfo("Collected numbering preferences", config);
    return config;
  }

  /**
   * @method handlePageRangeChange
   * @description Handles page range selection changes
   *
   * @param {string} rangeType - Selected page range type ("all", "first-10", "custom")
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  handlePageRangeChange(rangeType) {
    const customRangeContainer = document.getElementById("pdf-custom-range");

    if (rangeType === "custom") {
      customRangeContainer.style.display = "block";
      const customInput = document.getElementById("pdf-page-numbers");
      if (customInput) {
        customInput.focus();
      }
    } else {
      customRangeContainer.style.display = "none";
    }

    this.currentProcessingOptions.page_range = rangeType;

    logDebug("Page range changed", { rangeType });
  }

  /**
   * @method updateSelectedFormats
   * @description Updates selected output formats based on checkbox states
   *
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  updateSelectedFormats() {
    console.log("🔄 updateSelectedFormats called");

    const selectedFormats = [];
    const formatCheckboxes = document.querySelectorAll(
      'input[type="checkbox"][id^="pdf-format-"]'
    );

    formatCheckboxes.forEach((checkbox) => {
      console.log(
        `📋 ${checkbox.id}: checked=${checkbox.checked}, value=${checkbox.value}`
      );
      if (checkbox.checked) {
        selectedFormats.push(checkbox.value);
      }
    });

    // Ensure processing options exist
    if (!this.currentProcessingOptions) {
      this.currentProcessingOptions = {
        page_range: "all",
        formats: [
          "mmd",
          "md",
          "html",
          "tex.zip",
          "docx",
          "pptx",
          "pdf",
          "mmd.zip",
          "md.zip",
          "html.zip",
        ],
      };
      console.log(
        "🆘 Emergency init of processing options in updateSelectedFormats"
      );
    }

    this.currentProcessingOptions.formats = selectedFormats;

    console.log("✅ Formats updated:", selectedFormats);
    console.log("🎯 Full processing options:", this.currentProcessingOptions);

    logDebug("Selected formats updated", { formats: selectedFormats });

    // Enable/disable process button based on format selection
    const processButton = document.getElementById("mathpix-pdf-process-btn");
    if (processButton) {
      processButton.disabled = selectedFormats.length === 0;
    }
  }

  /**
   * @method processPDFWithOptions
   * @description Initiates PDF processing with configured options
   *
   * Validates options, shows progress interface, and starts PDF processing workflow.
   *
   * @returns {Promise<void>}
   * @since 2.1.0
   */
  async processPDFWithOptions() {
    if (!this.currentPDFFile || !this.currentProcessingOptions) {
      this.showNotification(
        "No PDF file or options available for processing",
        "error"
      );
      return;
    }

    try {
      // Validate processing options
      const optionsValidation = this.validateProcessingOptions();
      if (!optionsValidation.valid) {
        this.showNotification(optionsValidation.message, "error");
        return;
      }

      // Hide options interface and show progress
      this.showPDFProgressInterface();

      // Build final processing options
      const finalOptions = this.buildFinalProcessingOptions();

      logInfo("Starting PDF processing", {
        fileName: this.currentPDFFile.name,
        options: finalOptions,
      });

      // Start PDF processing
      await this.controller.pdfProcessor.processPDFDocument(
        this.currentPDFFile,
        finalOptions,
        this.getPDFProgressCallback()
      );
    } catch (error) {
      logError("PDF processing failed", error);
      this.showNotification(`PDF processing failed: ${error.message}`, "error");
      this.hidePDFProgressInterface();
    }
  }

  /**
   * @method validateProcessingOptions
   * @description Validates current processing options
   *
   * @returns {Object} Validation result with valid flag and message
   * @private
   * @since 2.1.0
   * @updated Phase 1 Step 5 - Added format availability validation
   */
  validateProcessingOptions() {
    // PHASE 2: Start validation progress
    const formatCount = this.currentProcessingOptions?.formats?.length || 0;
    const formatWord = formatCount === 1 ? "format" : "formats";

    if (this.controller?.progressDisplay) {
      this.controller.progressDisplay.updateStatusDetail(
        `Validating ${formatCount} output ${formatWord}...`
      );
      this.controller.progressDisplay.updateTimingDetail(
        "Format validation in progress..."
      );
    }

    const validationStart = performance.now();

    // Check if processing options exist
    if (!this.currentProcessingOptions) {
      return {
        valid: false,
        message:
          "No processing options available. Please upload a PDF file first.",
      };
    }

    // Check if formats are selected
    if (
      !this.currentProcessingOptions.formats ||
      this.currentProcessingOptions.formats.length === 0
    ) {
      return {
        valid: false,
        message: "Please select at least one output format",
      };
    }

    // PHASE 1 STEP 5: Validate format availability on current endpoint
    const availabilityCheck = this.validateFormatAvailability();
    if (!availabilityCheck.valid) {
      return availabilityCheck;
    }

    // Validate custom page range if selected
    if (this.currentProcessingOptions.page_range === "custom") {
      const customInput = document.getElementById("pdf-page-numbers");
      const customRange = customInput?.value?.trim();

      if (!customRange) {
        return {
          valid: false,
          message:
            "Please specify custom page range or select a different option",
        };
      }

      // Basic validation of page range format
      if (!/^[\d\s,\-]+$/.test(customRange)) {
        return {
          valid: false,
          message:
            "Invalid page range format. Use numbers, commas, and hyphens only (e.g., 1-5, 7, 10-12)",
        };
      }
    }

    // PHASE 2: Validation complete - update progress
    if (this.controller?.progressDisplay) {
      const validationTime = (
        (performance.now() - validationStart) /
        1000
      ).toFixed(1);
      this.controller.progressDisplay.updateStatusDetail(
        `✓ Format validation complete - ${formatCount} ${formatWord} ready`
      );
      this.controller.progressDisplay.updateTimingDetail(
        `Validation completed in ${validationTime}s`
      );
    }

    return { valid: true };
  }

  /**
   * @method buildFinalProcessingOptions
   * @description Builds final processing options for API request
   *
   * Combines page range, format selection, delimiter preferences,
   * and numbering preferences into a complete API request configuration object.
   *
   * @returns {Object} Complete processing options object
   * @returns {string} returns.page_range - Page range to process
   * @returns {Array<string>} returns.formats - Output formats requested
   * @returns {Array<string>} returns.math_inline_delimiters - Inline maths delimiters
   * @returns {Array<string>} returns.math_display_delimiters - Display maths delimiters
   * @returns {boolean} [returns.include_equation_tags] - Include equation numbering
   * @returns {boolean} [returns.idiomatic_eqn_arrays] - Use idiomatic environments
   * @returns {boolean} [returns.auto_number_sections] - Auto-number sections
   * @returns {boolean} [returns.remove_section_numbering] - Remove section numbers
   * @returns {boolean} [returns.preserve_section_numbering] - Keep existing numbers
   *
   * @private
   * @since 2.1.0
   * @updated 5.0.0 - Feature 1: Added delimiter preference integration
   * @updated 5.0.0 - Feature 2: Added numbering preference integration
   */
  buildFinalProcessingOptions() {
    let pageRange = this.currentProcessingOptions.page_range;

    // Handle custom page range
    if (pageRange === "custom") {
      const customInput = document.getElementById("pdf-page-numbers");
      pageRange = customInput?.value?.trim() || "all";
    } else if (pageRange === "first-10") {
      pageRange = "1-10";
    }

    // Collect delimiter preferences (Phase 5, Feature 1)
    const delimiterConfig = this.collectDelimiterPreferences();

    // Collect numbering preferences (Phase 5, Feature 2)
    const numberingConfig = this.collectNumberingPreferences();

    // Combine all processing options
    const finalOptions = {
      page_range: pageRange,
      formats: this.currentProcessingOptions.formats,
      ...delimiterConfig, // Spread delimiter configuration (Feature 1)
      ...numberingConfig, // Spread numbering configuration (Feature 2)
    };

    logDebug("Final processing options built", finalOptions);

    // DEBUG: Log all configurations explicitly
    console.log("🔍 DEBUG [PDF Handler]: Final options for API:", {
      page_range: finalOptions.page_range,
      formats: finalOptions.formats,
      // Feature 1: Delimiters
      math_inline_delimiters: finalOptions.math_inline_delimiters,
      math_display_delimiters: finalOptions.math_display_delimiters,
      // Feature 2: Numbering
      include_equation_tags: finalOptions.include_equation_tags,
      idiomatic_eqn_arrays: finalOptions.idiomatic_eqn_arrays,
      auto_number_sections: finalOptions.auto_number_sections,
      remove_section_numbering: finalOptions.remove_section_numbering,
      preserve_section_numbering: finalOptions.preserve_section_numbering,
    });

    return finalOptions;
  }

  /**
   * @method showPDFProgressInterface
   * @description Shows enhanced PDF processing progress interface and hides options
   *
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  showPDFProgressInterface() {
    const optionsContainer = document.getElementById("mathpix-pdf-options");

    // Hide options container
    if (optionsContainer) {
      optionsContainer.style.display = "none";
    }

    // Initialize enhanced progress system first (Phase 3.1)
    this.initializeEnhancedProgress();

    // Then show the enhanced progress system
    this.showEnhancedProgress();

    logDebug("Enhanced PDF progress interface initialized and shown");
  }

  /**
   * @method hidePDFProgressInterface
   * @description Hides enhanced PDF processing progress interface and shows options
   *
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  hidePDFProgressInterface() {
    const optionsContainer = document.getElementById("mathpix-pdf-options");

    // Hide enhanced progress system (Phase 3.1)
    this.hideEnhancedProgress();

    // Show options container
    if (optionsContainer) {
      optionsContainer.style.display = "block";
    }

    logDebug("Enhanced PDF progress interface hidden");
  }

  /**
   * @method getPDFProgressCallback
   * @description Creates progress callback for PDF processing using enhanced progress system
   *
   * @returns {Object} Progress callback object with enhanced update methods
   * @private
   * @since 2.1.0
   */
  getPDFProgressCallback() {
    // Map of API status messages to enhanced progress stages
    const statusToStageMap = {
      split: "stage1",
      processing: "stage2",
      Converting: "stage3",
      Finalizing: "stage4",
      completed: "stage5",
    };

    return {
      updateTiming: (message) => {
        // Enhanced progress system: Update detailed status and detect stage changes
        logDebug("PDF progress update", { message });

        // Update the enhanced progress system
        if (this.progressState) {
          this.updateDetailedStatus(message);

          // Enhanced status detection based on actual API responses
          const lowerMessage = message.toLowerCase();
          let detectedStage = null;
          let progressPercentage = null;

          // Map actual MathPix API statuses to our stages
          if (
            lowerMessage.includes("loaded") ||
            lowerMessage.includes("upload")
          ) {
            detectedStage = "upload";
            progressPercentage = 20;
          } else if (lowerMessage.includes("split")) {
            detectedStage = "validation";
            progressPercentage = 40;
          } else if (
            lowerMessage.includes("processing") &&
            !lowerMessage.includes("completed")
          ) {
            detectedStage = "processing";
            progressPercentage = 60;
          } else if (
            lowerMessage.includes("convert") ||
            lowerMessage.includes("format")
          ) {
            detectedStage = "processing";
            progressPercentage = 80;
          } else if (lowerMessage.includes("completed")) {
            detectedStage = "download";
            progressPercentage = 100;
          }

          // Extract percent_done from API if available
          const percentMatch = message.match(/(\d+)% done/);
          if (percentMatch) {
            progressPercentage = parseInt(percentMatch[1]);
          }

          if (
            detectedStage &&
            detectedStage !== this.progressState.currentStage
          ) {
            this.updateEnhancedProgress(
              detectedStage,
              progressPercentage,
              message
            );
            logDebug("Enhanced progress stage updated", {
              from: this.progressState.currentStage,
              to: detectedStage,
              progress: progressPercentage,
              message: message.substring(0, 100),
            });
          } else if (progressPercentage !== null) {
            // Update progress even if stage hasn't changed
            this.updateProgressBar(progressPercentage);
          }
        }

        // Fallback: Also update old system for compatibility
        const statusText = document.getElementById("mathpix-pdf-status");
        if (statusText) {
          statusText.textContent = message;
        }
      },

      nextStep: () => {
        // Enhanced progress system: Advance to next stage
        if (this.progressState) {
          const currentIndex = this.progressState.stageIndex;
          const nextIndex = Math.min(
            currentIndex + 1,
            this.progressState.stages.length - 1
          );
          const nextStage = this.progressState.stages[nextIndex];

          if (nextStage && nextStage.id !== this.progressState.currentStage) {
            this.updateEnhancedProgress(nextStage.id);
            logDebug("Enhanced progress: Advanced to next stage", {
              from: this.progressState.currentStage,
              to: nextStage.id,
            });
          }
        }

        // Fallback: Also update old system for compatibility
        const progressFill = document.getElementById(
          "mathpix-pdf-progress-fill"
        );
        if (progressFill) {
          const currentWidth = parseInt(progressFill.style.width) || 0;
          const newWidth = Math.min(currentWidth + 25, 90);
          progressFill.style.width = `${newWidth}%`;
        }
      },

      handleError: (error, context) => {
        logError("PDF processing error", { error, context });

        // Enhanced progress system: Show error state
        if (this.progressState) {
          this.updateDetailedStatus(`Error: ${error.message}`);
          this.updateProgressText(`Processing failed: ${error.message}`);
        }

        // Fallback: Also update old system for compatibility
        const statusText = document.getElementById("mathpix-pdf-status");
        if (statusText) {
          statusText.textContent = `Error: ${error.message}`;
        }
      },
    };
  }

  /**
   * @method initializeEnhancedProgress
   * @description Initializes enhanced progress tracking system with stages, timing, and detailed feedback
   * @returns {void}
   * @since 3.1.0
   */
  initializeEnhancedProgress() {
    this.progressState = {
      startTime: null,
      currentStage: "upload",
      stages: [
        {
          id: "upload",
          name: "Upload",
          duration: 5000,
          icon: "upload",
          messages: [
            "Uploading document...",
            "Validating file format...",
            "Upload complete",
          ],
        },
        {
          id: "validation",
          name: "Validation",
          duration: 3000,
          icon: "search",
          messages: [
            "Analyzing document structure...",
            "Checking compatibility...",
            "Validation complete",
          ],
        },
        {
          id: "queue",
          name: "Queue",
          duration: 2000,
          icon: "hourglass",
          messages: [
            "Entering processing queue...",
            "Waiting for available resources...",
            "Queue position assigned",
          ],
        },
        {
          id: "processing",
          name: "Processing",
          duration: 20000,
          icon: "gear",
          messages: [
            "OCR processing initiated...",
            "Extracting content...",
            "Generating formats...",
            "Processing complete",
          ],
        },
        {
          id: "download",
          name: "Results",
          duration: 4000,
          icon: "inbox",
          messages: [
            "Preparing results...",
            "Finalising formats...",
            "Ready for download",
          ],
        },
      ],
      stageIndex: 0,
      messageIndex: 0,
      estimatedTotal: 34000,
    };

    this.progressTimers = {
      elapsed: null,
      stage: null,
      message: null,
    };

    this.showEnhancedProgress();
    this.startProgressTracking();
  }

  /**
   * @method showEnhancedProgress
   * @description Shows the enhanced progress interface with all components
   * @returns {void}
   * @since 3.1.0
   */
  showEnhancedProgress() {
    const enhancedContainer = document.getElementById("pdf-progress-enhanced");
    const basicContainer = document.getElementById("mathpix-pdf-progress");

    if (enhancedContainer) {
      enhancedContainer.style.display = "block";
      logDebug("Enhanced progress container shown");
    }

    // Hide basic progress to avoid duplication
    if (basicContainer) {
      basicContainer.style.display = "none";
      logDebug("Basic progress container hidden");
    }

    // Initialize progress elements
    this.updateProgressBar(0);
    this.updateProgressText("Initializing processing...");
    this.updateDetailedStatus("Preparing to process your document...");
    this.updateCurrentStage(this.progressState.currentStage);
    this.updateProgressIcon(this.getStageIcon(this.progressState.currentStage));
    this.updateStageIndicators();

    // ✅ ACTION POINT 3: Scroll to start of progress section after clicking process
    // Use instant scroll to avoid jarring rapid movements during multi-step workflow
    if (enhancedContainer) {
      setTimeout(() => {
        enhancedContainer.scrollIntoView({
          behavior: "instant",
          block: "start",
        });
        logDebug("Scrolled to enhanced progress interface");
      }, 150);
    }
  }

  /**
   * @method hideEnhancedProgress
   * @description Hides the enhanced progress interface
   * @returns {void}
   * @since 3.1.0
   */
  hideEnhancedProgress() {
    const enhancedContainer = document.getElementById("pdf-progress-enhanced");

    if (enhancedContainer) {
      enhancedContainer.style.display = "none";
      logDebug("Enhanced progress container hidden");
    }

    // Only stop tracking if it was initialized
    if (this.progressState) {
      this.stopProgressTracking();
    }
  }

  /**
   * @method updateEnhancedProgress
   * @description Updates the enhanced progress system with new stage information
   * @param {string} stage - Current stage identifier
   * @param {number} [progress] - Optional progress percentage (0-100)
   * @param {string} [message] - Optional custom status message
   * @returns {void}
   * @since 3.1.0
   */
  updateEnhancedProgress(stage, progress, message) {
    if (!this.progressState) return;

    // Update current stage if different
    if (stage && stage !== this.progressState.currentStage) {
      this.progressState.currentStage = stage;
      this.progressState.stageIndex = this.progressState.stages.findIndex(
        (s) => s.id === stage
      );
      this.progressState.messageIndex = 0; // Reset message cycling for new stage

      this.updateCurrentStage(stage);
      this.updateProgressIcon(this.getStageIcon(stage));
      this.updateStageIndicators();

      logDebug("Enhanced progress stage updated", {
        stage,
        stageIndex: this.progressState.stageIndex,
      });
    }

    // Update progress bar
    if (typeof progress === "number") {
      this.updateProgressBar(progress);
    }

    // Update status message
    if (message) {
      this.updateDetailedStatus(message);
    }

    // Update time estimation (with safety check)
    try {
      this.updateTimeEstimation();
    } catch (error) {
      logWarn("Time estimation update failed", { error: error.message });
    }
  }

  /**
   * @method updateProgressBar
   * @description Updates the progress bar fill percentage
   * @param {number} percentage - Progress percentage (0-100)
   * @returns {void}
   * @since 3.1.0
   */
  updateProgressBar(percentage) {
    const progressFill = document.getElementById("pdf-progress-fill-enhanced");
    const progressPercentage = document.getElementById(
      "pdf-progress-percentage-enhanced"
    );

    if (progressFill) {
      progressFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    }

    if (progressPercentage) {
      progressPercentage.textContent = `${Math.round(percentage)}%`;
    }
  }

  /**
   * @method updateProgressText
   * @description Updates the main progress text display
   * @param {string} text - Progress text to display
   * @returns {void}
   * @since 3.1.0
   */
  updateProgressText(text) {
    const progressText = document.getElementById("pdf-progress-text-enhanced");
    if (progressText) {
      progressText.textContent = text;
    }
  }

  /**
   * @method updateDetailedStatus
   * @description Updates the detailed status message
   * @param {string} status - Detailed status message
   * @returns {void}
   * @since 3.1.0
   */
  updateDetailedStatus(status) {
    const statusElement = document.getElementById("stage-progress");
    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  /**
   * @method updateCurrentStage
   * @description Updates the current stage display
   * @param {string} stage - Current stage identifier
   * @returns {void}
   * @since 3.1.0
   */
  updateCurrentStage(stage) {
    const stageElement = document.getElementById("current-stage");
    if (stageElement) {
      const stageData = this.progressState.stages.find((s) => s.id === stage);
      if (stageData) {
        stageElement.textContent = stageData.name;
      }
    }
  }

  /**
   * @method updateProgressIcon
   * @description Updates the progress icon display with SVG support
   * @param {string} icon - SVG icon HTML string to display
   * @returns {void}
   * @since 3.1.0
   * @updated 4.1.0 - Changed from textContent to innerHTML for SVG support
   */
  updateProgressIcon(icon) {
    const iconElement = document.getElementById("pdf-progress-icon");
    if (iconElement) {
      iconElement.innerHTML = icon;
    }
  }

  /**
   * @method updateStageIndicators
   * @description Updates the visual stage indicators
   * @returns {void}
   * @since 3.1.0
   */
  updateStageIndicators() {
    if (!this.progressState) return;

    const indicators = document.querySelectorAll(".stage-indicator");
    indicators.forEach((indicator, index) => {
      const stage = this.progressState.stages[index];
      if (stage) {
        indicator.classList.remove("active", "completed");

        if (index < this.progressState.stageIndex) {
          indicator.classList.add("completed");
        } else if (index === this.progressState.stageIndex) {
          indicator.classList.add("active");
        }

        // Update stage name and icon
        const nameElement = indicator.querySelector(".stage-name");
        const iconElement = indicator.querySelector(".stage-icon");

        if (nameElement) nameElement.textContent = stage.name;
        if (iconElement) iconElement.innerHTML = getIcon(stage.icon);
      }
    });
  }

  /**
   * @method getStageIcon
   * @description Gets the SVG icon HTML for a specific stage
   * @param {string} stage - Stage identifier
   * @returns {string} SVG icon HTML string
   * @since 3.1.0
   * @updated 4.1.0 - Returns SVG icon HTML via getIcon()
   */
  getStageIcon(stage) {
    if (!this.progressState) return getIcon("gear");

    const stageData = this.progressState.stages.find((s) => s.id === stage);
    return stageData ? getIcon(stageData.icon) : getIcon("gear");
  }

  /**
   * @method startProgressTracking
   * @description Starts the progress tracking timers and message cycling
   * @returns {void}
   * @since 3.1.0
   */
  startProgressTracking() {
    if (!this.progressState) return;

    this.progressState.startTime = Date.now();

    // Start elapsed time updater
    this.progressTimers.elapsed = setInterval(() => {
      this.updateElapsedTime();
    }, 1000);

    // Start message cycling
    this.progressTimers.message = setInterval(() => {
      this.cycleStageMessage();
    }, 3000);

    logDebug("Progress tracking started");
  }

  /**
   * @method stopProgressTracking
   * @description Stops all progress tracking timers
   * @returns {void}
   * @since 3.1.0
   */
  stopProgressTracking() {
    // Safety check: Only stop tracking if progressState exists
    if (!this.progressState || !this.progressState.intervals) {
      logDebug("Progress tracking stop requested but no active tracking found");
      return;
    }

    // Stop any running intervals
    Object.values(this.progressState.intervals).forEach((intervalId) => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    });

    this.progressState.intervals = {};
    logDebug("Progress tracking stopped");
  }

  /**
   * @method updateElapsedTime
   * @description Updates the elapsed time display
   * @returns {void}
   * @since 3.1.0
   */
  updateElapsedTime() {
    if (!this.progressState || !this.progressState.startTime) return;

    const elapsed = Date.now() - this.progressState.startTime;
    const elapsedElement = document.getElementById("elapsed-time");

    if (elapsedElement) {
      const seconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      if (minutes > 0) {
        elapsedElement.textContent = `${minutes}m ${remainingSeconds}s`;
      } else {
        elapsedElement.textContent = `${seconds}s`;
      }
    }
  }

  /**
   * @method updateTimeEstimation
   * @description Updates the estimated remaining time with safety checks
   * @returns {void}
   * @since 3.1.0
   */
  updateTimeEstimation() {
    if (!this.progressState || !this.progressState.startTime) {
      logDebug("Time estimation skipped: No progress state or start time");
      return;
    }

    const elapsed = Date.now() - this.progressState.startTime;
    const currentStageIndex = this.progressState.stageIndex;
    const stages = this.progressState.stages;

    // Safety checks
    if (!stages || !Array.isArray(stages) || stages.length === 0) {
      logDebug("Time estimation skipped: No stages defined");
      return;
    }

    if (currentStageIndex < 0 || currentStageIndex >= stages.length) {
      logDebug("Time estimation skipped: Invalid stage index", {
        currentStageIndex,
        stagesLength: stages.length,
      });
      return;
    }

    // Calculate remaining time based on stage durations
    let remainingTime = 0;
    for (let i = currentStageIndex; i < stages.length; i++) {
      const stage = stages[i];

      // Safety check for stage object and duration property
      if (!stage || typeof stage.duration !== "number") {
        logWarn("Stage missing or invalid duration", { stageIndex: i, stage });
        continue;
      }

      if (i === currentStageIndex) {
        // For current stage, estimate based on progress within stage
        const stageElapsed = elapsed % stage.duration;
        remainingTime += Math.max(0, stage.duration - stageElapsed);
      } else {
        remainingTime += stage.duration;
      }
    }

    const remainingElement = document.getElementById("remaining-time");
    const estimatedSection = document.getElementById("estimated-remaining");

    if (remainingElement) {
      const seconds = Math.floor(remainingTime / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      if (minutes > 0) {
        remainingElement.textContent = `${minutes}m ${remainingSeconds}s`;
      } else {
        remainingElement.textContent = `${seconds}s`;
      }
    }

    // Show the estimated remaining section if we have a time estimate
    if (estimatedSection && remainingTime > 0) {
      estimatedSection.style.display = "block";
    }
  }

  /**
   * @method cycleStageMessage
   * @description Cycles through stage-specific status messages
   * @returns {void}
   * @since 3.1.0
   */
  cycleStageMessage() {
    if (!this.progressState) return;

    const currentStage =
      this.progressState.stages[this.progressState.stageIndex];
    if (!currentStage || !currentStage.messages) return;

    const message = currentStage.messages[this.progressState.messageIndex];
    if (message) {
      this.updateDetailedStatus(message);
    }

    // Advance to next message (cycle back to start)
    this.progressState.messageIndex =
      (this.progressState.messageIndex + 1) % currentStage.messages.length;
  }

  /**
   * @method completeProgress
   * @description Completes the progress tracking and shows completion state
   * @returns {void}
   * @since 3.1.0
   */
  completeProgress() {
    if (!this.progressState) return;

    // Stop all timers
    this.stopProgressTracking();

    // Set final state
    this.updateProgressBar(100);
    this.updateProgressText("Processing Complete!");
    this.updateDetailedStatus("Your document has been successfully processed.");
    this.updateCurrentStage("download");
    this.updateProgressIcon(getIcon("checkCircle"));

    // Mark all stages as completed
    this.progressState.stageIndex = this.progressState.stages.length - 1;
    this.updateStageIndicators();

    logInfo("Enhanced progress completed");
  }

  /**
   * @method cancelPDFProcessing
   * @description Cancels current PDF processing and resets unified drop zone to initial state
   *
   * UNIFIED DROP ZONE: Resets main drop zone to initial state that supports all file types,
   * ensuring consistent user experience when cancelling PDF processing.
   *
   * @returns {void}
   * @since 2.1.0
   * @updated 2.1.1 - Unified drop zone reset implementation
   */
  cancelPDFProcessing() {
    // Hide PDF options interface
    const pdfOptionsContainer = document.getElementById("mathpix-pdf-options");
    if (pdfOptionsContainer) {
      pdfOptionsContainer.style.display = "none";
    }

    // Reset state
    this.currentPDFFile = null;
    this.currentProcessingOptions = null;
    this.currentPDFId = null;

    // UNIFIED DROP ZONE: Reset main drop zone to initial state
    this.resetDropZoneToInitial();

    this.showNotification("PDF processing cancelled", "info");
    logInfo("PDF processing cancelled by user");
  }

  /**
   * @method displayPDFResults
   * @description Displays PDF processing results using the new result renderer with syntax highlighting
   *
   * @param {Object} results - PDF processing results from API
   * @returns {Promise<void>}
   * @since 2.1.0
   * @updated 3.2.0 - Integrated with MathPixPDFResultRenderer for syntax highlighting
   */
  async displayPDFResults(results) {
    this.currentPDFResults = results;

    // Hide progress interface
    const progressContainer = document.getElementById("mathpix-pdf-progress");
    if (progressContainer) {
      progressContainer.style.display = "none";
    }

    try {
      // Prepare document info for the result renderer
      const documentInfo = {
        name: this.currentPDFFile?.name || "document.pdf",
        size: this.currentPDFFile?.size || 0,
        pageCount: results.processingMetadata?.totalPages || "1",
        pageRange: results.processingMetadata?.pageRange || "1",
      };

      // Use new result renderer with syntax highlighting (Phase 3.2 integration)
      if (this.controller.pdfResultRenderer) {
        logInfo("Using new PDF result renderer with syntax highlighting");
        // Phase 3.4.2 DEBUG: Verify file blob before passing to renderer
        console.log("🔍 DEBUG [Handler]: About to call displayPDFResults", {
          hasResults: !!results,
          hasDocumentInfo: !!documentInfo,
          hasCurrentPDFFile: !!this.currentPDFFile,
          currentPDFFileDetails: this.currentPDFFile
            ? {
                name: this.currentPDFFile.name,
                type: this.currentPDFFile.type,
                size: this.currentPDFFile.size,
                lastModified: this.currentPDFFile.lastModified,
              }
            : null,
        });

        await this.controller.pdfResultRenderer.displayPDFResults(
          results,
          documentInfo,
          this.currentPDFFile
        );

        console.log("🔍 DEBUG [Handler]: displayPDFResults call completed");

        // Set up button event listeners for static HTML buttons (Copy/Download)
        // This is needed because the result renderer creates dynamic buttons,
        // but the MMD panel has static buttons that need handlers
        this.setupResultsInterface();
      } else {
        // Fallback to old method if result renderer unavailable
        logWarn("PDF result renderer not available, using fallback method");
        const resultsContainer = document.getElementById("mathpix-pdf-results");
        if (resultsContainer) {
          resultsContainer.style.display = "block";
          this.populatePDFResults(results);
        }
      }

      this.showNotification(
        "PDF processing completed successfully!",
        "success"
      );
      logInfo("PDF results displayed", {
        availableFormats: Object.keys(results),
        fileName: this.currentPDFFile?.name,
        usedResultRenderer: !!this.controller.pdfResultRenderer,
      });
    } catch (error) {
      logError("Failed to display PDF results", {
        error: error.message,
        fileName: this.currentPDFFile?.name,
      });

      // Fallback to old method on error
      logWarn("Falling back to old result display method");
      const resultsContainer = document.getElementById("mathpix-pdf-results");
      if (resultsContainer) {
        resultsContainer.style.display = "block";
        this.populatePDFResults(results);
      }

      this.showNotification(
        "PDF processing completed (basic display)",
        "success"
      );
    }
  }

  /**
   * @method populatePDFResults
   * @description Populates PDF results interface with processing data
   *
   * @param {Object} results - PDF processing results
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  populatePDFResults(results) {
    // Update document information
    const docName = document.getElementById("mathpix-doc-name");
    const docPages = document.getElementById("mathpix-doc-pages");
    const docTime = document.getElementById("mathpix-doc-time");
    const docFormats = document.getElementById("mathpix-doc-formats");

    if (docName && this.currentPDFFile) {
      docName.textContent = this.currentPDFFile.name;
    }
    // Get metadata from processing results
    const metadata = results.processingMetadata || {};

    if (docPages) {
      // Use metadata or estimate from processing
      const pages = metadata.totalPages || "1"; // Default for single-page PDFs
      docPages.textContent = pages;
    }

    if (docTime && metadata.totalTime) {
      // Convert milliseconds to seconds and format nicely
      const seconds = Math.round(metadata.totalTime / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      if (minutes > 0) {
        docTime.textContent = `${minutes}m ${remainingSeconds}s`;
      } else {
        docTime.textContent = `${seconds}s`;
      }
    }
    if (docFormats) {
      const formatDisplayNames = {
        mmd: "MMD",
        html: "HTML",
        "tex.zip": "LaTeX",
        docx: "DOCX",
      };

      const availableFormats = Object.keys(results)
        .filter((key) => key !== "processingMetadata" && results[key])
        .map((key) => formatDisplayNames[key] || key.toUpperCase())
        .filter(Boolean);

      docFormats.textContent = availableFormats.join(", ");
      console.log(`📋 Available formats: ${availableFormats.join(", ")}`);
    }

    // Populate format content
    this.populateFormatTabs(results);

    // Set up tab switching and export functionality
    this.setupResultsInterface();
  }

  /**
   * @method populateFormatTabs
   * @description Populates format tabs with processing results
   *
   * @param {Object} results - PDF processing results
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  populateFormatTabs(results) {
    // Map UI format names to result keys
    const formatMapping = {
      mmd: "mmd",
      html: "html",
      latex: "tex.zip", // Key fix: map latex UI to tex.zip result key
      docx: "docx",
    };

    const formats = ["mmd", "html", "latex", "docx"];

    formats.forEach((format) => {
      const resultKey = formatMapping[format];
      const contentElement = document.getElementById(
        `mathpix-pdf-content-${format}`
      );
      const tabButton = document.getElementById(`tab-${format}`);

      // Check if result exists (handle both text content and binary blobs)
      const hasResult =
        results[resultKey] &&
        ((typeof results[resultKey] === "string" &&
          results[resultKey].trim()) ||
          (results[resultKey] instanceof Blob && results[resultKey].size > 0) ||
          (typeof results[resultKey] === "object" && results[resultKey]));

      // Check if result exists (handle both text content and binary blobs)
      const resultExists = !!results[resultKey];
      const hasValidContent =
        resultExists &&
        ((typeof results[resultKey] === "string" &&
          results[resultKey].trim()) ||
          (results[resultKey] instanceof Blob && results[resultKey].size > 0) ||
          (typeof results[resultKey] === "object" && results[resultKey]));

      console.log(`🔍 Format ${format} check:`, {
        resultKey,
        resultExists,
        hasValidContent,
        type: typeof results[resultKey],
        size: results[resultKey]?.size || results[resultKey]?.length || "N/A",
        isBlob: results[resultKey] instanceof Blob,
      });

      if (resultExists && hasValidContent && contentElement) {
        // Show tab button
        if (tabButton) {
          tabButton.style.display = "block";
          console.log(
            `✅ Showing ${format} tab (found ${resultKey}: ${typeof results[
              resultKey
            ]})`
          );
        }

        // Populate content based on format
        if (format === "docx") {
          // DOCX is handled differently (download only)
          contentElement.textContent = "DOCX format ready for download";
        } else if (format === "latex") {
          // For LaTeX, show that it's a zip file download
          contentElement.textContent =
            "LaTeX files generated. Use download button to get ZIP file with .tex and images.";
        } else {
          contentElement.textContent = results[resultKey];

          // Update HTML line count and preview controls for HTML format
          if (format === "html") {
            this.updateHTMLLineCount(results[resultKey]);
          }
        }
      } else {
        // Hide tab button if format not available
        if (tabButton) {
          tabButton.style.display = "none";
          console.log(
            `❌ Hiding ${format} tab: exists=${resultExists}, valid=${hasValidContent}, element=${!!contentElement}`
          );
        }
      }
    });
  }

  /**
   * @method setupResultsInterface
   * @description Sets up results interface interactions (tabs, exports, etc.)
   *
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  setupResultsInterface() {
    // CRITICAL FIX: Remove existing event listeners to prevent duplicates
    this.removeExistingListeners();

    // Set up HTML preview toggle functionality
    this.setupHTMLPreviewToggle();

    // Set up tab switching
    const tabHeaders = document.querySelectorAll(".mathpix-tab-header");
    tabHeaders.forEach((tab) => {
      const clickHandler = (e) => {
        this.switchResultTab(e.target.id.replace("tab-", ""));
      };
      tab.addEventListener("click", clickHandler);
      // Store handler reference for cleanup
      tab._mathpixClickHandler = clickHandler;
    });

    // Set up export buttons
    const copyButtons = document.querySelectorAll(
      ".mathpix-copy-btn[data-format]"
    );
    const downloadButtons = document.querySelectorAll(
      ".mathpix-download-btn[data-format]"
    );
    const previewButtons = document.querySelectorAll(
      ".mathpix-preview-btn[data-format]"
    );

    copyButtons.forEach((btn) => {
      const clickHandler = () => {
        this.copyFormatContent(btn.getAttribute("data-format"));
      };
      btn.addEventListener("click", clickHandler);
      // Store handler reference for cleanup
      btn._mathpixClickHandler = clickHandler;
    });

    downloadButtons.forEach((btn) => {
      const clickHandler = () => {
        const format = btn.getAttribute("data-format");
        const action = btn.getAttribute("data-action");

        // Check if this is a copy button disguised as download button
        if (action === "copy") {
          this.copyFormatContent(format);
        } else {
          this.downloadFormatContent(format);
        }
      };
      btn.addEventListener("click", clickHandler);
      // Store handler reference for cleanup
      btn._mathpixClickHandler = clickHandler;
    });

    previewButtons.forEach((btn) => {
      const clickHandler = () => {
        this.previewFormatContent(btn.getAttribute("data-format"));
      };
      btn.addEventListener("click", clickHandler);
      // Store handler reference for cleanup
      btn._mathpixClickHandler = clickHandler;
    });

    // Set up final action buttons
    const processAnotherBtn = document.getElementById(
      "mathpix-process-another-pdf"
    );
    const clearResultsBtn = document.getElementById(
      "mathpix-clear-pdf-results"
    );

    if (processAnotherBtn) {
      const clickHandler = () => {
        this.processAnotherPDF();
      };
      processAnotherBtn.addEventListener("click", clickHandler);
      processAnotherBtn._mathpixClickHandler = clickHandler;
    }

    if (clearResultsBtn) {
      const clickHandler = () => {
        this.clearPDFResults();
      };
      clearResultsBtn.addEventListener("click", clickHandler);
      clearResultsBtn._mathpixClickHandler = clickHandler;
    }

    logDebug(
      "Results interface setup completed with duplicate prevention and HTML preview toggle"
    );
  }

  /**
   * @method setupHTMLPreviewToggle
   * @description Sets up HTML content collapse/expand functionality with animations
   * @returns {void}
   * @since 3.1.0
   */
  setupHTMLPreviewToggle() {
    const controls = document.querySelector(".html-preview-controls");
    const toggleButton = document.getElementById("html-expand-toggle");
    const toggleIcon = document.getElementById("html-toggle-icon");
    const toggleText = document.getElementById("html-toggle-text");
    const visibleLinesSpan = document.getElementById("html-visible-lines");
    const totalLinesSpan = document.getElementById("html-total-lines");
    const sizeInfo = document.getElementById("html-size-info");
    const contentSummary = document.getElementById("html-content-summary");

    if (!toggleButton || !controls) {
      logWarn("HTML preview toggle elements not found");
      return;
    }

    let isExpanded = false;
    this.htmlToggleState = {
      isExpanded,
      controls,
      toggleButton,
      toggleIcon,
      toggleText,
    };

    toggleButton.addEventListener("click", () => {
      this.toggleHTMLPreview();
    });

    logDebug("HTML preview toggle functionality initialized");
  }

  /**
   * @method toggleHTMLPreview
   * @description Toggles HTML preview expand/collapse state with smooth animation
   * @returns {void}
   * @since 3.1.0
   */
  toggleHTMLPreview() {
    if (!this.htmlToggleState) return;

    const { toggleButton, toggleIcon, toggleText } = this.htmlToggleState;
    const htmlContentElement = document.getElementById("mathpix-content-html");
    if (!htmlContentElement) return;

    const container =
      htmlContentElement.closest(".mathpix-format-panel") ||
      htmlContentElement.parentElement;
    if (!container) return;

    this.htmlToggleState.isExpanded = !this.htmlToggleState.isExpanded;
    const { isExpanded } = this.htmlToggleState;

    // Update ARIA and visual states
    toggleButton.setAttribute("aria-expanded", isExpanded.toString());

    if (isExpanded) {
      container.classList.remove("html-content-collapsed");
      container.classList.add("html-content-expanded");
      toggleText.textContent = "Show Less";
      this.updateHTMLVisibleLines("full");
    } else {
      container.classList.remove("html-content-expanded");
      container.classList.add("html-content-collapsed");
      toggleText.textContent = "Show Full Content";
      this.updateHTMLVisibleLines("preview");
    }

    // Smooth scroll to top of content when collapsing
    if (!isExpanded) {
      container.scrollIntoView({ behavior: "instant", block: "start" });
    }

    logDebug("HTML preview toggled", { expanded: isExpanded });
  }

  /**
   * @method updateHTMLLineCount
   * @description Updates line count and content analysis for HTML preview
   * @param {string} content - HTML content to analyze
   * @returns {void}
   * @since 3.1.0
   */
  updateHTMLLineCount(content) {
    const controls = document.querySelector(".html-preview-controls");
    const totalLinesSpan = document.getElementById("html-total-lines");
    const sizeInfo = document.getElementById("html-size-info");
    const contentSummary = document.getElementById("html-content-summary");

    if (!content || !controls) return;

    // Analyze content
    const lines = content.split("\n");
    const lineCount = lines.length;
    const sizeKB = (new Blob([content]).size / 1024).toFixed(1);

    // Content analysis
    const analysis = this.analyzeHTMLContent(content);

    // Update displays
    if (totalLinesSpan) totalLinesSpan.textContent = lineCount.toString();
    if (sizeInfo) sizeInfo.textContent = `${sizeKB} KB`;
    if (contentSummary) contentSummary.textContent = analysis.summary;

    // Show controls if content is substantial
    if (lineCount > 10) {
      controls.style.display = "block";
      this.initializeHTMLContentContainer();
      this.updateHTMLVisibleLines("preview");
    } else {
      controls.style.display = "none";
    }

    logDebug("HTML content analyzed", { lineCount, sizeKB, analysis });
  }

  /**
   * @method analyzeHTMLContent
   * @description Analyzes HTML content to provide summary information
   * @param {string} content - HTML content to analyze
   * @returns {Object} Analysis results
   * @since 3.1.0
   */
  analyzeHTMLContent(content) {
    const elements = [];

    // Basic HTML element counting
    const patterns = {
      "math elements": /<mjx-container|<span class="math-/g,
      tables: /<table/g,
      images: /<img/g,
      headings: /<h[1-6]/g,
      paragraphs: /<p>/g,
    };

    Object.entries(patterns).forEach(([name, pattern]) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        elements.push(`${matches.length} ${name}`);
      }
    });

    return {
      summary: elements.length > 0 ? elements.join(", ") : "HTML structure",
      elementCounts: elements,
    };
  }

  /**
   * @method initializeHTMLContentContainer
   * @description Sets up the HTML content container for collapse/expand
   * @returns {void}
   * @since 3.1.0
   */
  initializeHTMLContentContainer() {
    const htmlContentElement = document.getElementById("mathpix-content-html");
    if (!htmlContentElement) return;

    const container =
      htmlContentElement.closest(".mathpix-format-panel") ||
      htmlContentElement.parentElement;
    if (!container) return;

    // Add container classes and fade overlay
    container.classList.add("html-content-container", "html-content-collapsed");

    // Add fade overlay if not present
    if (!container.querySelector(".html-fade-overlay")) {
      const fadeOverlay = document.createElement("div");
      fadeOverlay.className = "html-fade-overlay";
      container.appendChild(fadeOverlay);
    }
  }

  /**
   * @method updateHTMLVisibleLines
   * @description Updates the visible lines counter
   * @param {string} mode - 'preview' or 'full'
   * @returns {void}
   * @since 3.1.0
   */
  updateHTMLVisibleLines(mode) {
    const visibleLinesSpan = document.getElementById("html-visible-lines");
    const totalLinesSpan = document.getElementById("html-total-lines");

    if (!visibleLinesSpan || !totalLinesSpan) return;

    const totalLines = parseInt(totalLinesSpan.textContent) || 0;

    if (mode === "full") {
      visibleLinesSpan.textContent = totalLines.toString();
    } else {
      visibleLinesSpan.textContent = Math.min(10, totalLines).toString();
    }
  }

  /**
   * @method removeExistingListeners
   * @description Removes existing event listeners to prevent duplicates
   *
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  removeExistingListeners() {
    // Remove tab header listeners
    const tabHeaders = document.querySelectorAll(".mathpix-tab-header");
    tabHeaders.forEach((tab) => {
      if (tab._mathpixClickHandler) {
        tab.removeEventListener("click", tab._mathpixClickHandler);
        delete tab._mathpixClickHandler;
      }
    });

    // Remove export button listeners
    const exportButtons = document.querySelectorAll(
      ".mathpix-copy-btn[data-format], .mathpix-download-btn[data-format], .mathpix-preview-btn[data-format]"
    );
    exportButtons.forEach((btn) => {
      if (btn._mathpixClickHandler) {
        btn.removeEventListener("click", btn._mathpixClickHandler);
        delete btn._mathpixClickHandler;
      }
    });

    // Remove final action button listeners
    const finalActionButtons = [
      document.getElementById("mathpix-process-another-pdf"),
      document.getElementById("mathpix-clear-pdf-results"),
    ];
    finalActionButtons.forEach((btn) => {
      if (btn && btn._mathpixClickHandler) {
        btn.removeEventListener("click", btn._mathpixClickHandler);
        delete btn._mathpixClickHandler;
      }
    });

    logDebug("Existing event listeners removed");
  }

  /**
   * @method switchResultTab
   * @description Switches active result tab
   *
   * @param {string} format - Format to switch to
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  switchResultTab(format) {
    // Update tab headers
    const tabHeaders = document.querySelectorAll(".mathpix-tab-header");
    tabHeaders.forEach((tab) => {
      const isActive = tab.id === `tab-${format}`;
      tab.setAttribute("aria-selected", isActive.toString());
    });

    // Update tab panels
    const tabPanels = document.querySelectorAll(".mathpix-tab-panel");
    tabPanels.forEach((panel) => {
      const isActive = panel.id === `panel-${format}`;
      panel.classList.toggle("active", isActive);
    });

    logDebug("Result tab switched", { format });
  }

  /**
   * @method copyFormatContent
   * @description Copies format content to clipboard
   *
   * @param {string} format - Format to copy
   * @returns {Promise<void>}
   * @private
   * @since 2.1.0
   */
  async copyFormatContent(format) {
    // Map UI format names to result keys (same as populateFormatTabs)
    const formatMapping = {
      mmd: "mmd",
      html: "html",
      latex: "tex.zip", // Key fix: map latex UI to tex.zip result key
      docx: "docx",
    };

    const resultKey = formatMapping[format];
    if (!this.currentPDFResults || !this.currentPDFResults[resultKey]) {
      this.showNotification("No content available to copy", "error");
      logError("Copy failed - no content", {
        format,
        resultKey,
        hasResults: !!this.currentPDFResults,
      });
      return;
    }

    try {
      const content = this.currentPDFResults[resultKey];
      if (typeof content !== "string") {
        this.showNotification(
          "Cannot copy non-text content to clipboard",
          "error"
        );
        return;
      }

      await navigator.clipboard.writeText(content);
      this.showNotification(
        MATHPIX_CONFIG.PDF_MESSAGES.PDF_COPY_SUCCESS,
        "success"
      );
      logInfo("Format content copied", { format, resultKey });
    } catch (error) {
      logError("Failed to copy content", error);
      this.showNotification("Failed to copy content to clipboard", "error");
    }
  }

  /**
   * @method downloadFormatContent
   * @description Downloads format content as file
   *
   * @param {string} format - Format to download
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  downloadFormatContent(format) {
    // Map UI format names to result keys (same as populateFormatTabs)
    const formatMapping = {
      mmd: "mmd",
      html: "html",
      latex: "tex.zip", // Key fix: map latex UI to tex.zip result key
      docx: "docx",
    };

    const resultKey = formatMapping[format];

    // Handle DOCX specially first (requires PDF ID)
    if (format === "docx") {
      this.downloadDOCXFromAPI();
      return;
    }

    if (!this.currentPDFResults || !this.currentPDFResults[resultKey]) {
      this.showNotification("No content available for download", "error");
      logError("Download failed - no content", {
        format,
        resultKey,
        hasResults: !!this.currentPDFResults,
      });
      return;
    }

    try {
      const content = this.currentPDFResults[resultKey];
      const filename = this.generateDownloadFilename(format);

      let blob, mimeType;

      // Handle different format types
      switch (format) {
        case "mmd":
          blob = new Blob([content], { type: "text/markdown" });
          mimeType = "text/markdown";
          break;
        case "html":
          blob = new Blob([content], { type: "text/html" });
          mimeType = "text/html";
          break;
        case "latex":
          // For LaTeX, content is a ZIP file (tex.zip), treat as binary
          if (typeof content === "string") {
            // Convert string to binary for ZIP download
            const bytes = new Uint8Array(content.length);
            for (let i = 0; i < content.length; i++) {
              bytes[i] = content.charCodeAt(i);
            }
            blob = new Blob([bytes], { type: "application/zip" });
          } else {
            blob = new Blob([content], { type: "application/zip" });
          }
          mimeType = "application/zip";
          break;
        default:
          blob = new Blob([content], { type: "text/plain" });
          mimeType = "text/plain";
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);

      this.showNotification(
        MATHPIX_CONFIG.PDF_MESSAGES.PDF_DOWNLOAD_SUCCESS,
        "success"
      );
      logInfo("Format content downloaded", { format, resultKey, filename });
    } catch (error) {
      logError("Failed to download content", error);
      this.showNotification(
        MATHPIX_CONFIG.PDF_MESSAGES.PDF_EXPORT_ERROR,
        "error"
      );
    }
  }

  /**
   * @method downloadDOCXFromAPI
   * @description Downloads DOCX file via API endpoint
   *
   * @returns {Promise<void>}
   * @private
   * @since 2.1.0
   */
  async downloadDOCXFromAPI() {
    if (!this.currentPDFId) {
      this.showNotification(
        "No document ID available for DOCX download",
        "error"
      );
      return;
    }

    try {
      const docxBlob = await this.controller.apiClient.downloadPDFFormat(
        this.currentPDFId,
        "docx"
      );
      const filename = this.generateDownloadFilename("docx");

      const url = URL.createObjectURL(docxBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);

      this.showNotification(
        MATHPIX_CONFIG.PDF_MESSAGES.PDF_DOWNLOAD_SUCCESS,
        "success"
      );
      logInfo("DOCX file downloaded via API", { filename });
    } catch (error) {
      logError("Failed to download DOCX via API", error);
      this.showNotification("Failed to download DOCX file", "error");
    }
  }

  /**
   * @method generateDownloadFilename
   * @description Generates appropriate filename for downloads
   *
   * @param {string} format - Format type
   * @returns {string} Generated filename
   * @private
   * @since 2.1.0
   */
  generateDownloadFilename(format) {
    const baseName = this.currentPDFFile
      ? this.currentPDFFile.name.replace(/\.pdf$/i, "")
      : "mathpix-result";

    const extensions = {
      mmd: ".md",
      html: ".html",
      latex: ".zip", // FIXED: LaTeX format is actually a ZIP file, not .tex
      docx: ".docx",
    };

    const extension = extensions[format] || ".txt";
    return `${baseName}-mathpix${extension}`;
  }

  /**
   * @method previewFormatContent
   * @description Previews format content (HTML only)
   *
   * @param {string} format - Format to preview
   * @returns {void}
   * @private
   * @since 2.1.0
   */
  previewFormatContent(format) {
    if (format !== "html") {
      this.showNotification(
        "Preview is only available for HTML format",
        "info"
      );
      return;
    }

    if (!this.currentPDFResults || !this.currentPDFResults.html) {
      this.showNotification("No HTML content available for preview", "error");
      return;
    }

    const previewArea = document.getElementById("mathpix-html-preview-area");
    const previewFrame = document.getElementById("mathpix-html-preview-frame");

    if (previewArea && previewFrame) {
      previewFrame.innerHTML = this.currentPDFResults.html;
      previewArea.style.display = "block";

      // Scroll preview area into view
      previewArea.scrollIntoView({ behavior: "instant", block: "start" });

      logInfo("HTML preview displayed");
    }
  }

  /**
   * @method processAnotherPDF
   * @description Resets interface to process another PDF with unified drop zone
   *
   * UNIFIED DROP ZONE: Resets main drop zone to initial state that supports all file types,
   * ensuring users can upload any supported file type after PDF processing completion.
   *
   * @returns {void}
   * @since 2.1.0
   * @updated 2.1.1 - Unified drop zone reset implementation
   */
  processAnotherPDF() {
    // Hide results interface
    const resultsContainer = document.getElementById("mathpix-pdf-results");
    if (resultsContainer) {
      resultsContainer.style.display = "none";
    }

    // ✅ FIX: Hide PDF-specific interface to return to unified upload state
    const pdfInterface = document.getElementById("mathpix-pdf-interface");
    if (pdfInterface) {
      pdfInterface.style.display = "none";
      logDebug("PDF interface hidden for unified upload state");
    }

    // Hide PDF options interface
    const pdfOptions = document.getElementById("mathpix-pdf-options");
    if (pdfOptions) {
      pdfOptions.style.display = "none";
      logDebug("PDF options hidden");
    }

    // ✅ FIX: Show main image interface for unified upload
    const imageInterface = document.getElementById("mathpix-main-interface");
    if (imageInterface) {
      imageInterface.style.display = "block";
      logDebug("Main image interface shown for unified uploads");
    }

    // Reset state
    this.currentPDFFile = null;
    this.currentProcessingOptions = null;
    this.currentPDFId = null;
    this.currentPDFResults = null;

    // UNIFIED DROP ZONE: Reset main drop zone to initial state
    this.resetDropZoneToInitial();

    this.showNotification("Ready for new upload", "info");
    logInfo("Interface reset to unified upload state");
  }

  /**
   * @method resetDropZoneToInitial
   * @description Resets the main drop zone to initial state supporting all file types
   *
   * UNIFIED DROP ZONE: Central method for resetting drop zone state to initial configuration.
   * Used by cancel, reset, and completion workflows to ensure consistent user experience.
   *
   * @returns {void}
   * @private
   * @since 2.1.1
   */
  resetDropZoneToInitial() {
    const mainDropZone = document.getElementById("mathpix-drop-zone");
    const pdfUploadContainer = document.querySelector(
      ".mathpix-pdf-upload-container"
    );

    // Show the PDF upload container again when resetting
    if (pdfUploadContainer) {
      pdfUploadContainer.style.display = "block";
      logDebug("PDF upload container shown for reset");
    }

    // Reset main drop zone to initial state
    if (mainDropZone) {
      const instructions = mainDropZone.querySelector("p");
      if (instructions) {
        // FIXED: No outer <p> wrapper - we're already setting innerHTML of the <p> element
        instructions.innerHTML = `
                <svg
                  aria-hidden="true"
                  height="40"
                  width="40"
                  viewBox="0 0 21 21"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g
                    fill="none"
                    fill-rule="evenodd"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    transform="translate(2 4)"
                  >
                    <path
                      d="m15.5 4.5c.000802-1.10737712-.8946285-2.00280762-1.999198-2.00280762l-5.000802.00280762-2-2h-4c-.55228475 0-1 .44771525-1 1v.99719238 2.00280762"
                    />
                    <path
                      d="m.81056316 5.74177845 1.31072322 5.24326075c.22257179.8903496 1.02254541 1.5149608 1.94029301 1.5149608h8.87667761c.9177969 0 1.7178001-.6246768 1.9403251-1.5150889l1.3108108-5.24508337c.1339045-.53580596-.1919011-1.07871356-.727707-1.21261805-.079341-.0198283-.1608148-.02983749-.2425959-.02983749l-13.43852073.00188666c-.55228474.00007754-.99985959.44785564-.99985959 1.00014038 0 .08170931.01003737.16310922.02985348.24237922z"
                    />
                  </g>
                </svg>
                Drop image or PDF here, or click to select
                <br />
                <span class="help-text">Supports: JPEG, PNG, WebP, PDF (max 10MB)</span>
      `;
        logDebug("Main drop zone reset to initial state");
      }
    } else {
      logWarn("Main drop zone not found for reset");
    }
  }
  /**
   * @method clearPDFResults
   * @description Clears current PDF results and shows options
   *
   * @returns {void}
   * @since 2.1.0
   */
  clearPDFResults() {
    // Hide results interface
    const resultsContainer = document.getElementById("mathpix-pdf-results");
    if (resultsContainer) {
      resultsContainer.style.display = "none";
    }

    // Show options interface if we still have a file
    if (this.currentPDFFile) {
      const optionsContainer = document.getElementById("mathpix-pdf-options");
      if (optionsContainer) {
        optionsContainer.style.display = "block";
      }
    }

    // Clear results but keep file and options
    this.currentPDFResults = null;
    this.currentPDFId = null;

    this.showNotification("Results cleared", "info");
    logInfo("PDF results cleared");
  }

  /**
   * @method updateFormatAvailability
   * @description Updates format checkbox states based on endpoint feature availability
   *
   * Disables format checkboxes for features not available on current endpoint
   * and adds helpful tooltips explaining why formats are unavailable.
   *
   * @returns {void}
   * @since Phase 1 Step 5
   * @accessibility Maintains keyboard navigation and screen reader support
   */
  updateFormatAvailability() {
    // Get current endpoint configuration
    const currentEndpoint = this.controller.apiClient?.currentEndpoint || "EU";
    const endpointConfig = this.controller.apiClient?.getEndpointConfig();

    if (!endpointConfig) {
      logWarn("Cannot update format availability: endpoint config unavailable");
      return;
    }

    // PHASE 2: Start format availability check
    if (this.controller?.progressDisplay) {
      this.controller.progressDisplay.updateStatusDetail(
        `Checking format availability on ${endpointConfig.name} endpoint...`
      );
      this.controller.progressDisplay.updateTimingDetail(
        "Updating format options..."
      );
    }

    logDebug("Updating format availability", {
      endpoint: currentEndpoint,
      config: endpointConfig,
    });

    // Format mapping: checkbox ID suffix -> API feature name
    // Maps all PDF format checkboxes to their required API features
    const formatFeatureMap = {
      // Basic formats (require only 'pdf' feature - available on all endpoints)
      mmd: "pdf", // Markdown Math Document
      md: "pdf", // Markdown
      html: "pdf", // HTML
      mmdzip: "pdf", // MMD ZIP archive
      mdzip: "pdf", // Markdown ZIP archive
      htmlzip: "pdf", // HTML ZIP archive
      latex: "pdf", // LaTeX source ZIP - basic PDF processing
      pdf: "pdf", // PDF with HTML rendering - basic PDF processing

      // Advanced formats (require specific features - may be endpoint-restricted)
      latexpdf: "latex_pdf", // PDF with LaTeX rendering - ONLY this requires latex_pdf
      docx: "docx", // Microsoft Word
      pptx: "docx", // Microsoft PowerPoint (uses same feature gate as DOCX)
    };

    const totalFormats = Object.keys(formatFeatureMap).length;
    let checkedFormats = 0;
    let availableCount = 0;
    let unavailableCount = 0;

    Object.entries(formatFeatureMap).forEach(([format, featureName]) => {
      const checkbox = document.getElementById(`pdf-format-${format}`);
      if (!checkbox) {
        logWarn(`Format checkbox not found: pdf-format-${format}`);
        return;
      }

      const isAvailable =
        this.controller.apiClient.isFeatureAvailable(featureName);

      // Don't disable MMD (always required)
      if (format === "mmd") {
        checkbox.disabled = false;
        checkbox.checked = true;
        logDebug("MMD format always enabled (required)");
        availableCount++;
        checkedFormats++;
        return;
      }

      if (!isAvailable) {
        // Disable unavailable formats
        checkbox.disabled = true;
        checkbox.checked = false;
        unavailableCount++;

        // Add visual indicator with styled message span
        const label = checkbox.closest(".mathpix-format-checkbox");
        if (label) {
          label.classList.add("format-unavailable");

          // Create explanatory message text
          const messageText = `Not available on ${endpointConfig.name}. Switch to US endpoint to enable.`;

          // Check if message span already exists
          let messageSpan = label.querySelector(".format-unavailable-message");
          if (!messageSpan) {
            // Create new message span
            messageSpan = document.createElement("span");
            messageSpan.className = "format-unavailable-message";

            // Insert after format-description within format-content
            const formatContent = label.querySelector(".format-content");
            if (formatContent) {
              formatContent.appendChild(messageSpan);
            }
          }

          // Update message text
          messageSpan.textContent = messageText;

          // Add ARIA label for screen readers (keep for accessibility)
          checkbox.setAttribute(
            "aria-label",
            `${format.toUpperCase()} format (unavailable on ${
              endpointConfig.name
            } endpoint)`
          );
        }

        logDebug(
          `Format ${format} disabled (unavailable on ${currentEndpoint})`,
          {
            featureName,
            endpoint: currentEndpoint,
          }
        );
      } else {
        // Enable available formats
        checkbox.disabled = false;
        availableCount++;

        // Remove unavailable indicator and message
        const label = checkbox.closest(".mathpix-format-checkbox");
        if (label) {
          label.classList.remove("format-unavailable");

          // Remove any unavailability message span
          const existingMessage = label.querySelector(
            ".format-unavailable-message"
          );
          if (existingMessage) {
            existingMessage.remove();
          }

          // Update ARIA label
          checkbox.setAttribute("aria-label", `${format.toUpperCase()} format`);
        }

        logDebug(`Format ${format} enabled (available on ${currentEndpoint})`);
      }

      checkedFormats++;
    });

    // Update selected formats to reflect availability changes
    this.updateSelectedFormats();

    // ✅ STEP 3 ENHANCEMENT: Immediately synchronize Select All state after availability changes
    this.updateSelectAllState();

    // Show informational message if any formats are unavailable
    const unavailableFormats = Object.entries(formatFeatureMap)
      .filter(
        ([format, feature]) =>
          format !== "mmd" &&
          !this.controller.apiClient.isFeatureAvailable(feature)
      )
      .map(([format]) => format.toUpperCase());

    // PHASE 2: Update progress with final availability status
    if (this.controller?.progressDisplay) {
      if (unavailableFormats.length > 0) {
        this.controller.progressDisplay.updateStatusDetail(
          `✓ Format check complete: ${availableCount} available, ${unavailableCount} unavailable on ${endpointConfig.name}`
        );
        this.controller.progressDisplay.updateTimingDetail(
          `${unavailableFormats.join(", ")} not supported on this endpoint`
        );
      } else {
        this.controller.progressDisplay.updateStatusDetail(
          `✓ All ${totalFormats} formats available on ${endpointConfig.name} endpoint`
        );
        this.controller.progressDisplay.updateTimingDetail(
          "Ready to configure processing options"
        );
      }
    }

    if (unavailableFormats.length > 0 && endpointConfig) {
      logInfo("Some formats unavailable on current endpoint", {
        unavailableFormats,
        endpoint: endpointConfig.name,
        suggestion: "Switch to US endpoint for full format support",
      });
    }
  }

  /**
   * @method validateFormatAvailability
   * @description Validates that selected formats are available on current endpoint
   *
   * Called during processing options validation to prevent submission of
   * requests for unavailable features.
   *
   * @returns {Object} Validation result with valid flag and message
   * @returns {boolean} returns.valid - Whether all selected formats are available
   * @returns {string} returns.message - Error message if validation fails
   * @private
   * @since Phase 1 Step 5
   */
  validateFormatAvailability() {
    if (!this.controller.apiClient || !this.currentProcessingOptions) {
      return { valid: true }; // Skip validation if controller not ready
    }

    const selectedFormats = this.currentProcessingOptions.formats || [];
    const currentEndpoint = this.controller.apiClient.currentEndpoint || "EU";
    const endpointConfig = this.controller.apiClient.getEndpointConfig();
    const endpointName = endpointConfig ? endpointConfig.name : currentEndpoint;

    // PHASE 2: Update progress with endpoint information
    if (this.controller?.progressDisplay) {
      this.controller.progressDisplay.updateStatusDetail(
        `Checking format availability on ${endpointName} endpoint...`
      );
    }

    // Format mapping: API format name -> feature name for availability check
    const formatFeatureMap = {
      mmd: "pdf",
      html: "pdf",
      latex: "latex_pdf",
      docx: "docx",
    };

    const unavailableFormats = [];

    for (const format of selectedFormats) {
      const featureName = formatFeatureMap[format];
      if (!featureName) {
        logWarn(`Unknown format in validation: ${format}`);
        continue;
      }

      // MMD and HTML are always available (basic PDF processing)
      if (format === "mmd" || format === "html") {
        continue;
      }

      const isAvailable =
        this.controller.apiClient.isFeatureAvailable(featureName);
      if (!isAvailable) {
        unavailableFormats.push(format.toUpperCase());
        logWarn(`Selected format not available: ${format}`, {
          featureName,
          endpoint: currentEndpoint,
        });
      }
    }

    if (unavailableFormats.length > 0) {
      const formatList = unavailableFormats.join(", ");

      // PHASE 2: Update progress with validation issue
      if (this.controller?.progressDisplay) {
        this.controller.progressDisplay.updateStatusDetail(
          `⚠ Format validation issue: ${formatList} unavailable on ${endpointName}`
        );
      }

      return {
        valid: false,
        message:
          `The following formats are not available on the ${endpointName} endpoint: ${formatList}. ` +
          `Please switch to the US endpoint or deselect these formats.`,
      };
    }

    return { valid: true };
  }

  /**
   * @method formatFileSize
   * @description Formats file size in bytes to human-readable format
   *
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size string
   * @since 2.1.0
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  /**
   * @method escapeHtml
   * @description Escapes HTML special characters to prevent XSS attacks
   *
   * @param {string} text - Text to escape
   * @returns {string} HTML-safe text
   * @since 4.0.0
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * @method showSimpleFilePreview
   * @description Shows simple file information preview for non-PDF formats (Phase 4)
   *
   * Displays a file info card with document icon, filename, format type, and size
   * for formats that don't support full preview (DOCX, PPTX, etc.). Provides
   * confirmation workflow similar to PDF preview but without rendering the document.
   *
   * Uses inline confirmation section within mathpix-pdf-interface container for
   * consistent user experience across all document formats.
   *
   * @param {File} file - Document file to preview
   * @param {Object} formatInfo - Format metadata from getFormatInfo()
   * @returns {Promise<boolean>} Promise resolving to true if confirmed, false if cancelled
   *
   * @example
   * const confirmed = await this.showSimpleFilePreview(docxFile, formatInfo);
   * if (confirmed) {
   *   // Proceed with processing
   * }
   *
   * @accessibility File info displayed with proper semantic HTML and ARIA labels
   * @since 4.0.0
   */
  async showSimpleFilePreview(file, formatInfo) {
    const formatName = formatInfo?.displayName || "Document";
    const icon = formatInfo?.icon || getIcon("document");
    const sizeFormatted = this.formatFileSize(file.size);

    logInfo("Showing simple file confirmation", {
      fileName: file.name,
      format: formatName,
      size: sizeFormatted,
    });

    // Show the PDF interface container
    const pdfInterface = document.getElementById("mathpix-pdf-interface");
    if (pdfInterface) {
      pdfInterface.style.display = "block";
    }

    // Phase 4: Hide upload container during confirmation (use class selector)
    const uploadContainer = document.querySelector(
      ".mathpix-pdf-upload-container"
    );
    if (uploadContainer) {
      uploadContainer.style.display = "none";
      logDebug("Upload container hidden during confirmation");
    }

    // Get confirmation section
    const confirmationSection = document.getElementById(
      "mathpix-file-confirmation"
    );
    if (!confirmationSection) {
      logWarn("File confirmation section not found in HTML");
      // Fallback: Auto-proceed without confirmation
      return true;
    }

    // Populate confirmation details
    const iconEl = document.getElementById("confirm-file-icon");
    const nameEl = document.getElementById("confirm-file-name");
    const typeEl = document.getElementById("confirm-file-type");
    const sizeEl = document.getElementById("confirm-file-size");

    // Phase 4: Support both emoji and SVG icons
    if (iconEl) iconEl.innerHTML = icon;
    if (nameEl) nameEl.textContent = this.escapeHtml(file.name);
    if (typeEl) typeEl.textContent = formatName;
    if (sizeEl) sizeEl.textContent = sizeFormatted;

    // Show confirmation, hide options (will be shown after confirmation)
    confirmationSection.style.display = "block";
    const optionsContainer = document.getElementById("mathpix-pdf-options");
    if (optionsContainer) {
      optionsContainer.style.display = "none";
    }

    logInfo("File confirmation displayed", {
      fileName: file.name,
      formatName: formatName,
    });

    // Return promise that resolves based on user action
    return new Promise((resolve) => {
      const proceedBtn = document.getElementById("confirm-proceed-btn");
      const cancelBtn = document.getElementById("confirm-cancel-btn");

      const cleanup = () => {
        confirmationSection.style.display = "none";
      };

      if (proceedBtn) {
        proceedBtn.addEventListener(
          "click",
          () => {
            logInfo("User confirmed file for processing", {
              fileName: file.name,
            });

            // Store file after confirmation
            this.currentPDFFile = file;

            // Announce to screen readers
            if (this.pdfAccessibility) {
              this.pdfAccessibility.announce(
                `${formatName} ${file.name} confirmed. Proceeding to processing options.`
              );
            }

            cleanup();
            resolve(true);
          },
          { once: true }
        );
      }

      if (cancelBtn) {
        cancelBtn.addEventListener(
          "click",
          () => {
            logInfo("User cancelled file selection", { fileName: file.name });

            // Announce to screen readers
            if (this.pdfAccessibility) {
              this.pdfAccessibility.announce(
                `${formatName} selection cancelled.`
              );
            }

            cleanup();

            // Hide PDF interface on cancel
            if (pdfInterface) {
              pdfInterface.style.display = "none";
            }

            resolve(false);
          },
          { once: true }
        );
      }

      // Focus on proceed button for accessibility
      if (proceedBtn) {
        proceedBtn.focus();
      }
    });
  }

  /**
   * @method cleanup
   * @description Cleans up resources and resets state
   *
   * @returns {void}
   * @since 2.1.0
   */
  cleanup() {
    // Reset all state
    this.currentPDFFile = null;
    this.currentProcessingOptions = null;
    this.currentPDFId = null;
    this.currentPDFResults = null;

    // Phase 3.4: Cleanup upload verification
    if (this.uploadVerification) {
      this.uploadVerification.cleanup();
    }

    // Phase 3.4: Cleanup accessibility features
    if (this.pdfAccessibility) {
      this.pdfAccessibility.cleanup();
    }

    // Hide all PDF interfaces
    const containers = [
      "mathpix-pdf-options",
      "mathpix-pdf-progress",
      "mathpix-pdf-results",
      "mathpix-upload-preview", // Phase 3.4: Hide upload preview
    ];

    containers.forEach((id) => {
      const container = document.getElementById(id);
      if (container) {
        container.style.display = "none";
      }
    });

    // Call parent cleanup
    super.cleanup();
    logDebug("PDF handler cleanup completed including Phase 3.4 components");
  }

  /**
   * @method getCurrentPDFFile
   * @description Gets current PDF file
   *
   * @returns {File|null} Current PDF file or null
   * @since 2.1.0
   */
  getCurrentPDFFile() {
    return this.currentPDFFile;
  }

  /**
   * @method hasPDFFile
   * @description Checks if PDF file is loaded
   *
   * @returns {boolean} True if PDF file is loaded
   * @since 2.1.0
   */
  hasPDFFile() {
    return !!this.currentPDFFile;
  }

  /**
   * @method getCurrentProcessingOptions
   * @description Gets current processing options
   *
   * @returns {Object|null} Current processing options or null
   * @since 2.1.0
   */
  getCurrentProcessingOptions() {
    return this.currentProcessingOptions;
  }

  /**
   * @method setCurrentPDFId
   * @description Sets current PDF processing ID
   *
   * @param {string} pdfId - PDF processing ID from API
   * @since 2.1.0
   */
  setCurrentPDFId(pdfId) {
    this.currentPDFId = pdfId;
    logDebug("PDF ID set", { pdfId });
  }

  /**
   * @method getCurrentPDFId
   * @description Gets current PDF processing ID
   *
   * @returns {string|null} Current PDF processing ID or null
   * @since 2.1.0
   */
  getCurrentPDFId() {
    return this.currentPDFId;
  }
}

// Phase 3.4: Global exposure for testing
if (typeof window !== "undefined") {
  window.MathPixPDFHandler = MathPixPDFHandler;
}

export default MathPixPDFHandler;
