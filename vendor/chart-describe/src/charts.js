/**
 * Chart description builders: the front door.
 *
 * This is the sentence-building half of the chart describers. Every adapter
 * calls it, so they all speak with one voice.
 * The builders live in one file for each chart family (charts-xychart.js,
 * charts-pie.js and charts-radar.js), on top of the helpers in
 * charts-shared.js. This file keeps the one name that callers use,
 * window.ChartDescribeCharts. It offers three builders: buildXychartModel,
 * buildPieModel and buildRadarModel.
 *
 * Do not change a sentence in a family file unless you can compare the new
 * descriptions with the old ones, chart by chart. A wording change reaches
 * every person who reads a description.
 *
 * This file reads each family file's global when a builder runs, never when
 * the file loads. The load order is: text.js, model.js and render.js, then
 * charts-shared.js, charts-xychart.js, charts-pie.js and charts-radar.js, then
 * this file, then any adapter that calls it.
 *
 * An adapter reads a chart from its own source and hands the builder plain
 * facts: buildXychartModel takes a chart in a normalised shape, buildPieModel
 * takes a title and segments, and buildRadarModel takes a facts object. The
 * Chart.js adapter in this repo is chartjs.js.
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
      console.error(`[Chart Describe Charts] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Describe Charts] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Describe Charts] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Describe Charts] DEBUG: ${message}`, ...args);
    }
  }

  // ---------------------------------------------------------------------
  // The xychart builder, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------
  //
  // A module-scope capture would read undefined permanently if this file ran
  // before charts-xychart.js. Resolving at call time costs one property read and cannot
  // go stale, so load order between the chart-describe files cannot matter.

  /**
   * ChartDescribeXychart: from the global when present, otherwise (Node only) from
   * ./charts-xychart.js. Throws if neither exists, so a missing file fails loudly rather
   * than returning wrong text.
   * @returns {Object} ChartDescribeXychart
   */
  function xychartCore() {
    if (root.ChartDescribeXychart) return root.ChartDescribeXychart;
    if (typeof require === "function") return require("./charts-xychart.js");
    throw new Error("ChartDescribeXychart is not loaded");
  }

  // ---------------------------------------------------------------------
  // The pie builder, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------
  //
  // A module-scope capture would read undefined permanently if this file ran
  // before charts-pie.js. Resolving at call time costs one property read and cannot
  // go stale, so load order between the chart-describe files cannot matter.

  /**
   * ChartDescribePie: from the global when present, otherwise (Node only) from
   * ./charts-pie.js. Throws if neither exists, so a missing file fails loudly rather
   * than returning wrong text.
   * @returns {Object} ChartDescribePie
   */
  function pieCore() {
    if (root.ChartDescribePie) return root.ChartDescribePie;
    if (typeof require === "function") return require("./charts-pie.js");
    throw new Error("ChartDescribePie is not loaded");
  }

  // ---------------------------------------------------------------------
  // The radar builder, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------
  //
  // A module-scope capture would read undefined permanently if this file ran
  // before charts-radar.js. Resolving at call time costs one property read and cannot
  // go stale, so load order between the chart-describe files cannot matter.

  /**
   * ChartDescribeRadar: from the global when present, otherwise (Node only) from
   * ./charts-radar.js. Throws if neither exists, so a missing file fails loudly rather
   * than returning wrong text.
   * @returns {Object} ChartDescribeRadar
   */
  function radarCore() {
    if (root.ChartDescribeRadar) return root.ChartDescribeRadar;
    if (typeof require === "function") return require("./charts-radar.js");
    throw new Error("ChartDescribeRadar is not loaded");
  }

  /**
   * Describe a bar or line chart as a model (the work is in charts-xychart.js).
   * @param {Object} chart - The chart in the normalised shape
   * @param {Object} [options] - Caller options, passed through unchanged
   * @returns {Object} A DescriptionModel
   */
  function buildXychartModel(chart, options) {
    return xychartCore().buildXychartModel(chart, options);
  }

  /**
   * Describe a pie chart as a model (the work is in charts-pie.js).
   * @param {string} title - The chart's title
   * @param {Array<Object>} segments - The pie segments
   * @returns {Object} A DescriptionModel
   */
  function buildPieModel(title, segments) {
    return pieCore().buildPieModel(title, segments);
  }

  /**
   * Describe a radar chart as a model (the work is in charts-radar.js).
   * @param {Object} facts - The facts an adapter read from the radar chart
   * @returns {Object} A DescriptionModel
   */
  function buildRadarModel(facts) {
    return radarCore().buildRadarModel(facts);
  }

  logInfo("Chart builders initialised successfully");

  // What the describers call: the three model builders. Each returns a
  // DescriptionModel (see model.js), which the caller renders with its own
  // profile (render.js). The other builders are reached only through these
  // and stay private until another describer needs them.
  const api = {
    buildXychartModel,
    buildPieModel,
    buildRadarModel,
  };

  root.ChartDescribeCharts = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
