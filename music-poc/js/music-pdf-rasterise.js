// music-pdf-rasterise.js
// The SVG-to-PNG rasterise primitive for the Accessible Music proof of concept.
//
// An EFFECTS PRIMITIVE, split out of the Stage 16 orchestrator (js/music-pdf.js)
// so the orchestrator stays under its soft line ceiling — the modularity note in
// docs/poc-plan-phase-4.md names this exact split. Unlike the pure builder
// (js/music-pdf-markup.js), this module touches the browser: it OWNS the canvas,
// and it is the SINGLE home of the ~16384px MAX_CANVAS_DIM guard that keeps an
// over-large page from failing silently. Its only collaborator is logging. The
// rasteriseSvg body and the guard are lifted VERBATIM from the orchestrator with
// no behaviour change: factor still defaults to 3, the guard still trips over the
// same limit and logs the same message, and it still returns a Promise of a
// Uint8Array (or rejects). Its selfTest is BROWSER-ONLY because it needs document
// and a canvas; under node only `node --check` is meaningful. Exposed as
// globalThis.MusicPdfRasterise.

const MusicPdfRasterise = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly. Read
  // from globalThis (not window) so the shim resolves under node as well.
  const log = globalThis.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // The browser's maximum canvas dimension. Beyond this, getContext/toBlob fail
  // silently (toBlob returns null); we guard explicitly so an over-large page
  // surfaces a clear error rather than a broken PNG. The validated scale (140)
  // keeps A4 pages well within this; the guard is the safety net.
  const MAX_CANVAS_DIM = 16384;

  // rasteriseSvg(svg, factor) → Promise<Uint8Array> of PNG bytes. Draws the page
  // SVG to a canvas at factor (default 3) on a white background. Lifted verbatim
  // from the spike, plus the explicit ~16384px canvas-dimension guard: if a
  // dimension would exceed the browser limit, or toBlob returns null, the error
  // is surfaced clearly (logged and rejected) rather than yielding a silent
  // broken result. The factor drops to 2 only if a larger page is ever needed.
  function rasteriseSvg(svg, factor) {
    const scale = factor && factor >= 1 ? factor : 3;
    let s = String(svg || "");
    if (!/xmlns\s*=/.test(s)) {
      s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return new Promise(function (resolve, reject) {
      const blob = new Blob([s], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function () {
        try {
          const w = Math.max(1, Math.round((img.naturalWidth || 1200) * scale));
          const h = Math.max(1, Math.round((img.naturalHeight || 1600) * scale));
          if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
            URL.revokeObjectURL(url);
            logError("rasteriseSvg: canvas dimension exceeds limit", { w, h, MAX_CANVAS_DIM });
            reject(new Error("Canvas dimension " + w + "×" + h + " exceeds the " + MAX_CANVAS_DIM + "px limit"));
            return;
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          canvas.toBlob(function (pngBlob) {
            if (!pngBlob) {
              logError("rasteriseSvg: canvas.toBlob returned null");
              reject(new Error("canvas.toBlob returned null"));
              return;
            }
            pngBlob
              .arrayBuffer()
              .then(function (buf) {
                resolve(new Uint8Array(buf));
              })
              .catch(reject);
          }, "image/png");
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("SVG failed to load as an image (bad markup or unembedded font)"));
      };
      img.src = url;
    });
  }

  // selfTest — BROWSER-ONLY (needs document and a canvas). Async because
  // rasteriseSvg is async. Builds a results object, console.table()s it and
  // returns it (the resolved value of the promise).
  async function selfTest() {
    const tinySvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#000"/></svg>';

    // Rasterise a tiny SVG and check the PNG magic (0x89 0x50 0x4E 0x47).
    let pngMagicOk = false;
    try {
      const bytes = await rasteriseSvg(tinySvg);
      pngMagicOk =
        bytes instanceof Uint8Array &&
        bytes.length > 0 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47;
    } catch (e) {
      logError("selfTest: rasteriseSvg on tiny SVG failed", e);
    }

    // A deliberately huge factor must surface the over-limit guard (null OR throw),
    // never a silent broken result.
    let guardSurfaced = false;
    try {
      const over = await rasteriseSvg(tinySvg, 100000);
      guardSurfaced = over === null;
    } catch (e) {
      guardSurfaced = true;
    }

    const results = {
      hasRasteriseSvg: typeof rasteriseSvg === "function",
      hasSelfTest: typeof selfTest === "function",
      rasterisePngMagicOk: pngMagicOk,
      canvasGuardSurfaced: guardSurfaced,
    };

    if (typeof console !== "undefined" && typeof console.table === "function") {
      console.table(results);
    }
    logInfo("MusicPdfRasterise selfTest verdict", results);
    return results;
  }

  return {
    rasteriseSvg,
    selfTest,
  };
})();

// Attach to globalThis (not window) to mirror its Stage 16 siblings: node --check
// stays clean, and in the browser globalThis IS window, so
// window.MusicPdfRasterise resolves unchanged.
globalThis.MusicPdfRasterise = MusicPdfRasterise;
