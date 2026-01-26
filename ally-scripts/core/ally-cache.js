/**
 * @fileoverview Ally Accessibility Reporting Tool - Cache Module
 * @module AllyCache
 * @requires None - Standalone cache module
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Core caching module for the Ally Accessibility Reporting Tool.
 * Provides localStorage-based caching with LRU eviction for API responses.
 * Supports all three report types: Course Report, Statement Preview, and Report Builder.
 *
 * Key Features:
 * - localStorage persistence with single key storage
 * - LRU (Least Recently Used) eviction strategy
 * - Separate cache keys per report type
 * - Change notification callbacks
 * - Utility functions for formatting size and age
 *
 * Storage Schema:
 * - Single localStorage key: 'ally-cache-store'
 * - Contains version, entries object, and metadata
 * - Entries keyed by report type prefix (ally-cache-cr-, ally-cache-sp-, ally-cache-rb-)
 *
 * Integration:
 * - Used by ally-course-report.js for caching course reports
 * - Used by ally-statement-preview.js for caching statements
 * - Used by ally-main-controller.js for Report Builder caching
 * - Available globally via ALLY_CACHE
 *
 * @example
 * // Cache a course report
 * var key = ALLY_CACHE.courseReportKey('_12345_1');
 * ALLY_CACHE.set(key, { type: 'course-report', courseId: '_12345_1', data: {...} });
 *
 * // Retrieve cached data
 * var cached = ALLY_CACHE.get(key);
 *
 * // Check cache statistics
 * var stats = ALLY_CACHE.getStats();
 */

const ALLY_CACHE = (function () {
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
      console.error.apply(console, ["[AllyCache] " + message].concat(args));
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
      console.warn.apply(console, ["[AllyCache] " + message].concat(args));
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
      console.log.apply(console, ["[AllyCache] " + message].concat(args));
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
      console.log.apply(console, ["[AllyCache] " + message].concat(args));
    }
  }

  // ========================================================================
  // Constants
  // ========================================================================

  /** localStorage key for the cache store */
  var STORAGE_KEY = "ally-cache-store";

  /** Current schema version for migrations */
  var SCHEMA_VERSION = 1;

  /** Maximum total cache size in bytes (4MB) */
  var MAX_SIZE_BYTES = 4194304;

  /** Maximum number of cached entries */
  var MAX_ENTRIES = 100;

  /** Eviction threshold (90% of max) */
  var EVICTION_THRESHOLD = 0.9;

  /** Percentage of entries to remove during eviction */
  var EVICTION_PERCENT = 0.2;

  /** Cache key prefixes */
  var KEY_PREFIX = {
    COURSE_REPORT: "ally-cache-cr-",
    STATEMENT_PREVIEW: "ally-cache-sp-",
    REPORT_BUILDER: "ally-cache-rb-",
  };

  // ========================================================================
  // Private State
  // ========================================================================

  /** Array of change callbacks */
  var changeCallbacks = [];

  // ========================================================================
  // Private Utility Functions
  // ========================================================================

  /**
   * Creates an empty cache store with default structure
   * @returns {Object} Empty store object
   */
  function createEmptyStore() {
    return {
      version: SCHEMA_VERSION,
      entries: {},
      metadata: {
        totalSize: 0,
        entryCount: 0,
        lastUpdated: Date.now(),
      },
    };
  }

  /**
   * Gets the cache store from localStorage
   * @returns {Object} Cache store object
   */
  function getStore() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        logDebug("No existing cache store, creating new one");
        return createEmptyStore();
      }

      var store = JSON.parse(stored);

      // Check schema version for future migrations
      if (!store.version || store.version !== SCHEMA_VERSION) {
        logInfo("Cache schema version mismatch, migrating...");
        return migrateStore(store);
      }

      return store;
    } catch (e) {
      logError("Failed to read cache store:", e);
      return createEmptyStore();
    }
  }

  /**
   * Saves the cache store to localStorage
   * @param {Object} store - Cache store to save
   * @returns {boolean} True if save was successful
   */
  function saveStore(store) {
    try {
      store.metadata.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      logDebug("Cache store saved, " + store.metadata.entryCount + " entries");
      return true;
    } catch (e) {
      logError("Failed to save cache store:", e);
      // Attempt to clear some space if quota exceeded
      if (e.name === "QuotaExceededError") {
        logWarn("Storage quota exceeded, triggering eviction");
        evictIfNeeded(true);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
          return true;
        } catch (e2) {
          logError("Still cannot save after eviction:", e2);
        }
      }
      return false;
    }
  }

  /**
   * Migrates an old store schema to the current version
   * @param {Object} oldStore - Store with old schema
   * @returns {Object} Migrated store
   */
  function migrateStore(oldStore) {
    logInfo(
      "Migrating cache store from version " + (oldStore.version || "unknown"),
    );

    // For now, just create a fresh store
    // Future versions can implement actual migration logic
    var newStore = createEmptyStore();

    // Attempt to preserve valid entries
    if (oldStore.entries && typeof oldStore.entries === "object") {
      Object.keys(oldStore.entries).forEach(function (key) {
        var entry = oldStore.entries[key];
        if (entry && entry.type && entry.data) {
          newStore.entries[key] = entry;
          newStore.metadata.entryCount++;
          newStore.metadata.totalSize += entry.size || 0;
        }
      });
    }

    saveStore(newStore);
    return newStore;
  }

  /**
   * Calculates the size of an entry in bytes
   * @param {Object} entry - Entry to measure
   * @returns {number} Size in bytes
   */
  function calculateEntrySize(entry) {
    try {
      return new Blob([JSON.stringify(entry)]).size;
    } catch (e) {
      // Fallback for environments without Blob
      return JSON.stringify(entry).length * 2; // Rough UTF-16 estimate
    }
  }

  /**
   * Generates a hash string from input using djb2 algorithm
   * @param {string} str - String to hash
   * @returns {string} Hexadecimal hash string
   */
  function hashString(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = (hash << 5) + hash + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to positive hex string
    return (hash >>> 0).toString(16);
  }

  /**
   * Notifies all registered change callbacks
   * @param {string} action - Action that occurred ('set', 'remove', 'clear', 'evict')
   * @param {string} key - Cache key affected (optional)
   */
  function notifyChange(action, key) {
    var stats = publicApi.getStats();
    var event = {
      action: action,
      key: key || null,
      stats: stats,
    };

    changeCallbacks.forEach(function (callback) {
      try {
        callback(event);
      } catch (e) {
        logError("Change callback error:", e);
      }
    });
  }

  /**
   * Performs LRU eviction if storage limits are approached
   * @param {boolean} force - Force eviction even if under threshold
   * @returns {boolean} True if eviction was performed
   */
  function evictIfNeeded(force) {
    var store = getStore();
    var totalSize = store.metadata.totalSize;
    var entryCount = store.metadata.entryCount;

    var sizeThreshold = MAX_SIZE_BYTES * EVICTION_THRESHOLD;
    var countThreshold = MAX_ENTRIES;

    if (!force && totalSize < sizeThreshold && entryCount < countThreshold) {
      return false; // No eviction needed
    }

    logInfo(
      "Eviction triggered: " +
        formatSizeInternal(totalSize) +
        ", " +
        entryCount +
        " entries",
    );

    // Sort entries by accessedAt (oldest first)
    var entries = Object.keys(store.entries)
      .map(function (key) {
        return {
          key: key,
          accessedAt: store.entries[key].accessedAt || 0,
        };
      })
      .sort(function (a, b) {
        return a.accessedAt - b.accessedAt;
      });

    // Remove oldest 20% (minimum 1)
    var removeCount = Math.max(1, Math.ceil(entries.length * EVICTION_PERCENT));
    var removed = [];

    for (var i = 0; i < removeCount && i < entries.length; i++) {
      var key = entries[i].key;
      var entry = store.entries[key];

      store.metadata.totalSize -= entry.size || 0;
      store.metadata.entryCount--;
      delete store.entries[key];
      removed.push(key);
    }

    // Ensure totalSize doesn't go negative
    if (store.metadata.totalSize < 0) {
      store.metadata.totalSize = 0;
    }

    saveStore(store);

    logInfo("Evicted " + removed.length + " entries");

    // Notify listeners for each evicted entry
    removed.forEach(function (key) {
      notifyChange("evict", key);
    });

    return true;
  }

  /**
   * Internal formatSize implementation
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  function formatSizeInternal(bytes) {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  /**
   * Internal formatAge implementation
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {string} Human-readable age string
   */
  function formatAgeInternal(timestamp) {
    var now = Date.now();
    var diffMs = now - timestamp;
    var diffSeconds = Math.floor(diffMs / 1000);
    var diffMinutes = Math.floor(diffSeconds / 60);
    var diffHours = Math.floor(diffMinutes / 60);
    var diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return "just now";
    if (diffMinutes < 60)
      return diffMinutes + " minute" + (diffMinutes === 1 ? "" : "s") + " ago";
    if (diffHours < 24)
      return diffHours + " hour" + (diffHours === 1 ? "" : "s") + " ago";
    if (diffDays < 7)
      return diffDays + " day" + (diffDays === 1 ? "" : "s") + " ago";
    if (diffDays < 30) {
      var weeks = Math.floor(diffDays / 7);
      return weeks + " week" + (weeks === 1 ? "" : "s") + " ago";
    }
    var months = Math.floor(diffDays / 30);
    return months + " month" + (months === 1 ? "" : "s") + " ago";
  }

  // ========================================================================
  // Public API
  // ========================================================================

  var publicApi = {
    // ====== Key Generation ======

    /**
     * Generates cache key for Course Report
     * @param {string} courseId - Course ID (e.g., '_12345_1')
     * @returns {string} Cache key (e.g., 'ally-cache-cr-_12345_1')
     */
    courseReportKey: function (courseId) {
      if (!courseId || typeof courseId !== "string") {
        logWarn("Invalid courseId for courseReportKey");
        return KEY_PREFIX.COURSE_REPORT + "invalid";
      }
      return KEY_PREFIX.COURSE_REPORT + courseId;
    },

    /**
     * Generates cache key for Statement Preview
     * @param {string} courseId - Course ID (e.g., '_12345_1')
     * @returns {string} Cache key (e.g., 'ally-cache-sp-_12345_1')
     */
    statementPreviewKey: function (courseId) {
      if (!courseId || typeof courseId !== "string") {
        logWarn("Invalid courseId for statementPreviewKey");
        return KEY_PREFIX.STATEMENT_PREVIEW + "invalid";
      }
      return KEY_PREFIX.STATEMENT_PREVIEW + courseId;
    },

    /**
     * Generates cache key for Report Builder query
     * Uses hash of query parameters for exact-match caching
     * @param {string} endpoint - 'overall' or 'issues'
     * @param {Object} filters - Filter object
     * @param {string} sort - Sort field
     * @param {string} order - 'asc' or 'desc'
     * @param {number} limit - Results limit
     * @returns {string} Cache key (e.g., 'ally-cache-rb-a1b2c3d4')
     */
    reportBuilderKey: function (endpoint, filters, sort, order, limit) {
      // Normalise inputs for consistent hashing
      var normalised = {
        endpoint: (endpoint || "overall").toLowerCase(),
        filters: filters || {},
        sort: sort || "",
        order: (order || "asc").toLowerCase(),
        limit: limit || 1000,
      };

      // Create deterministic string representation
      var hashInput = JSON.stringify(normalised);
      var hash = hashString(hashInput);

      return KEY_PREFIX.REPORT_BUILDER + hash;
    },

    // ====== Core Operations ======

    /**
     * Gets a cached entry, updating accessedAt timestamp
     * @param {string} key - Cache key
     * @returns {Object|null} Entry data or null if not found
     */
    get: function (key) {
      if (!key || typeof key !== "string") {
        logWarn("Invalid key for get");
        return null;
      }

      var store = getStore();
      var entry = store.entries[key];

      if (!entry) {
        logDebug("Cache miss: " + key);
        return null;
      }

      // Update accessedAt timestamp for LRU tracking
      entry.accessedAt = Date.now();
      saveStore(store);

      logDebug("Cache hit: " + key);
      return entry;
    },

    /**
     * Stores data in cache (triggers eviction if needed)
     * @param {string} key - Cache key
     * @param {Object} entry - Entry object (type, courseId/queryDescription, data, etc.)
     *                         timestamp, accessedAt, size are auto-calculated
     */
    set: function (key, entry) {
      if (!key || typeof key !== "string") {
        logError("Invalid key for set");
        return;
      }

      if (!entry || typeof entry !== "object") {
        logError("Invalid entry for set");
        return;
      }

      var store = getStore();
      var now = Date.now();

      // Check if updating existing entry
      var existingEntry = store.entries[key];
      var existingSize = existingEntry ? existingEntry.size || 0 : 0;

      // Prepare the entry with auto-calculated fields
      var newEntry = Object.assign({}, entry, {
        timestamp: entry.timestamp || now,
        accessedAt: now,
      });

      // Calculate size
      newEntry.size = calculateEntrySize(newEntry);

      // Update metadata
      if (existingEntry) {
        // Update: adjust size difference
        store.metadata.totalSize =
          store.metadata.totalSize - existingSize + newEntry.size;
      } else {
        // New entry
        store.metadata.totalSize += newEntry.size;
        store.metadata.entryCount++;
      }

      // Store the entry
      store.entries[key] = newEntry;

      // Check if eviction is needed
      evictIfNeeded(false);

      // Save (eviction may have modified store, so re-get)
      store = getStore();
      store.entries[key] = newEntry;
      if (!existingEntry) {
        store.metadata.entryCount = Object.keys(store.entries).length;
      }
      store.metadata.totalSize = Object.keys(store.entries).reduce(function (
        sum,
        k,
      ) {
        return sum + (store.entries[k].size || 0);
      }, 0);

      saveStore(store);

      logInfo(
        "Cached: " + key + " (" + formatSizeInternal(newEntry.size) + ")",
      );

      // Notify listeners
      notifyChange("set", key);
    },

    /**
     * Removes a specific entry
     * @param {string} key - Cache key
     * @returns {boolean} True if entry was removed
     */
    remove: function (key) {
      if (!key || typeof key !== "string") {
        logWarn("Invalid key for remove");
        return false;
      }

      var store = getStore();
      var entry = store.entries[key];

      if (!entry) {
        logDebug("Remove: key not found: " + key);
        return false;
      }

      // Update metadata
      store.metadata.totalSize -= entry.size || 0;
      store.metadata.entryCount--;

      // Ensure non-negative
      if (store.metadata.totalSize < 0) store.metadata.totalSize = 0;
      if (store.metadata.entryCount < 0) store.metadata.entryCount = 0;

      // Remove entry
      delete store.entries[key];

      saveStore(store);

      logInfo("Removed: " + key);

      // Notify listeners
      notifyChange("remove", key);

      return true;
    },

    /**
     * Clears all cached data
     */
    clear: function () {
      var store = createEmptyStore();
      saveStore(store);

      logInfo("Cache cleared");

      // Notify listeners
      notifyChange("clear", null);
    },

    /**
     * Checks if cache has entry for key
     * @param {string} key - Cache key
     * @returns {boolean} True if entry exists
     */
    has: function (key) {
      if (!key || typeof key !== "string") {
        return false;
      }

      var store = getStore();
      return Object.prototype.hasOwnProperty.call(store.entries, key);
    },

    // ====== Query Methods ======

    /**
     * Gets all entries of a specific type
     * @param {'course-report'|'statement-preview'|'report-builder'} type - Report type
     * @returns {Array} Array of {key, entry} sorted by accessedAt (newest first)
     */
    getEntriesByType: function (type) {
      if (!type || typeof type !== "string") {
        logWarn("Invalid type for getEntriesByType");
        return [];
      }

      var store = getStore();
      var results = [];

      Object.keys(store.entries).forEach(function (key) {
        var entry = store.entries[key];
        if (entry.type === type) {
          results.push({ key: key, entry: entry });
        }
      });

      // Sort by accessedAt descending (newest first)
      results.sort(function (a, b) {
        return (b.entry.accessedAt || 0) - (a.entry.accessedAt || 0);
      });

      return results;
    },

    /**
     * Gets all entries (for cache browser)
     * @returns {Array} Array of {key, entry} sorted by accessedAt (newest first)
     */
    getAllEntries: function () {
      var store = getStore();
      var results = [];

      Object.keys(store.entries).forEach(function (key) {
        results.push({ key: key, entry: store.entries[key] });
      });

      // Sort by accessedAt descending (newest first)
      results.sort(function (a, b) {
        return (b.entry.accessedAt || 0) - (a.entry.accessedAt || 0);
      });

      return results;
    },

    // ====== Metadata ======

    /**
     * Gets cache statistics
     * @returns {Object} { totalSize, entryCount, maxSize, maxEntries, usagePercent }
     */
    getStats: function () {
      var store = getStore();
      var entries = Object.keys(store.entries);
      var allyCacheSize = 0;

      entries.forEach(function (key) {
        var entry = store.entries[key];
        if (entry && entry.size) {
          allyCacheSize += entry.size;
        }
      });

      // Calculate total localStorage usage for the domain
      var totalLocalStorageSize = 0;
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          var value = localStorage.getItem(key);
          if (value) {
            // Approximate size: key length + value length (UTF-16 = 2 bytes per char)
            totalLocalStorageSize += (key.length + value.length) * 2;
          }
        }
      } catch (e) {
        logWarn("Could not calculate total localStorage size:", e.message);
      }

      // Browser localStorage limit is typically 5MB
      var localStorageLimit = 5 * 1024 * 1024;

      return {
        allyCacheSize: allyCacheSize,
        totalSize: totalLocalStorageSize,
        entryCount: entries.length,
        maxSize: localStorageLimit,
        maxEntries: MAX_ENTRIES,
        usagePercent: (totalLocalStorageSize / localStorageLimit) * 100,
        allyCachePercent: (allyCacheSize / localStorageLimit) * 100,
      };
    },

    /**
     * Gets age information for a cached entry
     * @param {string} key - Cache key
     * @returns {Object|null} { timestamp, ageMs, ageText } or null if not found
     */
    getAge: function (key) {
      if (!key || typeof key !== "string") {
        return null;
      }

      var store = getStore();
      var entry = store.entries[key];

      if (!entry) {
        return null;
      }

      var now = Date.now();
      var timestamp = entry.timestamp || entry.accessedAt || now;
      var ageMs = now - timestamp;

      return {
        timestamp: timestamp,
        ageMs: ageMs,
        ageText: formatAgeInternal(timestamp),
      };
    },

    // ====== Utilities ======

    /**
     * Formats bytes as human-readable string
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted string (e.g., '4.5 KB', '1.2 MB')
     */
    formatSize: function (bytes) {
      if (typeof bytes !== "number" || isNaN(bytes)) {
        return "0 B";
      }
      return formatSizeInternal(bytes);
    },

    /**
     * Formats timestamp as relative age
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Relative age string (e.g., '3 days ago', '2 hours ago')
     */
    formatAge: function (timestamp) {
      if (typeof timestamp !== "number" || isNaN(timestamp)) {
        return "unknown";
      }
      return formatAgeInternal(timestamp);
    },

    // ====== Events ======

    /**
     * Register callback for cache changes
     * @param {Function} callback - Called with { action, key, stats }
     *                              action: 'set', 'remove', 'clear', 'evict'
     */
    onChange: function (callback) {
      if (typeof callback !== "function") {
        logWarn("Invalid callback for onChange");
        return;
      }

      changeCallbacks.push(callback);
      logDebug("Change callback registered, total: " + changeCallbacks.length);
    },

    // ====== Constants (exposed for UI) ======

    /** Maximum cache size in bytes (4MB) */
    MAX_SIZE_BYTES: MAX_SIZE_BYTES,

    /** Maximum number of entries */
    MAX_ENTRIES: MAX_ENTRIES,

    // ====== Debug ======

    /**
     * Gets debug information
     * @returns {Object} Debug info including stats, constants, and store snapshot
     */
    getDebugInfo: function () {
      var store = getStore();

      return {
        stats: publicApi.getStats(),
        constants: {
          storageKey: STORAGE_KEY,
          schemaVersion: SCHEMA_VERSION,
          maxSizeBytes: MAX_SIZE_BYTES,
          maxEntries: MAX_ENTRIES,
          evictionThreshold: EVICTION_THRESHOLD,
          evictionPercent: EVICTION_PERCENT,
          keyPrefixes: KEY_PREFIX,
        },
        callbackCount: changeCallbacks.length,
        storeVersion: store.version,
        entriesByType: {
          courseReport: publicApi.getEntriesByType("course-report").length,
          statementPreview:
            publicApi.getEntriesByType("statement-preview").length,
          reportBuilder: publicApi.getEntriesByType("report-builder").length,
        },
      };
    },
  };

  // Log initialisation
  logInfo("ALLY_CACHE initialised");

  // Return the public API
  return publicApi;
})();
