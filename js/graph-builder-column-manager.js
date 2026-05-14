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

    // Phase 3.2.b-1: per-column currency symbol presets. Add new symbols here
    // to expose them across the UI + data + chart layers; the data layer's
    // formatCurrency accepts any string symbol, so this list is purely the
    // allowlist for what the UI <select> offers and what setColumns will
    // persist. Default "£" preserves pre-3.2.b behaviour for any column
    // without an explicit symbol.
    var SYMBOL_PRESETS = ["£", "$", "€", "¥", "₹"];
    var DEFAULT_SYMBOL = "£";

    function isValidSymbol(s) {
      return typeof s === "string" && SYMBOL_PRESETS.indexOf(s) !== -1;
    }

    function getColumns() {
      return columns.map(function (c) {
        var clone = { name: c.name, type: c.type, role: c.role };
        if (c.role === "value" && (c.chartType === "bar" || c.chartType === "line")) {
          clone.chartType = c.chartType;
        }
        if (c.type === "currency") {
          clone.symbol = isValidSymbol(c.symbol) ? c.symbol : DEFAULT_SYMBOL;
        }
        return clone;
      });
    }

    function setColumns(newColumns) {
      if (!Array.isArray(newColumns) || newColumns.length < CONFIG.minColumns) {
        logWarn("Invalid column configuration, using defaults");
        columns = cloneDefaults();
        return false;
      }

      columns = newColumns.map(function (col) {
        var next = {
          name: col.name || "Untitled",
          type: col.type || "text",
          role: col.role || "value",
        };
        if (next.role === "value" && (col.chartType === "bar" || col.chartType === "line")) {
          next.chartType = col.chartType;
        }
        if (next.type === "currency") {
          next.symbol = isValidSymbol(col.symbol) ? col.symbol : DEFAULT_SYMBOL;
        }
        return next;
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
      if (newCol.role === "value" && column && (column.chartType === "bar" || column.chartType === "line")) {
        newCol.chartType = column.chartType;
      }
      if (newCol.type === "currency") {
        newCol.symbol = (column && isValidSymbol(column.symbol)) ? column.symbol : DEFAULT_SYMBOL;
      }

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
      var radiusCols = validation.roleCounts.radius || 0;
      var hasTimeData = columns.some(function (col) { return col.type === "date"; });
      var compatible = [];

      if (valueCols === 1) {
        compatible.push("bar", "line", "pie", "doughnut");
      } else if (valueCols >= 2) {
        compatible.push("bar", "line", "scatter", "combo");
      }

      if (hasTimeData && compatible.indexOf("line") === -1) {
        compatible.push("line");
      }

      if (valueCols >= 2 && radiusCols >= 1) {
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

  // Module-level exposure of the currency-symbol allowlist + default.
  // Lives outside createInstance so consumers (UI, data, charts) can read
  // it without holding a column-manager instance reference.
  var MODULE_SYMBOL_PRESETS = ["£", "$", "€", "¥", "₹"];
  var MODULE_DEFAULT_SYMBOL = "£";

  return {
    create: createInstance,
    getDefaults: cloneDefaults,
    getSymbolPresets: function () { return MODULE_SYMBOL_PRESETS.slice(); },
    getDefaultSymbol: function () { return MODULE_DEFAULT_SYMBOL; },
    CONFIG: CONFIG,
  };
})();

// Attach to window
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderColumnManager;
} else {
  window.GraphBuilderColumnManager = GraphBuilderColumnManager;
}
