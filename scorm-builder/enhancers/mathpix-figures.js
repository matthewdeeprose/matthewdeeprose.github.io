// Normalise mathpix-markdown-it's figure markup into semantic <figure> /
// <figcaption>.
//
// mathpix renders images into three different shapes and NONE of the captioned
// ones produce a <figure> or a <figcaption>. The caption ends up as a sibling
// <div>, so a screen-reader user meets the image and its caption as unrelated
// content, with nothing tying them together:
//
//   \includegraphics[alt={…}]{url}            (standalone)
//     <div class="figure_img"><img …></div>
//
//   \begin{figure} … \caption{…} \end{figure}
//     <div class="table" number="1">
//       <div class="figure_img"><img …></div>
//       <div class="caption_figure">Figure 1: …</div>
//     </div>
//
// `![](url)` already emits a real <figure> (and has no caption source), so it is
// left alone, as is any author-supplied <figure>.
//
// This also makes CSS the library ALREADY ships start applying: the stylesheet
// has rules for `figure`, `figure:has(> .long-description-details)`, `figcaption`
// and `.document-content figcaption`, but none whatsoever for `.figure_img`,
// `.caption_figure`, `.caption_table` or `.table_tabular`. And it gives
// enhancers/long-descriptions.js a real <figure> to attach a disclosure to.
//
// ⚠ THE TRAP: `<div class="table">` wraps BOTH figure environments AND real
// tables — the wrapper markup is identical. The discriminator is the inner
// content div: `div.figure_img` for a figure, `div.table_tabular` for a table.
// A rule keyed on `class="table"` alone would destroy tables, which want
// <caption> (see enhancers/enhance-tables.js), not <figcaption>. So we convert
// ONLY a div.table that contains a div.figure_img and NO div.table_tabular.
//
// Like enhancers/long-descriptions.js and enhancers/headings.js this is a pure,
// idempotent string transform (no DOM), so it runs identically in node and the
// browser. The balanced-tag scan is a local mirror of the one in
// long-descriptions.js — required because these wrappers nest, and a greedy
// regex would close on the wrong </div>.

const CLASS_ATTR = /(\s*)\bclass\s*=\s*("([^"]*)"|'([^']*)')/i;
// A standalone `number` attribute: the leading \s guard stops it matching an
// already-converted `data-number`.
const NUMBER_ATTR = /(\s)number(\s*=\s*)/i;

// Does a class attribute value carry `token` as a standalone class? Guards
// against `.table-scroll` / `.figure_img_wrapper` style false positives.
function hasClassToken(classValue, token) {
  return classValue.split(/\s+/).some((t) => t === token);
}

// Find the next opening <div> whose class carries `token`, at or after `from`.
// Returns { start, openEnd, attrs } or null.
function findDivWithClass(html, from, token) {
  const re = /<div\b([^>]*)>/gi;
  re.lastIndex = from;
  let m;
  while ((m = re.exec(html)) !== null) {
    const cls = m[1].match(CLASS_ATTR);
    if (!cls) continue;
    if (hasClassToken(cls[3] ?? cls[4] ?? "", token)) {
      return { start: m.index, openEnd: re.lastIndex, attrs: m[1] };
    }
  }
  return null;
}

function containsDivWithClass(html, token) {
  return findDivWithClass(html, 0, token) !== null;
}

// From just after an opening tag, walk forward counting open/close `tagName`
// tags to the matching close. Returns { innerStart, innerEnd, end } or null
// (unbalanced markup — the caller skips rather than guessing).
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

// [start, end) of every <figure> block, so Rule B never converts a div.figure_img
// that is already inside one (author-supplied, shape 1, or produced by Rule A) —
// which would nest figures.
function figureRanges(html) {
  const ranges = [];
  const open = /<figure\b[^>]*>/gi;
  let m;
  while ((m = open.exec(html)) !== null) {
    const bal = matchTagClose(html, open.lastIndex, "figure");
    if (!bal) continue;
    ranges.push([m.index, bal.end]);
    open.lastIndex = bal.end; // don't descend into it
  }
  return ranges;
}

// Drop one class token, dropping the whole attribute if nothing is left.
function stripClassToken(attrs, token) {
  const m = attrs.match(CLASS_ATTR);
  if (!m) return attrs;
  const kept = (m[3] ?? m[4] ?? "")
    .split(/\s+/)
    .filter((t) => t && t !== token)
    .join(" ");
  const replacement = kept ? ` class="${kept}"` : "";
  return attrs.slice(0, m.index) + replacement + attrs.slice(m.index + m[0].length);
}

// `number="1"` is not a valid HTML attribute; carry the figure number over as
// data-number so hosts can still read it.
function renameNumberAttr(attrs) {
  return attrs.replace(NUMBER_ATTR, "$1data-number$2");
}

// div.caption_figure -> <figcaption>, preserving inner markup (captions carry
// maths and formatting) and attributes. The `caption_figure` class is kept: it
// is still accurate on a <figcaption> and gives hosts a selector hook.
function convertCaptions(inner) {
  let src = inner;
  let from = 0;
  for (;;) {
    const open = findDivWithClass(src, from, "caption_figure");
    if (!open) break;
    const close = matchTagClose(src, open.openEnd, "div");
    if (!close) {
      from = open.openEnd;
      continue;
    }
    const caption =
      `<figcaption${open.attrs}>` + src.slice(close.innerStart, close.innerEnd) + `</figcaption>`;
    src = src.slice(0, open.start) + caption + src.slice(close.end);
    from = open.start + caption.length;
  }
  return src;
}

/**
 * Normalise mathpix figure markup into <figure> / <figcaption>.
 *
 * Rule A: a `div.table` containing a `div.figure_img` (and no `div.table_tabular`)
 *         becomes a <figure>; its `div.caption_figure` becomes a <figcaption>;
 *         inner `div.figure_img` wrappers are left alone (a multi-panel figure
 *         needs them to keep its images apart).
 * Rule B: a standalone `div.figure_img` not already inside a <figure> becomes a
 *         <figure>, attributes preserved.
 * Rule C: everything else is left alone — `![](url)` figures, author <figure>s,
 *         `<img>` in an `<a>`, bare inline `<img>`, and every real table.
 *
 * Idempotent: after one pass no unconverted div.figure_img sits outside a figure
 * and no div.table holds a figure_img, so f(f(x)) === f(x).
 *
 * @param {string} html
 * @param {object} [opts]
 * @param {(warning: {type,message,snippet}) => void} [opts.onWarning] - called for
 *   an ambiguous wrapper holding BOTH a figure_img and a table_tabular, which is
 *   skipped rather than guessed at. Silent skips are how markup regressions hide.
 * @returns {{ html: string, count: number }} count = figures produced
 */
export function processMathpixFigures(html, opts = {}) {
  let src = String(html);
  let count = 0;

  // --- Rule A: figure environments (captioned, uncaptioned, multi-panel) ------
  let from = 0;
  for (;;) {
    const open = findDivWithClass(src, from, "table");
    if (!open) break;
    const close = matchTagClose(src, open.openEnd, "div");
    if (!close) {
      from = open.openEnd;
      continue;
    }
    const inner = src.slice(close.innerStart, close.innerEnd);
    const isFigure = containsDivWithClass(inner, "figure_img");
    const isTable = containsDivWithClass(inner, "table_tabular");

    if (!isFigure || isTable) {
      // Not ours (or ambiguous). Resume INSIDE the wrapper: a real table's cell
      // could still hold a standalone figure for Rule B to find.
      if (isFigure && isTable && opts.onWarning) {
        opts.onWarning({
          type: "mathpix-figure-ambiguous",
          message:
            "Wrapper contains both a figure_img and a table_tabular; left as-is rather than guessing between <figure> and a real table.",
          snippet: inner.length > 120 ? inner.slice(0, 117) + "..." : inner,
        });
      }
      from = open.openEnd;
      continue;
    }

    // `class="table"` would be an outright lie on a <figure>, and nothing in the
    // stylesheet keys on it, so drop that token and keep any others.
    const attrs = renameNumberAttr(stripClassToken(open.attrs, "table"));
    const figure = `<figure${attrs}>${convertCaptions(inner)}</figure>`;
    src = src.slice(0, open.start) + figure + src.slice(close.end);
    from = open.start + figure.length;
    count += 1;
  }

  // --- Rule B: standalone div.figure_img (never one already inside a figure) --
  from = 0;
  for (;;) {
    const open = findDivWithClass(src, from, "figure_img");
    if (!open) break;
    const ranges = figureRanges(src);
    if (ranges.some(([s, e]) => open.start >= s && open.start < e)) {
      from = open.openEnd;
      continue;
    }
    const close = matchTagClose(src, open.openEnd, "div");
    if (!close) {
      from = open.openEnd;
      continue;
    }
    const figure =
      `<figure${open.attrs}>` + src.slice(close.innerStart, close.innerEnd) + `</figure>`;
    src = src.slice(0, open.start) + figure + src.slice(close.end);
    from = open.start + figure.length;
    count += 1;
  }

  return { html: src, count };
}

/**
 * Cheap probe so non-mathpix builds pay nothing.
 * @param {string} html
 * @returns {boolean}
 */
export function hasMathpixFigure(html) {
  return /\bfigure_img\b/.test(String(html));
}
