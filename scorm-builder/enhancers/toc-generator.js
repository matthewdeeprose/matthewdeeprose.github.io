// Build the #toc navigation from a heading outline. Emits a nested ordered list
// honouring heading levels, with id="toc" + .table-of-contents so the skip link
// and distraction-free selectors resolve. Replaces toc-generator.js + the
// table-of-contents.html template (which assumed a pandoc section tree).

import { escapeXML } from "../util/escape-xml.js";

const EMPTY_TOC = `<nav id="toc" class="table-of-contents" aria-label="Table of contents" tabindex="-1" hidden></nav>`;

/**
 * @param {Array<{level:number,text:string,id:string}>} sections
 * @param {object} [opts] - { minLevel=1, maxLevel=3, heading="Table of Contents" }
 * @returns {string}
 */
export function renderToc(sections = [], opts = {}) {
  const minLevel = opts.minLevel || 1;
  const maxLevel = opts.maxLevel || 3;
  const items = sections.filter((s) => s.level >= minLevel && s.level <= maxLevel);
  if (items.length === 0) return EMPTY_TOC;

  const baseLevel = Math.min(...items.map((s) => s.level));
  let html = "";
  let open = 0; // number of <ol> currently open
  let prev = baseLevel - 1;

  for (const s of items) {
    if (s.level > prev) {
      for (let i = prev; i < s.level; i++) {
        html += "<ol>";
        open++;
      }
    } else {
      html += "</li>"; // close previous item
      for (let i = s.level; i < prev; i++) {
        html += "</ol></li>"; // step back up out of deeper lists
        open--;
      }
    }
    html += `<li><a href="#${escapeXML(s.id)}">${escapeXML(s.text)}</a>`;
    prev = s.level;
  }

  html += "</li>"; // close the final item
  while (open > 1) {
    html += "</ol></li>";
    open--;
  }
  html += "</ol>"; // close the outermost list

  return `<nav id="toc" class="table-of-contents" aria-label="Table of contents" tabindex="-1">
  <h2>${escapeXML(opts.heading || "Table of Contents")}</h2>
  ${html}
</nav>`;
}

export { EMPTY_TOC };
