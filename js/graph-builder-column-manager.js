/**
 * Graph Builder Column Manager
 *
 * Manages column definitions, validation, and chart type compatibility
 * for the enhanced multi-column Graph Builder.
 *
 * Dependencies: None (pure vanilla JavaScript)
 *
 * @version 1.0.0
 */

const GraphBuilderColumnManager = (function () {
  "use strict";

  // ============================================
  // LOGGING CONFIGURATION
  // ============================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[GB Columns] " + message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[GB Columns] " + message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[GB Columns] " + message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[GB Columns] " + message, ...args);
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  const CONFIG = {
    defaults: [
      { name: "Category", type: "text", role: "label" },
      { name: "Value", type: "number", role: "value" },
    ],
    maxColumns: 6,
    minColumns: 2,
  };

  // ============================================
  // NOTIFICATION HELPER
  // ============================================

  function notify(type, message) {
    if (typeof window.GraphBuilderNotifications !== "undefined") {
      window.GraphBuilderNotifications[type](message);
    }
  }

  // ============================================
  // FACTORY
  // ============================================

  function cloneDefaults() {
    return CONFIG.defaults.map(function (c) {
      return { name: c.name, type: c.type, role: c.role };
    });
  }

  function createInstance() {
    var columns = cloneDefaults();

    function getColumns() {
      return columns.map(function (c) {
        return { name: c.name, type: c.type, role: c.role };
      });
    }

    function setColumns(newColumns) {
      if (!Array.isArray(newColumns) || newColumns.length < CONFIG.minColumns) {
        logWarn("Invalid column configuration, using defaults");
        columns = cloneDefaults();
        return false;
      }

      columns = newColumns.map(function (col) {
        return {
          name: col.name || "Untitled",
          type: col.type || "text",
          role: col.role || "value",
        };
      });

      logDebug("Column configuration updated: " + columns.length + " columns");
      return true;
    }

    function addColumn(column) {
      if (columns.length >= CONFIG.maxColumns) {
        notify("warning", "Maximum " + CONFIG.maxColumns + " columns supported for optimal chart readability");
        logWarn("Cannot add column: maximum limit reached");
        return false;
      }

      var newCol = {
        name: (column && column.name) || "Column " + (columns.length + 1),
        type: (column && column.type) || "number",
        role: (column && column.role) || "value",
      };

      columns.push(newCol);
      logDebug("Added column: " + newCol.name);
      return true;
    }

    function removeColumn(index) {
      if (columns.length <= CONFIG.minColumns) {
        notify("warning", "Minimum " + CONFIG.minColumns + " columns required");
        logWarn("Cannot remove column: minimum columns required");
        return false;
      }

      if (index < 0 || index >= columns.length) {
        logWarn("Invalid column index: " + index);
        return false;
      }

      var removed = columns.splice(index, 1)[0];
      logDebug("Removed column: " + removed.name);
      return true;
    }

    function validateConfiguration() {
      var errors = [];
      var warnings = [];
      var roleCounts = {};

      columns.forEach(function (col) {
        roleCounts[col.role] = (roleCounts[col.role] || 0) + 1;
      });

      if (!roleCounts.label) {
        errors.push("At least one label column is required");
      }
      if (!roleCounts.value) {
        errors.push("At least one value column is required");
      }
      if (roleCounts.grouping > 2) {
        warnings.push("More than 2 grouping columns may affect chart readability");
      }

      return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        roleCounts: roleCounts,
      };
    }

    function getCompatibleChartTypes() {
      var validation = validateConfiguration();
      if (!validation.valid) return [];

      var valueCols = validation.roleCounts.value || 0;
      var hasTimeData = columns.some(function (col) { return col.type === "date"; });
      var compatible = [];

      if (valueCols === 1) {
        compatible.push("bar", "line", "pie", "doughnut");
      } else if (valueCols >= 2) {
        compatible.push("bar", "line", "scatter");
      }

      if (hasTimeData && compatible.indexOf("line") === -1) {
        compatible.push("line");
      }

      if (valueCols >= 3) {
        compatible.push("bubble");
      }

      return compatible;
    }

    return {
      getColumns: getColumns,
      setColumns: setColumns,
      addColumn: addColumn,
      removeColumn: removeColumn,
      validateConfiguration: validateConfiguration,
      getCompatibleChartTypes: getCompatibleChartTypes,
    };
  }

  logInfo("Module loaded");

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    create: createInstance,
    getDefaults: cloneDefaults,
    CONFIG: CONFIG,
  };
})();

// Attach to window
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderColumnManager;
} else {
  window.GraphBuilderColumnManager = GraphBuilderColumnManager;
}
