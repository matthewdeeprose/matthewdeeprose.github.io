/**
 * @file tikz-kit-worker.js
 * @description The Worker half of TikzKit. It runs the TeX step only (`tex()`), so a TeX run that never yields cannot
 * freeze the page: the page terminates this Worker on timeout or abort and starts a fresh one. The SVG step (dvi2svg)
 * needs page-only DOM calls and stays on the page. Loaded by tikz-kit.js with `new Worker(url)`; never loaded by a `<script>` tag.
 *
 * Messages in:  { type: "init", engineUrl, texUrl }    load vendor/tikz-worker-engine.js and preload the TeX resources
 *               { type: "tex", id, input, options }    run TeX on `input`
 * Messages out: { type: "ready" } | { type: "init-error", message }
 *               { type: "log", id, line }              one captured TeX console line, sent as it arrives
 *               { type: "done", id, dvi }              the DVI bytes (a transferred ArrayBuffer view)
 *               { type: "fail", id, message }
 *
 * It makes no request except for its own engine bundle and the TeX resources under `texUrl` (the page checks both are same-origin).
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

  // These write to console.error / console.warn, never console.log: tex() runs with console.log replaced.
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[TikzKitWorker]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[TikzKitWorker]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.info("[TikzKitWorker]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.debug("[TikzKitWorker]", message, ...args);
  }

  let engine = null;
  let loader = null;

  async function init(msg) {
    importScripts(msg.engineUrl);
    engine = self.TikzKitWorkerEngine;
    if (!engine) throw new Error("the worker engine bundle did not define TikzKitWorkerEngine");
    loader = new engine.BrowserResourceLoader(msg.texUrl);
    await loader.preload();
    logDebug("ready");
  }

  async function runTex(msg) {
    const original = console.log;
    const patched = function () {
      self.postMessage({ type: "log", id: msg.id, line: Array.prototype.map.call(arguments, String).join(" ") });
    };
    console.log = patched;
    try {
      const dvi = await engine.tex(msg.input, msg.options, loader);
      // a fresh, owned buffer: the engine's Buffer may share a pool, and only an owned buffer can be transferred
      const bytes = new Uint8Array(dvi);
      self.postMessage({ type: "done", id: msg.id, dvi: bytes }, [bytes.buffer]);
    } catch (e) {
      try {
        engine.reset(); // a throw can leave the engine's module state dirty
      } catch (resetError) {
        logError("engine reset threw", resetError);
      }
      self.postMessage({ type: "fail", id: msg.id, message: String((e && e.message) || e) });
    } finally {
      if (console.log === patched) console.log = original;
    }
  }

  self.onmessage = function (ev) {
    const msg = ev.data || {};
    if (msg.type === "init") {
      init(msg).then(
        () => self.postMessage({ type: "ready" }),
        (e) => self.postMessage({ type: "init-error", message: String((e && e.message) || e) })
      );
    } else if (msg.type === "tex") {
      if (!engine) {
        self.postMessage({ type: "fail", id: msg.id, message: "the worker was asked to run TeX before it was ready" });
        return;
      }
      runTex(msg);
    } else {
      logWarn("unknown message type", msg.type);
    }
  };
})();
