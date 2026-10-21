// Export-time step for Standalone HTML (target 'html'): store MathJax's own SVG for each
// equation, and Read Aloud's speech for both styles, inside the finished file, so a file
// opened with no internet shows real maths and Read Aloud speaks it.
//
//   shouldRunOfflineMaths(options, html, env) -> boolean   (the gate, pure)
//   addOfflineMaths(html, options, deps)      -> string|null (never throws; null = leave the export alone)
//   harvestOfflineMaths(html, options)        -> data|null  (browser only; null on ANY failure)
//   insertOfflineMaths(html, data)            -> string|null (pure; keeps the save copy identical)
//
// How the harvest works: the finished export is loaded into a hidden same-origin frame with
// its MathJax loader swapped from tex-chtml.js to tex-svg.js. The export's own Read Aloud
// computes the speech, so the stored strings are what the file would say online. The frame
// is removed afterwards and the page that built the export is left as it was.
//
// Nothing here may change the export when it fails: every failure path returns null and the
// caller keeps the plain export, byte-identical to a build with `offlineMaths: false`.

import { decodeBase64Utf8, encodeBase64Utf8 } from "../util/base64.js";
import { resolveConfig } from "../scorm/config.js";
import { getScript } from "../assets/index.js";

// The whole step gives up after this long. A normal run takes 1.5 to 3.3 s; a connection that
// hangs raises no error at all, so only this bound reaches it.
export const OFFLINE_MATHS_TIMEOUT_MS = 20000;

const SPEECH_ATTR = "data-read-aloud-speech";
const CHTML_FILE = "tex-chtml.js";
const SVG_FILE = "tex-svg.js";
const LOADER_TAG_START = '<script id="MathJax-script" async src="';
const DATA_SCRIPT_ID = "offline-maths-data";
const RUNTIME_KEY = "offline-maths.js";
const POLL_MS = 20;
const READ_ALOUD_WAIT_MS = 10000;
const SPEECH_STYLES = Object.freeze([
  { key: "cs", style: "clearspeak" },
  { key: "ms", style: "mathspeak" },
]);

// The empty placeholder html-assembler.js leaves for the save feature's base64 self-copy.
// test/unit/offline-maths.test.js pins this against what buildHtml really emits.
export const SAVE_EMBED_EMPTY = '<script type="application/octet-stream" id="original-content-data"></script>';
const SAVE_EMBED_FILLED = /<script type="application\/octet-stream" id="original-content-data">([A-Za-z0-9+/=]*)<\/script>/g;

// Listens for the loader's error BEFORE the loader script runs: the error can fire before any
// body script has executed, so the body runtime acts on this record or on the event, whichever
// comes first. No timer.
export const OFFLINE_MATHS_HEAD_LISTENER =
  "<script>(function(){var s=window.__offlineMathsState=window.__offlineMathsState||{err:false};" +
  "document.addEventListener('error',function(e){var t=e.target;" +
  "if(t&&t.id==='MathJax-script'){s.err=true;if(typeof s.onError==='function')s.onError();}},true);})();</script>";

// How the export's MathJax config states its display alignment (generators/mathjax-config.js: `chtml: { displayAlign: 'left'… }`).
const DISPLAY_ALIGN = /chtml: \{ displayAlign: '(left|center|right)'/;

// The same delimiters the export's MathJax config uses; only used to decide whether a document has maths.
const MATHS_PROBE = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\\begin\{[A-Za-z*]+\}/;

function defaultEnv() {
  return {
    window: typeof window !== "undefined" ? window : undefined,
    document: typeof document !== "undefined" ? document : undefined,
  };
}

/** True when the HTML outside its script and style blocks holds anything MathJax would typeset. */
export function documentHasMaths(html) {
  const text = String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  return MATHS_PROBE.test(text);
}

/**
 * The gate. The step runs only in a browser, only for MathJax from the network, only when the
 * document has maths, and unless the caller passes `offlineMaths: false`.
 */
export function shouldRunOfflineMaths(options = {}, html = "", env = defaultEnv()) {
  if (!env || !env.window || !env.document) return false;
  if ((options.mathjaxMode || "cdn") !== "cdn") return false;
  if (options.offlineMaths === false) return false;
  const features = options.features || {};
  if (features.mathjaxControls === false || features.readAloud === false) return false;
  return documentHasMaths(html);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Placed first in the frame's <head>: the frame gets its OWN in-memory storage, so the export's
// scripts can never write the page's, and it records the loader's error event.
const FRAME_SHIM =
  "(function(){function m(){var s={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(s,k)?s[k]:null}," +
  "setItem:function(k,v){s[k]=String(v)},removeItem:function(k){delete s[k]},clear:function(){s={}}," +
  "key:function(i){return Object.keys(s)[i]||null},get length(){return Object.keys(s).length}}}" +
  "['localStorage','sessionStorage'].forEach(function(n){Object.defineProperty(window,n,{configurable:true,value:m()})});" +
  "window.__offlineMathsFrameErr=false;" +
  "document.addEventListener('error',function(e){if(e.target&&e.target.id==='MathJax-script')window.__offlineMathsFrameErr=true},true);})();";

/** The HTML given to the hidden frame, or null when it is not in the shape this step expects. */
export function prepareFrameHtml(html, loaderUrl) {
  const head = html.indexOf("<head>");
  if (head < 0 || head > 400) return null;
  if (!loaderUrl.endsWith(CHTML_FILE)) return null;
  if (html.split(loaderUrl).length !== 2) return null;
  const svgUrl = loaderUrl.slice(0, -CHTML_FILE.length) + SVG_FILE;
  let swapped = html.replace(loaderUrl, () => svgUrl);
  // The export aligns display equations through its CHTML options; the SVG output has no such key and would centre
  // them, so the same alignment is handed to it. Without the CHTML option (an export built another way) nothing is added.
  swapped = swapped.replace(DISPLAY_ALIGN, (whole, align) => `svg: { displayAlign: '${align}' }, ${whole}`);
  const at = swapped.indexOf("<head>") + "<head>".length;
  return swapped.slice(0, at) + "\n<script>" + FRAME_SHIM + "</script>" + swapped.slice(at);
}

/**
 * Load the finished export into a hidden frame with MathJax's SVG output, let the export's own
 * Read Aloud compute speech for both styles, and collect it all. Returns null on ANY failure.
 * @returns {Promise<{css: string, items: Array<{m: string, d: boolean, svg: string|null, cs: string|null, ms: string|null}>}|null>}
 */
export async function harvestOfflineMaths(html, options = {}) {
  const env = options.env || defaultEnv();
  const host = env.window;
  if (!host || !env.document || !env.document.body) return null;
  const timeoutMs = options.timeoutMs || OFFLINE_MATHS_TIMEOUT_MS;
  const loaderUrl = options.loaderUrl || resolveConfig(options.scormConfig).CDN_MATHJAX_URL;

  const ABORTED = Symbol("offline-maths-aborted");
  let timer = null;
  let frame = null;
  let blobUrl = null;
  const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(ABORTED), timeoutMs); });
  const guard = (promise) => Promise.race([promise, deadline]);
  const stopAt = Date.now() + timeoutMs;

  // Poll `read` until it returns something truthy, the deadline passes, or `ms` runs out.
  async function waitFor(read, ms) {
    const until = Math.min(stopAt, Date.now() + ms);
    for (;;) {
      const value = read();
      if (value) return value;
      if (Date.now() >= until) return null;
      await sleep(POLL_MS);
    }
  }

  const containers = (win) => Array.from(win.document.querySelectorAll("mjx-container")).filter((c) => !c.closest("mjx-assistive-mml"));

  // One speech pass: clear the attribute so the other style's string cannot be read as this one's,
  // switch the reader's saved style (the frame's own storage), and have Read Aloud generate.
  async function speechPass(win, style, roots) {
    const rm = win.readAloudManager;
    if (!rm) return null;
    if (rm._mathSpeechPending) {
      const settled = await guard(Promise.resolve(rm._mathSpeechPending).catch(() => {}));
      if (settled === ABORTED) return null;
    }
    win.localStorage.setItem("user-maths-speech", style);
    containers(win).forEach((c) => c.removeAttribute(SPEECH_ATTR));
    rm.resetMathSpeech();
    const generated = await guard(rm.ensureMathSpeech().then(() => true, () => false));
    if (generated === ABORTED || generated !== true || !rm._mathSpeechDone) return null;
    return roots.map((root) => (root ? root.getAttribute(SPEECH_ATTR) : null));
  }

  async function flow() {
    const prepared = prepareFrameHtml(html, loaderUrl);
    if (!prepared) return null;
    blobUrl = host.URL.createObjectURL(new host.Blob([prepared], { type: "text/html" }));
    frame = env.document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("inert", "");
    frame.tabIndex = -1;
    frame.title = "Maths conversion (hidden)";
    frame.style.cssText = "position:fixed;left:-20000px;top:0;width:1200px;height:900px;border:0;";
    const loaded = new Promise((resolve) => { frame.onload = () => resolve(true); });
    frame.src = blobUrl;
    env.document.body.appendChild(frame);
    if ((await guard(loaded)) === ABORTED) return null;
    const win = frame.contentWindow;
    if (!win) return null;

    // The loader's error event means no maths will ever appear in the frame: give up at once.
    const startup = await waitFor(() => {
      if (win.__offlineMathsFrameErr) return "error";
      return win.MathJax && win.MathJax.startup && win.MathJax.startup.promise ? "ready" : null;
    }, timeoutMs);
    if (startup !== "ready") return null;
    if ((await guard(win.MathJax.startup.promise.then(() => true, () => false))) !== true) return null;
    if (!(await waitFor(() => win.readAloudManager, READ_ALOUD_WAIT_MS))) return null;

    const list = win.MathJax.startup.document.math;
    const math = typeof list.toArray === "function" ? list.toArray() : Array.from(list);
    if (!math.length) return null;

    // SVG first, before any speech pass, so Read Aloud's attribute is never in the stored markup.
    // The attribute and any tabindex are removed from the stored copy; MathJax's other markup,
    // its assistive MathML included, is kept exactly as drawn.
    const roots = math.map((m) => m.typesetRoot || null);
    const items = math.map((m, index) => {
      const root = roots[index];
      if (!root) return { m: m.math, d: !!m.display, svg: null, cs: null, ms: null };
      const copy = root.cloneNode(true);
      copy.removeAttribute(SPEECH_ATTR);
      copy.removeAttribute("tabindex");
      return { m: m.math, d: !!m.display, svg: copy.outerHTML, cs: null, ms: null };
    });
    if (!items.some((item) => item.svg)) return null;

    const css = Array.from(win.document.querySelectorAll("style"))
      .filter((style) => /^MJX-/.test(style.id))
      .map((style) => style.textContent)
      .join("\n");

    for (const { key, style } of SPEECH_STYLES) {
      const speech = await speechPass(win, style, roots);
      if (!speech) return null;
      speech.forEach((text, index) => { items[index][key] = text || null; });
    }
    return { css, items };
  }

  try {
    const result = await Promise.race([flow(), deadline]);
    return result === ABORTED ? null : result;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
    if (frame) frame.remove();
    if (blobUrl) host.URL.revokeObjectURL(blobUrl);
  }
}

// The data block is inert JSON. A "<" is written as < so nothing in the stored markup, not
// even a planted "</script>" in a \text{}, can close the script element that holds it.
export function serialiseOfflineData(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function dataBlock(data) {
  return `<script type="application/json" id="${DATA_SCRIPT_ID}">${serialiseOfflineData(data)}</script>`;
}

function runtimeBlock() {
  return `<script>\n${getScript(RUNTIME_KEY)}\n</script>`;
}

function countOf(text, needle) {
  return text.split(needle).length - 1;
}

// Put the listener before the loader tag and the data and runtime at the end of the body (before
// the save feature's embed when there is one). `doc` is a document whose embed, if any, is EMPTY.
function insertIntoDocument(doc, data) {
  if (countOf(doc, LOADER_TAG_START) !== 1) return null;
  const withListener = doc.replace(LOADER_TAG_START, () => OFFLINE_MATHS_HEAD_LISTENER + "\n" + LOADER_TAG_START);
  const block = dataBlock(data) + "\n" + runtimeBlock() + "\n";
  const embedAt = withListener.indexOf(SAVE_EMBED_EMPTY);
  if (embedAt >= 0) {
    if (countOf(withListener, SAVE_EMBED_EMPTY) !== 1) return null;
    // buildHtml puts the embed on its own line straight after the feature scripts.
    return withListener.slice(0, embedAt) + block + withListener.slice(embedAt);
  }
  const bodyEnd = withListener.lastIndexOf("</body>");
  if (bodyEnd < 0) return null;
  return withListener.slice(0, bodyEnd) + block + withListener.slice(bodyEnd);
}

/**
 * Add the stored maths to a finished export. With the save feature on, the file carries a base64
 * copy of itself that the in-page Save button hands back, so the stored maths has to be inside
 * THAT copy too: the embed is decoded, the same insertion is made, and it is encoded again. The
 * result is exactly what building with the data would have produced. Returns null if the file is
 * not in the shape this expects, and the caller then keeps the plain export.
 */
export function insertOfflineMaths(html, data) {
  if (typeof html !== "string" || !data || !Array.isArray(data.items)) return null;
  const matches = Array.from(html.matchAll(SAVE_EMBED_FILLED));
  if (matches.length === 0) {
    if (html.includes(SAVE_EMBED_EMPTY)) return null; // an embed that was never filled: not a shape we know
    return insertIntoDocument(html, data);
  }
  if (matches.length !== 1) return null;
  const encoded = matches[0][1];
  const filledTag = SAVE_EMBED_EMPTY.replace("></script>", `>${encoded}</script>`);
  const original = decodeBase64Utf8(encoded);
  // Prove the decode is the document the file was built from: filling it back must give the file.
  if (original.replace(SAVE_EMBED_EMPTY, () => filledTag) !== html) return null;
  const enriched = insertIntoDocument(original, data);
  if (enriched === null) return null;
  const reEncoded = encodeBase64Utf8(enriched);
  return enriched.replace(SAVE_EMBED_EMPTY, () => SAVE_EMBED_EMPTY.replace("></script>", `>${reEncoded}</script>`));
}

/**
 * The call buildStandaloneHtml makes. NEVER throws: a failure of any kind, a timeout, a document
 * with no maths, returns null and the caller keeps the plain export.
 */
export async function addOfflineMaths(html, options = {}, deps = {}) {
  try {
    const harvest = deps.harvest || harvestOfflineMaths;
    const data = await harvest(html, {
      timeoutMs: options.offlineMathsTimeoutMs,
      scormConfig: options.scormConfig,
    });
    if (!data || !Array.isArray(data.items) || !data.items.length) return null;
    return insertOfflineMaths(html, data);
  } catch (e) {
    return null;
  }
}
