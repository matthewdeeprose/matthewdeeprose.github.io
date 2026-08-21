/**
 * @fileoverview Injected stylesheet for the Ally accessibility-statement export.
 * @module ally-statement-export-css
 * @version 0.2.0
 * @since 0.2.0 (Part 2 — presentation parity)
 *
 * @description
 * A single `<style>` string handed to the Phase 1 export facade as
 * `options.head`, so it lands in the exported document's `<head>` AFTER the
 * scorm-builder library CSS and therefore wins on source order. It reproduces
 * the in-app `.ally-sp-*` section chrome (boxes, borders, icon sizes/colours,
 * link-button grid, course-info, disclosure spacing, video box) so an exported
 * statement LOOKS like the original, but expressed against the OUTPUT's own theme
 * tokens so it tracks the SCORM/HTML output's light/dark toggle (`[data-theme=
 * "dark"]` on `<html>`).
 *
 * Why this is a data-only module (no logging block): it exports a single string
 * constant and runs no logic. It mirrors `scorm-builder/assets/css.js` in shape.
 *
 * STRUCTURE is mirrored from ally-scripts/css/ally-main.css (theme-agnostic:
 * layout, grids, gutters, and every icon size). This matters because the library
 * base CSS is `svg { max-width:100%; height:auto; display:block }` — so ANY icon
 * we do not explicitly size inflates to its container. Every `.ally-sp-*-icon` /
 * graphic is therefore given an explicit size here.
 *
 * COLOUR is mirrored from light.css / dark.css, but expressed against the output's
 * theme tokens — which the reader can OVERRIDE from the exported document's
 * sidebar (Appearance -> Customise colours). That feature writes six custom
 * properties into a <style id="user-content-colours"> scoped to
 * `main.document-content`, so everything below inherits them. What each reader
 * control drives here:
 *
 *   Background   --body-bg     box fills (derived), link-button card, link-button text
 *   Body text    --body-text   every 4px box border; the derived fills and the
 *                              muted placeholder text step away from it
 *   Headings     --heading-color   NOTHING here, deliberately — it used to repaint
 *                              the dark icons and box links, which surprised readers
 *   Links        --link-color  box links, link-button fill/border, disclosure link
 *   Link hover   --link-hover  the :hover counterparts of those
 *   Heading border --border-color  unused here
 *
 * Pinned on purpose, so a customisation cannot break them: the icons (#005051 light
 * / #b3dbd2 dark — decorative graphics with measured SC 1.4.11 ratios), the gold
 * focus indicator (#fcbc00 on #00131d — the library makes the same call for its own
 * focus ring), and the .ally-sp-error box (see the deliberate deviation below).
 *
 * IMPLEMENTATION RULE — never hoist a derived colour to :root or to
 * main.document-content. Custom properties resolve on the element that declares
 * them: at :root the override has not applied yet (the library's own
 * `--focus-outline: var(--link-color)` is stuck this way), and on
 * main.document-content a value would be stale for the a11y fixture's nested
 * <div data-theme="dark"> copy. Inline var() / color-mix() at each use site
 * instead, with a plain-value fallback declaration immediately above each
 * color-mix() for engines that do not support it.
 *
 * DISCLOSURES are the interactive in-app pattern, NOT native <details>: a real
 * <button.ally-sp-disclosure-button> + revealed content, driven by the injected
 * end-of-body script (options.bodyEnd). This CSS styles the button as an
 * underlined teal/gold link with a rotating border caret (mirroring the in-app
 * .ally-sp-disclosure); the script handles the relocate-below-content + Read more
 * ↔ Read less + focus management. Focus indicator is left native (no custom
 * :focus-visible). The content ships VISIBLE in the raw HTML (readable with JS
 * off); the script collapses it on load.
 *
 * EXTERNAL LINKS are rewritten to open in a new tab by the SCORM target ONLY
 * (see applyExportNewTabLinks in ally-scripts/ui/ally-statement-preview.js). This
 * sheet supplies the two classes that treatment needs — .visually-hidden, which
 * the output does NOT define (it has .sr-only), and an explicitly-sized
 * .ally-sp-external-icon. Both are inert in a standalone HTML export, which never
 * emits the markup.
 *
 * ONE DELIBERATE DEVIATION (accessibility over fidelity): the in-app dark
 * `.ally-sp-error` keeps a near-white background (#fef7f6) while dark body text
 * is light — a latent contrast failure. The export pins dark text on the
 * always-near-white error box in BOTH themes so it stays WCAG 2.2 AA.
 */

export const ALLY_STATEMENT_EXPORT_CSS = `<style id="ally-statement-export-css">
/* ====================================================================== *
 * STRUCTURE (theme-agnostic) — mirrored from ally-main.css                *
 * ====================================================================== */

/* Shared box chrome for the boxed section types. */
.ally-sp-warning,
.ally-sp-success,
.ally-sp-error,
.ally-sp-info,
.ally-sp-linkbuttons,
.ally-sp-courseinfo,
.ally-sp-group {
  border-radius: 4px;
  padding: 1.25rem;
  margin: 1.5rem 0;
}

/* Anchor our own text to --body-text. MEASURED, not defensive: the library gives
   <p> and headings their own color: var(--body-text) rules, but plain flow text
   — the course-info <dt>/<dd> above all — inherits from <body>, which sits OUTSIDE
   the customiser's main.document-content scope and so keeps the UN-overridden
   colour. With the box fills now following the reader's background, that text went
   dark-on-dark (1.12:1) the moment a dark background was chosen. Setting it on the
   box makes every descendant follow the reader instead. No visual change at the
   default tokens, where this resolves to the value already inherited.

   .ally-sp-error is excluded on purpose — it pins its own dark text on a
   deliberately always-near-white fill (see the header note). */
.ally-sp-intro,
.ally-sp-warning,
.ally-sp-success,
.ally-sp-info,
.ally-sp-linkbuttons,
.ally-sp-courseinfo,
.ally-sp-group {
  color: var(--body-text);
}

/* NO ITALICS in the exported statement — italic text is harder to read, and this
   export already caters for that readership (it ships an OpenDyslexic option).
   Measured: with the placeholder set upright, a real export has zero italic text
   today. This makes that a guarantee rather than a fact about today's content —
   statement body text is inserted via innerHTML from the content library, so
   <em> and friends are reachable, and every one of these is italic by UA default
   with nothing in the library CSS to stop it.

   Emphasis is re-expressed as WEIGHT, not dropped: italic is currently the only
   thing marking <em>/<i>, so setting them upright without a substitute would
   leave emphasis conveyed by nothing at all. Scoped to the .ally-sp-* sections
   so no other exported content is affected. .ally-sp-error is included here (it
   is excluded only from the colour rule above, for its pinned text). */
:is(
  .ally-sp-intro,
  .ally-sp-warning,
  .ally-sp-success,
  .ally-sp-error,
  .ally-sp-info,
  .ally-sp-linkbuttons,
  .ally-sp-courseinfo,
  .ally-sp-group
)
  :is(em, i, cite, dfn, var, address, q, blockquote, figcaption) {
  font-style: normal;
}
:is(
  .ally-sp-intro,
  .ally-sp-warning,
  .ally-sp-success,
  .ally-sp-error,
  .ally-sp-info,
  .ally-sp-linkbuttons,
  .ally-sp-courseinfo,
  .ally-sp-group
)
  :is(em, i) {
  font-weight: 600;
}

/* Left-gutter model shared by warning / info / group. Two knobs; --sp-gutter is
   DERIVED. Body content is indented by --sp-gutter so its text aligns under the
   heading while the icon sits in the gutter. */
.ally-sp-warning,
.ally-sp-info,
.ally-sp-success,
.ally-sp-group {
  --sp-icon-size: 2.5rem;
  --sp-gutter-gap: clamp(
    0.75rem,
    calc(0.75rem + (100vw - 64rem) * 0.03125),
    2.5rem
  );
  --sp-gutter: calc(var(--sp-icon-size) + var(--sp-gutter-gap));
}

/* Query containers so the responsive grids/graphics collapse on the CARD's own
   width, not the viewport. */
.ally-sp-info {
  container: ally-sp-info-card / inline-size;
}
.ally-sp-linkbuttons {
  container: ally-sp-linkbuttons-card / inline-size;
}
.ally-sp-courseinfo {
  container: ally-sp-card / inline-size;
}

/* --- Warning (issue) card --- */
.ally-sp-warning-header {
  display: flex;
  align-items: center;
  gap: var(--sp-gutter-gap);
  margin-bottom: 1rem;
}
.ally-sp-warning-icon {
  flex-shrink: 0;
  line-height: 1;
}
.ally-sp-warning-icon svg,
.ally-sp-warning-icon .icon {
  width: var(--sp-icon-size);
  height: var(--sp-icon-size);
  flex-shrink: 0;
}
.ally-sp-warning h2,
.ally-sp-warning h3,
.ally-sp-warning h4 {
  margin: 0;
  line-height: 1.3;
}
.ally-sp-warning > p {
  margin: 1rem 0;
  margin-left: var(--sp-gutter);
  line-height: 1.6;
}

/* --- Disclosure ("Read more") ---
   An interactive <button> + revealed content, driven by the injected end-of-body
   script (which mirrors the in-app toggle: on expand the button relocates BELOW
   the content so DOM order = visual order = focus order, the label flips
   Read more ↔ Read less, the chevron rotates via aria-expanded, and focus is kept
   on the button across the move). Styled to match the in-app .ally-sp-disclosure
   link: an underlined teal (light) / gold (dark) link with a trailing border
   caret. Focus is left to the output/browser-native indicator (no custom
   :focus-visible). The content is visible in the raw HTML (no-JS readable); the
   script collapses it on load. */
.ally-sp-disclosure-wrapper {
  display: flex;
  flex-direction: column;
  margin-left: var(--sp-gutter);
}
.ally-sp-disclosure-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  min-height: 44px;
  margin-top: 1rem;
  padding: 0.75rem 0;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: inherit;
  text-align: left;
  cursor: pointer;
  /* Reads as a link, so it takes the link tokens — which also means one rule
     covers both themes and no dark override is needed. The caret below inherits
     it via currentcolor. */
  color: var(--link-color);
}
.ally-sp-disclosure-button:hover {
  color: var(--link-hover);
}
.ally-sp-disclosure-text {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
/* Border-drawn caret (not a Unicode ▼ glyph, which trips axe's nonBmp check):
   points down when collapsed, up when expanded. */
.ally-sp-disclosure-button::after {
  content: "";
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  border-right: 2px solid currentcolor;
  border-bottom: 2px solid currentcolor;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
}
.ally-sp-disclosure-button[aria-expanded="true"]::after {
  transform: rotate(-135deg);
}
@media (prefers-reduced-motion: reduce) {
  .ally-sp-disclosure-button::after {
    transition: none;
  }
}
.ally-sp-expandable-content {
  margin-top: 1.5rem;
}
.ally-sp-expandable-content h3,
.ally-sp-expandable-content h4 {
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
.ally-sp-expandable-content h3:first-child,
.ally-sp-expandable-content h4:first-child {
  margin-top: 0;
}
.ally-sp-expandable-content ul {
  margin-left: 1.5rem;
  margin-bottom: 1rem;
}
.ally-sp-expandable-content li {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}
.ally-sp-expandable-content ul ul {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

/* --- Success card --- (shares the warning/info gutter model) */
.ally-sp-success-header {
  display: flex;
  align-items: center;
  gap: var(--sp-gutter-gap);
  margin-bottom: 0.75rem;
}
.ally-sp-success-icon {
  flex-shrink: 0;
  line-height: 1;
}
.ally-sp-success-icon svg,
.ally-sp-success-icon .icon {
  width: var(--sp-icon-size);
  height: var(--sp-icon-size);
  flex-shrink: 0;
}
.ally-sp-success h2,
.ally-sp-success h3,
.ally-sp-success h4 {
  margin: 0;
  line-height: 1.3;
}
.ally-sp-success > p {
  line-height: 1.6;
  margin: 0.75rem 0;
  margin-left: var(--sp-gutter);
}

/* --- Error card --- */
.ally-sp-error-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.ally-sp-error-icon {
  flex-shrink: 0;
}
.ally-sp-error-icon svg,
.ally-sp-error-icon .icon {
  width: 2rem;
  height: 2rem;
}
.ally-sp-error h2,
.ally-sp-error h3 {
  margin: 0;
  line-height: 1.3;
}
.ally-sp-error p {
  line-height: 1.6;
  margin: 0.5rem 0 0 0;
}

/* --- Info card --- */
.ally-sp-info-header {
  display: flex;
  align-items: center;
  gap: var(--sp-gutter-gap);
  margin-bottom: 0.75rem;
}
.ally-sp-info-header h2,
.ally-sp-info-header h3,
.ally-sp-info-header h4,
.ally-sp-info-header h5,
.ally-sp-info-header h6 {
  margin: 0;
}
.ally-sp-info-icon {
  flex-shrink: 0;
  line-height: 1;
}
.ally-sp-info-icon svg,
.ally-sp-info-icon .icon {
  width: var(--sp-icon-size);
  height: var(--sp-icon-size);
  flex-shrink: 0;
}
/* Icon'd body sub-heading: its icon shares the header's left gutter, so the whole
   sub-heading is pulled back out of the body indent by the gutter width. */
.ally-sp-info-subheading {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--sp-gutter-gap);
  margin-left: calc(-1 * var(--sp-gutter));
}
.ally-sp-info-subicon svg,
.ally-sp-info-subicon .icon {
  width: var(--sp-icon-size);
  height: var(--sp-icon-size);
  flex-shrink: 0;
}
.ally-sp-info-body {
  display: block;
  line-height: 1.6;
  margin-left: var(--sp-gutter);
}
.ally-sp-info-body p {
  margin: 0.75rem 0;
}
.ally-sp-info-body ul,
.ally-sp-info-body ol {
  margin: 0.75rem 0;
}
/* Rich-text (module-lead message) and its role=heading pseudo-headings. */
.ally-sp-info-richtext > :first-child {
  margin-top: 0;
}
.ally-sp-info-richtext > :last-child {
  margin-bottom: 0;
}
.ally-sp-md-heading {
  display: block;
  font-weight: 700;
  line-height: 1.3;
  margin: 1.25rem 0 0.5rem;
}
.ally-sp-md-heading-1 {
  font-size: 1.25rem;
}
.ally-sp-md-heading-2 {
  font-size: 1.1rem;
}
.ally-sp-md-heading-3,
.ally-sp-md-heading-4,
.ally-sp-md-heading-5,
.ally-sp-md-heading-6 {
  font-size: 1rem;
}
/* Glossary definition list inside an info box. */
.ally-sp-info-dl {
  margin: 0.75rem 0;
}
.ally-sp-info-dl dt {
  font-weight: 600;
  margin: 0.75rem 0 0.25rem;
}
.ally-sp-info-dl dt:first-child {
  margin-top: 0;
}
.ally-sp-info-dl dd {
  margin: 0 0 0 1.5rem;
  line-height: 1.6;
}
/* Two-column / media info bodies collapse on the card's own width. */
.ally-sp-info-body--two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
@container ally-sp-info-card (max-width: 42rem) {
  .ally-sp-info-body--two-col {
    grid-template-columns: 1fr;
  }
}
.ally-sp-info-body--media {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: center;
}
@container ally-sp-info-card (max-width: 40rem) {
  .ally-sp-info-body--media {
    grid-template-columns: 1fr;
  }
}
.ally-sp-info-links {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
}
.ally-sp-info-links li {
  margin-bottom: 0.5rem;
}
.ally-sp-info-link-icon,
.ally-sp-courseinfo-icon {
  display: inline-flex;
  margin-right: 0.4rem;
  vertical-align: middle;
}
.ally-sp-info-link-icon svg,
.ally-sp-info-link-icon .icon {
  width: 1rem;
  height: 1rem;
  vertical-align: middle;
}

/* --- Link buttons --- */
.ally-sp-linkbutton-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
.ally-sp-linkbutton-grid--two-col {
  grid-template-columns: repeat(2, 1fr);
}
/* Collapse to one column when the section is genuinely narrow. NOTE the threshold
   is LOWER than the in-app 46rem: the SCORM/HTML output caps its content in a
   readability column (.reading-column) at ~45.5rem, so the in-app breakpoint
   would collapse two columns at EVERY desktop width. 34rem keeps two comfortable
   ~300px cards across the export's 41–45.5rem desktop column and still stacks on
   tablet/mobile. */
@container ally-sp-linkbuttons-card (max-width: 34rem) {
  .ally-sp-linkbutton-grid--two-col {
    grid-template-columns: 1fr;
  }
}
.ally-sp-linkbutton-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 4px;
  /* Gutter for the card body: heading icon (1.75rem) + heading flex gap (0.5rem),
     used to indent the body under the heading TEXT (matches the in-app card). */
  --sp-card-gutter: calc(1.75rem + 0.5rem);
}
.ally-sp-linkbutton-card :is(h2, h3, h4, h5, h6) {
  margin: 0;
  line-height: 1.3;
}
/* Card heading with a decorative icon beside the text (nowrap so the wide text
   item never drops onto its own flex line below the icon). */
.ally-sp-linkbutton-card-heading {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 0.5rem;
}
.ally-sp-linkbutton-card-icon {
  display: inline-flex;
  flex-shrink: 0;
  /* Centre the icon on the FIRST heading line: the heading stays
     align-items:flex-start, so size the icon box to one line-height (1.3em,
     matching the heading line-height above) and centre the taller SVG in it. */
  align-items: center;
  height: 1.3em;
}
.ally-sp-linkbutton-card-icon svg,
.ally-sp-linkbutton-card-icon .icon {
  width: 1.75rem;
  height: 1.75rem;
}
.ally-sp-linkbutton-card p {
  margin: 0;
  flex: 1;
}
/* Indent the card body under the heading text (past the icon), matching the
   info/warning gutter. Scoped to cards with an icon'd heading; the link button
   keeps its own alignment. */
.ally-sp-linkbutton-card:has(.ally-sp-linkbutton-card-heading) p {
  margin-left: var(--sp-card-gutter);
}
/* A real <a> styled to LOOK like a button (it navigates). */
.ally-sp-linkbutton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  align-self: center;
  margin-top: 0.5rem;
  min-height: 44px;
  padding: 0.5rem 1rem;
  border-width: 1px;
  border-style: solid;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 500;
}
.ally-sp-linkbutton:hover {
  text-decoration: underline;
}
.ally-sp-linkbutton-icon svg,
.ally-sp-linkbutton-icon .icon {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
}

/* --- External links that open in a new tab (SCORM target only) ---
   The SCORM export rewrites external http(s) links to target="_blank" (the LMS
   content frame blocks same-frame navigation to another origin), appending a
   decorative icon and a visually-hidden " (opens in a new tab)" suffix INSIDE the
   <a>. The output's own CSS supplies NEITHER class: it defines .sr-only and
   .lyt-visually-hidden but not .visually-hidden, and it styles only its own
   component classes. Both are therefore supplied here.

   Colour is deliberately absent: the icon is stroke="currentColor", so it takes
   the link's own colour in both themes and its contrast tracks the link text. */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.ally-sp-external-icon {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin-left: 0.25rem;
}
/* Explicit size, always: the library base rule is svg { max-width:100%; height:auto },
   so an unsized injected icon inflates to fill its container. */
.ally-sp-external-icon svg,
.ally-sp-external-icon .icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}
/* Inside a link-button the icon is a flex item and the button already supplies
   gap: 0.4rem, so the margin above would double-space it. */
.ally-sp-linkbutton .ally-sp-external-icon {
  margin-left: 0;
}

/* --- Course information --- */
.ally-sp-courseinfo > h2,
.ally-sp-courseinfo > h3 {
  margin-top: 0;
  line-height: 1.3;
}
.ally-sp-courseinfo-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.35rem 1.25rem;
  margin: 0;
}
/* Emphasis on the VALUE, not the label: the reader is scanning for the data. */
.ally-sp-courseinfo-list dt {
  font-weight: 400;
}
.ally-sp-courseinfo-list dd {
  margin: 0;
  font-weight: 600;
}
.ally-sp-courseinfo-icon svg,
.ally-sp-courseinfo-icon .icon {
  width: 1rem;
  height: 1rem;
  vertical-align: middle;
  margin-right: 0.35rem;
}
@container ally-sp-card (max-width: 22rem) {
  .ally-sp-courseinfo-list {
    grid-template-columns: 1fr;
    gap: 0.1rem 0;
  }
  .ally-sp-courseinfo-list dd {
    margin-bottom: 0.5rem;
  }
}
.ally-sp-courseinfo-body--two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
.ally-sp-courseinfo-group {
  container-type: inline-size;
}
.ally-sp-courseinfo-group > h4 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}
.ally-sp-courseinfo-note {
  margin: 0.75rem 0 0;
}
.ally-sp-courseinfo-group--has-graphic {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: 1rem;
  align-items: center;
}
.ally-sp-courseinfo-group--has-graphic > :not(.ally-sp-courseinfo-graphic) {
  grid-column: 1;
}
.ally-sp-courseinfo-graphic {
  grid-column: 2;
  grid-row: 1 / -1;
  align-self: center;
  flex-shrink: 0;
}
.ally-sp-courseinfo-graphic svg,
.ally-sp-courseinfo-graphic .icon {
  width: 4rem;
  height: 4rem;
}
/* No italics anywhere in the exported statement — italic text is harder to read,
   and this export already caters for that readership (it ships an OpenDyslexic
   option). The placeholder is distinguished by its bracketed wording and its
   muted colour instead, so nothing is lost by setting this upright. Declared
   rather than deleted so a UA or library italic cannot reintroduce it. */
.ally-sp-placeholder {
  font-style: normal;
}
@container ally-sp-card (max-width: 40rem) {
  .ally-sp-courseinfo-body--two-col {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
@container ally-sp-card (max-width: 48rem) {
  .ally-sp-courseinfo-group--has-graphic {
    display: block;
  }
  .ally-sp-courseinfo-graphic {
    display: none;
  }
}

/* --- Group panel (boxed, wraps child cards) --- */
.ally-sp-group-header {
  display: flex;
  align-items: center;
  gap: var(--sp-gutter-gap);
  margin: 0 0 1rem;
}
.ally-sp-group-header > :is(h2, h3, h4, h5, h6) {
  margin: 0;
  line-height: 1.3;
}
.ally-sp-group-icon {
  flex-shrink: 0;
  line-height: 1;
}
.ally-sp-group-icon svg,
.ally-sp-group-icon .icon {
  width: var(--sp-icon-size);
  height: var(--sp-icon-size);
  flex-shrink: 0;
}
/* Child info cards lift off the group panel; borderless so they don't double up. */
.ally-sp-group .ally-sp-info {
  border: 0;
}

/* --- Video box + export embed ---
   lite-youtube is not present in the SCORM/HTML output, so the export path
   replaces the embed with a standard responsive YouTube <iframe> (see
   embedExportMedia), falling back to a plain link for non-YouTube media. */
.ally-sp-video {
  margin: 1.5rem 0;
}
.ally-sp-video h2,
.ally-sp-video h3 {
  margin: 0 0 0.5rem;
  line-height: 1.3;
}
.ally-sp-video-caption {
  margin: 0 0 0.75rem;
  line-height: 1.6;
}
/* Responsive 16:9 embed container (padding-hack works in any renderer). */
.ally-sp-video-embed {
  position: relative;
  width: 100%;
  max-width: 40rem;
  margin: 0.75rem 0 0;
}
.ally-sp-video-embed::before {
  content: "";
  display: block;
  padding-top: 56.25%;
}
/* The ::before reserves the 16:9 box; the embed then fills it absolutely. This
   must cover <lite-youtube> as well as <iframe>: with lite-youtube always on, a
   YouTube <iframe> is rewritten to <lite-youtube>, which is display:block with
   its OWN 16:9 sizing — so without this it flows below the reserved box and
   leaves an empty 16:9 gap above the video. Filling it here (like the iframe)
   collapses that gap; lite-youtube's internal poster/play button still fill the
   box. Non-YouTube <iframe> embeds are unaffected. */
.ally-sp-video-embed iframe,
.ally-sp-video-embed lite-youtube {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 4px;
}
.ally-sp-export-media-link {
  margin: 0.75rem 0 0;
}

/* --- Narrow viewport: drop the decorative gutter/icons so text reclaims width. */
@media (max-width: 600px) {
  .ally-sp-warning,
  .ally-sp-success,
  .ally-sp-error {
    padding: 1rem;
  }
  .ally-sp-info,
  .ally-sp-warning,
  .ally-sp-success,
  .ally-sp-group {
    --sp-gutter: 0px;
  }
  .ally-sp-info-icon,
  .ally-sp-info-subicon,
  .ally-sp-warning-icon,
  .ally-sp-success-icon,
  .ally-sp-error-icon,
  .ally-sp-group-icon {
    display: none;
  }
  .ally-sp-group > .ally-sp-info,
  .ally-sp-group > .ally-sp-info > .ally-sp-info-header {
    margin-left: 0;
  }
}

/* ====================================================================== *
 * THEME — light (default). Token where the in-app value equals one;      *
 * pinned brand hex otherwise.                                            *
 * ====================================================================== */
.ally-sp-warning {
  /* Border stays on --body-text so it always contrasts with whatever background
     the reader chooses. The fill is a faint step away from the page background,
     derived so it follows a customised background; the rgba line above it is the
     pre-color-mix fallback and renders identically at the default tokens. */
  border: 4px solid var(--body-text);
  background-color: rgba(225, 232, 236, 0.3);
  background-color: color-mix(in srgb, var(--body-text) 4%, var(--body-bg));
}
.ally-sp-success {
  /* Unified box border: --body-text (#00131D light / #E1E8EC dark) — matches
     the in-app statement, where every box shares the warning border. */
  border: 4px solid var(--body-text);
}
.ally-sp-success-icon {
  color: #005051;
}
.ally-sp-error {
  /* Always-near-white box: pin dark text so it stays AA in both themes. The
     border tracks that pinned text (currentcolor = #00131D) so it stays a crisp
     near-black in both themes, matching the unified box border. */
  border: 4px solid currentcolor;
  background-color: #fef7f6;
  color: #00131d;
}
.ally-sp-error-icon {
  color: #d5007f;
}
.ally-sp-info,
.ally-sp-linkbuttons,
.ally-sp-courseinfo,
.ally-sp-group {
  /* Unified box border: --body-text (#00131D light / #E1E8EC dark). */
  border: 4px solid var(--body-text);
}
/* Light box fill — SELECTIVE for info boxes: only boilerplate info boxes and the
   intro take the faint tint; per-course "data" info boxes stay flat on the page
   background. (Dark darkens ALL info boxes uniformly — see the dark block.)

   Wrapped in :where() so the whole list stays specificity (0,0,0). Without this,
   the boilerplate selector .ally-sp-info[data-sp-export=include][data-sp-category=
   boilerplate] is (0,3,0) and OUT-SPECIFIES the dark override
   [data-theme="dark"] .ally-sp-info (0,2,0) — leaking this light tint into dark on
   the four boilerplate boxes. Flattening to (0,0,0) lets every dark override win.
   Safe because nothing else paints these sections in light (pre-change they were
   transparent, border-only). */
:where(
  .ally-sp-intro,
  .ally-sp-warning,
  .ally-sp-success,
  .ally-sp-group,
  .ally-sp-info:not([data-sp-export="include"]),
  .ally-sp-info[data-sp-export="include"][data-sp-category="boilerplate"],
  .ally-sp-courseinfo,
  .ally-sp-linkbuttons
) {
  background-color: rgba(225, 232, 236, 0.3);
  background-color: color-mix(in srgb, var(--body-text) 4%, var(--body-bg));
}
.ally-sp-info-icon,
.ally-sp-info-subicon,
.ally-sp-info-link-icon,
.ally-sp-courseinfo-icon,
.ally-sp-linkbutton-card-icon,
.ally-sp-group-icon,
.ally-sp-courseinfo-graphic {
  color: #005051;
}
/* A link inside a statement box is still a link: it takes the reader's own link
   colours, so it matches every other link in the exported document and stays
   legible on a customised background. */
.ally-sp-info a,
.ally-sp-courseinfo a {
  color: var(--link-color);
}
.ally-sp-info a:hover,
.ally-sp-courseinfo a:hover {
  color: var(--link-hover);
}
/* Muted body text, derived rather than pinned — a fixed mid-grey drops below AA
   the moment the reader darkens the background. */
.ally-sp-placeholder {
  color: #495961;
  color: color-mix(in srgb, var(--body-text) 72%, var(--body-bg));
}
.ally-sp-linkbutton-card {
  background-color: #fffff4;
  background-color: var(--body-bg);
  border: 1px solid currentcolor;
}
/* Link-buttons invert the link pairing: body background ON the link colour. That
   is contrast-safe by construction — the ratio is identical to link-on-background,
   which is exactly the pairing the export's own contrast readout warns about. */
.ally-sp-linkbutton {
  background-color: var(--link-color);
  border-color: var(--link-color);
  color: var(--body-bg);
}
.ally-sp-linkbutton:hover {
  background-color: var(--link-hover);
  border-color: var(--link-hover);
  color: var(--body-bg);
}
/* Gold focus (WCAG): dark text on the gold fill passes AA in both themes. */
.ally-sp-info a:focus-visible,
.ally-sp-courseinfo a:focus-visible,
.ally-sp-linkbuttons a:focus-visible,
.ally-sp-expandable-content a:focus-visible {
  outline: 3px solid #fcbc00;
  background-color: #fcbc00;
  color: #00131d;
}

/* ====================================================================== *
 * THEME — dark. Only the ally-specific colours that differ. Box borders    *
 * track --body-text and need no override here; links and link-buttons take *
 * the link tokens, which re-theme on their own.                            *
 * ====================================================================== */
[data-theme="dark"] .ally-sp-warning {
  border-color: currentcolor;
  background-color: #00131d;
  background-color: color-mix(in srgb, var(--body-bg) 88%, #000);
}
/* Success box: the border now tracks --body-text (unified box border, #E1E8EC on
   #231f20 in dark); only the success icon takes the teal accent, mapped to
   #b3dbd2 in dark (the established #005051 -> #b3dbd2 counterpart) so it clears
   3:1 on #231f20 (~10.8:1) instead of the dim #005051-on-near-black (~1.75:1). */
[data-theme="dark"] .ally-sp-success-icon {
  color: #b3dbd2;
}
[data-theme="dark"] .ally-sp-success,
[data-theme="dark"] .ally-sp-info,
[data-theme="dark"] .ally-sp-linkbuttons,
[data-theme="dark"] .ally-sp-courseinfo,
[data-theme="dark"] .ally-sp-group {
  /* Dark darkens ALL info boxes uniformly (unlike the selective light fill).
     Derived so the boxes still sit DEEPER than a customised background rather
     than staying a fixed near-black the reader's choice cannot move.

     Deepen RELATIVELY (toward black), not toward a fixed #00131d. Measured: the
     fixed-hue form collapsed to a murky mid-grey when a reader chose a LIGHT
     background while in dark theme, dropping box links to 3.88:1 — and the
     export's own contrast readout cannot warn, because it only ever checks
     against the page background, never a box fill. */
  background-color: #00131d;
  background-color: color-mix(in srgb, var(--body-bg) 88%, #000);
}
[data-theme="dark"] .ally-sp-info-icon,
[data-theme="dark"] .ally-sp-info-subicon,
[data-theme="dark"] .ally-sp-info-link-icon,
[data-theme="dark"] .ally-sp-courseinfo-icon,
[data-theme="dark"] .ally-sp-linkbutton-card-icon,
[data-theme="dark"] .ally-sp-group-icon,
[data-theme="dark"] .ally-sp-courseinfo-graphic {
  /* Pinned, NOT --heading-color: these are decorative graphics, so the reader's
     Headings choice should not repaint them, and pinning keeps the measured
     SC 1.4.11 ratio fixed. Same rendered value as before. */
  color: #b3dbd2;
}
[data-theme="dark"] .ally-sp-info a,
[data-theme="dark"] .ally-sp-courseinfo a {
  color: var(--link-color);
}
[data-theme="dark"] .ally-sp-info a:hover,
[data-theme="dark"] .ally-sp-courseinfo a:hover {
  color: var(--link-hover);
}
[data-theme="dark"] .ally-sp-placeholder {
  color: #b1b4b6;
  color: color-mix(in srgb, var(--body-text) 72%, var(--body-bg));
}
[data-theme="dark"] .ally-sp-linkbutton-card {
  background-color: #231f20;
  background-color: var(--body-bg);
  border: 1px solid currentcolor;
}
[data-theme="dark"] .ally-sp-linkbutton {
  background-color: var(--link-color);
  border-color: var(--link-color);
  color: var(--body-bg);
}
[data-theme="dark"] .ally-sp-linkbutton:hover {
  background-color: var(--link-hover);
  border-color: var(--link-hover);
  color: var(--body-bg);
}
</style>`;
