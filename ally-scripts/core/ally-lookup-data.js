/**
 * @fileoverview Ally Accessibility Reporting Tool - Lookup Data Module
 * @module AllyLookup
 * @requires None - Standalone data module
 * @generated 2026-05-05T10:00:18.262Z
 * @version 1.0.0
 *
 * @description
 * Generated from CSV files - provides human-readable names for Ally internal IDs.
 * Contains 38 terms and 0 departments.
 *
 * Course lookups are delegated to ALLY_COURSES (loaded separately due to size).
 */

const ALLY_LOOKUP = (function () {
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
      console.error("[AllyLookup] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyLookup] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyLookup] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyLookup] " + message, ...args);
  }

  // ========================================================================
  // Data (Generated from CSVs)
  // ========================================================================

  /**
   * Term ID to term data mapping
   * @type {Object.<string, {name: string, type: string, sortOrder: number}>}
   */
  const terms = {
    _387_1: {
      name: "Archived",
      type: "system",
      sortOrder: -1,
    },
    _253_1: {
      name: "External courses",
      type: "system",
      sortOrder: -99,
    },
    _287_1: {
      name: "Guest Access",
      type: "system",
      sortOrder: -99,
    },
    _24_1: {
      name: "2010-11",
      type: "academic",
      sortOrder: 10,
    },
    _23_1: {
      name: "2011-12",
      type: "academic",
      sortOrder: 11,
    },
    _22_1: {
      name: "2012-13",
      type: "academic",
      sortOrder: 12,
    },
    _21_1: {
      name: "2013-14",
      type: "academic",
      sortOrder: 13,
    },
    _81_1: {
      name: "2014-15",
      type: "academic",
      sortOrder: 14,
    },
    _110_1: {
      name: "2015-16",
      type: "academic",
      sortOrder: 15,
    },
    _117_1: {
      name: "2016-17",
      type: "academic",
      sortOrder: 16,
    },
    _127_1: {
      name: "2017-18",
      type: "academic",
      sortOrder: 17,
    },
    _138_1: {
      name: "2018-19",
      type: "academic",
      sortOrder: 18,
    },
    _148_1: {
      name: "2019-20 Modules",
      type: "academic",
      sortOrder: 19,
    },
    _159_1: {
      name: "2020-21 Modules",
      type: "academic",
      sortOrder: 20,
    },
    _160_1: {
      name: "2021-22 Modules",
      type: "academic",
      sortOrder: 21,
    },
    _161_1: {
      name: "2022-23 Modules",
      type: "academic",
      sortOrder: 22,
    },
    _162_1: {
      name: "2023-24 Modules",
      type: "academic",
      sortOrder: 23,
    },
    _313_1: {
      name: "Preparation for 2023-24",
      type: "system",
      sortOrder: -99,
    },
    _174_1: {
      name: "Sandboxes",
      type: "system",
      sortOrder: -2,
    },
    _207_1: {
      name: "Training and Further Resources",
      type: "system",
      sortOrder: -99,
    },
    _42_1: {
      name: "Faculty of Medicine Subjects",
      type: "system",
      sortOrder: -99,
    },
    _344_1: {
      name: "2024-25 Modules",
      type: "academic",
      sortOrder: 24,
    },
    _211_1: {
      name: "Pre sessional",
      type: "system",
      sortOrder: -99,
    },
    _362_1: {
      name: "Preparation for 2024-25",
      type: "system",
      sortOrder: -99,
    },
    _383_1: {
      name: "2025-26 Modules",
      type: "academic",
      sortOrder: 25,
    },
    _231_1: {
      name: "Programme Information",
      type: "system",
      sortOrder: -99,
    },
    _384_1: {
      name: "Preparation for 2025-26",
      type: "system",
      sortOrder: -99,
    },
    _462_1: {
      name: "2025-26 Modules (Delhi)",
      type: "academic",
      sortOrder: 25,
    },
    _463_1: {
      name: "2025-26 Modules (Malaysia)",
      type: "academic",
      sortOrder: 25,
    },
    _465_1: {
      name: "2026-27 Modules",
      type: "academic",
      sortOrder: 26,
    },
    _467_1: {
      name: "2026-27 Modules (Malaysia)",
      type: "academic",
      sortOrder: 26,
    },
    _466_1: {
      name: "2026-27 Modules (Delhi)",
      type: "academic",
      sortOrder: 26,
    },
    _468_1: {
      name: "Mandatory Training",
      type: "system",
      sortOrder: -99,
    },
    _451_1: {
      name: "Preparation for 2026-27",
      type: "system",
      sortOrder: -99,
    },
    _448_1: {
      name: "CPD / LLL Courses",
      type: "system",
      sortOrder: -99,
    },
    _430_1: {
      name: "Demonstration courses",
      type: "system",
      sortOrder: -99,
    },
    _299_1: {
      name: "Templates",
      type: "system",
      sortOrder: -99,
    },
    _241_1: {
      name: "Organisations",
      type: "system",
      sortOrder: -99,
    },
  };

  /**
   * Department ID to department data mapping
   * @type {Object.<string, {name: string, shortCode: string|null, isSystemTag: boolean}>}
   */
  const departments = {};

  // ========================================================================
  // Term Methods
  // ========================================================================

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

  // ========================================================================
  // Department Methods
  // ========================================================================

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

  // ========================================================================
  // Course Methods (delegate to ALLY_COURSES if loaded)
  // ========================================================================

  /**
   * Gets course by ID (delegates to ALLY_COURSES)
   * @param {string} courseId - Course ID
   * @returns {Object|null} Course data or null
   */
  function getCourseById(courseId) {
    if (typeof ALLY_COURSES !== "undefined") {
      return ALLY_COURSES.getCourseById(courseId);
    }
    logWarn("ALLY_COURSES not loaded - course lookup unavailable");
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
    logWarn("ALLY_COURSES not loaded - course lookup unavailable");
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
    logWarn("ALLY_COURSES not loaded - course search unavailable");
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

  logInfo(
    "ALLY_LOOKUP initialised with " +
      Object.keys(terms).length +
      " terms and " +
      Object.keys(departments).length +
      " departments",
  );

  // ========================================================================
  // Public API
  // ========================================================================

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
})();

// ========================================================================
// Console Testing Functions
// ========================================================================

/**
 * Tests ALLY_LOOKUP functionality
 * @returns {boolean} True if all tests pass
 */
function testAllyLookup() {
  console.group("ALLY_LOOKUP Tests");

  var passed = 0;
  var failed = 0;

  function test(name, condition) {
    if (condition) {
      console.log("✓ " + name);
      passed++;
    } else {
      console.error("✗ " + name);
      failed++;
    }
  }

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

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
}

if (typeof window !== "undefined") {
  window.testAllyLookup = testAllyLookup;
}
