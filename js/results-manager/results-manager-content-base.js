/**
 * @module ContentProcessorBase
 * @description Base class for content processors with common functionality
 */
import { ResultsManagerUtils } from "./results-manager-utils.js";

export class ContentProcessorBase {
  /**
   * Create a new ContentProcessorBase instance
   */
  constructor() {
    this.utils = new ResultsManagerUtils();
    this.utils.log("Base content processor initialized");
  }

  /**
   * Process content - to be implemented by derived classes
   * @param {string} content - Content to process
   * @returns {string} Processed content
   */
  process(content) {
    this.utils.log("Base processor process method called - should be overridden");
    return content;
  }
  
  /**
   * Generate a valid ID from header text
   * @param {string} text - Header text
   * @returns {string} Valid ID for use in anchor links
   */
  generateHeaderId(text) {
    try {
      // Convert to lowercase, replace non-alphanumeric chars with hyphens, remove leading/trailing hyphens
      return (
        text
          .toLowerCase()
          .replace(/[^\w\s-]/g, "") // Remove special characters
          .replace(/\s+/g, "-") // Replace spaces with hyphens
          .replace(/^-+|-+$/g, "") || // Remove leading/trailing hyphens
        "header"
      ); // Fallback if empty
    } catch (error) {
      this.utils.log("Error generating header ID", { error, text }, "error");
      return `header-${Date.now()}`; // Fallback with timestamp
    }
  }
}