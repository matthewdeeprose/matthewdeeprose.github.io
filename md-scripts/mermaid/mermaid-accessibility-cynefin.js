/**
 * Mermaid Accessibility - Cynefin Module
 *
 * Generates accessible descriptions for `cynefin-beta` sources from the shared
 * parse adapter's CYNEFIN surface (mermaid-parse-adapter.js, `parseCynefin`),
 * never from the SVG and never from the diagram source. The twenty-eighth
 * description generator (register item 135) and the twenty-first surface's
 * consumer, and the last Mermaid 11.17.2 type to be described.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-cynefin-gold-targets-2026-10-30.md - rules CN1 to CN13 and
 * CN2 item (2a), and rulings MQ1 to MQ8 - VERSION 1 FROZEN 1 November 2026. A
 * mismatch between this module's output and a target is a STOP that goes back
 * to the design seat; it is never a reason to edit a target or a fixture.
 *
 * THIS FILE HOLDS NO REGEX ON AUTHOR TEXT, NO db READ, NO DOM READ AND NO
 * SOURCE READ. Every author string arrives already decoded by the surface, so
 * THIS MODULE NEVER DECODES; it only escapes, once, at the HTML sink. Where
 * the picture draws an item (`placement`) is the surface's delivery too and
 * is read as delivered, never recomputed from a coordinate.
 *
 * ONE DECISION PER FACT: `count` is the only place a number becomes a count
 * word, `readSubtitle` the only place a drawn subtitle line becomes words
 * (CN13), `placementNote` the only place an item's disclosure is written,
 * `movementItem` the only place the distinct (from, to) pairs are named
 * (CN2 item 2a), and `quoted` the only place an author string is escaped and
 * quoted.
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

  const DIAGRAM_TYPE = "cynefin";

  /** The five domains in the picture's fixed order (CN4); the surface delivers them in this order. */
  const DOMAIN_KEYS = Object.freeze(["complex", "complicated", "chaotic", "clear", "confusion"]);

  /**
   * CN4, CN13: the subtitle lines the picture prints under each domain's name,
   * nearer the name first. They are renderer constants (read from the pinned
   * Mermaid 11.17.2 bundle and confirmed on the canvas, gold amendment 2a),
   * not facts of the source, so the surface does not deliver them. They are
   * drawn only while showDomainDescriptions is true. Confusion has one line.
   */
  const DRAWN_SUBTITLES = Object.freeze({
    complex: Object.freeze(["Probe → Sense → Respond", "Emergent Practices"]),
    complicated: Object.freeze(["Sense → Analyse → Respond", "Good Practices"]),
    chaotic: Object.freeze(["Act → Sense → Respond", "Novel Practices"]),
    clear: Object.freeze(["Sense → Categorise → Respond", "Best Practices"]),
    confusion: Object.freeze(["Disorder"]),
  });

  /** CN13: an arrow (U+2192) in a drawn subtitle line, with the spaces round it, reads as ", then ". */
  const SUBTITLE_ARROW = /\s*→\s*/g;
  const SUBTITLE_ARROW_READING = ", then ";

  /** CN2 items 2 and 3: the fixed sentences. */
  const LAYOUT_LABELLED = "Each domain is labelled with the framework's usual approach (drawn in the picture, not written in the code).";
  const CLIFF_FIRST =
    "A line called the cliff runs down the lower half of the boundary between Chaotic and Clear (drawn in the picture, not written in the code).";
  const CLIFF_WHY =
    "It is called the cliff because, in the Cynefin framework, a situation treated as Clear can fall suddenly into Chaotic, and it is hard to climb back.";

  /** CN5: the disclosure written after an item the picture does not draw where it belongs. */
  const NOT_DRAWN = "written in the code, not drawn in the picture";
  const PLACEMENT_NOTE = Object.freeze({
    hidden: NOT_DRAWN,
    "outside-regions": "drawn outside every domain in the picture",
    "outside-picture": "drawn outside the picture",
  });
  const PLACEMENT_OWN = "own";
  const PLACEMENT_HIDDEN = "hidden";
  const PLACEMENT_REGION_PREFIX = "region:";

  /** CN5: the words for an item whose label draws nothing. */
  const UNLABELLED_ITEM = "An unlabelled item";

  /** CN2 item (2a): at most this many distinct (from, to) pairs are named; above it the item is omitted. */
  const MAX_PAIRS_NAMED = 5;

  /** CN6: the ordinal of a repeated arrow; the table covers second to ninth, digits with "th" from 10. */
  const ORDINALS = Object.freeze(["", "", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"]);
  const ORDINAL_TABLE_END = 9;

  /** CN2 item (2a): a pair written twice reads "(twice)", more reads "(three times)", digits from 10. */
  const TWICE = 2;

  // A label of white space and Unicode format characters draws nothing (as on wardley and ishikawa). A TEST only.
  // U+2800 (braille blank, category So) is deliberately NOT in the class: it stays quoted. Re-open if a reader reports it.
  const NOTHING_DRAWN = /^[\s\p{Cf}]*$/u;

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
   * Escape one string of AUTHOR TEXT for an HTML sink, exactly once, where the
   * field enters the HTML. Generator furniture is never escaped and the PLAIN
   * short is never escaped at all.
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  /**
   * @param {string} text - Author text
   * @returns {string} The text escaped once and inside quotation marks
   */
  function quoted(text) {
    return `"${escapeText(text)}"`;
  }

  /**
   * @param {string} message - What the delivery held that this module cannot narrate
   * @returns {Error} The STOP that reaches the core's honest fallback
   */
  function cynefinStop(message) {
    return new Error("Cynefin narration: " + message);
  }

  /**
   * @param {*} text - A delivered label
   * @returns {boolean} True when nothing is drawn
   */
  function isBlank(text) {
    return text === null || text === undefined || NOTHING_DRAWN.test(String(text));
  }

  // ---------------------------------------------------------------------
  // Counts, agreement and lists (CN1, CN8)
  // ---------------------------------------------------------------------

  /**
   * A count as words to nine and digits from 10, through the shared writer.
   * @param {number} n - The count
   * @returns {string} The count word ("no" for zero)
   */
  function count(n) {
    return n === 0 ? "no" : common().narrationNumber(n);
  }

  /**
   * @param {number} n - A count
   * @returns {string} "none" for zero, else the count word
   */
  function countOrNone(n) {
    return n === 0 ? "none" : count(n);
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
   * @param {string} text - A sentence start
   * @returns {string} The text with its first letter capitalised
   */
  function capitalise(text) {
    return common().capitalize(text);
  }

  /**
   * The ONE list writer: commas, "and" before the last, NO serial comma. The
   * shared formatList is not used because it writes the Oxford comma and the
   * frozen gold reads "Complex, Complicated and Clear".
   * @param {Array<string>} items - The already-written items
   * @returns {string} The joined items
   */
  function commaAnd(items) {
    if (items.length <= 1) return items.join("");
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  // ---------------------------------------------------------------------
  // The delivery
  // ---------------------------------------------------------------------

  /**
   * Check the delivery's shape. An unknown shape is a STOP to the honest
   * fallback, never a silent drop.
   * @param {Object} delivery - The adapter's cynefin delivery
   */
  function verifyDelivery(delivery) {
    if (!delivery || delivery.diagramType !== DIAGRAM_TYPE) {
      throw cynefinStop("the delivery is not a cynefin delivery");
    }
    if (!Array.isArray(delivery.domains) || delivery.domains.length !== DOMAIN_KEYS.length) {
      throw cynefinStop("the delivery does not hold the five domains");
    }
    delivery.domains.forEach((domain, index) => {
      if (domain.key !== DOMAIN_KEYS[index]) throw cynefinStop(`domain ${index + 1} is not ${DOMAIN_KEYS[index]}`);
      if (typeof domain.label !== "string" || typeof domain.position !== "string" || !Array.isArray(domain.items)) {
        throw cynefinStop(`domain ${domain.key} is not shaped as the surface promises`);
      }
      domain.items.forEach((item) => placementNote(item.placement, delivery));
    });
    if (!Array.isArray(delivery.transitions)) throw cynefinStop("the delivery has no transitions list");
    delivery.transitions.forEach((transition) => {
      if (!DOMAIN_KEYS.includes(transition.from) || !DOMAIN_KEYS.includes(transition.to)) {
        throw cynefinStop("an arrow names a domain the picture does not draw");
      }
    });
    if (typeof delivery.showDomainDescriptions !== "boolean") {
      throw cynefinStop("the delivery does not say whether the domain descriptions are drawn");
    }
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @param {string} key - A domain key
   * @returns {string} The domain's drawn name
   */
  function domainLabel(delivery, key) {
    return delivery.domains.find((domain) => domain.key === key).label;
  }

  /**
   * CN5: the disclosure after an item, by the placement the surface delivered.
   * @param {string} placement - own, hidden, region:<key>, outside-regions or outside-picture
   * @param {Object} delivery - The adapter's delivery
   * @returns {string} The words inside the brackets, or "" when the item is drawn in its own domain
   */
  function placementNote(placement, delivery) {
    if (placement === PLACEMENT_OWN) return "";
    if (typeof placement === "string" && placement.startsWith(PLACEMENT_REGION_PREFIX)) {
      const key = placement.slice(PLACEMENT_REGION_PREFIX.length);
      if (!DOMAIN_KEYS.includes(key)) throw cynefinStop(`an item is drawn in a region the picture does not have: ${key}`);
      return `drawn in the ${domainLabel(delivery, key)} region of the picture`;
    }
    if (!Object.prototype.hasOwnProperty.call(PLACEMENT_NOTE, placement)) {
      throw cynefinStop(`an item has a placement this module cannot narrate: ${placement}`);
    }
    return PLACEMENT_NOTE[placement];
  }

  /**
   * CN13: a drawn subtitle line as words. The arrow and the spaces round it
   * become ", then "; every other character is as drawn.
   * @param {string} line - A drawn subtitle line
   * @returns {string} The line as read
   */
  function readSubtitle(line) {
    return line.replace(SUBTITLE_ARROW, SUBTITLE_ARROW_READING);
  }

  // ---------------------------------------------------------------------
  // CN1: the short
  // ---------------------------------------------------------------------

  /**
   * CN1: "six items and two arrows"; arrows are left out at zero, items never.
   * @param {Array<Object>} domains - The delivered domains
   * @param {Array<Object>} transitions - The delivered arrows
   * @returns {string} The count list, without a full stop
   */
  function countList(domains, transitions) {
    const items = domains.reduce((total, domain) => total + domain.items.length, 0);
    const parts = [countPhrase(items, "item", "items")];
    if (transitions.length > 0) parts.push(countPhrase(transitions.length, "arrow", "arrows"));
    return commaAnd(parts);
  }

  /**
   * The PLAIN short: the title is the delivered text, never escaped. The HTML
   * short is derived from this string.
   * @param {Object} delivery - The adapter's delivery
   * @returns {string} The plain sentence
   */
  function buildSentence(delivery) {
    const title = isBlank(delivery.title) ? "" : ` titled "${delivery.title}"`;
    return `A Cynefin diagram${title} with ${countList(delivery.domains, delivery.transitions)}.`;
  }

  // ---------------------------------------------------------------------
  // CN2: the Overview
  // ---------------------------------------------------------------------

  /**
   * CN2 item (2a): the distinct (from, to) pairs in first-declaration order,
   * each with how many times it is written.
   * @param {Array<Object>} transitions - The delivered arrows
   * @returns {Array<{from: string, to: string, times: number}>} The pairs
   */
  function distinctPairs(transitions) {
    const pairs = [];
    transitions.forEach((transition) => {
      const same = pairs.find((pair) => pair.from === transition.from && pair.to === transition.to);
      if (same) same.times += 1;
      else pairs.push({ from: transition.from, to: transition.to, times: 1 });
    });
    return pairs;
  }

  /**
   * CN2 item (2a): the Overview's movement sentence. No labels. Omitted at no
   * arrows or when more than five distinct pairs exist (the counts item gives
   * the number); the count of PAIRS, not of arrows, decides.
   * @param {Object} delivery - The adapter's delivery
   * @returns {string|null} The sentence, or null when the item is omitted
   */
  function movementItem(delivery) {
    const pairs = distinctPairs(delivery.transitions);
    if (pairs.length === 0 || pairs.length > MAX_PAIRS_NAMED) return null;
    const parts = pairs.map((pair) => {
      const repeat = pair.times === 1 ? "" : ` (${pair.times === TWICE ? "twice" : `${count(pair.times)} times`})`;
      return `from ${domainLabel(delivery, pair.from)} to ${domainLabel(delivery, pair.to)}${repeat}`;
    });
    const single = pairs.length === 1 && pairs[0].times === 1;
    return `${single ? "The arrow runs" : "The arrows run"} ${commaAnd(parts)}.`;
  }

  /**
   * CN2 item (2): the layout sentence, continued with the labelled sentence
   * only while the domain descriptions are drawn.
   * @param {Object} delivery - The adapter's delivery
   * @returns {string} The item's text
   */
  function layoutItem(delivery) {
    const places = delivery.domains.map(
      (domain) => `${domain.label} ${domain.position === "centre" ? "in" : "at"} the ${domain.position}`
    );
    const layout = `The picture is divided into five domains: ${places.slice(0, -1).join(", ")}, and ${places[places.length - 1]}.`;
    return delivery.showDomainDescriptions ? `${layout} ${LAYOUT_LABELLED}` : layout;
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @returns {Array<string>} The Overview section's lines
   */
  function renderOverview(delivery) {
    const titled = !isBlank(delivery.title);
    const lines = ["<h4>Overview</h4>"];
    if (titled) lines.push(`<p>This Cynefin diagram is titled ${quoted(delivery.title)}.</p>`);

    // With no title there is no sentence before the list for "It" to point to.
    lines.push("<ul>", `<li>${titled ? "It" : "This Cynefin diagram"} has ${countList(delivery.domains, delivery.transitions)}.</li>`);
    lines.push(`<li>${layoutItem(delivery)}</li>`);

    const movement = movementItem(delivery);
    if (movement !== null) lines.push(`<li>${movement}</li>`);

    // MQ4, MQ5: the line is always named; the reason is framework meaning, read only with the descriptions.
    lines.push(`<li>${delivery.showDomainDescriptions ? `${CLIFF_FIRST} ${CLIFF_WHY}` : CLIFF_FIRST}</li>`);

    const allItems = delivery.domains.flatMap((domain) => domain.items);
    const hidden = allItems.filter((item) => item.placement === PLACEMENT_HIDDEN).length;
    const misplaced = allItems.filter((item) => item.placement !== PLACEMENT_OWN && item.placement !== PLACEMENT_HIDDEN).length;
    if (hidden > 0) {
      lines.push(
        `<li>${hidden === 1 ? "One item" : `${capitalise(count(hidden))} items`} in Confusion ${
          hidden === 1 ? "is" : "are"
        } ${NOT_DRAWN}.</li>`
      );
    }
    if (misplaced > 0) {
      lines.push(
        `<li>${
          misplaced === 1 ? "One item is drawn outside its own domain" : `${capitalise(count(misplaced))} items are drawn outside their own domain`
        } in the picture.</li>`
      );
    }
    lines.push("</ul>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // CN4, CN5: the Domains
  // ---------------------------------------------------------------------

  /**
   * CN4: the Labelled sentence, only while the descriptions are drawn.
   * @param {Object} delivery - The adapter's delivery
   * @param {Object} domain - A delivered domain
   * @returns {string} "Labelled "S1" and "S2". " with its trailing space, or ""
   */
  function labelledSentence(delivery, domain) {
    if (!delivery.showDomainDescriptions) return "";
    const lines = DRAWN_SUBTITLES[domain.key].map((line) => `"${readSubtitle(line)}"`);
    return `Labelled ${lines.join(" and ")}. `;
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @returns {Array<string>} The Domains section's lines
   */
  function renderDomains(delivery) {
    const lines = ["<h4>Domains</h4>"];
    delivery.domains.forEach((domain) => {
      lines.push(`<h5>${domain.label}, ${domain.position}</h5>`);
      const labelled = labelledSentence(delivery, domain);
      if (domain.items.length === 0) {
        lines.push(`<p>${labelled}No items.</p>`);
        return;
      }
      lines.push(`<p>${labelled}${capitalise(countPhrase(domain.items.length, "item", "items"))}:</p>`, "<ul>");
      domain.items.forEach((item) => {
        const text = isBlank(item.label) ? UNLABELLED_ITEM : quoted(item.label);
        const note = placementNote(item.placement, delivery);
        lines.push(`<li>${text}${note ? ` (${note})` : ""}</li>`);
      });
      lines.push("</ul>");
    });
    return lines;
  }

  // ---------------------------------------------------------------------
  // CN6: the Arrows
  // ---------------------------------------------------------------------

  /**
   * @param {number} n - How many times a (from, to) pair has been written so far
   * @returns {string} The ordinal word
   */
  function ordinal(n) {
    return n <= ORDINAL_TABLE_END ? ORDINALS[n] : `${n}th`;
  }

  /**
   * @param {Object} delivery - The adapter's delivery
   * @returns {Array<string>} The Arrows section's lines
   */
  function renderArrows(delivery) {
    const lines = ["<h4>Arrows</h4>", "<ol>"];
    const seen = new Map();
    delivery.transitions.forEach((transition) => {
      const pair = `${transition.from}>${transition.to}`;
      const times = (seen.get(pair) || 0) + 1;
      seen.set(pair, times);
      // An arrow label that draws nothing reads as if no label was written (F1).
      const labelled = isBlank(transition.label) ? "" : `, labelled ${quoted(transition.label)}`;
      const repeat = times > 1 ? ` (${ordinal(times)})` : "";
      lines.push(`<li>From ${domainLabel(delivery, transition.from)} to ${domainLabel(delivery, transition.to)}${labelled}${repeat}.</li>`);
    });
    lines.push("</ol>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // CN7: the Summary
  // ---------------------------------------------------------------------

  /**
   * @param {Object} delivery - The adapter's delivery
   * @returns {Array<string>} The lines of the Summary section
   */
  function renderSummary(delivery) {
    const domains = delivery.domains;
    const items = domains.reduce((total, domain) => total + domain.items.length, 0);
    const most = Math.max(...domains.map((domain) => domain.items.length));
    const tied = domains.filter((domain) => domain.items.length === most).map((domain) => domain.label);
    const empty = domains.filter((domain) => domain.items.length === 0).map((domain) => domain.label);
    const mostText =
      most === 0 ? "none" : `${commaAnd(tied)}, with ${countPhrase(most, "item", "items")}${tied.length > 1 ? " each" : ""}`;
    return [
      "<h4>Summary</h4>",
      "<dl>",
      `<dt>Items</dt><dd>${countOrNone(items)}</dd>`,
      `<dt>Arrows</dt><dd>${countOrNone(delivery.transitions.length)}</dd>`,
      `<dt>Most items</dt><dd>${mostText}</dd>`,
      `<dt>Empty domains</dt><dd>${empty.length === 0 ? "none" : commaAnd(empty)}</dd>`,
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
   * PARSE and tests for `false`, never falsiness: `parseCynefin` is what
   * STARTS the lazy self-check, and the flag reads `null` until it settles.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The verified delivery
   */
  async function readCynefin(code) {
    const delivery = await window.MermaidParseAdapter.parseCynefin(code);
    if (window.MermaidParseAdapter.isCynefinHealthy() === false) {
      logWarn("[Mermaid Accessibility] Cynefin self-check failed; refusing to narrate");
      throw new Error("Parse adapter failed its cynefin self-check; refusing to narrate an unverified diagram");
    }
    verifyDelivery(delivery);
    logDebug(
      `[Mermaid Accessibility] Cynefin delivery: ${delivery.domains.reduce((total, domain) => total + domain.items.length, 0)} item(s), ${
        delivery.transitions.length
      } arrow(s)`
    );
    return delivery;
  }

  /**
   * Generate the short description - rule CN1. The plain string is verbatim;
   * the HTML short is the escape of that one string, derived and never
   * composed a second time.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating cynefin short description");

    const delivery = await readCynefin(code);
    const text = buildSentence(delivery);
    logDebug(`[Mermaid Accessibility] Cynefin short: ${text}`);

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
   * Generate the detailed description - rules CN2 to CN7.
   *
   * Overview, Domains (always five), Arrows (only when any), then Summary
   * (always). Newline-joined so text-content extraction stays readable.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating cynefin detailed description");

    const delivery = await readCynefin(code);
    const parts = [...renderOverview(delivery), ...renderDomains(delivery)];
    if (delivery.transitions.length > 0) parts.push(...renderArrows(delivery));
    parts.push(...renderSummary(delivery));
    return parts.join("\n");
  }

  // Register with the core module. THE KEY IS "cynefin", AND THE DETECTOR ROW
  // THAT ROUTES TO IT LANDS IN THE SAME CHANGE AS THIS FILE'S SCRIPT TAG; a
  // generator registered without its MERMAID_TYPE_TO_KEY row registers and is
  // never called. generateShortHTML is the ASYNC shape and has to be: this
  // module awaits the parse adapter, so a synchronous one would yield
  // `undefined` silently (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("cynefin", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo("[Mermaid Accessibility] Cynefin module loaded and registered on the parse adapter's cynefin surface");
})();
