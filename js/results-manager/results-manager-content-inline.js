/**
 * @module InlineContentProcessor
 * @description Processes inline elements like bold, italic, links, etc.
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";
import { ContentProcessorUtils } from "./results-manager-content-utils.js";

export class InlineContentProcessor extends ContentProcessorBase {
  constructor() {
    super();
    this.processorUtils = new ContentProcessorUtils();
    this.utils.log("Inline content processor initialized");
  }
  /**
   * Process escaped Markdown characters
   * @param {string} content - Content to process
   * @returns {string} Content with escaped characters processed
   */
  processEscapedCharacters(content) {
    this.utils.log("Processing escaped characters");

    try {
      // Replace escaped Markdown characters with HTML entities
      return content.replace(/\\([\\`*_{}[\]()#+\-.!|])/g, "$1");
    } catch (error) {
      this.utils.log("Error processing escaped characters", { error }, "error");
      return content;
    }
  }
  /**
   * Process inline elements in content
   * @param {string} content - Content to process
   * @returns {string} Processed content with inline formatting
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing inline elements");
      let processed = content;

      // Convert bold text
      processed = processed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      processed = processed.replace(/__(.*?)__/g, "<strong>$1</strong>");

      // Convert italic text
      processed = processed.replace(/\*(.*?)\*/g, "<em>$1</em>");
      processed = processed.replace(/_(.*?)_/g, "<em>$1</em>");

      // Convert strikethrough text
      processed = processed.replace(/~~(.*?)~~/g, "<del>$1</del>");

      // Convert subscript and superscript
      processed = processed.replace(/~([^~\s]+)~/g, "<sub>$1</sub>");
      processed = processed.replace(/\^([^\^\s]+)\^/g, "<sup>$1</sup>");

      // Convert highlighting
      processed = processed.replace(/==([^=]+)==/g, "<mark>$1</mark>");

      // Convert inline code
      processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");

      // Process links
      processed = this.processLinks(processed);

      // Process emoji shortcodes
      processed = this.processEmoji(processed);

      return processed;
    } catch (error) {
      this.utils.log("Error processing inline elements", { error }, "error");
      return content; // Return original content on error
    }
  }

  /**
   * Process links in content
   * @param {string} content - Content to process
   * @returns {string} Content with processed links
   */
  processLinks(content) {
    try {
      // Process Markdown-style links [text](url)
      const markdownLinkMatches =
        content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
      this.utils.log("Processing Markdown links", {
        matches: markdownLinkMatches,
        count: markdownLinkMatches.length,
      });

      // First, let's handle Markdown links by replacing them with temporary placeholders
      // This will prevent them from being processed by the URL regex
      const placeholders = new Map();
      let placeholderIndex = 0;

      // Process Markdown links first and replace them with placeholders
      let processed = content.replace(
        /\[([^\]]+)\]\(([^)]+(?:\([^)]*\)[^)]*)*)\)/g,
        (match, text, url) => {
          try {
            // Create a unique placeholder
            const placeholder = `__MARKDOWN_LINK_PLACEHOLDER_${placeholderIndex++}__`;

            // Extract the actual URL if it's wrapped in a security enhancer
            const extractedUrl = this.processorUtils.extractActualUrl(url);
            const safeUrl = this.utils.sanitizeUrl
              ? this.utils.sanitizeUrl(extractedUrl)
              : extractedUrl;

            if (safeUrl) {
              // Store the HTML for this link with the placeholder
              placeholders.set(
                placeholder,
                `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`
              );

              this.utils.log("Created placeholder for Markdown link", {
                placeholder,
                originalMatch: match,
                text,
                url,
                safeUrl,
              });

              return placeholder;
            }
            return match; // Return original text if URL is not safe
          } catch (error) {
            this.utils.log(
              "Error processing complex Markdown link",
              { error, match },
              "error"
            );
            return match; // Return original text on error
          }
        }
      );

      // Now process regular URLs (that aren't part of Markdown links)
      processed = processed.replace(/(https?:\/\/[^\s<]+)/g, (match) => {
        try {
          // Skip if this is a placeholder (should never happen, but just in case)
          if (match.includes("__MARKDOWN_LINK_PLACEHOLDER_")) {
            return match;
          }

          // Extract the actual URL if it's wrapped in a security enhancer
          const extractedUrl = this.processorUtils.extractActualUrl(match);
          const safeUrl = this.utils.sanitizeUrl
            ? this.utils.sanitizeUrl(extractedUrl)
            : extractedUrl;

          if (safeUrl) {
            // For very long URLs, use a shortened display text
            const displayText =
              match.length > 60 ? match.substring(0, 57) + "..." : match;
            return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${displayText}</a>`;
          }
          return match; // Return original text if URL is not safe
        } catch (error) {
          this.utils.log("Error processing URL", { error, match }, "error");
          return match; // Return original text on error
        }
      });

      // Finally, replace all placeholders with their corresponding HTML
      placeholders.forEach((html, placeholder) => {
        processed = processed.replace(placeholder, html);
        this.utils.log("Replaced placeholder with HTML", {
          placeholder,
          html,
        });
      });

      return processed;
    } catch (error) {
      this.utils.log("Error processing links", { error }, "error");
      return content; // Return original content on error
    }
  }

  /**
   * Convert emoji shortcodes to actual emoji (legacy method)
   * This method is kept for backward compatibility, but processing will be
   * handled by the dedicated EmojiContentProcessor
   * @param {string} content - Content to process
   * @returns {string} Content unchanged
   */
  processEmoji(content) {
    // Simply return the content as emoji processing is now done by EmojiContentProcessor
    return content;
  }
}
