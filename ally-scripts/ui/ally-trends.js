/**
 * @fileoverview Ally Accessibility Reporting Tool - Trends view
 * @module AllyTrends UI
 * @requires ALLY_TRENDS (lazy-loaded), ALLY_LOOKUP, Chart.js
 *
 * @description
 * Renders accessibility scores over time, for the institution or one
 * department. This is the only view in the tool built from a periodic export
 * rather than a live request: the Ally REST API accepts limit, offset, sort,
 * order and filters and nothing else, so there is no way to ask it for an
 * earlier position.
 *
 * The data module carries usability flags and this view honours them. A period
 * with no files reports a ~98% overall score because the score collapses to
 * the WYSIWYG score, and the trailing period is always mid-accumulation.
 * Plotted raw, both produce a confident and completely false picture.
 */

const ALLY_TRENDS_UI = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration
  // ========================================================================

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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[AllyTrendsUI] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[AllyTrendsUI] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[AllyTrendsUI] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[AllyTrendsUI] " + message, ...args);
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  /**
   * Where the bundled trends data lives, for a page without the tenant
   * resolver. With the resolver present the URL comes from
   * ALLY_TENANT_DATA.describeTrends(), which also knows a hosted folder's.
   */
  const DATA_URL = "ally-scripts/core/ally-trends-data.js";

  /**
   * Whose history the bundled trends file holds. Named in the provenance
   * line because that file is ONE institution's export: before multi-tenancy
   * Stage 4 the line gave a date and not an institution, so a tenant on their
   * own uploaded course data would have read Southampton's history as their
   * own. Since Stage 7 the view asks the resolver whose history is installed
   * (see trendsPlan), so this string is only ever shown when it is true.
   */
  const BUNDLED_DATA_INSTITUTION = "University of Southampton";

  /** The three aggregate files that carry an export's history (Stage 7). */
  const TREND_FILES = "years.csv, months.csv and departments_terms.csv";

  const UNAVAILABLE_PREFIX =
    "Trend data is not available for this institution's configuration. ";

  /**
   * Shown when the page runs on a tenant's course data - uploaded (Stage 4)
   * or fetched from a URL (Stage 6) - that did not include the aggregate
   * files. Names the three files, because adding them is the remedy.
   */
  const UNAVAILABLE_NO_TREND_FILES =
    UNAVAILABLE_PREFIX +
    "Your course data - uploaded or fetched from a URL - did not include " +
    TREND_FILES +
    ", which carry the accessibility history. Add those three files to the " +
    "upload, or regenerate the hosted payload with them, to see this view. " +
    "The other reports are unaffected.";

  /** Shown when no course data is installed for the tenant at all. */
  const UNAVAILABLE_NO_COURSE_DATA =
    UNAVAILABLE_PREFIX +
    "No course data is installed for this Client ID, so there is no history " +
    "to show. Upload your Ally export - including " +
    TREND_FILES +
    " - or fetch it from a URL in Set Up. The other reports are unaffected.";

  /** Shown when a hosted folder (the script route) has no trends module. */
  const UNAVAILABLE_SCRIPT_MISSING =
    UNAVAILABLE_PREFIX +
    "The folder your course data is loaded from has no ally-trends-data.js. " +
    "Generate it with the converter from " +
    TREND_FILES +
    " and host it beside the other two files. The other reports are unaffected.";

  /** The bundled module failed to load: an error, not a tenant's gap. */
  const LOAD_FAILED_MESSAGE =
    "Trend data could not be loaded, so this view is unavailable. The other reports are unaffected.";

  /** Fallbacks for the resolver's enums when it is absent from the page. */
  const PLAN = Object.freeze({ SCRIPT: "script", INSTALLED: "installed", NONE: "none" });
  const REASON = Object.freeze({ NO_COURSE_DATA: "no-course-data", NO_TREND_FILES: "no-trend-files" });

  /** Which department dataset pairs with each institution-level period. */
  const DEPARTMENT_DATASET = Object.freeze({
    year: "departmentYear",
    term: "departmentTerm",
    // There is no departmentMonth: departments_months.csv is 2.5 MB against
    // 553 KB for everything else, for a grain nobody has asked for.
    month: null,
  });

  const PERIOD_LABELS = Object.freeze({
    year: "academic year",
    term: "term",
    month: "month",
  });

  const elements = {
    section: null,
    period: null,
    metric: null,
    department: null,
    status: null,
    canvas: null,
    summary: null,
    table: null,
    provenance: null,
  };

  let chartInstance = null;
  let dataLoading = null;
  let dataLoadingUrl = null;
  /** The URL whose module installed the ALLY_TRENDS now on the page, if the view loaded it. */
  let loadedFrom = null;
  /** The ALLY_TRENDS object the department list was last built from. */
  let populatedFor = null;
  let initialised = false;

  // ========================================================================
  // Data loading
  // ========================================================================

  /**
   * Loads a trends data module once per URL, on first use.
   *
   * Deliberately NOT loaded with the course data: this is half a megabyte for
   * a view most sessions never open. The short-circuit is on the URL the
   * current global came from, NOT on the global existing - before Stage 7 it
   * was the latter, and nothing uninstalled ALLY_TRENDS, so a tenant's
   * history could sit behind a switch back to the bundled data and be
   * labelled Southampton's. The resolver now uninstalls on every path that
   * does not install, and this function re-fetches whenever the URL differs.
   *
   * @param {string} url - The module to load
   * @returns {Promise<boolean>} Whether ALLY_TRENDS was installed by it
   */
  function loadData(url) {
    if (typeof ALLY_TRENDS !== "undefined" && loadedFrom === url) return Promise.resolve(true);
    if (dataLoading && dataLoadingUrl === url) return dataLoading;

    setStatus("Loading trend data…");
    dataLoadingUrl = url;

    dataLoading = new Promise(function (resolve) {
      // A script that loads but installs nothing - a host answering 200 with
      // an HTML page where the module should be - must read as a failure.
      const before = typeof ALLY_TRENDS === "undefined" ? undefined : ALLY_TRENDS;
      const script = document.createElement("script");
      script.src = url;
      script.onload = function () {
        dataLoading = null;
        const installed = typeof ALLY_TRENDS !== "undefined" && ALLY_TRENDS !== before;
        loadedFrom = installed ? url : null;
        if (installed) logInfo("trend data loaded from " + url);
        else logWarn("a script loaded from " + url + " but installed no trend data");
        resolve(installed);
      };
      script.onerror = function () {
        dataLoading = null;
        loadedFrom = null;
        logWarn("trend data failed to load from " + url);
        resolve(false);
      };
      document.head.appendChild(script);
    });

    return dataLoading;
  }

  // ========================================================================
  // Rendering
  // ========================================================================

  /**
   * Writes the polite status line, only when it has actually changed.
   * @param {string} message - Status text
   */
  function setStatus(message) {
    if (!elements.status) return;
    if (elements.status.textContent === message) return;
    elements.status.textContent = message;
  }

  /**
   * Formats a score for display.
   * @param {number} value - Score on a 0-1 scale
   * @returns {string} Percentage text
   */
  function formatScore(value) {
    if (typeof value !== "number") return "Not scored";
    if (
      typeof ALLY_CONFIG !== "undefined" &&
      typeof ALLY_CONFIG.formatScoreAsPercentage === "function"
    ) {
      return ALLY_CONFIG.formatScoreAsPercentage(value, 1);
    }
    return (value * 100).toFixed(1) + "%";
  }

  /**
   * Reads the current control selections.
   * @returns {Object} { dataset, metric, departmentId, periodKind }
   */
  function readControls() {
    const periodKind = elements.period ? elements.period.value : "month";
    const departmentId = elements.department ? elements.department.value : "";
    const departmentDataset = DEPARTMENT_DATASET[periodKind];

    return {
      periodKind: periodKind,
      metric: elements.metric ? elements.metric.value : "Files score",
      departmentId: departmentId,
      // Falling back to the institution dataset when a department is chosen
      // for a period that has no department breakdown.
      dataset: departmentId && departmentDataset ? departmentDataset : periodKind,
      departmentUnavailable: !!departmentId && !departmentDataset,
    };
  }

  /**
   * Builds the accessible data table. This is not optional decoration: a
   * canvas is opaque to assistive technology, so the table IS the chart for
   * anyone not looking at it.
   * @param {Array<Object>} points - Series points
   * @param {string} metric - Metric name
   */
  function renderTable(points, metric) {
    if (!elements.table) return;

    if (points.length === 0) {
      elements.table.innerHTML = "<p>No data for this selection.</p>";
      return;
    }

    const rows = points
      .map(function (point) {
        const note = point.partial ? " (incomplete)" : "";
        return (
          "<tr><th scope=\"row\">" +
          escapeHtml(String(point.x)) +
          note +
          "</th><td>" +
          escapeHtml(formatScore(point.y)) +
          "</td></tr>"
        );
      })
      .join("");

    elements.table.innerHTML =
      '<table class="ally-trends-data-table">' +
      "<caption>" +
      escapeHtml(metric) +
      " by " +
      escapeHtml(PERIOD_LABELS[readControls().periodKind] || "period") +
      "</caption>" +
      '<thead><tr><th scope="col">Period</th><th scope="col">' +
      escapeHtml(metric) +
      "</th></tr></thead><tbody>" +
      rows +
      "</tbody></table>";
  }

  /**
   * Escapes HTML special characters.
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Renders the line chart.
   * @param {Array<Object>} points - Series points
   * @param {string} metric - Metric name
   * @param {string} scopeLabel - What the series covers
   */
  function renderChart(points, metric, scopeLabel) {
    if (!elements.canvas) return;

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    if (typeof Chart === "undefined") {
      logWarn("Chart.js is not available - the data table still carries the figures");
      return;
    }
    if (points.length === 0) return;

    const colour =
      typeof ALLY_CONFIG !== "undefined" && ALLY_CONFIG.CHART_COLOURS
        ? ALLY_CONFIG.CHART_COLOURS.good
        : "#1a5a96";

    chartInstance = new Chart(elements.canvas, {
      type: "line",
      data: {
        labels: points.map(function (p) { return String(p.x); }),
        datasets: [
          {
            label: metric + " — " + scopeLabel,
            data: points.map(function (p) { return p.y * 100; }),
            borderColor: colour,
            backgroundColor: colour,
            // The trailing period is mid-accumulation, so it is drawn hollow
            // rather than silently presented as a finished value.
            pointStyle: points.map(function (p) {
              return p.partial ? "triangle" : "circle";
            }),
            pointRadius: points.map(function (p) { return p.partial ? 6 : 3; }),
            tension: 0.2,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              label: function (context) {
                const point = points[context.dataIndex];
                return (
                  metric +
                  ": " +
                  context.parsed.y.toFixed(1) +
                  "%" +
                  (point && point.partial ? " (period incomplete)" : "")
                );
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: { display: true, text: metric + " (%)" },
          },
          x: { title: { display: true, text: "Period" } },
        },
      },
    });
  }

  /**
   * Redraws everything from the current control state.
   */
  function render() {
    if (typeof ALLY_TRENDS === "undefined") return;

    const controls = readControls();

    // Collected and emitted with the summary in ONE write. Setting the status
    // here and again below meant the second write silently erased the first,
    // so the fallback was never actually seen.
    const notes = [];

    if (controls.departmentUnavailable) {
      notes.push(
        "Department breakdowns are available by academic year and by term, not by month, so this shows the whole institution.",
      );
    }

    const points = ALLY_TRENDS.series(controls.dataset, controls.metric, {
      departmentId: controls.departmentUnavailable ? "" : controls.departmentId,
    });

    const scopeLabel =
      controls.departmentId && !controls.departmentUnavailable
        ? departmentName(controls.departmentId)
        : "whole institution";

    if (points.length === 0) {
      // "No data" is true but unhelpful. A small department usually HAS rows
      // and they are all below the file threshold, which is a different thing
      // from a broken selection and needs saying.
      const unguarded = ALLY_TRENDS.series(controls.dataset, controls.metric, {
        departmentId: controls.departmentUnavailable ? "" : controls.departmentId,
        includeUnusable: true,
      });

      const message =
        unguarded.length > 0
          ? "No periods for " +
            scopeLabel +
            " have at least " +
            ALLY_TRENDS.MIN_FILES +
            " files, so there is nothing here that can be scored meaningfully. Try a larger scope or a wider period."
          : "No data for this selection.";

      notes.push(message);
      setStatus(notes.join(" "));
      if (elements.summary) elements.summary.textContent = message;
      renderChart([], controls.metric, scopeLabel);
      renderTable([], controls.metric);
      return;
    }

    renderChart(points, controls.metric, scopeLabel);
    renderTable(points, controls.metric);

    const first = points[0];
    const last = points[points.length - 1];
    const change = (last.y - first.y) * 100;
    const direction = change > 0.05 ? "up" : change < -0.05 ? "down" : "unchanged";

    // The summary is what a screen reader gets in place of the picture, so it
    // carries the shape of the line rather than just its endpoints.
    const summary =
      controls.metric +
      " for " +
      scopeLabel +
      ", " +
      points.length +
      " periods from " +
      first.x +
      " to " +
      last.x +
      ". " +
      formatScore(first.y) +
      " to " +
      formatScore(last.y) +
      ", " +
      direction +
      (direction === "unchanged" ? "" : " " + Math.abs(change).toFixed(1) + " percentage points") +
      "." +
      (last.partial ? " The final period is still accumulating and is not a finished figure." : "");

    if (elements.summary) elements.summary.textContent = summary;
    notes.unshift(summary);
    setStatus(notes.join(" "));
  }

  /**
   * Resolves a department id to its name.
   * @param {string} id - Department ID
   * @returns {string} Name, or the id when unknown
   */
  function departmentName(id) {
    if (typeof ALLY_LOOKUP === "undefined") return id;
    return ALLY_LOOKUP.getDepartmentName(id);
  }

  /**
   * Fills the department dropdown, grouped by faculty where one is known.
   * Rebuilt whenever the installed ALLY_TRENDS changes - a tenant switch
   * brings a different department list, and the old one would otherwise
   * stay on screen naming departments the new data has never heard of.
   */
  function populateDepartments() {
    if (!elements.department || typeof ALLY_TRENDS === "undefined") return;
    if (populatedFor === ALLY_TRENDS) return;

    // Keep the first option (the whole institution); drop every group.
    Array.prototype.slice
      .call(elements.department.querySelectorAll("optgroup"))
      .forEach(function (group) { group.remove(); });
    elements.department.value = "";
    populatedFor = ALLY_TRENDS;

    const ids = ALLY_TRENDS.departments("departmentYear");
    const groups = {};

    ids.forEach(function (id) {
      const department =
        typeof ALLY_LOOKUP !== "undefined" ? ALLY_LOOKUP.getDepartment(id) : null;
      if (department && department.isSystemTag) return;

      const parent =
        department && department.parentName ? department.parentName : "Other";
      if (!groups[parent]) groups[parent] = [];
      groups[parent].push({ id: id, name: departmentName(id) });
    });

    Object.keys(groups)
      .sort()
      .forEach(function (parent) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = parent;

        groups[parent]
          .sort(function (a, b) { return a.name.localeCompare(b.name); })
          .forEach(function (entry) {
            const option = document.createElement("option");
            option.value = entry.id;
            option.textContent = entry.name;
            optgroup.appendChild(option);
          });

        elements.department.appendChild(optgroup);
      });

    logInfo("populated " + ids.length + " departments in " + Object.keys(groups).length + " groups");
  }

  /**
   * Shows where the figures came from, so nobody reads them as live - and
   * WHOSE they are: the bundled sentence names Southampton, a tenant's names
   * the stored institution name, or "your institution" when none is stored.
   * @param {Object} plan - trendsPlan() result
   */
  function showProvenance(plan) {
    if (!elements.provenance || typeof ALLY_TRENDS === "undefined") return;

    const taken = " Ally export taken " + String(ALLY_TRENDS.generatedOn).slice(0, 10);
    const from = plan.bundled
      ? "From the bundled " + BUNDLED_DATA_INSTITUTION + taken
      : plan.institution
        ? "From the " + plan.institution + taken
        : "From your institution's" + taken;

    elements.provenance.textContent =
      from +
      ". Periods with fewer than " +
      ALLY_TRENDS.MIN_FILES +
      " files are omitted, because a period with almost no files reports a near-perfect score.";
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  function cacheElements() {
    elements.section = document.getElementById("ally-trends-section");
    elements.period = document.getElementById("ally-trends-period");
    elements.metric = document.getElementById("ally-trends-metric");
    elements.department = document.getElementById("ally-trends-department");
    elements.status = document.getElementById("ally-trends-status");
    elements.canvas = document.getElementById("ally-trends-chart");
    elements.summary = document.getElementById("ally-trends-chart-summary");
    elements.table = document.getElementById("ally-trends-table");
    elements.provenance = document.getElementById("ally-trends-provenance");
  }

  function attachEventListeners() {
    [elements.period, elements.metric, elements.department].forEach(function (control) {
      if (!control) return;
      control.addEventListener("change", render);
    });
  }

  /**
   * What this view may show, and from where. Asks the Stage 4 resolver,
   * which reports what it actually INSTALLED - since Stage 7 that includes
   * a tenant's own history from their stored record, or a hosted folder's
   * module to load lazily. Falls back to the stored setting when the
   * resolver is absent, and to the bundled file when nothing at all is
   * available, so a page without the multi-tenancy scripts behaves exactly
   * as it did before.
   * @returns {{mode: string, url?: string, reason?: string, bundled: boolean, institution: string}}
   */
  function trendsPlan() {
    if (
      typeof ALLY_TENANT_DATA !== "undefined" &&
      typeof ALLY_TENANT_DATA.describeTrends === "function"
    ) {
      return ALLY_TENANT_DATA.describeTrends();
    }

    const bundledPlan = { mode: PLAN.SCRIPT, url: DATA_URL, bundled: true, institution: "" };
    const bundled =
      typeof ALLY_CONFIG !== "undefined" && ALLY_CONFIG.DATA_SOURCES
        ? ALLY_CONFIG.DATA_SOURCES.BUNDLED
        : "bundled";

    if (typeof ALLY_CONFIG !== "undefined" && ALLY_CONFIG.STORAGE_KEYS) {
      try {
        const stored = window.localStorage.getItem(
          ALLY_CONFIG.STORAGE_KEYS.TENANT_DATA_SOURCE,
        );
        if (stored && stored !== bundled) {
          return { mode: PLAN.NONE, reason: REASON.NO_COURSE_DATA, bundled: false, institution: "" };
        }
      } catch (e) {
        return bundledPlan;
      }
    }

    return bundledPlan;
  }

  /**
   * The sentence for a NONE plan. Every one names the three files, because
   * adding them is the remedy whichever way the data arrived.
   * @param {Object} plan - trendsPlan() result
   * @returns {string}
   */
  function unavailableSentence(plan) {
    return plan.reason === REASON.NO_COURSE_DATA
      ? UNAVAILABLE_NO_COURSE_DATA
      : UNAVAILABLE_NO_TREND_FILES;
  }

  /**
   * Clears whatever a previous render left and says why there is no chart.
   * Reached on every activation under a tenant without history, including
   * when a chart was rendered EARLIER in the session for other data.
   * @param {string} message - Which of the unavailable sentences applies
   */
  function showUnavailable(message) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    if (elements.summary) elements.summary.textContent = "";
    if (elements.table) elements.table.innerHTML = "";
    if (elements.provenance) elements.provenance.textContent = "";
    setStatus(message);
    logInfo("trends refused: no history for this data source");
  }

  /**
   * Prepares the view. Safe to call repeatedly; a module loads once per URL.
   * @returns {Promise<boolean>} Whether the view is usable
   */
  async function activate() {
    if (!initialised) {
      cacheElements();
      attachEventListeners();
      initialised = true;
    }

    // Decided BEFORE any load, so the bundled file is never fetched for a
    // tenant it does not belong to (Stage 4), and a tenant's own installed
    // history is rendered without a load at all (Stage 7).
    const plan = trendsPlan();

    if (plan.mode === PLAN.NONE) {
      showUnavailable(unavailableSentence(plan));
      return false;
    }

    if (plan.mode === PLAN.SCRIPT) {
      const ready = await loadData(plan.url);
      if (!ready) {
        // The bundled module failing is an error; a hosted folder without
        // the module is simply a tenant with no history.
        if (plan.bundled) {
          setStatus(LOAD_FAILED_MESSAGE);
          return false;
        }
        showUnavailable(UNAVAILABLE_SCRIPT_MISSING);
        return false;
      }
    }

    if (typeof ALLY_TRENDS === "undefined") {
      showUnavailable(UNAVAILABLE_NO_TREND_FILES);
      return false;
    }

    populateDepartments();
    showProvenance(plan);
    render();
    return true;
  }

  function isInitialised() {
    return initialised;
  }

  return {
    activate: activate,
    render: render,
    isInitialised: isInitialised,
    // Exposed for the suites, which assert the exact sentences.
    UNAVAILABLE_NO_TREND_FILES: UNAVAILABLE_NO_TREND_FILES,
    UNAVAILABLE_NO_COURSE_DATA: UNAVAILABLE_NO_COURSE_DATA,
    UNAVAILABLE_SCRIPT_MISSING: UNAVAILABLE_SCRIPT_MISSING,
    LOAD_FAILED_MESSAGE: LOAD_FAILED_MESSAGE,
  };
})();

if (typeof window !== "undefined") {
  window.ALLY_TRENDS_UI = ALLY_TRENDS_UI;
}
