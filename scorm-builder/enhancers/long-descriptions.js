// Turn authored long-description blocks into an accessible <details> disclosure
// placed below the image, and link the image to it for screen readers.
//
// A long description is the extended, *block-level* explanation a complex image
// (chart, diagram, data table) needs — headings, lists, tables — which cannot
// live in a short `alt` attribute. Authors mark it up as a container carrying a
// standalone `longdesc` class, inside the <figure> (or right after a bare <img>):
//
//   <figure>
//     <img src="chart.png" alt="Q3 revenue by region (see long description)">
//     <figcaption>Figure 3. Regional revenue</figcaption>
//     <div class="longdesc"> <h3>…</h3> <ul>…</ul> <table>…</table> </div>
//   </figure>
//
// Markdown authors write the wrapper as <figure class="longdesc"> with the inner
// content as literal HTML tags. mathpix-markdown-it (htmlTags:true) strips the
// class from a <div> and does NOT render markdown inside a raw HTML block, but it
// DOES preserve <figure> + its class and passes inner HTML through untouched — so
// the enhancer matches the `longdesc` class on ANY element, not just <div>.
//
// Each block becomes:
//   <details class="long-description-details" id="ld-N">
//     <summary>Long description</summary>
//     <div class="image-long-description">…block content…</div>
//   </details>
// and the nearest preceding <img> gets aria-details="ld-N" (id="img-ld-N" if it
// had none). aria-details (not aria-describedby) is used deliberately: it exposes
// the *structured* content to assistive tech, whereas aria-describedby would
// flatten it to a plain string. Where aria-details support is thin (e.g. some
// VoiceOver versions) the visible, keyboard-operable <details> is the fallback.
//
// Like enhancers/headings.js and enhancers/enhance-tables.js this is a pure,
// idempotent string transform (no DOM), so it runs identically in node + browser.
// The one non-regex piece — a balanced <div> scan — is required because a long
// description contains nested <div>/<table>, which a greedy regex would mangle.

import { escapeXML } from "../util/escape-xml.js";

const IMG_TAG = /<img\b[^>]*>/gi;
const ID_ATTR = /\bid\s*=\s*("([^"]*)"|'([^']*)')/i;
const CLASS_ATTR = /\bclass\s*=\s*("([^"]*)"|'([^']*)')/i;
const LD_ID = /\bid\s*=\s*["']ld-(\d+)["']/gi;

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Highest existing ld-N id in the document, so a fresh counter never collides
// with author-supplied ids or ids from a previous run (idempotency).
function maxLdId(html) {
  let max = 0;
  let m;
  LD_ID.lastIndex = 0;
  while ((m = LD_ID.exec(html)) !== null) {
    const n = Number(m[1]);
    if (n > max) max = n;
  }
  return max;
}

// Does a class attribute value carry `token` as a standalone class? Guards against
// `mylongdesc` / `long-description` false positives.
function hasClassToken(classValue, token) {
  return new RegExp(`(?:^|\\s)${escapeReg(token)}(?:\\s|$)`).test(classValue);
}

// Find the next opening tag whose class carries the `className` token, at or after
// `from`. Returns { start, openEnd, tagName } or null. Matches ANY element, not
// just <div>: markdown authors must use <figure class="longdesc"> because
// mathpix-markdown-it strips attributes from <div> (but keeps them on <figure>);
// HTML authors typically use <div class="longdesc">. One class, both inputs.
function findLongdescOpen(html, from, className) {
  const re = /<([a-zA-Z][\w-]*)\b([^>]*)>/gi;
  re.lastIndex = from;
  let m;
  while ((m = re.exec(html)) !== null) {
    const cls = m[2].match(CLASS_ATTR);
    if (!cls) continue;
    const value = cls[2] ?? cls[3] ?? "";
    if (hasClassToken(value, className)) {
      return { start: m.index, openEnd: re.lastIndex, tagName: m[1] };
    }
  }
  return null;
}

// From just after an opening tag, walk forward counting open/close `tagName` tags
// to the matching close. Returns { innerStart, innerEnd, end } or null (unbalanced).
function matchTagClose(html, openEnd, tagName) {
  const re = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  re.lastIndex = openEnd;
  let depth = 1;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[0][1] === "/") {
      if (--depth === 0) return { innerStart: openEnd, innerEnd: m.index, end: re.lastIndex };
    } else {
      depth += 1;
    }
  }
  return null;
}

/**
 * Ranges [start, end) of every long-description-details block in the HTML. Used by
 * the caller to keep long-description headings out of the document outline / TOC.
 * @param {string} html
 * @returns {Array<[number, number]>}
 */
export function findLongDescriptionRanges(html) {
  const ranges = [];
  const src = String(html);
  const open = /<details\b([^>]*)>/gi;
  let m;
  while ((m = open.exec(src)) !== null) {
    if (!/\blong-description-details\b/i.test(m[1])) continue;
    const bal = matchTagClose(src, open.lastIndex, "details");
    if (bal) {
      ranges.push([m.index, bal.end]);
      open.lastIndex = bal.end; // skip past a nested match inside this block
    }
  }
  return ranges;
}

// Wire the nearest preceding <img> in `prefix` to the details `id`. Returns the
// (possibly modified) prefix and whether an img was found. An img already inside
// an emitted long-description-details block is never selected.
function wireImg(prefix, id) {
  const ranges = findLongDescriptionRanges(prefix);
  const inRange = (idx) => ranges.some(([s, e]) => idx >= s && idx < e);

  let last = null;
  IMG_TAG.lastIndex = 0;
  let m;
  while ((m = IMG_TAG.exec(prefix)) !== null) {
    if (inRange(m.index)) continue;
    last = { tag: m[0], start: m.index, end: IMG_TAG.lastIndex };
  }
  if (!last) return { html: prefix, wired: false };

  // Already associated with something — leave it, but count it as wired.
  if (/\baria-details\s*=/i.test(last.tag)) return { html: prefix, wired: true };

  const existingId = last.tag.match(ID_ATTR);
  const imgId = existingId ? existingId[2] ?? existingId[3] : "";
  const addId = imgId ? "" : ` id="img-${id}"`;
  const newTag = last.tag.replace(/^<img\b/i, `<img${addId} aria-details="${id}"`);
  const html = prefix.slice(0, last.start) + newTag + prefix.slice(last.end);
  return { html, wired: true };
}

/**
 * Transform authored long-description blocks into accessible <details> disclosures.
 * @param {string} html
 * @param {object} [opts]
 * @param {string} [opts.summaryLabel="Long description"] - <summary> text
 * @param {string} [opts.className="longdesc"] - the marker class token
 * @param {(warning: {type,message,snippet}) => void} [opts.onWarning] - orphan blocks
 * @returns {{ html: string, count: number }}
 */
export function processLongDescriptions(html, opts = {}) {
  const label = escapeXML(opts.summaryLabel || "Long description");
  const className = opts.className || "longdesc";
  let src = String(html);
  let counter = maxLdId(src) + 1;
  let count = 0;
  let searchFrom = 0;

  for (;;) {
    const open = findLongdescOpen(src, searchFrom, className);
    if (!open) break;

    const close = matchTagClose(src, open.openEnd, open.tagName);
    if (!close) {
      // Unbalanced markup — skip this marker so we never loop forever.
      searchFrom = open.openEnd;
      continue;
    }

    const inner = src.slice(close.innerStart, close.innerEnd);
    const id = `ld-${counter++}`;
    const details =
      `<details class="long-description-details" id="${id}">` +
      `<summary>${label}</summary>` +
      `<div class="image-long-description">${inner}</div>` +
      `</details>`;

    const prefix = src.slice(0, open.start);
    const wired = wireImg(prefix, id);
    if (!wired.wired && opts.onWarning) {
      opts.onWarning({
        type: "longdesc-orphan",
        message:
          "Long description has no preceding <img> to associate with; rendered without aria-details.",
        snippet: inner.length > 120 ? inner.slice(0, 117) + "..." : inner,
      });
    }

    src = wired.html + details + src.slice(close.end);
    // Resume after the inserted <details> (its inner content must not be re-scanned,
    // and the wired prefix may have changed length).
    searchFrom = wired.html.length + details.length;
    count += 1;
  }

  return { html: src, count };
}
