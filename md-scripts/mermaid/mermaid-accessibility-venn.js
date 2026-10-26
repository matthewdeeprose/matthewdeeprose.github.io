/**
 * Mermaid Accessibility - Venn Diagram Module
 *
 * Generates accessible descriptions for `venn-beta` sources from the shared
 * parse adapter's VENN surface (mermaid-parse-adapter.js, `parseVenn`), never
 * from the SVG and never from the diagram source. The twenty-fourth
 * description generator (register item 121) and the seventeenth surface's
 * consumer.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-venn-gold-targets-2026-10-22.md - rules VN1 to VN12 and rulings
 * VR1 to VR14, VERSION 1 FROZEN 22 October 2026, as amended 23 October 2026
 * (amendments 4 to 11: VR16 and VR18 to VR23). A mismatch between this
 * module's output and a target is a STOP that goes back to the design seat; it
 * is never a reason to edit a target or a fixture.
 *
 * THIS FILE HOLDS NO REGEX, NO db READ, NO DOM READ AND NO URL LOGIC. Every
 * author string arrives already decoded by the surface (titles included: the
 * surface resolves VR8 and VR9), so THIS MODULE NEVER DECODES; it only
 * escapes, once, at the HTML sink. A Venn diagram has no link syntax (0
 * anchors on 154 canvases) and the canvas prints markup in a name as
 * characters, so markup reads as written.
 *
 * THERE IS NO accTitle OR accDescr NARRATION HERE (clause X3 is the core's;
 * both are parse errors on this grammar).
 *
 * ONE DECISION PER FACT: `placeItems` is the only place that decides where an
 * item sits, so the Circles, Intersections and Not drawn lists cannot
 * disagree; `count` is the only place a number becomes a count word, `plural`
 * the only place a noun agrees with it, `positional` the only place a size is
 * written, and `setName` the only place a set is named.
 *
 * KNOWN DEPARTURES FROM A READING OF THE PICTURE (all in the gold): no order
 * or position of the circles is ever narrated (VR1); a union's size is never
 * narrated (VR4); the geometry is item 108's and the words say only what was
 * declared.
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

  /** VN7, VR13: the standing disclosure of what is written in the code and not drawn. */
  const NOT_DRAWN_DISCLOSURE = "written in the code, not drawn in the picture";

  /** VN6, VR6: the mirror disclosure of a region drawn and never written. */
  const DERIVED_DISCLOSURE = "drawn in the picture, not written in the code";

  /** VR10, VR23: the Overview sentence for a negative size or an undrawable width or height. */
  const NEGATIVE_SENTENCE =
    "Every circle, intersection and item is written in the code and not drawn in the picture.";

  /** VN12, VR5: the three readings of the Largest circle row that name no circle. */
  const LARGEST_NONE_ONE = "none; there is only one circle";
  const LARGEST_NONE_EQUAL = "none; every circle has the same size";
  const LARGEST_NONE_UNDRAWN = "none; no circle is drawn";

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
  function vennStop(message) {
    return new Error("Venn narration: " + message);
  }

  // ---------------------------------------------------------------------
  // Counts, agreement and numbers (VN1, VN9)
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
   * @param {string} text - A sentence or a count word
   * @returns {string} The text with its first character upper-cased
   */
  function capitalise(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * VN9: a size as positional digits at every magnitude, never in exponent
   * form. The writer is MermaidAccessibilityCommon.positionalDigits, shared with
   * the treemap module since VR15 (23 October 2026).
   * @param {number} n - A circle's declared size
   * @returns {string} The number as positional digits
   */
  function positional(n) {
    return common().positionalDigits(n);
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

  /**
   * @param {*} name - A delivered name
   * @returns {boolean} True when nothing is drawn (empty, or spaces only)
   */
  function isBlank(name) {
    return name === null || name === undefined || String(name).trim() === "";
  }

  // ---------------------------------------------------------------------
  // The model the words describe (VN3, VN5, VN6, VN8)
  // ---------------------------------------------------------------------

  /**
   * Check the delivery's shape. An unknown shape is a STOP to the honest
   * fallback, never a silent drop.
   * @param {Object} delivery - The adapter's venn delivery
   */
  function verifyDelivery(delivery) {
    const listOf = (value, what) => {
      if (!Array.isArray(value)) throw vennStop(`${what} is not a list`);
      return value;
    };
    if (!delivery || delivery.diagramType !== "venn") {
      throw vennStop("the delivery is not a venn delivery");
    }
    listOf(delivery.sets, "sets").forEach((set) => {
      if (!set || typeof set.id !== "string" || typeof set.size !== "number") {
        throw vennStop("a set has no id or no numeric size");
      }
    });
    listOf(delivery.unions, "unions");
    listOf(delivery.derivedPairs, "derivedPairs");
    delivery.unions.concat(delivery.derivedPairs).forEach((region) => {
      if (
        !region ||
        !Array.isArray(region.setIds) ||
        region.setIds.length < 2 ||
        region.setIds.some((id) => typeof id !== "string") ||
        typeof region.size !== "number"
      ) {
        throw vennStop("an intersection has fewer than two sets or a non-numeric size");
      }
    });
    listOf(delivery.items, "items").forEach((item) => {
      if (
        !item ||
        typeof item.label !== "string" ||
        !Array.isArray(item.setIds) ||
        item.setIds.length === 0 ||
        item.setIds.some((id) => typeof id !== "string")
      ) {
        throw vennStop("an item has no text or names no set");
      }
    });
    if (typeof delivery.canvasBlank !== "boolean") {
      throw vennStop("the delivery does not say whether the canvas is blank");
    }
    if (delivery.sets.length === 0) {
      throw vennStop("the diagram declares no circle, so nothing is drawn");
    }
  }

  /**
   * @param {Array<string>} ids - Set ids
   * @returns {string} The same combination whatever the order or repeats
   */
  function combinationKey(ids) {
    return Array.from(new Set(ids)).sort().join("\u0000");
  }

  /**
   * Build the one model every list reads. Circles are in declaration order; a
   * set declared twice is two circles that share the LAST label written for it
   * and the LAST size declared (M6, VN8, VR20). Intersections are the declared
   * unions in written order and then the derived pairs (A7), a union declared
   * twice being two entries that share the last label written (VN8, VR20).
   * @param {Object} delivery - The adapter's venn delivery
   * @returns {Object} The model
   */
  function buildModel(delivery) {
    const firstIndex = new Map();
    const lastEntry = new Map();
    const lastLabel = new Map();
    delivery.sets.forEach((set, index) => {
      if (!firstIndex.has(set.id)) firstIndex.set(set.id, index);
      lastEntry.set(set.id, set);
      // VR20: a later declaration with no label does not clear the label.
      if (set.label !== null && set.label !== undefined) lastLabel.set(set.id, set.label);
    });
    const names = new Map();
    lastEntry.forEach((set, id) => {
      const text = lastLabel.has(id) ? lastLabel.get(id) : id;
      names.set(id, { text: text, blank: isBlank(text), number: firstIndex.get(id) + 1 });
    });

    // VR20: every circle of a doubled set has the LAST size declared for it.
    // VR25 (F13): a set is undrawn when ANY declaration of its name has size 0,
    // whatever its last size, so it reads with the VR13 disclosure.
    const zeroDeclared = new Set(delivery.sets.filter((set) => set.size === 0).map((set) => set.id));
    const circles = delivery.sets.map((set, index) => {
      const size = lastEntry.get(set.id).size;
      return { index: index, id: set.id, size: size, zero: size === 0 || zeroDeclared.has(set.id) };
    });

    const lastUnionLabel = new Map();
    delivery.unions.forEach((union) => {
      // VR20: a later declaration with no label does not clear the label.
      if (union.label !== null && union.label !== undefined) {
        lastUnionLabel.set(combinationKey(union.setIds), union.label);
      }
    });
    const zeroIds = new Set(circles.filter((circle) => circle.zero).map((circle) => circle.id));
    const regionOf = (region, derived) => {
      const key = combinationKey(region.setIds);
      const ids = Array.from(new Set(region.setIds));
      ids.forEach((id) => {
        if (!firstIndex.has(id)) throw vennStop(`an intersection names the undeclared set "${id}"`);
      });
      ids.sort((a, b) => firstIndex.get(a) - firstIndex.get(b));
      // VR13, VR18, VR19: a declared union is not drawn when it names a size-0
      // set or when its own size is 0. The adapter derives no pair naming a
      // size-0 set (VR18), so a derived pair is never disclosed this way.
      const zero = ids.some((id) => zeroIds.has(id)) || (!derived && region.size === 0);
      const label = derived ? null : lastUnionLabel.get(key);
      return {
        key: key,
        ids: ids,
        derived: derived,
        zero: zero,
        size: region.size,
        label: isBlank(label) ? null : label,
      };
    };
    const regions = delivery.unions
      .map((union) => regionOf(union, false))
      .concat(delivery.derivedPairs.map((pair) => regionOf(pair, true)));

    return { circles, regions, names, firstIndex, items: placeItems(delivery, circles, regions) };
  }

  /**
   * THE CHOKE POINT (VN7): where does each item sit? ONE function decides it
   * for every item, so the Circles, Intersections and Not drawn lists can
   * never disagree. An item sits under every circle that shares its single
   * set (a doubled set is two circles, VR14), under every declared union with
   * its exact combination (a union declared twice is two, VN8) or else under
   * the derived pair with it; otherwise it is drawn nowhere. The exact
   * combination is the whole test: the sets are not searched for a subset. A
   * set list that names one id twice is drawn nowhere either (VR21): the canvas
   * finds no region for the repeated key, so the ids are NOT de-duplicated.
   * @param {Object} delivery - The adapter's venn delivery
   * @param {Array<Object>} circles - The model's circles
   * @param {Array<Object>} regions - The model's intersections
   * @returns {Array<Object>} One placement per item, in written order
   */
  function placeItems(delivery, circles, regions) {
    return delivery.items.map((item) => {
      const ids = item.setIds.slice();
      const key = combinationKey(ids);
      let owners;
      if (new Set(ids).size < ids.length) {
        owners = [];
      } else if (ids.length === 1) {
        owners = circles.filter((circle) => circle.id === ids[0]).map((circle) => ({ circle: circle }));
      } else {
        const declared = regions.filter((region) => !region.derived && region.key === key);
        const matched = declared.length > 0 ? declared : regions.filter((region) => region.derived && region.key === key);
        owners = matched.map((region) => ({ region: region }));
      }
      const disclosed = owners.some((owner) => (owner.circle ? owner.circle.zero : owner.region.zero));
      return { item: item, ids: ids, owners: owners, notDrawn: owners.length === 0, disclosed: disclosed };
    });
  }

  // ---------------------------------------------------------------------
  // Naming (VN3, VR11)
  // ---------------------------------------------------------------------

  /**
   * The only place a set is named. A drawn name is quoted, author text
   * escaped once; a blank one reads "unlabelled circle N" in running words and
   * "Unlabelled circle N" at the head of a list item (VR11); a name no set
   * declared (an item written on it) reads as written.
   * @param {Object} model - The model
   * @param {string} id - A set id
   * @param {boolean} atHead - True when the name opens a list item
   * @param {number} [number] - The circle's own position, for a circle item
   * @returns {string} The name
   */
  function setName(model, id, atHead, number) {
    const known = model.names.get(id);
    if (!known) return `"${escapeText(id)}"`;
    if (!known.blank) return `"${escapeText(known.text)}"`;
    const text = `unlabelled circle ${number !== undefined ? number : known.number}`;
    return atHead ? capitalise(text) : text;
  }

  /**
   * @param {Object} model - The model
   * @param {Array<string>} ids - Set ids, in declaration order
   * @returns {string} The names joined as Matthew's form does, with " and " and no comma
   */
  function andNames(model, ids) {
    return ids.map((id, position) => setName(model, id, position === 0)).join(" and ");
  }

  // ---------------------------------------------------------------------
  // VN1: the one sentence
  // ---------------------------------------------------------------------

  /**
   * The title is passed through `esc`: identity for the plain short, the HTML
   * escape for the detailed Overview.
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} model - The model
   * @param {Function} esc - How the title enters this string
   * @returns {string} The sentence
   */
  function buildSentence(delivery, model, esc) {
    const title = isBlank(delivery.title) ? "" : ` titled "${esc(delivery.title)}"`;
    const circles = model.circles.length;
    const intersections = model.regions.length;
    const items = delivery.items.length;
    return (
      `A Venn diagram${title} with ` +
      `${count(circles)} ${plural(circles, "circle", "circles")}, ` +
      `${count(intersections)} ${plural(intersections, "intersection", "intersections")} and ` +
      `${count(items)} ${plural(items, "item", "items")}.`
    );
  }

  // ---------------------------------------------------------------------
  // VN2: the Overview
  // ---------------------------------------------------------------------

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} model - The model
   * @returns {string} The Overview paragraph's text
   */
  function buildOverview(delivery, model) {
    const n = model.circles.length;
    const names = model.circles.map((circle, position) =>
      setName(model, circle.id, false, circle.index + 1)
    );
    const labelled =
      n === 1
        ? `The circle is labelled ${names[0]}.`
        : `The ${count(n)} circles are labelled ${joinList(names)}.`;
    const parts = [buildSentence(delivery, model, escapeText), labelled];

    // VR10, VR23: nothing is visibly drawn when a size is negative or when the
    // source configures a width or height the canvas cannot draw; one sentence
    // for either, written once.
    const nothingDrawn =
      model.circles.some((circle) => circle.size < 0) ||
      model.regions.some((region) => region.size < 0) ||
      delivery.canvasBlank;
    if (nothingDrawn) parts.push(NEGATIVE_SENTENCE);

    const derived = model.regions.filter((region) => region.derived).length;
    if (derived > 0) {
      parts.push(
        `${capitalise(count(derived))} ${plural(derived, "intersection is", "intersections are")} ` +
          "drawn in the picture and not written in the code."
      );
    }

    const undrawn = model.items.filter((placement) => placement.notDrawn || placement.disclosed).length;
    if (undrawn > 0) {
      parts.push(
        `${capitalise(count(undrawn))} ${plural(undrawn, "item is", "items are")} ` +
          "written in the code and not drawn in the picture."
      );
    }
    return parts.join(" ");
  }

  // ---------------------------------------------------------------------
  // VN3 to VN6: the Circles and Intersections lists
  // ---------------------------------------------------------------------

  /**
   * @param {Object} placement - An item's placement
   * @param {boolean} zero - True when the owner it sits under is size 0 (VR13)
   * @returns {string} One <li>
   */
  function renderItemLine(placement, zero) {
    const disclosure = zero ? ` (${NOT_DRAWN_DISCLOSURE})` : "";
    return `<li>"${escapeText(placement.item.label)}"${disclosure}.</li>`;
  }

  /**
   * One list item with its heading and, nested inside the same <li>, the
   * items it holds. With none, the item stays on one line and says so.
   * @param {string} head - The heading, up to and excluding the full stop
   * @param {string} noun - "circle" or "intersection"
   * @param {string} verb - "contains" or "includes"
   * @param {Array<string>} lines - The item lines
   * @returns {Array<string>} The lines
   */
  function renderOwner(head, noun, verb, lines) {
    const k = lines.length;
    if (k === 0) return [`<li>${head}. This ${noun} ${verb} no items.</li>`];
    return [
      `<li>${head}. This ${noun} ${verb} ${count(k)} ${plural(k, "item", "items")}, as follows.`,
      "<ol>",
      ...lines,
      "</ol>",
      "</li>",
    ];
  }

  /**
   * @param {Object} model - The model
   * @param {boolean} withSizes - True when every circle carries its size clause (VR5, VR13)
   * @returns {Array<string>} The Circles list's lines
   */
  function renderCircles(model, withSizes) {
    const lines = ["<h4>Circles</h4>", "<ol>"];
    model.circles.forEach((circle) => {
      const size = withSizes ? `, size ${positional(circle.size)}` : "";
      const disclosure = circle.zero ? ` (${NOT_DRAWN_DISCLOSURE})` : "";
      const head = `${setName(model, circle.id, true, circle.index + 1)}${size}${disclosure}`;
      const held = model.items
        .filter((placement) => placement.owners.some((owner) => owner.circle === circle))
        .map((placement) => renderItemLine(placement, circle.zero));
      lines.push(...renderOwner(head, "circle", "contains", held));
    });
    lines.push("</ol>");
    return lines;
  }

  /**
   * @param {Object} model - The model
   * @returns {Array<string>} The Intersections list's lines (empty when none)
   */
  function renderIntersections(model) {
    if (model.regions.length === 0) return [];
    const lines = ["<h4>Intersections</h4>", "<ol>"];
    model.regions.forEach((region) => {
      const label = region.label === null ? "" : `, labelled "${escapeText(region.label)}"`;
      let disclosure = "";
      if (region.derived) disclosure = ` (${DERIVED_DISCLOSURE})`;
      else if (region.zero) disclosure = ` (${NOT_DRAWN_DISCLOSURE})`;
      const head = `${andNames(model, region.ids)}${label}${disclosure}`;
      const held = model.items
        .filter((placement) => placement.owners.some((owner) => owner.region === region))
        .map((placement) => renderItemLine(placement, region.zero));
      lines.push(...renderOwner(head, "intersection", "includes", held));
    });
    lines.push("</ol>");
    return lines;
  }

  /**
   * VN7: the items drawn nowhere, named with the sets as written.
   * @param {Object} model - The model
   * @returns {Array<string>} The Not drawn section's lines (empty when none)
   */
  function renderNotDrawn(model) {
    const undrawn = model.items.filter((placement) => placement.notDrawn);
    if (undrawn.length === 0) return [];
    const lines = ["<h4>Not drawn</h4>", "<ol>"];
    undrawn.forEach((placement) => {
      const ordered = placement.ids.slice().sort((a, b) => {
        const known = (id) => (model.firstIndex.has(id) ? model.firstIndex.get(id) : Infinity);
        return known(a) - known(b);
      });
      const sets = ordered.map((id) => setName(model, id, false)).join(" and ");
      lines.push(
        `<li>"${escapeText(placement.item.label)}", in ${sets} (${NOT_DRAWN_DISCLOSURE}).</li>`
      );
    });
    lines.push("</ol>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // VN12: the Summary
  // ---------------------------------------------------------------------

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} model - The model
   * @param {boolean} unequal - True when the circles' sizes are not all equal
   * @returns {Array<string>} The lines of the Summary section
   */
  function renderSummary(delivery, model, unequal) {
    const n = model.circles.length;
    const m = model.regions.length;
    const k = delivery.items.length;

    // VR28: the row compares DRAWN circles only, so an undrawn set is never named.
    const drawn = model.circles.filter((circle) => !circle.zero);
    let largest = LARGEST_NONE_EQUAL;
    if (drawn.length === 0) {
      largest = LARGEST_NONE_UNDRAWN;
    } else if (n === 1) {
      largest = LARGEST_NONE_ONE;
    } else if (unequal || drawn.length < n) {
      const top = Math.max(...drawn.map((circle) => circle.size));
      const tied = drawn.filter((circle) => circle.size === top);
      const names = joinList(
        tied.map((circle, position) => setName(model, circle.id, position === 0, circle.index + 1))
      );
      largest = `${names}, size ${positional(top)}`;
    }

    return [
      "<h4>Summary</h4>",
      "<dl>",
      `<dt>Circles</dt><dd>${count(n)}</dd>`,
      `<dt>Intersections</dt><dd>${m === 0 ? "none" : count(m)}</dd>`,
      `<dt>Items</dt><dd>${k === 0 ? "none" : count(k)}</dd>`,
      `<dt>Largest circle</dt><dd>${largest}</dd>`,
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
   * PARSE and tests for `false`, never falsiness: `parseVenn` is what STARTS
   * the lazy self-check, and the flag reads `null` until it settles.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<{delivery: Object, model: Object}>} The delivery and its model
   */
  async function readVenn(code) {
    const delivery = await window.MermaidParseAdapter.parseVenn(code);
    if (window.MermaidParseAdapter.isVennHealthy() === false) {
      logWarn("[Mermaid Accessibility] Venn self-check failed; refusing to narrate");
      throw new Error(
        "Parse adapter failed its venn self-check; refusing to narrate an unverified diagram"
      );
    }
    verifyDelivery(delivery);
    const model = buildModel(delivery);
    logDebug(
      `[Mermaid Accessibility] Venn delivery: ${model.circles.length} circle(s), ${model.regions.length} intersection(s), ${delivery.items.length} item(s)`
    );
    return { delivery, model };
  }

  /**
   * Generate the short description - rule VN1. The plain string is verbatim;
   * the HTML short is the escape of that one string, derived and never
   * composed a second time.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Venn short description");

    const { delivery, model } = await readVenn(code);
    const text = buildSentence(delivery, model, (title) => title);
    logDebug(`[Mermaid Accessibility] Venn short: ${text}`);

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
   * Generate the detailed description - rules VN2 to VN12.
   *
   * Overview, Circles, Intersections (omitted when there are none), Not drawn
   * (present only when an item is drawn nowhere) and Summary. Newline-joined
   * so text-content extraction stays readable.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Venn detailed description");

    const { delivery, model } = await readVenn(code);
    const sizes = model.circles.map((circle) => circle.size);
    const allEqual = sizes.every((size) => size === sizes[0]);
    // VR5, VR13: sizes are written when they differ, and a circle of size 0 makes them differ.
    const withSizes = !allEqual || model.circles.some((circle) => circle.zero);

    const parts = [
      "<h4>Overview</h4>",
      `<p>${buildOverview(delivery, model)}</p>`,
      ...renderCircles(model, withSizes),
      ...renderIntersections(model),
      ...renderNotDrawn(model),
      ...renderSummary(delivery, model, !allEqual),
    ];
    return parts.join("\n");
  }

  // Register with the core module. THE KEY IS "venn", AND THE DETECTOR ROW
  // THAT ROUTES TO IT LANDS IN THE SAME CHANGE AS THIS FILE'S SCRIPT TAG; a
  // generator registered without its MERMAID_TYPE_TO_KEY row registers and is
  // never called. generateShortHTML is the ASYNC shape and has to be: this
  // module awaits the parse adapter, so a synchronous one would yield
  // `undefined` silently (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("venn", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Venn diagram module loaded and registered on the parse adapter's venn surface"
  );
})();
