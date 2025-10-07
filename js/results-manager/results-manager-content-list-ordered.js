/**
 * @module OrderedListProcessor
 * @description Processes ordered (numbered) lists
 */
import { ListProcessorBase } from "./results-manager-content-list-base.js";

export class OrderedListProcessor extends ListProcessorBase {
  /**
   * Create a new OrderedListProcessor instance
   */
  constructor() {
    super();
    this.utils.log("Ordered list processor initialized");
  }

  /**
   * Process ordered lists in content
   * @param {string} content - Content to process
   * @returns {string} Content with ordered lists converted to HTML
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing ordered lists");

      // Split content into lines for processing
      const lines = content.split("\n");
      let inList = false;
      let currentList = [];
      let result = [];
      let currentIndent = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const listInfo = this.isListItem(line);

        // Skip if line already contains an HTML list (avoid double-processing)
        if (
          line.includes("<ol") ||
          line.includes("<ul") ||
          line.includes("</ol>") ||
          line.includes("</ul>")
        ) {
          result.push(line);
          continue;
        }

        // If this is an ordered list item
        if (listInfo && listInfo.type === "ordered") {
          if (!inList) {
            // Start a new list
            inList = true;
            currentList = [line];
            currentIndent = listInfo.indent;
          } else {
            // Add to current list
            currentList.push(line);
          }
        } else {
          // Not a list item
          if (inList) {
            // Process and add the current list
            const processedList = this.processOrderedList(currentList);
            result.push(processedList);
            inList = false;
            currentList = [];
          }

          // Add the current line
          result.push(line);
        }
      }

      // If we're still in a list at the end, process and add it
      if (inList && currentList.length > 0) {
        const processedList = this.processOrderedList(currentList);
        result.push(processedList);
      }

      return result.join("\n");
    } catch (error) {
      this.utils.log("Error processing ordered lists", { error }, "error");
      return content; // Return original content on error
    }
  }

  /**
   * Process an ordered list
   * @param {string[]} lines - Array of list item lines
   * @returns {string} HTML ordered list
   */
  processOrderedList(lines) {
    if (!lines || lines.length === 0) return "";

    try {
      let html = "<ol>\n";
      let currentItem = null;
      let currentContent = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.trim().match(/^(\d+)\.[ \t]+(.+)$/);

        if (match) {
          // If we have a previous item, process and add it
          if (currentItem !== null && currentContent.length > 0) {
            const joinedContent = currentContent.join("\n");
            const formattedContent =
              this.processMultiLineContent(joinedContent);
            html += `  <li>${formattedContent}</li>\n`;
            currentContent = [];
          }

          // Start a new item
          currentItem = match[1];
          currentContent = [match[2]];
        } else if (currentItem !== null) {
          // This is a continuation of the current item
          currentContent.push(line);
        }
      }

      // Process the last item if there is one
      if (currentItem !== null && currentContent.length > 0) {
        const joinedContent = currentContent.join("\n");
        const formattedContent = this.processMultiLineContent(joinedContent);
        html += `  <li>${formattedContent}</li>\n`;
      }

      html += "</ol>";
      return html;
    } catch (error) {
      this.utils.log("Error processing ordered list", { error }, "error");
      return lines.join("\n"); // Return original content on error
    }
  }
}
