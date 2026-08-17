// Bake everything the responsive table CSS needs straight into the markup at
// build time, so accessible/responsive tables work with NO runtime JavaScript.
//
// This replaces the never-wired runtime table-accessibility-enhancement.js. Like
// enhancers/headings.js it is a pure string transform (regex over <table> blocks),
// so it stays environment-independent (node + browser) and needs no DOM.
//
// For each table it:
//   - guarantees a <thead> wraps the header row (the card view hides it);
//   - bakes a data-label onto every body cell (CSS renders it as the column label
//     via content: attr(data-label) — see table-responsive.css);
//   - adds Adrian-Roselli ARIA roles + scope so semantics survive the card view's
//     display:block (which strips a table's implicit roles);
//   - tags the table data-responsive="cards" (few columns) or "scroll" (many),
//     so the CSS can pick a card layout or a horizontal-scroll fallback; and
//   - wraps it in a focusable .table-scroll region with an aria-label, so the
//     scroll fallback is keyboard-reachable and announced.
//
// Conservative by design: tables that look nested or malformed, or that are
// already processed, are returned untouched. The transform is idempotent.

import { escapeXML } from "../util/escape-xml.js";

// Default column count above which a table uses the horizontal-scroll fallback
// instead of the stacked-card layout (cards get too tall with many columns).
export const DEFAULT_COLUMN_THRESHOLD = 6;

const TABLE = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
const TABLE_PARTS = /^<table\b([^>]*)>([\s\S]*)<\/table>$/i;
const TR = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
const CELL = /<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const CAPTION = /<caption\b[^>]*>[\s\S]*?<\/caption>/i;

function stripTags(html) {
  return String(html)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Remove the named attributes from an opening-tag attribute string, then append
// them with the supplied values. Keeps the transform idempotent (re-running never
// duplicates an attribute) and any pre-existing markup attributes intact.
function setAttrs(attrsStr, obj) {
  let s = attrsStr || "";
  for (const key of Object.keys(obj)) {
    const re = new RegExp(`\\s${key}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, "gi");
    s = s.replace(re, "");
  }
  for (const [k, v] of Object.entries(obj)) {
    s += ` ${k}="${v}"`;
  }
  return s;
}

// Header cell text for each column, in order, cleaned to plain text.
function headerTexts(rowInner) {
  const texts = [];
  let m;
  CELL.lastIndex = 0;
  while ((m = CELL.exec(rowInner)) !== null) texts.push(stripTags(m[3]));
  return texts;
}

function transformTable(full, threshold) {
  // Skip anything that isn't a single, non-nested table.
  if ((full.match(/<table\b/gi) || []).length !== 1) return full;

  const parts = full.match(TABLE_PARTS);
  if (!parts) return full;
  const tableAttrs = parts[1];
  let inner = parts[2];

  // Already processed → idempotent no-op.
  if (/\bdata-responsive\s*=/i.test(tableAttrs)) return full;

  const rows = inner.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  if (rows.length === 0) return full;

  const headers = headerTexts(rows[0]);
  const cols = headers.length;
  if (cols === 0) return full;

  const mode = cols <= threshold ? "cards" : "scroll";

  // Rewrite every row: row[0] is the header (in <thead> or not), the rest are body.
  let rowIndex = 0;
  TR.lastIndex = 0;
  inner = inner.replace(TR, (rowFull, trAttrs, rowInner) => {
    const isHeader = rowIndex === 0;
    rowIndex += 1;

    let colIndex = 0;
    CELL.lastIndex = 0;
    const newRowInner = rowInner.replace(CELL, (cellFull, tag, cellAttrs, cellContent) => {
      const idx = colIndex++;
      if (isHeader) {
        // Promote header cells to <th scope="col"> for proper semantics.
        const a = setAttrs(cellAttrs, { scope: "col", role: "columnheader" });
        return `<th${a}>${cellContent}</th>`;
      }
      const isTh = tag.toLowerCase() === "th";
      const attrsObj = isTh ? { role: "rowheader", scope: "row" } : { role: "cell" };
      const label = headers[idx];
      if (label) attrsObj["data-label"] = escapeXML(label);
      const a = setAttrs(cellAttrs, attrsObj);
      return `<${tag}${a}>${cellContent}</${tag}>`;
    });

    const trA = setAttrs(trAttrs, { role: "row" });
    return `<tr${trA}>${newRowInner}</tr>`;
  });

  // Ensure a <thead> wraps the header row so the card CSS can hide it, and give
  // every row group its ARIA role.
  if (/<thead\b/i.test(inner)) {
    inner = inner
      .replace(/<thead\b([^>]*)>/i, (m, a) => `<thead${setAttrs(a, { role: "rowgroup" })}>`)
      .replace(/<tbody\b([^>]*)>/i, (m, a) => `<tbody${setAttrs(a, { role: "rowgroup" })}>`)
      .replace(/<tfoot\b([^>]*)>/i, (m, a) => `<tfoot${setAttrs(a, { role: "rowgroup" })}>`);
  } else {
    const caption = (inner.match(CAPTION) || [""])[0];
    const allRows = inner.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
    const head = allRows[0] || "";
    const body = allRows.slice(1).join("\n");
    inner =
      `${caption}\n` +
      `<thead role="rowgroup">\n${head}\n</thead>\n` +
      `<tbody role="rowgroup">\n${body}\n</tbody>\n`;
  }

  const newTableAttrs = setAttrs(tableAttrs, { role: "table", "data-responsive": mode });
  const table = `<table${newTableAttrs}>${inner}</table>`;

  // Focusable scroll region so the horizontal-scroll fallback is keyboard-reachable
  // and announced by screen readers.
  const captionText = stripTags((full.match(CAPTION) || [""])[0]) || "Table";
  const label = escapeXML(`${captionText}: table with ${rows.length} rows and ${cols} columns`);
  return `<div class="table-scroll" role="region" aria-label="${label}" tabindex="0">\n${table}\n</div>`;
}

/**
 * Enhance every table in an HTML string for accessible, responsive rendering.
 * @param {string} html
 * @param {object} [opts]
 * @param {number} [opts.columnThreshold] - cols above which the scroll fallback is used
 * @returns {string} html with tables wrapped + enhanced
 */
export function processTables(html, opts = {}) {
  const threshold = Number.isFinite(opts.columnThreshold)
    ? opts.columnThreshold
    : DEFAULT_COLUMN_THRESHOLD;
  return String(html).replace(TABLE, (full) => {
    try {
      return transformTable(full, threshold);
    } catch {
      return full;
    }
  });
}
