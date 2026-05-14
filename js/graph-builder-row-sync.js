/**
 * Graph Builder Row Sync
 *
 * Synchronises data entry rows (#gb-data-rows) with the enhanced
 * column configuration. When columns are added or removed in
 * advanced mode, existing rows gain or lose input fields to match.
 *
 * Dependencies:
 *   - graph-builder-enhanced.js (reads column config)
 *   - graph-builder-core.js (the existing row / validation system)
 *
 * @version 1.0.0
 */

const GraphBuilderRowSync = (function () {
  "use strict";

  // ─── LOGGING CONFIGURATION ───
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
      console.error("[GB RowSync] " + message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[GB RowSync] " + message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[GB RowSync] " + message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[GB RowSync] " + message, ...args);
  }

  // ─── HELPERS ───
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // currency/percentage → text + inputmode=decimal (allows "£1,200", "42%");
  // validate/extract strip symbols so raw forms are accepted at entry time.
  function inputTypeForColumn(col) {
    switch (col.type) {
      case "number":
        return { type: "number", step: "any" };
      case "currency":
      case "percentage":
        return { type: "text", step: "", inputmode: "decimal" };
      case "date":
        return { type: "date", step: "" };
      default:
        return { type: "text", step: "" };
    }
  }

  // ─── VALIDATION BRIDGE ───
  /**
   * Trigger the core Graph Builder's validation + preview pipeline.
   * The core controller listens for input events on existing inputs,
   * but dynamically added inputs need this explicit bridge.
   */
  function triggerCoreValidation() {
    // Find the core controller's validateFormData path
    var dataRows = document.getElementById("gb-data-rows");
    if (!dataRows) return;

    var rows = dataRows.querySelectorAll(".gb-data-row");
    if (!rows.length) return;

    // Use GraphBuilderData to validate and extract
    if (window.GraphBuilderData) {
      var validation = window.GraphBuilderData.validateFormData(rows);

      // Update the Next button state
      var nextBtn = document.getElementById("gb-data-next");
      if (nextBtn) nextBtn.disabled = !validation.valid;

      // If valid, regenerate preview
      if (validation.valid) {
        var col1El = document.getElementById("gb-column-1");
        var col2El = document.getElementById("gb-column-2");
        var columnHeaders = {
          col1Name: (col1El && col1El.value) || "Category",
          col2Name: (col2El && col2El.value) || "Value",
        };

        var chartData = window.GraphBuilderData.extractFormData(rows, columnHeaders);
        if (chartData.rows.length >= 2 && window.GraphBuilderUI) {
          window.GraphBuilderUI.showPreview(chartData);
        }

        // Update the core controller's state so the "Choose Chart Type"
        // navigation gate passes. Without this, advanced-mode users are
        // blocked with a "Please add data first" error even when rows are
        // valid, because basic mode writes chartData via generateFormData()
        // which row-sync's input listener bypasses.
        if (
          chartData.rows.length >= 2 &&
          window.GraphBuilder &&
          window.GraphBuilder._state
        ) {
          window.GraphBuilder._state.chartData = chartData;
        }
      }
    }
  }

  // ─── CORE LOGIC ───
  var lastColumnCount = 2; // tracks previous count so we know when to act

  /**
   * Build a single input-group div for a given column + row.
   * Returns an HTML string matching the existing .gb-input-group pattern.
   */
  function buildInputGroup(rowId, colIndex, column, rowNumber) {
    var inputId = rowId + "-col" + (colIndex + 1);
    var helpId = inputId + "-help";
    var attrs = inputTypeForColumn(column);
    var stepAttr = attrs.step ? ' step="' + attrs.step + '"' : "";
    var inputmodeAttr = attrs.inputmode ? ' inputmode="' + attrs.inputmode + '"' : "";
    var label = escapeHtml(column.name);

    return (
      '<div class="gb-input-group" data-col-index="' + colIndex + '">' +
      '<label for="' + inputId + '" class="gb-row-label">' + label + ":</label>" +
      '<input type="' + attrs.type + '" id="' + inputId + '" name="' + inputId + '"' +
      stepAttr + inputmodeAttr + ' required aria-describedby="' + helpId + '">' +
      '<span id="' + helpId + '" class="sr-only">Enter ' +
      label.toLowerCase() + " for row " + rowNumber + "</span>" +
      "</div>"
    );
  }

  /**
   * Update the grid on a data row to accommodate N columns.
   * Sets an inline grid-template-columns for wide viewports and a
   * data-enhanced-cols attribute so the CSS media query can override
   * to a stacked layout on narrow viewports.
   */
  function setRowGrid(rowEl, colCount) {
    if (colCount > 2) {
      var cols = [];
      for (var i = 0; i < colCount; i++) cols.push("1fr");
      cols.push("auto");
      rowEl.style.gridTemplateColumns = cols.join(" ");
      rowEl.setAttribute("data-enhanced-cols", colCount);
    } else {
      // Basic mode — remove overrides, let original CSS rule apply
      rowEl.style.gridTemplateColumns = "";
      rowEl.removeAttribute("data-enhanced-cols");
    }
  }

  /**
   * Synchronise all existing data rows with the current column config.
   * - Adds missing input groups for new columns
   * - Removes excess input groups for removed columns
   * - Updates labels for renamed/retyped columns
   */
  function syncRows(columns) {
    var container = document.getElementById("gb-data-rows");
    if (!container) return;

    var rows = container.querySelectorAll(".gb-data-row");
    if (rows.length === 0) return;

    logDebug("Syncing " + rows.length + " rows to " + columns.length + " columns");

    rows.forEach(function (row) {
      var rowId = row.getAttribute("data-row-id");
      var rowNumber = rowId ? rowId.replace("gb-row-", "") : "?";
      var groups = row.querySelectorAll(".gb-input-group");
      var removeBtn = row.querySelector(".gb-remove-row-button");
      var currentColCount = groups.length;

      // --- add missing columns ---
      for (var i = currentColCount; i < columns.length; i++) {
        var html = buildInputGroup(rowId, i, columns[i], rowNumber);
        var tmp = document.createElement("div");
        tmp.innerHTML = html;
        var newGroup = tmp.firstElementChild;

        // Insert before the remove button (last child)
        if (removeBtn) {
          row.insertBefore(newGroup, removeBtn);
        } else {
          row.appendChild(newGroup);
        }

        // Attach validation listener so typing triggers preview update
        var newInput = newGroup.querySelector("input");
        if (newInput) {
          newInput.addEventListener("input", triggerCoreValidation);
          attachBlurFormatter(newInput);  // 3.2.b-2
        }
      }

      // --- remove excess columns (from the end, before the button) ---
      // Re-query after potential additions
      groups = row.querySelectorAll(".gb-input-group");
      while (groups.length > columns.length) {
        var last = groups[groups.length - 1];
        // Preserve any user data? No — the column was removed, data is invalid.
        row.removeChild(last);
        groups = row.querySelectorAll(".gb-input-group");
      }

      // --- update labels, types, sr-only text for each column ---
      groups = row.querySelectorAll(".gb-input-group");
      groups.forEach(function (group, idx) {
        if (idx >= columns.length) return;
        var col = columns[idx];
        var label = group.querySelector("label");
        var input = group.querySelector("input");
        var help = group.querySelector(".sr-only");
        var attrs = inputTypeForColumn(col);
        var inputId = rowId + "-col" + (idx + 1);

        if (label) {
          label.textContent = col.name + ":";
          label.setAttribute("for", inputId);
        }
        if (input) {
          input.id = inputId;
          input.name = inputId;
          if (input.type !== attrs.type) input.type = attrs.type;
          if (attrs.step) {
            input.setAttribute("step", attrs.step);
          } else {
            input.removeAttribute("step");
          }
          attachBlurFormatter(input);  // 3.2.b-2 idempotent
        }
        if (help) {
          help.textContent = "Enter " + col.name.toLowerCase() + " for row " + rowNumber;
        }
      });

      // Update grid
      setRowGrid(row, columns.length);
    });

    lastColumnCount = columns.length;
  }

  /**
   * Also update the .gb-form-headers grid to match the column count
   * (only when in advanced mode with > 2 columns).
   */
  function syncFormHeaders(columns) {
    var headers = document.querySelector(".gb-form-headers");
    if (!headers) return;

    if (columns.length > 2) {
      // In advanced mode the original 2-column headers still show;
      // just note that the data rows now have more columns.
      // We don't hide the original headers — they remain the
      // "first two column" editors and sync via the existing listeners.
    }
  }

  // ─── MONKEY-PATCH addDataRow ───
  // The existing GraphBuilder.addDataRow creates 2-column rows; in advanced
  // mode we intercept the Add Row click to create rows with the right count.
  var addRowIntercepted = false;

  function interceptAddRow() {
    if (addRowIntercepted) return;
    var btn = document.getElementById("gb-add-row");
    if (!btn) return;

    // Clone to remove existing listeners, then re-attach
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener("click", function () {
      var enhanced = window.GraphBuilderEnhanced;
      if (enhanced && enhanced.isAdvancedMode()) {
        addEnhancedRow();
      } else {
        // Delegate to the original controller
        if (window.GraphBuilder && window.GraphBuilder._controller) {
          window.GraphBuilder._controller.addDataRow();
        } else {
          // Fallback: the core controller may not expose _controller.
          // Re-dispatch to original logic by triggering the core path.
          logWarn("Cannot delegate to original addDataRow — falling back");
        }
      }
    });

    addRowIntercepted = true;
    logDebug("Add Row button intercepted for advanced mode");
  }

  // 3.2.b-2: Reformat numeric input on blur with thousand separators (and
  // currency/percent symbol). Always attached — the handler checks the
  // CURRENT column at the input's DOM position at blur time, so columns
  // changing type or being added/removed don't leave stale formatting.
  // Currency input: blur "1500000" → "£1,500,000" (symbol from col.symbol).
  // Percentage input: blur "12.5"   → "12.5%".
  // parseValue's NUMERIC_STRIP_RE strips both forms so re-parsing on
  // Generate works whether the field is left formatted or wiped.
  function attachBlurFormatter(inp) {
    if (inp.dataset.gbBlurAttached === "1") return;  // idempotent
    inp.dataset.gbBlurAttached = "1";
    inp.addEventListener("blur", function () {
      var raw = inp.value.trim();
      if (!raw) return;
      var group = inp.closest(".gb-input-group");
      var row = group && group.closest(".gb-data-row");
      if (!row) return;
      var groups = row.querySelectorAll(".gb-input-group");
      var pos = Array.prototype.indexOf.call(groups, group);
      if (pos < 0) return;
      var enhanced = window.GraphBuilderEnhanced;
      var col = enhanced && enhanced.getColumnConfiguration()[pos];
      if (!col || (col.type !== "currency" && col.type !== "percentage")) return;
      var n = parseFloat(raw.replace(/[£$€¥₹%,\s]/g, ""));
      if (isNaN(n)) return;
      var fmt = Number(n).toLocaleString("en-GB", {
        minimumFractionDigits: 0, maximumFractionDigits: 2,
      });
      if (col.type === "currency") {
        var sym = (typeof col.symbol === "string" && col.symbol) ? col.symbol : "£";
        inp.value = sym + fmt;
      } else {
        inp.value = fmt + "%";
      }
    });
  }

  /** Create a new data row with the enhanced column set */
  function addEnhancedRow() {
    var container = document.getElementById("gb-data-rows");
    if (!container) return;

    var enhanced = window.GraphBuilderEnhanced;
    if (!enhanced) return;

    var columns = enhanced.getColumnConfiguration();

    // Determine row number from existing rows
    var existing = container.querySelectorAll(".gb-data-row");
    var maxNum = 0;
    existing.forEach(function (r) {
      var id = r.getAttribute("data-row-id") || "";
      var num = parseInt(id.replace("gb-row-", ""), 10);
      if (num > maxNum) maxNum = num;
    });
    var rowNum = maxNum + 1;
    var rowId = "gb-row-" + rowNum;

    var rowDiv = document.createElement("div");
    rowDiv.className = "gb-data-row";
    rowDiv.setAttribute("data-row-id", rowId);

    var html = "";
    columns.forEach(function (col, idx) {
      html += buildInputGroup(rowId, idx, col, rowNum);
    });

    // Remove button (matches existing pattern)
    html +=
      '<button type="button" class="gb-remove-row-button" ' +
      "onclick=\"window.GraphBuilder.removeDataRow('" + rowId + "')\" " +
      'aria-label="Remove row ' + rowNum + '">' +
      '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg" ' +
      'aria-hidden="true" class="gb-remove-icon">' +
      '<g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" ' +
      'stroke-linejoin="round" transform="translate(3 2)">' +
      '<path d="m2.5 2.5h10v12c0 1.1045695-.8954305 2-2 2h-6c-1.1045695 0-2-.8954305-2-2z' +
      'm5-2c1.0543618 0 1.91816512.81587779 1.99451426 1.85073766l.00548574.14926234h-4' +
      'c0-1.1045695.8954305-2 2-2z"></path>' +
      '<path d="m.5 2.5h14"></path>' +
      '<path d="m5.5 5.5v8"></path><path d="m9.5 5.5v8"></path>' +
      "</g></svg> Remove</button>";

    rowDiv.innerHTML = html;
    setRowGrid(rowDiv, columns.length);
    container.appendChild(rowDiv);

    // Attach validation listeners to every input in the new row.
    // Without this, typing in rows added via the Add-row button never
    // triggers validation or preview/chartData updates — rows 3+ are
    // invisible to the rest of the Graph Builder.
    var inputs = rowDiv.querySelectorAll("input");
    inputs.forEach(function (inp) {
      inp.addEventListener("input", triggerCoreValidation);
      attachBlurFormatter(inp);  // 3.2.b-2
    });

    // Focus first input of new row
    var firstInput = rowDiv.querySelector("input");
    if (firstInput) firstInput.focus();

    // Revalidate immediately so the new (empty) row is counted in the
    // row totals even before the user starts typing.
    triggerCoreValidation();

    logDebug("Added enhanced row: " + rowId + " with " + columns.length + " columns");
  }

  // 3.2.b-3: keep preview stats in sync with row add/remove. A single
  // MutationObserver on the rows container fires on any childList change,
  // covering addEnhancedRow + the core's removeDataRow without coupling
  // to either call site. Validation-pipeline showPreview() already keeps
  // stats fresh on input edits; this observer covers the gap where add
  // (empty row) and remove don't pass through validateFormData → showPreview.
  var statsObserverInstalled = false;
  function setupPreviewStatsObserver() {
    if (statsObserverInstalled) return;
    var container = document.getElementById("gb-data-rows");
    if (!container || !window.MutationObserver) return;
    var observer = new MutationObserver(function () {
      if (window.GraphBuilderUI && typeof window.GraphBuilderUI.refreshPreviewStats === "function") {
        window.GraphBuilderUI.refreshPreviewStats();
      }
    });
    observer.observe(container, { childList: true });
    statsObserverInstalled = true;
    logDebug("Preview stats observer installed");
  }

  // ─── PUBLIC API — called by GraphBuilderEnhanced ───
  /**
   * Call this whenever the column configuration changes.
   * @param {Array} columns - Current column array from ColumnManager
   */
  function onColumnsChanged(columns) {
    if (!columns || columns.length < 2) return;
    syncRows(columns);
    syncFormHeaders(columns);
    interceptAddRow();
    setupPreviewStatsObserver();  // 3.2.b-3
  }

  /**
   * Reset data rows back to 2-column layout (when leaving advanced mode).
   */
  function resetToBasic() {
    var defaults = window.GraphBuilderColumnManager
      ? window.GraphBuilderColumnManager.getDefaults()
      : [
          { name: "Category", type: "text", role: "label" },
          { name: "Value", type: "number", role: "value" },
        ];
    syncRows(defaults);

    // Restore original grid on all rows
    var container = document.getElementById("gb-data-rows");
    if (container) {
      container.querySelectorAll(".gb-data-row").forEach(function (row) {
        row.style.gridTemplateColumns = "";
      });
    }
    logInfo("Data rows reset to basic 2-column layout");
  }

  logInfo("Module loaded");

  return {
    onColumnsChanged: onColumnsChanged,
    resetToBasic: resetToBasic,
    addEnhancedRow: addEnhancedRow,
  };
})();

// Attach to window
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderRowSync;
} else {
  window.GraphBuilderRowSync = GraphBuilderRowSync;
}
