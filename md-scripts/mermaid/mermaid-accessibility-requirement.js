/**
 * Mermaid Accessibility - Requirement Diagram Module
 *
 * Generates accessible descriptions for `requirementDiagram` sources from the
 * shared parse adapter's REQUIREMENT surface (mermaid-parse-adapter.js,
 * `parseRequirement`), never from the SVG and never from the diagram source.
 * The twenty-first description generator (register item 110) and the
 * fourteenth surface's consumer.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-requirement-gold-targets-2026-10-07.md - rules RQ1 to RQ12,
 * rulings RR1 to RR11 and Matthew's ruling MR1 (VERSION 1, FROZEN 8 October
 * 2026) - and six byte-exact targets plus eleven ruled edges. A mismatch
 * between this module's output and a target is a STOP that goes back to the
 * design seat; it is never a reason to edit a target or a fixture.
 *
 * THIS FILE HOLDS NO REGEX, NO db READ, NO DOM READ AND NO URL LOGIC. Every
 * author string arrives already decoded by the surface, so THIS MODULE NEVER
 * DECODES; it only escapes, once, at the HTML sink. Links are written only by
 * `renderSegmentsHtml`, at a box's ITEM (its first narration); every later
 * mention (the relationship lines) reads the text (item 82, L2).
 *
 * THERE IS NO accTitle OR accDescr NARRATION HERE (clause X3 is the core's).
 * The title is narrated whoever wrote it (RQ11).
 *
 * ONE BUILDER PER FACT, which is the rule the c4 arc's finding F4 paid for:
 * `kindPhrase` is the only place a kind becomes words (RQ4), `countPhrase`
 * the only place a count agrees with its noun (RQ1), `boxRef` the only place a
 * box is named inside a relationship line (RQ5, RQ9 and the EDGE 7 qualifier),
 * `buildRelationshipLine` the only place a relationship is put into words, and
 * `measure` counts every tally once so the Overview and the Summary cannot
 * disagree about the same diagram.
 *
 * ENDS ARE MATCHED ON THE RAW KEY AND NARRATED BY THE DECODED NAME (RR7). A
 * relationship attaches to the box whose raw declared name it names, so two
 * boxes whose names decode alike are still two boxes. The later of such a pair
 * carries the generator's own ordinal, outside the quotation marks, in
 * declaration order - "x" and "x" (second) - on every narration of it (seat
 * ruling of 9 October 2026, quadrant Q15's form). The author's name is
 * qualified, never inflected.
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

  // ---------------------------------------------------------------------
  // The shared prose layer, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------

  /**
   * The shared prose layer (narrationNumber, capitalize, escapeHtml,
   * renderSegmentsHtml). One property read per call cannot go stale.
   * @returns {Object} MermaidAccessibilityCommon
   */
  function common() {
    return window.MermaidAccessibilityCommon;
  }

  /**
   * Escape one string of AUTHOR TEXT for an HTML sink - rule RQ10. The caller
   * escapes, exactly once, where the field enters the HTML; generator
   * furniture is never escaped and the PLAIN short is never escaped at all.
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  // ---------------------------------------------------------------------
  // The vocabulary, closed and frozen
  // ---------------------------------------------------------------------

  /** RQ4's six kind words, keyed on the surface's closed kind vocabulary. */
  const KIND_PHRASES = Object.freeze({
    Requirement: "a requirement",
    "Functional Requirement": "a functional requirement",
    "Interface Requirement": "an interface requirement",
    "Performance Requirement": "a performance requirement",
    "Physical Requirement": "a physical requirement",
    "Design Constraint": "a design constraint",
  });

  /** RQ3's Risk order, high first, as the surface delivers each value. */
  const RISK_ORDER = Object.freeze([
    Object.freeze({ value: "High", word: "high" }),
    Object.freeze({ value: "Medium", word: "medium" }),
    Object.freeze({ value: "Low", word: "low" }),
  ]);

  /** RQ3's Verification order, with the "by" clause each carries. */
  const METHOD_ORDER = Object.freeze([
    Object.freeze({ value: "Test", word: "test" }),
    Object.freeze({ value: "Analysis", word: "analysis" }),
    Object.freeze({ value: "Inspection", word: "inspection" }),
    Object.freeze({ value: "Demonstration", word: "demonstration" }),
  ]);

  /** RQ3's Relationships order. */
  const VERB_ORDER = Object.freeze([
    "contains",
    "copies",
    "derives",
    "satisfies",
    "verifies",
    "refines",
    "traces",
  ]);

  /** RQ8's disclosure, kanban MR1's wording. */
  const NOT_DRAWN_DISCLOSURE = "(written in the code, not drawn in the picture)";

  /** RR4's absence phrase. */
  const NOT_STATED = "not stated";

  /** Ordinal words for the EDGE 7 qualifier: words to ninth, digits from 10th. */
  const ORDINAL_WORDS = Object.freeze([
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
  ]);

  /** The two box types, as the words and the lookup use them. */
  const BOX = Object.freeze({
    REQUIREMENT: "requirement",
    ELEMENT: "element",
  });

  // ---------------------------------------------------------------------
  // Small builders
  // ---------------------------------------------------------------------

  /**
   * Is this delivered field narrated at all? A value that draws nothing reads
   * exactly as an absent one (RQ4, M2). Trimming is a test for emptiness only.
   * @param {string|null} value - A delivered field
   * @returns {boolean} True when the field has something to read out
   */
  function isNarratable(value) {
    return typeof value === "string" && value.trim() !== "";
  }

  /**
   * A count as a word: "no" for zero, words to nine, digits from 10.
   * @param {number} value - The count
   * @returns {string} The count word
   */
  function countWord(value) {
    return value === 0 ? "no" : common().narrationNumber(value);
  }

  /**
   * A count with its noun in agreement: "one requirement", "no elements".
   * @param {number} value - The count
   * @param {string} singular - The singular noun
   * @param {string} plural - The plural noun
   * @returns {string} The counted noun phrase
   */
  function countPhrase(value, singular, plural) {
    return `${countWord(value)} ${value === 1 ? singular : plural}`;
  }

  /**
   * Join items "a", "a and b", "a, b and c".
   * @param {Array<string>} items - The items
   * @returns {string} The joined list
   */
  function joinList(items) {
    if (items.length <= 1) {
      return items.join("");
    }
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  /**
   * A 1-based position as an ordinal: "first" to "ninth", then "10th".
   * @param {number} position - The position
   * @returns {string} The ordinal
   */
  function ordinalWord(position) {
    if (position >= 1 && position <= ORDINAL_WORDS.length) {
      return ORDINAL_WORDS[position - 1];
    }
    const lastTwo = position % 100;
    const lastOne = position % 10;
    let suffix = "th";
    if (lastTwo < 11 || lastTwo > 13) {
      if (lastOne === 1) suffix = "st";
      else if (lastOne === 2) suffix = "nd";
      else if (lastOne === 3) suffix = "rd";
    }
    return `${position}${suffix}`;
  }

  /**
   * RQ4: a surface kind as the words that follow the name.
   * @param {string} kind - A delivered kind
   * @returns {string} "a requirement", "an interface requirement" ...
   * @throws {Error} For a kind this module does not know
   */
  function kindPhrase(kind) {
    const phrase = KIND_PHRASES[kind];
    if (!phrase) {
      throw new Error(
        `Requirement kind ${JSON.stringify(kind)} is not one this generator narrates; refusing to narrate a diagram it does not understand.`
      );
    }
    return phrase;
  }

  /**
   * Check a delivered field is a string or null, and return it. A delivery
   * this module does not understand THROWS so the core reaches its honest
   * generation-failed message.
   * @param {*} value - The delivered field
   * @param {string} field - Its name, for the message
   * @returns {string|null} The field unchanged
   * @throws {Error} When the field is neither
   */
  function requireStringOrNull(value, field) {
    if (value !== null && typeof value !== "string") {
      throw new Error(
        `Requirement delivery carried a ${field} of type ${typeof value}; refusing to narrate a diagram it does not understand.`
      );
    }
    return value;
  }

  // ---------------------------------------------------------------------
  // Measurement - every box, every end and every count taken once
  // ---------------------------------------------------------------------

  /**
   * Resolve the picture's boxes and every relationship's two ends.
   *
   * A box is a DRAWN requirement or an element. Ends are matched on the RAW
   * key (RR7); when a requirement and an element share a name the canvas
   * draws the element, so the element is the box (RR5, M5). Each box carries
   * its declaration position among its own kind (RQ9) and, when its decoded
   * name repeats an earlier box's, the ordinal that qualifies it (EDGE 7).
   *
   * @param {Object} diagram - The adapter's normalised requirement delivery
   * @returns {Object} The facts every builder reads
   * @throws {Error} When a relationship names a box the picture does not draw
   */
  function measure(diagram) {
    const requirements = diagram.requirements || [];
    const elements = diagram.elements || [];
    const relationships = diagram.relationships || [];

    const boxes = [];
    const byRawName = new Map();

    elements.forEach((element, index) => {
      requireStringOrNull(element.type, "element type");
      requireStringOrNull(element.docRef, "element document reference");
      const box = {
        type: BOX.ELEMENT,
        item: element,
        position: index + 1,
        qualifier: null,
        rels: [],
      };
      boxes.push(box);
      byRawName.set(element.rawName, box);
    });

    const requirementBoxes = requirements.map((requirement, index) => {
      requireStringOrNull(requirement.id, "requirement id");
      requireStringOrNull(requirement.text, "requirement text");
      requireStringOrNull(requirement.risk, "requirement risk");
      requireStringOrNull(requirement.verifyMethod, "requirement verify method");
      kindPhrase(requirement.kind);
      const box = {
        type: BOX.REQUIREMENT,
        item: requirement,
        position: index + 1,
        qualifier: null,
        rels: [],
      };
      if (requirement.drawn === true) {
        boxes.push(box);
        if (!byRawName.has(requirement.rawName)) {
          byRawName.set(requirement.rawName, box);
        }
      }
      return box;
    });

    // EDGE 7: requirements then elements, the delivery's own order.
    const drawnInOrder = requirementBoxes
      .filter((box) => box.item.drawn === true)
      .concat(boxes.filter((box) => box.type === BOX.ELEMENT));
    const seenNames = new Map();
    drawnInOrder.forEach((box) => {
      if (!isNarratable(box.item.name)) {
        return;
      }
      const seen = (seenNames.get(box.item.name) || 0) + 1;
      seenNames.set(box.item.name, seen);
      if (seen > 1) {
        box.qualifier = ordinalWord(seen);
      }
    });

    const resolved = relationships.map((relationship) => {
      const source = byRawName.get(relationship.rawSource);
      const target = byRawName.get(relationship.rawTarget);
      if (!source || !target) {
        throw new Error(
          "Requirement relationship names a box the picture does not draw; refusing to narrate a diagram it does not understand."
        );
      }
      const entry = { relationship, source, target };
      source.rels.push(entry);
      if (target !== source) {
        target.rels.push(entry);
      }
      return entry;
    });

    const drawnRequirements = requirementBoxes.filter(
      (box) => box.item.drawn === true
    );

    return {
      title: isNarratable(diagram.title) ? diagram.title : null,
      requirementBoxes: requirementBoxes,
      elementBoxes: boxes.filter((box) => box.type === BOX.ELEMENT),
      drawnRequirements: drawnRequirements,
      relationships: resolved,
      R: drawnRequirements.length,
      E: elements.length,
      K: relationships.length,
    };
  }

  // ---------------------------------------------------------------------
  // Names
  // ---------------------------------------------------------------------

  /**
   * The qualifier suffix for a box: " (second)" or the empty string.
   * Generator furniture, outside the quotation marks (EDGE 7).
   * @param {Object} box - A resolved box
   * @returns {string} The suffix
   */
  function qualifierSuffix(box) {
    return box.qualifier ? ` (${box.qualifier})` : "";
  }

  /**
   * A box's positional name for RQ9: "Unlabelled requirement 2".
   * @param {Object} box - A resolved box
   * @param {boolean} sentenceInitial - True at the head of an item
   * @returns {string} The positional name
   */
  function unlabelledName(box, sentenceInitial) {
    const text = `unlabelled ${box.type} ${box.position}`;
    return sentenceInitial ? common().capitalize(text) : text;
  }

  /**
   * A box named inside a relationship line: `"NAME"` plus the EDGE 7
   * qualifier, or RQ9's positional name when the name draws nothing. Reads
   * the TEXT of the name and never a link (item 82, L2).
   * @param {Object} box - A resolved box
   * @returns {string} The reference, escaped once
   */
  function boxRef(box) {
    if (!isNarratable(box.item.name)) {
      return unlabelledName(box, false);
    }
    return `"${escapeText(box.item.name)}"${qualifierSuffix(box)}`;
  }

  /**
   * A box named at the head of its own item - the first narration, so the one
   * place a link the picture draws on the name is written (RQ10).
   * @param {Object} box - A resolved box
   * @returns {string} The head, escaped once, with any not-drawn disclosure
   */
  function boxHead(box) {
    const item = box.item;
    let head;
    if (!isNarratable(item.name)) {
      head = unlabelledName(box, true);
    } else {
      // A requirement's and an element's name can both carry a link the
      // canvas draws (item 110, F0); without segments this escapes the name.
      const label = common().renderSegmentsHtml(item.nameSegments, item.name);
      head = `"${label}"${qualifierSuffix(box)}`;
    }
    if (box.type === BOX.REQUIREMENT && item.drawn !== true) {
      head += ` ${NOT_DRAWN_DISCLOSURE}`;
    }
    return head;
  }

  // ---------------------------------------------------------------------
  // The sentences
  // ---------------------------------------------------------------------

  /**
   * RQ1: the overview sentence in PLAIN form, the tier of record. The title
   * is verbatim and the generator's quotation marks are raw.
   * @param {Object} facts - The measured diagram
   * @param {Function} esc - Applied to the author title only
   * @returns {string} The sentence
   */
  function buildOverviewSentence(facts, esc) {
    const titled = facts.title === null ? "" : ` titled "${esc(facts.title)}"`;
    return (
      `A requirement diagram${titled} with ` +
      `${countPhrase(facts.R, "requirement", "requirements")}, ` +
      `${countPhrase(facts.E, "element", "elements")} and ` +
      `${countPhrase(facts.K, "relationship", "relationships")}.`
    );
  }

  /**
   * RQ1: the SHORT, plain. Never escaped.
   * @param {Object} facts - The measured diagram
   * @returns {string} The plain short
   */
  function buildShortText(facts) {
    return buildOverviewSentence(facts, (title) => title);
  }

  /**
   * RQ1: the SHORT HTML, DERIVED as escapeHtml of the one plain string - two
   * tiers, one value, so they cannot disagree.
   * @param {string} plainShort - The plain short
   * @returns {string} The escaped short
   */
  function buildShortHtml(plainShort) {
    return escapeText(plainShort);
  }

  /**
   * RQ5: one relationship in the drawn direction, or a self-relationship.
   * @param {Object} entry - A resolved relationship
   * @returns {string} The sentence, escaped once
   */
  function buildRelationshipLine(entry) {
    const verb = entry.relationship.verb;
    if (entry.source === entry.target) {
      return `${boxRef(entry.source)} ${verb} itself.`;
    }
    return `${boxRef(entry.source)} ${verb} ${boxRef(entry.target)}.`;
  }

  /**
   * RQ4: the Risk and verification sentence, always written (RR4).
   * @param {Object} requirement - A delivered requirement
   * @returns {string} The sentence
   */
  function buildRiskSentence(requirement) {
    const risk =
      requirement.risk === null
        ? `Risk ${NOT_STATED}`
        : `Risk ${requirement.risk.toLowerCase()}`;
    const method =
      requirement.verifyMethod === null
        ? `verification ${NOT_STATED}`
        : `verified by ${requirement.verifyMethod.toLowerCase()}`;
    return `${risk}, ${method}.`;
  }

  /**
   * RQ4 / RQ6: wrap a first line and a box's relationship lines into one
   * list item, with the nested list only when there is something to nest.
   * @param {string} firstLine - The item's opening text
   * @param {Object} box - A resolved box
   * @returns {Array<string>} The lines of the item
   */
  function renderItem(firstLine, box) {
    if (box.rels.length === 0) {
      return [`<li>${firstLine}</li>`];
    }
    const lines = [`<li>${firstLine}`, "<ul>"];
    box.rels.forEach((entry) => {
      lines.push(`<li>${buildRelationshipLine(entry)}</li>`);
    });
    lines.push("</ul>", "</li>");
    return lines;
  }

  /**
   * RQ4: one requirement item.
   * @param {Object} box - A resolved requirement box
   * @returns {Array<string>} The lines of the item
   */
  function renderRequirement(box) {
    const requirement = box.item;
    let first = `${boxHead(box)}, ${kindPhrase(requirement.kind)}`;
    if (isNarratable(requirement.id)) {
      first += `, id "${common().renderSegmentsHtml(
        requirement.idSegments,
        requirement.id
      )}"`;
    }
    if (isNarratable(requirement.text)) {
      first += `: "${common().renderSegmentsHtml(
        requirement.textSegments,
        requirement.text
      )}"`;
    }
    first += `. ${buildRiskSentence(requirement)}`;
    // RQ8: a requirement the picture does not draw carries no nested list.
    return renderItem(first, requirement.drawn === true ? box : { rels: [] });
  }

  /**
   * RQ6: one element item.
   * @param {Object} box - A resolved element box
   * @returns {Array<string>} The lines of the item
   */
  function renderElement(box) {
    const element = box.item;
    const type = isNarratable(element.type)
      ? `type "${common().renderSegmentsHtml(
          element.typeSegments,
          element.type
        )}"`
      : `type ${NOT_STATED}`;
    let first = `${boxHead(box)}, ${type}`;
    if (isNarratable(element.docRef)) {
      first += `, document reference "${common().renderSegmentsHtml(
        element.docRefSegments,
        element.docRef
      )}"`;
    }
    first += ".";
    return renderItem(first, box);
  }

  /**
   * RQ3: a tally clause list over a closed vocabulary, zero counts omitted,
   * with a trailing "N not stated" when any field was absent.
   * @param {Array<{value: string, word: string}>} order - The vocabulary
   * @param {Array<string|null>} values - One delivered value per requirement
   * @param {Function} wording - Turns (count, word) into a clause
   * @returns {string} The joined tally
   */
  function buildTally(order, values, wording) {
    const clauses = [];
    order.forEach((entry) => {
      const count = values.filter((value) => value === entry.value).length;
      if (count > 0) {
        clauses.push(wording(count, entry.word));
      }
    });
    const missing = values.filter((value) => value === null).length;
    if (missing > 0) {
      clauses.push(`${common().narrationNumber(missing)} ${NOT_STATED}`);
    }
    return joinList(clauses);
  }

  /**
   * RQ3: the Relationships tally, count before verb (RR1), or "none".
   * @param {Object} facts - The measured diagram
   * @returns {string} The tally
   */
  function buildRelationshipTally(facts) {
    const clauses = [];
    VERB_ORDER.forEach((verb) => {
      const count = facts.relationships.filter(
        (entry) => entry.relationship.verb === verb
      ).length;
      if (count > 0) {
        clauses.push(`${common().narrationNumber(count)} ${verb}`);
      }
    });
    return clauses.length === 0 ? "none" : joinList(clauses);
  }

  /**
   * RQ3 / MR1: the Summary definition list. The Relationships row is always
   * written; Risk and Verification are dropped when no requirement is drawn.
   * @param {Object} facts - The measured diagram
   * @returns {Array<string>} The lines of the section
   */
  function renderSummary(facts) {
    const lines = ["<h4>Summary</h4>", "<dl>"];
    if (facts.R > 0) {
      const risks = facts.drawnRequirements.map((box) => box.item.risk);
      const methods = facts.drawnRequirements.map(
        (box) => box.item.verifyMethod
      );
      lines.push(
        `<dt>Risk</dt><dd>${buildTally(
          RISK_ORDER,
          risks,
          (count, word) => `${common().narrationNumber(count)} ${word}`
        )}</dd>`
      );
      lines.push(
        `<dt>Verification</dt><dd>${buildTally(
          METHOD_ORDER,
          methods,
          (count, word) => `${common().narrationNumber(count)} by ${word}`
        )}</dd>`
      );
    }
    lines.push(`<dt>Relationships</dt><dd>${buildRelationshipTally(facts)}</dd>`);
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
   * PARSE and tests for `false`, never falsiness: `parseRequirement` is what
   * STARTS the lazy self-check, and the flag reads `null` until it settles.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised requirement delivery
   */
  async function readRequirement(code) {
    const diagram = await window.MermaidParseAdapter.parseRequirement(code);
    if (window.MermaidParseAdapter.isRequirementHealthy() === false) {
      logWarn(
        "[Mermaid Accessibility] Requirement self-check failed; refusing to narrate"
      );
      throw new Error(
        "Parse adapter failed its requirement self-check; refusing to narrate an unverified diagram"
      );
    }
    logDebug(
      `[Mermaid Accessibility] Requirement delivery: ${diagram.diagramType}, ${
        (diagram.requirements || []).length
      } requirement(s)`
    );
    return diagram;
  }

  /**
   * Generate the short description - rule RQ1.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Requirement short description");

    const diagram = await readRequirement(code);
    const facts = measure(diagram);
    const text = buildShortText(facts);
    logDebug(`[Mermaid Accessibility] Requirement short: ${text}`);

    return { html: buildShortHtml(text), text: text };
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
   * Generate the detailed description - rules RQ2 to RQ10.
   *
   * Overview (the RQ1 sentence alone), Requirements, Elements (each omitted
   * when empty), then a Summary that is never omitted (MR1). Newline-joined so
   * text-content extraction stays readable.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo(
      "[Mermaid Accessibility] Generating Requirement detailed description"
    );

    const diagram = await readRequirement(code);
    const facts = measure(diagram);

    const parts = [
      "<h4>Overview</h4>",
      `<p>${buildOverviewSentence(facts, escapeText)}</p>`,
    ];

    if (facts.requirementBoxes.length > 0) {
      parts.push("<h4>Requirements</h4>", "<ol>");
      facts.requirementBoxes.forEach((box) => {
        parts.push(...renderRequirement(box));
      });
      parts.push("</ol>");
    }

    if (facts.elementBoxes.length > 0) {
      parts.push("<h4>Elements</h4>", "<ol>");
      facts.elementBoxes.forEach((box) => {
        parts.push(...renderElement(box));
      });
      parts.push("</ol>");
    }

    parts.push(...renderSummary(facts));

    return parts.join("\n");
  }

  // Register with the core module. THE KEY IS "requirement", AND THE DETECTOR
  // ROW THAT ROUTES TO IT LANDS IN THE SAME CHANGE AS THIS FILE'S SCRIPT TAG;
  // a generator registered without its MERMAID_TYPE_TO_KEY row registers and is
  // never called. generateShortHTML is the ASYNC shape and has to be: this
  // module awaits the parse adapter, so a synchronous one would yield
  // `undefined` silently (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("requirement", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Requirement diagram module loaded and registered on the parse adapter's requirement surface"
  );
})();
