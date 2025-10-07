/**
 * Chart Template Manager
 * Manages saving, loading, and sharing of chart templates
 *
 * Integrates with ChartDataManager for applying templates to data
 */

const ChartTemplateManager = (function () {
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

  /**
   * Helper methods for logging level control
   */
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
      console.log("[DEBUG]", message, ...args);
    }
  }

  /**
   * Set logging level
   * @param {number} level - Log level (0-3)
   */
  function setLogLevel(level) {
    if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
      currentLogLevel = level;
      logInfo(
        `[Chart Template Manager] Logging level set to: ${
          Object.keys(LOG_LEVELS)[level]
        }`
      );
    } else {
      logWarn(`[Chart Template Manager] Invalid log level: ${level}`);
    }
  }

  /**
   * Get current logging level
   * @returns {number} Current log level
   */
  function getLogLevel() {
    return currentLogLevel;
  }

  // Configuration
  const CONFIG = {
    storageKey: "chart-templates",
    version: "1.0.0",
    defaultCategories: [
      "general",
      "statistics",
      "science",
      "economics",
      "mathematics",
      "geography",
      "custom",
    ],
    templateVersion: "1.0.0",
  };

  /**
   * Template Storage
   * Handles persistence of templates
   */
  class TemplateStorage {
    constructor() {
      this.storageType = this.detectStorageCapability();
      this.initialised = false;
      this.initStorage();
    }

    /**
     * Detect available storage capability
     * @returns {string} Storage type ('local', 'session', 'memory')
     */
    detectStorageCapability() {
      try {
        // Test localStorage availability
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("test", "test");
          localStorage.removeItem("test");
          logDebug("localStorage detected and available");
          return "local";
        }
      } catch (e) {
        logWarn("localStorage not available:", e);
      }

      try {
        // Fallback to sessionStorage
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("test", "test");
          sessionStorage.removeItem("test");
          logDebug("sessionStorage detected and available");
          return "session";
        }
      } catch (e) {
        logWarn("sessionStorage not available:", e);
      }

      // Fallback to in-memory storage
      logWarn("Using in-memory storage for templates (will not persist)");
      return "memory";
    }

    /**
     * Initialise storage
     */
    initStorage() {
      if (this.initialised) return;

      logDebug("Initialising template storage");

      if (this.storageType === "memory") {
        this.memoryStore = {
          templates: {},
          categories: [...CONFIG.defaultCategories],
          metadata: {
            version: CONFIG.version,
            lastModified: new Date().toISOString(),
          },
        };
        logInfo("Memory storage initialised for templates");
      } else {
        // Initialise localStorage/sessionStorage if empty
        const storage =
          this.storageType === "local" ? localStorage : sessionStorage;
        if (!storage.getItem(CONFIG.storageKey)) {
          const initialData = {
            templates: {},
            categories: [...CONFIG.defaultCategories],
            metadata: {
              version: CONFIG.version,
              lastModified: new Date().toISOString(),
            },
          };
          storage.setItem(CONFIG.storageKey, JSON.stringify(initialData));
          logInfo(`${this.storageType} storage initialised for templates`);
        } else {
          logDebug(`Existing ${this.storageType} storage found for templates`);
        }
      }

      this.initialised = true;
    }

    /**
     * Get all storage data
     * @returns {Object} Complete storage data
     */
    getAllData() {
      logDebug("Retrieving all template storage data");
      if (this.storageType === "memory") {
        return { ...this.memoryStore };
      } else {
        const storage =
          this.storageType === "local" ? localStorage : sessionStorage;
        try {
          return JSON.parse(storage.getItem(CONFIG.storageKey)) || {};
        } catch (e) {
          logError("Error retrieving template data:", e);
          return { templates: {}, categories: [], metadata: {} };
        }
      }
    }

    /**
     * Save storage data
     * @param {Object} data - Data to save
     */
    saveData(data) {
      logDebug("Saving template storage data");
      if (this.storageType === "memory") {
        this.memoryStore = { ...data };
      } else {
        const storage =
          this.storageType === "local" ? localStorage : sessionStorage;
        try {
          storage.setItem(CONFIG.storageKey, JSON.stringify(data));
          logDebug("Template data saved successfully");
        } catch (e) {
          logError("Error saving template data:", e);
          throw new Error(`Failed to save templates: ${e.message}`);
        }
      }
    }

    /**
     * Get all templates
     * @returns {Object} Templates object
     */
    getTemplates() {
      logDebug("Retrieving all templates");
      return this.getAllData().templates || {};
    }

    /**
     * Get categories
     * @returns {Array} Categories array
     */
    getCategories() {
      logDebug("Retrieving template categories");
      return this.getAllData().categories || [...CONFIG.defaultCategories];
    }

    /**
     * Get template by ID
     * @param {string} id - Template ID
     * @returns {Object|null} Template object or null if not found
     */
    getTemplate(id) {
      logDebug(`Retrieving template: ${id}`);
      const template = this.getTemplates()[id] || null;
      if (!template) {
        logDebug(`Template not found: ${id}`);
      }
      return template;
    }

    /**
     * Save template
     * @param {string} id - Template ID
     * @param {Object} template - Template object
     */
    saveTemplate(id, template) {
      logDebug(`Saving template: ${id}`);
      const data = this.getAllData();
      if (!data.templates) data.templates = {};

      data.templates[id] = template;
      data.metadata.lastModified = new Date().toISOString();

      this.saveData(data);
      logInfo(`Template saved successfully: ${id}`);
    }

    /**
     * Delete template
     * @param {string} id - Template ID
     * @returns {boolean} Success status
     */
    deleteTemplate(id) {
      logDebug(`Deleting template: ${id}`);
      const data = this.getAllData();
      if (!data.templates || !data.templates[id]) {
        logDebug(`Template not found for deletion: ${id}`);
        return false;
      }

      delete data.templates[id];
      data.metadata.lastModified = new Date().toISOString();

      this.saveData(data);
      logInfo(`Template deleted successfully: ${id}`);
      return true;
    }

    /**
     * Add category
     * @param {string} category - Category name
     * @returns {boolean} Success status
     */
    addCategory(category) {
      logDebug(`Adding category: ${category}`);
      const data = this.getAllData();
      if (!data.categories) data.categories = [...CONFIG.defaultCategories];

      if (data.categories.includes(category)) {
        logDebug(`Category already exists: ${category}`);
        return false;
      }

      data.categories.push(category);
      data.metadata.lastModified = new Date().toISOString();

      this.saveData(data);
      logInfo(`Category added successfully: ${category}`);
      return true;
    }

    /**
     * Clear all storage
     * @returns {boolean} Success status
     */
    clearStorage() {
      logDebug("Clearing template storage");
      try {
        if (this.storageType === "memory") {
          this.memoryStore = {
            templates: {},
            categories: [...CONFIG.defaultCategories],
            metadata: {
              version: CONFIG.version,
              lastModified: new Date().toISOString(),
            },
          };
        } else {
          const storage =
            this.storageType === "local" ? localStorage : sessionStorage;
          storage.removeItem(CONFIG.storageKey);
          this.initStorage(); // Reinitialise
        }
        logInfo("Template storage cleared successfully");
        return true;
      } catch (e) {
        logError("Error clearing template storage:", e);
        return false;
      }
    }
  }

  /**
   * Template Manager
   * Core management of templates
   */
  class TemplateManager {
    constructor() {
      logDebug("Initialising Template Manager");
      this.storage = new TemplateStorage();
      this.serialiser = new TemplateSerialiser();
      this.categoriser = new TemplateCategoriser(this.storage);
      logInfo("Template Manager initialised successfully");
    }

    /**
     * Get template by ID
     * @param {string} id - Template ID
     * @returns {Object|null} Template object or null if not found
     */
    getTemplate(id) {
      return this.storage.getTemplate(id);
    }

    /**
     * Get all templates
     * @returns {Array} Array of templates
     */
    getAllTemplates() {
      logDebug("Retrieving all templates from manager");
      const templates = this.storage.getTemplates();
      return Object.entries(templates).map(([id, template]) => ({
        id,
        ...template,
      }));
    }

    /**
     * Create new template
     * @param {Object} templateData - Template data
     * @returns {string} New template ID
     */
    createTemplate(templateData) {
      logDebug("Creating new template");
      // Validate template
      this.validateTemplate(templateData);

      // Generate ID if not provided
      const id = templateData.id || this.generateTemplateId();

      // Ensure metadata
      if (!templateData.metadata) {
        templateData.metadata = {};
      }

      // Add creation timestamp
      templateData.metadata.created =
        templateData.metadata.created || new Date().toISOString();
      templateData.metadata.modified = new Date().toISOString();
      templateData.metadata.version = CONFIG.templateVersion;

      // Save template
      this.storage.saveTemplate(id, templateData);

      logInfo(`Template created successfully: ${templateData.name} (${id})`);
      return id;
    }

    /**
     * Update existing template
     * @param {string} id - Template ID
     * @param {Object} templateData - Template data
     * @returns {boolean} Success status
     */
    updateTemplate(id, templateData) {
      logDebug(`Updating template: ${id}`);
      const existing = this.storage.getTemplate(id);
      if (!existing) {
        logWarn(`Template not found for update: ${id}`);
        throw new Error(`Template not found: ${id}`);
      }

      // Validate template
      this.validateTemplate(templateData);

      // Preserve creation date
      if (existing.metadata && existing.metadata.created) {
        if (!templateData.metadata) templateData.metadata = {};
        templateData.metadata.created = existing.metadata.created;
      }

      // Update modification timestamp
      if (!templateData.metadata) templateData.metadata = {};
      templateData.metadata.modified = new Date().toISOString();
      templateData.metadata.version = CONFIG.templateVersion;

      // Save template
      this.storage.saveTemplate(id, templateData);

      logInfo(`Template updated successfully: ${templateData.name} (${id})`);
      return true;
    }

    /**
     * Delete template
     * @param {string} id - Template ID
     * @returns {boolean} Success status
     */
    deleteTemplate(id) {
      logDebug(`Deleting template via manager: ${id}`);
      return this.storage.deleteTemplate(id);
    }

    /**
     * Search templates by criteria
     * @param {Object} criteria - Search criteria
     * @returns {Array} Matching templates
     */
    searchTemplates(criteria = {}) {
      logDebug("Searching templates with criteria:", criteria);
      const templates = this.getAllTemplates();

      const results = templates.filter((template) => {
        // Filter by name
        if (
          criteria.name &&
          !template.name.toLowerCase().includes(criteria.name.toLowerCase())
        ) {
          return false;
        }

        // Filter by category
        if (criteria.category && template.category !== criteria.category) {
          return false;
        }

        // Filter by chart type
        if (criteria.chartType && template.chartType !== criteria.chartType) {
          return false;
        }

        // Filter by tags
        if (
          criteria.tags &&
          Array.isArray(criteria.tags) &&
          criteria.tags.length > 0
        ) {
          if (!template.tags || !Array.isArray(template.tags)) {
            return false;
          }

          const hasAllTags = criteria.tags.every((tag) =>
            template.tags.includes(tag)
          );

          if (!hasAllTags) return false;
        }

        return true;
      });

      logDebug(`Search returned ${results.length} templates`);
      return results;
    }

    /**
     * Apply template to chart data
     * @param {string} templateId - Template ID
     * @param {Object} chartData - Chart data object
     * @returns {Object} Chart configuration
     */
    applyTemplate(templateId, chartData) {
      logDebug(`Applying template: ${templateId}`);
      const template = this.getTemplate(templateId);
      if (!template) {
        logWarn(`Template not found for application: ${templateId}`);
        throw new Error(`Template not found: ${templateId}`);
      }

      // Get the base configuration from the template
      const config = this.serialiser.cloneObject(template.configuration);

      // Apply data mapping
      if (template.dataMapping && chartData) {
        logDebug("Applying data mapping to template configuration");
        this.applyDataMapping(config, chartData, template.dataMapping);
      }

      logInfo(`Template applied successfully: ${templateId}`);
      return config;
    }

    /**
     * Apply data mapping to configuration
     * @param {Object} config - Chart configuration
     * @param {Object} chartData - Chart data
     * @param {Object} mapping - Data mapping
     */
    applyDataMapping(config, chartData, mapping) {
      logDebug("Processing data mapping");
      // This implementation depends on the data format
      // A simple example for bar/line charts:
      if (mapping.labelColumn && chartData.labels) {
        config.data = config.data || {};
        config.data.labels = chartData.labels;
        logDebug("Applied label mapping");
      }

      if (mapping.valueColumns && chartData.datasets) {
        config.data = config.data || {};
        config.data.datasets = chartData.datasets;
        logDebug("Applied value column mapping");
      }
    }

    /**
     * Validate template structure
     * @param {Object} template - Template to validate
     * @throws {Error} If validation fails
     */
    validateTemplate(template) {
      logDebug("Validating template structure");
      // Required fields
      const requiredFields = ["name", "chartType", "configuration"];

      for (const field of requiredFields) {
        if (!template[field]) {
          logWarn(
            `Template validation failed: missing required field: ${field}`
          );
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate chart type
      const validChartTypes = [
        "bar",
        "line",
        "pie",
        "doughnut",
        "radar",
        "polarArea",
        "scatter",
        "bubble",
      ];
      if (!validChartTypes.includes(template.chartType)) {
        logWarn(
          `Template validation failed: invalid chart type: ${template.chartType}`
        );
        throw new Error(`Invalid chart type: ${template.chartType}`);
      }

      // Validate configuration
      if (typeof template.configuration !== "object") {
        logWarn("Template validation failed: configuration must be an object");
        throw new Error("Configuration must be an object");
      }

      logDebug("Template validation passed");
    }

    /**
     * Generate unique template ID
     * @returns {string} Unique ID
     */
    generateTemplateId() {
      const id =
        "template-" +
        Date.now() +
        "-" +
        Math.random().toString(36).substring(2, 9);
      logDebug(`Generated template ID: ${id}`);
      return id;
    }
  }

  /**
   * Template Serialiser
   * Handles import/export of templates
   */
  class TemplateSerialiser {
    /**
     * Export template to JSON string
     * @param {Object} template - Template object
     * @returns {string} JSON string
     */
    exportToJSON(template) {
      logDebug("Exporting template to JSON");
      try {
        const jsonString = JSON.stringify(template, null, 2);
        logInfo("Template exported to JSON successfully");
        return jsonString;
      } catch (e) {
        logError("Template serialisation failed:", e);
        throw new Error(`Template serialisation failed: ${e.message}`);
      }
    }

    /**
     * Import template from JSON string
     * @param {string} jsonString - JSON string
     * @returns {Object} Template object
     */
    importFromJSON(jsonString) {
      logDebug("Importing template from JSON");
      try {
        const template = JSON.parse(jsonString);
        this.validateImport(template);
        logInfo("Template imported from JSON successfully");
        return template;
      } catch (e) {
        logError("Template import failed:", e);
        throw new Error(`Template import failed: ${e.message}`);
      }
    }

    /**
     * Export template collection to JSON file
     * @param {Array} templates - Array of templates
     * @param {string} filename - File name
     */
    exportToFile(templates, filename = "chart-templates.json") {
      logDebug(`Exporting templates to file: ${filename}`);
      try {
        const dataStr = JSON.stringify(templates, null, 2);
        const dataUri =
          "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

        const exportLink = document.createElement("a");
        exportLink.setAttribute("href", dataUri);
        exportLink.setAttribute("download", filename);
        exportLink.style.display = "none";

        document.body.appendChild(exportLink);
        exportLink.click();
        document.body.removeChild(exportLink);

        logInfo(`Templates exported to file successfully: ${filename}`);
      } catch (e) {
        logError("Template export failed:", e);
        throw new Error(`Template export failed: ${e.message}`);
      }
    }

    /**
     * Validate imported template
     * @param {Object} template - Template to validate
     * @throws {Error} If validation fails
     */
    validateImport(template) {
      logDebug("Validating imported template");
      // Check template structure
      if (!template || typeof template !== "object") {
        logWarn("Import validation failed: invalid template format");
        throw new Error("Invalid template format");
      }

      // Required fields
      const requiredFields = ["name", "chartType", "configuration"];
      for (const field of requiredFields) {
        if (!template[field]) {
          logWarn(`Import validation failed: missing required field: ${field}`);
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // If template has version, check compatibility
      if (template.metadata && template.metadata.version) {
        // Here you would implement version compatibility checks
        // For now, just log a warning if versions don't match
        if (template.metadata.version !== CONFIG.templateVersion) {
          logWarn(
            `Template version mismatch: ${template.metadata.version} vs ${CONFIG.templateVersion}`
          );
        }
      }

      logDebug("Import validation passed");
    }

    /**
     * Deep clone an object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    cloneObject(obj) {
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch (e) {
        logError("Clone error:", e);
        return { ...obj };
      }
    }
  }

  /**
   * Template Categoriser
   * Manages categories and tags
   */
  class TemplateCategoriser {
    constructor(storage) {
      this.storage = storage;
      logDebug("Template Categoriser initialised");
    }

    /**
     * Get all categories
     * @returns {Array} Array of categories
     */
    getAllCategories() {
      logDebug("Retrieving all categories");
      return this.storage.getCategories();
    }

    /**
     * Add new category
     * @param {string} category - Category name
     * @returns {boolean} Success status
     */
    addCategory(category) {
      logDebug(`Adding new category: ${category}`);
      return this.storage.addCategory(category);
    }

    /**
     * Get templates by category
     * @param {string} category - Category name
     * @returns {Array} Templates in category
     */
    getTemplatesByCategory(category) {
      logDebug(`Retrieving templates for category: ${category}`);
      const templates = this.storage.getTemplates();

      const results = Object.entries(templates)
        .filter(([_, template]) => template.category === category)
        .map(([id, template]) => ({
          id,
          ...template,
        }));

      logDebug(`Found ${results.length} templates in category: ${category}`);
      return results;
    }

    /**
     * Get templates by tag
     * @param {string} tag - Tag name
     * @returns {Array} Templates with tag
     */
    getTemplatesByTag(tag) {
      logDebug(`Retrieving templates for tag: ${tag}`);
      const templates = this.storage.getTemplates();

      const results = Object.entries(templates)
        .filter(
          ([_, template]) =>
            template.tags &&
            Array.isArray(template.tags) &&
            template.tags.includes(tag)
        )
        .map(([id, template]) => ({
          id,
          ...template,
        }));

      logDebug(`Found ${results.length} templates with tag: ${tag}`);
      return results;
    }

    /**
     * Add tag to template
     * @param {string} templateId - Template ID
     * @param {string} tag - Tag to add
     * @returns {boolean} Success status
     */
    addTagToTemplate(templateId, tag) {
      logDebug(`Adding tag '${tag}' to template: ${templateId}`);
      const template = this.storage.getTemplate(templateId);
      if (!template) {
        logDebug(`Template not found for tag addition: ${templateId}`);
        return false;
      }

      if (!template.tags) {
        template.tags = [];
      }

      if (!template.tags.includes(tag)) {
        template.tags.push(tag);
        this.storage.saveTemplate(templateId, template);
        logInfo(`Tag '${tag}' added to template: ${templateId}`);
      } else {
        logDebug(`Tag '${tag}' already exists on template: ${templateId}`);
      }

      return true;
    }

    /**
     * Remove tag from template
     * @param {string} templateId - Template ID
     * @param {string} tag - Tag to remove
     * @returns {boolean} Success status
     */
    removeTagFromTemplate(templateId, tag) {
      logDebug(`Removing tag '${tag}' from template: ${templateId}`);
      const template = this.storage.getTemplate(templateId);
      if (!template || !template.tags) {
        logDebug(`Template or tags not found for tag removal: ${templateId}`);
        return false;
      }

      const index = template.tags.indexOf(tag);
      if (index !== -1) {
        template.tags.splice(index, 1);
        this.storage.saveTemplate(templateId, template);
        logInfo(`Tag '${tag}' removed from template: ${templateId}`);
        return true;
      }

      logDebug(`Tag '${tag}' not found on template: ${templateId}`);
      return false;
    }
  }

  /**
   * Default Templates Provider
   * Provides educational templates
   */
  class DefaultTemplatesProvider {
    constructor() {
      logDebug("Initialising Default Templates Provider");
      this.defaultTemplates = this.getDefaultTemplates();
    }

    /**
     * Get all default templates
     * @returns {Array} Default templates
     */
    getDefaultTemplates() {
      logDebug("Generating default templates");
      return [
        // Bar chart for comparing values across categories
        {
          name: "Basic Bar Chart",
          description:
            "Simple bar chart for comparing values across categories",
          category: "general",
          tags: ["comparison", "categorical"],
          chartType: "bar",
          configuration: {
            type: "bar",
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: true,
                  text: "Comparison Chart",
                },
                legend: {
                  position: "top",
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: "Values",
                  },
                },
                x: {
                  title: {
                    display: true,
                    text: "Categories",
                  },
                },
              },
            },
          },
          dataMapping: {
            requiredColumns: ["category", "value"],
            labelColumn: "category",
            valueColumns: ["value"],
          },
          metadata: {
            author: "System",
            created: new Date().toISOString(),
            version: CONFIG.templateVersion,
            educationalContext:
              "General purpose comparison chart suitable for most subjects",
          },
        },

        // Line chart for trends
        {
          name: "Time Series Line Chart",
          description: "Line chart for showing trends over time",
          category: "general",
          tags: ["time series", "trend"],
          chartType: "line",
          configuration: {
            type: "line",
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: true,
                  text: "Trend Analysis",
                },
              },
              scales: {
                y: {
                  title: {
                    display: true,
                    text: "Values",
                  },
                },
                x: {
                  title: {
                    display: true,
                    text: "Time Period",
                  },
                },
              },
            },
          },
          dataMapping: {
            requiredColumns: ["time_period", "value"],
            labelColumn: "time_period",
            valueColumns: ["value"],
          },
          metadata: {
            author: "System",
            created: new Date().toISOString(),
            version: CONFIG.templateVersion,
            educationalContext:
              "Suitable for showing changes over time in any subject",
          },
        },

        // Pie chart for parts of a whole
        {
          name: "Distribution Pie Chart",
          description: "Pie chart for showing distribution of categories",
          category: "statistics",
          tags: ["distribution", "proportion"],
          chartType: "pie",
          configuration: {
            type: "pie",
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: true,
                  text: "Distribution Chart",
                },
                legend: {
                  position: "right",
                },
              },
            },
          },
          dataMapping: {
            requiredColumns: ["category", "value"],
            labelColumn: "category",
            valueColumns: ["value"],
          },
          metadata: {
            author: "System",
            created: new Date().toISOString(),
            version: CONFIG.templateVersion,
            educationalContext:
              "Use to show proportions and percentages in statistics, economics, or social sciences",
          },
        },

        // Scatter plot for correlations
        {
          name: "Correlation Scatter Plot",
          description:
            "Scatter plot for showing relationships between two variables",
          category: "statistics",
          tags: ["correlation", "relationship"],
          chartType: "scatter",
          configuration: {
            type: "scatter",
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: true,
                  text: "Correlation Analysis",
                },
              },
              scales: {
                y: {
                  title: {
                    display: true,
                    text: "Dependent Variable",
                  },
                },
                x: {
                  title: {
                    display: true,
                    text: "Independent Variable",
                  },
                },
              },
            },
          },
          dataMapping: {
            requiredColumns: ["x_value", "y_value"],
            xColumn: "x_value",
            yColumn: "y_value",
          },
          metadata: {
            author: "System",
            created: new Date().toISOString(),
            version: CONFIG.templateVersion,
            educationalContext:
              "Ideal for showing correlations in science, mathematics, or economics",
          },
        },
      ];
    }

    /**
     * Install default templates
     * @param {TemplateManager} manager - Template manager instance
     * @returns {Array} Installed template IDs
     */
    installDefaultTemplates(manager) {
      logDebug("Installing default templates");
      const installedIds = [];

      for (const template of this.defaultTemplates) {
        try {
          const id = manager.createTemplate(template);
          installedIds.push(id);
          logDebug(`Default template installed: ${template.name} (${id})`);
        } catch (e) {
          logError(`Failed to install template "${template.name}":`, e);
        }
      }

      logInfo(
        `${installedIds.length} default templates installed successfully`
      );
      return installedIds;
    }
  }

  // Create manager instance
  const manager = new TemplateManager();

  // Install default templates if storage is empty
  const defaultProvider = new DefaultTemplatesProvider();
  if (Object.keys(manager.storage.getTemplates()).length === 0) {
    defaultProvider.installDefaultTemplates(manager);
    logInfo("[Chart Template Manager] Default templates installed");
  }

  // Module initialisation complete
  logInfo("[Chart Template Manager] Module loaded successfully");

  // Public API
  return {
    // Template management
    getTemplate: manager.getTemplate.bind(manager),
    getAllTemplates: manager.getAllTemplates.bind(manager),
    createTemplate: manager.createTemplate.bind(manager),
    updateTemplate: manager.updateTemplate.bind(manager),
    deleteTemplate: manager.deleteTemplate.bind(manager),

    // Search and filtering
    searchTemplates: manager.searchTemplates.bind(manager),

    // Categories and tags
    getAllCategories: manager.categoriser.getAllCategories.bind(
      manager.categoriser
    ),
    addCategory: manager.categoriser.addCategory.bind(manager.categoriser),
    getTemplatesByCategory: manager.categoriser.getTemplatesByCategory.bind(
      manager.categoriser
    ),
    getTemplatesByTag: manager.categoriser.getTemplatesByTag.bind(
      manager.categoriser
    ),
    addTagToTemplate: manager.categoriser.addTagToTemplate.bind(
      manager.categoriser
    ),
    removeTagFromTemplate: manager.categoriser.removeTagFromTemplate.bind(
      manager.categoriser
    ),

    // Template application
    applyTemplate: manager.applyTemplate.bind(manager),

    // Import/export
    exportToJSON: manager.serialiser.exportToJSON.bind(manager.serialiser),
    importFromJSON: manager.serialiser.importFromJSON.bind(manager.serialiser),
    exportToFile: manager.serialiser.exportToFile.bind(manager.serialiser),

    // Default templates
    getDefaultTemplates:
      defaultProvider.getDefaultTemplates.bind(defaultProvider),

    // Storage management
    clearStorage: manager.storage.clearStorage.bind(manager.storage),

    // Logging controls (exposed in public API)
    setLogLevel: setLogLevel,
    getLogLevel: getLogLevel,
    LOG_LEVELS: { ...LOG_LEVELS },

    // Constants
    CONFIG,
  };
})();

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = ChartTemplateManager;
} else {
  window.ChartTemplateManager = ChartTemplateManager;
}
