/**
 * Graph Builder Utils
 * Shared utilities, helpers, and constants for the Graph Builder
 *
 * @version 1.0.0
 */

const GraphBuilderUtils = (function () {
  "use strict";

  // Logging Configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging configuration
  let currentLogLevel = DEFAULT_LOG_LEVEL;
  let enableAllLogging = ENABLE_ALL_LOGGING;
  let disableAllLogging = DISABLE_ALL_LOGGING;

  /**
   * Check if logging should occur for given level
   * @param {number} level - Log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (disableAllLogging) return false;
    if (enableAllLogging) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {*} data - Additional data (optional)
   */
  function logError(message, data = null) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      if (data) {
        console.error(message, data);
      } else {
        console.error(message);
      }
    }
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {*} data - Additional data (optional)
   */
  function logWarn(message, data = null) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      if (data) {
        console.warn(message, data);
      } else {
        console.warn(message);
      }
    }
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {*} data - Additional data (optional)
   */
  function logInfo(message, data = null) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      if (data) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {*} data - Additional data (optional)
   */
  function logDebug(message, data = null) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      if (data) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }

  // Global Configuration
  const CONFIG = {
    maxFileSize: 1024 * 1024, // 1MB
    maxDataPoints: 1000,
    supportedChartTypes: [
      "bar",
      "line",
      "pie",
      "doughnut",
      "scatter",
      "bubble",
      "radar",
      "polarArea",
    ],
    debugMode: false,
  };

  /**
   * Debug Helper
   * Provides debugging and logging utilities
   */
  class DebugHelper {
    constructor() {
      this.logHistory = [];
      this.maxLogHistory = 100;
    }

    /**
     * Log workflow step with context
     * @param {string} step - Step description
     * @param {*} data - Additional data to log
     */
    logWorkflowStep(step, data = null) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        step,
        data: data ? JSON.stringify(data, null, 2) : null,
      };

      this.logHistory.push(logEntry);

      // Limit history size
      if (this.logHistory.length > this.maxLogHistory) {
        this.logHistory.shift();
      }

      if (CONFIG.debugMode) {
        logInfo(`[Graph Builder Workflow] ${step}`, data || "");
      }
    }

    /**
     * Validate current state for debugging
     * @param {Object} state - Current application state
     * @returns {Object} Validation summary
     */
    validateState(state) {
      return {
        timestamp: new Date().toISOString(),
        currentScreen: state.currentScreen,
        currentDataMethod: state.currentDataMethod,
        selectedChartType: state.selectedChartType,
        hasChartData: !!state.chartData,
        dataRowCount: state.chartData ? state.chartData.rows?.length || 0 : 0,
        formRowCount: state.formRowCount,
        initialised: state.initialised,
      };
    }

    /**
     * Get debug history
     * @returns {Array} Array of log entries
     */
    getHistory() {
      return [...this.logHistory];
    }

    /**
     * Clear debug history
     */
    clearHistory() {
      this.logHistory = [];
    }

    /**
     * Export debug information
     * @returns {Object} Debug export data
     */
    exportDebugInfo() {
      return {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        config: CONFIG,
        logHistory: this.logHistory,
        browserInfo: this.getBrowserInfo(),
        dependencies: this.checkDependencies(),
      };
    }

    /**
     * Get browser information
     * @returns {Object} Browser info
     */
    getBrowserInfo() {
      return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      };
    }

    /**
     * Check dependency availability
     * @returns {Object} Dependency status
     */
    checkDependencies() {
      const dependencies = [
        "Chart",
        "ChartDataManager",
        "ChartBuilderState",
        "ChartAccessibility",
        "ChartControls",
      ];

      const status = {};
      dependencies.forEach((dep) => {
        status[dep] = typeof window[dep] !== "undefined";
      });

      return status;
    }
  }

  /**
   * Validation Helper
   * Common validation functions
   */
  class ValidationHelper {
    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Whether email is valid
     */
    isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }

    /**
     * Validate file size
     * @param {number} size - File size in bytes
     * @returns {boolean} Whether file size is acceptable
     */
    isValidFileSize(size) {
      return size <= CONFIG.maxFileSize;
    }

    /**
     * Validate chart type
     * @param {string} chartType - Chart type to validate
     * @returns {boolean} Whether chart type is supported
     */
    isValidChartType(chartType) {
      return CONFIG.supportedChartTypes.includes(chartType);
    }

    /**
     * Validate data structure
     * @param {Object} data - Data to validate
     * @returns {Object} Validation result
     */
    validateDataStructure(data) {
      const errors = [];

      if (!data) {
        errors.push("Data is required");
      } else {
        if (!data.headers || !Array.isArray(data.headers)) {
          errors.push("Headers array is required");
        }

        if (!data.rows || !Array.isArray(data.rows)) {
          errors.push("Rows array is required");
        } else if (data.rows.length === 0) {
          errors.push("At least one data row is required");
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    }

    /**
     * Sanitise string input
     * @param {string} input - Input to sanitise
     * @returns {string} Sanitised string
     */
    sanitiseString(input) {
      if (typeof input !== "string") {
        return "";
      }

      return input
        .trim()
        .replace(/[<>]/g, "") // Remove potential HTML
        .substring(0, 1000); // Limit length
    }

    /**
     * Validate numeric input
     * @param {*} value - Value to validate
     * @returns {Object} Validation result
     */
    validateNumeric(value) {
      const num = parseFloat(value);
      const isValid = !isNaN(num) && isFinite(num);

      return {
        valid: isValid,
        value: isValid ? num : null,
        originalValue: value,
      };
    }
  }

  /**
   * DOM Helper
   * DOM manipulation utilities
   */
  class DOMHelper {
    /**
     * Safely get element by ID
     * @param {string} id - Element ID
     * @returns {HTMLElement|null} Element or null
     */
    getElementById(id) {
      try {
        return document.getElementById(id);
      } catch (error) {
        logError(`Error getting element with ID '${id}':`, error);
        return null;
      }
    }

    /**
     * Safely query selector
     * @param {string} selector - CSS selector
     * @param {HTMLElement} parent - Parent element (optional)
     * @returns {HTMLElement|null} Element or null
     */
    querySelector(selector, parent = document) {
      try {
        return parent.querySelector(selector);
      } catch (error) {
        logError(`Error with selector '${selector}':`, error);
        return null;
      }
    }

    /**
     * Safely query all elements
     * @param {string} selector - CSS selector
     * @param {HTMLElement} parent - Parent element (optional)
     * @returns {NodeList} NodeList (may be empty)
     */
    querySelectorAll(selector, parent = document) {
      try {
        return parent.querySelectorAll(selector);
      } catch (error) {
        logError(`Error with selector '${selector}':`, error);
        return [];
      }
    }

    /**
     * Create element with attributes
     * @param {string} tagName - Element tag name
     * @param {Object} attributes - Attributes to set
     * @param {string} textContent - Text content (optional)
     * @returns {HTMLElement} Created element
     */
    createElement(tagName, attributes = {}, textContent = "") {
      const element = document.createElement(tagName);

      Object.entries(attributes).forEach(([key, value]) => {
        if (key === "className") {
          element.className = value;
        } else if (key === "style" && typeof value === "object") {
          Object.assign(element.style, value);
        } else {
          element.setAttribute(key, value);
        }
      });

      if (textContent) {
        element.textContent = textContent;
      }

      return element;
    }

    /**
     * Add event listener with error handling
     * @param {HTMLElement} element - Element to add listener to
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    addEventListenerSafe(element, event, handler, options = {}) {
      if (!element || typeof handler !== "function") {
        logError("Invalid element or handler for event listener");
        return;
      }

      try {
        element.addEventListener(
          event,
          (e) => {
            try {
              handler(e);
            } catch (error) {
              logError(`Error in event handler for '${event}':`, error);
            }
          },
          options
        );
      } catch (error) {
        logError(`Error adding event listener for '${event}':`, error);
      }
    }

    /**
     * Focus element with error handling
     * @param {HTMLElement} element - Element to focus
     */
    focusSafe(element) {
      if (!element || typeof element.focus !== "function") {
        return;
      }

      try {
        element.focus();
      } catch (error) {
        logError("Error focusing element:", error);
      }
    }
  }

  /**
   * Format Helper
   * Formatting and conversion utilities
   */
  class FormatHelper {
    /**
     * Format file size
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size string
     */
    formatFileSize(bytes) {
      if (bytes === 0) return "0 Bytes";

      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    /**
     * Format number with locale
     * @param {number} number - Number to format
     * @param {Object} options - Formatting options
     * @returns {string} Formatted number
     */
    formatNumber(number, options = {}) {
      const {
        minimumFractionDigits = 0,
        maximumFractionDigits = 2,
        locale = "en-GB",
      } = options;

      return new Intl.NumberFormat(locale, {
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(number);
    }

    /**
     * Format date/time
     * @param {Date} date - Date to format
     * @param {Object} options - Formatting options
     * @returns {string} Formatted date
     */
    formatDateTime(date, options = {}) {
      const {
        locale = "en-GB",
        dateStyle = "medium",
        timeStyle = "short",
      } = options;

      return new Intl.DateTimeFormat(locale, {
        dateStyle,
        timeStyle,
      }).format(date);
    }

    /**
     * Truncate text with ellipsis
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated text
     */
    truncateText(text, maxLength = 100) {
      if (!text || text.length <= maxLength) {
        return text;
      }

      return text.substring(0, maxLength - 3) + "...";
    }

    /**
     * Capitalise first letter
     * @param {string} text - Text to capitalise
     * @returns {string} Capitalised text
     */
    capitalise(text) {
      if (!text) return "";
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    /**
     * Convert camelCase to kebab-case
     * @param {string} text - Text to convert
     * @returns {string} Kebab-case text
     */
    camelToKebab(text) {
      return text.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    }

    /**
     * Convert kebab-case to camelCase
     * @param {string} text - Text to convert
     * @returns {string} CamelCase text
     */
    kebabToCamel(text) {
      return text.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    }
  }

  /**
   * Performance Helper
   * Performance monitoring utilities
   */
  class PerformanceHelper {
    constructor() {
      this.timers = new Map();
    }

    /**
     * Start performance timer
     * @param {string} label - Timer label
     */
    startTimer(label) {
      this.timers.set(label, performance.now());
    }

    /**
     * End performance timer
     * @param {string} label - Timer label
     * @returns {number} Elapsed time in milliseconds
     */
    endTimer(label) {
      const startTime = this.timers.get(label);
      if (!startTime) {
        logWarn(`Timer '${label}' not found`);
        return 0;
      }

      const elapsed = performance.now() - startTime;
      this.timers.delete(label);

      logDebug(`[Performance] ${label}: ${elapsed.toFixed(2)}ms`);
      return elapsed;
    }

    /**
     * Measure function execution time
     * @param {Function} fn - Function to measure
     * @param {string} label - Measurement label
     * @returns {*} Function result
     */
    measure(fn, label = "Function") {
      const start = performance.now();
      const result = fn();
      const end = performance.now();

      logDebug(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
      return result;
    }

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Limit in milliseconds
     * @returns {Function} Throttled function
     */
    throttle(func, limit) {
      let inThrottle;
      return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      };
    }
  }

  // Create instances
  const debugHelper = new DebugHelper();
  const validationHelper = new ValidationHelper();
  const domHelper = new DOMHelper();
  const formatHelper = new FormatHelper();
  const performanceHelper = new PerformanceHelper();

  // Log module initialisation
  logInfo("[Graph Builder Utils] Module initialised successfully");

  // Public API
  return {
    // Configuration
    CONFIG,

    // Logging configuration and controls
    logging: {
      levels: LOG_LEVELS,
      setLevel: (level) => {
        if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
          currentLogLevel = level;
          logInfo(`Logging level set to: ${Object.keys(LOG_LEVELS)[level]}`);
        } else {
          logWarn(`Invalid logging level: ${level}`);
        }
      },
      getLevel: () => currentLogLevel,
      enableAll: () => {
        enableAllLogging = true;
        disableAllLogging = false;
        logInfo("All logging enabled");
      },
      disableAll: () => {
        disableAllLogging = true;
        enableAllLogging = false;
      },
      resetToDefault: () => {
        currentLogLevel = DEFAULT_LOG_LEVEL;
        enableAllLogging = ENABLE_ALL_LOGGING;
        disableAllLogging = DISABLE_ALL_LOGGING;
        logInfo("Logging configuration reset to default");
      },
      // Direct access to logging functions
      error: logError,
      warn: logWarn,
      info: logInfo,
      debug: logDebug,
    },

    // Debug utilities
    debug: {
      logWorkflowStep: (...args) => debugHelper.logWorkflowStep(...args),
      validateState: (...args) => debugHelper.validateState(...args),
      getHistory: () => debugHelper.getHistory(),
      clearHistory: () => debugHelper.clearHistory(),
      exportDebugInfo: () => debugHelper.exportDebugInfo(),
      setDebugMode: (enabled) => {
        CONFIG.debugMode = enabled;
      },
    },

    // Validation utilities
    validate: {
      email: (...args) => validationHelper.isValidEmail(...args),
      fileSize: (...args) => validationHelper.isValidFileSize(...args),
      chartType: (...args) => validationHelper.isValidChartType(...args),
      dataStructure: (...args) =>
        validationHelper.validateDataStructure(...args),
      numeric: (...args) => validationHelper.validateNumeric(...args),
      sanitiseString: (...args) => validationHelper.sanitiseString(...args),
    },

    // DOM utilities
    dom: {
      getById: (...args) => domHelper.getElementById(...args),
      query: (...args) => domHelper.querySelector(...args),
      queryAll: (...args) => domHelper.querySelectorAll(...args),
      create: (...args) => domHelper.createElement(...args),
      addListener: (...args) => domHelper.addEventListenerSafe(...args),
      focus: (...args) => domHelper.focusSafe(...args),
    },

    // Format utilities
    format: {
      fileSize: (...args) => formatHelper.formatFileSize(...args),
      number: (...args) => formatHelper.formatNumber(...args),
      dateTime: (...args) => formatHelper.formatDateTime(...args),
      truncate: (...args) => formatHelper.truncateText(...args),
      capitalise: (...args) => formatHelper.capitalise(...args),
      camelToKebab: (...args) => formatHelper.camelToKebab(...args),
      kebabToCamel: (...args) => formatHelper.kebabToCamel(...args),
    },

    // Performance utilities
    performance: {
      startTimer: (...args) => performanceHelper.startTimer(...args),
      endTimer: (...args) => performanceHelper.endTimer(...args),
      measure: (...args) => performanceHelper.measure(...args),
      debounce: (...args) => performanceHelper.debounce(...args),
      throttle: (...args) => performanceHelper.throttle(...args),
    },

    // Direct access to helper instances (for advanced usage)
    _helpers: {
      debug: debugHelper,
      validation: validationHelper,
      dom: domHelper,
      format: formatHelper,
      performance: performanceHelper,
    },
  };
})();

// Export for other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderUtils;
} else {
  window.GraphBuilderUtils = GraphBuilderUtils;
}
