/**
 * @fileoverview Ally Accessibility Reporting Tool - Course Search API Fallback
 * @module AllyCourseSearchApi
 * @requires ALLY_API_CLIENT
 * @requires ALLY_CONFIG
 * @version 1.0.0
 * @since Multi-tenancy Stage 5
 *
 * @description
 * ONE shared provider for the API fallback tier of course search. A tenant
 * that has configured credentials but uploaded no course data has no
 * ALLY_COURSES on the page, and all three search modules return nothing in
 * that state. This module lets them search the Ally API's own `courseName`
 * filter instead - the only name field the API can filter on.
 *
 * The three search modules (Report Builder, Course Report, Statement Preview)
 * call this; they never build a query themselves. Two implementations of one
 * parser cost Stage 2a a whole stage; three implementations of one API search
 * would drift the same way.
 *
 * WHAT THIS IS NOT:
 * - Not type-ahead. Every send polls the API at 10 s intervals for up to 30
 *   attempts, so it is an EXPLICIT send (Enter, or the visible button), one
 *   request in flight at a time. The 150 ms debounce path shows a hint.
 * - Not a code search. `courseCode` is not filterable (ally-config.js, the
 *   note above FILTER_FIELDS), and the interface says so in visible text.
 * - Not a cache. Results are memoised for the page's lifetime only, keyed by
 *   tenant + operator + limit + normalised query. They are NOT written into
 *   ALLY_CACHE, whose entries are reports the cache UI lists and ages.
 *
 * SINGLE FLIGHT, and why the guard lives HERE. ALLY_API_CLIENT.executeQuery
 * has no single-flight guard: a second call overwrites the abort controller
 * and the debug data of the first, and whichever finishes first clears the
 * in-progress flag. So this module refuses to send while
 * ALLY_API_CLIENT.isRequestInProgress() is true. The guard is deliberately
 * NOT inside executeQuery - that would change the page-load warm-up too.
 */

const ALLY_COURSE_SEARCH_API = (function () {
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
      console.error("[AllyCourseSearchApi] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyCourseSearchApi] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyCourseSearchApi] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyCourseSearchApi] " + message, ...args);
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  const CONFIG = Object.freeze({
    /** Shortest query worth sending - matches the search modules' own floor */
    MIN_SEARCH_LENGTH: 2,
    /** Rows requested when the caller names no limit */
    DEFAULT_LIMIT: 10,
    /** Default operator; `sw` (starts with) is the other one the API supports */
    DEFAULT_OPERATOR: "co",
    /** The only field the API can filter a name on */
    FILTER_FIELD: "courseName",
    /** Provenance marker on every mapped result */
    MATCH_TYPE: "api",
  });

  /** Operators the API documents for string fields that we allow here */
  const OPERATORS = Object.freeze({ CONTAINS: "co", STARTS_WITH: "sw" });

  /** Refusal codes, each with exactly one sentence in the interface */
  const REFUSAL = Object.freeze({
    SHORT_QUERY: "short-query",
    NO_CREDENTIALS: "no-credentials",
    IN_PROGRESS: "in-progress",
  });

  /** The sentences. One per refusal, one per outcome; nothing per poll. */
  const TEXT = Object.freeze({
    SHORT_QUERY:
      "Type at least " + CONFIG.MIN_SEARCH_LENGTH + " characters, then search.",
    NO_CREDENTIALS:
      "No course data has been uploaded and no Ally credentials are configured. Configure credentials in Set Up, or upload course data, to search.",
    // No "cancel it" here: during the page-load warm-up there is nothing the
    // person can cancel from the search box.
    IN_PROGRESS:
      "An Ally request is already running. Wait for it to finish, then search again.",
    HINT: "Press Enter or Search Ally to search by module name. Module codes cannot be searched.",
    STARTED_PREFIX: "Searching Ally for modules named like ",
    STARTED_SUFFIX: ". This can take a few minutes while the report prepares.",
    CANCELLED: "Ally search cancelled.",
    NONE_FOUND:
      "No modules found in Ally with that name. Module codes cannot be searched.",
    FAILED_PREFIX: "Ally search failed: ",
    /** Replaces the sr-only help text while API mode is active */
    HELP:
      "Type at least " +
      CONFIG.MIN_SEARCH_LENGTH +
      " characters, then press Enter or the Search Ally button. Matches module names only, not module codes, and a search can take a few minutes. Use arrow keys to navigate results, Enter to select, Escape to close.",
    /** Visible progress line while a send is in flight */
    PROGRESS_PREFIX: "Ally: ",
    BUTTON_BUSY: "Searching…",
  });

  /** "Search for a module by name or code" -> "Search for a module by name" */
  const LABEL_CODE_CLAUSE = /\s+or\s+code\b/i;

  // ========================================================================
  // Private State
  // ========================================================================

  /**
   * The one send this module may have in flight. Holds the settle promise so
   * a new send can wait for the abort to land before re-checking the client.
   * @type {{ settled: Promise<void>, key: string }|null}
   */
  let inFlight = null;

  /** Session memo: key -> results array. Page lifetime only. */
  const memo = new Map();

  // ========================================================================
  // Private Methods - Mode and Refusals
  // ========================================================================

  /**
   * API mode is decided from the data on the page and nothing else: local
   * type-ahead whenever ALLY_COURSES is installed, the API only when it is
   * not. Never both - a local hit list is never padded from the API.
   * @returns {boolean}
   */
  function isApiMode() {
    return typeof ALLY_COURSES === "undefined";
  }

  function hasClient() {
    return (
      typeof ALLY_API_CLIENT !== "undefined" &&
      ALLY_API_CLIENT !== null &&
      typeof ALLY_API_CLIENT.fetchOverall === "function"
    );
  }

  /**
   * Decides, before any send, whether one is allowed. Each refusal carries its
   * own sentence. Order: query length (cheapest, and the person can fix it at
   * the keyboard), then credentials, then the single-flight guard.
   * @param {string} query
   * @returns {{ ok: true }|{ ok: false, code: string, message: string }}
   */
  function checkRefusal(query) {
    const trimmed = (query || "").trim();
    if (trimmed.length < CONFIG.MIN_SEARCH_LENGTH) {
      return { ok: false, code: REFUSAL.SHORT_QUERY, message: TEXT.SHORT_QUERY };
    }
    if (!hasClient() || !ALLY_API_CLIENT.hasCredentials()) {
      return {
        ok: false,
        code: REFUSAL.NO_CREDENTIALS,
        message: TEXT.NO_CREDENTIALS,
      };
    }
    // Our OWN in-flight send is cancelled by search() before this is re-read,
    // so a true here means somebody else's request - a report, a warm-up.
    if (ALLY_API_CLIENT.isRequestInProgress()) {
      return { ok: false, code: REFUSAL.IN_PROGRESS, message: TEXT.IN_PROGRESS };
    }
    return { ok: true };
  }

  // ========================================================================
  // Private Methods - Query and Mapping
  // ========================================================================

  function normaliseQuery(query) {
    return (query || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  /**
   * The memo is per tenant, so a tenant change in Set Up cannot serve another
   * institution's hit list. Resolved live-first through the tenant resolver
   * where it exists, else from the client's own identity.
   * @returns {string}
   */
  function tenantKey() {
    if (
      typeof ALLY_TENANT_DATA !== "undefined" &&
      typeof ALLY_TENANT_DATA.resolveTenantIdentity === "function"
    ) {
      const identity = ALLY_TENANT_DATA.resolveTenantIdentity();
      if (identity && identity.tenantKey) return identity.tenantKey;
    }
    if (hasClient() && typeof ALLY_API_CLIENT.getCredentials === "function") {
      const creds = ALLY_API_CLIENT.getCredentials();
      return (creds.clientId || "") + "@" + (creds.region || "");
    }
    return "";
  }

  function memoKey(query, operator, limit) {
    return [tenantKey(), operator, limit, normaliseQuery(query)].join("|");
  }

  /**
   * Maps ONE `overall` row to the shape the three search modules render.
   * termName comes from the row, never from ALLY_LOOKUP - under the none
   * state the lookup is empty. A missing score is null, NEVER 0: about a
   * third of courses have no scanned files, and 0 would brand them worst.
   * @param {Object} row - An `overall` endpoint row
   * @returns {Object} { id, name, code, termId, termName, score, matchType }
   */
  function mapRow(row) {
    return {
      id: row.courseId || "",
      name: row.courseName || "Unknown Course",
      code: row.courseCode || "",
      termId: row.termId || "",
      termName: row.termName || "",
      score: scoreOf(row),
      matchType: CONFIG.MATCH_TYPE,
    };
  }

  /**
   * The API returns overallScore 0 for a course it has NEVER SCANNED -
   * measured on the live send, 6 September 2026: overallScore, filesScore
   * and WYSIWYGScore all 0 with totalFiles 0 and totalWYSIWYG 0. The export
   * leaves that cell empty and the parser derives null, so mapping the API's
   * 0 straight through would brand an unscanned course as the worst in the
   * institution. Both totals present and both 0 means unscanned: null. With
   * the totals absent there is nothing to decide on, so the number rule
   * stands.
   * @param {Object} row - An `overall` endpoint row
   * @returns {number|null}
   */
  function scoreOf(row) {
    const hasTotals =
      typeof row.totalFiles === "number" &&
      typeof row.totalWYSIWYG === "number";
    if (hasTotals && row.totalFiles === 0 && row.totalWYSIWYG === 0) {
      return null;
    }
    return typeof row.overallScore === "number" ? row.overallScore : null;
  }

  function mapRows(result) {
    const rows = result && Array.isArray(result.data) ? result.data : [];
    return rows.filter(function (row) {
      return row && row.courseId;
    }).map(mapRow);
  }

  function isAbort(error) {
    return (
      !!error &&
      (error.name === "AbortError" || error.type === "cancelled")
    );
  }

  /**
   * Cancels this module's own in-flight send. Goes through the client's
   * cancelRequest, because executeQuery takes no external signal. KNOWN
   * EDGE, stated: if a warm-up started AFTER our send (the idle timer), the
   * client's abort controller is the warm-up's by then, and this aborts that
   * instead. The refusal above closes the other ordering; this one is left
   * open because closing it needs a guard inside executeQuery.
   * @returns {boolean} Whether there was a send of ours to cancel
   */
  function cancel() {
    if (!inFlight) return false;
    logInfo("Cancelling in-flight course search");
    if (hasClient() && typeof ALLY_API_CLIENT.cancelRequest === "function") {
      ALLY_API_CLIENT.cancelRequest();
    }
    return true;
  }

  /**
   * Resolves once the current in-flight send (if any) has settled either way.
   * @returns {Promise<void>}
   */
  function whenSettled() {
    return inFlight ? inFlight.settled : Promise.resolve();
  }

  /**
   * Searches the API by course name. Explicit send only - never call this
   * from a keystroke path.
   *
   * @param {string} query - Raw query text
   * @param {Object} [options]
   * @param {string} [options.operator="co"] - "co" or "sw"
   * @param {number} [options.limit=10] - Rows to request
   * @param {Function} [options.onProgress] - Per-poll progress (visible only;
   *   callers must not announce from it)
   * @returns {Promise<Array>} Mapped results in the shared shape
   * @throws {{ refused: true, code: string, message: string }} on a refusal
   * @throws the client's classified error on a failed send; `name ===
   *   "AbortError"` or `type === "cancelled"` when cancelled
   */
  async function search(query, options) {
    const settings = options || {};
    const operator =
      settings.operator === OPERATORS.STARTS_WITH
        ? OPERATORS.STARTS_WITH
        : CONFIG.DEFAULT_OPERATOR;
    const limit =
      typeof settings.limit === "number" && settings.limit > 0
        ? settings.limit
        : CONFIG.DEFAULT_LIMIT;

    // A new send supersedes our own previous one. Wait for the abort to
    // settle so the client's in-progress flag reads our absence, not our
    // presence, in the refusal check that follows.
    if (inFlight) {
      cancel();
      await inFlight.settled;
    }

    const refusal = checkRefusal(query);
    if (!refusal.ok) {
      logDebug("Refused (" + refusal.code + ")");
      throw { refused: true, code: refusal.code, message: refusal.message };
    }

    const key = memoKey(query, operator, limit);
    if (memo.has(key)) {
      logDebug("Memo hit for " + key);
      return memo.get(key).slice();
    }

    const filters = {};
    filters[CONFIG.FILTER_FIELD] = operator + ":" + query.trim();

    let settle;
    const settled = new Promise(function (resolve) {
      settle = resolve;
    });
    const entry = { settled: settled, key: key };
    inFlight = entry;

    try {
      logInfo("Sending course search (" + operator + ", limit " + limit + ")");
      // Resolved at call time on the PUBLIC object, so a test wrapper on
      // ALLY_API_CLIENT.fetchOverall is the function this reaches.
      const result = await ALLY_API_CLIENT.fetchOverall({
        limit: limit,
        filters: filters,
        onProgress: settings.onProgress,
      });
      const mapped = mapRows(result);
      memo.set(key, mapped.slice());
      return mapped;
    } catch (error) {
      if (isAbort(error)) logInfo("Course search cancelled");
      else logWarn("Course search failed:", error && error.message);
      throw error;
    } finally {
      if (inFlight === entry) inFlight = null;
      settle();
    }
  }

  // ========================================================================
  // Private Methods - Binding (the shared interface work)
  // ========================================================================

  /**
   * Writes a text node only when the text differs. A same-string rewrite into
   * a live region is not decidable from the DOM as silent, so compare first.
   */
  function writeIfChanged(element, text) {
    if (!element) return;
    if (element.textContent !== text) element.textContent = text;
  }

  function describedByWith(input, id, present) {
    if (!input || !id) return;
    const current = (input.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter(Boolean);
    const has = current.indexOf(id) !== -1;
    if (present && !has) current.push(id);
    if (!present && has) current.splice(current.indexOf(id), 1);
    if (current.length) input.setAttribute("aria-describedby", current.join(" "));
    else input.removeAttribute("aria-describedby");
  }

  /**
   * Builds the per-module binding. Everything the three modules would
   * otherwise copy lives here: label and help swaps, the visible limit note,
   * the Search Ally and Cancel buttons, the progress line, the send itself,
   * and the one-announcement-per-event status writes.
   *
   * @param {Object} spec
   * @param {HTMLInputElement} spec.input - The combobox input
   * @param {HTMLElement} [spec.label] - Its label (text swapped in API mode)
   * @param {HTMLElement} [spec.help] - The sr-only help (text swapped)
   * @param {HTMLElement} [spec.note] - Visible limits paragraph (unhidden)
   * @param {HTMLButtonElement} [spec.sendButton] - Visible "Search Ally"
   * @param {HTMLButtonElement} [spec.cancelButton] - Visible "Cancel search"
   * @param {HTMLElement} [spec.progress] - Visible progress line, NOT live
   * @param {number} [spec.limit] - Rows to request (the module's MAX_RESULTS)
   * @param {Function} spec.onResults - (results, query) => void; renders
   * @param {Function} spec.onStatus - (message) => void; the module's status
   *   region write - the ONE announcement channel for every search event
   * @returns {Object} binding
   */
  function createBinding(spec) {
    const el = {
      input: spec.input || null,
      label: spec.label || null,
      help: spec.help || null,
      note: spec.note || null,
      sendButton: spec.sendButton || null,
      cancelButton: spec.cancelButton || null,
      progress: spec.progress || null,
    };
    const limit = spec.limit || CONFIG.DEFAULT_LIMIT;
    const onResults = typeof spec.onResults === "function" ? spec.onResults : function () {};
    const onStatus = typeof spec.onStatus === "function" ? spec.onStatus : function () {};

    const original = {
      label: el.label ? el.label.textContent : "",
      help: el.help ? el.help.textContent : "",
      sendLabel: el.sendButton ? el.sendButton.textContent : "",
    };

    // null until the first applyMode, so the first call always writes.
    let appliedApiMode = null;
    let busy = false;
    let lastHint = "";

    // Which edit of the input the last send was issued for. The modules'
    // 150 ms debounce can fire AFTER a fast send (a memo hit resolves in the
    // same tick) and would otherwise hide the results and write the hint over
    // the outcome. A hint is only offered for text nobody has sent yet.
    let inputSerial = 0;
    let sentSerial = -1;
    if (el.input) {
      el.input.addEventListener("input", function () {
        inputSerial++;
      });
    }

    // Resolves when THIS binding's current send has fully finished - status
    // write included. The provider's whenSettled() resolves one microtask
    // earlier, at the end of search(), which is before the superseded send's
    // catch has written "cancelled"; waiting on that put "searching" ahead of
    // "cancelled" in the status region. Measured, not predicted.
    let currentSendDone = Promise.resolve();

    function setBusy(state) {
      busy = state;
      if (el.sendButton) el.sendButton.disabled = state;
      if (el.cancelButton) el.cancelButton.hidden = !state;
      if (el.progress) {
        el.progress.hidden = !state;
        if (!state) el.progress.textContent = "";
      }
    }

    function setProgress(message) {
      if (!el.progress || !message) return;
      // Visible only. The progress line carries no live role on purpose:
      // one announcement per event, nothing per poll.
      writeIfChanged(el.progress, TEXT.PROGRESS_PREFIX + message);
    }

    /**
     * Applies the current mode to the interface. Idempotent: writes only on
     * a transition, so it is safe to call from focus and input handlers.
     * Leaving API mode (data installed after a send) cancels the send.
     * @returns {boolean} Whether API mode is now active
     */
    function applyMode() {
      const apiMode = isApiMode();
      if (apiMode === appliedApiMode) return apiMode;
      appliedApiMode = apiMode;

      if (el.label) {
        el.label.textContent = apiMode
          ? original.label.replace(LABEL_CODE_CLAUSE, "")
          : original.label;
      }
      if (el.help) {
        el.help.textContent = apiMode ? TEXT.HELP : original.help;
      }
      if (el.note) {
        el.note.hidden = !apiMode;
        describedByWith(el.input, el.note.id, apiMode);
      }
      if (el.sendButton) el.sendButton.hidden = !apiMode;
      if (!apiMode) {
        if (busy) cancel();
        setBusy(false);
        lastHint = "";
      }
      logDebug("Mode applied: " + (apiMode ? "api" : "local"));
      return apiMode;
    }

    /**
     * The debounce path in API mode: a hint, written once per hint text, and
     * NO send. Keystrokes alone never reach the API.
     * @param {string} query
     * @returns {boolean} Whether the hint applies - false while a send is in
     *   flight, or once the current text has been sent, so the caller leaves
     *   the results and the outcome line alone
     */
    function showHint(query) {
      if (busy || sentSerial === inputSerial) return false;
      const text =
        (query || "").trim().length < CONFIG.MIN_SEARCH_LENGTH
          ? TEXT.SHORT_QUERY
          : TEXT.HINT;
      if (text !== lastHint) {
        lastHint = text;
        onStatus(text);
      }
      return true;
    }

    /**
     * The explicit send. One request at a time; a new send cancels ours.
     * Announces twice per search - started, and the outcome - through the
     * module's status region only.
     * @param {string} query
     * @returns {Promise<void>}
     */
    async function send(query) {
      sentSerial = inputSerial;

      // A send that supersedes our own in-flight one waits for that one to
      // settle FIRST, so its "cancelled" line lands before this "searching"
      // line rather than after it.
      if (busy) {
        cancel();
        await currentSendDone;
      }

      const refusal = checkRefusal(query);
      if (!refusal.ok) {
        lastHint = "";
        onStatus(refusal.message);
        return;
      }

      let markDone;
      currentSendDone = new Promise(function (resolve) {
        markDone = resolve;
      });

      lastHint = "";
      setBusy(true);
      onStatus(
        TEXT.STARTED_PREFIX + "“" + query.trim() + "”" + TEXT.STARTED_SUFFIX,
      );
      setProgress(
        typeof ALLY_CONFIG !== "undefined" && ALLY_CONFIG.MESSAGES
          ? ALLY_CONFIG.MESSAGES.CONNECTING
          : "Connecting…",
      );

      try {
        const results = await search(query, {
          limit: limit,
          onProgress: function (progress) {
            setProgress(progress && progress.message);
          },
        });
        // The module renders and writes the outcome line itself - "N found",
        // or its noResultsMessage(), which reads TEXT.NONE_FOUND in API mode.
        // ONE status write per outcome, so nothing is written here.
        onResults(results, query);
      } catch (error) {
        if (error && error.refused) {
          onStatus(error.message);
        } else if (isAbort(error)) {
          onStatus(TEXT.CANCELLED);
        } else {
          onStatus(
            TEXT.FAILED_PREFIX + ((error && error.message) || "unknown error"),
          );
        }
      } finally {
        setBusy(false);
        markDone();
      }
    }

    function cancelSend() {
      if (!busy) return false;
      const had = cancel();
      if (el.input) el.input.focus();
      return had;
    }

    if (el.sendButton) {
      el.sendButton.addEventListener("click", function () {
        send(el.input ? el.input.value : "");
      });
    }
    if (el.cancelButton) {
      el.cancelButton.addEventListener("click", cancelSend);
    }

    return {
      applyMode: applyMode,
      isApiMode: function () {
        return appliedApiMode === true;
      },
      isBusy: function () {
        return busy;
      },
      showHint: showHint,
      send: send,
      cancel: cancelSend,
      /** For tests: the original label text this binding will restore */
      getOriginalLabel: function () {
        return original.label;
      },
    };
  }

  // ========================================================================
  // Public API
  // ========================================================================

  logDebug("Course search API fallback loaded");

  return {
    isApiMode: isApiMode,
    checkRefusal: checkRefusal,
    search: search,
    cancel: cancel,
    whenSettled: whenSettled,
    mapRow: mapRow,
    createBinding: createBinding,
    isInFlight: function () {
      return inFlight !== null;
    },
    /** Tests only: forget the session memo */
    clearMemo: function () {
      memo.clear();
    },
    memoSize: function () {
      return memo.size;
    },
    CONFIG: CONFIG,
    OPERATORS: OPERATORS,
    REFUSAL: REFUSAL,
    TEXT: TEXT,
  };
})();

if (typeof window !== "undefined") {
  window.ALLY_COURSE_SEARCH_API = ALLY_COURSE_SEARCH_API;
}
