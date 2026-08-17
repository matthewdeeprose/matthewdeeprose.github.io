// Inline <img> sources as base64 data URLs so exported content is fully
// self-contained (no external image requests in the LMS / offline).
// Decoupled from the original ImageAssetManager's LaTeX \includegraphics
// detection: this works on rendered <img> tags via an injected `resolve(src)`.
//
//   resolve(src) -> Promise<string|null>   // data: URL, or null to leave as-is
//
// A browser-default resolver (fetch -> data URL) is provided; node tests inject
// a stub so the enhancer is environment-independent.

const IMG_TAG = /<img\b[^>]*>/gi;
const SRC_ATTR = /\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i;

/**
 * @param {string} html
 * @param {(src: string) => Promise<string|null>} resolve
 * @returns {Promise<{ html: string, embedded: number, skipped: string[] }>}
 */
export async function embedImages(html, resolve, opts = {}) {
  if (typeof resolve !== "function") {
    throw new Error("embedImages: a resolve(src) function is required");
  }
  const source = String(html);

  // Phase 1 — resolve each UNIQUE src exactly once, in document order. Async, so
  // it cannot be folded into the rewrite below.
  const cache = new Map();
  for (const tag of source.match(IMG_TAG) || []) {
    const srcMatch = tag.match(SRC_ATTR);
    if (!srcMatch) continue;
    const src = srcMatch[2] ?? srcMatch[3] ?? "";
    if (!src || src.startsWith("data:") || cache.has(src)) continue;
    cache.set(src, await resolve(src));
  }

  // Phase 2 — one synchronous pass. Two things here are deliberate, and both
  // used to be wrong:
  //   * a FUNCTION replacement, so `$&`, `` $` ``, `$'` and `$1` inside a data
  //     URL are inserted literally instead of being read as substitution
  //     patterns (base64 has no `$`, but a caller-supplied resolver can return
  //     anything, and a corrupted src fails silently);
  //   * splicing the src attribute BY INDEX rather than String.replace with the
  //     quoted value as a needle — that replaced the first occurrence in the
  //     tag, so `<img alt="a.png" src="a.png">` had its ALT rewritten and its
  //     src left pointing outside the package.
  // Replacing per-occurrence also means each tag is rewritten exactly once,
  // rather than relying on repeated first-match scans of the whole document.
  let embedded = 0;
  const skipped = [];
  const out = source.replace(IMG_TAG, (tag) => {
    const srcMatch = tag.match(SRC_ATTR);
    if (!srcMatch) return tag;
    const src = srcMatch[2] ?? srcMatch[3] ?? "";
    if (!src || src.startsWith("data:")) return tag;

    const dataUrl = cache.get(src);
    if (!dataUrl) {
      skipped.push(src); // one entry per occurrence, as before
      return tag;
    }
    embedded += 1;
    // The quoted value is the tail of the SRC_ATTR match, so its offset within
    // the tag is exact — no searching, nothing else in the tag can be hit.
    const start = srcMatch.index + srcMatch[0].length - srcMatch[1].length;
    return tag.slice(0, start) + `"${dataUrl}"` + tag.slice(start + srcMatch[1].length);
  });

  return { html: out, embedded, skipped };
}

// Browser default: fetch each src and convert to a base64 data URL.
export function createBrowserImageResolver(fetchImpl) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  return async function resolve(src) {
    if (!doFetch) return null;
    try {
      const response = await doFetch(src);
      if (!response.ok) return null;
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const base64 = base64FromBytes(new Uint8Array(buffer));
      const mime = blob.type || "application/octet-stream";
      return `data:${mime};base64,${base64}`;
    } catch {
      return null;
    }
  };
}

function base64FromBytes(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

// Build a base64 `data:` URL from raw bytes (Uint8Array/Buffer/ArrayBuffer).
// Handy in node — read a file, hand it here, and you have an inline <img> src
// that needs no fetch and no CORS:
//   dataUrlFromBytes(fs.readFileSync("logo.png"), "image/png")
export function dataUrlFromBytes(bytes, mediaType = "application/octet-stream") {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return `data:${mediaType};base64,${base64FromBytes(arr)}`;
}

// Turn a plain object or Map of `src -> dataURL` into a resolver. This is the
// ergonomic way to "squirt" images you already have as base64: build the table
// once (e.g. from uploads), then pass createMapImageResolver(table) as
// `imageResolver`. Unknown srcs resolve to null (left as-is), so real URLs you
// omit are untouched. Keys are matched exactly against each <img>'s src.
export function createMapImageResolver(map) {
  const get =
    map instanceof Map
      ? (src) => (map.has(src) ? map.get(src) : null)
      : (src) => (Object.prototype.hasOwnProperty.call(map || {}, src) ? map[src] : null);
  return async function resolve(src) {
    return get(src) ?? null;
  };
}
