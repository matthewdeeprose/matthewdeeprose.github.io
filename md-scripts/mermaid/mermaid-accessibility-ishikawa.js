/**
 * Mermaid Accessibility - Ishikawa Module
 *
 * Generates accessible descriptions for `ishikawa` / `ishikawa-beta` sources
 * from the shared parse adapter's ISHIKAWA surface (mermaid-parse-adapter.js,
 * `parseIshikawa`), never from the SVG and never from the diagram source. The
 * twenty-sixth description generator (register item 125) and the nineteenth
 * surface's consumer.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-ishikawa-gold-targets-2026-10-26.md - rules IK1 to IK14 and
 * rulings MQ1 to MQ4 and IR1 to IR14 with the amendments SA1, IR1a, IR2a and
 * IR6a - VERSION 1 FROZEN 26 October 2026. A mismatch between this module's
 * output and a target is a STOP that goes back to the design seat; it is never
 * a reason to edit a target or a fixture.
 *
 * THIS FILE HOLDS NO REGEX ON AUTHOR TEXT, NO db READ, NO DOM READ AND NO
 * SOURCE READ. Every author string arrives already decoded (and, under SA1,
 * already restored to the author's own characters) by the surface, so THIS
 * MODULE NEVER DECODES; it only escapes, once, at the HTML sink.
 *
 * SIDE, SPINE POSITION AND DRAWN ORDER ARE NEVER NARRATED (MQ3): the words
 * list categories and causes in declared order and say nothing of where the
 * picture puts them. `side`, `spineIndex`, `authorIndex` and `drawnIndex` are
 * therefore never read. Depth is the surface's: `maxDepth` is the deepest
 * CAUSE level (a category is not a level), and `paddingDrawn` says whether
 * the canvas can draw at all (IK11).
 *
 * THERE IS NO title, accTitle OR accDescr NARRATION HERE: the grammar has none
 * (such a line is a node), and the core's override on an accTitle line is
 * core behaviour on every type (IK7).
 *
 * ONE DECISION PER FACT: `buildModel` is the only place the tree is walked for
 * counts, `nameOf` the only place a node is named, `count` the only place a
 * number becomes a count word.
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

  /** IK11: the standing disclosure of what is written in the code and not drawn. */
  const NOT_DRAWN_NOTE = "written in the code and not drawn in the picture";

  /** IK10: at most this many categories are named in the Most causes and no-causes rows; above it they give a count. */
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
  function ishikawaStop(message) {
    return new Error("Ishikawa narration: " + message);
  }

  // ---------------------------------------------------------------------
  // Counts, agreement and numbers (IK1, IK9)
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
   * "no causes", "one cause", "seven causes": a count with its agreeing noun.
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
   * Names written as a comma list with "and" before the last.
   * @param {Array<string>} names - The already-written names
   * @returns {string} The joined names
   */
  function joinList(names) {
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }

  // IR6a (26 October 2026): a label of white space and Unicode format
  // characters (category Cf: zero-width space and joiners, the word joiner, the
  // soft hyphen, the bidi controls, the byte order mark) draws nothing, as an
  // empty one does. A TEST only: the label's bytes are never altered.
  const NOTHING_DRAWN = /^[\s\p{Cf}]*$/u;

  /**
   * @param {*} text - A delivered label
   * @returns {boolean} True when nothing is drawn (empty, white space and format characters only)
   */
  function isBlank(text) {
    return text === null || text === undefined || NOTHING_DRAWN.test(String(text));
  }

  // ---------------------------------------------------------------------
  // The model the words describe (IK1, IK2, IK10)
  // ---------------------------------------------------------------------

  /**
   * Check the delivery's shape. An unknown shape is a STOP to the honest
   * fallback, never a silent drop. Iterative: a deep tree must not overflow
   * the stack.
   * @param {Object} delivery - The adapter's ishikawa delivery
   */
  function verifyDelivery(delivery) {
    if (!delivery || delivery.diagramType !== "ishikawa") {
      throw ishikawaStop("the delivery is not an ishikawa delivery");
    }
    if (!Number.isInteger(delivery.nodeCount) || !Number.isInteger(delivery.maxDepth)) {
      throw ishikawaStop("the delivery has no node count or no deepest cause level");
    }
    if (typeof delivery.paddingDrawn !== "boolean") {
      throw ishikawaStop("the delivery does not say whether the picture is drawn");
    }
    if (!delivery.effect || typeof delivery.effect.text !== "string") {
      throw ishikawaStop("the delivery has no effect");
    }
    if (!Array.isArray(delivery.categories)) {
      throw ishikawaStop("the delivery has no categories list");
    }
    const pending = delivery.categories.slice();
    while (pending.length > 0) {
      const node = pending.pop();
      if (!node || typeof node.text !== "string" || !Array.isArray(node.causes)) {
        throw ishikawaStop("a category or cause has no text or no causes list");
      }
      node.causes.forEach((cause) => pending.push(cause));
    }
  }

  /**
   * Total causes under one node at every level, iteratively.
   * @param {Object} node - A delivered category or cause
   * @returns {number} Its descendants
   */
  function descendantCount(node) {
    let total = 0;
    const pending = node.causes.slice();
    while (pending.length > 0) {
      const cause = pending.pop();
      total += 1;
      cause.causes.forEach((child) => pending.push(child));
    }
    return total;
  }

  /**
   * Build the one model every section reads. The surface's own counts are the
   * cross-check: a walk that disagrees is a STOP.
   * @param {Object} delivery - The adapter's ishikawa delivery
   * @returns {Object} The model
   */
  function buildModel(delivery) {
    const categories = delivery.categories.map((category) => ({
      category: category,
      total: descendantCount(category),
    }));
    const causes = categories.reduce((sum, entry) => sum + entry.total, 0);
    if (categories.length + causes !== delivery.nodeCount) {
      throw ishikawaStop(
        `the walk found ${categories.length + causes} node(s) but the delivery counts ${delivery.nodeCount}`
      );
    }
    // maxDepth is the deepest cause level, and 0 when there are no causes.
    const levels = causes === 0 ? 0 : delivery.maxDepth;
    if ((causes === 0) !== (delivery.maxDepth === 0)) {
      throw ishikawaStop("the delivery's deepest cause level disagrees with its cause count");
    }
    const mostCauses = categories.reduce((most, entry) => Math.max(most, entry.total), 0);
    return {
      categories: categories,
      causes: causes,
      levels: levels,
      mostCauses: mostCauses,
      mostNames: categories.filter((entry) => mostCauses > 0 && entry.total === mostCauses),
      withoutCauses: categories.filter((entry) => entry.total === 0),
    };
  }

  // ---------------------------------------------------------------------
  // Naming (IK3, IK4)
  // ---------------------------------------------------------------------

  /**
   * The only place a category or cause is named. A drawn label is quoted,
   * author text escaped once; a blank one reads "an unlabelled category" /
   * "an unlabelled cause", capitalised "An" at a list item's start (IK4).
   * @param {Object} node - A delivered category or cause
   * @param {string} noun - "Category" or "Cause" as the item's head noun, lower case
   * @param {boolean} atHead - True when the name opens a list item
   * @returns {string} The name
   */
  function nameOf(node, noun, atHead) {
    if (isBlank(node.text)) return `${atHead ? "An" : "an"} unlabelled ${noun}`;
    const quoted = `"${escapeText(node.text)}"`;
    return atHead ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${quoted}` : quoted;
  }

  // ---------------------------------------------------------------------
  // IK1: the one sentence
  // ---------------------------------------------------------------------

  /**
   * "N categories and M causes", "no categories", "two categories and no causes".
   * @param {Object} model - The model
   * @returns {string} The count clause, without a full stop
   */
  function countClause(model) {
    const categories = model.categories.length;
    if (categories === 0) return "no categories";
    return `${countPhrase(categories, "category", "categories")} and ${countPhrase(model.causes, "cause", "causes")}`;
  }

  /**
   * The PLAIN short: the effect is the delivered text, never escaped. The HTML
   * short is derived from this string.
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} model - The model
   * @returns {string} The plain sentence
   */
  function buildSentence(delivery, model) {
    const effect = isBlank(delivery.effect.text) ? "an unlabelled effect" : `"${delivery.effect.text}"`;
    return `An Ishikawa diagram of ${effect} with ${countClause(model)}.`;
  }

  // ---------------------------------------------------------------------
  // IK2: the Overview
  // ---------------------------------------------------------------------

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} model - The model
   * @returns {string} The Overview paragraph's text
   */
  function buildOverview(delivery, model) {
    const effect = isBlank(delivery.effect.text)
      ? "an unlabelled effect"
      : `the effect "${escapeText(delivery.effect.text)}"`;
    const parts = [`This Ishikawa diagram (a fishbone diagram) has ${effect} at the head of the fish.`];

    // IR1a, IR2a: the zero kind is kept; the depth clause only with causes.
    const depth = model.causes > 0 ? `, up to ${countPhrase(model.levels, "level", "levels")} deep` : "";
    parts.push(`It has ${countClause(model)}${depth}.`);

    // IK11: only when the canvas cannot draw the picture at all.
    if (delivery.paddingDrawn === false) {
      if (model.categories.length === 0) parts.push(`The effect is ${NOT_DRAWN_NOTE}.`);
      else if (model.causes === 0) parts.push(`The effect and every category are ${NOT_DRAWN_NOTE}.`);
      else parts.push(`The effect, every category and every cause are ${NOT_DRAWN_NOTE}.`);
    }
    return parts.join(" ");
  }

  // ---------------------------------------------------------------------
  // IK3: the Categories
  // ---------------------------------------------------------------------

  /**
   * The nested list in declared order, built iteratively so a deep tree cannot
   * overflow the stack. A node with none below it is one line; a node with
   * children reads its count before its list.
   * @param {Object} delivery - The adapter's delivery
   * @returns {Array<string>} The Categories section's lines
   */
  function renderCategories(delivery) {
    const lines = ["<h4>Categories</h4>", "<ol>"];
    const stack = [{ list: delivery.categories, index: 0, isTop: true }];
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
      const noun = frame.isTop ? "category" : "cause";
      const head = nameOf(node, noun, true);
      if (node.causes.length === 0) {
        // A category with none reads "has no causes"; a cause with none is a leaf.
        lines.push(frame.isTop ? `<li>${head} has no causes.</li>` : `<li>${head}.</li>`);
        continue;
      }
      const kind = frame.isTop ? "cause" : "sub-cause";
      lines.push(
        `<li>${head}. This ${noun} has ${countPhrase(node.causes.length, kind, `${kind}s`)}, as follows.`,
        "<ol>"
      );
      stack.push({ list: node.causes, index: 0, isTop: false });
    }
    return lines;
  }

  // ---------------------------------------------------------------------
  // IK10: the Summary
  // ---------------------------------------------------------------------

  /**
   * Names (quoted) for five or fewer categories, else the count.
   * @param {Array<Object>} entries - Model category entries
   * @returns {string} The names or the count of categories
   */
  function categoryNames(entries) {
    if (entries.length > NAME_LIST_MAX) return `${count(entries.length)} categories`;
    return joinList(entries.map((entry) => nameOf(entry.category, "category", false)));
  }

  /**
   * @param {Object} model - The model
   * @returns {Array<string>} The lines of the Summary section
   */
  function renderSummary(model) {
    const mostCauses =
      model.mostCauses === 0 ? "none" : `${count(model.mostCauses)}, in ${categoryNames(model.mostNames)}`;
    const withoutCauses = model.withoutCauses.length === 0 ? "none" : categoryNames(model.withoutCauses);
    return [
      "<h4>Summary</h4>",
      "<dl>",
      `<dt>Categories</dt><dd>${countOrNone(model.categories.length)}</dd>`,
      `<dt>Causes</dt><dd>${countOrNone(model.causes)}</dd>`,
      `<dt>Cause levels</dt><dd>${countOrNone(model.levels)}</dd>`,
      `<dt>Most causes</dt><dd>${mostCauses}</dd>`,
      `<dt>Categories with no causes</dt><dd>${withoutCauses}</dd>`,
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
   * PARSE and tests for `false`, never falsiness: `parseIshikawa` is what
   * STARTS the lazy self-check, and the flag reads `null` until it settles.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<{delivery: Object, model: Object}>} The delivery and its model
   */
  async function readIshikawa(code) {
    const delivery = await window.MermaidParseAdapter.parseIshikawa(code);
    if (window.MermaidParseAdapter.isIshikawaHealthy() === false) {
      logWarn("[Mermaid Accessibility] Ishikawa self-check failed; refusing to narrate");
      throw new Error(
        "Parse adapter failed its ishikawa self-check; refusing to narrate an unverified diagram"
      );
    }
    verifyDelivery(delivery);
    const model = buildModel(delivery);
    logDebug(
      `[Mermaid Accessibility] Ishikawa delivery: ${model.categories.length} categor(ies), ${model.causes} cause(s), ${model.levels} level(s)`
    );
    return { delivery, model };
  }

  /**
   * Generate the short description - rule IK1. The plain string is verbatim;
   * the HTML short is the escape of that one string, derived and never
   * composed a second time.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating ishikawa short description");

    const { delivery, model } = await readIshikawa(code);
    const text = buildSentence(delivery, model);
    logDebug(`[Mermaid Accessibility] Ishikawa short: ${text}`);

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
   * Generate the detailed description - rules IK2, IK3 and IK10.
   *
   * Overview, then Categories (only with categories), then Summary (always).
   * Newline-joined so text-content extraction stays readable.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating ishikawa detailed description");

    const { delivery, model } = await readIshikawa(code);
    const parts = ["<h4>Overview</h4>", `<p>${buildOverview(delivery, model)}</p>`];
    if (model.categories.length > 0) {
      parts.push(...renderCategories(delivery));
    }
    parts.push(...renderSummary(model));
    return parts.join("\n");
  }

  // Register with the core module. THE KEY IS "ishikawa", AND THE DETECTOR ROW
  // THAT ROUTES TO IT LANDS IN THE SAME CHANGE AS THIS FILE'S SCRIPT TAG; a
  // generator registered without its MERMAID_TYPE_TO_KEY row registers and is
  // never called. generateShortHTML is the ASYNC shape and has to be: this
  // module awaits the parse adapter, so a synchronous one would yield
  // `undefined` silently (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("ishikawa", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Ishikawa module loaded and registered on the parse adapter's ishikawa surface"
  );
})();
