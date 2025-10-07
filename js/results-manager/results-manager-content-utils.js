/**
 * @module ContentProcessorUtils
 * @description Utility functions for content processors
 */
import { ResultsManagerUtils } from "./results-manager-utils.js";

// Logging configuration
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Default logging level - only show warnings and errors
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;

// Set to true to enable all logging (overrides LOG_LEVEL)
const ENABLE_ALL_LOGGING = false;

// Set to true to completely disable all logging
const DISABLE_ALL_LOGGING = false;

export class ContentProcessorUtils {
  constructor() {
    this.utils = new ResultsManagerUtils();
    this.logLevel = DEFAULT_LOG_LEVEL;
    this.shouldLog("Content processor utilities initialised", "info");
  }

  /**
   * Check if a log message should be output based on current log level
   * @param {string} message - Log message
   * @param {string} level - Log level (error, warn, info, debug)
   * @returns {boolean} Whether the message should be logged
   */
  shouldLog(message, level = "info") {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) {
      this.utils.log(message, {}, level);
      return true;
    }

    const messageLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    const shouldOutput = messageLevel <= this.logLevel;

    if (shouldOutput) {
      this.utils.log(message, {}, level);
    }

    return shouldOutput;
  }

  /**
   * Log a message with additional data if level permits
   * @param {string} message - Log message
   * @param {object} data - Additional data to log
   * @param {string} level - Log level (error, warn, info, debug)
   */
  logWithData(message, data = {}, level = "info") {
    if (DISABLE_ALL_LOGGING) return;
    if (ENABLE_ALL_LOGGING) {
      this.utils.log(message, data, level);
      return;
    }

    const messageLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    if (messageLevel <= this.logLevel) {
      this.utils.log(message, data, level);
    }
  }

  /**
   * Process escaped Markdown characters
   * @param {string} content - Content to process
   * @returns {string} Content with escaped characters processed
   */
  processEscapedCharacters(content) {
    this.shouldLog("Processing escaped characters", "debug");

    try {
      // Replace escaped Markdown characters with HTML entities
      // This needs to happen before other Markdown processing
      return content.replace(/\\([\\`*_{}[\]()#+\-.!|])/g, "$1");
    } catch (error) {
      this.logWithData(
        "Error processing escaped characters",
        { error },
        "error"
      );
      // Return the original content as fallback
      return content;
    }
  }

  /**
   * Sanitise a value for use in an HTML attribute
   * @param {string} value - The value to sanitise
   * @returns {string} Sanitised value safe for use in HTML attributes
   */
  sanitizeAttributeValue(value) {
    if (!value) return "";
    // Replace quotes and other problematic characters
    return value.replace(/["'&<>]/g, (char) => {
      switch (char) {
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        default:
          return char;
      }
    });
  }

  /**
   * Extract the actual URL from a security-enhanced URL
   * @param {string} url - The security-enhanced URL
   * @returns {string} The extracted actual URL or the original URL if extraction fails
   */
  extractActualUrl(url) {
    try {
      // Check if this is a security-enhanced URL (like Outlook SafeLinks)
      if (url.includes("safelinks.protection.outlook.com")) {
        // Try to extract the actual URL from the 'url' parameter
        const urlMatch = url.match(/[?&]url=([^&]+)/i);
        if (urlMatch && urlMatch[1]) {
          // Decode the URL parameter
          const decodedUrl = decodeURIComponent(urlMatch[1]);
          this.logWithData(
            "Extracted URL from security wrapper",
            {
              original: url,
              extracted: decodedUrl,
            },
            "info"
          );
          return decodedUrl;
        }
      }

      // Return the original URL if it's not a security-enhanced URL or extraction fails
      return url;
    } catch (error) {
      this.logWithData(
        "Error extracting actual URL from security wrapper",
        { error, url },
        "error"
      );
      return url; // Return the original URL on error
    }
  }

  /**
   * Get SVG icon for copy button
   * @returns {string} SVG icon markup
   */
  getCopyButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`;
  }
}
