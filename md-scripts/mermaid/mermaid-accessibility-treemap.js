/**
 * Mermaid Accessibility - Treemap Diagram Module
 *
 * Generates accessible descriptions for `treemap` / `treemap-beta` sources from
 * the shared parse adapter's TREEMAP surface (mermaid-parse-adapter.js,
 * `parseTreemap`), never from the SVG and never from the diagram source.
 * The twenty-third description generator (register item 119) and the
 * sixteenth surface's consumer.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-treemap-gold-targets-2026-10-21.md - rules TM1 to TM12, rulings
 * TR1 to TR18 and Matthew's rulings MR1 (the values sentence is written only
 * when values are off) and MR2 (a zero item reads with the standing
 * disclosure), VERSION 1 FROZEN 21 October 2026, amended the same day so an
 * empty group carries MR2's disclosure (amendment 5, EDGE 7). A mismatch
 * between this module's output and a target is a STOP that goes back to the
 * design seat; it is never a reason to edit a target or a fixture.
 *
 * THIS FILE HOLDS NO REGEX, NO db READ, NO DOM READ AND NO URL LOGIC. Every
 * author string arrives already decoded by the surface, so THIS MODULE NEVER
 * DECODES; it only escapes, once, at the HTML sink. A treemap has no link
 * syntax and the canvas prints markup in a name as characters, so markup
 * reads as written.
 *
 * THERE IS NO accTitle OR accDescr NARRATION HERE (clause X3 is the core's).
 *
 * ONE BUILDER PER FACT: `count` is the only place a number becomes a count
 * word, `plural` the only place a noun agrees with it, `digits` the only place
 * a value is written, `perCent` the only place a share is written, and
 * `atHead` / `inText` the only places a node is named, so the Overview, the
 * Contents and the Summary cannot disagree about the same node.
 *
 * KNOWN DEPARTURES FROM A READING OF THE PICTURE (all in the gold): the author's
 * numbers are written as digits and the valueFormat is never narrated (TR1;
 * the canvas's formatter is not reachable and prints "$,.0f" as $1e+3); the
 * picture's size-driven omissions are not described because the delivery does
 * not hold box geometry (M4, TR15); a title the sanitiser changed reads as the
 * author's characters (TR16).
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

  /** TR1, TR10: significant digits kept when a sum is written (trims float noise). */
  const VALUE_SIGNIFICANT_DIGITS = 12;

  /** TM4: the base of a share, as a percentage. */
  const PERCENT = 100;

  /** TR8 and TR18: the two words a share that rounds to an end of the scale reads. */
  const UNDER_ONE = "under 1 per cent";
  const OVER_NINETY_NINE = "over 99 per cent";

  /** MR2 (and amendment 5): the standing disclosure of a box the canvas draws empty and nameless. */
  const NOT_DRAWN = "not drawn in the picture";
  const ZERO_DISCLOSURE = `written in the code, ${NOT_DRAWN}`;

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

  // ---------------------------------------------------------------------
  // Counts, agreement and numbers (TM1, TM9)
  // ---------------------------------------------------------------------

  /**
   * A count as words to nine and digits from 10; zero reads "no".
   * @param {number} n - The count
   * @returns {string} The count word
   */
  function count(n) {
    return n === 0 ? "no" : common().narrationNumber(n);
  }

  /**
   * @param {number} n - The count
   * @param {string} one - The singular noun
   * @param {string} many - The plural noun
   * @returns {string} The noun that agrees with n
   */
  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  /**
   * TM9: the author's number as digits, with no separator and no format.
   * Float noise from the surface's sums is trimmed (TR10).
   * @param {number} n - A value or a total
   * @returns {string} The number as digits
   */
  function digits(n) {
    return String(Number(Number(n).toPrecision(VALUE_SIGNIFICANT_DIGITS)));
  }

  /**
   * TM7: a name that draws nothing (empty, or spaces only) is unnamed.
   * @param {*} name - A delivered node name or title
   * @returns {boolean} True when nothing is drawn
   */
  function isBlank(name) {
    return name === null || name === undefined || String(name).trim() === "";
  }

  /**
   * TM4: a whole-number share, halves rounded up; null when the base is 0 (TR5).
   * @param {number} value - The node's total
   * @param {number} base - The total it is a share of
   * @returns {number|null} The rounded share
   */
  function sharePercent(value, base) {
    if (!(base > 0)) return null;
    return Math.round((value * PERCENT) / base);
  }

  /**
   * The only place a share is written. A non-zero value that rounds to 0 reads
   * "under 1 per cent" (TR8); one that rounds to 100 without being the whole of
   * its base reads "over 99 per cent" (TR18); a zero reads 0 (TR13).
   * @param {number} value - The node's total
   * @param {number} base - The total it is a share of
   * @returns {string|null} "N per cent", the two words above, or null (TR5)
   */
  function perCent(value, base) {
    const share = sharePercent(value, base);
    if (share === null) return null;
    if (share === 0 && value !== 0) return UNDER_ONE;
    if (share === PERCENT && digits(value) !== digits(base)) return OVER_NINETY_NINE;
    return `${share} per cent`;
  }

  // ---------------------------------------------------------------------
  // The tree the words describe (TM1, TM2, TM7)
  // ---------------------------------------------------------------------

  /**
   * @param {Object} node - A delivered node
   * @param {Function} visit - Called with (child, parent) for every node below
   * @param {Object} [parent] - The group the children sit in
   */
  function walk(node, visit, parent) {
    node.children.forEach((child) => {
      visit(child, parent || null);
      walk(child, visit, child);
    });
  }

  /**
   * One pass for the counts TM1 and TM2 need, and the author-order numbering
   * TM7 gives an unnamed item or group.
   * @param {Object} delivery - The adapter's delivery
   * @returns {{items: number, groups: number, depth: number, unnamedItem: Map, unnamedGroup: Map}}
   */
  function tally(delivery) {
    let items = 0;
    let groups = 0;
    let depth = 0;
    const unnamedItem = new Map();
    const unnamedGroup = new Map();
    const all = [];
    walk(delivery.root, (node) => all.push(node));
    all.sort((a, b) => a.authorIndex - b.authorIndex);
    all.forEach((node) => {
      if (node.leaf) {
        items += 1;
        if (isBlank(node.name)) unnamedItem.set(node.authorIndex, items);
      } else {
        groups += 1;
        if (isBlank(node.name)) unnamedGroup.set(node.authorIndex, groups);
      }
    });
    walk(delivery.root, (node) => {
      if (!node.leaf) depth = Math.max(depth, node.level + 1);
    });
    return { items, groups, depth, unnamedItem, unnamedGroup };
  }

  /**
   * @param {Object} node - A delivered node
   * @returns {number} The items at any depth below (or 1 for an item)
   */
  function itemsBelow(node) {
    if (node.leaf) return 1;
    return node.children.reduce((sum, child) => sum + itemsBelow(child), 0);
  }

  /**
   * @param {Object} node - A delivered node
   * @returns {number} The groups at any depth below
   */
  function groupsBelow(node) {
    return node.children.reduce(
      (sum, child) => sum + (child.leaf ? 0 : 1 + groupsBelow(child)),
      0
    );
  }

  /**
   * A node as it opens an item: quoted, or "Unnamed item N" / "Unnamed group N".
   * Author text escaped once.
   * @param {Object} node - A delivered node
   * @param {Object} counts - The tally
   * @returns {string} The name
   */
  function atHead(node, counts) {
    if (!isBlank(node.name)) return `"${escapeText(node.name)}"`;
    return node.leaf
      ? `Unnamed item ${counts.unnamedItem.get(node.authorIndex)}`
      : `Unnamed group ${counts.unnamedGroup.get(node.authorIndex)}`;
  }

  /**
   * A node named inside running words: an unnamed one reads in lower case.
   * @param {Object} node - A delivered node
   * @param {Object} counts - The tally
   * @returns {string} The name
   */
  function inText(node, counts) {
    const name = atHead(node, counts);
    return isBlank(node.name) ? name[0].toLowerCase() + name.slice(1) : name;
  }

  // ---------------------------------------------------------------------
  // TM1: the one sentence
  // ---------------------------------------------------------------------

  /**
   * The title is passed through `esc`: identity for the plain short, the HTML
   * escape for the detailed Overview.
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} counts - The tally
   * @param {Function} esc - How the title enters this string
   * @returns {string} The sentence
   */
  function buildSentence(delivery, counts, esc) {
    const title = isBlank(delivery.title) ? "" : ` titled "${esc(delivery.title)}"`;
    if (counts.items === 0 && counts.groups === 0) {
      return `A treemap${title} with no items.`;
    }
    const items = `${count(counts.items)} ${plural(counts.items, "item", "items")}`;
    const groups =
      counts.groups > 0
        ? ` in ${count(counts.groups)} ${plural(counts.groups, "group", "groups")}`
        : "";
    return `A treemap${title} with ${items}${groups}, totalling ${digits(delivery.root.total)}.`;
  }

  // ---------------------------------------------------------------------
  // TM3, TM4: the Contents
  // ---------------------------------------------------------------------

  /**
   * TM4 and TR14: one item. A zero carries MR2's disclosure (a corrupted zero
   * names what was typed inside it); any other value carries ONE bracket, the
   * share first and then a semicolon and what was typed.
   * @param {Object} node - A delivered item
   * @param {Object|null} parent - The group it sits in, or null at the top
   * @param {Object} counts - The tally
   * @param {number} whole - The whole's total
   * @returns {string} One <li>
   */
  function renderItemLine(node, parent, counts, whole) {
    const head = atHead(node, counts);
    const typed = node.valueNote
      ? `written as "${escapeText(node.rawValue)}" in the code`
      : "";
    if (node.total === 0) {
      return `<li>${head}, 0 (${typed ? `${typed}, ${NOT_DRAWN}` : ZERO_DISCLOSURE}).</li>`;
    }
    const share = perCent(node.total, parent ? parent.total : whole);
    const base = parent ? `of ${inText(parent, counts)}` : "of the whole";
    const parts = [share === null ? "" : `${share} ${base}`, typed].filter(Boolean);
    const bracket = parts.length ? ` (${parts.join("; ")})` : "";
    return `<li>${head}, ${digits(node.total)}${bracket}.</li>`;
  }

  /**
   * TM3: one group and, nested inside the same <li>, its children in drawn
   * order. A group with no children keeps its item on one line and carries
   * MR2's disclosure (amendment 5, EDGE 7).
   * @param {Object} node - A delivered group
   * @param {Object} counts - The tally
   * @param {number} whole - The whole's total
   * @returns {Array<string>} The lines
   */
  function renderGroupLines(node, counts, whole) {
    const k = itemsBelow(node);
    const g = groupsBelow(node);
    const items = k === 0 ? "no items" : `${count(k)} ${plural(k, "item", "items")}`;
    const nested = g > 0 ? ` in ${count(g)} ${plural(g, "group", "groups")}` : "";
    const share = perCent(node.total, whole);
    const ofWhole = share === null ? "" : ` (${share} of the whole)`;
    const head = `<li>${atHead(node, counts)}, total ${digits(node.total)}${ofWhole}, ${items}${nested}.`;
    if (node.children.length === 0) {
      return [`${head.slice(0, -1)} (${ZERO_DISCLOSURE}).</li>`];
    }
    const lines = [head, "<ol>"];
    node.children.forEach((child) => {
      lines.push(...renderNodeLines(child, node, counts, whole));
    });
    lines.push("</ol>", "</li>");
    return lines;
  }

  /**
   * @param {Object} node - A delivered node
   * @param {Object|null} parent - The group it sits in, or null at the top
   * @param {Object} counts - The tally
   * @param {number} whole - The whole's total
   * @returns {Array<string>} The lines
   */
  function renderNodeLines(node, parent, counts, whole) {
    return node.leaf
      ? [renderItemLine(node, parent, counts, whole)]
      : renderGroupLines(node, counts, whole);
  }

  // ---------------------------------------------------------------------
  // TM6: the Summary
  // ---------------------------------------------------------------------

  /**
   * Ties are all named, in drawn order, as a comma list with "and" before the
   * last name (packet amendment 4).
   * @param {Array<string>} names - The already-written names
   * @returns {string} The joined names
   */
  function joinTie(names) {
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @returns {Array<{node: Object, parent: (Object|null)}>} Every item with the
   *   group it sits in, in drawn order, depth first
   */
  function itemsWithParents(delivery) {
    const found = [];
    const visit = (node, parent) => {
      node.children.forEach((child) => {
        if (child.leaf) found.push({ node: child, parent });
        else visit(child, child);
      });
    };
    visit(delivery.root, null);
    return found;
  }

  /**
   * @param {Array} entries - Tied items with their groups
   * @param {Object} counts - The tally
   * @returns {string} The names, each with its group (none at the top)
   */
  function itemTie(entries, counts) {
    return joinTie(
      entries.map(({ node, parent }, position) => {
        const name = position === 0 ? atHead(node, counts) : inText(node, counts);
        return parent ? `${name} in ${inText(parent, counts)}` : name;
      })
    );
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} counts - The tally
   * @returns {Array<string>} The lines of the Summary section
   */
  function renderSummary(delivery, counts) {
    const whole = delivery.root.total;
    const lines = ["<h4>Summary</h4>", "<dl>", `<dt>Total</dt><dd>${digits(whole)}</dd>`];

    // TR6: the largest group is chosen from the top level only.
    const tops = delivery.root.children.filter((child) => !child.leaf);
    if (tops.length > 0) {
      const top = Math.max(...tops.map((group) => group.total));
      const tied = tops.filter((group) => group.total === top);
      const share = perCent(top, whole);
      const names = joinTie(
        tied.map((group, position) =>
          position === 0 ? atHead(group, counts) : inText(group, counts)
        )
      );
      lines.push(`<dt>Largest group</dt><dd>${names}${share ? `, ${share}` : ""}</dd>`);
    }

    const items = itemsWithParents(delivery);
    [
      ["Largest item", Math.max],
      ["Smallest item", Math.min],
    ].forEach(([label, pick]) => {
      const target = pick(...items.map((entry) => entry.node.total));
      const tied = items.filter((entry) => entry.node.total === target);
      const share = perCent(target, whole);
      // MR2: a zero picked as the extreme carries the disclosure once, at the end.
      const disclosure = target === 0 ? ` (${ZERO_DISCLOSURE})` : "";
      lines.push(
        `<dt>${label}</dt><dd>${itemTie(tied, counts)}${share ? `, ${share} of the whole` : ""}${disclosure}</dd>`
      );
    });

    lines.push("</dl>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // The generators
  // ---------------------------------------------------------------------

  /**
   * Fetch and verify the diagram, or throw.
   *
   * A parse rejection is deliberately NOT caught - the core's catch turns it
   * into the honest generation-failed fallback. THE GUARD RUNS AFTER THE
   * PARSE and tests for `false`, never falsiness: `parseTreemap` is what
   * STARTS the lazy self-check, and the flag reads `null` until it settles.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised treemap delivery
   */
  async function readTreemap(code) {
    const delivery = await window.MermaidParseAdapter.parseTreemap(code);
    if (window.MermaidParseAdapter.isTreemapHealthy() === false) {
      logWarn(
        "[Mermaid Accessibility] Treemap self-check failed; refusing to narrate"
      );
      throw new Error(
        "Parse adapter failed its treemap self-check; refusing to narrate an unverified diagram"
      );
    }
    logDebug(
      `[Mermaid Accessibility] Treemap delivery: ${delivery.crossCheck.dbNodeCount} node(s)`
    );
    return delivery;
  }

  /**
   * Generate the short description - rule TM1. The plain string is verbatim;
   * the HTML short is the escape of that one string.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Treemap short description");

    const delivery = await readTreemap(code);
    const text = buildSentence(delivery, tally(delivery), (title) => title);
    logDebug(`[Mermaid Accessibility] Treemap short: ${text}`);

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
   * Generate the detailed description - rules TM2 to TM11.
   *
   * Overview, Contents (a nested ordered list in drawn order), Summary (a
   * definition list). A treemap with nothing in it gets the Overview alone
   * (TR11), and one with no items gets no Summary. Newline-joined so
   * text-content extraction stays readable.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Treemap detailed description");

    const delivery = await readTreemap(code);
    const counts = tally(delivery);
    const whole = delivery.root.total;
    const hasContent = counts.items > 0 || counts.groups > 0;

    let overview = buildSentence(delivery, counts, escapeText);
    if (hasContent) {
      // TR4: depth. MR1: values are mentioned only when the author turned them off.
      if (counts.groups === 0) overview += " There are no groups.";
      else if (counts.depth === 1) overview += " Groups do not nest.";
      else overview += ` Groups nest to ${count(counts.depth)} levels.`;
      if (!delivery.showValues) overview += " Values are not shown on the picture.";
    }
    const parts = ["<h4>Overview</h4>", `<p>${overview}</p>`];

    if (hasContent) {
      parts.push("<h4>Contents</h4>", "<ol>");
      delivery.root.children.forEach((child) => {
        parts.push(...renderNodeLines(child, null, counts, whole));
      });
      parts.push("</ol>");
      if (counts.items > 0) parts.push(...renderSummary(delivery, counts));
    }

    return parts.join("\n");
  }

  // Register with the core module. THE KEY IS "treemap", AND THE DETECTOR ROW
  // THAT ROUTES TO IT LANDS IN THE SAME CHANGE AS THIS FILE'S SCRIPT TAG; a
  // generator registered without its MERMAID_TYPE_TO_KEY row registers and is
  // never called. generateShortHTML is the ASYNC shape and has to be: this
  // module awaits the parse adapter, so a synchronous one would yield
  // `undefined` silently (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("treemap", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Treemap diagram module loaded and registered on the parse adapter's treemap surface"
  );
})();
