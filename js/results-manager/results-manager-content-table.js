/**
 * @module TableContentProcessor
 *
 * results-manager-content-table.js
 *
 * @description Processes table content with sortable functionality
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";
import { ContentProcessorUtils } from "./results-manager-content-utils.js";

export class TableContentProcessor extends ContentProcessorBase {
  constructor() {
    super();
    this.processorUtils = new ContentProcessorUtils();
    this.utils.log("Table content processor initialized");
  }

  /**
   * Process tables in content
   * @param {string} content - Content to process
   * @returns {string} Processed content with HTML tables
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing tables");
      return this.processTables(content);
    } catch (error) {
      this.utils.log("Error processing tables", { error }, "error");
      return content; // Return original content on error
    }
  }

  /**
   * Process markdown tables in content
   * @param {string} content - Content to process
   * @returns {string} Content with tables converted to HTML
   */
  processTables(content) {
    this.utils.log("Processing tables");

    try {
      // Split content to isolate potential table blocks
      const parts = content.split(/\n\n+/);

      const processedParts = parts.map((part) => {
        // Improved table pattern detection - more precise checking
        if (part.includes("|") && part.includes("\n")) {
          const lines = part.trim().split("\n");

          // Need at least 2 lines for a table
          if (lines.length >= 2) {
            // Check if second line contains separator pattern (---|---|---)
            const secondLine = lines[1].trim();
            if (
              secondLine.includes("|") &&
              secondLine.replace(/[|:,-]/g, "").trim() === ""
            ) {
              this.utils.log("Found table pattern", {
                headerLine: lines[0],
                separatorLine: secondLine,
              });

              // Convert the table
              return this.convertTableToHtml(part);
            }
          }
        }
        return part;
      });

      return processedParts.join("\n\n");
    } catch (error) {
      this.utils.log("Error processing tables", { error }, "error");
      return content;
    }
  }

  /**
   * Check if content contains a markdown table
   * @param {string} content - Content to check
   * @returns {boolean} True if content contains a markdown table
   */
  isMarkdownTable(content) {
    // A markdown table must have at least two lines:
    // - A header line with pipe separators
    // - A separator line with hyphens and optional colons for alignment
    const lines = content.trim().split("\n");
    this.utils.log("Checking for markdown table", {
      lineCount: lines.length,
      firstLine: lines.length > 0 ? lines[0] : "",
      secondLine: lines.length > 1 ? lines[1] : "",
    });

    if (lines.length < 2) {
      this.utils.log("Not a table: too few lines");
      return false;
    }

    // Check for pipe separators in first line
    if (!lines[0].includes("|")) {
      this.utils.log("Not a table: first line doesn't contain pipe separator");
      return false;
    }

    // Check for separator line with hyphens
    const separatorLine = lines[1].trim();
    const separatorPattern = /^\|?(:?-+:?\|)+:?-+:?\|?$/;
    const isTable = separatorPattern.test(separatorLine);

    this.utils.log("Table separator line check", {
      separatorLine,
      isTable,
      pattern: separatorPattern.toString(),
    });

    return isTable;
  }

  /**
   * Convert markdown table to HTML with sortable functionality
   * @param {string} tableContent - Markdown table content
   * @returns {string} HTML table with sortable features
   */
  convertTableToHtml(tableContent) {
    try {
      this.utils.log(
        "Converting markdown table to HTML with sortable features",
        {
          tableContentPreview: tableContent.substring(0, 100) + "...",
          hasCurrencySymbols: tableContent.includes("$"),
          hasCurrencyPlaceholders: tableContent.includes("__CURRENCY_"),
          lineCount: tableContent.trim().split("\n").length,
        }
      );

      const lines = tableContent.trim().split("\n");
      if (lines.length < 2) return tableContent;

      // Extract header row and separator row
      const headerRow = this.parseTableRow(lines[0]);
      const separatorRow = this.parseTableRow(lines[1]);

      // Log header row for debugging
      this.utils.log("Table header row", {
        headerRow,
        hasCurrencyInHeaders: headerRow.some(
          (cell) => cell.includes("$") || cell.includes("__CURRENCY_")
        ),
      });

      // Determine column alignments from separator row
      const alignments = this.determineColumnAlignments(separatorRow);

      // Start building the HTML table with sortable-table class
      let html = '<table class="sortable-table">\n';

      // Add thead with header row
      html += "<thead>\n<tr>\n";
      headerRow.forEach((cell, index) => {
        const alignment = alignments[index] || "left";
        const cellContent = this.processTableCell(cell);
        const columnId = `column-${this.generateHeaderId(cell)}-${index}`;

        // Create sortable header with button
        html += `<th scope="col" style="text-align: ${alignment}">\n`;
        html += `  <div class="th-container">\n`;
        html += `    <span class="th-content">${cellContent}</span>\n`;
        html += `    <button class="sort-button" aria-label="Sort by ${cellContent}" data-column-index="${index}" data-sort-direction="none">\n`;
        html += `      <span class="sort-icon" aria-hidden="true"></span>\n`;
        html += `    </button>\n`;
        html += `  </div>\n`;
        html += `</th>\n`;
      });
      html += "</tr>\n</thead>\n";

      // Add tbody with data rows
      html += "<tbody>\n";
      for (let i = 2; i < lines.length; i++) {
        const row = this.parseTableRow(lines[i]);

        // Log data row for debugging
        this.utils.log(`Processing table row ${i - 1}`, {
          rowData: row,
          hasCurrencyInRow: row.some(
            (cell) => cell.includes("$") || cell.includes("__CURRENCY_")
          ),
          currencyCells: row
            .map((cell, idx) => ({
              columnIndex: idx,
              headerName: headerRow[idx] || "unknown",
              hasCurrency: cell.includes("$") || cell.includes("__CURRENCY_"),
              content: cell,
            }))
            .filter((info) => info.hasCurrency),
        });

        html += "<tr>\n";

        row.forEach((cell, index) => {
          const alignment = alignments[index] || "left";
          // Get the header text for this column, sanitize it for use in data-label
          const headerText = headerRow[index]
            ? this.processorUtils.sanitizeAttributeValue(headerRow[index])
            : "";

          // Check if this cell might contain currency
          const mightContainCurrency =
            cell.includes("$") || cell.includes("__CURRENCY_");
          if (mightContainCurrency) {
            this.utils.log("Processing potential currency cell", {
              columnName: headerRow[index] || "unknown",
              columnIndex: index,
              rawContent: cell,
              hasDollarSign: cell.includes("$"),
              hasPlaceholder: cell.includes("__CURRENCY_"),
            });
          }

          // Process the cell content
          const processedCellContent = this.processTableCell(cell);

          // For the first cell in each row, use th with scope="row" for better accessibility
          if (index === 0) {
            html += `<th scope="row" data-label="${headerText}" style="text-align: ${alignment}">${processedCellContent}</th>\n`;
          } else {
            html += `<td data-label="${headerText}" style="text-align: ${alignment}">${processedCellContent}</td>\n`;
          }
        });

        // If this row has fewer cells than the header, add empty cells
        for (let j = row.length; j < headerRow.length; j++) {
          const alignment = alignments[j] || "left";
          const headerText = headerRow[j]
            ? this.processorUtils.sanitizeAttributeValue(headerRow[j])
            : "";
          html += `<td data-label="${headerText}" style="text-align: ${alignment}">&nbsp;</td>\n`;
        }

        html += "</tr>\n";
      }
      html += "</tbody>\n";
      html += "</table>";

      this.utils.log(
        "Table conversion completed successfully with sortable features"
      );
      return html;
    } catch (error) {
      this.utils.log("Error converting table to HTML", { error }, "error");
      // Return a basic version of the table as fallback
      return `<table>${tableContent}</table>`;
    }
  }

  /**
   * Parse a table row into an array of cells
   * @param {string} rowContent - Content of the table row
   * @returns {string[]} Array of cell contents
   */
  parseTableRow(rowContent) {
    // Remove leading and trailing pipes if present
    let cleanRow = rowContent.trim();
    if (cleanRow.startsWith("|")) cleanRow = cleanRow.substring(1);
    if (cleanRow.endsWith("|"))
      cleanRow = cleanRow.substring(0, cleanRow.length - 1);

    // Split by pipes and trim each cell
    return cleanRow.split("|").map((cell) => cell.trim());
  }

  /**
   * Determine column alignments from separator row
   * @param {string[]} separatorCells - Array of separator cells
   * @returns {string[]} Array of alignment values ('left', 'center', 'right')
   */
  determineColumnAlignments(separatorCells) {
    return separatorCells.map((cell) => {
      if (cell.startsWith(":") && cell.endsWith(":")) return "center";
      if (cell.endsWith(":")) return "right";
      return "left";
    });
  }

  /**
   * Process content within a table cell
   * @param {string} cellContent - Content of the cell
   * @returns {string} Processed cell content
   */
  processTableCell(cellContent) {
    // Log the cell content for debugging
    this.utils.log("Processing table cell", {
      cellContent,
      hasCurrencyPlaceholder: cellContent.includes("__CURRENCY_"),
      hasDollarSign: cellContent.includes("$"),
      hasCurrencyWithComma:
        cellContent.includes("$") && cellContent.includes(","),
      hasBulletPoints: cellContent.includes("•"),
      hasLineBreaks: cellContent.includes("<br>"),
      hasLinks: cellContent.includes("[") && cellContent.includes("]("),
      length: cellContent.length,
    });

    // Process inline formatting within the cell
    let processed = cellContent;

    // Handle <br> tags or <br/> tags - they might be part of the original input
    // Convert them to actual HTML breaks rather than escaped text
    processed = processed.replace(/&lt;br\s*\/?&gt;/g, "<br>");
    processed = processed.replace(/<br\s*\/?>/g, "<br>");

    // Handle bullet points with proper spacing
    if (processed.includes("•")) {
      // Add a class to help with styling if needed
      processed = `<div class="table-cell-list">${processed}</div>`;

      // Convert bullet points to list items if they're followed by line breaks
      processed = processed.replace(
        /•\s*(.*?)(?:<br>|$)/g,
        '<div class="table-list-item">• $1</div>'
      );
    }

    // Convert bold text
    processed = processed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    processed = processed.replace(/__(.*?)__/g, "<strong>$1</strong>");

    // Convert italic text
    processed = processed.replace(/\*(.*?)\*/g, "<em>$1</em>");
    processed = processed.replace(/_(.*?)_/g, "<em>$1</em>");

    // Convert inline code
    processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");

    // DO NOT process links in table cells - let the InlineContentProcessor handle them
    // This prevents double-processing of links which causes malformed HTML

    // Check if the cell contains currency placeholders
    if (processed.includes("__CURRENCY_")) {
      this.utils.log("Table cell contains currency placeholder", {
        original: cellContent,
        processed,
        placeholders: processed.match(/__CURRENCY_\d+__/g) || [],
      });
    }

    return processed;
  }

  /**
   * Check if a position is within a table cell
   * @param {string} content - The full content
   * @param {number} position - Position to check
   * @returns {boolean} True if position is within a table cell
   */
  isWithinTableCell(content, position) {
    try {
      // Simple check: look for pipe characters (|) that indicate table cells
      // Find the last newline before position
      const lastNewline = content.lastIndexOf("\n", position);
      const nextNewline = content.indexOf("\n", position);

      // Extract the line containing the position
      const line = content.substring(
        lastNewline === -1 ? 0 : lastNewline + 1,
        nextNewline === -1 ? content.length : nextNewline
      );

      // Check if the line contains pipe characters (indicating a table row)
      return line.includes("|");
    } catch (error) {
      this.utils.log(
        "Error checking if position is within table cell",
        { error },
        "error"
      );
      // Default to false if there's an error
      return false;
    }
  }

  /**
   * Get table cell boundaries for a position
   * @param {string} content - The full content
   * @param {number} position - Position within a table cell
   * @returns {Object|null} Object with start and end positions of the cell, or null if not in a cell
   */
  getTableCellBoundaries(content, position) {
    try {
      if (!this.isWithinTableCell(content, position)) {
        return null;
      }

      // Find the last newline before position
      const lastNewline = content.lastIndexOf("\n", position);
      const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

      // Find the next newline after position
      const nextNewline = content.indexOf("\n", position);
      const lineEnd = nextNewline === -1 ? content.length : nextNewline;

      // Extract the line containing the position
      const line = content.substring(lineStart, lineEnd);

      // Find the position within the line
      const posInLine = position - lineStart;

      // Find the pipe characters before and after the position
      let cellStart = line.lastIndexOf("|", posInLine);
      let cellEnd = line.indexOf("|", posInLine);

      // Adjust boundaries
      cellStart = cellStart === -1 ? lineStart : lineStart + cellStart + 1;
      cellEnd = cellEnd === -1 ? lineEnd : lineStart + cellEnd;

      return {
        start: cellStart,
        end: cellEnd,
      };
    } catch (error) {
      this.utils.log("Error getting table cell boundaries", { error }, "error");
      return null;
    }
  }
}
