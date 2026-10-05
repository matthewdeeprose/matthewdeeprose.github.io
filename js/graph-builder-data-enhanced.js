/**
 * Graph Builder Enhanced Data Processor
 *
 * Transforms multi-column form data (from Phase 1 extraction) into
 * Chart.js-consumable datasets with type-aware value parsing
 * (currency, percentage, date, number) and per-series colour assignment.
 *
 * Pure data in, pure data out. No DOM access, no Chart.js dependency.
 *
 * Consumes:
 *   - rawData: { headers: [...], rows: [[...], ...] } from GraphBuilderData.extractFormData
 *   - columnConfig: [{ name, type, role }, ...] from GraphBuilderEnhanced.getColumnConfiguration
 *
 * Produces:
 *   { labels, datasets, xAxisType, formatters, meta }
 *
 * Dependencies: None
 *
 * @version 1.0.0
 */

const GraphBuilderDataEnhanced = (function () {
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
      console.error("[GB Data Enhanced] " + message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[GB Data Enhanced] " + message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[GB Data Enhanced] " + message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[GB Data Enhanced] " + message, ...args);
  }

  // ============================================
  // COLOUR PALETTE
  // ============================================

  // Accessible high-contrast palette, optimised for series distinction.
  const SERIES_PALETTE = ["#005c84", "#d45087", "#2f4b7c", "#ff7c43", "#665191", "#a05195"];

  function getSeriesColours(count) {
    if (typeof count !== "number" || count < 1) return [];
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(SERIES_PALETTE[i % SERIES_PALETTE.length]);
    }
    return out;
  }

  // ============================================
  // VALUE PARSING
  // ============================================

  // Strip currency symbols, percentage signs, and thousand separators
  // for numeric parsing. British spelling in variable names.
  const NUMERIC_STRIP_RE = /[£$€¥₹%,\s]/g;

  function parseValue(raw, type) {
    // Already-parsed numbers (extractFormData strips symbols in advanced mode)
    if (typeof raw === "number") {
      return isNaN(raw) ? null : raw;
    }

    if (raw === null || raw === undefined) return null;

    const str = String(raw).trim();
    if (!str) return null;

    switch (type) {
      case "number":
      case "currency":
      case "percentage": {
        const cleaned = str.replace(NUMERIC_STRIP_RE, "");
        if (!cleaned) return null;
        const n = parseFloat(cleaned);
        return isNaN(n) ? null : n;
      }
      case "date": {
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
      }
      case "text":
      default:
        return str;
    }
  }

  // ============================================
  // FORMATTERS — wire into ticks.callback / tooltip.callbacks
  // ============================================

  function formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return "";
    return Number(value).toLocaleString("en-GB");
  }

  // 3.2.b-1: optional `symbol` arg. Default "£" preserves pre-3.2.b call
  // sites (Test 2 byte-identity). Empty string renders a bare number.
  function formatCurrency(value, symbol) {
    if (value === null || value === undefined || isNaN(value)) return "";
    var sym = (typeof symbol === "string") ? symbol : "£";
    return sym + Number(value).toLocaleString("en-GB", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function formatPercentage(value) {
    if (value === null || value === undefined || isNaN(value)) return "";
    return Number(value).toLocaleString("en-GB") + "%";
  }

  function formatDate(value) {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-GB");
  }

  function formatText(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function getFormatters() {
    return {
      number: formatNumber,
      currency: formatCurrency,
      percentage: formatPercentage,
      date: formatDate,
      text: formatText,
    };
  }

  // ============================================
  // ROLE RESOLUTION
  // ============================================

  // Resolves which column index is the label, which are values, and which are
  // grouping. Falls back per the prompt: if no explicit label, first column;
  // if no explicit value columns, all non-label numeric-compatible columns.
  function resolveRoles(columnConfig) {
    const cols = Array.isArray(columnConfig) ? columnConfig : [];

    let labelIdx = cols.findIndex((c) => c && c.role === "label");
    if (labelIdx === -1) {
      labelIdx = 0;
      logDebug("No explicit label column; defaulting to index 0");
    }

    const numericTypes = ["number", "currency", "percentage"];
    let valueIndices = cols
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c && c.role === "value")
      .map(({ i }) => i);

    if (valueIndices.length === 0) {
      valueIndices = cols
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => i !== labelIdx && c && numericTypes.indexOf(c.type) !== -1)
        .map(({ i }) => i);
      if (valueIndices.length > 0) {
        logDebug("No explicit value columns; inferred " + valueIndices.length + " numeric columns");
      }
    }

    const groupingIndices = cols
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c && c.role === "grouping")
      .map(({ i }) => i);

    return { labelIdx, valueIndices, groupingIndices };
  }

  // ============================================
  // MAIN PROCESSOR
  // ============================================

  function processData(rawData, columnConfig) {
    if (!rawData || !Array.isArray(rawData.rows)) {
      logWarn("processData called without valid rawData.rows");
      return emptyResult();
    }
    if (!Array.isArray(columnConfig) || columnConfig.length === 0) {
      logWarn("processData called without column configuration");
      return emptyResult();
    }

    const headers = Array.isArray(rawData.headers) ? rawData.headers : [];
    const rows = rawData.rows;

    const { labelIdx, valueIndices, groupingIndices } = resolveRoles(columnConfig);

    if (valueIndices.length === 0) {
      logWarn("No value columns could be resolved from column configuration");
      return emptyResult();
    }

    const labelCol = columnConfig[labelIdx] || { type: "text" };
    const xAxisType = labelCol.type === "date" ? "time" : "category";

    // Chronological sort for time-axis: TimeScale positions ticks by date
    // but line charts connect points in array order — unsorted input zig-zags.
    let orderedRows = rows;
    if (xAxisType === "time") {
      orderedRows = rows.slice().sort((a, b) => {
        const da = parseValue(Array.isArray(a) ? a[labelIdx] : undefined, "date");
        const db = parseValue(Array.isArray(b) ? b[labelIdx] : undefined, "date");
        const ta = da instanceof Date ? da.getTime() : Number.POSITIVE_INFINITY;
        const tb = db instanceof Date ? db.getTime() : Number.POSITIVE_INFINITY;
        return ta - tb;
      });
    }

    const labels = orderedRows.map((r) => {
      const raw = Array.isArray(r) ? r[labelIdx] : undefined;
      return parseValue(raw, labelCol.type);
    });

    const colours = getSeriesColours(valueIndices.length);

    const datasets = valueIndices.map((colIdx, seriesIdx) => {
      const col = columnConfig[colIdx] || {};
      const data = orderedRows.map((r) => {
        const raw = Array.isArray(r) ? r[colIdx] : undefined;
        return parseValue(raw, col.type);
      });
      const ds = {
        label: (headers[colIdx] || col.name || "Series " + (seriesIdx + 1)),
        data: data,
        backgroundColor: colours[seriesIdx],
        borderColor: colours[seriesIdx],
        borderWidth: 1,
        _columnType: col.type || "number",
        _columnIndex: colIdx,
      };
      // 3.1.b: per-column chart-type override for combo charts.
      if (col.chartType === "bar" || col.chartType === "line") {
        ds._columnChartType = col.chartType;
      }
      // 3.2.b-1: per-column currency symbol for tooltip + legend rendering.
      // Default "£" matches column-manager's getColumns fallback.
      if (col.type === "currency") {
        ds._columnSymbol = (typeof col.symbol === "string" && col.symbol) ? col.symbol : "£";
      }
      return ds;
    });

    // Uniform value type across all datasets (for shared tick formatting);
    // null means mixed — the chart generator falls back to numeric.
    const valueTypes = valueIndices.map((i) => (columnConfig[i] && columnConfig[i].type) || "number");
    const uniformValueType = valueTypes.every((t) => t === valueTypes[0]) ? valueTypes[0] : null;

    // 3.2.b-1: shared currency symbol when uniformValueType === "currency".
    // null means mixed — chart layer falls back per CURRENCY_DISPLAY_OPTIONS.
    let uniformValueSymbol = null;
    if (uniformValueType === "currency") {
      const syms = valueIndices.map((i) => {
        const c = columnConfig[i] || {};
        return (typeof c.symbol === "string" && c.symbol) ? c.symbol : "£";
      });
      uniformValueSymbol = syms.every((s) => s === syms[0]) ? syms[0] : null;
    }

    const result = {
      labels: labels,
      datasets: datasets,
      xAxisType: xAxisType,
      formatters: getFormatters(),
      meta: {
        labelIndex: labelIdx,
        labelType: labelCol.type || "text",
        valueIndices: valueIndices,
        valueTypes: valueTypes,
        uniformValueType: uniformValueType,
        uniformValueSymbol: uniformValueSymbol,
        groupingIndices: groupingIndices,
        rowCount: rows.length,
      },
    };

    logInfo(
      "Processed " +
        rows.length +
        " rows into " +
        datasets.length +
        " dataset(s); xAxisType=" +
        xAxisType +
        (uniformValueType ? "; uniform value type=" + uniformValueType : "; mixed value types")
    );

    return result;
  }

  function emptyResult() {
    return {
      labels: [],
      datasets: [],
      xAxisType: "category",
      formatters: getFormatters(),
      meta: {
        labelIndex: -1,
        labelType: "text",
        valueIndices: [],
        valueTypes: [],
        uniformValueType: null,
        uniformValueSymbol: null,
        groupingIndices: [],
        rowCount: 0,
      },
    };
  }

  // ============================================
  // BUBBLE PROCESSOR (Phase 3.1.c)
  // ============================================

  // Bubble: {x,y,r} point objects, not scalar arrays. First two value-role
  // cols → x/y; radius-role → r. Negative/zero radii clamp to 1.
  function processBubbleData(rawData, columnConfig) {
    if (!rawData || !Array.isArray(rawData.rows)) {
      logWarn("processBubbleData called without valid rawData.rows");
      return emptyBubbleResult();
    }
    if (!Array.isArray(columnConfig) || columnConfig.length === 0) {
      logWarn("processBubbleData called without column configuration");
      return emptyBubbleResult();
    }

    const headers = Array.isArray(rawData.headers) ? rawData.headers : [];
    const rows = rawData.rows;

    const labelIdx = columnConfig.findIndex((c) => c && c.role === "label");
    const valueIndices = columnConfig
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c && c.role === "value")
      .map(({ i }) => i);
    const radiusIdx = columnConfig.findIndex((c) => c && c.role === "radius");

    if (valueIndices.length < 2) {
      logWarn("Bubble chart requires 2 value columns (x, y); found " + valueIndices.length);
      return emptyBubbleResult();
    }
    if (radiusIdx === -1) {
      logWarn("Bubble chart requires a column with role 'radius'");
      return emptyBubbleResult();
    }

    const xIdx = valueIndices[0];
    const yIdx = valueIndices[1];
    const xCol = columnConfig[xIdx] || { type: "number" };
    const yCol = columnConfig[yIdx] || { type: "number" };
    const rCol = columnConfig[radiusIdx] || { type: "number" };
    const labelCol = labelIdx !== -1 ? columnConfig[labelIdx] : null;

    let negativeRadiusCount = 0;
    const data = rows.map((r) => {
      const xRaw = Array.isArray(r) ? r[xIdx] : undefined;
      const yRaw = Array.isArray(r) ? r[yIdx] : undefined;
      const rRaw = Array.isArray(r) ? r[radiusIdx] : undefined;
      const x = parseValue(xRaw, xCol.type);
      const y = parseValue(yRaw, yCol.type);
      let rVal = parseValue(rRaw, rCol.type);
      if (typeof rVal !== "number" || isNaN(rVal)) rVal = 1;
      if (rVal < 1) {
        if (rVal < 0) negativeRadiusCount += 1;
        rVal = 1;
      }
      const point = { x: x, y: y, r: rVal };
      if (labelCol) {
        const labelRaw = Array.isArray(r) ? r[labelIdx] : undefined;
        point._label = parseValue(labelRaw, labelCol.type);
      }
      return point;
    });

    if (negativeRadiusCount > 0) {
      logWarn(
        "Bubble chart had " +
          negativeRadiusCount +
          " negative radius value(s); clamped to 1"
      );
    }

    const colours = getSeriesColours(1);
    const datasetLabel = headers[radiusIdx] || rCol.name || "Bubbles";
    const datasets = [
      {
        label: datasetLabel,
        data: data,
        backgroundColor: colours[0],
        borderColor: colours[0],
        borderWidth: 1,
        _columnType: yCol.type || "number",
        _columnIndex: yIdx,
      },
    ];

    const result = {
      datasets: datasets,
      formatters: getFormatters(),
      meta: {
        xIndex: xIdx,
        yIndex: yIdx,
        radiusIndex: radiusIdx,
        labelIndex: labelIdx,
        xType: xCol.type || "number",
        yType: yCol.type || "number",
        radiusType: rCol.type || "number",
        labelType: labelCol ? labelCol.type || "text" : null,
        xLabel: headers[xIdx] || xCol.name || "X",
        yLabel: headers[yIdx] || yCol.name || "Y",
        radiusLabel: headers[radiusIdx] || rCol.name || "Radius",
        rowCount: rows.length,
      },
    };

    logInfo(
      "Processed " +
        rows.length +
        " rows into 1 bubble dataset; x=" +
        result.meta.xLabel +
        ", y=" +
        result.meta.yLabel +
        ", r=" +
        result.meta.radiusLabel
    );

    return result;
  }

  function emptyBubbleResult() {
    return {
      datasets: [],
      formatters: getFormatters(),
      meta: {
        xIndex: -1,
        yIndex: -1,
        radiusIndex: -1,
        labelIndex: -1,
        xType: "number",
        yType: "number",
        radiusType: "number",
        labelType: null,
        xLabel: "X",
        yLabel: "Y",
        radiusLabel: "Radius",
        rowCount: 0,
      },
    };
  }

  // ============================================
  // SCATTER PROCESSOR (B-2b)
  // ============================================

  // Scatter: ONE dataset of {x,y} points, not one series per value column.
  // First two value-role cols → x/y; the label column rides on each point as
  // _label. A row with no usable x or y is dropped (Chart.js cannot place it).
  // Fewer than two value columns returns no datasets so the caller falls back
  // to the default path, as bubble does.
  function processScatterData(rawData, columnConfig) {
    if (!rawData || !Array.isArray(rawData.rows)) {
      logWarn("processScatterData called without valid rawData.rows");
      return emptyScatterResult();
    }
    if (!Array.isArray(columnConfig) || columnConfig.length === 0) {
      logWarn("processScatterData called without column configuration");
      return emptyScatterResult();
    }

    const headers = Array.isArray(rawData.headers) ? rawData.headers : [];
    const rows = rawData.rows;
    const { labelIdx, valueIndices } = resolveRoles(columnConfig);

    if (valueIndices.length < 2) {
      logWarn("Scatter chart requires 2 value columns (x, y); found " + valueIndices.length);
      return emptyScatterResult();
    }

    const xIdx = valueIndices[0];
    const yIdx = valueIndices[1];
    const xCol = columnConfig[xIdx] || { type: "number" };
    const yCol = columnConfig[yIdx] || { type: "number" };
    const labelCol = columnConfig[labelIdx] || null;
    const hasLabel = labelCol !== null && labelIdx !== xIdx && labelIdx !== yIdx;

    const isCoordinate = (v) => typeof v === "number" && !isNaN(v);
    const points = [];
    const labels = [];
    let droppedCount = 0;
    rows.forEach((r) => {
      const x = parseValue(Array.isArray(r) ? r[xIdx] : undefined, xCol.type);
      const y = parseValue(Array.isArray(r) ? r[yIdx] : undefined, yCol.type);
      if (!isCoordinate(x) || !isCoordinate(y)) {
        droppedCount += 1;
        return;
      }
      const point = { x: x, y: y };
      if (hasLabel) {
        point._label = parseValue(Array.isArray(r) ? r[labelIdx] : undefined, labelCol.type);
        labels.push(point._label);
      }
      points.push(point);
    });

    if (droppedCount > 0) {
      logWarn("Scatter chart dropped " + droppedCount + " row(s) with no usable x or y");
    }

    const colours = getSeriesColours(1);
    const xLabel = headers[xIdx] || xCol.name || "X";
    const yLabel = headers[yIdx] || yCol.name || "Y";

    const result = {
      labels: labels,
      datasets: [
        {
          label: yLabel,
          data: points,
          backgroundColor: colours[0],
          borderColor: colours[0],
          borderWidth: 1,
          _columnType: yCol.type || "number",
          _columnIndex: yIdx,
        },
      ],
      xAxisType: "linear",
      formatters: getFormatters(),
      meta: {
        labelIndex: hasLabel ? labelIdx : -1,
        labelType: hasLabel ? labelCol.type || "text" : null,
        xIndex: xIdx,
        yIndex: yIdx,
        valueIndices: [xIdx, yIdx],
        xType: xCol.type || "number",
        yType: yCol.type || "number",
        valueTypes: [xCol.type || "number", yCol.type || "number"],
        uniformValueType: (xCol.type || "number") === (yCol.type || "number") ? xCol.type || "number" : null,
        uniformValueSymbol: null,
        xLabel: xLabel,
        yLabel: yLabel,
        rowCount: rows.length,
        droppedRowCount: droppedCount,
      },
    };

    logInfo("Processed " + rows.length + " rows into 1 scatter dataset of " + points.length + " point(s); x=" + xLabel + ", y=" + yLabel);

    return result;
  }

  function emptyScatterResult() {
    return {
      labels: [],
      datasets: [],
      xAxisType: "linear",
      formatters: getFormatters(),
      meta: {
        labelIndex: -1,
        labelType: null,
        xIndex: -1,
        yIndex: -1,
        valueIndices: [],
        xType: "number",
        yType: "number",
        valueTypes: [],
        uniformValueType: null,
        uniformValueSymbol: null,
        xLabel: "X",
        yLabel: "Y",
        rowCount: 0,
        droppedRowCount: 0,
      },
    };
  }

  logInfo("Module loaded");

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    processData: processData,
    processBubbleData: processBubbleData,
    processScatterData: processScatterData,
    parseValue: parseValue,
    getSeriesColours: getSeriesColours,
    getFormatters: getFormatters,
  };
})();

// Attach to window / exports
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderDataEnhanced;
} else {
  window.GraphBuilderDataEnhanced = GraphBuilderDataEnhanced;
}
