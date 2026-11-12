/**
 * @file mathpix-braille-engine.js
 * @description Lazy braille engine (BR-3a): MathCAT (maths to UEB or Nemeth braille) and liblouis (text to UEB grade 1 or
 * grade 2), both vendored under mathpix-scripts/vendor/braille/ and run in a Worker. Exposed as window.MathPixBrailleEngine.
 *
 * Nothing is fetched until ensureReady() is first called. It then fetches the four gzipped files (about 1.26 MB), inflates
 * them with DecompressionStream, starts the Worker, loads both libraries, and runs a self-test taken from
 * mathpix-braille-canary.json. If any step fails it resolves to a refusal { ok: false, reason } with a plain English
 * reason, and every later call refuses with that reason. No raw error text is ever returned to the caller.
 *
 * API (all async calls resolve; none rejects for a bad expression):
 *   ensureReady()                              -> { ok: true, versions, timings } | { ok: false, reason }
 *   status()                                   -> "idle" | "loading" | "ready" | "refused"; fetches nothing (the page's resource
 *                                                 timing list is full at load and cannot show a vendored fetch, so this is the check)
 *   translateMath(mathmlList, { code })        -> [{ ok, braille } | { ok: false, reason }], input order; code "UEB" | "Nemeth"
 *   translateText(textList, { table })         -> same shape; table "en-ueb-g2" | "en-ueb-g1". Each item is a string, or
 *                                                 { text, runs: [{ start, end, forms: ["bold", "italic", "underline", "script"] }] }
 *                                                 (BR-3c): start and end are character (code point) positions, end exclusive, and
 *                                                 liblouis adds the UEB typeform indicators itself. An unknown form refuses that item.
 *   backTranslateText(brailleList, { table })  -> same shape; Unicode braille back to text (liblouis only; MathCAT has no back-translation)
 *   toBrailleAscii(unicodeBraille)            -> string; throws BrailleAsciiError for a cell with dot 7 or 8, or a non-braille character
 *   fromBrailleAscii(ascii)                    -> Unicode braille string; throws BrailleAsciiError for a character with no cell
 *   version()                                  -> the pinned library versions (literals), plus what was reported once loaded
 *   createEngine(options)                      -> a second, independent engine; options: { vendorBase, workerUrl, canaryUrl }.
 *                                                 Used by the guard rows to prove a refused self-test. The shared engine is the default export.
 *
 * Both pure functions (the Braille ASCII map) run on the main thread and need no load.
 */
(function () {
  "use strict";

  // Logging configuration
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[BrailleEngine]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[BrailleEngine]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.info("[BrailleEngine]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.debug("[BrailleEngine]", message, ...args);
  }

  // Where this script was loaded from, read once while it runs; the Worker, the canary and the vendored files are resolved from it.
  const ENGINE_SCRIPT_URL = (typeof document !== "undefined" && document.currentScript && document.currentScript.src) || null;

  // ---- pinned versions (literals; the vendored files are the exact bytes BR-1 built and measured) ----
  const PINNED = Object.freeze({
    mathcat: Object.freeze({
      tag: "v0.7.7",
      commit: "764d24d1241b20c0973e9dbcee62d022c1f99a4a",
      reportedVersion: "0.7.6-rc.4", // the tag's Cargo.toml says this, and get_version() returns it
      wasmBindgen: "0.2.130",
    }),
    liblouis: Object.freeze({
      version: "3.39.0",
      jsBuildCommit: "a694d1d947d473677b5fe56c0faff360a9ce1a74",
    }),
  });

  const VENDOR_FILES = Object.freeze({
    mathcatGlue: "mathcat.js.gz",
    mathcatWasm: "mathcat_bg.wasm.gz",
    louisBuild: "liblouis-build.js.gz",
    louisTables: "ueb-tables.json.gz",
  });
  const WORKER_FILE = "mathpix-braille-worker.js";
  const CANARY_FILE = "mathpix-braille-canary.json";
  const VENDOR_RELATIVE_TO_ENGINE = "../vendor/braille/";
  const FALLBACK_CORE_PATH = "mathpix-scripts/core/";

  const PHASES = Object.freeze({ IDLE: "idle", LOADING: "loading", READY: "ready", REFUSED: "refused" });
  const MATH_CODES = Object.freeze(["UEB", "Nemeth"]);
  const TEXT_TABLES = Object.freeze(["en-ueb-g2", "en-ueb-g1"]);

  // Every reason is fixed plain English. Raw errors go to the log at debug level only.
  const REASONS = Object.freeze({
    unsupportedBrowser: "This browser cannot run the braille converter.",
    downloadFailed: "The braille files could not be downloaded. Check your connection and try again.",
    startFailed: "The braille converter could not start.",
    selfTestFailed: "The braille converter did not pass its own check, so it has been switched off.",
    stopped: "The braille converter stopped unexpectedly.",
    badCode: "That braille code is not available.",
    badTable: "That braille table is not available.",
  });

  // ---- Braille ASCII (the standard 64-cell map) ----
  // The string is indexed by the cell's dot pattern: dot 1 is bit 0, dot 2 bit 1, ... dot 6 bit 5.
  const BRAILLE_ASCII = " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=";
  const UNICODE_BRAILLE_BASE = 0x2800;
  const SIX_DOT_CELL_COUNT = 64;
  const UNICODE_BRAILLE_LAST = 0x28ff;
  const PASS_THROUGH = Object.freeze(["\n", "\r"]);

  const BrailleAsciiErrorKind = Object.freeze({
    DOT_7_OR_8: "dot-7-or-8",
    NOT_BRAILLE: "not-braille",
    NOT_BRAILLE_ASCII: "not-braille-ascii",
  });

  /** Typed error for the Braille ASCII map. `kind`, `char` and `index` describe it; `plainMessage` is words for a person. */
  class BrailleAsciiError extends Error {
    constructor(kind, char, index) {
      super("Braille ASCII conversion refused: " + kind);
      this.name = "BrailleAsciiError";
      this.kind = kind;
      this.char = char;
      this.index = index;
    }
    get plainMessage() {
      if (this.kind === BrailleAsciiErrorKind.DOT_7_OR_8) {
        return "This braille uses an eight-dot cell, which Braille ASCII cannot show.";
      }
      if (this.kind === BrailleAsciiErrorKind.NOT_BRAILLE) {
        return "This text holds a character that is not a braille cell.";
      }
      return "This text holds a character that has no braille cell.";
    }
  }

  function toBrailleAscii(unicodeBraille) {
    if (typeof unicodeBraille !== "string") throw new TypeError("toBrailleAscii needs a string");
    let out = "";
    let index = 0;
    for (const char of unicodeBraille) {
      const code = char.codePointAt(0);
      if (code >= UNICODE_BRAILLE_BASE && code <= UNICODE_BRAILLE_LAST) {
        const pattern = code - UNICODE_BRAILLE_BASE;
        if (pattern >= SIX_DOT_CELL_COUNT) throw new BrailleAsciiError(BrailleAsciiErrorKind.DOT_7_OR_8, char, index);
        out += BRAILLE_ASCII[pattern];
      } else if (PASS_THROUGH.includes(char)) {
        out += char;
      } else {
        throw new BrailleAsciiError(BrailleAsciiErrorKind.NOT_BRAILLE, char, index);
      }
      index += 1;
    }
    return out;
  }

  function fromBrailleAscii(ascii) {
    if (typeof ascii !== "string") throw new TypeError("fromBrailleAscii needs a string");
    let out = "";
    let index = 0;
    for (const char of ascii) {
      const pattern = BRAILLE_ASCII.indexOf(char.toUpperCase());
      if (pattern >= 0) {
        out += String.fromCharCode(UNICODE_BRAILLE_BASE + pattern);
      } else if (PASS_THROUGH.includes(char)) {
        out += char;
      } else {
        throw new BrailleAsciiError(BrailleAsciiErrorKind.NOT_BRAILLE_ASCII, char, index);
      }
      index += 1;
    }
    return out;
  }

  // ---- the engine ----

  const now = () => performance.now();
  const round = (n) => Math.round(n * 10) / 10;
  const refusal = (reason) => Object.freeze({ ok: false, reason });
  const refuseEach = (list, reason) => list.map(() => ({ ok: false, reason }));

  function defaultUrls() {
    const base = ENGINE_SCRIPT_URL || new URL(FALLBACK_CORE_PATH + "mathpix-braille-engine.js", document.baseURI).href;
    return {
      vendorBase: new URL(VENDOR_RELATIVE_TO_ENGINE, base).href,
      workerUrl: new URL(WORKER_FILE, base).href,
      canaryUrl: new URL(CANARY_FILE, base).href,
    };
  }

  /** Fetch one gzipped file and inflate it. Returns the inflated bytes as an ArrayBuffer. */
  async function fetchInflated(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("HTTP " + response.status + " for " + url);
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).arrayBuffer();
  }

  function createEngine(options) {
    const urls = Object.assign(defaultUrls(), options || {});
    let readyPromise = null;
    let phase = PHASES.IDLE;
    let state = null; // set once ensureReady settles: the ok result or a refusal
    let worker = null;
    let loadedVersions = null;
    let nextId = 1;
    const pending = new Map();

    function request(type, payload, transfer) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, type, payload }, transfer || []);
      });
    }

    function failPending(message) {
      for (const { reject } of pending.values()) reject(new Error(message));
      pending.clear();
    }

    function startWorker() {
      worker = new Worker(urls.workerUrl, { type: "module" });
      worker.onmessage = (event) => {
        const { id, result, error } = event.data;
        const waiting = pending.get(id);
        if (!waiting) return;
        pending.delete(id);
        if (error !== undefined) waiting.reject(new Error(error));
        else waiting.resolve(result);
      };
      worker.onerror = (event) => {
        logError("worker error", event && event.message);
        failPending("the worker stopped");
        state = refusal(REASONS.stopped);
      };
    }

    function stopWorker() {
      if (worker) worker.terminate();
      worker = null;
      failPending("the engine was shut down");
    }

    /** Run every canary case; returns the ids that did not match. */
    async function runSelfTest(canary) {
      const misses = [];
      for (const code of MATH_CODES) {
        const cases = canary.mathCases.filter((c) => c.code === code);
        if (cases.length === 0) continue;
        const out = await request("math", { items: cases.map((c) => c.mathml), code });
        cases.forEach((c, i) => {
          if (!out[i].ok || out[i].braille !== c.expected) misses.push(c.id);
        });
      }
      for (const table of TEXT_TABLES) {
        const cases = canary.textCases.filter((c) => c.table === table);
        if (cases.length === 0) continue;
        const forward = await request("text", { items: cases.map((c) => c.text), table });
        const back = await request("back", { items: forward.map((f) => (f.ok ? f.braille : "")), table });
        cases.forEach((c, i) => {
          const expectedBack = c.back !== undefined ? c.back : c.text;
          if (!forward[i].ok || forward[i].braille !== c.expected || !back[i].ok || back[i].braille !== expectedBack) misses.push(c.id);
        });
      }
      return misses;
    }

    async function load() {
      const timings = {};
      const t0 = now();
      if (typeof Worker === "undefined" || typeof DecompressionStream === "undefined") {
        return refusal(REASONS.unsupportedBrowser);
      }

      let files;
      let canary;
      try {
        const t1 = now();
        const names = Object.keys(VENDOR_FILES);
        const [inflated, canaryResponse] = await Promise.all([
          Promise.all(names.map((n) => fetchInflated(urls.vendorBase + VENDOR_FILES[n]))),
          fetch(urls.canaryUrl).then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status + " for the canary");
            return r.json();
          }),
        ]);
        files = Object.fromEntries(names.map((n, i) => [n, inflated[i]]));
        canary = canaryResponse;
        timings.fetchAndInflateMs = round(now() - t1);
      } catch (e) {
        logDebug("download failed", String((e && e.message) || e).slice(0, 200));
        return refusal(REASONS.downloadFailed);
      }

      try {
        const t2 = now();
        startWorker();
        loadedVersions = await request("init", { files }, Object.values(files));
        timings.workerLoadMs = round(now() - t2);
      } catch (e) {
        logDebug("worker start failed", String((e && e.message) || e).slice(0, 200));
        stopWorker();
        return refusal(REASONS.startFailed);
      }

      try {
        const t3 = now();
        const versionsMatch = loadedVersions.mathcat === PINNED.mathcat.reportedVersion && loadedVersions.liblouis === PINNED.liblouis.version;
        const misses = versionsMatch ? await runSelfTest(canary) : ["versions"];
        timings.selfTestMs = round(now() - t3);
        if (misses.length > 0) {
          logWarn("self-test did not pass", misses);
          stopWorker();
          return refusal(REASONS.selfTestFailed);
        }
      } catch (e) {
        logDebug("self-test threw", String((e && e.message) || e).slice(0, 200));
        stopWorker();
        return refusal(REASONS.selfTestFailed);
      }

      timings.totalMs = round(now() - t0);
      logInfo("braille engine ready", timings);
      return Object.freeze({ ok: true, versions: Object.freeze({ ...loadedVersions }), timings: Object.freeze(timings) });
    }

    function ensureReady() {
      if (!readyPromise) {
        phase = PHASES.LOADING;
        readyPromise = load().then(
          (result) => {
            state = state && !state.ok ? state : result;
            phase = state.ok ? PHASES.READY : PHASES.REFUSED;
            return state;
          },
          (e) => {
            logError("unexpected load failure", e);
            phase = PHASES.REFUSED;
            return (state = refusal(REASONS.startFailed));
          }
        );
      }
      return readyPromise;
    }

    /** "idle" until ensureReady() is first called, then "loading", then "ready" or "refused". Fetches nothing. */
    function status() {
      return state && !state.ok ? PHASES.REFUSED : phase;
    }

    /** Run one batch through the Worker. A thrown request failure becomes a refusal for every entry. */
    async function run(type, list, extra) {
      const ready = await ensureReady();
      if (!ready.ok) return refuseEach(list, ready.reason);
      if (state && !state.ok) return refuseEach(list, state.reason);
      try {
        return await request(type, { items: list, ...extra });
      } catch (e) {
        logDebug("request failed", String((e && e.message) || e).slice(0, 200));
        return refuseEach(list, REASONS.stopped);
      }
    }

    async function translateMath(mathmlList, options) {
      if (!Array.isArray(mathmlList)) throw new TypeError("translateMath needs an array");
      const code = options && options.code;
      if (!MATH_CODES.includes(code)) return refuseEach(mathmlList, REASONS.badCode);
      return run("math", mathmlList, { code });
    }

    async function translateText(textList, options) {
      if (!Array.isArray(textList)) throw new TypeError("translateText needs an array");
      const table = options && options.table;
      if (!TEXT_TABLES.includes(table)) return refuseEach(textList, REASONS.badTable);
      return run("text", textList, { table });
    }

    /** Braille (Unicode cells) back to text, with the same table names as translateText. Same result shape. */
    async function backTranslateText(brailleList, options) {
      if (!Array.isArray(brailleList)) throw new TypeError("backTranslateText needs an array");
      const table = options && options.table;
      if (!TEXT_TABLES.includes(table)) return refuseEach(brailleList, REASONS.badTable);
      // With { forms: true } the text comes back with emphasis shown as ** ** (bold) and _ _ (italic), for the proof file.
      return run("back", brailleList, { table, forms: !!(options && options.forms) });
    }

    function version() {
      return { mathcat: { ...PINNED.mathcat }, liblouis: { ...PINNED.liblouis }, loaded: loadedVersions ? { ...loadedVersions } : null };
    }

    return { ensureReady, status, translateMath, translateText, backTranslateText, version, toBrailleAscii, fromBrailleAscii };
  }

  const shared = createEngine();
  window.MathPixBrailleEngine = Object.freeze({ ...shared, createEngine, BrailleAsciiError, BrailleAsciiErrorKind });

  logInfo("Braille engine registered (nothing fetched until ensureReady())");
})();
