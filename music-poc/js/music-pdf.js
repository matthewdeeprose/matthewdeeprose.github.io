// music-pdf.js
// The PDF orchestrator for the Accessible Music proof of concept (Stage 20).
//
// This module re-homes the proven pdf-spike pipeline into a real module that
// drives the real Stage 15 builder. It owns the whole-page flow: it asks Verovio
// to paginate a break-injected score onto pages whose size and staff unit come
// from a named engraving profile, embeds each page as a vector SVG, then
// assembles the pages into a genuine multi-page tagged PDF via typst.ts,
// embedding the original MusicXML as an attachment. Threading a profile name
// selects standard or large-print engraving from one pipeline. The pure document
// SOURCE (pagination breaks, multi-page markup, %PDF magic check) lives in
// js/music-pdf-markup.js; this module supplies the BROWSER mechanism around it
// (Verovio, typst.ts compile). Every proven primitive here is lifted verbatim
// from music-poc/experiments/pdf-spike, narrowed to the validated engraving
// norm. The whole runtime needs the browser; under node only `node --check` and
// the pure-builder selfTest rows are meaningful. Exposed as globalThis.MusicPdf.

const MusicPdf = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly. Read
  // from globalThis (not window) so the shim resolves under node as well.
  const log = globalThis.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // The PNG primitive in js/music-pdf-rasterise.js is parked, not deleted, so a
  // PNG-versus-SVG comparison can still run from the spike harness or a direct
  // MusicPdfRasterise.rasteriseSvg call while the SVG profiles are tuned. The
  // production path embeds vector SVG and does not call it, so no consumer const
  // is held here any longer.

  // Proven, pinned constants, lifted verbatim from the spike so the mechanism is
  // identical to the validated path.
  const TYPST_MODULE_URL =
    "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts@0.7.0/dist/esm/contrib/all-in-one-lite.bundle.js";
  const TYPST_WASM_URL =
    "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@0.7.0/pkg/typst_ts_web_compiler_bg.wasm";
  const MAIN = "/main.typ"; // absolute main .typ path the spike compiles with
  const FORMAT_PDF = 1; // CompileFormatEnum.pdf
  const ATTACH_PATH = "/assets/score.musicxml"; // absolute vfs path for the source
  const MUSICXML_MIME = "application/vnd.recordare.musicxml+xml";
  const DOC_LANG = "en";
  const DEFAULT_TITLE = "Accessible Music score"; // British fallback when workTitle absent

  // Engraving profiles for the PDF, keyed by profile name. Each holds the Verovio
  // options that set the staff SIZE; the shared layout options are the same for
  // every profile. Fine-tune large print by editing these labelled numbers.
  //
  // Why these levers and not scale: each page is placed at width:100% in the
  // Typst markup, so Typst fits every page SVG to the page width, and the staff
  // size on the final PDF is the staff height RELATIVE TO the Verovio page width.
  //   - unit sets the staff size directly, but Verovio caps it: the real range is
  //     4.5 to 12.0, and a value outside reverts SILENTLY to 9. Twelve is the
  //     largest staff the unit alone can give.
  //   - pageWidth/pageHeight break past that cap: a NARROWER Verovio page makes
  //     the same staff a larger fraction of the width, which the width-fit then
  //     enlarges. Keep height with width at roughly the 1.41 A4 ratio so each
  //     page holds its shape while the staff grows.
  //   - scale is RETIRED: it resizes the whole SVG with the same music, so the
  //     width-fit cancels it. It did nothing on the old standard PDF either.
  //   - line widths are optional refinements, set only where a profile lists
  //     them; a profile that omits them keeps Verovio's defaults.
  const ENGRAVING_PROFILES = {
    // standard: A4 at the Verovio default unit. pageWidth/pageHeight are A4 in
    // 0.1 mm units (210 x 297 mm); unit 9 is the Verovio default, so this matches
    // the current standard PDF once scale is dropped. No line widths: defaults.
    standard: { pageWidth: 2100, pageHeight: 2970, unit: 9 },
    // large-print: a narrower 120 x 170 mm page (roughly A4 ratio) at the unit
    // cap of 12, which together give a staff of about 9 to 10 mm. Slightly
    // heavier lines aid low-vision reading.
    "large-print": {
      pageWidth: 1200,
      pageHeight: 1700,
      unit: 12,
      staffLineWidth: 0.15,
      barLineWidth: 0.3,
      stemWidth: 0.2,
    },
  };
  const DEFAULT_ENGRAVING_PROFILE = "standard";

  // Shared layout options, identical for every profile: page geometry stays full
  // height with ONLY the encoded breaks honoured, the systems justified to fill
  // the page, no running header or footer, and even 100-unit margins. The profile
  // supplies page size and staff unit on top of this; scale is not included here
  // or in any profile (retired — the width-fit cancels it).
  const SHARED_ENGRAVING = {
    adjustPageHeight: false, // keep each page a full page height
    breaks: "encoded", // use ONLY the <print> breaks already in the xml
    justifyVertically: true, // spread the systems to fill the page height
    // Measure numbers at the start of every system. mnumInterval is the
    // confirmed measure-number frequency option (Verovio 6.2.0 toolkit-options
    // docs); 0 is its default-rule value. UNCONFIRMED: the docs do not state
    // the default value nor explicitly confirm 0 prints at each system start.
    // Matthew sees in the PDF whether numbers print; if none appear, try 1.
    mnumInterval: 0,
    header: "none",
    footer: "none",
    pageMarginTop: 100,
    pageMarginBottom: 100,
    pageMarginLeft: 100,
    pageMarginRight: 100,
  };

  // engravingOptionsFor(profile) → the merged Verovio options for a profile. Pure:
  // it touches no toolkit and no DOM. An undefined or empty profile falls back to
  // standard silently; an unknown string logWarns then falls back. The result is a
  // fresh object so callers cannot mutate the shared blocks.
  function engravingOptionsFor(profile) {
    let key = profile || DEFAULT_ENGRAVING_PROFILE;
    if (!ENGRAVING_PROFILES[key]) {
      logWarn(
        "Unknown engraving profile '" + profile + "'; falling back to '" + DEFAULT_ENGRAVING_PROFILE + "'"
      );
      key = DEFAULT_ENGRAVING_PROFILE;
    }
    return Object.assign({}, SHARED_ENGRAVING, ENGRAVING_PROFILES[key]);
  }

  // Lazily-loaded, module-scoped cache of the typst.ts $typst handle. typst.ts is
  // a ~12MB ES module, so it is imported only on the first PDF request and then
  // reused. This dynamic import() is the SINGLE documented exception to the
  // project's no-ES-module rule; it lives behind getTypst so node --check stays
  // clean (the specifier is only resolved when the function is called).
  let typstPromise = null;
  function getTypst() {
    if (!typstPromise) {
      typstPromise = import(/* @vite-ignore */ TYPST_MODULE_URL).then(function (mod) {
        // Point the compiler at the matched, pinned wasm. Done once per load.
        mod.$typst.setCompilerInitOptions({ getModule: () => TYPST_WASM_URL });
        return mod.$typst;
      });
    }
    return typstPromise;
  }

  // Wait for the Verovio wasm runtime, then resolve a fresh toolkit instance.
  // Lifted verbatim from the spike; reads globalThis.verovio at CALL time so the
  // Stage 17 <script> tag can provide it without this file referencing it at load.
  function verovioToolkitReady() {
    return new Promise(function (resolve, reject) {
      const v = globalThis.verovio;
      if (!v || !v.module) {
        reject(new Error("Verovio global not found"));
        return;
      }
      if (v.module.calledRun) {
        try {
          resolve(new v.toolkit());
        } catch (e) {
          reject(e);
        }
        return;
      }
      v.module.onRuntimeInitialized = function () {
        try {
          resolve(new v.toolkit());
        } catch (e) {
          reject(e);
        }
      };
    });
  }

  // renderPages(xml, profile) → Promise<string[]> of one page SVG per page (its
  // length is the page count). The xml is already break-injected by the caller, so
  // breaks are honoured exactly. The page size and staff unit come from the named
  // engraving profile (standard or large-print) merged over the shared layout;
  // scale is dropped (retired — the width-fit cancels it).
  async function renderPages(xml, profile) {
    const tk = await verovioToolkitReady();
    tk.setOptions(engravingOptionsFor(profile));
    const ok = tk.loadData(xml);
    if (ok === false) throw new Error("Verovio loadData reported failure");
    const pageCount = tk.getPageCount();
    if (!pageCount || pageCount < 1) {
      throw new Error("Verovio getPageCount returned " + pageCount);
    }
    const svgs = [];
    for (let n = 1; n <= pageCount; n++) {
      const svg = tk.renderToSVG(n); // n is 1-based
      if (!svg) throw new Error("Verovio renderToSVG(" + n + ") was empty");
      svgs.push(svg);
    }
    logInfo("renderPages produced " + svgs.length + " page SVG(s)");
    return svgs;
  }

  // generate(model, xml, profile) → Promise<Uint8Array> of PDF bytes. The
  // orchestrator: it derives the bar count and title, reads the plain-language
  // summary (its one allowed DOM touch), injects pagination breaks into a COPY of
  // the xml, renders each page under the named engraving profile, embeds each page
  // as a vector SVG and the ORIGINAL xml at absolute /assets paths, builds the
  // markup via the Stage 15 builder, and compiles through the low-level typst.ts
  // path. On a null/empty result it logs the diagnostics and throws — never a
  // silent null.
  async function generate(model, xml, profile) {
    const markupSvc = globalThis.MusicPdfMarkup;
    if (!markupSvc) throw new Error("MusicPdfMarkup is not available");
    const summarySvc = globalThis.MusicRenderSummary;

    const barCount =
      model && model.parts[0] && model.parts[0].measures
        ? model.parts[0].measures.length
        : 0;
    const title = model && model.workTitle ? model.workTitle : DEFAULT_TITLE;
    const lang = DOC_LANG;

    // Summary text: render the model into a detached <div> and read its <p>. This
    // is the orchestrator's only DOM touch, and it reads from the ORIGINAL model.
    let summaryText = "";
    if (summarySvc) {
      const div = document.createElement("div");
      summarySvc.render(model, div);
      const p = div.querySelector("p");
      summaryText = p ? p.textContent : "";
    }

    // Inject breaks into a COPY; the original xml stays the attachment and the
    // source of the summary's data.
    const brokenXml = markupSvc.withEncodedBreaks(xml, barCount, profile);
    const svgs = await renderPages(brokenXml, profile);

    const $typst = await getTypst();
    const compiler = await $typst.getCompiler();

    // Map each page as a vector SVG at an absolute .svg /assets path, then the
    // original xml. The builder emits the path verbatim, so #image auto-detects
    // SVG from the .svg extension; no markup change is needed.
    const pageImagePaths = [];
    for (let i = 0; i < svgs.length; i++) {
      const path = "/assets/page-" + (i + 1) + ".svg";
      compiler.mapShadow(path, new TextEncoder().encode(svgs[i]));
      pageImagePaths.push(path);
    }
    compiler.mapShadow(ATTACH_PATH, new TextEncoder().encode(xml));

    const attachments = [
      {
        path: ATTACH_PATH,
        mimeType: MUSICXML_MIME,
        description: "MusicXML source of " + title + ".",
        relationship: "source",
      },
    ];

    const markup = markupSvc.buildMultiPageMarkup({
      title: title,
      lang: lang,
      summaryText: summaryText,
      pageImagePaths: pageImagePaths,
      attachments: attachments,
    });

    // Write the markup as the main .typ source and compile via the low-level path.
    compiler.addSource(MAIN, markup);
    const res = await compiler.compile({
      root: "/",
      mainFilePath: MAIN,
      format: FORMAT_PDF,
      diagnostics: "full",
    });
    const diagnostics = res && res.diagnostics;
    const result = res && res.result;
    if (!(result instanceof Uint8Array) || result.length === 0) {
      logError("Typst compile produced no PDF", diagnostics);
      throw new Error("Typst compile produced no PDF bytes; see diagnostics");
    }
    logInfo("generate produced PDF (" + result.length + " bytes, " + pageImagePaths.length + " page(s))");
    return result;
  }

  // selfTest — checks the orchestrator's own surface. The rasterise and canvas-
  // guard rows now live in the sibling's selfTest (MusicPdfRasterise.selfTest),
  // so this one needs no canvas; it stays synchronous. Builds a results object,
  // console.table()s it and returns it.
  function selfTest() {
    const markupSvc = globalThis.MusicPdfMarkup || null;

    // The pure engraving-options builder is node-safe (no toolkit, no DOM), so it
    // is exercised directly here. The Verovio and typst runtime path stays
    // browser-proven by hand and out of selfTest.
    const standardOpts = engravingOptionsFor("standard");
    const largePrintOpts = engravingOptionsFor("large-print");

    const results = {
      hasRenderPages: typeof renderPages === "function",
      hasGenerate: typeof generate === "function",
      hasSelfTest: typeof selfTest === "function",
      pdfMagicTrueOnPdf:
        !!markupSvc && markupSvc.pdfMagicOk([0x25, 0x50, 0x44, 0x46, 0x2d]) === true,
      pdfMagicFalseOnNonPdf:
        !!markupSvc && markupSvc.pdfMagicOk([0x00, 0x01, 0x02, 0x03]) === false,
      standardPageSize:
        standardOpts.pageWidth === 2100 &&
        standardOpts.pageHeight === 2970 &&
        standardOpts.unit === 9,
      standardHasNoScale: !("scale" in standardOpts),
      standardOmitsLineWidths: !("staffLineWidth" in standardOpts),
      absentMatchesStandard:
        JSON.stringify(engravingOptionsFor()) === JSON.stringify(standardOpts),
      largePrintPageSize:
        largePrintOpts.pageWidth === 1200 &&
        largePrintOpts.pageHeight === 1700 &&
        largePrintOpts.unit === 12,
      largePrintLineWidths:
        largePrintOpts.staffLineWidth === 0.15 &&
        largePrintOpts.barLineWidth === 0.3 &&
        largePrintOpts.stemWidth === 0.2,
      unknownFallsBackToStandard:
        JSON.stringify(engravingOptionsFor("bogus")) === JSON.stringify(standardOpts),
      sharedOptionsPresent:
        standardOpts.breaks === "encoded" && standardOpts.adjustPageHeight === false,
    };

    if (typeof console !== "undefined" && typeof console.table === "function") {
      console.table(results);
    }
    logInfo("MusicPdf selfTest verdict", results);
    return results;
  }

  return {
    renderPages,
    generate,
    selfTest,
  };
})();

// Attach to globalThis (not window) to mirror the Stage 15 sibling: node --check
// stays clean, and in the browser globalThis IS window, so window.MusicPdf
// resolves unchanged.
globalThis.MusicPdf = MusicPdf;
