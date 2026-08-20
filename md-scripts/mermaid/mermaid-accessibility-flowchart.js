/**
 * Mermaid Accessibility - Flowchart Module
 * Generates accessible descriptions for flowchart diagrams
 * Enhanced to properly handle complex flowcharts with labeled edges
 */
const FlowchartModule = (function () {
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

  // Current logging level (can be modified at runtime if needed)
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logError(context, message) {
    if (!shouldLog(LOG_LEVELS.ERROR)) return;

    if (typeof message === "object") {
      console.error(`[Flowchart][ERROR][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.error(`[Flowchart][ERROR][${context}] ${message}`);
    }
  }

  /**
   * Log a warning message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logWarn(context, message) {
    if (!shouldLog(LOG_LEVELS.WARN)) return;

    if (typeof message === "object") {
      console.warn(`[Flowchart][WARN][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.warn(`[Flowchart][WARN][${context}] ${message}`);
    }
  }

  /**
   * Log an info message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logInfo(context, message) {
    if (!shouldLog(LOG_LEVELS.INFO)) return;

    if (typeof message === "object") {
      console.log(`[Flowchart][INFO][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Flowchart][INFO][${context}] ${message}`);
    }
  }

  /**
   * Log a debug message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logDebug(context, message) {
    if (!shouldLog(LOG_LEVELS.DEBUG)) return;

    if (typeof message === "object") {
      console.log(`[Flowchart][DEBUG][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[Flowchart][DEBUG][${context}] ${message}`);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("Module Check", "Core module not loaded!");
    return;
  }

  // Shared prose layer (loads before every diagram module — knowledge base
  // § 2): narrationNumber, labelFullStop, formatList, capitalize.
  const Common = window.MermaidAccessibilityCommon;

  // Direction phrases for the short description. The adapter has already
  // collapsed the TD synonym to TB, so only these four keys can arrive.
  const DIRECTION_PHRASES = Object.freeze({
    TB: "top to bottom",
    BT: "bottom to top",
    LR: "left to right",
    RL: "right to left",
  });

  // DECISION_NODE_RATIO retired in Session 5. It gated a "decision flowchart"
  // opening the gold short tier does not have: all six frozen shorts open
  // "A flowchart of N steps", whatever the diamond ratio. Nothing else read it.

  /**
   * Generate a short description for a flowchart
   *
   * Async since stage 2 of the flowchart rewrite: the values come from the
   * parse adapter's normalised graph, not from the SVG or a source-text
   * scan. A parse rejection is deliberately NOT caught here — the core's
   * catch turns it into the generation-failed fallback.
   *
   * Since Session 5 this runs the SAME traversal the detailed tier runs, so
   * the two tiers cannot disagree about how many steps there are, where the
   * flow begins and ends, or how many loops it has. That is the whole reason
   * the traversal is called from here rather than the counts being
   * re-derived: the previous short tier counted nodes and read the direction
   * and shared nothing else with the detailed tier.
   *
   * @param {HTMLElement} svgElement - Unused since stage 2; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to an object with HTML and plain text versions of the description
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("generateShortDescription", "Generating short description");

    const graph = withNarratableLabels(
      await window.MermaidParseAdapter.parse(code)
    );
    if (window.MermaidParseAdapter.isHealthy() === false) {
      throw new Error(
        "Parse adapter failed its self-check; refusing to narrate an unverified graph"
      );
    }

    const descriptions = buildShortTier(graph, buildFlowchartTraversal(graph));
    logDebug("Final Short Description", descriptions.text);
    return descriptions;
  }

  /**
   * Wrapper for the short description generator to maintain backwards compatibility
   * @param {HTMLElement} svgElement - Unused since stage 2; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the plain text description
   */
  async function shortDescriptionWrapper(svgElement, code) {
    const descriptions = await generateShortDescription(svgElement, code);

    // Return text version for backwards compatibility
    return descriptions.text;
  }


  // ---------------------------------------------------------------------
  // Stage 3: the detailed tier on the parse adapter — traversal + narration
  // ---------------------------------------------------------------------

  // Edge kinds that impose order, start to end (stage 0 M2). Open links
  // (arrow_open) connect two steps without direction: they count for
  // connectivity and the "also linked to" narration, never for numbering.
  // R22 DOUBLE-ENDED EDGES (ruled 20 August 2026, gold targets version 8).
  // The three kinds Mermaid emits for a link with an arrowhead at BOTH ends:
  // `<-->`, `o--o` and `x--x`. They are ordering edges and they narrate
  // through one set of paths, which is why this is a named set rather than
  // three string comparisons — the probe sweep found the two new members
  // matching NEITHER branch of the edge classification and vanishing from the
  // description entirely, and a set is what stops that recurring the next time
  // Mermaid adds an arrowhead pair.
  const DOUBLE_ARROW_KINDS = Object.freeze([
    "double_arrow_point",
    "double_arrow_circle",
    "double_arrow_cross",
  ]);
  const isDoubleArrow = (edge) => DOUBLE_ARROW_KINDS.includes(edge.kind);

  const ORDERING_EDGE_KINDS = Object.freeze([
    "arrow_point",
    "arrow_circle",
    "arrow_cross",
    ...DOUBLE_ARROW_KINDS,
  ]);

  /**
   * R24 LINE BREAKS IN LABELS (ruled 20 August 2026, gold targets version 9).
   *
   * A label carrying a line break arrives with the tag as LITERAL CHARACTERS
   * in the label string, so it is escaped at the sink and read aloud as
   * markup — the probe sweep measured "First line&lt;br&gt;Second line", which
   * a screen reader announces as the tag. The design seat ruled it a single
   * space. It is not a markdown question and needs no `labelType`: the tag is
   * text whatever the label's type.
   *
   * MEASURED, not assumed (20 August 2026): Mermaid normalises EVERY spelling
   * the author can write — `<br>`, `<br/>`, `<br />`, `<BR>`, `<Br/>`,
   * `<BR />` — to lowercase `<br>` before the adapter sees it. The pattern
   * still matches the variants, because that costs nothing and survives a
   * Mermaid change that stops normalising.
   *
   * A RUN of tags collapses to ONE space, which is why the quantifier wraps
   * the whole group: two adjacent tags matched separately would each leave a
   * space and the label would gain a double one. Whitespace the author wrote
   * elsewhere is untouched — a general collapse would edit author text, and
   * the standing convention is that author labels are verbatim.
   */
  const LINE_BREAK_TAGS = /(?:\s*<br\s*\/?>\s*)+/gi;

  /**
   * @param {string} text - A delivered label or subgraph title
   * @returns {string} The same text with line-break tags read as spaces
   */
  function collapseLineBreaks(text) {
    if (typeof text !== "string" || text === "") return text;
    return text.replace(LINE_BREAK_TAGS, " ").trim();
  }

  /**
   * Apply R24 ONCE, to a shallow copy of the parsed graph, before anything
   * reads a label. This is the choke point: the traversal, the step renderer,
   * the short tier, the group headings and the isolated-node list all read
   * their text from this object, so no site can be missed and no site has to
   * remember. It runs BEFORE escaping everywhere, per the standing rule that
   * transforms come first and the escape is last.
   *
   * The adapter's own objects are never mutated — the parse queue hands them
   * out and another consumer may hold them.
   *
   * @param {Object} graph - The parse adapter's normalised graph
   * @returns {Object} The same shape, with narratable label text
   */
  function withNarratableLabels(graph) {
    return {
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        label: collapseLineBreaks(node.label),
      })),
      edges: graph.edges.map((edge) => ({
        ...edge,
        label: collapseLineBreaks(edge.label),
      })),
      subgraphs: graph.subgraphs.map((sub) => ({
        ...sub,
        title: collapseLineBreaks(sub.title),
      })),
    };
  }

  /**
   * R21 INVISIBLE LINKS (ruled 20 August 2026, gold targets version 8).
   *
   * Mermaid's `~~~` arrives as kind `arrow_open` with `stroke: "invisible"`,
   * which is the ONLY thing separating it from an author's `---` association —
   * the probe sweep measured two diagrams differing only in that operator
   * producing byte-identical descriptions. The edge is kept for ORDERING and
   * narrated by no sentence of its own: an invisible link is written to force
   * layout, so the ordering it implies is the ordering the author meant a
   * reader to follow, while the visible connection it does not draw must not
   * be claimed.
   *
   * This is the ONLY place the module reads `stroke`, and it reads it for this
   * one value. Dotted and thick carry no guaranteed meaning in Mermaid, so
   * narrating them would invent semantics — the standing convention that
   * stroke styles are never narrated still holds for them (R21, ruling 6).
   *
   * @param {Object} edge - A normalised edge from the parse adapter
   * @returns {boolean} True when the author drew this link to be unseen
   */
  const isInvisibleLink = (edge) => edge.stroke === "invisible";

  // R11 NUMBERS (gold targets, version 2): "Step totals in digits ("13
  // steps"); descriptive counts in words ("four decision points"); step
  // references in words up to nine and digits from 10."
  //
  // Step totals are interpolated as raw digits below; every other number
  // goes through Common.narrationNumber, which is words to nine and digits
  // from 10. That satisfies R11's step-reference clause exactly, and its
  // descriptive-count clause for every count the corpus can produce — the
  // two readings of that clause (always words, or the shared word form)
  // diverge only at a descriptive count of 10 or more, which no fixture and
  // no exemplar reaches. The divergence is recorded rather than resolved
  // here: resolving it towards "always words" needs an unbounded
  // number-to-words converter with no target to check it against, and
  // narrationNumber is shared with every other diagram module, so it could
  // not be changed from this file in any case.
  //
  // Oxford-comma joining, label full stops and capitalisation also come
  // from the shared prose layer since the helper promotion (register
  // item: shared narration helpers).

  // The sentences R3, R5 and R13 pin, named so the rule each implements is
  // visible where it is used. Frozen-object enum per the codebase's
  // no-magic-strings convention.
  const NARRATION = Object.freeze({
    // R3: the overview convention that lets every in-sequence step stay silent.
    SEQUENCE_CONVENTION:
      "Steps follow in numbered order unless a step states otherwise.",
    // R5: a sole end point, versus one of several ending paths.
    SOLE_ENDING: "This is the end of the process.",
    PATH_ENDING: "This path ends here.",
    // R13: the word is "decision point" everywhere (ruled by Matthew,
    // 16 August 2026).
    DECISION_PREFIX: "Decision point:",
  });

  // R10 BRANCH-LABEL QUOTING. A branch label is spoken bare; one carrying
  // punctuation is wrapped in double quotes; one carrying a double quote is
  // wrapped in single quotes. The punctuation set is the clause- and
  // sentence-ending marks, because those are what make a bare label run into
  // the "If X, go to…" frame around it — gold's only positive witness is the
  // comma in exemplar 4's "Yes, in full or in part". An apostrophe is
  // deliberately NOT in the set: it ends nothing, and wrapping a possessive
  // would read as a quotation. A label carrying BOTH a double quote and an
  // apostrophe has no gold witness and no third form; it takes the single
  // quotes and reads ambiguously, which is recorded rather than invented past.
  const BRANCH_LABEL_PUNCTUATION = /[,.;:!?]/;

  /**
   * Wrap an author label in the generator's own quotation marks.
   *
   * THE ONE ESCAPING SITE for every quoted author label in the branch layer —
   * R4's previews, R10's branch wrapping and R12's open-link sentence all
   * arrive here, so the escaping decision is made once and can be checked
   * once. Escape EXACTLY ONCE, on the raw label: Common.escapeHtml maps `"` to
   * `&quot;` and `&` to `&amp;`, so escaping an already-escaped label emits
   * `&amp;quot;` — a sequence flowchart-quotes/hostile forbids by name. The
   * quotation marks this adds are generator-authored markup and stay literal,
   * which is the OQ4 closure's scope: in gold exemplar 6 exactly two
   * characters change, both inside the author's P1 label.
   *
   * @param {string} label - The RAW author label, never a pre-escaped one
   * @param {string} style - "double", "single" or "bare"
   * @returns {string} The escaped label, wrapped as asked
   */
  function quoteAuthorLabel(label, style) {
    const safe = Common.escapeHtml(label);
    if (style === "single") return `'${safe}'`;
    if (style === "double") return `"${safe}"`;
    return safe;
  }

  /**
   * R10: a branch label as it is spoken in the "If X," slot.
   *
   * The quoting test reads the RAW label, because after escaping there is no
   * double quote left to find.
   *
   * @param {string} label - The raw branch label
   * @returns {string} The escaped label, quoted per R10
   */
  function renderBranchLabel(label) {
    const style = label.includes('"')
      ? "single"
      : BRANCH_LABEL_PUNCTUATION.test(label)
        ? "double"
        : "bare";
    return quoteAuthorLabel(label, style);
  }

  /**
   * R4 LABEL PREVIEWS: "step five, "New deadline set and recorded"".
   *
   * Every branch and jump that names a step number also names that step's
   * label, so a listener never has to hold a bare number in mind. The
   * punctuation that follows sits OUTSIDE the closing quote, which is what
   * every gold witness shows, and is why this returns the reference without a
   * terminator and lets each caller add its own.
   *
   * NOT applied to a step's own flat connectives — "Proceed to step seven.",
   * "The process returns to step one." — which gold shows unpreviewed at 16
   * sites across five exemplars (counted, not estimated). The preview belongs
   * to the branch list and to R12's association sentence.
   *
   * @param {string} id - The referenced node id
   * @param {Object} t - The traversal model
   * @returns {string} "step N, "LABEL"" with no trailing punctuation
   */
  function stepReference(id, t) {
    const word = Common.narrationNumber(t.numberOf.get(id));
    return `step ${word}, ${quoteAuthorLabel(t.nodeById.get(id).label, "double")}`;
  }

  /**
   * Join narration items WITHOUT the Oxford comma: "a", "a and b",
   * "a, b and c". This is the form every list inside a gold sentence takes —
   * R1's end-point names ("X", "Y" or "Z"), R6's loop addresses ("from step
   * four and from step 10"), R7's split targets ("to steps three, four and
   * five").
   *
   * Deliberately NOT Common.formatList, which inserts the Oxford comma the
   * shared prose layer uses for its own lists (the Groups section, the
   * isolated-step paragraph). The two forms coexist on purpose; matching
   * gold here would silently change those.
   *
   * @param {string[]} items - The rendered items
   * @param {string} conjunction - "and" or "or"
   * @returns {string} The joined list
   */
  function joinPlain(items, conjunction = "and") {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
  }

  /**
   * Join whole CLAUSES the way exemplar 5's overview does — with a comma
   * before "and", which is what separates a clause join from the item join
   * above: "At step two the flow splits into three parallel paths that
   * rejoin at step six, and one loop returns the flow from step eight to
   * step six."
   *
   * @param {string[]} clauses - The rendered clauses, uncapitalised
   * @returns {string} The joined clause string, still uncapitalised
   */
  function joinClauses(clauses) {
    if (clauses.length === 0) return "";
    if (clauses.length === 1) return clauses[0];
    return `${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}`;
  }

  /**
   * Render a set of step numbers as the run-collapsed phrases the overview
   * uses, one string per RUN of consecutive numbers.
   *
   * The convention is pinned by the gold targets, section Ordering
   * specification: one step reads "step N"; two read "steps N and M"; three
   * or more read "steps N to M". The caller joins the phrases — with
   * joinClauses, so separate runs read "steps seven and eight, and step 11" —
   * and decides whether the joined list needs a closing comma, which is why
   * this returns the phrases rather than one string. Gold exemplar 4 puts
   * that comma in ("…and step 11, sit outside the groups"); a single run does
   * not need one.
   *
   * @param {number[]} numbers - Step numbers, any order
   * @returns {string[]} One phrase per run of consecutive numbers
   */
  function stepRunPhrases(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const runs = [];
    for (const n of sorted) {
      const last = runs[runs.length - 1];
      if (last && n === last[last.length - 1] + 1) last.push(n);
      else runs.push([n]);
    }
    return runs.map((run) => {
      const words = run.map(Common.narrationNumber);
      if (run.length === 1) return `step ${words[0]}`;
      if (run.length === 2) return `steps ${words[0]} and ${words[1]}`;
      return `steps ${words[0]} to ${words[run.length - 1]}`;
    });
  }

  /**
   * "a" or "an" before one of R11's rendered counts — "a seven-step thread",
   * "an eight-step thread", "an 11-step thread".
   *
   * DERIVED: no gold witness. The corpus and the exemplars reach "two",
   * "three" and "seven" only, all of which take "a", so this exists to stop a
   * larger diagram reading wrongly rather than to satisfy anything measured.
   * Deliberately BOUNDED to the counts R11 can put here — the words one to
   * nine, and digits from 10 — because a general number-to-words article rule
   * would be untestable against anything. Anything outside that set takes
   * "a", which is the safe default in English and is what the code did before
   * this helper existed.
   *
   * @param {string} rendered - The count as Common.narrationNumber rendered it
   * @returns {string} "a" or "an"
   */
  function countArticle(rendered) {
    return /^(eight|8|11|18|8\d)$/.test(rendered) ? "an" : "a";
  }

  /**
   * R19 THREAD CLAUSE. One clause naming one open-link thread, for the
   * overview's structure sentence.
   *
   * Gold exemplar 6 is the single witness and reads: "an open link joins step
   * 12 to a final two-step thread, steps 14 and 15, ending at "Continual
   * improvement"".
   *
   * Three things in it scale, and R19 rules all three:
   *
   * - The STEP RUN collapses to a range from three steps up ("steps three to
   *   nine"). That is valid only because R15 numbers a thread contiguously; if
   *   R15 were ever relaxed, this range would start lying and stepRunPhrases
   *   would silently produce several phrases instead of one.
   * - "final" appears only when the thread's steps END the list. A thread
   *   numbered before some other thread is not final, and saying so would tell
   *   the reader the description was about to stop when it was not.
   * - The ENDINGS reuse R1's scaling exactly — one named, two as a pair, three
   *   listed, more than three counted — so a thread's ending reads the way the
   *   main flow's does. Only the one-ending form has a gold witness; the rest
   *   are R1's own frozen shapes, borrowed rather than invented.
   *
   * A thread with no ending at all (every step of it loops) says nothing about
   * endings. DERIVED, and unreachable in the corpus.
   *
   * @param {Object} thread - One entry of the traversal's threads array
   * @param {Object} t - The traversal model
   * @param {number} totalNumbered - How many steps the list carries in all
   * @returns {string} The clause, uncapitalised, for joinClauses
   */
  function threadClause(thread, t, totalNumbered) {
    const numbers = thread.stepIds.map((id) => t.numberOf.get(id));
    const countWord = Common.narrationNumber(numbers.length);
    const isFinal = Math.max(...numbers) === totalNumbered;
    const joinWord = Common.narrationNumber(t.numberOf.get(thread.joinStepId));
    // With "final" present the article answers to that word, not to the count.
    const article = isFinal ? "a" : countArticle(countWord);
    const where = joinClauses(stepRunPhrases(numbers));

    let clause = `an open link joins step ${joinWord} to ${article} ${isFinal ? "final " : ""}${countWord}-step thread, ${where}`;

    const ends = thread.endIds.map((id) =>
      quoteAuthorLabel(t.nodeById.get(id).label, "double")
    );
    if (ends.length === 1) {
      clause += `, ending at ${ends[0]}`;
    } else if (ends.length === 2) {
      clause += `, ending at either ${ends[0]} or ${ends[1]}`;
    } else if (ends.length === 3) {
      clause += `, ending at one of three outcomes: ${joinPlain(ends, "or")}`;
    } else if (ends.length > 3) {
      clause += `, ending at one of ${Common.narrationNumber(ends.length)} outcomes`;
    }
    return clause;
  }

  /**
   * The gold PLAIN short tier.
   *
   * Shape, read off the six frozen shorts:
   *
   *   A flowchart of {N} steps[ in {G} groups], from {START} to {END}[, with {FEATURES}].
   *
   * The comma before "from" appears only with the groups clause — exemplar 4
   * is the only grouped exemplar and is its only witness. Direction, the
   * "complex"/"moderate" size words and the "decision flowchart" opening are
   * all GONE: no gold short carries any of them.
   *
   * ESCAPING. This builds BOTH tiers in one pass, and the difference between
   * them is exactly two things: the plain tier interpolates author labels RAW
   * and the step total as digits, the HTML tier escapes the labels and wraps
   * the total in the count span. The plain string feeds figcaption.textContent
   * and the SVG aria-label (mermaid-accessibility-core.js ~:1286-1299), so
   * escaping it would put "&amp;" in front of a reader. The detailed tier's
   * escape-everything rule must not leak in here; that is why the two renders
   * share a function and differ by one flag, rather than one being derived
   * from the other by a substitution.
   *
   * WHAT IS DERIVED, all of it noted because none of it has a gold witness:
   * the two- and three-start forms (every exemplar has one start), the
   * zero-end form, the plural group, split and thread forms, the feature
   * ORDER, and the no-steps guard. The feature order follows the rule numbers
   * that own each feature — R2 decision points, R6 loops, R7 splits, R12 and
   * R19 threads — which is the only ordering basis available: the two
   * exemplars showing more than one feature (3 and 6) are consistent with it
   * and do not pin it.
   *
   * ONE KNOWN DIFFERENCE FROM GOLD, reported rather than fitted to: exemplar 5
   * has a decision point, a loop and a three-way parallel split, and its
   * frozen short names only the first and the third. Every other exemplar's
   * short names every feature its diagram carries. The rule below names all
   * three, so exemplar 5's short differs from gold by ", one loop". Recorded
   * as an OPEN QUESTION in the version 4 changelog of
   * docs/mermaid-flowchart-gold-targets-2026-08-16.md. Do NOT "fix" it here by
   * suppressing loops wherever a split exists: that is a rule fitted to one
   * datum, with no rationale behind it.
   *
   * @param {Object} graph - The parse adapter's normalised graph
   * @param {Object} t - The traversal model, shared with the detailed tier
   * @returns {{html: string, text: string}} The two short tiers
   */
  function buildShortTier(graph, t) {
    const totalSteps = graph.nodes.length;

    const render = (asHtml) => {
      // No steps at all: there is no start, no end and nothing to count, and
      // "A flowchart of 0 steps" is not a sentence anyone should hear.
      if (totalSteps === 0) return "A flowchart with no steps.";

      const quoted = (id) => {
        const raw = t.nodeById.get(id).label;
        return `"${asHtml ? Common.escapeHtml(raw) : raw}"`;
      };
      const total = asHtml
        ? `<span class="diagram-count">${totalSteps}</span>`
        : `${totalSteps}`;

      // One end reads as a name, two as a pair, three or more as a count —
      // exemplars 1 and 5 (one), 3 and 4 (two) and 2 (three) between them pin
      // the end side; the start side mirrors it and is DERIVED.
      const namedSet = (ids, countNoun) => {
        const names = ids.map(quoted);
        if (names.length === 1) return names[0];
        if (names.length === 2) return `${names[0]} or ${names[1]}`;
        return `one of ${Common.narrationNumber(names.length)} ${countNoun}`;
      };

      let sentence = `A flowchart of ${total} step${totalSteps === 1 ? "" : "s"}`;

      const groupCount = graph.subgraphs.length;
      if (groupCount > 0) {
        sentence += ` in ${Common.narrationNumber(groupCount)} group${groupCount === 1 ? "" : "s"},`;
      }

      if (t.mainStartIds.length > 0) {
        sentence += ` from ${namedSet(t.mainStartIds, "starting points")}`;
      }
      if (t.mainEndIds.length > 0) {
        sentence += ` to ${namedSet(t.mainEndIds, "outcomes")}`;
      }

      const features = [];
      // A flow with nowhere to end is a fact about the diagram rather than a
      // feature of it, but the short has no other slot for it once the "to …"
      // clause has nothing to say. DERIVED; the detailed tier's wording is
      // reused so the two tiers say the same thing.
      if (t.mainEndIds.length === 0) features.push("no distinct end point");
      if (t.diamondCount > 0) {
        features.push(
          `${Common.narrationNumber(t.diamondCount)} decision point${t.diamondCount === 1 ? "" : "s"}`
        );
      }
      const loopCount = t.cycleEdges.size;
      if (loopCount > 0) {
        features.push(
          `${Common.narrationNumber(loopCount)} loop${loopCount === 1 ? "" : "s"}`
        );
      }
      // R20 REPEAT CLAUSE, immediately after the loops so the ruled order —
      // "two loops and one step that can repeat" — falls out of the push
      // order rather than being sorted for.
      const repeatCount = t.repeatStepCount;
      if (repeatCount > 0) {
        features.push(
          `${Common.narrationNumber(repeatCount)} step${repeatCount === 1 ? "" : "s"} that can repeat`
        );
      }
      if (t.splits.length === 1) {
        // Gold exemplar 5: "a three-way parallel split". The way-count is kept
        // for a single split and dropped for several, which is R1's
        // name-it-or-count-it scaling reaching a feature rather than a label.
        const ways = Common.narrationNumber(t.splits[0].targets.length);
        features.push(`${countArticle(ways)} ${ways}-way parallel split`);
      } else if (t.splits.length > 1) {
        features.push(
          `${Common.narrationNumber(t.splits.length)} parallel splits`
        );
      }
      if (t.threads.length === 1) {
        features.push("a linked follow-on thread");
      } else if (t.threads.length > 1) {
        features.push(
          `${Common.narrationNumber(t.threads.length)} linked follow-on threads`
        );
      }
      if (features.length > 0) sentence += `, with ${joinPlain(features)}`;

      return `${sentence}.`;
    };

    return { html: render(true), text: render(false) };
  }

  /**
   * R8 GROUP PRESENTATION — THE SWAPPABLE STRATEGY, and the only place group
   * presentation is decided.
   *
   * The targets document pins VARIANT A, headed segments, with user feedback
   * as the re-open trigger; Matthew's NVDA log of 16 August 2026 records the
   * trade both ways (list-item continuity against heading navigation).
   * VARIANT C — one unbroken list with the groups announced inside the
   * boundary items — is the documented alternative, and swapping to it means
   * replacing this object and nothing else.
   *
   * It is an object with two members rather than a single function for one
   * structural reason: the segmentation has to be known BEFORE any step item
   * renders, because R3's connective fires on a step whose successor sits
   * under a different heading, and that question is asked from inside
   * renderStepItem. So `segment` runs during the traversal and feeds
   * nextInSegment, and `render` runs at assembly. A variant that segments
   * differently then gets both halves right by construction, which a single
   * render function could not.
   *
   * Variant C would return ONE segment carrying every step from `segment` —
   * making nextInSegment the plain component relation again, so no connective
   * fires at a group boundary — and would announce each group inside its
   * boundary items from `render`.
   */
  const GROUP_PRESENTATION = Object.freeze({
    name: "variant A — headed segments",

    /**
     * Cut one component's steps into runs of common group membership.
     *
     * MEMBERSHIP ORDER COMES FROM STEP ORDER, never from the adapter's
     * `nodeIds` field: the grounding report measured `nodeIds` arriving out of
     * source order (exemplar 4's `early` group declares A then B then C, and
     * the field is delivered as ["B","A","C"]). This walks the already-numbered
     * step list, so that array's order cannot reach the output at all.
     *
     * @param {string[]} stepIds - One component's step ids, in step order
     * @param {Function} groupOf - id -> the subgraph object, or null
     * @returns {Array<{group: (Object|null), stepIds: string[]}>} The segments
     */
    segment(stepIds, groupOf) {
      const segments = [];
      for (const id of stepIds) {
        const group = groupOf(id);
        const last = segments[segments.length - 1];
        if (last && last.group === group) last.stepIds.push(id);
        else segments.push({ group, stepIds: [id] });
      }
      return segments;
    },

    /**
     * Render the segments as headed <ol> blocks, exactly as the frozen
     * exemplar 4 fragment shows: a subheading per segment, global numbering
     * kept by each list's `start`, and "Ungrouped steps" over a run belonging
     * to no group. Multiple ungrouped runs are allowed and each takes its own
     * heading — the heading text is a description, not a name.
     *
     * @param {Array} segments - From segment() above
     * @param {Object} t - The traversal model
     * @param {string} tag - "h5" or "h6", per the pinned heading allocation
     * @returns {string[]} Markup parts
     */
    render(segments, t, tag) {
      const parts = [];
      for (const segment of segments) {
        const heading = segment.group
          ? Common.escapeHtml(segment.group.title || segment.group.id)
          : "Ungrouped steps";
        parts.push(
          `<${tag} class="flow-heading group-heading">${heading}</${tag}>`
        );
        parts.push(
          `<ol class="flowchart-steps" start="${t.numberOf.get(segment.stepIds[0])}">`
        );
        for (const id of segment.stepIds) parts.push(renderStepItem(id, t));
        parts.push(`</ol>`);
      }
      return parts;
    },
  });

  /**
   * Traverse the normalised graph: weakly-connected components over ALL
   * edges, then a Kahn topological numbering per component over ordering
   * edges only, tie-broken by source first-mention order. When cycles
   * block the queue the earliest-mention unnumbered node is forced, and
   * any ordering edge whose target is numbered at or before its source is
   * a cycle edge ("go back to").
   *
   * ORDERING SPECIFICATION OF RECORD. This routine is the ordering the
   * gold targets are numbered against, per the OQ1 ruling of 18 August
   * 2026 (Option B). Three points are pinned by
   * docs/mermaid-flowchart-gold-targets-2026-08-16.md and must not be
   * changed without re-deriving the targets:
   *
   * - The CYCLE-BREAK rule is the forcing rule below: nothing is removed
   *   up front, the queue is allowed to block, and the earliest-mention
   *   unnumbered node is then forced. Which arrow R6 narrates as the
   *   return follows from that. On exemplar 3 it breaks the cycle at
   *   J -> G ("returns to step seven"); on exemplar 6 at M -> J
   *   ("returns to step 10"). A depth-first back-edge rule would break
   *   both at a different arrow and rewrite an approved exemplar.
   * - R15 THREAD-LAST: a component is numbered one flow sub-partition at
   *   a time, so a thread joined to the rest only by open links is
   *   numbered after the flow rather than interleaved with it.
   * - R16 ENDINGS-LAST: a tie-break on the last two steps of a component
   *   keeps the list closing on an ending rather than on a return.
   *
   * @param {Object} graph - The parse adapter's normalised graph
   * @returns {Object} The traversal model the renderer consumes
   */
  function buildFlowchartTraversal(graph) {
    const mention = new Map();
    const nodeById = new Map();
    graph.nodes.forEach((node, index) => {
      mention.set(node.id, index);
      nodeById.set(node.id, node);
    });

    // R21: an invisible link orders, whatever its kind. Routing it here is
    // what makes the association clause and the thread BOTH disappear, and it
    // does so by the edge never reaching either site rather than by a guard
    // at the site — it never enters `openFrom`, which R12's sentence reads,
    // and it does enter `flowNeighbours`, which is what R15 uses to tell a
    // thread apart from the flow it hangs off.
    const isOrdering = (edge) =>
      (ORDERING_EDGE_KINDS.includes(edge.kind) || isInvisibleLink(edge)) &&
      edge.from !== edge.to;

    // Per-node edge lists, all in graph.edges (source) order.
    const orderingOut = new Map(graph.nodes.map((n) => [n.id, []]));
    const selfLoops = new Map(graph.nodes.map((n) => [n.id, []]));
    const openFrom = new Map(graph.nodes.map((n) => [n.id, []]));
    const touched = new Set();
    const neighbours = new Map(graph.nodes.map((n) => [n.id, new Set()]));
    // Undirected adjacency over ORDERING edges only. `neighbours` counts
    // open links, which is what makes a thread part of its component;
    // this map deliberately does not, which is what lets R15 tell the
    // thread apart from the flow it hangs off.
    const flowNeighbours = new Map(graph.nodes.map((n) => [n.id, new Set()]));

    for (const edge of graph.edges) {
      touched.add(edge.from);
      touched.add(edge.to);
      if (edge.from === edge.to) {
        selfLoops.get(edge.from).push(edge);
        continue;
      }
      neighbours.get(edge.from).add(edge.to);
      neighbours.get(edge.to).add(edge.from);
      if (isOrdering(edge)) {
        orderingOut.get(edge.from).push(edge);
        flowNeighbours.get(edge.from).add(edge.to);
        flowNeighbours.get(edge.to).add(edge.from);
      } else if (edge.kind === "arrow_open") {
        openFrom.get(edge.from).push(edge);
      }
    }

    // Isolated nodes: no incident edges at all. Excluded from the steps
    // list and declared in a paragraph after it.
    const isolated = graph.nodes
      .filter((node) => !touched.has(node.id))
      .map((node) => node.id);
    const isolatedSet = new Set(isolated);

    // In-degree and out-degree over ordering edges, self-loops ignored.
    //
    // THESE TWO MAPS BELONG TO THE NUMBERING and must not gain a two-way
    // edge's reverse direction. Four sites read them for ordering: the
    // component start set, the R15 partition start set, the Kahn seed
    // `localIn`, and R16's endings-last tie-break. Adding the reverse there
    // turns every two-way edge into a two-node cycle, which blocks the queue,
    // fires the cycle-break forcing rule and renumbers the diagram. R23's
    // ending question is answered by `hasWayOut` below instead.
    const inDegree = new Map(graph.nodes.map((n) => [n.id, 0]));
    const outDegree = new Map(graph.nodes.map((n) => [n.id, 0]));
    for (const edges of orderingOut.values()) {
      for (const edge of edges) {
        inDegree.set(edge.to, inDegree.get(edge.to) + 1);
        outDegree.set(edge.from, outDegree.get(edge.from) + 1);
      }
    }

    // R23 TWO-WAY ENDINGS (ruled 20 August 2026, gold targets version 9).
    //
    // A two-way edge is ONE edge with TWO traversable directions, and the
    // ending question is whether a step has a way out. The adapter delivers a
    // single `from`/`to` pair with only `kind` recording that it runs both
    // ways, so the target's out-degree is never incremented and the step was
    // announced as an ending while the diagram showed a way onward — sweep
    // finding F19, propagated to `o--o` and `x--x` when R22 made them
    // ordering edges.
    //
    // Counted as ARRIVALS of a two-way edge rather than pushed into
    // `orderingOut`, for the reason in the block above: `orderingOut` drives
    // the numbering, the R7 split detection, the decision-point exit count
    // and every step's branch list, and a second entry there would change all
    // of them. This map is read by the ending predicate and by nothing else.
    const twoWayIn = new Map(graph.nodes.map((n) => [n.id, 0]));
    for (const edges of orderingOut.values()) {
      for (const edge of edges) {
        if (isDoubleArrow(edge)) {
          twoWayIn.set(edge.to, twoWayIn.get(edge.to) + 1);
        }
      }
    }

    /**
     * Does this step have a way out? THE single ending predicate, and every
     * consumer reads it — the two endpoint sets, both end counts, and the
     * step item's own closing sentence. Before R23 the step item derived its
     * answer independently, from `orderingOut.get(id).length`, which is how
     * the overview and the step list could have disagreed about the same node.
     *
     * @param {string} id - The node id
     * @returns {boolean} True when a reader can leave this step
     */
    const hasWayOut = (id) => outDegree.get(id) > 0 || twoWayIn.get(id) > 0;

    // Weakly-connected components among non-isolated nodes, over all edges.
    const componentOf = new Map();
    const components = [];
    for (const node of graph.nodes) {
      if (isolatedSet.has(node.id) || componentOf.has(node.id)) continue;
      const members = [];
      const queue = [node.id];
      componentOf.set(node.id, components.length);
      while (queue.length) {
        const id = queue.shift();
        members.push(id);
        for (const next of neighbours.get(id)) {
          if (!componentOf.has(next) && !isolatedSet.has(next)) {
            componentOf.set(next, components.length);
            queue.push(next);
          }
        }
      }
      components.push({ members, stepIds: [] });
    }

    // Order components by their start's first mention (earliest member
    // where no start node exists — the loop case).
    for (const component of components) {
      const starts = component.members.filter((id) => inDegree.get(id) === 0);
      const pool = starts.length ? starts : component.members;
      component.startMention = Math.min(...pool.map((id) => mention.get(id)));
    }
    components.sort((a, b) => a.startMention - b.startMention);

    /**
     * R15 THREAD-LAST. Split one component's members into the runs the
     * ordering edges connect. Two members fall in different sub-partitions
     * only when every route between them uses an open link — an open link
     * imposes no direction, so it holds a component together without ever
     * placing one step before another. Every sub-partition after the first
     * is therefore exactly the "open-link thread" R12 describes, and
     * numbering them one at a time stops a thread interleaving with the
     * flow it hangs off.
     *
     * Sub-partitions are ordered the way components themselves are, by
     * their start's first mention, so the sub-partition the diagram opens
     * with is numbered in full before any other. Internal flow order is
     * untouched: each sub-partition runs the same Kahn numbering as before.
     *
     * A component with no open links yields exactly one sub-partition, so
     * this changes nothing for a diagram that has none.
     *
     * @param {string[]} members - One component's node ids
     * @returns {string[][]} Its sub-partitions, flow first, threads after
     */
    const flowPartitionsOf = (members) => {
      const memberSet = new Set(members);
      const placed = new Set();
      const partitions = [];

      for (const seed of members) {
        if (placed.has(seed)) continue;
        const group = [];
        const queue = [seed];
        placed.add(seed);
        while (queue.length) {
          const id = queue.shift();
          group.push(id);
          for (const next of flowNeighbours.get(id)) {
            if (memberSet.has(next) && !placed.has(next)) {
              placed.add(next);
              queue.push(next);
            }
          }
        }
        // Flow edges never cross a sub-partition boundary, so the global
        // in-degree is already the sub-partition-local one.
        const starts = group.filter((id) => inDegree.get(id) === 0);
        const pool = starts.length ? starts : group;
        partitions.push({
          group,
          startMention: Math.min(...pool.map((id) => mention.get(id))),
        });
      }

      partitions.sort((a, b) => a.startMention - b.startMention);
      return partitions.map((partition) => partition.group);
    };

    // Kahn numbering, continuous across components and, within each
    // component, across its flow sub-partitions (R15).
    const numberOf = new Map();
    const stepsInOrder = [];
    let counter = 0;
    for (const component of components) {
      let componentRemaining = component.members.length;
      const partitions = flowPartitionsOf(component.members);
      // The component's MAIN FLOW is its first sub-partition; every later one
      // is an open-link thread (R15). R1 names the start and end points of
      // the main flow only, and R12 (a later session) speaks the thread.
      component.mainIds = new Set(partitions[0] || []);
      // Kept for R19: every sub-partition after the first IS an open-link
      // thread, which is what R15 established when it lifted them out of the
      // flow. Recomputing them later would be a second implementation of the
      // same rule, free to drift from this one.
      component.partitions = partitions;
      for (const partition of partitions) {
        const remaining = new Set(partition);
        const localIn = new Map(partition.map((id) => [id, inDegree.get(id)]));
        while (remaining.size) {
          let candidates = [...remaining].filter((id) => localIn.get(id) === 0);
          if (candidates.length === 0) {
            // A cycle blocks the queue: force the earliest-mention node.
            // This forcing IS the cycle-break rule pinned by the targets
            // document — see the note on this function.
            candidates = [...remaining];
          }
          candidates.sort((a, b) => mention.get(a) - mention.get(b));

          // R16 ENDINGS-LAST. With two steps of the component left and a
          // free choice between them, take the one that still leads
          // somewhere, so the list closes on an ending rather than on
          // "go back to step N" with the reader left mid-loop. At this
          // point an out-edge can only reach an already-numbered step:
          // if one of the two led to the other, the other would not yet
          // be a candidate. So a positive out-degree here means a return,
          // and a zero one means an ending.
          if (componentRemaining === 2 && candidates.length > 1) {
            const leadsOn = candidates.find((id) => outDegree.get(id) > 0);
            if (leadsOn) {
              candidates = [
                leadsOn,
                ...candidates.filter((id) => id !== leadsOn),
              ];
            }
          }

          const id = candidates[0];
          remaining.delete(id);
          componentRemaining -= 1;
          counter += 1;
          numberOf.set(id, counter);
          stepsInOrder.push(id);
          component.stepIds.push(id);
          for (const edge of orderingOut.get(id)) {
            if (remaining.has(edge.to)) {
              localIn.set(edge.to, localIn.get(edge.to) - 1);
            }
          }
        }
      }
    }

    // R8 GROUP MEMBERSHIP. A step belongs to the subgraph whose `nodeIds`
    // holds it. The adapter reports subgraphs FLAT, with a child subgraph's
    // id appearing in its parent's node list and filtered out into
    // `childSubgraphIds`, so `nodeIds` is DIRECT membership only and no node
    // can be claimed by two groups through nesting. The array's ORDER is not
    // read here and must not be: the grounding report measured it arriving out
    // of source order. Only membership is asked of it.
    const groupById = new Map();
    for (const sub of graph.subgraphs) {
      for (const id of sub.nodeIds) {
        if (!groupById.has(id)) groupById.set(id, sub);
      }
    }
    const groupOf = (id) => groupById.get(id) || null;

    // R8's segments, cut by the pinned presentation strategy. Computed HERE,
    // inside the traversal, because R3's next-item relation below depends on
    // them: a step whose implicit successor sits under a different heading
    // takes an explicit connective, and that is decided by where the segment
    // boundaries fall. See GROUP_PRESENTATION's header for why segmentation
    // and rendering are two members of one strategy.
    for (const component of components) {
      component.segments = GROUP_PRESENTATION.segment(component.stepIds, groupOf);
    }

    // R3's "next list item" relation, resolved on SEGMENTS rather than on step
    // numbers. A segment is one rendered <ol>. Before R8 that was one per
    // component; it is now one per run of common group membership within a
    // component, which is exactly R8's clause: a step whose implicit successor
    // sits under a DIFFERENT heading still takes an explicit connective, and
    // comparing step numbers alone would silence precisely that case.
    //
    // This is the ONE place the relation is built, which is what the pre-R8
    // note here promised: the guard was written over component segments while
    // it was inert, so that turning groups into headed segments meant
    // rebuilding one map rather than finding every site that assumed N + 1.
    const nextInSegment = new Map();
    for (const component of components) {
      for (const segment of component.segments) {
        for (let i = 0; i + 1 < segment.stepIds.length; i += 1) {
          nextInSegment.set(segment.stepIds[i], segment.stepIds[i + 1]);
        }
      }
    }

    // Cycle edges: ordering edges pointing at an already-numbered node.
    const cycleEdges = new Set();
    for (const edges of orderingOut.values()) {
      for (const edge of edges) {
        if (numberOf.get(edge.to) <= numberOf.get(edge.from)) {
          cycleEdges.add(edge);
        }
      }
    }

    // Start points exclude cycle edges (stage 3.1 amendment A): a
    // back-edge does not stop a node being where reading begins, but it
    // does mean the process continues from that node — so end points keep
    // counting cycle edges. Every edge into a component's first-numbered
    // node is a cycle edge by construction, so each component contributes
    // at least one start point.
    const nonCycleInDegree = new Map(graph.nodes.map((n) => [n.id, 0]));
    for (const edges of orderingOut.values()) {
      for (const edge of edges) {
        if (cycleEdges.has(edge)) continue;
        nonCycleInDegree.set(edge.to, nonCycleInDegree.get(edge.to) + 1);
      }
    }

    // ------------------------------------------------------------------
    // SHARED REJOIN COMPUTATION — used by R2, R7 and R14, built once.
    //
    // The rejoin of a branching step is its IMMEDIATE POST-DOMINATOR on the
    // BACK-EDGE-FREE flow graph: the nearest step every path out of it must
    // pass through. Cycle edges are removed first, so a loop back to an
    // earlier step is not mistaken for a path that rejoins; what is left is
    // a DAG, and the step numbering is already one of its topological
    // orders (an edge is a cycle edge exactly when its target is numbered
    // at or before its source), so walking stepsInOrder backwards visits
    // every successor before its predecessor and one pass reaches the
    // fixpoint.
    //
    // postdom(n) = {n} union the intersection of postdom over n's
    // successors. A sink's postdom is {n} alone, so two paths that end at
    // different sinks intersect to nothing and the step has no rejoin —
    // which is the silent case R2 needs (exemplar 5 is its frozen witness).
    // The IMMEDIATE post-dominator is the candidate with the LARGEST
    // postdom set, the sets along a postdominator chain being nested.
    //
    // R2 asks it of the sole decision point, R7 of a parallel split, R14 of
    // the step a split names. One computation, three consumers.
    // ------------------------------------------------------------------
    const forwardSucc = new Map(graph.nodes.map((n) => [n.id, []]));
    for (const [id, edges] of orderingOut) {
      for (const edge of edges) {
        if (!cycleEdges.has(edge)) forwardSucc.get(id).push(edge.to);
      }
    }
    const postDom = new Map();
    for (let i = stepsInOrder.length - 1; i >= 0; i -= 1) {
      const id = stepsInOrder[i];
      const successors = forwardSucc.get(id);
      let set = null;
      for (const next of successors) {
        const nextSet = postDom.get(next) || new Set([next]);
        set =
          set === null
            ? new Set(nextSet)
            : new Set([...set].filter((x) => nextSet.has(x)));
      }
      const own = set === null ? new Set() : set;
      own.add(id);
      postDom.set(id, own);
    }
    const immediatePostDominator = (id) => {
      const candidates = [...(postDom.get(id) || [])].filter((x) => x !== id);
      if (candidates.length === 0) return null;
      return candidates.reduce((best, x) =>
        (postDom.get(x) || new Set()).size > (postDom.get(best) || new Set()).size
          ? x
          : best
      );
    };

    // R7 PARALLEL SPLITS. An unlabelled multi-way exit on a non-diamond: a
    // fork in the flow rather than a choice between branches. Diamonds are
    // excluded because only a diamond is a decision point (R13) and a
    // decision is never narrated as parallel paths. A cycle edge is
    // excluded because a return is not a parallel path, a double arrow
    // because a two-way link is not a fork, and a labelled self-loop
    // because it needs the nested form to say so.
    // DECISION POINTS. Being a diamond is NECESSARY and not sufficient: the
    // decision-point treatment requires a decision to make, so a diamond with
    // fewer than two ordering exits narrates as an ordinary step (ruled 20
    // August 2026, closing probe-sweep finding F23). Before that ruling a
    // one-exit diamond was announced as a decision point over a one-item path
    // list carrying no condition, and a ZERO-exit diamond was announced as one
    // with no list at all AND no ending sentence, even where the overview
    // named it as where the process ends.
    //
    // This Set is the single definition, and it exists so the three consumers
    // cannot drift: `diamondCount` in the return object, the step prefix in
    // renderStepItem, and R2's sole-decision lookup. Self-loops and open links
    // are not exits here — `orderingOut` is the flow, which is what a decision
    // decides between. An isolated diamond has no ordering exits and so is not
    // a decision point either, which is why this reads every node rather than
    // only the numbered ones.
    const decisionIds = new Set(
      graph.nodes
        .filter(
          (node) =>
            node.shape === "diamond" && orderingOut.get(node.id).length >= 2
        )
        .map((node) => node.id)
    );

    const splits = [];
    const splitById = new Map();
    for (const id of stepsInOrder) {
      const out = orderingOut.get(id);
      // Deliberately the RAW shape test, not `decisionIds`: this guard is
      // about a diamond never being narrated as a parallel fork, whatever its
      // exit count, and the two populations cannot overlap anyway because a
      // split needs two exits and a non-decision diamond has fewer.
      if (nodeById.get(id).shape === "diamond") continue;
      if (out.length < 2) continue;
      const parallel = out.every(
        (edge) =>
          !edge.label &&
          !cycleEdges.has(edge) &&
          // R21: a fork the diagram does not draw is exactly the claim an
          // invisible link must not produce, so an exit set containing one is
          // not a parallel split. Same shape as the two exclusions beside it:
          // any disqualifying exit kills the split rather than being dropped
          // from its target list.
          !isInvisibleLink(edge) &&
          // R22: any two-way link, not only `<-->`, disqualifies a fork.
          !isDoubleArrow(edge)
      );
      if (!parallel) continue;
      if (selfLoops.get(id).some((edge) => edge.label)) continue;
      const targets = out
        .map((edge) => edge.to)
        .sort((a, b) => numberOf.get(a) - numberOf.get(b));
      let rejoin = immediatePostDominator(id);
      // A rejoin that IS one of the split's own targets is not a place the
      // paths meet — it is one path running through another — so R7's
      // rejoin clause and R14's acknowledgement both stay silent there.
      if (rejoin && targets.includes(rejoin)) rejoin = null;
      const split = { id, targets, rejoin };
      splits.push(split);
      splitById.set(id, split);
    }

    // R14 REJOIN ACKNOWLEDGEMENT. Keyed by the step a split rejoins at, so
    // the renderer can ask one question of the step it is rendering. Fires
    // only at an R7 rejoin, whatever the node type; where two splits share
    // a rejoin the earlier split is the one acknowledged.
    const rejoinAcknowledgement = new Map();
    for (const split of splits) {
      if (split.rejoin && !rejoinAcknowledgement.has(split.rejoin)) {
        rejoinAcknowledgement.set(split.rejoin, split);
      }
    }

    // R19 THREAD CLAUSE. A THREAD is a flow sub-partition after the first: a
    // run of steps reachable from the rest of its component only across an
    // open link, which R15 has already numbered after the flow and therefore
    // CONTIGUOUSLY — that contiguity is what lets R19 speak a range.
    //
    // One clause per THREAD, not per link. A thread joined by three open links
    // is still one place the reader can go, and three clauses saying so would
    // be three ways of describing one detour. The clause attaches at the step
    // where the thread's FIRST open link joins, ordered by the joining step's
    // own number, so it is spoken against the earliest point the reader could
    // have left the flow.
    //
    // The joining step is the endpoint OUTSIDE the thread, whichever end of
    // the link the author wrote it from: an open link imposes no direction, so
    // edge.from carries no meaning here beyond where it was typed.
    const threads = [];
    for (const component of components) {
      const partitions = component.partitions || [];
      for (let i = 1; i < partitions.length; i += 1) {
        const memberSet = new Set(partitions[i]);
        // Step order, taken from the component's numbered list rather than
        // from the partition array, which is in BFS order.
        const threadStepIds = component.stepIds.filter((id) => memberSet.has(id));
        const inside = (id) => memberSet.has(id);
        const joinEdges = [];
        for (const edges of openFrom.values()) {
          for (const edge of edges) {
            if (inside(edge.from) !== inside(edge.to)) joinEdges.push(edge);
          }
        }
        if (joinEdges.length === 0) {
          // Unreachable by construction — a sub-partition is in this component
          // at all only because some non-ordering edge holds it there, and the
          // only non-ordering kind the adapter emits is arrow_open. Guarded
          // rather than asserted, because a silent wrong clause is worse than
          // a missing one, and logged so the impossible case is not silent.
          logWarn(
            "R19",
            `Thread of ${threadStepIds.length} step(s) has no open link; no clause spoken`
          );
          continue;
        }
        const outsideOf = (edge) => (inside(edge.from) ? edge.to : edge.from);
        const insideOf = (edge) => (inside(edge.from) ? edge.from : edge.to);
        joinEdges.sort((a, b) => {
          const byJoin = numberOf.get(outsideOf(a)) - numberOf.get(outsideOf(b));
          return byJoin !== 0
            ? byJoin
            : numberOf.get(insideOf(a)) - numberOf.get(insideOf(b));
        });
        threads.push({
          stepIds: threadStepIds,
          joinStepId: outsideOf(joinEdges[0]),
          // R1's endpoint test, asked of the thread instead of the main flow.
          endIds: threadStepIds.filter((id) => !hasWayOut(id)),
        });
      }
    }

    const nonIsolated = graph.nodes.filter((n) => !isolatedSet.has(n.id));

    // R1's start and end sets, restricted to the MAIN FLOW of each
    // component. A node in an open-link thread is left out: exemplar 6 has
    // two start points and two end points by the counts below, and its gold
    // overview names one of each — the thread's own start and ending belong
    // to R12's thread clause, not to R1's endpoint sentence. The counts
    // themselves are NOT restricted, because R5 chooses its ending sentence
    // from endCount and gold gives exemplar 6's thread ending "This path
    // ends here", i.e. the diagram-wide count of two.
    const inMainFlow = (id) =>
      components.some((component) => component.mainIds.has(id));
    const mainStartIds = stepsInOrder.filter(
      (id) => nonCycleInDegree.get(id) === 0 && inMainFlow(id)
    );
    const mainEndIds = stepsInOrder.filter(
      (id) => !hasWayOut(id) && inMainFlow(id)
    );
    const threadEndCount = nonIsolated.filter(
      (n) => !hasWayOut(n.id) && !inMainFlow(n.id)
    ).length;

    return {
      nodeById,
      orderingOut,
      selfLoops,
      openFrom,
      isolated,
      components,
      numberOf,
      stepsInOrder,
      nextInSegment,
      groupOf,
      threads,
      cycleEdges,
      splits,
      splitById,
      rejoinAcknowledgement,
      // The raw immediate post-dominator, for R2. R7 additionally discards
      // a rejoin that is one of the split's own targets, because R14 would
      // then claim a path leading from the very step it is spoken at; R2
      // has no such self-reference and takes the value unfiltered.
      rejoinOf: immediatePostDominator,
      mainStartIds,
      mainEndIds,
      threadEndCount,
      // No startCount: R1 replaced its only consumer, and the surviving
      // count would be the UNRESTRICTED one — a later reader reaching for
      // it would silently get the threads back. mainStartIds is the
      // main-flow set R1 names, and it is the only start-side figure.
      // endCount survives because R5 chooses its ending sentence from the
      // diagram-wide count, threads included, which gold requires.
      endCount: nonIsolated.filter((n) => !hasWayOut(n.id)).length,
      // R23: the step item's closing sentence reads THIS, not its own
      // out-edge count, so the overview and the step list cannot disagree.
      hasWayOut,
      decisionIds,
      // R20 REPEAT CLAUSE (ruled 20 August 2026, gold targets version 7). The
      // number of DISTINCT STEPS that can repeat, not the number of self-loop
      // edges: a step carrying two self-loops is one step that can repeat.
      //
      // Computed here, once, so the short tier and the detailed overview
      // cannot drift — the same reason decisionIds exists. It is deliberately
      // NOT folded into cycleEdges: R6's loop count excludes self-loops,
      // because a self-loop returns to the SAME step and would falsify
      // "N loops return the flow to earlier steps" of the very edge it added.
      // A self-looping node is always a step, never isolated, because the
      // classification loop marks both endpoints touched before it tests
      // from === to.
      repeatStepCount: [...selfLoops.values()].filter(
        (edges) => edges.length > 0
      ).length,
      // Counts DECISION POINTS, not diamonds — see decisionIds above. The
      // overview and the short tier both read this, so a diamond the step
      // list declines to announce cannot be counted in either.
      diamondCount: decisionIds.size,
    };
  }

  /**
   * Render one step's list item from the traversal model.
   * @param {string} id - The node id
   * @param {Object} t - The traversal model
   * @returns {string} An <li> fragment
   */
  function renderStepItem(id, t) {
    const node = t.nodeById.get(id);
    const label = node.label;

    // Diagram-source text is escaped once, here, where it enters an HTML
    // string. Everything downstream of this point is generator-authored
    // markup and must never be escaped. labelFullStop still reads the RAW
    // label: it is a text-level test for trailing sentence punctuation.
    const safeLabel = Common.escapeHtml(label);

    const out = t.orderingOut.get(id);
    const loops = t.selfLoops.get(id);
    const opens = t.openFrom.get(id);
    // A DECISION POINT, not merely a diamond: a diamond with fewer than two
    // ordering exits has no decision to offer and narrates as an ordinary
    // step (ruled 20 August 2026). Defined once, in the traversal.
    const isDecisionPoint = t.decisionIds.has(id);
    const split = t.splitById.get(id) || null;

    // R17 LABEL PUNCTUATION (ruled 18 August 2026). A decision-point label
    // takes no appended full stop — "Decision point: Criteria met?" and
    // "Decision point: Risk level" end as the author wrote them. Every
    // other label, including a non-diamond that heads a branch list under
    // R9, takes one when it lacks terminal punctuation of its own.
    const labelStop = isDecisionPoint ? "" : Common.labelFullStop(label);

    // A labelled self-loop is narrated as a nested item, so it forces the
    // nested form too. An R7 parallel split never takes it: its exits are
    // one sentence at the splitting step, not a branch list.
    const nestedForm =
      !split &&
      (isDecisionPoint ||
        out.length >= 2 ||
        out.some((edge) => edge.label) ||
        loops.some((edge) => edge.label));

    // The reference phrase for one ordering edge, lowercase. Called only from
    // the nested branch list below, which is R4's site: every reference here
    // carries its target's label preview.
    const referencePhrase = (edge) => {
      const reference = stepReference(edge.to, t);
      if (isDoubleArrow(edge)) {
        // DERIVED, and unreachable in the corpus today: a two-way link only
        // reaches this branch when its source also has a second exit or a
        // labelled one. Previewed for consistency with its neighbours in the
        // same list rather than on a gold witness, which there is none of.
        return `connects both ways with ${reference}`;
      }
      // The nested return keeps "go back to step N" and gains the preview by
      // the same shape as its siblings. DERIVED: gold's three returns are all
      // the flat form, which R6 speaks and which takes no preview, so this
      // form has no gold witness.
      return t.cycleEdges.has(edge)
        ? `go back to ${reference}`
        : `go to ${reference}`;
    };

    let main;
    const nestedItems = [];

    if (nestedForm) {
      main = isDecisionPoint
        ? `${NARRATION.DECISION_PREFIX} <span class="diagram-decision">${safeLabel}</span>${labelStop}`
        : `<span class="diagram-action">${safeLabel}</span>${labelStop}`;
      for (const edge of out) {
        nestedItems.push(
          edge.label
            ? `<li>If ${renderBranchLabel(edge.label)}, ${referencePhrase(edge)}.</li>`
            : `<li>${Common.capitalize(referencePhrase(edge))}.</li>`
        );
      }
      for (const edge of loops) {
        if (edge.label) {
          nestedItems.push(
            `<li>If ${renderBranchLabel(edge.label)}, this step repeats.</li>`
          );
        }
      }
    } else if (split) {
      // R7 PARALLEL SPLITS, narrated at the splitting step, with the rejoin
      // named when one exists. The step numbers are R11's word-or-digit
      // forms and the list takes no Oxford comma, per gold exemplar 5.
      const wayWord = Common.narrationNumber(split.targets.length);
      const targetWords = split.targets.map((target) =>
        Common.narrationNumber(t.numberOf.get(target))
      );
      let sentence = `The flow splits ${wayWord} ways, to steps ${joinPlain(targetWords)}`;
      if (split.rejoin) {
        const allPaths =
          split.targets.length === 2 ? "both paths" : `all ${wayWord} paths`;
        sentence += `; ${allPaths} rejoin at step ${Common.narrationNumber(t.numberOf.get(split.rejoin))}`;
      }
      main = `<span class="diagram-action">${safeLabel}</span>${labelStop} ${sentence}.`;
    } else if (out.length === 1) {
      const edge = out[0];
      const word = Common.narrationNumber(t.numberOf.get(edge.to));
      let sentence;
      if (isDoubleArrow(edge)) {
        // Not a sequencing connective: it states that the two steps are
        // joined in both directions, which R3 has nothing to say about and
        // which no reader could recover from the numbering. Always spoken.
        sentence = `Connects both ways with step ${word}.`;
      } else if (t.cycleEdges.has(edge)) {
        // R6 LOOPS: the looping step itself says so. The nested branch form
        // keeps "go back to step N" — that is a branch reference, which R4
        // governs, not the looping step's own sentence.
        sentence = `The process returns to step ${word}.`;
      } else if (t.nextInSegment.get(id) === edge.to) {
        // R3 IMPLICIT SEQUENCING. The successor is the next list item, so
        // the overview's convention sentence already carries this and the
        // step says nothing. A cycle edge never reaches here: it points at
        // a step numbered at or before this one, so it can never be the
        // next item.
        sentence = "";
      } else {
        sentence = `Proceed to step ${word}.`;
      }
      main = `<span class="diagram-action">${safeLabel}</span>${labelStop}${sentence ? ` ${sentence}` : ""}`;
    } else if (t.hasWayOut(id)) {
      // R23 TWO-WAY ENDINGS. No ordering edge LEAVES this step, so the chain
      // above found nothing to say — but a two-way edge ARRIVES at it, and
      // that is a way out. It is therefore not an ending, and it takes no
      // sentence of its own: the relation is already narrated at the other
      // end of the two-way edge, by R22's "Connects both ways with step N."
      // No new wording is minted here, which is what ruling 7 asked for.
      main = `<span class="diagram-action">${safeLabel}</span>${labelStop}`;
    } else {
      // R5 ENDINGS. A sole end point closes the process; where several
      // paths end, each says so for itself. The count is the diagram-wide
      // one the overview reports, so the two always agree — and since R23
      // both read `hasWayOut`, they cannot drift apart.
      const ending =
        t.endCount === 1 ? NARRATION.SOLE_ENDING : NARRATION.PATH_ENDING;
      main = `<span class="diagram-node">${safeLabel}</span>${labelStop} ${ending}`;
    }

    // R14 REJOIN ACKNOWLEDGEMENT. A generator-owned sentence naming the
    // paths this step gathers, before the step's own text — so it reads
    // ahead of the "Decision point:" prefix where the rejoin is a diamond.
    // Fires only at an R7 rejoin, whatever the node type.
    const gathered = t.rejoinAcknowledgement.get(id);
    if (gathered) {
      const gatheredWords = gathered.targets.map((target) =>
        Common.narrationNumber(t.numberOf.get(target))
      );
      main = `The ${Common.narrationNumber(gathered.targets.length)} parallel paths from steps ${joinPlain(gatheredWords)} meet here. ${main}`;
    }

    // Appended sentences: unlabelled self-loops, then open links (narrated
    // on the edge's start-side step only).
    let appendix = "";
    if (loops.some((edge) => !edge.label)) {
      appendix += " This step can repeat itself.";
    }
    // R12 OPEN LINKS. A link without an arrowhead is an association, not
    // flow, so it is spoken after the step's flow sentences — and it names
    // the step number as well as the label, because the thread it reaches is
    // numbered and a bare label leaves the listener no way to find it.
    for (const edge of opens) {
      appendix += ` It is also linked to ${stepReference(edge.to, t)}.`;
    }

    // Newlines between elements keep text-content extraction readable:
    // without them, block and list boundaries concatenate with no space.
    if (nestedItems.length) {
      return `<li>${main}${appendix}\n<ul class="decision-paths">\n${nestedItems.join("\n")}\n</ul>\n</li>`;
    }
    return `<li>${main}${appendix}</li>`;
  }

  /**
   * Generate a detailed description for a flowchart
   *
   * Async since stage 3 of the flowchart rewrite: the narration is built
   * from the parse adapter's normalised graph — order by flow, never by
   * alphabet — to contract clauses D1 to D6. A parse rejection or a failed
   * adapter self-check propagates; the core's catch produces the honest
   * generation-failed statement (pinned by fault-pie/generator-throws).
   * Never catch and narrate anyway.
   *
   * @param {HTMLElement} svgElement - Unused since stage 3; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("generateDetailedDescription", "Generating flowchart description");

    const graph = withNarratableLabels(
      await window.MermaidParseAdapter.parse(code)
    );
    if (window.MermaidParseAdapter.isHealthy() === false) {
      throw new Error(
        "Parse adapter failed its self-check; refusing to narrate an unverified graph"
      );
    }

    const t = buildFlowchartTraversal(graph);
    // The step total counts ALL nodes, isolated ones included (stage 3.1
    // amendment B); the overview then says how many are unconnected.
    const totalSteps = graph.nodes.length;

    // --- Overview -------------------------------------------------------
    const sentences = [];

    const directionPhrase = DIRECTION_PHRASES[graph.direction] || "";
    let flowSentence = directionPhrase
      ? `This flowchart flows from ${directionPhrase} through ${totalSteps} step${totalSteps === 1 ? "" : "s"}`
      : `This flowchart flows through ${totalSteps} step${totalSteps === 1 ? "" : "s"}`;
    if (t.diamondCount > 0) {
      flowSentence += `, including ${Common.narrationNumber(t.diamondCount)} decision point${t.diamondCount === 1 ? "" : "s"}`;
    }
    if (t.isolated.length > 0) {
      flowSentence +=
        t.isolated.length === 1
          ? `, one of which is not connected to the others`
          : `, ${Common.narrationNumber(t.isolated.length)} of which are not connected to the others`;
    }
    sentences.push(`${flowSentence}.`);

    // R1 NAMED ENDPOINTS. The overview names the start and end labels when
    // there are at most three of each, and counts them beyond that. The
    // three phrasings for one, two and three ends are the frozen gold ones
    // (exemplars 1 and 5, 3 and 4, 2 respectively); the beyond-three form
    // is the three-end form with its list dropped.
    //
    // Routed through quoteAuthorLabel, the branch layer's one escaping site,
    // so the escape-exactly-once decision is made in a single place. Its
    // header carries the reasoning: the generator's own quotation marks are
    // markup and stay literal, and a second escaping pass would emit
    // "&amp;quot;" on a label carrying an author quote, which one fixture
    // forbids by name.
    const quotedLabel = (id) =>
      quoteAuthorLabel(t.nodeById.get(id).label, "double");
    // A zero start count is unreachable (stage 3.1 amendment A): every
    // edge into a component's first-numbered node is a cycle edge, so
    // each component contributes at least one start point. A diagram with
    // no numbered steps at all simply skips this sentence.
    if (t.mainStartIds.length > 0) {
      const starts = t.mainStartIds.map(quotedLabel);
      const ends = t.mainEndIds.map(quotedLabel);
      let beginClause;
      if (starts.length === 1) {
        beginClause = `It begins at ${starts[0]}`;
      } else if (starts.length === 2) {
        beginClause = `It begins at either ${starts[0]} or ${starts[1]}`;
      } else if (starts.length === 3) {
        beginClause = `It begins at one of three points: ${joinPlain(starts, "or")}`;
      } else {
        beginClause = `It begins at one of ${Common.narrationNumber(starts.length)} starting points`;
      }

      // Where an open-link thread carries an ending of its own, the ending
      // named here is the MAIN path's — gold exemplar 6 names one of its
      // two end points and leaves the thread's to R12's clause.
      const mainPath = t.threadEndCount > 0;
      const endsLead = mainPath
        ? ends.length === 1
          ? "its main path ends at"
          : "its main paths end at"
        : ends.length <= 2
          ? "ends at"
          : "every path ends at";
      let endClause;
      if (ends.length === 0) {
        endClause = "has no distinct end point";
      } else if (ends.length === 1) {
        endClause = `${endsLead} ${ends[0]}`;
      } else if (ends.length === 2) {
        endClause = `${endsLead} either ${ends[0]} or ${ends[1]}`;
      } else if (ends.length === 3) {
        endClause = `${endsLead} one of three outcomes: ${joinPlain(ends, "or")}`;
      } else {
        endClause = `${endsLead} one of ${Common.narrationNumber(ends.length)} outcomes`;
      }
      sentences.push(`${beginClause} and ${endClause}.`);
    }

    // R2 DECISION-POINT NAMING AND REJOIN. Only when the diagram has
    // exactly one decision point AND its branches rejoin; with no rejoin
    // the overview says nothing beyond the count in the flow sentence
    // (gold exemplar 5 is the frozen witness for that silence).
    if (t.diamondCount === 1) {
      // Must use the SAME predicate diamondCount was derived from, or the
      // count could refer to one node and this lookup find another.
      const soleDecision = t.stepsInOrder.find((id) => t.decisionIds.has(id));
      const rejoin = soleDecision ? t.rejoinOf(soleDecision) : null;
      const branchCount = soleDecision
        ? t.orderingOut
            .get(soleDecision)
            .filter((edge) => !t.cycleEdges.has(edge)).length
        : 0;
      if (rejoin && branchCount >= 2) {
        sentences.push(
          `The decision point, ${quotedLabel(soleDecision)}, splits the flow into ${Common.narrationNumber(branchCount)} paths that rejoin at step ${Common.narrationNumber(t.numberOf.get(rejoin))}.`
        );
      }
    }

    if (t.components.length > 1) {
      sentences.push(
        `The diagram contains ${Common.narrationNumber(t.components.length)} separate flows.`
      );
    }

    // R8's overview clause. It counts the groups and says WHERE they are.
    //
    // "whose names appear as headings in the list below" replaced "marked by
    // headings in the list below" on 20 August 2026, at version 7 of the gold
    // targets — the first amendment to a frozen exemplar's text this project
    // has made. The withdrawn wording invites a one-to-one reading of the
    // heading COUNT, and R8 version 6 (19 August 2026) licensed a group whose
    // steps are forced apart to repeat its heading over several segments, so
    // the counts legitimately disagree: the probe sweep measured two groups
    // over five headings. Two groups still have two NAMES, and every heading
    // carries one of them, which is true however often a name recurs. The gold
    // sentence predated the rule that invalidated it.
    //
    // The ungrouped runs are then named, collapsed to ranges by the
    // convention the ordering specification pins.
    //
    // The closing comma before "sit" is gold exemplar 4's ("…and step 11, sit
    // outside the groups") and is written only when the list itself is
    // comma-joined; a single run reads "step five sits outside the groups"
    // with no comma. DERIVED for the single-run case, which gold does not
    // show.
    if (graph.subgraphs.length > 0) {
      const groupCount = graph.subgraphs.length;
      const ungrouped = t.stepsInOrder
        .filter((id) => !t.groupOf(id))
        .map((id) => t.numberOf.get(id));
      let clause = `The steps fall into ${Common.narrationNumber(groupCount)} group${groupCount === 1 ? "" : "s"}, whose names appear as headings in the list below`;
      if (ungrouped.length > 0) {
        const phrases = stepRunPhrases(ungrouped);
        const verb = ungrouped.length === 1 ? "sits" : "sit";
        const noun = groupCount === 1 ? "group" : "groups";
        clause += `; ${joinClauses(phrases)}${phrases.length > 1 ? "," : ""} ${verb} outside the ${noun}`;
      }
      sentences.push(`${clause}.`);
    }

    // R7's overview mention and R6's loop addresses share ONE sentence,
    // joined with ", and", as gold exemplar 5's frozen overview shows. Each
    // stands alone, capitalised, when it is the only clause present.
    const structureClauses = [];

    for (const split of t.splits) {
      const at = `at step ${Common.narrationNumber(t.numberOf.get(split.id))}`;
      const ways = `the flow splits into ${Common.narrationNumber(split.targets.length)} parallel paths`;
      structureClauses.push(
        split.rejoin
          ? `${at} ${ways} that rejoin at step ${Common.narrationNumber(t.numberOf.get(split.rejoin))}`
          : `${at} ${ways}`
      );
    }

    // R6 LOOPS. One loop names both ends; several count themselves and give
    // their step addresses, in step order, without naming each target.
    const cycleList = [...t.cycleEdges].sort(
      (a, b) => t.numberOf.get(a.from) - t.numberOf.get(b.from)
    );
    if (cycleList.length === 1) {
      const edge = cycleList[0];
      structureClauses.push(
        `one loop returns the flow from step ${Common.narrationNumber(t.numberOf.get(edge.from))} to step ${Common.narrationNumber(t.numberOf.get(edge.to))}`
      );
    } else if (cycleList.length > 1) {
      const addresses = cycleList.map(
        (edge) => `from step ${Common.narrationNumber(t.numberOf.get(edge.from))}`
      );
      structureClauses.push(
        `${Common.narrationNumber(cycleList.length)} loops return the flow to earlier steps, ${joinPlain(addresses)}`
      );
    }

    // R20 REPEAT CLAUSE, after R6's loops and before R19's threads, so the
    // ruled order — loops first — holds and threads still read last.
    //
    // R20's ruled forms are NOUN PHRASES ("one step that can repeat"), which
    // is what the short tier's feature list wants and what it uses verbatim.
    // A structure clause here has to carry a verb: every sibling does, and a
    // lone clause is capitalised and given a full stop, where a bare noun
    // phrase would render "One step that can repeat." and not be a sentence.
    // The ruled phrase is therefore kept intact inside an existential carrier,
    // which reads correctly both alone and joined — "There is one step that
    // can repeat." and "…from step four and from step nine, and there are
    // three steps that can repeat."
    if (t.repeatStepCount > 0) {
      const repeatWord = Common.narrationNumber(t.repeatStepCount);
      const repeatVerb = t.repeatStepCount === 1 ? "is" : "are";
      const repeatNoun = t.repeatStepCount === 1 ? "step" : "steps";
      structureClauses.push(
        `there ${repeatVerb} ${repeatWord} ${repeatNoun} that can repeat`
      );
    }

    // R19 THREAD CLAUSES, last in the structure sentence — gold exemplar 6
    // puts the thread after the loop ("One loop returns the flow from step 13
    // to step 10, and an open link joins step 12 to a final two-step
    // thread…"), and a thread is the furthest thing from the main flow that
    // this sentence describes, so it reads last on both counts.
    for (const thread of t.threads) {
      structureClauses.push(threadClause(thread, t, t.stepsInOrder.length));
    }

    if (structureClauses.length > 0) {
      sentences.push(`${Common.capitalize(joinClauses(structureClauses))}.`);
    }

    // R3's convention sentence, and it goes LAST: it is what licenses every
    // in-sequence step to stay silent, so it is read after the flow has been
    // described rather than interrupting it. All six gold exemplars close
    // their overview with it.
    //
    // Guarded on there being a numbered list to describe. A diagram whose
    // nodes are all isolated renders no steps, and a convention about an
    // order that nothing follows would be saying nothing about nothing.
    if (t.stepsInOrder.length > 0) {
      sentences.push(NARRATION.SEQUENCE_CONVENTION);
    }

    // --- Assembly ---------------------------------------------------------
    const parts = [];
    parts.push(`<section class="mermaid-section">`);
    parts.push(`<h4 class="mermaid-details-heading">Overview</h4>`);
    parts.push(`<p>${sentences.join(" ")}</p>`);
    parts.push(`<h4 class="mermaid-details-heading">Steps</h4>`);

    // R8 HEADING ALLOCATION, pinned 19 August 2026 (re-open trigger: user
    // feedback). Groups take h5 in a single-component diagram, which is the
    // frozen exemplar 4 witness. In a MULTI-component diagram the per-flow
    // headings keep h5 and groups drop to h6, so a group stays nested under
    // the flow it belongs to rather than competing with it. That case has no
    // gold witness and no corpus fixture; Session 6's multi-component fixture
    // is its witness.
    const multiComponent = t.components.length > 1;
    const groupHeadingTag = multiComponent ? "h6" : "h5";
    // A diagram can declare a subgraph that holds no numbered step, in which
    // case every segment is ungrouped and a lone "Ungrouped steps" heading
    // would be furniture over the whole list. Segmented rendering therefore
    // turns on a segment actually CARRYING a group, not on the subgraph count.
    const isSegmented = (component) =>
      component.segments.some((segment) => segment.group);

    if (multiComponent) {
      t.components.forEach((component, index) => {
        parts.push(
          `<h5 class="flow-heading">Flow ${Common.narrationNumber(index + 1)}</h5>`
        );
        if (isSegmented(component)) {
          parts.push(
            ...GROUP_PRESENTATION.render(component.segments, t, groupHeadingTag)
          );
        } else {
          parts.push(
            `<ol class="flowchart-steps" start="${t.numberOf.get(component.stepIds[0])}">`
          );
          for (const id of component.stepIds) {
            parts.push(renderStepItem(id, t));
          }
          parts.push(`</ol>`);
        }
      });
    } else if (t.components.length === 1 && isSegmented(t.components[0])) {
      parts.push(
        ...GROUP_PRESENTATION.render(t.components[0].segments, t, groupHeadingTag)
      );
    } else {
      // One component with no groups, or no components at all (every node
      // isolated, so stepsInOrder is empty and this renders an empty list —
      // the pre-R8 behaviour, deliberately unchanged).
      parts.push(`<ol class="flowchart-steps">`);
      for (const id of t.stepsInOrder) {
        parts.push(renderStepItem(id, t));
      }
      parts.push(`</ol>`);
    }

    if (t.isolated.length > 0) {
      // Each label is escaped BEFORE the list is formatted — formatList
      // inserts its own commas and "and", which must not be escaped.
      const labels = t.isolated.map((id) =>
        Common.escapeHtml(t.nodeById.get(id).label)
      );
      const countWord = Common.capitalize(Common.narrationNumber(t.isolated.length));
      const noun = t.isolated.length === 1 ? "step" : "steps";
      const verb = t.isolated.length === 1 ? "is" : "are";
      parts.push(
        `<p>${countWord} ${noun}, ${Common.formatList(labels)}, ${verb} not connected to the others.</p>`
      );
    }

    // THE TRAILING "Groups" SECTION IS GONE, retired by R8 in Session 5.
    //
    // It listed each group and the steps it held, after the step list. R8
    // moves that information INTO the list as subheadings, and the frozen
    // exemplar 4 fragment — the rule's own witness — carries no such section,
    // so keeping one would say everything twice.
    //
    // ONE THING WAS LOST WITH IT, and it is recorded rather than quietly
    // dropped: the old section was the only place a NESTED group was narrated
    // ("X contains the group Y and steps one and two"). Headed segments carry
    // membership and cannot express containment, because a step belongs to
    // exactly one segment. No exemplar and no corpus fixture nests a subgraph,
    // so nothing measures the loss today. If it matters, the answer is
    // probably a containment sentence in the overview rather than the section
    // coming back — but that is a ruling nobody has made, and inventing it
    // here would have put an unwitnessed shape into the one release that was
    // meant to reach gold exactly.

    parts.push(`</section>`);
    // Newline-joined for the same text-extraction reason as the list items.
    return parts.join("\n");
  }


  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator("flowchart", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    // Add a new property for HTML-formatted short description
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
    // Add a flag to help with CSS class application
    diagramType: "flowchart",
  });

  // Public API to allow runtime configuration of logging levels
  const publicAPI = {
    // Allow external configuration of logging level
    setLogLevel: function (level) {
      if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
        logInfo("setLogLevel", `Logging level changed to ${level}`);
      } else {
        logWarn("setLogLevel", `Invalid log level: ${level}`);
      }
    },

    getLogLevel: function () {
      return currentLogLevel;
    },

    // Expose log level constants for external use
    LOG_LEVELS: LOG_LEVELS,
  };

  logInfo(
    "Flowchart Module",
    "Flowchart module loaded and registered with enhanced parsing for complex diagrams"
  );

  return publicAPI;
})();

// Export statements (outside the IIFE as required)
if (typeof module !== "undefined" && module.exports) {
  module.exports = FlowchartModule;
} else {
  window.FlowchartModule = FlowchartModule;
}
