/**
 * Mermaid Accessibility Export Utilities
 * Functions for exporting and copying diagram descriptions
 */

window.MermaidAccessibilityExport = (function () {
  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level - can be modified at runtime
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The logging level to check
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
   * @param {...any} args - Additional arguments to log
   */
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Mermaid Accessibility] ${message}`, ...args);
    }
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to log
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Mermaid Accessibility] ${message}`, ...args);
    }
  }

  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to log
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Mermaid Accessibility] ${message}`, ...args);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to log
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Mermaid Accessibility] [DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Set the current logging level
   * @param {number} level - The new logging level
   */
  function setLogLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      currentLogLevel = level;
      logInfo(
        `Logging level set to: ${Object.keys(LOG_LEVELS).find(
          (key) => LOG_LEVELS[key] === level
        )}`
      );
    } else {
      logWarn(
        `Invalid log level: ${level}. Valid levels are: ${Object.values(
          LOG_LEVELS
        ).join(", ")}`
      );
    }
  }

  // Items 115 and 120 (24 October 2026): what goes between two table cells
  // when a row is written as one line of text.
  const TABLE_CELL_SEPARATOR = " | ";

  /**
   * Copy the HTML content to clipboard
   * @param {HTMLElement} element - The element to copy
   * @returns {Promise<boolean>} Whether the operation succeeded
   */
  async function copyHtmlToClipboard(element) {
    if (!element) {
      logError("No element provided to copy");
      return false;
    }

    logDebug("Starting HTML clipboard copy operation");

    try {
      // Create a clean clone of the element without export controls
      const cleanElement = createCleanClone(element);

      // Get the HTML content
      const htmlContent = cleanElement.outerHTML;

      logDebug("HTML content prepared for clipboard");

      // Use Clipboard API if available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(htmlContent);
        logDebug("HTML copied to clipboard using Clipboard API");
        return true;
      } else {
        logDebug("Clipboard API not available, using fallback method");
        return fallbackCopyToClipboard(htmlContent);
      }
    } catch (error) {
      logError("Error copying HTML to clipboard:", error);
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
      logError("No element provided to copy");
      return false;
    }

    logDebug("Starting text clipboard copy operation");

    try {
      // Create a clean clone of the element without export controls
      const cleanElement = createCleanClone(element);

      // Convert the HTML to plain text while preserving structure
      const plainText = convertHtmlToText(cleanElement);

      logDebug("Text content prepared for clipboard");

      // Use Clipboard API if available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(plainText);
        logDebug("Text copied to clipboard using Clipboard API");
        return true;
      } else {
        logDebug("Clipboard API not available, using fallback method");
        return fallbackCopyToClipboard(plainText);
      }
    } catch (error) {
      logError("Error copying text to clipboard:", error);
      return false;
    }
  }

  /**
   * Create a clean clone of an element without export controls
   * @param {HTMLElement} element - The element to clone
   * @returns {HTMLElement} A clean clone without export controls
   */
  function createCleanClone(element) {
    logDebug("Creating clean clone of element");

    // Create a deep clone of the element
    const clone = element.cloneNode(true);

    // Remove export controls from the clone if they exist
    const exportControls = clone.querySelector(".mermaid-export-controls");
    if (exportControls) {
      clone.removeChild(exportControls);
      logDebug("Removed export controls from cloned element");
    }

    return clone;
  }

  /**
   * Fallback method for copying to clipboard using document.execCommand
   * @param {string} text - Text to copy
   * @returns {boolean} Whether the operation succeeded
   */
  function fallbackCopyToClipboard(text) {
    logDebug("Using fallback clipboard copy method");

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
        logDebug("Fallback clipboard copy successful");
      } else {
        logWarn("Fallback clipboard copy failed");
      }

      return successful;
    } catch (error) {
      logError("Error in fallback copy method:", error);
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
      logError("No element provided to copy");
      return false;
    }

    logDebug("Starting formatted text copy for Word");

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
              
              .diagram-title, .timeline-start, .timeline-end, .timeline-sections, 
              .timeline-events, .diagram-node, .diagram-action, .diagram-decision {
                  font-weight: bold;
              }
              
              .diagram-condition {
                  font-style: italic;
              }
              
              .timeline-section-heading, .mermaid-details-heading, 
              .mermaid-short-description-heading {
                  margin-top: 12pt;
                  margin-bottom: 6pt;
                  font-weight: bold;
              }
              
              .timeline-section-name {
                  font-weight: bold;
                  margin-top: 10pt;
                  margin-bottom: 4pt;
              }
              
              .timeline-time {
                  font-weight: bold;
              }
              
              /* Clear margin for state disclaimer */
              .state-disclaimer {
                  margin-top: 12pt;
                  font-style: italic;
                  color: #666666;
              }
          </style>
      `;

      // Add the content to the div
      const cleanCopy = cleanElement.cloneNode(true);

      // Tables paste into Word with a repeating header row and unsplit rows
      if (window.WordTablePrep) {
        cleanCopy.innerHTML = window.WordTablePrep.prepare(cleanCopy.innerHTML);
      }

      formattedDiv.appendChild(cleanCopy);

      // Get the HTML content
      const formattedHtml = formattedDiv.innerHTML;

      logDebug("Formatted HTML prepared for Word");

      // Create a Blob with HTML mime type
      const blob = new Blob([formattedHtml], { type: "text/html" });

      // Create clipboard data
      const data = new ClipboardItem({
        "text/html": blob,
      });

      // Use Clipboard API to write HTML to clipboard if available
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([data]);
        logDebug("Formatted text copied using Clipboard API");
        return true;
      } else {
        // Fallback for browsers that don't support ClipboardItem
        logDebug("ClipboardItem not supported, using fallback method");
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

          if (success) {
            logDebug("Formatted text copied using fallback method");
          } else {
            logWarn("Fallback formatted copy failed");
          }

          return success;
        } catch (error) {
          logError("Error in fallback formatted copy:", error);
          return false;
        }
      }
    } catch (error) {
      logError("Error copying formatted text:", error);
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

    logDebug("Converting HTML to plain text");

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

    logDebug("HTML to text conversion completed");
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
    if (node.classList && node.classList.contains("mermaid-export-controls")) {
      return "";
    }

    // Text node handling
    if (node.nodeType === Node.TEXT_NODE) {
      // Item 111 (13 October 2026): the space beside an inline sibling (a
      // link above all) is the AUTHOR's. The old code trimmed every text node
      // and then added a space after it, which put a space inside an opening
      // quote ('" name') and dropped the one after a link ('specnow').
      const raw = node.textContent;
      const text = raw.trim();
      const previous = node.previousSibling;
      const next = node.nextSibling;

      if (!text) {
        return previous &&
          next &&
          isInlineContent(previous) &&
          isInlineContent(next)
          ? " "
          : "";
      }

      const leading =
        previous && isInlineContent(previous) && /^\s/.test(raw) ? " " : "";
      const nextIsInline = !!next && isInlineContent(next);
      const authoredTrailing = /\s$/.test(raw);

      // Check if we're in an inline context
      if (context.parentNode && isInlineElement(context.parentNode)) {
        return leading + text + (nextIsInline && authoredTrailing ? " " : "");
      }

      // Normal text node: a space after it, unless an inline sibling follows
      // and the author wrote none.
      return leading + text + (nextIsInline && !authoredTrailing ? "" : " ");
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

      case "DL": {
        // Item 111 (13 October 2026): a definition list reads "Term: detail",
        // one pair to a line. The default branch ran the term and the detail
        // together with no separator and no break.
        if (!context.lastNodeWasBlock) {
          result += "\n\n";
        }

        const read = (child) => {
          let text = "";
          for (const grandchild of child.childNodes) {
            text += processNodeToTextEnhanced(grandchild, {
              ...context,
              parentNode: child,
              lastNodeWasBlock: false,
            });
          }
          return text.trim();
        };

        let term = null;
        for (const child of node.childNodes) {
          if (child.nodeName === "DT") {
            if (term !== null) result += term + "\n";
            term = read(child);
          } else if (child.nodeName === "DD") {
            result += (term !== null ? term + ": " : "") + read(child) + "\n";
            term = null;
          }
        }
        if (term !== null) result += term + "\n";

        result += "\n";
        context.lastNodeWasBlock = true;
        break;
      }

      case "TABLE": {
        // Items 115 and 120, ruling X2 (24 October 2026): a table reads as its
        // caption on a line, then one line per row with " | " between cells.
        // The default branch ran every cell of the table onto a single line.
        if (!context.lastNodeWasBlock) {
          result += "\n\n";
        }

        const readCell = (cell) => {
          let text = "";
          for (const child of cell.childNodes) {
            text += processNodeToTextEnhanced(child, {
              ...context,
              parentNode: cell,
              lastNodeWasBlock: false,
            });
          }
          return text.replace(/\s+/g, " ").trim();
        };

        const caption = node.caption ? readCell(node.caption) : "";
        if (caption) result += caption + "\n";

        for (const row of node.rows) {
          result += [...row.cells].map(readCell).join(TABLE_CELL_SEPARATOR) + "\n";
        }

        result += "\n";
        context.lastNodeWasBlock = true;
        break;
      }

      case "A": {
        // Items 115 and 120, ruling X5: a link keeps its address, in angle
        // brackets after its text, because plain text has nowhere else to put
        // it. A fragment, an empty href or an address equal to the text adds
        // nothing the reader does not already have.
        for (const child of node.childNodes) {
          result += processNodeToTextEnhanced(child, {
            ...context,
            parentNode: node,
          });
        }

        const href = (node.getAttribute("href") || "").trim();
        if (href && !href.startsWith("#") && href !== result.trim()) {
          result += ` <${href}>`;
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
          (node.classList.contains("mermaid-export-controls") ||
            node.classList.contains("mermaid-export-group"))
        ) {
          return "";
        }

        // Special handling for timeline sections to keep proper formatting
        if (
          node.classList &&
          (node.classList.contains("timeline-section-container") ||
            node.classList.contains("timeline-section"))
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
        }
        // Special handling for timeline events
        else if (
          node.classList &&
          (node.classList.contains("timeline-time-period") ||
            node.classList.contains("timeline-period-events"))
        ) {
          // Use more compact formatting for these elements
          for (const child of node.childNodes) {
            result += processNodeToTextEnhanced(child, {
              ...context,
              lastNodeWasBlock: false,
              parentNode: node,
            });
          }

          // Add a newline after time periods
          if (node.classList.contains("timeline-time-period")) {
            result += "\n";
          }

          context.lastNodeWasBlock = false;
        }
        // General block elements
        else {
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
        // Special handling for timeline elements
        if (
          node.classList &&
          (node.classList.contains("timeline-time") ||
            node.classList.contains("timeline-event"))
        ) {
          const content = getTextContentEnhanced(node);

          // Format based on class
          if (node.classList.contains("timeline-time")) {
            result += content + ": ";
          } else if (node.classList.contains("timeline-event")) {
            result += content;
          } else {
            result += content + " ";
          }
        }
        // Special handling for diagram elements (make them stand out)
        else if (
          node.classList &&
          (node.classList.contains("diagram-title") ||
            node.classList.contains("diagram-node") ||
            node.classList.contains("diagram-decision"))
        ) {
          result += getTextContentEnhanced(node);
        }
        // Default span handling
        else {
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
   * True for a node that sits in the flow of a line of text: a text node with
   * words in it, or an inline element. Decides whether the space beside a text
   * node is the author's (item 111).
   * @param {Node} node - The node to test
   * @returns {boolean} True when the node is inline content
   */
  function isInlineContent(node) {
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim() !== "";
    }
    return isInlineElement(node);
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
      (node.classList.contains("mermaid-export-controls") ||
        node.classList.contains("mermaid-export-group") ||
        node.classList.contains("mermaid-export-group-label") ||
        node.classList.contains("mermaid-export-buttons") ||
        node.classList.contains("mermaid-export-button") ||
        node.classList.contains("mermaid-export-feedback"))
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
   * Items 115 and 120, ruling X1 (24 October 2026): a table as a pipe table
   * with its caption as a bold line above it. The first row is the header when
   * it is all header cells; otherwise the header row is empty, since a pipe
   * table must have one. A cell's own "|" is escaped. Shared by the Turndown
   * rule and the fallback converter, so the two cannot drift.
   * @param {HTMLTableElement} table - The table
   * @param {function(Element): string} readInline - Reads an element as one line of Markdown
   * @returns {string} The table block, or "" when it has no rows
   */
  function tableToMarkdown(table, readInline) {
    if (!table.rows || !table.rows.length) return "";

    const cellText = (cell) => readInline(cell).replace(/\|/g, "\\|");
    const rows = [...table.rows].map((row) => [...row.cells].map(cellText));
    const width = Math.max(...rows.map((row) => row.length));
    const line = (cells) =>
      "| " +
      cells.concat(Array(width - cells.length).fill("")).join(" | ") +
      " |";

    const firstRowIsHeader = [...table.rows[0].cells].every(
      (cell) => cell.nodeName === "TH"
    );
    const header = firstRowIsHeader ? rows.shift() : [];
    const lines = [line(header), line(Array(width).fill("---")), ...rows.map(line)];

    const caption = table.caption ? readInline(table.caption) : "";
    return `\n\n${caption ? `**${caption}**\n\n` : ""}${lines.join("\n")}\n\n`;
  }

  /**
   * Items 115 and 120, ruling X4: a definition list as one paragraph per pair,
   * "**Term:** detail", the form the plain-text export already has.
   * @param {HTMLElement} list - The dl element
   * @param {function(Element): string} readInline - Reads an element as one line of Markdown
   * @returns {string} The paragraphs
   */
  function definitionListToMarkdown(list, readInline) {
    const paragraphs = [];
    let term = null;

    for (const child of list.children) {
      if (child.nodeName === "DT") {
        if (term) paragraphs.push(`**${term}**`);
        term = readInline(child);
      } else if (child.nodeName === "DD") {
        const detail = readInline(child);
        paragraphs.push(term ? `**${term}:** ${detail}` : detail);
        term = null;
      }
    }
    if (term) paragraphs.push(`**${term}**`);

    return `\n\n${paragraphs.join("\n\n")}\n\n`;
  }

  /**
   * Item 115 and 120, ruling X6: a "<" in author text is escaped so the
   * Markdown Editor reads it as a character and not the start of a tag.
   * Ruling X8: the same for an "&" that begins what looks like a character
   * reference ("&amp;" typed by the author), which the Editor would read as
   * the one character it names. A bare "&" is read as itself and is left alone.
   * @param {string} text - Text from a text node
   * @returns {string} The text with "<" and entity-looking "&" escaped
   */
  function escapeAngleBrackets(text) {
    return text
      .replace(/</g, "\\<")
      .replace(/&(?=#\d+;|#[xX][0-9a-fA-F]+;|[A-Za-z][A-Za-z0-9]*;)/g, "\\&");
  }

  /**
   * Convert HTML to Markdown using TurndownJS
   * @param {HTMLElement} element - The element to convert
   * @returns {string} Markdown text
   */
  function convertHtmlToMarkdown(element) {
    if (!element) return "";

    logDebug("Converting HTML to Markdown");

    // Create a clean clone of the element without export controls
    const cleanElement = createCleanClone(element);

    // Check if TurndownJS is available
    if (typeof TurndownService === "undefined") {
      logWarn(
        "TurndownJS not available. Falling back to basic markdown conversion."
      );
      return fallbackHtmlToMarkdown(cleanElement);
    }

    try {
      logDebug("Using TurndownJS for Markdown conversion");

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

      // Configure TurndownService for better handling of mermaid diagram descriptions

      // Handle specific diagram classes
      turndownService.addRule("diagramElements", {
        filter: function (node) {
          return (
            node.classList &&
            (node.classList.contains("diagram-title") ||
              node.classList.contains("diagram-count") ||
              node.classList.contains("diagram-node") ||
              node.classList.contains("diagram-action") ||
              node.classList.contains("diagram-decision") ||
              node.classList.contains("diagram-condition") ||
              node.classList.contains("diagram-flow") ||
              node.classList.contains("diagram-step"))
          );
        },
        replacement: function (content, node) {
          // For most diagram elements, use bold formatting
          if (
            node.classList.contains("diagram-title") ||
            node.classList.contains("diagram-node") ||
            node.classList.contains("diagram-action") ||
            node.classList.contains("diagram-decision")
          ) {
            return `**${content}**`;
          }

          // For condition elements, use emphasis
          if (node.classList.contains("diagram-condition")) {
            return `_${content}_`;
          }

          // For steps and counts, keep as plain text
          return content;
        },
      });

      // Handle list items in diagram descriptions better
      // Items 115 and 120, ruling X3 (24 October 2026): a child list is
      // indented by its PARENT's marker width (3 under "1. ", 2 under "* ",
      // 4 under "10. "), because a child indented less than the parent's text
      // is read as a continuation of the parent and not as a nested list. The
      // old rule indented every level by 2 whatever the marker. Each item
      // indents its own continuation lines, so the widths add up at any depth.
      turndownService.addRule("listItems", {
        filter: "li",
        replacement: function (content, node) {
          let prefix = "*"; // Default for ul items
          const parent = node.parentNode;

          // Handle ordered lists
          if (parent.nodeName === "OL") {
            // Find position in parent's children
            const index = Array.prototype.indexOf.call(parent.children, node) + 1;
            prefix = `${index}.`;
          }

          const markerWidth = prefix.length + 1;
          const body = content
            .replace(/^\s+/, "")
            .replace(/\n+$/, "")
            .replace(/\n/g, "\n" + " ".repeat(markerWidth));

          return `\n${prefix} ${body}`;
        },
      });

      // A list inside a list item follows its parent's text on the next line
      // with no blank line between (a blank line makes the list loose).
      turndownService.addRule("nestedLists", {
        filter: function (node) {
          return (
            (node.nodeName === "UL" || node.nodeName === "OL") &&
            node.parentNode &&
            node.parentNode.nodeName === "LI"
          );
        },
        replacement: function (content) {
          return "\n" + content.replace(/^\n+/, "").replace(/\n+$/, "");
        },
      });

      // Items 115 and 120, rulings X1 and X4 (24 October 2026). A cell or a
      // definition read as one line of Markdown text.
      const readInline = (element) =>
        turndownService
          .turndown(element)
          .replace(/\s*\n+\s*/g, " ")
          .trim();

      // X1: see tableToMarkdown.
      turndownService.addRule("tables", {
        filter: "table",
        replacement: function (content, node) {
          return tableToMarkdown(node, readInline) || content;
        },
      });

      // X4: a definition list is one paragraph per pair, "**Term:** detail",
      // the form the plain-text export already has.
      turndownService.addRule("definitionLists", {
        filter: "dl",
        replacement: function (content, node) {
          return definitionListToMarkdown(node, readInline);
        },
      });

      // X6: author text the panel shows as characters stays characters. A "<"
      // in a text node would otherwise reach the Markdown Editor as the start
      // of a tag (packet E6's x<br>y was drawn as a line break there).
      const escapeText = turndownService.escape.bind(turndownService);
      turndownService.escape = (text) => escapeAngleBrackets(escapeText(text));

      // Handle special elements that need extra spacing
      turndownService.addRule("doubleLineBreaks", {
        filter: function (node) {
          return (
            node.classList &&
            (node.classList.contains("mermaid-section") ||
              node.classList.contains("mermaid-section-heading"))
          );
        },
        replacement: function (content) {
          // Add extra line breaks for section divisions
          return `\n\n${content}\n\n`;
        },
      });

      // Use TurndownService to convert HTML to Markdown
      const markdown = turndownService.turndown(cleanElement);
      logDebug("Markdown conversion completed successfully");
      return markdown;
    } catch (error) {
      logError("Error using TurndownJS:", error);
      return fallbackHtmlToMarkdown(cleanElement);
    }
  }

  /**
   * Fallback function for HTML to Markdown conversion when TurndownJS is not available
   * @param {HTMLElement} element - The element to convert
   * @returns {string} Markdown text
   */
  function fallbackHtmlToMarkdown(element) {
    logDebug("Using fallback Markdown conversion");

    // Process the clean clone
    return processNodeToMarkdown(element, 0);
  }

  /**
   * Read an element's contents as one line of Markdown, for a table cell or a
   * definition (items 115 and 120). Reads the children, so a link or bold text
   * inside the cell keeps its markup.
   * @param {Element} element - The cell, caption, term or detail
   * @returns {string} One line of Markdown
   */
  function readInlineFallback(element) {
    let markdown = "";
    for (const child of element.childNodes) {
      markdown += processNodeToMarkdown(child, 0);
    }
    return markdown.replace(/\s+/g, " ").trim();
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
      return escapeAngleBrackets(node.textContent);
    }

    // Skip script, style and hidden elements
    if (node.nodeName === "SCRIPT" || node.nodeName === "STYLE") {
      return "";
    }

    // Skip export controls entirely
    if (node.classList && node.classList.contains("mermaid-export-controls")) {
      return "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    // Handle different element types
    let result = "";

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
        // Raw text: a backslash inside a code span would show.
        result += "`" + node.textContent + "`";
        break;
      case "A":
        const href = node.getAttribute("href");
        const text = getTextContent(node);
        result += "[" + text + "](" + (href || "#") + ")";
        break;
      case "UL":
      case "OL": {
        // Items 115 and 120, ruling X3: each item indents its own continuation
        // lines (a nested list among them) by its marker width, so a child list
        // sits 3 columns in under "1. " and 2 under "* ", at any depth, with no
        // blank line between an item and its child list.
        const isOrdered = node.nodeName === "OL";
        const items = [];
        let position = 1;
        for (const child of node.childNodes) {
          if (child.nodeName !== "LI") continue;

          const marker = isOrdered ? `${position}.` : "*";
          position++;
          // The whitespace between an item's text and its child list is not a
          // paragraph break, and a blank line would make the list loose.
          const body = processNodeToMarkdown(child, 0)
            .trim()
            .replace(/\n[ \t]*(?=\n)/g, "")
            .replace(/\n/g, "\n" + " ".repeat(marker.length + 1));
          items.push(`${marker} ${body}`);
        }

        const nestedInItem = node.parentNode && node.parentNode.nodeName === "LI";
        result += nestedInItem
          ? "\n" + items.join("\n")
          : "\n" + items.join("\n") + "\n\n";
        break;
      }
      case "TABLE":
        // Item 115, ruling X1, shared with the Turndown rule.
        result += tableToMarkdown(node, readInlineFallback) || getTextContent(node);
        break;
      case "DL":
        // Item 115, ruling X4, shared with the Turndown rule.
        result += definitionListToMarkdown(node, readInlineFallback);
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
          node.classList.contains("mermaid-export-controls")
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
        // Special handling for diagram-specific classes
        if (node.classList) {
          if (
            node.classList.contains("diagram-node") ||
            node.classList.contains("diagram-action") ||
            node.classList.contains("diagram-decision") ||
            node.classList.contains("diagram-title")
          ) {
            return "**" + getTextContent(node) + "** ";
          }
          if (node.classList.contains("diagram-condition")) {
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
      (node.classList.contains("mermaid-export-controls") ||
        node.classList.contains("mermaid-export-group") ||
        node.classList.contains("mermaid-export-group-label") ||
        node.classList.contains("mermaid-export-buttons") ||
        node.classList.contains("mermaid-export-button") ||
        node.classList.contains("mermaid-export-feedback"))
    ) {
      return "";
    }

    let result = "";

    if (node.nodeType === Node.TEXT_NODE) {
      result += escapeAngleBrackets(node.textContent);
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
    logDebug(`Starting file download: ${fileName} (${mimeType})`);

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

      logInfo(`File downloaded successfully: ${fileName}`);
    } catch (error) {
      logError("Error downloading file:", error);
    }
  }

  /**
   * Download HTML content as a file
   * @param {HTMLElement} element - The element to download
   * @param {string} fileName - The file name
   */
  function downloadAsHtml(element, fileName) {
    if (!element) {
      logError("No element provided to download");
      return;
    }

    logDebug("Starting HTML file download");

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
<title>Mermaid Diagram Description</title>
<style>
  body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.5;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 1rem;
  }
  
  .mermaid-description {
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 1.5rem;
      margin: 1rem 0;
  }
  
  .mermaid-section {
      margin-bottom: 1.5rem;
  }
  
  .mermaid-section-heading {
      margin-top: 0;
      margin-bottom: 0.75rem;
      color: #2c3e50;
  }
  
  .message-sender, .message-receiver, .actor-name, .participant-name, .diagram-title {
      font-weight: bold;
  }
  
  .actor-name {
      color: #e74c3c;
  }
  
  .participant-name {
      color: #3498db;
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
<h1>Mermaid Diagram Description</h1>
${htmlContent}
</body>
</html>`;

    // Download the content
    downloadAsFile(
      docContent,
      fileName || "diagram-description.html",
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
      logError("No element provided to download");
      return;
    }

    logDebug("Starting text file download");

    // Create a clean clone of the element without export controls
    const cleanElement = createCleanClone(element);

    // Convert HTML to plain text
    const plainText = convertHtmlToText(cleanElement);

    // Download the content
    downloadAsFile(
      plainText,
      fileName || "diagram-description.txt",
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
      logError("No element provided to download");
      return;
    }

    logDebug("Starting Markdown file download");

    // Create a clean clone of the element without export controls
    const cleanElement = createCleanClone(element);

    // Convert HTML to Markdown
    const markdown = convertHtmlToMarkdown(cleanElement);

    // Download the content
    downloadAsFile(
      markdown,
      fileName || "diagram-description.md",
      "text/markdown"
    );
  }

  // Log that the module has been initialised
  logInfo("Export utilities module loaded");

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
    // Expose logging configuration for external control if needed
    setLogLevel: setLogLevel,
    LOG_LEVELS: LOG_LEVELS,
  };
})();
