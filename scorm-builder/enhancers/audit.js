// Build-time accessibility audit of the source content. Non-blocking by design:
// it collects warnings the caller can surface (via `onAccessibilityWarning`) or
// escalate (via `strictAccessibility`), and never mutates the HTML.
//
// Currently checks:
//   img-missing-alt — an <img> with NO `alt` attribute at all (WCAG 1.1.1
//     Non-text Content). An EMPTY alt (alt="") is deliberately NOT flagged: it
//     is the correct, intentional marker for a decorative image.
//   img-missing-longdesc — OPT-IN (opts.warnMissingLongDescription): an <img>
//     with a very long alt (a sign the author is stuffing structure meant for a
//     long description into alt) and no adjacent long description. Off by default
//     so builds stay quiet; see enhancers/long-descriptions.js for the fix.
//
//   svg-missing-name — an <svg role="img"> with no non-empty aria-label or
//     aria-labelledby (WCAG 1.1.1). Skips MathJax svg inside <mjx-container>.
//   svg-decorative-conflict — an aria-hidden="true" <svg> that also carries role,
//     aria-label or aria-details, or is focusable (tabindex >= 0, focusable="true"
//     or "auto"). A plain aria-hidden icon is NOT flagged.
//
// Each warning: { type, message, snippet }.

const IMG_TAG = /<img\b[^>]*>/gi;
// Matches a real alt attribute: alt="...", alt='...' or alt=token. Requires
// whitespace (or the tag open) immediately before `alt` so it never matches a
// different attribute that merely ends in "alt", e.g. `data-alt`.
const ALT_ATTR = /(?:^|[\s"'])alt\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i;

// Above this alt length we suspect a long description was crammed into `alt`.
const LONG_ALT_THRESHOLD = 150;
// A class attribute carrying a `longdesc` class, or an existing aria-details —
// either means the author already supplied / linked a long description nearby.
const LONGDESC_MARKER = /\bclass\s*=\s*("[^"]*\blongdesc\b[^"]*"|'[^']*\blongdesc\b[^']*')|\baria-details\s*=/i;

const SVG_OPEN = /<svg\b(?:"[^"]*"|'[^']*'|[^>"'])*>/gi;

// Value of attribute `name` on a start tag: the string (possibly empty) or null if absent.
function attrValue(tag, name) {
  const m = tag.match(new RegExp(`(?:^|[\\s"'/])${name}(?![\\w-])(?:\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+))?`, "i"));
  if (!m) return null;
  return m[1] == null ? "" : m[1].replace(/^["']|["']$/g, "");
}

const snippetOf = (tag) => (tag.length > 120 ? tag.slice(0, 117) + "..." : tag);

// Inline-SVG checks (figure-contract-v1). Pre-rendered MathJax svg inside an
// <mjx-container> is deliberately skipped: it carries role="img" with no name by
// design and is not an authored figure, so existing exports stay quiet.
function auditSvgs(src, warnings) {
  SVG_OPEN.lastIndex = 0;
  let m;
  while ((m = SVG_OPEN.exec(src)) !== null) {
    const tag = m[0];
    const before = src.slice(0, m.index);
    const inMath = before.lastIndexOf("<mjx-container") > before.lastIndexOf("</mjx-container");
    if (inMath) continue;

    const hidden = attrValue(tag, "aria-hidden")?.trim().toLowerCase() === "true";
    if (hidden) {
      const tabindex = attrValue(tag, "tabindex");
      const focusable = attrValue(tag, "focusable")?.trim().toLowerCase();
      const conflicts =
        attrValue(tag, "role") !== null ||
        attrValue(tag, "aria-label") !== null ||
        attrValue(tag, "aria-details") !== null ||
        (tabindex !== null && Number(tabindex) >= 0) ||
        focusable === "true" ||
        focusable === "auto";
      if (conflicts) {
        warnings.push({
          type: "svg-decorative-conflict",
          message:
            'SVG is hidden from assistive technology (aria-hidden="true") but also carries a role, a label, a long-description link or is focusable. ' +
            'Make it either decorative (aria-hidden="true" focusable="false", nothing else) or a described image (role="img" with a name).',
          snippet: snippetOf(tag),
        });
      }
      continue;
    }

    if (attrValue(tag, "role")?.trim().toLowerCase() !== "img") continue;
    const named = (attrValue(tag, "aria-label") || "").trim() || (attrValue(tag, "aria-labelledby") || "").trim();
    if (!named) {
      warnings.push({
        type: "svg-missing-name",
        message:
          'SVG has role="img" but no accessible name. Add a descriptive aria-label (or aria-labelledby), or mark it decorative with aria-hidden="true".',
        snippet: snippetOf(tag),
      });
    }
  }
}

function altText(tag) {
  const m = tag.match(ALT_ATTR);
  if (!m) return null;
  return m[1].replace(/^["']|["']$/g, "");
}

/**
 * @param {string} html
 * @param {object} [opts]
 * @param {boolean} [opts.warnMissingLongDescription=false] - emit img-missing-longdesc
 * @returns {Array<{type: string, message: string, snippet: string}>}
 */
export function auditAccessibility(html, opts = {}) {
  const warnings = [];
  const src = String(html);
  const tags = src.match(IMG_TAG) || [];
  for (const tag of tags) {
    if (!ALT_ATTR.test(tag)) {
      warnings.push({
        type: "img-missing-alt",
        message:
          'Image has no alt attribute. Add descriptive alt text, or alt="" if the image is purely decorative.',
        snippet: tag.length > 120 ? tag.slice(0, 117) + "..." : tag,
      });
    }
  }

  auditSvgs(src, warnings);

  if (opts.warnMissingLongDescription) {
    IMG_TAG.lastIndex = 0;
    let m;
    while ((m = IMG_TAG.exec(src)) !== null) {
      const tag = m[0];
      if (/\baria-details\s*=/i.test(tag)) continue;
      const alt = altText(tag);
      if (!alt || alt.length <= LONG_ALT_THRESHOLD) continue;

      // Look from just after this img up to the next img (or end) for a nearby
      // long description; absence is the signal to warn.
      const rest = src.slice(m.index + tag.length);
      const nextImg = rest.search(/<img\b/i);
      const window = nextImg === -1 ? rest : rest.slice(0, nextImg);
      if (!LONGDESC_MARKER.test(window)) {
        warnings.push({
          type: "img-missing-longdesc",
          message:
            "Image has a very long alt and no long description. Move the detail into a " +
            '<div class="longdesc"> block so screen-reader users get structured content.',
          snippet: tag.length > 120 ? tag.slice(0, 117) + "..." : tag,
        });
      }
    }
  }

  return warnings;
}
