/**
 * Chart Template Library
 * Comprehensive template management system for educational chart creation
 * Provides pre-built templates, validation, and import/export capabilities
 *
 * Dependencies:
 * - chart-data-manager.js (required)
 * - chart-builder-state.js (required)
 * - Chart.js (required)
 *
 * @version 1.0.0
 */

const ChartTemplateLibrary = (function () {
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

  // Override flags
  if (ENABLE_ALL_LOGGING) {
    currentLogLevel = LOG_LEVELS.DEBUG;
  } else if (DISABLE_ALL_LOGGING) {
    currentLogLevel = -1; // Disable all logging
  }

  /**
   * Helper function to check if logging should occur
   * @param {number} level - Log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {*} details - Additional details
   */
  function logError(message, details = null) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      if (details) {
        console.error(message, details);
      } else {
        console.error(message);
      }
    }
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {*} details - Additional details
   */
  function logWarn(message, details = null) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      if (details) {
        console.warn(message, details);
      } else {
        console.warn(message);
      }
    }
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {*} details - Additional details
   */
  function logInfo(message, details = null) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      if (details) {
        console.log(message, details);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {*} details - Additional details
   */
  function logDebug(message, details = null) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      if (details) {
        console.log(message, details);
      } else {
        console.log(message);
      }
    }
  }

  // Configuration
  const CONFIG = {
    storageKey: "chart-template-library",
    userTemplatesKey: "user-chart-templates",
    maxTemplateSize: 50000, // 50KB max per template
    maxUserTemplates: 100,
    supportedVersion: "1.0.0",
    exportFormat: "json",
  };

  // Template categories and subcategories
  const Categories = {
    MATHEMATICS: {
      name: "Mathematics",
      subcategories: {
        STATISTICS: "Statistics",
        ALGEBRA: "Algebra",
        GEOMETRY: "Geometry",
        PROBABILITY: "Probability",
        CALCULUS: "Calculus",
      },
    },
    SCIENCE: {
      name: "Science",
      subcategories: {
        PHYSICS: "Physics",
        CHEMISTRY: "Chemistry",
        BIOLOGY: "Biology",
        EARTH_SCIENCE: "Earth Science",
        EXPERIMENTS: "Experiments",
      },
    },
    BUSINESS: {
      name: "Business Studies",
      subcategories: {
        FINANCE: "Finance",
        MARKETING: "Marketing",
        OPERATIONS: "Operations",
        ECONOMICS: "Economics",
        PERFORMANCE: "Performance",
      },
    },
    GEOGRAPHY: {
      name: "Geography",
      subcategories: {
        PHYSICAL: "Physical Geography",
        HUMAN: "Human Geography",
        CLIMATE: "Climate",
        RESOURCES: "Resources",
        DEMOGRAPHICS: "Demographics",
      },
    },
    HISTORY: {
      name: "History",
      subcategories: {
        DEMOGRAPHICS: "Demographics",
        ECONOMICS: "Economic History",
        SOCIAL: "Social History",
        POLITICAL: "Political History",
        TIMELINES: "Timelines",
      },
    },
    GENERAL: {
      name: "General",
      subcategories: {
        BASIC: "Basic Charts",
        SURVEYS: "Surveys",
        COMPARISONS: "Comparisons",
        TRENDS: "Trends",
        DISTRIBUTIONS: "Distributions",
      },
    },
  };

  // Education levels
  const EducationLevels = {
    PRIMARY: "Primary (Ages 5-11)",
    SECONDARY_LOWER: "Secondary Lower (Ages 11-14)",
    SECONDARY_UPPER: "Secondary Upper (Ages 14-16)",
    SIXTH_FORM: "Sixth Form (Ages 16-18)",
    HIGHER_EDUCATION: "Higher Education (18+)",
    ALL_LEVELS: "All Levels",
  };

  /**
   * Template Validator
   * Validates template structure and data compatibility
   */
  class TemplateValidator {
    constructor() {
      this.requiredFields = [
        "id",
        "name",
        "category",
        "chartType",
        "chartConfig",
        "dataRequirements",
        "version",
      ];
    }

    /**
     * Validate template structure
     * @param {Object} template - Template to validate
     * @returns {Object} Validation result
     */
    validateTemplate(template) {
      const errors = [];
      const warnings = [];

      logDebug(
        "[Chart Template Library] Validating template structure",
        template.id
      );

      // Check required fields
      this.requiredFields.forEach((field) => {
        if (!template[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      });

      // Validate ID format
      if (template.id && !/^[a-z0-9-_]+$/.test(template.id)) {
        errors.push(
          "Template ID must contain only lowercase letters, numbers, hyphens, and underscores"
        );
      }

      // Validate chart type
      if (
        template.chartType &&
        !CONFIG.supportedChartTypes?.includes(template.chartType)
      ) {
        const supportedTypes = [
          "bar",
          "line",
          "pie",
          "doughnut",
          "radar",
          "polarArea",
          "scatter",
          "bubble",
        ];
        if (!supportedTypes.includes(template.chartType)) {
          errors.push(`Unsupported chart type: ${template.chartType}`);
        }
      }

      // Validate chart configuration
      if (template.chartConfig) {
        const configValidation = this.validateChartConfig(
          template.chartConfig,
          template.chartType
        );
        errors.push(...configValidation.errors);
        warnings.push(...configValidation.warnings);
      }

      // Validate data requirements
      if (template.dataRequirements) {
        const dataValidation = this.validateDataRequirements(
          template.dataRequirements
        );
        errors.push(...dataValidation.errors);
        warnings.push(...dataValidation.warnings);
      }

      // Check template size
      const templateSize = JSON.stringify(template).length;
      if (templateSize > CONFIG.maxTemplateSize) {
        warnings.push(
          `Template size (${templateSize} bytes) exceeds recommended maximum (${CONFIG.maxTemplateSize} bytes)`
        );
      }

      // Validate sample data if present
      if (template.sampleData) {
        const sampleValidation = this.validateSampleData(
          template.sampleData,
          template.dataRequirements
        );
        errors.push(...sampleValidation.errors);
        warnings.push(...sampleValidation.warnings);
      }

      logDebug("[Chart Template Library] Template validation completed", {
        templateId: template.id,
        valid: errors.length === 0,
        errorCount: errors.length,
        warningCount: warnings.length,
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }

    /**
     * Validate chart configuration
     * @param {Object} config - Chart.js configuration
     * @param {string} chartType - Chart type
     * @returns {Object} Validation result
     */
    validateChartConfig(config, chartType) {
      const errors = [];
      const warnings = [];

      logDebug(
        "[Chart Template Library] Validating chart configuration",
        chartType
      );

      // Basic structure validation
      if (!config.type && !chartType) {
        errors.push("Chart type must be specified in config or template");
      }

      if (config.type && chartType && config.type !== chartType) {
        warnings.push("Chart type mismatch between config and template");
      }

      // Validate options structure
      if (config.options) {
        // Check for accessibility-friendly defaults
        if (!config.options.plugins?.title?.display) {
          warnings.push("Consider enabling chart title for accessibility");
        }

        if (
          !config.options.plugins?.legend?.display &&
          ["line", "bar", "radar", "scatter", "bubble"].includes(chartType)
        ) {
          warnings.push("Consider enabling legend for multi-series charts");
        }
      }

      return { errors, warnings };
    }

    /**
     * Validate data requirements structure
     * @param {Object} requirements - Data requirements object
     * @returns {Object} Validation result
     */
    validateDataRequirements(requirements) {
      const errors = [];
      const warnings = [];

      logDebug(
        "[Chart Template Library] Validating data requirements",
        requirements
      );

      const requiredFields = ["minColumns", "columnTypes", "minRows"];
      requiredFields.forEach((field) => {
        if (requirements[field] === undefined) {
          errors.push(`Data requirements missing field: ${field}`);
        }
      });

      // Validate column types
      if (requirements.columnTypes && Array.isArray(requirements.columnTypes)) {
        const validTypes = ["string", "numeric", "date", "boolean", "category"];
        requirements.columnTypes.forEach((type, index) => {
          if (!validTypes.includes(type)) {
            errors.push(`Invalid column type at index ${index}: ${type}`);
          }
        });
      }

      // Validate numeric constraints
      if (
        requirements.minColumns &&
        (requirements.minColumns < 1 || requirements.minColumns > 20)
      ) {
        warnings.push("Minimum columns should be between 1 and 20");
      }

      if (
        requirements.minRows &&
        (requirements.minRows < 1 || requirements.minRows > 1000)
      ) {
        warnings.push("Minimum rows should be between 1 and 1000");
      }

      return { errors, warnings };
    }

    /**
     * Validate sample data against requirements
     * @param {Object} sampleData - Sample data object
     * @param {Object} requirements - Data requirements
     * @returns {Object} Validation result
     */
    validateSampleData(sampleData, requirements) {
      const errors = [];
      const warnings = [];

      logDebug("[Chart Template Library] Validating sample data", {
        hasHeaders: !!sampleData.headers,
        hasRows: !!sampleData.rows,
      });

      if (!sampleData.headers || !sampleData.rows) {
        errors.push("Sample data must have headers and rows");
        return { errors, warnings };
      }

      // Check column count
      if (sampleData.headers.length < requirements.minColumns) {
        errors.push(
          `Sample data has ${sampleData.headers.length} columns, need at least ${requirements.minColumns}`
        );
      }

      // Check row count
      if (sampleData.rows.length < requirements.minRows) {
        errors.push(
          `Sample data has ${sampleData.rows.length} rows, need at least ${requirements.minRows}`
        );
      }

      return { errors, warnings };
    }

    /**
     * Validate template compatibility with user data
     * @param {Object} template - Template to validate
     * @param {Object} userData - User's data
     * @returns {Object} Compatibility result
     */
    validateTemplateWithData(template, userData) {
      const errors = [];
      const warnings = [];
      const requirements = template.dataRequirements;

      logDebug("[Chart Template Library] Validating template with user data", {
        templateId: template.id,
        hasUserData: !!userData,
      });

      if (!userData || !userData.headers || !userData.rows) {
        errors.push("Invalid user data structure");
        return { compatible: false, errors, warnings };
      }

      // Check column count
      if (userData.headers.length < requirements.minColumns) {
        errors.push(
          `Data has ${userData.headers.length} columns, template requires at least ${requirements.minColumns}`
        );
      }

      // Check row count
      if (userData.rows.length < requirements.minRows) {
        errors.push(
          `Data has ${userData.rows.length} rows, template requires at least ${requirements.minRows}`
        );
      }

      // Check column types if specified
      if (requirements.columnTypes) {
        for (
          let i = 0;
          i <
          Math.min(requirements.columnTypes.length, userData.headers.length);
          i++
        ) {
          const expectedType = requirements.columnTypes[i];
          const columnData = userData.rows.map((row) => row[i]);

          if (!this.validateColumnType(columnData, expectedType)) {
            warnings.push(
              `Column ${i + 1} (${
                userData.headers[i]
              }) may not match expected type: ${expectedType}`
            );
          }
        }
      }

      return {
        compatible: errors.length === 0,
        errors,
        warnings,
      };
    }

    /**
     * Validate column data type
     * @param {Array} columnData - Column data array
     * @param {string} expectedType - Expected data type
     * @returns {boolean} Type compatibility
     */
    validateColumnType(columnData, expectedType) {
      const sampleSize = Math.min(10, columnData.length);
      const sample = columnData.slice(0, sampleSize);

      logDebug("[Chart Template Library] Validating column type", {
        expectedType,
        sampleSize: sample.length,
      });

      switch (expectedType) {
        case "numeric":
          return sample.every(
            (val) => val === null || val === "" || !isNaN(parseFloat(val))
          );

        case "string":
        case "category":
          return sample.every(
            (val) => typeof val === "string" || val === null || val === ""
          );

        case "date":
          return sample.every(
            (val) => val === null || val === "" || !isNaN(Date.parse(val))
          );

        case "boolean":
          return sample.every(
            (val) =>
              val === null ||
              val === "" ||
              typeof val === "boolean" ||
              ["true", "false", "1", "0", "yes", "no"].includes(
                String(val).toLowerCase()
              )
          );

        default:
          return true;
      }
    }
  }

  /**
   * Template Storage
   * Manages template persistence and import/export
   */
  class TemplateStorage {
    constructor() {
      this.validator = new TemplateValidator();
      logInfo("[Chart Template Library] Template storage initialised");
    }

    /**
     * Save template to storage
     * @param {Object} template - Template to save
     * @param {boolean} isUserTemplate - Whether this is a user-created template
     * @returns {boolean} Success status
     */
    saveTemplate(template, isUserTemplate = true) {
      try {
        logDebug(
          "[Chart Template Library] Attempting to save template",
          template.id
        );

        const validation = this.validator.validateTemplate(template);
        if (!validation.valid) {
          throw new Error(
            `Template validation failed: ${validation.errors.join(", ")}`
          );
        }

        const storageKey = isUserTemplate
          ? CONFIG.userTemplatesKey
          : CONFIG.storageKey;
        const templates = this.getTemplates(isUserTemplate);

        // Check user template limit
        if (
          isUserTemplate &&
          Object.keys(templates).length >= CONFIG.maxUserTemplates
        ) {
          throw new Error(
            `Maximum number of user templates (${CONFIG.maxUserTemplates}) reached`
          );
        }

        // Add metadata
        const templateWithMetadata = {
          ...template,
          lastModified: new Date().toISOString(),
          created: template.created || new Date().toISOString(),
        };

        templates[template.id] = templateWithMetadata;
        localStorage.setItem(storageKey, JSON.stringify(templates));

        logInfo(`[Chart Template Library] Template saved: ${template.name}`);
        return true;
      } catch (error) {
        logError("[Chart Template Library] Failed to save template:", error);
        return false;
      }
    }

    /**
     * Get all templates
     * @param {boolean} userOnly - Get only user templates
     * @returns {Object} Templates object
     */
    getTemplates(userOnly = false) {
      try {
        logDebug("[Chart Template Library] Retrieving templates", { userOnly });

        if (userOnly) {
          const userTemplates = localStorage.getItem(CONFIG.userTemplatesKey);
          return userTemplates ? JSON.parse(userTemplates) : {};
        }

        // Combine built-in and user templates
        const builtInTemplates = this.getBuiltInTemplates();
        const userTemplates = localStorage.getItem(CONFIG.userTemplatesKey);
        const userTemplatesObj = userTemplates ? JSON.parse(userTemplates) : {};

        return { ...builtInTemplates, ...userTemplatesObj };
      } catch (error) {
        logError("[Chart Template Library] Failed to get templates:", error);
        return {};
      }
    }

    /**
     * Get single template
     * @param {string} templateId - Template ID
     * @returns {Object|null} Template object
     */
    getTemplate(templateId) {
      logDebug(
        "[Chart Template Library] Retrieving single template",
        templateId
      );
      const allTemplates = this.getTemplates();
      return allTemplates[templateId] || null;
    }

    /**
     * Delete template
     * @param {string} templateId - Template ID
     * @returns {boolean} Success status
     */
    deleteTemplate(templateId) {
      try {
        logDebug(
          "[Chart Template Library] Attempting to delete template",
          templateId
        );

        const userTemplates = this.getTemplates(true);

        if (!userTemplates[templateId]) {
          logWarn(
            "[Chart Template Library] Cannot delete built-in template or template not found:",
            templateId
          );
          return false;
        }

        delete userTemplates[templateId];
        localStorage.setItem(
          CONFIG.userTemplatesKey,
          JSON.stringify(userTemplates)
        );

        logInfo(`[Chart Template Library] Template deleted: ${templateId}`);
        return true;
      } catch (error) {
        logError("[Chart Template Library] Failed to delete template:", error);
        return false;
      }
    }

    /**
     * Export templates to JSON
     * @param {Array} templateIds - Template IDs to export (null for all user templates)
     * @returns {string} JSON string
     */
    exportTemplates(templateIds = null) {
      try {
        logDebug("[Chart Template Library] Exporting templates", templateIds);

        const allTemplates = this.getTemplates();
        let templatesToExport = {};

        if (templateIds === null) {
          // Export all user templates
          const userTemplates = this.getTemplates(true);
          templatesToExport = userTemplates;
        } else {
          // Export specific templates
          templateIds.forEach((id) => {
            if (allTemplates[id]) {
              templatesToExport[id] = allTemplates[id];
            }
          });
        }

        const exportData = {
          version: CONFIG.supportedVersion,
          exportDate: new Date().toISOString(),
          templateCount: Object.keys(templatesToExport).length,
          templates: templatesToExport,
        };

        logInfo("[Chart Template Library] Templates exported successfully", {
          count: Object.keys(templatesToExport).length,
        });

        return JSON.stringify(exportData, null, 2);
      } catch (error) {
        logError("[Chart Template Library] Failed to export templates:", error);
        throw error;
      }
    }

    /**
     * Import templates from JSON
     * @param {string} jsonData - JSON string containing templates
     * @param {Object} options - Import options
     * @returns {Object} Import result
     */
    importTemplates(jsonData, options = {}) {
      const {
        overwrite = false,
        validateOnly = false,
        categoryFilter = null,
      } = options;

      try {
        logDebug("[Chart Template Library] Importing templates", options);

        const importData = JSON.parse(jsonData);
        const results = {
          success: true,
          imported: 0,
          skipped: 0,
          errors: [],
          templates: [],
        };

        if (!importData.templates) {
          throw new Error("Invalid import format: missing templates");
        }

        const existingTemplates = this.getTemplates(true);

        // Process each template
        Object.entries(importData.templates).forEach(([id, template]) => {
          try {
            // Apply category filter if specified
            if (categoryFilter && template.category !== categoryFilter) {
              results.skipped++;
              return;
            }

            // Validate template
            const validation = this.validator.validateTemplate(template);
            if (!validation.valid) {
              results.errors.push(
                `Template ${id}: ${validation.errors.join(", ")}`
              );
              return;
            }

            // Check for existing template
            if (existingTemplates[id] && !overwrite) {
              results.skipped++;
              results.errors.push(
                `Template ${id} already exists (use overwrite option)`
              );
              return;
            }

            if (!validateOnly) {
              // Save template
              if (this.saveTemplate(template, true)) {
                results.imported++;
                results.templates.push(id);
              } else {
                results.errors.push(`Failed to save template ${id}`);
              }
            } else {
              results.templates.push(id);
            }
          } catch (error) {
            results.errors.push(`Template ${id}: ${error.message}`);
          }
        });

        if (results.errors.length > 0) {
          results.success = false;
        }

        logInfo(
          `[Chart Template Library] Import completed: ${results.imported} imported, ${results.skipped} skipped, ${results.errors.length} errors`
        );
        return results;
      } catch (error) {
        logError("[Chart Template Library] Failed to import templates:", error);
        return {
          success: false,
          imported: 0,
          skipped: 0,
          errors: [error.message],
          templates: [],
        };
      }
    }

    /**
     * Get built-in templates
     * @returns {Object} Built-in templates
     */
    getBuiltInTemplates() {
      logDebug("[Chart Template Library] Loading built-in templates");
      return BuiltInTemplates.getAllTemplates();
    }
  }

  /**
   * Template Preview Generator
   * Generates preview charts from templates
   */
  class TemplatePreview {
    constructor() {
      this.previewCache = new Map();
      logInfo(
        "[Chart Template Library] Template preview generator initialised"
      );
    }

    /**
     * Generate preview chart from template
     * @param {Object} template - Template object
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Preview options
     * @returns {Promise<Object>} Preview result
     */
    async generatePreview(template, container, options = {}) {
      const {
        width = 400,
        height = 300,
        useResponsive = false,
        useSampleData = true,
      } = options;

      try {
        logDebug("[Chart Template Library] Generating preview", {
          templateId: template.id,
          width,
          height,
        });

        // Validate template
        const validator = new TemplateValidator();
        const validation = validator.validateTemplate(template);

        if (!validation.valid) {
          throw new Error(
            `Template validation failed: ${validation.errors.join(", ")}`
          );
        }

        // Get data for preview
        let previewData;
        if (useSampleData && template.sampleData) {
          previewData = template.sampleData;
          logDebug("[Chart Template Library] Using template sample data");
        } else {
          previewData = this.generateSampleData(
            template.dataRequirements,
            template.chartType
          );
          logDebug("[Chart Template Library] Generated sample data");
        }

        // Create chart data model
        if (!window.ChartDataManager) {
          throw new Error(
            "ChartDataManager is required for preview generation"
          );
        }

        const { model, modelId } =
          await window.ChartDataManager.createChartData(
            previewData,
            template.chartType
          );

        // Generate chart configuration
        const baseConfig = window.ChartDataManager.getChartConfig(
          modelId,
          template.chartConfig
        );

        // Apply preview-specific options
        const previewConfig = {
          ...baseConfig,
          options: {
            ...baseConfig.options,
            responsive: useResponsive,
            maintainAspectRatio: false,
            plugins: {
              ...baseConfig.options?.plugins,
              title: {
                ...baseConfig.options?.plugins?.title,
                display: true,
                text: template.name,
              },
            },
          },
        };

        // Create canvas
        const canvas = this.createPreviewCanvas(container, width, height);

        // Render chart
        const chartInstance = new Chart(canvas.getContext("2d"), previewConfig);

        // Cleanup data model
        window.ChartDataManager.removeModel(modelId);

        logInfo(
          "[Chart Template Library] Preview generated successfully",
          template.name
        );

        return {
          success: true,
          chartInstance,
          canvas,
          template,
        };
      } catch (error) {
        logError("[Chart Template Library] Failed to generate preview:", error);
        return {
          success: false,
          error: error.message,
          template,
        };
      }
    }

    /**
     * Generate sample data based on requirements
     * @param {Object} requirements - Data requirements
     * @param {string} chartType - Chart type
     * @returns {Object} Sample data
     */
    generateSampleData(requirements, chartType) {
      logDebug("[Chart Template Library] Generating sample data", {
        chartType,
        minColumns: requirements.minColumns,
        minRows: requirements.minRows,
      });

      const headers = this.generateSampleHeaders(requirements, chartType);
      const rows = this.generateSampleRows(requirements, headers, chartType);

      return {
        headers,
        rows,
        metadata: {
          generated: true,
          chartType,
          sampleSize: rows.length,
        },
      };
    }

    /**
     * Generate sample headers
     * @param {Object} requirements - Data requirements
     * @param {string} chartType - Chart type
     * @returns {Array} Sample headers
     */
    generateSampleHeaders(requirements, chartType) {
      const columnCount = Math.max(requirements.minColumns, 2);
      const headers = [];

      logDebug("[Chart Template Library] Generating sample headers", {
        chartType,
        columnCount,
      });

      // Generate headers based on chart type
      switch (chartType) {
        case "pie":
        case "doughnut":
        case "polarArea":
          headers.push("Category", "Value");
          break;

        case "scatter":
        case "bubble":
          headers.push("X Value", "Y Value");
          if (chartType === "bubble") {
            headers.push("Size");
          }
          break;

        case "radar":
          headers.push("Metric");
          for (let i = 1; i < columnCount; i++) {
            headers.push(`Series ${i}`);
          }
          break;

        default:
          headers.push("Category");
          for (let i = 1; i < columnCount; i++) {
            headers.push(`Value ${i}`);
          }
      }

      return headers;
    }

    /**
     * Generate sample rows
     * @param {Object} requirements - Data requirements
     * @param {Array} headers - Headers array
     * @param {string} chartType - Chart type
     * @returns {Array} Sample rows
     */
    generateSampleRows(requirements, headers, chartType) {
      const rowCount = Math.max(requirements.minRows, 5);
      const rows = [];

      logDebug("[Chart Template Library] Generating sample rows", {
        chartType,
        rowCount,
        headerCount: headers.length,
      });

      for (let i = 0; i < rowCount; i++) {
        const row = [];

        headers.forEach((header, colIndex) => {
          const columnType = requirements.columnTypes?.[colIndex] || "string";

          switch (columnType) {
            case "numeric":
              row.push(Math.floor(Math.random() * 100) + 1);
              break;

            case "category":
            case "string":
              if (colIndex === 0) {
                row.push(`Category ${i + 1}`);
              } else {
                row.push(`Item ${i + 1}`);
              }
              break;

            case "date":
              const date = new Date();
              date.setDate(date.getDate() + i);
              row.push(date.toISOString().split("T")[0]);
              break;

            case "boolean":
              row.push(Math.random() > 0.5);
              break;

            default:
              row.push(`Sample ${i + 1}`);
          }
        });

        rows.push(row);
      }

      return rows;
    }

    /**
     * Create preview canvas
     * @param {HTMLElement} container - Container element
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {HTMLCanvasElement} Canvas element
     */
    createPreviewCanvas(container, width, height) {
      logDebug("[Chart Template Library] Creating preview canvas", {
        width,
        height,
      });

      // Clear container
      container.innerHTML = "";

      // Create canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Chart preview");

      // Add preview styling
      canvas.style.border = "1px solid #ddd";
      canvas.style.borderRadius = "4px";

      container.appendChild(canvas);
      return canvas;
    }
  }

  /**
   * Built-in Templates Collection
   * Provides pre-built educational chart templates
   */
  class BuiltInTemplates {
    static getAllTemplates() {
      logDebug("[Chart Template Library] Loading all built-in templates");

      return {
        // Mathematics Templates
        "math-frequency-distribution": {
          id: "math-frequency-distribution",
          name: "Frequency Distribution",
          description: "Bar chart for displaying frequency data in statistics",
          category: Categories.MATHEMATICS.name,
          subcategory: Categories.MATHEMATICS.subcategories.STATISTICS,
          chartType: "bar",
          chartConfig: {
            type: "bar",
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: "Frequency Distribution",
                },
                legend: {
                  display: false,
                },
              },
              scales: {
                x: {
                  title: {
                    display: true,
                    text: "Values",
                  },
                },
                y: {
                  title: {
                    display: true,
                    text: "Frequency",
                  },
                  beginAtZero: true,
                },
              },
            },
          },
          dataRequirements: {
            minColumns: 2,
            columnTypes: ["category", "numeric"],
            minRows: 3,
            expectedHeaders: ["Value", "Frequency"],
          },
          sampleData: {
            headers: ["Score Range", "Number of Students"],
            rows: [
              ["0-20", 2],
              ["21-40", 5],
              ["41-60", 12],
              ["61-80", 18],
              ["81-100", 8],
            ],
          },
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
            customDescriptions: {
              short:
                "Frequency distribution showing the number of occurrences for each value range",
            },
          },
          education: {
            subjectArea: "Mathematics",
            ageRange: EducationLevels.SECONDARY_UPPER,
            curriculum: ["GCSE Mathematics", "A-Level Statistics"],
            learningObjectives: [
              "Understand frequency distributions",
              "Interpret statistical data",
              "Create and read bar charts",
            ],
          },
          version: "1.0.0",
          author: "Chart Builder System",
          created: "2025-05-23",
          lastModified: "2025-05-23",
        },

        "math-function-graph": {
          id: "math-function-graph",
          name: "Mathematical Function Graph",
          description: "Line chart for plotting mathematical functions",
          category: Categories.MATHEMATICS.name,
          subcategory: Categories.MATHEMATICS.subcategories.ALGEBRA,
          chartType: "line",
          chartConfig: {
            type: "line",
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: "Mathematical Function",
                },
                legend: {
                  display: true,
                  position: "top",
                },
              },
              scales: {
                x: {
                  title: {
                    display: true,
                    text: "x",
                  },
                  type: "linear",
                },
                y: {
                  title: {
                    display: true,
                    text: "f(x)",
                  },
                },
              },
              elements: {
                point: {
                  radius: 2,
                },
              },
            },
          },
          dataRequirements: {
            minColumns: 2,
            columnTypes: ["numeric", "numeric"],
            minRows: 10,
            expectedHeaders: ["x", "y"],
          },
          sampleData: {
            headers: ["x", "y = x²"],
            rows: [
              [-5, 25],
              [-4, 16],
              [-3, 9],
              [-2, 4],
              [-1, 1],
              [0, 0],
              [1, 1],
              [2, 4],
              [3, 9],
              [4, 16],
              [5, 25],
            ],
          },
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
          },
          education: {
            subjectArea: "Mathematics",
            ageRange: EducationLevels.SECONDARY_UPPER,
            curriculum: ["GCSE Mathematics", "A-Level Mathematics"],
            learningObjectives: [
              "Plot mathematical functions",
              "Understand function behaviour",
              "Interpret graphs",
            ],
          },
          version: "1.0.0",
          author: "Chart Builder System",
          created: "2025-05-23",
          lastModified: "2025-05-23",
        },

        // Science Templates
        "science-experiment-results": {
          id: "science-experiment-results",
          name: "Experiment Results",
          description:
            "Line chart with multiple series for tracking experimental data over time",
          category: Categories.SCIENCE.name,
          subcategory: Categories.SCIENCE.subcategories.EXPERIMENTS,
          chartType: "line",
          chartConfig: {
            type: "line",
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: "Experimental Results",
                },
                legend: {
                  display: true,
                  position: "top",
                },
              },
              scales: {
                x: {
                  title: {
                    display: true,
                    text: "Time",
                  },
                },
                y: {
                  title: {
                    display: true,
                    text: "Measurement",
                  },
                },
              },
              elements: {
                line: {
                  tension: 0.1,
                },
                point: {
                  radius: 4,
                },
              },
            },
          },
          dataRequirements: {
            minColumns: 2,
            columnTypes: ["string", "numeric"],
            minRows: 5,
            expectedHeaders: ["Time", "Value"],
          },
          sampleData: {
            headers: ["Time (min)", "Temperature (°C)", "pH Level"],
            rows: [
              ["0", 20, 7.0],
              ["5", 25, 6.8],
              ["10", 32, 6.5],
              ["15", 38, 6.2],
              ["20", 42, 5.9],
              ["25", 45, 5.7],
            ],
          },
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
            includeStatistics: true,
          },
          education: {
            subjectArea: "Science",
            ageRange: EducationLevels.SECONDARY_LOWER,
            curriculum: ["Key Stage 3 Science", "GCSE Science"],
            learningObjectives: [
              "Record experimental data",
              "Identify trends in results",
              "Draw scientific conclusions",
            ],
          },
          version: "1.0.0",
          author: "Chart Builder System",
          created: "2025-05-23",
          lastModified: "2025-05-23",
        },

        "science-classification-pie": {
          id: "science-classification-pie",
          name: "Scientific Classification",
          description:
            "Pie chart for showing proportions in scientific classifications",
          category: Categories.SCIENCE.name,
          subcategory: Categories.SCIENCE.subcategories.BIOLOGY,
          chartType: "pie",
          chartConfig: {
            type: "pie",
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: "Scientific Classification",
                },
                legend: {
                  display: true,
                  position: "right",
                },
              },
            },
          },
          dataRequirements: {
            minColumns: 2,
            columnTypes: ["category", "numeric"],
            minRows: 3,
            expectedHeaders: ["Category", "Count"],
          },
          sampleData: {
            headers: ["Animal Class", "Number of Species"],
            rows: [
              ["Mammals", 42],
              ["Birds", 38],
              ["Reptiles", 15],
              ["Amphibians", 8],
              ["Fish", 25],
            ],
          },
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
          },
          education: {
            subjectArea: "Science",
            ageRange: EducationLevels.SECONDARY_LOWER,
            curriculum: ["Key Stage 3 Biology", "GCSE Biology"],
            learningObjectives: [
              "Understand classification systems",
              "Analyse proportional data",
              "Compare species diversity",
            ],
          },
          version: "1.0.0",
          author: "Chart Builder System",
          created: "2025-05-23",
          lastModified: "2025-05-23",
        },

        // Business Studies Templates
        "business-financial-performance": {
          id: "business-financial-performance",
          name: "Financial Performance",
          description:
            "Multi-series bar chart for comparing financial metrics over time",
          category: Categories.BUSINESS.name,
          subcategory: Categories.BUSINESS.subcategories.FINANCE,
          chartType: "bar",
          chartConfig: {
            type: "bar",
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: "Financial Performance Comparison",
                },
                legend: {
                  display: true,
                  position: "top",
                },
              },
              scales: {
                x: {
                  title: {
                    display: true,
                    text: "Time Period",
                  },
                },
                y: {
                  title: {
                    display: true,
                    text: "Amount (£000s)",
                  },
                  beginAtZero: true,
                },
              },
            },
          },
          dataRequirements: {
            minColumns: 3,
            columnTypes: ["category", "numeric", "numeric"],
            minRows: 4,
            expectedHeaders: ["Period", "Revenue", "Profit"],
          },
          sampleData: {
            headers: [
              "Quarter",
              "Revenue (£000)",
              "Profit (£000)",
              "Expenses (£000)",
            ],
            rows: [
              ["Q1 2023", 450, 85, 365],
              ["Q2 2023", 520, 110, 410],
              ["Q3 2023", 580, 125, 455],
              ["Q4 2023", 650, 140, 510],
            ],
          },
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
            includeStatistics: true,
          },
          education: {
            subjectArea: "Business Studies",
            ageRange: EducationLevels.SECONDARY_UPPER,
            curriculum: ["GCSE Business Studies", "A-Level Business"],
            learningObjectives: [
              "Analyse financial performance",
              "Compare revenue and costs",
              "Identify business trends",
            ],
          },
          version: "1.0.0",
          author: "Chart Builder System",
          created: "2025-05-23",
          lastModified: "2025-05-23",
        },

        "business-market-share": {
          id: "business-market-share",
          name: "Market Share Analysis",
          description:
            "Doughnut chart for displaying market share distribution",
          category: Categories.BUSINESS.name,
          subcategory: Categories.BUSINESS.subcategories.MARKETING,
          chartType: "doughnut",
          chartConfig: {
            type: "doughnut",
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: "Market Share Distribution",
                },
                legend: {
                  display: true,
                  position: "right",
                },
              },
            },
          },
          dataRequirements: {
            minColumns: 2,
            columnTypes: ["category", "numeric"],
            minRows: 3,
            expectedHeaders: ["Company", "Market Share"],
          },
          sampleData: {
            headers: ["Company", "Market Share (%)"],
            rows: [
              ["Company A", 35],
              ["Company B", 28],
              ["Company C", 20],
              ["Company D", 12],
              ["Others", 5],
            ],
          },
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
          },
          education: {
            subjectArea: "Business Studies",
            ageRange: EducationLevels.SECONDARY_UPPER,
            curriculum: ["GCSE Business Studies", "A-Level Business"],
            learningObjectives: [
              "Understand market competition",
              "Analyse market dominance",
              "Evaluate competitive position",
            ],
          },
          version: "1.0.0",
          author: "Chart Builder System",
          created: "2025-05-23",
          lastModified: "2025-05-23",
        },

        // Geography Templates
        "geography-population-growth": {
          id: "geography-population-growth",
          name: "Population Growth",
          description: "Line chart for tracking population changes over time",
          category: Categories.GEOGRAPHY.name,
          subcategory: Categories.GEOGRAPHY.subcategories.DEMOGRAPHICS,
          chartType: "line",
          chartConfig: {
            type: "line",
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: "Population Growth Over Time",
                },
                legend: {
                  display: true,
                  position: "top",
                },
              },
              scales: {
                x: {
                  title: {
                    display: true,
                    text: "Year",
                  },
                },
                y: {
                  title: {
                    display: true,
                    text: "Population (millions)",
                  },
                  beginAtZero: true,
                },
              },
            },
          },
          dataRequirements: {
            minColumns: 2,
            columnTypes: ["string", "numeric"],
            minRows: 5,
            expectedHeaders: ["Year", "Population"],
          },
          sampleData: {
            headers: [
              "Year",
              "UK Population (millions)",
              "France Population (millions)",
            ],
            rows: [
              ["1950", 50.4, 41.8],
              ["1970", 55.6, 50.8],
              ["1990", 57.2, 56.7],
              ["2010", 62.8, 64.6],
              ["2020", 67.9, 67.4],
            ],
          },
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
            includeStatistics: true,
          },
          education: {
            subjectArea: "Geography",
            ageRange: EducationLevels.SECONDARY_LOWER,
            curriculum: ["Key Stage 3 Geography", "GCSE Geography"],
            learningObjectives: [
              "Understand population dynamics",
              "Analyse demographic trends",
              "Compare population growth rates",
            ],
          },
          version: "1.0.0",
          author: "Chart Builder System",
          created: "2025-05-23",
          lastModified: "2025-05-23",
        },

        "geography-climate-data": {
          id: "geography-climate-data",
          name: "Climate Data Comparison",
          description:
            "Radar chart for comparing climate characteristics across locations",
          category: Categories.GEOGRAPHY.name,
          subcategory: Categories.GEOGRAPHY.subcategories.CLIMATE,
          chartType: "radar",
          chartConfig: {
            type: "radar",
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: "Climate Comparison",
                },
                legend: {
                  display: true,
                  position: "top",
                },
              },
              scales: {
                r: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: "Climate Index",
                  },
                },
              },
            },
          },
          dataRequirements: {
            minColumns: 2,
            columnTypes: ["category", "numeric"],
            minRows: 5,
            expectedHeaders: ["Climate Factor", "Value"],
          },
          sampleData: {
            headers: ["Climate Factor", "London", "Madrid", "Stockholm"],
            rows: [
              ["Temperature", 7, 9, 3],
              ["Rainfall", 8, 4, 6],
              ["Sunshine Hours", 5, 9, 4],
              ["Humidity", 7, 3, 6],
              ["Wind Speed", 4, 5, 6],
            ],
          },
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
          },
          education: {
            subjectArea: "Geography",
            ageRange: EducationLevels.SECONDARY_UPPER,
            curriculum: ["GCSE Geography", "A-Level Geography"],
            learningObjectives: [
              "Compare climate patterns",
              "Understand weather systems",
              "Analyse environmental data",
            ],
          },
          version: "1.0.0",
          author: "Chart Builder System",
          created: "2025-05-23",
          lastModified: "2025-05-23",
        },

        // General Templates
        "general-survey-results": {
          id: "general-survey-results",
          name: "Survey Results",
          description: "Horizontal bar chart ideal for survey response data",
          category: Categories.GENERAL.name,
          subcategory: Categories.GENERAL.subcategories.SURVEYS,
          chartType: "bar",
          chartConfig: {
            type: "bar",
            options: {
              indexAxis: "y",
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: "Survey Results",
                },
                legend: {
                  display: false,
                },
              },
              scales: {
                x: {
                  title: {
                    display: true,
                    text: "Number of Responses",
                  },
                  beginAtZero: true,
                },
                y: {
                  title: {
                    display: true,
                    text: "Response Options",
                  },
                },
              },
            },
          },
          dataRequirements: {
            minColumns: 2,
            columnTypes: ["category", "numeric"],
            minRows: 3,
            expectedHeaders: ["Option", "Count"],
          },
          sampleData: {
            headers: ["Response", "Number of People"],
            rows: [
              ["Strongly Agree", 45],
              ["Agree", 32],
              ["Neutral", 18],
              ["Disagree", 12],
              ["Strongly Disagree", 8],
            ],
          },
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
          },
          education: {
            subjectArea: "General",
            ageRange: EducationLevels.ALL_LEVELS,
            curriculum: ["General Use"],
            learningObjectives: [
              "Collect and present survey data",
              "Understand response patterns",
              "Draw conclusions from data",
            ],
          },
          version: "1.0.0",
          author: "Chart Builder System",
          created: "2025-05-23",
          lastModified: "2025-05-23",
        },

        "general-comparison-chart": {
          id: "general-comparison-chart",
          name: "Comparison Chart",
          description:
            "Grouped bar chart for comparing multiple categories across different groups",
          category: Categories.GENERAL.name,
          subcategory: Categories.GENERAL.subcategories.COMPARISONS,
          chartType: "bar",
          chartConfig: {
            type: "bar",
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: "Comparison Chart",
                },
                legend: {
                  display: true,
                  position: "top",
                },
              },
              scales: {
                x: {
                  title: {
                    display: true,
                    text: "Categories",
                  },
                },
                y: {
                  title: {
                    display: true,
                    text: "Values",
                  },
                  beginAtZero: true,
                },
              },
            },
          },
          dataRequirements: {
            minColumns: 3,
            columnTypes: ["category", "numeric", "numeric"],
            minRows: 3,
            expectedHeaders: ["Category", "Group 1", "Group 2"],
          },
          sampleData: {
            headers: [
              "Subject",
              "Class A Average",
              "Class B Average",
              "National Average",
            ],
            rows: [
              ["Mathematics", 78, 82, 75],
              ["English", 85, 79, 78],
              ["Science", 73, 77, 74],
              ["History", 81, 84, 79],
            ],
          },
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
            includeStatistics: true,
          },
          education: {
            subjectArea: "General",
            ageRange: EducationLevels.ALL_LEVELS,
            curriculum: ["General Use"],
            learningObjectives: [
              "Compare different groups",
              "Identify patterns and differences",
              "Make data-driven decisions",
            ],
          },
          version: "1.0.0",
          author: "Chart Builder System",
          created: "2025-05-23",
          lastModified: "2025-05-23",
        },
      };
    }
  }

  /**
   * Main Chart Template Library Manager
   * Coordinates all template operations
   */
  class ChartTemplateManager {
    constructor() {
      this.storage = new TemplateStorage();
      this.validator = new TemplateValidator();
      this.preview = new TemplatePreview();
      logInfo("[Chart Template Library] Manager initialised successfully");
    }

    /**
     * Get all templates with optional filtering
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered templates array
     */
    getTemplates(filters = {}) {
      const {
        category = null,
        chartType = null,
        educationLevel = null,
        searchQuery = null,
        userOnly = false,
      } = filters;

      logDebug(
        "[Chart Template Library] Getting templates with filters",
        filters
      );

      const allTemplates = this.storage.getTemplates(userOnly);
      let templates = Object.values(allTemplates);

      // Apply filters
      if (category) {
        templates = templates.filter((t) => t.category === category);
      }

      if (chartType) {
        templates = templates.filter((t) => t.chartType === chartType);
      }

      if (educationLevel) {
        templates = templates.filter(
          (t) =>
            t.education?.ageRange === educationLevel ||
            t.education?.ageRange === EducationLevels.ALL_LEVELS
        );
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        templates = templates.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query) ||
            (t.education?.learningObjectives || []).some((obj) =>
              obj.toLowerCase().includes(query)
            )
        );
      }

      logDebug("[Chart Template Library] Templates filtered", {
        totalFound: templates.length,
        originalCount: Object.keys(allTemplates).length,
      });

      return templates;
    }

    /**
     * Get single template by ID
     * @param {string} templateId - Template ID
     * @returns {Object|null} Template object
     */
    getTemplate(templateId) {
      logDebug("[Chart Template Library] Getting single template", templateId);
      return this.storage.getTemplate(templateId);
    }

    /**
     * Save template
     * @param {Object} template - Template object
     * @param {boolean} isUserTemplate - Whether this is user-created
     * @returns {boolean} Success status
     */
    saveTemplate(template, isUserTemplate = true) {
      logDebug("[Chart Template Library] Saving template", {
        templateId: template.id,
        isUserTemplate,
      });
      return this.storage.saveTemplate(template, isUserTemplate);
    }

    /**
     * Delete template
     * @param {string} templateId - Template ID
     * @returns {boolean} Success status
     */
    deleteTemplate(templateId) {
      logDebug("[Chart Template Library] Deleting template", templateId);
      return this.storage.deleteTemplate(templateId);
    }

    /**
     * Get templates by category
     * @param {string} category - Category name
     * @returns {Array} Templates in category
     */
    getCategoryTemplates(category) {
      logDebug("[Chart Template Library] Getting category templates", category);
      return this.getTemplates({ category });
    }

    /**
     * Get all categories with template counts
     * @returns {Array} Categories with counts
     */
    getCategories() {
      logDebug("[Chart Template Library] Getting all categories");
      const allTemplates = this.storage.getTemplates();
      const categoryCounts = {};

      Object.values(allTemplates).forEach((template) => {
        const category = template.category;
        if (!categoryCounts[category]) {
          categoryCounts[category] = {
            name: category,
            count: 0,
            subcategories: {},
          };
        }
        categoryCounts[category].count++;

        if (template.subcategory) {
          const subcategory = template.subcategory;
          if (!categoryCounts[category].subcategories[subcategory]) {
            categoryCounts[category].subcategories[subcategory] = 0;
          }
          categoryCounts[category].subcategories[subcategory]++;
        }
      });

      return Object.values(categoryCounts);
    }

    /**
     * Search templates
     * @param {string} query - Search query
     * @param {Object} filters - Additional filters
     * @returns {Array} Search results
     */
    searchTemplates(query, filters = {}) {
      logDebug("[Chart Template Library] Searching templates", {
        query,
        filters,
      });
      return this.getTemplates({ ...filters, searchQuery: query });
    }

    /**
     * Validate template
     * @param {Object} template - Template to validate
     * @returns {Object} Validation result
     */
    validateTemplate(template) {
      logDebug("[Chart Template Library] Validating template", template.id);
      return this.validator.validateTemplate(template);
    }

    /**
     * Validate template with user data
     * @param {string} templateId - Template ID
     * @param {Object} userData - User data
     * @returns {Object} Compatibility result
     */
    validateTemplateWithData(templateId, userData) {
      logDebug(
        "[Chart Template Library] Validating template with data",
        templateId
      );
      const template = this.getTemplate(templateId);
      if (!template) {
        return {
          compatible: false,
          errors: ["Template not found"],
          warnings: [],
        };
      }

      return this.validator.validateTemplateWithData(template, userData);
    }

    /**
     * Generate preview
     * @param {string} templateId - Template ID
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Preview options
     * @returns {Promise<Object>} Preview result
     */
    async generatePreview(templateId, container, options = {}) {
      logDebug("[Chart Template Library] Generating preview", templateId);
      const template = this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      return this.preview.generatePreview(template, container, options);
    }

    /**
     * Export templates
     * @param {Array} templateIds - Template IDs (null for all user templates)
     * @returns {string} JSON export data
     */
    exportTemplates(templateIds = null) {
      logDebug("[Chart Template Library] Exporting templates", templateIds);
      return this.storage.exportTemplates(templateIds);
    }

    /**
     * Export category
     * @param {string} category - Category to export
     * @returns {string} JSON export data
     */
    exportCategory(category) {
      logDebug("[Chart Template Library] Exporting category", category);
      const templates = this.getCategoryTemplates(category);
      const templateIds = templates.map((t) => t.id);
      return this.storage.exportTemplates(templateIds);
    }

    /**
     * Import templates
     * @param {string} jsonData - JSON import data
     * @param {Object} options - Import options
     * @returns {Object} Import result
     */
    importTemplates(jsonData, options = {}) {
      logDebug("[Chart Template Library] Importing templates", options);
      return this.storage.importTemplates(jsonData, options);
    }

    /**
     * Get template statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
      logDebug("[Chart Template Library] Getting statistics");
      const allTemplates = this.storage.getTemplates();
      const userTemplates = this.storage.getTemplates(true);
      const builtInCount =
        Object.keys(allTemplates).length - Object.keys(userTemplates).length;

      const categories = this.getCategories();
      const chartTypes = {};

      Object.values(allTemplates).forEach((template) => {
        const type = template.chartType;
        chartTypes[type] = (chartTypes[type] || 0) + 1;
      });

      return {
        totalTemplates: Object.keys(allTemplates).length,
        builtInTemplates: builtInCount,
        userTemplates: Object.keys(userTemplates).length,
        categories: categories.length,
        chartTypes: Object.keys(chartTypes).length,
        categoryBreakdown: categories,
        chartTypeBreakdown: chartTypes,
      };
    }
  }

  // Create singleton instance
  const instance = new ChartTemplateManager();

  // Log successful module initialisation
  logInfo("[Chart Template Library] Module loaded successfully");

  // Public API
  return {
    // Template management
    getTemplates: (filters) => instance.getTemplates(filters),
    getTemplate: (id) => instance.getTemplate(id),
    saveTemplate: (template, isUser) => instance.saveTemplate(template, isUser),
    deleteTemplate: (id) => instance.deleteTemplate(id),

    // Category management
    getCategories: () => instance.getCategories(),
    getCategoryTemplates: (category) => instance.getCategoryTemplates(category),

    // Search and filtering
    searchTemplates: (query, filters) =>
      instance.searchTemplates(query, filters),

    // Validation
    validateTemplate: (template) => instance.validateTemplate(template),
    validateTemplateWithData: (templateId, data) =>
      instance.validateTemplateWithData(templateId, data),

    // Preview
    generatePreview: (templateId, container, options) =>
      instance.generatePreview(templateId, container, options),

    // Import/Export
    exportTemplates: (templateIds) => instance.exportTemplates(templateIds),
    exportCategory: (category) => instance.exportCategory(category),
    importTemplates: (jsonData, options) =>
      instance.importTemplates(jsonData, options),

    // Statistics
    getStatistics: () => instance.getStatistics(),

    // Constants for external use
    Categories,
    EducationLevels,
    CONFIG,

    // Logging configuration access (for debugging)
    getLoggingConfig: () => ({
      levels: LOG_LEVELS,
      currentLevel: currentLogLevel,
      enableAllLogging: ENABLE_ALL_LOGGING,
      disableAllLogging: DISABLE_ALL_LOGGING,
    }),

    // Allow runtime logging level changes
    setLoggingLevel: (level) => {
      if (typeof level === "number" && level >= -1 && level <= 3) {
        currentLogLevel = level;
        logInfo("[Chart Template Library] Logging level changed", level);
      } else {
        logWarn("[Chart Template Library] Invalid logging level", level);
      }
    },
  };
})();

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = ChartTemplateLibrary;
} else {
  window.ChartTemplateLibrary = ChartTemplateLibrary;
}
