/**
 * @fileoverview Ally Accessibility Reporting Tool - Data Runtime
 * @module AllyDataRuntime
 * @requires None - must load BEFORE any ally-*-data.js payload
 * @version 1.0.0
 *
 * @description
 * The behaviour half of the three generated Ally data modules. Each generated
 * file used to be ~100 lines of behaviour wrapped around megabytes of data,
 * emitted as one file declaring a `const`. That behaviour lives here, is
 * shipped once, and is never regenerated; the generated files are now pure
 * payloads that call the installers below.
 *
 * WHY THIS FILE DEFINES NO DATA GLOBAL ON LOAD. Three lazy-load guards read
 * `typeof ALLY_COURSES === "undefined"` (tools.html, and twice in
 * ally-trends.js) and three render guards do the same. If an always-shipped
 * runtime defined those names at load time, every one of those guards would
 * read "already loaded", the payload would never be fetched, and course search
 * would silently return nothing on a page that looked perfectly healthy.
 *
 * So the names are assigned at INSTALL time, not at load time, and all six
 * guards keep working with no edit. That is the whole design constraint.
 *
 * Splitting behaviour from data is what lets a payload arrive from somewhere
 * other than a <script> tag - an upload, IndexedDB, a remote URL - which is
 * the multi-tenancy work from Stage 4 onwards. This file builds only the seam.
 */

const ALLY_DATA_RUNTIME = (function () {
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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[AllyDataRuntime] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyDataRuntime] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyDataRuntime] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyDataRuntime] " + message, ...args);
  }

  /**
   * The three modules this runtime replaces logged their own load lines at
   * three DIFFERENT effective levels, and that asymmetry is preserved here
   * deliberately so this stage changes nothing observable: ALLY_COURSES and
   * ALLY_TRENDS called a bare console.log, so their lines printed, while
   * ALLY_LOOKUP called a level-gated logInfo against a WARN default, so its
   * line never printed at all. Harmonising the three is a real decision and
   * belongs in its own change, not smuggled into a mechanical split.
   */
  function logAs(prefix, message) {
    console.log("[" + prefix + "] " + message);
  }

  function warnAs(prefix, message) {
    console.warn("[" + prefix + "] " + message);
  }

  /**
   * The lookup module's warnings were level-gated before the split and the
   * trends module's were a bare console.warn. Both print at the WARN default,
   * so the difference only shows under DISABLE_ALL_LOGGING - which is exactly
   * the sort of divergence that is invisible until someone relies on it.
   * Preserved rather than harmonised, for the reason given on logAs.
   */
  function warnAsGated(prefix, message) {
    if (shouldLog(LOG_LEVELS.WARN)) warnAs(prefix, message);
  }

  // ========================================================================
  // Shadow detection
  // ========================================================================

  /**
   * Reads the BARE global name, exactly as every consumer of this data does.
   *
   * A LITERAL identifier, deliberately - not `new Function(name)`. Identifier
   * resolution happens when this function is CALLED, so a literal name still
   * sees whatever the scope chain holds at install time, and it keeps working
   * under a Content-Security-Policy that forbids the Function constructor.
   * tools.html carries no CSP today, but the Function constructor is exactly
   * what a future one breaks - and it would fail OPEN, so the detection below
   * would vanish silently rather than complain. The cost of a literal is that
   * it cannot be dynamic, which is why there are three readers and three
   * installers rather than one generic install(name, payload).
   *
   * The `typeof` guard is what keeps this safe when the name is genuinely
   * absent; a bare read of an undeclared name throws ReferenceError.
   */
  function readCourses() {
    return typeof ALLY_COURSES === "undefined" ? undefined : ALLY_COURSES;
  }

  function readLookup() {
    return typeof ALLY_LOOKUP === "undefined" ? undefined : ALLY_LOOKUP;
  }

  function readTrends() {
    return typeof ALLY_TRENDS === "undefined" ? undefined : ALLY_TRENDS;
  }

  /**
   * Confirms that the bare global name really resolves to what we installed.
   *
   * THE FAILURE THIS CATCHES. A `const ALLY_COURSES = ...` declaration and a
   * `window.ALLY_COURSES = ...` assignment do not collide: both scripts run to
   * completion, no error is raised, and the two values coexist under one name.
   * The const wins every BARE read - which is what all six guards and all six
   * consumer files use - while the assignment sits on window, unreachable.
   * Measured in both orders; the order makes no difference.
   *
   * So a stale cached copy of the OLD generated file, loading alongside this
   * runtime, silently WINS and serves stale course data. Before this split the
   * same situation raised a loud "Identifier has already been declared"; the
   * split turns that loud failure into a silent one, and this check is what
   * puts the noise back.
   *
   * BLIND SPOT, stated rather than left to be found: this runs ONCE, at
   * install, so it detects a stale const that is already on the page at that
   * moment. A stale file loading AFTER a successful install shadows the
   * payload undetected, because nothing re-checks. That is hard to reach under
   * the current lazy loader - the tools.html guard reads the bare name and
   * will not fetch a second time - but it is not impossible, and it is the one
   * arrangement this check cannot see.
   *
   * @param {string} name - The global name, for the message
   * @param {*} resolvedByBareName - Result of the matching read* function
   * @param {Object} installed - What we just assigned to window
   * @returns {boolean} Whether the bare name resolves to the installed object
   */
  function confirmInstall(name, resolvedByBareName, installed) {
    if (resolvedByBareName === installed) return true;

    logError(
      name +
        " was installed on window, but the bare name resolves to a DIFFERENT " +
        "object. A stale copy of the old generated file - one that declared " +
        '"const ' +
        name +
        '" - is on this page and shadows the payload. Every ' +
        "consumer reads the bare name, so they will all see the STALE data. " +
        "Remove the old file, or hard-reload to clear the cached copy.",
    );
    return false;
  }

  /**
   * Publishes a name on window and confirms nothing shadows it.
   * @param {string} name - Global name
   * @param {Object} api - The public API object to install
   * @param {Function} read - The matching literal-identifier reader
   * @returns {boolean} Whether the install is visible under the bare name
   */
  function publish(name, api, read) {
    if (typeof window === "undefined") {
      logError(
        name + " cannot be installed: there is no window on this platform.",
      );
      return false;
    }

    // A replacement is legitimate from Stage 4 onwards, when switching tenant
    // is the whole point, so this is INFO rather than WARN. It is unreachable
    // today: the lazy-load guards will not fetch a payload twice.
    if (read() !== undefined) logInfo(name + " was already installed; replacing.");

    window[name] = api;
    return confirmInstall(name, read(), api);
  }

  // ========================================================================
  // Courses
  // ========================================================================

  /**
   * Rebuilds the courses API from a compact payload.
   *
   * STORAGE SHAPE: courses arrive as compact arrays and the object map is
   * rebuilt here. Storing them as objects repeated the field names once per
   * course, which cost 6.57 MB on a real export, and the code-to-id index is a
   * pure inversion of data already present, so it is DERIVED rather than
   * shipped. Shipped pre-built against a filtered course set,
   * searchCoursesByCode would dereference undefined on the first archived
   * code collision.
   *
   * @param {Object} payload - { termIds, rows, excludesArchived, archivedExcluded }
   * @returns {Object} The ALLY_COURSES public API
   */
  function buildCourses(payload) {
    const termIds = payload.termIds || [];
    let rows = payload.rows || [];

    // Read before the payload reference is dropped below.
    const excludesArchived = !!payload.excludesArchived;
    const archivedExcluded = payload.archivedExcluded || 0;

    /** @type {Object.<string, {courseCode: string, courseName: string, termId: string, score: number|null}>} */
    const courses = {};

    /** @type {Object.<string, string>} */
    const courseCodeIndex = {};

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      courses[row[0]] = {
        courseCode: row[1],
        courseName: row[2],
        termId: termIds[row[3]],
        // Integer per mille, or NULL when the course has no scanned files.
        // Null is not zero: about a third of courses are unscored, and showing
        // them as 0% would brand them the worst content in the institution.
        score:
          row.length > 4 && row[4] !== null && row[4] !== undefined
            ? row[4] / 1000
            : null,
      };
      // Last one wins, matching the generator: course codes are not unique.
      courseCodeIndex[row[1]] = row[0];
    }

    // Release the source rows. Without this the compact arrays stay reachable
    // alongside the rebuilt maps and the memory saving is given straight back.
    // The payload object itself is a temporary inside the generated file's
    // IIFE, so dropping these two references is what makes it collectable -
    // which means nothing in this runtime may retain `payload`.
    rows = null;
    payload = null;

    /**
     * Gets course data by ID
     * @param {string} courseId - Course ID
     * @returns {Object|null} Course data or null if not found
     */
    function getCourseById(courseId) {
      return courses[courseId] || null;
    }

    /**
     * Gets course ID by course code
     * @param {string} courseCode - Course code
     * @returns {string|null} Course ID or null if not found
     */
    function getCourseIdByCode(courseCode) {
      return courseCodeIndex[courseCode] || null;
    }

    /**
     * Searches courses by partial code (for autocomplete)
     * @param {string} partialCode - Partial course code to match
     * @param {number} [limit=10] - Maximum number of results
     * @returns {Array<Object>} Matching courses with full data
     */
    function searchCoursesByCode(partialCode, limit) {
      limit = limit || 10;
      var upper = partialCode.toUpperCase();
      var results = [];

      for (var code in courseCodeIndex) {
        if (code.toUpperCase().indexOf(upper) !== -1) {
          var courseId = courseCodeIndex[code];
          var course = courses[courseId];
          results.push({
            courseId: courseId,
            courseCode: code,
            courseName: course.courseName,
            termId: course.termId,
            score: course.score,
          });
          if (results.length >= limit) break;
        }
      }

      return results;
    }

    // NOTE: getCoursesByTerm and getCoursesByDepartment were removed. Both were
    // dead - no call site anywhere in the application - and both existed only to
    // read departmentId, which nothing consumes either, so the field is no longer
    // carried in the payload.

    return {
      // Raw data
      courses: courses,
      courseCodeIndex: courseCodeIndex,

      // Build provenance. The search UI reads excludesArchived so its empty
      // result can say WHY nothing matched, and so that message cannot lie:
      // build with archived courses kept and it reverts by itself.
      excludesArchived: excludesArchived,
      archivedExcluded: archivedExcluded,

      // Lookup methods
      getCourseById: getCourseById,
      getCourseIdByCode: getCourseIdByCode,
      searchCoursesByCode: searchCoursesByCode,
    };
  }

  /**
   * Installs a courses payload as the global ALLY_COURSES.
   * @param {Object} payload - { termIds, rows, excludesArchived, archivedExcluded }
   * @returns {boolean} Whether the install is visible under the bare name
   */
  function installCourses(payload) {
    if (!payload || typeof payload !== "object") {
      logError("installCourses called with no payload.");
      return false;
    }

    const api = buildCourses(payload);

    logAs(
      "AllyCourses",
      "Loaded " + Object.keys(api.courses).length.toLocaleString() + " courses",
    );

    const ok = publish("ALLY_COURSES", api, readCourses);
    if (typeof window !== "undefined") window.testAllyCourses = testAllyCourses;
    return ok;
  }

  // ========================================================================
  // Lookup
  // ========================================================================

  /**
   * Rebuilds the lookup API from a payload.
   * @param {Object} payload - { terms, departments }
   * @returns {Object} The ALLY_LOOKUP public API
   */
  function buildLookup(payload) {
    /** @type {Object.<string, {name: string, type: string, sortOrder: number}>} */
    const terms = payload.terms || {};

    /** @type {Object.<string, {name: string, shortCode: string|null, isSystemTag: boolean}>} */
    const departments = payload.departments || {};

    // ----------------------------------------------------------------------
    // Term Methods
    // ----------------------------------------------------------------------

    /**
     * Gets term name by ID
     * @param {string} termId - Term ID
     * @returns {string} Term name or the ID if not found
     */
    function getTermName(termId) {
      const term = terms[termId];
      return term ? term.name : termId;
    }

    /**
     * Gets term data by ID
     * @param {string} termId - Term ID
     * @returns {Object|null} Term data or null if not found
     */
    function getTerm(termId) {
      return terms[termId] || null;
    }

    /**
     * Gets academic terms sorted by most recent first
     * @returns {Array<{id: string, name: string, type: string, sortOrder: number}>}
     */
    function getAcademicTermsSorted() {
      return Object.entries(terms)
        .filter(function (entry) {
          return entry[1].type === "academic";
        })
        .map(function (entry) {
          return {
            id: entry[0],
            name: entry[1].name,
            type: entry[1].type,
            sortOrder: entry[1].sortOrder,
          };
        })
        .sort(function (a, b) {
          return b.sortOrder - a.sortOrder;
        });
    }

    /**
     * Gets all terms sorted (academic first, then system)
     * @returns {Array<{id: string, name: string, type: string, sortOrder: number}>}
     */
    function getAllTermsSorted() {
      return Object.entries(terms)
        .map(function (entry) {
          return {
            id: entry[0],
            name: entry[1].name,
            type: entry[1].type,
            sortOrder: entry[1].sortOrder,
          };
        })
        .sort(function (a, b) {
          // Academic terms first, sorted by year descending
          if (a.type === "academic" && b.type !== "academic") return -1;
          if (a.type !== "academic" && b.type === "academic") return 1;
          return b.sortOrder - a.sortOrder;
        });
    }

    // ----------------------------------------------------------------------
    // Department Methods
    // ----------------------------------------------------------------------

    /**
     * Gets department name by ID
     * @param {string} deptId - Department ID
     * @returns {string} Department name or the ID if not found
     */
    function getDepartmentName(deptId) {
      const dept = departments[deptId];
      return dept ? dept.name : deptId;
    }

    /**
     * Gets department data by ID
     * @param {string} deptId - Department ID
     * @returns {Object|null} Department data or null if not found
     */
    function getDepartment(deptId) {
      return departments[deptId] || null;
    }

    /**
     * Formats a semicolon-separated department ID string to names
     * @param {string} deptIdString - e.g., "_267_1; _120_1"
     * @returns {string} e.g., "Ultra; School of Psychology (JW)"
     */
    function formatDepartments(deptIdString) {
      if (!deptIdString) return "";
      return deptIdString
        .split(";")
        .map(function (id) {
          return getDepartmentName(id.trim());
        })
        .join("; ");
    }

    /**
     * Checks if a course's department string contains a specific department
     * @param {string} courseDeptIdString - Course's department IDs (semicolon-separated)
     * @param {string} targetDeptId - Department to search for
     * @returns {boolean} Whether the department is present
     */
    function courseContainsDepartment(courseDeptIdString, targetDeptId) {
      if (!courseDeptIdString || !targetDeptId) return false;
      var deptIds = courseDeptIdString.split(";").map(function (id) {
        return id.trim();
      });
      return deptIds.indexOf(targetDeptId) !== -1;
    }

    /**
     * Gets non-system departments sorted alphabetically
     * @returns {Array<{id: string, name: string, shortCode: string|null}>}
     */
    function getDepartmentsSorted() {
      return Object.entries(departments)
        .filter(function (entry) {
          return !entry[1].isSystemTag;
        })
        .map(function (entry) {
          return {
            id: entry[0],
            name: entry[1].name,
            shortCode: entry[1].shortCode,
          };
        })
        .sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });
    }

    /**
     * Gets all departments including system tags
     * @returns {Array<{id: string, name: string, shortCode: string|null, isSystemTag: boolean}>}
     */
    function getAllDepartments() {
      return Object.entries(departments)
        .map(function (entry) {
          return {
            id: entry[0],
            name: entry[1].name,
            shortCode: entry[1].shortCode,
            isSystemTag: entry[1].isSystemTag,
          };
        })
        .sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });
    }

    // ----------------------------------------------------------------------
    // Course Methods (delegate to ALLY_COURSES if loaded)
    // ----------------------------------------------------------------------

    /**
     * Gets course by ID (delegates to ALLY_COURSES)
     * @param {string} courseId - Course ID
     * @returns {Object|null} Course data or null
     */
    function getCourseById(courseId) {
      if (typeof ALLY_COURSES !== "undefined") {
        return ALLY_COURSES.getCourseById(courseId);
      }
      warnAsGated("AllyLookup", "ALLY_COURSES not loaded - course lookup unavailable");
      return null;
    }

    /**
     * Gets course ID by code (delegates to ALLY_COURSES)
     * @param {string} courseCode - Course code
     * @returns {string|null} Course ID or null
     */
    function getCourseIdByCode(courseCode) {
      if (typeof ALLY_COURSES !== "undefined") {
        return ALLY_COURSES.getCourseIdByCode(courseCode);
      }
      warnAsGated("AllyLookup", "ALLY_COURSES not loaded - course lookup unavailable");
      return null;
    }

    /**
     * Gets course by code (convenience method)
     * @param {string} courseCode - Course code
     * @returns {Object|null} Course data or null
     */
    function getCourseByCode(courseCode) {
      var courseId = getCourseIdByCode(courseCode);
      return courseId ? getCourseById(courseId) : null;
    }

    /**
     * Searches courses by partial code (for autocomplete)
     * @param {string} partialCode - Partial course code
     * @param {number} [limit=10] - Maximum results
     * @returns {Array} Matching courses
     */
    function searchCoursesByCode(partialCode, limit) {
      if (typeof ALLY_COURSES !== "undefined") {
        return ALLY_COURSES.searchCoursesByCode(partialCode, limit);
      }
      warnAsGated("AllyLookup", "ALLY_COURSES not loaded - course search unavailable");
      return [];
    }

    /**
     * Formats course name for display
     * @param {string} courseId - Course ID
     * @returns {string} "CODE: Name" or courseId if not found
     */
    function formatCourseName(courseId) {
      var course = getCourseById(courseId);
      if (course) {
        return course.courseCode + ": " + course.courseName;
      }
      return courseId;
    }

    /**
     * Checks if course data is loaded
     * @returns {boolean} Whether ALLY_COURSES is available
     */
    function isCoursesDataLoaded() {
      return typeof ALLY_COURSES !== "undefined";
    }

    /**
     * Gets statistics about loaded data
     * @returns {Object} Statistics object
     */
    function getStatistics() {
      return {
        termCount: Object.keys(terms).length,
        departmentCount: Object.keys(departments).length,
        academicTermCount: getAcademicTermsSorted().length,
        nonSystemDepartmentCount: getDepartmentsSorted().length,
        coursesLoaded: isCoursesDataLoaded(),
        courseCount: isCoursesDataLoaded()
          ? Object.keys(ALLY_COURSES.courses).length
          : 0,
      };
    }

    return {
      // Raw data
      terms: terms,
      departments: departments,

      // Term methods
      getTermName: getTermName,
      getTerm: getTerm,
      getAcademicTermsSorted: getAcademicTermsSorted,
      getAllTermsSorted: getAllTermsSorted,

      // Department methods
      getDepartmentName: getDepartmentName,
      getDepartment: getDepartment,
      formatDepartments: formatDepartments,
      courseContainsDepartment: courseContainsDepartment,
      getDepartmentsSorted: getDepartmentsSorted,
      getAllDepartments: getAllDepartments,

      // Course methods (delegate to ALLY_COURSES)
      getCourseById: getCourseById,
      getCourseIdByCode: getCourseIdByCode,
      getCourseByCode: getCourseByCode,
      searchCoursesByCode: searchCoursesByCode,
      formatCourseName: formatCourseName,
      isCoursesDataLoaded: isCoursesDataLoaded,

      // Utilities
      getStatistics: getStatistics,
    };
  }

  /**
   * Installs a lookup payload as the global ALLY_LOOKUP.
   * @param {Object} payload - { terms, departments }
   * @returns {boolean} Whether the install is visible under the bare name
   */
  function installLookup(payload) {
    if (!payload || typeof payload !== "object") {
      logError("installLookup called with no payload.");
      return false;
    }

    const api = buildLookup(payload);

    // Level-gated on purpose - see logAs above. This line did NOT print before
    // the split and does not print now.
    if (shouldLog(LOG_LEVELS.INFO)) {
      logAs(
        "AllyLookup",
        "ALLY_LOOKUP initialised with " +
          Object.keys(api.terms).length +
          " terms and " +
          Object.keys(api.departments).length +
          " departments",
      );
    }

    const ok = publish("ALLY_LOOKUP", api, readLookup);
    if (typeof window !== "undefined") window.testAllyLookup = testAllyLookup;
    return ok;
  }

  // ========================================================================
  // Trends
  // ========================================================================

  /** Default minimum files for a period to be worth charting. */
  const DEFAULT_MIN_FILES = 100;

  /**
   * Matches a metric that is an accessibility ISSUE.
   *
   * Ally suffixes every rule with its severity - "Contrast:2", "Scanned:1" -
   * and that suffix is the discriminator. Metrics without one are volume
   * counts (Total files, pdf, image) or markers, and LibraryReference is the
   * marker that matters: at ~74% of files it would dominate any top-issues
   * chart while describing no fault at all.
   *
   * An earlier version carried a NON_DEFECT_METRICS exclusion list as well.
   * It was removed after an inversion showed it could not change any result -
   * this pattern already excluded LibraryReference, so the list was dead code
   * dressed as a safeguard.
   *
   * @type {RegExp}
   */
  const ISSUE_METRIC_PATTERN = /:[123]$/;

  /**
   * Rebuilds the trends API from a payload.
   * @param {Object} payload - { generatedOn, minFiles, metrics, byYear, byTerm,
   *   byMonth, byDepartmentYear, byDepartmentTerm }
   * @returns {Object} The ALLY_TRENDS public API
   */
  function buildTrends(payload) {
    /** When the source export was taken. The newest point is only this fresh. */
    const generatedOn = payload.generatedOn || "";

    const MIN_FILES =
      typeof payload.minFiles === "number" ? payload.minFiles : DEFAULT_MIN_FILES;

    /** @type {Array<string>} */
    const metrics = payload.metrics || [];

    /** Metric name to column offset within a row's metric section. */
    const metricIndex = {};
    for (var m = 0; m < metrics.length; m++) metricIndex[metrics[m]] = m;

    const byYear = payload.byYear || [];
    const byTerm = payload.byTerm || [];
    const byMonth = payload.byMonth || [];
    const byDepartmentYear = payload.byDepartmentYear || [];
    const byDepartmentTerm = payload.byDepartmentTerm || [];

    /** Dataset name to its rows and the width of its dimension prefix. */
    const DATASETS = {
      year: { rows: byYear, prefix: 1 },
      term: { rows: byTerm, prefix: 1 },
      month: { rows: byMonth, prefix: 1 },
      departmentYear: { rows: byDepartmentYear, prefix: 2 },
      departmentTerm: { rows: byDepartmentTerm, prefix: 2 },
    };

    /**
     * Reads one metric out of a row.
     * @param {Array} row - A data row
     * @param {number} prefix - Width of the row's dimension prefix
     * @param {string} metric - Metric name
     * @returns {number|null} Value, or null when the source cell was empty
     */
    function readMetric(row, prefix, metric) {
      var at = metricIndex[metric];
      if (at === undefined) return null;
      var value = row[prefix + at];
      return value === null || value === undefined ? null : value;
    }

    /**
     * Whether a period carries enough files to be worth charting.
     *
     * A period with no files reports an overall score of ~98% because the score
     * collapses to the WYSIWYG score - the University's 2006-07 to 2009-10 rows
     * all read ~98.6% on ZERO files, which charted naively shows accessibility
     * collapsing after 2010. It did not; the earlier points are empty.
     *
     * @param {Array} row - A data row
     * @param {number} prefix - Width of the row's dimension prefix
     * @returns {boolean} Whether the row is safe to chart
     */
    function isUsable(row, prefix) {
      var files = readMetric(row, prefix, "Total files");
      return typeof files === "number" && files >= MIN_FILES;
    }

    /**
     * Whether this is the trailing, still-accumulating period.
     *
     * Only ever true for the LAST row of a dataset. The newest month always
     * looks like a cliff because it is a few days old, not because anything
     * changed.
     *
     * @param {string} dataset - Dataset name
     * @param {number} index - Row index within that dataset
     * @returns {boolean} Whether the row is incomplete
     */
    function isPartial(dataset, index) {
      var entry = DATASETS[dataset];
      return !!entry && index === entry.rows.length - 1;
    }

    /**
     * Builds a plottable series.
     *
     * Unusable periods are dropped by default - pass includeUnusable to keep
     * them, and label them, if you are deliberately showing coverage rather
     * than quality.
     *
     * @param {string} dataset - year | term | month | departmentYear | departmentTerm
     * @param {string} metric - Metric name, e.g. "Files score"
     * @param {Object} [options] - { departmentId, includeUnusable, includePartial }
     * @returns {Array<{x: string, y: number, partial: boolean, usable: boolean}>}
     */
    function series(dataset, metric, options) {
      options = options || {};
      var entry = DATASETS[dataset];
      if (!entry) {
        warnAs("AllyTrends", "unknown dataset: " + dataset);
        return [];
      }
      if (metricIndex[metric] === undefined) {
        warnAs("AllyTrends", "unknown metric: " + metric);
        return [];
      }

      var points = [];

      for (var i = 0; i < entry.rows.length; i++) {
        var row = entry.rows[i];

        if (
          entry.prefix === 2 &&
          options.departmentId &&
          row[1] !== options.departmentId
        ) {
          continue;
        }

        var usable = isUsable(row, entry.prefix);
        if (!usable && !options.includeUnusable) continue;

        var partial = isPartial(dataset, i);
        if (partial && options.includePartial === false) continue;

        var value = readMetric(row, entry.prefix, metric);
        if (value === null) continue;

        points.push({ x: row[0], y: value, partial: partial, usable: usable });
      }

      return points;
    }

    /**
     * Lists the departments present in a department-level dataset.
     * @param {string} dataset - departmentYear | departmentTerm
     * @returns {Array<string>} Department IDs, first-seen order
     */
    function departments(dataset) {
      var entry = DATASETS[dataset];
      if (!entry || entry.prefix !== 2) return [];

      var seen = {};
      var ids = [];
      for (var i = 0; i < entry.rows.length; i++) {
        var id = entry.rows[i][1];
        if (seen[id]) continue;
        seen[id] = true;
        ids.push(id);
      }
      return ids;
    }

    /**
     * The most recent usable row of a dataset, as a metric-keyed object.
     * @param {string} dataset - Dataset name
     * @param {Object} [options] - { departmentId }
     * @returns {Object|null} { period, values } or null
     */
    function latest(dataset, options) {
      options = options || {};
      var entry = DATASETS[dataset];
      if (!entry) return null;

      for (var i = entry.rows.length - 1; i >= 0; i--) {
        var row = entry.rows[i];
        if (
          entry.prefix === 2 &&
          options.departmentId &&
          row[1] !== options.departmentId
        )
          continue;
        if (!isUsable(row, entry.prefix)) continue;

        var values = {};
        for (var k = 0; k < metrics.length; k++)
          values[metrics[k]] = row[entry.prefix + k];
        return { period: row[0], values: values };
      }

      return null;
    }

    /**
     * Ranks issue metrics for one period, biggest first, excluding non-defects.
     * @param {string} dataset - Dataset name
     * @param {Object} [options] - { departmentId, limit }
     * @returns {Array<{metric: string, count: number, share: number}>}
     */
    function topIssues(dataset, options) {
      options = options || {};
      var row = latest(dataset, options);
      if (!row) return [];

      var totalFiles = row.values["Total files"];
      var results = [];

      for (var i = 0; i < metrics.length; i++) {
        var name = metrics[i];
        if (!ISSUE_METRIC_PATTERN.test(name)) continue;

        var count = row.values[name];
        if (!count) continue;

        results.push({
          metric: name,
          count: count,
          share: totalFiles ? count / totalFiles : 0,
        });
      }

      results.sort(function (a, b) {
        return b.count - a.count;
      });
      return options.limit ? results.slice(0, options.limit) : results;
    }

    return {
      generatedOn: generatedOn,
      MIN_FILES: MIN_FILES,
      metrics: metrics,

      byYear: byYear,
      byTerm: byTerm,
      byMonth: byMonth,
      byDepartmentYear: byDepartmentYear,
      byDepartmentTerm: byDepartmentTerm,

      readMetric: readMetric,
      isUsable: isUsable,
      isPartial: isPartial,
      series: series,
      departments: departments,
      latest: latest,
      topIssues: topIssues,
    };
  }

  /**
   * Installs a trends payload as the global ALLY_TRENDS.
   * @param {Object} payload - See buildTrends
   * @returns {boolean} Whether the install is visible under the bare name
   */
  function installTrends(payload) {
    if (!payload || typeof payload !== "object") {
      logError("installTrends called with no payload.");
      return false;
    }

    const api = buildTrends(payload);

    logAs(
      "AllyTrends",
      "Loaded trends: " +
        api.byMonth.length +
        " months, " +
        api.byYear.length +
        " years, " +
        api.byTerm.length +
        " terms, from an export taken " +
        api.generatedOn.slice(0, 10),
    );

    const ok = publish("ALLY_TRENDS", api, readTrends);
    if (typeof window !== "undefined") window.testAllyTrends = testAllyTrends;
    return ok;
  }

  // ========================================================================
  // Console Testing Functions
  // ========================================================================

  /**
   * Each self-test reads the BARE global name, not the object the installer
   * returned. That is deliberate: the bare name is what every consumer reads,
   * so a self-test on it also fails when a stale const shadows the payload.
   *
   * They are published on window at INSTALL time rather than at runtime load,
   * which preserves the previous behaviour exactly - before the split each
   * test came into existence with its data file, so calling testAllyCourses()
   * before the Ally mode switch found nothing, and it still finds nothing.
   */

  function makeRecorder(groupName) {
    console.group(groupName);
    const state = { passed: 0, failed: 0 };
    state.test = function (name, condition) {
      if (condition) {
        console.log("✓ " + name);
        state.passed++;
      } else {
        console.error("✗ " + name);
        state.failed++;
      }
    };
    state.finish = function () {
      console.log("\n" + state.passed + " passed, " + state.failed + " failed");
      console.groupEnd();
      return state.failed === 0;
    };
    return state;
  }

  /**
   * Tests ALLY_COURSES functionality
   * @returns {boolean} True if all tests pass
   */
  function testAllyCourses() {
    const r = makeRecorder("ALLY_COURSES Tests");
    const test = r.test;

    // Test 1: Module exists
    test("ALLY_COURSES exists", typeof ALLY_COURSES === "object");

    // Test 2: Courses data exists
    test("courses data exists", typeof ALLY_COURSES.courses === "object");

    // Test 3: Course code index exists
    test(
      "courseCodeIndex exists",
      typeof ALLY_COURSES.courseCodeIndex === "object",
    );

    // Test 4: getCourseById works
    var courseIds = Object.keys(ALLY_COURSES.courses);
    if (courseIds.length > 0) {
      var course = ALLY_COURSES.getCourseById(courseIds[0]);
      test(
        "getCourseById returns course",
        course !== null && typeof course.courseCode === "string",
      );
      // Rehydration check: the three fields consumers read must all survive the
      // compact storage shape. A missing one would not surface until a search.
      test(
        "rehydrated course carries code, name and term",
        typeof course.courseCode === "string" &&
          course.courseCode.length > 0 &&
          typeof course.courseName === "string" &&
          typeof course.termId === "string",
      );
    } else {
      test("getCourseById (skipped - no courses)", true);
      test("rehydrated fields (skipped - no courses)", true);
    }

    // Test 5: getCourseIdByCode works
    var courseCodes = Object.keys(ALLY_COURSES.courseCodeIndex);
    if (courseCodes.length > 0) {
      var courseId = ALLY_COURSES.getCourseIdByCode(courseCodes[0]);
      test("getCourseIdByCode returns ID", typeof courseId === "string");
    } else {
      test("getCourseIdByCode (skipped - no courses)", true);
    }

    // Test 6: searchCoursesByCode returns array
    var searchResults = ALLY_COURSES.searchCoursesByCode("TEST", 5);
    test("searchCoursesByCode returns array", Array.isArray(searchResults));

    // Test 7: The reverse index is populated and never larger than the course set.
    // It is legitimately SMALLER when two courses share a course code - the real
    // Ally export has thousands of such collisions, and the last one wins.
    // Skips on an empty set, matching tests 4 and 5: a build with every course
    // filtered out is a build decision, not a defect in this module.
    var courseCount = Object.keys(ALLY_COURSES.courses).length;
    var indexCount = Object.keys(ALLY_COURSES.courseCodeIndex).length;
    if (courseCount > 0) {
      test(
        "Course code index is populated (" +
          indexCount +
          " codes for " +
          courseCount +
          " courses)",
        indexCount > 0 && indexCount <= courseCount,
      );
    } else {
      test("Course code index (skipped - no courses)", true);
    }

    return r.finish();
  }

  /**
   * Tests ALLY_LOOKUP functionality
   * @returns {boolean} True if all tests pass
   */
  function testAllyLookup() {
    const r = makeRecorder("ALLY_LOOKUP Tests");
    const test = r.test;

    // Test 1: Module exists
    test("ALLY_LOOKUP exists", typeof ALLY_LOOKUP === "object");

    // Test 2: Terms data exists
    test("terms data exists", typeof ALLY_LOOKUP.terms === "object");

    // Test 3: Departments data exists
    test("departments data exists", typeof ALLY_LOOKUP.departments === "object");

    // Test 4: getTermName returns string
    var termKeys = Object.keys(ALLY_LOOKUP.terms);
    if (termKeys.length > 0) {
      var termName = ALLY_LOOKUP.getTermName(termKeys[0]);
      test(
        "getTermName returns string",
        typeof termName === "string" && termName.length > 0,
      );
    } else {
      test("getTermName (skipped - no terms)", true);
    }

    // Test 5: getDepartmentName returns string
    var deptKeys = Object.keys(ALLY_LOOKUP.departments);
    if (deptKeys.length > 0) {
      var deptName = ALLY_LOOKUP.getDepartmentName(deptKeys[0]);
      test(
        "getDepartmentName returns string",
        typeof deptName === "string" && deptName.length > 0,
      );
    } else {
      test("getDepartmentName (skipped - no depts)", true);
    }

    // Test 6: getAcademicTermsSorted returns array
    var academicTerms = ALLY_LOOKUP.getAcademicTermsSorted();
    test("getAcademicTermsSorted returns array", Array.isArray(academicTerms));

    // Test 7: getDepartmentsSorted returns array
    var sortedDepts = ALLY_LOOKUP.getDepartmentsSorted();
    test("getDepartmentsSorted returns array", Array.isArray(sortedDepts));

    // Test 8: courseContainsDepartment works
    test(
      "courseContainsDepartment with match",
      ALLY_LOOKUP.courseContainsDepartment("_267_1; _120_1", "_120_1") === true,
    );
    test(
      "courseContainsDepartment without match",
      ALLY_LOOKUP.courseContainsDepartment("_267_1; _120_1", "_999_1") === false,
    );

    // Test 9: formatDepartments works
    test(
      "formatDepartments returns string",
      typeof ALLY_LOOKUP.formatDepartments("_267_1") === "string",
    );

    // Test 10: isCoursesDataLoaded returns boolean
    test(
      "isCoursesDataLoaded returns boolean",
      typeof ALLY_LOOKUP.isCoursesDataLoaded() === "boolean",
    );

    // Test 11: getStatistics returns object
    var stats = ALLY_LOOKUP.getStatistics();
    test(
      "getStatistics returns object with counts",
      typeof stats === "object" &&
        typeof stats.termCount === "number" &&
        typeof stats.departmentCount === "number",
    );

    return r.finish();
  }

  /**
   * Tests ALLY_TRENDS functionality
   * @returns {boolean} True if all tests pass
   */
  function testAllyTrends() {
    const r = makeRecorder("ALLY_TRENDS Tests");
    const test = r.test;

    test("ALLY_TRENDS exists", typeof ALLY_TRENDS === "object");
    test(
      "metrics list is populated",
      Array.isArray(ALLY_TRENDS.metrics) && ALLY_TRENDS.metrics.length > 0,
    );
    test(
      "monthly data exists",
      Array.isArray(ALLY_TRENDS.byMonth) && ALLY_TRENDS.byMonth.length > 0,
    );

    var files = ALLY_TRENDS.series("year", "Files score");
    test("series returns points", Array.isArray(files) && files.length > 0);
    test(
      "series points carry x and y",
      files.length === 0 ||
        (files[0].x !== undefined && typeof files[0].y === "number"),
    );

    // Chronological order is what a line chart depends on.
    var ordered = true;
    for (var i = 1; i < files.length; i++) {
      if (String(files[i].x) < String(files[i - 1].x)) ordered = false;
    }
    test("series is in chronological order", ordered);

    // The guard must actually remove something, or it is not doing its job.
    var guarded = ALLY_TRENDS.series("year", "Files score");
    var unguarded = ALLY_TRENDS.series("year", "Files score", {
      includeUnusable: true,
    });
    test(
      "the minimum-files guard excludes at least one period",
      unguarded.length >= guarded.length,
    );
    test(
      "every returned point is usable",
      guarded.every(function (p) {
        return p.usable;
      }),
    );

    var issues = ALLY_TRENDS.topIssues("year", { limit: 5 });
    test("topIssues returns ranked results", Array.isArray(issues));
    test(
      "topIssues excludes LibraryReference",
      !issues.some(function (r2) {
        return r2.metric.indexOf("LibraryReference") === 0;
      }),
    );

    var depts = ALLY_TRENDS.departments("departmentYear");
    test("department list is populated", Array.isArray(depts) && depts.length > 0);

    return r.finish();
  }

  logDebug("runtime loaded; no data global defined until a payload installs");

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    installCourses: installCourses,
    installLookup: installLookup,
    installTrends: installTrends,
  };
})();

if (typeof window !== "undefined") {
  window.ALLY_DATA_RUNTIME = ALLY_DATA_RUNTIME;
}
