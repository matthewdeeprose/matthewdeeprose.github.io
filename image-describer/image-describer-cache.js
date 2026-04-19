/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER CACHE — IndexedDB Persistence
 * ═══════════════════════════════════════════════════════════════
 *
 * Persists analysis results in IndexedDB, keyed by SHA-256 file hash.
 * When a user uploads the same image again, cached analysis is restored
 * instantly without re-running OCR, colour sampling, or CLIP.
 *
 * Public API:
 *   hashFile(file)                         → Promise<string>  (SHA-256 hex)
 *   save(hash, record)                     → Promise<void>
 *   load(hash)                             → Promise<record|null>
 *   updateSlot(hash, slotName, data)       → Promise<void>
 *   saveUserEdits(hash, edits)             → Promise<void>
 *   saveGeneration(hash, generation)       → Promise<void>
 *   delete(hash)                           → Promise<void>
 *   list()                                 → Promise<array>
 *   getStats()                             → Promise<{ count, totalBytes }>
 *   evictOldest(targetBytes)               → Promise<number>
 *   shouldReuseSlot(slot, version, profile) → boolean
 *   clear()                                → Promise<void>
 *
 * Architecture: IIFE with window.ImageDescriberCache global.
 * No NPM — pure browser JS loaded via <script> tag.
 *
 * VERSION: 1.0.0
 * DATE: 22 March 2026
 * PHASE: 9B — Analysis Cache + File Hashing
 * ═══════════════════════════════════════════════════════════════
 */

window.ImageDescriberCache = (function () {
  "use strict";

  // ========================================================================
  // LOGGING CONFIGURATION
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
      console.error("[ImageDescriberCache] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[ImageDescriberCache] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[ImageDescriberCache] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[ImageDescriberCache] " + message, ...args);
  }

  // ========================================================================
  // CONSTANTS
  // ========================================================================

  const DB_NAME = "ImageDescriberCache";
  const DB_VERSION = 1;
  const STORE_NAME = "analyses";

  // ========================================================================
  // DATABASE CONNECTION
  // ========================================================================

  /** @type {IDBDatabase|null} */
  let _db = null;

  /**
   * Open (or create) the IndexedDB database.
   * Returns a cached connection on subsequent calls.
   * @returns {Promise<IDBDatabase>}
   */
  function getDB() {
    if (_db) return Promise.resolve(_db);

    return new Promise(function (resolve, reject) {
      var request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        logError("IndexedDB not available:", err);
        reject(new Error("IndexedDB not available: " + err.message));
        return;
      }

      request.onerror = function () {
        logError("Failed to open database:", request.error);
        reject(request.error);
      };

      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          var store = db.createObjectStore(STORE_NAME, { keyPath: "hash" });
          // Index for eviction: oldest lastAccessedAt first
          store.createIndex("lastAccessedAt", "lastAccessedAt", {
            unique: false,
          });
          logInfo("Object store created: " + STORE_NAME);
        }
      };

      request.onsuccess = function (event) {
        _db = event.target.result;

        // Handle unexpected close (e.g. browser clearing storage)
        _db.onclose = function () {
          logWarn("Database connection closed unexpectedly");
          _db = null;
        };

        logDebug("Database connection established");
        resolve(_db);
      };
    });
  }

  /**
   * Run an IndexedDB transaction with a single store.
   * @param {string} mode — 'readonly' or 'readwrite'
   * @param {function(IDBObjectStore): IDBRequest|void} callback
   * @returns {Promise<*>} — resolves with the request result
   */
  function withStore(mode, callback) {
    return getDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, mode);
        var store = tx.objectStore(STORE_NAME);
        var result;

        try {
          result = callback(store);
        } catch (err) {
          reject(err);
          return;
        }

        if (result && typeof result.onsuccess !== "undefined") {
          // callback returned an IDBRequest
          result.onsuccess = function () {
            resolve(result.result);
          };
          result.onerror = function () {
            reject(result.error);
          };
        } else {
          // callback did not return a request — resolve on tx complete
          tx.oncomplete = function () {
            resolve(result);
          };
          tx.onerror = function () {
            reject(tx.error);
          };
        }
      });
    });
  }

  // ========================================================================
  // FILE HASHING
  // ========================================================================

  /**
   * Compute the SHA-256 hash of a File (or Blob).
   * Uses the Web Crypto API — available in all modern browsers.
   * @param {File|Blob} file
   * @returns {Promise<string>} — 64-character lowercase hex string
   */
  async function hashFile(file) {
    if (!file || typeof file.arrayBuffer !== "function") {
      throw new Error("hashFile() requires a File or Blob");
    }

    var buffer = await file.arrayBuffer();
    var hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    var hashHex = hashArray
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");

    logDebug(
      "File hashed: " +
        hashHex.substring(0, 16) +
        "... (" +
        file.size +
        " bytes)",
    );
    return hashHex;
  }

  // ========================================================================
  // RECORD STRUCTURE
  // ========================================================================

  /**
   * Wrap an analysis result into a cache record with metadata.
   * @param {string} hash
   * @param {object} analysisResult
   * @returns {object} — cache record
   */
  function buildRecord(hash, analysisResult) {
    var now = Date.now();
    return {
      hash: hash,
      analysis: analysisResult,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      profile: analysisResult.profile || null,
      schemaVersion: analysisResult.schemaVersion || null,
      slotVersions: buildSlotVersions(analysisResult),
      userEdits: null,
      generations: [],
    };
  }

  /**
   * Build a version map for each analysis slot.
   * Used by shouldReuseSlot() to detect stale data.
   * @param {object} analysis
   * @returns {object}
   */
  function buildSlotVersions(analysis) {
    var versions = {};
    var slots = [
      "ocr",
      "colour",
      "classification",
      "edges",
      "objects",
      "faces",
      "depth",
    ];
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (
        analysis[slot] &&
        (analysis[slot].status === "complete" ||
          analysis[slot].status === "success")
      ) {
        versions[slot] = {
          version: analysis.schemaVersion || 1,
          profile: analysis.profile || "default",
          completedAt:
            analysis[slot].completedAt || analysis.completedAt || Date.now(),
        };
      }
    }
    return versions;
  }

  // ========================================================================
  // CORE CRUD
  // ========================================================================

  /**
   * Save an analysis result to the cache.
   * @param {string} hash — SHA-256 hex string
   * @param {object} record — analysis result (or full cache record)
   * @returns {Promise<void>}
   */
  async function save(hash, record) {
    if (!hash || typeof hash !== "string") {
      throw new Error("save() requires a hash string");
    }

    // If the caller passed a raw analysis result, wrap it
    var cacheRecord;
    if (record && record.hash === hash && record.analysis) {
      // Already a cache record — preserve existing lastAccessedAt if set
      cacheRecord = record;
      if (!cacheRecord.lastAccessedAt) {
        cacheRecord.lastAccessedAt = Date.now();
      }
    } else {
      cacheRecord = buildRecord(hash, record);
    }

    await withStore("readwrite", function (store) {
      return store.put(cacheRecord);
    });

    logDebug("Saved cache record: " + hash.substring(0, 16) + "...");
  }

  /**
   * Load a cached analysis by hash.
   * Updates lastAccessedAt on hit.
   * @param {string} hash
   * @returns {Promise<object|null>} — the cache record, or null if not found
   */
  async function load(hash) {
    if (!hash || typeof hash !== "string") {
      return null;
    }

    var record = await withStore("readonly", function (store) {
      return store.get(hash);
    });

    if (!record) {
      logDebug("Cache miss: " + hash.substring(0, 16) + "...");
      return null;
    }

    // Update lastAccessedAt (fire-and-forget)
    record.lastAccessedAt = Date.now();
    withStore("readwrite", function (store) {
      return store.put(record);
    }).catch(function (err) {
      logWarn("Failed to update lastAccessedAt:", err);
    });

    logDebug("Cache hit: " + hash.substring(0, 16) + "...");
    return record;
  }

  /**
   * Update a single analysis slot within a cached record.
   * @param {string} hash
   * @param {string} slotName — e.g. 'ocr', 'colour', 'classification'
   * @param {object} data — the slot data
   * @returns {Promise<void>}
   */
  async function updateSlot(hash, slotName, data) {
    var record = await withStore("readonly", function (store) {
      return store.get(hash);
    });

    if (!record) {
      logWarn("updateSlot: record not found for hash " + hash.substring(0, 16));
      return;
    }

    record.analysis[slotName] = data;
    record.lastAccessedAt = Date.now();

    // Update slot version
    if (data && data.status === "complete") {
      if (!record.slotVersions) record.slotVersions = {};
      record.slotVersions[slotName] = {
        version: record.analysis.schemaVersion || 1,
        profile: record.analysis.profile || "default",
        completedAt: Date.now(),
      };
    }

    await withStore("readwrite", function (store) {
      return store.put(record);
    });

    logDebug(
      'Updated slot "' + slotName + '" for ' + hash.substring(0, 16) + "...",
    );
  }

  /**
   * Save user edits (overlay corrections) for a cached record.
   * @param {string} hash
   * @param {object} edits — user edit data from overlay review mode
   * @returns {Promise<void>}
   */
  async function saveUserEdits(hash, edits) {
    var record = await withStore("readonly", function (store) {
      return store.get(hash);
    });

    if (!record) {
      logWarn(
        "saveUserEdits: record not found for hash " + hash.substring(0, 16),
      );
      return;
    }

    record.userEdits = edits;
    record.lastAccessedAt = Date.now();

    await withStore("readwrite", function (store) {
      return store.put(record);
    });

    logDebug("Saved user edits for " + hash.substring(0, 16) + "...");
  }

  /**
   * Save a generation result for a cached record.
   * Appends to the generations array (keeps history).
   * @param {string} hash
   * @param {object} generation — { prompt, response, model, cost, timestamp }
   * @returns {Promise<void>}
   */
  async function saveGeneration(hash, generation) {
    var record = await withStore("readonly", function (store) {
      return store.get(hash);
    });

    if (!record) {
      logWarn(
        "saveGeneration: record not found for hash " + hash.substring(0, 16),
      );
      return;
    }

    if (!Array.isArray(record.generations)) {
      record.generations = [];
    }

    generation.timestamp = generation.timestamp || Date.now();
    record.generations.push(generation);
    record.lastAccessedAt = Date.now();

    await withStore("readwrite", function (store) {
      return store.put(record);
    });

    logDebug(
      "Saved generation #" +
        record.generations.length +
        " for " +
        hash.substring(0, 16) +
        "...",
    );
  }

  /**
   * Delete a cached record by hash.
   * @param {string} hash
   * @returns {Promise<void>}
   */
  async function deleteRecord(hash) {
    await withStore("readwrite", function (store) {
      return store.delete(hash);
    });

    logDebug("Deleted cache record: " + hash.substring(0, 16) + "...");
  }

  // ========================================================================
  // LISTING & STATISTICS
  // ========================================================================

  /**
   * List all cached records (summaries only — no full analysis data).
   * @returns {Promise<Array<{ hash, profile, createdAt, lastAccessedAt, sizeEstimate }>>}
   */
  async function list() {
    var records = await withStore("readonly", function (store) {
      return store.getAll();
    });

    return records.map(function (r) {
      return {
        hash: r.hash,
        profile: r.profile,
        createdAt: r.createdAt,
        lastAccessedAt: r.lastAccessedAt,
        sizeEstimate: estimateRecordSize(r),
      };
    });
  }

  /**
   * Get cache statistics.
   * @returns {Promise<{ count: number, totalBytes: number }>}
   */
  async function getStats() {
    var records = await withStore("readonly", function (store) {
      return store.getAll();
    });

    var totalBytes = 0;
    for (var i = 0; i < records.length; i++) {
      totalBytes += estimateRecordSize(records[i]);
    }

    return {
      count: records.length,
      totalBytes: totalBytes,
    };
  }

  /**
   * Estimate the byte size of a cache record via JSON serialisation.
   * @param {object} record
   * @returns {number}
   */
  function estimateRecordSize(record) {
    try {
      return new Blob([JSON.stringify(record)]).size;
    } catch (err) {
      // Fallback: rough estimate from JSON string length
      try {
        return JSON.stringify(record).length * 2;
      } catch (e) {
        return 0;
      }
    }
  }

  // ========================================================================
  // EVICTION
  // ========================================================================

  /**
   * Evict oldest-accessed records until at least targetBytes have been freed.
   * @param {number} targetBytes — minimum bytes to free
   * @returns {Promise<number>} — number of records removed
   */
  async function evictOldest(targetBytes) {
    if (!targetBytes || targetBytes <= 0) return 0;

    var records = await withStore("readonly", function (store) {
      return store.getAll();
    });

    if (records.length === 0) return 0;

    // Sort by lastAccessedAt ascending (oldest first)
    records.sort(function (a, b) {
      return (a.lastAccessedAt || 0) - (b.lastAccessedAt || 0);
    });

    var freedBytes = 0;
    var removedCount = 0;
    var hashesToRemove = [];

    for (var i = 0; i < records.length; i++) {
      if (freedBytes >= targetBytes) break;
      var size = estimateRecordSize(records[i]);
      hashesToRemove.push(records[i].hash);
      freedBytes += size;
      removedCount++;
    }

    if (hashesToRemove.length > 0) {
      await withStore("readwrite", function (store) {
        for (var j = 0; j < hashesToRemove.length; j++) {
          store.delete(hashesToRemove[j]);
        }
      });
    }

    logInfo(
      "Evicted " + removedCount + " record(s), freed ~" + freedBytes + " bytes",
    );
    return removedCount;
  }

  // ========================================================================
  // SLOT REUSE CHECK
  // ========================================================================

  /**
   * Check whether a cached slot can be reused for the current analysis.
   * Returns false if the slot was produced by a different schema version
   * or a different analysis profile.
   *
   * @param {object} slot — slotVersions entry, e.g. { version, profile, completedAt }
   * @param {number} version — current schema version
   * @param {string} profile — current analysis profile name
   * @returns {boolean}
   */
  function shouldReuseSlot(slot, version, profile) {
    if (!slot) return false;
    if (slot.version !== version) return false;
    if (slot.profile !== profile) return false;
    return true;
  }

  // ========================================================================
  // STRIP FOR CACHE (Phase 11C)
  // ========================================================================

  /**
   * Deep-clone an analysis result and strip rawDepthMap.data for caching.
   * The Float32Array can be ~800KB per image — too large for IndexedDB.
   * Zones, depthRange, hasSignificantDepth, and invertDepth are preserved
   * (they feed the prompt and legend). Width/height kept for reference.
   *
   * @param {object} analysis — the analysis result from the analyser
   * @returns {object} — a deep clone with rawDepthMap.data set to null
   */
  function stripForCache(analysis) {
    if (!analysis) return analysis;

    // Deep clone via structured clone (handles most types except functions)
    var stripped;
    try {
      stripped = JSON.parse(JSON.stringify(analysis));
    } catch (err) {
      logWarn("stripForCache: JSON clone failed, returning original:", err);
      return analysis;
    }

    // Null out the large Float32Array data (not serialised by JSON anyway,
    // but we set it explicitly to null so the intent is clear on recall)
    if (
      stripped.depth &&
      stripped.depth.rawDepthMap &&
      stripped.depth.rawDepthMap.data !== undefined
    ) {
      stripped.depth.rawDepthMap.data = null;
      logDebug(
        "stripForCache: rawDepthMap.data stripped (width: " +
          (stripped.depth.rawDepthMap.width || "?") +
          ", height: " +
          (stripped.depth.rawDepthMap.height || "?") +
          ")",
      );
    }

    return stripped;
  }

  // ========================================================================
  // INCREMENT ACCESS COUNT (Phase 11C)
  // ========================================================================

  /**
   * Increment the accessCount and update lastAccessedAt on a cached record.
   * Fire-and-forget — errors are logged but not thrown.
   *
   * @param {string} hash — SHA-256 hex string
   * @returns {Promise<void>}
   */
  async function incrementAccessCount(hash) {
    if (!hash || typeof hash !== "string") return;

    try {
      var record = await withStore("readonly", function (store) {
        return store.get(hash);
      });

      if (!record) {
        logDebug(
          "incrementAccessCount: no record for " + hash.substring(0, 16),
        );
        return;
      }

      record.accessCount = (record.accessCount || 0) + 1;
      record.lastAccessedAt = Date.now();

      await withStore("readwrite", function (store) {
        return store.put(record);
      });

      logDebug(
        "Access count incremented to " +
          record.accessCount +
          " for " +
          hash.substring(0, 16) +
          "...",
      );
    } catch (err) {
      logWarn("incrementAccessCount failed:", err.message);
    }
  }

  // ========================================================================
  // CLEAR ALL
  // ========================================================================

  /**
   * Remove all cached records.
   * @returns {Promise<void>}
   */
  async function clear() {
    await withStore("readwrite", function (store) {
      store.clear();
    });

    logInfo("All cache records cleared");
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  logInfo(
    "ImageDescriberCache loaded (IndexedDB persistence for analysis results)",
  );

  return {
    hashFile: hashFile,
    save: save,
    load: load,
    updateSlot: updateSlot,
    saveUserEdits: saveUserEdits,
    saveGeneration: saveGeneration,
    delete: deleteRecord,
    list: list,
    getStats: getStats,
    evictOldest: evictOldest,
    shouldReuseSlot: shouldReuseSlot,
    stripForCache: stripForCache,
    incrementAccessCount: incrementAccessCount,
    buildSlotVersions: buildSlotVersions,
    clear: clear,
  };
})();
