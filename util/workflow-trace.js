/**
 * workflow-trace.js
 *
 * A no-build console helper that records a browser workflow into one ordered
 * timeline so you can automate it later. It captures, in order:
 *   - clicks (with a usable CSS selector and the element text)
 *   - fetch requests and responses (method, URL, body, status, duration)
 *   - XMLHttpRequest requests and responses
 *   - calls to functions you name, with their arguments and return values
 *
 * Usage (paste into the DevTools console, then run your workflow):
 *   trace.start();                       // begin capturing network and clicks
 *   trace.watch(window, ['doThing']);    // also trace named global functions
 *   trace.watch(myApp, ['save', 'load']); // or methods on an object
 *   trace.step('open editor');           // record a named stage marker
 *   trace.snapshot('mmd', () => ({ mmd: editor.value })); // capture state
 *   ... click through your workflow ...
 *   trace.export();                      // download the timeline as JSON
 *   trace.reset();                       // full teardown, leaves no residue
 *
 * Inspect live at any point with: trace.log
 *
 * RELOAD-SURVIVING: the timeline is mirrored to localStorage, so an F5 in the
 * middle of a capture does not wipe it. If tracing was active before the
 * reload it auto-resumes and drops a {type:"reload"} marker so you can see
 * exactly where the refresh happened. Use trace.reset() to wipe everything
 * (memory + both localStorage keys) when you are done.
 *
 * NOTE ON LOGGING: the internal logger below follows the level/flag shape from
 * the project Logging Standards (ERROR, WARN, INFO, DEBUG; default WARN;
 * ENABLE_ALL_LOGGING / DISABLE_ALL_LOGGING). Swap it for the exact CLAUDE.md
 * implementation if you want it to match the rest of the codebase. This logger
 * reports the tool's own behaviour; the captured workflow data lives in
 * trace.log, separate from these messages.
 */
const trace = (function () {
  'use strict';

  // --- Configuration -------------------------------------------------------
  const config = {
    maxString: 500,        // truncate captured strings to this length
    snapshotMaxString: 300, // truncate captured snapshot strings (opts.full bypasses)
    maxItems: 20,          // cap array entries and object keys when summarising
    maxDepth: 3,           // how deep to walk nested objects
    maxBody: 10000,        // truncate request and response bodies
    ignore: [],            // substrings; matching URLs are skipped (e.g. analytics)
  };

  // localStorage keys for the reload-surviving timeline and the active flag.
  const PERSIST_KEY = 'workflow-trace-timeline';
  const FLAG_KEY = 'workflow-trace-active';

  // Arm flag for the two-phase trace.selfTest() flush guard (see selfTest()).
  const SELFTEST_KEY = 'workflow-trace-selftest';

  // DOM ids for the self-owned recording indicator and its injected styles.
  const INDICATOR_ID = 'workflow-trace-indicator';
  const INDICATOR_STYLE_ID = 'workflow-trace-indicator-styles';

  // --- Internal logger (placeholder for the CLAUDE.md logger) --------------
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;
  let currentLevel = LOG_LEVELS.WARN;

  function logAt(level, args) {
    if (DISABLE_ALL_LOGGING) return;
    if (!ENABLE_ALL_LOGGING && LOG_LEVELS[level] > currentLevel) return;
    const sink = level === 'ERROR' ? console.error
      : level === 'WARN' ? console.warn
        : console.log;
    sink.apply(console, ['[trace:' + level + ']'].concat(args));
  }
  const log = {
    error: function () { logAt('ERROR', Array.prototype.slice.call(arguments)); },
    warn: function () { logAt('WARN', Array.prototype.slice.call(arguments)); },
    info: function () { logAt('INFO', Array.prototype.slice.call(arguments)); },
    debug: function () { logAt('DEBUG', Array.prototype.slice.call(arguments)); },
  };

  // --- State ---------------------------------------------------------------
  const timeline = [];
  const watched = new Map();   // key -> { target, name, original }
  let running = false;
  let requestId = 0;
  let originalFetch = null;
  let originalXhrOpen = null;
  let originalXhrSend = null;
  let clickHandler = null;
  let persistTimer = null;
  let flushHandler = null;     // single guarded ref for pagehide + beforeunload

  function nextId() { requestId += 1; return requestId; }

  // --- Reload-surviving persistence ----------------------------------------
  // Write the timeline to localStorage so a reload (F5) does not wipe it.
  // On a quota error we degrade gracefully: drop the oldest 25% and retry once.
  function writeTimeline() {
    persistTimer = null;
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify(timeline));
    } catch (err) {
      log.warn('Could not persist timeline (' + (err && err.name) +
        '); dropping oldest 25% and retrying once.');
      const drop = Math.max(1, Math.floor(timeline.length * 0.25));
      timeline.splice(0, drop);
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify(timeline));
      } catch (err2) {
        log.error('Persist retry failed (' + (err2 && err2.name) +
          '); timeline kept in memory only.');
      }
    }
  }

  // Debounce the write so a burst of records costs one serialise, not many.
  function persist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(writeTimeline, 250);
  }

  // Synchronous boundary flush: persist the timeline immediately, bypassing the
  // 250ms debounce, so the final records before an instant reload are not lost.
  // It cancels the SAME pending debounce timer and reuses writeTimeline()'s body
  // (single source of truth for the serialise + quota-degrade write to the SAME
  // PERSIST_KEY). Idempotent, and the outer try/catch guarantees it never throws
  // past navigation — a flush firing during unload must never break the reload.
  function flushTimelineSync() {
    try {
      if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
      writeTimeline();
    } catch (e) {
      try { log.debug('Synchronous flush failed: ' + e); } catch (ignore) { /* never throw past navigation */ }
    }
  }

  function record(entry) {
    entry.t = Math.round(performance.now());
    entry.time = new Date().toISOString();
    timeline.push(entry);
    persist();
    return entry;
  }

  function ignored(url) {
    if (!url) return false;
    return config.ignore.some(function (pattern) { return url.indexOf(pattern) !== -1; });
  }

  function truncate(text) {
    if (typeof text !== 'string') return text;
    if (text.length <= config.maxBody) return text;
    return text.slice(0, config.maxBody) + '...[' + text.length + ' chars]';
  }

  // --- Value summarising (safe, depth limited, no circular blow-ups) -------
  function describeNode(node) {
    if (node.nodeType === 3) return '#text:' + (node.textContent || '').trim().slice(0, 40);
    const tag = node.tagName ? node.tagName.toLowerCase() : node.nodeName;
    const id = node.id ? '#' + node.id : '';
    const cls = (node.classList && node.classList.length)
      ? '.' + Array.prototype.join.call(node.classList, '.')
      : '';
    return '<' + tag + id + cls + '>';
  }

  function summarise(value, depth) {
    depth = depth || 0;
    if (value === null) return null;
    const type = typeof value;
    if (type === 'string') {
      return value.length > config.maxString
        ? value.slice(0, config.maxString) + '...[' + value.length + ']'
        : value;
    }
    if (type === 'number' || type === 'boolean') return value;
    if (type === 'undefined') return '[undefined]';
    if (type === 'function') return '[Function ' + (value.name || 'anonymous') + ']';
    if (type === 'bigint') return value.toString() + 'n';
    if (type === 'symbol') return value.toString();

    if (typeof Node !== 'undefined' && value instanceof Node) return describeNode(value);
    if (value instanceof Error) return { error: value.name, message: value.message };
    if (value instanceof Date) return value.toISOString();

    if (depth >= config.maxDepth) {
      return '[' + (Array.isArray(value) ? 'Array' : 'Object') + ' depth limit]';
    }

    if (Array.isArray(value)) {
      const out = value.slice(0, config.maxItems).map(function (v) { return summarise(v, depth + 1); });
      if (value.length > config.maxItems) out.push('...[' + value.length + ' total]');
      return out;
    }
    if (typeof FormData !== 'undefined' && value instanceof FormData) {
      const fd = {};
      value.forEach(function (v, k) { fd[k] = typeof v === 'string' ? v : '[file]'; });
      return fd;
    }
    if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
      const sp = {};
      value.forEach(function (v, k) { sp[k] = v; });
      return sp;
    }

    const out = {};
    let count = 0;
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i += 1) {
      if (count >= config.maxItems) { out['...'] = (keys.length - count) + ' more keys'; break; }
      count += 1;
      try { out[keys[i]] = summarise(value[keys[i]], depth + 1); }
      catch (e) { out[keys[i]] = '[unreadable]'; }
    }
    return out;
  }

  function bodyText(body) {
    if (body == null) return null;
    if (typeof body === 'string') return truncate(body);
    if (typeof FormData !== 'undefined' && body instanceof FormData) return summarise(body);
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return summarise(body);
    if (typeof Blob !== 'undefined' && body instanceof Blob) return '[Blob ' + body.size + ' bytes]';
    if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return '[ArrayBuffer ' + body.byteLength + ' bytes]';
    try { return truncate(JSON.stringify(body)); }
    catch (e) { return '[unserialisable body]'; }
  }

  // --- Network: fetch ------------------------------------------------------
  function patchFetch() {
    if (typeof window.fetch !== 'function') return;
    originalFetch = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url);
      if (ignored(url)) return originalFetch.apply(this, arguments);

      const id = nextId();
      const method = (init && init.method) || (input && input.method) || 'GET';
      const startedAt = performance.now();
      record({ type: 'fetch:request', id: id, method: method, url: url, body: bodyText(init && init.body) });

      return originalFetch.apply(this, arguments).then(function (response) {
        let copy;
        try { copy = response.clone(); } catch (e) { copy = null; }
        const finish = function (text) {
          record({
            type: 'fetch:response', id: id, url: url, status: response.status,
            durationMs: Math.round(performance.now() - startedAt), body: truncate(text),
          });
        };
        if (copy) {
          copy.text().then(finish, function () { finish('[unreadable]'); });
        } else {
          finish('[clone failed]');
        }
        return response;
      }, function (err) {
        record({ type: 'fetch:error', id: id, url: url, error: String(err) });
        throw err;
      });
    };
    log.info('Patched fetch');
  }

  // --- Network: XMLHttpRequest ---------------------------------------------
  function patchXhr() {
    if (typeof XMLHttpRequest === 'undefined') return;
    originalXhrOpen = XMLHttpRequest.prototype.open;
    originalXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__trace = { id: nextId(), method: method, url: url };
      return originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      const meta = this.__trace || { id: nextId(), method: 'GET', url: '' };
      if (ignored(meta.url)) return originalXhrSend.apply(this, arguments);

      const startedAt = performance.now();
      record({ type: 'xhr:request', id: meta.id, method: meta.method, url: meta.url, body: bodyText(body) });

      const xhr = this;
      this.addEventListener('loadend', function () {
        let text = '';
        try { text = xhr.responseType === '' || xhr.responseType === 'text' ? xhr.responseText : '[' + xhr.responseType + ']'; }
        catch (e) { text = '[unreadable]'; }
        record({
          type: 'xhr:response', id: meta.id, url: meta.url, status: xhr.status,
          durationMs: Math.round(performance.now() - startedAt), body: truncate(text),
        });
      });
      return originalXhrSend.apply(this, arguments);
    };
    log.info('Patched XMLHttpRequest');
  }

  // --- Clicks --------------------------------------------------------------
  function cssPath(el) {
    if (!(el instanceof Element)) return '';
    if (el.id) return '#' + el.id;
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 5) {
      if (node.id) { parts.unshift('#' + node.id); break; }
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName; });
        if (sameTag.length > 1) part += ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = node.parentElement;
      depth += 1;
    }
    return parts.join(' > ');
  }

  function onClick(event) {
    const el = event.target;
    record({
      type: 'click',
      tag: el.tagName ? el.tagName.toLowerCase() : el.nodeName,
      selector: cssPath(el),
      text: (el.textContent || '').trim().slice(0, 80),
    });
  }

  // --- Function watching ---------------------------------------------------
  function watch(target, names) {
    // Allow watch('fnName') or watch(['a','b']) to default the target to window.
    if (typeof target === 'string' || Array.isArray(target)) {
      names = target;
      target = window;
    }
    if (typeof names === 'string') names = [names];
    if (!Array.isArray(names)) { log.warn('watch needs a name or array of names'); return trace; }

    names.forEach(function (name) {
      const original = target[name];
      if (typeof original !== 'function') {
        log.warn('Cannot watch "' + name + '": not a function on the target');
        return;
      }
      const key = name + '@' + (target === window ? 'window' : 'object');
      if (watched.has(key)) { log.warn('Already watching ' + name); return; }
      watched.set(key, { target: target, name: name, original: original });

      target[name] = function () {
        const args = Array.prototype.slice.call(arguments);
        record({ type: 'call', fn: name, args: args.map(function (a) { return summarise(a); }) });
        try {
          const result = original.apply(this, arguments);
          if (result && typeof result.then === 'function') {
            return result.then(function (value) {
              record({ type: 'return', fn: name, async: true, value: summarise(value) });
              return value;
            }, function (err) {
              record({ type: 'throw', fn: name, async: true, error: String(err) });
              throw err;
            });
          }
          record({ type: 'return', fn: name, value: summarise(result) });
          return result;
        } catch (err) {
          record({ type: 'throw', fn: name, error: String(err) });
          throw err;
        }
      };
      log.info('Watching ' + name);
    });
    return trace;
  }

  function unwatch() {
    watched.forEach(function (entry) { entry.target[entry.name] = entry.original; });
    watched.clear();
    log.info('Restored watched functions');
    return trace;
  }

  // --- State snapshots -----------------------------------------------------
  // Capture named application state at a checkpoint. fn() returns any object of
  // state; its result is summarised and recorded. opts.full === true bypasses
  // the per-snapshot truncation (use for full MMD capture); otherwise strings
  // are truncated to config.snapshotMaxString. A throwing fn is recorded as an
  // error entry and never escapes into the page.
  function snapshot(label, fn, opts) {
    opts = opts || {};
    if (typeof fn !== 'function') {
      log.warn('snapshot needs a function that returns the state to capture');
      return trace;
    }
    let state;
    try {
      state = fn();
    } catch (err) {
      record({ type: 'snapshot', label: label, error: String(err) });
      log.warn('Snapshot "' + label + '" threw and was recorded as an error: ' + err);
      return trace;
    }
    // Reuse summarise() but swap in the snapshot string budget for this call.
    const previousMax = config.maxString;
    config.maxString = opts.full === true ? Infinity : config.snapshotMaxString;
    let summary;
    try { summary = summarise(state); }
    catch (e) { summary = '[unsummarisable state]'; }
    finally { config.maxString = previousMax; }
    record({ type: 'snapshot', label: label, state: summary });
    log.info('Snapshot "' + label + '" captured');
    return trace;
  }

  // Record a named stage marker so a capture reads as ordered steps.
  function step(label) {
    record({ type: 'step', label: label });
    return trace;
  }

  // --- Recording indicator (self-owned, fixed-position) --------------------
  // A visible, accessible status badge so a trace left running across a reload
  // is obvious. The tracer injects and owns BOTH the node and its styles; it
  // touches no application HTML or stylesheet. The coloured dot is decorative
  // (aria-hidden) and is NOT the only signal — the visible "Recording trace"
  // text carries the meaning (WCAG 1.4.1). The dot is drawn in CSS rather than
  // via the app icon-library on purpose: this is a standalone dev tool with no
  // icon-library dependency, and a dynamically-inserted data-icon span would
  // need a separate populate call to render, defeating "self-contained".
  function injectIndicatorStyles() {
    if (document.getElementById(INDICATOR_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = INDICATOR_STYLE_ID;
    // The badge carries its OWN solid background so it is legible over both the
    // light and dark theme without depending on the page behind it. Non-colour
    // cues pair with the red so the state never relies on colour alone: a light
    // ring around the dot, a pulse (disabled under prefers-reduced-motion), and
    // the always-present text label. pointer-events:none so the badge can never
    // intercept a click the tracer is meant to be recording.
    style.textContent = [
      '#' + INDICATOR_ID + '{',
      '  position:fixed;bottom:16px;right:16px;z-index:2147483647;',
      '  display:flex;align-items:center;gap:8px;',
      '  padding:6px 12px;border-radius:16px;',
      '  background:#1b1b1b;color:#ffffff;',
      '  outline:2px solid #fffff4;outline-offset:0;', // defined edge in both themes; outline keeps box size + corner radius
      '  font:600 13px/1.4 system-ui,Segoe UI,Arial,sans-serif;',
      '  box-shadow:0 2px 8px rgba(0,0,0,0.5);',
      '  pointer-events:none;',
      '}',
      '#' + INDICATOR_ID + ' .wt-dot{',
      '  width:10px;height:10px;border-radius:50%;flex:0 0 auto;',
      '  background:#ff4136;border:1px solid rgba(255,255,255,0.85);',
      '  animation:wt-pulse 1.4s ease-in-out infinite;',
      '}',
      '@keyframes wt-pulse{',
      '  0%,100%{box-shadow:0 0 0 0 rgba(255,65,54,0.7);}',
      '  50%{box-shadow:0 0 0 5px rgba(255,65,54,0);}',
      '}',
      '@media (prefers-reduced-motion: reduce){',
      '  #' + INDICATOR_ID + ' .wt-dot{animation:none;}',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function createIndicator() {
    if (!document.body) { log.debug('No document.body yet; recording indicator skipped.'); return; }
    // Guard: a double start() must not inject two indicators.
    if (document.getElementById(INDICATOR_ID)) return;
    injectIndicatorStyles();
    const box = document.createElement('div');
    box.id = INDICATOR_ID;
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    const dot = document.createElement('span');
    dot.className = 'wt-dot';
    dot.setAttribute('aria-hidden', 'true');   // decorative; never the only signal
    const label = document.createElement('span');
    label.className = 'wt-label';
    label.textContent = 'Recording trace';      // the real, visible signal
    box.appendChild(dot);
    box.appendChild(label);
    document.body.appendChild(box);
    log.info('Recording indicator shown.');
  }

  function removeIndicator() {
    const box = document.getElementById(INDICATOR_ID);
    if (box) box.remove();
    const style = document.getElementById(INDICATOR_STYLE_ID);
    if (style) style.remove();
    // We remove synchronously rather than first updating the live region to
    // "Recording stopped" and deferring removal. The gate requires stop() to
    // leave no indicator node, so a deferred removal (and the timer it needs)
    // would be residue and a stale-status risk. The polite start announcement
    // is kept; the stop announcement is traded away for a clean teardown.
  }

  // --- Lifecycle -----------------------------------------------------------
  function start() {
    if (running) { log.warn('Already running'); return trace; }
    running = true;
    try { localStorage.setItem(FLAG_KEY, '1'); }
    catch (e) { log.warn('Could not set the active flag: ' + e); }
    patchFetch();
    patchXhr();
    clickHandler = onClick;
    document.addEventListener('click', clickHandler, true);
    // Persist the timeline at the navigation boundary so the final records
    // survive an instant reload. pagehide is the reliable primary on mobile
    // Safari and bfcache; beforeunload covers desktop edge cases.
    if (!flushHandler) flushHandler = function () { flushTimelineSync(); };
    window.addEventListener('pagehide', flushHandler);
    window.addEventListener('beforeunload', flushHandler);
    createIndicator();
    log.warn('Tracing started. Run your workflow, then call trace.export().');
    return trace;
  }

  function stop() {
    if (!running) { log.warn('Not running'); return trace; }
    if (originalFetch) { window.fetch = originalFetch; originalFetch = null; }
    if (originalXhrOpen) { XMLHttpRequest.prototype.open = originalXhrOpen; originalXhrOpen = null; }
    if (originalXhrSend) { XMLHttpRequest.prototype.send = originalXhrSend; originalXhrSend = null; }
    if (clickHandler) { document.removeEventListener('click', clickHandler, true); clickHandler = null; }
    if (flushHandler) {
      window.removeEventListener('pagehide', flushHandler);
      window.removeEventListener('beforeunload', flushHandler);
      flushHandler = null;
    }
    removeIndicator();
    unwatch();
    try { localStorage.removeItem(FLAG_KEY); }
    catch (e) { log.warn('Could not clear the active flag: ' + e); }
    running = false;
    log.warn('Tracing stopped. ' + timeline.length + ' records held in trace.log.');
    return trace;
  }

  function clear() {
    timeline.length = 0;
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    try { localStorage.removeItem(PERSIST_KEY); }
    catch (e) { log.warn('Could not remove persisted timeline: ' + e); }
    log.info('Timeline cleared (the active flag is left untouched)');
    return trace;
  }

  // Full teardown: stop capturing, wipe the timeline, and remove both
  // localStorage keys so a capture session leaves no residue behind.
  function reset() {
    if (running) stop();
    clear();
    try { localStorage.removeItem(FLAG_KEY); } catch (e) { /* best effort */ }
    try { localStorage.removeItem(PERSIST_KEY); } catch (e) { /* best effort */ }
    log.warn('Trace reset: stopped, cleared, and removed both localStorage keys.');
    return trace;
  }

  function exportLog(filename) {
    const name = filename || 'workflow-trace-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    const blob = new Blob([JSON.stringify(timeline, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(url); anchor.remove(); }, 0);
    log.warn('Exported ' + timeline.length + ' records to ' + name);
    return trace;
  }

  function setLevel(level) {
    if (Object.prototype.hasOwnProperty.call(LOG_LEVELS, level)) currentLevel = LOG_LEVELS[level];
    else log.warn('Unknown level: ' + level);
    return trace;
  }

  // --- Self-test: synchronous-flush guard (capture-to-test, Lesson 3) ------
  // A phase-aware test that proves the SYNCHRONOUS flush — not the 250ms
  // debounce — carries the final records across a reload. It is the first
  // worked example of the capture-to-test convention: record a marker, prove
  // the behaviour at the storage boundary, leave no residue.
  //
  // Two phases, chosen by whether SELFTEST_KEY is set in localStorage:
  //   ARM   (flag absent) — start, drop a unique marker, then NEUTRALISE the
  //                         debounce so only the flush can persist it; set the
  //                         flag; tell the user to reload and call again.
  //   CHECK (flag present) — after the reload the auto-resume has already run,
  //                         so read memory + the persisted store and report
  //                         whether the marker survived; always clean up.
  function selfTest() {
    const MARKER = 'selftest-flush-probe';

    // Helper: does a parsed timeline array hold the probe marker?
    function hasMarker(list) {
      return Array.isArray(list) && list.some(function (e) {
        return e && e.type === 'step' && e.label === MARKER;
      });
    }
    // Helper: read and parse the persisted store, never throwing.
    function readPersisted() {
      try {
        const saved = localStorage.getItem(PERSIST_KEY);
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        log.warn('Could not read the persisted store: ' + e);
        return null;
      }
    }

    let armed = false;
    try { armed = localStorage.getItem(SELFTEST_KEY) === '1'; }
    catch (e) { armed = false; }

    if (!armed) {
      // --- ARM phase -------------------------------------------------------
      reset();          // clean slate — no residue from a prior trace
      start();
      step(MARKER);     // drop the marker via the existing step()/record() path

      // CRITICAL: neutralise the debounce so the ONLY thing that can persist the
      // marker is the synchronous boundary flush. Cancel the pending timer and
      // do NOT call writeTimeline()/persist() — the persisted store must stay
      // empty until the flush fires at navigation.
      if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }

      // Set the arm flag AFTER cancelling the debounce. It is not part of the
      // timeline, so write it directly — same try/catch idiom as the resume block.
      try { localStorage.setItem(SELFTEST_KEY, '1'); }
      catch (e) { log.warn('Could not set the self-test arm flag: ' + e); }

      // Precondition: the marker must NOT yet be in the persisted store.
      if (hasMarker(readPersisted())) {
        log.warn('Debounce was not neutralised — the marker is already persisted; ' +
          'this run cannot prove the flush. Proceeding; the reload will reveal the truth.');
      }

      log.info('trace.selfTest armed. Reload the page at ANY speed, then call ' +
        'trace.selfTest() again to read the result.');
      return { phase: 'armed' };
    }

    // --- CHECK phase -------------------------------------------------------
    // The reload has happened and auto-resume has restored the timeline into
    // memory before this call. markerPersisted is the real proof (the flush
    // wrote before navigation); markerInMemory is informational (restore path).
    let pass = false;
    let markerPersisted = false;
    let reloadMarker = false;
    let markerInMemory = false;
    try {
      markerInMemory = hasMarker(timeline);
      reloadMarker = timeline.some(function (e) { return e && e.type === 'reload'; });
      markerPersisted = hasMarker(readPersisted());

      pass = markerPersisted && reloadMarker;
      log.warn('[trace.selfTest] flush guard — markerPersisted: ' + markerPersisted +
        ', reloadMarker: ' + reloadMarker + ', markerInMemory: ' + markerInMemory +
        ' — ' + (pass ? 'PASS' : 'FAIL'));
      if (!pass) {
        log.warn('Synchronous flush did NOT carry the boundary records across the ' +
          'reload (the debounce was neutralised, so the flush was the only writer).');
      }
      return {
        phase: 'checked',
        pass: pass,
        markerPersisted: markerPersisted,
        reloadMarker: reloadMarker,
        markerInMemory: markerInMemory,
      };
    } finally {
      // Always clear the arm flag (even on FAIL or a throw) so a failed run never
      // strands the tracer in check-mode, then reset() for a residue-free teardown.
      try { localStorage.removeItem(SELFTEST_KEY); } catch (e) { /* best effort */ }
      reset();
    }
  }

  // --- Resume-key family resolver (shared seam; pure read) -----------------
  // The family-scan + newest-pick + loadedFromKey logic, lifted out of
  // resumeKey() so BOTH the live path and the guard test (resumeKeyTest) drive
  // the EXACT same resolution with an explicit base-name. Pure read: it only
  // reads localStorage and mutates nothing. Returns { key, source, candidates }.
  //
  // Mirrors checkForMatchingSessions in session-restorer-sessions.js: the prefix
  // MUST stay in sync with the app's k.startsWith("mathpix-resume-session"), the
  // same extension-stripping regex, and the same stored-name field fallback
  // order (sourceFileName || sourceFilename || '').
  function resolveFromFamily(baseName, loadedFromKey) {
    const RESUME_PREFIX = 'mathpix-resume-session';

    let rawKeys = [];
    try {
      rawKeys = Object.keys(localStorage).filter(function (k) {
        return k.startsWith(RESUME_PREFIX);
      });
    } catch (e) {
      log.warn('Could not enumerate localStorage for resume keys: ' + e);
      rawKeys = [];
    }

    const candidates = [];
    if (baseName !== null) {
      for (let i = 0; i < rawKeys.length; i += 1) {
        const k = rawKeys[i];
        let data = null;
        try { data = JSON.parse(localStorage.getItem(k)); }
        catch (e) { continue; }   // skip invalid entries, as checkForMatchingSessions does
        if (!data) continue;
        const storedName = data.sourceFileName || data.sourceFilename || '';
        const storedBaseName = storedName.replace(/\.[^/.]+$/, '');
        if (storedBaseName && storedBaseName === baseName && data.current) {
          candidates.push({
            key: k,
            lastModified: data.lastModified || 0,
            currentLen: (data.current || '').length,
          });
        }
      }
      // Newest first — the lesson is newest, not first match.
      candidates.sort(function (a, b) { return b.lastModified - a.lastModified; });
    }

    // Resolve the key, in order of trust.
    let key = null;
    let source = null;
    if (loadedFromKey) {
      // loadedFromKey is ground truth on the recovered path. Accept it if it
      // appears among the candidate family OR among the raw localStorage keys.
      const inCandidates = candidates.some(function (c) { return c.key === loadedFromKey; });
      const inRaw = rawKeys.indexOf(loadedFromKey) !== -1;
      if (inCandidates || inRaw) {
        key = loadedFromKey;
        source = 'loadedFromKey';
      }
    }
    if (key === null && candidates.length > 0) {
      key = candidates[0].key;       // newest of the filename-matched family
      source = 'filename-newest';
    }

    return { key: key, source: source, candidates: candidates };
  }

  // --- Resume-key resolver (read-only; MathPix Lesson 1) -------------------
  // Resolve which mathpix-resume-session key the tracer should bind to after a
  // reload — loadedFromKey when the app recovered a session, else filename-and-
  // newest over the resume-key family. It implements the readme's resume-key
  // lesson: match by filename and NEWEST timestamp, not first match.
  //
  // PURE-READ: it only reads localStorage and the live restorer singleton. It
  // mutates nothing, writes no key, sets no flag, and does NOT auto-bind or touch
  // the tracer's own persistence. It degrades gracefully when the MathPix app is
  // absent (the tracer is notionally standalone), returning a clear null-result
  // shape rather than throwing. Always returns:
  //   { key, source, filename, candidates, loadedFromKey }
  function resumeKey() {
    // The full result shape is returned on EVERY path, including every failure
    // path — this function never throws.
    const result = {
      key: null,
      source: null,
      filename: null,
      candidates: [],
      loadedFromKey: null,
    };

    // Resolve the restorer defensively — the tracer must not assume the app exists
    // (same existence-guard idiom the network patches use for window.fetch).
    const getSR = window.getMathPixSessionRestorer;
    if (typeof getSR !== 'function') {
      log.debug('MathPix session restorer not present — resumeKey unavailable');
      return result;
    }
    let SR = null;
    try { SR = getSR(); } catch (e) { SR = null; }
    if (!SR) {
      log.debug('MathPix session restorer not present — resumeKey unavailable');
      return result;
    }

    // Read the live fields off the recovered session (all optional).
    const restored = SR.restoredSession || null;
    const filename = (restored && restored.source && restored.source.filename) || null;
    const loadedFromKey = (restored && restored.loadedFromKey != null) ? restored.loadedFromKey : null;
    result.filename = filename;
    result.loadedFromKey = loadedFromKey;

    // Strip the extension to the base-name, then resolve over the family via the
    // shared seam so the guard test drives the identical logic.
    const uploadedBaseName = filename ? filename.replace(/\.[^/.]+$/, '') : null;
    const resolved = resolveFromFamily(uploadedBaseName, loadedFromKey);
    result.candidates = resolved.candidates;
    result.key = resolved.key;
    result.source = resolved.source;

    // Deliberately NO content-differs / newerSessions gate here: the app's gate
    // compares against live page state (restoredSession.currentMMD), so it is a
    // property of the running page, not of the stored key set — replicating it
    // would make this resolver fragile. We resolve over the key family only.

    log.info('resumeKey resolved: key=' + (result.key || 'null') +
      ', source=' + (result.source || 'null'));
    return result;
  }

  // --- Resume-key guard: pure-read assertion over the family seam ----------
  // Proves resumeKey()'s family-resolution (Lesson 1: filename + NEWEST, prefer
  // loadedFromKey) WITHOUT a reload. resumeKey() reads the LIVE restorer's
  // filename, so the guard cannot steer it from an argument; instead it drives
  // the shared resolveFromFamily() seam directly with an explicit base-name —
  // the exact code path resumeKey() uses (OPTION (a): the clean testable seam).
  //
  // It DOES write three throwaway localStorage keys to build a sibling family,
  // so cleanup is exact and crash-safe (finally). Every fake key uses the app's
  // resume prefix, so it lives in the namespace mathpixWipe clears — a manual
  // backstop if cleanup is ever interrupted.
  function resumeKeyTest() {
    // Guard-only base-name — deliberately not a real filename, so it can never
    // collide with a live session.
    const BASE = '__wt-guard-fixture__';
    const PREFIX = 'mathpix-resume-session';   // mirror resolveFromFamily/mathpixWipe
    // Three fake keys, ascending lastModified so 'newest' is unambiguous.
    const fakes = [
      { key: PREFIX + '-' + BASE + '-1000', lastModified: 1000 },
      { key: PREFIX + '-' + BASE + '-3000', lastModified: 3000 }, // newest
      { key: PREFIX + '-' + BASE + '-2000', lastModified: 2000 },
    ];
    const NEWEST = PREFIX + '-' + BASE + '-3000';
    const OLDEST = PREFIX + '-' + BASE + '-1000';
    const PHANTOM = PREFIX + '-' + BASE + '-9999';   // never written to localStorage

    const rows = [];
    function check(name, pass) { rows.push({ name: name, pass: !!pass }); }

    try {
      // Seed the sibling family. Field names MUST match what resolveFromFamily
      // reads: sourceFileName (base-name source), current (truthy gate),
      // lastModified (newest tie-break). Without the match the asserts test nothing.
      fakes.forEach(function (f) {
        const payload = {
          sourceFileName: BASE + '.pdf',
          current: 'x',
          lastModified: f.lastModified,
        };
        localStorage.setItem(f.key, JSON.stringify(payload));
      });

      // A. Newest wins: family resolution returns the lastModified=3000 key, NOT
      //    the first-written (1000) or first-encountered key.
      const a = resolveFromFamily(BASE, null);
      check('A newest-of-family wins (3000 key)',
        a.key === NEWEST && a.source === 'filename-newest');

      // B. loadedFromKey preferred: an OLDER sibling that exists beats newest,
      //    proving ground-truth trumps the timestamp.
      const b = resolveFromFamily(BASE, OLDEST);
      check('B present loadedFromKey beats newest',
        b.key === OLDEST && b.source === 'loadedFromKey');

      // C. loadedFromKey ignored when absent: a phantom key not in the set falls
      //    back to NEWEST, never the phantom.
      const c = resolveFromFamily(BASE, PHANTOM);
      check('C phantom loadedFromKey falls back to newest',
        c.key === NEWEST && c.source === 'filename-newest');
    } catch (err) {
      check('guard threw: ' + err, false);
    } finally {
      // Exact, crash-safe cleanup: remove each fake by exact key string — on
      // pass, fail, or throw.
      fakes.forEach(function (f) {
        try { localStorage.removeItem(f.key); } catch (e) { /* best effort */ }
      });
      // Best-effort: confirm none survived; WARN (never throw) if any did.
      let leaked = 0;
      fakes.forEach(function (f) {
        try { if (localStorage.getItem(f.key) !== null) leaked += 1; }
        catch (e) { /* ignore */ }
      });
      if (leaked > 0) {
        log.warn('resumeKeyTest cleanup left ' + leaked + ' fake key(s); ' +
          'sweep manually with mathpixWipe({ families: [\'resume\'] }).');
      }
    }

    const passed = rows.filter(function (r) { return r.pass; }).length;
    const total = rows.length;
    rows.forEach(function (r) {
      log.warn('[trace.resumeKeyTest] ' + (r.pass ? 'PASS' : 'FAIL') + ' — ' + r.name);
    });
    log.warn('[trace.resumeKeyTest] ' + passed + '/' + total + ' passed.');
    return { passed: passed, total: total, rows: rows };
  }

  // --- Public API ----------------------------------------------------------
  // Built (and the local `trace` bound) BEFORE the restore/auto-resume block
  // below, so the chaining `return trace;` inside start() resolves cleanly when
  // the auto-resume calls start() during initialisation rather than hitting a
  // temporal-dead-zone error on the outer const.
  const trace = {
    start: start,
    stop: stop,
    watch: watch,
    unwatch: unwatch,
    snapshot: snapshot,
    step: step,
    clear: clear,
    reset: reset,
    selfTest: selfTest,
    resumeKey: resumeKey,
    resumeKeyTest: resumeKeyTest,
    export: exportLog,
    setLevel: setLevel,
    config: config,
    get log() { return timeline; },
  };

  // --- Restore a prior session (reload-surviving) --------------------------
  // If a timeline was persisted before a reload, parse it back so the records
  // survive the F5. Guarded so a corrupt value can never break initialisation.
  try {
    const saved = localStorage.getItem(PERSIST_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        timeline.push.apply(timeline, parsed);
        log.info('Restored ' + parsed.length + ' record(s) from a previous session.');
      }
    }
  } catch (e) {
    log.warn('Could not restore the persisted timeline: ' + e);
  }

  // --- Auto-resume after a reload ------------------------------------------
  // If tracing was active before the reload, drop a marker showing where the
  // refresh happened, then resume capturing — no manual trace.start() needed.
  try {
    if (localStorage.getItem(FLAG_KEY) === '1') {
      record({ type: 'reload' });
      start();
      // start() above already recreates the indicator; this explicit call makes
      // the "indicator returns the moment capture resumes" intent visible and is
      // a harmless no-op (createIndicator() guards on the existing node id).
      createIndicator();
      log.info('Auto-resumed tracing after a reload.');
    }
  } catch (e) {
    log.warn('Auto-resume check failed: ' + e);
  }

  return trace;
})();

// Expose for console use.
window.trace = trace;
