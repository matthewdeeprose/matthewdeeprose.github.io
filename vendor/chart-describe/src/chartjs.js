/**
 * Chart.js adapter for the shared chart describer
 * Turns a Chart.js chart config into the same three forms the Mermaid
 * describers produce (short, shortHTML, detailed), by way of ChartModel v0
 * (.claude/measurements/cd-1-chartmodel-v0/chartmodel-v0.md) and the shared
 * builders in vendor/chart-describe/src/charts.js.
 *
 * ADOPTED NOWHERE (CD-3a). No page loads this file. Where the shared core has no
 * ruled wording for a chart's shape, describe() says so with
 * { supported: false, reason } and the existing Chart.js engine stays in charge.
 *
 * Supported in v0.1: bar and line (including mixed bar and line, and horizontal
 * bars) with data.labels, and pie. Everything else returns a REASONS value.
 *
 * Resolves window.ChartDescribeCharts at CALL TIME, never at load. In Node it
 * falls back to require("./charts.js") when the global is absent.
 */
(function (root) {
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

  // Current logging level - can be modified at runtime
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Chart Describe ChartJs] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Describe ChartJs] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Describe ChartJs] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Describe ChartJs] DEBUG: ${message}`, ...args);
    }
  }

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  /** Why a chart is not described by the shared core. A frozen enum. */
  const REASONS = Object.freeze({
    NO_CONFIG: "no-config",
    NO_DATA: "no-data",
    UNSUPPORTED_TYPE_DOUGHNUT: "unsupported-type-doughnut",
    UNSUPPORTED_TYPE_POLAR_AREA: "unsupported-type-polarArea",
    UNSUPPORTED_TYPE_SCATTER: "unsupported-type-scatter",
    UNSUPPORTED_TYPE_BUBBLE: "unsupported-type-bubble",
    UNSUPPORTED_TYPE_RADAR: "unsupported-type-radar",
    UNSUPPORTED_TYPE_OTHER: "unsupported-type",
    UNSUPPORTED_SERIES_TYPE: "unsupported-series-type",
    MULTI_LINE_TITLE: "multi-line-title",
    HIDDEN_SERIES: "hidden-series",
    STACKED: "stacked",
    MULTIPLE_VALUE_AXES: "multiple-value-axes",
    NAMED_STACK_GROUPS: "named-stack-groups",
    TIME_SCALE: "time-scale",
    POINT_DATA: "point-data",
    MISSING_LABELS: "missing-labels",
    NON_STRING_LABEL: "non-string-label",
    NULL_VALUES: "null-values",
    NON_NUMERIC_VALUES: "non-numeric-values",
    MULTI_DATASET_PIE: "multi-dataset-pie",
    PIE_LENGTH_MISMATCH: "pie-length-mismatch",
    BUILDER_ERROR_PREFIX: "builder-error: ",
  });

  const UNSUPPORTED_BY_TYPE = Object.freeze({
    doughnut: REASONS.UNSUPPORTED_TYPE_DOUGHNUT,
    polarArea: REASONS.UNSUPPORTED_TYPE_POLAR_AREA,
    scatter: REASONS.UNSUPPORTED_TYPE_SCATTER,
    bubble: REASONS.UNSUPPORTED_TYPE_BUBBLE,
    radar: REASONS.UNSUPPORTED_TYPE_RADAR,
  });

  const KIND_BY_TYPE = Object.freeze({
    bar: "bar",
    line: "line",
    scatter: "point",
    bubble: "bubble",
    pie: "slice",
    doughnut: "slice",
    polarArea: "polarSlice",
    radar: "polygon",
  });

  const FAMILY_BY_TYPE = Object.freeze({
    bar: "cartesian",
    line: "cartesian",
    scatter: "cartesian",
    bubble: "cartesian",
    pie: "proportion",
    doughnut: "proportion",
    polarArea: "proportion",
    radar: "radial",
  });

  const XYCHART_KINDS = Object.freeze(["bar", "line"]);
  const AXIS_KIND_BAND = "band";
  const AXIS_KIND_TIME = "time";
  const AXIS_KIND_RANGE = "range";
  const ORIENTATION_HORIZONTAL = "horizontal";
  const ORIENTATION_VERTICAL = "vertical";

  // ---------------------------------------------------------------------
  // The shared builders, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------

  /**
   * ChartDescribeCharts: from the global when present, otherwise (Node only)
   * from ./charts.js. Throws if neither exists, so describe() reports a
   * builder-error instead of returning wrong text.
   * @returns {Object} ChartDescribeCharts
   */
  function chartsCore() {
    if (root.ChartDescribeCharts) return root.ChartDescribeCharts;
    if (typeof require === "function") return require("./charts.js");
    throw new Error("ChartDescribeCharts is not loaded");
  }

  // ---------------------------------------------------------------------
  // Config -> ChartModel v0
  // ---------------------------------------------------------------------

  /** An empty author string is absence (rule R1 of ChartModel v0). */
  const orNull = (s) => (s === "" || s === undefined || s === null ? null : s);

  const emptyPresentation = () => ({
    legend: null,
    gridDivisions: null,
    gridShape: null,
  });

  const axisTitle = (scale) =>
    scale &&
    scale.title &&
    scale.title.display !== false &&
    scale.title.text !== undefined
      ? scale.title.text
      : null;

  const authorBound = (scale, key) =>
    scale && typeof scale[key] === "number" ? scale[key] : null;

  /**
   * Port of CD-1's fromChartjs, amended in two ways (recorded in the CD-3a
   * report): valueAxis.min / .max carry ONLY numeric author bounds
   * (scales.<value>.min / .max, never suggestedMin or beginAtZero), and a
   * value axis exists when it has a title or an author bound.
   * @param {Object} config - A Chart.js config
   * @returns {Object} A ChartModel v0
   */
  function toModel(config) {
    const family = FAMILY_BY_TYPE[config.type];
    const options = config.options || {};
    const scales = options.scales || {};
    const horizontal = family === "cartesian" && options.indexAxis === "y";
    const domainScale = scales[horizontal ? "y" : "x"];
    const valueScale = scales[horizontal ? "x" : "y"];
    const data = config.data || {};
    const labels = data.labels;
    const datasets = data.datasets || [];

    const series = datasets.map((ds) => {
      const rows = Array.isArray(ds.data) ? ds.data : [];
      const first = rows.find((d) => d !== null);
      const isPoints = first !== undefined && typeof first === "object";
      return {
        key: null,
        name: orNull(ds.label),
        kind: KIND_BY_TYPE[ds.type || config.type] || null,
        shown: ds.hidden !== true,
        values: isPoints
          ? null
          : rows.map((d) => (d === undefined ? null : d)),
        points: isPoints
          ? rows.map((p) => ({
              x: p.x,
              y: p.y === undefined ? null : p.y,
              r: p.r === undefined ? null : p.r,
            }))
          : null,
      };
    });
    const anyPoints = series.some((r) => r.points !== null);
    const timeScale = !!(domainScale && domainScale.type === "time");

    const domainAxis =
      labels !== undefined || anyPoints
        ? {
            kind: timeScale
              ? AXIS_KIND_TIME
              : labels !== undefined
                ? AXIS_KIND_BAND
                : AXIS_KIND_RANGE,
            title: axisTitle(domainScale),
            labels: labels !== undefined ? labels.slice() : null,
            keys: null,
            min: null,
            max: null,
          }
        : null;

    const valueTitle = axisTitle(valueScale);
    const min = authorBound(valueScale, "min");
    const max = authorBound(valueScale, "max");
    const hasValueAxis =
      family !== "proportion" &&
      (valueTitle !== null || min !== null || max !== null);
    const titleCfg = options.plugins && options.plugins.title;
    const titleText =
      titleCfg && titleCfg.display !== false ? titleCfg.text : undefined;

    return {
      modelVersion: 0,
      family,
      title: Array.isArray(titleText) ? titleText : orNull(titleText),
      accessibleTitle: null,
      accessibleDescription: null,
      orientation:
        family === "cartesian"
          ? horizontal
            ? ORIENTATION_HORIZONTAL
            : ORIENTATION_VERTICAL
          : null,
      stacked:
        family === "cartesian" && !!(valueScale && valueScale.stacked === true),
      domainAxis,
      valueAxis: hasValueAxis
        ? {
            title: valueTitle,
            min,
            max,
            scaleMax: null,
            scaleMaxSource: null,
            format: null, // M1: units are never guessed
          }
        : null,
      series,
      presentation: emptyPresentation(),
    };
  }

  // ---------------------------------------------------------------------
  // Model -> the shapes the shared builders read
  // ---------------------------------------------------------------------

  /** Model -> the Mermaid parse adapter's xychart shape (CD-1 toXychart). */
  function toXychartShape(model) {
    const d = model.domainAxis;
    return {
      type: "xychart",
      title: model.title ?? "",
      accTitle: model.accessibleTitle ?? "",
      accDescr: model.accessibleDescription ?? "",
      orientation: model.orientation,
      xAxis: { kind: AXIS_KIND_BAND, title: d.title, categories: d.labels },
      yAxis:
        model.valueAxis === null
          ? null
          : {
              title: model.valueAxis.title,
              min: model.valueAxis.min,
              max: model.valueAxis.max,
            },
      series: model.series.map((r) => ({
        kind: r.kind,
        name: r.name ?? "",
        values: r.values,
      })),
    };
  }

  /** Model -> the pie describer's segments (CD-1 toPieSegments). */
  const toPieSegmentsShape = (model) =>
    model.domainAxis.labels.map((label, i) => ({
      name: label,
      value: model.series[0].values[i],
    }));

  // ---------------------------------------------------------------------
  // Classification
  // ---------------------------------------------------------------------

  const unsupported = (reason) => ({ supported: false, reason });
  const SUPPORTED = Object.freeze({ supported: true });
  const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

  /** Distinct value-axis ids used by the datasets, plus extra scales. */
  function hasMultipleValueAxes(config, horizontal) {
    const idKey = horizontal ? "xAxisID" : "yAxisID";
    const valueKey = horizontal ? "x" : "y";
    const domainKey = horizontal ? "y" : "x";
    const ids = new Set(
      (config.data.datasets || []).map((ds) =>
        ds[idKey] === undefined ? valueKey : ds[idKey],
      ),
    );
    if (ids.size > 1) return true;
    const scaleKeys = Object.keys((config.options || {}).scales || {});
    return scaleKeys.some((k) => k !== valueKey && k !== domainKey);
  }

  /**
   * Can the shared core describe this config?
   * @param {Object} model - from toModel(config)
   * @param {Object} config - the same Chart.js config
   * @returns {{supported: boolean, reason?: string}}
   */
  function classify(model, config) {
    if (!config || typeof config !== "object" || !config.data) {
      return unsupported(REASONS.NO_CONFIG);
    }
    const type = config.type;
    if (UNSUPPORTED_BY_TYPE[type]) return unsupported(UNSUPPORTED_BY_TYPE[type]);
    if (type !== "bar" && type !== "line" && type !== "pie") {
      return unsupported(REASONS.UNSUPPORTED_TYPE_OTHER);
    }
    if (Array.isArray(model.title)) return unsupported(REASONS.MULTI_LINE_TITLE);
    if (!model.series.length) return unsupported(REASONS.NO_DATA);
    if (model.series.some((r) => !r.shown)) {
      return unsupported(REASONS.HIDDEN_SERIES);
    }
    if (model.series.some((r) => r.points !== null)) {
      return model.domainAxis && model.domainAxis.kind === AXIS_KIND_TIME
        ? unsupported(REASONS.TIME_SCALE)
        : unsupported(REASONS.POINT_DATA);
    }
    if (model.domainAxis && model.domainAxis.kind === AXIS_KIND_TIME) {
      return unsupported(REASONS.TIME_SCALE);
    }
    if (!model.domainAxis || model.domainAxis.labels === null) {
      return unsupported(REASONS.MISSING_LABELS);
    }
    if (
      model.domainAxis.labels.some((l) => typeof l !== "string" || l === "")
    ) {
      return unsupported(REASONS.NON_STRING_LABEL);
    }
    if (model.series.some((r) => r.values.some((v) => v === null))) {
      return unsupported(REASONS.NULL_VALUES);
    }
    if (model.series.some((r) => r.values.some((v) => !isFiniteNumber(v)))) {
      return unsupported(REASONS.NON_NUMERIC_VALUES);
    }

    if (model.family === "proportion") {
      if (model.series.length > 1) return unsupported(REASONS.MULTI_DATASET_PIE);
      if (model.series[0].values.length !== model.domainAxis.labels.length) {
        return unsupported(REASONS.PIE_LENGTH_MISMATCH);
      }
      return SUPPORTED;
    }

    const options = config.options || {};
    const scales = options.scales || {};
    if (
      model.stacked ||
      Object.keys(scales).some((k) => scales[k] && scales[k].stacked === true)
    ) {
      return unsupported(REASONS.STACKED);
    }
    if (config.data.datasets.some((ds) => ds.stack !== undefined)) {
      return unsupported(REASONS.NAMED_STACK_GROUPS);
    }
    if (hasMultipleValueAxes(config, options.indexAxis === "y")) {
      return unsupported(REASONS.MULTIPLE_VALUE_AXES);
    }
    if (model.series.some((r) => !XYCHART_KINDS.includes(r.kind))) {
      return unsupported(REASONS.UNSUPPORTED_SERIES_TYPE);
    }
    return SUPPORTED;
  }

  // ---------------------------------------------------------------------
  // Composition: the exact call order of the Mermaid describers
  // ---------------------------------------------------------------------

  /**
   * The xychart describer's three tiers for a normalised xychart shape. Same
   * calls, same order as mermaid-accessibility-xychart.js (short :194-205,
   * detailed :233-251).
   * @param {Object} chart - the xychart shape
   * @returns {{short: string, shortHTML: string, detailed: string}}
   */
  function composeXychart(chart) {
    const core = chartsCore();
    const short = `${core.buildShortOpening(chart, false)} ${core.buildTakeaway(chart, false, core.TIERS.SHORT)}`;
    const parts = [];
    parts.push("<h4>Chart Construction</h4>");
    parts.push(...core.buildConstruction(chart));
    parts.push("<h4>Key Insights</h4>");
    parts.push("<ul>");
    parts.push(...core.buildInsights(chart));
    parts.push("</ul>");
    parts.push("<h4>Data Table</h4>");
    parts.push(...core.buildTable(chart));
    return {
      short,
      shortHTML: core.escapeText(short),
      detailed: parts.join("\n"),
    };
  }

  /**
   * The pie describer's three tiers (mermaid-accessibility-pie.js :86-97,
   * :169-180).
   * @param {string} title - "" when there is none
   * @param {Array<{name: string, value: number}>} segments
   * @returns {{short: string, shortHTML: string, detailed: string}}
   */
  function composePie(title, segments) {
    const core = chartsCore();
    const short = core.buildPieShort(title, segments);
    return {
      short: short.text,
      shortHTML: short.html,
      detailed: core.buildPieDetailed(title, segments),
    };
  }

  // ---------------------------------------------------------------------
  // Public describe()
  // ---------------------------------------------------------------------

  /**
   * Describe a Chart.js config with the shared core. Never throws.
   * @param {Object} config - A Chart.js config
   * @returns {{supported: true, short: string, shortHTML: string, detailed: string} | {supported: false, reason: string}}
   */
  function describe(config) {
    try {
      if (!config || typeof config !== "object" || !config.data) {
        return unsupported(REASONS.NO_CONFIG);
      }
      const model = toModel(config);
      const verdict = classify(model, config);
      if (!verdict.supported) return verdict;
      const tiers =
        model.family === "proportion"
          ? composePie(model.title ?? "", toPieSegmentsShape(model))
          : composeXychart(toXychartShape(model));
      return { supported: true, ...tiers };
    } catch (err) {
      logWarn("describe failed", err);
      return unsupported(REASONS.BUILDER_ERROR_PREFIX + err.message);
    }
  }

  const api = {
    REASONS,
    toModel,
    classify,
    describe,
    composeXychart,
    composePie,
    toXychartShape,
    toPieSegmentsShape,
    setLogLevel: function (level) {
      if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
        logInfo(`Logging level changed to ${level}`);
      } else {
        logWarn("Invalid log level", level);
      }
    },
  };

  logDebug("Chart.js adapter initialised");

  root.ChartDescribeChartJs = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
