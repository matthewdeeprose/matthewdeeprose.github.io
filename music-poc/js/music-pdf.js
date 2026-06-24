// music-pdf.js
// The PDF orchestrator for the Accessible Music proof of concept (Stage 16).
//
// This module re-homes the proven pdf-spike pipeline into a real module that
// drives the real Stage 15 builder. It owns the whole-page flow: it asks Verovio
// to paginate a break-injected score onto fixed A4 pages, rasterises each page to
// PNG, then assembles the pages into a genuine multi-page tagged PDF via typst.ts,
// embedding the original MusicXML as an attachment. The pure document SOURCE
// (pagination breaks, multi-page markup, %PDF magic check) lives in
// js/music-pdf-markup.js; this module supplies the BROWSER mechanism around it
// (Verovio, canvas rasterise, typst.ts compile). Every proven primitive here is
// lifted verbatim from music-poc/experiments/pdf-spike, narrowed to the validated
// engraving norm. The whole runtime needs the browser; under node only
// `node --check` is meaningful. Exposed as globalThis.MusicPdf.

const MusicPdf = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly. Read
  // from globalThis (not window) so the shim resolves under node as well.
  const log = globalThis.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Consumer-side rasterise: the SVG-to-PNG primitive now lives in its own sibling
  // (js/music-pdf-rasterise.js), which owns the canvas and the ~16384px guard. Read
  // it from globalThis with a silent fallback so this file never throws at load if
  // the sibling is absent; a missing sibling resolves to null, which generate then
  // rejects on (no Uint8Array → no PDF).
  const rasterise = globalThis.MusicPdfRasterise || { rasteriseSvg() { return Promise.resolve(null); } };

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

  // renderPages(xml) → Promise<string[]> of one page SVG per page (its length is
  // the page count). The xml is already break-injected by the caller, so breaks
  // are honoured exactly. Verovio options reproduce the validated norm: fixed A4
  // (2100×2970 px = 210×297 mm), full page height kept, ONLY the encoded breaks,
  // scale held at 140, and the lines justified vertically to fill the page.
  async function renderPages(xml) {
    const tk = await verovioToolkitReady();
    tk.setOptions({
      pageWidth: 2100, // px — A4 width (210 mm); toolkit default page is also A4
      pageHeight: 2970, // px — A4 height (297 mm)
      adjustPageHeight: false, // keep each page a full A4 height
      breaks: "encoded", // use ONLY the <print> breaks already in the xml
      justifyVertically: true, // spread the systems to fill the page height
      scale: 140, // readable size, held at the validated norm (zoom only)
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
    });
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

  // generate(model, xml) → Promise<Uint8Array> of PDF bytes. The orchestrator:
  // it derives the bar count and title, reads the plain-language summary (its one
  // allowed DOM touch), injects pagination breaks into a COPY of the xml, renders
  // and rasterises each page, embeds the page PNGs and the ORIGINAL xml at
  // absolute /assets paths, builds the markup via the Stage 15 builder, and
  // compiles through the low-level typst.ts path. On a null/empty result it logs
  // the diagnostics and throws — never a silent null.
  async function generate(model, xml) {
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
    const brokenXml = markupSvc.withEncodedBreaks(xml, barCount);
    const svgs = await renderPages(brokenXml);

    const pngs = [];
    for (let i = 0; i < svgs.length; i++) {
      pngs.push(await rasterise.rasteriseSvg(svgs[i]));
    }

    const $typst = await getTypst();
    const compiler = await $typst.getCompiler();

    // Map each page PNG at an absolute /assets path, then the original xml.
    const pageImagePaths = [];
    for (let i = 0; i < pngs.length; i++) {
      const path = "/assets/page-" + (i + 1) + ".png";
      compiler.mapShadow(path, pngs[i]);
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

    const results = {
      hasRenderPages: typeof renderPages === "function",
      hasGenerate: typeof generate === "function",
      hasSelfTest: typeof selfTest === "function",
      pdfMagicTrueOnPdf:
        !!markupSvc && markupSvc.pdfMagicOk([0x25, 0x50, 0x44, 0x46, 0x2d]) === true,
      pdfMagicFalseOnNonPdf:
        !!markupSvc && markupSvc.pdfMagicOk([0x00, 0x01, 0x02, 0x03]) === false,
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
