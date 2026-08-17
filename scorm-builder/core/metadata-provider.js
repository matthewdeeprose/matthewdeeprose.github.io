// Pluggable document metadata provider. Default implementation derives title +
// section outline from the rendered DOM headings — works identically for HTML
// and Markdown inputs (both reduce to HTML before this runs). Replaces the
// LaTeX-specific LaTeXProcessor.extractDocumentMetadata.
//
// Callers can supply their own provider (e.g. richer LMS metadata) to build().

import { processHeadings } from "../enhancers/headings.js";

/**
 * This is the single choke point every piece of caller metadata passes through
 * on its way to the footer, the SCORM manifest, the README, the filename and the
 * LOM. It used to rebuild the object from a fixed allow-list — title, author,
 * date, description, sections — which silently discarded everything else, so no
 * new metadata key could ever reach `generateLom`. It now passes unknown keys
 * through untouched.
 *
 * Two deliberate exclusions preserve the old behaviour exactly:
 *   * `title` is derived (caller > first <h1> > placeholder), never taken raw.
 *   * `sections` always comes from the rendered DOM, never from the caller.
 * Empty-ish values (undefined / null / "") are dropped, because the old
 * truthiness gate dropped them and the footer renders on truthiness. An empty
 * ARRAY survives — `keywords: []` is a meaningful opt-out, not an absent value.
 *
 * @param {string} html - rendered content
 * @param {object} [overrides] - { title, author, date, description, ...any LOM keys }
 * @returns {{ title:string, sections: Array<{level:number,text:string,id:string}> }
 *            & Record<string, unknown>}
 */
export function deriveMetadata(html, overrides = {}) {
  const { sections } = processHeadings(html);
  const firstH1 = sections.find((s) => s.level === 1);
  const title = overrides.title || (firstH1 && firstH1.text) || "Accessible Document";

  const extras = {};
  for (const [key, value] of Object.entries(overrides || {})) {
    if (key === "title" || key === "sections") continue;
    if (value === undefined || value === null || value === "") continue;
    extras[key] = value;
  }

  return { title, ...extras, sections };
}
