/**
 * @module ListContentProcessor
 * @description Orchestrates list content processing using specialized processors
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";
import { TaskListProcessor } from "./results-manager-content-list-task.js";
import { OrderedListProcessor } from "./results-manager-content-list-ordered.js";
import { UnorderedListProcessor } from "./results-manager-content-list-unordered.js";
import { NestedListProcessor } from "./results-manager-content-list-nested.js";
import { ListCodeBlockProcessor } from "./results-manager-content-list-code-blocks.js";

export class ListContentProcessor extends ContentProcessorBase {
  /**
   * Create a new ListContentProcessor instance
   */
  constructor() {
    super();

    // Initialize specialized processors
    this.taskListProcessor = new TaskListProcessor();
    this.orderedListProcessor = new OrderedListProcessor();
    this.unorderedListProcessor = new UnorderedListProcessor();
    this.nestedListProcessor = new NestedListProcessor();
    this.codeBlockProcessor = new ListCodeBlockProcessor();

    this.utils.log("List content processor orchestrator initialized");
  }

  /**
   * Process lists in content
   * @param {string} content - Content to process
   * @returns {string} Processed content with HTML lists
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing lists");
      let processed = content;

      // Process task lists first
      processed = this.taskListProcessor.process(processed);

      // Process lists with code blocks (this needs special handling)
      processed = this.codeBlockProcessor.process(processed);

      // Process nested lists (handles both ordered and unordered with nesting)
      processed = this.nestedListProcessor.process(processed);

      // Process any remaining simple ordered and unordered lists
      processed = this.orderedListProcessor.process(processed);
      processed = this.unorderedListProcessor.process(processed);

      return processed;
    } catch (error) {
      this.utils.log("Error processing lists", { error }, "error");
      return content; // Return original content on error
    }
  }

  /**
   * Get SVG icon for copy button (for backward compatibility)
   * @returns {string} SVG icon markup
   */
  getCopyButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`;
  }

  /**
   * Generate a valid ID from header text (for backward compatibility)
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
