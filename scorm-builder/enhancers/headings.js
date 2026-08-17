// Derive a heading outline from rendered content and ensure every heading has a
// stable id, so TOC links (#slug) and their targets always agree. Content-agnostic
// (works for pandoc, mathpix, or hand-written HTML) — replaces the LaTeX-specific
// section extraction that LaTeXProcessor.extractDocumentMetadata did.

import { slugify } from "../util/slugify.js";
import { RESERVED_IDS } from "../util/reserved-ids.js";

const HEADING = /<h([1-6])(\b[^>]*?)>([\s\S]*?)<\/h\1>/gi;
const ID_ATTR = /\bid\s*=\s*("([^"]*)"|'([^']*)')/i;

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} html
 * @param {object} [opts]
 * @param {Array<[number, number]>} [opts.excludeRanges] - [start,end) offsets whose
 *   headings still get a stable id but are kept OUT of the outline/TOC (e.g. headings
 *   inside an image long description). Offsets index the passed-in `html` string.
 * @returns {{ html: string, sections: Array<{level:number,text:string,id:string}> }}
 */
export function processHeadings(html, opts = {}) {
  const sections = [];
  // Seed the dedupe set with the shell's reserved ids so a heading whose slug
  // matches one (e.g. "Focus mode" → "focus-mode") is suffixed rather than minting
  // a duplicate id that would shadow the shell element (breaking its TOC link,
  // skip-link and scrollspy). An explicit author id is still honoured verbatim.
  const used = new Set(RESERVED_IDS);
  const excludeRanges = opts.excludeRanges || [];
  const isExcluded = (offset) => excludeRanges.some(([s, e]) => offset >= s && offset < e);

  const out = String(html).replace(HEADING, (full, level, attrs, inner, offset) => {
    const text = stripTags(inner);
    const existing = attrs.match(ID_ATTR);
    let id = existing ? existing[2] ?? existing[3] : "";

    if (!id) {
      let base = slugify(text);
      id = base;
      let n = 2;
      while (used.has(id)) id = `${base}-${n++}`;
    }
    used.add(id);

    // Still mint an id (the heading stays anchorable), but skip the outline push
    // for excluded ranges so long-description headings never pollute the TOC.
    if (!isExcluded(offset)) {
      sections.push({ level: Number(level), text, id });
    }

    const newAttrs = existing ? attrs : `${attrs} id="${id}"`;
    return `<h${level}${newAttrs}>${inner}</h${level}>`;
  });

  return { html: out, sections };
}
