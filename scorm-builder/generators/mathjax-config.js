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

// siunitx-STYLE unit commands, written as plain TeX macros (MathJax 3.2.2 ships no `siunitx`).
//
// `\SI{5}{\micro\farad}` used to render as three red undefined-macro words and be read out as
// "backslash SI 5 backslash micro backslash farad". This table gives a course author the commands
// they reach for, with the unit written upright and the number a thin space before it, as siunitx
// does. It is deliberately NOT siunitx: no options, no digit grouping, no `\SI{1.5e3}{...}`.
//
// Only `tex.macros` (the bundled `configmacros`) and `\mathrm` are used, so nothing is added to
// `loader.load` and nothing can fail offline or over file://. `\class`, `\cssId` and `\style` live
// in the autoloaded `html` extension and are avoided for that reason. Each unit is its own
// `\mathrm{...}` token, so the speech is the same as for a hand-written `\mathrm{m/s^2}`:
// "9.81 normal m divided by normal s squared". MathJax's `class="MathML-Unit"` marking (which makes
// the Speech Rule Engine say unit WORDS) was measured and rejected: SRE reads F as Fahrenheit,
// C as Celsius and T as tons, and mixing marked and unmarked tokens inserts a stray "times".
//
// A name MathJax already defines is never redefined (`\square`, `\deg`, `\min`), and an author's
// own \newcommand, \renewcommand or \def of one of these names wins (measured, RA-27). The emitted
// script is ASCII whatever encoding the export is saved in: siMacrosSource() escapes every
// non-ASCII character.
const SI_UPRIGHT = (symbol) => "\\mathrm{" + symbol + "}";

export const SI_PREFIXES = Object.freeze({
  // micro is the Greek letter itself, not `\mu`: MathJax's TeX font has no upright lowercase Greek,
  // so `\mathrm{\mu}` still draws the italic glyph (measured: one `TEX-I` glyph). The literal letter
  // is drawn upright by the browser's own font, and is spoken "normal mu" either way.
  yocto: "y", zepto: "z", atto: "a", femto: "f", pico: "p", nano: "n", micro: "μ", milli: "m",
  centi: "c", deci: "d", deca: "da", deka: "da", hecto: "h", kilo: "k", mega: "M", giga: "G",
  tera: "T", peta: "P", exa: "E", zetta: "Z", yotta: "Y",
});

export const SI_UNITS = Object.freeze({
  // The 7 SI base units (the kilogram is a prefix and a unit, as in siunitx).
  metre: "m", meter: "m", second: "s", gram: "g", ampere: "A", kelvin: "K", mole: "mol", candela: "cd",
  // The 22 named derived units.
  radian: "rad", steradian: "sr", hertz: "Hz", newton: "N", pascal: "Pa", joule: "J", watt: "W",
  coulomb: "C", volt: "V", farad: "F", ohm: "\\Omega", siemens: "S", weber: "Wb", tesla: "T", henry: "H",
  degreeCelsius: "°C", lumen: "lm", lux: "lx", becquerel: "Bq", gray: "Gy", sievert: "Sv", katal: "kat",
  // Units accepted for use with the SI.
  litre: "L", liter: "L", minute: "min", hour: "h", day: "d", tonne: "t", electronvolt: "eV",
  percent: "\\%", degree: "°",
});

// [replacement text, number of arguments]; a plain string takes none.
export const SI_COMMANDS = Object.freeze({
  SI: ["#1\\,#2", 2],
  qty: ["#1\\,#2", 2],
  si: ["#1", 1],
  unit: ["#1", 1],
  num: ["#1", 1],
  ang: ["#1^{\\circ}", 1],
  per: "/",
  squared: "^{2}",
  cubed: "^{3}",
  tothe: ["^{#1}", 1],
  kilogram: "\\kilo\\gram",
});

// The `macros` object, built from the three tables above.
export function buildSiMacros() {
  const macros = {};
  for (const [name, symbol] of Object.entries(SI_PREFIXES)) macros[name] = SI_UPRIGHT(symbol);
  for (const [name, symbol] of Object.entries(SI_UNITS)) macros[name] = SI_UPRIGHT(symbol);
  for (const [name, def] of Object.entries(SI_COMMANDS)) macros[name] = def;
  return macros;
}

// The same object as a JavaScript literal for the <script> block. JSON is a subset of JS, and
// replacing every non-ASCII character with its \uXXXX escape keeps the script ASCII.
export function siMacrosSource() {
  return JSON.stringify(buildSiMacros()).replace(
    /[^\x00-\x7f]/g,
    (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0")
  );
}

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
    // (via the aria-label speech below). It does NOT govern the Explorer's walk or the
    // equations' screen-reader labels, which are MathSpeak whatever is saved (RA-31).
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
  //
  // RA-33 (19 Oct 2026): the `file:` test applies only when MathJax is LOCAL. Measured at
  // RA-30, with the test lifted from a CDN-mode export opened from a file on the computer
  // and the network on, SRE reads its data from jsDelivr over https (which allows any
  // origin) and the page equals the hosted one on every count. A local export lifted the
  // same way gets no equations at all. So the mode, known here at build time, decides:
  // network MathJax drops the test, local MathJax keeps it. The network case also
  // publishes `window.__mathFromNetwork`, which explorerSupported() in the controls reads;
  // an export built without it falls back to the `file:` test there.
  const loadsFromNetwork = opts.mathjaxMode !== "local";
  const explorerGate =
    "(function(){ try { return " +
    (loadsFromNetwork ? "" : "location.protocol !== 'file:' && ") +
    "localStorage.getItem('user-math-explorer') === 'on'; } catch (e) { return false; } })()";
  const networkFlag = loadsFromNetwork ? "window.__mathFromNetwork = true;\n" : "";

  // RA-43 (20 October 2026): the watchdog no longer deletes the saved choice. It used to, on
  // the reasoning below, and a reader whose MathJax was only SLOW (it arrived at 15 s and the
  // explorer then worked) lost the choice for every later visit. It now gives up for THIS
  // load only (8 s timer, or at once when the loader script reports an error). If MathJax's
  // startup promise fulfils afterwards, __mathExplorerRecovered lets the controls put the box
  // back, silently, unless the reader has touched it meanwhile. The cost is the one the
  // deletion existed to avoid: if the exploration chain itself stalls startup, the reader
  // reloads into the same blank document until they untick the box (measured RA-42, HANG
  // arm). The owner chose that trade (RA-42 W4).
  //
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
  //
  // About `speechRules`, which the menu settings in the literal below deliberately omit
  // (kept here for the same size reason). Nothing sets it at load time. updateExplorer()
  // in mathjax-controls.js no longer touches the menu (RA-29), so the only writer is
  // updateSpeechRules(domain), which runs when the reader changes their speech style in
  // the page. Measured at RA-31 (explorer on, cold and warm, over http): this MathJax's
  // menu.settings has no `speechRules` key at all, this config sets no options.sre, and
  // SRE's domain is MathJax's default, mathspeak, whichever style the reader saved. Do
  // not read the `speechDomain` option above as controlling the Explorer's walk: it does
  // not on this build.

  const configScript = `<script>
(function () {
${networkFlag}var mjxExplorer = ${explorerGate};
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
    displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
    processEscapes: true,
    tags: 'ams',
    macros: ${siMacrosSource()}
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
      }
    }
  },
  loader: { load: ['ui/menu', ${a11yLoad}].concat(mjxExplorer ? ['a11y/explorer'] : []) },
  chtml: { displayAlign: 'left'${chtmlAdaptive} }
};

// Watchdog: if exploration was requested but MathJax does not start up, give up on
// exploration for this load only. The saved choice is kept.
if (mjxExplorer) {
  var settled = false;
  var gaveUp = false;
  var poll = setInterval(function () {
    var startup = window.MathJax && window.MathJax.startup;
    if (!startup || !startup.promise || typeof startup.promise.then !== 'function') return;
    clearInterval(poll);
    startup.promise.then(function () { settled = true; }, function () {});
  }, 200);
  function giveUp() {
    if (gaveUp || settled) return;
    gaveUp = true;
    clearInterval(poll);
    window.__mathExplorerUnavailable = true;
    if (typeof window.__mathExplorerGaveUp === 'function') { try { window.__mathExplorerGaveUp(); } catch (e) {} }
    console.warn('Equation exploration could not be loaded, so it is off for this visit. The rest of the maths on this page may not have rendered either.');
    var tries = 0;
    var recoverPoll = setInterval(function () {
      var startup = window.MathJax && window.MathJax.startup;
      if (++tries > 900) { clearInterval(recoverPoll); return; }
      if (!startup || !startup.promise || typeof startup.promise.then !== 'function') return;
      clearInterval(recoverPoll);
      startup.promise.then(function () {
        window.__mathExplorerUnavailable = false;
        if (typeof window.__mathExplorerRecovered === 'function') { try { window.__mathExplorerRecovered(); } catch (e) {} }
      }, function () {});
    }, 200);
  }
  document.addEventListener('error', function (e) {
    if (e.target && e.target.id === 'MathJax-script') giveUp();
  }, true);
  setTimeout(giveUp, 8000);
}
})();
</script>`;

  const loaderScript = `<script id="MathJax-script" async src="${src}"></script>`;
  return `${configScript}\n${loaderScript}`;
}
