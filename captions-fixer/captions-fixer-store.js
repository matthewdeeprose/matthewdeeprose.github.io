/**
 * CAPTIONS FIXER — THE STORE (Stage 5).
 *
 * Everything this tool has paid for, on disk the instant it arrives. One
 * IndexedDB database, one object store, keyed by the SHA-256 of the uploaded
 * caption file, so re-uploading the same file finds the same record and a
 * one-byte change does not.
 *
 * The record:
 *   { sha256, sourceName, meta, cueList, changeSet, pairs, pairsRaw, usageRaw,
 *     pairsRaw2, pairs2, agreement, passRaw, passEntries, glossary, model,
 *     savedAt }
 *
 * THIS LINE HAD DRIFTED, AND IT IS CORRECTED HERE RATHER THAN EXTENDED. Stage 6
 * added `pairsRaw` to RECORD_FIELDS and Stage 7b added `usageRaw`, and neither
 * reached this prose — so it listed nine of eleven fields until Stage 15 came to
 * add three more. RECORD_FIELDS below is the list `persist` actually enforces;
 * this is prose about it, and a reader checking "does the record carry X" reads
 * whichever they meet first. The two are put back in step here.
 *
 * Stage 11 added `passRaw` and `passEntries` for the cue-level pass and updated
 * this list IN THE SAME EDIT, which is the whole point of the paragraph above:
 * a widening that does not reach this prose puts the two back out of step and
 * nothing about either half looks wrong on its own. Its iteration 7a then added
 * `discoverySettledAt`, in the same edit again. SEVENTEEN fields now, and the
 * store section reads the count off RECORD_FIELDS rather than off this line.
 *
 * `persist(sha256, patch)` is the one every stage calls before it parses,
 * scores or validates. It is a read-modify-write of the NAMED FIELDS ONLY, in
 * one transaction: a field the patch does not mention keeps whatever the stored
 * record already holds. That is the difference between this and `save`, which
 * replaces the record wholesale.
 *
 * WHAT WAS COPIED FROM image-describer/image-describer-cache.js, AND WHAT WAS NOT
 * ------------------------------------------------------------------------------
 * COPIED: the cached-connection open (`getDB`, returning the live handle on
 * every later call), the `onupgradeneeded` guard that creates the object store
 * only when `objectStoreNames` lacks it, the `onclose` handler that drops the
 * cached handle when the browser closes the connection under us, the
 * `withStore(mode, callback)` wrapper that resolves on the request when the
 * callback returned one and on transaction completion when it did not, and the
 * `crypto.subtle.digest` hex hashing.
 *
 * NOT COPIED, each for a reason:
 * - `open()` here RETURNS FALSE rather than rejecting when IndexedDB is
 *   missing. A caller asking "can I persist?" should get an answer, not an
 *   exception; the operations still reject, with a named reason, so a caller
 *   that ignored the answer is not silently fed nothing.
 * - The database NAME is a parameter (`open({ name })`), because the suite must
 *   run against its own database and delete it afterwards. The cache hard-codes
 *   one name and cannot be tested without touching the user's data.
 * - `close()` exists, because the suite has to release the handle before
 *   `deleteDatabase` will complete rather than block.
 * - No eviction, no `lastAccessedAt` index, no access counting. Nothing has
 *   asked for them and an index is a schema commitment.
 * - No preserve-on-save merge. That rule exists in the cache because
 *   `buildRecord` there destroyed OCR curation; here `save` is documented as a
 *   wholesale replace and `persist` is the surgical route, so there is no
 *   second shape to reconcile.
 *
 * Pure data. No DOM, no voice, no announcement, no live region.
 *
 * A PLAIN script publishing window.CaptionsFixerStore. It touches nothing at
 * load: `open()` is the first thing that reaches IndexedDB.
 */
const CaptionsFixerStore = (function () {
  "use strict";

  // --- house-style logging ---------------------------------------------------
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[CaptionsFixerStore]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[CaptionsFixerStore]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[CaptionsFixerStore]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[CaptionsFixerStore]", message, ...args);
  }

  // --- constants -------------------------------------------------------------
  const DB_NAME = "captions-fixer";
  const DB_VERSION = 1;
  const STORE_NAME = "files";
  const KEY_PATH = "sha256";
  const DIGEST_ALGORITHM = "SHA-256";
  /** A SHA-256 hex digest, lower case. Every key is checked against it. */
  const SHA256_PATTERN = /^[0-9a-f]{64}$/;
  const HEX_RADIX = 16;
  const HEX_DIGITS_PER_BYTE = 2;

  /**
   * Every field the record carries, in the order the masterplan states them.
   * `persist` refuses a patch naming anything outside this list, so a typo is
   * a rejection rather than a field nobody ever reads again.
   */
  const RECORD_FIELDS = Object.freeze([
    "sha256",
    "sourceName",
    "meta",
    "cueList",
    "changeSet",
    "pairs",
    // Stage 6. The discovery reply EXACTLY as it arrived, written before
    // anything parses it, so a reply nobody can parse is still on disk to look
    // at rather than being the one thing a paid-for send did not leave behind.
    // It is a record field and never a change-set field. Adding it is a
    // one-line widening of this refusal list and NOT a schema change: an
    // IndexedDB record is schemaless, there is no index on it, and DB_VERSION
    // is deliberately unmoved — a bump would run the upgrade path and redden
    // the Stage 5 rows that prove it runs once and only once.
    "pairsRaw",
    // Stage 7b, and the same one-line widening for the same reason: the token
    // counts are PAID FOR, so they belong on disk beside the reply rather than
    // being recomputed by whoever wants them later. Written VERBATIM — cf-1
    // established that on the OpenRouter path what arrives is a character
    // estimate rather than a provider count, and a record that normalised it
    // would destroy the evidence for that. DB_VERSION is again unmoved, for the
    // reason set out on `pairsRaw` above.
    "usageRaw",
    // Stage 15, three names for one decision: the agreement filter runs
    // discovery TWICE per pass, and the second send must not cost the first its
    // evidence. `discover` persists `pairsRaw` before it reads a pair and
    // `pairs` after, so two plain calls would leave the second send's reply
    // sitting where the first send's was and the first would be gone — a paid
    // byte overwritten by another paid byte, which is the one outcome the
    // on-disk-the-instant-it-arrives rule exists to prevent. The second send
    // therefore runs with a RE-KEYED `persist` that writes these two instead,
    // and `discover` itself is unchanged. DB_VERSION is unmoved for the third
    // time, for the reason set out on `pairsRaw` above.
    "pairsRaw2",
    "pairs2",
    // The sort's own result, `{ both, one }` — TWO LISTS OF PAIRS, not two
    // numbers. `both` holds the pairs proposed by both replies, `one` the pairs
    // proposed by a single reply, each in the order `run` merges them.
    //
    // THE FIRST VERSION OF THIS COMMENT SAID COUNTS, AND IS QUOTED HERE RATHER
    // THAN REPLACED SILENTLY: "Counts, never text: the pairs themselves are
    // already on disk twice over in the four fields above." Both halves were
    // wrong. The four fields above hold each REPLY separately and none of them
    // holds the SORT's output, so re-deriving the split from them means running
    // `agree` again — which is the work this field exists to save. And a count
    // cannot be compared with a returned list pair by pair, which is exactly
    // what a suite row has to do against what `run` handed back.
    "agreement",
    // Stage 11, two names for one decision, and the same one-line widening for
    // the fourth and fifth time. The cue-level pass sends the corrected
    // captions CHUNK BY CHUNK — eleven sends on the 657-cue fixture, not the
    // two a discovery pass makes — so "written before it is parsed" has to hold
    // eleven times over rather than once. `passRaw` therefore holds the WHOLE
    // array so far, one record per chunk, rewritten after every reply, so that
    // each write is a strict superset of the one before it — which is what "the
    // second never overwrites the first" has to mean when the count is eleven.
    // A plain per-chunk write would leave chunk 11's reply sitting where chunk
    // 1's was and the other ten would be gone — ten paid-for replies discarded
    // by the eleventh, which is the one outcome the on-disk-the-instant-it-
    // arrives rule exists to prevent.
    //
    // THE SUPERSET IS THE STAGE'S GUARANTEE, NOT THIS FILE'S, AND THIS FILE
    // CANNOT CHECK IT. `persist` is a read-modify-write of the named fields: it
    // writes whatever array it is handed and would accept a shorter one, or an
    // unrelated one, without complaint. So the property belongs to the pass
    // stage, which builds each write from the one before it, and it is proved
    // in the pass section by the P rows in captions-fixer-tests-llm-pass.js:
    // the persist spy sees TWO writes per chunk — SIX for three chunks, record
    // count 1,1,2,2,3,3 — because decision 6 asks for both the raw bytes before
    // the parse AND the drop counts in the record, and the drop counts do not
    // exist until the parse has run. Each write is a prefix-superset of the one
    // before it, and each chunk's raw reaches disk before that chunk is parsed
    // and before the next chunk is sent. Said plainly here because a guarantee
    // described in the file that does not enforce it reads as a check somebody
    // has already done.
    "passRaw",
    // The pass's GUARDED entries, and they are a separate field rather than
    // more of `changeSet` because `changeSet` belongs to the recurring stage
    // and a pass run must leave it byte-identical. The orchestrator's
    // `settleStage` writes `changeSet` and knows nothing about passes, so the
    // caller hands the pass run a RE-KEYED `persist` — exactly the
    // SECOND_SEND_FIELD_MAP arrangement Stage 15 built for the second discovery
    // send, reused rather than re-invented. Entries arrive here as `proposed`
    // and `applyChangeSet` applies `accepted` only, so what is on disk is
    // inert until a person ticks it.
    "passEntries",
    // Stage 11, iteration 7a. WHEN THE DISCOVERY RUN SETTLED — an ISO string,
    // or null. It exists because nothing else on this record can answer that
    // question, which was measured at iteration 5b rather than assumed:
    //
    //   - `pairsRaw` and `usageRaw` are written before anything parses the
    //     reply, and again when parsing fails, so a FAILED run writes them.
    //   - `pairs` is written once reply one validates, so a cancel BETWEEN the
    //     two sends writes it.
    //   - `pairsRaw2`, `pairs2` and `agreement` are written by the second send
    //     and before the cancel check, so a cancel AFTER it writes all three.
    //   - `glossary` is written by the UI before the run starts.
    //   - `changeSet` is written by the orchestrator's `settleStage`, which is
    //     reached on any NORMAL stage return — and a cancel IS a normal return:
    //     `handleCancel` aborts the signal and settles the approval with `[]`,
    //     and the recurring stage returns `{ changeSet: [], halted:
    //     "cancelled" }` rather than throwing. So a cancelled run writes
    //     `changeSet: []`, which is also what a settled run over a clean
    //     transcript writes. The two are indistinguishable, and the clean
    //     transcript is the cue-level pass's BEST case.
    //
    // WHO WRITES IT: the UI, at the ONE point where `handleRun` settles —
    // after the cancelled and failed returns, beside `discoverySettled = true`.
    // NOT the orchestrator and NOT a stage, for the reason in the list above:
    // `settleStage` cannot tell a settle from a cancel, so a field written
    // there would carry the same defect the field exists to cure.
    //
    // DB_VERSION is unmoved, for the reason `pairsRaw` sets out: an IndexedDB
    // record is schemaless, there is no index on this name, and a bump would
    // run the upgrade path and redden the Stage 5 rows that prove it runs once.
    "discoverySettledAt",
    "glossary",
    "model",
    "savedAt",
  ]);

  /** The named reasons a rejection carries, so a caller can branch on one. */
  const ERRORS = Object.freeze({
    UNAVAILABLE: "indexeddb-unavailable",
    BAD_REQUEST: "bad-request",
    NOT_FOUND: "not-found",
    STORE: "store-error",
  });

  // --- state -------------------------------------------------------------
  /** @type {IDBDatabase|null} */
  let _db = null;
  /** The database name the open handle belongs to. */
  let _dbName = DB_NAME;
  /** Counts upgrade runs so the suite can assert a fresh open ran one and a second ran none. */
  let _upgradeCount = 0;

  /**
   * A rejection carrying a named reason from ERRORS.
   * @param {string} reason
   * @param {string} message
   * @returns {Error}
   */
  function storeError(reason, message) {
    const error = new Error(message);
    error.reason = reason;
    return error;
  }

  /** @returns {boolean} whether this browser exposes IndexedDB at all. */
  function isAvailable() {
    return typeof window !== "undefined" && !!window.indexedDB;
  }

  /**
   * Open the database, or hand back the connection already open.
   *
   * Idempotent: a second call on the same name resolves the cached handle and
   * never reaches `indexedDB.open`, so `onupgradeneeded` cannot run twice.
   * Naming a DIFFERENT database closes the current handle first — the suite
   * needs that, and leaving two handles open would leak one.
   *
   * @param {{ name?: string }} [options]
   * @returns {Promise<boolean>} true when a connection is open; false when
   *   IndexedDB is unavailable or the open failed. Never rejects.
   */
  function open({ name = DB_NAME } = {}) {
    if (!isAvailable()) {
      logWarn("IndexedDB is not available; nothing will be persisted");
      return Promise.resolve(false);
    }
    if (_db && _dbName === name) return Promise.resolve(true);
    if (_db && _dbName !== name) close();

    return new Promise(function (resolve) {
      let request;
      try {
        request = window.indexedDB.open(name, DB_VERSION);
      } catch (error) {
        logError("indexedDB.open threw:", error);
        resolve(false);
        return;
      }

      request.onerror = function () {
        logError("Failed to open the database:", request.error);
        resolve(false);
      };

      request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: KEY_PATH });
          logInfo(`Object store created: ${STORE_NAME}`);
        }
        _upgradeCount += 1;
      };

      request.onsuccess = function (event) {
        _db = event.target.result;
        _dbName = name;
        // The browser can close a connection under us — clearing storage, or a
        // version change from another tab. Drop the handle so the next call
        // opens a fresh one rather than using a dead one.
        _db.onclose = function () {
          logWarn("Database connection closed unexpectedly");
          _db = null;
        };
        logDebug(`Database connection established: ${name}`);
        resolve(true);
      };
    });
  }

  /** Release the connection. Safe to call when nothing is open. */
  function close() {
    if (!_db) return;
    _db.onclose = null;
    _db.close();
    _db = null;
    logDebug("Database connection closed");
  }

  /**
   * How many times `onupgradeneeded` has run since this page loaded. The
   * upgrade path is otherwise invisible: a fresh database and an existing one
   * both resolve to a working connection, so only this number distinguishes
   * them.
   * @returns {number}
   */
  function upgradeCount() {
    return _upgradeCount;
  }

  /**
   * Run one transaction against the object store.
   * @param {string} mode 'readonly' or 'readwrite'
   * @param {function(IDBObjectStore, IDBTransaction): (IDBRequest|undefined)} callback
   * @returns {Promise<*>} the request's result, or the callback's return value
   *   when it returned no request
   */
  function withStore(mode, callback) {
    if (!_db) {
      return Promise.reject(
        storeError(ERRORS.UNAVAILABLE, "The store is not open. Call open() first."),
      );
    }
    return new Promise(function (resolve, reject) {
      let transaction;
      try {
        transaction = _db.transaction(STORE_NAME, mode);
      } catch (error) {
        reject(storeError(ERRORS.STORE, `Could not begin a transaction: ${error.message}`));
        return;
      }
      let result;
      try {
        result = callback(transaction.objectStore(STORE_NAME), transaction);
      } catch (error) {
        reject(error);
        return;
      }

      if (result && typeof result.onsuccess !== "undefined") {
        // The callback returned one IDBRequest: resolve on its own result.
        result.onsuccess = function () {
          resolve(result.result);
        };
        result.onerror = function () {
          reject(storeError(ERRORS.STORE, String(result.error)));
        };
        return;
      }
      // The callback ran its own requests: the transaction completing is the
      // only signal that all of them landed.
      transaction.oncomplete = function () {
        resolve(result);
      };
      transaction.onerror = function () {
        reject(storeError(ERRORS.STORE, String(transaction.error)));
      };
      // AN ABORT FIRES `onabort`, NEVER `onerror`, so a wrapper without this
      // handler leaves the promise pending for ever on any aborted
      // transaction. Measured 7 September 2026: persist() aborting on a
      // missing key hung the whole suite, and a hang reports nothing at all
      // where a rejection would have named the cause in a row.
      transaction.onabort = function () {
        reject(storeError(ERRORS.STORE, `The transaction was aborted: ${String(transaction.error)}`));
      };
    });
  }

  /**
   * The SHA-256 of a string, as 64 lower-case hex characters.
   * @param {string} text
   * @returns {Promise<string>}
   */
  async function sha256(text) {
    if (typeof text !== "string") {
      throw storeError(ERRORS.BAD_REQUEST, "sha256() takes a string");
    }
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest(DIGEST_ALGORITHM, bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, "0"))
      .join("");
  }

  /**
   * Reject anything that is not a SHA-256 hex key. A caller bug, not a miss.
   * @param {*} key
   * @param {string} where
   */
  function assertKey(key, where) {
    if (typeof key !== "string" || !SHA256_PATTERN.test(key)) {
      throw storeError(
        ERRORS.BAD_REQUEST,
        `${where}() takes a 64-character lower-case SHA-256 hex string, saw ${JSON.stringify(key)}`,
      );
    }
  }

  /**
   * Write a record wholesale, stamping `savedAt`.
   *
   * REPLACES. Every field the incoming record does not carry is gone; that is
   * what `persist` exists to avoid.
   *
   * @param {object} record must carry a `sha256`
   * @returns {Promise<object>} the record as written
   */
  async function save(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw storeError(ERRORS.BAD_REQUEST, "save() takes a record object");
    }
    assertKey(record.sha256, "save");
    const toWrite = Object.assign({}, record, { savedAt: Date.now() });
    await withStore("readwrite", (store) => store.put(toWrite));
    logDebug(`Saved ${record.sha256.slice(0, 12)}…`);
    return toWrite;
  }

  /**
   * Read one record.
   * @param {string} key the SHA-256
   * @returns {Promise<object|null>} the record, or null when nothing is stored
   *   under that key
   */
  async function load(key) {
    assertKey(key, "load");
    const found = await withStore("readonly", (store) => store.get(key));
    return found === undefined ? null : found;
  }

  /**
   * Every record's summary, newest first.
   * @returns {Promise<Array<{ sha256: string, sourceName: string, savedAt: number, cueCount: number }>>}
   */
  async function list() {
    const all = await withStore("readonly", (store) => store.getAll());
    return all
      .map((record) => ({
        sha256: record.sha256,
        sourceName: record.sourceName || null,
        savedAt: record.savedAt || null,
        cueCount: Array.isArray(record.cueList) ? record.cueList.length : 0,
      }))
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }

  /**
   * Delete one record. Deleting a key that is not there is not an error —
   * IndexedDB says so and a caller tidying up should not have to check first.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async function remove(key) {
    assertKey(key, "remove");
    await withStore("readwrite", (store) => store.delete(key));
    logDebug(`Removed ${key.slice(0, 12)}…`);
  }

  /**
   * The merge `persist` performs: the stored record, with the patch's named
   * fields written over it.
   *
   * A NAMED SEAM RATHER THAN AN INLINE `Object.assign`, so the suite can invert
   * the merge alone. Replacing the whole of `persist` would take its argument
   * checking and its not-found refusal with it, and rows named for surgical
   * writing would then redden for reasons that have nothing to do with
   * surgery.
   *
   * @param {object} existing the record as stored
   * @param {object} patch the fields to write
   * @returns {object} a NEW object; neither argument is mutated
   */
  function mergeRecord(existing, patch) {
    return Object.assign({}, existing, patch);
  }

  /**
   * Read-modify-write of the NAMED FIELDS ONLY, in ONE transaction.
   *
   * This is what a stage calls the instant it has anything paid for. Two
   * properties it must have, and both are asserted by the suite: a field the
   * patch does not name is byte-identical afterwards, and calling it twice with
   * the same patch leaves the same record (only `savedAt` moves).
   *
   * The get and the put share one transaction deliberately. Two transactions
   * would let a second `persist` interleave between them and be overwritten.
   *
   * @param {string} key the SHA-256
   * @param {object} patch fields to write; every name must be in RECORD_FIELDS
   * @returns {Promise<object>} the record as it now stands
   */
  async function persist(key, patch) {
    assertKey(key, "persist");
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw storeError(ERRORS.BAD_REQUEST, "persist() takes a patch object");
    }
    const names = Object.keys(patch);
    if (names.length === 0) {
      throw storeError(ERRORS.BAD_REQUEST, "persist() takes at least one field");
    }
    const unknown = names.filter((name) => RECORD_FIELDS.indexOf(name) === -1);
    if (unknown.length > 0) {
      throw storeError(
        ERRORS.BAD_REQUEST,
        `persist() will not write a field the record does not define: ${unknown.join(", ")}`,
      );
    }
    if (names.indexOf(KEY_PATH) !== -1 && patch[KEY_PATH] !== key) {
      throw storeError(ERRORS.BAD_REQUEST, "persist() cannot move a record to a different key");
    }

    // The get and the put share ONE transaction, so a second persist cannot
    // interleave between them and be overwritten. The miss is handled by
    // writing nothing and letting the transaction complete, rather than by
    // `transaction.abort()`: an abort fires `onabort` and not `onerror`, and
    // relying on it makes the not-found path depend on the wrapper handling a
    // second event. Nothing is put on a miss either way, so completing is
    // exactly as safe and settles by the ordinary route.
    let written = null;
    await withStore("readwrite", function (store) {
      const read = store.get(key);
      read.onsuccess = function () {
        const existing = read.result;
        // Never create: a patch is an update to something the caller believes
        // is already there, and inventing a half-record here would hide the
        // bug that produced the wrong key.
        if (existing === undefined) return;
        // Through the exported object, so the suite's seam is the same one the
        // product reads.
        written = Object.assign(CaptionsFixerStore.mergeRecord(existing, patch), { savedAt: Date.now() });
        store.put(written);
      };
    });
    if (written === null) {
      throw storeError(ERRORS.NOT_FOUND, `persist(): no record under ${key.slice(0, 12)}…`);
    }
    logDebug(`Persisted ${names.join(", ")} on ${key.slice(0, 12)}…`);
    return written;
  }

  return {
    open,
    close,
    save,
    load,
    list,
    remove,
    persist,
    mergeRecord,
    sha256,
    isAvailable,
    upgradeCount,
    DB_NAME,
    DB_VERSION,
    STORE_NAME,
    RECORD_FIELDS,
    ERRORS,
  };
})();

window.CaptionsFixerStore = CaptionsFixerStore;
