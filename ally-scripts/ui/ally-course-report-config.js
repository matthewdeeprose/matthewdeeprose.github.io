/**
 * @fileoverview Ally Course Report - Configuration Module
 * @module AllyCourseReportConfig
 * @requires None - Standalone configuration module
 * @version 1.0.0
 * @since Phase 7A.2
 *
 * @description
 * Configuration module for the Course Report feature. Contains all data mappings
 * for file types, issue categories, issue descriptions, and severity levels.
 * Designed to work with ALLY_CONFIG for score thresholds and colour classes.
 *
 * Key Features:
 * - File type categorisation (External Files vs Blackboard Content)
 * - Issue category groupings for organised display
 * - Human-readable issue descriptions (British spelling)
 * - Severity level definitions with CSS classes
 * - Helper functions for data transformation
 *
 * Integration:
 * - Used by ally-course-report.js for report rendering
 * - References ALLY_CONFIG for score utilities
 * - Available globally via ALLY_COURSE_REPORT_CONFIG
 *
 * @example
 * // Get human-readable description for an issue
 * const desc = ALLY_COURSE_REPORT_CONFIG.getIssueDescription('alternativeText2');
 *
 * // Get severity level from field name
 * const severity = ALLY_COURSE_REPORT_CONFIG.getSeverityFromField('headingsPresence2');
 *
 * // Get category for an issue
 * const category = ALLY_COURSE_REPORT_CONFIG.getCategoryForIssue('contrast2');
 */

const ALLY_COURSE_REPORT_CONFIG = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
  // ========================================================================

  var LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  var DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  var ENABLE_ALL_LOGGING = false;
  var DISABLE_ALL_LOGGING = false;

  /**
   * Determines if a message should be logged based on current configuration
   * @param {number} level - The log level to check
   * @returns {boolean} True if the message should be logged
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  /**
   * Logs error messages if error logging is enabled
   * @param {string} message - The error message to log
   * @param {...any} args - Additional arguments to pass to console.error
   */
  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.error.apply(
        console,
        ["[AllyCourseReportConfig] " + message].concat(args),
      );
    }
  }

  /**
   * Logs warning messages if warning logging is enabled
   * @param {string} message - The warning message to log
   * @param {...any} args - Additional arguments to pass to console.warn
   */
  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.warn.apply(
        console,
        ["[AllyCourseReportConfig] " + message].concat(args),
      );
    }
  }

  /**
   * Logs informational messages if info logging is enabled
   * @param {string} message - The info message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.log.apply(
        console,
        ["[AllyCourseReportConfig] " + message].concat(args),
      );
    }
  }

  /**
   * Logs debug messages if debug logging is enabled
   * @param {string} message - The debug message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.log.apply(
        console,
        ["[AllyCourseReportConfig] " + message].concat(args),
      );
    }
  }

  // ========================================================================
  // File Type Mapping
  // ========================================================================

  /**
   * File type categorisation for content inventory display
   * Organises API fields into logical groups
   * @type {Object}
   */
  var FILE_TYPE_MAPPING = {
    external: {
      label: "External Files",
      description: "Files uploaded to the course",
      types: {
        pdf: { label: "PDF Documents", apiField: "pdf", icon: "pdf" },
        document: {
          label: "Word Documents",
          apiField: "document",
          icon: "document",
        },
        image: { label: "Images", apiField: "image", icon: "eye" },
        presentation: {
          label: "Presentations",
          apiField: "presentation",
          icon: "chart",
        },
        "html-page": {
          label: "HTML Pages",
          apiField: "html-page",
          icon: "html",
        },
        other: { label: "Other Files", apiField: "other", icon: "folder" },
      },
    },
    blackboard: {
      label: "Blackboard Content",
      description: "Content created within Blackboard",
      types: {
        "application/x-document": {
          label: "Blackboard Documents",
          apiField: "application/x-document",
          icon: "clipboard",
        },
        "application/x-folder": {
          label: "Folders",
          apiField: "application/x-folder",
          icon: "folder",
        },
        "application/x-item": {
          label: "Content Items",
          apiField: "application/x-item",
          icon: "document",
        },
        "application/x-learning-module": {
          label: "Learning Modules",
          apiField: "application/x-learning-module",
          icon: "document",
        },
        "application/x-lesson": {
          label: "Lesson Plans",
          apiField: "application/x-lesson",
          icon: "document",
        },
        "application/x-link-discussion-topic": {
          label: "Discussion Topics",
          apiField: "application/x-link-discussion-topic",
          icon: "document",
        },
        "application/x-link-web": {
          label: "Web Links",
          apiField: "application/x-link-web",
          icon: "html",
        },
        "application/x-lti-launch": {
          label: "External LTI Tools",
          apiField: "application/x-lti-launch",
          icon: "gear",
        },
        "application/x-page": {
          label: "Content Pages",
          apiField: "application/x-page",
          icon: "document",
        },
      },
    },
  };

  // ========================================================================
  // Issue Categories
  // ========================================================================

  /**
   * Issue category groupings for organised display
   * Groups related issues together with display metadata
   * @type {Object}
   */
  var ISSUE_CATEGORIES = {
    "Alternative Text": {
      description: "Images and objects missing descriptions for screen readers",
      icon: "missingAlt",
      issues: [
        "alternativeText2",
        "htmlImageAlt2",
        "htmlObjectAlt2",
        "imageDescription2",
        "imageDecorative2",
        "htmlImageRedundantAlt3",
      ],
    },
    "Colour Contrast": {
      description: "Text and images with insufficient colour contrast",
      icon: "eye",
      issues: ["contrast2", "htmlColorContrast2", "imageContrast2"],
    },
    Headings: {
      description: "Missing or incorrectly structured headings",
      icon: "document",
      issues: [
        "headingsPresence2",
        "headingsSequential3",
        "headingsStartAtOne3",
        "headingsHigherLevel3",
        "htmlHeadingsPresence2",
        "htmlHeadingOrder3",
        "htmlEmptyHeading2",
        "htmlHeadingsStart2",
      ],
    },
    Tables: {
      description: "Tables missing proper header markup",
      icon: "clipboard",
      issues: ["tableHeaders2", "htmlEmptyTableHeader2", "htmlTdHasHeader2"],
    },
    "Document Structure": {
      description: "Missing titles, tags, or language settings",
      icon: "document",
      issues: [
        "tagged2",
        "title3",
        "htmlTitle3",
        "languagePresence3",
        "languageCorrect3",
        "htmlHasLang3",
      ],
    },
    "Scanned Documents": {
      description: "Scanned documents requiring OCR processing",
      icon: "camera",
      issues: ["scanned1"],
    },
    "Scanned and OCRed": {
      description: "Scanned content that has been OCRed but may have issues",
      icon: "ocr",
      issues: ["ocred2"],
    },
    "File Issues": {
      description: "Documents that cannot be processed",
      icon: "warning",
      issues: ["parsable1", "security1"],
    },
    "Seizure Risk": {
      description: "Content that may trigger seizures",
      icon: "warning",
      issues: ["imageSeizure1"],
    },
    Links: {
      description: "Broken or unclear link text",
      icon: "brokenLink",
      issues: ["htmlBrokenLink2", "htmlLinkName3"],
    },
    "HTML Structure": {
      description: "Malformed HTML elements",
      icon: "code",
      issues: [
        "htmlCaption2",
        "htmlLabel2",
        "htmlDefinitionList3",
        "htmlList3",
      ],
    },
    "OCR Quality": {
      description: "Images containing text that may be unreadable",
      icon: "search",
      issues: ["imageOcr3"],
    },
  };

  /**
   * Issues to exclude from category display (shown in dedicated sections)
   * @type {Array.<string>}
   */
  var EXCLUDED_ISSUES = ["libraryReference"];

  // ========================================================================
  // Issue Descriptions
  // ========================================================================

  /**
   * Human-readable descriptions for all issue types
   * Organised by severity suffix: 1 = Severe, 2 = Major, 3 = Minor
   * @type {Object.<string, string>}
   */
  var ISSUE_DESCRIPTIONS = {
    // Severe Issues (suffix 1) - Immediate action required
    scanned1:
      "The document is scanned but not processed with OCR, making text inaccessible to screen readers.",
    parsable1:
      "The document is malformed or corrupted and cannot be processed.",
    security1:
      "The document is encrypted or password-protected, preventing accessibility analysis.",
    imageSeizure1:
      "The image contains flashing content that may induce seizures in susceptible individuals.",

    // Major Issues (suffix 2) - Should be addressed
    alternativeText2:
      "The document contains images without alternative text descriptions.",
    htmlImageAlt2:
      "The HTML content contains images without alternative text descriptions.",
    htmlObjectAlt2:
      "The HTML content has embedded objects (videos, audio) without alternative descriptions.",
    imageDescription2:
      "The standalone image does not have an alternative text description.",
    imageDecorative2:
      "A decorative image is not marked as decorative, confusing screen reader users.",
    contrast2:
      "The document contains text with insufficient colour contrast against the background.",
    htmlColorContrast2:
      "The HTML content contains text with insufficient colour contrast.",
    imageContrast2:
      "The image contains text with insufficient colour contrast.",
    headingsPresence2:
      "The document does not contain any headings, making navigation difficult.",
    htmlHeadingsPresence2: "The HTML content does not contain any headings.",
    htmlEmptyHeading2: "The HTML content contains empty heading elements.",
    htmlHeadingsStart2:
      "The HTML heading structure does not start at the appropriate level.",
    tableHeaders2:
      "The document contains tables without header cells, making data relationships unclear.",
    htmlEmptyTableHeader2:
      "The HTML content has table header cells without content.",
    htmlTdHasHeader2:
      "The HTML content has data tables without any header cells.",
    tagged2:
      "The document is untagged, making it inaccessible to assistive technologies.",
    ocred2:
      "The document is scanned and has been OCRed, but may have recognition errors.",
    htmlCaption2: "The HTML content has videos or multimedia without captions.",
    htmlLabel2: "The HTML content has form elements without accessible labels.",
    htmlBrokenLink2:
      "The HTML content contains links that lead to missing or broken pages.",

    // Minor Issues (suffix 3) - Recommended improvements
    headingsSequential3:
      "The document headings skip levels (e.g., H1 to H3), which can confuse navigation.",
    headingsStartAtOne3:
      "The document heading structure does not begin at heading level one.",
    headingsHigherLevel3:
      "The document uses heading levels beyond six (H7+), which are not standard.",
    htmlHeadingOrder3: "The HTML heading levels are not in sequential order.",
    title3: "The document is missing a title, making it hard to identify.",
    htmlTitle3: "The HTML content is missing a page title.",
    languagePresence3:
      "The document does not have a language set, affecting pronunciation by screen readers.",
    languageCorrect3:
      "The document language tag does not match the actual content language.",
    htmlHasLang3: "The HTML content does not have a language attribute set.",
    htmlImageRedundantAlt3:
      'The HTML content has images with redundant alternative text (e.g., "image of...").',
    htmlLinkName3:
      "The HTML content contains links without clear, descriptive text.",
    htmlDefinitionList3: "The HTML content has malformed definition lists.",
    htmlList3: "The HTML content has malformed list structures.",
    imageOcr3:
      "The image contains text that may not be readable by assistive technologies.",
  };

  // ========================================================================
  // Severity Levels
  // ========================================================================

  /**
   * Severity level definitions with display metadata
   * @type {Object.<number, Object>}
   */
  var SEVERITY_LEVELS = {
    1: {
      label: "Severe",
      description: "Critical issues requiring immediate attention",
      cssClass: "ally-severity-severe",
      ariaLabel: "Severe issue",
    },
    2: {
      label: "Major",
      description: "Significant issues that should be addressed",
      cssClass: "ally-severity-major",
      ariaLabel: "Major issue",
    },
    3: {
      label: "Minor",
      description: "Recommended improvements for best practice",
      cssClass: "ally-severity-minor",
      ariaLabel: "Minor issue",
    },
  };

  // ========================================================================
  // Score Rating Labels
  // ========================================================================

  /**
   * Score rating labels for accessibility score display
   * Matches ALLY_CONFIG.SCORE_THRESHOLDS
   * @type {Object.<string, Object>}
   */
  var SCORE_RATINGS = {
    excellent: { label: "Excellent", minScore: 0.9 },
    good: { label: "Good", minScore: 0.7 },
    fair: { label: "Fair", minScore: 0.5 },
    poor: { label: "Poor", minScore: 0.3 },
    veryPoor: { label: "Very Poor", minScore: 0 },
  };

  // ========================================================================
  // Helper Functions
  // ========================================================================

  /**
   * Extracts severity level from an issue field name
   * Issue fields end with severity suffix (1, 2, or 3)
   * @param {string} fieldName - The API field name (e.g., 'alternativeText2')
   * @returns {number} Severity level (1, 2, or 3), defaults to 2 if not found
   *
   * @example
   * getSeverityFromField('scanned1');      // Returns: 1
   * getSeverityFromField('contrast2');     // Returns: 2
   * getSeverityFromField('title3');        // Returns: 3
   * getSeverityFromField('unknownField');  // Returns: 2 (default)
   */
  function getSeverityFromField(fieldName) {
    if (!fieldName || typeof fieldName !== "string") {
      logWarn(
        "Invalid field name provided to getSeverityFromField:",
        fieldName,
      );
      return 2;
    }
    var match = fieldName.match(/(\d)$/);
    return match ? parseInt(match[1], 10) : 2;
  }

  /**
   * Gets the human-readable description for an issue field
   * @param {string} fieldName - The API field name
   * @returns {string} Human-readable description or formatted field name if not found
   *
   * @example
   * getIssueDescription('alternativeText2');
   * // Returns: 'The document contains images without alternative text descriptions.'
   */
  function getIssueDescription(fieldName) {
    if (!fieldName || typeof fieldName !== "string") {
      logWarn("Invalid field name provided to getIssueDescription:", fieldName);
      return "Unknown issue";
    }
    if (ISSUE_DESCRIPTIONS[fieldName]) {
      return ISSUE_DESCRIPTIONS[fieldName];
    }
    // Fallback: format field name as readable text
    logDebug("No description found for field:", fieldName);
    return formatFieldNameAsLabel(fieldName);
  }

  /**
   * Gets the category name for a given issue field
   * @param {string} fieldName - The API field name
   * @returns {string|null} Category name or null if not categorised
   *
   * @example
   * getCategoryForIssue('contrast2');     // Returns: 'Colour Contrast'
   * getCategoryForIssue('libraryReference'); // Returns: null
   */
  function getCategoryForIssue(fieldName) {
    if (!fieldName || typeof fieldName !== "string") {
      return null;
    }
    for (var category in ISSUE_CATEGORIES) {
      if (Object.prototype.hasOwnProperty.call(ISSUE_CATEGORIES, category)) {
        if (ISSUE_CATEGORIES[category].issues.indexOf(fieldName) !== -1) {
          return category;
        }
      }
    }
    return null;
  }

  /**
   * Gets the severity level object for a given level number
   * @param {number} level - Severity level (1, 2, or 3)
   * @returns {Object|null} Severity level definition or null if invalid
   */
  function getSeverityLevel(level) {
    return SEVERITY_LEVELS[level] || null;
  }

  /**
   * Gets all issues for a specific severity level
   * @param {number} level - Severity level (1, 2, or 3)
   * @returns {Array.<string>} Array of issue field names
   */
  function getIssuesBySeverity(level) {
    var issues = [];
    var suffix = String(level);
    for (var fieldName in ISSUE_DESCRIPTIONS) {
      if (Object.prototype.hasOwnProperty.call(ISSUE_DESCRIPTIONS, fieldName)) {
        if (fieldName.endsWith(suffix)) {
          issues.push(fieldName);
        }
      }
    }
    return issues;
  }

  /**
   * Gets file type information from the mapping
   * @param {string} apiField - The API field name for the file type
   * @returns {Object|null} File type info with label and category, or null if not found
   *
   * @example
   * getFileTypeInfo('pdf');
   * // Returns: { label: 'PDF Documents', category: 'External Files', icon: '📄' }
   */
  function getFileTypeInfo(apiField) {
    if (!apiField || typeof apiField !== "string") {
      return null;
    }
    for (var category in FILE_TYPE_MAPPING) {
      if (Object.prototype.hasOwnProperty.call(FILE_TYPE_MAPPING, category)) {
        var categoryData = FILE_TYPE_MAPPING[category];
        for (var typeKey in categoryData.types) {
          if (
            Object.prototype.hasOwnProperty.call(categoryData.types, typeKey)
          ) {
            var typeData = categoryData.types[typeKey];
            if (typeData.apiField === apiField) {
              return {
                label: typeData.label,
                category: categoryData.label,
                categoryKey: category,
                icon: typeData.icon,
              };
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Formats a field name as a human-readable label
   * @param {string} fieldName - The API field name
   * @returns {string} Formatted label
   * @private
   */
  function formatFieldNameAsLabel(fieldName) {
    if (!fieldName) return "Unknown";
    // Remove numeric suffix
    var name = fieldName.replace(/\d+$/, "");
    // Convert camelCase to spaces
    name = name.replace(/([A-Z])/g, " $1");
    // Convert to title case
    name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    return name.trim();
  }

  /**
   * Gets the score rating based on a score value
   * Uses ALLY_CONFIG thresholds if available, otherwise uses local thresholds
   * @param {number} score - Score between 0 and 1
   * @returns {Object} Rating object with label and cssClass
   *
   * @example
   * getScoreRating(0.95); // Returns: { label: 'Excellent', cssClass: 'score-excellent' }
   * getScoreRating(0.45); // Returns: { label: 'Poor', cssClass: 'score-poor' }
   */
  function getScoreRating(score) {
    if (typeof score !== "number" || isNaN(score)) {
      return { label: "Unknown", cssClass: "score-unknown" };
    }

    // Use ALLY_CONFIG if available for consistent thresholds
    if (typeof ALLY_CONFIG !== "undefined" && ALLY_CONFIG.SCORE_THRESHOLDS) {
      var thresholds = ALLY_CONFIG.SCORE_THRESHOLDS;
      if (score >= thresholds.EXCELLENT) {
        return { label: "Excellent", cssClass: "score-excellent" };
      }
      if (score >= thresholds.GOOD) {
        return { label: "Good", cssClass: "score-good" };
      }
      if (score >= thresholds.FAIR) {
        return { label: "Fair", cssClass: "score-fair" };
      }
      if (score >= thresholds.POOR) {
        return { label: "Poor", cssClass: "score-poor" };
      }
      return { label: "Very Poor", cssClass: "score-very-poor" };
    }

    // Fallback to local thresholds
    if (score >= 0.9) {
      return { label: "Excellent", cssClass: "score-excellent" };
    }
    if (score >= 0.7) {
      return { label: "Good", cssClass: "score-good" };
    }
    if (score >= 0.5) {
      return { label: "Fair", cssClass: "score-fair" };
    }
    if (score >= 0.3) {
      return { label: "Poor", cssClass: "score-poor" };
    }
    return { label: "Very Poor", cssClass: "score-very-poor" };
  }

  /**
   * Checks if an issue field should be excluded from category display
   * @param {string} fieldName - The API field name
   * @returns {boolean} True if the field should be excluded
   */
  function isExcludedIssue(fieldName) {
    return EXCLUDED_ISSUES.indexOf(fieldName) !== -1;
  }

  /**
   * Gets all category names in order of typical importance
   * @returns {Array.<string>} Array of category names
   */
  function getCategoryNames() {
    return Object.keys(ISSUE_CATEGORIES);
  }

  /**
   * Gets category information by name
   * @param {string} categoryName - The category name
   * @returns {Object|null} Category information or null if not found
   */
  function getCategory(categoryName) {
    return ISSUE_CATEGORIES[categoryName] || null;
  }

  /**
   * Calculates issue counts by category from API response data
   * @param {Object} issuesData - Issues data from API response
   * @returns {Object} Object mapping category names to issue counts and details
   *
   * @example
   * const categoryCounts = calculateCategoryIssueCounts(issuesData);
   * // Returns: { 'Alternative Text': { total: 64, severe: 0, major: 64, minor: 0, issues: [...] }, ... }
   */
  function calculateCategoryIssueCounts(issuesData) {
    var categoryCounts = {};

    for (var categoryName in ISSUE_CATEGORIES) {
      if (
        Object.prototype.hasOwnProperty.call(ISSUE_CATEGORIES, categoryName)
      ) {
        var category = ISSUE_CATEGORIES[categoryName];
        var categoryTotal = 0;
        var severeCounts = 0;
        var majorCounts = 0;
        var minorCounts = 0;
        var issueDetails = [];

        for (var i = 0; i < category.issues.length; i++) {
          var issueField = category.issues[i];
          var count = issuesData[issueField] || 0;

          if (count > 0) {
            var severity = getSeverityFromField(issueField);
            categoryTotal += count;

            if (severity === 1) severeCounts += count;
            else if (severity === 2) majorCounts += count;
            else if (severity === 3) minorCounts += count;

            issueDetails.push({
              field: issueField,
              count: count,
              severity: severity,
              description: getIssueDescription(issueField),
            });
          }
        }

        categoryCounts[categoryName] = {
          total: categoryTotal,
          severe: severeCounts,
          major: majorCounts,
          minor: minorCounts,
          issues: issueDetails,
          description: category.description,
          icon: category.icon,
        };
      }
    }

    return categoryCounts;
  }

  /**
   * Calculates total issue counts by severity from API response data
   * @param {Object} issuesData - Issues data from API response
   * @returns {Object} Object with severe, major, minor, and total counts
   *
   * @example
   * const severityCounts = calculateSeverityTotals(issuesData);
   * // Returns: { severe: 1, major: 148, minor: 35, total: 184 }
   */
  function calculateSeverityTotals(issuesData) {
    var totals = {
      severe: 0,
      major: 0,
      minor: 0,
      total: 0,
    };

    for (var fieldName in issuesData) {
      if (Object.prototype.hasOwnProperty.call(issuesData, fieldName)) {
        // Skip non-issue fields and excluded issues
        if (!fieldName.match(/\d$/) || isExcludedIssue(fieldName)) {
          continue;
        }

        var count = issuesData[fieldName];
        if (typeof count === "number" && count > 0) {
          var severity = getSeverityFromField(fieldName);
          totals.total += count;

          if (severity === 1) totals.severe += count;
          else if (severity === 2) totals.major += count;
          else if (severity === 3) totals.minor += count;
        }
      }
    }

    return totals;
  }

  /**
   * Calculates issues grouped by severity level from API response data
   * Groups all issues into severe, major, and minor with category information
   * @param {Object} issuesData - Issues data from API response
   * @returns {Object} Object with severe, major, minor arrays containing issue details
   *
   * @example
   * const severityGroups = calculateIssuesBySeverity(issuesData);
   * // Returns: { severe: [...], major: [...], minor: [...] }
   */
  function calculateIssuesBySeverity(issuesData) {
    var result = {
      severe: [],
      major: [],
      minor: [],
    };

    // Iterate through all categories to get issues with their category context
    for (var categoryName in ISSUE_CATEGORIES) {
      if (
        Object.prototype.hasOwnProperty.call(ISSUE_CATEGORIES, categoryName)
      ) {
        var category = ISSUE_CATEGORIES[categoryName];

        for (var i = 0; i < category.issues.length; i++) {
          var issueField = category.issues[i];
          var count = issuesData[issueField] || 0;

          if (count > 0) {
            var severity = getSeverityFromField(issueField);
            var issueInfo = {
              field: issueField,
              count: count,
              severity: severity,
              description: getIssueDescription(issueField),
              category: categoryName,
              categoryIcon: category.icon,
            };

            if (severity === 1) {
              result.severe.push(issueInfo);
            } else if (severity === 2) {
              result.major.push(issueInfo);
            } else if (severity === 3) {
              result.minor.push(issueInfo);
            }
          }
        }
      }
    }

    // Sort each array by count (descending)
    var sortByCount = function (a, b) {
      return b.count - a.count;
    };

    result.severe.sort(sortByCount);
    result.major.sort(sortByCount);
    result.minor.sort(sortByCount);

    return result;
  }

  /**
   * Calculates file type counts from API response data
   * @param {Object} overallData - Overall data from API response
   * @returns {Object} Object with external and blackboard file counts
   *
   * @example
   * const fileTypeCounts = calculateFileTypeCounts(overallData);
   * // Returns: { external: { total: 95, types: [...] }, blackboard: { total: 3, types: [...] } }
   */
  function calculateFileTypeCounts(overallData) {
    var result = {
      external: {
        total: 0,
        types: [],
      },
      blackboard: {
        total: 0,
        types: [],
      },
    };

    for (var categoryKey in FILE_TYPE_MAPPING) {
      if (
        Object.prototype.hasOwnProperty.call(FILE_TYPE_MAPPING, categoryKey)
      ) {
        var categoryData = FILE_TYPE_MAPPING[categoryKey];

        for (var typeKey in categoryData.types) {
          if (
            Object.prototype.hasOwnProperty.call(categoryData.types, typeKey)
          ) {
            var typeInfo = categoryData.types[typeKey];
            var count = overallData[typeInfo.apiField] || 0;

            if (count > 0) {
              result[categoryKey].total += count;
              result[categoryKey].types.push({
                key: typeKey,
                label: typeInfo.label,
                icon: typeInfo.icon,
                count: count,
              });
            }
          }
        }
      }
    }

    return result;
  }

  // ========================================================================
  // Validation and Debug
  // ========================================================================

  /**
   * Validates configuration integrity
   * @returns {Object} Validation result with status and any issues found
   */
  function validateConfiguration() {
    var issues = [];

    // Check all issues in categories have descriptions
    for (var categoryName in ISSUE_CATEGORIES) {
      if (
        Object.prototype.hasOwnProperty.call(ISSUE_CATEGORIES, categoryName)
      ) {
        var category = ISSUE_CATEGORIES[categoryName];
        for (var i = 0; i < category.issues.length; i++) {
          var issueField = category.issues[i];
          if (!ISSUE_DESCRIPTIONS[issueField]) {
            issues.push(
              "Missing description for issue: " +
                issueField +
                " in category: " +
                categoryName,
            );
          }
        }
      }
    }

    // Check severity levels are defined
    for (var level = 1; level <= 3; level++) {
      if (!SEVERITY_LEVELS[level]) {
        issues.push("Missing severity level definition: " + level);
      }
    }

    // Check file type mapping structure
    for (var catKey in FILE_TYPE_MAPPING) {
      if (Object.prototype.hasOwnProperty.call(FILE_TYPE_MAPPING, catKey)) {
        var cat = FILE_TYPE_MAPPING[catKey];
        if (!cat.label || !cat.types) {
          issues.push("Invalid file type category structure: " + catKey);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues: issues,
    };
  }

  /**
   * Gets debug information about the configuration
   * @returns {Object} Debug information
   */
  function getDebugInfo() {
    return {
      issueDescriptionCount: Object.keys(ISSUE_DESCRIPTIONS).length,
      categoryCount: Object.keys(ISSUE_CATEGORIES).length,
      fileTypeCategories: Object.keys(FILE_TYPE_MAPPING).length,
      excludedIssueCount: EXCLUDED_ISSUES.length,
      validation: validateConfiguration(),
    };
  }

  // Log initialisation
  logInfo("ALLY_COURSE_REPORT_CONFIG initialised");

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    // Data mappings (read-only access)
    FILE_TYPE_MAPPING: FILE_TYPE_MAPPING,
    ISSUE_CATEGORIES: ISSUE_CATEGORIES,
    ISSUE_DESCRIPTIONS: ISSUE_DESCRIPTIONS,
    SEVERITY_LEVELS: SEVERITY_LEVELS,
    SCORE_RATINGS: SCORE_RATINGS,
    EXCLUDED_ISSUES: EXCLUDED_ISSUES,

    // Core helper functions
    getSeverityFromField: getSeverityFromField,
    getIssueDescription: getIssueDescription,
    getCategoryForIssue: getCategoryForIssue,
    getSeverityLevel: getSeverityLevel,
    getIssuesBySeverity: getIssuesBySeverity,
    getFileTypeInfo: getFileTypeInfo,
    getScoreRating: getScoreRating,
    isExcludedIssue: isExcludedIssue,

    // Category functions
    getCategoryNames: getCategoryNames,
    getCategory: getCategory,

    // Calculation functions
    calculateCategoryIssueCounts: calculateCategoryIssueCounts,
    calculateSeverityTotals: calculateSeverityTotals,
    calculateIssuesBySeverity: calculateIssuesBySeverity,
    calculateFileTypeCounts: calculateFileTypeCounts,

    // Validation and debug
    validateConfiguration: validateConfiguration,
    getDebugInfo: getDebugInfo,
  };
})();
