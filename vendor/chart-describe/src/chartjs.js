/**
 * Chart.js adapter for the shared chart describer.
 *
 * This file turns a Chart.js chart config into three forms of description:
 * short, shortHTML and detailed. The adapter works in two steps. First it
 * reads the config into a ChartModel (version 0), a neutral description of the
 * chart that holds nothing specific to Chart.js. Then it hands the chart's
 * facts to the shared builders in charts.js.
 *
 * Where the shared builders have no wording for a chart's shape, describe()
 * says so with { supported: false, reason }. The caller can then describe the
 * chart another way.
 *
 * Version 0.1 supports bar and line charts (including mixed bar and line, and
 * horizontal bars) that use data.labels, and pie charts. Every other chart
 * returns one of the REASONS values.
 *
 * This file exports REASONS, toModel, classify, describe, composeXychart,
 * composePie and more. It exports itself as window.ChartDescribeChartJs.
 *
 * It reads window.ChartDescribeCharts, ChartDescribeModel and
 * ChartDescribeRender when a function runs, never when the file loads. In Node
 * each one falls back to require("./charts.js"), "./model.js" or "./render.js"
 * when the global is missing.
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
    RANGE_DATA: "range-data",
    OBJECT_DATA: "object-data",
    MISSING_LABELS: "missing-labels",
    NON_STRING_LABEL: "non-string-label",
    NULL_VALUES: "null-values",
    NON_NUMERIC_VALUES: "non-numeric-values",
    MULTI_DATASET_PIE: "multi-dataset-pie",
    PIE_LENGTH_MISMATCH: "pie-length-mismatch",
    PARTIAL_CIRCLE: "partial-circle",
    NON_FINITE_TOTAL: "non-finite-total",
    INVALID_CONFIG: "invalid-config",
    BUILDER_ERROR: "builder-error",
  });

  // The words the shared builders' overflow refusals share ("... add up to more than a number can hold.").
  const OVERFLOW_MESSAGE = /add up to more than a number can hold/;

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

  const TYPE_PIE = "pie";
  const XYCHART_KINDS = Object.freeze(["bar", "line"]);
  const AXIS_KIND_BAND = "band";
  const AXIS_KIND_TIME = "time";
  const AXIS_KIND_RANGE = "range";
  const ORIENTATION_HORIZONTAL = "horizontal";
  const ORIENTATION_VERTICAL = "vertical";

  /**
   * The default axis titles that the host chart builder (a tool called Graph
   * Builder) writes, and the column-type markers that it sets on each dataset
   * in advanced mode. A placeholder is not an author title.
   */
  const GB_DECLARED = Object.freeze({
    PLACEHOLDER_VALUE_TITLE: "Y Axis",
    PLACEHOLDER_DOMAIN_TITLE: "X Axis",
    TYPE_CURRENCY: "currency",
    TYPE_PERCENTAGE: "percentage",
    PERCENT_SUFFIX: "%",
  });

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

  /**
   * ChartDescribeModel (model.js): the global, otherwise (Node only) require.
   * @returns {Object} ChartDescribeModel
   */
  function modelCore() {
    if (root.ChartDescribeModel) return root.ChartDescribeModel;
    if (typeof require === "function") return require("./model.js");
    throw new Error("ChartDescribeModel is not loaded");
  }

  /**
   * ChartDescribeRender (render.js): the global, otherwise (Node only) require.
   * @returns {Object} ChartDescribeRender
   */
  function renderCore() {
    if (root.ChartDescribeRender) return root.ChartDescribeRender;
    if (typeof require === "function") return require("./render.js");
    throw new Error("ChartDescribeRender is not loaded");
  }

  // ---------------------------------------------------------------------
  // Config -> ChartModel v0
  // ---------------------------------------------------------------------

  /** In a ChartModel, an empty string from the author means "nothing given". */
  const orNull = (s) => (s === "" || s === undefined || s === null ? null : s);

  const emptyPresentation = () => ({
    legend: null,
    gridDivisions: null,
    gridShape: null,
  });

  // An exact match on the host's placeholder is treated as no title (case-sensitive).
  const axisTitle = (scale, placeholder) =>
    scale &&
    scale.title &&
    scale.title.display !== false &&
    scale.title.text !== undefined &&
    scale.title.text !== placeholder
      ? scale.title.text
      : null;

  /**
   * valueAxis.format from what the person DECLARED, never from a title, label
   * or callback. Every visible series must be currency with one shared
   * symbol, or every one a percentage; anything else (basic mode, numbers,
   * mixed types, mixed symbols) is null.
   */
  function declaredFormat(datasets) {
    const visible = datasets.filter((ds) => ds.hidden !== true);
    if (visible.length === 0) return null;

    if (visible.every((ds) => ds._columnType === GB_DECLARED.TYPE_PERCENTAGE)) {
      return {
        prefix: null,
        suffix: GB_DECLARED.PERCENT_SUFFIX,
        locale: null,
        intlOptions: null,
      };
    }

    const symbol = visible[0]._columnSymbol;
    const sameCurrency =
      typeof symbol === "string" &&
      symbol !== "" &&
      visible.every(
        (ds) =>
          ds._columnType === GB_DECLARED.TYPE_CURRENCY &&
          ds._columnSymbol === symbol,
      );
    return sameCurrency
      ? { prefix: symbol, suffix: null, locale: null, intlOptions: null }
      : null;
  }

  const authorBound = (scale, key) =>
    scale && typeof scale[key] === "number" ? scale[key] : null;

  /**
   * Read a Chart.js config into a ChartModel. Two rules matter here.
   * valueAxis.min and valueAxis.max hold ONLY numeric bounds that the author
   * set (scales.<value>.min and .max, never suggestedMin or beginAtZero). And
   * a value axis exists when it has a title or an author bound.
   * @param {Object} config - A Chart.js config
   * @returns {Object} A ChartModel v0
   */
  function toModel(config) {
    const family = FAMILY_BY_TYPE[config.type];
    const options = config.options || {};
    const scales = readScales(options);
    const horizontal = family === "cartesian" && options.indexAxis === "y";
    const domainScale = scales[horizontal ? "y" : "x"];
    const valueScale = scales[horizontal ? "x" : "y"];
    const data = config.data || {};
    const labels = data.labels;
    const datasets = data.datasets || [];

    const series = datasets.map((ds) => {
      const rows = dataList(ds) ?? [];
      const first = rows.find((d) => d !== null);
      const isPoints = first !== undefined && typeof first === "object";
      return {
        key: null,
        name: orNull(ds.label),
        kind: KIND_BY_TYPE[ds.type || config.type] || null,
        shown: ds.hidden !== true,
        // Array.from visits holes (`[1,,3]`), where map skips them, so a hole
        // reads as the null that an explicit `undefined` already reads as.
        values: isPoints
          ? null
          : Array.from(rows, (d) => (d === undefined ? null : d)),
        points: isPoints
          ? rows.filter((p) => p !== null && p !== undefined).map((p) => ({
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
            title: axisTitle(domainScale, GB_DECLARED.PLACEHOLDER_DOMAIN_TITLE),
            labels: labels !== undefined ? labels.slice() : null,
            keys: null,
            min: null,
            max: null,
          }
        : null;

    const valueTitle = axisTitle(valueScale, GB_DECLARED.PLACEHOLDER_VALUE_TITLE);
    const min = authorBound(valueScale, "min");
    const max = authorBound(valueScale, "max");
    // The proportion family has no value axis, so a pie never carries a format.
    const format = family !== "proportion" ? declaredFormat(datasets) : null;
    const hasValueAxis =
      family !== "proportion" &&
      (valueTitle !== null || min !== null || max !== null || format !== null);
    // Chart.js draws a title only when `display` is truthy (its default is false),
    // so a title with no `display` key is not in the picture.
    const titleCfg = options.plugins && options.plugins.title;
    const titleText =
      titleCfg && titleCfg.display ? titleCfg.text : undefined;

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
        family === "cartesian" && !!(valueScale && valueScale.stacked),
      domainAxis,
      valueAxis: hasValueAxis
        ? {
            title: valueTitle,
            min,
            max,
            scaleMax: null,
            scaleMaxSource: null,
            format, // Declared by the person only, never guessed
          }
        : null,
      series,
      presentation: emptyPresentation(),
    };
  }

  // ---------------------------------------------------------------------
  // Model -> the shapes the shared builders read
  // ---------------------------------------------------------------------

  /** ChartModel -> the normalised xychart shape that the xychart builder reads. */
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

  /** ChartModel -> the list of { name, value } segments that the pie builder reads. */
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

  /** True when a dataset's `data` is present and is neither a list nor an object (a string, a number, a boolean). */
  function hasMalformedData(dataset) {
    const data = dataset ? dataset.data : undefined;
    return data !== undefined && data !== null && typeof data !== "object";
  }

  /** A dataset with no `type` takes the chart's own type, so only an explicit other type fails. */
  const isPieDataset = (ds) => ds.type === undefined || ds.type === TYPE_PIE;

  /** The sweep, in degrees, of a whole pie. Chart.js draws this when `circumference` is not set. */
  const FULL_CIRCLE_DEGREES = 360;

  /**
   * Does Chart.js draw less (or more) than a whole circle? A dataset's own
   * `circumference` beats the chart's `options.circumference`. A value that is
   * not set, or is exactly 360, is a whole pie; anything else (a half-circle
   * gauge, a number the text cannot trust) is not, so the shares of a whole
   * pie would mislead.
   * @param {Object} config - A Chart.js config
   * @returns {boolean} True when the picture is not a whole circle
   */
  function drawsPartialCircle(config) {
    const dataset = config.data.datasets[0] || {};
    const options = config.options || {};
    const value = dataset.circumference !== undefined ? dataset.circumference : options.circumference;
    if (value === undefined || value === null) return false;
    return value !== FULL_CIRCLE_DEGREES;
  }

  /**
   * Does Chart.js draw a ring, not a whole pie, because `cutout` is set? A
   * dataset's own `cutout` beats the chart's `options.cutout`. Not set, or
   * zero in any spelling (`0`, `"0"`, `"0%"`), is a whole pie; anything else,
   * or a value that is not a number, is a ring, which is a doughnut.
   * @param {Object} config - A Chart.js config
   * @returns {boolean} True when the picture is a ring
   */
  function drawsRing(config) {
    const dataset = config.data.datasets[0] || {};
    const options = config.options || {};
    const value = dataset.cutout !== undefined ? dataset.cutout : options.cutout;
    if (value === undefined || value === null) return false;
    const size = typeof value === "number" ? value : Number.parseFloat(value);
    return size !== 0;
  }

  /** A title written with a line break is drawn on several lines, like an array title. */
  const hasLineBreak = (title) => typeof title === "string" && /[\r\n]/.test(title);

  /**
   * The scales Chart.js reads from `options.scales`: it takes the keys of whatever is there and keeps each entry that is an object, so a
   * string or number there, and an entry that is a string, are ignored (a string logs "Invalid scale configuration").
   * @param {Object} options - The config's options
   * @returns {Object} The scale objects by id
   */
  function readScales(options) {
    const scales = {};
    for (const [id, scale] of Object.entries(Object(options.scales || {}))) {
      if (Object.prototype.toString.call(scale) === "[object Object]") scales[id] = scale;
    }
    return scales;
  }

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
    const scaleKeys = Object.keys(readScales(config.options || {}));
    return scaleKeys.some((k) => k !== valueKey && k !== domainKey);
  }

  /**
   * A dataset's data as a list: an array, or a typed array, which Chart.js draws as the list of numbers it holds. Null for anything else.
   * @param {Object} dataset - A Chart.js dataset
   * @returns {Array|null} The rows, or null when `data` is not a list
   */
  function dataList(dataset) {
    const data = dataset ? dataset.data : undefined;
    if (readsAsKeyed(data)) return null;
    // Chart.js reads element 0, 1, 2 and so on up to the array's length, and never calls the array's iterator or its methods. A list made here,
    // element by element, is read the same way by everything below, so a replaced iterator, find or filter cannot change what is described.
    if (Array.isArray(data)) return readByIndex(data, undefined);
    if (!ArrayBuffer.isView(data)) return null;
    // The kind comes from the array's own internal slot, so it holds for an array made in another realm (an iframe) and for a subclass.
    // A DataView has no kind and no length, so Chart.js reads no element from it: it is read like any array-like, and is an empty list.
    const store = NARROW_FLOAT_STORES.get(typedArrayName(data));
    return readByIndex(data, store);
  }

  /**
   * The elements of an array or typed array, read as Chart.js reads them: index 0 up to its `length`, by index, with a narrow float array's numbers
   * brought back to the decimals the author wrote.
   * @param {Object} data - An array or typed array
   * @param {Function|undefined} store - Rounds a double to what the same kind of narrow float array stores, or undefined for any other kind
   * @returns {Array} A new list
   */
  function readByIndex(data, store) {
    const length = data.length;
    assertDrawableLength(length);
    if (!store) return Array.from({ length }, (_, index) => data[index]);
    return Array.from({ length }, (_, index) => shortestStored(data[index], store));
  }

  // Chart.js makes one parsed row per element with `new Array(count)`, which throws "Invalid array length" for a count with a fraction, so it draws nothing
  // for a `length` of 0.5 or 2.5. A length that is not a number, or is below zero, parses as an empty list, and a numeric string reads as its number.
  // The first case is refused here as it is there, so a chart that cannot be drawn is not described as the first `floor(length)` values.
  const MAX_ARRAY_LENGTH = 2 ** 32 - 1; // the largest length a JavaScript array can have
  function assertDrawableLength(length) {
    const count = +length; // a BigInt throws here, as it does in Chart.js
    if (count > 0 && (!Number.isInteger(count) || count > MAX_ARRAY_LENGTH)) throw new RangeError("Invalid array length");
  }

  // Chart.js reads `data` as keyed values, one per key and each drawn at a new category, whenever Object.prototype.toString calls it "[object Object]".
  // A typed array whose tag was set to "Object", or whose prototype was moved off TypedArray.prototype, reads that way, so it is keyed data here too.
  const KEYED_TAG = "[object Object]";
  const readsAsKeyed = (data) => Object.prototype.toString.call(data) === KEYED_TAG;

  // The built-in getter behind every typed array's Symbol.toStringTag: it reads the internal slot, so a subclass or another realm cannot change the answer,
  // and it returns undefined for anything that is not a typed array (a DataView).
  const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Int8Array.prototype), Symbol.toStringTag).get;
  const typedArrayName = (value) => TYPED_ARRAY_TAG_GETTER.call(value);

  // Typed arrays that store each number with fewer digits than a double, each with the function that rounds a double to what the array would store.
  // Rounding by function means no array is built from the value's own constructor. Float16Array is left out where the runtime has none.
  const NARROW_FLOAT_STORES = new Map(
    [
      ["Float32Array", Math.fround],
      ["Float16Array", typeof Math.f16round === "function" ? Math.f16round : typeof Float16Array === "function" ? storeInFloat16 : null],
    ].filter(([, store]) => store),
  );

  /** Round a double to the nearest half-precision number, for a runtime that has Float16Array but not Math.f16round. */
  function storeInFloat16(value) {
    FLOAT16_SCRATCH[0] = value;
    return FLOAT16_SCRATCH[0];
  }
  const FLOAT16_SCRATCH = typeof Float16Array === "function" ? new Float16Array(1) : null;

  // A double reads back exactly from 17 significant digits, so the search below always ends by then.
  const MAX_SIGNIFICANT_DIGITS = 17;

  /**
   * A short decimal that a narrow float array stores as this same element. A Float32Array holds 0.095 as
   * 0.0949999988079071; read whole, that widened figure would be spoken digit by digit. This rounds the element to
   * 1, 2, 3 ... significant digits and returns the first rounding that the same kind of array stores as the same
   * element: 0.095, the number the author put in, whenever it fits the array's precision. Zero (either sign), NaN
   * and the infinities come back unchanged.
   * @param {number} value - One element, as the typed array returns it
   * @param {Function} store - Rounds a double to the number the same kind of array stores (Math.fround for a Float32Array)
   * @returns {number} The first rounding, by significant digits, that the same kind of array stores as `value`
   */
  function shortestStored(value, store) {
    if (value === 0 || !Number.isFinite(value)) return value;
    // A whole number the array holds is already exact; a shorter decimal would be another whole number (4112 would read 4110).
    if (Number.isInteger(value)) return value;
    for (let digits = 1; digits < MAX_SIGNIFICANT_DIGITS; digits++) {
      const candidate = Number(value.toPrecision(digits));
      if (store(candidate) === value) return candidate;
    }
    return value;
  }

  /** True when a dataset's `data` is an object that is not a list: values keyed by name. */
  function hasKeyedData(dataset) {
    return !!dataset && dataset.data !== null && typeof dataset.data === "object" && dataList(dataset) === null;
  }

  /** True when a dataset's first row is a pair of numbers, the shape of a floating bar. */
  function hasRangeRows(dataset) {
    const rows = dataList(dataset) ?? [];
    return Array.isArray(rows.find((row) => row !== null));
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
    if (Array.isArray(model.title) || hasLineBreak(model.title)) {
      return unsupported(REASONS.MULTI_LINE_TITLE);
    }
    if (!model.series.length) return unsupported(REASONS.NO_DATA);
    if (model.series.some((r) => !r.shown)) {
      return unsupported(REASONS.HIDDEN_SERIES);
    }
    // A dataset's data given as an object (keyed values) is read by Chart.js and is not a list of numbers here.
    if (config.data.datasets.some(hasKeyedData)) return unsupported(REASONS.OBJECT_DATA);
    // Data that is a string, number or boolean is not a list. Chart.js reads a string as its characters and draws nothing for a number.
    if (config.data.datasets.some(hasMalformedData)) return unsupported(REASONS.INVALID_CONFIG);
    if (model.series.some((r) => r.points !== null)) {
      if (model.domainAxis && model.domainAxis.kind === AXIS_KIND_TIME) {
        return unsupported(REASONS.TIME_SCALE);
      }
      // Floating bars give each row a pair [low, high]; every other object row is a point.
      return config.data.datasets.some(hasRangeRows)
        ? unsupported(REASONS.RANGE_DATA)
        : unsupported(REASONS.POINT_DATA);
    }
    if (model.domainAxis && model.domainAxis.kind === AXIS_KIND_TIME) {
      return unsupported(REASONS.TIME_SCALE);
    }
    if (!model.domainAxis || model.domainAxis.labels === null) {
      return unsupported(REASONS.MISSING_LABELS);
    }
    // An empty label is a string Chart.js draws as nothing, the same as a label of spaces, so it
    // reaches the builder and reads as unlabelled there ("Unlabelled segment 2"), as in Mermaid.
    if (model.domainAxis.labels.some((l) => typeof l !== "string")) {
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
      // A pie with `cutout` set is a ring, the picture of a doughnut.
      if (drawsRing(config)) return unsupported(REASONS.UNSUPPORTED_TYPE_DOUGHNUT);
      // Finite values can still sum past the largest number, and every share
      // of an infinite total reads as zero.
      if (!Number.isFinite(model.series[0].values.reduce((sum, v) => sum + v, 0))) {
        return unsupported(REASONS.NON_FINITE_TOTAL);
      }
      // A dataset `type` overrides the chart type, so the dataset must be a
      // pie too, or the picture is not the pie the text would name.
      if (!isPieDataset(config.data.datasets[0])) {
        return unsupported(REASONS.UNSUPPORTED_SERIES_TYPE);
      }
      // A half-circle or other arc is a gauge, not a whole pie.
      if (drawsPartialCircle(config)) return unsupported(REASONS.PARTIAL_CIRCLE);
      return SUPPORTED;
    }

    // A series with no values has no highest, lowest or average to state.
    if (model.series.some((r) => r.values.length === 0)) return unsupported(REASONS.NO_DATA);

    // Finite values can still sum past the largest number, and the average of an infinite total is not a number
    // a reader can be told.
    if (model.series.some((r) => !Number.isFinite(r.values.reduce((sum, v) => sum + v, 0)))) {
      return unsupported(REASONS.NON_FINITE_TOTAL);
    }

    const options = config.options || {};
    const scales = readScales(options);
    if (
      model.stacked ||
      Object.keys(scales).some((k) => scales[k] && scales[k].stacked)
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
  // Composition: build the model, then render it
  // ---------------------------------------------------------------------

  /**
   * Does Chart.js draw the series name? It does, in its legend, unless the
   * author sets `options.plugins.legend.display` to false. The xychart
   * builder needs to know, because it names the series only when the picture
   * does.
   * @param {Object} config - A Chart.js config
   * @returns {boolean} True when the legend is drawn
   */
  function legendIsDrawn(config) {
    const plugins = (config.options && config.options.plugins) || {};
    return !(plugins.legend && plugins.legend.display === false);
  }

  /**
   * The xychart describer's three tiers for a normalised xychart shape:
   * buildXychartModel rendered under PROFILES.lines.
   * @param {Object} chart - the xychart shape
   * @param {Object} [options] - `{ drawsSeriesName: boolean }`, passed to the
   *   shared builders. It is on when omitted
   * @returns {{short: string, shortHTML: string, detailed: string}}
   */
  function composeXychart(chart, options) {
    const model = chartsCore().buildXychartModel(chart, options);
    const rendered = renderCore().renderHtml(model, renderCore().PROFILES.lines);
    // The plain short is the runs joined into text. It is never escaped,
    // because it is not HTML.
    return {
      short: modelCore().flatten(model.short),
      shortHTML: rendered.shortHTML,
      detailed: rendered.detailed,
    };
  }

  // The pie presentation: the section roles, the term classes and the profile
  // that gives the pie HTML its class names. The class names are part of the
  // output, so change them only on purpose.
  const PIE_ROLES = Object.freeze({
    CONSTRUCTION: "construction",
    INSIGHTS: "insights",
    DATA: "data",
    PATTERNS: "patterns",
    CATEGORIES: "categories",
    PRIMARY: "primary",
    TOTAL: "total",
    LARGEST: "largest",
    SMALLEST: "smallest",
  });

  const PIE_TERM_CLASS = Object.freeze({
    label: "diagram-segment",
    percentage: "diagram-percentage",
    proportion: "diagram-proportion",
    value: "diagram-value",
    count: "diagram-count",
    title: "diagram-title",
  });

  const PIE_PROFILE = Object.freeze({
    name: "sections",
    layout: "sections",
    sectionClass: (role) => `mermaid-section chart-${role}`,
    headingClass: "mermaid-details-heading",
    sectionLayout: Object.freeze({
      default: Object.freeze({ indent: 10, afterHeading: true }),
      [PIE_ROLES.INSIGHTS]: Object.freeze({ indent: 10, afterHeading: false }),
      [PIE_ROLES.PATTERNS]: Object.freeze({ indent: 6, afterHeading: true }),
    }),
    listClass: Object.freeze({
      [PIE_ROLES.CATEGORIES]: "diagram-segment-list",
      [PIE_ROLES.INSIGHTS]: "diagram-insights-list",
      [PIE_ROLES.DATA]: "diagram-data-list",
    }),
    itemClass: Object.freeze({
      [PIE_ROLES.PRIMARY]: "diagram-insight diagram-insight-primary",
      [PIE_ROLES.TOTAL]: "diagram-insight diagram-insight-total",
      [PIE_ROLES.LARGEST]: "diagram-insight diagram-insight-largest",
      [PIE_ROLES.SMALLEST]: "diagram-insight diagram-insight-smallest",
      [PIE_ROLES.DATA]: "diagram-data-item",
    }),
    termClass: (role) => PIE_TERM_CLASS[role],
  });

  /**
   * The pie describer's three tiers: buildPieModel rendered under PIE_PROFILE.
   * @param {string} title - "" when there is none
   * @param {Array<{name: string, value: number}>} segments
   * @returns {{short: string, shortHTML: string, detailed: string}}
   */
  function composePie(title, segments) {
    const model = chartsCore().buildPieModel(title, segments);
    const rendered = renderCore().renderHtml(model, PIE_PROFILE);
    // The plain short is the runs joined into text. It is never escaped,
    // because it is not HTML.
    return {
      short: modelCore().flatten(model.short),
      shortHTML: rendered.shortHTML,
      detailed: rendered.detailed,
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
    // Until the config has been read and classified, a thrown error means the config is malformed.
    let readingConfig = true;
    try {
      if (!config || typeof config !== "object" || !config.data) {
        return unsupported(REASONS.NO_CONFIG);
      }
      const model = toModel(config);
      const verdict = classify(model, config);
      if (!verdict.supported) return verdict;
      readingConfig = false;
      const tiers =
        model.family === "proportion"
          ? composePie(model.title ?? "", toPieSegmentsShape(model))
          : composeXychart(toXychartShape(model), {
              drawsSeriesName: legendIsDrawn(config),
            });
      return { supported: true, ...tiers };
    } catch (err) {
      logWarn("describe failed", err);
      // A builder that sums in its own order can overflow where the adapter's check, in the order
      // given, did not: [1e308, -1e308, 1e308] is finite, but sorted high to low it passes the
      // largest number. The builders refuse it with a RangeError whose message says so; that is the
      // same refusal as the adapter's own, not a fault in the builder.
      if (err instanceof RangeError && OVERFLOW_MESSAGE.test(err.message)) {
        return unsupported(REASONS.NON_FINITE_TOTAL);
      }
      // The message is logged above; the reason names the cause without carrying a raw JavaScript message.
      return unsupported(readingConfig ? REASONS.INVALID_CONFIG : REASONS.BUILDER_ERROR);
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
