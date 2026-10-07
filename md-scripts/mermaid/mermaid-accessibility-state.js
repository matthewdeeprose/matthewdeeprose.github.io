/**
 * Mermaid Accessibility - State Diagram Module
 * Generates accessible descriptions for state diagrams
 */
(function () {
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

  // Current logging level - can be modified at runtime if needed
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message, ...args);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("[Mermaid Accessibility] Core module not loaded!");
    return;
  }

  // Utility function aliases
  // Diagram-source text is escaped once, where it enters an HTML string. This
  // module's ONLY short tier is plain text (there is no generateShortHTML): it
  // feeds the figcaption and the SVG aria-label, neither of which parses HTML,
  // so it is deliberately left raw.
  const Common = window.MermaidAccessibilityCommon;
  // MermaidAccessibilityUtils is deliberately NOT aliased here. Its only
  // consumer in this module was extractTitleFromSVG, removed by item 67 below.

  // Mermaid's YAML frontmatter opens the source and closes on a `---` of its
  // own. Nothing before the opener counts as frontmatter.
  const FRONTMATTER_PATTERN =
    /^\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

  // A top-level `title:` inside that block. Anchored at column 0 on purpose: a
  // `title:` indented under another key belongs to that key, and Mermaid draws
  // no caption for it (measured 28 August 2026 on `config:` / `  title:`).
  const FRONTMATTER_TITLE_PATTERN = /^title[ \t]*:[ \t]*(.*)$/m;

  // YAML strips one layer of matching quotes and the drawing follows YAML:
  // `title: "Quoted caption"` renders as Quoted caption (measured 28 August
  // 2026). The inner classes exclude the delimiter, so a value carrying its own
  // quotes is left alone rather than mis-stripped.
  const DOUBLE_QUOTED_PATTERN = /^"([^"]*)"$/;
  const SINGLE_QUOTED_PATTERN = /^'([^']*)'$/;

  /**
   * Strip one layer of matching YAML quotes from a frontmatter scalar
   * @param {string} value - The raw text after `title:`
   * @returns {string} The value with a single matching quote pair removed
   */
  function stripMatchingQuotes(value) {
    const doubled = DOUBLE_QUOTED_PATTERN.exec(value);
    if (doubled) return doubled[1];

    const singled = SINGLE_QUOTED_PATTERN.exec(value);
    if (singled) return singled[1];

    return value;
  }

  /**
   * Extract the diagram's caption title from the SOURCE, and only from there.
   *
   * Item 67. This site used to read `Utils.extractTitleFromSVG(svgElement)`,
   * which returns the rendered SVG's `<title>` element — and that is exactly
   * where Mermaid writes an `accTitle`. An accTitle is an accessible NAME; a
   * title is a caption. Narrating the one as the other claimed a title the
   * author never wrote.
   *
   * Measured 28 August 2026 against the pinned build at securityLevel strict,
   * reading the rendered SVG directly:
   *   accTitle only      `<title>` carries the accTitle; there is no `<text>`
   *   frontmatter title  no `<title>`; one `<text class="statediagramTitleText">`
   *   both               `<title>` carries the accTitle and the real title is
   *                      drawn as that `<text>` — so the caption was DISCARDED
   *                      and the accessible name narrated in its place
   *   neither            no `<title>` and no `<text>` at all
   * A bare `title X` body line is not state syntax: it draws nothing.
   *
   * The shared helper is deliberately NOT changed. Its two other callers do not
   * have this defect — sequence prefers its own parsed title, and common.js
   * reaches it only after a source regex has failed — so a helper-level fix
   * would spread a state-only defect into two modules that do not have it.
   * `Common.parseDiagramTitle` is not reusable here either: its `/title\s+/`
   * pattern cannot match the frontmatter `title:` form, it falls back to the
   * same SVG helper, and it returns a default string where this site needs null.
   *
   * @param {string} code - The original mermaid source, frontmatter included
   * @returns {string|null} The frontmatter title, or null when there is none
   */
  function extractTitleFromSource(code) {
    if (!code) return null;

    const frontmatter = FRONTMATTER_PATTERN.exec(code);
    if (!frontmatter) return null;

    const titleLine = FRONTMATTER_TITLE_PATTERN.exec(frontmatter[1]);
    if (!titleLine) return null;

    const title = stripMatchingQuotes(titleLine[1].trim()).trim();
    return title || null;
  }

  /**
   * Generate a short description for a state diagram
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} A short description
   */
  function generateShortDescription(svgElement, code) {
    logDebug(
      "[Mermaid Accessibility] Generating short state diagram description"
    );

    // Parse the state diagram
    const parsedData = parseStateDiagram(code);

    // Extract the caption title, from the SOURCE only — see the helper above
    // for why the rendered SVG is not consulted (item 67).
    const title = extractTitleFromSource(code);

    // Count states (excluding initial/final markers)
    const regularStates = parsedData.allStates.filter(
      (state) => state !== "[*]"
    );

    // Build a concise description
    let description = `A state diagram`;

    if (title) {
      description += ` titled "${title}"`;
    }

    description += ` showing a lifecycle with ${regularStates.length} state${
      regularStates.length !== 1 ? "s" : ""
    }`;

    if (parsedData.initialStates.length > 0) {
      // Ledger entry 10, measured 13 August 2026: the article was a ternary
      // that emitted "" on the plural arm, so two initial states read
      // "starting from  Draft and Imported states" — a double space and no
      // article at all. The article is invariant; only the noun takes the
      // number. The singular arm's output is unchanged by this.
      description += `, starting from the ${formatStateList(
        parsedData.initialStates.map((s) => displayNameFor(parsedData, s))
      )} state${parsedData.initialStates.length !== 1 ? "s" : ""}`;
    }

    if (parsedData.finalStates.length > 0) {
      // Ledger entry 10, same arc: the identical ternary sat here, so two
      // final states would have read "and ending at  X and Y states". Fixed by
      // extension of the initial clause's approved wording rather than by its
      // own measurement — the defect is DEFENSIVE and unpinnable, because no
      // corpus fixture has more than one final state (the position entry 3 was
      // accepted in). The singular arm already carried "the" and is unchanged.
      description += ` and ending at the ${formatStateList(
        parsedData.finalStates.map((s) => displayNameFor(parsedData, s))
      )} state${parsedData.finalStates.length !== 1 ? "s" : ""}`;
    }

    description += ".";

    logDebug(
      "[Mermaid Accessibility] Short description generated:",
      description
    );
    return description;
  }

  /**
   * Format a list of states for readable output
   * @param {Array} states - Array of state names
   * @returns {string} Formatted list of states
   */
  function formatStateList(states) {
    // Handle special case for initial/final markers
    const formattedStates = states.map((state) =>
      state === "[*]" ? "initial/final" : state
    );

    if (formattedStates.length === 1) {
      return formattedStates[0];
    } else if (formattedStates.length === 2) {
      return `${formattedStates[0]} and ${formattedStates[1]}`;
    } else {
      const lastState = formattedStates.pop();
      return `${formattedStates.join(", ")}, and ${lastState}`;
    }
  }

  /**
   * Clean state name to handle quoted strings and special formats
   * @param {string} stateName - The raw state name from the diagram
   * @returns {string} Cleaned state name
   */
  function cleanStateName(stateName) {
    if (!stateName) return "";

    // Handle quoted state names
    if (
      (stateName.startsWith('"') && stateName.endsWith('"')) ||
      (stateName.startsWith("'") && stateName.endsWith("'"))
    ) {
      return stateName.substring(1, stateName.length - 1);
    }

    // Handle state with description format "State: Description"
    if (stateName.includes('": ')) {
      // Extract just the state name part
      return stateName.replace(/^"([^"]+)":\s.*$/, "$1");
    }

    return stateName;
  }

  /**
   * Resolve a state id to the name the author gave it.
   *
   * Transitions, initial states and final states all reference a state by its
   * id, so this is the single seam at which a name enters a description string.
   * It is applied BEFORE escaping, so the escaper sees the display name
   * (transform then escape).
   *
   * A diagram that declares no alias has an empty map, so every call returns its
   * argument unchanged and such a diagram's description cannot move.
   *
   * @param {Object} parsedData - Parsed diagram data
   * @param {string} id - The state id as it appears in the parsed structure
   * @returns {string} The declared display name, or the id when none exists
   */
  function displayNameFor(parsedData, id) {
    const names = parsedData && parsedData.displayNames;
    if (!names || !Object.prototype.hasOwnProperty.call(names, id)) return id;
    return names[id];
  }

  // The case a transition-label arm applies to the words it quotes.
  const LABEL_CASE = Object.freeze({
    VERBATIM: "verbatim",
    LOWER_FIRST: "lower-first",
    LOWER_ALL: "lower-all",
  });

  /**
   * Apply a label case rule to a string.
   * @param {string} text - The label, or one piece of it
   * @param {string} rule - A LABEL_CASE value
   * @returns {string} The text with the rule applied
   */
  function applyLabelCase(text, rule) {
    if (rule === LABEL_CASE.LOWER_FIRST) {
      return text.charAt(0).toLowerCase() + text.slice(1);
    }
    if (rule === LABEL_CASE.LOWER_ALL) return text.toLowerCase();
    return text;
  }

  /**
   * Join the text of a segment list.
   * @param {Array<{text: string, href?: string}>} segments - Label pieces
   * @returns {string} The plain label the pieces make
   */
  function joinSegmentText(segments) {
    return segments.map((segment) => segment.text).join("");
  }

  /**
   * Render a name or label for the detailed tier, with the link it draws as a
   * working link (item 82, L2) when the pieces read as the text. With no
   * usable pieces this is exactly escapeHtml of the cased text, so a caller
   * that passes none is byte-identical to what it was.
   * @param {string} text - The narrated text
   * @param {Array<{text: string, href?: string}>} [segments] - Label pieces
   * @param {string} rule - A LABEL_CASE value
   * @returns {string} HTML for the text
   */
  function labelHtml(text, segments, rule) {
    const cased = applyLabelCase(text, rule);
    if (!Array.isArray(segments) || joinSegmentText(segments) !== text) {
      return Common.escapeHtml(cased);
    }
    // Lower-first touches only the first character, which belongs to the first
    // piece; lower-all touches every piece. Either way the words are the same.
    const lowered =
      rule === LABEL_CASE.LOWER_FIRST
        ? segments.map((segment, index) =>
            index === 0
              ? { ...segment, text: applyLabelCase(segment.text, rule) }
              : segment
          )
        : segments.map((segment) => ({
            ...segment,
            text: applyLabelCase(segment.text, rule),
          }));
    return Common.renderSegmentsHtml(lowered, cased);
  }

  // Arm (a) of transitionLabelPhrase: a label opening with one of these already
  // reads as a clause, so it is spoken as the author wrote it.
  const CONDITION_WORD_PATTERN = /^(?:if|when|after|on|once|upon)\b/i;

  // Arm (c): a single capitalised word, the "Start" / "Submit" event-name shape.
  const SINGLE_CAPITALISED_WORD_PATTERN = /^[A-Z][a-z]*$/;

  /**
   * Build the narration phrase for a transition label.
   *
   * Item 11 ledger entry 4 (docs/mermaid-outstanding.md; session report
   * docs/mermaid-state-wording-2026-08-07.md): the four near-identical inline
   * scaffolds this replaces DEFAULTED to " when the <label>", which assumes
   * every label reads as a noun phrase and lower-cases its first character on
   * the way. A label that is a proper noun or a clause of its own came out as
   * prose like "…to the Archived state when the tom & Jerry.".
   *
   * The four arms are tried in order and the first match wins:
   *   (a) opens with a condition word  -> spoken as-is, first character lowered
   *   (b) two or more words, last ends in "s" (subject-plus-verb) -> "when the"
   *   (c) a single capitalised word    -> "after <lowercased>"
   *   (d) anything else                -> ", labelled \"<verbatim>\""
   *
   * The label is escaped exactly ONCE, here, inside the diagram-label span —
   * call sites must not escape it again. The furniture (the span, the wording,
   * the quotation marks in arm d) is generator-authored and never escaped.
   * Lower-casing in arm (a) is safe by construction: the first word is one of
   * the six function words above. Arm (d) never lower-cases, because that is
   * where proper nouns live and mangling their case was part of the defect.
   *
   * @param {string} label - The transition label, already trimmed
   * @returns {string} The phrase to append after the state name, "" if no label
   */
  function transitionLabelPhrase(label, segments) {
    if (!label) return "";

    // Item 82, L2: `segments` is passed ONLY by the one site that writes the
    // label's anchor; every other call reads the text, exactly as before. The
    // case a phrase arm applies is applied to the segment text too, so the
    // words are the same with or without an anchor in them.
    const inSpan = (rule) =>
      `<span class="diagram-label">${labelHtml(label, segments, rule)}</span>`;

    // (a) The label is already a condition — do not wrap it in one.
    if (CONDITION_WORD_PATTERN.test(label)) {
      logDebug("[Mermaid Accessibility] Transition label arm (a):", label);
      return ` ${inSpan(LABEL_CASE.LOWER_FIRST)}`;
    }

    // (b) Subject plus verb, such as "payment occurs". A lone "occurs" or a
    // bare plural "errors" deliberately does NOT qualify — it is arm (d).
    const words = label.split(/\s+/);
    if (
      words.length >= 2 &&
      words[words.length - 1].toLowerCase().endsWith("s")
    ) {
      logDebug("[Mermaid Accessibility] Transition label arm (b):", label);
      return ` when the ${inSpan(LABEL_CASE.LOWER_FIRST)}`;
    }

    // (c) A simple event name, such as "Start".
    if (SINGLE_CAPITALISED_WORD_PATTERN.test(label)) {
      logDebug("[Mermaid Accessibility] Transition label arm (c):", label);
      return ` after ${inSpan(LABEL_CASE.LOWER_ALL)}`;
    }

    // (d) Everything else is quoted verbatim rather than forced into a phrase.
    logDebug("[Mermaid Accessibility] Transition label arm (d):", label);
    return `, labelled "${inSpan(LABEL_CASE.VERBATIM)}"`;
  }

  /**
   * Build the narration phrase for the label on a CYCLE edge.
   *
   * Item 11 ledger entry 7 (docs/mermaid-outstanding.md): `identifyCycles`
   * narrated a single cycle as " via the <label> action" and lower-cased the
   * WHOLE label on the way, so a proper-noun cycle label read "via the tom &
   * jerry action". A second, latent defect sat beside it: the cycle map stored
   * `transition.label || "a transition"`, which made the empty arm of the call
   * site's ternary unreachable, so an UNLABELLED cycle read "via the a
   * transition action" — measured before the fix, not inferred from the source.
   *
   * Three arms are tried in order and the first match wins:
   *   (a) no label                    -> "" — the sentence carries no clause
   *   (b) opens with a condition word -> spoken as-is, first character lowered
   *   (c) anything else               -> ' via the "<verbatim>" transition'
   *
   * This mirrors entry 4's principle in `transitionLabelPhrase`: proper nouns
   * live in an arm that quotes the label VERBATIM and never touches its case.
   * Lower-casing in arm (b) is safe by construction — the first word is one of
   * the six function words in CONDITION_WORD_PATTERN. The noun is "transition"
   * rather than "action", deliberately: what is narrated is an edge, which is
   * what this module calls it everywhere else.
   *
   * The label is escaped exactly ONCE, here, inside the diagram-label span —
   * the call site must not escape it again. The quotation marks and the word
   * "transition" are generator-authored furniture and sit OUTSIDE the span.
   *
   * @param {string} label - The cycle transition's label, "" when there is none
   * @returns {string} The phrase to append after "the initial state", "" if none
   */
  function cycleLabelPhrase(label) {
    // (a) An unlabelled cycle edge is narrated by the sentence alone.
    if (!label) {
      logDebug("[Mermaid Accessibility] Cycle label arm (a): no label");
      return "";
    }

    const inSpan = (text) =>
      `<span class="diagram-label">${Common.escapeHtml(text)}</span>`;

    // (b) The label is already a condition — do not wrap it in one.
    if (CONDITION_WORD_PATTERN.test(label)) {
      logDebug("[Mermaid Accessibility] Cycle label arm (b):", label);
      const lowerFirst = label.charAt(0).toLowerCase() + label.slice(1);
      return ` ${inSpan(lowerFirst)}`;
    }

    // (c) Everything else is quoted verbatim rather than case-folded.
    logDebug("[Mermaid Accessibility] Cycle label arm (c):", label);
    return ` via the "${inSpan(label)}" transition`;
  }

  /**
   * The narration phrase for the labelled edge OUT OF the initial marker into
   * one state.
   *
   * Ledger entry 8, measured in docs/mermaid-ledger-grounding-2026-08-13.md
   * Part A: the parser stores `[*]` edges under the `[*]` key exactly like any
   * other source, and NOTHING in this module ever read that key — the per-state
   * list returns early on `[*]`, the overview starts from the state after the
   * marker, and every other site filters the marker out. So
   * `[*] --> Draft : if ready` reached no description tier at all while the
   * rendered canvas showed the label. The three sites that name an initial
   * state now ask here for it.
   *
   * The phrase carries its own leading separator and is escaped exactly once,
   * inside `transitionLabelPhrase` — call sites concatenate it directly, the
   * same pattern the per-state transition list already uses. Do not escape it
   * again.
   *
   * The TARGET direction (an edge INTO `[*]`) was measured NOT defective and is
   * untouched: it is narrated by the per-state list and by the overview.
   *
   * @param {Object} parsedData - Parsed diagram data
   * @param {string} state - The state id the initial edge points at
   * @param {{links?: boolean}} [options] - `links: true` at the one place the
   *   label's link is written (the Initial State list); absent, the text is read
   * @returns {string} The phrase, or "" when there is no such edge or no label
   */
  function initialEdgePhrase(parsedData, state, options) {
    const transitions = parsedData && parsedData.stateTransitions;
    const edges = (transitions && transitions["[*]"]) || [];
    const edge = edges.find((candidate) => candidate.target === state);
    if (!edge || !edge.label) return "";
    const segments = options && options.links ? edge.segments : undefined;
    return transitionLabelPhrase(edge.label.trim(), segments);
  }

  // ITEM 82, ENACTMENT 5 (3 October 2026): "a line break the picture draws is
  // read as a space; a <br> the picture prints as characters is read as
  // written." State's canvas breaks on every typed spelling (`<br>`, `<br/>`,
  // `<br />`, `<BR>`, a run, spaced) on a transition label and on a state
  // alias name, measured 2 October 2026 (measurement 2 § 3), so the shared
  // rule is called with its default (all) form set. The rule is the adapter's
  // and is resolved off window AT CALL TIME. The parse reads raw source
  // bytes, so an escaped `&lt;br&gt;` or `#lt;br#gt;` is not matched; the
  // entity decode after the rules (entity slice, 6 October 2026,
  // decodeStateText) reads it as the characters the canvas prints. The
  // diagram TITLE is not read through this: the canvas prints a tag there. The description of a state
  // (`s1 : text`) breaks on the canvas and is read by nothing here.
  // ITEM 82, MARKUP ENACTMENT 4 (5 October 2026): "formatting the picture
  // draws is read as the plain text it formats." State's canvas draws
  // formatting tags, images, links and markdown emphasis on a transition label
  // and on a state alias name, and prints backticks (measurement 3 § 3.2), so
  // the adapter's markup rule is called with tags and emphasis on and codespan
  // off, after the break rule, resolved off window AT CALL TIME. An escaped
  // `&lt;b&gt;` or `#lt;b#gt;` is not matched (this parse reads raw source
  // bytes); the entity decode after it reads it as the characters the canvas
  // prints. A transition label that is only tags arrives empty, which this
  // module already reads as no label; an alias that is only tags draws an
  // empty state and is named by its id (readAliasBreaks). An alias containing a double quote never
  // reaches this site: the alias declaration's pattern stops at the first
  // inner quote, so the alias is dropped before any rule runs.
  const STATE_DRAWN_MARKUP = Object.freeze({
    tags: true,
    emphasis: true,
    codespan: false,
  });
  let warnedMarkupRuleMissing = false;

  /**
   * Read drawn markup in state text as the text it formats.
   * @param {Object} adapter - window.MermaidParseAdapter
   * @param {string} text - The text after the break rule
   * @returns {string} The text with drawn markup read as text, or the text
   *   as typed when the rule is not loaded
   */
  function readStateMarkup(adapter, text) {
    if (typeof adapter.replaceDrawnMarkup !== "function") {
      if (!warnedMarkupRuleMissing) {
        warnedMarkupRuleMissing = true;
        logWarn(
          "[Mermaid Accessibility] State: the shared markup rule is not loaded; labels and names are read as typed"
        );
      }
      return text;
    }
    return adapter.replaceDrawnMarkup(text, STATE_DRAWN_MARKUP);
  }

  /**
   * Read state text with typed line breaks as spaces and drawn markup as text.
   * @param {string} text - A transition label or an alias name
   * @returns {string} The text with breaks read as spaces; empty when it was
   *   only a break; unchanged when the rule is not loaded
   */
  function readStateBreaks(text) {
    if (typeof text !== "string" || text === "") return text;

    const adapter = window.MermaidParseAdapter;
    if (!adapter || typeof adapter.replaceTypedLineBreaks !== "function") {
      logWarn(
        "[Mermaid Accessibility] State: the shared line-break rule is not loaded; labels and names are read as typed"
      );
      return text;
    }
    const withoutBreaks = adapter.replaceTypedLineBreaks(
      text,
      adapter.LINE_BREAK_FORMS.ALL
    );
    return readStateMarkup(adapter, withoutBreaks);
  }

  /**
   * Read a `state "Name" as id` alias name.
   *
   * ITEM 82, HELD EMPTIES (6 October 2026): "a label that draws nothing (only
   * a break, or only spaces) is read as unlabelled, in each type's own
   * words." A name the break and markup rules empty (only breaks, only tags,
   * only spaces) is not a name: the state is named by its id in every
   * sentence, and the state list carries one disclosure sentence,
   * `State "s1" has an empty name.` The canvas draws an empty state for a
   * break-only or tag-only name and the id for a spaces-only one (measured
   * on 11.17.2). The emptiness test runs on the text AFTER the rules and
   * alters no bytes.
   * @param {string} name - The alias name after quote stripping
   * @returns {string|null} The name with breaks read as spaces, or null when
   *   the name draws nothing
   */
  function readAliasBreaks(name) {
    const read = readStateBreaks(name);
    return typeof read === "string" && read.trim() === ""
      ? null
      : decodeStateText(read);
  }

  /**
   * Did the author give this state an alias that draws nothing?
   * @param {Object} parsedData - Parsed diagram data
   * @param {string} id - The state id
   * @returns {boolean} True when the alias name is empty after the rules
   */
  function hasEmptyName(parsedData, id) {
    const empties = parsedData && parsedData.emptyNames;
    return Boolean(empties && Object.prototype.hasOwnProperty.call(empties, id));
  }

  // ITEM 82, ENTITY SLICE, ENACTMENT 1 (6 October 2026): "the words read the
  // characters the picture prints, decoded once and escaped once." A state
  // alias and a transition label are drawn into a foreignObject, which
  // resolves the author's references and Mermaid's `#name;` codes alike, so
  // the adapter's decodeAuthorTextFromSource (Mermaid's encode, then the full
  // decode) is applied LAST, after the break and markup rules, and every
  // narrating site escapes once. It matched the alias canvas on 15 of 15
  // forms (docs/mermaid-item-82-entity-measure-2026-10-06.md § 2). It is
  // resolved off window AT CALL TIME. An alias that draws nothing is never
  // decoded.
  let warnedDecodeMissing = false;

  /**
   * Decode state text as the canvas prints it.
   * @param {string} text - An alias name or transition label after the break
   *   and markup rules
   * @returns {string} The decoded text, or the text as typed when the decode
   *   is not loaded
   */
  function decodeStateText(text) {
    if (typeof text !== "string" || text === "") return text;

    const adapter = window.MermaidParseAdapter;
    if (!adapter || typeof adapter.decodeAuthorTextFromSource !== "function") {
      if (!warnedDecodeMissing) {
        warnedDecodeMissing = true;
        logWarn(
          "[Mermaid Accessibility] State: the shared source decode is not loaded; labels and names are read as typed"
        );
      }
      return text;
    }
    return adapter.decodeAuthorTextFromSource(text);
  }

  // The same slice, for the transition label only. Mermaid's state grammar
  // ends a statement at a `;`, so a label is CUT at its first `;` and the
  // canvas draws the text before it (the rest becomes stray states, an
  // upstream watch). Mermaid's encode runs first and turns its own `#name;`
  // and `#digits;` codes into placeholders, so their semicolons never cut;
  // an author's `&lt;` keeps its `;` and does cut, drawing `a <` for
  // `a &lt; b`. Measured 6 October 2026 on 11.17.2. Ruling (Matthew,
  // 6 October 2026): the words read the cut text as drawn.
  const STATEMENT_END_OR_CODE = /#\w+;|;/g;

  /**
   * Cut a transition label where Mermaid's grammar ends the statement.
   * @param {string} text - The label text after the colon, as typed
   * @returns {string} The text before the first `;` that is not part of a
   *   Mermaid `#name;` code, or the text unchanged when there is none
   */
  function cutTransitionLabel(text) {
    for (const match of text.matchAll(STATEMENT_END_OR_CODE)) {
      if (match[0] === ";") return text.slice(0, match.index);
    }
    return text;
  }

  // ITEM 82, L2 (6 October 2026): "a link the picture draws is a working link
  // in the words." The anchor is written ONCE per position, at its own place
  // in the structure lists: an alias in the per-state list (`<dt>`), a
  // transition label in the per-state transition list, or, for an edge out of
  // the initial marker, in the Initial State list. Every other site, about
  // twenty for an alias, reads the text. The segment reader is the adapter's
  // readLabelWithLinks, resolved off window AT CALL TIME like the two rules
  // above. Segments are kept ONLY when their join equals the text it already
  // narrates. Since the entity slice (6 October 2026) that text is decoded and
  // the reader is handed the source with `fromSource`, so a label carrying an
  // entity joins and keeps its anchor. A transition label is read from source
  // where Mermaid spells a double quote `#quot;`, so its href took one decode
  // here, after the adapter's own; on the `fromSource` route the adapter's
  // decode already resolves it and this one finds nothing left to do. It is
  // kept, not removed: removal was not measured.
  const ANCHOR_OPENING = /<a[\s/>]/i;
  const HASH_ENTITIES = Object.freeze({
    quot: '"',
    amp: "&",
    lt: "<",
    gt: ">",
    apos: "'",
  });
  let warnedLinkReaderMissing = false;

  /**
   * Decode Mermaid's `#name;` escapes in an href read from source.
   * @param {string} href - The href as the adapter delivered it
   * @returns {string} The href with the five named escapes read
   */
  function decodeHashEntities(href) {
    return href.replace(/#([a-z]+);/gi, (whole, name) =>
      Object.prototype.hasOwnProperty.call(HASH_ENTITIES, name.toLowerCase())
        ? HASH_ENTITIES[name.toLowerCase()]
        : whole
    );
  }

  /**
   * Read the link pieces of an alias name or a transition label.
   * @param {string} typedText - The text before the break and markup rules
   * @param {string} read - The text this module narrates (after the rules)
   * @param {{hashEntities: boolean}} options - `hashEntities` for a
   *   transition label, whose source spells a quote `#quot;`
   * @returns {Array<{text: string, href?: string}>|null} The pieces, or null
   *   when the text draws no link, the reader is not loaded, or the pieces
   *   would not read as the narrated text
   */
  function readStateSegments(typedText, read, options) {
    if (typeof typedText !== "string" || !ANCHOR_OPENING.test(typedText)) {
      return null;
    }

    const adapter = window.MermaidParseAdapter;
    if (!adapter || typeof adapter.readLabelWithLinks !== "function") {
      if (!warnedLinkReaderMissing) {
        warnedLinkReaderMissing = true;
        logWarn(
          "[Mermaid Accessibility] State: the shared link reader is not loaded; labels and names are read as typed, with no links"
        );
      }
      return null;
    }

    // `fromSource`: the reader encodes with Mermaid's rule first, so its
    // per-segment decode resolves what decodeStateText resolves and the
    // segments join to the narrated text (entity slice, 6 October 2026).
    const result = adapter.readLabelWithLinks(typedText, STATE_DRAWN_MARKUP, {
      fromSource: true,
    });
    if (!Array.isArray(result.segments) || result.segments.length === 0) {
      return null;
    }

    const segments = options.hashEntities
      ? result.segments.map((segment) =>
          segment.href === undefined
            ? segment
            : { ...segment, href: decodeHashEntities(segment.href) }
        )
      : result.segments;
    return joinSegmentText(segments) === read ? segments : null;
  }

  /**
   * A state's narrated name with the link it draws as a working link. Used at
   * the one site that writes the anchor; every other site escapes the name.
   * @param {Object} parsedData - Parsed diagram data
   * @param {string} id - The state id
   * @returns {string} HTML for the state's display name
   */
  function stateNameHtml(parsedData, id) {
    const links = parsedData && parsedData.displayLinks;
    const segments =
      links && Object.prototype.hasOwnProperty.call(links, id)
        ? links[id]
        : undefined;
    return labelHtml(displayNameFor(parsedData, id), segments, LABEL_CASE.VERBATIM);
  }

  /**
   * Parse state diagram from mermaid code
   * @param {string} code - The mermaid diagram code
   * @returns {Object} Parsed diagram data
   */
  function parseStateDiagram(code) {
    logDebug("[Mermaid Accessibility] Parsing state diagram code");

    const stateTransitions = {};
    const initialStates = [];
    const finalStates = [];
    const allStates = new Set();
    const compositeStates = {};
    // id -> author-facing display name, populated only by `state "Name" as id`
    // declarations. Stays empty for a diagram that declares no alias, which is
    // what makes displayNameFor a no-op on such diagrams.
    const displayNames = {};
    // id -> link pieces of an alias name that draws a link (item 82, L2).
    // Empty unless an alias carries one.
    const displayLinks = {};
    // id -> true for an alias whose name draws nothing (item 82, held
    // empties). Such a state stays out of displayNames, so every site names
    // it by its id; the state list discloses the empty name.
    const emptyNames = {};

    // Parse line by line
    const lines = code.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines, the stateDiagram declaration, and comments
      if (
        !trimmedLine ||
        trimmedLine.startsWith("stateDiagram") ||
        trimmedLine.startsWith("%")
      ) {
        continue;
      }

      // Handle composite state definitions - state StateName { ... }
      if (trimmedLine.match(/^state\s+"?[^"{}]+"?\s*{/)) {
        const match = trimmedLine.match(/^state\s+"?([^"{}]+)"?\s*{/);
        if (match) {
          const compositeName = cleanStateName(match[1]);
          compositeStates[compositeName] = true;
          allStates.add(compositeName);
          logDebug(
            "[Mermaid Accessibility] Found composite state:",
            compositeName
          );
        }
        continue;
      }

      // Handle aliased state declarations - state "Display Name" as id
      //
      // The declaration NAMES an existing state; it is not a state of its own.
      // The capture below must therefore span the whole quoted name and reach
      // the id after `as`. The previous capture, /^state\s+("?[^"\s]+"?|\S+)/,
      // stopped at the first space and added the fragment `"Tom` to the state
      // list — one spurious state per alias declaration, narrated as a real one.
      if (trimmedLine.match(/^state\s+(?:"[^"]+"|'[^']+'|\S+)\s+as\s+/)) {
        const match = trimmedLine.match(
          /^state\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s+as\s+(\S+)/
        );
        if (match) {
          const declaredName = match[1] || match[2] || match[3];
          const stateId = match[4];
          allStates.add(stateId);
          const typedName = cleanStateName(declaredName);
          const aliasName = readAliasBreaks(typedName);
          if (aliasName === null) {
            // Draws nothing: named by its id, with no link.
            emptyNames[stateId] = true;
          } else {
            displayNames[stateId] = aliasName;
            const nameSegments = readStateSegments(typedName, aliasName, {
              hashEntities: false,
            });
            if (nameSegments) displayLinks[stateId] = nameSegments;
          }
          logDebug(
            "[Mermaid Accessibility] Found aliased state:",
            stateId,
            "displayed as",
            aliasName === null ? `${stateId} (empty name)` : aliasName
          );
        }
        continue;
      }

      // Handle simple state definitions - state StateName
      if (trimmedLine.match(/^state\s+(?:"[^"]+"|'[^']+'|\S+)$/)) {
        const match = trimmedLine.match(
          /^state\s+(?:"([^"]+)"|'([^']+)'|(\S+))$/
        );
        if (match) {
          const stateName = match[1] || match[2] || match[3];
          allStates.add(stateName);
          logDebug("[Mermaid Accessibility] Found simple state:", stateName);
        }
        continue;
      }

      // Handle note attachments - note right of/left of/on StateName
      if (
        trimmedLine.match(/^note\s+(right|left|top|bottom)\s+of\s+/) ||
        trimmedLine.match(/^note\s+on\s+/)
      ) {
        // Extract state name from note definition
        const match = trimmedLine.match(
          /^note\s+(?:(?:right|left|top|bottom)\s+of|on)\s+(\S+)/
        );
        if (match) {
          allStates.add(cleanStateName(match[1]));
        }
        continue;
      }

      // Handle forks and joins
      if (
        trimmedLine.match(/^state\s+(?:fork|join)\s+<<\s*(?:fork|join)\s*>>/)
      ) {
        const match = trimmedLine.match(/^state\s+(fork|join)/);
        if (match) {
          allStates.add(match[1]);
          logDebug("[Mermaid Accessibility] Found fork/join state:", match[1]);
        }
        continue;
      }

      // Handle choice states
      if (trimmedLine.match(/^state\s+"?[^"{}]+"?\s*<<\s*choice\s*>>/)) {
        const match = trimmedLine.match(/^state\s+("?[^"{}]+"?)/);
        if (match) {
          allStates.add(cleanStateName(match[1]));
          logDebug(
            "[Mermaid Accessibility] Found choice state:",
            cleanStateName(match[1])
          );
        }
        continue;
      }

      // Extract states and transitions
      if (trimmedLine.includes("-->")) {
        // Split by arrow to get source and target+label
        const parts = trimmedLine.split("-->");
        if (parts.length !== 2) continue;

        const sourceState = cleanStateName(parts[0].trim());

        // Extract target state and transition label
        let targetState = parts[1].trim();
        let transitionLabel = "";
        let transitionSegments = null;

        if (targetState.includes(":")) {
          const targetParts = targetState.split(":");
          targetState = cleanStateName(targetParts[0].trim());
          const typedLabel = cutTransitionLabel(
            targetParts.slice(1).join(":")
          ).trim();
          transitionLabel = decodeStateText(readStateBreaks(typedLabel));
          transitionSegments = readStateSegments(typedLabel, transitionLabel, {
            hashEntities: true,
          });
        } else {
          targetState = cleanStateName(targetState);
        }

        // Add to allStates
        allStates.add(sourceState);
        allStates.add(targetState);

        // Check for initial state
        if (sourceState === "[*]") {
          initialStates.push(targetState);
          logDebug("[Mermaid Accessibility] Found initial state:", targetState);
        }

        // Check for final state
        if (targetState === "[*]") {
          finalStates.push(sourceState);
          logDebug("[Mermaid Accessibility] Found final state:", sourceState);
        }

        // Add to transitions
        if (!stateTransitions[sourceState]) {
          stateTransitions[sourceState] = [];
        }

        const transition = { target: targetState, label: transitionLabel };
        if (transitionSegments) transition.segments = transitionSegments;
        stateTransitions[sourceState].push(transition);

        logDebug(
          "[Mermaid Accessibility] Found transition:",
          sourceState,
          "->",
          targetState,
          transitionLabel ? `(${transitionLabel})` : ""
        );
      }
    }

    const parsedResult = {
      stateTransitions,
      initialStates,
      finalStates,
      allStates: Array.from(allStates),
      compositeStates,
      displayNames,
      displayLinks,
      emptyNames,
    };

    logDebug(
      "[Mermaid Accessibility] Parsing complete. Found",
      parsedResult.allStates.length,
      "states,",
      initialStates.length,
      "initial states,",
      finalStates.length,
      "final states"
    );

    return parsedResult;
  }

  /**
   * Generate a detailed description for a state diagram
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} A detailed HTML description
   */
  function generateDetailedDescription(svgElement, code) {
    logInfo(
      "[Mermaid Accessibility] Generating detailed state diagram description"
    );

    // Parse the state diagram
    const parsedData = parseStateDiagram(code);

    // Get additional information sections
    const processOverview = generateProcessOverview(parsedData);
    const happyPath = identifyHappyPath(parsedData);
    const cycles = identifyCycles(parsedData);

    logDebug(
      "[Mermaid Accessibility] Generated process overview, happy path, and cycle analysis"
    );

    // Create HTML structure with proper sections - using the chart description pattern
    let html = `<div class="state-diagram-description">`;

    // Detailed description section
    html += `<section class="state-detailed-description-section">`;

    // Process overview section
    html += `    <section class="state-section state-overview-section">`;
    html += `      <section class="state-process-overview">`;
    html += `        <h4 class="mermaid-details-heading state-details-heading">Process Overview</h4>`;
    html += `        <p class="process-overview">${processOverview}</p>`;
    html += `      </section>`;

    // Main flow section (if available)
    if (happyPath) {
      html += `      <section class="state-process-flow">`;
      html += `        <p class="process-flow"><strong>Main flow:</strong> ${happyPath}</p>`;
      html += `      </section>`;
    }

    // Cycles section (if available)
    if (cycles) {
      html += `      <section class="state-process-cycles">`;
      html += `        <p class="process-cycles"><strong>Cycles:</strong> ${cycles}</p>`;
      html += `      </section>`;
    }
    html += `    </section>\n\n`;

    // States and Transitions section
    html += `    <section class="state-section state-transitions-section">`;
    html += `      <h4 class="mermaid-details-heading state-details-heading">States and Transitions</h4>`;
    html += `      <dl>\n`;

    // Add initial states
    if (parsedData.initialStates.length > 0) {
      html += `        <dt>Initial State</dt>\n`;
      html += `        <dd>\n`;

      // Ledger entry 8: each initial state carries the label of its own edge
      // out of [*]. An unlabelled edge yields "" and leaves the sentence and
      // the list items byte-identical to what they were before.
      if (parsedData.initialStates.length === 1) {
        html += `          The process starts in the <strong><span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, parsedData.initialStates[0]))}</span></strong> state${initialEdgePhrase(parsedData, parsedData.initialStates[0], { links: true })}.\n`;
      } else {
        html += `          The process can start in any of these states:\n          <ul>\n`;
        parsedData.initialStates.forEach((state) => {
          html += `            <li><strong><span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, state))}</span></strong>${initialEdgePhrase(parsedData, state, { links: true })}</li>\n`;
        });
        html += `          </ul>\n`;
      }

      html += `        </dd>\n\n`;
    }

    // Group states functionally - first collect information about each state
    const stateGroups = groupStatesFunctionally(parsedData);

    logDebug(
      "[Mermaid Accessibility] Grouped states into",
      Object.keys(stateGroups).length,
      "functional groups"
    );

    // Process states by functional groups
    Object.keys(stateGroups).forEach((groupName) => {
      // Add group header if there are multiple groups
      if (Object.keys(stateGroups).length > 1) {
        html += `        <dt class="state-group-heading">${groupName}</dt>\n`;
        html += `        <dd class="state-group-description">\n`;
        html += `          <p>${stateGroups[groupName].description}</p>\n`;
        html += `        </dd>\n\n`;
      }

      // Add the states in this group
      const statesToProcess = stateGroups[groupName].states;

      // Process states in this group
      const processedStates = new Set();
      processStates(statesToProcess, processedStates);
    });

    // Function to process states - same as before but now used by group processing
    function processStates(statesToProcess, processedStates) {
      statesToProcess.forEach((state) => {
        if (state === "[*]" || processedStates.has(state)) return;
        processedStates.add(state);

        html += `        <dt><span class="diagram-state">${stateNameHtml(parsedData, state)}</span></dt>\n`;
        html += `        <dd>\n`;

        // Item 82, held empties: the one sentence that discloses an alias
        // which draws nothing; every other sentence names the state by id.
        if (hasEmptyName(parsedData, state)) {
          html += `          <p>State "${Common.escapeHtml(state)}" has an empty name.</p>\n`;
        }

        // Note if this is a composite state
        if (parsedData.compositeStates[state]) {
          html += `          <p><strong>Composite state</strong> containing nested states.</p>\n`;
        }

        const outgoingTransitions = parsedData.stateTransitions[state] || [];
        if (outgoingTransitions.length > 0) {
          html += `          <ul>\n`;
          outgoingTransitions.forEach((transition) => {
            // Add semantic class for error transitions. Ledger entry 5: the
            // keyword test runs on the DISPLAY NAME the reader hears, not on
            // the id — `state "Send failure" as sf` is classified by "Send
            // failure". Only the tested string changed; the keyword set did not.
            const targetName = displayNameFor(parsedData, transition.target);
            const isErrorTransition =
              transition.label &&
              (transition.label.toLowerCase().includes("error") ||
                targetName.toLowerCase().includes("error"));

            const transitionClass = isErrorTransition
              ? ' class="error-transition"'
              : "";

            // Create more natural transition phrasing (ledger entry 4)
            const transitionPhrase = transitionLabelPhrase(
              transition.label ? transition.label.trim() : "",
              transition.segments
            );

            if (transition.target === "[*]") {
              html += `            <li${transitionClass}>Transitions to the <strong>final state</strong>${transitionPhrase}.</li>\n`;
            } else {
              html += `            <li${transitionClass}>Transitions to the <strong><span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, transition.target))}</span></strong> state${transitionPhrase}.</li>\n`;
            }
          });
          html += `          </ul>\n`;
        } else {
          html += `          <p>No outgoing transitions from this state.</p>\n`;
        }

        html += `        </dd>\n\n`;
      });
    }

    // Add final states section
    if (parsedData.finalStates.length > 0) {
      html += `        <dt>Final States</dt>\n`;
      html += `        <dd>\n`;
      html += `          The process can end from these states:\n          <ul>\n`;
      parsedData.finalStates.forEach((state) => {
        html += `            <li><strong><span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, state))}</span></strong></li>\n`;
      });
      html += `          </ul>\n`;
      html += `        </dd>\n`;
    }

    html += `      </dl>\n`;
    html += `    </section>\n`;

    // Close the detailed description div
    html += `</div>`;

    logInfo(
      "[Mermaid Accessibility] Detailed description generated successfully"
    );
    return html;
  }

  /**
   * Generate an overview description of the process flow
   * @param {Object} parsedData - Parsed diagram data
   * @returns {string} Overview description
   */
  function generateProcessOverview(parsedData) {
    logDebug("[Mermaid Accessibility] Generating process overview");

    // Start with initial states
    let overview = "";

    if (parsedData.initialStates.length > 0) {
      // Find first state after initial
      const initialState = parsedData.initialStates[0];
      // Ledger entry 8: the opening gains the label of the FIRST branch's edge
      // out of [*]. The overview continues to follow initialStates[0] only —
      // that is a decision, not an oversight, so a second initial state is
      // still spoken by the Initial State list above and not here.
      overview += `This diagram shows a process that begins in the <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, initialState))}</span> state${initialEdgePhrase(parsedData, initialState)}`;

      // Try to describe the first few transitions
      const outgoingFromInitial =
        parsedData.stateTransitions[initialState] || [];
      if (outgoingFromInitial.length > 0) {
        const firstTransition = outgoingFromInitial[0];

        // Format the transition label for better readability (ledger entry 4)
        const transitionPhrase = transitionLabelPhrase(
          firstTransition.label ? firstTransition.label.trim() : ""
        );

        overview += `, proceeds to the <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, firstTransition.target))}</span> state${transitionPhrase}`;

        // Try to describe the next level of transitions
        const secondLevelTransitions =
          parsedData.stateTransitions[firstTransition.target] || [];
        if (secondLevelTransitions.length > 0) {
          if (secondLevelTransitions.length === 1) {
            const stTransition = secondLevelTransitions[0];
            const stPhrase = transitionLabelPhrase(
              stTransition.label ? stTransition.label.trim() : ""
            );

            if (stTransition.target === "[*]") {
              overview += `, and then to completion${stPhrase}`;
            } else {
              overview += `, and then to the <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, stTransition.target))}</span> state${stPhrase}`;
            }
          } else if (secondLevelTransitions.length === 2) {
            // Format for branches with two options
            const options = secondLevelTransitions.map((transition) => {
              let targetDesc =
                transition.target === "[*]"
                  ? "completion"
                  : `the <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, transition.target))}</span> state`;

              const conditionPhrase = transitionLabelPhrase(
                transition.label ? transition.label.trim() : ""
              );

              return `${targetDesc}${conditionPhrase}`;
            });

            overview += `, and then either to ${options[0]} or to ${options[1]}`;
          } else {
            overview += `, and then to one of ${secondLevelTransitions.length} possible states depending on conditions`;
          }
        }
      }
    } else {
      overview += `This diagram shows a process with multiple states and transitions`;
    }

    // Describe final states if they exist
    if (parsedData.finalStates.length > 0) {
      if (parsedData.finalStates.length === 1) {
        overview += `. The process can end from the <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, parsedData.finalStates[0]))}</span> state.`;
      } else {
        const formattedStates = parsedData.finalStates
          .map(
            (state) => `the <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, state))}</span> state`
          )
          .join(" or ");
        overview += `. The process can end from ${formattedStates}.`;
      }
    } else {
      overview += `.`;
    }

    logDebug("[Mermaid Accessibility] Process overview generated");
    return overview;
  }

  /**
   * Identify the main/happy path through the system
   * @param {Object} parsedData - Parsed diagram data
   * @returns {string} Description of happy path or null if can't be determined
   */
  function identifyHappyPath(parsedData) {
    logDebug(
      "[Mermaid Accessibility] Identifying happy path through the process"
    );

    // If no initial states, return null
    if (parsedData.initialStates.length === 0) return null;

    // Start from the first initial state
    const initialState = parsedData.initialStates[0];
    const path = [initialState];
    let currentState = initialState;

    // Follow transitions, preferring ones that don't have "error" in their labels
    // and avoiding cycles where possible
    while (true) {
      const transitions = parsedData.stateTransitions[currentState] || [];
      if (transitions.length === 0) break;

      // Try to find a transition that doesn't lead to an already visited state
      // and doesn't have "error" in the label
      let nextTransition = null;

      // First look for transitions without "error" in the label or target
      for (const transition of transitions) {
        if (transition.target === "[*]") {
          // Found a final state transition
          const hasSuccess =
            transition.label &&
            (transition.label.toLowerCase().includes("success") ||
              transition.label.toLowerCase().includes("complet"));

          // Prioritise "success" exits over others
          if (hasSuccess) {
            nextTransition = transition;
            break;
          } else if (!nextTransition) {
            nextTransition = transition;
            // Keep looking for better transitions if this isn't a success exit
          }
        }

        // Ledger entry 5: the "error" test reads the display name, not the id.
        // `path` and every lookup stay on ids.
        if (
          !path.includes(transition.target) &&
          (!transition.label ||
            !transition.label.toLowerCase().includes("error")) &&
          !displayNameFor(parsedData, transition.target)
            .toLowerCase()
            .includes("error")
        ) {
          // Prioritise transitions with "success" in the label
          const hasSuccess =
            transition.label &&
            (transition.label.toLowerCase().includes("success") ||
              transition.label.toLowerCase().includes("complet"));

          if (hasSuccess) {
            nextTransition = transition;
            break;
          } else if (
            !nextTransition ||
            (nextTransition.target === "[*]" && !hasSuccess)
          ) {
            nextTransition = transition;
            // Keep looking for better transitions
          }
        }
      }

      // If no suitable transition found, take the first non-error one as fallback
      if (!nextTransition && transitions.length > 0) {
        // Avoid error transitions and cycles if possible
        nextTransition =
          transitions.find(
            (t) =>
              !path.includes(t.target) &&
              (!t.label || !t.label.toLowerCase().includes("error")) &&
              // Ledger entry 5: display name, not id.
              !displayNameFor(parsedData, t.target)
                .toLowerCase()
                .includes("error")
          ) ||
          transitions.find((t) => !path.includes(t.target)) ||
          transitions[0];
      }

      if (!nextTransition) {
        break;
      } else if (nextTransition.target === "[*]") {
        // Use a more descriptive term than just "Exit"
        path.push("completion");
        break;
      }

      // Add the next state to the path
      path.push(nextTransition.target);
      currentState = nextTransition.target;

      // Safety check to prevent infinite loops
      if (path.length > 10) break;
    }

    // If path is just initial state, it's not useful
    if (path.length <= 1) return null;

    // Return the path as a string with proper formatting and state classes
    const formattedPath = path
      .map((state) => {
        if (state === "completion") {
          return "completion";
        } else {
          return `<span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, state))}</span>`;
        }
      })
      .join(" → ");

    logDebug("[Mermaid Accessibility] Happy path identified:", formattedPath);
    return formattedPath;
  }

  /**
   * Identify cycles in the state diagram
   * @param {Object} parsedData - Parsed diagram data
   * @returns {string} Description of cycles or null if none found
   */
  function identifyCycles(parsedData) {
    logDebug("[Mermaid Accessibility] Identifying cycles in the process");

    // Track states that form cycles
    const cycleStates = new Map();

    // Look for states that can transition back to an earlier state
    for (const state in parsedData.stateTransitions) {
      if (state === "[*]") continue;

      const transitions = parsedData.stateTransitions[state] || [];
      for (const transition of transitions) {
        // Skip final state transitions
        if (transition.target === "[*]") continue;

        // Check if this transition creates a potential cycle to initial states
        if (parsedData.initialStates.includes(transition.target)) {
          // Store the mechanism of the cycle. The RAW label is kept — the
          // "a transition" filler this used to substitute made the unlabelled
          // arm of cycleLabelPhrase unreachable (ledger entry 7).
          if (!cycleStates.has(state)) {
            cycleStates.set(state, transition.label || "");
          }
        }
      }
    }

    // If we found cycles, describe them clearly
    if (cycleStates.size > 0) {
      const stateList = Array.from(cycleStates.keys());

      if (stateList.length === 1) {
        const state = stateList[0];
        const action = cycleStates.get(state);
        logDebug(
          "[Mermaid Accessibility] Found single cycle from state:",
          state
        );
        return `The <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, state))}</span> state can return to the initial state${cycleLabelPhrase(action)}, allowing the process to restart.`;
      } else if (stateList.length === 2) {
        const firstState = stateList[0];
        const secondState = stateList[1];
        const firstPhrase = cycleLabelPhrase(cycleStates.get(firstState));
        const secondPhrase = cycleLabelPhrase(cycleStates.get(secondState));
        logDebug(
          "[Mermaid Accessibility] Found cycles from two states:",
          stateList
        );

        // Neither cycle is labelled — the merged sentence is unchanged
        // (ledger entry 12: byte-identical preservation, deliberately).
        if (!firstPhrase && !secondPhrase) {
          return `Both the <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, firstState))}</span> and <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, secondState))}</span> states can return to the initial state, creating cycles that allow the process to restart.`;
        }

        // At least one label to speak, so the states are narrated separately —
        // a merged subject cannot carry a per-state clause. Each phrase is
        // escaped once inside cycleLabelPhrase and must not be escaped again.
        return `The <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, firstState))}</span> state can return to the initial state${firstPhrase}, and the <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, secondState))}</span> state can return to the initial state${secondPhrase}, creating cycles that allow the process to restart.`;
      } else {
        // Format a list of all states with cycles
        const lastState = stateList.pop();
        const stateListFormatted = stateList
          .map(
            (s) =>
              `<span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, s))}</span>`
          )
          .join(", ");
        logDebug(
          "[Mermaid Accessibility] Found cycles from multiple states:",
          stateList.length + 1
        );
        return `Multiple states (${stateListFormatted}, and <span class="diagram-state">${Common.escapeHtml(displayNameFor(parsedData, lastState))}</span>) can return to earlier states, creating cycles in the process flow.`;
      }
    }

    logDebug("[Mermaid Accessibility] No cycles found in the process");
    return "";
  }

  /**
   * Group states functionally based on their role in the process
   * @param {Object} parsedData - Parsed diagram data
   * @returns {Object} Groups of states with descriptions
   */
  function groupStatesFunctionally(parsedData) {
    logDebug("[Mermaid Accessibility] Grouping states functionally");

    const groups = {};

    // Initial states go in "Starting States" group
    if (parsedData.initialStates.length > 0) {
      groups["Starting States"] = {
        states: parsedData.initialStates,
        description: "States where the process begins.",
      };
    }

    // Look for processing/operational states
    const processingStates = [];
    const errorStates = [];
    const completionStates = [];

    // Track which states we've already categorised to prevent duplicates
    const categorisedStates = new Set();

    // Add initial states to categorised set
    parsedData.initialStates.forEach((state) => categorisedStates.add(state));

    // Categorise remaining states
    for (const state of parsedData.allStates) {
      if (state === "[*]" || categorisedStates.has(state)) {
        continue; // Skip initial/final markers and already categorised states
      }

      // Ledger entry 5: classify on the display name the reader hears, not on
      // the internal id, so `state "Job Done" as jd` files under Completion
      // rather than Operational. Only the tested STRING changed — the keyword
      // sets are untouched, and the groups, the categorised Set and every
      // downstream lookup still hold ids.
      const stateName = displayNameFor(parsedData, state).toLowerCase();

      // Check if this is an error state
      if (stateName.includes("error") || stateName.includes("fail")) {
        errorStates.push(state);
        categorisedStates.add(state);
      }
      // Check if this is a completion state
      else if (
        stateName.includes("complet") ||
        stateName.includes("done") ||
        stateName.includes("finish") ||
        stateName.includes("success")
      ) {
        completionStates.push(state);
        categorisedStates.add(state);
      }
      // Otherwise it's a processing state
      else {
        processingStates.push(state);
        categorisedStates.add(state);
      }
    }

    // Add groups if they have states
    if (processingStates.length > 0) {
      groups["Operational States"] = {
        states: processingStates,
        description: "States representing active processing or operations.",
      };
    }

    if (completionStates.length > 0) {
      groups["Completion States"] = {
        states: completionStates,
        description:
          "States representing successful completion of the process.",
      };
    }

    if (errorStates.length > 0) {
      groups["Error States"] = {
        states: errorStates,
        description: "States representing error conditions or failures.",
      };
    }

    // If we didn't categorise any states, create a single "States" group with all states
    if (
      Object.keys(groups).length === 0 ||
      (Object.keys(groups).length === 1 && groups["Starting States"])
    ) {
      const remainingStates = parsedData.allStates.filter(
        (state) => state !== "[*]" && !categorisedStates.has(state)
      );

      if (remainingStates.length > 0) {
        groups["Process States"] = {
          states: remainingStates,
          description: "States in the process flow.",
        };
      }
    }

    // We'll avoid adding Terminal States as a separate group to prevent duplicates
    // Instead we'll mention which states can lead to termination in the Final States section

    logDebug(
      "[Mermaid Accessibility] Created",
      Object.keys(groups).length,
      "functional groups"
    );
    return groups;
  }

  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator("stateDiagram", {
    generateShort: generateShortDescription,
    generateDetailed: generateDetailedDescription,
  });

  // Also register for stateDiagram-v2 as they're fundamentally the same
  window.MermaidAccessibility.registerDescriptionGenerator("stateDiagram-v2", {
    generateShort: generateShortDescription,
    generateDetailed: generateDetailedDescription,
  });

  logInfo("[Mermaid Accessibility] State diagram module loaded and registered");
})();
