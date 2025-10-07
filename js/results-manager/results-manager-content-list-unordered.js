/**
 * @module UnorderedListProcessor
 * @description Processes unordered (bullet) lists
 */
import { ListProcessorBase } from "./results-manager-content-list-base.js";

export class UnorderedListProcessor extends ListProcessorBase {
  /**
   * Create a new UnorderedListProcessor instance
   */
  constructor() {
    super();
    this.utils.log("Unordered list processor initialized");
  }

  /**
   * Process unordered lists in content
   * @param {string} content - Content to process
   * @returns {string} Content with unordered lists converted to HTML
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing unordered lists");

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

        // If this is an unordered list item
        if (listInfo && listInfo.type === "unordered") {
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
            const processedList = this.processUnorderedList(currentList);
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
        const processedList = this.processUnorderedList(currentList);
        result.push(processedList);
      }

      return result.join("\n");
    } catch (error) {
      this.utils.log("Error processing unordered lists", { error }, "error");
      return content; // Return original content on error
    }
  }

  /**
   * Process an unordered list
   * @param {string[]} lines - Array of list item lines
   * @returns {string} HTML unordered list
   */
  processUnorderedList(lines) {
    if (!lines || lines.length === 0) return "";

    try {
      let html = "<ul>\n";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.trim().match(/^(-|\*|\•)[ \t]+(.+)$/);

        if (match) {
          const content = match[2];
          const formattedContent = this.processInlineFormatting(content);
          html += `  <li>${formattedContent}</li>\n`;
        }
      }

      html += "</ul>";
      return html;
    } catch (error) {
      this.utils.log("Error processing unordered list", { error }, "error");
      return lines.join("\n"); // Return original content on error
    }
  }
}
