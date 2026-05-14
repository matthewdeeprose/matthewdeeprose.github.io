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

  // ─── HELPERS ───
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

  // ─── CURRENCY DISPLAY OPTIONS (Phase 3.2.b-1) ───
  // Single-knob config for the two open UX questions. Flip either string to
  // change behaviour — no other code edits needed.
  //   mixedSymbolStrategy: "plain" (no symbol) | "first" | "all" ("£/$")
  //   legendSymbolSuffix:  "always" | "mixed-only" | "never"
  const CURRENCY_DISPLAY_OPTIONS = {
    mixedSymbolStrategy: "plain",
    legendSymbolSuffix: "always",
  };

  // Resolves {tickSym, titleSym} for currency uniformity; null = not currency.
  // tickSym=null means "render plain numeric ticks" (mixed + plain strategy).
  function resolveCurrencyDisplay(processedData) {
    const meta = processedData.meta || {};
    if (meta.uniformValueType !== "currency") return null;
    if (meta.uniformValueSymbol) {
      return { tickSym: meta.uniformValueSymbol, titleSym: meta.uniformValueSymbol };
    }
    const syms = (processedData.datasets || []).map((d) => d._columnSymbol).filter(Boolean);
    switch (CURRENCY_DISPLAY_OPTIONS.mixedSymbolStrategy) {
      case "first": return { tickSym: syms[0] || "£", titleSym: syms[0] || "£" };
      case "all":   return { tickSym: syms[0] || "£", titleSym: Array.from(new Set(syms)).join("/") };
      default:      return { tickSym: null, titleSym: null };
    }
  }

  // generateLabels factory — appends " (sym)" to currency datasets in legend.
  function makeSymbolSuffixGenerateLabels() {
    return function (chart) {
      const def = window.Chart && window.Chart.defaults && window.Chart.defaults.plugins
        && window.Chart.defaults.plugins.legend && window.Chart.defaults.plugins.legend.labels;
      const items = (def && def.generateLabels) ? def.generateLabels(chart) : [];
      items.forEach((it, i) => {
        const ds = chart.data.datasets[i];
        if (ds && ds._columnSymbol) it.text = it.text + " (" + ds._columnSymbol + ")";
      });
      return items;
    };
  }

  function shouldApplySymbolSuffix(processedData) {
    const meta = processedData.meta || {};
    const isMixed = meta.uniformValueType === "currency" && meta.uniformValueSymbol === null;
    const m = CURRENCY_DISPLAY_OPTIONS.legendSymbolSuffix;
    return m === "always" || (m === "mixed-only" && isMixed);
  }

  // ─── BASE CONFIG SCAFFOLD ───
  // Stub data; only the layout/padding/title/plugin scaffold survives.
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

  // ─── CONFIG OVERRIDES ───
  function applyDatasets(config, processedData, chartType, options) {
    config.data.labels = processedData.labels.slice();

    // Stacked line needs fill:true to read as stacked area bands.
    const stackedLine = chartType === "line" && !!(options && options.stacked === true);
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
        effectiveType = (ds._columnChartType === "line" || ds._columnChartType === "bar")
          ? ds._columnChartType : "bar";
        out.type = effectiveType;
      } else {
        effectiveType = chartType;
      }
      if (effectiveType === "line") {
        out.fill = isCombo ? false : stackedLine;
        out.tension = 0.1;
        if (isCombo) out.borderWidth = 2;  // Thicker stroke vs bar fills.
      }
      if (ds._columnType) out._columnType = ds._columnType;
      // 3.2.b-1: pass through symbol for tooltip + legend generateLabels.
      if (ds._columnSymbol) out._columnSymbol = ds._columnSymbol;
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
    // 3.2.b-1: legend symbol suffix policy.
    if (shouldApplySymbolSuffix(processedData)) {
      const labels = config.options.plugins.legend.labels = config.options.plugins.legend.labels || {};
      labels.generateLabels = makeSymbolSuffixGenerateLabels();
    }
  }

  function applyXAxisScale(config, processedData) {
    if (!config.options.scales || !config.options.scales.x) return;
    if (processedData.xAxisType !== "time") return;
    if (!hasDateAdapter()) {
      logWarn("xAxisType='time' requested but no Chart.js date adapter detected; x-axis falls back to category scale.");
      return;
    }
    config.options.scales.x.type = "time";
    // displayFormats avoid round-tripping pre-formatted STRING via new Date().
    config.options.scales.x.time = {
      tooltipFormat: "PP",
      displayFormats: {
        millisecond: "HH:mm:ss.SSS", second: "HH:mm:ss", minute: "HH:mm",
        hour: "HH:00", day: "d MMM yyyy", week: "d MMM yyyy",
        month: "MMM yyyy", quarter: "qqq yyyy", year: "yyyy",
      },
    };
    config.options.scales.x.ticks = config.options.scales.x.ticks || {};
    config.options.scales.x.ticks.autoSkip = true;
    config.options.scales.x.ticks.maxTicksLimit = 12;  // wide canvases else render ~45 ticks
  }

  function applyYAxisFormatter(config, processedData) {
    if (!config.options.scales || !config.options.scales.y) return;
    const uniform = processedData.meta && processedData.meta.uniformValueType;
    if (!uniform) { logDebug("Mixed value-column types; default numeric ticks"); return; }
    const formatters = processedData.formatters || {};
    let cb;
    if (uniform === "currency") {
      // 3.2.b-1: closure carries the resolved symbol; null tickSym (mixed +
      // "plain" strategy) leaves Chart.js default numeric formatting.
      const cd = resolveCurrencyDisplay(processedData);
      if (!cd || cd.tickSym === null) return;
      const f = formatters.currency;
      if (typeof f !== "function") return;
      cb = function (v) { return f(v, cd.tickSym); };
    } else {
      const f = formatters[uniform];
      if (typeof f !== "function") return;
      cb = function (v) { return f(v); };
    }
    config.options.scales.y.ticks = config.options.scales.y.ticks || {};
    config.options.scales.y.ticks.callback = cb;
  }

  // Multi-series uniform value type → generic axis title ("Amount (£)") not
  // the first column's name. 3.2.b-1 resolves the symbol via uniformValueSymbol.
  function applyYAxisTitle(config, processedData) {
    if (!config.options.scales || !config.options.scales.y) return;
    const multiSeries = Array.isArray(processedData.datasets) && processedData.datasets.length > 1;
    if (!multiSeries) return;
    const uniform = processedData.meta && processedData.meta.uniformValueType;
    if (!uniform) return;
    let title;
    if (uniform === "currency") {
      const cd = resolveCurrencyDisplay(processedData);
      title = (cd && cd.titleSym) ? "Amount (" + cd.titleSym + ")" : "Amount";
    } else if (uniform === "percentage") title = "Percentage (%)";
    else return;
    config.options.scales.y.title = config.options.scales.y.title || {};
    config.options.scales.y.title.display = true;
    config.options.scales.y.title.text = title;
  }

  // Stacked bar/line opt-in. Both axes required by Chart.js; bar/line only.
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
      const dsSym = ctx.dataset && ctx.dataset._columnSymbol;
      const fmt = (dsType && formatters[dsType]) || (uniform && formatters[uniform]) || fallback;
      // parsed is {x,y} for cartesian, raw value for pie/doughnut.
      let value;
      if (ctx.parsed && typeof ctx.parsed === "object" && "y" in ctx.parsed) value = ctx.parsed.y;
      else if (typeof ctx.parsed !== "undefined") value = ctx.parsed;
      else value = ctx.raw;
      const prefix = ctx.dataset && ctx.dataset.label ? ctx.dataset.label + ": " : "";
      // 3.2.b-1: per-dataset currency symbol; non-currency formatters ignore extra arg.
      return prefix + fmt(value, dsSym);
    };
  }

  // ─── BUBBLE CONFIG (3.1.c): own path; {x,y,r} points break applyDatasets ───
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

    // 3.1.d: scale `r` to MIN_PX..MAX_PX with sqrt(t) (area tracks datum).
    const dp = (config.data.datasets[0] && config.data.datasets[0].data) || [];
    if (dp.length) {
      const raws = dp.map((p) => p.r);
      const rMin = Math.min(...raws), rMax = Math.max(...raws);
      const MIN_PX = 6, MAX_PX = 40, range = rMax - rMin;
      dp.forEach((p) => {
        p._rRaw = p.r;
        p.r = range === 0 ? (MIN_PX + MAX_PX) / 2
          : MIN_PX + (MAX_PX - MIN_PX) * Math.sqrt((p.r - rMin) / range);
      });
    }

    config.options = config.options || {};
    config.options.scales = config.options.scales || {};
    const sx = (config.options.scales.x = config.options.scales.x || {});
    const sy = (config.options.scales.y = config.options.scales.y || {});
    sx.type = "linear"; sy.type = "linear";

    const numFmt = fmts.number || ((v) => String(v));
    const xFmt = (meta.xType && fmts[meta.xType]) || numFmt;
    const yFmt = (meta.yType && fmts[meta.yType]) || numFmt;
    const rFmt = (meta.radiusType && fmts[meta.radiusType]) || numFmt;
    const xLab = meta.xLabel || "X", yLab = meta.yLabel || "Y", rLab = meta.radiusLabel || "Radius";

    sx.title = { display: true, text: xLab };
    sy.title = { display: true, text: yLab };
    sx.ticks = sx.ticks || {}; sx.ticks.callback = (v) => xFmt(v);
    sy.ticks = sy.ticks || {}; sy.ticks.callback = (v) => yFmt(v);

    // 3.1.d: proximity tooltips for small (6-40 px) markers.
    config.options.interaction = { mode: "nearest", intersect: false };

    config.options.plugins = config.options.plugins || {};
    config.options.plugins.legend = config.options.plugins.legend || {};
    config.options.plugins.legend.display = false;
    config.options.plugins.tooltip = config.options.plugins.tooltip || {};
    // Tooltip uses raw datum (_rRaw), not the scaled visual radius.
    config.options.plugins.tooltip.callbacks = {
      title: (items) => {
        if (!items || !items.length) return "";
        const raw = items[0].raw;
        return raw && raw._label != null ? String(raw._label) : "";
      },
      label: (ctx) => {
        const raw = ctx.raw || {};
        return [
          xLab + ": " + xFmt(raw.x),
          yLab + ": " + yFmt(raw.y),
          rLab + ": " + rFmt(raw._rRaw != null ? raw._rRaw : raw.r),
        ];
      },
    };

    config._gbEnhanced = true; config._gbProcessed = processedData; config._gbBubble = true;

    logInfo("Built enhanced bubble config: " + dp.length + " pts; x=" + xLab + ", y=" + yLab + ", r=" + rLab);
    return config;
  }

  // ─── PUBLIC API ───
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
    if (chartType === "bubble") return buildBubbleConfig(processedData, safeOptions);

    // Combo + stacked unsupported (Phase 4); prefer combo, warn loudly.
    if (chartType === "combo" && safeOptions.stacked === true) {
      logWarn("Stacked + combo unsupported; rendering combo without stacking");
    }
    // Combo: bar scaffold, per-dataset .type from applyDatasets.
    const scaffoldChartType = chartType === "combo" ? "bar" : chartType;

    logDebug("Building enhanced chart config", { chartType, scaffoldChartType,
      datasets: processedData.datasets.length, xAxisType: processedData.xAxisType });

    const config = getBaseScaffold(scaffoldChartType, safeOptions);
    if (!config) return null;

    applyDatasets(config, processedData, chartType, safeOptions);
    applyLegend(config, processedData);

    // Scale-bearing chart types only get axis / tooltip overrides.
    if (!isScaleFree(chartType)) {
      applyXAxisScale(config, processedData);
      applyYAxisFormatter(config, processedData);
      applyYAxisTitle(config, processedData);
      applyStacked(config, chartType, safeOptions);
    }
    applyTooltipFormatter(config, processedData);

    // Marker for FinalChartCreator's post-generation override path.
    config._gbEnhanced = true; config._gbProcessed = processedData;

    logInfo("Built enhanced config: " + config.data.datasets.length + " dataset(s), chartType=" + chartType);

    return config;
  }

  // Re-apply enhanced overrides after FinalChartCreator's state-merge rewrite
  // strips function callbacks. No-op without _gbEnhanced.
  function applyEnhancedOverrides(chartInstance, config) {
    if (!chartInstance || !config || !config._gbEnhanced) return false;
    if (!chartInstance.options) return false;

    const opts = chartInstance.options;
    const processed = config._gbProcessed || {};
    const formatters = processed.formatters || {};
    const uniform = processed.meta && processed.meta.uniformValueType;
    const multiSeries = Array.isArray(config.data && config.data.datasets)
      ? config.data.datasets.length > 1 : false;

    // Restore plugin callbacks / display.
    if (!opts.plugins) opts.plugins = {};
    if (!opts.plugins.legend) opts.plugins.legend = {};
    if (multiSeries) opts.plugins.legend.display = true;

    // 3.2.b-1: legend generateLabels (suffix policy) — Chart.js strips it.
    if (shouldApplySymbolSuffix(processed)) {
      opts.plugins.legend.labels = opts.plugins.legend.labels || {};
      opts.plugins.legend.labels.generateLabels = makeSymbolSuffixGenerateLabels();
    }

    if (!opts.plugins.tooltip) opts.plugins.tooltip = {};
    opts.plugins.tooltip.callbacks = opts.plugins.tooltip.callbacks || {};
    const origTip = config.options && config.options.plugins && config.options.plugins.tooltip
      && config.options.plugins.tooltip.callbacks && config.options.plugins.tooltip.callbacks.label;
    if (typeof origTip === "function") opts.plugins.tooltip.callbacks.label = origTip;

    // Scale-bearing types only.
    if (opts.scales) {
      if (opts.scales.y) {
        // Y-axis tick formatter — currency uses resolved symbol closure.
        if (uniform === "currency") {
          const cd = resolveCurrencyDisplay(processed);
          if (cd && cd.tickSym !== null && typeof formatters.currency === "function") {
            const f = formatters.currency;
            opts.scales.y.ticks = opts.scales.y.ticks || {};
            opts.scales.y.ticks.callback = function (v) { return f(v, cd.tickSym); };
          }
        } else if (uniform && typeof formatters[uniform] === "function") {
          const f = formatters[uniform];
          opts.scales.y.ticks = opts.scales.y.ticks || {};
          opts.scales.y.ticks.callback = function (v) { return f(v); };
        }
        // Multi-series: force a generic y-axis title rather than the
        // first column's name (which the basic post-gen override sets).
        if (multiSeries) {
          opts.scales.y.title = opts.scales.y.title || {};
          opts.scales.y.title.display = true;
          if (uniform === "currency") {
            const cd = resolveCurrencyDisplay(processed);
            opts.scales.y.title.text = (cd && cd.titleSym) ? "Amount (" + cd.titleSym + ")" : "Amount";
          } else if (uniform === "percentage") opts.scales.y.title.text = "Percentage (%)";
          else opts.scales.y.title.text = "Value";
        }
      }
      // Do NOT mutate opts.scales.x.type on a live instance (Phase 2.5).
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
