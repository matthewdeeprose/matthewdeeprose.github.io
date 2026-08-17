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
