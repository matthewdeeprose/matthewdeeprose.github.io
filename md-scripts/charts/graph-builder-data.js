/**
 * Graph Builder Data
 * Handles all data processing, validation, and transformation for the Graph Builder
 *
 * Dependencies:
 * - GraphBuilderNotifications (for user feedback)
 *
 * @version 1.0.0
 */

const GraphBuilderData = (function () {
  "use strict";

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

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message, ...args);
    }
  }

  // Configuration
  const CONFIG = {
    maxFileSize: 1024 * 1024, // 1MB
    maxDataSize: 500000, // 500KB for pasted data
    maxDataPoints: 1000,
    csvDelimiters: [",", ";", "\t", "|"],
    supportedFileTypes: [".csv", ".txt"],
    supportedMimeTypes: ["text/csv", "text/plain", "application/csv"],
  };

  /**
   * CSV Parser
   * Handles parsing of CSV data with proper quote and delimiter handling
   */
  class CSVParser {
    /**
     * Parse CSV text into structured data
     * @param {string} csvText - Raw CSV text
     * @param {Object} options - Parsing options
     * @returns {Object} Parsed data structure
     */
    parse(csvText, options = {}) {
      logInfo("[Graph Builder Data] Starting CSV parse");

      if (!csvText || csvText.trim().length === 0) {
        throw new Error("CSV data is empty");
      }

      // Size validation
      if (csvText.length > CONFIG.maxDataSize) {
        throw new Error(
          `CSV data is too large. Maximum size is ${Math.round(
            CONFIG.maxDataSize / 1024
          )}KB`
        );
      }

      try {
        // Split into lines while respecting quotes
        const lines = this.splitCSVIntoLines(csvText);
        logDebug("[Graph Builder Data] Found lines:", lines.length);

        if (lines.length < 2) {
          throw new Error("CSV must have at least 2 rows (header + data)");
        }

        // Detect delimiter from header line
        const delimiter = this.detectDelimiter(lines[0]);
        logDebug("[Graph Builder Data] Detected delimiter:", delimiter);

        // Parse header line
        const headers = this.parseCSVLine(lines[0], delimiter);
        logDebug("[Graph Builder Data] Parsed headers:", headers);

        if (headers.length < 2) {
          throw new Error("CSV must have at least 2 columns");
        }

        const rows = [];
        let skippedRows = 0;

        // Process each data line
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();

          if (line.length === 0) {
            continue; // Skip empty lines
          }

          try {
            const row = this.parseCSVLine(line, delimiter);

            if (row.length === 0) {
              logWarn(`[Graph Builder Data] Row ${i + 1} is empty, skipping`);
              skippedRows++;
              continue;
            }

            // Process row data
            const processedRow = this.processRowData(row, headers);
            rows.push(processedRow);
          } catch (rowError) {
            logWarn(
              `[Graph Builder Data] Error parsing row ${i + 1}:`,
              rowError
            );
            skippedRows++;
          }
        }

        if (rows.length === 0) {
          throw new Error("No valid data rows found in CSV");
        }

        // Success feedback
        if (skippedRows > 0) {
          logInfo(
            `[Graph Builder Data] CSV parsed: ${rows.length} rows, ${skippedRows} rows skipped`
          );
        }

        return {
          headers: headers.map((h) => String(h).trim()),
          rows,
          metadata: {
            originalRowCount: lines.length - 1,
            processedRowCount: rows.length,
            skippedRowCount: skippedRows,
            delimiter: delimiter,
          },
        };
      } catch (error) {
        logError("[Graph Builder Data] CSV parsing error:", error);
        throw error;
      }
    }

    /**
     * Split CSV text into lines while respecting quoted fields with newlines
     * @param {string} csvText - Raw CSV text
     * @returns {Array} Array of complete CSV lines
     */
    splitCSVIntoLines(csvText) {
      const lines = [];
      let currentLine = "";
      let inQuotes = false;
      let quoteCount = 0;

      for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
          quoteCount++;
          // Check if this is an escaped quote (double quote)
          if (nextChar === '"') {
            currentLine += '""';
            i++; // Skip the next quote
            continue;
          } else {
            // Toggle quote state for unescaped quotes
            inQuotes = !inQuotes;
            currentLine += char;
          }
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
          // End of line outside quotes
          if (currentLine.trim().length > 0) {
            lines.push(currentLine.trim());
          }
          currentLine = "";

          // Handle \r\n - skip the \n if we just processed \r
          if (char === "\r" && nextChar === "\n") {
            i++;
          }
        } else {
          // Regular character or newline inside quotes
          currentLine += char;
        }
      }

      // Add the last line
      if (currentLine.trim().length > 0) {
        lines.push(currentLine.trim());
      }

      logDebug(`[Graph Builder Data] Split into ${lines.length} lines`);
      return lines;
    }

    /**
     * Detect the most likely delimiter in a CSV line
     * @param {string} line - CSV line to analyse
     * @returns {string} Detected delimiter
     */
    detectDelimiter(line) {
      const counts = {};

      // Count occurrences of each delimiter outside of quotes
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && (i === 0 || line[i - 1] !== "\\")) {
          inQuotes = !inQuotes;
        } else if (!inQuotes && CONFIG.csvDelimiters.includes(char)) {
          counts[char] = (counts[char] || 0) + 1;
        }
      }

      // Return delimiter with highest count, default to comma
      let maxCount = 0;
      let bestDelimiter = ",";

      for (const [delimiter, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          bestDelimiter = delimiter;
        }
      }

      return bestDelimiter;
    }

    /**
     * Parse a single CSV line with proper quote and delimiter handling
     * @param {string} line - CSV line to parse
     * @param {string} delimiter - Delimiter character
     * @returns {Array} Parsed values
     */
    parseCSVLine(line, delimiter = ",") {
      const result = [];
      let current = "";
      let inQuotes = false;
      let i = 0;

      while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Handle escaped quotes (double quotes)
            current += '"';
            i += 2;
            continue;
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          // End of field
          result.push(current.trim());
          current = "";
        } else {
          // Regular character
          current += char;
        }

        i++;
      }

      // Add the last field
      result.push(current.trim());

      return result;
    }

    /**
     * Process row data to ensure proper types
     * @param {Array} row - Raw row data
     * @param {Array} headers - Column headers
     * @returns {Array} Processed row data
     */
    processRowData(row, headers) {
      const processedRow = [];

      for (let j = 0; j < headers.length; j++) {
        let cellValue = row[j] || ""; // Use empty string for missing cells

        if (cellValue === "") {
          processedRow.push(""); // Keep empty cells as empty strings
        } else {
          // First column stays as string (categories)
          if (j === 0) {
            processedRow.push(String(cellValue).trim());
          } else {
            // Other columns: try to convert to numbers
            const trimmed = String(cellValue).trim();
            // Handle European decimal format (comma as decimal separator)
            const normalised = trimmed.replace(",", ".");
            const num = parseFloat(normalised);

            if (!isNaN(num) && isFinite(num)) {
              processedRow.push(num);
            } else {
              processedRow.push(trimmed);
            }
          }
        }
      }

      return processedRow;
    }
  }

  /**
   * File Handler
   * Manages file upload and validation
   */
  class FileHandler {
    /**
     * Handle file upload with validation
     * @param {File} file - File to process
     * @returns {Promise<Object>} Processed file data
     */
    async handleFile(file) {
      logInfo(
        `[Graph Builder Data] Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`
      );

      // File size validation
      if (file.size > CONFIG.maxFileSize) {
        throw new Error(
          `File too large (${Math.round(
            file.size / 1024
          )}KB). Maximum size is ${Math.round(CONFIG.maxFileSize / 1024)}KB.`
        );
      }

      // File extension validation
      const fileName = file.name.toLowerCase();
      const hasValidExtension = CONFIG.supportedFileTypes.some((ext) =>
        fileName.endsWith(ext)
      );

      if (!hasValidExtension) {
        throw new Error("Please select a CSV or text file.");
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            const csvText = e.target.result;

            // Content validation
            if (!csvText || csvText.trim().length === 0) {
              throw new Error("File appears to be empty");
            }

            // Check for suspicious content (binary files)
            if (csvText.includes("\x00") || csvText.includes("\uFFFD")) {
              throw new Error(
                "File appears to be binary or corrupted. Please ensure it's a text-based CSV file."
              );
            }

            // Size check after reading
            if (csvText.length > CONFIG.maxFileSize * 2) {
              throw new Error("File content too large after reading");
            }

            // Additional structure validation
            const lines = csvText.trim().split("\n");
            if (lines.length < 2) {
              throw new Error(
                "File must have at least a header row and one data row"
              );
            }

            // Parse the CSV
            const csvParser = new CSVParser();
            const parsed = csvParser.parse(csvText);

            resolve({
              ...parsed,
              filename: file.name,
              fileSize: file.size,
            });
          } catch (error) {
            logError("[Graph Builder Data] File processing error:", error);
            reject(error);
          }
        };

        reader.onerror = () => {
          reject(new Error("Error reading file. Please try again."));
        };

        reader.readAsText(file);
      });
    }
  }

  /**
   * Data Validator
   * Validates data for chart creation
   */
  class DataValidator {
    /**
     * Validate data structure for chart creation
     * @param {Object} data - Data to validate
     * @returns {Object} Validation result
     */
    validate(data) {
      const errors = [];
      const warnings = [];

      // Basic structure validation
      if (!data || !data.rows || !data.headers) {
        errors.push("Invalid data structure: missing rows or headers");
        return { valid: false, errors, warnings };
      }

      // Minimum data requirements
      if (data.rows.length < 2) {
        errors.push("At least 2 data rows are required");
      }

      if (data.headers.length < 2) {
        errors.push("At least 2 columns are required");
      }

      // Check for empty data
      const validRows = data.rows.filter(
        (row) =>
          row.length >= 2 &&
          row[0] !== "" &&
          row[1] !== "" &&
          !isNaN(parseFloat(row[1]))
      );

      if (validRows.length < 2) {
        errors.push(
          "At least 2 rows with valid category and numeric value are required"
        );
      }

      // Performance warnings
      if (data.rows.length > CONFIG.maxDataPoints) {
        logWarn(
          `[Graph Builder Data] Large dataset (${data.rows.length} rows) may affect performance`
        );
        warnings.push(
          `Large dataset (${data.rows.length} rows) may affect performance`
        );
      }

      // Data type validation
      const secondColumnValues = data.rows
        .map((row) => row[1])
        .filter((val) => val !== "");
      const nonNumericValues = secondColumnValues.filter((val) =>
        isNaN(parseFloat(val))
      );

      if (nonNumericValues.length > 0) {
        const sampleNonNumeric = nonNumericValues.slice(0, 3).join(", ");
        const warningMessage = `Some non-numeric values in data column: ${sampleNonNumeric}${
          nonNumericValues.length > 3 ? "..." : ""
        }`;
        logWarn(`[Graph Builder Data] ${warningMessage}`);
        warnings.push(warningMessage);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        validRowCount: validRows.length,
        totalRowCount: data.rows.length,
      };
    }

    /**
     * Validate form data
     * @param {Array} formRows - Array of form row elements
     * @returns {Object} Validation result
     */
    validateFormData(formRows) {
      let validRows = 0;
      const errors = [];

      formRows.forEach((row, index) => {
        const inputs = row.querySelectorAll("input");
        if (inputs.length >= 2) {
          const col1 = inputs[0].value.trim();
          const col2 = inputs[1].value.trim();

          if (col1 && col2) {
            if (isNaN(parseFloat(col2))) {
              errors.push(`Row ${index + 1}: Second column must be a number`);
            } else {
              validRows++;
            }
          }
        }
      });

      return {
        valid: validRows >= 2 && errors.length === 0,
        errors,
        validRowCount: validRows,
        totalRowCount: formRows.length,
      };
    }
  }

  /**
   * Form Data Processor
   * Handles form data collection and processing
   */
  class FormDataProcessor {
    /**
     * Extract data from form rows
     * @param {NodeList} formRows - Form row elements
     * @param {Object} columnHeaders - Column header values
     * @returns {Object} Processed form data
     */
    extractFormData(formRows, columnHeaders) {
      const { col1Name = "Category", col2Name = "Value" } = columnHeaders;
      const headers = [col1Name, col2Name];
      const rows = [];

      formRows.forEach((row) => {
        const inputs = row.querySelectorAll("input");
        if (inputs.length >= 2) {
          const col1 = inputs[0].value.trim();
          const col2 = parseFloat(inputs[1].value);

          if (col1 && !isNaN(col2)) {
            rows.push([col1, col2]);
          }
        }
      });

      logDebug(
        `[Graph Builder Data] Extracted ${rows.length} form data rows from ${formRows.length} form rows`
      );

      return {
        headers,
        rows,
        metadata: {
          source: "form",
          originalRowCount: formRows.length,
          processedRowCount: rows.length,
        },
      };
    }
  }

  // Create instances
  const csvParser = new CSVParser();
  const fileHandler = new FileHandler();
  const dataValidator = new DataValidator();
  const formProcessor = new FormDataProcessor();

  // Log module initialisation
  logInfo("[Graph Builder Data] Module initialised successfully");

  // Public API
  return {
    // CSV Processing
    parseCSV: (csvText, options) => csvParser.parse(csvText, options),

    // File Processing
    processFile: (file) => fileHandler.handleFile(file),

    // Data Validation
    validateData: (data) => dataValidator.validate(data),
    validateFormData: (formRows) => dataValidator.validateFormData(formRows),

    // Form Data Processing
    extractFormData: (formRows, columnHeaders) =>
      formProcessor.extractFormData(formRows, columnHeaders),

    // Configuration
    CONFIG,

    // Logging configuration (for external control if needed)
    setLogLevel: (level) => {
      if (Object.values(LOG_LEVELS).includes(level)) {
        currentLogLevel = level;
        logInfo(`[Graph Builder Data] Log level changed to ${level}`);
      }
    },

    getLogLevel: () => currentLogLevel,

    LOG_LEVELS,

    // Utility methods
    detectFileType: (fileName) => {
      const name = fileName.toLowerCase();
      return (
        CONFIG.supportedFileTypes.find((ext) => name.endsWith(ext)) || null
      );
    },

    isValidFileSize: (size) => size <= CONFIG.maxFileSize,

    // For debugging
    _parser: csvParser,
    _validator: dataValidator,
    _fileHandler: fileHandler,
  };
})();

// Export for other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderData;
} else {
  window.GraphBuilderData = GraphBuilderData;
}
