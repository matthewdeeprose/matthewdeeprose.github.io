/**
 * @file mathpix-braille-worker.js
 * @description The Worker half of the braille engine (BR-3a). It hosts MathCAT (WebAssembly, wasm-bindgen web target) and
 * liblouis (a synchronous JavaScript build) off the main thread. Started by mathpix-braille-engine.js with
 * `new Worker(url, { type: "module" })`; never loaded by a `<script>` tag. A module Worker is needed only because the
 * MathCAT glue is an ES module, and it is imported with a dynamic import() from a blob URL: this file has no static
 * import or export.
 *
 * Messages in:  { id, type: "init", files }     files: { mathcatGlue, mathcatWasm, louisBuild, louisTables } (ArrayBuffers)
 *               { id, type: "math", items, code }   items: MathML strings; code: "UEB" | "Nemeth"
 *               { id, type: "text", items, table }  items: strings; table: "en-ueb-g2" | "en-ueb-g1"
 *               { id, type: "back", items, table }  items: Unicode braille strings (back-translation, for the self-test)
 * Messages out: { id, result } or { id, error }; `error` is a short string for the log, never shown to a person.
 *
 * No threads and no SharedArrayBuffer: everything runs on this one Worker thread. It makes no request of its own.
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[BrailleWorker]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[BrailleWorker]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.info("[BrailleWorker]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.debug("[BrailleWorker]", message, ...args);
  }

  // liblouis constants (the UTF-32 build: one wide character is four bytes)
  const LOUIS_LOG_LEVEL_OFF = 100000;
  const WIDECHAR_BYTES = 4;
  const BUFFER_SLACK = 8; // output can be longer than input once cells are inserted
  const MODE_DEFAULT = 0;
  const TYPEFORM_NONE = 0;
  const TYPEFORM_BYTES = 2; // liblouis formtype is an unsigned 16-bit value
  // Bit values of the UEB tables' emphasis classes, in the order en-ueb-g1 declares them (italic, underline, bold, script).
  const TYPEFORM_BITS = Object.freeze({ italic: 1, underline: 2, bold: 4, script: 8 });
  const TYPEFORM_MASK = 0x0f; // only the four emphasis classes; liblouis keeps other bits for itself
  const PROOF_MARK = Object.freeze({ bold: "**", italic: "_" });
  const TABLES_DIR = "/tables";

  // The Unicode display table turns liblouis's default ASCII braille into Unicode cells.
  const LOUIS_TABLES = Object.freeze({
    "en-ueb-g2": Object.freeze(["unicode.dis", "en-ueb-g2.ctb"]),
    "en-ueb-g1": Object.freeze(["unicode.dis", "en-ueb-g1.ctb"]),
  });
  const MATHCAT_CODES = Object.freeze(["UEB", "Nemeth"]);

  // Reasons are fixed plain English. The raw error from either library goes to the log only.
  const REASONS = Object.freeze({
    notText: "There was nothing to convert.",
    mathInvalid: "This expression could not be converted to braille.",
    textInvalid: "This text could not be converted to braille.",
    badCode: "That braille code is not available.",
    badTable: "That braille table is not available.",
    notReady: "The braille converter has not been started.",
  });

  let mathcat = null;
  let louis = null;

  // ---- liblouis wrapper (the same calls the BR-1 probe proved) ----

  /** Evaluate the prebuilt build source and return its Emscripten Module. It builds itself on evaluation. */
  function instantiateLouis(buildSource) {
    // With no window and no importScripts the build takes the Emscripten "shell" branch, which reads global print and
    // printErr; supply silent ones in the wrapper scope.
    const evaluate = new Function("print", "printErr", buildSource + "\nreturn liblouisBuild;");
    return evaluate(function () {}, function () {});
  }

  /** Write a { "name": "text" } bundle into the in-memory file system under /tables. */
  function mountTables(Module, bundle) {
    Module.FS_createPath("/", "tables", true, true);
    // Pass UTF-8 BYTES, not a string: this Emscripten's FS_createDataFile turns a string into one byte per UTF-16 unit,
    // which cuts the combining characters in en-ueb-chardefs.uti and makes the table fail to compile.
    const encoder = new TextEncoder();
    for (const [name, text] of Object.entries(bundle)) {
      Module.FS_createDataFile(TABLES_DIR, name, encoder.encode(text), true, false);
    }
    Module.ccall("lou_setDataPath", null, ["string"], [TABLES_DIR + "/"]);
    Module.ccall("lou_setLogLevel", null, ["number"], [LOUIS_LOG_LEVEL_OFF]);
  }

  function toWide(Module, text) {
    const codePoints = Array.from(text, (c) => c.codePointAt(0));
    const ptr = Module._malloc((codePoints.length + 1) * WIDECHAR_BYTES);
    codePoints.forEach((cp, i) => Module.setValue(ptr + i * WIDECHAR_BYTES, cp, "i32"));
    return { ptr, length: codePoints.length };
  }

  function fromWide(Module, ptr, length) {
    let s = "";
    for (let i = 0; i < length; i++) s += String.fromCodePoint(Module.getValue(ptr + i * WIDECHAR_BYTES, "i32"));
    return s;
  }

  /**
   * The typeform array liblouis reads: one unsigned 16-bit mask per input character (BR-3c). `runs` is
   * [{ start, end, forms: ["bold", "italic", ...] }] with character (code point) indices, end exclusive.
   * Returns the masks, or null when there is nothing to carry. Throws on a form name it does not know.
   */
  function typeformMasks(length, runs) {
    if (!Array.isArray(runs) || runs.length === 0) return null;
    const masks = new Array(length).fill(TYPEFORM_NONE);
    for (const run of runs) {
      let mask = TYPEFORM_NONE;
      for (const form of run.forms || []) {
        if (!Object.prototype.hasOwnProperty.call(TYPEFORM_BITS, form)) throw new Error("unknown typeform " + form);
        mask |= TYPEFORM_BITS[form];
      }
      const end = Math.min(length, run.end);
      for (let i = Math.max(0, run.start); i < end; i++) masks[i] |= mask;
    }
    return masks;
  }

  /**
   * Back-translated text with its emphasis shown as plain markers (the proof file): bold in ** **, italic in _ _.
   * `forms` is one mask per output character, as liblouis reports it.
   */
  function markForms(text, forms) {
    const chars = Array.from(text);
    let out = "";
    let i = 0;
    while (i < chars.length) {
      const mask = forms[i] || TYPEFORM_NONE;
      let j = i;
      while (j < chars.length && (forms[j] || TYPEFORM_NONE) === mask) j++;
      const open = (mask & TYPEFORM_BITS.bold ? PROOF_MARK.bold : "") + (mask & TYPEFORM_BITS.italic ? PROOF_MARK.italic : "");
      const close = (mask & TYPEFORM_BITS.italic ? PROOF_MARK.italic : "") + (mask & TYPEFORM_BITS.bold ? PROOF_MARK.bold : "");
      const run = chars.slice(i, j).join("");
      if (open === "") {
        out += run;
      } else {
        // The markers sit tight round the words; any space at either end of the run stays outside them.
        const lead = run.match(/^\s*/)[0];
        const tail = run.match(/\s*$/)[0];
        const core = run.slice(lead.length, run.length - tail.length);
        out += core === "" ? run : lead + open + core + close + tail;
      }
      i = j;
    }
    return out;
  }

  function runLouis(fn, tables, text, runs, readForms) {
    const input = toWide(louis, text);
    const outCapacity = input.length * BUFFER_SLACK + BUFFER_SLACK;
    const outPtr = louis._malloc(outCapacity * WIDECHAR_BYTES);
    const inLenPtr = louis._malloc(4);
    const outLenPtr = louis._malloc(4);
    const masks = typeformMasks(input.length, runs);
    // liblouis may write the typeform array as well as read it, so it is as long as the output buffer.
    const wantForms = !!masks || readForms === true;
    const formPtr = wantForms ? louis._malloc(outCapacity * TYPEFORM_BYTES) : TYPEFORM_NONE;
    try {
      louis.setValue(inLenPtr, input.length, "i32");
      louis.setValue(outLenPtr, outCapacity, "i32");
      if (wantForms) {
        for (let i = 0; i < outCapacity; i++) louis.setValue(formPtr + i * TYPEFORM_BYTES, masks && i < masks.length ? masks[i] : TYPEFORM_NONE, "i16");
      }
      const ok = louis.ccall(
        fn,
        "number",
        ["string", "number", "number", "number", "number", "number", "number", "number"],
        [tables.map((t) => TABLES_DIR + "/" + t).join(","), input.ptr, inLenPtr, outPtr, outLenPtr, formPtr, 0, MODE_DEFAULT]
      );
      if (!ok) throw new Error(fn + " failed for " + tables.join(","));
      const outLength = louis.getValue(outLenPtr, "i32");
      const out = fromWide(louis, outPtr, outLength);
      if (readForms !== true) return out;
      const outForms = [];
      for (let i = 0; i < outLength; i++) outForms.push(louis.getValue(formPtr + i * TYPEFORM_BYTES, "i16") & TYPEFORM_MASK);
      return markForms(out, outForms);
    } finally {
      [input.ptr, outPtr, inLenPtr, outLenPtr].forEach((p) => louis._free(p));
      if (wantForms) louis._free(formPtr);
    }
  }

  // ---- request handlers ----

  const decode = (buffer) => new TextDecoder().decode(buffer);

  async function handleInit({ files }) {
    const blobUrl = URL.createObjectURL(new Blob([files.mathcatGlue], { type: "text/javascript" }));
    try {
      mathcat = await import(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
    await mathcat.default({ module_or_path: files.mathcatWasm });
    mathcat.init();
    louis = instantiateLouis(decode(files.louisBuild));
    mountTables(louis, JSON.parse(decode(files.louisTables)));
    return { mathcat: mathcat.version(), liblouis: louis.ccall("lou_version", "string", [], []) };
  }

  /** One entry per input, in order; one bad input fails that entry only. */
  function convertEach(items, convert, failReason) {
    return items.map((entry) => {
      // An item is a string, or { text, runs } where runs carry typeform (text translation only).
      const item = entry && typeof entry === "object" ? entry.text : entry;
      const runs = entry && typeof entry === "object" ? entry.runs : undefined;
      if (typeof item !== "string" || item.length === 0) return { ok: false, reason: REASONS.notText };
      try {
        return { ok: true, braille: convert(item, runs) };
      } catch (e) {
        logDebug("conversion failed", String((e && e.message) || e).slice(0, 200));
        return { ok: false, reason: failReason };
      }
    });
  }

  function handleMath({ items, code }) {
    if (!mathcat) return items.map(() => ({ ok: false, reason: REASONS.notReady }));
    if (!MATHCAT_CODES.includes(code)) return items.map(() => ({ ok: false, reason: REASONS.badCode }));
    return convertEach(items, (mathml) => mathcat.braille(mathml, code), REASONS.mathInvalid);
  }

  function handleText({ items, table, forms }, fn) {
    if (!louis) return items.map(() => ({ ok: false, reason: REASONS.notReady }));
    const tables = LOUIS_TABLES[table];
    if (!tables) return items.map(() => ({ ok: false, reason: REASONS.badTable }));
    return convertEach(items, (text, runs) => runLouis(fn, tables, text, runs, forms === true), REASONS.textInvalid);
  }

  const handlers = {
    init: handleInit,
    math: handleMath,
    text: (payload) => handleText(payload, "lou_translateString"),
    back: (payload) => handleText(payload, "lou_backTranslateString"),
  };

  self.onmessage = async function (event) {
    const { id, type, payload } = event.data || {};
    try {
      if (!handlers[type]) throw new Error("unknown request " + type);
      self.postMessage({ id, result: await handlers[type](payload) });
    } catch (e) {
      logWarn("request failed", type, String((e && e.message) || e).slice(0, 200));
      self.postMessage({ id, error: String((e && e.message) || e).slice(0, 300) });
    }
  };

  logInfo("braille worker script loaded");
})();
