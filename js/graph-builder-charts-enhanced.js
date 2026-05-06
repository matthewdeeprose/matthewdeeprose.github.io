/**
 * Graph Builder Enhanced Chart Generator
 *
 * Builds Chart.js configs for multi-series charts from the processed data
 * produced by GraphBuilderDataEnhanced. Delegates layout/padding/title/a11y
 * scaffolding to GraphBuilderCharts.buildConfig via a stub, then overrides
 * data, scales, tooltip, and legend so basic-mode stays untouched.
 *
 * Deps: window.GraphBuilderCharts, window.GraphBuilderDataEnhanced,
 *       Chart.js, chartjs-adapter-date-fns (time x-axis only).
 *
 * @version 1.0.0
 */

const GraphBuilderChartsEnhanced = (function () {
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
      console.error("[GB Charts Enhanced] " + message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[GB Charts Enhanced] " + message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[GB Charts Enhanced] " + message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[GB Charts Enhanced] " + message, ...args);
  }

  // ============================================
  // HELPERS
  // ============================================

  // Chart types that don't use x/y scales — skip scale overrides for these.
  const SCALE_FREE_TYPES = ["pie", "doughnut", "polarArea", "radar"];

  function isScaleFree(chartType) {
    return SCALE_FREE_TYPES.indexOf(chartType) !== -1;
  }

  function hasDateAdapter() {
    // Stable signal that chartjs-adapter-date-fns is loaded.
    const C = typeof window !== "undefined" ? window.Chart : undefined;
    return !!(C && C._adapters && C._adapters._date);
  }

  // ============================================
  // BASE CONFIG SCAFFOLD
  // ============================================

  // Stub data matches basic ChartConfigBuilder's 2-column shape; only the
  // layout/padding/title/plugin scaffold survives — data is overwritten.
  function getBaseScaffold(chartType, options) {
    const stubData = { headers: ["X", "Y"], rows: [["stub", 0]] };

    if (!window.GraphBuilderCharts || typeof window.GraphBuilderCharts.buildConfig !== "function") {
      logError("GraphBuilderCharts.buildConfig not available — cannot build scaffold");
      return null;
    }

    try {
      return window.GraphBuilderCharts.buildConfig(stubData, chartType, options);
    } catch (err) {
      logError("Base scaffold build failed", err);
      return null;
    }
  }

  // ============================================
  // CONFIG OVERRIDES
  // ============================================

  function applyDatasets(config, processedData, chartType, options) {
    config.data.labels = processedData.labels.slice();

    // Stacked line needs fill:true + scales.y.stacked for visible area
    // bands; without fill, lines draw at cumulative positions and read
    // as overlapping rather than stacked.
    const stackedLine =
      chartType === "line" && !!(options && options.stacked === true);
    const isCombo = chartType === "combo";

    config.data.datasets = processedData.datasets.map((ds) => {
      const out = {
        label: ds.label,
        data: ds.data.slice(),
        backgroundColor: ds.backgroundColor,
        borderColor: ds.borderColor || ds.backgroundColor,
        borderWidth: typeof ds.borderWidth === "number" ? ds.borderWidth : 1,
      };
      // Combo: per-dataset .type override, default "bar" baseline.
      let effectiveType;
      if (isCombo) {
        effectiveType =
          ds._columnChartType === "line" || ds._columnChartType === "bar"
            ? ds._columnChartType
            : "bar";
        out.type = effectiveType;
      } else {
        effectiveType = chartType;
      }
      if (effectiveType === "line") {
        out.fill = isCombo ? false : stackedLine;
        out.tension = 0.1;
        // Thicker stroke keeps combo line legible over bar fills.
        if (isCombo) out.borderWidth = 2;
      }
      if (ds._columnType) out._columnType = ds._columnType;
      return out;
    });
  }

  function applyLegend(config, processedData) {
    if (!config.options.plugins) config.options.plugins = {};
    if (!config.options.plugins.legend) config.options.plugins.legend = {};
    // Force legend ON for multi-series. Single-series respects existing default.
    if (processedData.datasets.length > 1) {
      config.options.plugins.legend.display = true;
    }
  }

  function applyXAxisScale(config, processedData) {
    if (!config.options.scales || !config.options.scales.x) return;

    if (processedData.xAxisType !== "time") return;

    if (!hasDateAdapter()) {
      logWarn(
        "xAxisType='time' requested but no Chart.js date adapter detected; " +
          "x-axis will fall back to category scale. Load chartjs-adapter-date-fns."
      );
      return;
    }

    config.options.scales.x.type = "time";
    // displayFormats handle rendering; a ticks.callback would receive the
    // adapter's pre-formatted STRING and re-parsing it via `new Date(...)`
    // defaults to year 2001 in V8. tooltipFormat "PP" = localised medium.
    config.options.scales.x.time = {
      tooltipFormat: "PP",
      displayFormats: {
        millisecond: "HH:mm:ss.SSS", second: "HH:mm:ss", minute: "HH:mm",
        hour: "HH:00", day: "d MMM yyyy", week: "d MMM yyyy",
        month: "MMM yyyy", quarter: "qqq yyyy", year: "yyyy",
      },
    };
    // Cap tick density (wide canvases otherwise render ~45 ticks).
    config.options.scales.x.ticks = config.options.scales.x.ticks || {};
    config.options.scales.x.ticks.autoSkip = true;
    config.options.scales.x.ticks.maxTicksLimit = 12;
  }

  function applyYAxisFormatter(config, processedData) {
    if (!config.options.scales || !config.options.scales.y) return;

    const uniform = processedData.meta && processedData.meta.uniformValueType;
    const formatter = uniform && processedData.formatters && processedData.formatters[uniform];

    if (!uniform) {
      logDebug("Mixed value-column types; using default numeric tick formatting");
      return;
    }
    if (typeof formatter !== "function") return;

    config.options.scales.y.ticks = config.options.scales.y.ticks || {};
    config.options.scales.y.ticks.callback = function (value) {
      return formatter(value);
    };
  }

  // Multi-series charts with a single uniform value type get a generic axis
  // title ("Amount (£)") instead of the first column's name ("Sales"), which
  // would be misleading when the axis represents multiple series. Mixed types
  // and single-series charts keep the basic scaffold's title unchanged.
  function applyYAxisTitle(config, processedData) {
    if (!config.options.scales || !config.options.scales.y) return;

    const multiSeries =
      Array.isArray(processedData.datasets) && processedData.datasets.length > 1;
    if (!multiSeries) return;

    const uniform = processedData.meta && processedData.meta.uniformValueType;
    if (!uniform) return;

    let title;
    if (uniform === "currency") title = "Amount (£)";
    else if (uniform === "percentage") title = "Percentage (%)";
    else return;

    config.options.scales.y.title = config.options.scales.y.title || {};
    config.options.scales.y.title.display = true;
    config.options.scales.y.title.text = title;
  }

  // Stacked bar / stacked line — opt-in via `options.stacked === true`.
  // Sets both axes because Chart.js requires the pair to cooperate even
  // when visually only y stacks. Bar/line only; combo/scatter handled
  // separately (see 3.1.b).
  function applyStacked(config, chartType, options) {
    if (!options || options.stacked !== true) return;
    if (chartType !== "bar" && chartType !== "line") return;
    if (!config.options.scales || !config.options.scales.x || !config.options.scales.y) return;

    config.options.scales.x.stacked = true;
    config.options.scales.y.stacked = true;
    logDebug("Stacked scales applied for chartType=" + chartType);
  }

  function applyTooltipFormatter(config, processedData) {
    if (!config.options.plugins) config.options.plugins = {};
    if (!config.options.plugins.tooltip) config.options.plugins.tooltip = {};
    config.options.plugins.tooltip.callbacks = config.options.plugins.tooltip.callbacks || {};

    const formatters = processedData.formatters || {};
    const uniform = processedData.meta && processedData.meta.uniformValueType;
    const fallback = formatters.number || function (v) { return String(v); };

    config.options.plugins.tooltip.callbacks.label = function (ctx) {
      // Per-dataset type wins; fall back to uniform type, then plain numeric.
      const dsType = ctx.dataset && ctx.dataset._columnType;
      const fmt = (dsType && formatters[dsType]) || (uniform && formatters[uniform]) || fallback;
      // parsed is {x,y} for cartesian, raw value for pie/doughnut.
      let value;
      if (ctx.parsed && typeof ctx.parsed === "object" && "y" in ctx.parsed) value = ctx.parsed.y;
      else if (typeof ctx.parsed !== "undefined") value = ctx.parsed;
      else value = ctx.raw;
      const prefix = ctx.dataset && ctx.dataset.label ? ctx.dataset.label + ": " : "";
      return prefix + fmt(value);
    };
  }

  // ============================================
  // BUBBLE CONFIG (Phase 3.1.c)
  // ============================================

  // Bubble owns its own config path: {x,y,r} point shape (not scalar arrays)
  // breaks applyDatasets/applyXAxisScale. Linear x+y, type-aware formatters.
  function buildBubbleConfig(processedData, options) {
    const meta = processedData.meta || {};
    const fmts = processedData.formatters || {};
    const config = getBaseScaffold("bubble", options);
    if (!config) return null;

    config.data.labels = [];
    config.data.datasets = processedData.datasets.map((ds) => ({
      label: ds.label,
      data: ds.data.map((p) => {
        const out = { x: p.x, y: p.y, r: p.r };
        if (p && p._label != null) out._label = p._label;
        return out;
      }),
      backgroundColor: ds.backgroundColor,
      borderColor: ds.borderColor || ds.backgroundColor,
      borderWidth: typeof ds.borderWidth === "number" ? ds.borderWidth : 1,
    }));

    // Phase 3.1.d: Chart.js treats `r` as canvas pixels — raw values
    // dominate the canvas. Scale to MIN_PX..MAX_PX with sqrt(t) so bubble
    // *area* tracks the datum. Preserve raw value as _rRaw for tooltip.
    const dp = (config.data.datasets[0] && config.data.datasets[0].data) || [];
    if (dp.length) {
      const raws = dp.map((p) => p.r);
      const rMin = Math.min(...raws);
      const rMax = Math.max(...raws);
      const MIN_PX = 6, MAX_PX = 40, range = rMax - rMin;
      dp.forEach((p) => {
        p._rRaw = p.r;
        p.r = range === 0
          ? (MIN_PX + MAX_PX) / 2
          : MIN_PX + (MAX_PX - MIN_PX) * Math.sqrt((p.r - rMin) / range);
      });
    }

    config.options = config.options || {};
    config.options.scales = config.options.scales || {};
    const sx = (config.options.scales.x = config.options.scales.x || {});
    const sy = (config.options.scales.y = config.options.scales.y || {});
    sx.type = "linear";
    sy.type = "linear";

    const numFmt = fmts.number || ((v) => String(v));
    const xFmt = (meta.xType && fmts[meta.xType]) || numFmt;
    const yFmt = (meta.yType && fmts[meta.yType]) || numFmt;
    const rFmt = (meta.radiusType && fmts[meta.radiusType]) || numFmt;
    const xLab = meta.xLabel || "X";
    const yLab = meta.yLabel || "Y";
    const rLab = meta.radiusLabel || "Radius";

    sx.title = { display: true, text: xLab };
    sy.title = { display: true, text: yLab };
    sx.ticks = sx.ticks || {};
    sx.ticks.callback = (v) => xFmt(v);
    sy.ticks = sy.ticks || {};
    sy.ticks.callback = (v) => yFmt(v);

    // Phase 3.1.d: proximity-based tooltips — small bubble markers (6-40 px)
    // are hard to hit with the default intersect:true mode.
    config.options.interaction = { mode: "nearest", intersect: false };

    config.options.plugins = config.options.plugins || {};
    config.options.plugins.legend = config.options.plugins.legend || {};
    config.options.plugins.legend.display = false;
    config.options.plugins.tooltip = config.options.plugins.tooltip || {};
    config.options.plugins.tooltip.callbacks = {
      title: (items) => {
        if (!items || !items.length) return "";
        const raw = items[0].raw;
        return raw && raw._label != null ? String(raw._label) : "";
      },
      label: (ctx) => {
        const raw = ctx.raw || {};
        // Tooltip shows the raw datum (_rRaw), not the scaled visual radius.
        return [
          xLab + ": " + xFmt(raw.x),
          yLab + ": " + yFmt(raw.y),
          rLab + ": " + rFmt(raw._rRaw != null ? raw._rRaw : raw.r),
        ];
      },
    };

    config._gbEnhanced = true;
    config._gbProcessed = processedData;
    config._gbBubble = true;

    logInfo("Built enhanced bubble config: " + dp.length + " pts; x=" + xLab + ", y=" + yLab + ", r=" + rLab);
    return config;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  function buildConfig(processedData, chartType, options) {
    if (!processedData || !Array.isArray(processedData.datasets)) {
      logError("buildConfig called without valid processedData");
      return null;
    }
    if (!chartType) {
      logError("buildConfig called without chartType");
      return null;
    }

    const safeOptions = options || {};

    // Bubble has its own data-shape contract; route early.
    if (chartType === "bubble") {
      return buildBubbleConfig(processedData, safeOptions);
    }

    // Combo + stacked is a Phase 4 consideration. If the user ticks both,
    // prefer combo and warn rather than silently dropping one.
    if (chartType === "combo" && safeOptions.stacked === true) {
      logWarn(
        "Stacked + combo combined is not supported; rendering combo without stacking"
      );
    }

    // Combo isn't a native Chart.js type. The combo container is a bar chart
    // whose individual datasets carry their own .type ("bar" or "line"), so
    // the scaffold uses "bar" while applyDatasets writes per-dataset types.
    const scaffoldChartType = chartType === "combo" ? "bar" : chartType;

    logDebug("Building enhanced chart config", {
      chartType: chartType,
      scaffoldChartType: scaffoldChartType,
      datasets: processedData.datasets.length,
      xAxisType: processedData.xAxisType,
    });

    const config = getBaseScaffold(scaffoldChartType, safeOptions);
    if (!config) return null;

    // Always override data — the stub data must not reach Chart.js.
    applyDatasets(config, processedData, chartType, safeOptions);
    applyLegend(config, processedData);

    // Scale-bearing chart types only get axis / tooltip overrides.
    if (!isScaleFree(chartType)) {
      applyXAxisScale(config, processedData);
      applyYAxisFormatter(config, processedData);
      applyYAxisTitle(config, processedData);
      applyStacked(config, chartType, safeOptions);
    }

    // Tooltip formatting applies across all chart types.
    applyTooltipFormatter(config, processedData);

    // Marker so downstream code (post-generation override in
    // FinalChartCreator) can distinguish our config from the basic-mode
    // scaffold and re-apply our overrides after ChartBuilderState rewrites.
    config._gbEnhanced = true;
    config._gbProcessed = processedData;

    logInfo("Built enhanced config: " + config.data.datasets.length + " dataset(s), chartType=" + chartType);

    return config;
  }

  // Re-apply enhanced overrides to a live Chart.js instance after
  // FinalChartCreator.createUsingChartBuilderState's three-stage rewrite
  // strips functions (state merge serialises them). Restores tick + tooltip
  // callbacks and forces multi-series y-axis title. No-op without _gbEnhanced.
  function applyEnhancedOverrides(chartInstance, config) {
    if (!chartInstance || !config || !config._gbEnhanced) return false;
    if (!chartInstance.options) return false;

    const opts = chartInstance.options;
    const processed = config._gbProcessed || {};
    const formatters = processed.formatters || {};
    const uniform = processed.meta && processed.meta.uniformValueType;
    const xAxisType = processed.xAxisType;
    const multiSeries = Array.isArray(config.data && config.data.datasets)
      ? config.data.datasets.length > 1
      : false;

    // Restore plugin callbacks / display.
    if (!opts.plugins) opts.plugins = {};
    if (!opts.plugins.legend) opts.plugins.legend = {};
    if (multiSeries) opts.plugins.legend.display = true;

    if (!opts.plugins.tooltip) opts.plugins.tooltip = {};
    opts.plugins.tooltip.callbacks = opts.plugins.tooltip.callbacks || {};
    const originalTooltipLabel =
      config.options &&
      config.options.plugins &&
      config.options.plugins.tooltip &&
      config.options.plugins.tooltip.callbacks &&
      config.options.plugins.tooltip.callbacks.label;
    if (typeof originalTooltipLabel === "function") {
      opts.plugins.tooltip.callbacks.label = originalTooltipLabel;
    }

    // Scale-bearing types only.
    if (opts.scales) {
      // Y-axis tick formatter.
      if (opts.scales.y) {
        if (uniform && typeof formatters[uniform] === "function") {
          opts.scales.y.ticks = opts.scales.y.ticks || {};
          const fmt = formatters[uniform];
          opts.scales.y.ticks.callback = function (value) {
            return fmt(value);
          };
        }
        // Multi-series: force a generic y-axis title rather than the
        // first column's name (which the basic post-gen override sets).
        if (multiSeries) {
          opts.scales.y.title = opts.scales.y.title || {};
          opts.scales.y.title.display = true;
          if (uniform === "currency") opts.scales.y.title.text = "Amount (£)";
          else if (uniform === "percentage") opts.scales.y.title.text = "Percentage (%)";
          else if (uniform === "number") opts.scales.y.title.text = "Value";
          else opts.scales.y.title.text = "Value";
        }
      }

      // Do NOT mutate opts.scales.x.type — setting "time" on a live
      // Chart.js instance triggers a proxy-setter recursion loop (Phase 2.5).
    }

    logDebug("Enhanced overrides re-applied to chart instance");
    return true;
  }

  logInfo("Module loaded");

  return {
    buildConfig: buildConfig,
    hasDateAdapter: hasDateAdapter,
    applyEnhancedOverrides: applyEnhancedOverrides,
  };
})();

// Attach to window / exports
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderChartsEnhanced;
} else {
  window.GraphBuilderChartsEnhanced = GraphBuilderChartsEnhanced;
}
