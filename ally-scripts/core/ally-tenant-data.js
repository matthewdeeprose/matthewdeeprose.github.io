/**
 * @fileoverview Ally Accessibility Reporting Tool - per-tenant course data
 * @module AllyTenantData
 * @requires ally-scripts/core/ally-config.js (STORAGE_KEYS, DATA_SOURCES, readLiveTenantIdentity)
 * @requires ally-scripts/core/ally-data-runtime.js (the three installers)
 * @requires ally-scripts/core/ally-csv-parser.js (the export parser)
 *
 * @description
 * Multi-tenancy Stage 4. A second institution picks their own Ally CSV export,
 * this file parses it in the browser, caches the compact payload in IndexedDB
 * keyed by tenant, and hands it to ALLY_DATA_RUNTIME. On later loads the
 * cached payload is installed without the file - and without fetching the
 * bundled University of Southampton data.
 *
 * RESOLUTION ORDER, decided once here and nowhere else:
 *
 *   1. a payload stored under the CURRENT tenant key, whatever the stored
 *      data-source setting says - it was uploaded or fetched by that tenant,
 *      for that tenant;
 *   1b. otherwise, if the stored data source is `remote` and a URL is stored
 *      (Stage 6), ONE automatic fetch of that URL, which stores a record under
 *      the tenant key and installs it - so the next visit is step 1;
 *   2. otherwise, if the stored data source is `bundled` (the default and the
 *      Southampton path), the bundled files exactly as before this stage;
 *   3. otherwise NOTHING. A tenant configured for `upload` or `remote` who has
 *      no payload under their key gets no course data, an EMPTY lookup so ids
 *      render raw rather than as another institution's names, and a search
 *      that says so.
 *
 * Step 3 is deliberate and is the point of the stage's hazard section: the
 * bundled data is one university's, and it must never be shown to another
 * as if it were their own.
 *
 * THE TENANT KEY IS `<clientId>@<region>` - the same shape ally-cache.js
 * builds its scope token from - and it is read the same way: the LIVE API
 * client first, stored credentials only as a fallback, and the pair
 * atomically. Reasoning in multi-tenancy-stage-3-dispatch.md § "Two
 * constraints that will bite": a key resolved from storage alone reproduces
 * the cross-institution cache leak Stage 1 closed, and it fails silently.
 * The optional tenant id is a display label a person can edit; the client id
 * and region are what queries actually go out under, so they key the data.
 * DEFAULT_CLIENT_ID is never consulted here, for the same reason
 * getTenantRecord() avoids getEffectiveClientId().
 *
 * COURSES AND LOOKUP ARE ONE RECORD. getTermName returns the raw id for an
 * unknown term, and worse, Southampton's lookup against another institution's
 * courses renders a WRONG name wherever an id happens to collide. So both
 * payloads are stored together and installed together, or neither is.
 *
 * WHAT IS STORED IS THE COMPACT PAYLOAD, not the rehydrated map: 2.76 MB for
 * 53,207 courses, with the object map rebuilt at install in tens of
 * milliseconds. Measured figures for the real export are in the Stage 4
 * dispatch's as-built section.
 *
 * IT STAYS LAZY. Nothing here opens the database or reads a payload on a
 * plain tools.html load; resolveCourseData() runs when Ally Reporting is
 * selected, exactly where the bundled file used to be fetched.
 *
 * Every dependency is read INSIDE the function that needs it, never captured
 * at module scope: ally-api-client.js and ally-data-runtime.js are separate
 * <script> tags and a module-scope capture could be permanently undefined.
 */

const ALLY_TENANT_DATA = (function () {
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[AllyTenantData] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[AllyTenantData] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[AllyTenantData] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[AllyTenantData] " + message, ...args);
  }

  // ========================================================================
  // Constants
  // ========================================================================

  const DB_NAME = "AllyTenantData";
  const DB_VERSION = 1;
  const STORE_NAME = "payloads";
  const KEY_PATH = "tenantKey";

  /** Joins client id and region into the tenant key, as ally-cache.js does. */
  const SCOPE_JOIN = "@";

  /** Where the bundled (University of Southampton) payloads are served from. */
  const BUNDLED_URLS = Object.freeze({
    courses: "ally-scripts/core/ally-courses-data.js",
    lookup: "ally-scripts/core/ally-lookup-data.js",
  });

  /**
   * The three files an upload must supply, matched by name. departments_years
   * and NOT departments_terms: the years file is a strict superset, measured
   * 4 September 2026 (.claude/ally-course-data/README.md).
   */
  const REQUIRED_FILES = Object.freeze({
    courses: "courses.csv",
    terms: "terms.csv",
    departments: "departments_years.csv",
  });

  /** What resolveCourseData() reports it installed. */
  const SOURCE = Object.freeze({
    UPLOAD: "upload",
    BUNDLED: "bundled",
    REMOTE: "remote",
    NONE: "none",
  });

  /**
   * The three aggregate files an upload may add for the Trends view
   * (multi-tenancy Stage 7). Read from the parser, which owns the list, so
   * the upload and the converter cannot disagree about which files complete
   * the set; the fallback only matters before the parser has loaded.
   */
  const TREND_ONLY_FILES_FALLBACK = Object.freeze({
    years: "years.csv",
    months: "months.csv",
    departmentTerms: "departments_terms.csv",
  });

  /** Where the bundled trends module and a hosted folder's copy are served from. */
  const BUNDLED_TRENDS_URL = "ally-scripts/core/ally-trends-data.js";
  const REMOTE_TRENDS_FILE = "ally-trends-data.js";

  /**
   * What describeTrends() tells the Trends view to do. Decided HERE, from
   * what was installed, never by the view from whether ALLY_TRENDS happens
   * to exist - the global can be a previous tenant's, and nothing else
   * uninstalls it.
   */
  const TRENDS = Object.freeze({
    /** Load a module lazily from `url` - the bundled file, or a hosted folder's. */
    SCRIPT: "script",
    /** A tenant's own history is installed from their stored record. */
    INSTALLED: "installed",
    /** Nothing to show; `reason` says why. */
    NONE: "none",
  });

  /** Why describeTrends() answered NONE. */
  const TRENDS_REASON = Object.freeze({
    NO_COURSE_DATA: "no-course-data",
    NO_TREND_FILES: "no-trend-files",
  });

  /** Fallback for ALLY_CONFIG.DATA_URL_FORMATS when the config is absent. */
  const FORMAT = Object.freeze({ JSON: "json", SCRIPT: "script" });

  /**
   * The two files the script route appends to its base URL: the converter's
   * own output names, loaded lookup-then-courses exactly as loadBundled does.
   */
  const REMOTE_SCRIPT_FILES = Object.freeze({
    lookup: "ally-lookup-data.js",
    courses: "ally-courses-data.js",
  });

  /** The refusal for a course-data URL that will not normalise. */
  const DATA_URL_REFUSAL =
    "The course data address must be a full https address, such as " +
    "https://your-institution.github.io/ally/ally-course-payload.json.";

  /**
   * The middle of every fetch-failure sentence. A CORS refusal and an
   * unreachable host are the same TypeError from the browser, and a 404 is
   * a wrong address as often as a missing file, so the sentence names all
   * three and asserts none - the honesty ally-api-client.js applies to the
   * worker. Exposed so a test asserts the sentence rather than a substring
   * a rewording could satisfy.
   */
  const FETCH_FAILURE_CAUSES =
    "The address may be wrong, the host may be unreachable, or it may not " +
    "allow this site to read it.";

  /** How many missing term ids an error message lists before "and N more". */
  const MISSING_TERMS_SHOWN = 5;

  /** Fallback region when neither the client nor storage names one. */
  const FALLBACK_REGION = "EU";

  // ========================================================================
  // State
  // ========================================================================

  /**
   * What the last resolution installed. `lookupIsTenant` records that the
   * lookup on the page is NOT the bundled one loaded by tools.html - either a
   * tenant's or the empty one - so a switch back to bundled knows to reload
   * ally-lookup-data.js as well as the courses.
   */
  const state = {
    resolved: false,
    tenantKey: null,
    source: null,
    lookupIsTenant: false,
    subscribed: false,
    /** Whether ALLY_TRENDS was installed from the current tenant's RECORD. */
    trendsInstalled: false,
    /** The script route's base URL while the page runs on it, else null. */
    remoteScriptBase: null,
  };

  // ========================================================================
  // Dependencies, read late
  // ========================================================================

  function config() {
    return typeof ALLY_CONFIG !== "undefined" ? ALLY_CONFIG : null;
  }

  function runtime() {
    return typeof ALLY_DATA_RUNTIME !== "undefined" ? ALLY_DATA_RUNTIME : null;
  }

  function parser() {
    return typeof ALLY_CSV_PARSER !== "undefined" ? ALLY_CSV_PARSER : null;
  }

  function coursesInstalled() {
    return typeof ALLY_COURSES !== "undefined";
  }

  function trendsInstalled() {
    return typeof ALLY_TRENDS !== "undefined";
  }

  function trendOnlyFiles() {
    const p = parser();
    return p && p.TREND_ONLY_INPUTS ? p.TREND_ONLY_INPUTS : TREND_ONLY_FILES_FALLBACK;
  }

  function readStoredTrimmed(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return typeof raw === "string" ? raw.trim() : "";
    } catch (e) {
      logWarn("Could not read " + key + ":", e.message);
      return "";
    }
  }

  // ========================================================================
  // Tenant identity
  // ========================================================================

  /**
   * Resolves who the data belongs to.
   *
   * Live credentials first, stored ones only when the client holds no client
   * id, and the pair together - see the file header. Returns null when there
   * is no client id at all: an upload cannot be keyed then, and a resolution
   * has nothing to look up.
   *
   * @returns {{clientId: string, region: string, tenantKey: string}|null}
   */
  function resolveTenantIdentity() {
    const cfg = config();
    if (!cfg) return null;

    const live =
      typeof cfg.readLiveTenantIdentity === "function"
        ? cfg.readLiveTenantIdentity()
        : null;

    const clientId = live
      ? live.clientId
      : readStoredTrimmed(cfg.STORAGE_KEYS.CLIENT_ID);
    if (!clientId) return null;

    const rawRegion = live ? live.region : readStoredTrimmed(cfg.STORAGE_KEYS.REGION);
    const region =
      typeof cfg.isValidRegion === "function" && cfg.isValidRegion(rawRegion)
        ? rawRegion
        : cfg.DEFAULT_REGION || FALLBACK_REGION;

    return {
      clientId: clientId,
      region: region,
      tenantKey: clientId + SCOPE_JOIN + region,
    };
  }

  /**
   * The stored data-source setting, validated against the enum.
   * @returns {string} One of ALLY_CONFIG.DATA_SOURCES; BUNDLED when unset
   */
  function readStoredDataSource() {
    const cfg = config();
    if (!cfg) return SOURCE.BUNDLED;

    const stored = readStoredTrimmed(cfg.STORAGE_KEYS.TENANT_DATA_SOURCE);
    return Object.values(cfg.DATA_SOURCES).includes(stored)
      ? stored
      : cfg.DATA_SOURCES.BUNDLED;
  }

  function writeStoredDataSource(value) {
    const cfg = config();
    if (!cfg) return;
    try {
      window.localStorage.setItem(cfg.STORAGE_KEYS.TENANT_DATA_SOURCE, value);
    } catch (e) {
      logWarn("Could not write the data source setting:", e.message);
    }
  }

  /**
   * What the page is actually running on, for anyone deciding whether the
   * bundled data may be shown - the Trends view above all.
   *
   * After a resolution this reports what was INSTALLED, so a tenant whose
   * stored setting still reads `bundled` but whose own payload was found is
   * reported as `upload`. Before any resolution it is the stored setting.
   *
   * @returns {string} One of ALLY_CONFIG.DATA_SOURCES
   */
  function getEffectiveDataSource() {
    const cfg = config();
    const sources = cfg ? cfg.DATA_SOURCES : { UPLOAD: "upload", BUNDLED: "bundled" };

    if (state.resolved) {
      if (state.source === SOURCE.UPLOAD) return sources.UPLOAD;
      if (state.source === SOURCE.BUNDLED) return sources.BUNDLED;
      if (state.source === SOURCE.REMOTE) return sources.REMOTE || SOURCE.REMOTE;
    }
    return readStoredDataSource();
  }

  /**
   * What the Trends view may show, and from where (multi-tenancy Stage 7).
   *
   * Three answers. Under the bundled source, or the script route, a module
   * to load lazily from `url`; under a tenant whose record carried trends,
   * the history already INSTALLED from that record; otherwise NONE with a
   * reason. The view asks this rather than testing `typeof ALLY_TRENDS`,
   * because that global can be a previous tenant's: before this stage
   * nothing uninstalled it, so a tenant's history could have been shown
   * under Southampton's label after a switch back to bundled.
   *
   * `institution` is the stored tenant display name, for the provenance
   * line; empty under bundled, where the view names Southampton itself.
   *
   * @returns {{mode: string, url?: string, reason?: string, bundled: boolean, institution: string}}
   */
  function describeTrends() {
    const cfg = config();
    const sources = cfg ? cfg.DATA_SOURCES : { BUNDLED: SOURCE.BUNDLED };
    const institution = cfg ? readStoredTrimmed(cfg.STORAGE_KEYS.TENANT_NAME) : "";

    if (getEffectiveDataSource() === sources.BUNDLED) {
      return { mode: TRENDS.SCRIPT, url: BUNDLED_TRENDS_URL, bundled: true, institution: "" };
    }

    if (state.trendsInstalled && trendsInstalled()) {
      return { mode: TRENDS.INSTALLED, bundled: false, institution: institution };
    }

    if (state.source === SOURCE.REMOTE && state.remoteScriptBase) {
      return {
        mode: TRENDS.SCRIPT,
        url: state.remoteScriptBase + "/" + REMOTE_TRENDS_FILE,
        bundled: false,
        institution: institution,
      };
    }

    return {
      mode: TRENDS.NONE,
      reason:
        state.resolved && state.source !== SOURCE.NONE
          ? TRENDS_REASON.NO_TREND_FILES
          : TRENDS_REASON.NO_COURSE_DATA,
      bundled: false,
      institution: institution,
    };
  }

  // ========================================================================
  // IndexedDB
  // ========================================================================

  /** @type {IDBDatabase|null} */
  let _db = null;

  /**
   * Opens (or creates) the database. Cached after the first call.
   * @returns {Promise<IDBDatabase>}
   */
  function getDB() {
    if (_db) return Promise.resolve(_db);

    return new Promise(function (resolve, reject) {
      let request;
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
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: KEY_PATH });
          logInfo("Object store created: " + STORE_NAME);
        }
      };

      request.onsuccess = function (event) {
        _db = event.target.result;

        // The browser can close a connection under us (storage cleared, a
        // versionchange from another tab). Drop the cache so the next call
        // reopens rather than failing on a dead handle.
        _db.onclose = function () {
          logWarn("Database connection closed unexpectedly");
          _db = null;
        };
        _db.onversionchange = function () {
          closeDatabase();
        };

        resolve(_db);
      };
    });
  }

  /**
   * Whether the database exists at all, WITHOUT creating it. indexedDB.open()
   * creates on first call, so a status line that merely wanted to look would
   * otherwise leave an empty database in every profile that opened the Set
   * Up card. Where the browser lacks indexedDB.databases() this reports true
   * and the caller falls through to a real open.
   * @returns {Promise<boolean>}
   */
  function databaseExists() {
    if (_db) return Promise.resolve(true);
    if (typeof indexedDB === "undefined") return Promise.resolve(false);
    if (typeof indexedDB.databases !== "function") return Promise.resolve(true);

    return indexedDB.databases().then(
      function (list) {
        return list.some(function (entry) {
          return entry && entry.name === DB_NAME;
        });
      },
      function () {
        return true;
      },
    );
  }

  /**
   * Closes the cached connection. deleteDatabase() needs this, and so does a
   * test that wants to prove the database is gone.
   */
  function closeDatabase() {
    if (!_db) return;
    try {
      _db.close();
    } catch (e) {
      logWarn("Closing the database threw:", e.message);
    }
    _db = null;
  }

  /**
   * Runs one request inside a transaction on the payload store.
   * @param {string} mode - "readonly" or "readwrite"
   * @param {function(IDBObjectStore): IDBRequest} callback
   * @returns {Promise<*>} The request result
   */
  function withStore(mode, callback) {
    return getDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        let tx;
        try {
          tx = db.transaction(STORE_NAME, mode);
        } catch (err) {
          reject(err);
          return;
        }

        let request;
        try {
          request = callback(tx.objectStore(STORE_NAME));
        } catch (err) {
          reject(err);
          return;
        }

        request.onsuccess = function () {
          resolve(request.result);
        };
        request.onerror = function () {
          reject(request.error);
        };
        tx.onabort = function () {
          reject(tx.error || new Error("transaction aborted"));
        };
      });
    });
  }

  /**
   * Reads the record stored under a tenant key.
   * @param {string} tenantKey
   * @returns {Promise<Object|null>}
   */
  function getStored(tenantKey) {
    return withStore("readonly", function (store) {
      return store.get(tenantKey);
    }).then(function (record) {
      return record || null;
    });
  }

  /**
   * Writes a record. The key is the record's own tenantKey.
   * @param {Object} record
   * @returns {Promise<string>} The key written
   */
  function putStored(record) {
    if (!record || typeof record[KEY_PATH] !== "string" || !record[KEY_PATH]) {
      return Promise.reject(new Error("A stored record needs a tenantKey"));
    }
    return withStore("readwrite", function (store) {
      return store.put(record);
    });
  }

  function removeStored(tenantKey) {
    return withStore("readwrite", function (store) {
      return store.delete(tenantKey);
    });
  }

  /**
   * Every tenant key with a stored payload.
   * @returns {Promise<Array<string>>}
   */
  function listStoredKeys() {
    return withStore("readonly", function (store) {
      return store.getAllKeys();
    });
  }

  /**
   * Deletes the whole database. For tests and for a deliberate tidy-up; the
   * UI removes one tenant's record at a time with removeForCurrentTenant().
   * @returns {Promise<boolean>}
   */
  function deleteDatabase() {
    closeDatabase();
    return new Promise(function (resolve, reject) {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = function () {
        resolve(true);
      };
      request.onerror = function () {
        reject(request.error);
      };
      request.onblocked = function () {
        logWarn("deleteDatabase is blocked by another open connection");
      };
    });
  }

  // ========================================================================
  // Install and uninstall
  // ========================================================================

  /**
   * Installs a stored record: lookup first, then courses, then trends when
   * the record carries them. Both or neither for the first two - a lookup
   * that fails to install leaves the courses uninstalled too. A record
   * WITHOUT trends uninstalls ALLY_TRENDS, so a previous tenant's history
   * (or the bundled file's) can never be shown as this tenant's.
   * @param {Object} record - A record from getStored() or buildRecord()
   * @returns {boolean} Whether every install is visible under its bare name
   */
  function installRecord(record) {
    const rt = runtime();
    if (!rt) {
      logError("ALLY_DATA_RUNTIME is not loaded; cannot install a payload");
      return false;
    }
    if (!record || !record.courses || !record.lookup) {
      logError("Stored record is incomplete and was not installed");
      return false;
    }

    const lookupOk = rt.installLookup(record.lookup);
    if (!lookupOk) return false;
    state.lookupIsTenant = true;
    state.remoteScriptBase = null;

    const coursesOk = rt.installCourses(record.courses);
    if (!coursesOk) {
      uninstallTrends();
      return false;
    }

    if (!record.trends) {
      uninstallTrends();
      return true;
    }

    state.trendsInstalled = rt.installTrends(record.trends);
    if (!state.trendsInstalled) {
      logError("The record's trends could not be installed; the Trends view will say so");
      uninstallTrends();
      return false;
    }
    return true;
  }

  /**
   * Installs a lookup that knows no terms and no departments, so every id
   * renders as itself - obviously raw, never another institution's name.
   */
  function installEmptyLookup() {
    const rt = runtime();
    if (!rt) return false;
    state.lookupIsTenant = true;
    return rt.installLookup({ terms: {}, departments: {} });
  }

  /**
   * Removes the courses global so every `typeof ALLY_COURSES === "undefined"`
   * guard reads "no data". The runtime publishes it as a plain window
   * property, which is deletable; the fallback assignment leaves typeof
   * reading "undefined" just the same.
   */
  function uninstallCourses() {
    if (typeof window === "undefined" || !coursesInstalled()) return;
    try {
      delete window.ALLY_COURSES;
    } catch (e) {
      window.ALLY_COURSES = undefined;
    }
    logInfo("ALLY_COURSES uninstalled");
  }

  /**
   * Removes the trends global, and the record that it was a tenant's. The
   * runtime publishes ALLY_TRENDS as a plain window property, exactly as it
   * does ALLY_COURSES, so the same delete works. Called on every resolution
   * path that does not install trends - a stored record without them, the
   * bundled path when the page was on a tenant, the script route, and the
   * nothing path - so the Trends view never renders a leftover.
   */
  function uninstallTrends() {
    state.trendsInstalled = false;
    if (typeof window === "undefined" || !trendsInstalled()) return;
    try {
      delete window.ALLY_TRENDS;
    } catch (e) {
      window.ALLY_TRENDS = undefined;
    }
    logInfo("ALLY_TRENDS uninstalled");
  }

  /**
   * Injects a classic script and resolves when it has run.
   * @param {string} url
   * @returns {Promise<boolean>}
   */
  function loadScript(url) {
    return new Promise(function (resolve) {
      const script = document.createElement("script");
      script.src = url;
      script.onload = function () {
        resolve(true);
      };
      script.onerror = function () {
        logError("failed to load " + url);
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Loads the bundled payload(s). The lookup is reloaded only when the one on
   * the page is not the bundled one - tools.html loads ally-lookup-data.js
   * at start-up, so on the plain Southampton path only the courses are
   * fetched here, exactly as before this stage.
   * @param {Object} options - { includeLookup: boolean }
   * @returns {Promise<boolean>} Whether the courses are installed afterwards
   */
  async function loadBundled(options) {
    if (options && options.includeLookup) {
      const lookupOk = await loadScript(BUNDLED_URLS.lookup);
      if (!lookupOk) return false;
      state.lookupIsTenant = false;
    }
    await loadScript(BUNDLED_URLS.courses);
    return coursesInstalled();
  }

  // ========================================================================
  // Resolution
  // ========================================================================

  function summary(source, extra) {
    const out = {
      source: source,
      tenantKey: state.tenantKey,
      courseCount: coursesInstalled() ? Object.keys(ALLY_COURSES.courses).length : 0,
      trends: state.trendsInstalled,
    };
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }

  /**
   * Re-resolves when the tenant changes under us. The Set Up page and the
   * Ally credential form both emit this on the embed emitter (NOT on window -
   * a window CustomEvent reaches nothing here). A same-tenant save is a
   * no-op because resolveCourseData() short-circuits on an unchanged key.
   */
  function subscribeToCredentialChanges() {
    if (state.subscribed) return;
    if (!window.EmbedEventEmitter || typeof window.EmbedEventEmitter.on !== "function") return;

    window.EmbedEventEmitter.on("credentials:changed", function (data) {
      if (!data || data.service !== "ally" || !state.resolved) return;
      resolveCourseData().catch(function (error) {
        logWarn("re-resolution after a credential change failed:", error.message);
      });
    });
    state.subscribed = true;
  }

  /**
   * Resolves and installs course data for the current tenant. Safe to call on
   * every switch into Ally Reporting: it does nothing when the tenant key is
   * unchanged and data is already installed.
   *
   * @param {Object} [options] - { force: true } to re-resolve regardless
   * @returns {Promise<{source: string, tenantKey: string|null, courseCount: number, reason?: string}>}
   */
  async function resolveCourseData(options) {
    const force = !!(options && options.force);
    subscribeToCredentialChanges();

    const identity = resolveTenantIdentity();
    const tenantKey = identity ? identity.tenantKey : null;

    if (
      !force &&
      state.resolved &&
      state.tenantKey === tenantKey &&
      state.source !== SOURCE.NONE &&
      coursesInstalled()
    ) {
      return summary(state.source, { unchanged: true });
    }

    // 1. A payload stored under this tenant's key. The existence check keeps
    //    the Southampton path from creating an empty database on every visit.
    let record = null;
    if (tenantKey) {
      try {
        if (await databaseExists()) record = await getStored(tenantKey);
      } catch (error) {
        logWarn("could not read IndexedDB for " + tenantKey + ":", error.message);
      }
    }

    if (record) {
      const installed = installRecord(record);
      const fromUrl = record.source === SOURCE.REMOTE;
      state.resolved = true;
      state.tenantKey = tenantKey;
      state.source = installed
        ? fromUrl ? SOURCE.REMOTE : SOURCE.UPLOAD
        : SOURCE.NONE;
      logInfo("installed " + (fromUrl ? "fetched" : "uploaded") + " payload for " + tenantKey);
      return summary(state.source, {
        storedAt: record.storedAt,
        sourceUrl: fromUrl ? record.sourceUrl : undefined,
        reason: installed ? undefined : "stored payload could not be installed",
      });
    }

    const storedSource = readStoredDataSource();
    const cfg = config();

    // 1b. The ONE automatic fetch (Stage 6): the setting is remote, a URL is
    //     stored, and nothing is stored for this tenant. It stores a record,
    //     so the next visit is step 1 and costs no download. A failure falls
    //     through to step 3 carrying the reason - never to the bundled files.
    const remoteSetting = cfg ? cfg.DATA_SOURCES.REMOTE : SOURCE.REMOTE;
    let remoteFailure = "";
    if (tenantKey && storedSource === remoteSetting) {
      if (readStoredDataUrl()) {
        try {
          const fetched = await fetchRemote();
          return summary(SOURCE.REMOTE, {
            storedAt: fetched.storedAt,
            sourceUrl: fetched.url,
            fetched: true,
          });
        } catch (error) {
          remoteFailure = error.message;
          logWarn("automatic fetch failed for " + tenantKey + ": " + remoteFailure);
        }
      } else {
        remoteFailure = "no course data URL is stored";
      }
    }

    // 2. The bundled files, on the bundled setting only.
    const bundledSetting = cfg ? cfg.DATA_SOURCES.BUNDLED : SOURCE.BUNDLED;

    if (storedSource === bundledSetting) {
      const replacing = state.lookupIsTenant;
      // Whatever ALLY_TRENDS holds after a tenant is that tenant's, or a
      // hosted folder's: remove it, so the Trends view fetches the bundled
      // module lazily rather than showing a leftover under Southampton's
      // name. On the plain Southampton path nothing is touched, so a module
      // the view already loaded is not fetched twice.
      if (replacing) uninstallTrends();
      state.remoteScriptBase = null;

      let ok = coursesInstalled() && !replacing;
      if (!ok) ok = await loadBundled({ includeLookup: replacing });

      state.resolved = true;
      state.tenantKey = tenantKey;
      state.source = ok ? SOURCE.BUNDLED : SOURCE.NONE;
      return summary(state.source, {
        reason: ok ? undefined : "bundled course data failed to load",
      });
    }

    // 3. Nothing. Never another institution's data - history included.
    uninstallCourses();
    uninstallTrends();
    installEmptyLookup();
    state.remoteScriptBase = null;
    state.resolved = true;
    state.tenantKey = tenantKey;
    state.source = SOURCE.NONE;
    logInfo(
      "no course data: data source is " +
        storedSource +
        " and no payload is stored for " +
        (tenantKey || "an unconfigured tenant"),
    );
    return summary(SOURCE.NONE, {
      reason: !tenantKey
        ? "no client id is configured, so no tenant payload can be found"
        : remoteFailure
          ? "course data could not be fetched for " + tenantKey + ": " + remoteFailure
          : "no uploaded payload is stored for " + tenantKey,
    });
  }

  // ========================================================================
  // Upload
  // ========================================================================

  /**
   * Picks the three required files, and the three optional trend files, out
   * of a FileList by name. `missing` lists required files only; the trend
   * files are all-or-nothing and `missingTrendFiles` says which are absent.
   * @param {FileList|Array<File>} files
   * @returns {{courses: File|null, terms: File|null, departments: File|null, missing: Array<string>,
   *   years: File|null, months: File|null, departmentTerms: File|null, missingTrendFiles: Array<string>}}
   */
  function matchExportFiles(files) {
    const list = Array.prototype.slice.call(files || []);
    const out = {
      courses: null, terms: null, departments: null, missing: [],
      years: null, months: null, departmentTerms: null, missingTrendFiles: [],
    };

    function pick(names, slot, missingList) {
      const wanted = names[slot].toLowerCase();
      const found = list.filter(function (file) {
        return file && typeof file.name === "string" && file.name.toLowerCase() === wanted;
      });
      out[slot] = found.length ? found[0] : null;
      if (!out[slot]) missingList.push(names[slot]);
    }

    Object.keys(REQUIRED_FILES).forEach(function (slot) {
      pick(REQUIRED_FILES, slot, out.missing);
    });
    const trendFiles = trendOnlyFiles();
    Object.keys(trendFiles).forEach(function (slot) {
      pick(trendFiles, slot, out.missingTrendFiles);
    });

    return out;
  }

  /** The three trend file names, for a message. */
  function describeTrendFiles() {
    const names = trendOnlyFiles();
    return names.years + ", " + names.months + " and " + names.departmentTerms;
  }

  /**
   * Builds the record that is stored. Pure apart from the timestamp.
   *
   * The `courses` and `lookup` sub-objects come from the parser's ONE payload
   * builder (Stage 6), so an upload, the converter's JSON file and a fetched
   * payload all store and install the same shapes - `excludesArchived`
   * included, which mirrors the converter's own expression so the search
   * UI's "archived courses are not included" message cannot say something
   * the payload did not do.
   *
   * Since Stage 7 the record carries `trends` when the export supplied the
   * aggregate files (`parsed.trends`, a buildTrends result), through the
   * same builder, so an upload with history and a fetched payload with
   * history store and install the same shape.
   *
   * @param {{clientId: string, region: string, tenantKey: string}} identity
   * @param {Object} parsed - { coursesData, terms, departments, fileNames, trends?, trendsMissingFiles? }
   * @returns {Object} The record, ready for putStored()
   */
  function buildRecord(identity, parsed) {
    const p = parser();
    if (!p) throw new Error("The CSV parser (ally-csv-parser.js) is not loaded.");

    const coursesData = parsed.coursesData;
    const payload = p.buildCoursePayload(coursesData, parsed.terms, parsed.departments, {
      trends: parsed.trends || null,
    });

    const record = {
      tenantKey: identity.tenantKey,
      clientId: identity.clientId,
      region: identity.region,
      source: SOURCE.UPLOAD,
      storedAt: new Date().toISOString(),
      courses: payload.courses,
      lookup: payload.lookup,
      provenance: {
        files: parsed.fileNames || [],
        rowCount: coursesData.rowCount,
        courseCount: payload.courses.rows.length,
        archivedExcluded: payload.courses.archivedExcluded,
        excludesArchived: payload.courses.excludesArchived,
        termCount: Object.keys(payload.lookup.terms).length,
        departmentCount: Object.keys(payload.lookup.departments).length,
        trends: !!payload.trends,
        trendsMissingFiles: parsed.trendsMissingFiles || [],
      },
    };
    if (payload.trends) record.trends = payload.trends;

    return record;
  }

  /**
   * Formats the missing-terms refusal the way build.mjs does, capped.
   * @param {Array<string>} missing
   * @returns {string}
   */
  function describeMissingTerms(missing) {
    const shown = missing.slice(0, MISSING_TERMS_SHOWN).join(", ");
    const more = missing.length > MISSING_TERMS_SHOWN
      ? " and " + (missing.length - MISSING_TERMS_SHOWN) + " more"
      : "";
    return (
      missing.length +
      " term id(s) used by courses are absent from terms.csv (" +
      shown +
      more +
      "). The files must come from the same export, or the tool shows raw ids where term names belong."
    );
  }

  /**
   * Parses an export, stores the payload for the current tenant, installs it,
   * and records `upload` as the data source.
   *
   * Refuses, throwing, BEFORE anything is stored when: no client id is
   * configured, a required file is missing, no course survives, or a course
   * names a term the terms file lacks (the builder's own gate).
   *
   * @param {FileList|Array<File>} files - The chosen files
   * @param {Object} [options] - { excludeArchived (default true), onProgress(bytesRead, totalBytes, rowCount) }
   * @returns {Promise<Object>} Counts and timings for the report and the UI
   */
  async function importExportFiles(files, options) {
    const opts = options || {};
    const excludeArchived = opts.excludeArchived !== false;
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : function () {};

    const identity = resolveTenantIdentity();
    if (!identity) {
      throw new Error(
        "Save a Client ID and region first. Uploaded course data is stored for one institution, and there is nothing yet to store it under.",
      );
    }

    const p = parser();
    if (!p) throw new Error("The CSV parser (ally-csv-parser.js) is not loaded.");
    if (!runtime()) throw new Error("The data runtime (ally-data-runtime.js) is not loaded.");

    const matched = matchExportFiles(files);
    if (matched.missing.length) {
      throw new Error(
        "Missing " +
          matched.missing.join(", ") +
          ". Choose courses.csv, terms.csv and departments_years.csv together from the same Ally export.",
      );
    }

    const t0 = performance.now();
    const termsText = await p.readFileAsText(matched.terms);
    const departmentsText = await p.readFileAsText(matched.departments);
    const terms = p.processTerms(p.parseCSV(termsText));
    const departments = p.processDepartments(p.parseCSV(departmentsText));
    const coursesData = await p.streamCourses(matched.courses, onProgress, {
      excludeArchived: excludeArchived,
    });

    // Trends (Stage 7): all three optional files, or none. terms.csv and
    // departments_years.csv are read a second time as aggregate files. A
    // malformed file throws the builder's own refusal, BEFORE anything is
    // stored - a half-right history is not stored as a right one.
    let trends = null;
    const fileNames = [matched.courses.name, matched.terms.name, matched.departments.name];
    if (matched.missingTrendFiles.length === 0) {
      trends = p.buildTrends({
        years: await p.readFileAsText(matched.years),
        terms: termsText,
        months: await p.readFileAsText(matched.months),
        departments: departmentsText,
        departmentTerms: await p.readFileAsText(matched.departmentTerms),
      });
      fileNames.push(matched.years.name, matched.months.name, matched.departmentTerms.name);
    }
    const parseMs = performance.now() - t0;

    const courseCount = Object.keys(coursesData.byId).length;
    if (courseCount === 0) {
      throw new Error(
        excludeArchived
          ? "Every course was left out as archived. Untick the archived-courses box if that is intended."
          : "courses.csv produced no usable courses.",
      );
    }

    const missingTerms = p.findMissingTerms(coursesData, terms);
    if (missingTerms.length) throw new Error(describeMissingTerms(missingTerms));

    const record = buildRecord(identity, {
      coursesData: coursesData,
      terms: terms,
      departments: departments,
      fileNames: fileNames,
      trends: trends,
      trendsMissingFiles: matched.missingTrendFiles,
    });

    const t1 = performance.now();
    await putStored(record);
    const storeMs = performance.now() - t1;

    const t2 = performance.now();
    const installed = installRecord(record);
    const installMs = performance.now() - t2;
    if (!installed) {
      throw new Error(
        "The data was stored but could not be installed on this page. Reload and try again.",
      );
    }

    writeStoredDataSource(SOURCE.UPLOAD);
    state.resolved = true;
    state.tenantKey = identity.tenantKey;
    state.source = SOURCE.UPLOAD;
    logInfo("uploaded and installed " + courseCount + " courses for " + identity.tenantKey);

    return {
      tenantKey: identity.tenantKey,
      clientId: identity.clientId,
      region: identity.region,
      storedAt: record.storedAt,
      courseCount: courseCount,
      rowCount: coursesData.rowCount,
      archivedExcluded: coursesData.archivedSkipped,
      excludesArchived: record.courses.excludesArchived,
      termCount: record.provenance.termCount,
      departmentCount: record.provenance.departmentCount,
      trends: !!record.trends,
      trendsMissingFiles: matched.missingTrendFiles.slice(),
      timings: { parseMs: parseMs, storeMs: storeMs, installMs: installMs },
    };
  }

  // ========================================================================
  // Remote URL (multi-tenancy Stage 6)
  // ========================================================================
  // A hosted payload becomes a STORED RECORD, not a live dependency: fetched
  // once, stored under the tenant key with source "remote" and the URL it
  // came from, and installed on later visits exactly as an upload is - so a
  // reload costs no download, a tenant switch cannot serve another
  // institution's data (the record is keyed), and every proof Stage 4 carries
  // about the stored path keeps applying. The JSON route is the default. The
  // script route loads the converter's two generated modules from a base URL
  // and stores nothing, because a <script src> install never passes through
  // installRecord; it sets the same state a stored record sets instead.

  function formats() {
    const cfg = config();
    return cfg && cfg.DATA_URL_FORMATS ? cfg.DATA_URL_FORMATS : FORMAT;
  }

  /** ALLY_CONFIG owns the rule; without it no address is accepted. */
  function normaliseDataUrl(raw) {
    const cfg = config();
    return cfg && typeof cfg.normaliseDataUrl === "function"
      ? cfg.normaliseDataUrl(raw)
      : "";
  }

  function validFormat(value) {
    return Object.values(formats()).indexOf(value) !== -1 ? value : "";
  }

  /**
   * The stored course-data URL, normalised.
   * @returns {string} "" when none is stored or it will not normalise
   */
  function readStoredDataUrl() {
    const cfg = config();
    if (!cfg) return "";
    return normaliseDataUrl(readStoredTrimmed(cfg.STORAGE_KEYS.TENANT_DATA_URL));
  }

  /**
   * The stored payload format, validated; JSON when unset or unknown.
   * @returns {string}
   */
  function readStoredDataUrlFormat() {
    const cfg = config();
    if (!cfg) return FORMAT.JSON;
    return (
      validFormat(readStoredTrimmed(cfg.STORAGE_KEYS.TENANT_DATA_URL_FORMAT)) ||
      cfg.DEFAULT_DATA_URL_FORMAT ||
      FORMAT.JSON
    );
  }

  function writeStoredDataUrl(url, format) {
    const cfg = config();
    if (!cfg) return;
    try {
      window.localStorage.setItem(cfg.STORAGE_KEYS.TENANT_DATA_URL, url);
      window.localStorage.setItem(cfg.STORAGE_KEYS.TENANT_DATA_URL_FORMAT, format);
    } catch (e) {
      logWarn("Could not write the course data URL:", e.message);
    }
  }

  /** The origin of a URL for messages - never the full path, which can be long. */
  function originOf(url) {
    try {
      return new URL(url).origin;
    } catch (e) {
      return String(url);
    }
  }

  /**
   * The failure sentence, with an optional detail appended.
   * @param {string} url - The URL that failed
   * @param {string} [detail] - e.g. the HTTP status, when there was one
   * @returns {string}
   */
  function describeFetchFailure(url, detail) {
    return (
      "Could not fetch course data from " +
      originOf(url) +
      ". " +
      FETCH_FAILURE_CAUSES +
      (detail ? " " + detail : "")
    );
  }

  /**
   * Checks a fetched payload BEFORE anything is stored: the discriminator,
   * the version, both sub-objects, at least one course, and the builder's
   * term-consistency gate (courses and lookup must come from one export).
   * @param {*} payload - Parsed JSON
   * @param {string} url - For the message
   * @returns {string} "" when usable, otherwise the sentence to refuse with
   */
  function describePayloadProblem(payload, url) {
    const p = parser();
    const kind = p ? p.PAYLOAD_KIND : "ally-course-payload";
    const version = p ? p.PAYLOAD_VERSION : 1;
    const where = "The file at " + originOf(url);

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return where + " is not the JSON course payload this tool expects.";
    }
    if (payload.kind !== kind) {
      return (
        where +
        " is not an Ally course payload. Host the ally-course-payload.json file the converter produces."
      );
    }
    if (payload.version !== version) {
      return where + " was written by a different version of the converter and cannot be read.";
    }

    const courses = payload.courses;
    if (
      !courses ||
      typeof courses !== "object" ||
      !Array.isArray(courses.termIds) ||
      !Array.isArray(courses.rows)
    ) {
      return where + " has no courses.";
    }
    if (courses.rows.length === 0) return where + " contains no courses.";

    const lookup = payload.lookup;
    if (
      !lookup ||
      typeof lookup !== "object" ||
      !lookup.terms ||
      typeof lookup.terms !== "object" ||
      !lookup.departments ||
      typeof lookup.departments !== "object"
    ) {
      return where + " has no term and department lookup.";
    }

    if (p && typeof p.findMissingTerms === "function") {
      const byId = {};
      courses.rows.forEach(function (row) {
        if (Array.isArray(row)) byId[row[0]] = row;
      });
      const missing = p.findMissingTerms({ byId: byId, termIds: courses.termIds }, lookup.terms);
      if (missing.length) {
        const shown = missing.slice(0, MISSING_TERMS_SHOWN).join(", ");
        const more = missing.length > MISSING_TERMS_SHOWN
          ? " and " + (missing.length - MISSING_TERMS_SHOWN) + " more"
          : "";
        return (
          where +
          " is inconsistent: " +
          missing.length +
          " term id(s) used by its courses are absent from its lookup (" +
          shown +
          more +
          "). Its courses and lookup must come from the same export."
        );
      }
    }

    // Trends are optional (Stage 7), but a payload that carries them in a
    // shape installTrends cannot read is refused whole rather than stored
    // half-right.
    if (
      payload.trends !== undefined &&
      payload.trends !== null &&
      !(p && typeof p.isTrendsPayload === "function" && p.isTrendsPayload(payload.trends))
    ) {
      return (
        where +
        " carries accessibility history in a shape this tool cannot read. Regenerate the file with the converter."
      );
    }

    return "";
  }

  /**
   * Builds the record a fetched JSON payload is stored as. buildRecord's
   * shape, with the payload's own courses and lookup UNCHANGED.
   * @param {{clientId: string, region: string, tenantKey: string}} identity
   * @param {Object} payload - A payload describePayloadProblem() passed
   * @param {string} url - The normalised URL it came from
   * @returns {Object} The record, ready for putStored()
   */
  function buildRemoteRecord(identity, payload, url) {
    const courses = payload.courses;
    const record = {
      tenantKey: identity.tenantKey,
      clientId: identity.clientId,
      region: identity.region,
      source: SOURCE.REMOTE,
      sourceUrl: url,
      storedAt: new Date().toISOString(),
      courses: courses,
      lookup: payload.lookup,
      provenance: {
        files: [],
        url: url,
        generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : "",
        courseCount: courses.rows.length,
        archivedExcluded: courses.archivedExcluded || 0,
        excludesArchived: !!courses.excludesArchived,
        termCount: Object.keys(payload.lookup.terms).length,
        departmentCount: Object.keys(payload.lookup.departments).length,
        trends: !!payload.trends,
        trendsMissingFiles: [],
      },
    };
    // The payload's own trends, UNCHANGED, as its courses and lookup are.
    if (payload.trends) record.trends = payload.trends;
    return record;
  }

  /**
   * The JSON route: fetch, check, store, install.
   * @returns {Promise<{record: Object, timings: Object}>}
   */
  async function fetchRemoteJson(identity, url) {
    const t0 = performance.now();
    let response;
    try {
      // No cookies to a data host, and a fresh copy on an explicit refresh.
      response = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-cache" });
    } catch (error) {
      if (error && error.name === "AbortError") throw error;
      logWarn("fetch failed (unreachable, or no CORS header for this origin):", error.message);
      throw new Error(describeFetchFailure(url));
    }
    if (!response.ok) {
      throw new Error(describeFetchFailure(url, "The server answered " + response.status + "."));
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error(
        "The file at " + originOf(url) + " is not valid JSON, so it cannot be the course payload.",
      );
    }
    const fetchMs = performance.now() - t0;

    const problem = describePayloadProblem(payload, url);
    if (problem) throw new Error(problem);

    const record = buildRemoteRecord(identity, payload, url);

    const t1 = performance.now();
    await putStored(record);
    const storeMs = performance.now() - t1;

    const t2 = performance.now();
    const installed = installRecord(record);
    const installMs = performance.now() - t2;
    if (!installed) {
      throw new Error(
        "The course data was stored but could not be installed on this page. Reload and try again.",
      );
    }

    return { record: record, timings: { fetchMs: fetchMs, storeMs: storeMs, installMs: installMs } };
  }

  /**
   * The script route: the bundled loader with a different base. Nothing is
   * stored, and the pair is both-or-neither - if the courses module fails
   * after the lookup module installed, the page is left with NO course data
   * and an EMPTY lookup rather than a foreign lookup beside the old courses.
   * @returns {Promise<{record: null, timings: Object}>}
   */
  async function fetchRemoteScripts(identity, base) {
    const t0 = performance.now();
    const coursesBefore = coursesInstalled() ? ALLY_COURSES : undefined;

    const lookupOk = await loadScript(base + "/" + REMOTE_SCRIPT_FILES.lookup);
    if (!lookupOk) {
      throw new Error(
        describeFetchFailure(base, "The file " + REMOTE_SCRIPT_FILES.lookup + " did not load."),
      );
    }
    state.lookupIsTenant = true;

    const coursesOk = await loadScript(base + "/" + REMOTE_SCRIPT_FILES.courses);
    const coursesReplaced = coursesInstalled() && ALLY_COURSES !== coursesBefore;
    // Either way the page is no longer on whatever history it held: on
    // success the Trends view loads <base>/ally-trends-data.js lazily, and
    // on failure there is nothing to show.
    uninstallTrends();
    if (!coursesOk || !coursesReplaced) {
      uninstallCourses();
      installEmptyLookup();
      state.remoteScriptBase = null;
      state.resolved = true;
      state.tenantKey = identity.tenantKey;
      state.source = SOURCE.NONE;
      throw new Error(
        coursesOk
          ? "The scripts at " +
            originOf(base) +
            " loaded but did not install course data. They must be the two files the converter generated."
          : describeFetchFailure(base, "The file " + REMOTE_SCRIPT_FILES.courses + " did not load."),
      );
    }

    // A script install stores nothing, so an older stored copy for this
    // tenant would win at step 1 of the next visit. Remove it, so what is on
    // screen is what the next visit resolves.
    try {
      await removeStored(identity.tenantKey);
    } catch (error) {
      logWarn("could not remove the stored record for " + identity.tenantKey + ":", error.message);
    }

    // Remembered so describeTrends() can point the Trends view at the same
    // folder's ally-trends-data.js.
    state.remoteScriptBase = base;

    return { record: null, timings: { fetchMs: performance.now() - t0, storeMs: 0, installMs: 0 } };
  }

  /**
   * Fetches course data from a URL, stores it (JSON route), installs it, and
   * records `remote` as the data source with the URL and format.
   *
   * Refuses, throwing, BEFORE any request when: no client id is configured
   * (nothing to key a record under), no URL is given or stored, or the URL
   * is not https (loopback hosts excepted). The setting, URL and format are
   * written only AFTER a successful install, so a failed fetch never flips
   * a tenant onto a source that yields nothing.
   *
   * This is also the "Refresh from URL" gesture: with no options it fetches
   * the stored URL again and replaces the stored record.
   *
   * @param {Object} [options] - { url (default: the stored URL), format ("json" | "script"; default: the stored format, then JSON) }
   * @returns {Promise<Object>} The normalised URL, counts and timings for the UI
   */
  async function fetchRemote(options) {
    const opts = options || {};

    const identity = resolveTenantIdentity();
    if (!identity) {
      throw new Error(
        "Save a Client ID and region first. Fetched course data is stored for one institution, and there is nothing yet to store it under.",
      );
    }
    if (!runtime()) throw new Error("The data runtime (ally-data-runtime.js) is not loaded.");

    const cfg = config();
    const rawUrl =
      typeof opts.url === "string" && opts.url.trim()
        ? opts.url
        : cfg
          ? readStoredTrimmed(cfg.STORAGE_KEYS.TENANT_DATA_URL)
          : "";
    if (!rawUrl.trim()) throw new Error("Enter the address of the course data first.");

    const url = normaliseDataUrl(rawUrl);
    if (!url) throw new Error(DATA_URL_REFUSAL);

    const format = validFormat(opts.format) || readStoredDataUrlFormat();
    const outcome =
      format === formats().SCRIPT
        ? await fetchRemoteScripts(identity, url)
        : await fetchRemoteJson(identity, url);

    writeStoredDataSource(SOURCE.REMOTE);
    writeStoredDataUrl(url, format);
    state.resolved = true;
    state.tenantKey = identity.tenantKey;
    state.source = SOURCE.REMOTE;

    const record = outcome.record;
    const courseCount = coursesInstalled() ? Object.keys(ALLY_COURSES.courses).length : 0;
    const lookupLoaded = typeof ALLY_LOOKUP !== "undefined" && ALLY_LOOKUP;
    logInfo(
      "fetched and installed " + courseCount + " courses for " + identity.tenantKey + " from " + originOf(url) + " (" + format + ")",
    );

    return {
      tenantKey: identity.tenantKey,
      clientId: identity.clientId,
      region: identity.region,
      url: url,
      origin: originOf(url),
      format: format,
      stored: !!record,
      storedAt: record ? record.storedAt : null,
      courseCount: courseCount,
      termCount: record
        ? record.provenance.termCount
        : lookupLoaded ? Object.keys(ALLY_LOOKUP.terms).length : 0,
      departmentCount: record
        ? record.provenance.departmentCount
        : lookupLoaded ? Object.keys(ALLY_LOOKUP.departments).length : 0,
      archivedExcluded: record
        ? record.courses.archivedExcluded || 0
        : coursesInstalled() ? ALLY_COURSES.archivedExcluded || 0 : 0,
      excludesArchived: record
        ? !!record.courses.excludesArchived
        : coursesInstalled() ? !!ALLY_COURSES.excludesArchived : false,
      // A stored record either carries history or does not; the script
      // route cannot know until the Trends view tries the folder, so null.
      trends: record ? !!record.trends : null,
      timings: outcome.timings,
    };
  }

  /**
   * Removes the current tenant's stored payload and returns the data source
   * to `bundled`. If the page was running on that payload it is re-resolved,
   * so what is on screen matches what is stored. The course-data URL is NOT
   * forgotten: a refresh should not mean re-typing it.
   * @returns {Promise<{tenantKey: string, existed: boolean, source: string}>}
   */
  async function removeForCurrentTenant() {
    const identity = resolveTenantIdentity();
    if (!identity) {
      throw new Error("No Client ID is configured, so there is no uploaded data to remove.");
    }

    const existed = !!(await getStored(identity.tenantKey));
    await removeStored(identity.tenantKey);

    const cfg = config();
    const stored = readStoredDataSource();
    if (cfg && (stored === cfg.DATA_SOURCES.UPLOAD || stored === cfg.DATA_SOURCES.REMOTE)) {
      writeStoredDataSource(cfg.DATA_SOURCES.BUNDLED);
    }

    if (state.resolved && state.tenantKey === identity.tenantKey) {
      await resolveCourseData({ force: true });
    }

    return { tenantKey: identity.tenantKey, existed: existed, source: getEffectiveDataSource() };
  }

  /**
   * Describes the current tenant's stored data for a status line.
   * @returns {Promise<Object>}
   */
  async function describeCurrent() {
    const identity = resolveTenantIdentity();
    const dataSource = readStoredDataSource();
    const dataUrl = readStoredDataUrl();
    const dataUrlFormat = readStoredDataUrlFormat();
    if (!identity) {
      return {
        tenantKey: null,
        stored: null,
        dataSource: dataSource,
        dataUrl: dataUrl,
        dataUrlOrigin: dataUrl ? originOf(dataUrl) : "",
        dataUrlFormat: dataUrlFormat,
      };
    }

    let record = null;
    try {
      if (await databaseExists()) record = await getStored(identity.tenantKey);
    } catch (error) {
      logWarn("could not read IndexedDB:", error.message);
    }

    return {
      tenantKey: identity.tenantKey,
      clientId: identity.clientId,
      region: identity.region,
      dataSource: dataSource,
      dataUrl: dataUrl,
      dataUrlOrigin: dataUrl ? originOf(dataUrl) : "",
      dataUrlFormat: dataUrlFormat,
      stored: record
        ? {
            source: record.source === SOURCE.REMOTE ? SOURCE.REMOTE : SOURCE.UPLOAD,
            sourceUrl: record.sourceUrl || "",
            sourceOrigin: record.sourceUrl ? originOf(record.sourceUrl) : "",
            storedAt: record.storedAt,
            courseCount: record.provenance.courseCount,
            termCount: record.provenance.termCount,
            departmentCount: record.provenance.departmentCount,
            archivedExcluded: record.provenance.archivedExcluded,
            excludesArchived: record.provenance.excludesArchived,
            files: record.provenance.files,
            // Read off the record itself, not its provenance, so a status
            // line cannot say "with history" about a record that lost it.
            trends: !!record.trends,
            trendsMissingFiles: record.provenance.trendsMissingFiles || [],
          }
        : null,
    };
  }

  logDebug("loaded; nothing resolved until Ally Reporting is selected");

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    SOURCE: SOURCE,
    REQUIRED_FILES: REQUIRED_FILES,
    REMOTE_SCRIPT_FILES: REMOTE_SCRIPT_FILES,
    FETCH_FAILURE_CAUSES: FETCH_FAILURE_CAUSES,
    DATA_URL_REFUSAL: DATA_URL_REFUSAL,
    DB_NAME: DB_NAME,
    STORE_NAME: STORE_NAME,
    TRENDS: TRENDS,
    TRENDS_REASON: TRENDS_REASON,
    BUNDLED_TRENDS_URL: BUNDLED_TRENDS_URL,
    REMOTE_TRENDS_FILE: REMOTE_TRENDS_FILE,

    // Identity and settings
    resolveTenantIdentity: resolveTenantIdentity,
    readStoredDataSource: readStoredDataSource,
    getEffectiveDataSource: getEffectiveDataSource,
    describeTrends: describeTrends,
    describeTrendFiles: describeTrendFiles,
    readStoredDataUrl: readStoredDataUrl,
    readStoredDataUrlFormat: readStoredDataUrlFormat,

    // The lazy-load entry point and the UI operations
    resolveCourseData: resolveCourseData,
    importExportFiles: importExportFiles,
    fetchRemote: fetchRemote,
    removeForCurrentTenant: removeForCurrentTenant,
    describeCurrent: describeCurrent,

    // Building blocks, exposed for tests
    matchExportFiles: matchExportFiles,
    buildRecord: buildRecord,
    buildRemoteRecord: buildRemoteRecord,
    describePayloadProblem: describePayloadProblem,
    describeFetchFailure: describeFetchFailure,
    installRecord: installRecord,
    uninstallTrends: uninstallTrends,
    getStored: getStored,
    putStored: putStored,
    removeStored: removeStored,
    listStoredKeys: listStoredKeys,
    databaseExists: databaseExists,
    closeDatabase: closeDatabase,
    deleteDatabase: deleteDatabase,
    getState: function () {
      return {
        resolved: state.resolved,
        tenantKey: state.tenantKey,
        source: state.source,
        lookupIsTenant: state.lookupIsTenant,
        trendsInstalled: state.trendsInstalled,
        remoteScriptBase: state.remoteScriptBase,
      };
    },
  };
})();

if (typeof window !== "undefined") {
  window.ALLY_TENANT_DATA = ALLY_TENANT_DATA;
}
