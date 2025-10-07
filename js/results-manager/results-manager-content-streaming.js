/**
 * @module StreamingContentProcessor
 * @description Processes streaming content for real-time display
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";

export class StreamingContentProcessor extends ContentProcessorBase {
  /**
   * Create a new StreamingContentProcessor instance
   */
  constructor() {
    super();
    this.utils.log("Streaming content processor initialized");
  }

  /**
   * Process streaming content
   * @param {string} content - Content to process
   * @returns {string} Processed content
   */
  process(content) {
    if (!content) return "";
    
    try {
      this.utils.log("Processing streaming content");
      return this.processStreamingChunk(content);
    } catch (error) {
      this.utils.log("Error processing streaming content", { error }, "error");
      return content;
    }
  }

  /**
   * Process a chunk of streaming content
   * @param {string} chunk - Content chunk to process
   * @returns {string} Processed chunk
   */
  processStreamingChunk(chunk) {
    try {
      this.utils.log("Processing streaming chunk", {
        chunkPreview: chunk.substring(0, 100),
        containsTaskList: chunk.includes("- [x]") || chunk.includes("- [ ]"),
        length: chunk.length,
      });

      // Basic sanitization for streaming
      let processed = chunk.replace(/</g, "&lt;").replace(/>/g, "&gt;");

      // Special handling for task lists before converting newlines
      if (processed.includes("- [x]") || processed.includes("- [ ]")) {
        this.utils.log("Task list detected in streaming chunk");
        // Don't convert newlines to <br> for task lists as they need special handling
        return processed;
      }

      // Convert line breaks to <br> for streaming display
      processed = processed.replace(/\n/g, "<br>");

      return processed;
    } catch (error) {
      this.utils.log("Error processing streaming chunk", { error }, "error");
      return chunk.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  }
}