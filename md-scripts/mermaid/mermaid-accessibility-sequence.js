/**
 * Mermaid Accessibility - Sequence Diagram Module
 *
 * Generates accessible descriptions for `sequenceDiagram` diagrams from the
 * shared parse adapter's sequence surface (mermaid-parse-adapter.js), never
 * from the SVG and never from the diagram source. The ninth
 * adapter-consuming generator.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-sequence-gold-targets-2026-09-03.md — rules S1 to S16, rulings
 * R1 to R21 (VERSION 3, 4 September 2026, which enacted the hostile sweep's
 * findings; the rulings this file gained there are R14 attachment, R15 an
 * unnamed box and boxIndex, R16 an empty message text, R17 and R18 autonumber,
 * and R20 same-kind nested closers), and six byte-exact approved targets. A
 * mismatch between this
 * module's output and a target is a STOP that goes back to the design seat; it
 * is never a reason to edit a target or a fixture.
 *
 * WHY THE REWRITE. The module this replaces read the diagram source with its
 * own hand-written regexes, in 3,194 lines, and its defects were factual
 * rather than stylistic (grounding sections A2 to A4,
 * docs/mermaid-item-70-sequence-grounding-2026-09-02.md):
 *
 *   - ITS ARROW REGEX DEGRADED FOUR FORMS AND DROPPED TWO. The sender class was
 *     greedy enough to swallow a hyphen, so an UNSPACED two-dash arrow —
 *     `S-->>U: Fresh copy`, the commonest way anyone writes a reply — was read
 *     as a request. Both bidirectional forms (`<<->>`, `<<-->>`) were not
 *     recognised at all. Whether a message narrated as a reply therefore turned
 *     on whether the author had typed a space. The db carries an enumerated
 *     LINETYPE integer per arrow and has no such ambiguity; rule S7 is written
 *     against those ten constants.
 *   - IT FABRICATED A TITLE. An untitled diagram was narrated as "Sequence
 *     Diagram" or "Message Exchange Process"; rule S1 forbids both, and an
 *     untitled diagram now simply drops the title clause.
 *   - IT FABRICATED A FLOW NAME AND A HAPPY PATH, and asserted a purpose
 *     inferred from message text ("It primarily shows requests or commands").
 *     Rule S14 forbids every claim that does not trace to a delivered field or
 *     a count of delivered fields, so all of that prose is deleted rather than
 *     repaired.
 *   - IT LEAKED A GLOBAL. `generateFlowDescription` assigned to an undeclared
 *     `description`, and with no `"use strict"` in the file that created
 *     `window.description` on every detailed build (grounding A4.6) — an
 *     unusually collision-prone name on a page that also carries a description
 *     engine. This file is strict, so the class of defect cannot recur.
 *   - IT COMPUTED THE SHORT TIER TWICE, once plain and once with its own
 *     `<span class="diagram-title">` markup, so the two tiers could and did
 *     disagree. Rule S1 and the quadrant precedent give ONE plain string, built
 *     once, with the HTML tier as its escape.
 *
 * THE SOURCE IS READ BEHIND THE ADAPTER'S QUEUE, NOT HERE. Mermaid keeps the
 * diagram title, accessible title and accessible description in one
 * module-scoped store shared by every diagram type and cleared by every parse
 * (register item 21), so a read outside the adapter's queue slot can return
 * another diagram's title while looking live. This module holds no regex of
 * its own for that reason.
 *
 * ACCTITLE AND ACCDESCR ARE NOT NARRATED HERE (rule S15). The author override
 * is applied by the core, from a regex over the RAW source in
 * mermaid-accessibility-utils.js, after the generator block — so it reaches
 * every diagram type identically and no sentence in this file is on its path.
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
  // load order. One property read per call cannot go stale. (Gantt, XY chart
  // and quadrant precedent; the module this replaces used the cached-alias
  // form.)
  //
  // There is deliberately NO `MermaidAccessibilityUtils` handle. The module
  // this replaces carried one; every field this file narrates now arrives from
  // the adapter already decoded, so nothing is left for it to do.

  /**
   * The shared prose layer (narrationNumber, escapeHtml).
   * @returns {Object} MermaidAccessibilityCommon
   */
  function common() {
    return window.MermaidAccessibilityCommon;
  }

  /**
   * Escape one string of AUTHOR TEXT for an HTML sink.
   *
   * Knowledge base section 14.2: the caller escapes, exactly once, at the point
   * the field enters the HTML; generator furniture — the tags, the quotation
   * marks around a name, the commas, the "and" — is never escaped. The PLAIN
   * short tier is raw author text and calls none of this (rule S13).
   *
   * The adapter has already applied `decodePlaceholders` to every author-text
   * field it delivers (rule S16, ruling R10). THIS MODULE NEVER DECODES; it
   * only escapes, once, here.
   *
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  /**
   * Narration count: words for zero to nine, digits from 10. The one
   * number-to-word route in this module — there is deliberately no second
   * computation of it.
   * @param {number} value - The count
   * @returns {string} The count as it is spoken
   */
  function countWord(value) {
    return common().narrationNumber(value);
  }

  /**
   * A count and its noun: "six messages", "one message".
   * @param {number} value - The count
   * @param {string} singular - The singular noun
   * @param {string} plural - The plural noun
   * @returns {string} The counted noun
   */
  function countedNoun(value, singular, plural) {
    return `${countWord(value)} ${value === 1 ? singular : plural}`;
  }

  /**
   * Join a list with commas and a final "and", and NO OXFORD COMMA:
   * `"A", "B" and "C"`.
   *
   * MEASURED, NOT ASSUMED. `MermaidAccessibilityCommon`'s own `formatList`
   * returns `${others.join(", ")}, and ${last}` on three or more items — an
   * Oxford comma — which gold exemplars E2, E4 and E5 all contradict. Gantt
   * built the join locally twice and quadrant once for the same reason; this is
   * the fourth such site. The shared helper is not changed, because callers in
   * this file's siblings depend on the Oxford form.
   *
   * @param {Array<string>} items - The already-rendered items
   * @returns {string} The joined list
   */
  function joinNames(items) {
    if (!items || items.length === 0) return "";
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  // Rule S2's structure clause, in the rule's own fixed order. Only non-zero
  // entries are spoken. `rect` blocks and notes are absent on purpose (ruling
  // R6): a highlighted region is emphasis rather than control flow, and a
  // listener told "one highlighted region" in the short learns nothing about
  // the exchange.
  const STRUCTURE_NOUNS = Object.freeze([
    Object.freeze({ key: "loops", singular: "loop", plural: "loops" }),
    Object.freeze({
      key: "alternatives",
      singular: "alternative",
      plural: "alternatives",
    }),
    Object.freeze({
      key: "optionalSections",
      singular: "optional section",
      plural: "optional sections",
    }),
    Object.freeze({
      key: "parallelSections",
      singular: "parallel section",
      plural: "parallel sections",
    }),
    Object.freeze({
      key: "criticalSections",
      singular: "critical section",
      plural: "critical sections",
    }),
    Object.freeze({ key: "breaks", singular: "break", plural: "breaks" }),
  ]);

  // Rule S1 and ruling R4: participants are listed by name in the short up to
  // this many, and counted from one more. Four quoted names fit inside the
  // 250-character contract cap alongside a title and a structure clause; five
  // rarely do, and gold exemplar E6 is the witness.
  const NAME_LIST_MAX = 4;

  // Rule S9's two suffix phrases, quoted verbatim from the frozen gold. They
  // sit BEFORE the final full stop and after any S7 decoration.
  const ACTIVE_SUFFIX = ", which becomes active";
  const INACTIVE_SUFFIX = " and becomes inactive";

  // Rule S7 and ruling R16: what stands in the text slot when the author's
  // message text trims to nothing. Unquoted deliberately — quoting it would
  // claim the author wrote the words.
  const EMPTY_MESSAGE_TEXT = "an empty message";

  // Rule S6 and ruling R15: the opener of a box the author left unnamed. The
  // name clause is dropped rather than rendered as an empty pair of quotation
  // marks, matching S10's treatment of an empty block condition.
  const UNNAMED_BOX_OPENER = "A box, containing:";

  // ---------------------------------------------------------------------
  // Names (rules S5, S7, S11)
  // ---------------------------------------------------------------------

  /**
   * A lookup from participant id to DISPLAY NAME.
   *
   * Rule S5: participant ids — the part before "as" — are never narrated. The
   * adapter delivers `id` (the declared key) and `name` (the "as" text, or the
   * id when the author declared no alias), so the id is only ever reached as
   * the fallback below.
   *
   * @param {Object} diagram - The adapter's normalised sequence delivery
   * @returns {Function} id to display name
   */
  function makeNameLookup(diagram) {
    const byId = {};
    (diagram.participants || []).forEach((participant) => {
      byId[participant.id] = participant.name;
    });
    return function nameFor(id) {
      if (Object.prototype.hasOwnProperty.call(byId, id)) {
        return byId[id];
      }
      // Mermaid declares an actor implicitly on first use, so this branch is
      // not expected. Falling back to the id keeps the sentence honest rather
      // than printing "undefined"; the warning is what makes it visible.
      logWarn(
        `[Mermaid Accessibility] Sequence message names an undeclared participant: ${id}`
      );
      return typeof id === "string" ? id : "";
    };
  }

  /**
   * A display name, quoted and escaped for the HTML sink.
   * @param {string} name - The display name
   * @returns {string} The quoted name
   */
  function quoted(name) {
    return `"${escapeText(name)}"`;
  }

  // ---------------------------------------------------------------------
  // Message sentences (rule S7)
  // ---------------------------------------------------------------------

  /**
   * The verb clause of a message, without decoration, activation suffix or
   * full stop.
   *
   * Rule S7 keys the verb on the LINE STYLE and reserves the head for
   * decoration: solid narrates as "sends", dotted as "replies", and the
   * bidirectional head as "exchange" (rulings R2 and R3). ARROWHEAD SHAPE —
   * open against filled — is never narrated, because it carries no agreed
   * meaning a listener could use.
   *
   * RULING R16: A MESSAGE WHOSE TEXT TRIMS TO EMPTY names the absence instead
   * of quoting nothing — `sends an empty message to`, not `sends "" to`. The
   * canvas draws a zero-width space for such a message, so the empty pair of
   * quotation marks was a mark the diagram does not carry (sweep F3). The
   * substitution is of the TEXT TOKEN ONLY, which is why one branch serves all
   * three verbs: every S7 sentence puts the text in the same slot. Reachable
   * only from a whitespace-only text — `A->>B:` with nothing after the colon
   * is a parse error, so the module never sees it.
   *
   * @param {Object} event - A `kind: "message"` event
   * @param {Function} nameFor - Id to display name
   * @returns {string} The verb clause
   */
  function messageClause(event, nameFor) {
    const raw = typeof event.text === "string" ? event.text : "";
    const text = raw.trim() === "" ? EMPTY_MESSAGE_TEXT : quoted(raw);
    const from = quoted(nameFor(event.from));
    const to = quoted(nameFor(event.to));
    const isSelf = event.from === event.to;

    if (event.head === "bidirectional") {
      return `${from} and ${to} exchange ${text}`;
    }
    if (event.line === "dotted") {
      return isSelf
        ? `${from} replies to itself with ${text}`
        : `${from} replies to ${to} with ${text}`;
    }
    return isSelf
      ? `${from} sends ${text} to itself`
      : `${from} sends ${text} to ${to}`;
  }

  /**
   * The decoration a message's arrowHEAD earns (rule S7), placed before the
   * activation suffix and the full stop.
   *
   * A cross and the asynchronous form carry agreed meaning; a dotted
   * bidirectional line needs its line style spoken because "exchange" — unlike
   * "sends" and "replies" — does not encode it.
   *
   * @param {Object} event - A `kind: "message"` event
   * @returns {string} The decoration, or ""
   */
  function messageDecoration(event) {
    if (event.head === "cross") return ", marked with a cross";
    if (event.head === "async") return " asynchronously";
    if (event.head === "bidirectional" && event.line === "dotted") {
      return " on a dotted line";
    }
    return "";
  }

  // ---------------------------------------------------------------------
  // Block, note and activation sentences (rules S9, S10, S11)
  // ---------------------------------------------------------------------

  /**
   * Count each block instance's branches, over the whole event list, BEFORE
   * narration starts (rule S10).
   *
   * K — "the first of K alternatives", "the first of K" — is the branch count
   * plus one, and it has to be known at the block's OPENER, which is narrated
   * before its branches have been seen. Recovered with the same stack shape the
   * adapter's surface validated; the adapter has already refused any list whose
   * blocks do not balance, so no refusal path is needed here.
   *
   * @param {Array<Object>} events - The delivered event list
   * @returns {Object} Event index of each blockStart to its branch count
   */
  function countBranchesPerBlock(events) {
    const totals = {};
    const stack = [];
    events.forEach((event, index) => {
      if (event.kind === "blockStart") {
        totals[index] = 0;
        stack.push(index);
        return;
      }
      if (event.kind === "blockBranch") {
        const top = stack[stack.length - 1];
        if (top !== undefined) {
          totals[top] += 1;
        }
        return;
      }
      if (event.kind === "blockEnd") {
        stack.pop();
      }
    });
    return totals;
  }

  /**
   * A block opener's sentence (rule S10).
   *
   * AN EMPTY CONDITION IS A DOCUMENTED EDGE GAP in the gold document, so no
   * target fixes its wording. The label clause is omitted rather than rendered
   * as an empty pair of quotation marks, which keeps the spacing single and
   * adds no claim; it is flagged in the rebuild report for the design seat.
   *
   * RULING R13: WHEN K IS ONE the opener DROPS its count clause. An `alt`
   * with no `else` and a `par` with no `and` both deliver K = 1, and the
   * K-of-two-or-more wording would read "the first of one alternatives" —
   * a `one <plural>` that contract clause C8 fires on, and wrong English
   * about a single branch either way. K of two or more is unchanged.
   *
   * @param {Object} event - A `kind: "blockStart"` event
   * @param {number} branchCount - K, the branch count plus one
   * @returns {string} The sentence
   */
  function blockStartSentence(event, branchCount) {
    const label = event.label ? ` ${quoted(event.label)}` : "";
    const single = branchCount <= 1;
    switch (event.block) {
      case "loop":
        return `Loop${label} begins.`;
      case "alt":
        return single
          ? `Branch${label} begins.`
          : `Branch${label} begins, the first of ${countWord(
              branchCount
            )} alternatives.`;
      case "opt":
        return `Optional section${label} begins.`;
      case "par":
        return single
          ? `Parallel section${label} begins.`
          : `Parallel section${label} begins, the first of ${countWord(
              branchCount
            )}.`;
      case "critical":
        return `Critical section${label} begins.`;
      case "break":
        return `Break${label} begins.`;
      case "rect":
        // Ruling R6: the colour the author gave the region is never narrated.
        return "A highlighted region begins.";
      default:
        return "";
    }
  }

  /**
   * A block branch's sentence (rule S10). The unlabelled `par` form is the
   * gold's own; the unlabelled `alt` and `critical` forms follow it, because
   * neither is fixed by a target and an empty quoted label is worse.
   * @param {Object} event - A `kind: "blockBranch"` event
   * @returns {string} The sentence
   */
  function blockBranchSentence(event) {
    const label = event.label ? quoted(event.label) : "";
    switch (event.block) {
      case "alt":
        return label
          ? `Otherwise, branch ${label} begins.`
          : "Otherwise, another branch begins.";
      case "par":
        return label
          ? `In parallel, section ${label} begins.`
          : "In parallel, another section begins.";
      case "critical":
        return label
          ? `If needed, option ${label} begins.`
          : "If needed, another option begins.";
      default:
        return "";
    }
  }

  /**
   * A block closer's sentence (rule S10).
   *
   * RULING R13: the closer is SINGULAR when K is one, so it agrees with the
   * opener that dropped its count clause. K travels from the opener on the
   * open-block stack rather than being recounted here, because the closer's
   * own event carries no branch count.
   *
   * RULING R20: WHEN A BLOCK NESTS, OR IS NESTED IN, A BLOCK OF ITS OWN KIND,
   * the closer carries the OPENER'S LABEL. A `par` inside a `par` produced two
   * items both reading "The parallel sections end.", with the openers that
   * would disambiguate them three and four items earlier (sweep F10). The
   * label travels from the opener on the same stack K does, and the caller
   * passes "" when there is no same-kind relation — so a block with no
   * same-kind neighbour keeps the plain closer, which is why gold exemplar 3's
   * alt-inside-a-loop does not move.
   *
   * TWO COMBINATIONS R20 DOES NOT DECIDE, both flagged to the design seat
   * rather than settled here: a same-kind block whose opener carries NO label
   * falls through to the plain closer, because there is nothing to carry; and
   * a same-kind `alt` or `par` at K of ONE composes R13's singular with R20's
   * label clause. Neither is reached by any target or fixture.
   *
   * @param {Object} event - A `kind: "blockEnd"` event
   * @param {number} branchCount - K, as counted at the matching opener
   * @param {string} openerLabel - The opener's label when R20's same-kind test
   *   holds and the opener carried one; "" otherwise
   * @returns {string} The sentence
   */
  function blockEndSentence(event, branchCount, openerLabel) {
    const single = branchCount <= 1;
    const naming = typeof openerLabel === "string" && openerLabel !== "";
    const label = naming ? quoted(openerLabel) : "";
    switch (event.block) {
      case "loop":
        return naming ? `Loop ${label} ends.` : "The loop ends.";
      case "alt":
        if (single) {
          return naming
            ? `The branch that began with ${label} ends.`
            : "The branch ends.";
        }
        return naming
          ? `The alternatives that began with ${label} end.`
          : "The alternatives end.";
      case "opt":
        return naming
          ? `Optional section ${label} ends.`
          : "The optional section ends.";
      case "par":
        if (single) {
          return naming
            ? `The parallel section that began with ${label} ends.`
            : "The parallel section ends.";
        }
        return naming
          ? `The parallel sections that began with ${label} end.`
          : "The parallel sections end.";
      case "critical":
        return naming
          ? `Critical section ${label} ends.`
          : "The critical section ends.";
      case "break":
        return naming ? `Break ${label} ends.` : "The break ends.";
      case "rect":
        // Ruling R20 leaves rect unchanged: its opener carries a colour, never
        // a label, and R6 keeps the colour out of narration.
        return "The highlighted region ends.";
      default:
        return "";
    }
  }

  /**
   * A note's sentence (rule S11).
   *
   * The adapter delivers one actor for a single-actor note and two for a
   * spanning one — the db has no `isSpanning` field, so `from === to` IS the
   * signal and the surface has already resolved it into the array length.
   *
   * @param {Object} event - A `kind: "note"` event
   * @param {Function} nameFor - Id to display name
   * @returns {string} The sentence
   */
  function noteSentence(event, nameFor) {
    const text = quoted(event.text);
    const actors = (event.actors || []).filter(
      (actor) => actor !== null && actor !== undefined
    );
    if (actors.length > 1) {
      const names = joinNames(actors.map((actor) => quoted(nameFor(actor))));
      return `Note over ${names}: ${text}.`;
    }
    const who = quoted(nameFor(actors[0]));
    if (event.placement === "left") {
      return `Note to the left of ${who}: ${text}.`;
    }
    if (event.placement === "right") {
      return `Note to the right of ${who}: ${text}.`;
    }
    return `Note over ${who}: ${text}.`;
  }

  /**
   * A standalone activation sentence (rule S9) — the form an activation takes
   * when it does NOT immediately follow the message it belongs to.
   * @param {Object} event - An `activate` or `deactivate` event
   * @param {Function} nameFor - Id to display name
   * @returns {string} The sentence
   */
  function activationSentence(event, nameFor) {
    const who = quoted(nameFor(event.actor));
    return event.kind === "activate"
      ? `${who} becomes active.`
      : `${who} becomes inactive.`;
  }

  // ---------------------------------------------------------------------
  // The Messages list (rules S8, S9, R1)
  // ---------------------------------------------------------------------

  /**
   * Build one item per message, with every non-message entry attached to one of
   * them (rule S8).
   *
   * RULING R1 IS WHAT THIS FUNCTION EXISTS FOR. The list has EXACTLY
   * `counts.messages` items, so a listener who hears "item four" and sees the
   * diagram's own number 4 is looking at the same arrow. A flat list of every
   * delivered entry would break that correspondence, and a nested list per
   * block would restart the numbering inside each one.
   *
   * ATTACHMENT, in the rule's own terms:
   *   - block openers and branches attach FORWARD, to the next message item;
   *   - a block closer attaches BACKWARD, unless its block contains no message
   *     at all, in which case it joins its opener in the forward queue;
   *   - notes and standalone activations attach BACKWARD **only when no block
   *     opener or branch lies between them and the preceding message**, and
   *     otherwise join the FORWARD queue in source order beside those openers;
   *   - within an item: forward content in source order, the message sentence,
   *     then backward content in source order.
   *
   * RULING R14 IS THE SECOND CLAUSE, AND IT REPAIRS A REAL DEFECT. Before it,
   * a note inside an otherwise-empty `loop` was narrated on the message item
   * BEFORE the block, and the block was then narrated as empty — a listener
   * heard the note attached to a message it has nothing to do with, and heard
   * a loop containing nothing (sweep F1). The surface had delivered the note
   * in the right place, between the block's opener and its closer; the rule
   * was what was wrong, because S8's closer clause carried an inside-the-block
   * qualifier its note clause did not. `pendingForward` below is the test, set
   * by any opener or branch and cleared by the next message: it is a
   * SOURCE-ORDER test rather than a containment one, so it decides a note that
   * FOLLOWS a block as well as one INSIDE it, with one comparison.
   *
   * @param {Object} diagram - The adapter's normalised sequence delivery
   * @param {Function} nameFor - Id to display name
   * @returns {Array<Object>} One entry per message
   */
  function buildMessageItems(diagram, nameFor) {
    const events = diagram.events || [];
    const branchTotals = countBranchesPerBlock(events);
    const items = [];
    const forward = [];
    const openBlocks = [];

    // Set only while the IMMEDIATELY preceding event was a message, which is
    // what rule S9 turns an activation into a suffix on.
    let immediatelyAfter = null;

    // RULING R14's test: true from the moment a block opener or branch is seen
    // until the next message clears it. While it holds, a note or standalone
    // activation joins the forward queue instead of attaching backward, so it
    // is narrated in source order beside the openers it follows.
    let pendingForward = false;

    function lastItem() {
      return items.length > 0 ? items[items.length - 1] : null;
    }

    function attachBackward(sentence) {
      const item = lastItem();
      if (item) {
        item.backward.push(sentence);
        return;
      }
      forward.push(sentence);
    }

    // A note or standalone activation, placed by ruling R14. Before the first
    // message there is no item to attach to and the forward queue is the only
    // destination, which the same test reaches.
    function attachTrailing(sentence) {
      if (pendingForward) {
        forward.push(sentence);
        return;
      }
      attachBackward(sentence);
    }

    events.forEach((event, index) => {
      if (event.kind === "message") {
        const item = {
          event: event,
          forward: forward.splice(0, forward.length),
          suffix: "",
          backward: [],
        };
        items.push(item);
        immediatelyAfter = item;
        pendingForward = false;
        return;
      }

      if (event.kind === "activate" || event.kind === "deactivate") {
        const previous = immediatelyAfter;
        immediatelyAfter = null;
        if (previous && previous.suffix === "") {
          const matches =
            event.kind === "activate"
              ? previous.event.to === event.actor
              : previous.event.from === event.actor;
          if (matches) {
            previous.suffix =
              event.kind === "activate" ? ACTIVE_SUFFIX : INACTIVE_SUFFIX;
            return;
          }
        }
        attachTrailing(activationSentence(event, nameFor));
        return;
      }

      immediatelyAfter = null;

      if (event.kind === "note") {
        attachTrailing(noteSentence(event, nameFor));
        return;
      }
      if (event.kind === "blockStart") {
        // The stack carries K and the opener's LABEL as well as the item
        // index: ruling R13 makes the CLOSER's wording depend on the count
        // taken at the opener, and ruling R20 makes it depend on the opener's
        // label. `sameKind` starts false and is set below, from either
        // direction, when a block of this kind is found inside or outside it.
        const k = branchTotals[index] + 1;
        openBlocks.push({
          at: items.length,
          k: k,
          block: event.block,
          label: typeof event.label === "string" ? event.label : "",
          sameKind: false,
        });
        pendingForward = true;
        forward.push(blockStartSentence(event, k));
        return;
      }
      if (event.kind === "blockBranch") {
        pendingForward = true;
        forward.push(blockBranchSentence(event));
        return;
      }
      if (event.kind === "blockEnd") {
        const opened = openBlocks.pop() || {
          at: -1,
          k: 1,
          block: event.block,
          label: "",
          sameKind: false,
        };
        // RULING R20's test, taken over the WHOLE remaining stack rather than
        // its top, so it reaches any depth and any intervening block kind: a
        // loop inside an opt inside a loop names both loops. Marking runs in
        // both directions at once — the block just closed learns it had a
        // same-kind ancestor, and every same-kind ancestor learns it held a
        // same-kind descendant, while it is still open to be told.
        openBlocks.forEach((ancestor) => {
          if (ancestor.block === opened.block) {
            ancestor.sameKind = true;
            opened.sameKind = true;
          }
        });
        const sentence = blockEndSentence(
          event,
          opened.k,
          opened.sameKind ? opened.label : ""
        );
        if (opened.at === items.length) {
          // An empty block: no message arrived between its opener and its
          // closer, so both sentences go forward together.
          forward.push(sentence);
          return;
        }
        attachBackward(sentence);
      }
    });

    // A forward queue left over at the end can only be an empty block, or a
    // block closer, sitting after the last message. Rule S8 says every
    // non-message entry is narrated inside a message item, and the last item is
    // the only one available, so it takes them. A diagram with NO messages has
    // no Messages section at all (rule S3), and its queue is simply dropped.
    if (forward.length > 0) {
      const item = lastItem();
      if (item) {
        item.backward = item.backward.concat(forward);
      }
      forward.length = 0;
    }

    return items;
  }

  /**
   * Render the Messages list items.
   * @param {Array<Object>} items - From buildMessageItems
   * @param {Function} nameFor - Id to display name
   * @returns {Array<string>} The `<li>` lines
   */
  function renderMessageItems(items, nameFor) {
    return items.map((item) => {
      const sentence = `${messageClause(item.event, nameFor)}${messageDecoration(
        item.event
      )}${item.suffix}.`;
      const content = item.forward
        .concat([sentence])
        .concat(item.backward)
        .join(" ");
      return `<li>${content}</li>`;
    });
  }

  // ---------------------------------------------------------------------
  // The Participants list (rules S5, S6)
  // ---------------------------------------------------------------------

  /**
   * One participant's line: the display name quoted, then qualifiers in rule
   * S5's fixed order — person, created/destroyed, links — then a full stop.
   *
   * `createdAt` and `destroyedAt` are MESSAGE ORDINALS, not the db's list
   * index (ruling R7): the index counts markers and notes, so on gold exemplar
   * E5 the destroy index is 11 and the ordinal is seven. The adapter does that
   * conversion; this file narrates the ordinal it is given.
   *
   * A link's URL is escaped at this sink like every other author string, and is
   * delivered VERBATIM by the adapter — a URL is never transformed.
   *
   * @param {Object} participant - A participant from the delivery
   * @returns {string} The line, ending in a full stop
   */
  function participantText(participant) {
    let out = quoted(participant.name);

    // Ruling R5: the author who chose the stick figure over the box was saying
    // this one is a human, and that is author-declared information.
    if (participant.kind === "actor") {
      out += ", shown as a person";
    }

    const created =
      typeof participant.createdAt === "number" ? participant.createdAt : null;
    const destroyed =
      typeof participant.destroyedAt === "number"
        ? participant.destroyedAt
        : null;
    if (created !== null && destroyed !== null) {
      out += `, created by message ${countWord(
        created
      )} and destroyed by message ${countWord(destroyed)}`;
    } else if (created !== null) {
      out += `, created by message ${countWord(created)}`;
    } else if (destroyed !== null) {
      out += `, destroyed by message ${countWord(destroyed)}`;
    }

    // Ruling R8: the diagram offers a menu the listener cannot click, so the
    // URL is the only way to reach it.
    const links = Array.isArray(participant.links) ? participant.links : [];
    if (links.length > 0) {
      const rendered = links.map(
        (link) => `${quoted(link.label)} (${escapeText(link.url)})`
      );
      out += `, with ${countedNoun(
        links.length,
        "link",
        "links"
      )}: ${joinNames(rendered)}`;
    }

    return `${out}.`;
  }

  /**
   * The Participants list's inner lines (rules S5, S6).
   *
   * Boxes are nested lists. A box takes the position of its FIRST member in
   * declaration order, so ungrouped participants stay in declaration order
   * relative to it. Box colours are never narrated.
   *
   * MEMBERSHIP COMES FROM `participant.boxIndex` (ruling R15), the surface's
   * own index into `boxes`. This file used to rebuild the mapping from
   * `boxes[].members`, because the surface's older `box` field carried the
   * owning box's NAME and delivered `null` both for a participant in no box
   * and for a member of an UNNAMED one (sweep F12). The index cannot make that
   * mistake, and one lookup replaces a reconstruction.
   *
   * AN UNNAMED BOX drops its name clause and reads `A box, containing:`
   * (ruling R15). The canvas draws no label for it, so `Box "", containing:`
   * was an empty pair of quotation marks the diagram does not carry.
   *
   * @param {Object} diagram - The adapter's normalised sequence delivery
   * @returns {Array<string>} The lines between `<ul>` and `</ul>`
   */
  function buildParticipantLines(diagram) {
    const participants = diagram.participants || [];
    const boxes = diagram.boxes || [];

    const indexOf = (participant) =>
      typeof participant.boxIndex === "number" ? participant.boxIndex : null;

    const lines = [];
    const emitted = {};

    participants.forEach((participant) => {
      if (emitted[participant.id]) return;

      const boxIndex = indexOf(participant);
      const box = boxIndex === null ? null : boxes[boxIndex];

      if (!box) {
        emitted[participant.id] = true;
        lines.push(`<li>${participantText(participant)}</li>`);
        return;
      }

      const members = participants.filter(
        (candidate) => indexOf(candidate) === boxIndex
      );
      lines.push(
        box.name
          ? `<li>Box ${quoted(box.name)}, containing:`
          : `<li>${UNNAMED_BOX_OPENER}`
      );
      lines.push("<ul>");
      members.forEach((member) => {
        emitted[member.id] = true;
        lines.push(`<li>${participantText(member)}</li>`);
      });
      lines.push("</ul>");
      lines.push("</li>");
    });

    return lines;
  }

  // ---------------------------------------------------------------------
  // The Overview sentences (rules S1, S2, S4, S12)
  // ---------------------------------------------------------------------

  /**
   * The messages clause both tiers share: "six messages", or "no messages".
   * @param {Object} diagram - The adapter's normalised sequence delivery
   * @returns {string} The clause
   */
  function messagesClause(diagram) {
    const count = diagram.counts ? diagram.counts.messages : 0;
    return count === 0 ? "no messages" : countedNoun(count, "message", "messages");
  }

  /**
   * Rule S2's counts, in the rule's fixed order, non-zero only.
   * @param {Object} diagram - The adapter's normalised sequence delivery
   * @returns {string} The joined list, or ""
   */
  function structureList(diagram) {
    const counts = diagram.counts || {};
    const rendered = [];
    STRUCTURE_NOUNS.forEach((noun) => {
      const value = typeof counts[noun.key] === "number" ? counts[noun.key] : 0;
      if (value > 0) {
        rendered.push(countedNoun(value, noun.singular, noun.plural));
      }
    });
    return joinNames(rendered);
  }

  /**
   * The detailed tier's opening sentence (rule S1).
   *
   * NO FALLBACK TITLE EVER. An untitled diagram drops the clause; a frontmatter
   * `title:` never reaches `getDiagramTitle` and so narrates as untitled
   * (ruling R9, item 77).
   *
   * @param {Object} diagram - The adapter's normalised sequence delivery
   * @returns {string} The sentence
   */
  function buildOpeningSentence(diagram) {
    const title = diagram.title ? ` titled ${quoted(diagram.title)}` : "";
    const participantCount = (diagram.participants || []).length;
    return `This sequence diagram${title} shows ${messagesClause(
      diagram
    )} between ${countedNoun(
      participantCount,
      "participant",
      "participants"
    )}.`;
  }

  /**
   * The detailed tier's structure sentence (rule S2), or "".
   * @param {Object} diagram - The adapter's normalised sequence delivery
   * @returns {string} The sentence
   */
  function buildStructureSentence(diagram) {
    const list = structureList(diagram);
    return list ? `It includes ${list}.` : "";
  }

  /**
   * The numbering sentence (rule S12), or "".
   *
   * The AUTONUMBER entry with `visible` true is the ONLY honest signal:
   * `showSequenceNumbers()` reads false on a diagram that has autonumber, and
   * `getConfig().showSequenceNumbers` reads true on every diagram because it is
   * the page's own Mermaid config. Both were measured wrong and rejected at the
   * surface, so this file never sees them.
   *
   * The `<ol>` itself is deliberately never given a `start` attribute.
   *
   * RULING R17: THE SURFACE DELIVERS EVERY DIRECTIVE, as an array in source
   * order, each carrying the ordinal of the first message it governs. A single
   * directive that is visible and governs from message one is the only case in
   * which S12's three sentences can be true of the whole diagram; every other
   * case — an `off`, a mid-diagram start, two directives — reads `Only some
   * messages are numbered in the diagram.` and says nothing further. This is
   * what closes sweep F4, where `autonumber` followed by `autonumber off`
   * overwrote the surface's single object and the description said NOTHING
   * about numbering while the canvas drew the numbers 1 and 2, and sweep F5,
   * where a mid-diagram `autonumber` claimed every message was numbered when
   * the first was not.
   *
   * RULING R18: an undefined start or step READS AS ONE, and each clause is
   * dropped at one. Mermaid supplies `step: 1` for `autonumber 5`, so the
   * pre-R18 wording asserted a step the author never wrote (sweep F6) and
   * S12's middle form was unreachable.
   *
   * RULING R22 NARROWS R17: the sentence fires only when at least one
   * DELIVERED directive is VISIBLE. A directive set in which no entry carries
   * `visible: true` says nothing about numbering at all, because the canvas
   * draws no numbers — a LONE `autonumber off` is the reachable case, and it
   * was the EDGE GAP this function's previous comment registered. R17's
   * second branch is unchanged for every set that HAS a visible directive, so
   * `autonumber` … `autonumber off` still reads "Only some messages are
   * numbered", which is true of that diagram: the canvas draws 1 and 2.
   *
   * The test is over ANY entry, not the LAST one. Testing the last gives the
   * same answer on a lone `off` and the WRONG answer on a visible directive
   * followed by an `off`.
   *
   * @param {Object} diagram - The adapter's normalised sequence delivery
   * @returns {string} The sentence
   */
  function buildNumberingSentence(diagram) {
    const directives = Array.isArray(diagram.autonumber)
      ? diagram.autonumber
      : [];
    if (directives.length === 0) return "";
    if (!directives.some((directive) => directive.visible === true)) return "";

    const only = directives.length === 1 ? directives[0] : null;
    const governsEveryMessage =
      only !== null && only.visible === true && only.atOrdinal === 1;
    if (!governsEveryMessage) {
      return "Only some messages are numbered in the diagram.";
    }

    const start = typeof only.start === "number" ? only.start : 1;
    const step = typeof only.step === "number" ? only.step : 1;
    const from = start === 1 ? "" : ` from ${countWord(start)}`;
    const steps = step === 1 ? "" : ` in steps of ${countWord(step)}`;
    return `Messages are numbered in the diagram${from}${steps}.`;
  }

  /**
   * THE ONE SHORT STRING, built once, plain and unescaped (rules S1, S2, S13).
   *
   * The HTML short tier is this string escaped exactly once, and nothing else —
   * so the two tiers cannot disagree about what the diagram says. The module
   * this replaces computed them separately, wrapping the title in a
   * `<span class="diagram-title">`; the shell-level presentation pass owns that
   * treatment, and the gold's HTML-short invariant forbids it here.
   *
   * There is no length-discipline branch. The short is a SINGLE sentence
   * carrying the title, the message count, the participants and the structure
   * clause — all of it author text or a count of delivered fields — so there is
   * nothing that could be dropped without dropping a fact. Ruling R4's count
   * form is what keeps a wide diagram inside the corpus cap.
   *
   * @param {Object} diagram - The adapter's normalised sequence delivery
   * @returns {string} The plain short tier
   */
  function buildShortText(diagram) {
    const title = diagram.title ? ` titled "${diagram.title}"` : "";
    const participants = diagram.participants || [];
    const count = participants.length;
    const between =
      count >= 1 && count <= NAME_LIST_MAX
        ? joinNames(participants.map((participant) => `"${participant.name}"`))
        : countedNoun(count, "participant", "participants");
    const list = structureList(diagram);
    const including = list ? `, including ${list}` : "";
    return `A sequence diagram${title} with ${messagesClause(
      diagram
    )} between ${between}${including}.`;
  }

  // ---------------------------------------------------------------------
  // The registered tiers
  // ---------------------------------------------------------------------

  /**
   * Fetch and verify the diagram, or throw.
   *
   * A parse rejection is deliberately NOT caught — the core's catch turns it
   * into the honest generation-failed fallback. A failed adapter self-check
   * throws for the same reason: never narrate an unverified diagram. The
   * adapter's own block-stack refusals arrive here as rejections and are
   * treated identically, which is the point of refusing rather than repairing:
   * a mis-paired block would otherwise be narrated as a diagram nobody drew.
   *
   * `isSequenceHealthy()` reads `null` until the lazy self-check settles, which
   * is why the guard tests for `false` rather than falsiness — a `!healthy`
   * test would refuse every first call on a page.
   *
   * A DIAGRAM WITH NO MESSAGES DOES NOT THROW, unlike quadrant's no-points
   * case: rules S1 and S3 both narrate it, with "no messages" and with the
   * Messages section omitted.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised sequence delivery
   */
  async function readSequence(code) {
    const diagram = await window.MermaidParseAdapter.parseSequence(code);
    if (window.MermaidParseAdapter.isSequenceHealthy() === false) {
      logWarn(
        "[Mermaid Accessibility] Sequence self-check failed; refusing to narrate"
      );
      throw new Error(
        "Parse adapter failed its sequence self-check; refusing to narrate an unverified diagram"
      );
    }
    return diagram;
  }

  /**
   * Generate a short description for a sequence diagram.
   *
   * The PLAIN form is the tier of record and is never escaped: it reaches a
   * `textContent` sink and the SVG's `aria-label`, where an entity would be
   * announced literally. The HTML form is the same sentence escaped exactly
   * once.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating sequence short description");

    const diagram = await readSequence(code);
    const text = buildShortText(diagram);
    logDebug(`[Mermaid Accessibility] Sequence short: ${text}`);

    return { html: escapeText(text), text: text };
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
   * Generate a detailed description for a sequence diagram.
   *
   * Three headed sections in a fixed order (rule S3): Overview, Participants,
   * Messages. No `<section>` wrapper, no Key Insights, no data table, and none
   * of the old module's "What is a sequence diagram", "Understanding the
   * Diagram", flow-name or happy-path prose — the shell-level presentation pass
   * owns section treatment, and rule S14 forbids the rest.
   *
   * Gantt G3's rule that a heading introducing no content is omitted entirely
   * is inherited: a diagram with zero messages has no Messages section.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating sequence detailed description");

    const diagram = await readSequence(code);
    const nameFor = makeNameLookup(diagram);

    // Rule S4's order: the opening, the structure sentence, the numbering
    // sentence, each present only when it fires.
    const overview = [
      buildOpeningSentence(diagram),
      buildStructureSentence(diagram),
      buildNumberingSentence(diagram),
    ]
      .filter((sentence) => sentence)
      .join(" ");

    const parts = [];
    const pushSection = (heading, lines) => {
      if (!lines || lines.length === 0) return;
      parts.push(`<h4>${heading}</h4>`);
      parts.push(...lines);
    };
    const wrapList = (tag, inner) =>
      inner.length === 0 ? [] : [`<${tag}>`].concat(inner).concat([`</${tag}>`]);

    pushSection("Overview", overview ? [`<p>${overview}</p>`] : []);
    pushSection("Participants", wrapList("ul", buildParticipantLines(diagram)));
    pushSection(
      "Messages",
      wrapList(
        "ol",
        renderMessageItems(buildMessageItems(diagram, nameFor), nameFor)
      )
    );

    // Newline-joined so text-content extraction stays readable: without them,
    // list and heading boundaries concatenate with no space.
    return parts.join("\n");
  }

  // Register with the core module. `generateShort` returns plain text because
  // the core assigns its result straight to descriptions.short, which reaches
  // the figcaption and the SVG aria-label.
  //
  // The key is "sequenceDiagram", which is what mermaid-diagram-detection.js
  // returns for this type. NOTE THAT MERMAID'S OWN `detectType` RETURNS
  // "sequence": the detection module's MERMAID_TYPE_TO_KEY maps the one to the
  // other, and registering on the raw Mermaid name would register a generator
  // nothing ever calls.
  //
  // generateShortHTML is the ASYNC shape, and it has to be: this module awaits
  // the parse adapter, so `generateShortDescription(...).html` on the returned
  // promise would be `undefined` and the tier would register, be called, and
  // yield nothing silently (register item 13). The module this replaces used
  // exactly that synchronous shape, which was safe only because it read the
  // source synchronously.
  window.MermaidAccessibility.registerDescriptionGenerator("sequenceDiagram", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Sequence diagram module loaded and registered on the parse adapter's sequence surface"
  );
})();
