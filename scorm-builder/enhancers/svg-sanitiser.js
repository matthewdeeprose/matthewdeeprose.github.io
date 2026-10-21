// Strip active content from inline <svg> markup, and nothing else.
//
// A diagram compiled elsewhere (TikZ, a charting tool, an author paste) arrives as
// inline SVG, and inline SVG is a full document: it can carry <script>, <foreignObject>
// (arbitrary HTML), on* handlers and links off the page. This pass removes:
//
//   - <script> and <foreignObject> elements, with their content
//   - <set>/<animate> elements that retarget an href (SMIL can write a javascript: URL)
//   - every on* attribute
//   - href / xlink:href unless it is a same-document "#" reference
//   - url(…) unless it is url(#…), replaced by `none`; @import rules in an svg <style>
//
// One exception, because figure-contract-v1 needs both rules at once: a data: URI
// inside an @font-face block is kept (rule 6 embeds fonts that way). It is a font
// file in a font-face src, not a fetch; a data: url anywhere else is still replaced.
//
// HTML OUTSIDE an <svg> is never touched: the library's authors legitimately write
// onclick buttons, links and inline styles, and this is not an HTML sanitiser.
// Markup that needs none of the above passes through byte-identical. Like the other
// enhancers it is a pure, idempotent string transform (no DOM), so it runs the same
// in node and in the browser.

// A tag, quote-aware so a ">" inside an attribute value does not end it.
const TAG = /<\/?[a-zA-Z][^\s>\/]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g;
// One attribute inside a tag (after its name): leading separator, name, optional value.
const ATTR = /([\s\/]+)([^\s"'<>\/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
const URL_FN = /url\(\s*(["']?)([^)]*?)\1\s*\)/gi;
const IMPORT_RULE = /@import\b[^;{}]*;?/gi;
const FONT_FACE = /@font-face\s*\{[^}]*\}/gi;
const FONT_DATA = /^data:(?:font\/|application\/(?:x-)?font|application\/vnd\.ms-fontobject|application\/octet-stream)/i;

const SMIL_NAME = /^(?:[\w-]+:)?(?:set|animate)$/i;
const DANGEROUS_ELEMENT = /^(?:[\w-]+:)?(?:script|foreignobject)$/i;
const HREF_NAME = /^(?:[\w-]+:)?href$/i;

const unquote = (v) => (v == null ? "" : v.replace(/^(["'])([\s\S]*)\1$/, "$2"));
const isSameDocument = (value) => unquote(value).trim().startsWith("#");

// url(#x) and url("#x") stay; everything else becomes `none`.
function scrubUrls(text, { allowFontData = false } = {}) {
  let removed = 0;
  const out = text.replace(URL_FN, (match, _q, target) => {
    const t = target.trim();
    if (t.startsWith("#")) return match;
    if (allowFontData && FONT_DATA.test(t)) return match;
    removed += 1;
    return "none";
  });
  return { text: out, removed };
}

// <style> content: @import rules go; url() is scrubbed everywhere except font data in @font-face.
function scrubStyleText(css) {
  let removed = 0;
  let out = css.replace(IMPORT_RULE, () => {
    removed += 1;
    return "";
  });
  // Protect each @font-face block, scrub the rest, then scrub the blocks with data fonts allowed.
  const blocks = [];
  out = out.replace(FONT_FACE, (block) => {
    blocks.push(block);
    return `\u0000FF${blocks.length - 1}\u0000`;
  });
  const rest = scrubUrls(out);
  removed += rest.removed;
  out = rest.text.replace(/\u0000FF(\d+)\u0000/g, (_m, i) => {
    const scrubbed = scrubUrls(blocks[Number(i)], { allowFontData: true });
    removed += scrubbed.removed;
    return scrubbed.text;
  });
  return { text: out, removed };
}

// Rewrite one start tag's attributes. Returns the tag unchanged when nothing needs to go.
function scrubTag(tag) {
  const nameEnd = tag.match(/^<\/?[^\s>\/]+/)[0].length;
  const head = tag.slice(0, nameEnd);
  const tail = tag.slice(nameEnd);
  let removed = 0;
  const scrubbed = tail.replace(ATTR, (match, _sep, name, value) => {
    if (/^on/i.test(name)) {
      removed += 1;
      return "";
    }
    if (HREF_NAME.test(name) && !isSameDocument(value)) {
      removed += 1;
      return "";
    }
    if (value) {
      const u = scrubUrls(unquote(value));
      if (u.removed) {
        removed += u.removed;
        const quote = value[0] === '"' || value[0] === "'" ? value[0] : '"';
        return match.replace(value, () => `${quote}${u.text}${quote}`);
      }
    }
    return match;
  });
  return { tag: head + scrubbed, removed };
}

// Sanitise the inner text of one balanced <svg>…</svg> block (open tag included).
function sanitiseSvgBlock(block) {
  let removed = 0;
  const out = [];
  let i = 0;
  // Elements whose whole subtree is dropped, tracked by name so nesting balances.
  let dropName = null;
  let dropDepth = 0;
  let styleOpen = false;
  let styleText = "";

  TAG.lastIndex = 0;
  let m;
  while ((m = TAG.exec(block)) !== null) {
    const text = block.slice(i, m.index);
    i = TAG.lastIndex;
    const tag = m[0];
    const closing = tag[1] === "/";
    const name = tag.match(/^<\/?([^\s>\/]+)/)[1];
    const selfClosing = /\/\s*>$/.test(tag);

    if (dropName) {
      // Inside a removed subtree: swallow text and tags until it balances.
      if (name.toLowerCase() === dropName) {
        if (closing) dropDepth -= 1;
        else if (!selfClosing) dropDepth += 1;
        if (dropDepth === 0) dropName = null;
      }
      continue;
    }

    if (styleOpen) {
      // Text between <style> and </style> is CSS, not markup.
      styleText += text;
    } else {
      out.push(text);
    }

    if (!closing && DANGEROUS_ELEMENT.test(name)) {
      removed += 1;
      if (!selfClosing) {
        dropName = name.toLowerCase();
        dropDepth = 1;
      }
      continue;
    }

    if (!closing && SMIL_NAME.test(name) && /\battributeName\s*=\s*["']?(?:[\w-]+:)?href\b/i.test(tag)) {
      removed += 1;
      if (!selfClosing) {
        dropName = name.toLowerCase();
        dropDepth = 1;
      }
      continue;
    }

    if (styleOpen && closing && /^(?:[\w-]+:)?style$/i.test(name)) {
      const css = scrubStyleText(styleText);
      removed += css.removed;
      out.push(css.text);
      styleOpen = false;
      styleText = "";
      out.push(tag);
      continue;
    }

    if (closing) {
      out.push(tag);
      continue;
    }

    const scrubbed = scrubTag(tag);
    removed += scrubbed.removed;
    out.push(scrubbed.tag);
    if (/^(?:[\w-]+:)?style$/i.test(name) && !selfClosing) styleOpen = true;
  }

  // Whatever follows the last tag. An unclosed dropped element takes it with it.
  if (!dropName) {
    const rest = block.slice(i);
    if (styleOpen) {
      const css = scrubStyleText(styleText + rest);
      removed += css.removed;
      out.push(css.text);
    } else {
      out.push(rest);
    }
  }
  return { html: out.join(""), removed };
}

// Locate every outermost <svg>…</svg> by counting nested <svg> opens and closes.
// An unclosed <svg> runs to the end of the string, so what follows it is scrubbed too.
function findSvgBlocks(html) {
  const blocks = [];
  const re = /<(\/?)svg\b(?:"[^"]*"|'[^']*'|[^>"'])*>/gi;
  let depth = 0;
  let start = -1;
  let m;
  while ((m = re.exec(html)) !== null) {
    const closing = m[1] === "/";
    const selfClosing = /\/\s*>$/.test(m[0]);
    if (!closing) {
      if (depth === 0) start = m.index;
      if (selfClosing && depth === 0) {
        blocks.push([start, re.lastIndex]);
        start = -1;
      } else if (!selfClosing) {
        depth += 1;
      }
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0) {
        blocks.push([start, re.lastIndex]);
        start = -1;
      }
    }
  }
  if (depth > 0 && start !== -1) blocks.push([start, html.length]);
  return blocks;
}

const FIGURE_TAG = /<(\/?)figure\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
const CLASS_VALUE = /\bclass\s*=\s*(["'])([^"']*)\1/i;
const isTikzFigureOpen = (attrs) => /(?:^|\s)tikz-figure(?:\s|$)/.test(attrs.match(CLASS_VALUE)?.[2] ?? "");

/**
 * Sanitise only the svgs inside `<figure class="tikz-figure">…</figure>` (figure-contract-v1),
 * leaving every other svg and all other markup untouched. This is the default scope of the
 * assembler: the library has always passed an author's own inline svg through verbatim
 * (on* handlers, links, animation — see the developer guide), and that must not change.
 * @param {string} html
 * @returns {{ html: string, removed: number }}
 */
export function sanitiseTikzFigures(html) {
  const src = String(html ?? "");
  if (!/<svg\b/i.test(src) || !/tikz-figure/.test(src)) return { html: src, removed: 0 };

  let out = "";
  let last = 0;
  let removed = 0;
  let depth = 0;
  let start = -1;
  FIGURE_TAG.lastIndex = 0;
  let m;
  while ((m = FIGURE_TAG.exec(src)) !== null) {
    const closing = m[1] === "/";
    if (!closing) {
      if (depth === 0) {
        if (!isTikzFigureOpen(m[2])) continue; // not ours: ignore it, and its (possibly nested) figures
        start = m.index;
      }
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0) {
        const end = FIGURE_TAG.lastIndex;
        const result = sanitiseSvg(src.slice(start, end));
        out += src.slice(last, start) + result.html;
        removed += result.removed;
        last = end;
        start = -1;
      }
    }
  }
  // An unclosed tikz-figure runs to the end of the document.
  if (depth > 0 && start !== -1) {
    const result = sanitiseSvg(src.slice(start));
    out += src.slice(last, start) + result.html;
    removed += result.removed;
    last = src.length;
  }
  out += src.slice(last);
  return { html: out, removed };
}

/**
 * Remove active content from every inline <svg> in `html`. Markup outside an svg is untouched.
 * @param {string} html
 * @returns {{ html: string, removed: number }} removed = number of elements/attributes/urls dropped
 */
export function sanitiseSvg(html) {
  const src = String(html ?? "");
  if (!/<svg\b/i.test(src)) return { html: src, removed: 0 };

  let out = "";
  let last = 0;
  let removed = 0;
  for (const [start, end] of findSvgBlocks(src)) {
    out += src.slice(last, start);
    const block = sanitiseSvgBlock(src.slice(start, end));
    out += block.html;
    removed += block.removed;
    last = end;
  }
  out += src.slice(last);
  return { html: out, removed };
}
