/**
 * Mermaid Accessibility - XY Chart Module
 *
 * Generates accessible descriptions for `xychart-beta` diagrams from the shared
 * parse adapter's XY chart surface (mermaid-parse-adapter.js), never from the
 * SVG. The fifteenth generator; before it existed an XY chart received the
 * core's honest "no description available" fallback.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-xychart-gold-targets-2026-08-23.md — rules XC1 to XC23 and six
 * byte-exact approved targets, pinned by thirty-three harness fixtures. A mismatch
 * between this module's output and a target is a STOP that goes back to the
 * design seat; it is never a reason to edit a target or a fixture.
 *
 * WHY THIS MODULE READS AN ADAPTER SURFACE THAT READS THE SOURCE. Mermaid's
 * xychart db delivers no data at all — every one of its nineteen members is a
 * function and none returns the chart's numbers, its series names or its axis
 * declarations (docs/mermaid-xychart-grounding-2026-08-22.md). Only `title`,
 * `accTitle` and `accDescr` come from the db. The adapter's surface therefore
 * reads the author's own source for everything else, inside the same queue
 * slot, and only after Mermaid has judged the source valid.
 *
 * THE STATISTICS ARE CHART.JS'S, DELIBERATELY. This engine and
 * md-scripts/charts/chart-accessibility.js are siblings, and one reader meeting
 * both should hear one voice, so the thresholds, the trend vocabulary and the
 * number formatter are that engine's, measured and quoted in
 * docs/mermaid-xychart-chartjs-conventions-2026-08-22.md. Its measured defects
 * are fixed here rather than inherited: see FIXED CHART.JS DEFECTS below.
 */
const XychartModule = (function () {
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

  // Current logging level (can be modified at runtime if needed)
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logError(context, message) {
    if (!shouldLog(LOG_LEVELS.ERROR)) return;

    if (typeof message === "object") {
      console.error(`[XY Chart][ERROR][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.error(`[XY Chart][ERROR][${context}] ${message}`);
    }
  }

  /**
   * Log a warning message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logWarn(context, message) {
    if (!shouldLog(LOG_LEVELS.WARN)) return;

    if (typeof message === "object") {
      console.warn(`[XY Chart][WARN][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.warn(`[XY Chart][WARN][${context}] ${message}`);
    }
  }

  /**
   * Log an info message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logInfo(context, message) {
    if (!shouldLog(LOG_LEVELS.INFO)) return;

    if (typeof message === "object") {
      console.log(`[XY Chart][INFO][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[XY Chart][INFO][${context}] ${message}`);
    }
  }

  /**
   * Log a debug message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logDebug(context, message) {
    if (!shouldLog(LOG_LEVELS.DEBUG)) return;

    if (typeof message === "object") {
      console.log(`[XY Chart][DEBUG][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[XY Chart][DEBUG][${context}] ${message}`);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("Module Check", "Core module not loaded!");
    return;
  }

  // ---------------------------------------------------------------------
  // The shared description builders, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------
  //
  // The sentence-building half of this describer lives in
  // vendor/chart-describe/src/charts.js, so that the Chart.js describer can
  // speak with the same voice. A module-scope `const` would capture
  // `undefined` permanently if this file ever ran before charts.js. Resolving
  // off `window` at call time costs one property read per call and cannot go
  // stale. If charts.js is missing, the first call throws a TypeError, and the
  // core's generation-failed fallback takes over: never silently wrong text.

  /**
   * The shared description builders (buildShortOpening, buildTakeaway,
   * buildConstruction, buildInsights, buildTable, escapeText, TIERS), resolved
   * at call time.
   * @returns {Object} ChartDescribeCharts
   */
  function chartsCore() {
    return window.ChartDescribeCharts;
  }

  // ---------------------------------------------------------------------
  // The registered tiers
  // ---------------------------------------------------------------------

  /**
   * Fetch and verify the chart, or throw.
   *
   * A parse rejection is deliberately NOT caught — the core's catch turns it
   * into the honest generation-failed fallback. That covers the adapter's own
   * reader errors, including the pre-scan that refuses an `accDescr { … }`
   * block before it can hang Mermaid's parser. A failed adapter self-check
   * throws for the same reason: never narrate an unverified chart.
   *
   * `isXychartHealthy()` reads `null` until the lazy self-check settles, which
   * is why the guard tests for `false` rather than falsiness — a `!healthy`
   * test would refuse every first call on a page.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised chart
   */
  async function readChart(code) {
    const chart = await window.MermaidParseAdapter.parseXychart(code);
    if (window.MermaidParseAdapter.isXychartHealthy() === false) {
      throw new Error(
        "Parse adapter failed its XY chart self-check; refusing to narrate an unverified chart"
      );
    }
    if (!chart.series || chart.series.length === 0) {
      throw new Error("XY chart carries no data series; refusing to narrate it");
    }
    return chart;
  }

  /**
   * Generate a short description for an XY chart.
   *
   * The PLAIN form is the tier of record and is never escaped (knowledge base
   * § 14.2 rule 5): it reaches a `textContent` sink and the SVG's `aria-label`,
   * where an entity would be announced literally. The HTML form is the same
   * sentence escaped exactly once, with no spans and no classes of its own.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("generateShortDescription", "Generating short description");

    const chart = await readChart(code);
    const core = chartsCore();
    const text = `${core.buildShortOpening(chart, false)} ${core.buildTakeaway(chart, false, core.TIERS.SHORT)}`;
    logDebug("Final Short Description", text);

    return {
      html: core.escapeText(text),
      text: text,
    };
  }

  /**
   * Wrapper for the short description generator to maintain backwards compatibility
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the plain text description
   */
  async function shortDescriptionWrapper(svgElement, code) {
    const descriptions = await generateShortDescription(svgElement, code);

    // Return text version for backwards compatibility
    return descriptions.text;
  }

  /**
   * Generate a detailed description for an XY chart.
   *
   * Three headed sections in a fixed order (rule XC3): Chart Construction, Key
   * Insights with the takeaway first and bolded, and the Data Table. Chart.js's
   * dead Statistical Summary section and its duplicate label list are not
   * carried.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("generateDetailedDescription", "Generating XY chart description");

    const chart = await readChart(code);
    const core = chartsCore();

    const parts = [];
    parts.push("<h4>Chart Construction</h4>");
    parts.push(...core.buildConstruction(chart));
    parts.push("<h4>Key Insights</h4>");
    parts.push("<ul>");
    parts.push(...core.buildInsights(chart));
    parts.push("</ul>");
    parts.push("<h4>Data Table</h4>");
    parts.push(...core.buildTable(chart));

    // Newline-joined so text-content extraction stays readable: without them,
    // list and row boundaries concatenate with no space.
    return parts.join("\n");
  }

  // Register with the core module. `generateShort` returns plain text because
  // the core assigns its result straight to descriptions.short, which reaches
  // the figcaption and the SVG aria-label.
  //
  // generateShortHTML is the ASYNC shape, and it has to be: this module awaits
  // the parse adapter, so `generateShortDescription(...).html` on the returned
  // promise would be `undefined` and the tier would register, be called, and
  // yield nothing silently (knowledge base § 3, register item 13). Flowchart is
  // the precedent this follows.
  window.MermaidAccessibility.registerDescriptionGenerator("xychart", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  // Public API to allow runtime configuration of logging levels
  const publicAPI = {
    // Allow external configuration of logging level
    setLogLevel: function (level) {
      if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
        logInfo("setLogLevel", `Logging level changed to ${level}`);
      } else {
        logWarn("setLogLevel", `Invalid log level: ${level}`);
      }
    },

    getLogLevel: function () {
      return currentLogLevel;
    },

    // Expose log level constants for external use
    LOG_LEVELS: LOG_LEVELS,
  };

  logInfo(
    "XY Chart Module",
    "XY chart module loaded and registered on the parse adapter's XY chart surface"
  );

  return publicAPI;
})();

// Export statements (outside the IIFE as required)
if (typeof module !== "undefined" && module.exports) {
  module.exports = XychartModule;
} else {
  window.XychartModule = XychartModule;
}
