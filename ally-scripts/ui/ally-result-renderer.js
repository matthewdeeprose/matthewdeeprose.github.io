/**
 * @fileoverview Ally Result Renderer - Displays query results in accessible tables
 * @module AllyResultRenderer
 * @requires ALLY_CONFIG
 * @requires ALLY_LOOKUP
 * @requires ALLY_UI_MANAGER
 * @requires AccessibleSortableTable (from markdown-it-sortable-tables-combined.js)
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Renders API query results as accessible, sortable tables with:
 * - Column selection and visibility management
 * - Score formatting with colour coding
 * - Term/department name lookups
 * - Export to CSV and JSON
 * - View toggle (Table/Chart - Chart disabled until Phase 6)
 *
 * @example
 * // Render results
 * ALLY_RESULT_RENDERER.render(apiResult, 'overall');
 *
 * // Export visible data as CSV
 * ALLY_RESULT_RENDERER.exportCSV(false);
 */

const ALLY_RESULT_RENDERER = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[AllyResultRenderer] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyResultRenderer] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyResultRenderer] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyResultRenderer] " + message, ...args);
  }

  // ========================================================================
  // Column Definitions
  // ========================================================================

  /**
   * Column definitions for each endpoint
   * @type {Object.<string, Object>}
   */
  const COLUMN_DEFINITIONS = {
    overall: {
      // Course Information
      courseName: {
        key: "courseName",
        label: "Course Name",
        category: "Course Info",
        formatter: "courseLink",
      },
      courseCode: {
        key: "courseCode",
        label: "Code",
        category: "Course Info",
        formatter: "text",
      },
      courseId: {
        key: "courseId",
        label: "Course ID",
        category: "Course Info",
        formatter: "text",
      },
      termName: {
        key: "termName",
        label: "Term",
        category: "Course Info",
        formatter: "termLookup",
      },
      termId: {
        key: "termId",
        label: "Term ID",
        category: "Course Info",
        formatter: "text",
      },
      departmentName: {
        key: "departmentName",
        label: "Department",
        category: "Course Info",
        formatter: "departmentLookup",
      },
      departmentId: {
        key: "departmentId",
        label: "Department ID",
        category: "Course Info",
        formatter: "text",
      },
      // Scores
      overallScore: {
        key: "overallScore",
        label: "Overall",
        category: "Scores",
        formatter: "score",
      },
      filesScore: {
        key: "filesScore",
        label: "Files",
        category: "Scores",
        formatter: "score",
      },
      WYSIWYGScore: {
        key: "WYSIWYGScore",
        label: "WYSIWYG",
        category: "Scores",
        formatter: "score",
      },
      // Counts
      totalFiles: {
        key: "totalFiles",
        label: "Total Files",
        category: "Counts",
        formatter: "number",
      },
      totalWYSIWYG: {
        key: "totalWYSIWYG",
        label: "WYSIWYG Items",
        category: "Counts",
        formatter: "number",
      },
      numberOfStudents: {
        key: "numberOfStudents",
        label: "Students",
        category: "Counts",
        formatter: "number",
      },
      // File Types
      pdf: {
        key: "pdf",
        label: "PDFs",
        category: "File Types",
        formatter: "number",
      },
      document: {
        key: "document",
        label: "Documents",
        category: "File Types",
        formatter: "number",
      },
      presentation: {
        key: "presentation",
        label: "Presentations",
        category: "File Types",
        formatter: "number",
      },
      image: {
        key: "image",
        label: "Images",
        category: "File Types",
        formatter: "number",
      },
      "html-page": {
        key: "html-page",
        label: "HTML Pages",
        category: "File Types",
        formatter: "number",
      },
      other: {
        key: "other",
        label: "Other",
        category: "File Types",
        formatter: "number",
      },
      // Blackboard Content Types
      "application/x-folder": {
        key: "application/x-folder",
        label: "Folders",
        category: "Blackboard Types",
        formatter: "number",
      },
      "application/x-item": {
        key: "application/x-item",
        label: "Items",
        category: "Blackboard Types",
        formatter: "number",
      },
      "application/x-link-web": {
        key: "application/x-link-web",
        label: "Web Links",
        category: "Blackboard Types",
        formatter: "number",
      },
      "application/x-learning-module": {
        key: "application/x-learning-module",
        label: "Learning Modules",
        category: "Blackboard Types",
        formatter: "number",
      },
      "application/x-lti-launch": {
        key: "application/x-lti-launch",
        label: "LTI Tools",
        category: "Blackboard Types",
        formatter: "number",
      },
      "application/x-document": {
        key: "application/x-document",
        label: "BB Documents",
        category: "Blackboard Types",
        formatter: "number",
      },
      "application/x-page": {
        key: "application/x-page",
        label: "BB Pages",
        category: "Blackboard Types",
        formatter: "number",
      },
      "application/x-lesson": {
        key: "application/x-lesson",
        label: "Lessons",
        category: "Blackboard Types",
        formatter: "number",
      },
      "application/x-link-discussion-topic": {
        key: "application/x-link-discussion-topic",
        label: "Discussion Links",
        category: "Blackboard Types",
        formatter: "number",
      },
      // Status
      allyEnabled: {
        key: "allyEnabled",
        label: "Ally Enabled",
        category: "Status",
        formatter: "boolean",
      },
      lastCheckedOn: {
        key: "lastCheckedOn",
        label: "Last Checked",
        category: "Status",
        formatter: "date",
      },
      observedDeletedOn: {
        key: "observedDeletedOn",
        label: "Deleted On",
        category: "Status",
        formatter: "text",
      },
    },
    issues: {
      // Course Information
      courseName: {
        key: "courseName",
        label: "Course Name",
        category: "Course Info",
        formatter: "courseLink",
      },
      courseCode: {
        key: "courseCode",
        label: "Code",
        category: "Course Info",
        formatter: "text",
      },
      courseId: {
        key: "courseId",
        label: "Course ID",
        category: "Course Info",
        formatter: "text",
      },
      termName: {
        key: "termName",
        label: "Term",
        category: "Course Info",
        formatter: "termLookup",
      },
      termId: {
        key: "termId",
        label: "Term ID",
        category: "Course Info",
        formatter: "text",
      },
      departmentName: {
        key: "departmentName",
        label: "Department",
        category: "Course Info",
        formatter: "departmentLookup",
      },
      departmentId: {
        key: "departmentId",
        label: "Department ID",
        category: "Course Info",
        formatter: "text",
      },
      numberOfStudents: {
        key: "numberOfStudents",
        label: "Students",
        category: "Course Info",
        formatter: "number",
      },
      // Severe Issues (suffix 1)
      scanned1: {
        key: "scanned1",
        label: "Scanned PDFs",
        category: "Severe Issues",
        formatter: "severityCount",
        severity: "severe",
      },
      security1: {
        key: "security1",
        label: "Security Restricted",
        category: "Severe Issues",
        formatter: "severityCount",
        severity: "severe",
      },
      parsable1: {
        key: "parsable1",
        label: "Unparseable",
        category: "Severe Issues",
        formatter: "severityCount",
        severity: "severe",
      },
      imageSeizure1: {
        key: "imageSeizure1",
        label: "Seizure Risk",
        category: "Severe Issues",
        formatter: "severityCount",
        severity: "severe",
      },
      // Major Issues - Document (suffix 2)
      alternativeText2: {
        key: "alternativeText2",
        label: "Missing Alt Text",
        category: "Major Issues",
        formatter: "severityCount",
        severity: "major",
      },
      contrast2: {
        key: "contrast2",
        label: "Low Contrast",
        category: "Major Issues",
        formatter: "severityCount",
        severity: "major",
      },
      headingsPresence2: {
        key: "headingsPresence2",
        label: "Missing Headings",
        category: "Major Issues",
        formatter: "severityCount",
        severity: "major",
      },
      tableHeaders2: {
        key: "tableHeaders2",
        label: "Tables No Headers",
        category: "Major Issues",
        formatter: "severityCount",
        severity: "major",
      },
      tagged2: {
        key: "tagged2",
        label: "Untagged PDFs",
        category: "Major Issues",
        formatter: "severityCount",
        severity: "major",
      },
      imageDecorative2: {
        key: "imageDecorative2",
        label: "Decorative Not Marked",
        category: "Major Issues",
        formatter: "severityCount",
        severity: "major",
      },
      imageContrast2: {
        key: "imageContrast2",
        label: "Image Contrast",
        category: "Major Issues",
        formatter: "severityCount",
        severity: "major",
      },
      imageDescription2: {
        key: "imageDescription2",
        label: "Missing Description",
        category: "Major Issues",
        formatter: "severityCount",
        severity: "major",
      },
      ocred2: {
        key: "ocred2",
        label: "OCR Needed",
        category: "Major Issues",
        formatter: "severityCount",
        severity: "major",
      },
      // Major Issues - HTML (suffix 2)
      htmlImageAlt2: {
        key: "htmlImageAlt2",
        label: "HTML Image Alt",
        category: "Major Issues (HTML)",
        formatter: "severityCount",
        severity: "major",
      },
      htmlEmptyHeading2: {
        key: "htmlEmptyHeading2",
        label: "Empty Headings",
        category: "Major Issues (HTML)",
        formatter: "severityCount",
        severity: "major",
      },
      htmlHeadingsStart2: {
        key: "htmlHeadingsStart2",
        label: "HTML H1 Missing",
        category: "Major Issues (HTML)",
        formatter: "severityCount",
        severity: "major",
      },
      htmlHeadingsPresence2: {
        key: "htmlHeadingsPresence2",
        label: "HTML No Headings",
        category: "Major Issues (HTML)",
        formatter: "severityCount",
        severity: "major",
      },
      htmlLabel2: {
        key: "htmlLabel2",
        label: "Form Labels",
        category: "Major Issues (HTML)",
        formatter: "severityCount",
        severity: "major",
      },
      htmlCaption2: {
        key: "htmlCaption2",
        label: "Media Captions",
        category: "Major Issues (HTML)",
        formatter: "severityCount",
        severity: "major",
      },
      htmlObjectAlt2: {
        key: "htmlObjectAlt2",
        label: "Object Alt Text",
        category: "Major Issues (HTML)",
        formatter: "severityCount",
        severity: "major",
      },
      htmlColorContrast2: {
        key: "htmlColorContrast2",
        label: "HTML Contrast",
        category: "Major Issues (HTML)",
        formatter: "severityCount",
        severity: "major",
      },
      htmlTdHasHeader2: {
        key: "htmlTdHasHeader2",
        label: "Table Data Headers",
        category: "Major Issues (HTML)",
        formatter: "severityCount",
        severity: "major",
      },
      htmlEmptyTableHeader2: {
        key: "htmlEmptyTableHeader2",
        label: "Empty Table Headers",
        category: "Major Issues (HTML)",
        formatter: "severityCount",
        severity: "major",
      },
      htmlBrokenLink2: {
        key: "htmlBrokenLink2",
        label: "Broken Links",
        category: "Major Issues (HTML)",
        formatter: "severityCount",
        severity: "major",
      },
      // Minor Issues - Document (suffix 3)
      title3: {
        key: "title3",
        label: "Missing Title",
        category: "Minor Issues",
        formatter: "severityCount",
        severity: "minor",
      },
      languagePresence3: {
        key: "languagePresence3",
        label: "Language Not Set",
        category: "Minor Issues",
        formatter: "severityCount",
        severity: "minor",
      },
      languageCorrect3: {
        key: "languageCorrect3",
        label: "Wrong Language",
        category: "Minor Issues",
        formatter: "severityCount",
        severity: "minor",
      },
      headingsSequential3: {
        key: "headingsSequential3",
        label: "Heading Sequence",
        category: "Minor Issues",
        formatter: "severityCount",
        severity: "minor",
      },
      headingsStartAtOne3: {
        key: "headingsStartAtOne3",
        label: "Heading Start",
        category: "Minor Issues",
        formatter: "severityCount",
        severity: "minor",
      },
      headingsHigherLevel3: {
        key: "headingsHigherLevel3",
        label: "Higher Level Headings",
        category: "Minor Issues",
        formatter: "severityCount",
        severity: "minor",
      },
      imageOcr3: {
        key: "imageOcr3",
        label: "Image OCR",
        category: "Minor Issues",
        formatter: "severityCount",
        severity: "minor",
      },
      // Minor Issues - HTML (suffix 3)
      htmlTitle3: {
        key: "htmlTitle3",
        label: "HTML Title",
        category: "Minor Issues (HTML)",
        formatter: "severityCount",
        severity: "minor",
      },
      htmlHasLang3: {
        key: "htmlHasLang3",
        label: "HTML Language",
        category: "Minor Issues (HTML)",
        formatter: "severityCount",
        severity: "minor",
      },
      htmlHeadingOrder3: {
        key: "htmlHeadingOrder3",
        label: "Heading Order",
        category: "Minor Issues (HTML)",
        formatter: "severityCount",
        severity: "minor",
      },
      htmlLinkName3: {
        key: "htmlLinkName3",
        label: "Link Names",
        category: "Minor Issues (HTML)",
        formatter: "severityCount",
        severity: "minor",
      },
      htmlList3: {
        key: "htmlList3",
        label: "List Structure",
        category: "Minor Issues (HTML)",
        formatter: "severityCount",
        severity: "minor",
      },
      htmlDefinitionList3: {
        key: "htmlDefinitionList3",
        label: "Definition Lists",
        category: "Minor Issues (HTML)",
        formatter: "severityCount",
        severity: "minor",
      },
      htmlImageRedundantAlt3: {
        key: "htmlImageRedundantAlt3",
        label: "Redundant Alt Text",
        category: "Minor Issues (HTML)",
        formatter: "severityCount",
        severity: "minor",
      },
      // Special
      libraryReference: {
        key: "libraryReference",
        label: "Library References",
        category: "Other",
        formatter: "number",
      },
      // Status
      allyEnabled: {
        key: "allyEnabled",
        label: "Ally Enabled",
        category: "Status",
        formatter: "boolean",
      },
      lastCheckedOn: {
        key: "lastCheckedOn",
        label: "Last Checked",
        category: "Status",
        formatter: "date",
      },
      observedDeletedOn: {
        key: "observedDeletedOn",
        label: "Deleted On",
        category: "Status",
        formatter: "text",
      },
    },
  };

  /**
   * Default visible columns per endpoint
   * @type {Object.<string, string[]>}
   */
  const DEFAULT_COLUMNS = {
    overall: [
      "courseName",
      "courseCode",
      "termName",
      "overallScore",
      "filesScore",
      "WYSIWYGScore",
      "totalFiles",
      "numberOfStudents",
    ],
    issues: [
      "courseName",
      "courseCode",
      "termName",
      "scanned1",
      "alternativeText2",
      "headingsPresence2",
      "contrast2",
      "tableHeaders2",
      "title3",
    ],
  };

  // ========================================================================
  // Private State
  // ========================================================================

  /** @type {Object|null} Current API result data */
  let currentResult = null;

  /** @type {string} Current endpoint ('overall' or 'issues') */
  let currentEndpoint = "overall";

  /** @type {string[]} Currently visible column keys */
  let visibleColumns = [];

  /** @type {string} Current view mode ('table' or 'chart') */
  let currentView = "table";

  /** @type {number} Number of rows currently displayed */
  let displayedRows = 10;

  /** @type {number} Increment for "Show more" */
  const ROWS_INCREMENT = 20;

  /** @type {boolean} Initialisation state */
  let initialised = false;

  // ========================================================================
  // Private Methods - Formatters
  // ========================================================================

  /**
   * Escapes HTML entities in a string
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (typeof text !== "string") return String(text);
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Formats a value based on formatter type
   * @param {*} value - Value to format
   * @param {string} formatter - Formatter type
   * @param {Object} row - Full row data (for context like courseUrl)
   * @returns {string} HTML string
   */
  function formatValue(value, formatter, row) {
    switch (formatter) {
      case "text":
        return escapeHtml(value || "—");

      case "number":
        if (typeof value !== "number" || isNaN(value)) return "—";
        return escapeHtml(value.toLocaleString("en-GB"));

      case "score":
        if (typeof value !== "number" || isNaN(value)) {
          return '<span class="score-unknown">N/A</span>';
        }
        var colourClass =
          typeof ALLY_CONFIG !== "undefined"
            ? ALLY_CONFIG.getScoreColourClass(value)
            : "score-unknown";
        var percentage =
          typeof ALLY_CONFIG !== "undefined"
            ? ALLY_CONFIG.formatScoreAsPercentage(value)
            : (value * 100).toFixed(1) + "%";
        return (
          '<span class="score-badge ' +
          colourClass +
          '">' +
          escapeHtml(percentage) +
          "</span>"
        );

      case "severityCount":
        var count = typeof value === "number" ? value : 0;
        if (count === 0) return '<span class="ally-severity-none">0</span>';
        return escapeHtml(count.toLocaleString("en-GB"));

      case "courseLink":
        var name = escapeHtml(value || "Unnamed Course");
        var url = row.courseUrl;
        if (url) {
          return (
            '<a href="' +
            escapeHtml(url) +
            '" target="_blank" rel="noopener">' +
            name +
            ' <span aria-hidden="true">↗</span><span class="sr-only">(opens in new tab)</span></a>'
          );
        }
        return name;

      case "termLookup":
        if (value) return escapeHtml(value);
        if (row.termId && typeof ALLY_LOOKUP !== "undefined") {
          var termName = ALLY_LOOKUP.getTermName(row.termId);
          return escapeHtml(termName || "—");
        }
        return "—";

      case "departmentLookup":
        if (value) return escapeHtml(value);
        if (row.departmentId && typeof ALLY_LOOKUP !== "undefined") {
          var deptNames = ALLY_LOOKUP.formatDepartments(row.departmentId);
          return escapeHtml(deptNames || "—");
        }
        return "—";

      case "boolean":
        return value ? "Yes" : "No";

      case "date":
        if (!value) return "—";
        return escapeHtml(value);

      default:
        return escapeHtml(value || "—");
    }
  }

  // ========================================================================
  // Private Methods - Summary Generation
  // ========================================================================

  /**
   * Generates summary HTML for Overall endpoint
   * @param {Object} result - API result
   * @returns {string} HTML string
   */
  function generateOverallSummary(result) {
    var data = result.data || [];
    var metadata = result.metadata || {};

    var recordCount = data.length;
    var totalRecords = metadata.filteredTotal || metadata.total || recordCount;

    var scoreSum = { overall: 0, files: 0, wysiwyg: 0 };
    var scoreCounts = { overall: 0, files: 0, wysiwyg: 0 };

    data.forEach(function (row) {
      if (typeof row.overallScore === "number" && !isNaN(row.overallScore)) {
        scoreSum.overall += row.overallScore;
        scoreCounts.overall++;
      }
      if (typeof row.filesScore === "number" && !isNaN(row.filesScore)) {
        scoreSum.files += row.filesScore;
        scoreCounts.files++;
      }
      if (typeof row.WYSIWYGScore === "number" && !isNaN(row.WYSIWYGScore)) {
        scoreSum.wysiwyg += row.WYSIWYGScore;
        scoreCounts.wysiwyg++;
      }
    });

    var avgOverall =
      scoreCounts.overall > 0 ? scoreSum.overall / scoreCounts.overall : null;
    var avgFiles =
      scoreCounts.files > 0 ? scoreSum.files / scoreCounts.files : null;
    var avgWysiwyg =
      scoreCounts.wysiwyg > 0 ? scoreSum.wysiwyg / scoreCounts.wysiwyg : null;

    var html =
      "<p><strong>Showing " +
      recordCount +
      " of " +
      totalRecords +
      "</strong> records</p>";

    if (scoreCounts.overall > 0) {
      html += '<div class="ally-summary-scores">';
      html += "<p>Average scores for displayed records:</p><ul>";
      if (avgOverall !== null) {
        html +=
          "<li>Overall: " + formatValue(avgOverall, "score", {}) + "</li>";
      }
      if (avgFiles !== null) {
        html += "<li>Files: " + formatValue(avgFiles, "score", {}) + "</li>";
      }
      if (avgWysiwyg !== null) {
        html +=
          "<li>WYSIWYG: " + formatValue(avgWysiwyg, "score", {}) + "</li>";
      }
      html += "</ul></div>";
    }

    return html;
  }

  /**
   * Generates summary HTML for Issues endpoint
   * @param {Object} result - API result
   * @returns {string} HTML string
   */
  function generateIssuesSummary(result) {
    var data = result.data || [];
    var metadata = result.metadata || {};

    var recordCount = data.length;
    var totalRecords = metadata.filteredTotal || metadata.total || recordCount;

    var severeTotals = 0;
    var majorTotals = 0;
    var minorTotals = 0;

    var severeFields = ["scanned1", "security1", "parsable1", "imageSeizure1"];
    var majorFields = [
      "alternativeText2",
      "contrast2",
      "headingsPresence2",
      "tableHeaders2",
      "tagged2",
      "imageDecorative2",
      "imageContrast2",
      "imageDescription2",
      "ocred2",
      "htmlImageAlt2",
      "htmlEmptyHeading2",
      "htmlHeadingsStart2",
      "htmlHeadingsPresence2",
      "htmlLabel2",
      "htmlCaption2",
      "htmlObjectAlt2",
      "htmlColorContrast2",
      "htmlTdHasHeader2",
      "htmlEmptyTableHeader2",
      "htmlBrokenLink2",
    ];
    var minorFields = [
      "title3",
      "languagePresence3",
      "languageCorrect3",
      "headingsSequential3",
      "headingsStartAtOne3",
      "headingsHigherLevel3",
      "imageOcr3",
      "htmlTitle3",
      "htmlHasLang3",
      "htmlHeadingOrder3",
      "htmlLinkName3",
      "htmlList3",
      "htmlDefinitionList3",
      "htmlImageRedundantAlt3",
    ];

    data.forEach(function (row) {
      severeFields.forEach(function (field) {
        if (typeof row[field] === "number") severeTotals += row[field];
      });
      majorFields.forEach(function (field) {
        if (typeof row[field] === "number") majorTotals += row[field];
      });
      minorFields.forEach(function (field) {
        if (typeof row[field] === "number") minorTotals += row[field];
      });
    });

    var html =
      "<p><strong>Showing " +
      recordCount +
      " of " +
      totalRecords +
      "</strong> records</p>";

    html += '<div class="ally-summary-issues">';
    html += "<p>Total issues across displayed records:</p><ul>";
    html +=
      '<li><span class="ally-severity-severe">Severe: ' +
      severeTotals.toLocaleString("en-GB") +
      "</span></li>";
    html +=
      '<li><span class="ally-severity-major">Major: ' +
      majorTotals.toLocaleString("en-GB") +
      "</span></li>";
    html +=
      '<li><span class="ally-severity-minor">Minor: ' +
      minorTotals.toLocaleString("en-GB") +
      "</span></li>";
    html += "</ul></div>";

    return html;
  }

  // ========================================================================
  // Private Methods - Table Generation
  // ========================================================================

  /**
   * Generates table HTML from current data
   * @returns {string} HTML string
   */
  function generateTableHtml() {
    if (
      !currentResult ||
      !currentResult.data ||
      currentResult.data.length === 0
    ) {
      return '<p class="ally-no-results">No records found matching your criteria.</p>';
    }

    var data = currentResult.data;
    var columns = visibleColumns;
    var definitions = COLUMN_DEFINITIONS[currentEndpoint] || {};

    var rowsToShow = Math.min(displayedRows, data.length);

    var html = '<table class="sortable-table ally-results-table">';

    // Table header
    html += "<thead><tr>";
    columns.forEach(function (colKey) {
      var def = definitions[colKey];
      if (def) {
        html += "<th>" + escapeHtml(def.label) + "</th>";
      }
    });
    html += "</tr></thead>";

    // Table body
    html += "<tbody>";
    for (var i = 0; i < rowsToShow; i++) {
      var row = data[i];
      html += "<tr>";
      columns.forEach(function (colKey) {
        var def = definitions[colKey];
        if (def) {
          var value = row[def.key];
          var cellClass = "";

          if (def.formatter === "severityCount" && def.severity) {
            var count = typeof value === "number" ? value : 0;
            if (count > 0) {
              cellClass = ' class="ally-severity-' + def.severity + '"';
            }
          }

          html +=
            "<td" +
            cellClass +
            ">" +
            formatValue(value, def.formatter, row) +
            "</td>";
        }
      });
      html += "</tr>";
    }
    html += "</tbody></table>";

    // Show more button
    if (rowsToShow < data.length) {
      var remaining = data.length - rowsToShow;
      html +=
        '<div class="ally-show-more-container">' +
        '<button type="button" id="ally-show-more-btn" class="ally-secondary-btn" onclick="ALLY_RESULT_RENDERER.showMoreRows()">' +
        "Show more rows (" +
        remaining +
        " remaining)" +
        "</button></div>";
    }

    return html;
  }

  // ========================================================================
  // Private Methods - Column Selector
  // ========================================================================

  /**
   * Generates column selector HTML
   * @returns {string} HTML string
   */
  function generateColumnSelectorHtml() {
    var definitions = COLUMN_DEFINITIONS[currentEndpoint] || {};

    var categories = {};
    Object.keys(definitions).forEach(function (key) {
      var def = definitions[key];
      var category = def.category || "Other";
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({ key: key, label: def.label });
    });

    var html = "";
    Object.keys(categories).forEach(function (category) {
      html += '<div class="ally-column-group">';
      html +=
        '<div class="ally-column-group-title">' +
        escapeHtml(category) +
        "</div>";

      categories[category].forEach(function (col) {
        var isChecked = visibleColumns.indexOf(col.key) > -1;
        html += '<label class="ally-column-option">';
        html +=
          '<input type="checkbox" value="' +
          escapeHtml(col.key) +
          '"' +
          (isChecked ? " checked" : "") +
          " onchange=\"ALLY_RESULT_RENDERER.toggleColumn('" +
          escapeHtml(col.key) +
          "')\">";
        html += " " + escapeHtml(col.label);
        html += "</label>";
      });

      html += "</div>";
    });

    return html;
  }

  // ========================================================================
  // Private Methods - Export
  // ========================================================================

  /**
   * Generates CSV content from data
   * @param {boolean} allData - If true, export all data; otherwise export visible rows
   * @returns {string} CSV content
   */
  function generateCsvContent(allData) {
    if (!currentResult || !currentResult.data) return "";

    var data = allData
      ? currentResult.data
      : currentResult.data.slice(0, displayedRows);
    var definitions = COLUMN_DEFINITIONS[currentEndpoint] || {};

    var headers = visibleColumns.map(function (key) {
      var def = definitions[key];
      return def ? '"' + def.label.replace(/"/g, '""') + '"' : "";
    });

    var rows = [headers.join(",")];

    data.forEach(function (row) {
      var values = visibleColumns.map(function (key) {
        var def = definitions[key];
        if (!def) return "";

        var value = row[def.key];

        switch (def.formatter) {
          case "score":
            if (typeof value !== "number" || isNaN(value)) return "";
            return (value * 100).toFixed(1) + "%";
          case "termLookup":
            if (value) return value;
            if (row.termId && typeof ALLY_LOOKUP !== "undefined") {
              return ALLY_LOOKUP.getTermName(row.termId) || "";
            }
            return "";
          case "departmentLookup":
            if (value) return value;
            if (row.departmentId && typeof ALLY_LOOKUP !== "undefined") {
              return ALLY_LOOKUP.formatDepartments(row.departmentId) || "";
            }
            return "";
          case "boolean":
            return value ? "Yes" : "No";
          default:
            return value != null ? String(value) : "";
        }
      });

      var escapedValues = values.map(function (v) {
        if (
          v.indexOf(",") > -1 ||
          v.indexOf('"') > -1 ||
          v.indexOf("\n") > -1
        ) {
          return '"' + v.replace(/"/g, '""') + '"';
        }
        return v;
      });

      rows.push(escapedValues.join(","));
    });

    return rows.join("\n");
  }

  /**
   * Triggers a file download
   * @param {string} content - File content
   * @param {string} filename - Filename
   * @param {string} mimeType - MIME type
   */
  function downloadFile(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logInfo("Downloaded: " + filename);
  }

  // ========================================================================
  // Private Methods - Rendering
  // ========================================================================

  /**
   * Renders the complete results UI
   */
  function renderResults() {
    var summaryEl = document.getElementById("ally-results-summary");
    var tableContainer = document.getElementById("ally-table-container");
    var columnOptions = document.getElementById("ally-column-options");

    if (!summaryEl || !tableContainer) {
      logError("Results elements not found");
      return;
    }

    // Render summary
    if (currentEndpoint === "issues") {
      summaryEl.innerHTML = generateIssuesSummary(currentResult);
    } else {
      summaryEl.innerHTML = generateOverallSummary(currentResult);
    }

    // Render column selector
    if (columnOptions) {
      columnOptions.innerHTML = generateColumnSelectorHtml();
    }

    // Render table
    tableContainer.innerHTML = generateTableHtml();

    // Enhance table with AccessibleSortableTable
    var table = tableContainer.querySelector("table.sortable-table");
    if (table && typeof AccessibleSortableTable !== "undefined") {
      try {
        new AccessibleSortableTable(table);
        logDebug("Table enhanced with AccessibleSortableTable");
      } catch (e) {
        logWarn("Failed to enhance table:", e.message);
      }
    }

    logInfo(
      "Rendered " +
        currentEndpoint +
        " results: " +
        (currentResult.data ? currentResult.data.length : 0) +
        " rows",
    );
  }

  // ========================================================================
  // Private Methods - Initialisation
  // ========================================================================

  /**
   * Sets up event listeners for UI elements
   */
  function setupEventListeners() {
    var viewBtns = document.querySelectorAll(".ally-view-btn");
    viewBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var view = btn.getAttribute("data-view");
        if (view && !btn.disabled) {
          publicAPI.setView(view);
        }
      });
    });

    var exportVisibleCsv = document.getElementById("ally-export-visible-csv");
    var exportAllCsv = document.getElementById("ally-export-all-csv");
    var exportJson = document.getElementById("ally-export-json");

    if (exportVisibleCsv) {
      exportVisibleCsv.addEventListener("click", function () {
        publicAPI.exportCSV(false);
      });
    }

    if (exportAllCsv) {
      exportAllCsv.addEventListener("click", function () {
        publicAPI.exportCSV(true);
      });
    }

    if (exportJson) {
      exportJson.addEventListener("click", function () {
        publicAPI.exportJSON(true);
      });
    }

    logDebug("Event listeners set up");
  }

  // ========================================================================
  // Public API
  // ========================================================================

  var publicAPI = {
    /**
     * Initialises the result renderer
     * @returns {boolean} True if initialisation succeeded
     */
    initialise: function () {
      if (initialised) {
        logDebug("Already initialised");
        return true;
      }

      setupEventListeners();
      initialised = true;
      logInfo("Result Renderer initialised");
      return true;
    },

    /**
     * Checks if renderer is initialised
     * @returns {boolean} Initialisation state
     */
    isInitialised: function () {
      return initialised;
    },

    /**
     * Renders API results
     * @param {Object} result - API result object { metadata, data }
     * @param {string} endpoint - Endpoint name ('overall' or 'issues')
     */
    render: function (result, endpoint) {
      if (!result) {
        logWarn("No result to render");
        return;
      }

      currentResult = result;
      currentEndpoint = endpoint || "overall";

      visibleColumns = DEFAULT_COLUMNS[currentEndpoint]
        ? DEFAULT_COLUMNS[currentEndpoint].slice()
        : [];

      displayedRows = 10;

      if (!initialised) {
        this.initialise();
      }

      renderResults();
    },

    /**
     * Shows more rows in the table
     */
    showMoreRows: function () {
      displayedRows += ROWS_INCREMENT;
      renderResults();

      if (typeof ALLY_UI_MANAGER !== "undefined") {
        ALLY_UI_MANAGER.announce("Showing more rows");
      }
    },

    /**
     * Toggles a column's visibility
     * @param {string} columnKey - Column key
     */
    toggleColumn: function (columnKey) {
      var index = visibleColumns.indexOf(columnKey);
      if (index > -1) {
        visibleColumns.splice(index, 1);
        logDebug("Column hidden: " + columnKey);
      } else {
        visibleColumns.push(columnKey);
        logDebug("Column shown: " + columnKey);
      }
      renderResults();
    },

    /**
     * Sets visible columns
     * @param {string[]} columns - Array of column keys
     */
    setVisibleColumns: function (columns) {
      if (Array.isArray(columns)) {
        visibleColumns = columns.slice();
        renderResults();
      }
    },

    /**
     * Gets current visible columns
     * @returns {string[]} Array of column keys
     */
    getVisibleColumns: function () {
      return visibleColumns.slice();
    },

    /**
     * Sets the view mode
     * @param {string} view - 'table' or 'chart'
     */
    setView: function (view) {
      currentView = view;

      var viewBtns = document.querySelectorAll(".ally-view-btn");
      viewBtns.forEach(function (btn) {
        var btnView = btn.getAttribute("data-view");
        btn.setAttribute("aria-checked", btnView === view ? "true" : "false");
      });

      var tableContainer = document.getElementById("ally-table-container");
      var chartContainer = document.getElementById("ally-chart-container");

      if (tableContainer) {
        tableContainer.hidden = view !== "table";
      }
      if (chartContainer) {
        chartContainer.hidden = view !== "chart";

        // Render charts when switching to chart view
        if (view === "chart" && currentResult && currentResult.data) {
          if (typeof ALLY_CHART_RENDERER !== "undefined") {
            ALLY_CHART_RENDERER.render(currentResult, currentEndpoint);
          } else {
            logWarn("ALLY_CHART_RENDERER not available");
            chartContainer.innerHTML =
              '<p class="ally-no-results">Chart renderer not loaded.</p>';
          }
        }
      }

      logDebug("View set to: " + view);

      // Announce view change to screen readers
      if (typeof ALLY_UI_MANAGER !== "undefined" && ALLY_UI_MANAGER.announce) {
        ALLY_UI_MANAGER.announce("Switched to " + view + " view");
      }
    },

    /**
     * Exports data as CSV
     * @param {boolean} allData - If true, export all data; otherwise export visible
     */
    exportCSV: function (allData) {
      if (!currentResult || !currentResult.data) {
        logWarn("No data to export");
        return;
      }

      var csv = generateCsvContent(allData);
      var timestamp = new Date().toISOString().slice(0, 10);
      var filename = "ally-" + currentEndpoint + "-" + timestamp + ".csv";

      downloadFile(csv, filename, "text/csv;charset=utf-8");

      if (typeof window.notifySuccess === "function") {
        var rowCount = allData
          ? currentResult.data.length
          : Math.min(displayedRows, currentResult.data.length);
        window.notifySuccess("Exported " + rowCount + " records to CSV");
      }
    },

    /**
     * Exports data as JSON
     * @param {boolean} allData - If true, export all data; otherwise export visible
     */
    exportJSON: function (allData) {
      if (!currentResult || !currentResult.data) {
        logWarn("No data to export");
        return;
      }

      var data = allData
        ? currentResult.data
        : currentResult.data.slice(0, displayedRows);

      var json = JSON.stringify(data, null, 2);
      var timestamp = new Date().toISOString().slice(0, 10);
      var filename = "ally-" + currentEndpoint + "-" + timestamp + ".json";

      downloadFile(json, filename, "application/json");

      if (typeof window.notifySuccess === "function") {
        window.notifySuccess("Exported " + data.length + " records to JSON");
      }
    },

    /**
     * Gets column definitions for an endpoint
     * @param {string} endpoint - Endpoint name
     * @returns {Object} Column definitions
     */
    getColumnDefinitions: function (endpoint) {
      return COLUMN_DEFINITIONS[endpoint] || {};
    },

    /**
     * Gets default columns for an endpoint
     * @param {string} endpoint - Endpoint name
     * @returns {string[]} Default column keys
     */
    getDefaultColumns: function (endpoint) {
      return DEFAULT_COLUMNS[endpoint] ? DEFAULT_COLUMNS[endpoint].slice() : [];
    },

    /**
     * Gets current state for debugging
     * @returns {Object} Current state
     */
    getState: function () {
      return {
        currentEndpoint: currentEndpoint,
        currentView: currentView,
        visibleColumns: visibleColumns.slice(),
        displayedRows: displayedRows,
        dataLength: currentResult ? currentResult.data.length : 0,
        initialised: initialised,
      };
    },

    /**
     * Gets current result data for chart rendering
     * @returns {Object|null} Current result object or null
     */
    getCurrentResult: function () {
      return currentResult;
    },

    /**
     * Gets current endpoint type
     * @returns {string} 'overall' or 'issues'
     */
    getCurrentEndpoint: function () {
      return currentEndpoint;
    },
  };

  return publicAPI;
})();

// Tests moved to ally-tests.js
