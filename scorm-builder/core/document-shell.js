// The canonical document shell the builder OWNS and emits. This is the key to
// pandoc-decoupling: the playground's UI scripts (reading-tools, theme,
// distraction-free, mathjax-controls) bind to #main / .document-wrapper /
// #sidebar / #toc / control IDs. By emitting that exact structure here, those
// scripts run unedited regardless of where the content came from.
//
// Maps to: structure/document-wrapper-start.html, integrated-document-sidebar.html
// (+ its partials), structure/document-wrapper-end.html.

import { render } from "../generators/template-engine.js";
import { getTemplate } from "../assets/index.js";
import { buildSidebarContext } from "./defaults.js";
import { escapeXML } from "../util/escape-xml.js";

const SIDEBAR_PARTIALS = {
  themeToggleSection: "theme-toggle-section.html",
  contentColoursSection: "content-colours-section.html",
  printButtonSection: "print-button-section.html",
  readAloudSection: "read-aloud-section.html",
  visualAidsSection: "visual-aids-section.html",
  findSection: "find-section.html",
  readingToolsSection: "reading-tools-section.html",
  resetControlsSection: "reset-controls-section.html",
  mathJaxAccessibilityControls: "mathjax-accessibility-controls.html",
  fontOption: "partials/font-option.html",
  widthOption: "partials/width-option.html",
  zoomOption: "partials/zoom-option.html",
};

function loadPartials(map) {
  const partials = {};
  for (const [name, key] of Object.entries(map)) partials[name] = getTemplate(key);
  return partials;
}

export function renderSidebar(options = {}) {
  const features = options.features || {};
  const context = buildSidebarContext({
    ...(options.sidebar || {}),
    // Gate the colour-customisation controls on the feature flag (default on).
    ...(features.contentColours !== undefined ? { contentColours: features.contentColours } : {}),
    // Gate the read-aloud section on its feature flag (default on).
    ...(features.readAloud !== undefined ? { readAloud: features.readAloud } : {}),
    // Gate the visual-aids section on its feature flag (default on).
    ...(features.visualAids !== undefined ? { visualAids: features.visualAids } : {}),
    // Gate the find-in-document section on its feature flag (default on).
    ...(features.search !== undefined ? { search: features.search } : {}),
    // Gate the keyboard-shortcuts help button on its feature flag (default on).
    ...(features.shortcutsHelp !== undefined ? { shortcutsHelp: features.shortcutsHelp } : {}),
    // Gate the MathJax accessibility section on its feature flag (default on).
    // html-assembler.js already drops the MathJax head AND the controls manager
    // for this flag, so without this the section shipped as dead controls (L11).
    ...(features.mathjaxControls !== undefined ? { mathjaxControls: features.mathjaxControls } : {}),
  });
  return render(getTemplate("integrated-document-sidebar.html"), context, {
    partials: loadPartials(SIDEBAR_PARTIALS),
  });
}

// Distraction-free / focus-mode controls (#toggle-toc, #toggle-sidebar,
// #focus-mode). The distraction-free-manager.js script binds to these.
export function renderDistractionFreeControls() {
  return render(getTemplate("structure/distraction-free-controls.html"), {});
}

// Placeholder TOC used until the TOC generator (phase 5) supplies a populated one.
// Carries id="toc" + .table-of-contents so the skip link and distraction-free
// selectors resolve even before there are sections.
export function renderEmptyToc() {
  return `<nav id="toc" class="table-of-contents" aria-label="Table of contents" hidden></nav>`;
}

// Render the document footer (contentinfo landmark). Fills the grid's `footer`
// area (see grid-layout.css). Uses caller-supplied `custom` HTML if given,
// otherwise assembles from metadata. Returns "" when there is nothing to show,
// so an empty landmark is never emitted.
export function renderFooter({ author, date, description, custom } = {}) {
  const inner = custom
    ? String(custom)
    : [
        author ? `<p class="footer-author">${escapeXML(author)}</p>` : "",
        date ? `<p class="footer-date">${escapeXML(date)}</p>` : "",
        description ? `<p class="footer-description">${escapeXML(description)}</p>` : "",
      ]
        .filter(Boolean)
        .join("\n");
  if (!inner.trim()) return "";
  return `<footer id="doc-footer" class="document-footer" role="contentinfo">\n${inner}\n</footer>`;
}

/**
 * Assemble the <body> inner shell: wrapper + TOC + #main(content) + sidebar + footer.
 * @param {object} parts - { content, toc, sidebar, footer }
 * @returns {string}
 */
export function assembleBodyShell({ content = "", toc = "", sidebar = "", footer = "" } = {}) {
  const start = getTemplate("structure/document-wrapper-start.html").replace("TOC_PLACEHOLDER", toc);
  const end = getTemplate("structure/document-wrapper-end.html"); // </main>
  const footerBlock = footer ? `\n${footer}` : "";
  return `${start}\n${content}\n${end}\n${sidebar}${footerBlock}\n</div>`; // close .document-wrapper
}
