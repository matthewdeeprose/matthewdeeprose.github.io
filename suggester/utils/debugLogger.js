/**
 * @fileoverview Debug Logger Utility
 * Provides centralized logging control for development and debugging
 */

export class DebugLogger {
  static #enabled = false;

  /**
   * Enable or disable debug logging
   * @param {boolean} enabled - Whether to enable debug logging
   */
  static setEnabled(enabled) {
    this.#enabled = enabled;
    this.log(`Debug logging ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Log a debug message if debug mode is enabled
   * @param {...any} args - Arguments to log
   */
  static log(...args) {
    if (this.#enabled) {
      console.log(`[${new Date().toISOString()}]`, ...args);
    }
  }

  /**
   * Log an error message (always logged regardless of debug mode)
   * @param {...any} args - Arguments to log
   */
  static error(...args) {
    console.error(`[${new Date().toISOString()}]`, ...args);
  }

  /**
   * Initialize debug mode based on URL parameter or localStorage
   */
  static init() {
    // Check URL parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get("debug");

    if (debugParam !== null) {
      // If debug parameter exists in URL, use it and save to localStorage
      const enabled = debugParam === "true" || debugParam === "1";
      localStorage.setItem("debugMode", enabled.toString());
      this.setEnabled(enabled);
    } else {
      // Otherwise check localStorage
      const storedDebug = localStorage.getItem("debugMode");
      this.setEnabled(storedDebug === "true");
    }
  }
}
