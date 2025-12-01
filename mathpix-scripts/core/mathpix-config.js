/**
 * @fileoverview MathPix OCR System Configuration and Constants
 * @module MathPixConfig
 * @requires None - Standalone configuration module
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Central configuration module for the MathPix mathematics OCR system. Provides
 * GDPR-compliant privacy settings, API configuration, file validation rules,
 * and user interface messages. All settings are optimised for EU data sovereignty
 * and maximum privacy protection.
 *
 * Key Features:
 * - EU-specific API endpoints for GDPR compliance
 * - Privacy-first configuration with data retention opt-out
 * - Comprehensive file validation settings
 * - User experience configuration options
 * - Multilingual message templates with British spelling
 * - Configurable logging system integration
 *
 * Integration:
 * - Used by mathpix-api-client.js for API configuration
 * - Referenced by mathpix-privacy-manager.js for privacy settings
 * - Imported by UI components for validation and messaging
 * - Available globally via window.MATHPIX_CONFIG
 *
 * Privacy Compliance:
 * - Full GDPR compliance with EU-only processing
 * - Data retention disabled by default
 * - No machine learning training on user data
 * - Secure HTTPS transmission requirements
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant message templates
 * - Screen reader friendly notification text
 * - Clear error messaging for assistive technology
 */

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * @function shouldLog
 * @description Determines if a message should be logged based on current logging configuration
 * @param {number} level - The log level to check (0=ERROR, 1=WARN, 2=INFO, 3=DEBUG)
 * @returns {boolean} True if the message should be logged
 * @since 1.0.0
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * @function logError
 * @description Logs error messages if error logging is enabled
 * @param {string} message - The error message to log
 * @param {...any} args - Additional arguments to pass to console.error
 * @since 1.0.0
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

/**
 * @function logWarn
 * @description Logs warning messages if warning logging is enabled
 * @param {string} message - The warning message to log
 * @param {...any} args - Additional arguments to pass to console.warn
 * @since 1.0.0
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

/**
 * @function logInfo
 * @description Logs informational messages if info logging is enabled
 * @param {string} message - The info message to log
 * @param {...any} args - Additional arguments to pass to console.log
 * @since 1.0.0
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

/**
 * @function logDebug
 * @description Logs debug messages if debug logging is enabled
 * @param {string} message - The debug message to log
 * @param {...any} args - Additional arguments to pass to console.log
 * @since 1.0.0
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

/**
 * @namespace MATHPIX_CONFIG
 * @description Comprehensive configuration object for the MathPix OCR system
 *
 * @property {string} API_BASE - EU-specific API endpoint ensuring GDPR compliance
 * @property {Object} DEFAULT_REQUEST - Default API request configuration with privacy settings
 * @property {Object} PRIVACY - Privacy and GDPR compliance configuration
 * @property {Object} USER_EXPERIENCE - User interface and workflow configuration
 * @property {Array<string>} SUPPORTED_TYPES - File types supported for mathematics processing
 * @property {number} MAX_FILE_SIZE - Maximum file size in bytes (10MB)
 * @property {number} TIMEOUT - API request timeout in milliseconds
 * @property {Object} MESSAGES - User-facing messages and notifications
 * @property {Object} PRIVACY_MESSAGES - Privacy-specific message templates
 *
 * @example
 * import MATHPIX_CONFIG from './mathpix-config.js';
 *
 * // Check if file type is supported
 * const isSupported = MATHPIX_CONFIG.SUPPORTED_TYPES.includes(file.type);
 *
 * // Use privacy-compliant API endpoint
 * const apiUrl = `${MATHPIX_CONFIG.API_BASE}/text`;
 *
 * @readonly
 * @since 1.0.0
 */
const MATHPIX_CONFIG = {
  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description Regional API endpoint configurations with feature availability matrix
   *
   * Three endpoints available:
   * - US: Full feature support, best latency for Americas
   * - EU: GDPR-compliant, some features limited (latex.pdf unavailable)
   * - Asia: Best latency for APAC (currently shares US infrastructure)
   *
   * @property {Object} US - United States endpoint configuration
   * @property {Object} EU - European Union endpoint configuration
   * @property {Object} ASIA - Asia Pacific endpoint configuration
   *
   * @since 2.0.0
   */
  ENDPOINTS: {
    US: {
      name: "United States",
      baseUrl: " https://api.mathpix.com/v3",
      location: "US East 1 (N. Virginia)",
      features: {
        text: true, // Image/Draw OCR
        strokes: true, // Handwriting recognition
        pdf: true, // PDF processing
        latex_pdf: true, // ✅ Available
        html: true, // HTML export
        docx: true, // DOCX export
        tex_zip: true, // LaTeX zip export
        pptx: true, // PowerPoint export
        lines_data: true, // Line-level data
      },
      dataLocality: "United States",
      gdprCompliant: false,
      recommendedFor: ["americas", "default"],
    },
    EU: {
      name: "European Union",
      baseUrl: "https://eu-central-1.api.mathpix.com/v3",
      location: "EU Central 1 (Frankfurt)",
      features: {
        text: true, // Image/Draw OCR
        strokes: true, // Handwriting recognition
        pdf: true, // PDF processing
        latex_pdf: false, // ❌ NOT available (confirmed by support)
        html: true, // HTML export
        docx: true, // DOCX export
        tex_zip: true, // LaTeX zip export
        pptx: true, // PowerPoint export
        lines_data: true, // Line-level data
      },
      dataLocality: "European Union",
      gdprCompliant: true,
      recommendedFor: ["eu", "uk", "gdpr"],
    },
    ASIA: {
      name: "Asia Pacific",
      baseUrl: "https://ap-southeast-1.api.mathpix.com/v3",
      location: "SE Asia (Singapore)",
      features: {
        text: true,
        strokes: true,
        pdf: true,
        latex_pdf: true, // Assumed available
        html: true,
        docx: true,
        tex_zip: true,
        pptx: true,
        lines_data: true,
      },
      dataLocality: "Singapore",
      gdprCompliant: false,
      recommendedFor: ["asia", "apac"],
    },
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {string}
   * @description Default endpoint for new users (GDPR-safe default)
   * @default "EU"
   * @since 2.0.0
   */
  DEFAULT_ENDPOINT: "EU",

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description Document format metadata for multi-format support
   *
   * Provides format-specific configuration including MIME types, display names,
   * file size limits, preview capabilities, and UI categorisation. Used by
   * validation and preview systems to handle different document types appropriately.
   *
   * @property {Object} application/pdf - PDF document metadata
   * @property {string} name - Short format name for logging
   * @property {string} displayName - Human-readable name for UI display
   * @property {string} icon - Emoji icon for visual identification
   * @property {number} maxSize - Maximum file size in bytes
   * @property {boolean} showPdfPreview - Whether to show full PDF preview
   * @property {string} category - Format category (document/office)
   *
   * @example
   * const formatInfo = MATHPIX_CONFIG.DOCUMENT_FORMATS['application/pdf'];
   * console.log(formatInfo.displayName); // "PDF Document"
   * console.log(formatInfo.maxSize); // 536870912 (512MB)
   *
   * @accessibility Format metadata ensures appropriate handling for all users
   * @since 4.0.0
   */
  DOCUMENT_FORMATS: {
    "application/pdf": {
      name: "PDF",
      displayName: "PDF Document",
      icon: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)"><path d="m12.5 12.5v-7l-5-5h-5c-1.1045695 0-2 .8954305-2 2v10c0 1.1045695.8954305 2 2 2h8c1.1045695 0 2-.8954305 2-2z"/><path d="m2.5 7.5h5"/><path d="m2.5 9.5h7"/><path d="m2.5 11.5h3"/><path d="m7.5.5v3c0 1.1045695.8954305 2 2 2h3"/></g></svg>',
      maxSize: 512 * 1024 * 1024, // 512MB
      showPdfPreview: true,
      category: "document",
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      name: "DOCX",
      displayName: "Word Document",
      icon: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)"><path d="m12.5 12.5v-7l-5-5h-5c-1.1045695 0-2 .8954305-2 2v10c0 1.1045695.8954305 2 2 2h8c1.1045695 0 2-.8954305 2-2z"/><path d="m2.5 7.5h5"/><path d="m2.5 9.5h7"/><path d="m2.5 11.5h3"/><path d="m7.5.5v3c0 1.1045695.8954305 2 2 2h3"/></g></svg>',
      maxSize: 100 * 1024 * 1024, // 100MB
      showPdfPreview: false,
      category: "office",
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      {
        name: "PPTX",
        displayName: "PowerPoint Presentation",
        icon: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(1 2)"><path d="m16.5 12.5v-10.01471863h-14v10.01471863c0 .5522847.44771525 1 1 1h12c.5522847 0 1-.4477153 1-1z"/><path d="m7.5 13.5-2 3.5"/><path d="m13.5 13.5-2 3" transform="matrix(-1 0 0 1 25 0)"/><path d="m.5 2.5h18"/><path d="m9.49894742.49789429c1.05502148.00261296 1.91822238.81840641 1.99543358 1.85289779l.0056181.1492082-4.00000003-.00210599c-.00105165-1.1045695.89437885-2 1.99894835-2z"/></g></svg>',
        maxSize: 100 * 1024 * 1024, // 100MB
        showPdfPreview: false,
        category: "office",
      },
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {string}
   * @description localStorage key for endpoint preference
   * @since 2.0.0
   */
  ENDPOINT_PREFERENCE_KEY: "mathpix-selected-endpoint",

  /**
   * @memberof MATHPIX_CONFIG
   * @type {string}
   * @description localStorage key for GDPR warning dismissal
   * @since 2.0.0
   */
  GDPR_WARNING_DISMISSED_KEY: "mathpix-gdpr-warning-dismissed",

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description Default API request configuration optimised for privacy and comprehensive format support
   *
   * @property {Array<string>} formats - Output formats requested from API
   * @property {Object} metadata - API metadata settings with privacy protection
   * @property {boolean} metadata.improve_mathpix - Disabled to prevent training on user data
   * @property {Object} data_options - Additional data format options
   * @property {boolean} data_options.include_latex - Include LaTeX output format
   * @property {boolean} data_options.include_mathml - Include MathML output format
   * @property {boolean} data_options.include_asciimath - Include AsciiMath output format
   */
  DEFAULT_REQUEST: {
    formats: ["text", "data", "html", "markdown"], // ✅ Added "markdown" format
    metadata: { improve_mathpix: false }, // Privacy: No data improvement/training
    data_options: {
      include_latex: true,
      include_mathml: true,
      include_asciimath: true,
      include_table_html: true, // Enable HTML table extraction
      include_tsv: true, // Enable Tab-Separated Values extraction
      // include_smiles: true, // Phase 4: DISABLED - not supported by current API tier
    },
    enable_tables_fallback: true, // Better handling of complex tables
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description Privacy and GDPR compliance configuration ensuring maximum user data protection
   *
   * @property {boolean} requireConsent - Always require explicit user consent before processing
   * @property {boolean} dataRetentionOptOut - Files automatically deleted within 24 hours
   * @property {boolean} noDataImprovement - User content not used for model training
   * @property {boolean} secureTransmission - HTTPS encryption required for all communications
   * @property {boolean} gdprCompliant - Full GDPR compliance maintained throughout processing
   * @property {string} processingLocation - Geographic location of data processing
   * @property {string} processingEndpoint - Specific API endpoint ensuring EU processing
   * @property {string} dataLocality - Jurisdiction where data processing occurs
   * @property {number} maxRetentionHours - Maximum data retention time in hours
   */
  PRIVACY: {
    requireConsent: true,
    dataRetentionOptOut: true,
    noDataImprovement: true,
    secureTransmission: true,
    gdprCompliant: true,
    processingLocation: "EU (Frankfurt)",
    processingEndpoint: "eu-central-1.api.mathpix.com",
    dataLocality: "European Union",
    maxRetentionHours: 24,
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description User experience configuration controlling workflow and interface behaviour
   *
   * @property {boolean} PRIVACY_MODAL_ENABLED - Controls display of privacy consent modal
   * @property {boolean} REQUIRE_FILE_CONFIRMATION - Requires explicit user confirmation before processing
   * @property {boolean} CLEANUP_AFTER_PROCESSING - Automatically hide preview elements after processing
   * @property {boolean} MOVE_BUTTON_TO_COMPARISON - Relocates action buttons to comparison panel
   * @property {boolean} SHOW_CONFIRMATION_BUTTON - Displays process confirmation button
   *
   * @accessibility All UI elements controlled by these settings maintain WCAG 2.2 AA compliance
   */
  USER_EXPERIENCE: {
    PRIVACY_MODAL_ENABLED: false,
    REQUIRE_FILE_CONFIRMATION: true,
    CLEANUP_AFTER_PROCESSING: true,
    MOVE_BUTTON_TO_COMPARISON: true,
    SHOW_CONFIRMATION_BUTTON: true,
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Array<string>}
   * @description File MIME types supported for mathematics OCR processing
   * @default ["image/jpeg", "image/png", "image/webp", "application/pdf"]
   */
  SUPPORTED_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // PPTX
  ],

  /**
   * @memberof MATHPIX_CONFIG
   * @type {number}
   * @description Maximum file size in bytes (10MB limit for optimal processing performance)
   * @default 10485760
   */
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  /**
   * @memberof MATHPIX_CONFIG
   * @type {number}
   * @description API request timeout in milliseconds (30 second limit for images)
   * @default 30000
   */
  TIMEOUT: 30000,

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description Phase 2.1: PDF Document Processing Configuration
   *
   * @property {number} MAX_PDF_SIZE - Maximum PDF file size in bytes (512MB limit)
   * @property {number} PDF_TIMEOUT - PDF processing timeout in milliseconds (5 minute limit)
   * @property {number} STATUS_POLL_INTERVAL - Polling interval for PDF status checks (2 seconds)
   * @property {number} MAX_STATUS_POLLS - Maximum number of status polling attempts (150 = 5 minutes)
   * @property {Array<string>} SUPPORTED_PDF_FORMATS - Output formats available for PDF documents
   * @property {Object} DEFAULT_PDF_OPTIONS - Default PDF processing options
   * @property {string} DEFAULT_PDF_OPTIONS.page_range - Default page range selection
   * @property {Array<string>} DEFAULT_PDF_OPTIONS.formats - Default output formats
   * @property {Object} PDF_PAGE_LIMITS - Page processing limits for different tiers
   * @property {number} PDF_PAGE_LIMITS.free - Free tier page limit
   * @property {number} PDF_PAGE_LIMITS.preview - Preview processing limit
   * @property {number} PDF_PAGE_LIMITS.max - Maximum pages per document
   *
   * @accessibility All PDF processing maintains full accessibility compliance
   * @since 2.1.0
   */
  PDF_PROCESSING: {
    MAX_PDF_SIZE: 512 * 1024 * 1024, // 512MB limit for comprehensive documents
    PDF_TIMEOUT: 5 * 60 * 1000, // 5 minute timeout for PDF processing
    STATUS_POLL_INTERVAL: 2000, // Poll every 2 seconds for status updates
    MAX_STATUS_POLLS: 150, // Maximum 150 polls (5 minutes at 2-second intervals)
    SUPPORTED_PDF_FORMATS: ["mmd", "html", "tex.zip", "docx"],
    DEFAULT_PDF_OPTIONS: {
      page_range: null, // No page range = process all pages
      formats: ["mmd", "html"],
    },
    PDF_PAGE_LIMITS: {
      free: 10, // Free processing up to 10 pages
      preview: 10, // Preview mode limit
      max: 1000, // Technical maximum per document
    },
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description PDF API request configuration for document processing
   *
   * @property {Object} metadata - PDF-specific metadata settings
   * @property {boolean} metadata.improve_mathpix - Always disabled for privacy
   * @property {Object} conversion_formats - Available output formats for PDFs
   * @property {boolean} conversion_formats.mmd - MultiMarkdown with mathematical notation
   * @property {boolean} conversion_formats.html - HTML with MathML rendering
   * @property {boolean} conversion_formats.latex - LaTeX document format
   * @property {boolean} conversion_formats.docx - Microsoft Word format
   * @property {Object} ocr_settings - OCR optimization for mathematical content
   * @property {boolean} ocr_settings.math_inline_delimiters - Enable inline math detection
   * @property {boolean} ocr_settings.math_display_delimiters - Enable display math detection
   * @property {boolean} ocr_settings.rm_spaces - Remove unnecessary spaces
   * @property {boolean} ocr_settings.rm_fonts - Remove font specifications
   *
   * @privacy All settings optimised for maximum privacy protection
   * @since 2.1.0
   */
  DEFAULT_PDF_REQUEST: {
    metadata: { improve_mathpix: false }, // Privacy: No data improvement/training
    conversion_formats: {
      // Note: MMD is the default output format, not a conversion format
      "tex.zip": false, // LaTeX zip file (corrected from "latex")
      docx: false, // Microsoft Word format
      html: true, // HTML format (valid conversion format)
    },
    // Phase 5: Delimiter defaults at ROOT level (not in ocr_settings)
    // These will be overridden by user preferences from buildFinalProcessingOptions()
    math_inline_delimiters: ["$", "$"],
    math_display_delimiters: ["$$", "$$"],
    rm_spaces: true,
    rm_fonts: true,
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description User-facing messages and notifications with British spelling
   *
   * @property {string} UPLOAD_START - Message displayed when processing begins
   * @property {string} UPLOAD_SUCCESS - Success confirmation message
   * @property {string} UPLOAD_ERROR - Generic error message for failed processing
   * @property {string} COPY_SUCCESS - Confirmation when content copied to clipboard
   * @property {string} COPY_ERROR - Error message for failed copy operations
   * @property {string} PRIVACY_CONSENT_REQUIRED - Message when privacy consent needed
   * @property {string} PRIVACY_CONSENT_DENIED - Message when user declines processing
   * @property {string} PRIVACY_PROTECTION_ENABLED - Confirmation of privacy protection status
   *
   * @accessibility All messages designed for screen reader compatibility and clear communication
   */
  MESSAGES: {
    UPLOAD_START: "Processing mathematics...",
    UPLOAD_SUCCESS: "Mathematics converted successfully!",
    UPLOAD_ERROR: "Failed to process mathematics",
    COPY_SUCCESS: "Content copied to clipboard!",
    COPY_ERROR: "Failed to copy content",
    PRIVACY_CONSENT_REQUIRED: "Privacy consent required before processing",
    PRIVACY_CONSENT_DENIED:
      "Processing cancelled - privacy consent not granted",
    PRIVACY_PROTECTION_ENABLED:
      "Privacy protection enabled - no data retention",
    TABLE_DETECTED: "Table detected in image",
    TABLE_EXTRACTED: "Table data extracted successfully",
    TABLE_COPY_SUCCESS: "Table copied to clipboard!",
    NO_TABLE_DETECTED: "No table found in image",
    TABLE_PARSE_ERROR: "Table detected but parsing failed",
    TABLE_TOO_COMPLEX: "Table too complex - simplified extraction used",
    TABLE_EXPORT_FAILED: "Failed to export table data",
    MIXED_CONTENT_WARNING: "Image contains both mathematics and tables",
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description PDF-specific user messages with British spelling and clear communication
   *
   * @property {string} PDF_UPLOAD_START - Message when PDF processing begins
   * @property {string} PDF_UPLOAD_SUCCESS - Success message for completed PDF processing
   * @property {string} PDF_PROCESSING - Status message during document conversion
   * @property {string} PDF_STATUS_CHECKING - Message while checking processing status
   * @property {string} PDF_DOWNLOAD_READY - Notification when downloads are available
   * @property {string} PDF_TIMEOUT_ERROR - Error message for processing timeouts
   * @property {string} PDF_SIZE_ERROR - Error for oversized PDF files
   * @property {string} PDF_FORMAT_ERROR - Error for unsupported PDF formats
   * @property {string} PDF_PAGE_LIMIT_ERROR - Error when page limit exceeded
   * @property {string} PDF_COPY_SUCCESS - Success message for content copying
   * @property {string} PDF_DOWNLOAD_SUCCESS - Success message for file downloads
   * @property {string} PDF_EXPORT_ERROR - Error message for failed exports
   *
   * @accessibility All PDF messages optimised for screen reader compatibility
   * @since 2.1.0
   */
  PDF_MESSAGES: {
    PDF_UPLOAD_START: "Uploading PDF document...",
    PDF_UPLOAD_SUCCESS: "PDF document processed successfully!",
    PDF_PROCESSING: "Converting document to mathematical formats...",
    PDF_STATUS_CHECKING: "Checking processing status...",
    PDF_DOWNLOAD_READY: "Document formats ready for download",
    PDF_TIMEOUT_ERROR:
      "PDF processing timed out - please try a smaller document",
    PDF_SIZE_ERROR: "PDF file too large (max 512MB) - please reduce file size",
    PDF_FORMAT_ERROR: "Invalid PDF format - please check file integrity",
    PDF_PAGE_LIMIT_ERROR:
      "Document exceeds page limit - please select specific pages",
    PDF_COPY_SUCCESS: "Document content copied to clipboard!",
    PDF_DOWNLOAD_SUCCESS: "Document downloaded successfully",
    PDF_EXPORT_ERROR: "Failed to export document - please try again",
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description PDF processing status messages for user feedback during document conversion
   *
   * @property {string} UPLOADING - Document upload in progress
   * @property {string} QUEUED - Document queued for processing
   * @property {string} PROCESSING - Active document conversion
   * @property {string} COMPLETED - Processing successfully completed
   * @property {string} ERROR - Processing encountered errors
   * @property {string} TIMEOUT - Processing exceeded time limits
   *
   * @accessibility Status messages provide clear progress indication for all users
   * @since 2.1.0
   */
  PDF_STATUS_MESSAGES: {
    UPLOADING: "Uploading document to processing server...",
    QUEUED: "Document queued for processing...",
    PROCESSING: "Converting mathematical content...",
    COMPLETED: "Document processing completed",
    ERROR: "Processing encountered an error",
    TIMEOUT: "Processing time exceeded - document too complex",
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description Privacy-specific message templates for consent workflow and policy information
   *
   * @property {string} CONSENT_TITLE - Title for privacy consent modal
   * @property {string} POLICY_TITLE - Title for detailed privacy policy display
   * @property {string} DATA_RETENTION_INFO - Information about automatic file deletion
   * @property {string} NO_DATA_IMPROVEMENT - Explanation of no-training policy
   * @property {string} SECURE_TRANSMISSION - Information about HTTPS encryption
   * @property {string} EU_PROCESSING_ONLY - Guarantee of EU-only processing
   * @property {string} DATA_LOCALITY - Explanation of data jurisdiction requirements
   * @property {string} GDPR_COMPLIANT - Confirmation of GDPR compliance
   *
   * @accessibility Messages designed for clear communication to all users including those using assistive technology
   */
  PRIVACY_MESSAGES: {
    CONSENT_TITLE: "Privacy & Processing Consent",
    POLICY_TITLE: "MathPix Privacy Policy & Data Handling",
    DATA_RETENTION_INFO: "Files automatically deleted within 24 hours",
    NO_DATA_IMPROVEMENT: "Your content will not be used to train AI models",
    SECURE_TRANSMISSION: "All data transmitted securely via HTTPS encryption",
    EU_PROCESSING_ONLY:
      "All processing guaranteed to occur within the European Union",
    DATA_LOCALITY: "Your data never leaves EU jurisdiction during processing",
    GDPR_COMPLIANT: "Full GDPR compliance with EU-only data processing",
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description Table extraction and processing configuration
   *
   * @property {boolean} ENABLE_TSV_EXPORT - Enable Tab-Separated Values export format
   * @property {boolean} ENABLE_HTML_EXPORT - Enable HTML table format export
   * @property {boolean} ENABLE_MARKDOWN_EXPORT - Enable Markdown table format export
   * @property {string} DEFAULT_FORMAT - Default display format for extracted tables
   * @property {boolean} ENABLE_COMPLEX_TABLES - Use advanced parsing for complex tables
   * @property {number} MAX_TABLE_CELLS - Maximum cells to process (performance limit)
   *
   * @accessibility All table formats maintain WCAG 2.2 AA compliance with semantic HTML
   * @since 1.1.0
   */
  TABLE_PROCESSING: {
    ENABLE_TSV_EXPORT: true,
    ENABLE_HTML_EXPORT: true,
    ENABLE_MARKDOWN_EXPORT: true,
    DEFAULT_FORMAT: "html",
    ENABLE_COMPLEX_TABLES: true,
    MAX_TABLE_CELLS: 1000,
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description Total Downloader configuration for comprehensive ZIP archive creation
   *
   * Provides configuration for creating complete archives of MathPix processing results,
   * including source files, conversion formats, API data, and auto-generated documentation.
   * Designed for archival, quality assurance, and document remediation workflows.
   *
   * @property {string} FILENAME_TEMPLATE - Template for generated ZIP filenames with timestamp placeholder
   * @property {string} FILENAME_SUFFIX - Suffix appended to custom filenames
   * @property {string} METADATA_ONLY_SUFFIX - Suffix for metadata-only archives (partial failure mode)
   * @property {Object} DIRECTORIES - ZIP archive folder structure
   * @property {string} DIRECTORIES.SOURCE - Folder for original source files (images, PDFs, etc.)
   * @property {string} DIRECTORIES.RESULTS - Folder for conversion results (LaTeX, MathML, HTML, etc.)
   * @property {string} DIRECTORIES.DATA - Folder for metadata and API request/response data
   * @property {Object} MESSAGES - User-facing progress and status messages with British spelling
   * @property {RegExp} FILENAME_ALLOWED_CHARS - Regex for allowed filename characters
   * @property {string} FILENAME_REPLACEMENT - Replacement character for disallowed filename characters
   * @property {number} CLIPBOARD_JPG_QUALITY - JPEG quality for clipboard images (0.0-1.0)
   * @property {string} CANVAS_PNG_FORMAT - Format for canvas snapshots
   *
   * @example
   * // Access configuration
   * const config = MATHPIX_CONFIG.TOTAL_DOWNLOADER;
   * const filename = config.FILENAME_TEMPLATE.replace('{timestamp}', '2025-10-14-143022');
   *
   * @accessibility All generated archives maintain full accessibility with semantic structure
   * @since 1.0.0
   */
  TOTAL_DOWNLOADER: {
    // Filename configuration
    FILENAME_TEMPLATE: "mathpix-results-{timestamp}",
    FILENAME_SUFFIX: "-mathpix",
    METADATA_ONLY_SUFFIX: "-metadata",

    // ZIP structure
    DIRECTORIES: {
      SOURCE: "source",
      RESULTS: "results",
      DATA: "data",
    },

    // Progress messages (British spelling)
    MESSAGES: {
      START: "Preparing download...",
      COLLECT_SOURCE: "Collecting source files...",
      COLLECT_RESULTS: "Collecting conversion results...",
      COLLECT_DATA: "Collecting metadata...",
      GENERATE_README: "Generating documentation...",
      CREATE_ZIP: "Creating ZIP archive...",
      COMPLETE: "Download ready!",
      ERROR: "Download failed. See console for details.",
    },

    // File sanitisation (British spelling in comment)
    FILENAME_ALLOWED_CHARS: /[^a-zA-Z0-9\-_\.]/g,
    FILENAME_REPLACEMENT: "-",

    // Image quality (Phase 2)
    CLIPBOARD_JPG_QUALITY: 0.85,
    CANVAS_PNG_FORMAT: "image/png",
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {Object}
   * @description Maths delimiter preset configurations for different LaTeX/Markdown ecosystems
   *
   * Provides standard delimiter formats optimised for various documentation systems
   * and mathematics rendering engines. Users can choose between Markdown-friendly,
   * traditional LaTeX, or MathJax-compatible delimiter styles.
   *
   * Each preset includes:
   * - Inline delimiters (for inline maths expressions like $x = 5$)
   * - Display delimiters (for display maths blocks like $$E = mc^2$$)
   * - Human-readable name for UI display
   * - Description explaining ecosystem compatibility
   *
   * @property {Object} markdown - Markdown-style delimiters using $ and $$
   * @property {Array<string>} markdown.inline - Inline maths delimiters ["$", "$"]
   * @property {Array<string>} markdown.display - Display maths delimiters ["$$", "$$"]
   * @property {string} markdown.name - Display name for UI
   * @property {string} markdown.description - Ecosystem compatibility information
   *
   * @property {Object} latex - Traditional LaTeX-style delimiters
   * @property {Array<string>} latex.inline - Inline maths delimiters ["\\(", "\\)"]
   * @property {Array<string>} latex.display - Display maths delimiters ["\\[", "\\]"]
   * @property {string} latex.name - Display name for UI
   * @property {string} latex.description - Traditional LaTeX notation information
   *
   * @property {Object} mathjax - MathJax-compatible delimiters
   * @property {Array<string>} mathjax.inline - Inline maths delimiters ["\\(", "\\)"]
   * @property {Array<string>} mathjax.display - Display maths delimiters ["\\[", "\\]"]
   * @property {string} mathjax.name - Display name for UI
   * @property {string} mathjax.description - MathJax compatibility information
   *
   * @example
   * // Access Markdown preset
   * const preset = MATHPIX_CONFIG.MATH_DELIMITER_PRESETS.markdown;
   * console.log(preset.inline); // ["$", "$"]
   * console.log(preset.display); // ["$$", "$$"]
   *
   * @example
   * // Use in API request
   * const apiRequest = {
   *   ...MATHPIX_CONFIG.DEFAULT_PDF_REQUEST,
   *   math_inline_delimiters: MATHPIX_CONFIG.MATH_DELIMITER_PRESETS.markdown.inline,
   *   math_display_delimiters: MATHPIX_CONFIG.MATH_DELIMITER_PRESETS.markdown.display
   * };
   *
   * @accessibility Delimiter choice affects output compatibility with assistive technology
   * @since 5.0.0
   */
  MATH_DELIMITER_PRESETS: {
    markdown: {
      inline: ["$", "$"],
      display: ["$$", "$$"],
      name: "Markdown Style",
      description: "Best for Markdown processors (Hugo, Jekyll, Pandoc)",
    },
    latex: {
      inline: ["\\(", "\\)"],
      display: ["\\[", "\\]"],
      name: "LaTeX Style",
      description: "Traditional LaTeX notation",
    },
    mathjax: {
      inline: ["\\(", "\\)"],
      display: ["\\[", "\\]"],
      name: "MathJax Compatible",
      description: "Compatible with MathJax rendering",
    },
  },

  /**
   * @memberof MATHPIX_CONFIG
   * @type {string}
   * @description Default delimiter preset for new users and initial configuration
   *
   * Set to 'markdown' for broadest ecosystem compatibility with modern static
   * site generators, documentation systems, and Markdown processors. The Markdown
   * style using $ and $$ delimiters is widely supported and requires less escaping
   * than traditional LaTeX backslash notation.
   *
   * Valid values: 'markdown', 'latex', 'mathjax'
   *
   * @default 'markdown'
   * @since 5.0.0
   */
  DEFAULT_DELIMITER_PRESET: "markdown",

  /**
   * Get format information for a given MIME type
   * @param {string} mimeType - MIME type to look up
   * @returns {Object|null} Format metadata or null
   * @since 4.0.0
   */
  getFormatInfo(mimeType) {
    return this.DOCUMENT_FORMATS[mimeType] || null;
  },
};

/**
 * Get endpoint configuration by key
 * @param {string} endpointKey - Endpoint key (US, EU, ASIA)
 * @returns {Object} Endpoint configuration
 * @since 2.0.0
 */
function getEndpointConfig(endpointKey) {
  return (
    MATHPIX_CONFIG.ENDPOINTS[endpointKey] ||
    MATHPIX_CONFIG.ENDPOINTS[MATHPIX_CONFIG.DEFAULT_ENDPOINT]
  );
}

/**
 * Get available features for endpoint
 * @param {string} endpointKey - Endpoint key
 * @returns {Object} Feature availability object
 * @since 2.0.0
 */
function getEndpointFeatures(endpointKey) {
  const config = getEndpointConfig(endpointKey);
  return config.features;
}

/**
 * Check if feature is available on endpoint
 * @param {string} endpointKey - Endpoint key
 * @param {string} featureName - Feature to check
 * @returns {boolean} True if feature available
 * @since 2.0.0
 */
function isFeatureAvailable(endpointKey, featureName) {
  const features = getEndpointFeatures(endpointKey);
  return features[featureName] === true;
}

/**
 * Get format information for a given MIME type
 * @param {string} mimeType - MIME type to look up (e.g., 'application/pdf')
 * @returns {Object|null} Format metadata object or null if not found
 * @since 4.0.0
 *
 * @example
 * const info = getFormatInfo('application/pdf');
 * console.log(info.displayName); // "PDF Document"
 * console.log(info.maxSize); // 536870912
 */
function getFormatInfo(mimeType) {
  return MATHPIX_CONFIG.DOCUMENT_FORMATS[mimeType] || null;
}

export default MATHPIX_CONFIG;
export {
  logError,
  logWarn,
  logInfo,
  logDebug,
  getEndpointConfig,
  getEndpointFeatures,
  isFeatureAvailable,
  getFormatInfo,
};
