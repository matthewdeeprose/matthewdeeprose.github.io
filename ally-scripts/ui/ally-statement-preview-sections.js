/**
 * @fileoverview Ally Statement Preview - Section Registry & Renderers (IIFE)
 * @module AllyStatementPreviewSections
 * @version 1.0.0
 * @since Phase 7B (section-registry architecture)
 *
 * @description
 * Declarative registry for statement-preview section types. Each section type
 * is a single entry in RENDERERS keyed by `spec.type`; adding a new type means
 * adding one renderer, not editing renderPreview / buildCopyFragment /
 * serialiseToText / the docx serialiser separately.
 *
 * Two seams keep new types cheap:
 *  - RENDER seam  — RENDERERS[type](spec, ctx) returns a top-level <section>.
 *  - EXPORT seam  — every rendered root is stamped with `data-sp-section` and
 *                   `data-sp-export` markers so the copy/text/HTML/Word export
 *                   pipeline can include it generically (see the controller's
 *                   buildCopyFragment and serialiseToText, and the docx module).
 *
 * This module also exposes `window.ALLY_SP_DOM` (createElement / escapeHtml) so
 * the registry and the controller share one DOM-helper implementation. The
 * helpers are copied faithfully from ally-statement-preview.js; the controller
 * may converge on window.ALLY_SP_DOM in a later phase.
 *
 * MUST load before ally-statement-preview.js (the controller consumes the
 * registry). See tools.html script order.
 *
 * @example
 * const el = ALLY_STATEMENT_PREVIEW_SECTIONS.render(spec, {
 *   createElement: window.ALLY_SP_DOM.createElement,
 *   tokens: ALLY_STATEMENT_PREVIEW_CONFIG.getTokens("soton-blackboard"),
 * });
 */

const ALLY_STATEMENT_PREVIEW_SECTIONS = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
  // ========================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[AllyStatementSections] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyStatementSections] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyStatementSections] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyStatementSections] " + message, ...args);
  }

  // ========================================================================
  // Shared DOM helpers (window.ALLY_SP_DOM)
  // ========================================================================

  /**
   * Creates an HTML element with attributes.
   *
   * Copied faithfully from ally-statement-preview.js so the registry and the
   * controller share one implementation. Supports: className, dataset,
   * aria* (camelCase → kebab-case), onclick / onkeydown, and plain attributes.
   * Children may be a string (textContent), an array (mixed strings / Nodes),
   * or a single Node.
   *
   * @param {string} tag - Element tag name
   * @param {Object} [attrs] - Attributes to set
   * @param {string|Array|Node} [children] - Text, child elements, or a node
   * @returns {HTMLElement}
   */
  function createElement(tag, attrs, children) {
    const el = document.createElement(tag);

    if (attrs) {
      for (const key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          if (key === "className") {
            el.className = attrs[key];
          } else if (key === "dataset") {
            for (const dataKey in attrs[key]) {
              if (Object.prototype.hasOwnProperty.call(attrs[key], dataKey)) {
                el.dataset[dataKey] = attrs[key][dataKey];
              }
            }
          } else if (key.startsWith("aria")) {
            // Convert camelCase to kebab-case for ARIA attributes
            const ariaAttr = key.replace(/([A-Z])/g, "-$1").toLowerCase();
            el.setAttribute(ariaAttr, attrs[key]);
          } else if (key === "onclick" || key === "onkeydown") {
            // Event handlers
            el[key] = attrs[key];
          } else {
            el.setAttribute(key, attrs[key]);
          }
        }
      }
    }

    if (children !== undefined && children !== null) {
      if (typeof children === "string") {
        el.textContent = children;
      } else if (Array.isArray(children)) {
        children.forEach(function (child) {
          if (child) {
            if (typeof child === "string") {
              el.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
              el.appendChild(child);
            }
          }
        });
      } else if (children instanceof Node) {
        el.appendChild(children);
      }
    }

    return el;
  }

  /**
   * Escapes HTML entities for safe display.
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Publish shared helpers once. Do not clobber an existing instance (the
  // controller may publish its own in a later phase).
  if (typeof window !== "undefined" && !window.ALLY_SP_DOM) {
    window.ALLY_SP_DOM = {
      createElement: createElement,
      escapeHtml: escapeHtml,
    };
  }

  // ========================================================================
  // Export-marker stamping
  // ========================================================================

  /**
   * Stamps a rendered section root with the export markers the copy/export
   * pipeline iterates on, plus the optional category taxonomy:
   *  - data-sp-section  = the section type (iteration hook)
   *  - data-sp-export   = "include" (default) or "omit" when spec.export === false
   *  - data-sp-category = section role ("header" | "boilerplate" | "data"),
   *                       stamped only when spec.category is authored
   *  - data-sp-region   = "top" | "bottom" (boilerplate only), stamped only when
   *                       spec.region is authored
   *
   * The category/region markers are groundwork for showing/hiding whole section
   * roles on request; they are left unstamped when absent so un-categorised
   * sections (e.g. the error box) stay clean.
   *
   * Idempotent: existing markers are overwritten with the current values.
   *
   * @param {HTMLElement} el - The top-level section element
   * @param {Object} spec - The section spec
   * @returns {HTMLElement} The same element (for chaining)
   */
  function markExportable(el, spec) {
    if (!el || !el.setAttribute) return el;
    el.setAttribute("data-sp-section", spec && spec.type ? spec.type : "");
    el.setAttribute(
      "data-sp-export",
      spec && spec.export === false ? "omit" : "include",
    );
    if (spec && spec.category) el.setAttribute("data-sp-category", spec.category);
    if (spec && spec.region) el.setAttribute("data-sp-region", spec.region);
    return el;
  }

  // ========================================================================
  // Renderer registry
  // ========================================================================

  /**
   * Section renderers keyed by spec.type. Each renderer has the signature
   * (spec, ctx) => HTMLElement, returning a single top-level <section>.
   * `ctx` provides { createElement, tokens } (tokens is the resolved
   * master-settings map; see the config module).
   *
   * Populated incrementally: Phase 3 migrates intro/warning/success/error;
   * Phases 4–6 add info/linkButtons/courseInfo/group/video.
   *
   * @type {Object.<string, function(Object, Object): HTMLElement>}
   */
  const RENDERERS = {};

  /**
   * Registers a renderer for a section type. Warns (but allows) on override so
   * a reload / re-registration during development is visible, not silent.
   * @param {string} type - Section type id
   * @param {function(Object, Object): HTMLElement} renderer
   */
  function registerRenderer(type, renderer) {
    if (typeof type !== "string" || !type) {
      logError("registerRenderer: invalid type", type);
      return;
    }
    if (typeof renderer !== "function") {
      logError("registerRenderer: renderer is not a function for type", type);
      return;
    }
    if (RENDERERS[type]) {
      logWarn("Overriding existing renderer for type: " + type);
    }
    RENDERERS[type] = renderer;
    logDebug("Registered renderer: " + type);
  }

  /**
   * Renders a section spec to a top-level <section> element, stamped with the
   * export markers. Returns null (and warns) for an unknown or invalid type so
   * callers can filter with .filter(Boolean).
   *
   * @param {Object} spec - Section spec ({ type, id, heading, ... })
   * @param {Object} [ctx] - Render context ({ createElement, tokens })
   * @returns {HTMLElement|null}
   */
  function render(spec, ctx) {
    if (!spec || typeof spec.type !== "string") {
      logWarn("render: spec is missing a string `type`", spec);
      return null;
    }

    const renderer = RENDERERS[spec.type];
    if (!renderer) {
      logWarn("render: no renderer registered for type: " + spec.type);
      return null;
    }

    // Default context: use the shared createElement, no token map.
    const context = ctx || {};
    if (typeof context.createElement !== "function") {
      context.createElement = createElement;
    }

    let el;
    try {
      el = renderer(spec, context);
    } catch (error) {
      logError("render: renderer threw for type " + spec.type, error);
      return null;
    }

    if (el === null) {
      // A renderer may INTENTIONALLY return null to render nothing — e.g. a
      // group that self-collapses when none of its children are visible (see
      // renderGroup). That is an expected outcome, not a fault, so it is logged
      // at debug level only. A missing/`undefined` or non-Node return below is
      // still treated as a probable renderer bug and warned.
      logDebug("render: renderer for " + spec.type + " returned null (nothing to render)");
      return null;
    }

    if (!el || !(el instanceof Node)) {
      logWarn("render: renderer for " + spec.type + " did not return a Node");
      return null;
    }

    return markExportable(el, spec);
  }

  // ========================================================================
  // Built-in authored renderers
  // ========================================================================
  //
  // Authored (config-driven, not API-data) section types live here and
  // self-register at module load. Heading strategy: a top-level authored
  // section uses <h3> (→ <h1> on export via the controller's promoteHeadings);
  // sub-headings use <h4> (→ <h2>). All class names are structural only — no
  // colour (colour is deferred to the theme stylesheets).

  /**
   * Builds the lazy-YouTube embed wrapper (the `.videoWrapper` with its
   * `<lite-youtube>` and real `<a class="lty-playbtn">`), shared by the standalone
   * `video` section renderer and the info box's `{ video }` block so both embed
   * identically. Carries `data-export-text` / `data-export-href` so copy / text /
   * Word export degrade to a clean titled link (never a dead embed). The play
   * control's accessible name is "Play video: <title>". Does NOT include a heading
   * or caption — the caller supplies those.
   * @param {Object} spec - { youTubeId, title, poster?, href? }
   * @param {function} ce - createElement
   * @returns {HTMLElement} the `.videoWrapper` div
   */
  function buildVideoEmbed(spec, ce) {
    const youTubeId = (spec && spec.youTubeId) || "";
    const title = (spec && spec.title) || "";
    const href =
      (spec && spec.href) || (youTubeId ? "https://youtu.be/" + youTubeId : "#");
    const playLabel = "Play video: " + (title || "video");

    const wrapper = ce("div", {
      className: "videoWrapper",
      dataset: { exportText: playLabel, exportHref: href },
    });

    const liteAttrs = { videoid: youTubeId, playlabel: playLabel };
    if (spec && spec.poster) {
      liteAttrs.style = "background-image: url('" + spec.poster + "');";
    }
    const lite = ce("lite-youtube", liteAttrs);
    lite.appendChild(
      ce("a", { href: href, className: "lty-playbtn" }, [
        ce("span", { className: "lyt-visually-hidden" }, playLabel),
      ]),
    );
    wrapper.appendChild(lite);
    return wrapper;
  }

  /**
   * Renders one content block for an info column.
   * Supported blocks: {h4[,icon]}, {p}, {ul:[...]}, {ol:[...]},
   * {dl:[{term,definition}]}, {links:[{text,href,icon}]},
   * {video:{youTubeId,title,poster?,href?}}.
   * Authored content is trusted (from config), so inline HTML in {p}/{ul} and a
   * {dl} definition is allowed via innerHTML — matching the config's
   * renderListItems. A {video} block embeds a lazy YouTube player (shared with
   * the standalone `video` type via buildVideoEmbed); pair it with a text column
   * and `mediaLayout: true` on the box for a side-by-side text+video layout.
   *
   * The `h4` block renders at `subLevel` (h4 by default; a title-led statement
   * passes 5 so the sub-heading nests correctly under the box heading). An
   * optional `icon` on an `h4` block adds a decorative (aria-hidden) icon beside
   * the heading text; the icon carries no accessible name so the heading's text
   * stays clean for both export seams.
   * @param {Object} block
   * @param {function} ce - createElement
   * @param {number} [subLevel=4] - heading level for an {h4} block (1..6)
   * @returns {HTMLElement|null}
   */
  function renderInfoBlock(block, ce, subLevel) {
    if (!block || typeof block !== "object") return null;

    if (typeof block.h4 === "string") {
      const level =
        typeof subLevel === "number" && subLevel >= 1 && subLevel <= 6
          ? subLevel
          : 4;
      if (block.icon) {
        return ce(
          "h" + level,
          { className: "ally-sp-info-subheading" },
          [
            ce("span", {
              className: "ally-sp-info-subicon",
              ariaHidden: "true",
              dataset: { icon: block.icon },
            }),
            block.h4,
          ],
        );
      }
      return ce("h" + level, null, block.h4);
    }
    if (typeof block.p === "string") {
      const p = ce("p");
      p.innerHTML = block.p;
      return p;
    }
    if (typeof block.html === "string") {
      // Block-level trusted/pre-sanitised HTML (unlike {p}, a <div> so it can
      // hold block children — headings, lists, paragraphs). Used by card 6's
      // module-lead message, whose Markdown is rendered to safe HTML by
      // buildInclusionMessageHtml (html:false markdown-it; see Stage D). A
      // reusable primitive, not card-6-specific.
      const div = ce("div", { className: "ally-sp-info-richtext" });
      div.innerHTML = block.html;
      return div;
    }
    if (Array.isArray(block.ul)) {
      const ul = ce("ul");
      block.ul.forEach(function (item) {
        const li = ce("li");
        li.innerHTML = item;
        ul.appendChild(li);
      });
      return ul;
    }
    if (Array.isArray(block.ol)) {
      // Ordered list — use when the items have a meaningful sequence or count
      // (e.g. "you'll find: 1) … 2) …"). Same trusted-innerHTML item handling as
      // {ul}; the browser renders the numbers. Both export seams treat <ol> the
      // same as <ul> (bulleted/numbered lines follow from the tag).
      const ol = ce("ol");
      block.ol.forEach(function (item) {
        const li = ce("li");
        li.innerHTML = item;
        ol.appendChild(li);
      });
      return ol;
    }
    if (Array.isArray(block.dl)) {
      // Definition list (glossary): one <dt>/<dd> pair per item. The term is
      // plain text (textContent); the definition is trusted authored content
      // (innerHTML) so inline <a> etc. work, matching the {ul}/{p} blocks. The
      // <dt> is styled bold via CSS (.ally-sp-info-dl dt) — no <strong> needed.
      // Exports cleanly to both seams: "Term: definition" per pair (copy/text
      // and the docx collectDefinitionList walker).
      const dl = ce("dl", { className: "ally-sp-info-dl" });
      block.dl.forEach(function (item) {
        if (!item || (!item.term && !item.definition)) return;
        dl.appendChild(ce("dt", null, item.term || ""));
        const dd = ce("dd");
        dd.innerHTML = item.definition || "";
        dl.appendChild(dd);
      });
      return dl;
    }
    if (Array.isArray(block.links)) {
      const ul = ce("ul", { className: "ally-sp-info-links" });
      block.links.forEach(function (lnk) {
        if (!lnk || !lnk.href) return;
        const li = ce("li");
        li.appendChild(
          ce("a", { href: lnk.href }, [
            lnk.icon
              ? ce("span", {
                  className: "ally-sp-info-link-icon",
                  ariaHidden: "true",
                  dataset: { icon: lnk.icon },
                })
              : null,
            lnk.text || lnk.href,
          ]),
        );
        ul.appendChild(li);
      });
      return ul;
    }
    if (block.video && typeof block.video === "object") {
      // Lazy YouTube embed inside an info column (shared with the `video` type).
      return buildVideoEmbed(block.video, ce);
    }
    return null;
  }

  /**
   * Info box — a rectangular section (like a warning) with an optional icon and
   * one or two columns of blocks (headings, paragraphs, lists, links).
   *
   * The box heading defaults to <h3>; an optional `headingLevel` (threaded by
   * the controller from the layout's content level) renders it at that level
   * instead — e.g. 4 when the layout leads with a title section — and body
   * sub-headings ({h4} blocks) then render one level lower.
   * `mediaLayout: true` (with two columns) switches the body to a container-query
   * media split (text | media, collapsing on the card's own width) — used for a
   * text-beside-video box where one column holds a {video} block.
   * An optional `lead` (an array of blocks, same shapes as a column's `blocks`)
   * renders full-width BETWEEN the header and the columns — an intro that spans
   * both columns, so the two columns' first headings align (a two-column info box
   * otherwise starts each column at the top). It reuses the `.ally-sp-info-body`
   * block (indented under the heading, no grid), so no extra CSS is needed.
   * Spec: { type:"info", id, heading, icon?, headingLevel?, mediaLayout?, lead?:[...blocks], columns:[{blocks:[...]}] }
   */
  function renderInfo(spec, ctx) {
    const ce = ctx.createElement;
    const headingId = spec.id + "-heading";
    const hl =
      typeof spec.headingLevel === "number" &&
      spec.headingLevel >= 1 &&
      spec.headingLevel <= 6
        ? spec.headingLevel
        : 3;
    const subLevel = Math.min(6, hl + 1);

    const section = ce("section", {
      className: "ally-sp-info",
      ariaLabelledby: headingId,
    });

    const headerChildren = [];
    if (spec.icon) {
      headerChildren.push(
        ce("span", {
          className: "ally-sp-info-icon",
          ariaHidden: "true",
          dataset: { icon: spec.icon },
        }),
      );
    }
    headerChildren.push(ce("h" + hl, { id: headingId }, spec.heading || ""));
    section.appendChild(
      ce("div", { className: "ally-sp-info-header" }, headerChildren),
    );

    // Optional full-width lead: an intro that spans both columns, rendered as a
    // plain (non-grid) info body between the header and the columns. Reuses the
    // `.ally-sp-info-body` indent so its text aligns under the heading.
    const lead = Array.isArray(spec.lead) ? spec.lead : [];
    if (lead.length) {
      const leadEl = ce("div", {
        className: "ally-sp-info-body ally-sp-info-lead",
      });
      lead.forEach(function (block) {
        const el = renderInfoBlock(block, ce, subLevel);
        if (el) leadEl.appendChild(el);
      });
      section.appendChild(leadEl);
    }

    const columns = Array.isArray(spec.columns) ? spec.columns : [];
    const twoCol = columns.length > 1;
    // `mediaLayout: true` (with two columns) uses a container-query media split
    // (text | media, collapsing on the CARD's own width — see .ally-sp-info-body
    // --media in ally-main.css) instead of the viewport-based two-column grid.
    // Used for a text-beside-video box (the {video} block sits in one column).
    const layoutClass =
      spec.mediaLayout && twoCol
        ? " ally-sp-info-body--media"
        : twoCol
          ? " ally-sp-info-body--two-col"
          : "";
    const body = ce("div", {
      className: "ally-sp-info-body" + layoutClass,
    });

    columns.forEach(function (col) {
      const colEl = ce("div", { className: "ally-sp-info-col" });
      const blocks = (col && col.blocks) || [];
      blocks.forEach(function (block) {
        const el = renderInfoBlock(block, ce, subLevel);
        if (el) colEl.appendChild(el);
      });
      body.appendChild(colEl);
    });

    section.appendChild(body);
    return section;
  }

  /**
   * Button-styled link cards — a heading plus a grid of small cards, each with
   * an optional heading/body and a real <a> styled to LOOK like a button
   * (never a <button>/role="button" — these navigate). Two columns, collapsing
   * to one at narrow widths.
   *
   * A card may carry a decorative (aria-hidden) `icon` shown beside its heading
   * text (the same header relationship the info box uses) — distinct from the
   * link's own optional `icon`, which sits inside the button.
   * Spec: { type:"linkButtons", id, heading, columns?, cards:[
   *          { heading?, icon?, body?, link:{ text, href, icon? } } ] }
   */
  function renderLinkButtons(spec, ctx) {
    const ce = ctx.createElement;
    const headingId = spec.id + "-heading";
    // Honour the controller's heading-level threading (§4): the section heading
    // sits at `headingLevel` (4 when the layout leads with a title section, else
    // 3) and the card headings one level below, so the outline nests correctly
    // under the statement title. Mirrors renderInfo.
    const hl =
      typeof spec.headingLevel === "number" &&
      spec.headingLevel >= 1 &&
      spec.headingLevel <= 6
        ? spec.headingLevel
        : 3;
    const cardLevel = Math.min(6, hl + 1);

    const section = ce("section", {
      className: "ally-sp-linkbuttons",
      ariaLabelledby: headingId,
    });
    section.appendChild(ce("h" + hl, { id: headingId }, spec.heading || ""));

    const cards = Array.isArray(spec.cards) ? spec.cards : [];
    const twoCol = (spec.columns || 2) >= 2 && cards.length > 1;
    const grid = ce("ul", {
      className:
        "ally-sp-linkbutton-grid" +
        (twoCol ? " ally-sp-linkbutton-grid--two-col" : ""),
    });

    cards.forEach(function (card) {
      if (!card) return;
      const li = ce("li", { className: "ally-sp-linkbutton-card" });
      if (card.heading) {
        if (card.icon) {
          // Decorative icon beside the card heading text (aria-hidden, no
          // accessible name — the heading text carries the name).
          li.appendChild(
            ce(
              "h" + cardLevel,
              { className: "ally-sp-linkbutton-card-heading" },
              [
                ce("span", {
                  className: "ally-sp-linkbutton-card-icon",
                  ariaHidden: "true",
                  dataset: { icon: card.icon },
                }),
                card.heading,
              ],
            ),
          );
        } else {
          li.appendChild(ce("h" + cardLevel, null, card.heading));
        }
      }
      if (card.body) {
        const p = ce("p");
        p.innerHTML = card.body;
        li.appendChild(p);
      }
      if (card.link && card.link.href) {
        li.appendChild(
          ce("a", { className: "ally-sp-linkbutton", href: card.link.href }, [
            card.link.icon
              ? ce("span", {
                  className: "ally-sp-linkbutton-icon",
                  ariaHidden: "true",
                  dataset: { icon: card.link.icon },
                })
              : null,
            card.link.text || card.link.href,
          ]),
        );
      }
      grid.appendChild(li);
    });

    section.appendChild(grid);
    return section;
  }

  /**
   * Course-information section — a heading plus a dl/dt/dd list. A value may be
   * plain text, a mailto email link (with optional small inline icon), or a
   * generic link. Copies/exports via the shared `dl` primitive.
   *
   * Two shapes are supported:
   *  - Flat: `items` renders a single <dl>.
   *  - Grouped: `groups` renders one labelled sub-block per group (an <h4> plus
   *    its own <dl> and optional prose `notes`), sitting side-by-side when there
   *    is more than one group. Used by the statement header (Module Information /
   *    Module Lead).
   *
   * Item value resolution, in order: mailto (`email`), generic link (`href`), a
   * plain `value` (optionally wrapped in `<time datetime>` when `datetime` is
   * set), or — when none of those carry text — a fill-in `placeholder`.
   *
   * Spec: { type:"courseInfo", id, heading,
   *          items?:[ { label, value } | { label, email, icon? }
   *                 | { label, href, text?, icon? }
   *                 | { label, value, datetime? } | { label, placeholder, icon? } ],
   *          groups?:[ { heading, items:[…], notes?:[htmlString] } ] }
   */
  function renderCourseInfo(spec, ctx) {
    const ce = ctx.createElement;
    const headingId = spec.id + "-heading";

    const section = ce("section", {
      className: "ally-sp-courseinfo",
      ariaLabelledby: headingId,
    });
    section.appendChild(ce("h3", { id: headingId }, spec.heading || ""));

    function iconSpan(name) {
      return name
        ? ce("span", {
            className: "ally-sp-courseinfo-icon",
            ariaHidden: "true",
            dataset: { icon: name },
          })
        : null;
    }

    // A value counts as "present" only when it is a non-empty, non-whitespace
    // string — so a token that resolved to "" (e.g. an absent academic year)
    // falls through to the item's placeholder rather than an empty <dd>.
    function hasText(value) {
      return value != null && String(value).trim() !== "";
    }

    // Builds the <dd> for one item.
    function renderItemValue(item) {
      if (hasText(item.email)) {
        return ce("dd", null, [
          iconSpan(item.icon),
          ce("a", { href: "mailto:" + item.email }, item.email),
        ]);
      }
      if (hasText(item.href)) {
        return ce("dd", null, [
          iconSpan(item.icon),
          ce("a", { href: item.href }, item.text || item.href),
        ]);
      }
      if (hasText(item.value)) {
        if (item.datetime) {
          return ce(
            "dd",
            null,
            ce("time", { datetime: item.datetime }, String(item.value)),
          );
        }
        // Keep the item's icon when a plain value resolves (e.g. the Module
        // Lead name from {moduleLead}), matching the email/href/placeholder
        // branches so the icon doesn't vanish once the field is answered.
        return ce("dd", null, [iconSpan(item.icon), String(item.value)]);
      }
      if (hasText(item.placeholder)) {
        return ce("dd", null, [
          iconSpan(item.icon),
          ce("span", { className: "ally-sp-placeholder" }, item.placeholder),
        ]);
      }
      return ce("dd", null, "");
    }

    // Renders a <dl> from an items array (label -> dt, value -> dd).
    function renderList(items) {
      const dl = ce("dl", { className: "ally-sp-courseinfo-list" });
      (items || []).forEach(function (item) {
        if (!item || !item.label) return;
        dl.appendChild(ce("dt", null, item.label));
        dl.appendChild(renderItemValue(item));
      });
      return dl;
    }

    if (Array.isArray(spec.groups)) {
      // Grouped: each group is an <h4> sub-heading + its own <dl>, plus optional
      // prose notes. Two or more groups sit side-by-side (collapsing to one
      // column at narrow widths).
      const twoCol = spec.groups.length > 1;
      const body = ce("div", {
        className:
          "ally-sp-courseinfo-body" +
          (twoCol ? " ally-sp-courseinfo-body--two-col" : ""),
      });
      spec.groups.forEach(function (group) {
        if (!group) return;
        const hasGraphic = hasText(group.graphic);
        const groupEl = ce("div", {
          className:
            "ally-sp-courseinfo-group" +
            (hasGraphic ? " ally-sp-courseinfo-group--has-graphic" : ""),
        });
        if (hasText(group.heading)) {
          groupEl.appendChild(ce("h4", null, group.heading));
        }
        if (Array.isArray(group.items) && group.items.length) {
          groupEl.appendChild(renderList(group.items));
        }
        (group.notes || []).forEach(function (note) {
          if (!hasText(note)) return;
          // Trusted authored content (matches renderInfoBlock's {p}); lets a
          // resolved {lastRefreshed} token render as a real <time> element.
          const p = ce("p", { className: "ally-sp-courseinfo-note" });
          p.innerHTML = note;
          groupEl.appendChild(p);
        });
        if (hasGraphic) {
          // Decorative graphic (aria-hidden, no accessible name) sitting to the
          // right of the group at wide width; CSS hides it when the card is
          // narrow. Populated by IconLibrary after render.
          groupEl.appendChild(
            ce("span", {
              className: "ally-sp-courseinfo-graphic",
              ariaHidden: "true",
              dataset: { icon: group.graphic },
            }),
          );
        }
        body.appendChild(groupEl);
      });
      section.appendChild(body);
    } else {
      // Flat (unchanged behaviour): a single <dl> from spec.items.
      section.appendChild(renderList(spec.items));
    }

    return section;
  }

  /**
   * Demotes every heading in a detached subtree by `by` levels (h3→h4, …),
   * preserving attributes (incl. the id an aria-labelledby points at). Used by
   * the group renderer so nested child sections sit one level below the group
   * heading. Mirrors the controller's promoteHeadings, in the other direction.
   * @param {HTMLElement} root
   * @param {number} by
   */
  function demoteHeadings(root, by) {
    root.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(function (h) {
      const level = parseInt(h.tagName.charAt(1), 10);
      const newLevel = Math.min(6, level + by);
      if (newLevel === level) return;
      const repl = document.createElement("h" + newLevel);
      for (let i = 0; i < h.attributes.length; i++) {
        repl.setAttribute(h.attributes[i].name, h.attributes[i].value);
      }
      while (h.firstChild) repl.appendChild(h.firstChild);
      h.parentNode.replaceChild(repl, h);
    });
  }

  /**
   * Group — a wrapper section with one part heading above a set of child
   * sections rendered recursively. Child headings are demoted so the hierarchy
   * reads group → child (child heading = group heading + 1). The group is the
   * single top-level export unit; its children ride inside the export clone
   * (they are not direct children of the results container, so
   * buildCopyFragment's outermost-only pass does not double-emit them).
   *
   * The heading defaults to <h3>; an optional `headingLevel` (threaded by the
   * controller from the layout's content level — 4 under a title-first layout)
   * renders it at that level, and children are demoted to sit one below it.
   * An optional `icon` (icon-library name) renders a decorative icon beside the
   * heading text (aria-hidden; the text alone names the group).
   *
   * Conditional children + self-collapse: a child may carry a `showWhen` rule
   * evaluated by the controller-supplied `ctx.shouldShow(childSpec)` hook (when
   * absent, every child shows). A group left with NO visible children renders
   * NOTHING — heading included — by returning null, so an empty part never
   * shows a dangling heading.
   * Spec: { type:"group", id, heading, icon?, headingLevel?, children:[ ...specs ] }
   */
  function renderGroup(spec, ctx) {
    const ce = ctx.createElement;
    const hLevel =
      typeof spec.headingLevel === "number" &&
      spec.headingLevel >= 1 &&
      spec.headingLevel <= 6
        ? spec.headingLevel
        : 3;
    const headingId = spec.id + "-heading";

    const section = ce("section", {
      className: "ally-sp-group",
      ariaLabelledby: headingId,
    });

    // Part heading, optionally with a decorative icon beside the text (mirrors
    // the info box header relationship). Icon-less groups keep the plain heading.
    if (spec.icon) {
      section.appendChild(
        ce("div", { className: "ally-sp-group-header" }, [
          ce("span", {
            className: "ally-sp-group-icon",
            ariaHidden: "true",
            dataset: { icon: spec.icon },
          }),
          ce("h" + hLevel, { id: headingId }, spec.heading || ""),
        ]),
      );
    } else {
      section.appendChild(ce("h" + hLevel, { id: headingId }, spec.heading || ""));
    }

    // Children sit one heading level below the group heading.
    const demoteBy = hLevel - 2; // h3 group → 1 (child h4); h4 group → 2 (child h5)
    let shown = 0;
    (spec.children || []).forEach(function (childSpec) {
      // Show-rule (criteria wired by the controller): skip a hidden child.
      if (typeof ctx.shouldShow === "function" && !ctx.shouldShow(childSpec)) {
        return;
      }
      const childEl = render(childSpec, ctx);
      if (!childEl) return;
      if (demoteBy > 0) demoteHeadings(childEl, demoteBy);
      section.appendChild(childEl);
      shown++;
    });

    // Self-collapse: no visible child → the whole part (heading included) is
    // omitted. Returning null is honoured by the layout walk and the registry.
    if (shown === 0) return null;
    return section;
  }

  /**
   * Video section — a lazy YouTube embed via the self-hosted lite-youtube
   * custom element, with an optional heading and caption. The play control is a
   * REAL <a href> (keyboard-operable; navigates to YouTube when JS is off) with
   * a visually-hidden label lite-youtube reads for the button and the injected
   * iframe's title. The wrapper carries data-export-text / data-export-href so
   * copy and Word export become a clean titled link, never a dead embed.
   * Spec: { type:"video", id, heading?, body?, youTubeId, title, poster?, href? }
   */
  function renderVideo(spec, ctx) {
    const ce = ctx.createElement;
    const title = spec.title || "";
    const headingId = spec.id + "-heading";

    const sectionAttrs = { className: "ally-sp-video" };
    if (spec.heading) {
      sectionAttrs.ariaLabelledby = headingId;
    } else if (title) {
      sectionAttrs.ariaLabel = title;
    }
    const section = ce("section", sectionAttrs);

    if (spec.heading) {
      section.appendChild(ce("h3", { id: headingId }, spec.heading));
    }
    if (spec.body) {
      const caption = ce("p", { className: "ally-sp-video-caption" });
      caption.innerHTML = spec.body;
      section.appendChild(caption);
    }

    // The embed itself is shared with the info box's {video} block.
    section.appendChild(buildVideoEmbed(spec, ce));

    return section;
  }

  // Self-register the authored renderers at module load.
  registerRenderer("info", renderInfo);
  registerRenderer("linkButtons", renderLinkButtons);
  registerRenderer("courseInfo", renderCourseInfo);
  registerRenderer("group", renderGroup);
  registerRenderer("video", renderVideo);

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    /**
     * Renders a section spec to a stamped top-level <section>, or null.
     */
    render: render,

    /**
     * Registers a renderer for a section type.
     */
    registerRenderer: registerRenderer,

    /**
     * Stamps export markers on an element (exposed for tests / advanced use).
     */
    markExportable: markExportable,

    /**
     * Returns the list of registered section type ids.
     * @returns {Array.<string>}
     */
    getRegisteredTypes: function () {
      return Object.keys(RENDERERS);
    },

    /**
     * Whether a renderer is registered for the given type.
     * @param {string} type
     * @returns {boolean}
     */
    has: function (type) {
      return Object.prototype.hasOwnProperty.call(RENDERERS, type);
    },
  };
})();

// ========================================================================
// Console Test Function
// ========================================================================

window.testAllyStatementPreviewSections = function () {
  console.group("ALLY_STATEMENT_PREVIEW_SECTIONS Tests");

  let passed = 0;
  let failed = 0;

  function test(name, condition) {
    if (condition) {
      console.log("✓ " + name);
      passed++;
    } else {
      console.error("✗ " + name);
      failed++;
    }
  }

  // Module existence
  test(
    "ALLY_STATEMENT_PREVIEW_SECTIONS exists",
    typeof ALLY_STATEMENT_PREVIEW_SECTIONS === "object",
  );
  test(
    "has render method",
    typeof ALLY_STATEMENT_PREVIEW_SECTIONS.render === "function",
  );
  test(
    "has registerRenderer method",
    typeof ALLY_STATEMENT_PREVIEW_SECTIONS.registerRenderer === "function",
  );
  test(
    "has getRegisteredTypes method",
    typeof ALLY_STATEMENT_PREVIEW_SECTIONS.getRegisteredTypes === "function",
  );
  test(
    "has `has` method",
    typeof ALLY_STATEMENT_PREVIEW_SECTIONS.has === "function",
  );

  // Shared DOM helper published
  test("window.ALLY_SP_DOM exists", typeof window.ALLY_SP_DOM === "object");
  test(
    "ALLY_SP_DOM.createElement is a function",
    window.ALLY_SP_DOM &&
      typeof window.ALLY_SP_DOM.createElement === "function",
  );
  test(
    "ALLY_SP_DOM.escapeHtml is a function",
    window.ALLY_SP_DOM && typeof window.ALLY_SP_DOM.escapeHtml === "function",
  );

  // createElement behaviour (spot check)
  const el = window.ALLY_SP_DOM.createElement(
    "section",
    { className: "x", dataset: { icon: "warning" }, ariaLabel: "hi" },
    "text",
  );
  test("createElement sets className", el.className === "x");
  test("createElement sets dataset", el.dataset.icon === "warning");
  test(
    "createElement kebabs aria",
    el.getAttribute("aria-label") === "hi",
  );
  test("createElement sets text child", el.textContent === "text");

  // Registry is empty at Phase 1 (renderers land in later phases)
  test(
    "getRegisteredTypes returns an array",
    Array.isArray(ALLY_STATEMENT_PREVIEW_SECTIONS.getRegisteredTypes()),
  );

  // Unknown / invalid types return null (do not throw)
  test(
    "render(unknown type) returns null",
    ALLY_STATEMENT_PREVIEW_SECTIONS.render({ type: "definitely-not-real" }) ===
      null,
  );
  test(
    "render(no type) returns null",
    ALLY_STATEMENT_PREVIEW_SECTIONS.render({}) === null,
  );
  test(
    "render(null) returns null",
    ALLY_STATEMENT_PREVIEW_SECTIONS.render(null) === null,
  );

  // registerRenderer + render round-trip with a throwaway type
  ALLY_STATEMENT_PREVIEW_SECTIONS.registerRenderer(
    "__test__",
    function (spec, ctx) {
      return ctx.createElement("section", {}, spec.heading || "");
    },
  );
  test(
    "has('__test__') true after register",
    ALLY_STATEMENT_PREVIEW_SECTIONS.has("__test__") === true,
  );
  const rendered = ALLY_STATEMENT_PREVIEW_SECTIONS.render({
    type: "__test__",
    heading: "Hello",
    export: false,
  });
  test("render(registered) returns an element", rendered instanceof Node);
  test(
    "render stamps data-sp-section",
    rendered && rendered.getAttribute("data-sp-section") === "__test__",
  );
  test(
    "render stamps data-sp-export=omit when export:false",
    rendered && rendered.getAttribute("data-sp-export") === "omit",
  );
  const rendered2 = ALLY_STATEMENT_PREVIEW_SECTIONS.render({
    type: "__test__",
    heading: "Hi",
  });
  test(
    "render stamps data-sp-export=include by default",
    rendered2 && rendered2.getAttribute("data-sp-export") === "include",
  );

  console.log("\n" + passed + " passed, " + failed + " failed");
  console.groupEnd();

  return failed === 0;
};

// ========================================================================
// Demo specs & console helpers (style the new section types before wiring
// real content). Render one example of a type into #ally-sp-results.
// ========================================================================

window.ALLY_SP_DEMO_SPECS = {
  info: {
    type: "info",
    id: "demo-info",
    heading: "An inclusive experience",
    icon: "infoCircle",
    lead: [
      {
        p: "A full-width lead spans both columns, so the two columns' first headings line up beneath it.",
      },
    ],
    columns: [
      {
        blocks: [
          {
            p: "We are working to make this module better for everyone. The module team has listened to what disability and inclusion experts suggested.",
          },
          { ul: ["what it is", "why it is useful for you", "what to do with it"] },
          {
            ol: [
              "whether it counts towards your module mark",
              "clear instructions and the due date",
              "how you will get feedback",
            ],
          },
          {
            dl: [
              {
                term: "Accessibility",
                definition:
                  "Designing and building products, services, and environments for everyone regardless of impairment, disability, or context.",
              },
              {
                term: "Assistive technology",
                definition:
                  "Hardware or software that supports people in interacting with products, for example a screen reader or a hearing loop.",
              },
            ],
          },
        ],
      },
      {
        blocks: [
          { h4: "Easy-to-find files", icon: "search" },
          {
            p: "We name all files in a way that makes sense, so you can find things quickly.",
          },
          {
            links: [
              {
                text: "Alternative formats in Blackboard",
                href: "https://help.blackboard.com/Ally/Ally_for_LMS/Student/Alternative_Formats",
                icon: "external",
              },
            ],
          },
        ],
      },
    ],
  },
  infoVideo: {
    type: "info",
    id: "demo-info-video",
    heading: "Accessibility tools in Blackboard",
    icon: "playCircle",
    mediaLayout: true,
    columns: [
      {
        blocks: [
          {
            p: "Use Blackboard to generate alternative formats of content to suit your preferences and needs.",
          },
        ],
      },
      {
        blocks: [
          {
            video: {
              youTubeId: "8Q-kmnyGHbU",
              title: "Accessibility tools in Blackboard",
              poster: "ally-scripts/assets/ally-thumbnail.png",
              href: "https://www.youtube.com/watch?v=8Q-kmnyGHbU",
            },
          },
        ],
      },
    ],
  },
  linkButtons: {
    type: "linkButtons",
    id: "demo-support",
    heading: "Support and resources",
    columns: 2,
    cards: [
      {
        heading: "My computer, my way",
        icon: "monitor",
        body: "Learn how to make your device easier to use through accessibility adjustments.",
        link: {
          text: 'Visit "My Computer, My Way"',
          href: "https://mcmw.abilitynet.org.uk/",
        },
      },
      {
        heading: "Assistive technology",
        icon: "wrench",
        body: "The university provides a range of assistive technology solutions to support your learning.",
        link: {
          text: "Explore available tools",
          href: "https://www.southampton.ac.uk/",
        },
      },
    ],
  },
  courseInfo: {
    type: "courseInfo",
    id: "demo-courseinfo",
    heading: "Module information",
    items: [
      { label: "Module Code", value: "GENG1234" },
      { label: "Academic Year", value: "2025-26" },
      { label: "Module Lead", value: "Dr Example Person", icon: "user" },
      {
        label: "Email",
        email: "module.lead@example.com",
        icon: "mail",
      },
    ],
  },
  courseInfoGroups: {
    type: "courseInfo",
    id: "demo-courseinfo-groups",
    heading: "Blackboard accessibility statement for Example Module",
    groups: [
      {
        heading: "Module Information",
        items: [
          { label: "Module Code", value: "GENG1234" },
          {
            label: "Academic Year",
            value: "",
            placeholder: "[Add academic year]",
          },
        ],
        notes: [
          "This statement last edited by [Add module lead] on [add date].",
          'Accessibility data last refreshed on <time datetime="2025-10-15">15 October 2025</time>.',
        ],
      },
      {
        heading: "Module Lead",
        graphic: "userCard",
        items: [
          { label: "Module Lead", placeholder: "[Add module lead]", icon: "user" },
          { label: "Email", email: "", placeholder: "[Add email]", icon: "mail" },
        ],
      },
    ],
  },
  video: {
    type: "video",
    id: "demo-video",
    heading: "Accessibility tools in Blackboard",
    body: "Use Blackboard to generate alternative formats of content to suit your preferences and needs.",
    youTubeId: "lXKQ5c-_SfM",
    title: "Building Digital Accessibility Tools with Generative AI",
  },
  group: {
    type: "group",
    id: "demo-group",
    heading: "Accessibility features in Blackboard",
    children: [
      {
        type: "info",
        id: "demo-group-child-info",
        heading: "Keyboard navigation",
        icon: "infoCircle",
        columns: [
          {
            blocks: [
              { p: "Blackboard supports keyboard navigation and shortcuts." },
            ],
          },
        ],
      },
      {
        type: "courseInfo",
        id: "demo-group-child-courseinfo",
        heading: "Contact",
        items: [{ label: "Email", email: "support@example.com", icon: "mail" }],
      },
    ],
  },
};

window.allySpDemoSection = function (kind) {
  const spec = window.ALLY_SP_DEMO_SPECS[kind];
  if (!spec) {
    console.warn(
      "[allySpDemoSection] unknown kind: " +
        kind +
        ". Known: " +
        Object.keys(window.ALLY_SP_DEMO_SPECS).join(", "),
    );
    return null;
  }
  const container = document.getElementById("ally-sp-results");
  if (!container) {
    console.warn("[allySpDemoSection] #ally-sp-results not found");
    return null;
  }
  const ctx = {
    createElement: window.ALLY_SP_DOM.createElement,
    tokens: null,
  };
  const el = ALLY_STATEMENT_PREVIEW_SECTIONS.render(spec, ctx);
  if (!el) return null;
  container.hidden = false;
  container.appendChild(el);
  if (typeof IconLibrary !== "undefined" && IconLibrary.populateIcons) {
    IconLibrary.populateIcons(container);
  }
  return el;
};

window.allySpDemoAll = function () {
  return Object.keys(window.ALLY_SP_DEMO_SPECS).map(window.allySpDemoSection);
};

// Placeholder until the master-settings token model lands (Phase 8/9).
window.allySpSetEnvironment = function (id) {
  console.warn(
    "[allySpSetEnvironment] environments arrive in a later phase; requested: " +
      id,
  );
  return null;
};
