/**
 * Markdown Editor static export (MRC-80)
 *
 * The SCORM and standalone HTML export carries the preview's markup but none of
 * the preview's scripts, so three page controls arrive dead: the sortable-table
 * header buttons (and the show-more rows), the code block "Copy" button, and the
 * tab buttons. The owner's ruling (13 November 2026) is that the export makes
 * them STATIC rather than carrying their scripts:
 *
 *   1. a sortable table becomes a plain table with every row present;
 *   2. a code block loses its copy button and keeps its Prism token colours,
 *      whose rules the export head carries for both site modes;
 *   3. a tab set becomes headed sections, every panel visible, in tab order.
 *
 * Everything here acts on the export copy, an HTML string re-parsed into an
 * inert <template>, so nothing in it loads or runs and the live preview is never
 * touched. The one thing taken from outside the copy is the markdown source,
 * which is re-PARSED (never rendered as a whole, so no diagram or chart fence
 * runs) to recover table rows the sorter keeps only in its own JavaScript.
 *
 * ES module, loaded by a dynamic import beside the export control.
 */

// Logging configuration (inside module scope)
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

// Current logging level - can be overridden by flags
let currentLogLevel = DEFAULT_LOG_LEVEL;
if (ENABLE_ALL_LOGGING) {
  currentLogLevel = LOG_LEVELS.DEBUG;
} else if (DISABLE_ALL_LOGGING) {
  currentLogLevel = -1; // Disable all logging
}

// Helper functions to check if logging should occur
function shouldLog(level) {
  return currentLogLevel >= level;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) {
    console.error(message, ...args);
  }
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) {
    console.warn(message, ...args);
  }
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) {
    console.log(message, ...args);
  }
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) {
    console.log(message, ...args);
  }
}

/**
 * The markup the three page controls build, as their own files write it:
 * markdown-it-sortable-tables-combined.js (prefix "mdSortableTable"),
 * markdown-code-copy.js ("code-copy-button", "code-block-container") and the
 * remote markdown-it-tab plugin (read from the rendered preview).
 */
const STATIC_EXPORT = Object.freeze({
  sortContainerSelector: ".mdSortableTable-table-container",
  sortTableSelector: "table.mdSortableTable-data-table",
  sortButtonSelector: "button.mdSortableTable-sort-button",
  sortAnnouncerSelector: "#sortable-table-announcements",
  sourceTableSelector: "table.sortable-table",
  // The sorter's own caption, which says the table is sortable
  generatedCaptionPattern: /^Table with (\d+) rows and (\d+) columns/,
  copyButtonSelector: "button.code-copy-button",
  codeContainerClass: "code-block-container",
  codeOriginalAttribute: "data-original-code",
  tabWrapperSelector: ".tabs-tabs-wrapper",
  tabHeaderSelector: ":scope > .tabs-tabs-header",
  tabPanelHolderSelector: ":scope > .tabs-tabs-container",
  tabButtonSelector: "[role='tab']",
  tabPanelSelector: "[role='tabpanel']",
  tabSectionsClass: "md-export-tab-sections",
  tabSectionClass: "md-export-tab-section",
  headingSelector: "h1, h2, h3, h4, h5, h6",
  // Headings that belong to a figure or a description, not to the document outline
  outlineExcludedSelector: "details, figure, table, .mermaid-container, .chart-container",
  hiddenTextClass: "sr-only",
  // Chart containers: the chart step (chart-export-utils.js) has already run on
  // this copy, so a container with a picture is one it exported.
  chartContainerSelector: ".chart-container",
  chartControlsSelector: ".chart-view-controls",
  chartCanvasSelector: "canvas",
  chartPictureSelector: "img.chart-export-image",
  diagramContainerSelector: ".mermaid-container",
  // MRC-85: typeset maths, and the pairing attribute the editor's accessibility pass sets
  mathContainerSelector: "mjx-container",
  mathIndexAttribute: "data-math-index",
  htmlTarget: "html",
});

/** The delimiters MATHS_PROBE (scorm-builder) and MathJax both accept. */
const MATH_DELIMITERS = Object.freeze({
  inline: Object.freeze({ open: "\\(", close: "\\)" }),
  display: Object.freeze({ open: "\\[", close: "\\]" }),
});

/** Plain wording left where a chart could not be exported as a picture. */
const CHART_NOT_INCLUDED_NOTE = "This chart is not included in the exported page.";

/** Heading levels for a tab set's labels. */
const TAB_HEADING = Object.freeze({ DEFAULT_LEVEL: 2, MAX_LEVEL: 6 });

/**
 * Off-screen host for typesetting recovered table rows. Laid out, not
 * display:none, because MathJax CHTML needs a layout box to size itself.
 */
const TYPESET_HOST_STYLE =
  "position:absolute;left:-20000px;top:0;width:1200px;visibility:hidden;";

/**
 * Prism token colours, copied from the app's own rules (read, never edited):
 * light.css and dark.css, `@layer vendor-prism`, the custom properties block
 * (HEAD 2731958: light.css:6657-6669, dark.css:7290-7302) and the
 * `pre[class*="language-"]` border (light.css:2780, dark.css:2811). The rule
 * shapes below are the same in both sheets; only the values differ.
 */
const PRISM_COLOURS = Object.freeze({
  light: Object.freeze({
    background: "hsla(40, 100%, 99%, 1)",
    noToken: "hsla(0, 0%, 33%, 1)",
    comment: "hsla(16, 100%, 25%, 1)",
    blue: "hsla(195, 100%, 30%, 1)",
    green: "hsla(120, 100%, 25%, 1)",
    gray: "hsla(0, 0%, 41%, 1)",
    purple: "hsla(282, 100%, 41%, 1)",
    red: "hsla(2, 80%, 47%, 1)",
    yellow: "hsla(43, 74%, 30%, 1)",
    border: "#00131d",
  }),
  dark: Object.freeze({
    background: "hsla(345, 6%, 13%, 1)",
    noToken: "hsla(60, 30%, 96%, 1)",
    comment: "hsla(54, 32%, 75%, 1)",
    blue: "hsla(180, 100%, 44%, 1)",
    green: "hsla(80, 75%, 55%, 1)",
    gray: "hsla(60, 30%, 96%, 1)",
    purple: "hsla(291, 30%, 83%, 1)",
    red: "hsla(17, 100%, 74%, 1)",
    yellow: "hsla(51, 100%, 50%, 1)",
    border: "#9fb1bd",
  }),
});

const PRISM_VAR = "--md-export-prism-";

function prismVariables(colours) {
  return Object.entries(colours)
    .map(([name, value]) => `  ${PRISM_VAR}${name}: ${value};`)
    .join("\n");
}

/**
 * Head CSS for code blocks: the token colours for the mode the exported page's
 * own switch shows (`data-theme` on <html>; none means light), the same rule
 * shape the Mermaid and chart copies use. Under forced colours the app's own
 * system-colour mapping applies.
 */
const STATIC_EXPORT_HEAD = `<style>
html:not([data-theme="dark"]) {
${prismVariables(PRISM_COLOURS.light)}
}
html[data-theme="dark"] {
${prismVariables(PRISM_COLOURS.dark)}
}
@media (forced-colors: active) {
  html, html[data-theme="dark"] {
    ${PRISM_VAR}background: Canvas;
    ${PRISM_VAR}noToken: CanvasText;
    ${PRISM_VAR}comment: GrayText;
    ${PRISM_VAR}blue: LinkText;
    ${PRISM_VAR}gray: LinkText;
    ${PRISM_VAR}green: CanvasText;
    ${PRISM_VAR}purple: CanvasText;
    ${PRISM_VAR}red: CanvasText;
    ${PRISM_VAR}yellow: GrayText;
    ${PRISM_VAR}border: CanvasText;
  }
}
html pre[class*="language-"],
html pre[class*="language-"] > code[class*="language-"] {
  color: var(${PRISM_VAR}noToken);
  background: var(${PRISM_VAR}background);
}
html pre[class*="language-"] {
  border: 1px solid var(${PRISM_VAR}border);
}
/* The app's token rules, in the app's order. Every group is wrapped in :where()
   as the app wraps it, so the groups tie on specificity and the later group wins
   where a token matches two (a CSS string ends green, a keyword purple), exactly
   as in the app. Punctuation is not wrapped in the app either. */
html pre[class*="language-"] :where(.token.comment, .token.prolog, .token.doctype, .token.cdata) {
  color: var(${PRISM_VAR}comment);
}
html pre[class*="language-"] .token.punctuation {
  color: var(${PRISM_VAR}gray);
}
html pre[class*="language-"] :where(.token.property, .token.tag, .token.constant, .token.symbol, .token.deleted) {
  color: var(${PRISM_VAR}red);
}
html pre[class*="language-"] :where(.token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string, .token.variable, .token.keyword) {
  color: var(${PRISM_VAR}blue);
}
html pre[class*="language-"] :where(.token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted) {
  color: var(${PRISM_VAR}green);
}
html pre[class*="language-"] :where(.token.atrule, .token.attr-value, .token.function, .token.regex, .token.important) {
  color: var(${PRISM_VAR}yellow);
}
html pre[class*="language-"] :where(.token.boolean, .token.number, .token.keyword) {
  color: var(${PRISM_VAR}purple);
}
html pre[class*="language-"] :where(.token.important, .token.bold) {
  font-weight: bold;
}
html pre[class*="language-"] .token.italic {
  font-style: italic;
}
@media (forced-colors: active) {
  html pre[class*="language-"] :where(.token.boolean, .token.number, .token.keyword) {
    font-weight: bold;
  }
}
</style>`;

// ---------------------------------------------------------------------------
// Source tables: every row, recovered from the markdown
// ---------------------------------------------------------------------------

/**
 * Render each markdown table in the source on its own, in document order, from
 * the token stream. md.parse runs no renderer, and only the tokens between a
 * table_open and its table_close are rendered, so no diagram or chart fence is
 * ever drawn. Returns the tables the sorter would have enhanced (a thead and a
 * tbody), each as a detached element.
 *
 * @param {Object} source - { markdown, md, protectMath, restoreMath }
 * @returns {HTMLTableElement[]|null} null when the source cannot be read
 */
function readSourceTables(source) {
  if (
    !source ||
    typeof source.markdown !== "string" ||
    !source.md ||
    typeof source.protectMath !== "function" ||
    typeof source.restoreMath !== "function"
  ) {
    return null;
  }
  try {
    const { text, mathMap } = source.protectMath(source.markdown);
    const env = { mathMap };
    const tokens = source.md.parse(text, env);
    const tables = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "table_open") continue;
      let depth = 0;
      let end = i;
      for (let j = i; j < tokens.length; j++) {
        if (tokens[j].type === "table_open") depth++;
        if (tokens[j].type === "table_close") depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
      const html = source.restoreMath(
        source.md.renderer.render(tokens.slice(i, end + 1), source.md.options, env),
        mathMap
      );
      const template = document.createElement("template");
      template.innerHTML = html;
      const table = template.content.querySelector("table");
      if (table && table.querySelector("thead") && table.querySelector("tbody")) {
        tables.push(table);
      }
      i = end;
    }
    return tables;
  } catch (error) {
    logWarn("[Static Export] Could not read the source tables:", error);
    return null;
  }
}

/**
 * Typeset the maths in the given source tables, in an off-screen host outside
 * the preview, then lift each table back out. The host is cleared from
 * MathJax's list and removed before this returns.
 */
async function typesetSourceTables(tables, fixMaths) {
  if (!tables.length) return;
  const mathJax = window.MathJax;
  if (!mathJax || typeof mathJax.typesetPromise !== "function") return;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("style", TYPESET_HOST_STYLE);
  tables.forEach((table) => host.appendChild(table));
  document.body.appendChild(host);
  try {
    await mathJax.typesetPromise([host]);
    if (typeof fixMaths === "function") fixMaths(host);
  } catch (error) {
    logWarn("[Static Export] Typesetting the recovered rows failed:", error);
  } finally {
    if (typeof mathJax.typesetClear === "function") mathJax.typesetClear([host]);
    tables.forEach((table) => table.remove());
    host.remove();
  }
}

// ---------------------------------------------------------------------------
// 0. Typeset equations go back to their own TeX (MRC-85 HTML, MRC-89 SCORM)
// ---------------------------------------------------------------------------

/**
 * The standalone HTML builder stores offline maths (SVG plus Read Aloud speech)
 * only when it finds TeX delimiters in the page it is handed, and the preview's
 * HTML holds typeset containers instead. So each equation outside a sortable
 * table is replaced by the author's own TeX, taken from MathJax's math items on
 * the live page, so the builder typesets it itself. MRC-89: this applies to the
 * SCORM target as well, as MathPix's SCORM export does (its builder bundles
 * MathJax and typesets the TeX at run time), so both tools give the same
 * equation markup. Equations in a sortable table are handled by the table step,
 * from the markdown source.
 *
 * The one-for-one pairing is proved before anything is written: the counts must
 * agree and, where both sides carry the editor's data-math-index, so must each
 * pair. Any disagreement leaves every equation typeset, as before.
 *
 * @returns {{ restored: number, skipped: string|null }}
 */
function restoreTexFromLiveMaths(content, options) {
  const outcome = { restored: 0, skipped: null };
  const liveRoot = options.liveRoot;
  const mathDocument = window.MathJax && window.MathJax.startup && window.MathJax.startup.document;
  if (!liveRoot || !mathDocument || typeof mathDocument.getMathItemsWithin !== "function") {
    outcome.skipped = "no live maths items";
    return outcome;
  }
  const outsideTables = (node) => !node || !node.closest(STATIC_EXPORT.sortContainerSelector);
  const containers = Array.from(content.querySelectorAll(STATIC_EXPORT.mathContainerSelector)).filter(
    outsideTables
  );
  if (!containers.length) return outcome;
  const items = mathDocument
    .getMathItemsWithin(liveRoot)
    .filter((item) => outsideTables(item.typesetRoot));
  if (items.length !== containers.length) {
    outcome.skipped = `${containers.length} equations in the copy, ${items.length} maths items on the page`;
    return outcome;
  }
  const pairs = containers.map((container, index) => [container, items[index]]);
  const disagree = pairs.some(([container, item]) => {
    const copyIndex = container.getAttribute(STATIC_EXPORT.mathIndexAttribute);
    const liveIndex = item.typesetRoot && item.typesetRoot.getAttribute(STATIC_EXPORT.mathIndexAttribute);
    return copyIndex !== null && liveIndex !== null && copyIndex !== liveIndex;
  });
  if (disagree) {
    outcome.skipped = "an equation in the copy does not pair with the page's maths item";
    return outcome;
  }
  pairs.forEach(([container, item]) => {
    const { open, close } = item.display ? MATH_DELIMITERS.display : MATH_DELIMITERS.inline;
    // A text node, so "<", ">" and "&" inside the TeX are escaped on serialising
    container.replaceWith(document.createTextNode(`${open}${item.math}${close}`));
  });
  outcome.restored = pairs.length;
  return outcome;
}

// ---------------------------------------------------------------------------
// 1. Sortable tables become plain tables
// ---------------------------------------------------------------------------

function cellsOf(row, tag) {
  return Array.from(row.children).filter((cell) => cell.tagName.toLowerCase() === tag);
}

/** The header cell's own content: the sort button's first span, without the icon or the "sortable" text. */
function staticHeaderCell(liveTh) {
  const th = document.createElement("th");
  th.setAttribute("scope", "col");
  const button = liveTh.querySelector(STATIC_EXPORT.sortButtonSelector);
  const content = button ? button.firstElementChild : null;
  if (content) {
    while (content.firstChild) th.appendChild(content.firstChild);
  } else {
    while (liveTh.firstChild) th.appendChild(liveTh.firstChild);
  }
  return th;
}

function bodyRow(cellHtmlList) {
  const tr = document.createElement("tr");
  cellHtmlList.forEach((html) => {
    const td = document.createElement("td");
    td.innerHTML = html;
    tr.appendChild(td);
  });
  return tr;
}

/**
 * Plan each sortable table in the copy: how many rows it has (from the sorter's
 * caption), how many the copy holds, and the source table paired with it.
 * Pairing is by order, and a pair stands only when its header count and row
 * count both agree; anything else keeps the rows the copy has.
 */
function planTables(containers, sourceTables) {
  const paired = sourceTables && sourceTables.length === containers.length;
  if (sourceTables && !paired) {
    logWarn(
      `[Static Export] ${containers.length} sortable tables against ${sourceTables.length} in the source - rows and captions taken from the copy only`
    );
  }
  return containers.map((container, index) => {
    const table = container.querySelector(STATIC_EXPORT.sortTableSelector);
    if (!table) return null;
    const headerRow = table.querySelector("thead tr");
    const columns = headerRow ? cellsOf(headerRow, "th").length : 0;
    const bodyRows = Array.from(table.querySelectorAll("tbody > tr"));
    const caption = table.querySelector("caption");
    const match = caption
      ? caption.textContent.trim().match(STATIC_EXPORT.generatedCaptionPattern)
      : null;
    const totalRows = match ? Number(match[1]) : bodyRows.length;
    let source = paired ? sourceTables[index] : null;
    if (source) {
      const sourceHeader = source.querySelector("thead tr");
      const sourceColumns = sourceHeader ? sourceHeader.children.length : 0;
      const sourceRows = source.querySelectorAll("tbody > tr").length;
      if (sourceColumns !== columns || sourceRows !== totalRows) {
        logWarn(
          `[Static Export] Table ${index + 1}: source has ${sourceRows} rows and ${sourceColumns} columns, copy says ${totalRows} and ${columns} - source not used`
        );
        source = null;
      }
    }
    return { container, table, headerRow, bodyRows, totalRows, columns, source };
  });
}

/** The source table's own caption text, if the author wrote one. */
function authorCaption(source) {
  const caption = source && source.querySelector("caption");
  return caption ? caption.textContent.trim() : "";
}

/**
 * Each table's caption: the author's, else its size. Captions that repeat are
 * told apart by the table's place in the document, because the export builder
 * names each table's scroll region by its caption, and two regions with one
 * name cannot be told apart (axe landmark-unique, MRC-79).
 */
function captionTexts(plans) {
  const texts = plans.map((plan) =>
    plan
      ? authorCaption(plan.source) ||
        `Table with ${plan.totalRows} rows and ${plan.columns} columns`
      : null
  );
  const seen = new Map();
  texts.forEach((text) => text && seen.set(text, (seen.get(text) || 0) + 1));
  return texts.map((text, index) =>
    text && seen.get(text) > 1 ? `${text} (table ${index + 1})` : text
  );
}

function staticTable(plan, captionText) {
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.className = STATIC_EXPORT.hiddenTextClass;
  caption.textContent = captionText;
  table.appendChild(caption);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  if (plan.texFromSource) {
    // MRC-85 (HTML target): the author's own TeX, not the sorter's typeset copies
    cellsOf(plan.source.querySelector("thead tr"), "th").forEach((sourceTh) => {
      const th = document.createElement("th");
      th.setAttribute("scope", "col");
      th.innerHTML = sourceTh.innerHTML;
      headRow.appendChild(th);
    });
  } else if (plan.headerRow) {
    cellsOf(plan.headerRow, "th").forEach((th) => headRow.appendChild(staticHeaderCell(th)));
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  // The copy's own rows when it has them all (they are what the preview showed,
  // in the preview's order); the source's rows when the sorter held some back.
  const tbody = document.createElement("tbody");
  const useSource =
    plan.source && (plan.texFromSource || plan.bodyRows.length < plan.totalRows);
  const rows = useSource
    ? Array.from(plan.source.querySelectorAll("tbody > tr"))
    : plan.bodyRows;
  rows.forEach((row) => tbody.appendChild(bodyRow(cellsOf(row, "td").map((td) => td.innerHTML))));
  table.appendChild(tbody);

  if (!useSource && plan.bodyRows.length < plan.totalRows) {
    logWarn(
      `[Static Export] A table exports ${plan.bodyRows.length} of ${plan.totalRows} rows: its source could not be paired`
    );
  }
  return table;
}

async function makeTablesStatic(content, options) {
  const containers = Array.from(content.querySelectorAll(STATIC_EXPORT.sortContainerSelector));
  content.querySelectorAll(STATIC_EXPORT.sortAnnouncerSelector).forEach((node) => node.remove());
  if (!containers.length) return 0;

  const sourceTables = readSourceTables(options.source);
  const plans = planTables(containers, sourceTables);
  const htmlTarget = options.target === STATIC_EXPORT.htmlTarget;
  // MRC-85 (HTML) and MRC-89 (SCORM): a table holding typeset maths takes its
  // header and rows from the markdown source as TeX, for both targets. Without a
  // source that matched, it stays as typeset.
  plans.forEach((plan, index) => {
    if (!plan || !plan.container.querySelector(STATIC_EXPORT.mathContainerSelector)) return;
    if (plan.source) plan.texFromSource = true;
    else logWarn(`[Static Export] Table ${index + 1} holds maths but has no matched source - left typeset`);
  });
  // Recovered rows are left as TeX where the table was taken from source, so
  // there is nothing to typeset there. The HTML target never typesets rows; the
  // SCORM target still does for a table with no maths in its copy.
  const needRows = htmlTarget
    ? []
    : plans
        .filter(
          (plan) => plan && plan.source && !plan.texFromSource && plan.bodyRows.length < plan.totalRows
        )
        .map((plan) => plan.source);
  await typesetSourceTables(needRows, options.source && options.source.fixMaths);

  const captions = captionTexts(plans);
  let done = 0;
  plans.forEach((plan, index) => {
    if (!plan) return;
    plan.container.replaceWith(staticTable(plan, captions[index]));
    done++;
  });
  return done;
}

// ---------------------------------------------------------------------------
// 2. Code blocks lose the copy button
// ---------------------------------------------------------------------------

function makeCodeStatic(content) {
  const buttons = content.querySelectorAll(STATIC_EXPORT.copyButtonSelector);
  buttons.forEach((button) => button.remove());
  content.querySelectorAll(`.${STATIC_EXPORT.codeContainerClass}`).forEach((pre) => {
    pre.classList.remove(STATIC_EXPORT.codeContainerClass);
    if (!pre.getAttribute("class")) pre.removeAttribute("class");
    pre.removeAttribute(STATIC_EXPORT.codeOriginalAttribute);
  });
  return buttons.length;
}

// ---------------------------------------------------------------------------
// 3. Tabs become headed sections
// ---------------------------------------------------------------------------

/** One level below the nearest outline heading before `node`, never deeper than h6. */
function headingLevelBefore(content, node) {
  const headings = Array.from(content.querySelectorAll(STATIC_EXPORT.headingSelector)).filter(
    (heading) =>
      !heading.closest(STATIC_EXPORT.outlineExcludedSelector) &&
      heading.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING &&
      !heading.contains(node)
  );
  const last = headings[headings.length - 1];
  if (!last) return TAB_HEADING.DEFAULT_LEVEL;
  return Math.min(Number(last.tagName.slice(1)) + 1, TAB_HEADING.MAX_LEVEL);
}

function makeTabsStatic(content) {
  const wrappers = Array.from(content.querySelectorAll(STATIC_EXPORT.tabWrapperSelector));
  let done = 0;
  // Document order: an outer set is converted before any set inside it, so an
  // inner set's labels sit one level below the outer set's.
  wrappers.forEach((wrapper) => {
    const header = wrapper.querySelector(STATIC_EXPORT.tabHeaderSelector);
    const holder = wrapper.querySelector(STATIC_EXPORT.tabPanelHolderSelector);
    if (!header || !holder) return;
    const tabs = Array.from(header.querySelectorAll(STATIC_EXPORT.tabButtonSelector));
    const panels = Array.from(holder.children).filter((panel) =>
      panel.matches(STATIC_EXPORT.tabPanelSelector)
    );
    if (!tabs.length || tabs.length !== panels.length) {
      logWarn(`[Static Export] A tab set with ${tabs.length} tabs and ${panels.length} panels was left as it was`);
      return;
    }

    const level = headingLevelBefore(content, wrapper);
    const sections = document.createElement("div");
    sections.className = STATIC_EXPORT.tabSectionsClass;
    tabs.forEach((tab, index) => {
      const controlled = tab.getAttribute("aria-controls");
      const panel = panels.find((p) => controlled && p.id === controlled) || panels[index];
      const section = document.createElement("section");
      section.className = STATIC_EXPORT.tabSectionClass;
      if (panel.id) section.id = panel.id;
      const heading = document.createElement(`h${level}`);
      while (tab.firstChild) heading.appendChild(tab.firstChild);
      section.appendChild(heading);
      while (panel.firstChild) section.appendChild(panel.firstChild);
      sections.appendChild(section);
    });
    wrapper.replaceWith(sections);
    done++;
  });
  return done;
}

// ---------------------------------------------------------------------------
// 4. A chart with no picture loses its dead toolbar
// ---------------------------------------------------------------------------

/**
 * A chart container the chart step left without a picture (a chart in a tab
 * panel that was never shown, or a hand-written wrapper whose fence was never
 * parsed) still carries the preview's toolbar, whose buttons do nothing here.
 * Remove the toolbar. Where a blank canvas is left, replace it with one plain
 * sentence saying so; where only the author's text is left, keep it as written.
 * A container that holds a picture is not touched.
 */
function makeChartsWithoutPicturesStatic(content) {
  let done = 0;
  content.querySelectorAll(STATIC_EXPORT.chartContainerSelector).forEach((container) => {
    if (container.closest(STATIC_EXPORT.diagramContainerSelector)) return;
    if (container.querySelector(STATIC_EXPORT.chartPictureSelector)) return;
    container
      .querySelectorAll(STATIC_EXPORT.chartControlsSelector)
      .forEach((controls) => controls.remove());
    container.querySelectorAll(STATIC_EXPORT.chartCanvasSelector).forEach((canvas) => {
      const note = document.createElement("p");
      note.textContent = CHART_NOT_INCLUDED_NOTE;
      canvas.replaceWith(note);
    });
    done++;
  });
  return done;
}

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

/**
 * Make the export copy static: tabs into headed sections first (so a table or
 * code block inside a panel is reached in the same pass), then tables, then
 * code blocks.
 *
 * @param {string} html - The export copy's inner HTML (after the Mermaid and chart steps)
 * @param {Object} [options]
 * @param {Object} [options.source] - { markdown, md, protectMath, restoreMath, fixMaths }
 *   from the editor, used only to recover table rows and captions (and the TeX
 *   of equations in a sortable table)
 * @param {string} [options.target] - "html" or "scorm". Both get TeX back (MRC-85, MRC-89)
 * @param {Element} [options.liveRoot] - the live preview, whose maths items give the TeX
 * @returns {Promise<string>} The static copy's inner HTML
 */
export async function makeExportStatic(html, options = {}) {
  if (!html) return html;
  try {
    const template = document.createElement("template");
    template.innerHTML = html;
    const content = template.content;
    // MRC-85 (HTML) and MRC-89 (SCORM), FIRST: the copy still pairs one-for-one
    // with the page's maths items here, before tabs and tables move or rebuild
    // anything. It runs inside this step so the builder sees the finished page
    // (nothing may alter the export after buildStandaloneHtml returns).
    const maths = restoreTexFromLiveMaths(content, options);
    if (maths.skipped) logWarn(`[Static Export] Equations left typeset: ${maths.skipped}`);
    const tabs = makeTabsStatic(content);
    const tables = await makeTablesStatic(content, options);
    const copyButtons = makeCodeStatic(content);
    const bareCharts = makeChartsWithoutPicturesStatic(content);
    logInfo(
      `[Static Export] ${tabs} tab sets, ${tables} tables, ${copyButtons} copy buttons, ${bareCharts} charts without a picture made static, ${maths.restored} equations restored to TeX`
    );
    logDebug("[Static Export] Done");
    return template.innerHTML;
  } catch (error) {
    logError("[Static Export] Failed - the copy is exported as it was:", error);
    return html;
  }
}

/** Head CSS for the static copy (code token colours for both site modes). */
export function getStaticExportHead() {
  return STATIC_EXPORT_HEAD;
}

export { STATIC_EXPORT, STATIC_EXPORT_HEAD, PRISM_COLOURS, CHART_NOT_INCLUDED_NOTE };
