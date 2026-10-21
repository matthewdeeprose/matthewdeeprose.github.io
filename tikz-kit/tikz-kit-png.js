/**
 * @file tikz-kit-png.js
 * @description Rasterises a rendered figure SVG to a PNG Blob (SVG -> Image -> canvas), the route proved
 * in P1: the browser honours the @font-face data: URIs inside the SVG, so the fonts survive. Pass it the
 * SVG that TikzKit.render() returned (fonts embedded); an SVG without them draws in fallback fonts.
 *
 * @module TikzKitPng
 */
(function (root) {
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[TikzKitPng]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[TikzKitPng]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.info("[TikzKitPng]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.debug("[TikzKitPng]", message, ...args);
  }

  const DEFAULT_SCALE = 2;
  const MAX_CANVAS_SIDE = 16000; // stay well inside the browser canvas limits
  const PT_TO_PX = 4 / 3; // CSS: 1pt = 4/3 px

  // size in CSS pixels: width/height attributes (pt or px), else the viewBox
  function svgSize(svg) {
    const rootTag = /<svg\b(?:"[^"]*"|'[^']*'|[^'">])*>/.exec(svg);
    if (!rootTag) throw new Error("toPng: no <svg> root element");
    const attr = (name) => {
      const m = new RegExp("\\s" + name + '="([\\d.]+)(pt|px)?"').exec(rootTag[0]);
      return m ? parseFloat(m[1]) * (m[2] === "pt" ? PT_TO_PX : 1) : null;
    };
    let w = attr("width");
    let h = attr("height");
    if (!(w > 0 && h > 0)) {
      const vb = /\sviewBox="([-\d.\s,]+)"/.exec(rootTag[0]);
      const parts = vb ? vb[1].trim().split(/[\s,]+/).map(parseFloat) : [];
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        w = parts[2];
        h = parts[3];
      }
    }
    if (!(w > 0 && h > 0)) throw new Error("toPng: the SVG has no usable width/height or viewBox");
    return { w, h };
  }

  /**
   * @param {string} svgString
   * @param {{scale?:number, background?:string|null}} [opts] background defaults to white; null keeps it transparent
   * @returns {Promise<Blob>} image/png
   */
  async function toPng(svgString, opts) {
    opts = opts || {};
    const scale = opts.scale > 0 ? opts.scale : DEFAULT_SCALE;
    const background = opts.background === undefined ? "#ffffff" : opts.background;
    const { w, h } = svgSize(svgString);
    const cw = Math.ceil(w * scale);
    const ch = Math.ceil(h * scale);
    if (cw > MAX_CANVAS_SIDE || ch > MAX_CANVAS_SIDE) throw new Error("toPng: " + cw + "x" + ch + " is over the canvas limit; lower the scale");

    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const g = canvas.getContext("2d");
    if (background) {
      g.fillStyle = background;
      g.fillRect(0, 0, cw, ch);
    }
    // draw at the exact scaled size, not the rounded-up canvas size: stretching to cw x ch resamples the glyph edges
    g.drawImage(img, 0, 0, w * scale, h * scale);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("toPng: the canvas produced no blob");
    return blob;
  }

  const api = { toPng, svgSize };
  root.TikzKitPng = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
