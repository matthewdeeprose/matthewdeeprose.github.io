/**
 * @module ListProcessorBase
 * @description Base class for list processors with common functionality
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";

export class ListProcessorBase extends ContentProcessorBase {
  /**
   * Create a new ListProcessorBase instance
   */
  constructor() {
    super();
    this.utils.log("List processor base initialized");
  }

  /**
   * Process list content - to be implemented by derived classes
   * @param {string} content - Content to process
   * @returns {string} Processed content
   */
  process(content) {
    this.utils.log(
      "Base list processor process method called - should be overridden"
    );
    return content;
  }

  /**
   * Check if a line is a list item
   * @param {string} line - Line to check
   * @returns {Object|null} List information or null if not a list item
   */
  isListItem(line) {
    if (!line || !line.trim()) return null;

    // Check for ordered list item (e.g., "1. Item")
    const orderedMatch = line.trim().match(/^(\d+)\.[ \t]+(.+)$/);
    if (orderedMatch) {
      return {
        type: "ordered",
        number: parseInt(orderedMatch[1], 10),
        content: orderedMatch[2],
        indent: (line.match(/^(\s*)/)[1] || "").length,
      };
    }

    // Check for unordered list item (e.g., "- Item" or "* Item")
    const unorderedMatch = line.trim().match(/^(-|\*|\•)[ \t]+(.+)$/);
    if (unorderedMatch) {
      return {
        type: "unordered",
        marker: unorderedMatch[1],
        content: unorderedMatch[2],
        indent: (line.match(/^(\s*)/)[1] || "").length,
      };
    }

    return null;
  }

  /**
   * Process inline formatting within list items
   * @param {string} text - Text to process
   * @returns {string} Text with inline formatting converted to HTML
   */
  processInlineFormatting(text) {
    // Convert bold text
    let formatted = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/__(.*?)__/g, "<strong>$1</strong>");

    // Convert italic text
    formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
    formatted = formatted.replace(/_(.*?)_/g, "<em>$1</em>");

    // Convert inline code
    formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Process links
    formatted = formatted.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (match, text, url) => {
        const safeUrl = this.utils.sanitizeUrl
          ? this.utils.sanitizeUrl(url)
          : url;
        if (safeUrl) {
          return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        return text;
      }
    );

    return formatted;
  }

  /**
   * Process multi-line content within list items, including code blocks
   * @param {string} content - Content to process
   * @returns {string} Processed content with HTML formatting
   */
  processMultiLineContent(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing multi-line list item content");

      // Split content into lines
      const lines = content.split("\n");
      let result = [];
      let inCodeBlock = false;
      let codeBlockContent = [];
      let codeLanguage = "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for code block start/end
        if (line.startsWith("```")) {
          if (!inCodeBlock) {
            // Start of code block
            inCodeBlock = true;
            codeLanguage = line.substring(3).trim() || "text";
            // Process any content before the code block
            if (result.length > 0) {
              const textContent = result.join(" ");
              result = [this.processInlineFormatting(textContent)];
            }
          } else {
            // End of code block
            inCodeBlock = false;
            const code = codeBlockContent.join("\n");
            result.push(
              `<pre><code class="language-${codeLanguage}">${code}</code></pre>`
            );
            codeBlockContent = [];
          }
        } else if (inCodeBlock) {
          // Inside code block
          codeBlockContent.push(line);
        } else if (
          line.startsWith("`") &&
          line.endsWith("`") &&
          line.length > 2
        ) {
          // Single line inline code
          const code = line.substring(1, line.length - 1);
          result.push(`<code>${code}</code>`);
        } else {
          // Regular content
          if (line) {
            result.push(line);
          }
        }
      }

      // Process any remaining content
      if (!inCodeBlock && result.length > 0) {
        const textContent = result.join(" ");
        return this.processInlineFormatting(textContent);
      }

      return result.join(" ");
    } catch (error) {
      this.utils.log("Error processing multi-line content", { error }, "error");
      return content; // Return original content on error
    }
  }
}
