/**
 * Chart Data Manager
 * Comprehensive data management system for chart creation
 * Handles data ingestion, validation, transformation, and Chart.js configuration generation
 *
 * Dependencies:
 * - None (standalone module)
 * - Optional: ChartStatistics, ChartTrends for advanced analysis
 *
 * @version 1.0.0
 */

const ChartDataManager = (function () {
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

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Chart Data Manager] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Data Manager] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Data Manager] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Data Manager] DEBUG: ${message}`, ...args);
    }
  }

  // Configuration and constants
  const CONFIG = {
    maxDataPoints: 10000,
    defaultDateFormat: "DD/MM/YYYY",
    numericPrecision: 2,
    csvDelimiters: [",", ";", "\t", "|"],
    supportedChartTypes: [
      "bar",
      "line",
      "pie",
      "doughnut",
      "radar",
      "polarArea",
      "scatter",
      "bubble",
      "area",
    ],
  };

  // Data type definitions
  const DataTypes = {
    NUMERIC: "numeric",
    STRING: "string",
    DATE: "date",
    BOOLEAN: "boolean",
    CATEGORY: "category",
  };

  // Chart type requirements mapping
  const ChartRequirements = {
    bar: {
      requiredFields: ["labels", "datasets"],
      dataStructure: "categorical",
      minDataPoints: 1,
      maxDatasets: 10,
    },
    line: {
      requiredFields: ["labels", "datasets"],
      dataStructure: "sequential",
      minDataPoints: 2,
      maxDatasets: 5,
    },
    pie: {
      requiredFields: ["labels", "data"],
      dataStructure: "categorical",
      minDataPoints: 2,
      maxDatasets: 1,
    },
    doughnut: {
      requiredFields: ["labels", "data"],
      dataStructure: "categorical",
      minDataPoints: 2,
      maxDatasets: 1,
    },
    radar: {
      requiredFields: ["labels", "datasets"],
      dataStructure: "multidimensional",
      minDataPoints: 3,
      maxDatasets: 3,
    },
    polarArea: {
      requiredFields: ["labels", "data"],
      dataStructure: "categorical",
      minDataPoints: 3,
      maxDatasets: 1,
    },
    scatter: {
      requiredFields: ["datasets"],
      dataStructure: "coordinate",
      minDataPoints: 2,
      maxDatasets: 5,
    },
    bubble: {
      requiredFields: ["datasets"],
      dataStructure: "coordinate",
      minDataPoints: 1,
      maxDatasets: 3,
    },
  };

  /**
   * Data Source Handler
   * Manages data ingestion from various sources
   */
  class DataSource {
    constructor() {
      this.supportedFormats = ["csv", "json", "array", "object"];
      logInfo(
        "DataSource initialised with supported formats:",
        this.supportedFormats
      );
    }

    /**
     * Parse CSV data
     * @param {string} csvText - Raw CSV text
     * @param {Object} options - Parsing options
     * @returns {Promise<Object>} Parsed data structure
     */
    async parseCSV(csvText, options = {}) {
      const {
        delimiter = this.detectDelimiter(csvText),
        hasHeader = true,
        skipEmptyLines = true,
      } = options;

      logDebug("Starting CSV parsing with options:", {
        delimiter,
        hasHeader,
        skipEmptyLines,
      });

      try {
        const lines = csvText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => (skipEmptyLines ? line.length > 0 : true));

        if (lines.length === 0) {
          logError("CSV parsing failed: empty data");
          throw new Error("CSV data is empty");
        }

        logDebug(`Processing ${lines.length} CSV lines`);

        const rows = lines.map((line) => this.parseCSVLine(line, delimiter));
        const headers = hasHeader
          ? rows.shift()
          : this.generateHeaders(rows[0].length);

        const result = {
          headers: headers.map((h) => h.trim()),
          rows: rows,
          metadata: {
            rowCount: rows.length,
            columnCount: headers.length,
            delimiter: delimiter,
          },
        };

        logInfo(
          `CSV parsed successfully: ${result.metadata.rowCount} rows, ${result.metadata.columnCount} columns`
        );
        return result;
      } catch (error) {
        logError("CSV parsing failed:", error.message);
        throw new Error(`CSV parsing failed: ${error.message}`);
      }
    }

    /**
     * Parse JSON data
     * @param {string|Object} jsonData - JSON string or object
     * @returns {Promise<Object>} Parsed data structure
     */
    async parseJSON(jsonData) {
      logDebug("Starting JSON parsing");

      try {
        const data =
          typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;

        logDebug(
          "JSON data type:",
          Array.isArray(data) ? "array" : typeof data
        );

        // Handle different JSON structures
        if (Array.isArray(data)) {
          const result = this.normaliseArrayData(data);
          logInfo(
            `JSON array parsed successfully: ${result.metadata.rowCount} rows`
          );
          return result;
        } else if (typeof data === "object") {
          const result = this.normaliseObjectData(data);
          logInfo(
            `JSON object parsed successfully: ${result.metadata.rowCount} rows`
          );
          return result;
        } else {
          logError("Invalid JSON structure: not an array or object");
          throw new Error("Invalid JSON structure");
        }
      } catch (error) {
        logError("JSON parsing failed:", error.message);
        throw new Error(`JSON parsing failed: ${error.message}`);
      }
    }

    /**
     * Parse direct array input
     * @param {Array} arrayData - Array of data
     * @param {Array} headers - Optional headers
     * @returns {Object} Normalised data structure
     */
    parseArray(arrayData, headers = null) {
      logDebug("Parsing direct array input");

      if (!Array.isArray(arrayData)) {
        logError("Parse array failed: input is not an array");
        throw new Error("Input must be an array");
      }

      const normalisedHeaders =
        headers || this.generateHeaders(arrayData[0]?.length || 0);

      const result = {
        headers: normalisedHeaders,
        rows: arrayData,
        metadata: {
          rowCount: arrayData.length,
          columnCount: normalisedHeaders.length,
        },
      };

      logInfo(
        `Array parsed successfully: ${result.metadata.rowCount} rows, ${result.metadata.columnCount} columns`
      );
      return result;
    }

    /**
     * Detect CSV delimiter
     * @param {string} csvText - CSV text sample
     * @returns {string} Detected delimiter
     */
    detectDelimiter(csvText) {
      const sample = csvText.split("\n")[0] || "";
      const counts = CONFIG.csvDelimiters.map((delimiter) => ({
        delimiter,
        count: (sample.match(new RegExp(`\\${delimiter}`, "g")) || []).length,
      }));

      const detected = counts.reduce((prev, current) =>
        current.count > prev.count ? current : prev
      ).delimiter;

      logDebug(`CSV delimiter detected: '${detected}'`);
      return detected;
    }

    /**
     * Parse a single CSV line
     * @param {string} line - CSV line
     * @param {string} delimiter - Delimiter character
     * @returns {Array} Parsed values
     */
    parseCSVLine(line, delimiter) {
      const result = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }

      result.push(current.trim());
      return result;
    }

    /**
     * Generate default headers
     * @param {number} count - Number of columns
     * @returns {Array} Generated headers
     */
    generateHeaders(count) {
      const headers = Array.from(
        { length: count },
        (_, i) => `Column ${i + 1}`
      );
      logDebug(`Generated ${count} default headers`);
      return headers;
    }

    /**
     * Normalise array data structure
     * @param {Array} data - Array data
     * @returns {Object} Normalised structure
     */
    normaliseArrayData(data) {
      if (data.length === 0) {
        logError("Normalise array data failed: empty array");
        throw new Error("Empty array data");
      }

      // Check if first row contains headers (strings vs numbers)
      const firstRow = data[0];
      const hasHeaders =
        Array.isArray(firstRow) &&
        firstRow.some((cell) => isNaN(cell) && typeof cell === "string");

      logDebug(
        `Array data analysis: hasHeaders=${hasHeaders}, firstRowLength=${firstRow.length}`
      );

      if (hasHeaders) {
        return {
          headers: data[0],
          rows: data.slice(1),
          metadata: {
            rowCount: data.length - 1,
            columnCount: data[0].length,
          },
        };
      } else {
        return {
          headers: this.generateHeaders(firstRow.length),
          rows: data,
          metadata: {
            rowCount: data.length,
            columnCount: firstRow.length,
          },
        };
      }
    }

    /**
     * Normalise object data structure
     * @param {Object} data - Object data
     * @returns {Object} Normalised structure
     */
    normaliseObjectData(data) {
      if (data.headers && data.rows) {
        logDebug("Object data already in correct format");
        return data;
      }

      // Convert object to array format
      const headers = Object.keys(data);
      const maxLength = Math.max(
        ...headers.map((key) =>
          Array.isArray(data[key]) ? data[key].length : 1
        )
      );

      logDebug(
        `Converting object data: ${headers.length} properties, maxLength=${maxLength}`
      );

      const rows = [];
      for (let i = 0; i < maxLength; i++) {
        const row = headers.map((header) => {
          const value = data[header];
          return Array.isArray(value) ? value[i] : value;
        });
        rows.push(row);
      }

      return {
        headers,
        rows,
        metadata: {
          rowCount: rows.length,
          columnCount: headers.length,
        },
      };
    }
  }

  /**
   * Data Validator
   * Validates data integrity and chart requirements
   */
  class DataValidator {
    constructor() {
      this.validationRules = new Map();
      this.setupDefaultRules();
      logInfo("DataValidator initialised with default rules");
    }

    /**
     * Set up default validation rules
     */
    setupDefaultRules() {
      this.validationRules.set("required", (value) => {
        return value !== null && value !== undefined && value !== "";
      });

      this.validationRules.set("numeric", (value) => {
        return !isNaN(parseFloat(value)) && isFinite(value);
      });

      this.validationRules.set("positive", (value) => {
        return (
          this.validationRules.get("numeric")(value) && parseFloat(value) > 0
        );
      });

      this.validationRules.set("date", (value) => {
        return !isNaN(Date.parse(value));
      });

      this.validationRules.set("minLength", (value, minLength) => {
        return value && value.toString().length >= minLength;
      });

      this.validationRules.set("maxLength", (value, maxLength) => {
        return value && value.toString().length <= maxLength;
      });

      logDebug(
        `Validation rules configured: ${this.validationRules.size} rules available`
      );
    }

    /**
     * Validate data structure for chart type
     * @param {Object} data - Data to validate
     * @param {string} chartType - Target chart type
     * @returns {Object} Validation result
     */
    validateForChartType(data, chartType) {
      logDebug(`Starting validation for chart type: ${chartType}`);

      const requirements = ChartRequirements[chartType];
      if (!requirements) {
        logError(`Unsupported chart type: ${chartType}`);
        return {
          valid: false,
          errors: [`Unsupported chart type: ${chartType}`],
        };
      }

      const errors = [];
      const warnings = [];

      // Check data structure exists
      if (!data || !data.rows || !data.headers) {
        logError("Invalid data structure: missing rows or headers");
        errors.push("Invalid data structure: missing rows or headers");
        return { valid: false, errors, warnings };
      }

      logDebug(
        `Validating ${data.rows.length} rows against requirements: minDataPoints=${requirements.minDataPoints}`
      );

      // Check minimum data points
      if (data.rows.length < requirements.minDataPoints) {
        const error = `Insufficient data points: need at least ${requirements.minDataPoints}, got ${data.rows.length}`;
        logWarn(error);
        errors.push(error);
      }

      // Check maximum data points
      if (data.rows.length > CONFIG.maxDataPoints) {
        const warning = `Large dataset: ${data.rows.length} points may affect performance`;
        logWarn(warning);
        warnings.push(warning);
      }

      // Validate data types for chart type
      const typeValidation = this.validateDataTypes(data, chartType);
      errors.push(...typeValidation.errors);
      warnings.push(...typeValidation.warnings);

      const result = {
        valid: errors.length === 0,
        errors,
        warnings,
      };

      if (result.valid) {
        logInfo(
          `Validation passed for ${chartType} chart with ${warnings.length} warnings`
        );
      } else {
        logWarn(
          `Validation failed for ${chartType} chart: ${errors.length} errors, ${warnings.length} warnings`
        );
      }

      return result;
    }

    /**
     * Validate data types for specific chart requirements
     * @param {Object} data - Data to validate
     * @param {string} chartType - Chart type
     * @returns {Object} Type validation result
     */
    validateDataTypes(data, chartType) {
      const errors = [];
      const warnings = [];

      logDebug(`Validating data types for ${chartType} chart`);

      // Chart-specific validation
      switch (chartType) {
        case "pie":
        case "doughnut":
        case "polarArea":
          // Need at least 2 columns: labels and values
          if (data.headers.length < 2) {
            const error =
              "Pie charts require at least 2 columns: labels and values";
            logWarn(error);
            errors.push(error);
          }

          // Check if values are numeric
          const valueColumn = data.rows.map((row) => row[1]);
          const nonNumeric = valueColumn.filter(
            (val) => !this.validationRules.get("numeric")(val)
          );
          if (nonNumeric.length > 0) {
            const error = `Non-numeric values found in data column: ${nonNumeric
              .slice(0, 3)
              .join(", ")}${nonNumeric.length > 3 ? "..." : ""}`;
            logWarn(error);
            errors.push(error);
          }
          break;

        case "scatter":
        case "bubble":
          // Need numeric data for coordinates
          if (data.headers.length < 2) {
            const error = `${chartType} charts require at least 2 numeric columns`;
            logWarn(error);
            errors.push(error);
          }

          // Validate numeric columns
          for (let col = 0; col < Math.min(data.headers.length, 2); col++) {
            const columnData = data.rows.map((row) => row[col]);
            const nonNumeric = columnData.filter(
              (val) => !this.validationRules.get("numeric")(val)
            );
            if (nonNumeric.length > 0) {
              const error = `Non-numeric values in column ${
                col + 1
              }: ${nonNumeric.slice(0, 3).join(", ")}`;
              logWarn(error);
              errors.push(error);
            }
          }
          break;

        case "bar":
        case "line":
          // First column can be categories/labels, others should be numeric
          for (let col = 1; col < data.headers.length; col++) {
            const columnData = data.rows.map((row) => row[col]);
            const nonNumeric = columnData.filter(
              (val) => !this.validationRules.get("numeric")(val)
            );
            if (nonNumeric.length > 0) {
              const warning = `Some non-numeric values in column ${
                col + 1
              }: ${nonNumeric.slice(0, 3).join(", ")}`;
              logDebug(warning);
              warnings.push(warning);
            }
          }
          break;
      }

      return { errors, warnings };
    }

    /**
     * Validate individual data cell
     * @param {*} value - Value to validate
     * @param {string} type - Expected data type
     * @param {Object} rules - Validation rules
     * @returns {Object} Validation result
     */
    validateCell(value, type, rules = {}) {
      const errors = [];

      // Check required
      if (rules.required && !this.validationRules.get("required")(value)) {
        errors.push("Value is required");
      }

      // Type-specific validation
      switch (type) {
        case DataTypes.NUMERIC:
          if (value !== "" && !this.validationRules.get("numeric")(value)) {
            errors.push("Value must be numeric");
          }
          break;

        case DataTypes.DATE:
          if (value !== "" && !this.validationRules.get("date")(value)) {
            errors.push("Value must be a valid date");
          }
          break;
      }

      // Additional rule validation
      Object.entries(rules).forEach(([rule, param]) => {
        if (rule !== "required" && this.validationRules.has(rule)) {
          if (!this.validationRules.get(rule)(value, param)) {
            errors.push(`Validation failed: ${rule}`);
          }
        }
      });

      return {
        valid: errors.length === 0,
        errors,
      };
    }
  }

  /**
   * Data Transformer
   * Transforms data between different formats and structures
   */
  class DataTransformer {
    constructor() {
      this.transformers = new Map();
      this.setupDefaultTransformers();
      logInfo("DataTransformer initialised with default transformers");
    }

    /**
     * Set up default data transformers
     */
    setupDefaultTransformers() {
      // Numeric transformation
      this.transformers.set("toNumeric", (value) => {
        if (value === "" || value === null || value === undefined) return null;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      });

      // String transformation
      this.transformers.set("toString", (value) => {
        return value === null || value === undefined ? "" : String(value);
      });

      // Date transformation
      this.transformers.set("toDate", (value) => {
        if (!value) return null;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      });

      // Category transformation
      this.transformers.set("toCategory", (value) => {
        return this.transformers.get("toString")(value).trim();
      });

      logDebug(
        `Data transformers configured: ${this.transformers.size} transformers available`
      );
    }

    /**
     * Transform data for specific chart type
     * @param {Object} data - Raw data
     * @param {string} chartType - Target chart type
     * @param {Object} options - Transformation options
     * @returns {Object} Transformed data
     */
    transformForChartType(data, chartType, options = {}) {
      const {
        labelColumn = 0,
        valueColumns = null,
        aggregateFunction = "sum",
      } = options;

      logDebug(`Starting data transformation for ${chartType} chart`);
      logDebug(`Transform options:`, {
        labelColumn,
        valueColumns,
        aggregateFunction,
      });

      switch (chartType) {
        case "pie":
        case "doughnut":
        case "polarArea":
          const pieResult = this.transformToPieData(
            data,
            labelColumn,
            valueColumns?.[0] || 1
          );
          logInfo(
            `Pie data transformation complete: ${pieResult.labels.length} segments`
          );
          return pieResult;

        case "bar":
        case "line":
          const categoricalResult = this.transformToCategoricalData(
            data,
            labelColumn,
            valueColumns
          );
          logInfo(
            `Categorical data transformation complete: ${categoricalResult.datasets.length} datasets`
          );
          return categoricalResult;

        case "scatter":
          const scatterResult = this.transformToScatterData(data, options);
          logInfo(
            `Scatter data transformation complete: ${scatterResult.datasets.length} datasets`
          );
          return scatterResult;

        case "bubble":
          const bubbleResult = this.transformToBubbleData(data, options);
          logInfo(
            `Bubble data transformation complete: ${bubbleResult.datasets.length} datasets`
          );
          return bubbleResult;

        case "radar":
          const radarResult = this.transformToRadarData(
            data,
            labelColumn,
            valueColumns
          );
          logInfo(
            `Radar data transformation complete: ${radarResult.datasets.length} datasets`
          );
          return radarResult;

        default:
          logError(`Unsupported chart type for transformation: ${chartType}`);
          throw new Error(`Unsupported chart type: ${chartType}`);
      }
    }

    /**
     * Transform to pie chart data format
     * @param {Object} data - Raw data
     * @param {number} labelColumn - Column index for labels
     * @param {number} valueColumn - Column index for values
     * @returns {Object} Pie chart data
     */
    transformToPieData(data, labelColumn, valueColumn) {
      logDebug(
        `Transforming to pie data: labelColumn=${labelColumn}, valueColumn=${valueColumn}`
      );

      const labels = [];
      const values = [];

      data.rows.forEach((row) => {
        const label = this.transformers.get("toCategory")(row[labelColumn]);
        const value = this.transformers.get("toNumeric")(row[valueColumn]);

        if (label && value !== null && value >= 0) {
          labels.push(label);
          values.push(value);
        }
      });

      logDebug(`Pie transformation result: ${labels.length} valid data points`);

      return {
        labels,
        datasets: [
          {
            data: values,
            label: data.headers[valueColumn] || "Values",
          },
        ],
        metadata: {
          chartType: "pie",
          labelColumn: data.headers[labelColumn],
          valueColumn: data.headers[valueColumn],
          totalValue: values.reduce((sum, val) => sum + val, 0),
        },
      };
    }

    /**
     * Transform to categorical data format (bar/line charts)
     * @param {Object} data - Raw data
     * @param {number} labelColumn - Column index for labels
     * @param {Array} valueColumns - Column indices for values
     * @returns {Object} Categorical chart data
     */
    transformToCategoricalData(data, labelColumn, valueColumns) {
      logDebug(`Transforming to categorical data: labelColumn=${labelColumn}`);

      const labels = [];
      const datasets = [];

      // Determine value columns if not specified
      const actualValueColumns =
        valueColumns ||
        data.headers.map((_, i) => i).filter((i) => i !== labelColumn);

      logDebug(`Using value columns: ${actualValueColumns}`);

      // Extract labels
      data.rows.forEach((row) => {
        const label = this.transformers.get("toCategory")(row[labelColumn]);
        if (label) {
          labels.push(label);
        }
      });

      // Extract datasets
      actualValueColumns.forEach((colIndex) => {
        const values = [];

        data.rows.forEach((row) => {
          const value = this.transformers.get("toNumeric")(row[colIndex]);
          values.push(value !== null ? value : 0);
        });

        datasets.push({
          label: data.headers[colIndex] || `Dataset ${colIndex + 1}`,
          data: values,
        });
      });

      logDebug(
        `Categorical transformation result: ${labels.length} labels, ${datasets.length} datasets`
      );

      return {
        labels,
        datasets,
        metadata: {
          chartType: "categorical",
          labelColumn: data.headers[labelColumn],
          valueColumns: actualValueColumns.map((i) => data.headers[i]),
        },
      };
    }

    /**
     * Transform to scatter chart data format
     * @param {Object} data - Raw data
     * @param {Object} options - Transformation options
     * @returns {Object} Scatter chart data
     */
    transformToScatterData(data, options) {
      const { xColumn = 0, yColumn = 1, groupColumn = null } = options;

      logDebug(
        `Transforming to scatter data: xColumn=${xColumn}, yColumn=${yColumn}, groupColumn=${groupColumn}`
      );

      if (groupColumn !== null) {
        // Group by category
        const groups = new Map();

        data.rows.forEach((row) => {
          const group = this.transformers.get("toCategory")(row[groupColumn]);
          const x = this.transformers.get("toNumeric")(row[xColumn]);
          const y = this.transformers.get("toNumeric")(row[yColumn]);

          if (x !== null && y !== null) {
            if (!groups.has(group)) {
              groups.set(group, []);
            }
            groups.get(group).push({ x, y });
          }
        });

        const datasets = Array.from(groups.entries()).map(
          ([group, points]) => ({
            label: group,
            data: points,
          })
        );

        logDebug(`Scatter transformation result: ${datasets.length} groups`);

        return {
          datasets,
          metadata: {
            chartType: "scatter",
            xColumn: data.headers[xColumn],
            yColumn: data.headers[yColumn],
            groupColumn: data.headers[groupColumn],
          },
        };
      } else {
        // Single dataset
        const points = [];

        data.rows.forEach((row) => {
          const x = this.transformers.get("toNumeric")(row[xColumn]);
          const y = this.transformers.get("toNumeric")(row[yColumn]);

          if (x !== null && y !== null) {
            points.push({ x, y });
          }
        });

        logDebug(`Scatter transformation result: ${points.length} points`);

        return {
          datasets: [
            {
              label: "Data Points",
              data: points,
            },
          ],
          metadata: {
            chartType: "scatter",
            xColumn: data.headers[xColumn],
            yColumn: data.headers[yColumn],
          },
        };
      }
    }

    /**
     * Transform to bubble chart data format
     * @param {Object} data - Raw data
     * @param {Object} options - Transformation options
     * @returns {Object} Bubble chart data
     */
    transformToBubbleData(data, options) {
      const {
        xColumn = 0,
        yColumn = 1,
        sizeColumn = 2,
        groupColumn = null,
      } = options;

      logDebug(
        `Transforming to bubble data: xColumn=${xColumn}, yColumn=${yColumn}, sizeColumn=${sizeColumn}`
      );

      const transformPoint = (row) => {
        const x = this.transformers.get("toNumeric")(row[xColumn]);
        const y = this.transformers.get("toNumeric")(row[yColumn]);
        const r = this.transformers.get("toNumeric")(row[sizeColumn]);

        return x !== null && y !== null && r !== null ? { x, y, r } : null;
      };

      if (groupColumn !== null) {
        // Group by category
        const groups = new Map();

        data.rows.forEach((row) => {
          const group = this.transformers.get("toCategory")(row[groupColumn]);
          const point = transformPoint(row);

          if (point) {
            if (!groups.has(group)) {
              groups.set(group, []);
            }
            groups.get(group).push(point);
          }
        });

        const datasets = Array.from(groups.entries()).map(
          ([group, points]) => ({
            label: group,
            data: points,
          })
        );

        logDebug(`Bubble transformation result: ${datasets.length} groups`);

        return {
          datasets,
          metadata: {
            chartType: "bubble",
            xColumn: data.headers[xColumn],
            yColumn: data.headers[yColumn],
            sizeColumn: data.headers[sizeColumn],
            groupColumn: data.headers[groupColumn],
          },
        };
      } else {
        // Single dataset
        const points = data.rows
          .map(transformPoint)
          .filter((point) => point !== null);

        logDebug(`Bubble transformation result: ${points.length} points`);

        return {
          datasets: [
            {
              label: "Bubbles",
              data: points,
            },
          ],
          metadata: {
            chartType: "bubble",
            xColumn: data.headers[xColumn],
            yColumn: data.headers[yColumn],
            sizeColumn: data.headers[sizeColumn],
          },
        };
      }
    }

    /**
     * Transform to radar chart data format
     * @param {Object} data - Raw data
     * @param {number} labelColumn - Column index for labels
     * @param {Array} valueColumns - Column indices for values
     * @returns {Object} Radar chart data
     */
    transformToRadarData(data, labelColumn, valueColumns) {
      logDebug(`Transforming to radar data: labelColumn=${labelColumn}`);

      // For radar charts, we typically want categories as labels
      // and multiple data series as datasets
      const labels = [];
      const datasets = [];

      // Get unique labels (categories)
      const uniqueLabels = [
        ...new Set(
          data.rows.map((row) =>
            this.transformers.get("toCategory")(row[labelColumn])
          )
        ),
      ];

      // Determine value columns
      const actualValueColumns =
        valueColumns ||
        data.headers.map((_, i) => i).filter((i) => i !== labelColumn);

      logDebug(
        `Radar using ${uniqueLabels.length} labels and ${actualValueColumns.length} value columns`
      );

      // For each value column, create a dataset
      actualValueColumns.forEach((colIndex) => {
        const values = [];

        uniqueLabels.forEach((label) => {
          // Find the row with this label
          const row = data.rows.find(
            (r) => this.transformers.get("toCategory")(r[labelColumn]) === label
          );

          if (row) {
            const value = this.transformers.get("toNumeric")(row[colIndex]);
            values.push(value !== null ? value : 0);
          } else {
            values.push(0);
          }
        });

        datasets.push({
          label: data.headers[colIndex] || `Series ${colIndex + 1}`,
          data: values,
        });
      });

      return {
        labels: uniqueLabels,
        datasets,
        metadata: {
          chartType: "radar",
          labelColumn: data.headers[labelColumn],
          valueColumns: actualValueColumns.map((i) => data.headers[i]),
        },
      };
    }

    /**
     * Clean and normalise data
     * @param {Object} data - Raw data
     * @param {Object} options - Cleaning options
     * @returns {Object} Cleaned data
     */
    cleanData(data, options = {}) {
      const {
        removeEmptyRows = true,
        trimStrings = true,
        handleMissingValues = "remove",
        convertTypes = true,
      } = options;

      logDebug("Starting data cleaning with options:", options);

      let cleanedRows = [...data.rows];

      // Remove empty rows
      if (removeEmptyRows) {
        const originalCount = cleanedRows.length;
        cleanedRows = cleanedRows.filter((row) =>
          row.some((cell) => cell !== null && cell !== undefined && cell !== "")
        );
        logDebug(`Removed ${originalCount - cleanedRows.length} empty rows`);
      }

      // Process each cell
      cleanedRows = cleanedRows.map((row) =>
        row.map((cell) => {
          let cleanedCell = cell;

          // Trim strings
          if (trimStrings && typeof cleanedCell === "string") {
            cleanedCell = cleanedCell.trim();
          }

          // Handle missing values
          if (
            cleanedCell === "" ||
            cleanedCell === null ||
            cleanedCell === undefined
          ) {
            switch (handleMissingValues) {
              case "remove":
                return null;
              case "zero":
                return 0;
              case "mean":
                // This would require additional processing
                return null;
              default:
                return cleanedCell;
            }
          }

          return cleanedCell;
        })
      );

      const result = {
        ...data,
        rows: cleanedRows,
        metadata: {
          ...data.metadata,
          cleaningApplied: true,
          originalRowCount: data.rows.length,
          cleanedRowCount: cleanedRows.length,
        },
      };

      logInfo(
        `Data cleaning complete: ${data.rows.length} → ${cleanedRows.length} rows`
      );
      return result;
    }
  }

  /**
   * Chart Data Model
   * Core data structure for managing chart data
   */
  class ChartDataModel {
    constructor(rawData, chartType) {
      this.rawData = rawData;
      this.chartType = chartType;
      this.transformedData = null;
      this.validationResult = null;
      this.metadata = {
        created: new Date(),
        lastModified: new Date(),
        version: "1.0.0",
      };

      logInfo(
        `ChartDataModel created for ${chartType} chart with ${rawData.rows.length} rows`
      );
    }

    /**
     * Get chart configuration for Chart.js
     * @returns {Object} Chart.js configuration
     */
    getChartConfig() {
      if (!this.transformedData) {
        logError("Cannot generate chart config: data not transformed");
        throw new Error(
          "Data must be transformed before generating chart config"
        );
      }

      logDebug(`Generating chart config for ${this.chartType}`);

      const baseConfig = {
        type: this.chartType,
        data: this.transformedData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: false,
            },
            legend: {
              display: true,
              position: "top",
            },
          },
        },
      };

      // Add chart-specific options
      switch (this.chartType) {
        case "pie":
        case "doughnut":
          baseConfig.options.plugins.legend.position = "right";
          break;

        case "scatter":
        case "bubble":
          baseConfig.options.scales = {
            x: {
              type: "linear",
              position: "bottom",
              title: {
                display: true,
                text: this.transformedData.metadata?.xColumn || "X Axis",
              },
            },
            y: {
              title: {
                display: true,
                text: this.transformedData.metadata?.yColumn || "Y Axis",
              },
            },
          };
          break;

        case "radar":
          baseConfig.options.scales = {
            r: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Values",
              },
            },
          };
          break;

        default:
          baseConfig.options.scales = {
            x: {
              title: {
                display: true,
                text:
                  this.transformedData.metadata?.labelColumn || "Categories",
              },
            },
            y: {
              title: {
                display: true,
                text: "Values",
              },
            },
          };
      }

      logDebug("Chart config generated successfully");
      return baseConfig;
    }

    /**
     * Update chart data
     * @param {Object} newData - New data
     */
    updateData(newData) {
      logInfo(`Updating chart data model: ${newData.rows.length} rows`);
      this.rawData = newData;
      this.transformedData = null;
      this.validationResult = null;
      this.metadata.lastModified = new Date();
    }

    /**
     * Get data summary
     * @returns {Object} Data summary
     */
    getSummary() {
      return {
        chartType: this.chartType,
        dataPoints: this.rawData?.rows?.length || 0,
        columns: this.rawData?.headers?.length || 0,
        isValid: this.validationResult?.valid || false,
        lastModified: this.metadata.lastModified,
      };
    }
  }

  /**
   * Chart Configuration Generator
   * Generates Chart.js configurations with accessibility features
   */
  class ChartConfigGenerator {
    constructor() {
      this.defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: false,
          },
          legend: {
            display: true,
            position: "top",
          },
        },
      };

      logInfo("ChartConfigGenerator initialised with default options");
    }

    /**
     * Generate complete Chart.js configuration
     * @param {ChartDataModel} dataModel - Chart data model
     * @param {Object} customOptions - Custom options
     * @returns {Object} Complete Chart.js configuration
     */
    generateConfig(dataModel, customOptions = {}) {
      logDebug("Generating complete Chart.js configuration");

      const baseConfig = dataModel.getChartConfig();

      // Merge with custom options
      const mergedConfig = this.deepMerge(baseConfig, customOptions);

      // Add accessibility features
      this.addAccessibilityFeatures(mergedConfig, dataModel);

      logInfo(`Chart configuration generated for ${dataModel.chartType} chart`);
      return mergedConfig;
    }

    /**
     * Add accessibility features to chart configuration
     * @param {Object} config - Chart configuration
     * @param {ChartDataModel} dataModel - Chart data model
     */
    addAccessibilityFeatures(config, dataModel) {
      logDebug("Adding accessibility features to chart configuration");

      // Add ARIA labels
      if (!config.options.plugins) {
        config.options.plugins = {};
      }

      // Add title for screen readers
      if (!config.options.plugins.title) {
        config.options.plugins.title = {
          display: false,
          text: `${dataModel.chartType} chart with ${dataModel.rawData.rows.length} data points`,
        };
      }

      // Add dataset labels if missing
      if (config.data.datasets) {
        config.data.datasets.forEach((dataset, index) => {
          if (!dataset.label) {
            dataset.label = `Dataset ${index + 1}`;
          }
        });
      }
    }

    /**
     * Deep merge objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    deepMerge(target, source) {
      const result = { ...target };

      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (
            typeof source[key] === "object" &&
            source[key] !== null &&
            !Array.isArray(source[key])
          ) {
            result[key] = this.deepMerge(result[key] || {}, source[key]);
          } else {
            result[key] = source[key];
          }
        }
      }

      return result;
    }
  }

  /**
   * Main Chart Data Manager
   * Coordinates all data operations
   */
  class ChartDataManager {
    constructor() {
      this.dataSource = new DataSource();
      this.validator = new DataValidator();
      this.transformer = new DataTransformer();
      this.configGenerator = new ChartConfigGenerator();
      this.models = new Map();

      logInfo("ChartDataManager core system initialised");
    }

    /**
     * Create new chart data model from various sources
     * @param {*} source - Data source (CSV string, JSON, Array, etc.)
     * @param {string} chartType - Chart type
     * @param {Object} options - Processing options
     * @returns {Promise<ChartDataModel>} Chart data model
     */
    async createChartData(source, chartType, options = {}) {
      logInfo(`Creating chart data for ${chartType} chart`);
      logDebug("Chart creation options:", options);

      try {
        // Parse data based on source type
        let parsedData;

        if (typeof source === "string") {
          if (source.includes(",") || source.includes("\n")) {
            // Assume CSV
            logDebug("Source identified as CSV data");
            parsedData = await this.dataSource.parseCSV(source, options.csv);
          } else {
            // Assume JSON
            logDebug("Source identified as JSON string");
            parsedData = await this.dataSource.parseJSON(source);
          }
        } else if (Array.isArray(source)) {
          logDebug("Source identified as array data");
          parsedData = this.dataSource.parseArray(source, options.headers);
        } else if (typeof source === "object") {
          logDebug("Source identified as object data");
          parsedData = await this.dataSource.parseJSON(source);
        } else {
          logError(`Unsupported data source type: ${typeof source}`);
          throw new Error("Unsupported data source type");
        }

        // Clean data
        if (options.clean !== false) {
          logDebug("Applying data cleaning");
          parsedData = this.transformer.cleanData(parsedData, options.cleaning);
        }

        // Create data model
        const model = new ChartDataModel(parsedData, chartType);

        // Validate data
        logDebug("Starting data validation");
        model.validationResult = this.validator.validateForChartType(
          parsedData,
          chartType
        );

        if (!model.validationResult.valid) {
          logError(
            `Data validation failed: ${model.validationResult.errors.join(
              ", "
            )}`
          );
          throw new Error(
            `Data validation failed: ${model.validationResult.errors.join(
              ", "
            )}`
          );
        }

        // Transform data
        logDebug("Starting data transformation");
        model.transformedData = this.transformer.transformForChartType(
          parsedData,
          chartType,
          options.transform
        );

        // Generate unique ID and store
        const modelId = this.generateModelId();
        this.models.set(modelId, model);

        logInfo(`Chart data created successfully with ID: ${modelId}`);
        return { model, modelId };
      } catch (error) {
        logError(`Failed to create chart data: ${error.message}`);
        throw new Error(`Failed to create chart data: ${error.message}`);
      }
    }

    /**
     * Get chart configuration for rendering
     * @param {string} modelId - Model ID
     * @param {Object} customOptions - Custom chart options
     * @returns {Object} Chart.js configuration
     */
    getChartConfig(modelId, customOptions = {}) {
      logDebug(`Retrieving chart config for model: ${modelId}`);

      const model = this.models.get(modelId);
      if (!model) {
        logError(`Chart data model not found: ${modelId}`);
        throw new Error(`Chart data model not found: ${modelId}`);
      }

      const config = this.configGenerator.generateConfig(model, customOptions);
      logDebug("Chart configuration retrieved successfully");
      return config;
    }

    /**
     * Update existing chart data
     * @param {string} modelId - Model ID
     * @param {*} newSource - New data source
     * @param {Object} options - Update options
     * @returns {Promise<ChartDataModel>} Updated model
     */
    async updateChartData(modelId, newSource, options = {}) {
      logInfo(`Updating chart data for model: ${modelId}`);

      const model = this.models.get(modelId);
      if (!model) {
        logError(`Chart data model not found: ${modelId}`);
        throw new Error(`Chart data model not found: ${modelId}`);
      }

      // Parse new data
      let parsedData;
      if (typeof newSource === "string") {
        parsedData = await this.dataSource.parseCSV(newSource, options.csv);
      } else if (Array.isArray(newSource)) {
        parsedData = this.dataSource.parseArray(newSource, options.headers);
      } else {
        parsedData = await this.dataSource.parseJSON(newSource);
      }

      // Update model
      model.updateData(parsedData);

      // Re-validate and transform
      model.validationResult = this.validator.validateForChartType(
        parsedData,
        model.chartType
      );

      if (!model.validationResult.valid) {
        logError(
          `Data validation failed during update: ${model.validationResult.errors.join(
            ", "
          )}`
        );
        throw new Error(
          `Data validation failed: ${model.validationResult.errors.join(", ")}`
        );
      }

      model.transformedData = this.transformer.transformForChartType(
        parsedData,
        model.chartType,
        options.transform
      );

      logInfo(`Chart data updated successfully for model: ${modelId}`);
      return model;
    }

    /**
     * Get data model
     * @param {string} modelId - Model ID
     * @returns {ChartDataModel} Data model
     */
    getModel(modelId) {
      const model = this.models.get(modelId);
      if (model) {
        logDebug(`Retrieved model: ${modelId}`);
      } else {
        logWarn(`Model not found: ${modelId}`);
      }
      return model;
    }

    /**
     * Remove data model
     * @param {string} modelId - Model ID
     * @returns {boolean} Success status
     */
    removeModel(modelId) {
      const success = this.models.delete(modelId);
      if (success) {
        logInfo(`Model removed: ${modelId}`);
      } else {
        logWarn(`Failed to remove model (not found): ${modelId}`);
      }
      return success;
    }

    /**
     * List all models
     * @returns {Array} Model summaries
     */
    listModels() {
      const models = Array.from(this.models.entries()).map(([id, model]) => ({
        id,
        ...model.getSummary(),
      }));

      logDebug(`Listed ${models.length} models`);
      return models;
    }

    /**
     * Generate unique model ID
     * @returns {string} Unique ID
     */
    generateModelId() {
      return (
        "chart-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9)
      );
    }
  }

  // Create singleton instance
  const instance = new ChartDataManager();

  // Log successful initialisation
  logInfo("Chart Data Manager module loaded successfully");

  // Public API
  return {
    // Main interface
    createChartData: instance.createChartData.bind(instance),
    getChartConfig: instance.getChartConfig.bind(instance),
    updateChartData: instance.updateChartData.bind(instance),
    getModel: instance.getModel.bind(instance),
    removeModel: instance.removeModel.bind(instance),
    listModels: instance.listModels.bind(instance),

    // Utility classes (for advanced usage)
    DataSource,
    DataValidator,
    DataTransformer,
    ChartDataModel,
    ChartConfigGenerator,

    // Constants
    CONFIG,
    DataTypes,
    ChartRequirements,
  };
})();

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = ChartDataManager;
} else {
  window.ChartDataManager = ChartDataManager;
}
