/**
 * @fileoverview Token Counter Logger
 * Provides structured logging functionality for the token counter system.
 * Includes accessibility-focused console output formatting.
 */

import { CONFIG } from "../config.js";

/**
 * TokenLogger class
 * Handles all logging operations for the token counter system
 * with accessibility-focused output formatting
 */
export class TokenLogger {
  /**
   * Log a message with optional data
   * Uses console grouping for better readability and screen reader support
   *
   * @param {string} component - The component generating the log
   * @param {string} message - The message to log
   * @param {*} [data=null] - Optional data to include in the log
   */
  static log(component, message, data = null) {
    if (CONFIG.DEBUG.TOKEN_COUNTER) {
      console.group(`TokenCounter[${component}]: ${message}`);
      if (data) console.log("Data:", data);
      console.trace("Stack trace");
      console.groupEnd();
    }
  }
}
