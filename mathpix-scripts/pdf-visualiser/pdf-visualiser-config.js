/**
 * @fileoverview PDF Confidence Visualiser Configuration
 * @module PDFVisualiserConfig
 * @requires None - Standalone configuration module
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Central configuration for the PDF Confidence Visualiser feature.
 * Provides confidence level thresholds, colour schemes, PDF.js CDN URLs,
 * rendering defaults, and accessibility settings.
 *
 * Key Features:
 * - Confidence level categorisation with WCAG-compliant colours
 * - PDF.js CDN configuration for lazy loading
 * - Rendering and zoom configuration
 * - Accessibility-first CSS class naming
 * - Theme support for light and dark modes
 *
 * Integration:
 * - Used by pdf-visualiser-core.js for main orchestration
 * - Referenced by pdf-visualiser-overlays.js for colour selection
 * - Imported by pdf-visualiser-stats.js for threshold categorisation
 * - Compatible with existing MathPix theming system
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant colour contrast ratios
 * - Screen reader friendly label templates
 * - High contrast mode support
 */

// =============================================================================
// LOGGING CONFIGURATION
// =============================================================================

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * @function shouldLog
 * @description Determines if logging should occur at the specified level
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
 * @description Logs error messages when appropriate
 * @param {string} message - Error message
 * @param {...*} args - Additional arguments
 * @private
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error("[PDFVisualiserConfig]", message, ...args);
}

/**
 * @function logWarn
 * @description Logs warning messages when appropriate
 * @param {string} message - Warning message
 * @param {...*} args - Additional arguments
 * @private
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[PDFVisualiserConfig]", message, ...args);
}

/**
 * @function logInfo
 * @description Logs informational messages when appropriate
 * @param {string} message - Info message
 * @param {...*} args - Additional arguments
 * @private
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[PDFVisualiserConfig]", message, ...args);
}

/**
 * @function logDebug
 * @description Logs debug messages when appropriate
 * @param {string} message - Debug message
 * @param {...*} args - Additional arguments
 * @private
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[PDFVisualiserConfig]", message, ...args);
}

// =============================================================================
// MAIN CONFIGURATION
// =============================================================================

/**
 * @namespace PDF_VISUALISER_CONFIG
 * @description Comprehensive configuration for PDF Confidence Visualiser
 *
 * @property {Object} PDFJS - PDF.js library configuration
 * @property {Object} CONFIDENCE_LEVELS - Confidence categorisation thresholds and colours
 * @property {Object} RENDERING - PDF rendering settings
 * @property {Object} ZOOM - Zoom control configuration
 * @property {Object} CSS_CLASSES - CSS class names for styling
 * @property {Object} ARIA - Accessibility labels and announcements
 * @property {Object} MESSAGES - User-facing messages (British spelling)
 *
 * @readonly
 * @since 1.0.0
 */
const PDF_VISUALISER_CONFIG = {
  // ===========================================================================
  // PDF.JS LIBRARY CONFIGURATION
  // ===========================================================================

  /**
   * @memberof PDF_VISUALISER_CONFIG
   * @type {Object}
   * @description PDF.js library CDN configuration for lazy loading
   *
   * Uses stable version 3.11.174 from cdnjs.cloudflare.com
   * Library is loaded only when visualiser is activated
   *
   * @property {string} LIB_URL - Main PDF.js library URL
   * @property {string} WORKER_URL - PDF.js web worker URL
   * @property {string} VERSION - PDF.js version identifier
   * @property {number} LOAD_TIMEOUT - Maximum load time in milliseconds
   *
   * @since 1.0.0
   */
  PDFJS: {
    LIB_URL:
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    WORKER_URL:
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
    VERSION: "3.11.174",
    LOAD_TIMEOUT: 10000, // 10 seconds
  },

  // ===========================================================================
  // CONFIDENCE LEVEL CONFIGURATION
  // ===========================================================================

  /**
   * @memberof PDF_VISUALISER_CONFIG
   * @type {Object}
   * @description Confidence level thresholds and associated styling
   *
   * Defines four confidence tiers based on OCR confidence_rate:
   * - HIGH: ≥95% confidence (excellent recognition)
   * - MEDIUM: 80-94% confidence (good recognition with minor uncertainty)
   * - LOW: 60-79% confidence (uncertain recognition, review recommended)
   * - VERY_LOW: <60% confidence (poor recognition, manual review required)
   *
   * Colours chosen for WCAG 2.2 AA compliance with sufficient contrast
   *
   * @since 1.0.0
   */
  CONFIDENCE_LEVELS: {
    /**
     * High confidence level (≥95%)
     * Colours defined in CSS class .pdf-vis-legend-swatch--high
     */
    HIGH: {
      name: "High",
      minThreshold: 0.95,
      maxThreshold: 1.0,
      cssClass: "pdf-vis-legend-swatch--high",
      legendLabel: "High (≥95%)",
      ariaLabel: "High confidence, 95 percent or above",
    },

    /**
     * Medium confidence level (80-94%)
     * Colours defined in CSS class .pdf-vis-legend-swatch--medium
     */
    MEDIUM: {
      name: "Medium",
      minThreshold: 0.8,
      maxThreshold: 0.9499,
      cssClass: "pdf-vis-legend-swatch--medium",
      legendLabel: "Medium (80-94%)",
      ariaLabel: "Medium confidence, 80 to 94 percent",
    },

    /**
     * Low confidence level (60-79%)
     * Colours defined in CSS class .pdf-vis-legend-swatch--low
     */
    LOW: {
      name: "Low",
      minThreshold: 0.6,
      maxThreshold: 0.7999,
      cssClass: "pdf-vis-legend-swatch--low",
      legendLabel: "Low (60-79%)",
      ariaLabel: "Low confidence, 60 to 79 percent",
    },

    /**
     * Very low confidence level (<60%)
     * Colours defined in CSS class .pdf-vis-legend-swatch--very-low
     */
    VERY_LOW: {
      name: "Very Low",
      minThreshold: 0,
      maxThreshold: 0.5999,
      cssClass: "pdf-vis-legend-swatch--very-low",
      legendLabel: "Very Low (<60%)",
      ariaLabel: "Very low confidence, below 60 percent",
    },
  },

  // ===========================================================================
  // RENDERING CONFIGURATION
  // ===========================================================================

  /**
   * @memberof PDF_VISUALISER_CONFIG
   * @type {Object}
   * @description PDF rendering and canvas configuration
   *
   * @property {number} DEFAULT_SCALE - Initial rendering scale (1.5x for clarity)
   * @property {number} DEVICE_PIXEL_RATIO - Use device pixel ratio for sharp rendering
   * @property {string} CANVAS_BACKGROUND - Background colour for canvas
   * @property {number} OVERLAY_BORDER_WIDTH - Border width for confidence boxes
   * @property {boolean} SHOW_LABELS_DEFAULT - Whether to show percentage labels by default
   * @property {boolean} SHOW_OVERLAYS_DEFAULT - Whether to show overlays by default
   * @property {number} LABEL_FONT_SIZE - Font size for confidence percentage labels
   * @property {string} LABEL_FONT_FAMILY - Font family for labels
   *
   * @since 1.0.0
   */
  RENDERING: {
    DEFAULT_SCALE: 0.5,
    DEVICE_PIXEL_RATIO:
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    CANVAS_BACKGROUND: "#ffffff",
    OVERLAY_BORDER_WIDTH: 2,
    SHOW_LABELS_DEFAULT: true,
    SHOW_OVERLAYS_DEFAULT: true,
    LABEL_FONT_SIZE: 11,
    LABEL_FONT_FAMILY: "system-ui, -apple-system, sans-serif",
    LABEL_TEXT_COLOUR: "#00131D", // Fixed colour for confidence labels (set to null to use confidence-level colours)
    LABEL_PADDING: 2,
    MIN_BOX_SIZE_FOR_LABEL: 30, // Minimum box dimension to show label
  },

  // ===========================================================================
  // ZOOM CONFIGURATION
  // ===========================================================================

  /**
   * @memberof PDF_VISUALISER_CONFIG
   * @type {Object}
   * @description Zoom control configuration
   *
   * @property {number} MIN_SCALE - Minimum zoom level (50%)
   * @property {number} MAX_SCALE - Maximum zoom level (300%)
   * @property {number} STEP - Zoom increment/decrement step
   * @property {Array<number>} PRESETS - Predefined zoom levels for quick access
   *
   * @since 1.0.0
   */
  ZOOM: {
    MIN_SCALE: 0.5,
    MAX_SCALE: 3.0,
    STEP: 0.25,
    PRESETS: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0],
  },

  // ===========================================================================
  // CSS CLASS NAMES
  // ===========================================================================

  /**
   * @memberof PDF_VISUALISER_CONFIG
   * @type {Object}
   * @description CSS class names for styling elements
   *
   * Follows BEM-like naming convention with 'pdf-vis' prefix
   *
   * @since 1.0.0
   */
  CSS_CLASSES: {
    // Container classes
    CONTAINER: "pdf-vis-container",
    VIEWER: "pdf-vis-viewer",
    CANVAS_WRAPPER: "pdf-vis-canvas-wrapper",
    PAGE_WRAPPER: "pdf-vis-page-wrapper",

    // Canvas classes
    PDF_CANVAS: "pdf-vis-pdf-canvas",
    OVERLAY_CANVAS: "pdf-vis-overlay-canvas",

    // Control classes
    CONTROLS: "pdf-vis-controls",
    CONTROL_GROUP: "pdf-vis-control-group",
    CONTROL_BUTTON: "pdf-vis-control-btn",
    CONTROL_BUTTON_ACTIVE: "pdf-vis-control-btn--active",

    // Navigation classes
    PAGE_NAV: "pdf-vis-page-nav",
    PAGE_INDICATOR: "pdf-vis-page-indicator",
    NAV_BUTTON: "pdf-vis-nav-btn",
    NAV_BUTTON_DISABLED: "pdf-vis-nav-btn--disabled",

    // Statistics classes
    STATS_PANEL: "pdf-vis-stats-panel",
    STATS_SUMMARY: "pdf-vis-stats-summary",
    STATS_BREAKDOWN: "pdf-vis-stats-breakdown",
    STAT_ITEM: "pdf-vis-stat-item",
    STAT_LABEL: "pdf-vis-stat-label",
    STAT_VALUE: "pdf-vis-stat-value",

    // Legend classes
    LEGEND: "pdf-vis-legend",
    LEGEND_ITEM: "pdf-vis-legend-item",
    LEGEND_SWATCH: "pdf-vis-legend-swatch",
    LEGEND_LABEL: "pdf-vis-legend-label",

    // Toggle classes
    TOGGLE: "pdf-vis-toggle",
    TOGGLE_LABEL: "pdf-vis-toggle-label",
    TOGGLE_SWITCH: "pdf-vis-toggle-switch",

    // State classes
    LOADING: "pdf-vis--loading",
    ERROR: "pdf-vis--error",
    HIDDEN: "pdf-vis--hidden",
    FULLSCREEN: "pdf-vis--fullscreen",

    // Interactive state (for page wrapper)
    INTERACTIVE: "pdf-vis-interactive",

    // Confidence level classes (for overlays)
    CONFIDENCE_HIGH: "pdf-vis-confidence--high",
    CONFIDENCE_MEDIUM: "pdf-vis-confidence--medium",
    CONFIDENCE_LOW: "pdf-vis-confidence--low",
    CONFIDENCE_VERY_LOW: "pdf-vis-confidence--very-low",
  },

  // ===========================================================================
  // ACCESSIBILITY (ARIA) CONFIGURATION
  // ===========================================================================

  /**
   * @memberof PDF_VISUALISER_CONFIG
   * @type {Object}
   * @description Accessibility labels and announcements
   *
   * All strings use British spelling
   *
   * @since 1.0.0
   */
  ARIA: {
    // Region labels
    CONTAINER_LABEL: "PDF Confidence Visualiser",
    STATS_LABEL: "OCR Confidence Statistics",
    LEGEND_LABEL: "Confidence Level Legend",
    CONTROLS_LABEL: "Visualiser Controls",
    PAGE_NAV_LABEL: "PDF Page Navigation",

    // Button labels
    PREV_PAGE: "Go to previous page",
    NEXT_PAGE: "Go to next page",
    ZOOM_IN: "Zoom in",
    ZOOM_OUT: "Zoom out",
    TOGGLE_OVERLAYS: "Toggle confidence overlays",
    TOGGLE_LABELS: "Toggle percentage labels",
    ENTER_FULLSCREEN: "Enter fullscreen mode",
    EXIT_FULLSCREEN: "Exit fullscreen mode",
    FIT_TO_SCREEN: "Fit PDF to screen",

    // Live region announcements
    PAGE_CHANGED: "Now viewing page {current} of {total}",
    ZOOM_CHANGED: "Zoom level changed to {level} percent",
    OVERLAYS_ENABLED: "Confidence overlays enabled",
    OVERLAYS_DISABLED: "Confidence overlays disabled",
    LABELS_ENABLED: "Percentage labels enabled",
    LABELS_DISABLED: "Percentage labels disabled",
    FULLSCREEN_ENTERED: "Fullscreen mode enabled. Press F to exit.",
    FULLSCREEN_EXITED: "Fullscreen mode disabled",
    FIT_ENABLED: "PDF fitted to screen",
    FIT_DISABLED: "PDF returned to previous zoom level",
    LOADING: "Loading PDF page {page}",
    LOADED: "PDF page {page} loaded with {lines} lines analysed",
  },

  // ===========================================================================
  // USER-FACING MESSAGES
  // ===========================================================================

  /**
   * @memberof PDF_VISUALISER_CONFIG
   * @type {Object}
   * @description User-facing messages with British spelling
   *
   * @since 1.0.0
   */
  MESSAGES: {
    // Loading states
    LOADING_PDFJS: "Loading PDF viewer...",
    LOADING_PDF: "Loading PDF document...",
    LOADING_PAGE: "Rendering page...",
    LOADING_LINES: "Fetching confidence data...",

    // Success states
    READY: "PDF confidence visualiser ready",
    LOADED: "PDF loaded successfully",

    // Error states
    ERROR_PDFJS_LOAD: "Failed to load PDF viewer library",
    ERROR_PDF_LOAD: "Failed to load PDF document",
    ERROR_LINES_LOAD: "Failed to fetch confidence data",
    ERROR_RENDER: "Failed to render PDF page",
    ERROR_NO_DATA: "No confidence data available for this document",
    ERROR_INVALID_PAGE: "Invalid page number requested",

    // Warnings
    WARN_LOW_CONFIDENCE: "This page contains lines with low OCR confidence",
    WARN_NO_LINES: "No text lines detected on this page",

    // Info
    INFO_LINES_COUNT: "{count} lines analysed on this page",
    INFO_AVG_CONFIDENCE: "Average confidence: {avg}%",
  },

  // ===========================================================================
  // LINE TYPE CONFIGURATION
  // ===========================================================================

  /**
   * @memberof PDF_VISUALISER_CONFIG
   * @type {Object}
   * @description Configuration for different line content types
   *
   * MathPix lines.json provides type information for each line
   * This configuration allows filtering and special handling by type
   *
   * @since 1.0.0
   */
  LINE_TYPES: {
    TEXT: {
      name: "Text",
      showByDefault: true,
      icon: "📝",
    },
    MATH: {
      name: "Mathematics",
      showByDefault: true,
      icon: "🔢",
    },
    TABLE: {
      name: "Table",
      showByDefault: true,
      icon: "📊",
    },
    DIAGRAM: {
      name: "Diagram",
      showByDefault: true,
      icon: "📈",
    },
    HANDWRITTEN: {
      name: "Handwritten",
      showByDefault: true,
      icon: "✍️",
    },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// =============================================================================
// COLOUR READING FROM CSS
// =============================================================================

/**
 * Cache for colours read from CSS (avoids repeated DOM operations)
 * @type {Map<string, Object>}
 * @private
 */
const colourCache = new Map();

/**
 * @function getColoursFromCSS
 * @description Reads background-color and border-color from a CSS class
 * @param {string} cssClass - The CSS class name to read colours from
 * @returns {Object} Object with fillColour and borderColour
 * @since 1.1.0
 */
function getColoursFromCSS(cssClass) {
  // Check cache first
  if (colourCache.has(cssClass)) {
    return colourCache.get(cssClass);
  }

  // Default fallback colours
  const fallback = {
    fillColour: "rgba(128, 128, 128, 0.3)",
    borderColour: "#808080",
  };

  // Cannot read CSS if not in browser
  if (typeof window === "undefined" || !document.body) {
    logWarn("Cannot read CSS colours - not in browser environment");
    return fallback;
  }

  try {
    // Create temporary element with BOTH base class and modifier class
    // Base class provides border-style:solid which is needed for border-color to compute
    const tempElement = document.createElement("span");
    tempElement.className = `pdf-vis-legend-swatch ${cssClass}`;
    tempElement.style.position = "absolute";
    tempElement.style.visibility = "hidden";
    tempElement.style.pointerEvents = "none";
    // Ensure border-style is set (required for border-color to compute correctly)
    tempElement.style.borderStyle = "solid";
    tempElement.style.borderWidth = "2px";
    document.body.appendChild(tempElement);

    // Read computed styles
    const computedStyle = window.getComputedStyle(tempElement);
    const colours = {
      fillColour: computedStyle.backgroundColor || fallback.fillColour,
      borderColour:
        computedStyle.borderColor ||
        computedStyle.borderTopColor ||
        fallback.borderColour,
    };

    // Clean up
    document.body.removeChild(tempElement);

    // Cache the result
    colourCache.set(cssClass, colours);

    logDebug("Read colours from CSS", { cssClass, colours });
    return colours;
  } catch (error) {
    logError("Failed to read colours from CSS", {
      cssClass,
      error: error.message,
    });
    return fallback;
  }
}

/**
 * @function getConfidenceLevelColours
 * @description Gets the colours for a confidence level by reading from CSS
 * @param {string} levelKey - Confidence level key (HIGH, MEDIUM, LOW, VERY_LOW)
 * @returns {Object} Object with fillColour and borderColour
 * @since 1.1.0
 */
function getConfidenceLevelColours(levelKey) {
  const level = PDF_VISUALISER_CONFIG.CONFIDENCE_LEVELS[levelKey];
  if (!level || !level.cssClass) {
    logWarn("Unknown confidence level or missing cssClass", { levelKey });
    return {
      fillColour: "rgba(128, 128, 128, 0.3)",
      borderColour: "#808080",
    };
  }

  return getColoursFromCSS(level.cssClass);
}

/**
 * @function clearColourCache
 * @description Clears the colour cache (useful when theme changes)
 * @since 1.1.0
 */
function clearColourCache() {
  colourCache.clear();
  logDebug("Colour cache cleared");
}

/**
 * @function getConfidenceLevelByRate
 * @description Determines confidence level category based on confidence rate
 *
 * @param {number} confidenceRate - Confidence rate between 0 and 1
 * @returns {Object} Confidence level configuration object
 *
 * @example
 * const level = getConfidenceLevelByRate(0.92);
 * console.log(level.name); // 'Medium'
 * console.log(level.fillColour); // 'rgba(250, 204, 21, 0.3)'
 *
 * @since 1.0.0
 */
function getConfidenceLevelByRate(confidenceRate) {
  const levels = PDF_VISUALISER_CONFIG.CONFIDENCE_LEVELS;

  if (confidenceRate >= levels.HIGH.minThreshold) {
    return levels.HIGH;
  } else if (confidenceRate >= levels.MEDIUM.minThreshold) {
    return levels.MEDIUM;
  } else if (confidenceRate >= levels.LOW.minThreshold) {
    return levels.LOW;
  } else {
    return levels.VERY_LOW;
  }
}

/**
 * @function getConfidenceLevelKey
 * @description Gets the key name for a confidence level based on rate
 *
 * @param {number} confidenceRate - Confidence rate between 0 and 1
 * @returns {string} Level key: 'HIGH', 'MEDIUM', 'LOW', or 'VERY_LOW'
 *
 * @since 1.0.0
 */
function getConfidenceLevelKey(confidenceRate) {
  const levels = PDF_VISUALISER_CONFIG.CONFIDENCE_LEVELS;

  if (confidenceRate >= levels.HIGH.minThreshold) {
    return "HIGH";
  } else if (confidenceRate >= levels.MEDIUM.minThreshold) {
    return "MEDIUM";
  } else if (confidenceRate >= levels.LOW.minThreshold) {
    return "LOW";
  } else {
    return "VERY_LOW";
  }
}

/**
 * @function formatPercentage
 * @description Formats confidence rate as percentage string
 *
 * @param {number} rate - Confidence rate between 0 and 1
 * @param {number} [decimals=0] - Number of decimal places
 * @returns {string} Formatted percentage string
 *
 * @example
 * formatPercentage(0.9523, 1); // '95.2%'
 *
 * @since 1.0.0
 */
function formatPercentage(rate, decimals = 0) {
  return `${(rate * 100).toFixed(decimals)}%`;
}

/**
 * @function formatAriaMessage
 * @description Formats ARIA message template with placeholders
 *
 * @param {string} template - Message template with {placeholder} syntax
 * @param {Object} values - Object with placeholder values
 * @returns {string} Formatted message
 *
 * @example
 * formatAriaMessage('Page {current} of {total}', { current: 1, total: 5 });
 * // Returns: 'Page 1 of 5'
 *
 * @since 1.0.0
 */
function formatAriaMessage(template, values) {
  let message = template;
  for (const [key, value] of Object.entries(values)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }
  return message;
}

// =============================================================================
// TOGGLETIP INTEGRATION HELPERS (STAGES 3 & 4)
// =============================================================================

/**
 * @function buildToggletipContent
 * @description Builds toggletip content HTML for a line
 *
 * Creates a structured HTML display showing confidence percentage,
 * level category, type, and extracted text with appropriate styling.
 *
 * @param {Object} line - Line data with confidence_rate, text, type
 * @param {number} line.confidence_rate - Confidence rate (0-1)
 * @param {string} [line.text] - Extracted text
 * @param {string} [line.type] - Line type (text, math, table, etc.)
 * @returns {string} HTML content for toggletip
 *
 * @example
 * const content = buildToggletipContent({
 *   confidence_rate: 0.92,
 *   text: 'Sample text',
 *   type: 'text'
 * });
 *
 * @since 1.2.0
 */
function buildToggletipContent(line) {
  const confidencePercent = (line.confidence_rate * 100).toFixed(1);
  const levelKey = getConfidenceLevelKey(line.confidence_rate);

  const displayText = line.text
    ? line.text.length > 150
      ? line.text.substring(0, 150) + "…"
      : line.text
    : "(No text extracted)";

  const levelLabels = {
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
    VERY_LOW: "Needs Review",
  };

  return `
    <div class="toggletip-row">
      <span class="toggletip-label">Confidence</span>
      <span class="toggletip-confidence-value toggletip-confidence-${levelKey
        .toLowerCase()
        .replace("_", "-")}">${confidencePercent}%</span>
    </div>
    <div class="toggletip-row">
      <span class="toggletip-label">Level</span>
      <span class="toggletip-value">${levelLabels[levelKey] || "Unknown"}</span>
    </div>
    <div class="toggletip-row">
      <span class="toggletip-label">Type</span>
      <span class="toggletip-value">${line.type || "Unknown"}</span>
    </div>
    <div class="toggletip-row">
      <span class="toggletip-label">Text</span>
      <span class="toggletip-value" style="font-size: 0.8125rem;">${escapeHtml(
        displayText
      )}</span>
    </div>
  `;
}

/**
 * @function buildAccessibleLabel
 * @description Builds accessible label for screen readers
 *
 * Creates a concise, informative label for screen reader users
 * that includes the line number, text preview, and confidence level.
 *
 * @param {Object} line - Line data
 * @param {number} line.confidence_rate - Confidence rate (0-1)
 * @param {string} [line.text] - Extracted text
 * @param {string} [line.type] - Line type
 * @param {number} index - Line index (0-based)
 * @returns {string} Accessible label
 *
 * @example
 * const label = buildAccessibleLabel(
 *   { confidence_rate: 0.92, text: 'Sample text' },
 *   0
 * );
 * // Returns: 'Line 1: "Sample text" - 92.0% confidence'
 *
 * @since 1.2.0
 */
function buildAccessibleLabel(line, index) {
  const confidencePercent = (line.confidence_rate * 100).toFixed(1);
  const textPreview = line.text
    ? `"${line.text.substring(0, 30)}${line.text.length > 30 ? "…" : ""}"`
    : line.type || "Unknown type";

  return `Line ${index + 1}: ${textPreview} - ${confidencePercent}% confidence`;
}

/**
 * @function getToggletipType
 * @description Gets toggletip type based on confidence level
 *
 * Maps confidence levels to toggletip visual types for consistent
 * colour coding across the application.
 *
 * @param {number} confidence - Confidence rate (0-1)
 * @returns {string} Toggletip type: 'success', 'info', 'warning', or 'error'
 *
 * @example
 * getToggletipType(0.98); // Returns: 'success'
 * getToggletipType(0.85); // Returns: 'info'
 * getToggletipType(0.72); // Returns: 'warning'
 * getToggletipType(0.45); // Returns: 'error'
 *
 * @since 1.2.0
 */
function getToggletipType(confidence) {
  if (confidence >= 0.95) return "success";
  if (confidence >= 0.8) return "info";
  if (confidence >= 0.6) return "warning";
  return "error";
}

/**
 * @function escapeHtml
 * @description Escapes HTML to prevent XSS attacks
 *
 * Safely escapes HTML special characters in user-provided text
 * to prevent cross-site scripting vulnerabilities.
 *
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for innerHTML
 *
 * @example
 * escapeHtml('<script>alert("XSS")</script>');
 * // Returns: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
 *
 * @since 1.2.0
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * @function validateConfig
 * @description Validates configuration integrity
 *
 * @returns {Object} Validation result with isValid boolean and any errors
 *
 * @since 1.0.0
 */
function validateConfig() {
  const errors = [];

  // Check PDF.js URLs
  if (!PDF_VISUALISER_CONFIG.PDFJS.LIB_URL) {
    errors.push("Missing PDF.js library URL");
  }
  if (!PDF_VISUALISER_CONFIG.PDFJS.WORKER_URL) {
    errors.push("Missing PDF.js worker URL");
  }

  // Check confidence levels
  const levels = PDF_VISUALISER_CONFIG.CONFIDENCE_LEVELS;
  for (const [key, level] of Object.entries(levels)) {
    if (typeof level.minThreshold !== "number") {
      errors.push(`Invalid minThreshold for ${key} confidence level`);
    }
    if (!level.fillColour || !level.borderColour) {
      errors.push(`Missing colour configuration for ${key} confidence level`);
    }
  }

  const isValid = errors.length === 0;

  if (!isValid) {
    logError("Configuration validation failed", { errors });
  } else {
    logDebug("Configuration validated successfully");
  }

  return { isValid, errors };
}

// =============================================================================
// GLOBAL EXPOSURE FOR TESTING AND CROSS-MODULE ACCESS
// =============================================================================

// Expose main config object globally
window.PDF_VISUALISER_CONFIG = PDF_VISUALISER_CONFIG;

// Expose helper functions globally for use by other modules
window.getConfidenceLevelByRate = getConfidenceLevelByRate;
window.getConfidenceLevelKey = getConfidenceLevelKey;
window.getConfidenceLevelColours = getConfidenceLevelColours;
window.clearColourCache = clearColourCache;
window.formatPercentage = formatPercentage;
window.formatAriaMessage = formatAriaMessage;
window.validateConfig = validateConfig;

// Expose toggletip helper functions (Stages 3 & 4)
window.buildToggletipContent = buildToggletipContent;
window.buildAccessibleLabel = buildAccessibleLabel;
window.getToggletipType = getToggletipType;
window.escapeHtml = escapeHtml;

logInfo("PDF Visualiser Config loaded and exposed globally");

// =============================================================================
// EXPORTS
// =============================================================================

export default PDF_VISUALISER_CONFIG;

export {
  getConfidenceLevelByRate,
  getConfidenceLevelKey,
  getConfidenceLevelColours,
  clearColourCache,
  formatPercentage,
  formatAriaMessage,
  validateConfig,
  buildToggletipContent,
  buildAccessibleLabel,
  getToggletipType,
  escapeHtml,
  logError,
  logWarn,
  logInfo,
  logDebug,
};
