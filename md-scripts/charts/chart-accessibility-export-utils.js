/**
 * Chart Accessibility Export Utilities
 * Functions for exporting and copying chart descriptions
 */

window.ChartAccessibilityExport = (function () {
  // Logging configuration (within module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   * @param {*} data - Optional additional data to log
   */
  function logError(message, data) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      if (data !== undefined) {
        console.error(message, data);
      } else {
        console.error(message);
      }
    }
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {*} data - Optional additional data to log
   */
  function logWarn(message, data) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      if (data !== undefined) {
        console.warn(message, data);
      } else {
        console.warn(message);
      }
    }
  }

  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {*} data - Optional additional data to log
   */
  function logInfo(message, data) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      if (data !== undefined) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {*} data - Optional additional data to log
   */
  function logDebug(message, data) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      if (data !== undefined) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * Copy the HTML content to clipboard
   * @param {HTMLElement} element - The element to copy
   * @returns {Promise<boolean>} Whether the operation succeeded
   */
  async function copyHtmlToClipboard(element) {
    if (!element) {
      logError("[Chart Accessibility] No element provided to copy");
      return false;
    }

    logDebug("[Chart Accessibility] Starting HTML clipboard copy operation");

    try {
      // Create a clean clone of the element without export controls
      const cleanElement = createCleanClone(element);
      logDebug("[Chart Accessibility] Created clean clone for HTML copy");

      // Get the HTML content
      const htmlContent = cleanElement.outerHTML;

      // Use Clipboard API if available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        logDebug(
          "[Chart Accessibility] Using modern Clipboard API for HTML copy"
        );
        await navigator.clipboard.writeText(htmlContent);
        return true;
      } else {
        logDebug(
          "[Chart Accessibility] Falling back to legacy copy method for HTML"
        );
        return fallbackCopyToClipboard(htmlContent);
      }
    } catch (error) {
      logError("[Chart Accessibility] Error copying HTML to clipboard:", error);
      return false;
    }
  }

  /**
   * Copy rich text content to clipboard
   * @param {HTMLElement} element - The element containing content to copy
   * @returns {Promise<boolean>} Whether the operation succeeded
   */
  async function copyTextToClipboard(element) {
    if (!element) {
      logError("[Chart Accessibility] No element provided to copy");
      return false;
    }

    logDebug("[Chart Accessibility] Starting text clipboard copy operation");

    try {
      // Create a clean clone of the element without export controls
      const cleanElement = createCleanClone(element);
      logDebug("[Chart Accessibility] Created clean clone for text copy");

      // Convert the HTML to plain text while preserving structure
      const plainText = convertHtmlToText(cleanElement);

      // Use Clipboard API if available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        logDebug(
          "[Chart Accessibility] Using modern Clipboard API for text copy"
        );
        await navigator.clipboard.writeText(plainText);
        return true;
      } else {
        logDebug(
          "[Chart Accessibility] Falling back to legacy copy method for text"
        );
        return fallbackCopyToClipboard(plainText);
      }
    } catch (error) {
      logError("[Chart Accessibility] Error copying text to clipboard:", error);
      return false;
    }
  }

  /**
   * Create a clean clone of an element without export controls
   * @param {HTMLElement} element - The element to clone
   * @returns {HTMLElement} A clean clone without export controls
   */
  function createCleanClone(element) {
    logDebug("[Chart Accessibility] Creating clean clone of element");

    // Create a deep clone of the element
    const clone = element.cloneNode(true);

    // Remove export controls from the clone if they exist
    const exportControls = clone.querySelector(".chart-export-controls");
    if (exportControls) {
      clone.removeChild(exportControls);
      logDebug("[Chart Accessibility] Removed export controls from clone");
    }

    return clone;
  }

  /**
   * Fallback method for copying to clipboard using document.execCommand
   * @param {string} text - Text to copy
   * @returns {boolean} Whether the operation succeeded
   */
  function fallbackCopyToClipboard(text) {
    logDebug("[Chart Accessibility] Using fallback copy method");

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-999999px";
      textarea.style.top = "-999999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (successful) {
        logDebug("[Chart Accessibility] Fallback copy method succeeded");
      } else {
        logWarn("[Chart Accessibility] Fallback copy method reported failure");
      }

      return successful;
    } catch (error) {
      logError("[Chart Accessibility] Error in fallback copy method:", error);
      return false;
    }
  }

  /**
   * Copy rich text content formatted for pasting into Word
   * @param {HTMLElement} element - The element containing content to copy
   * @returns {Promise<boolean>} Whether the operation succeeded
   */
  async function copyFormattedTextForWord(element) {
    if (!element) {
      logError("[Chart Accessibility] No element provided to copy");
      return false;
    }

    logDebug("[Chart Accessibility] Starting formatted text copy for Word");

    try {
      // Create a clean clone of the element without export controls
      const cleanElement = createCleanClone(element);

      // Create a new div for the formatted content
      const formattedDiv = document.createElement("div");

      // Add Word-friendly styles
      formattedDiv.innerHTML = `
            <style>
                /* Base styles for Word compatibility */
                body {
                    font-family: Calibri, Arial, sans-serif;
                    line-height: 1.15;
                    color: #000000;
                }
                
                h1, h2, h3, h4, h5, h6 {
                    font-family: Calibri, Arial, sans-serif;
                    margin-top: 12pt;
                    margin-bottom: 6pt;
                    line-height: 1.1;
                    font-weight: bold;
                    color: #000000;
                }
                
                h3 {
                    font-size: 16pt;
                }
                
                h4 {
                    font-size: 14pt;
                }
                
                h5 {
                    font-size: 12pt;
                    font-style: italic;
                }
                
                p {
                    margin: 0;
                    margin-bottom: 8pt;
                }
                
                ul, ol {
                    margin-top: 0;
                    margin-bottom: 8pt;
                    padding-left: 1.5em;
                }
                
                li {
                    margin-bottom: 3pt;
                }
                
                .chart-title, .chart-variable, .chart-value {
                    font-weight: bold;
                }
                
                .chart-section-heading, .chart-short-description-heading, 
                .chart-details-heading {
                    margin-top: 12pt;
                    margin-bottom: 6pt;
                    font-weight: bold;
                }
                
                .chart-insights, .chart-statistics {
                    font-weight: bold;
                    margin-top: 10pt;
                    margin-bottom: 4pt;
                }
                
                /* Clear margin for disclaimer */
                .chart-disclaimer {
                    margin-top: 12pt;
                    font-style: italic;
                    color: #666666;
                }
            </style>
        `;

      // Add the content to the div
      formattedDiv.appendChild(cleanElement.cloneNode(true));

      // Get the HTML content
      const formattedHtml = formattedDiv.innerHTML;

      // Create a Blob with HTML mime type
      const blob = new Blob([formattedHtml], { type: "text/html" });

      // Create clipboard data
      const data = new ClipboardItem({
        "text/html": blob,
      });

      // Use Clipboard API to write HTML to clipboard if available
      if (navigator.clipboard && navigator.clipboard.write) {
        logDebug(
          "[Chart Accessibility] Using modern Clipboard API for formatted copy"
        );
        await navigator.clipboard.write([data]);
        return true;
      } else {
        // Fallback for browsers that don't support ClipboardItem
        logDebug(
          "[Chart Accessibility] Using fallback method for formatted copy"
        );
        try {
          // Create a temporary element
          const tempElement = document.createElement("div");
          tempElement.setAttribute("contenteditable", "true");
          tempElement.innerHTML = formattedHtml;
          document.body.appendChild(tempElement);

          // Select the content
          const range = document.createRange();
          range.selectNodeContents(tempElement);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);

          // Execute copy command
          const success = document.execCommand("copy");

          // Clean up
          document.body.removeChild(tempElement);
          return success;
        } catch (error) {
          logError(
            "[Chart Accessibility] Error in fallback formatted copy:",
            error
          );
          return false;
        }
      }
    } catch (error) {
      logError("[Chart Accessibility] Error copying formatted text:", error);
      return false;
    }
  }

  /**
   * Convert HTML to plain text while preserving structure
   * @param {HTMLElement} element - The element to convert
   * @returns {string} Formatted plain text
   */
  function convertHtmlToText(element) {
    if (!element) return "";

    logDebug("[Chart Accessibility] Converting HTML to text");

    // Create a clean clone without export controls
    const cleanElement = createCleanClone(element);

    // Process the element with enhanced text conversion
    return enhancedHtmlToText(cleanElement);
  }

  /**
   * Enhanced HTML to text conversion with better formatting and structure
   * @param {HTMLElement} element - The element to convert
   * @returns {string} Well-formatted plain text
   */
  function enhancedHtmlToText(element) {
    if (!element) return "";

    logDebug(
      "[Chart Accessibility] Processing enhanced HTML to text conversion"
    );

    let result = "";
    const context = {
      level: 0,
      inList: false,
      listItemCount: 0,
      lastNodeWasBlock: false,
      parentNode: null,
    };

    // Process the node and its children recursively
    result = processNodeToTextEnhanced(element, context);

    // Clean up multiple blank lines
    result = result.replace(/\n{3,}/g, "\n\n");

    // Ensure text ends with a single newline
    if (!result.endsWith("\n")) {
      result += "\n";
    }

    return result;
  }

  /**
   * Enhanced process node to text function with better formatting
   * @param {Node} node - The node to process
   * @param {Object} context - The context object for tracking state
   * @returns {string} Formatted text
   */
  function processNodeToTextEnhanced(node, context) {
    if (!node) return "";

    // Skip export controls
    if (node.classList && node.classList.contains("chart-export-controls")) {
      return "";
    }

    // Text node handling
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (!text) return "";

      // Check if we're in an inline context
      if (context.parentNode && isInlineElement(context.parentNode)) {
        return text;
      }

      // Normal text node
      return text + " ";
    }

    // Skip certain elements
    if (
      node.nodeName === "SCRIPT" ||
      node.nodeName === "STYLE" ||
      node.nodeName === "NOSCRIPT"
    ) {
      return "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    // Initialize result
    let result = "";
    const previousParent = context.parentNode;
    context.parentNode = node;

    // Special handling for different node types
    switch (node.nodeName) {
      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6": {
        // Extract heading level
        const level = parseInt(node.nodeName.substring(1), 10);
        const prefix = "#".repeat(level) + " ";

        // Add newlines before heading based on context
        if (!context.lastNodeWasBlock) {
          result += "\n\n";
        }

        // Add heading content
        result += prefix + getTextContentEnhanced(node) + "\n";
        context.lastNodeWasBlock = true;
        break;
      }

      case "P": {
        // Add newlines before paragraph based on context
        if (!context.lastNodeWasBlock) {
          result += "\n\n";
        }

        // Process children for paragraph content
        for (const child of node.childNodes) {
          result += processNodeToTextEnhanced(child, {
            ...context,
            parentNode: node,
          });
        }

        result += "\n";
        context.lastNodeWasBlock = true;
        break;
      }

      case "BR": {
        result += "\n";
        context.lastNodeWasBlock = false;
        break;
      }

      case "UL":
      case "OL": {
        // Add newline before list if not already after a block element
        if (!context.lastNodeWasBlock) {
          result += "\n\n";
        }

        // Create new context for list processing
        const listContext = {
          level: context.level + 1,
          inList: true,
          listItemCount: 0,
          lastNodeWasBlock: false,
          parentNode: node,
          isOrdered: node.nodeName === "OL",
        };

        // Process each list item
        for (const child of node.childNodes) {
          if (child.nodeName === "LI") {
            listContext.listItemCount++;
            result += processNodeToTextEnhanced(child, listContext);
          }
        }

        result += "\n";
        context.lastNodeWasBlock = true;
        break;
      }

      case "LI": {
        const indent = "  ".repeat(context.level - 1);
        let marker;

        // Choose marker based on list type
        if (context.isOrdered) {
          marker = `${context.listItemCount}. `;
        } else {
          marker = "• ";
        }

        // Start the list item
        result += `${indent}${marker}`;

        // Create a new level context for nested list item content
        const itemContext = {
          level: context.level,
          inList: false,
          lastNodeWasBlock: false,
          parentNode: node,
        };

        // Process li content in a special way to handle nested lists properly
        let itemContent = "";
        for (const child of node.childNodes) {
          if (child.nodeName === "UL" || child.nodeName === "OL") {
            // For nested lists, add them with proper indentation after the current item
            itemContent +=
              "\n" +
              processNodeToTextEnhanced(child, {
                ...itemContext,
                level: itemContext.level + 1,
                lastNodeWasBlock: true,
              });
          } else {
            // For normal content, add it to the current line
            itemContent += processNodeToTextEnhanced(child, itemContext);
          }
        }

        // Clean up and format the content
        itemContent = itemContent.trim();

        // Handle multi-line content with proper indentation
        if (itemContent.includes("\n")) {
          const indentSize = indent.length + marker.length;
          const contentIndent = " ".repeat(indentSize);

          // Format first line, then indent subsequent lines
          const lines = itemContent.split("\n");
          result += lines[0] + "\n";

          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              result += contentIndent + lines[i] + "\n";
            } else {
              result += "\n";
            }
          }
        } else {
          // Single line content
          result += itemContent + "\n";
        }

        context.lastNodeWasBlock = false;
        break;
      }

      case "DIV":
      case "SECTION":
      case "ARTICLE": {
        // Skip export controls
        if (
          node.classList &&
          (node.classList.contains("chart-export-controls") ||
            node.classList.contains("chart-export-group"))
        ) {
          return "";
        }

        // Special handling for chart sections to keep proper formatting
        if (
          node.classList &&
          (node.classList.contains("chart-section") ||
            node.classList.contains("chart-insights-section") ||
            node.classList.contains("chart-statistics-section"))
        ) {
          if (!context.lastNodeWasBlock) {
            result += "\n\n";
          }

          // Process each child
          for (const child of node.childNodes) {
            result += processNodeToTextEnhanced(child, {
              ...context,
              parentNode: node,
            });
          }

          context.lastNodeWasBlock = true;
        } else {
          // General block elements
          // Process children
          for (const child of node.childNodes) {
            result += processNodeToTextEnhanced(child, {
              ...context,
              parentNode: node,
            });
          }

          // No additional spacing for general divs/sections
          context.lastNodeWasBlock = false;
        }
        break;
      }

      case "SPAN": {
        // Special handling for chart elements
        if (
          node.classList &&
          (node.classList.contains("chart-title") ||
            node.classList.contains("chart-value") ||
            node.classList.contains("chart-variable"))
        ) {
          const content = getTextContentEnhanced(node);
          result += content;
        } else {
          // Default span handling
          for (const child of node.childNodes) {
            result += processNodeToTextEnhanced(child, {
              ...context,
              parentNode: node,
            });
          }
        }

        context.lastNodeWasBlock = false;
        break;
      }

      default: {
        // Process all children for any other element
        for (const child of node.childNodes) {
          result += processNodeToTextEnhanced(child, {
            ...context,
            parentNode: node,
          });
        }

        context.lastNodeWasBlock = false;
      }
    }

    // Restore previous parent context
    context.parentNode = previousParent;
    return result;
  }

  /**
   * Check if an element is an inline element
   * @param {HTMLElement} node - The node to check
   * @returns {boolean} True if it's an inline element
   */
  function isInlineElement(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;

    const inlineElements = [
      "A",
      "ABBR",
      "ACRONYM",
      "B",
      "BDO",
      "BIG",
      "CITE",
      "CODE",
      "DFN",
      "EM",
      "I",
      "KBD",
      "LABEL",
      "Q",
      "SAMP",
      "SMALL",
      "SPAN",
      "STRONG",
      "SUB",
      "SUP",
      "TIME",
      "TT",
      "VAR",
    ];

    return inlineElements.includes(node.nodeName);
  }

  /**
   * Enhanced version of getTextContent that better handles
   * inline elements and special classes
   * @param {Node} node - The node to get text from
   * @returns {string} The text content
   */
  function getTextContentEnhanced(node) {
    // Skip export controls elements
    if (
      node.classList &&
      (node.classList.contains("chart-export-controls") ||
        node.classList.contains("chart-export-group") ||
        node.classList.contains("chart-export-group-label") ||
        node.classList.contains("chart-export-buttons") ||
        node.classList.contains("chart-export-button") ||
        node.classList.contains("chart-export-feedback"))
    ) {
      return "";
    }

    // For text nodes, just return the content
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim();
    }

    // For elements, concatenate all child text
    if (node.nodeType === Node.ELEMENT_NODE) {
      let result = "";

      // Special handling for certain elements
      if (node.nodeName === "BR") {
        return "\n";
      }

      // Process all children
      for (const child of node.childNodes) {
        result += getTextContentEnhanced(child);
      }

      return result.trim();
    }

    return "";
  }

  /**
   * Convert HTML to Markdown using TurndownJS
   * @param {HTMLElement} element - The element to convert
   * @returns {string} Markdown text
   */
  function convertHtmlToMarkdown(element) {
    if (!element) return "";

    logDebug("[Chart Accessibility] Converting HTML to Markdown");

    // Create a clean clone of the element without export controls
    const cleanElement = createCleanClone(element);

    // Check if TurndownJS is available
    if (typeof TurndownService === "undefined") {
      logWarn(
        "[Chart Accessibility] TurndownJS not available. Falling back to basic markdown conversion."
      );
      return fallbackHtmlToMarkdown(cleanElement);
    }

    try {
      logDebug(
        "[Chart Accessibility] Using TurndownJS for Markdown conversion"
      );

      // Create a new instance of TurndownService
      const turndownService = new TurndownService({
        headingStyle: "atx", // Use # style headings
        hr: "---", // Use --- for horizontal rules
        bulletListMarker: "*", // Use * for bullet lists
        codeBlockStyle: "fenced", // Use ```code``` style code blocks
        emDelimiter: "_", // Use _text_ for emphasis
        strongDelimiter: "**", // Use **text** for strong
        linkStyle: "inlined", // Use [text](url) style links
        linkReferenceStyle: "full", // Use [text][1] style link references with [1]: url
      });

      // Configure TurndownService for better handling of chart descriptions

      // Handle specific chart classes
      turndownService.addRule("chartElements", {
        filter: function (node) {
          return (
            node.classList &&
            (node.classList.contains("chart-title") ||
              node.classList.contains("chart-count") ||
              node.classList.contains("chart-value") ||
              node.classList.contains("chart-variable") ||
              node.classList.contains("chart-insight"))
          );
        },
        replacement: function (content, node) {
          // For most chart elements, use bold formatting
          if (
            node.classList.contains("chart-title") ||
            node.classList.contains("chart-value") ||
            node.classList.contains("chart-variable")
          ) {
            return `**${content}**`;
          }

          // For insights, use emphasis
          if (node.classList.contains("chart-insight")) {
            return `_${content}_`;
          }

          // For counts, keep as plain text
          return content;
        },
      });

      // Handle list items better
      turndownService.addRule("listItems", {
        filter: "li",
        replacement: function (content, node) {
          let prefix = "*"; // Default for ul items
          let parent = node.parentNode;

          // Calculate indentation level
          let level = 0;
          let currentNode = node;
          while (
            currentNode.parentNode &&
            (currentNode.parentNode.nodeName === "UL" ||
              currentNode.parentNode.nodeName === "OL")
          ) {
            level++;
            currentNode = currentNode.parentNode;
          }

          // Use proper indentation for nested lists
          const indent = "  ".repeat(Math.max(0, level - 1));

          // Handle ordered lists
          if (parent.nodeName === "OL") {
            // Find position in parent's children
            let index = Array.prototype.indexOf.call(parent.children, node) + 1;
            prefix = `${index}.`;
          }

          // Ensure proper spacing for nested content
          content = content
            .replace(/^\s+/, "")
            .replace(/\n/gm, "\n" + indent + "  ");

          return `\n${indent}${prefix} ${content}`;
        },
      });

      // Handle special elements that need extra spacing
      turndownService.addRule("doubleLineBreaks", {
        filter: function (node) {
          return (
            node.classList &&
            (node.classList.contains("chart-section") ||
              node.classList.contains("chart-section-heading"))
          );
        },
        replacement: function (content) {
          // Add extra line breaks for section divisions
          return `\n\n${content}\n\n`;
        },
      });

      // Use TurndownService to convert HTML to Markdown
      return turndownService.turndown(cleanElement);
    } catch (error) {
      logError("[Chart Accessibility] Error using TurndownJS:", error);
      return fallbackHtmlToMarkdown(cleanElement);
    }
  }

  /**
   * Fallback function for HTML to Markdown conversion when TurndownJS is not available
   * @param {HTMLElement} element - The element to convert
   * @returns {string} Markdown text
   */
  function fallbackHtmlToMarkdown(element) {
    logDebug("[Chart Accessibility] Using fallback Markdown conversion");
    // Process the clean clone
    return processNodeToMarkdown(element, 0);
  }

  /**
   * Process a node and its children to Markdown
   * @param {Node} node - The node to process
   * @param {number} indentLevel - Current indentation level
   * @returns {string} Markdown text
   */
  function processNodeToMarkdown(node, indentLevel) {
    if (!node) return "";

    // Text node - just return the content
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    // Skip script, style and hidden elements
    if (node.nodeName === "SCRIPT" || node.nodeName === "STYLE") {
      return "";
    }

    // Skip export controls entirely
    if (node.classList && node.classList.contains("chart-export-controls")) {
      return "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    // Handle different element types
    let result = "";
    const indent = "  ".repeat(indentLevel);

    switch (node.nodeName) {
      case "H1":
        result += "\n# " + getTextContent(node) + "\n\n";
        break;
      case "H2":
        result += "\n## " + getTextContent(node) + "\n\n";
        break;
      case "H3":
        result += "\n### " + getTextContent(node) + "\n\n";
        break;
      case "H4":
        result += "\n#### " + getTextContent(node) + "\n\n";
        break;
      case "H5":
        result += "\n##### " + getTextContent(node) + "\n\n";
        break;
      case "H6":
        result += "\n###### " + getTextContent(node) + "\n\n";
        break;
      case "P":
        result += "\n" + getTextContent(node) + "\n\n";
        break;
      case "STRONG":
      case "B":
        result += "**" + getTextContent(node) + "**";
        break;
      case "EM":
      case "I":
        result += "*" + getTextContent(node) + "*";
        break;
      case "CODE":
        result += "`" + getTextContent(node) + "`";
        break;
      case "A":
        const href = node.getAttribute("href");
        const text = getTextContent(node);
        result += "[" + text + "](" + (href || "#") + ")";
        break;
      case "UL":
        result += "\n";
        for (const child of node.childNodes) {
          if (child.nodeName === "LI") {
            // For UL items, add asterisk with proper indentation
            const childContent = processNodeToMarkdown(child, indentLevel + 1);
            result += indent + "* " + childContent.trim() + "\n";
          }
        }
        result += "\n";
        break;
      case "OL":
        result += "\n";
        let i = 1;
        for (const child of node.childNodes) {
          if (child.nodeName === "LI") {
            // For OL items, add number with proper indentation
            const childContent = processNodeToMarkdown(child, indentLevel + 1);
            result += indent + i + ". " + childContent.trim() + "\n";
            i++;
          }
        }
        result += "\n";
        break;
      case "LI":
        // Process children of list items, but don't add bullets/numbers (parent list will do that)
        for (const child of node.childNodes) {
          result += processNodeToMarkdown(child, indentLevel);
        }
        break;
      case "SECTION":
      case "DIV":
      case "ARTICLE":
        // Skip export controls container
        if (
          node.classList &&
          node.classList.contains("chart-export-controls")
        ) {
          return "";
        }

        // Process children with same indentation level
        for (const child of node.childNodes) {
          const childText = processNodeToMarkdown(child, indentLevel);
          if (childText.trim()) {
            result += childText;
          }
        }
        break;
      default:
        // Special handling for chart-specific classes
        if (node.classList) {
          if (
            node.classList.contains("chart-title") ||
            node.classList.contains("chart-value") ||
            node.classList.contains("chart-variable")
          ) {
            return "**" + getTextContent(node) + "** ";
          }
          if (node.classList.contains("chart-insight")) {
            return "_" + getTextContent(node) + "_ ";
          }
        }

        // For other elements, just get their text content
        const content = getTextContent(node).trim();
        if (content) {
          result += content + " ";
        }
        break;
    }

    return result;
  }

  /**
   * Get text content of a node and its children
   * @param {Node} node - The node to process
   * @returns {string} Combined text content
   */
  function getTextContent(node) {
    // Skip export controls elements
    if (
      node.classList &&
      (node.classList.contains("chart-export-controls") ||
        node.classList.contains("chart-export-group") ||
        node.classList.contains("chart-export-group-label") ||
        node.classList.contains("chart-export-buttons") ||
        node.classList.contains("chart-export-button") ||
        node.classList.contains("chart-export-feedback"))
    ) {
      return "";
    }

    let result = "";

    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (const child of node.childNodes) {
        result += getTextContent(child);
      }
    }

    return result;
  }

  /**
   * Download content as a file
   * @param {string} content - The content to download
   * @param {string} fileName - The file name
   * @param {string} mimeType - The MIME type
   */
  function downloadAsFile(content, fileName, mimeType) {
    logDebug("[Chart Accessibility] Starting file download:", fileName);

    try {
      // Create a blob with the content
      const blob = new Blob([content], { type: mimeType });

      // Create a URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a download link
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.style.display = "none";

      // Add the link to the document and click it
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      logInfo(
        "[Chart Accessibility] File download initiated successfully:",
        fileName
      );
    } catch (error) {
      logError("[Chart Accessibility] Error downloading file:", error);
    }
  }

  /**
   * Download HTML content as a file
   * @param {HTMLElement} element - The element to download
   * @param {string} fileName - The file name
   */
  function downloadAsHtml(element, fileName) {
    if (!element) {
      logError("[Chart Accessibility] No element provided to download");
      return;
    }

    logInfo("[Chart Accessibility] Starting HTML download");

    // Create a clean clone of the element without export controls
    const cleanElement = createCleanClone(element);

    // Get the HTML content
    const htmlContent = cleanElement.outerHTML;

    // Create a simple HTML document wrapper
    const docContent = `<!DOCTYPE html>
  <html lang="en-GB">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chart Description</title>
  <style>
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.5;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 1rem;
    }
    
    .chart-description {
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 1.5rem;
        margin: 1rem 0;
    }
    
    .chart-section {
        margin-bottom: 1.5rem;
    }
    
    .chart-section-heading {
        margin-top: 0;
        margin-bottom: 0.75rem;
        color: #2c3e50;
    }
    
    .chart-title, .chart-value, .chart-variable {
        font-weight: bold;
    }
    
    ul, ol {
        padding-left: 1.5rem;
    }
    
    li {
        margin-bottom: 0.5rem;
    }
  </style>
  </head>
  <body>
  <h1>Chart Description</h1>
  ${htmlContent}
  </body>
  </html>`;

    // Download the content
    downloadAsFile(
      docContent,
      fileName || "chart-description.html",
      "text/html"
    );
  }

  /**
   * Download content as plain text
   * @param {HTMLElement} element - The element to download
   * @param {string} fileName - The file name
   */
  function downloadAsText(element, fileName) {
    if (!element) {
      logError("[Chart Accessibility] No element provided to download");
      return;
    }

    logInfo("[Chart Accessibility] Starting text download");

    // Create a clean clone of the element without export controls
    const cleanElement = createCleanClone(element);

    // Convert HTML to plain text
    const plainText = convertHtmlToText(cleanElement);

    // Download the content
    downloadAsFile(
      plainText,
      fileName || "chart-description.txt",
      "text/plain"
    );
  }

  /**
   * Download content as Markdown
   * @param {HTMLElement} element - The element to download
   * @param {string} fileName - The file name
   */
  function downloadAsMarkdown(element, fileName) {
    if (!element) {
      logError("[Chart Accessibility] No element provided to download");
      return;
    }

    logInfo("[Chart Accessibility] Starting Markdown download");

    // Create a clean clone of the element without export controls
    const cleanElement = createCleanClone(element);

    // Convert HTML to Markdown
    const markdown = convertHtmlToMarkdown(cleanElement);

    // Download the content
    downloadAsFile(
      markdown,
      fileName || "chart-description.md",
      "text/markdown"
    );
  }

  // Module initialisation
  logInfo("[Chart Accessibility] Export utilities module initialised");

  // Public API
  return {
    copyHtmlToClipboard: copyHtmlToClipboard,
    copyTextToClipboard: copyTextToClipboard,
    copyFormattedTextForWord: copyFormattedTextForWord,
    downloadAsHtml: downloadAsHtml,
    downloadAsText: downloadAsText,
    downloadAsMarkdown: downloadAsMarkdown,
    convertHtmlToText: convertHtmlToText,
    convertHtmlToMarkdown: convertHtmlToMarkdown,
  };
})();
