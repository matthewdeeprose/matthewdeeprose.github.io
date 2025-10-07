/**
 * @module DefinitionListProcessor
 * @description Processes definition lists with proper HTML dl, dt, dd elements
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";

export class DefinitionListProcessor extends ContentProcessorBase {
  /**
   * Create a new DefinitionListProcessor instance
   */
  constructor() {
    super();
    this.utils.log("Definition list processor initialized");
  }

  /**
   * Process definition lists in content
   * @param {string} content - Content to process
   * @returns {string} Processed content with HTML definition lists
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing definition lists");
      return this.processDefinitionLists(content);
    } catch (error) {
      this.utils.log("Error processing definition lists", { error }, "error");
      return content; // Return original content on error
    }
  }

  /**
   * Process definition lists in content
   * @param {string} content - Content to process
   * @returns {string} Content with definition lists converted to HTML
   */
  processDefinitionLists(content) {
    try {
      // Split content by paragraphs to isolate potential definition list blocks
      const paragraphs = content.split(/\n\n+/);

      // Process each paragraph
      const processedParagraphs = paragraphs.map((paragraph) => {
        // Check if this paragraph looks like a definition list
        if (this.isDefinitionList(paragraph)) {
          return this.convertDefinitionListToHtml(paragraph);
        }

        // If the paragraph has multiple lines, check if it might be a definition list
        // with the term on one line and definition on the next
        const lines = paragraph.split("\n");
        if (lines.length >= 2) {
          // Check if any line starts with a colon (potential definition)
          const hasColonLine = lines.some((line) =>
            line.trim().startsWith(":")
          );

          if (hasColonLine) {
            return this.convertDefinitionListToHtml(paragraph);
          }
        }

        return paragraph;
      });

      return processedParagraphs.join("\n\n");
    } catch (error) {
      this.utils.log("Error processing definition lists", { error }, "error");
      return content;
    }
  }

  /**
   * Check if content contains a definition list pattern
   * @param {string} content - Content to check
   * @returns {boolean} True if content appears to be a definition list
   */
  isDefinitionList(content) {
    // Basic pattern: Term : Definition (on same line)
    // Note: Requires a space before the colon to avoid matching normal sentences with colons
    const sameLinePattern = /^(.+?)\s+:\s*(.+)$/m;

    // Pattern for term on one line, definition on next line starting with colon
    const multiLinePattern = /^(.+?)$\s*^:\s*(.+)$/m;

    // Check if there are multiple lines with these patterns
    const lines = content.split("\n");

    // Check for same-line pattern
    const sameLineMatches = lines.filter((line) =>
      sameLinePattern.test(line.trim())
    );

    // Check for multi-line pattern (term on one line, definition on next)
    let multiLineMatches = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      const twoLines = lines[i] + "\n" + lines[i + 1];
      if (multiLinePattern.test(twoLines)) {
        multiLineMatches++;
      }
    }

    // Consider it a definition list if either pattern has matches
    return sameLineMatches.length > 0 || multiLineMatches > 0;
  }

  /**
   * Convert a definition list from Markdown format to HTML
   * @param {string} content - Definition list content
   * @returns {string} HTML definition list
   */
  convertDefinitionListToHtml(content) {
    try {
      const lines = content.trim().split("\n");
      let currentTerm = null;
      let definitions = [];
      let inContinuation = false;
      let html = '<dl class="definition-list">\n';

      // Process each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if this line is a continuation of previous definition (indented)
        if (line.match(/^\s+/) && currentTerm) {
          // This is a continuation of the previous definition
          const continuationText = line.trim();

          // Add to the last definition
          if (definitions.length > 0) {
            definitions[definitions.length - 1] += " " + continuationText;
          }

          inContinuation = true;
          continue;
        }

        // Check for term:definition pattern on same line
        // Note: Requires a space before the colon to avoid matching normal sentences with colons
        const sameLineMatch = line.match(/^(.+?)\s+:\s*(.+)$/);

        if (sameLineMatch) {
          // If we already have a term, add it and its definitions to the HTML
          if (currentTerm) {
            html += `  <dt>${this.processInlineFormatting(currentTerm)}</dt>\n`;

            // Add all definitions for this term
            definitions.forEach((def) => {
              html += `  <dd>${this.processInlineFormatting(def)}</dd>\n`;
            });
          }

          // Set the new term and definition
          currentTerm = sameLineMatch[1].trim();
          definitions = [sameLineMatch[2].trim()];
          inContinuation = false;
        } else if (line.match(/^\s*:\s*(.+)$/)) {
          // Additional definition for the current term
          const additionalDef = line.replace(/^\s*:\s*/, "").trim();

          // If we don't have a current term but this is a definition line,
          // the term might be on the previous line
          if (!currentTerm && i > 0) {
            currentTerm = lines[i - 1].trim();
            definitions = [additionalDef];
          } else {
            definitions.push(additionalDef);
          }
        } else if (line.trim() !== "") {
          // If it's not a blank line and doesn't match our patterns,
          // it might be a continuation of the previous line or a new term
          if (currentTerm && !inContinuation) {
            currentTerm += " " + line;
          } else if (definitions.length > 0) {
            definitions[definitions.length - 1] += " " + line;
          } else {
            // This might be a new term with definition on next line
            currentTerm = line;
            definitions = [];
          }
        }
      }

      // Add the last term and its definitions
      if (currentTerm) {
        html += `  <dt>${this.processInlineFormatting(currentTerm)}</dt>\n`;

        // Add all definitions for this term
        definitions.forEach((def) => {
          html += `  <dd>${this.processInlineFormatting(def)}</dd>\n`;
        });
      }

      html += "</dl>";

      // Clean up the HTML output by removing superfluous tags
      let cleanedHtml = html;

      // Remove <br> tags
      cleanedHtml = cleanedHtml.replace(/<br\s*\/?>/gi, "");

      // Remove empty paragraph tags
      cleanedHtml = cleanedHtml.replace(/<p>\s*<\/p>/gi, "");

      // Wrap the result to prevent surrounding <p></p> tags
      return `<!-- definition-list-start -->${cleanedHtml}<!-- definition-list-end -->`;
    } catch (error) {
      this.utils.log(
        "Error converting definition list to HTML",
        { error },
        "error"
      );
      return `<p>${content}</p>`; // Fallback to a paragraph
    }
  }

  /**
   * Process inline formatting within definition list content
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
}
