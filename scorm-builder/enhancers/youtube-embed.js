// Convert authored YouTube <iframe> embeds into the lightweight <lite-youtube>
// custom element (click-to-load, far less weight, keyboard-accessible play button).
// Gated by the caller on the `liteYoutube` feature; a no-op when no YouTube iframe
// is present. Non-YouTube iframes are left untouched.
//
// Poster: a data:-URI `data-poster` on the source iframe is carried onto the
// element as an inline background-image, so it shows OFFLINE (that is what a host's
// base64 image pipeline naturally produces). Without one, lite-youtube fetches
// YouTube's own thumbnail at view time (needs network — as does playback).

import { escapeXML } from "../util/escape-xml.js";

const IFRAME = /<iframe\b([^>]*)>[\s\S]*?<\/iframe>/gi;

// Pull the value of an HTML attribute out of an iframe's attribute string.
function attr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? (m[2] !== undefined ? m[2] : m[3]) : null;
}

// Reverse the basic HTML entities so an already-encoded attribute value (e.g. the
// iframe title) isn't double-escaped when we re-emit it. &amp; last, to avoid
// turning "&amp;lt;" into "<".
function decodeBasicEntities(s) {
  return s
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

// Extract a YouTube video id from an embed/watch/short URL, or null if not YouTube.
function youtubeId(src) {
  if (!src) return null;
  const decoded = src.replace(/&amp;/g, "&");
  const m = decoded.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:embed|v)\/|youtu\.be\/|youtube(?:-nocookie)?\.com\/watch\?[^"']*?\bv=)([A-Za-z0-9_-]{6,})/i
  );
  return m ? m[1] : null;
}

// Player params to carry over from the iframe src query string. Drop the ones the
// component sets itself or that are tracking/API noise.
const DROP_PARAMS = new Set(["autoplay", "si", "feature", "enablejsapi", "origin", "widget_referrer", "playsinline"]);

function carriedParams(src) {
  const q = src.replace(/&amp;/g, "&").split("?")[1];
  if (!q) return "";
  const kept = [];
  for (const pair of q.split("&")) {
    if (!pair) continue;
    const key = pair.split("=")[0];
    if (DROP_PARAMS.has(key)) continue;
    kept.push(pair);
  }
  return kept.join("&");
}

/**
 * Rewrite YouTube <iframe> embeds to <lite-youtube>.
 * @param {string} html
 * @returns {string}
 */
export function processYoutubeEmbeds(html) {
  if (!html || html.indexOf("<iframe") === -1) return html;

  return String(html).replace(IFRAME, (full, attrs) => {
    const src = attr(attrs, "src");
    const id = youtubeId(src);
    if (!id) return full; // not a YouTube iframe — leave it alone

    const label = decodeBasicEntities(attr(attrs, "title") || "Play video");
    const params = carriedParams(src);
    const poster = attr(attrs, "data-poster") || attr(attrs, "poster");
    const width = attr(attrs, "width");
    const cls = attr(attrs, "class");

    // Build an inline style: an author-supplied (ideally data:) poster shows offline;
    // a numeric width caps the element so it matches the original embed's size.
    const styleBits = [];
    if (poster) styleBits.push(`background-image:url('${poster.replace(/'/g, "%27")}')`);
    if (width && /^\d+$/.test(width)) styleBits.push(`max-width:${width}px`);
    const style = styleBits.length ? ` style="${styleBits.join(";")}"` : "";

    // Carry the original iframe's class through, and stamp data-converted-from="iframe",
    // so host CSS/JS that dressed the iframe can re-target the element. The tag changed
    // from <iframe> to <lite-youtube>, so any host rule that selected `iframe` (e.g. a
    // responsive/aspect-ratio wrapper) no longer matches — see optional-features-guide §4.4.
    const paramsAttr = params ? ` params="${escapeXML(params)}"` : "";
    const classAttr = cls ? ` class="${escapeXML(cls)}"` : "";
    return `<lite-youtube videoid="${escapeXML(id)}" playlabel="${escapeXML(label)}"${paramsAttr}${classAttr} data-converted-from="iframe"${style}></lite-youtube>`;
  });
}

/** True if the content carries a convertible YouTube iframe (cheap probe). */
export function hasYoutubeIframe(html) {
  if (!html || html.indexOf("<iframe") === -1) return false;
  IFRAME.lastIndex = 0;
  let m;
  while ((m = IFRAME.exec(html))) {
    if (youtubeId(attr(m[1], "src"))) {
      IFRAME.lastIndex = 0;
      return true;
    }
  }
  return false;
}
