/**
 * @module BlockContentProcessor
 * @description Processes block-level elements like headers, paragraphs, blockquotes, etc.
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";
import { ContentProcessor } from "./results-manager-content.js";

export class BlockContentProcessor extends ContentProcessorBase {
  // Reference to the main content processor for recursive processing
  static contentProcessorInstance = null;
  constructor() {
    super();
    this.utils.log("Block content processor initialized");

    // We no longer create a ContentProcessor instance here
    // Instead, the ContentProcessor will set itself as the instance
    // This breaks the circular dependency
    this.utils.log(
      "Block content processor initialized, waiting for ContentProcessor reference"
    );
  }

  /**
   * Process block elements in content
   * @param {string} content - Content to process
   * @returns {string} Processed content with block formatting
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing block elements");
      let processed = content;

      // Convert headers (h1-h6) with IDs for anchor links
      processed = processed.replace(
        /^(#{1,6})\s+(.*?)(?:\s+)?$/gm,
        (match, hashes, text) => {
          const level = hashes.length;
          const id = this.generateHeaderId(text);
          return `<h${level} id="${id}">${text}</h${level}>`;
        }
      );

      // Process blockquotes
      processed = this.processBlockquotes(processed);

      // Convert horizontal rules
      processed = processed.replace(/^(\s*)(---|\*\*\*|___)\s*$/gm, "<hr>");

      // Process footnotes
      processed = this.processFootnotes(processed);

      // Process paragraphs (but not inside lists, code blocks, etc.)
      processed = this.processParagraphs(processed);

      return processed;
    } catch (error) {
      this.utils.log("Error processing block elements", { error }, "error");
      return content; // Return original content on error
    }
  }

  /**
   * Process blockquotes in content
   * @param {string} content - Content to process
   * @returns {string} Content with blockquotes converted to HTML
   */
  processBlockquotes(content) {
    this.utils.log("Processing blockquotes");

    try {
      // Split content by paragraphs
      const paragraphs = content.split(/\n\n+/);

      const processedParagraphs = paragraphs.map((paragraph) => {
        // Check if this paragraph contains blockquote lines
        // Note: We need to check for &gt; instead of > because the content has already been HTML sanitized
        if (paragraph.trim().startsWith("&gt;")) {
          this.utils.log("Found blockquote paragraph", {
            paragraphPreview: paragraph.substring(0, 100),
          });

          // Process the blockquote paragraph
          return this.processBlockquoteParagraph(paragraph);
        }

        // Not a blockquote paragraph
        return paragraph;
      });

      return processedParagraphs.join("\n\n");
    } catch (error) {
      this.utils.log("Error processing blockquotes", { error }, "error");
      // Return the original content as fallback
      return content;
    }
  }

  /**
   * Process a blockquote paragraph
   * @param {string} paragraph - Blockquote paragraph to process
   * @returns {string} HTML representation of the blockquote
   */
  processBlockquoteParagraph(paragraph) {
    try {
      // Split the paragraph into lines
      const lines = paragraph.split("\n");

      // Clean the lines by removing the blockquote markers
      const cleanedLines = lines.map((line) => {
        // Remove the &gt; marker and any space after it
        return line.replace(/^(&gt;\s*)+/, "");
      });

      this.utils.log("Processing blockquote paragraph", {
        lineCount: lines.length,
        firstLine:
          lines[0].substring(0, 50) + (lines[0].length > 50 ? "..." : ""),
        cleanedFirstLine:
          cleanedLines[0].substring(0, 50) +
          (cleanedLines[0].length > 50 ? "..." : ""),
      });

      // Process the blockquote content using a line-by-line approach
      const result = this.processNestedBlockquotes(lines, cleanedLines);

      return result;
    } catch (error) {
      this.utils.log(
        "Error processing blockquote paragraph",
        { error },
        "error"
      );
      // Return the original paragraph wrapped in a blockquote as fallback
      return `<blockquote><p>${paragraph}</p></blockquote>`;
    }
  }

  /**
   * Process blockquote lines with proper nesting
   * @param {string[]} lines - Array of original lines with blockquote markers
   * @param {string[]} cleanedLines - Array of lines with blockquote markers removed
   * @returns {string} HTML representation of the blockquote with proper nesting
   */
  processNestedBlockquotes(lines, cleanedLines) {
    // Create a tree structure to represent the blockquote hierarchy
    const root = { level: 0, content: [], cleanedContent: [], children: [] };

    // First pass: Parse lines and build the tree structure
    let currentNode = root;
    let currentLevel = 0;
    let stack = [root];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cleanedLine = cleanedLines[i];

      // Count the number of &gt; at the beginning of the line
      const gtMatches = line.match(/^(&gt;\s*)+/);
      if (!gtMatches) continue; // Skip lines that don't start with &gt;

      const prefix = gtMatches[0];
      const level = (prefix.match(/&gt;/g) || []).length;

      // Navigate to the correct node in the tree
      if (level > currentLevel) {
        // Going deeper - create a new child node
        const newNode = {
          level,
          content: [],
          cleanedContent: [],
          children: [],
          parent: currentNode,
        };
        currentNode.children.push(newNode);
        stack.push(newNode);
        currentNode = newNode;
      } else if (level < currentLevel) {
        // Going back up - pop nodes from the stack
        while (stack.length > 1 && stack[stack.length - 1].level > level) {
          stack.pop();
        }
        currentNode = stack[stack.length - 1];
      }

      // Add content to the current node (both original and cleaned)
      currentNode.content.push(line.substring(prefix.length));
      currentNode.cleanedContent.push(cleanedLine);
      currentLevel = level;
    }

    // Second pass: Convert the tree to HTML
    const renderNode = (node) => {
      // Format the content of this node using the cleaned content
      let contentHtml = "";
      if (node.cleanedContent.length > 0) {
        this.utils.log("Processing blockquote node content", {
          level: node.level,
          contentLines: node.cleanedContent.length,
        });
        contentHtml = this.formatBlockquoteContent(node.cleanedContent);
      }

      // Process children
      let childrenHtml = "";
      if (node.children.length > 0) {
        childrenHtml = node.children.map((child) => renderNode(child)).join("");
      }

      // Root node doesn't get wrapped in a blockquote
      if (node.level === 0) {
        return childrenHtml;
      }

      // Return the blockquote HTML
      return `<blockquote>${contentHtml}${childrenHtml}</blockquote>`;
    };

    return renderNode(root);
  }

  /**
   * Format a group of blockquote lines into HTML content
   * @param {string[]} lines - Array of content lines
   * @returns {string} Formatted HTML content
   */
  formatBlockquoteContent(lines) {
    // Check if we have any lines
    if (!lines || lines.length === 0) {
      return "";
    }

    try {
      this.utils.log("Processing blockquote content with nested elements");

      // Check if any line already contains HTML blockquote tags (from nested blockquotes)
      const hasNestedBlockquote = lines.some(
        (line) =>
          line.includes("<blockquote>") || line.includes("</blockquote>")
      );

      if (hasNestedBlockquote) {
        // If we have nested blockquotes, just join the lines without additional formatting
        return lines.join("");
      }

      // Group lines into paragraphs based on blank lines
      const paragraphs = [];
      let currentParagraph = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line === "") {
          // Empty line indicates paragraph break
          if (currentParagraph.length > 0) {
            paragraphs.push(currentParagraph);
            currentParagraph = [];
          }
        } else {
          currentParagraph.push(line);
        }
      }

      // Add the last paragraph if it's not empty
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph);
      }

      // Process each paragraph
      const processedParagraphs = paragraphs.map((paragraph) => {
        // Join the paragraph lines with newlines to preserve markdown formatting
        const paragraphContent = paragraph.join("\n").trim();

        if (!paragraphContent) {
          return "";
        }

        // Use the ContentProcessor to process the content recursively
        if (BlockContentProcessor.contentProcessorInstance) {
          this.utils.log(
            "Using ContentProcessor to process nested blockquote content"
          );

          // Add a safeguard to prevent infinite recursion
          // Check if the content contains blockquote markers that might cause recursion
          if (paragraphContent.includes("&gt;")) {
            this.utils.log(
              "Detected potential recursive blockquote processing, using fallback formatting",
              { contentPreview: paragraphContent.substring(0, 50) },
              "warn"
            );
            // Use fallback formatting instead of recursive processing
            return this.applyFallbackFormatting(paragraphContent);
          }

          return BlockContentProcessor.contentProcessorInstance.processContent(
            paragraphContent
          );
        } else {
          // Fallback to basic inline formatting if ContentProcessor is not available
          this.utils.log(
            "ContentProcessor not available, using fallback formatting",
            {},
            "warn"
          );
          let formattedContent = paragraphContent;

          // Convert bold text
          formattedContent = formattedContent.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
          );
          formattedContent = formattedContent.replace(
            /__(.*?)__/g,
            "<strong>$1</strong>"
          );

          // Convert italic text
          formattedContent = formattedContent.replace(
            /\*(.*?)\*/g,
            "<em>$1</em>"
          );
          formattedContent = formattedContent.replace(
            /_(.*?)_/g,
            "<em>$1</em>"
          );

          // Convert inline code
          formattedContent = formattedContent.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
          );

          // Process links
          formattedContent = formattedContent.replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            (_, text, url) => {
              const safeUrl = this.utils.sanitizeUrl
                ? this.utils.sanitizeUrl(url)
                : url;
              return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            }
          );

          return `<p>${formattedContent}</p>`;
        }
      });

      // Join the processed paragraphs
      return processedParagraphs.join("");
    } catch (error) {
      this.utils.log("Error processing blockquote content", { error }, "error");

      // Fallback to simple formatting
      const paragraphContent = lines.join("<br>").trim();

      if (!paragraphContent) {
        return "";
      }

      return `<p>${paragraphContent}</p>`;
    }
  }

  /**
   * Apply fallback formatting for blockquote content when recursive processing is detected
   * This prevents infinite recursion while still providing basic formatting
   * @param {string} content - Content to format
   * @returns {string} Formatted HTML content
   */
  applyFallbackFormatting(content) {
    try {
      this.utils.log("Applying fallback formatting for blockquote content");
      let formattedContent = content;

      // Convert headers (h1-h6)
      formattedContent = formattedContent.replace(
        /^(#{1,6})\s+(.*?)(?:\s+)?$/gm,
        (match, hashes, text) => {
          const level = hashes.length;
          const id = this.generateHeaderId(text);
          return `<h${level} id="${id}">${text}</h${level}>`;
        }
      );

      // Convert unordered lists
      formattedContent = formattedContent.replace(
        /^[\s]*[-*+][\s]+(.*?)$/gm,
        "<li>$1</li>"
      );
      formattedContent = formattedContent.replace(
        /(<li>.*?<\/li>\n)+/gs,
        (match) => `<ul>${match}</ul>`
      );

      // Convert ordered lists
      formattedContent = formattedContent.replace(
        /^[\s]*\d+\.[\s]+(.*?)$/gm,
        "<li>$1</li>"
      );
      formattedContent = formattedContent.replace(
        /(<li>.*?<\/li>\n)+/gs,
        (match) => {
          // Only wrap in <ol> if not already wrapped in <ul>
          if (!match.startsWith("<ul>")) {
            return `<ol>${match}</ol>`;
          }
          return match;
        }
      );

      // Convert bold text
      formattedContent = formattedContent.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );
      formattedContent = formattedContent.replace(
        /__(.*?)__/g,
        "<strong>$1</strong>"
      );

      // Convert italic text
      formattedContent = formattedContent.replace(/\*(.*?)\*/g, "<em>$1</em>");
      formattedContent = formattedContent.replace(/_(.*?)_/g, "<em>$1</em>");

      // Convert inline code
      formattedContent = formattedContent.replace(
        /`([^`]+)`/g,
        "<code>$1</code>"
      );

      // Process links
      formattedContent = formattedContent.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (_, text, url) => {
          const safeUrl = this.utils.sanitizeUrl
            ? this.utils.sanitizeUrl(url)
            : url;
          return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
      );

      // Wrap paragraphs (text separated by blank lines)
      const paragraphs = formattedContent.split(/\n\n+/);
      formattedContent = paragraphs
        .map((para) => {
          if (para.trim() && !para.trim().startsWith("<")) {
            return `<p>${para.trim()}</p>`;
          }
          return para.trim();
        })
        .join("\n\n");

      return formattedContent;
    } catch (error) {
      this.utils.log("Error in fallback formatting", { error }, "error");
      return `<p>${content}</p>`;
    }
  }

  /**
   * Process paragraphs in content, but avoid processing inside lists, code blocks, etc.
   * @param {string} content - Content to process
   * @returns {string} Content with processed paragraphs
   */
  processParagraphs(content) {
    this.utils.log("Processing paragraphs");

    // Split content by block elements to avoid processing inside them
    const blockElementsPattern =
      /(<h[1-6][\s\S]*?<\/h[1-6]>|<pre[\s\S]*?<\/pre>|<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>|<table[\s\S]*?<\/table>)/g;
    const parts = content.split(blockElementsPattern);

    // Process each part
    const processedParts = parts.map((part) => {
      // If this part starts with a block element tag, don't process it
      if (part.match(/^<(h[1-6]|pre|ul|ol|table)/)) {
        return part;
      }

      // Process paragraphs in this part
      // Split by double newlines to create separate paragraphs
      const paragraphs = part.split(/\n\n+/);

      return paragraphs
        .map((para) => {
          if (para.trim()) {
            // Replace single newlines with <br>
            const formattedPara = para.replace(/\n/g, "<br>");
            return `<p>${formattedPara}</p>`;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n\n");
    });

    return processedParts.join("");
  }

  /**
   * Process footnotes in content
   * @param {string} content - Content to process
   * @returns {string} Content with footnotes converted to HTML
   */
  processFootnotes(content) {
    this.utils.log("Processing footnotes");

    try {
      // Collect all footnote definitions
      const footnoteDefinitions = new Map();
      const referenceMap = new Map(); // Map original IDs to numeric IDs
      const referenceCounts = new Map(); // Track multiple references to the same footnote
      let nextNumericId = 1;

      // First pass: collect multiline footnote definitions
      const multilineDefRegex =
        /^\[\^([^\s\]]+)\]:\s+((?:.+)(?:\n[ \t]+.+)*)/gm;
      let multilineMatch;
      let processedContent = content;

      while ((multilineMatch = multilineDefRegex.exec(content)) !== null) {
        const id = multilineMatch[1].trim();
        // Join the multiline content, preserving paragraph structure
        const text = multilineMatch[2].replace(/\n[ \t]+/g, " ").trim();

        const numericId = nextNumericId++;
        referenceMap.set(id, numericId);
        footnoteDefinitions.set(numericId.toString(), text);

        // Remove the full multiline definition
        const fullMatch = multilineMatch[0];
        processedContent = processedContent.replace(fullMatch, "");
      }

      // Now find and remove single-line footnote definitions
      const singleLineDefRegex = /^\[\^([^\s\]]+)\]:\s+(.+)$/gm;
      let singleMatch;

      while (
        (singleMatch = singleLineDefRegex.exec(processedContent)) !== null
      ) {
        const id = singleMatch[1].trim();
        const text = singleMatch[2].trim();

        // Skip if already processed in multiline step
        if (!referenceMap.has(id)) {
          const numericId = nextNumericId++;
          referenceMap.set(id, numericId);
          footnoteDefinitions.set(numericId.toString(), text);
        }

        // Remove the definition
        processedContent = processedContent.replace(singleMatch[0], "");
      }

      // Handle regular footnote references, tracking reference count for each
      let refIndex = 0;
      processedContent = processedContent.replace(
        /\[\^([^\s\]]+)\]/g,
        (match, id) => {
          const numericId = referenceMap.get(id);
          if (numericId !== undefined) {
            // Track the number of references to this footnote
            referenceCounts.set(id, (referenceCounts.get(id) || 0) + 1);
            const refCount = referenceCounts.get(id);

            // Use a unique ID for each reference to the same footnote
            return `<a href="#fn:${numericId}" id="fnref:${numericId}-${refCount}" class="footnote-ref" aria-describedby="footnote-label"><sup>${numericId}</sup></a>`;
          }
          return match; // Keep original if no definition found
        }
      );

      // Handle inline footnotes with standard pattern ^[content]
      processedContent = processedContent.replace(
        /\^\[(.*?)\]/g,
        (match, text) => {
          const numericId = nextNumericId++;
          footnoteDefinitions.set(numericId.toString(), text.trim());
          return `<a href="#fn:${numericId}" id="fnref:${numericId}" class="footnote-ref" aria-describedby="footnote-label"><sup>${numericId}</sup></a>`;
        }
      );

      // If no footnotes found, return the processed content
      if (footnoteDefinitions.size === 0) {
        return processedContent;
      }

      // Add the footnotes section
      let footnotesHtml = '<div class="footnotes-container">';
      footnotesHtml += '<h2 id="footnote-label">Footnotes</h2>';
      footnotesHtml += '<section class="footnotes">';
      footnotesHtml += "<hr>";
      footnotesHtml += "<ol>";

      footnoteDefinitions.forEach((text, id) => {
        // Find the original ID for this numeric ID
        let originalId = "";
        for (const [origId, numId] of referenceMap.entries()) {
          if (numId.toString() === id) {
            originalId = origId;
            break;
          }
        }

        // Create back references
        let backRefs = "";
        if (originalId && referenceCounts.has(originalId)) {
          const count = referenceCounts.get(originalId);
          if (count === 1) {
            // Single reference - use the -1 suffix for consistency
            backRefs = `<a href="#fnref:${id}-1" class="footnote-backref" aria-label="Back to reference ${id}">↩</a>`;
          } else {
            // Multiple references to this footnote
            backRefs = "";
            for (let i = 1; i <= count; i++) {
              backRefs += `<a href="#fnref:${id}-${i}" class="footnote-backref" aria-label="Back to reference ${id}-${i}">↩<sup>${i}</sup></a> `;
            }
          }
        } else {
          // For inline footnotes or those without tracked references
          backRefs = `<a href="#fnref:${id}" class="footnote-backref" aria-label="Back to reference ${id}">↩</a>`;
        }

        footnotesHtml += `<li id="fn:${id}">
        <p>${text} ${backRefs}</p>
      </li>`;
      });

      footnotesHtml += "</ol>";
      footnotesHtml += "</section>";
      footnotesHtml += "</div>";

      // Append footnotes section
      processedContent += footnotesHtml;

      // Clean up empty elements and unnecessary whitespace
      processedContent = processedContent
        // Remove empty paragraph tags
        .replace(/<p>\s*<\/p>/g, "")
        // Remove trailing paragraph tags
        .replace(/<\/div><p><\/p>$/g, "</div>")
        // Clean up footnotes container
        .replace(
          /<div class="footnotes-container"><p><\/p>/g,
          '<div class="footnotes-container">'
        )
        .replace(
          /<p><\/p><section class="footnotes">/g,
          '<section class="footnotes">'
        )
        .replace(/<hr><p><\/p>/g, "<hr>")
        .replace(/<\/ol><p><\/p>/g, "</ol>")
        .replace(/<\/section><p><\/p><\/div>/g, "</section></div>");

      return processedContent;
    } catch (error) {
      this.utils.log("Error processing footnotes", { error }, "error");
      return content;
    }
  }
}
