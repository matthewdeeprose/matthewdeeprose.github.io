/**
 * @fileoverview Ally Accessibility Reporting Tool - Inclusion Answers Store
 * @module AllyInclusionAnswers
 * @requires None - Standalone durable store
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Durable, per-module store for the author-answered "inclusion questionnaire"
 * that drives the visibility of the six "How your module was created with
 * accessibility and inclusion in mind" cards (group id `inclusive-design`) in
 * the Statement Preview.
 *
 * These answers are AUTHORED content, not regenerable API data, so this store
 * is deliberately SEPARATE from ALLY_CACHE — it has its own localStorage key
 * and NO LRU eviction. A module lead's answers must never be silently dropped
 * to make room for cached report data.
 *
 * Storage Schema (single localStorage key `ally-inclusion-answers`):
 *   {
 *     version: 1,
 *     entries: {
 *       [courseKey]: {
 *         answers: { <questionId>: "yes" | "no" | <markdown string> },
 *         updatedAt: <epoch ms>
 *       }
 *     }
 *   }
 *
 * `courseKey` is `selectedCourse.id` when present, else a normalised
 * `courseName` (mirrors the courseId/courseName fallback in
 * ally-statement-preview.js `generatePreview`). Use `courseKey(course)` to
 * derive it consistently from a course object.
 *
 * Answer semantics:
 * - Yes/No questions store the literal string "yes" or "no".
 * - The free-text question stores the raw markdown string (may be empty).
 * - The module-lead contact step stores two plain-text strings under the
 *   field ids "module-lead-name" and "module-lead-email" (may be empty).
 * - A missing question id means "unanswered".
 *
 * Integration:
 * - Written by the question wizard (Stage B, ally-inclusion-questions.js).
 * - Read by ally-statement-preview.js to feed the `answer:<id>` show-rule.
 * - Available globally via ALLY_INCLUSION_ANSWERS.
 *
 * @example
 * var key = ALLY_INCLUSION_ANSWERS.courseKey(selectedCourse);
 * ALLY_INCLUSION_ANSWERS.setAnswer(key, "assessment-clarity", "yes");
 * var answers = ALLY_INCLUSION_ANSWERS.get(key); // { "assessment-clarity": "yes", ... }
 */

const ALLY_INCLUSION_ANSWERS = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
  // ========================================================================

  var LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  var DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  var ENABLE_ALL_LOGGING = false;
  var DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.error.apply(console, ["[AllyInclusionAnswers] " + message].concat(args));
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.warn.apply(console, ["[AllyInclusionAnswers] " + message].concat(args));
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.log.apply(console, ["[AllyInclusionAnswers] " + message].concat(args));
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.log.apply(console, ["[AllyInclusionAnswers] " + message].concat(args));
    }
  }

  // ========================================================================
  // Constants
  // ========================================================================

  /** localStorage key for the durable inclusion-answers store */
  var STORAGE_KEY = "ally-inclusion-answers";

  /** Current schema version for future migrations */
  var SCHEMA_VERSION = 1;

  // ========================================================================
  // Private Utility Functions
  // ========================================================================

  /**
   * Creates an empty store with the default structure.
   * @returns {Object} Empty store object
   */
  function createEmptyStore() {
    return { version: SCHEMA_VERSION, entries: {} };
  }

  /**
   * Reads the store from localStorage, tolerating a missing or corrupt value.
   * On a schema-version mismatch the store is reset (answers are re-authorable),
   * preserving nothing rather than risking a malformed read.
   * @returns {Object} Store object
   */
  function getStore() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        logDebug("No existing inclusion-answers store, creating new one");
        return createEmptyStore();
      }
      var store = JSON.parse(stored);
      if (!store || typeof store !== "object" || !store.entries) {
        logWarn("Malformed inclusion-answers store, resetting");
        return createEmptyStore();
      }
      if (store.version !== SCHEMA_VERSION) {
        logInfo("Inclusion-answers schema mismatch, resetting to v" + SCHEMA_VERSION);
        return createEmptyStore();
      }
      return store;
    } catch (e) {
      logError("Failed to read inclusion-answers store:", e);
      return createEmptyStore();
    }
  }

  /**
   * Persists the store to localStorage.
   * @param {Object} store - Store to save
   * @returns {boolean} True on success
   */
  function saveStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      logError("Failed to save inclusion-answers store:", e);
      return false;
    }
  }

  /**
   * Normalises a course-name fallback key: lower-cased, trimmed, non-alphanumeric
   * runs collapsed to single hyphens. Used only when a course has no stable id.
   * @param {string} name
   * @returns {string}
   */
  function normaliseName(name) {
    return String(name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // ========================================================================
  // Public API
  // ========================================================================

  var publicApi = {
    /**
     * Derives the durable per-module storage key from a course object,
     * preferring the stable Ally course id and falling back to a normalised
     * course name (mirrors the generatePreview courseId/courseName fallback).
     * @param {{id?: string, name?: string}} course
     * @returns {string} A non-empty key, or "" when the course is unusable
     */
    courseKey: function (course) {
      if (!course) return "";
      if (course.id) return String(course.id);
      var fromName = normaliseName(course.name);
      if (fromName) return "name:" + fromName;
      return "";
    },

    /**
     * Returns the answers map for a course key (a shallow copy), or {} when the
     * course has no stored answers yet.
     * @param {string} courseKey
     * @returns {Object.<string, string>}
     */
    get: function (courseKey) {
      if (!courseKey) return {};
      var store = getStore();
      var entry = store.entries[courseKey];
      if (!entry || !entry.answers) return {};
      return Object.assign({}, entry.answers);
    },

    /**
     * Returns a single stored answer value, or undefined when unanswered.
     * @param {string} courseKey
     * @param {string} questionId
     * @returns {string|undefined}
     */
    getAnswer: function (courseKey, questionId) {
      if (!courseKey || !questionId) return undefined;
      var store = getStore();
      var entry = store.entries[courseKey];
      if (!entry || !entry.answers) return undefined;
      return entry.answers[questionId];
    },

    /**
     * Sets (or overwrites) a single answer and persists.
     * @param {string} courseKey
     * @param {string} questionId
     * @param {string} value - "yes" | "no" | markdown string
     * @returns {boolean} True on successful save
     */
    setAnswer: function (courseKey, questionId, value) {
      if (!courseKey || !questionId) {
        logWarn("setAnswer ignored: missing courseKey or questionId");
        return false;
      }
      var store = getStore();
      var entry = store.entries[courseKey];
      if (!entry || !entry.answers) {
        entry = { answers: {}, updatedAt: Date.now() };
        store.entries[courseKey] = entry;
      }
      entry.answers[questionId] = value;
      entry.updatedAt = Date.now();
      var ok = saveStore(store);
      logDebug("setAnswer", courseKey, questionId, "=>", value, ok ? "saved" : "FAILED");
      return ok;
    },

    /**
     * Replaces all answers for a course in one write.
     * @param {string} courseKey
     * @param {Object.<string, string>} answersObj
     * @returns {boolean} True on successful save
     */
    setAll: function (courseKey, answersObj) {
      if (!courseKey) {
        logWarn("setAll ignored: missing courseKey");
        return false;
      }
      var store = getStore();
      store.entries[courseKey] = {
        answers: Object.assign({}, answersObj || {}),
        updatedAt: Date.now(),
      };
      var ok = saveStore(store);
      logDebug("setAll", courseKey, ok ? "saved" : "FAILED");
      return ok;
    },

    /**
     * Removes all stored answers for a course.
     * @param {string} courseKey
     * @returns {boolean} True on successful save (or when nothing to clear)
     */
    clear: function (courseKey) {
      if (!courseKey) return false;
      var store = getStore();
      if (!store.entries[courseKey]) return true;
      delete store.entries[courseKey];
      var ok = saveStore(store);
      logDebug("clear", courseKey, ok ? "saved" : "FAILED");
      return ok;
    },

    /**
     * Returns the epoch-ms timestamp of the course's last saved answer
     * (the entry's `updatedAt`), or null when the course has no stored
     * answers yet. Feeds the statement's "last edited on" date.
     * @param {string} courseKey
     * @returns {number|null}
     */
    updatedAt: function (courseKey) {
      if (!courseKey) return null;
      var store = getStore();
      var entry = store.entries[courseKey];
      if (!entry || typeof entry.updatedAt !== "number") return null;
      return entry.updatedAt;
    },

    /**
     * True when the course has at least one stored answer.
     * @param {string} courseKey
     * @returns {boolean}
     */
    has: function (courseKey) {
      if (!courseKey) return false;
      var store = getStore();
      return !!store.entries[courseKey];
    },
  };

  logDebug("Inclusion-answers store initialised (key: " + STORAGE_KEY + ")");
  return publicApi;
})();

// Expose globally for non-module consumers (matches ALLY_CACHE pattern).
if (typeof window !== "undefined") {
  window.ALLY_INCLUSION_ANSWERS = ALLY_INCLUSION_ANSWERS;
}
