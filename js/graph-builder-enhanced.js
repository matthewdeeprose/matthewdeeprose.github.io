/**
 * Graph Builder Enhanced - Progressive Multi-Column Support
 *
 * Adds advanced column configuration UI while maintaining complete
 * backwards compatibility with the existing Graph Builder.
 *
 * Dependencies:
 *   - graph-builder-column-manager.js (must load first)
 *   - graph-builder-csv-processor.js (must load first)
 *
 * @version 1.0.0
 */

const GraphBuilderEnhanced = (function () {
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
      console.error("[GB Enhanced] " + message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[GB Enhanced] " + message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[GB Enhanced] " + message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[GB Enhanced] " + message, ...args);
  }

  // ============================================
  // STATE
  // ============================================

  var state = { isAdvancedMode: false, formEnhanced: false };
  var columnManager = window.GraphBuilderColumnManager
    ? window.GraphBuilderColumnManager.create()
    : null;
  var enhancedElements = [];

  // ============================================
  // HELPERS
  // ============================================

  function notify(type, message) {
    if (typeof window.GraphBuilderNotifications !== "undefined") {
      window.GraphBuilderNotifications[type](message);
    }
  }

  function announceToScreenReader(message) {
    var el = document.createElement("div");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.className = "sr-only";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () {
      if (document.body.contains(el)) document.body.removeChild(el);
    }, 1000);
  }

  // ============================================
  // DOM HELPERS
  // ============================================

  function findFormContainer() {
    var selectors = ["#gb-form-panel", "#GraphBuilderContainer", "#graph-builder"];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) return el;
    }
    return null;
  }

  function findInsertionPoint(container) {
    return container.querySelector(".gb-form-headers") ||
      container.querySelector(".gb-help-text") || null;
  }

  function createEnhancementPanel() {
    var panel = document.createElement("div");
    panel.className = "gb-enhanced-config";
    panel.id = "gb-enhanced-config";
    panel.innerHTML =
      '<div class="gb-advanced-toggle">' +
      '<input type="checkbox" class="gb-toggle-checkbox" id="gb-advanced-checkbox" ' +
      'aria-controls="gb-advanced-options" aria-expanded="false" ' +
      'aria-describedby="gb-advanced-description">' +
      '<label for="gb-advanced-checkbox" class="gb-toggle-text">' +
      "Advanced Column Options</label>" +
      '<svg class="gb-toggle-icon" fill="none" stroke="currentColor" ' +
      'viewBox="0 0 24 24" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" ' +
      'stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div>' +
      '<div id="gb-advanced-description" class="sr-only">' +
      "Enable multi-series charts, time series data, and hierarchical structures</div>" +
      '<div id="gb-advanced-options" class="gb-advanced-options" role="region" ' +
      'aria-labelledby="gb-advanced-heading">' +
      '<h4 id="gb-advanced-heading">Advanced Column Configuration</h4>' +
      '<div id="gb-dynamic-columns"></div>' +
      '<div class="gb-column-actions">' +
      '<button type="button" id="gb-add-column-enhanced" class="gb-add-column-btn">' +
      "+ Add Column</button></div>" +
      '<div class="gb-smart-suggestions" role="region" ' +
      'aria-labelledby="gb-suggestions-heading">' +
      '<h4 id="gb-suggestions-heading">Smart Suggestions</h4>' +
      '<ul id="gb-suggestions-list" class="gb-suggestions-list"></ul>' +
      "</div></div>";
    return panel;
  }

  // ============================================
  // COLUMN RENDERING
  // ============================================

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderDynamicColumns() {
    var container = document.getElementById("gb-dynamic-columns");
    if (!container || !columnManager) return;

    var cols = columnManager.getColumns();
    container.innerHTML = "";

    var typeOpts = ["text", "number", "currency", "percentage", "date"];
    var typeLabels = { text: "Text", number: "Number", currency: "Currency", percentage: "Percentage", date: "Date" };
    var roleOpts = ["label", "value", "grouping", "radius"];
    var roleLabels = { label: "Label", value: "Value", grouping: "Grouping", radius: "Radius" };
    var chartTypeOpts = ["", "bar", "line"];
    var chartTypeLabels = { "": "default", bar: "Bar", line: "Line" };

    // Per-column Chart Type override only matters for Combo, which itself
    // requires >= 2 value columns. Match Combo's Stage 2 gating here.
    var canCombo = cols.filter(function (c) { return c.role === "value"; }).length >= 2;

    cols.forEach(function (column, index) {
      var fs = document.createElement("fieldset");
      fs.className = "gb-column-definition";
      var eName = escapeHtml(column.name);

      var tHtml = typeOpts.map(function (t) {
        return '<option value="' + t + '"' + (column.type === t ? " selected" : "") + ">" + typeLabels[t] + "</option>";
      }).join("");

      var rHtml = roleOpts.map(function (r) {
        return '<option value="' + r + '"' + (column.role === r ? " selected" : "") + ">" + roleLabels[r] + "</option>";
      }).join("");

      var ctValue = column.chartType || "";
      var ctHtml = chartTypeOpts.map(function (ct) {
        return '<option value="' + ct + '"' + (ctValue === ct ? " selected" : "") + ">" + chartTypeLabels[ct] + "</option>";
      }).join("");
      var ctDisplay = (column.role === "value" && canCombo) ? "" : "display: none;";

      var removeBtn = index >= 2
        ? '<button type="button" class="gb-remove-column-btn" aria-label="Remove column ' + (index + 1) + '">Remove</button>'
        : "";

      fs.innerHTML =
        "<legend>Column " + (index + 1) + ": " + eName + "</legend>" +
        '<div class="gb-column-inputs">' +
        '<div class="gb-enhanced-input-group"><label for="gb-ecol-' + index + '-name">Name:</label>' +
        '<input type="text" id="gb-ecol-' + index + '-name" class="gb-enhanced-input" value="' + eName + '"></div>' +
        '<div class="gb-enhanced-input-group"><label for="gb-ecol-' + index + '-type">Data Type:</label>' +
        '<select id="gb-ecol-' + index + '-type" class="gb-enhanced-select">' + tHtml + "</select></div>" +
        '<div class="gb-enhanced-input-group"><label for="gb-ecol-' + index + '-role">Role:</label>' +
        '<select id="gb-ecol-' + index + '-role" class="gb-enhanced-select">' + rHtml + "</select></div>" +
        '<div class="gb-enhanced-input-group gb-chart-type-group" style="' + ctDisplay + '">' +
        '<label for="gb-ecol-' + index + '-charttype">Chart Type:</label>' +
        '<select id="gb-ecol-' + index + '-charttype" class="gb-enhanced-select">' + ctHtml + "</select></div>" +
        '<div class="gb-enhanced-input-group">' + removeBtn + "</div></div>";

      // Event listeners
      var nI = fs.querySelector("#gb-ecol-" + index + "-name");
      var tS = fs.querySelector("#gb-ecol-" + index + "-type");
      var rS = fs.querySelector("#gb-ecol-" + index + "-role");
      var ctS = fs.querySelector("#gb-ecol-" + index + "-charttype");
      var rB = fs.querySelector(".gb-remove-column-btn");

      if (nI) nI.addEventListener("input", function () { updateColumn(index, "name", nI.value); });
      if (tS) tS.addEventListener("change", function () { updateColumn(index, "type", tS.value); });
      if (rS) rS.addEventListener("change", function () {
        updateColumn(index, "role", rS.value);
        // Role flips change the total value-column count, which can show or
        // hide chart-type selects on OTHER rows — recompute globally.
        updateAllChartTypeVisibility();
      });
      if (ctS) ctS.addEventListener("change", function () { updateColumn(index, "chartType", ctS.value); });
      if (rB) rB.addEventListener("click", function () { handleRemoveColumn(index); });

      container.appendChild(fs);
    });
  }

  // Refresh visibility of every per-column "Chart Type" select. Visible only
  // on value-role columns when valueCount >= 2 (mirrors Combo's gating).
  // Resets the DOM value to "" when hiding so visible state matches column-
  // manager state (which drops chartType for non-value roles).
  function updateAllChartTypeVisibility() {
    if (!columnManager) return;
    var cols = columnManager.getColumns();
    var canCombo = cols.filter(function (c) { return c.role === "value"; }).length >= 2;
    var container = document.getElementById("gb-dynamic-columns");
    if (!container) return;
    container.querySelectorAll(".gb-column-definition").forEach(function (fs, idx) {
      var ctG = fs.querySelector(".gb-chart-type-group");
      if (!ctG) return;
      var visible = !!(cols[idx] && cols[idx].role === "value" && canCombo);
      ctG.style.display = visible ? "" : "none";
      if (!visible) {
        var ctS = fs.querySelector("#gb-ecol-" + idx + "-charttype");
        if (ctS && ctS.value) ctS.value = "";
      }
    });
  }

  /** Propagate column changes to the data entry rows */
  function syncDataRows() {
    if (state.isAdvancedMode && window.GraphBuilderRowSync && columnManager) {
      window.GraphBuilderRowSync.onColumnsChanged(columnManager.getColumns());
    }
  }

  function updateColumn(index, prop, value) {
    var cols = columnManager.getColumns();
    if (cols[index]) {
      cols[index][prop] = value;
      columnManager.setColumns(cols);
      if (prop === "name") {
        // Update legend text in place — avoid full re-render which steals focus
        var container = document.getElementById("gb-dynamic-columns");
        if (container) {
          var fieldsets = container.querySelectorAll(".gb-column-definition");
          if (fieldsets[index]) {
            var legend = fieldsets[index].querySelector("legend");
            if (legend) legend.textContent = "Column " + (index + 1) + ": " + value;
          }
        }
      }
      updateSmartSuggestions();
      syncDataRows();
    }
  }

  function handleAddColumn() {
    if (columnManager.addColumn()) {
      renderDynamicColumns();
      updateSmartSuggestions();
      syncDataRows();
      notify("success", "Column added successfully");
      announceToScreenReader("Column added. Configure its name, type, and role.");
    }
  }

  function handleRemoveColumn(index) {
    if (columnManager.removeColumn(index)) {
      renderDynamicColumns();
      updateSmartSuggestions();
      syncDataRows();
      notify("success", "Column removed");
      announceToScreenReader("Column removed.");
    }
  }

  // ============================================
  // SMART SUGGESTIONS
  // ============================================

  function updateSmartSuggestions() {
    var list = document.getElementById("gb-suggestions-list");
    if (!list || !columnManager) return;

    var compatible = columnManager.getCompatibleChartTypes();
    var cols = columnManager.getColumns();
    var suggestions = [];

    if (compatible.length > 0) {
      var names = compatible.map(function (c) { return c.charAt(0).toUpperCase() + c.slice(1); });
      suggestions.push("Current setup supports: " + names.join(", "));
    }

    var valueCols = cols.filter(function (c) { return c.role === "value"; }).length;
    if (valueCols === 1 && cols.length < 4) {
      suggestions.push("Add another value column to enable multi-series charts");
    }
    if (!cols.some(function (c) { return c.type === "date"; })) {
      suggestions.push("Use Date type for time series analysis");
    }
    if (compatible.length === 0) {
      suggestions.push("Current configuration not compatible with any chart type");
    }

    list.innerHTML = suggestions.map(function (s) { return "<li>" + s + "</li>"; }).join("");
  }

  // ============================================
  // MODE MANAGEMENT
  // ============================================

  function syncFromBasicHeaders() {
    var col1 = document.getElementById("gb-column-1");
    var col2 = document.getElementById("gb-column-2");
    columnManager.setColumns([
      { name: (col1 && col1.value) || "Category", type: "text", role: "label" },
      { name: (col2 && col2.value) || "Value", type: "number", role: "value" },
    ]);
  }

  function activateAdvancedMode() {
    state.isAdvancedMode = true;
    syncFromBasicHeaders();
    renderDynamicColumns();
    updateSmartSuggestions();
    syncDataRows();
    logInfo("Advanced mode activated");
  }

  function deactivateAdvancedMode() {
    state.isAdvancedMode = false;
    if (window.GraphBuilderColumnManager) {
      columnManager.setColumns(window.GraphBuilderColumnManager.getDefaults());
    }
    updateSmartSuggestions();
    // Reset data rows back to the original 2-column layout
    if (window.GraphBuilderRowSync) {
      window.GraphBuilderRowSync.resetToBasic();
    }
    logInfo("Advanced mode deactivated");
  }

  // ============================================
  // EVENT SETUP
  // ============================================

  function setupListeners() {
    var panel = document.getElementById("gb-advanced-options");
    var checkbox = document.getElementById("gb-advanced-checkbox");

    if (!panel || !checkbox) return;

    checkbox.addEventListener("change", function () {
      var checked = checkbox.checked;
      checkbox.setAttribute("aria-expanded", String(checked));
      if (checked) {
        panel.classList.add("expanded");
        activateAdvancedMode();
        announceToScreenReader("Advanced options expanded. Configure column types and roles for multi-series charts.");
      } else {
        panel.classList.remove("expanded");
        deactivateAdvancedMode();
        announceToScreenReader("Advanced options collapsed. Using basic two-column configuration.");
      }
    });

    // Basic header sync
    ["gb-column-1", "gb-column-2"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", function () {
          if (state.isAdvancedMode) {
            syncFromBasicHeaders();
            renderDynamicColumns();
            updateSmartSuggestions();
          }
        });
      }
    });

    // Add column button
    var addBtn = document.getElementById("gb-add-column-enhanced");
    if (addBtn) addBtn.addEventListener("click", handleAddColumn);
  }

  // ============================================
  // FORM ENHANCEMENT
  // ============================================

  function enhanceForm(formContainer) {
    try {
      if (state.formEnhanced) { logWarn("Form already enhanced"); return true; }
      var container = formContainer || findFormContainer();
      if (!container) { logWarn("Could not find Graph Builder form container"); return false; }
      var insertion = findInsertionPoint(container);
      if (!insertion) { logWarn("Could not find insertion point"); return false; }

      var panel = createEnhancementPanel();
      insertion.parentNode.insertBefore(panel, insertion.nextSibling);
      enhancedElements.push(panel);

      setupListeners();
      updateSmartSuggestions();

      state.formEnhanced = true;
      logInfo("Form enhancement completed successfully");
      return true;
    } catch (error) {
      logError("Form enhancement failed:", error);
      return false;
    }
  }

  function cleanup() {
    enhancedElements.forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    enhancedElements.length = 0;
    state.formEnhanced = false;
    state.isAdvancedMode = false;
    logInfo("Form enhancement cleaned up");
  }

  // ============================================
  // CSV DELEGATION
  // ============================================

  function processCSV(csvText, options) {
    if (window.GraphBuilderCSVProcessor) {
      return window.GraphBuilderCSVProcessor.processCSV(csvText, options);
    }
    throw new Error("CSV processor module not loaded");
  }

  // ============================================
  // AUTO-INITIALISATION
  // ============================================

  function autoEnhance() {
    if (!columnManager && window.GraphBuilderColumnManager) {
      columnManager = window.GraphBuilderColumnManager.create();
    }
    var container = findFormContainer();
    if (container) {
      logInfo("Auto-enhancing Graph Builder form");
      enhanceForm(container);
    } else {
      logDebug("Graph Builder form not found — skipping auto-enhancement");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoEnhance);
  } else {
    setTimeout(autoEnhance, 100);
  }

  logInfo("Module loaded");

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    enhanceForm: enhanceForm,
    getColumnConfiguration: function () { return columnManager ? columnManager.getColumns() : []; },
    setColumnConfiguration: function (cols, adv) {
      if (!columnManager) return false;
      state.isAdvancedMode = !!adv;
      var ok = columnManager.setColumns(cols);
      if (ok) { renderDynamicColumns(); updateSmartSuggestions(); }
      return ok;
    },
    addColumn: function (col) { return columnManager ? columnManager.addColumn(col) : false; },
    removeColumn: function (idx) { return columnManager ? columnManager.removeColumn(idx) : false; },
    processCSV: processCSV,
    getCompatibleChartTypes: function () { return columnManager ? columnManager.getCompatibleChartTypes() : []; },
    validateConfiguration: function () { return columnManager ? columnManager.validateConfiguration() : { valid: false, errors: ["Not initialised"], warnings: [], roleCounts: {} }; },
    isAdvancedMode: function () { return state.isAdvancedMode; },
    isFormEnhanced: function () { return state.formEnhanced; },
    cleanup: cleanup,
  };
})();

// Attach to window
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderEnhanced;
} else {
  window.GraphBuilderEnhanced = GraphBuilderEnhanced;
}
