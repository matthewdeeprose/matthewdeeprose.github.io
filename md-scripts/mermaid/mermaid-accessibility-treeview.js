/**
 * Mermaid Accessibility - Tree View Module
 *
 * Generates accessible descriptions for `treeView-beta` sources from the shared
 * parse adapter's TREEVIEW surface (mermaid-parse-adapter.js, `parseTreeView`),
 * never from the SVG and never from the diagram source. The twenty-fifth
 * description generator (register item 122) and the eighteenth surface's
 * consumer.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-treeview-gold-targets-2026-10-24.md - rules TV1 to TV14 and
 * rulings MQ1 to MQ4 and TR1 to TR16 with the amendments TR13a, TR13b, TR13c,
 * TR14a, TR15a, SA1 and SA2 - VERSION 1 FROZEN 25 October 2026. A mismatch
 * between this module's output and a target is a STOP that goes back to the
 * design seat; it is never a reason to edit a target or a fixture.
 *
 * THIS FILE HOLDS NO REGEX, NO db READ, NO DOM READ AND NO URL LOGIC. Every
 * author string arrives already decoded by the surface, so THIS MODULE NEVER
 * DECODES; it only escapes, once, at the HTML sink. The canvas prints markup in
 * a name as characters (F1), so markup reads as written.
 *
 * DEPTH, THE ICON AND THE NESTING ARE THE SURFACE'S, NEVER RE-DERIVED HERE:
 * `depth` and `maxDepth` are read off the delivery (never from the written
 * indentation, TR1), `iconDrawn` and `iconName` say what the canvas draws and
 * what the author wrote (SA1), and `nestingDrawn` says whether the canvas can
 * place rows by depth (SA2).
 *
 * THERE IS NO accTitle OR accDescr NARRATION HERE (the core's override carries
 * them, TR15).
 *
 * ONE DECISION PER FACT: `buildModel` is the only place the tree is walked for
 * counts, `nameOf` the only place an item is named, `iconNote` and `qualifiers`
 * the only places a mark is read, and `count` the only place a number becomes a
 * count word.
 */
(function () {
  "use strict";

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

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Helper functions for logging level checks
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  // Logging helper methods
  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("[Mermaid Accessibility] Core module not loaded!");
    return;
  }

  /** TV2, MQ4: the standing disclosure of what is written in the code and not drawn. */
  const NOT_DRAWN_NOTE = "written in the code, not drawn in the picture";

  /** MQ1: the mirror disclosure of the root the picture draws and the author never wrote. */
  const NOT_WRITTEN_NOTE = "drawn in the picture, not written in the code";

  /** TV7: the only class that draws anything (F8). */
  const HIGHLIGHT_CLASS = "highlight";

  /** TR14a: at most this many items are named in the Deepest level and Highlighted rows; above it they give a count. */
  const NAME_LIST_MAX = 5;

  // ---------------------------------------------------------------------
  // The shared prose layer, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------

  /**
   * @returns {Object} MermaidAccessibilityCommon
   */
  function common() {
    return window.MermaidAccessibilityCommon;
  }

  /**
   * Escape one string of AUTHOR TEXT for an HTML sink. The caller escapes,
   * exactly once, where the field enters the HTML; generator furniture is
   * never escaped and the PLAIN short is never escaped at all.
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  /**
   * @param {string} message - What the delivery held that this module cannot narrate
   * @returns {Error} The STOP that reaches the core's honest fallback
   */
  function treeStop(message) {
    return new Error("Tree view narration: " + message);
  }

  // ---------------------------------------------------------------------
  // Counts, agreement and numbers (TV1, TV12)
  // ---------------------------------------------------------------------

  /**
   * A count as words to nine and digits from 10, through the shared writer.
   * @param {number} n - The count
   * @returns {string} The count word
   */
  function count(n) {
    return common().narrationNumber(n);
  }

  /**
   * "no items", "one item", "seven items": a count with its agreeing noun.
   * @param {number} n - The count
   * @param {string} one - The singular noun
   * @param {string} many - The plural noun
   * @returns {string} The phrase
   */
  function countPhrase(n, one, many) {
    if (n === 0) return `no ${many}`;
    return n === 1 ? `one ${one}` : `${count(n)} ${many}`;
  }

  /**
   * @param {number} n - A count
   * @returns {string} "none" for zero, else the count word
   */
  function countOrNone(n) {
    return n === 0 ? "none" : count(n);
  }

  /**
   * @param {string} text - A sentence or a count word
   * @returns {string} The text with its first character upper-cased
   */
  function capitalise(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Names written as a comma list with "and" before the last (packet
   * amendment 4). An empty list joins to nothing.
   * @param {Array<string>} names - The already-written names
   * @returns {string} The joined names
   */
  function joinList(names) {
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }

  // TF3 (25 October 2026): a name of white space and Unicode format characters
  // (category Cf: zero-width space and joiners, the word joiner, the soft
  // hyphen, the bidi controls, the byte order mark) draws nothing, as an empty
  // one does. A TEST only: the name's bytes are never altered.
  const NOTHING_DRAWN = /^[\s\p{Cf}]*$/u;

  /**
   * @param {*} name - A delivered name
   * @returns {boolean} True when nothing is drawn (empty, white space and format characters only)
   */
  function isBlank(name) {
    return name === null || name === undefined || NOTHING_DRAWN.test(String(name));
  }

  // ---------------------------------------------------------------------
  // The model the words describe (TV3, TV11)
  // ---------------------------------------------------------------------

  /**
   * Check the delivery's shape. An unknown shape is a STOP to the honest
   * fallback, never a silent drop. Iterative: a deep tree must not overflow
   * the stack.
   * @param {Object} delivery - The adapter's treeView delivery
   */
  function verifyDelivery(delivery) {
    if (!delivery || delivery.diagramType !== "treeView") {
      throw treeStop("the delivery is not a treeView delivery");
    }
    if (typeof delivery.nestingDrawn !== "boolean") {
      throw treeStop("the delivery does not say whether the nesting is drawn");
    }
    if (!Number.isInteger(delivery.nodeCount) || !Number.isInteger(delivery.maxDepth)) {
      throw treeStop("the delivery has no node count or no deepest level");
    }
    if (!delivery.root || !Array.isArray(delivery.root.children)) {
      throw treeStop("the delivery has no root");
    }
    const pending = delivery.root.children.slice();
    while (pending.length > 0) {
      const node = pending.pop();
      if (
        !node ||
        typeof node.name !== "string" ||
        typeof node.isDirectory !== "boolean" ||
        !Array.isArray(node.classes) ||
        !Array.isArray(node.children) ||
        !Number.isInteger(node.depth)
      ) {
        throw treeStop("an item has no name, kind, classes, depth or children");
      }
      node.children.forEach((child) => pending.push(child));
    }
  }

  /**
   * @param {Object} node - A delivered item
   * @returns {boolean} True when the item is highlighted (TV7)
   */
  function isHighlighted(node) {
    return node.classes.includes(HIGHLIGHT_CLASS);
  }

  /**
   * @param {Object} node - A delivered item
   * @returns {boolean} True when the item carries a description that draws
   */
  function hasDescription(node) {
    return typeof node.description === "string" && node.description.trim() !== "";
  }

  /**
   * @param {Object} node - A delivered item
   * @returns {string} The glyph the canvas draws by default for the item's kind
   */
  function defaultGlyph(node) {
    return node.isDirectory ? "folder" : "file";
  }

  /**
   * Build the one model every section reads: the items in drawn (pre-order)
   * order, walked once and iteratively.
   * @param {Object} delivery - The adapter's treeView delivery
   * @returns {Object} The model
   */
  function buildModel(delivery) {
    const nodes = [];
    const stack = delivery.root.children.slice().reverse();
    while (stack.length > 0) {
      const node = stack.pop();
      nodes.push(node);
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index]);
      }
    }
    // The surface's own count is the cross-check: a walk that disagrees is a STOP.
    if (nodes.length !== delivery.nodeCount) {
      throw treeStop(`the walk found ${nodes.length} item(s) but the delivery counts ${delivery.nodeCount}`);
    }
    const levels = delivery.maxDepth;
    const deepest = nodes.filter((node) => node.depth === levels);
    if (nodes.length > 0 && deepest.length === 0) {
      throw treeStop("no item sits at the deepest level the delivery names");
    }
    return {
      nodes: nodes,
      levels: levels,
      folders: nodes.filter((node) => node.isDirectory),
      files: nodes.filter((node) => !node.isDirectory),
      leaves: nodes.filter((node) => node.children.length === 0),
      highlighted: nodes.filter(isHighlighted),
      described: nodes.filter(hasDescription),
      deepest: deepest,
    };
  }

  // ---------------------------------------------------------------------
  // Naming and marks (TV3 to TV8)
  // ---------------------------------------------------------------------

  /**
   * The only place an item is named. A drawn name is quoted, author text
   * escaped once; a blank one reads "an unlabelled folder", "an unlabelled
   * file" or "an unlabelled empty folder" (TR5), capitalised "An" at the
   * start of a list item.
   * @param {Object} node - A delivered item
   * @param {Object} [options] - { atHead: true when the name opens a list item, withEmpty: false to drop "empty" }
   * @returns {string} The name
   */
  function nameOf(node, options) {
    const atHead = Boolean(options && options.atHead);
    const withEmpty = !(options && options.withEmpty === false);
    const isEmpty = withEmpty && node.isDirectory && node.children.length === 0;
    const noun = isEmpty ? "empty folder" : node.isDirectory ? "folder" : "file";
    if (isBlank(node.name)) return `${atHead ? "An" : "an"} unlabelled ${noun}`;
    return atHead ? `${capitalise(noun)} "${escapeText(node.name)}"` : `"${escapeText(node.name)}"`;
  }

  /**
   * TV4: an icon whose glyph differs from the default for the item is read by
   * the name the author wrote (SA1); a "?" is disclosed. Default icons read
   * nothing (MQ3).
   * @param {Object} node - A delivered item
   * @returns {string} The note, with its leading comma, or ""
   */
  function iconNote(node) {
    if (node.iconDrawn === null || node.iconDrawn === undefined || node.iconDrawn === defaultGlyph(node)) return "";
    const written = typeof node.iconName === "string" ? node.iconName : null;
    if (node.iconDrawn === "?") {
      return written === null
        ? ", icon drawn as a question mark"
        : `, icon "${escapeText(written)}" (drawn as a question mark)`;
    }
    return `, icon "${escapeText(written === null ? node.iconDrawn : written)}"`;
  }

  /**
   * TV7: the icon note, then ", highlighted", then ", described as "TEXT"".
   * @param {Object} node - A delivered item
   * @returns {string} The qualifiers, with their leading commas, or ""
   */
  function qualifiers(node) {
    const highlighted = isHighlighted(node) ? ", highlighted" : "";
    const described = hasDescription(node) ? `, described as "${escapeText(node.description)}"` : "";
    return `${iconNote(node)}${highlighted}${described}`;
  }

  // ---------------------------------------------------------------------
  // TV1: the one sentence
  // ---------------------------------------------------------------------

  /**
   * The PLAIN short: the title is the delivered title, never escaped. The HTML
   * short is derived from this string, and the Overview escapes its own title.
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} model - The model
   * @returns {string} The plain sentence
   */
  function buildSentence(delivery, model) {
    const title = hasTitle(delivery) ? ` titled "${delivery.title}"` : "";
    const items = model.nodes.length;
    const levels = items === 0 ? "" : ` in ${countPhrase(model.levels, "level", "levels")}`;
    return `A tree view${title} with ${countPhrase(items, "item", "items")}${levels}.`;
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @returns {boolean} True when the delivery carries a title
   */
  function hasTitle(delivery) {
    return typeof delivery.title === "string" && delivery.title !== "";
  }

  // ---------------------------------------------------------------------
  // TV2: the Overview
  // ---------------------------------------------------------------------

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} model - The model
   * @returns {string} The Overview paragraph's text
   */
  function buildOverview(delivery, model) {
    const parts = [];
    if (hasTitle(delivery)) {
      parts.push(`The tree view is titled "${escapeText(delivery.title)}" (${NOT_DRAWN_NOTE}).`);
    }

    const items = model.nodes.length;
    if (items === 0) {
      parts.push("The tree view has no items.");
    } else {
      // TR15a: no comma before "in"; TR13b: a kind with none is left out.
      const kinds = [
        model.folders.length > 0 ? countPhrase(model.folders.length, "folder", "folders") : null,
        model.files.length > 0 ? countPhrase(model.files.length, "file", "files") : null,
      ].filter((kind) => kind !== null);
      parts.push(
        `The tree view has ${countPhrase(items, "item", "items")} in ${countPhrase(model.levels, "level", "levels")}: ${kinds.join(" and ")}.`
      );
      // TR13c: when the canvas cannot place rows by depth the nesting is not drawn.
      if (delivery.nestingDrawn === false) parts.push(`The nesting is ${NOT_DRAWN_NOTE}.`);
    }

    parts.push(`A root marked "/" sits above the tree (${NOT_WRITTEN_NOTE}).`);

    const highlighted = model.highlighted.length;
    if (highlighted === 1) parts.push("One item is highlighted.");
    else if (highlighted > 1) parts.push(`${capitalise(count(highlighted))} items are highlighted.`);

    return parts.join(" ");
  }

  // ---------------------------------------------------------------------
  // TV3: the Tree
  // ---------------------------------------------------------------------

  /**
   * The nested list in drawn order, built iteratively so a deep tree cannot
   * overflow the stack. A leaf is one line; an item with children reads its
   * count before its list.
   * @param {Object} delivery - The adapter's delivery
   * @returns {Array<string>} The Tree section's lines
   */
  function renderTree(delivery) {
    const lines = ["<h4>Tree</h4>", "<ol>"];
    const stack = [{ list: delivery.root.children, index: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.list.length) {
        stack.pop();
        lines.push("</ol>");
        if (stack.length > 0) lines.push("</li>");
        continue;
      }
      const node = frame.list[frame.index];
      frame.index += 1;
      const head = `${nameOf(node, { atHead: true })}${qualifiers(node)}.`;
      if (node.children.length === 0) {
        lines.push(`<li>${head}</li>`);
        continue;
      }
      const noun = node.isDirectory ? "folder" : "file";
      lines.push(
        `<li>${head} This ${noun} contains ${countPhrase(node.children.length, "item", "items")}, as follows.`,
        "<ol>"
      );
      stack.push({ list: node.children, index: 0 });
    }
    return lines;
  }

  // ---------------------------------------------------------------------
  // TV11: the Summary
  // ---------------------------------------------------------------------

  /**
   * TR14a: names (quoted) for five or fewer, "none" for none, else the count.
   * @param {Array<Object>} list - The items
   * @returns {string} The reading
   */
  function namesOrCount(list) {
    if (list.length === 0) return "none";
    if (list.length > NAME_LIST_MAX) return `${count(list.length)} items`;
    return joinList(list.map((node) => nameOf(node, { withEmpty: false })));
  }

  /**
   * @param {Object} model - The model
   * @returns {Array<string>} The lines of the Summary section
   */
  function renderSummary(model) {
    return [
      "<h4>Summary</h4>",
      "<dl>",
      `<dt>Items</dt><dd>${count(model.nodes.length)}</dd>`,
      `<dt>Folders</dt><dd>${countOrNone(model.folders.length)}</dd>`,
      `<dt>Files</dt><dd>${countOrNone(model.files.length)}</dd>`,
      `<dt>Leaves</dt><dd>${countOrNone(model.leaves.length)}</dd>`,
      `<dt>Deepest level</dt><dd>${count(model.levels)}, with ${namesOrCount(model.deepest)}</dd>`,
      `<dt>Highlighted</dt><dd>${namesOrCount(model.highlighted)}</dd>`,
      `<dt>Descriptions</dt><dd>${countOrNone(model.described.length)}</dd>`,
      "</dl>",
    ];
  }

  // ---------------------------------------------------------------------
  // The generators
  // ---------------------------------------------------------------------

  /**
   * Fetch and verify the diagram, or throw.
   *
   * A parse rejection is deliberately NOT caught - the core's catch turns it
   * into the honest generation-failed fallback. THE GUARD RUNS AFTER THE
   * PARSE and tests for `false`, never falsiness: `parseTreeView` is what
   * STARTS the lazy self-check, and the flag reads `null` until it settles.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<{delivery: Object, model: Object}>} The delivery and its model
   */
  async function readTreeView(code) {
    const delivery = await window.MermaidParseAdapter.parseTreeView(code);
    if (window.MermaidParseAdapter.isTreeViewHealthy() === false) {
      logWarn("[Mermaid Accessibility] Tree view self-check failed; refusing to narrate");
      throw new Error(
        "Parse adapter failed its treeView self-check; refusing to narrate an unverified diagram"
      );
    }
    verifyDelivery(delivery);
    const model = buildModel(delivery);
    logDebug(
      `[Mermaid Accessibility] Tree view delivery: ${model.nodes.length} item(s), ${model.levels} level(s)`
    );
    return { delivery, model };
  }

  /**
   * Generate the short description - rule TV1. The plain string is verbatim;
   * the HTML short is the escape of that one string, derived and never
   * composed a second time.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating tree view short description");

    const { delivery, model } = await readTreeView(code);
    const text = buildSentence(delivery, model);
    logDebug(`[Mermaid Accessibility] Tree view short: ${text}`);

    return { html: escapeText(text), text: text };
  }

  /**
   * Wrapper returning the plain tier.
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the plain text description
   */
  async function shortDescriptionWrapper(svgElement, code) {
    const descriptions = await generateShortDescription(svgElement, code);
    return descriptions.text;
  }

  /**
   * Generate the detailed description - rules TV2, TV3 and TV11.
   *
   * Overview, then (only with items) Tree and Summary. Newline-joined so
   * text-content extraction stays readable.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating tree view detailed description");

    const { delivery, model } = await readTreeView(code);
    const parts = ["<h4>Overview</h4>", `<p>${buildOverview(delivery, model)}</p>`];
    if (model.nodes.length > 0) {
      parts.push(...renderTree(delivery), ...renderSummary(model));
    }
    return parts.join("\n");
  }

  // Register with the core module. THE KEY IS "treeView", AND THE DETECTOR ROW
  // THAT ROUTES TO IT LANDS IN THE SAME CHANGE AS THIS FILE'S SCRIPT TAG; a
  // generator registered without its MERMAID_TYPE_TO_KEY row registers and is
  // never called. generateShortHTML is the ASYNC shape and has to be: this
  // module awaits the parse adapter, so a synchronous one would yield
  // `undefined` silently (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("treeView", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Tree view module loaded and registered on the parse adapter's treeView surface"
  );
})();
