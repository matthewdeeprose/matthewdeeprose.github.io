// Browser helper: lazy-load the injected dependencies (JSZip, mathpix-markdown-it)
// from a CDN when they're not already on the page. The host can instead inject
// its own (self-hosted / air-gapped) by exposing the globals or passing deps.

export const DEFAULT_JSZIP_URL = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
export const DEFAULT_MATHPIX_URL = "https://cdn.jsdelivr.net/npm/mathpix-markdown-it@3.0.0/es5/bundle.js";

const scriptCache = new Map();

/** Load a classic <script> once; cached by URL. */
export function loadScript(url) {
  if (typeof document === "undefined") return Promise.reject(new Error("loadScript() requires a browser environment"));
  if (scriptCache.has(url)) return scriptCache.get(url);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => resolve(url);
    s.onerror = () => reject(new Error("Failed to load script: " + url));
    document.head.appendChild(s);
  });
  scriptCache.set(url, p);
  return p;
}

/**
 * Ensure JSZip and/or the mathpix renderer are available, loading from CDN if missing.
 * @param {object} [opts] - { jszip?, mathpix?, jszipUrl?, mathpixUrl?, loadScript? }
 * @returns {Promise<{ JSZip?, mathpix? }>}
 */
export async function ensureDependencies(opts = {}) {
  const load = opts.loadScript || loadScript;
  const out = {};

  if (opts.jszip) {
    if (!globalThis.JSZip) await load(opts.jszipUrl || DEFAULT_JSZIP_URL);
    out.JSZip = globalThis.JSZip;
  } else if (globalThis.JSZip) {
    out.JSZip = globalThis.JSZip;
  }

  if (opts.mathpix) {
    if (!globalThis.markdownToHTML) await load(opts.mathpixUrl || DEFAULT_MATHPIX_URL);
    out.mathpix = globalThis.markdownToHTML;
  } else if (globalThis.markdownToHTML) {
    out.mathpix = globalThis.markdownToHTML;
  }

  return out;
}
