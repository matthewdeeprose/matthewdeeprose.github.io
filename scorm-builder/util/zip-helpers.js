// Shared zip helpers used by both the SCORM package builder and the standalone
// HTML package builder. Extracted from scorm/package-builder.js so the two
// packagers stay DRY.
//
// JSZip is an INJECTED dependency (opts.deps.JSZip) with a globalThis.JSZip
// fallback, so these helpers stay dependency-free for browser consumers while
// node tests pass JSZip explicitly.

/**
 * Resolve the JSZip constructor from injected deps or a global, throwing a
 * helpful error when neither is present.
 * @param {object} [opts] - { deps: { JSZip } }
 * @returns {Function} the JSZip constructor
 */
export function resolveJSZip(opts = {}) {
  const JSZip = opts.deps?.JSZip || (typeof globalThis !== "undefined" ? globalThis.JSZip : undefined);
  if (!JSZip) {
    throw new Error(
      "scorm-builder: JSZip is required. Pass it via opts.deps.JSZip or expose it as a global (window.JSZip)."
    );
  }
  return JSZip;
}

/**
 * Bundle the MathJax es5 assets into a zip so the package renders maths fully
 * offline. Asset keys are relative to config.LOCAL_MATHJAX_DIR (e.g.
 * "es5/tex-chtml.js"); values may be strings or Uint8Array/Buffer (fonts).
 * Mutates `zip` and returns the entry paths written.
 * @param {object} zip - a JSZip instance
 * @param {object} assets - { 'es5/...': string|Uint8Array } map of MathJax files
 * @param {object} config - resolved config carrying LOCAL_MATHJAX_DIR
 * @returns {string[]} the entry paths added to the zip
 */
export function bundleLocalMathjax(zip, assets, config) {
  if (!assets || Object.keys(assets).length === 0) {
    throw new Error(
      "scorm-builder: mathjaxMode 'local' requires opts.mathjaxAssets (a { 'es5/...': content } map of MathJax files to bundle). " +
        "For the minimum set, see docs/developer-guide.md#mathjax-minimum-asset-set — note an INCOMPLETE map does not throw, " +
        "so a partial bundle ships a document where nothing typesets at all."
    );
  }
  const entries = [];
  for (const [rel, content] of Object.entries(assets)) {
    const path = `${config.LOCAL_MATHJAX_DIR}/${rel}`;
    zip.file(path, content);
    entries.push(path);
  }
  return entries;
}

// The autoload extension a document needs the moment it writes any chemistry.
export const MHCHEM_ASSET = "es5/input/tex/extensions/mhchem.js";

// \ce{...} and \pu{...} are mhchem's only entry points.
const CHEMISTRY_TEX = /\\(?:ce|pu)\s*\{/;

// ---------------------------------------------------------------------------
// The measured MathJax asset sets.
//
// These are DATA, not defaults. `mathjaxAssets` stays entirely caller-supplied and
// the library still fetches nothing — these exist so a caller does not have to
// rediscover by experiment what a document actually needs. Every figure below was
// measured cold in a real browser (P6, mathjax 3.2.2), zipped at DEFLATE level 9,
// because zipped is what an LMS size limit applies to.
//
// Sizes, for budgeting:
//   safe floor                24 files  1.44 MiB raw  0.59 MB zipped
//   + chemistry               25 files                +0.01 MB
//   + exploration             41 files                +0.51 MB
//   (the FULL es5/ tree      106 files 23.01 MiB      5.89 MB — 10x for no benefit)
//
// The fonts are already-compressed WOFF: 339.8 KB raw becomes 345.0 KB zipped, so
// DEFLATE *adds* 5 KB. Do not budget for font compression.
// ---------------------------------------------------------------------------

// Note the directory is `woff-v2` — MathJax font VERSION 2 — and these 23 files are
// WOFF 1.0 `.woff`, NOT WOFF2. The distinction matters only because "woff2" sends
// anyone checking sizes to the wrong assumption about compression.
const CHTML_FONT_DIR = "es5/output/chtml/fonts/woff-v2/";
const CHTML_FONT_FILES = [
  "MathJax_AMS-Regular.woff",
  "MathJax_Calligraphic-Bold.woff",
  "MathJax_Calligraphic-Regular.woff",
  "MathJax_Fraktur-Bold.woff",
  "MathJax_Fraktur-Regular.woff",
  "MathJax_Main-Bold.woff",
  "MathJax_Main-Italic.woff",
  "MathJax_Main-Regular.woff",
  "MathJax_Math-BoldItalic.woff",
  "MathJax_Math-Italic.woff",
  "MathJax_Math-Regular.woff",
  "MathJax_SansSerif-Bold.woff",
  "MathJax_SansSerif-Italic.woff",
  "MathJax_SansSerif-Regular.woff",
  "MathJax_Script-Regular.woff",
  "MathJax_Size1-Regular.woff",
  "MathJax_Size2-Regular.woff",
  "MathJax_Size3-Regular.woff",
  "MathJax_Size4-Regular.woff",
  "MathJax_Typewriter-Regular.woff",
  "MathJax_Vector-Bold.woff",
  "MathJax_Vector-Regular.woff",
  "MathJax_Zero.woff",
];

/**
 * The smallest set no document can under-cover: the entry point plus every CHTML
 * font. **24 files, 0.59 MB zipped.**
 *
 * Fonts are fetched lazily per glyph range, and three documents measured in P6 needed
 * three DIFFERENT subsets — `plain` pulled Size2 but neither Size3 nor Main-Bold;
 * `chem` pulled neither Size. So a set derived from one document silently loses
 * glyphs in another, and "measured for this document" is only ever correct for that
 * exact content. This is the floor to start from.
 * @type {ReadonlyArray<string>}
 */
export const MATHJAX_SAFE_FLOOR = Object.freeze([
  "es5/tex-chtml.js",
  ...CHTML_FONT_FILES.map((f) => CHTML_FONT_DIR + f),
]);

/**
 * What a document needs the moment it writes `\ce{}` or `\pu{}`. **1 file, +0.01 MB.**
 * `tex-chtml` ships `autoload`, which fetches this on demand — so CDN mode needs
 * nothing and it must NOT be added to `loader.load`. A local bundle has to carry it.
 * @type {ReadonlyArray<string>}
 */
export const MATHJAX_CHEMISTRY = Object.freeze([MHCHEM_ASSET]);

/**
 * Equation exploration and spoken maths. **17 files, +0.51 MB.**
 *
 * Measured: bundled and served over `http(s)://`, this gives full exploration and
 * generated speech on every equation with no internet connection at all. Under
 * `file://` the same bundle cannot work — SRE fetches its locale JSON by XHR, which
 * the file: scheme blocks — so this is worth bundling for an LMS package and is dead
 * weight in one meant to be opened directly.
 * @type {ReadonlyArray<string>}
 */
export const MATHJAX_EXPLORATION = Object.freeze([
  "es5/a11y/explorer.js",
  "es5/a11y/sre.js",
  "es5/a11y/semantic-enrich.js",
  "es5/input/mml.js",
  ...["base", "ca", "da", "de", "en", "es", "fr", "hi", "it", "nb", "nemeth", "nn", "sv"].map(
    (l) => `es5/sre/mathmaps/${l}.json`
  ),
]);

// The subset of MATHJAX_EXPLORATION that a document was measured to actually request:
// the four JS files, plus the base map and the English locale. Anything less than this
// is a chain that dies part-way, which is what hangs startup.promise. The remaining
// locales are optional — bundle them only for documents in those languages.
const EXPLORATION_CORE = Object.freeze([
  "es5/a11y/explorer.js",
  "es5/a11y/sre.js",
  "es5/a11y/semantic-enrich.js",
  "es5/input/mml.js",
  "es5/sre/mathmaps/base.json",
  "es5/sre/mathmaps/en.json",
]);

/**
 * Build-time completeness check for a caller-supplied `mathjaxAssets` map.
 *
 * `tex-chtml` ships `autoload`, so chemistry needs nothing extra in CDN mode —
 * and, measured, autoload works even under file:// (it injects a <script>, where
 * SRE fails because it fetches locale JSON by XHR). But `mathjaxAssets` is
 * entirely caller-supplied, so under mathjaxMode 'local' an incomplete map means
 * autoload has nothing to load. That failure is NOT confined to the chemistry:
 * MathJax's startup.promise rejects and the whole page stops typesetting, so a
 * plain $E = mc^2$ elsewhere in the document stays literal text.
 *
 * Warn, never throw — a caller who knows what they are doing must still be able
 * to ship — and warn at BUILD time, where they can act, rather than silently in
 * a learner's browser.
 *
 * @param {string} html - the assembled document (the TeX source is still in it)
 * @param {object} [assets] - the { 'es5/...': content } map that will be bundled
 * @returns {Array<{type: string, message: string, snippet: string}>}
 */
export function auditMathjaxAssets(html, assets) {
  const src = String(html || "");
  // An absent or empty map already gets a clear, actionable error from
  // bundleLocalMathjax. A pile of warnings in front of it would bury that message,
  // not improve it.
  if (!assets || typeof assets !== "object" || Object.keys(assets).length === 0) return [];
  const has = (p) => Object.prototype.hasOwnProperty.call(assets, p);
  const findings = [];

  // 1. No entry point. Measured: MathJax never loads — no MathJax.startup at all,
  //    zero containers — and today nothing anywhere says so.
  if (!has("es5/tex-chtml.js")) {
    findings.push({
      type: "mathjax-missing-core",
      message:
        `Advisory warning: mathjaxAssets does not include "es5/tex-chtml.js", which is the ` +
        `entry point the document's <script> tag points at. Without it MathJax never loads ` +
        `at all: no equation renders, and nothing in the browser reports why. Add it — it is ` +
        `the one file no document can do without.`,
      snippet: "es5/tex-chtml.js",
    });
  }

  // 2. A partial font set. Measured: fonts are fetched lazily per glyph range, and
  //    three documents needed three different subsets — so a map derived by watching
  //    one document under-covers the next one silently.
  const missingFonts = CHTML_FONT_FILES.filter((f) => !has(CHTML_FONT_DIR + f));
  if (missingFonts.length && missingFonts.length < CHTML_FONT_FILES.length) {
    const present = CHTML_FONT_FILES.length - missingFonts.length;
    findings.push({
      type: "mathjax-incomplete-fonts",
      message:
        `Advisory warning: mathjaxAssets carries ${present} of the 23 CHTML fonts. This is not a ` +
        `build error and this document may well render perfectly — the risk is to OTHER documents ` +
        `built from the same map. MathJax fetches fonts lazily per glyph range, so a set measured ` +
        `from one document silently loses glyphs in another: the affected characters simply do not ` +
        `paint, with a correct DOM, correct screen-reader MathML and no console error, so only ` +
        `sighted readers ever see it. Bundle all 23 (MATHJAX_SAFE_FLOOR) — they cost 0.34 MB zipped.`,
      snippet: missingFonts.join(", "),
    });
  } else if (missingFonts.length === CHTML_FONT_FILES.length) {
    findings.push({
      type: "mathjax-incomplete-fonts",
      message:
        `Advisory warning: mathjaxAssets carries none of the 23 CHTML fonts. Maths will lay out ` +
        `but render no characters. Bundle MATHJAX_SAFE_FLOOR — all 23 cost 0.34 MB zipped.`,
      snippet: CHTML_FONT_DIR + "*.woff",
    });
  }

  // 3. Chemistry without mhchem. tex-chtml ships autoload, so CDN mode needs nothing
  //    and we deliberately do not preload it — but a local bundle must carry it.
  const chem = src.match(CHEMISTRY_TEX);
  if (chem && !has(MHCHEM_ASSET)) {
    findings.push({
      type: "mathjax-missing-mhchem",
      message:
        `This document contains chemistry (\\ce{} or \\pu{}) and mathjaxMode is "local", but ` +
        `mathjaxAssets does not include "${MHCHEM_ASSET}". MathJax will try to autoload it, ` +
        `fail (there is no network in an offline package), and its startup promise will reject — ` +
        `which stops ALL maths in the document from rendering, not just the chemistry: ` +
        `every other equation stays as literal TeX text. Add that file to mathjaxAssets.`,
      snippet: src.slice(chem.index, chem.index + 60).split("\n")[0],
    });
  }

  // 4. A half-bundled exploration chain. Measured: this is the configuration that
  //    leaves startup.promise PERMANENTLY PENDING — it does not even reject, so there
  //    is nothing to catch and no error beyond one CORS line.
  const explorationPresent = EXPLORATION_CORE.filter(has);
  if (explorationPresent.length && explorationPresent.length < EXPLORATION_CORE.length) {
    const missing = EXPLORATION_CORE.filter((p) => !has(p));
    findings.push({
      type: "mathjax-partial-exploration",
      message:
        `Advisory warning: mathjaxAssets carries part of the equation-exploration chain but not ` +
        `all of it. An incomplete chain is the worst measured configuration in this library: ` +
        `MathJax's startup promise never settles — it does not reject either, so there is nothing ` +
        `to catch — and NO equation typesets anywhere in the document. Either bundle the whole ` +
        `chain (MATHJAX_EXPLORATION) or none of it; the safe floor on its own is a perfectly ` +
        `good package that simply has no exploration.`,
      snippet: missing.join(", "),
    });
  }

  return findings;
}

/**
 * Validate and normalise a companion-asset path to a safe, relative POSIX path
 * suitable both as a zip entry and as an imsmanifest `<file href>`. Throws on
 * anything that could escape the package or clobber a core SCORM file.
 * @param {string} input - the caller-supplied path (zip-relative)
 * @param {object} config - resolved config carrying the reserved core filenames
 * @returns {string} the cleaned relative path
 */
export function normalizeAssetPath(input, config) {
  if (input == null || typeof input !== "string") {
    throw new Error("scorm-builder: asset path must be a non-empty string.");
  }
  // Normalise separators and collapse duplicate slashes.
  let path = input.replace(/\\/g, "/").replace(/\/{2,}/g, "/").trim();

  if (!path) throw new Error("scorm-builder: asset path must be a non-empty string.");
  if (path.startsWith("/")) {
    throw new Error(`scorm-builder: asset path must be relative, got absolute "${input}".`);
  }
  if (/^[a-zA-Z]:/.test(path)) {
    throw new Error(`scorm-builder: asset path must be relative, got drive path "${input}".`);
  }
  if (path.endsWith("/")) {
    throw new Error(`scorm-builder: asset path must be a file, not a directory "${input}".`);
  }
  if (path.split("/").some((seg) => seg === "..")) {
    throw new Error(`scorm-builder: asset path must not contain ".." segments "${input}".`);
  }

  const reserved = new Set(
    [
      config.CONTENT_FILENAME,
      config.MANIFEST_FILENAME,
      config.METADATA_FILENAME,
      config.API_FILENAME,
      config.README_FILENAME,
    ].map((f) => f.toLowerCase())
  );
  if (reserved.has(path.toLowerCase())) {
    throw new Error(`scorm-builder: asset path "${input}" collides with a reserved SCORM file.`);
  }

  return path;
}

/**
 * Write caller-supplied companion files into the package zip and return their
 * (normalised) entry paths — so they can also be declared in the manifest.
 * Absent/empty assets yield no entries. Values may be anything JSZip.file()
 * accepts (string | Uint8Array | Buffer | ArrayBuffer | Blob).
 * @param {object} zip - a JSZip instance
 * @param {object} [assets] - { 'relative/path.ext': content } map
 * @param {object} config - resolved config (reserved filenames)
 * @returns {string[]} the entry paths added to the zip (insertion order)
 */
export function bundleAssets(zip, assets, config) {
  if (!assets || Object.keys(assets).length === 0) return [];
  const entries = [];
  const seen = new Set();
  for (const [rawPath, content] of Object.entries(assets)) {
    const path = normalizeAssetPath(rawPath, config);
    if (seen.has(path.toLowerCase())) {
      throw new Error(`scorm-builder: duplicate asset path "${path}".`);
    }
    seen.add(path.toLowerCase());
    zip.file(path, content);
    entries.push(path);
  }
  return entries;
}
