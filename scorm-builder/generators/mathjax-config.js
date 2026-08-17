// MathJax <head> configuration + loader. Produces the window.MathJax config
// (must run BEFORE the library loads) and the loader <script>. Accessibility
// extensions (assistive MathML, explorer) are loaded so screen-reader support
// and equation exploration work out of the box.
//
// mathjaxMode "cdn" -> jsDelivr; "local" path-rewriting is handled later by
// prepareScormHtml (so the same output supports both).
//
// `explorerControl: true` says "this document ships the Explore-equations
// checkbox", which forces adaptiveCSS off — see the long note by `adaptiveCSS`
// below. Callers that do not render that control keep MathJax's default
// (adaptive) CSS and pay nothing.

import { resolveConfig } from "../scorm/config.js";

export function renderMathJaxHead(opts = {}) {
  const config = resolveConfig(opts.config);
  const src = opts.mathjaxMode === "local" ? config.LOCAL_MATHJAX_PATH : config.CDN_MATHJAX_URL;
  const s = {
    zoom: "Click",
    zscale: "200%",
    assistiveMml: true,
    inTabOrder: false,
    // NB: no `explorer` key. It is accepted on opts.settings for compatibility but
    // deliberately never read from here — see the loader note below for why it
    // cannot be honoured at build time.
    // Default speech ruleset domain for SRE. ClearSpeak is clearer/more natural
    // than the terse MathSpeak default; it governs the wording used by Read Aloud
    // (via the aria-label speech below), screen readers, and the Explorer.
    speechDomain: "clearspeak",
    ...(opts.settings || {}),
  };
  // NOTHING THAT CAN FAIL MAY SIT IN `loader.load`.
  //
  // Screen-reader MathML is the exception that proves it: assistive-mml is bundled
  // inside tex-chtml.js, needs no SRE and no network, and cannot fail — so it is
  // preloaded. Everything in the SRE chain can fail, so none of it is.
  //
  // Measured (P6): with 'a11y/explorer' preloaded and its SRE locale data
  // unreachable, `startup.promise` NEVER SETTLES — it does not even reject. Zero
  // equations typeset and an unrelated $E = mc^2$ stays as literal text: a
  // whole-document maths outage, permanently pending, with nothing for a .catch() to
  // catch and no error beyond one CORS line. SRE fetches that data by XHR, which is
  // blocked under file:// and merely unreachable when a CDN is blocked or down.
  //
  // So the Explorer is never preloaded here, whatever the caller asks for. Where it
  // CAN work — served over http(s):// with its data reachable — it is armed from the
  // reader's own persisted choice instead (source/templates/js/mathjax-controls.js).
  // ClearSpeak speech for Read Aloud is likewise generated lazily, after typeset, on
  // a bounded wait (read-aloud.js).
  if (opts.settings && opts.settings.explorer) {
    console.warn(
      "scorm-builder: settings.explorer is not honoured at build time. Preloading " +
        "'a11y/explorer' leaves MathJax's startup promise permanently pending whenever its " +
        "SRE data is unreachable, which stops the WHOLE document typesetting — not just the " +
        "exploration. The Explore-equations control arms it at runtime instead, only where " +
        "it can actually work."
    );
  }
  const a11yLoad = "'a11y/assistive-mml'";

  // L10: MathJax v3 CHTML defaults to adaptiveCSS, emitting `mjx-c::before
  // { content: "…" }` rules only for the glyphs it has actually seen. Anything
  // that rebuilds the output jax calls font.clearCache(), which wipes that
  // glyph-usage record — and the record cannot be repopulated afterwards,
  // because by then the TeX source has been replaced by rendered output, so
  // there is nothing left in the page for a re-typeset to find. The stylesheet
  // is then re-emitted with ZERO character rules and every glyph collapses to
  // 0px: the DOM, the assistive MathML and the speech all stay correct, so only
  // SIGHTED readers see the damage. Ticking "Explore equations" takes exactly
  // that path (menu.setExplorer -> loadA11y -> outputJax.reset -> rerender).
  //
  // Measured (26 Jul 2026, 30 display equations, Chromium): re-typeset after the
  // wipe leaves charUsage at 0 used / 0 pending, so no in-page repair works —
  // typesetClear+typesetPromise, rerender() and runtime adaptiveCSS flips were
  // all tried and all failed. Turning adaptiveCSS off at BUILD time is the only
  // measure that keeps the maths visible. It costs zero exported bytes (MathJax
  // generates the CSS in the browser: 243,791 B vs 13,198 B in
  // #MJX-CHTML-styles) and, measured cold and warm at 1x and 4x CPU
  // throttling, ~0-4% on time-to-first-painted-glyph, +25ms recalc-style at 4x
  // cold and +0.6MB JS heap. So it is applied only to documents that actually
  // ship the Explorer control, not to every export.
  const chtmlAdaptive = opts.explorerControl ? ", adaptiveCSS: false" : "";

  // The exploration decision belongs to the BROWSER, not to this build.
  //
  // Measured (P6 §4b): the Explorer failure is a `file://` SCHEME restriction, not an
  // offline one. SRE fetches its locale JSON by XHR, which the file: scheme blocks as
  // a cross-origin request from origin `null` — but the identical bundle served over
  // http(s):// gives full exploration and generated speech on every equation with no
  // internet connection at all. A build-time gate would therefore strip a working
  // feature from LMS learners, who are the majority. Only `location.protocol` can tell
  // the two cases apart, and only at runtime.
  //
  // `user-math-explorer` is written by the sidebar control (mathjax-controls.js) after
  // it has PROVED the data is reachable, so by the time this reads 'on' the risk is
  // already small. `explorerWatchdog` below covers what is left of it.
  const explorerGate =
    "(function(){ try { return location.protocol !== 'file:' && " +
    "localStorage.getItem('user-math-explorer') === 'on'; } catch (e) { return false; } })()";

  // About the watchdog emitted below — kept HERE rather than in the template literal,
  // because comments inside that literal ship to every learner and cost ~2.33x their
  // own size once the document's base64 self-embed is counted.
  //
  // If the exploration data turns out to be unreachable after all (a blocked CDN, a
  // partial bundle, a proxy that blackholes the host), MathJax's startup promise never
  // settles and NO equation typesets anywhere in the document. Measured: nothing can
  // repair that page once it happens. The watchdog does not try. What it prevents is
  // the reader being STUCK there, reloading into the same blank document for ever —
  // it drops the preference, so the very next load is the safe configuration again.
  //
  // It is armed only when exploration was actually requested, so the default export
  // creates no timers at all. `startup.promise` does not exist yet at config time (the
  // loader is async), hence the poll — the same shape whenMathReady() uses in
  // read-aloud.js.
  //
  // ONLY fulfilment counts as healthy. A rejected startup promise means no equation
  // typeset either, and we cannot tell from here whether the exploration chain caused
  // it (a 404 on a11y/explorer) or something unrelated did (a missing autoload
  // extension). The trade is deliberate: clearing costs a reader one re-tick of a
  // checkbox, which the control re-proves before it takes effect; NOT clearing can
  // leave them reloading into a blank document for ever. When in doubt, fall back to
  // the configuration known to be safe.
  //
  // `__mathExplorerUnavailable` is read by mathjax-controls.js, which turns it into
  // something the reader can actually see.

  const configScript = `<script>
(function () {
var mjxExplorer = ${explorerGate};
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
    displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
    processEscapes: true,
    tags: 'ams'
  },
  options: {
    enableMenu: true,
    menuOptions: {
      settings: {
        zoom: ${JSON.stringify(s.zoom)},
        zscale: ${JSON.stringify(s.zscale)},
        // Applied at config time from the saved preference so unchecking the box
        // and reloading actually turns assistive MathML off (MathJax v3 cannot
        // strip it from an already-rendered page).
        assistiveMml: (function(){ try { return localStorage.getItem('user-assistive-mathml') !== 'off'; } catch (e) { return ${JSON.stringify(!!s.assistiveMml)}; } })(),
        inTabOrder: ${JSON.stringify(!!s.inTabOrder)},
        // Tracks the loaded module exactly. Left true while 'a11y/explorer' is absent,
        // MathJax's own menu lazily pulls the same SRE chain during startup and
        // reaches the identical whole-document hazard by another route.
        explorer: mjxExplorer
        // NB: speechRules is NOT set here — it is only a valid menu setting once
        // the Explorer loads (setting it early logs "Invalid option"). The
        // generated Read-Aloud/SR speech domain is driven by options.sre.domain
        // above; the Explorer's speechRules is set at load time in updateExplorer().
      }
    }
  },
  loader: { load: ['ui/menu', ${a11yLoad}].concat(mjxExplorer ? ['a11y/explorer'] : []) },
  chtml: { displayAlign: 'left'${chtmlAdaptive} }
};

// Watchdog: if exploration was requested but MathJax never starts up, drop the
// preference so the next load is the safe configuration again.
if (mjxExplorer) {
  var settled = false;
  var poll = setInterval(function () {
    var startup = window.MathJax && window.MathJax.startup;
    if (!startup || !startup.promise || typeof startup.promise.then !== 'function') return;
    clearInterval(poll);
    startup.promise.then(function () { settled = true; }, function () {});
  }, 200);
  setTimeout(function () {
    clearInterval(poll);
    if (settled) return;
    try { localStorage.removeItem('user-math-explorer'); } catch (e) {}
    window.__mathExplorerUnavailable = true;
    console.warn('Equation exploration could not be loaded, so it has been turned off for the next reload. The rest of the maths on this page may not have rendered either.');
  }, 8000);
}
})();
</script>`;

  const loaderScript = `<script id="MathJax-script" async src="${src}"></script>`;
  return `${configScript}\n${loaderScript}`;
}
