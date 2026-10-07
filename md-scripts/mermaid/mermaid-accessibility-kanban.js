/**
 * Mermaid Accessibility - Kanban Board Module
 *
 * Generates accessible descriptions for `kanban` boards from the shared parse
 * adapter's KANBAN surface (mermaid-parse-adapter.js), never from the SVG and
 * never from the diagram source. The eighteenth description generator and the
 * twelfth adapter-consuming one.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-kanban-gold-targets-2026-09-19.md - rules K1 to K15 (K13
 * withdrawn), rulings KR1 to KR11 and Matthew's review rulings MR1 and MR2
 * (VERSION 1, FROZEN 20 September 2026, approved by Matthew from the review
 * page) - and six byte-exact approved targets plus six RULED EDGES. A mismatch
 * between this module's output and a target is a STOP that goes back to the
 * design seat; it is never a reason to edit a target or a fixture. Register
 * item 88.
 *
 * THERE IS NO TITLE CLAUSE, ON EITHER TIER, AND NO AUTHOR OVERRIDE ROUTE FROM
 * HERE (rule K2). The kanban db carries no `getDiagramTitle`, `getAccTitle` or
 * `getAccDescription` accessor at all, and a frontmatter `title:` reaches
 * nothing. Worse than block's case: on this grammar an `accTitle:` or
 * `accDescr:` line is not a directive but a COLUMN LABEL, and the canvas draws
 * it as a spurious column (census § Q6, contradiction 3). So this module
 * narrates whatever the grammar delivered, which on such a source is an extra
 * column, and it invents nothing; the core's clause X3 route still carries the
 * author's own strings to the reader, and register item 81 carries the
 * fallback-wording question that follows.
 *
 * THIS FILE HOLDS NO REGEX, NO db READ, NO DOM READ AND NO URL LOGIC. Every
 * author string arrives already decoded by the surface's `decodeAuthorText`,
 * so THIS MODULE NEVER DECODES; it only escapes, once, at the HTML sink.
 *
 * AND IT NEVER TESTS A SCHEME OR BUILDS AN ADDRESS. Rule K9's second half and
 * ruling KS8 put the http/https allow-list in the adapter and nowhere else, so
 * K7 and K15 branch on the delivered `ticketUrl` being non-null and on nothing
 * else. A second scheme test here would be a second place for the allow-list to
 * be wrong, and the two could disagree silently.
 *
 * ONE BUILDER PER FACT, which is the rule the c4 arc's finding F4 paid for.
 * `columnName` names a column for K4's sentence and K6's list alike, carrying
 * K10's unlabelled arm and its one difference of case; `cardCountPhrase` gives
 * a card count its K1 number form for K1, K3, K4 and K6; `joinNoSerial` is
 * K4's join and serves K5's family list too; `buildCardLine` is the only place
 * a card is put into words. `P` and `U` are counted once, in `measure`, and
 * every rule that needs them reads them from there. A split would let the
 * overview's distribution and the Columns list disagree about the same board.
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
  //
  // A module-scope `const Common = window.MermaidAccessibilityCommon` captures
  // `undefined` permanently if this file ever loses the load race, and the
  // symptom is a TypeError deep inside a tier rather than anything naming the
  // load order. One property read per call cannot go stale. (Sequence, gantt,
  // XY chart, quadrant, block and c4 precedent.)

  /**
   * The shared prose layer (narrationNumber, capitalize, escapeHtml).
   * @returns {Object} MermaidAccessibilityCommon
   */
  function common() {
    return window.MermaidAccessibilityCommon;
  }

  /**
   * Escape one string of AUTHOR TEXT for an HTML sink - rule K9.
   *
   * The caller escapes, exactly once, at the point the field enters the HTML:
   * a column label, a card label, a ticket, an assignee, an UNDRAWN priority
   * value and the `ticketUrl` K15 writes into an href. Generator furniture -
   * the tags, the quotation marks round a label, the commas, the "and", the
   * disclosure in brackets - is never escaped. The PLAIN short tier is never
   * escaped at all (K1).
   *
   * ITEMS ARE ESCAPED BEFORE THEY ARE JOINED, never after: escaping a joined
   * string would reach the generator's own separators.
   *
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  /**
   * A count in rule K1's number form: words to nine, digits from 10.
   *
   * REUSED FROM `MermaidAccessibilityCommon`, not reimplemented. There is
   * deliberately no second number convention in this file, and every rule that
   * needs one reaches it through here or through `cardCountPhrase`.
   *
   * @param {number} value - The count
   * @returns {string} The narration form
   */
  function narrationCount(value) {
    return common().narrationNumber(value);
  }

  /**
   * A count in K1's number form, capitalised for the start of a sentence.
   *
   * K5's two sentences each open on a count, and a digit is unchanged by this -
   * "12" capitalises to "12".
   *
   * @param {number} value - The count
   * @returns {string} The narration form, first letter upper-case
   */
  function narrationCountCapitalised(value) {
    return common().capitalize(narrationCount(value));
  }

  // ---------------------------------------------------------------------
  // The vocabulary, closed and frozen
  // ---------------------------------------------------------------------

  /**
   * THE FOUR PRIORITY VALUES THE CANVAS DRAWS - rule K8.
   *
   * THIS LIST NO LONGER DECIDES WHICH ARM A CARD TAKES, since ruling KS9 of
   * 21 September 2026. The adapter delivers `priorityDrawn`, computed from the
   * RAW db bytes, and that is the decision; this list supplies the WORD, and
   * `lookUpDrawnFamily` throws if the surface names a value it does not carry.
   * The change is not cosmetic: the surface now DECODES the priority, so a
   * value written `H#105;gh` arrives here as the exact string `High` while the
   * renderer drew nothing for it. A match taken here would have narrated an
   * invisible mark as a drawn one.
   *
   * The `value` is still the EXACT string, never re-cased, trimmed or
   * normalised: rule K8 and ruling MR1 both turn on the canvas destroying the
   * difference between "High" and "high", so the words must not restore it.
   * "high" lower-case is an UNDRAWN priority and EDGE 5 pins it.
   *
   * THE ARRAY ORDER IS K5's FIXED FAMILY ORDER and is read as such by
   * `buildPrioritySentence`; it is not an implementation detail to be sorted.
   */
  const DRAWN_PRIORITIES = Object.freeze([
    Object.freeze({ value: "Very High", word: "very high" }),
    Object.freeze({ value: "High", word: "high" }),
    Object.freeze({ value: "Low", word: "low" }),
    Object.freeze({ value: "Very Low", word: "very low" }),
  ]);

  /** K10's substitute for an empty or whitespace-only column label. */
  const UNLABELLED_COLUMN = "An unlabelled column";

  /** The same phrase inside K4's sentence, where it is not sentence-initial. */
  const UNLABELLED_COLUMN_MID_SENTENCE = "an unlabelled column";

  /** K10's substitute for an empty or whitespace-only card label. */
  const UNLABELLED_CARD = "An unlabelled card";

  // ---------------------------------------------------------------------
  // Shared shapes
  // ---------------------------------------------------------------------

  /**
   * Is this metadata field narrated at all? - rules K7 and K10.
   *
   * TRIMMING IS A TEST FOR EMPTINESS ONLY (K10). Nothing here returns a
   * trimmed string, and no narrated byte in this file is ever trimmed: a
   * padded label is quoted with its padding, exactly as the canvas draws it.
   * The surface delivers `null` rather than `""` for an absent field, so the
   * empty-string arm is a defence rather than a live path.
   *
   * @param {string|null} value - A delivered metadata field
   * @returns {boolean} True when the field has something to read out
   */
  function isNarratable(value) {
    return value !== null && value.trim() !== "";
  }

  /**
   * Check one delivered metadata field is the string-or-null the surface
   * promises, and return it.
   *
   * A delivery this module does not understand THROWS, so the core's catch
   * reaches its generation-failed message and the reader is never handed a
   * board with parts of it silently missing. A dropped field is invisible: a
   * card short of its ticket looks exactly like a card with no ticket.
   *
   * @param {*} value - The delivered field
   * @param {string} field - Its name, for the message
   * @param {number} index - The card's position, for the message
   * @returns {string|null} The field, unchanged
   * @throws {Error} When the field is neither a string nor null
   */
  function requireStringOrNull(value, field, index) {
    if (value !== null && typeof value !== "string") {
      throw new Error(
        `Kanban card ${index} delivered a ${field} of type ${typeof value}; ` +
          "this generator narrates only the string-or-null the surface promises. " +
          "Refusing to narrate a board it does not understand."
      );
    }
    return value;
  }

  /**
   * Check one delivered BOOLEAN field is a boolean, and return it.
   *
   * A SEPARATE GUARD BECAUSE null IS NOT AN ACCEPTABLE VALUE HERE, and that is
   * the whole reason it cannot share `requireStringOrNull`. `priorityDrawn`
   * answers a question every card has an answer to, so an absent or null one
   * is a delivery this file does not understand rather than a card with
   * nothing to say. A missing key would otherwise arrive as `undefined`, which
   * is falsy, and every drawn priority on the board would silently take the
   * undrawn arm - the exact silent-drop shape the sibling guard exists to
   * refuse.
   *
   * @param {*} value - The delivered field
   * @param {string} field - Its name, for the message
   * @param {number} index - The card's position, for the message
   * @returns {boolean} The field, unchanged
   * @throws {Error} When the field is not a boolean
   */
  function requireBoolean(value, field, index) {
    if (typeof value !== "boolean") {
      throw new Error(
        `Kanban card ${index} delivered a ${field} of type ${typeof value}; ` +
          "this generator narrates only the boolean the surface promises for it. " +
          "Refusing to narrate a board it does not understand."
      );
    }
    return value;
  }

  /**
   * The family a DRAWN priority belongs to - rule K8's four values.
   *
   * THIS IS WHERE THE TWO COPIES OF THE VOCABULARY MEET, AND IT IS WHY THE
   * DUPLICATION IS SAFE. The adapter holds the four strings, to decide whether
   * the canvas drew anything; this file holds the four strings WITH THE WORD
   * each is spoken as, because it must say "high" rather than "High". Neither
   * can be derived from the other. A divergence between them would otherwise
   * be silent - a card the surface called drawn, whose value this file cannot
   * name - so it THROWS instead, and the reader gets the core's honest failure
   * rather than a board missing a priority.
   *
   * @param {string|null} value - The delivered priority
   * @returns {Object} The matching entry of DRAWN_PRIORITIES
   * @throws {Error} When no entry carries that value
   */
  function lookUpDrawnFamily(value) {
    const drawn = DRAWN_PRIORITIES.find((family) => family.value === value);
    if (!drawn) {
      throw new Error(
        `Kanban delivery says the canvas drew a priority mark for the value ` +
          `${JSON.stringify(value)}, which is not one of this generator's four ` +
          "drawn families. The adapter's drawn vocabulary and this file's have " +
          "diverged; refusing to narrate a board it does not understand."
      );
    }
    return drawn;
  }

  /**
   * Join a list of already-escaped items - rule K4's join, NO SERIAL COMMA.
   *
   * ONE JOIN SERVES K4 AND K5 (design constraint D2). `Common.formatList` is
   * deliberately NOT used: it writes an Oxford comma from three items up, and
   * K4 rules against one. Two joins in one file would be two chances to
   * disagree about the same sentence.
   *
   * @param {string[]} items - The parts, each already escaped where it carries
   *   author text
   * @returns {string} The joined list
   */
  function joinNoSerial(items) {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  /**
   * A card count as a noun phrase - rule K1's number form, for every rule.
   *
   * THE ONE BUILDER FOR A CARD COUNT (D2). K1's short, K3's overview opener,
   * K4's distribution and K6's list heading all read a card count, and all
   * four read it from here, so no two of them can disagree about a board.
   * Zero reads "no cards", which is K1's and K3's own spelling and is also
   * what K4 and K6 want for an empty column.
   *
   * @param {number} count - The number of cards
   * @returns {string} e.g. "no cards", "one card", "three cards", "10 cards"
   */
  function cardCountPhrase(count) {
    if (count === 0) return "no cards";
    return `${narrationCount(count)} card${count === 1 ? "" : "s"}`;
  }

  /**
   * A column count as a noun phrase - rule K1's number form.
   *
   * There is no zero arm, and that is a measurement rather than an omission:
   * K13 was WITHDRAWN by ruling KR2 because a board with no columns is a HARD
   * PARSE ERROR, so `parseKanban` rejects it and this module is never called.
   *
   * @param {number} count - The number of columns
   * @returns {string} e.g. "one column", "three columns", "12 columns"
   */
  function columnCountPhrase(count) {
    return `${narrationCount(count)} column${count === 1 ? "" : "s"}`;
  }

  // The option K6's list item passes to columnName to write a label's links.
  const LINKED_NAME = Object.freeze({ withLinks: true });

  /**
   * Name one column - rule K6's form, or rule K4's, carrying K10.
   *
   * THE ONE BUILDER FOR A COLUMN'S NAME (D2), because K4's sentence and K6's
   * list must never name the same column two ways. The only difference between
   * the two sites is the CASE of K10's unlabelled phrase, which is
   * sentence-initial in K6's list item and mid-sentence in K4's, so the case is
   * a parameter rather than a second function.
   *
   * The label is escaped here, once, at its only entry to the HTML.
   *
   * @param {Object} column - A delivered column
   * @param {boolean} midSentence - True for K4's sentence
   * @param {Object} [options] - `LINKED_NAME` to write the label's links
   * @returns {string} The quoted label, or K10's phrase
   */
  function columnName(column, midSentence, options) {
    if (!isNarratable(column.label)) {
      return midSentence ? UNLABELLED_COLUMN_MID_SENTENCE : UNLABELLED_COLUMN;
    }
    // Item 82, L2 (enactment 3): only K6's list item asks for the label's
    // links; K4's distribution sentence reads the text.
    if (options === LINKED_NAME) {
      return `"${common().renderSegmentsHtml(column.segments, column.label)}"`;
    }
    return `"${escapeText(column.label)}"`;
  }

  /**
   * Name one card - rule K7's opening, carrying K10.
   *
   * @param {Object} card - A delivered card
   * @returns {string} The quoted label, or K10's phrase
   */
  function cardName(card) {
    if (!isNarratable(card.label)) {
      return UNLABELLED_CARD;
    }
    // Item 82, L2 (enactment 3): the card's item is the label's only site.
    return `"${common().renderSegmentsHtml(card.segments, card.label)}"`;
  }

  // ---------------------------------------------------------------------
  // Measurement - every count taken once
  // ---------------------------------------------------------------------

  /**
   * Read the delivery into the facts every tier is built from.
   *
   * IT VALIDATES FIRST (design constraint D7). A delivery whose `diagramType`
   * is not `kanban`, whose `columns` is not an array, or which carries a card
   * that is not an object, throws rather than narrating part of a board.
   *
   * P AND U ARE COUNTED HERE AND NOWHERE ELSE. `P` is the number of cards
   * carrying one of K8's four DRAWN values and is the subject of K5's first
   * sentence; `U` is the number carrying any other non-whitespace priority and
   * is the subject of K5's second. They are counted in one pass over the same
   * cards the Columns list narrates, so the summary and the list cannot
   * disagree, and by construction they never overlap.
   *
   * `families` counts the drawn values by K5's fixed family order, indexed by
   * position in `DRAWN_PRIORITIES`.
   *
   * @param {Object} diagram - The adapter's kanban delivery
   * @returns {Object} The facts
   * @throws {Error} On a delivery this module does not understand
   */
  function measure(diagram) {
    if (!diagram || diagram.diagramType !== "kanban") {
      throw new Error(
        `Kanban generator received a delivery of type ${JSON.stringify(
          diagram && diagram.diagramType
        )}; refusing to narrate it as a Kanban board.`
      );
    }
    if (!Array.isArray(diagram.columns)) {
      throw new Error(
        "Kanban delivery carries no columns array; refusing to narrate a board it cannot read."
      );
    }

    const families = DRAWN_PRIORITIES.map(() => 0);
    let N = 0;
    let P = 0;
    let U = 0;

    const columns = diagram.columns.map((column, columnIndex) => {
      if (!column || typeof column !== "object") {
        throw new Error(
          `Kanban delivery carries a column at position ${columnIndex} that is not an object; refusing to narrate it.`
        );
      }
      const cards = Array.isArray(column.cards) ? column.cards : null;
      if (cards === null) {
        throw new Error(
          `Kanban column at position ${columnIndex} carries no cards array; refusing to narrate a partial board.`
        );
      }

      cards.forEach((card, cardIndex) => {
        if (!card || typeof card !== "object") {
          throw new Error(
            `Kanban column at position ${columnIndex} carries a card at position ${cardIndex} that is not an object; refusing to narrate it.`
          );
        }
        // Validate every narrated field once, here, rather than at each sink.
        requireStringOrNull(card.label, "label", cardIndex);
        requireStringOrNull(card.ticket, "ticket", cardIndex);
        requireStringOrNull(card.assigned, "assigned", cardIndex);
        requireStringOrNull(card.priority, "priority", cardIndex);
        requireBoolean(card.priorityDrawn, "priorityDrawn", cardIndex);
        requireStringOrNull(card.ticketUrl, "ticketUrl", cardIndex);

        N += 1;

        // K8's two arms, counted once. WHICH ARM IS THE SURFACE'S ANSWER, not
        // a string test taken here: the delivered priority is DECODED, and a
        // decoded string cannot tell a value the renderer drew from one that
        // merely reads like it (ruling KS9). `lookUpDrawnFamily` throws if the
        // two vocabularies have diverged, so a drawn card can never be
        // silently miscounted into the undrawn total.
        if (card.priorityDrawn) {
          families[DRAWN_PRIORITIES.indexOf(lookUpDrawnFamily(card.priority))] += 1;
          P += 1;
        } else if (isNarratable(card.priority)) {
          U += 1;
        }
      });

      requireStringOrNull(column.label, "label", columnIndex);
      return column;
    });

    return {
      columns: columns,
      C: columns.length,
      N: N,
      P: P,
      U: U,
      families: families,
    };
  }

  // ---------------------------------------------------------------------
  // The short tier - rule K1
  // ---------------------------------------------------------------------

  /**
   * The short description - rule K1.
   *
   * IT CARRIES NO AUTHOR TEXT, by rule, which is why `buildShortHtml` can be a
   * plain `escapeHtml` of it and why the two tiers are identical on every
   * target. That is a property of the sentence rather than a coincidence: the
   * short names no column and no card.
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The short sentence
   */
  function buildShortText(facts) {
    return `A Kanban board with ${columnCountPhrase(facts.C)} and ${cardCountPhrase(
      facts.N
    )}.`;
  }

  /**
   * The HTML short tier - DERIVED from the plain one and never composed.
   *
   * The sequence rebuild's structural answer, inherited: building the plain
   * sentence once and escaping it makes the two tiers incapable of disagreeing,
   * which is stronger than asserting that they agree. `gold-compare.mjs`
   * asserts the invariant on every target regardless.
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The escaped short sentence
   */
  function buildShortHtml(facts) {
    return escapeText(buildShortText(facts));
  }

  // ---------------------------------------------------------------------
  // The detailed tier - rules K3 to K8 and K15
  // ---------------------------------------------------------------------

  /**
   * Overview paragraph one - rule K3.
   *
   * NOT the short sentence reworded: it is its own sentence with its own
   * clause order, and it carries no author text either.
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The sentence
   */
  function buildOverviewSentence(facts) {
    return `This Kanban board shows ${cardCountPhrase(
      facts.N
    )} in ${columnCountPhrase(facts.C)}.`;
  }

  /**
   * Overview paragraph two, the distribution - rule K4.
   *
   * Left to right is the DELIVERY order, which the census measured to be the
   * canvas order (Q4); nothing here sorts or reorders.
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The sentence
   */
  function buildDistributionSentence(facts) {
    const parts = facts.columns.map(
      (column) =>
        `${columnName(column, true)} with ${cardCountPhrase(column.cards.length)}`
    );

    if (facts.C === 1) {
      return `The column is ${parts[0]}.`;
    }
    return `From left to right, the columns are ${joinNoSerial(parts)}.`;
  }

  /**
   * Overview paragraph three, the priority summary's FIRST sentence - rule K5.
   *
   * THE BRANCH IS ON THE NUMBER OF NON-ZERO FAMILIES, NOT ON P (ruling KR3).
   * With exactly one family non-zero the family word stands alone and carries
   * no count, because the count is already the sentence's subject: "Two cards
   * carry a priority: high." With two or more, each family reads its own count
   * and they join as K4 joins.
   *
   * It counts DRAWN priorities only, so it and the second sentence never
   * overlap and never share a paragraph.
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The sentence
   */
  function buildPrioritySentence(facts) {
    const present = DRAWN_PRIORITIES.map((family, index) => ({
      word: family.word,
      count: facts.families[index],
    })).filter((family) => family.count > 0);

    const list =
      present.length === 1
        ? present[0].word
        : joinNoSerial(
            present.map((family) => `${narrationCount(family.count)} ${family.word}`)
          );

    const opener =
      facts.P === 1
        ? "One card carries a priority"
        : `${narrationCountCapitalised(facts.P)} cards carry a priority`;

    return `${opener}: ${list}.`;
  }

  /**
   * The priority summary's SECOND sentence, its own paragraph - ruling KR10.
   *
   * THE WORD "more" IS PRESENT ONLY WHEN THE FIRST SENTENCE FIRED, because
   * with P zero there is no first group for these cards to be more than.
   * EDGE 5 pins that arm; E3 pins the other.
   *
   * Its own paragraph rather than a clause on the first, because the two
   * sentences count DIFFERENT things and joining them would invite a reader to
   * add the numbers.
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The sentence
   */
  function buildUndrawnPrioritySentence(facts) {
    const more = facts.P > 0 ? "more " : "";
    if (facts.U === 1) {
      return `One ${more}card has a priority in the code that the picture does not draw.`;
    }
    return `${narrationCountCapitalised(
      facts.U
    )} ${more}cards have a priority in the code that the picture does not draw.`;
  }

  /**
   * The priority phrase on one card line - rule K8, as restated by KR9.
   *
   * TWO ARMS AND NOTHING ELSE. A card the canvas DREW a mark for reads as the
   * words that colour stands for; ANY OTHER non-whitespace priority is an
   * UNDRAWN priority and is read out WITH ITS DISCLOSURE, quoted, escaped once
   * and never inflected or re-cased. A whitespace-only priority is not
   * narrated, by K10's emptiness test, because the author wrote nothing.
   *
   * WHICH ARM IS DECIDED BY `priorityDrawn` AND BY NOTHING ELSE, since ruling
   * KS9 of 21 September 2026. It used to be decided by matching the delivered
   * `priority` against this file's own four values, and that was measured
   * wrong on 21 September: the surface now DECODES the priority, and a value
   * written `H#105;gh` decodes to the exact string `High` while the renderer
   * — which compares the raw bytes — draws its mark with `stroke: none`. So
   * the decoded string cannot tell the two apart and this file must not try.
   * The value is still read off `priority`, because on a genuine drawn match
   * the raw and decoded strings are identical: a string carrying a sentinel or
   * an entity cannot be an exact match for any of the four.
   *
   * The disclosure's brackets and words are generator furniture and are not
   * escaped; only VALUE is.
   *
   * @param {Object} card - A delivered card
   * @returns {string} The phrase, opening with a comma, or "" when silent
   * @throws {Error} When the surface says the mark was drawn and this file's
   *   own vocabulary does not carry the value
   */
  function buildPriorityPhrase(card) {
    if (card.priorityDrawn) {
      return `, ${lookUpDrawnFamily(card.priority).word} priority`;
    }
    if (!isNarratable(card.priority)) {
      return "";
    }
    return `, priority "${escapeText(
      card.priority
    )}" (written in the code, not drawn in the picture)`;
  }

  /**
   * The ticket phrase on one card line - rule K7's part, or rule K15's.
   *
   * THE CHOICE IS MADE ON THE DELIVERED `ticketUrl` AND ON NOTHING ELSE, so
   * this rule never has to know what a URL is. The allow-list that decides
   * which addresses arrive lives in the adapter (ruling KS8) and nowhere else.
   * There is no third form and no fallback text: a refused base delivers null
   * and the plain part is what reads, which EDGE 6 pins.
   *
   * THE WORD "ticket" IS INSIDE THE LINK, so the link's accessible name says
   * what it is; a link named only "REL-20" tells a reader listening to a list
   * of links nothing at all. NO `target` and NO `title` attribute - the first
   * opens a window nobody asked for, and the second is forbidden by the
   * project's own accessibility rules.
   *
   * @param {Object} card - A delivered card
   * @returns {string} The phrase, opening with a comma, or "" when silent
   */
  function buildTicketPhrase(card) {
    if (!isNarratable(card.ticket)) {
      return "";
    }
    const quoted = `ticket "${escapeText(card.ticket)}"`;
    if (card.ticketUrl === null) {
      return `, ${quoted}`;
    }
    return `, <a href="${escapeText(card.ticketUrl)}">${quoted}</a>`;
  }

  /**
   * One card, as one list item's contents - rule K7.
   *
   * THE ONE BUILDER FOR A CARD LINE (D2). The parts appear in K7's order, each
   * only when its field has something to read out, and the line ends in a full
   * stop after the last part - whichever part that turns out to be.
   *
   * @param {Object} card - A delivered card
   * @returns {string} The card line, without its `<li>`
   */
  function buildCardLine(card) {
    const assignedPhrase = isNarratable(card.assigned)
      ? `, assigned to "${common().renderSegmentsHtml(
          card.assignedSegments,
          card.assigned
        )}"`
      : "";

    return (
      cardName(card) +
      buildTicketPhrase(card) +
      assignedPhrase +
      buildPriorityPhrase(card) +
      "."
    );
  }

  /**
   * One column, as list items - rule K6.
   *
   * A column with cards opens its own nested ordered list in the same item; a
   * column with no cards is one item ending in a full stop, with no list to
   * open. The nesting is written as the targets have it, with the inner `<ol>`
   * on the heading line and its close carrying the outer `</li>`.
   *
   * @param {Object} column - A delivered column
   * @returns {string[]} The lines for this column
   */
  function renderColumn(column) {
    const name = columnName(column, false, LINKED_NAME);
    const count = cardCountPhrase(column.cards.length);

    if (column.cards.length === 0) {
      return [`<li>${name}, ${count}.</li>`];
    }

    const lines = [`<li>${name}, ${count}:<ol>`];
    column.cards.forEach((card) => {
      lines.push(`<li>${buildCardLine(card)}</li>`);
    });
    lines.push("</ol></li>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // The registered tiers
  // ---------------------------------------------------------------------

  /**
   * Fetch and verify the diagram, or throw.
   *
   * A parse rejection is deliberately NOT caught - the core's catch turns it
   * into the honest generation-failed fallback. A failed adapter self-check
   * throws for the same reason: never narrate an unverified diagram.
   *
   * `isKanbanHealthy()` reads `null` until the lazy self-check settles, which
   * is why the guard tests for `false` rather than falsiness - a `!healthy`
   * test would refuse every first call on a page.
   *
   * THE GUARD RUNS AFTER THE PARSE, which is the block, sequence and c4 order:
   * `parseKanban` is what STARTS the lazy self-check, and the self-check takes
   * its own queue slot ahead of this call's, so a guard placed before the parse
   * reads `null` on the first call of every page and could never refuse - a
   * guard off the path it protects on exactly the call where an unhealthy
   * surface matters most.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised kanban delivery
   */
  async function readKanban(code) {
    const diagram = await window.MermaidParseAdapter.parseKanban(code);
    if (window.MermaidParseAdapter.isKanbanHealthy() === false) {
      logWarn(
        "[Mermaid Accessibility] Kanban self-check failed; refusing to narrate"
      );
      throw new Error(
        "Parse adapter failed its kanban self-check; refusing to narrate an unverified diagram"
      );
    }
    logDebug(
      `[Mermaid Accessibility] Kanban delivery: ${diagram.diagramType}, ${
        (diagram.columns || []).length
      } column(s)`
    );
    return diagram;
  }

  /**
   * Generate a short description for a kanban board - rule K1.
   *
   * The PLAIN form is the tier of record and is never escaped: it reaches a
   * `textContent` sink and the SVG's `aria-label`, where an entity would be
   * announced literally. The HTML form is the same sentence escaped exactly
   * once, and on this type the two are always identical because the sentence
   * carries no author text.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Kanban short description");

    const diagram = await readKanban(code);
    const facts = measure(diagram);
    const text = buildShortText(facts);
    logDebug(`[Mermaid Accessibility] Kanban short: ${text}`);

    return { html: buildShortHtml(facts), text: text };
  }

  /**
   * Wrapper for the short description generator, returning the plain tier.
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the plain text description
   */
  async function shortDescriptionWrapper(svgElement, code) {
    const descriptions = await generateShortDescription(svgElement, code);
    return descriptions.text;
  }

  /**
   * Generate a detailed description for a kanban board - rules K3 to K8, K15.
   *
   * `<h4>Overview</h4>` with the board's totals, the left-to-right
   * distribution, and K5's two priority paragraphs where they fire; then
   * `<h4>Columns</h4>` with one ordered list, one item per column in delivery
   * order, each column with cards opening a nested ordered list of them.
   *
   * THERE IS NO TITLE CLAUSE AND NO STYLING SECTION, by rules K2 and K11.
   *
   * NOTHING IS DE-DUPLICATED (K11, ruling KR7). A duplicate column id delivers
   * its cards to both columns, which is what the canvas draws, and EDGE 3 pins
   * it; a module that removed the repetition would be describing a board
   * nobody is looking at.
   *
   * Newline-joined so text-content extraction stays readable: without them,
   * list and heading boundaries concatenate with no space.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Kanban detailed description");

    const diagram = await readKanban(code);
    const facts = measure(diagram);

    const parts = [
      "<h4>Overview</h4>",
      `<p>${buildOverviewSentence(facts)}</p>`,
      `<p>${buildDistributionSentence(facts)}</p>`,
    ];

    // K5: the first sentence fires on a DRAWN priority, the second on an
    // undrawn one, and each is its own paragraph.
    if (facts.P > 0) {
      parts.push(`<p>${buildPrioritySentence(facts)}</p>`);
    }
    if (facts.U > 0) {
      parts.push(`<p>${buildUndrawnPrioritySentence(facts)}</p>`);
    }

    parts.push("<h4>Columns</h4>");
    parts.push("<ol>");
    facts.columns.forEach((column) => {
      parts.push(...renderColumn(column));
    });
    parts.push("</ol>");

    return parts.join("\n");
  }

  // Register with the core module. `generateShort` returns plain text because
  // the core assigns its result straight to descriptions.short, which reaches
  // the figcaption and the SVG aria-label.
  //
  // THE KEY IS "kanban", AND THE DETECTOR ROW THAT ROUTES TO IT LANDS IN THE
  // SAME CHANGE AS THIS FILE'S SCRIPT TAG. A generator registered without its
  // MERMAID_TYPE_TO_KEY row registers and is never called - the core resolves a
  // generator by the detected key, and without the row a kanban source resolves
  // to `unsupported:kanban` and reaches the honest fallback instead. The block
  // module shipped in exactly that state and its own header records the halt.
  //
  // generateShortHTML is the ASYNC shape, and it has to be: this module awaits
  // the parse adapter, so `generateShortDescription(...).html` on the returned
  // promise would be `undefined` and the tier would register, be called, and
  // yield nothing silently (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("kanban", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Kanban board module loaded and registered on the parse adapter's kanban surface"
  );
})();
