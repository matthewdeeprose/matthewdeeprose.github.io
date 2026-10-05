/**
 * Mermaid Accessibility - C4 Diagram Module
 *
 * Generates accessible descriptions for C4 diagrams from the shared parse
 * adapter's C4 surface (mermaid-parse-adapter.js), never from the SVG and never
 * from the diagram source. The seventeenth description generator and the
 * eleventh adapter-consuming one.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-c4-gold-targets-2026-09-16.md - rules C1 to C13 and rulings CR1
 * to CR24 (VERSION 3, FROZEN 18 September 2026; CR14 approved by Matthew from
 * the review page on 16 September, CR17 to CR22 approved on 18 September, and
 * CR23 and CR24 the same day on the item 84 close's own referrals) -
 * and six byte-exact approved targets. A mismatch between this module's output
 * and a target is a STOP that goes back to the design seat; it is never a
 * reason to edit a target or a fixture. Register item 84.
 *
 * THE SIX RULINGS OF 18 SEPTEMBER CAME FROM A SWEEP OF THIS MODULE, and five
 * of them changed it. docs/mermaid-item-84-sweep-6-2026-09-17.md drove 22 probe
 * sources against the session 4 build and found eight things; the five that are
 * c4 rulings are enacted here.
 *
 *   CR17  the boundary count is PER SORT and the sort is a property of each
 *         BOUNDARY, not of the diagram - `DEPLOYMENT_NODE_HAS_NO_KIND`
 *   CR18  an empty or whitespace-only shape label reads `unlabelled element
 *         "ALIAS"` and never `""` - `makeSubjects`
 *   CR19  a technology is QUOTED on an element line and a relationship line -
 *         `quotedTechn`; its OPEN QUESTION about the boundary line is now
 *         answered by CR23 below
 *   CR20  a label two or more shapes share carries `(alias ALIAS)` wherever it
 *         is spoken - `measure`'s `sharedLabels` and `makeSubjects`
 *   CR22  the endpoint lookup indexes shapes and THEN boundaries -
 *         `makeSubjects().endpointOf`
 *
 * TWO MORE RULINGS CAME BACK FROM THE ITEM 84 CLOSE, WHICH REFERRED THEM
 * RATHER THAN FIXING THEM. Item 84 is CLOSED on the description side and stays
 * closed; the close enacted CR17 and CR19 literally, recorded in this file and
 * in the gold that each produced output the seat plainly had not considered,
 * and sent both back with their scope named. The seat ruled both on
 * 18 September 2026.
 *
 *   CR23  a deployment node's technology is QUOTED like every other, through
 *         the same helper - `renderBoundary`, calling `quotedTechn`. CR19 is
 *         WIDENED, not reversed: one rule about one field. The bracketed DESCR
 *         stays OUTSIDE the quotes. MOVED FOUR GOLD LINES, all in E6.
 *   CR24  when BOTH boundary sorts are present the opening drops "in" and the
 *         counts become a comma list - `buildShortText`. CR17's per-sort
 *         COUNTING stands; only its JOIN moves. Reached by no exemplar.
 *
 * NEITHER WAS FIXED BY THE SESSION THAT FOUND IT, and that is the part worth
 * carrying. A session that removes an inconsistency it has noticed produces
 * the same bytes as a seat that rules on it, and the two are distinguishable
 * only by asking who decided. That is why both sat in this file as logged
 * observations for as long as they did.
 *
 * CR21 CHANGED NOTHING HERE AND THAT IS RECORDED RATHER THAN LEFT SILENT.
 * Sweep finding F6 measured `comma,.` and `semicolon;.` from descriptions
 * ending in `,` and `;`, and reported this module CORRECT against CR4 as
 * written. The seat ACCEPTED the behaviour, so `terminalStop` is untouched and
 * its withholding set is still `.` `!` `?` alone. An unruled finding is
 * re-raised by the next sweep; a measured behaviour recorded as accepted is
 * what stops that.
 *
 * OF THE SIX RULINGS OF 18 SEPTEMBER ONLY CR19 MOVED A GOLD BYTE - twenty-five
 * target lines, twelve element and thirteen relationship, across all six
 * exemplars; CR23 later moved four more, all of them E6's boundary lines, and
 * CR24 none. THE OTHER FOUR OF THE SIX ARE REACHED BY NO EXEMPLAR, which is
 * why the sweep found F2 and F4 sitting in a module the comparator had already
 * read at six of six, and why each is pinned by a fixture of its own instead:
 * `c4/mixed-boundaries`, `c4/empty-label`, `c4/techn-comma` and
 * `c4/duplicate-labels`. CR22 IS PINNED BY NO FIXTURE and
 * cannot be - see `makeSubjects`.
 *
 * ONE MODULE COVERS FIVE DIAGRAM KINDS, AND THE KIND IS NOT IN THE KEY.
 * `C4Context`, `C4Container`, `C4Component`, `C4Dynamic` and `C4Deployment` all
 * report `c4` from Mermaid's own detector (census Q1), so the detection map
 * gains ONE row and this file registers ONE generator. The kind is recoverable
 * only from `db.getC4Type()`, which the adapter delivers as `diagramType`, and
 * NOTHING HERE MAY READ THE KIND OFF A DETECTION KEY - the key is identical for
 * all five. C1's KIND clause is served by `DIAGRAM_WORD` below and by nothing
 * else.
 *
 * WHY THE SURFACE IS DB-ONLY, AND WHY THIS FILE HOLDS NO REGEX AND NO DECODE.
 * The census measured every fact the canvas draws about elements, boundaries
 * and relationships arriving in the db in declaration order, and measured the
 * decode transform as `decodePlaceholders` on eight references where
 * `decodeAuthorText` disagrees on four (census CONTRADICTION 3). The adapter
 * applies that decode to every author-text field it delivers, so THIS MODULE
 * NEVER DECODES; it only escapes, once, at the HTML sink (rule C8, and the
 * CONVENTIONS clause on where `escapeHtml` applies).
 *
 * THE TITLE IS NARRATED WHOEVER WROTE IT (ruling R1, census Q9). `title` comes
 * from `getTitle()` and may be the author's `accTitle:` text rather than their
 * body title - both write one slot, last writer wins, and the db cannot report
 * which. The canvas draws the winner as the visible title either way, so
 * narrating it withholds nothing; clause X3 lifts a real `accTitle` onto the
 * short tier by the core's own raw-source route, making a title sentence at
 * worst a repetition and never a contradiction. RULE C9 FORBIDS THIS FILE FROM
 * CALLING `getAccTitle` OR `getAccDescription`, and it cannot reach them in any
 * case: the surface delivers no such field.
 *
 * THE SYNTHETIC ROOT IS NEVER SPOKEN AND NEVER COUNTED (rule C2). Every c4
 * parse delivers a boundary at index 0 whose alias, label and kind are all the
 * machine string `global`; it is not drawn. It is excluded here by its alias
 * through the named constant below, never by a string literal at a use site.
 *
 * WHAT IS NEVER NARRATED (rule C12): `UpdateElementStyle`, `UpdateRelStyle`,
 * `UpdateLayoutConfig`, and the `sprite`, `tags` and `link` fields. Measurement
 * M3 rendered eleven decorated shapes across three sources and found ZERO `<a>`
 * elements at strict, no tag text in any `<text>`, and the only `<image>` the
 * person glyph - so none of the three is drawn and narrating one would invent a
 * fact. M3 also found those three fields reaching the db UNEVENLY by a
 * mechanism it did not isolate (ruling CR13), which is a second reason: no rule
 * may ever be built on them without measuring the delivery first.
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
  // load order. One property read per call cannot go stale. (Block, sequence,
  // gantt, XY chart and quadrant precedent.)

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
   * THE CONVENTIONS CLAUSE IS EXPLICIT ABOUT WHERE THIS APPLIES: escaping is
   * done to author text AT THE INTERPOLATION SITE - a label, a technology, a
   * description, a title - and NEVER to an assembled line, which mixes author
   * text with the quotation marks, colons and list markup this module writes
   * itself. The PLAIN short tier is raw author text and calls none of this.
   *
   * None of the six exemplars carries a character the escaper touches, so they
   * cannot distinguish this from escaping the whole line; the rule is followed
   * because the first hostile fixture will reach it.
   *
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  /**
   * Narration count: words for zero to nine, digits from 10 (ruling CR1).
   *
   * REUSED FROM `MermaidAccessibilityCommon`, not reimplemented:
   * `narrationNumber` already carries exactly CR1's convention, which is the
   * one block R5, gantt G4 and the sequence gold use. CR1 rewrote every count
   * in all six targets, every one of them being nine or below.
   *
   * @param {number} n - The count
   * @returns {string} The narration form
   */
  function narrationCount(n) {
    return common().narrationNumber(n);
  }

  // ---------------------------------------------------------------------
  // The vocabularies, every one of them measured
  // ---------------------------------------------------------------------

  /**
   * The synthetic boundary Mermaid manufactures at index 0 of every parse.
   *
   * Its alias, label and kind are all this same machine string. Rule C2
   * excludes it from B, and rule C5 never narrates it. Named here so no use
   * site carries the literal.
   */
  const SYNTHETIC_ROOT_ALIAS = "global";

  /** The diagram kind, from `getC4Type()` alone - rule C1. */
  const DIAGRAM_WORD = Object.freeze({
    C4Context: "system context",
    C4Container: "container",
    C4Component: "component",
    C4Dynamic: "dynamic",
    C4Deployment: "deployment",
  });

  /**
   * A DEPLOYMENT NODE IS IDENTIFIED BY ITS OWN DELIVERED SHAPE, NOT BY THE
   * DIAGRAM'S KIND - ruling CR17.
   *
   * The db's single `type` slot holds a machine KIND on four boundary sorts and
   * the AUTHOR'S OWN TECHNOLOGY on a deployment node (census CONTRADICTION 1);
   * the adapter splits it into `kind` and `techn`, exactly one of which is ever
   * non-null. So a null `kind` IS the discriminator, and it is the same one
   * `renderBoundary` has always used.
   *
   * THIS REPLACED A `getC4Type() === "C4Deployment"` TEST, AND THE REPLACEMENT
   * IS THE WHOLE OF F2's FIX. The old form substituted the noun on the
   * DIAGRAM's kind and then applied it to EVERY boundary, so sweep P08 - a
   * deployment diagram carrying two deployment nodes and two system boundaries
   * - read `in four deployment nodes` in the short while its own detailed tier
   * named both sorts correctly eleven lines away. THE SHORT AND THE DETAILED
   * CONTRADICTED EACH OTHER ON A FACT THE READER IS GIVEN TWICE, and the short
   * is the one a listener hears first. The removed constant was
   * `DEPLOYMENT_TYPE = "C4Deployment"`; it is named here so a reader meeting
   * F2 in the sweep finds where it went, and it is GONE rather than left
   * unused so nothing can reach for it again.
   */
  const DEPLOYMENT_NODE_HAS_NO_KIND = null;

  /**
   * The TEN BASE shape kinds and their English words - rule C4, as amended by
   * ruling CR6.
   *
   * THE VOCABULARY IS NINETEEN TOKENS AND THE EXTERNAL MARKER IS THE PREFIX
   * `external_`, NOT THE SUFFIX `_ext` C4 originally named. Measurement V1
   * declared every spelling the grammar accepts in one diagram and read the
   * delivered tokens against the stereotypes the canvas draws from them: ten
   * base tokens and NINE external ones. `external_component_queue` is
   * UNREACHABLE on this build - `ComponentQueue_Ext` is a hard lexical error,
   * found by bisection after a twenty-spelling source failed to parse - and
   * CR6 rules that it stays in the table anyway, so a future grammar that adds
   * the spelling meets a known clause rather than a STOP.
   */
  const KIND_WORD = Object.freeze({
    person: "person",
    system: "software system",
    system_db: "database system",
    system_queue: "queue system",
    container: "container",
    container_db: "database container",
    container_queue: "queue container",
    component: "component",
    component_db: "database component",
    component_queue: "queue component",
  });

  /** The external-kind prefix (CR6), and its length, named once. */
  const EXTERNAL_PREFIX = "external_";

  /**
   * The THREE boundary kinds that read as words - rule C5, as amended by CR8.
   *
   * THE SLOT IS OPEN AND IS NOT A CLOSED VOCABULARY. Any other non-empty string
   * reads `a boundary of kind "STRING"` with the author's own string verbatim.
   * Measurement Z3 found a `Boundary(b, "X", "custom")` delivering the author's
   * arbitrary string on an ordinary non-deployment boundary, and measurement S1
   * read all three spellings side by side in ONE parse: a bare `Boundary`
   * delivers the LOWER-CASE `"system"` and the canvas draws `[system]`, so a
   * bare Boundary is NOT a bare state and takes the open-slot arm. "system" and
   * "SYSTEM" differ only by case and narrate differently, which is faithful
   * because the canvas draws them differently too.
   *
   * The delivered tokens are UPPER CASE and this table lower-cases them, which
   * is this narration's own choice and the same kind of choice as C4's kind
   * words: the canvas draws the upper-case token bracketed.
   */
  const BOUNDARY_KIND_WORD = Object.freeze({
    ENTERPRISE: "enterprise boundary",
    SYSTEM: "system boundary",
    CONTAINER: "container boundary",
  });

  /**
   * The FOUR families of N and their order - rule C3, as amended by CR3.
   *
   * "Deployment nodes" is STRUCK: a deployment node is a BOUNDARY and is never
   * a shape, so that family could never be non-zero. Database and queue
   * variants count in their base family, and externals count WITHIN their
   * family rather than as a family of their own.
   */
  const FAMILY_ORDER = Object.freeze([
    "people",
    "software systems",
    "containers",
    "components",
  ]);

  /** Base kind token to family (CR3). */
  const FAMILY_OF = Object.freeze({
    person: "people",
    system: "software systems",
    system_db: "software systems",
    system_queue: "software systems",
    container: "containers",
    container_db: "containers",
    container_queue: "containers",
    component: "components",
    component_db: "components",
    component_queue: "components",
  });

  /** Family to its singular form, for a count of one (CR2). */
  const FAMILY_SINGULAR = Object.freeze({
    people: "person",
    "software systems": "software system",
    containers: "container",
    components: "component",
  });

  // ---------------------------------------------------------------------
  // Small shared helpers
  // ---------------------------------------------------------------------

  /**
   * Split a delivered kind token into its base and its externality (CR6).
   *
   * @param {string} token - The db's own control token, verbatim
   * @returns {Object} `{ base, external }`
   */
  function splitKind(token) {
    const t = typeof token === "string" ? token : "";
    const external = t.indexOf(EXTERNAL_PREFIX) === 0;
    return { base: external ? t.slice(EXTERNAL_PREFIX.length) : t, external };
  }

  /**
   * The indefinite article for a noun phrase - ruling CR7.
   *
   * IT AGREES WITH THE WORD THAT FOLLOWS IT, which is what found the
   * "a enterprise boundary" fault. "External" never triggers it, because on
   * this type external FOLLOWS the noun rather than preceding it.
   *
   * @param {string} phrase - The noun phrase
   * @returns {string} "a" or "an"
   */
  function article(phrase) {
    return /^[aeiou]/i.test(String(phrase)) ? "an" : "a";
  }

  /**
   * The generator's terminal full stop - ruling CR4.
   *
   * Every element and relationship line ends with one. Where the line ends in
   * the author's DESCR and that text ALREADY ends with one of `.` `!` `?`, no
   * second mark is added. NO EXEMPLAR CARRIES A DESCR ENDING IN ANYTHING ELSE,
   * so this clause moves no byte in the six and the first hostile fixture is
   * what reaches it.
   *
   * A BOUNDARY LINE TAKES NONE OF THIS: it ends at "containing:" because a list
   * follows it.
   *
   * CR21 ACCEPTED THIS FUNCTION AS WRITTEN AND THAT IS WHY IT IS UNCHANGED.
   * Sweep finding F6 measured `comma,.` and `semicolon;.` from descriptions
   * ending in `,` and `;`, and reported the behaviour CORRECT against CR4 - the
   * withholding set really is `.` `!` `?` alone. The seat considered widening it
   * to `,` `;` `:` and declined: a supplied stop after a comma is a cosmetic
   * oddity in the source text, while withholding one leaves a line with no
   * terminal punctuation at all, and every other line here has one. RECORDED
   * RATHER THAN LEFT SILENT, because an unruled finding is re-raised by the next
   * sweep and re-investigated by the next session.
   *
   * @param {string} text - The author's description
   * @returns {string} "." or ""
   */
  function terminalStop(text) {
    return /[.!?]$/.test(String(text)) ? "" : ".";
  }

  /**
   * A technology, quoted - ruling CR19.
   *
   * THE QUOTATION MARKS ARE THIS MODULE'S OWN FURNITURE AND THE TECHNOLOGY IS
   * AUTHOR TEXT, so the escaper applies to what is between them and never to
   * the marks themselves, exactly as it does for a label (the CONVENTIONS
   * rule).
   *
   * WHY IT EXISTS. CR14 made the technology a comma clause after the last
   * quoted run, and sweep finding F5 measured what that does to a technology
   * carrying a comma of its own: `"Alpha", "Calls", "Bravo", using HTTP, with
   * JSON.` - two comma clauses in a row a listener cannot tell apart. The
   * canvas has a delimiter the listener did not, because it brackets every
   * technology it draws; the quotation marks are that delimiter in speech, and
   * they make the technology read like the label and the description beside it.
   *
   * IT IS USED ON EVERY LINE THAT NARRATES A TECHNOLOGY - element,
   * relationship AND boundary - ruling CR23, 18 September 2026. Until then it
   * was used on the first two only: CR19 named "element and relationship
   * lines", a boundary line is neither, so `renderBoundary` emitted an
   * unquoted technology and a deployment diagram spoke of one field two ways.
   * THAT ASYMMETRY WAS ENACTED DELIBERATELY AND REPORTED, NOT OVERLOOKED. The
   * gold recorded it as an OPEN QUESTION under CR19 and the item 84 close
   * referred it to the design seat, which widened the ruling; the comment that
   * used to stand here predicted the repair would be "one clause in
   * `renderBoundary`, and this helper is already the thing to call", and that
   * is exactly what it was.
   *
   * THE ROUTE IS THE POINT AND IS WORTH KEEPING. The same words could have
   * been reached by a session deciding the omission must have been an
   * oversight and fixing it, and the outcome would read identically. Widening
   * a ruling to remove an inconsistency is the same move as narrowing a target
   * to match an output, which the gold's authority clause forbids; the
   * difference between the two is only visible in who ruled it.
   *
   * WHAT IT DOES NOT REACH: a deployment node's bracketed DESCR, which stays
   * OUTSIDE the quotation marks. See `renderBoundary`.
   *
   * @param {string} techn - The author's technology
   * @returns {string} The quoted, escaped technology
   */
  function quotedTechn(techn) {
    return `"${escapeText(techn)}"`;
  }

  /**
   * Is this delivered string present and non-empty?
   *
   * `null` and `""` ARE DIFFERENT ANSWERS FROM THE SURFACE AND THE SAME ANSWER
   * HERE, which is rule C13 and measurement M4. A `Person` carries no `techn`
   * key at all while a `Container` beside it carries one; a three-argument
   * `Rel` carries an EMPTY WRAPPER. M4 rendered all three cases in one diagram
   * and the canvas drew NO bracketed element for either absent case - not an
   * empty `[]`, nothing - so both read as no technology and the distinction is
   * the surface's business rather than the reader's.
   *
   * @param {*} value - A delivered field
   * @returns {boolean} Whether it carries text
   */
  function has(value) {
    return typeof value === "string" && value.length > 0;
  }

  // ITEM 82, ENACTMENT 4 (3 October 2026): "a label that draws nothing (only a
  // break, or only spaces) is read as unlabelled, in each type's own words."
  // The test is a TEST only: it trims to decide and never alters the bytes it
  // narrates. It runs on the DELIVERED label, after the adapter's break
  // transform. A boundary label is a required argument, so an empty one can
  // only be a label that draws nothing; the canvas shows a blank title.
  //
  // The phrase follows CR18's own form, `unlabelled element "ALIAS"`, which
  // opens its list line in lower case, so the boundary form does the same.
  const UNLABELLED_BOUNDARY_PHRASE = "unlabelled boundary";

  /**
   * Is this boundary one whose label draws nothing? The one emptiness test for
   * a boundary's name: the boundary line and the endpoint lookup both ask it
   * here, so they cannot disagree.
   * @param {Object} boundary - A delivered boundary
   * @returns {boolean} Whether to narrate it as unlabelled
   */
  function isUnlabelledBoundary(boundary) {
    return typeof boundary.label === "string" && boundary.label.trim() === "";
  }

  /**
   * A boundary's name as the lines speak it: the quoted escaped label, or the
   * unlabelled phrase naming the author's alias in the generator's quotes,
   * never inflected.
   * @param {Object} boundary - A delivered boundary
   * @returns {string} The name, ready for the HTML sink
   */
  function boundaryName(boundary) {
    return isUnlabelledBoundary(boundary)
      ? `${UNLABELLED_BOUNDARY_PHRASE} "${escapeText(boundary.alias)}"`
      : `"${escapeText(boundary.label)}"`;
  }

  // ---------------------------------------------------------------------
  // Facts: everything counted once, from the delivery
  // ---------------------------------------------------------------------

  /**
   * Measure the delivery into the facts both tiers narrate.
   *
   * N, B AND R ARE COMPUTED HERE AND NOWHERE ELSE, so the short tier's counts
   * and the detailed tier's lists cannot disagree - the same choke-point
   * discipline the block module's `layoutGrid` carries, and for the same
   * reason: the flowchart arc shipped two computations of one fact and they
   * disagreed.
   *
   * RULE C2: N counts every shape at every depth, B every boundary at every
   * depth EXCLUDING the synthetic root, R every relationship including
   * self-relationships and duplicates.
   *
   * @param {Object} diagram - The adapter's normalised c4 delivery
   * @returns {Object} The measured facts
   */
  function measure(diagram) {
    const shapes = Array.isArray(diagram.shapes) ? diagram.shapes : [];
    const boundaries = Array.isArray(diagram.boundaries)
      ? diagram.boundaries
      : [];
    const rels = Array.isArray(diagram.rels) ? diagram.rels : [];

    // C2's exclusion, by the named alias and never by a literal at a use site.
    const authorBoundaries = boundaries.filter(
      (b) => b && b.alias !== SYNTHETIC_ROOT_ALIAS
    );

    // CR17: B is split by SORT, per boundary, on every diagram kind. B itself
    // is unchanged and is still every author boundary - the split is what the
    // opening sentence needs, and the two must add up to B by construction
    // rather than be counted twice.
    const deploymentNodes = authorBoundaries.filter(
      (b) => b.kind === DEPLOYMENT_NODE_HAS_NO_KIND
    );

    // CR20: THE LABELS TWO OR MORE SHAPES SHARE, counted here so the element
    // line and the two relationship ends read the same answer off one
    // computation - the choke-point discipline N, B and R already follow.
    //
    // THE EMPTY LABEL IS DELIBERATELY EXCLUDED FROM THIS SET, and the gold
    // rules the construction: two empty-labelled shapes DO share a label, so
    // including it would render `unlabelled element "blank1" (alias blank1)` -
    // the alias twice, disambiguating nothing. CR18's form already carries the
    // alias and is already unique, so the suffix fires only where a label is
    // actually spoken. Fixture `c4/empty-label` reaches exactly this
    // interaction.
    //
    // UNIQUENESS IS OVER SHAPES AND NOT OVER BOUNDARIES (CR20). A boundary
    // label is never compared, even though CR22 makes a boundary narratable as
    // an endpoint.
    const labelCounts = new Map();
    shapes.forEach((shape) => {
      if (!has(shape.label)) return;
      labelCounts.set(shape.label, (labelCounts.get(shape.label) || 0) + 1);
    });
    const sharedLabels = new Set();
    labelCounts.forEach((count, label) => {
      if (count > 1) sharedLabels.add(label);
    });

    // C3's family breakdown, counted in one pass over the same shape array the
    // element list walks.
    const families = {};
    shapes.forEach((shape) => {
      const { base, external } = splitKind(shape.kind);
      const family = FAMILY_OF[base];
      if (!family) return;
      if (!families[family]) families[family] = { total: 0, external: 0 };
      families[family].total += 1;
      if (external) families[family].external += 1;
    });

    return {
      diagramType: typeof diagram.diagramType === "string" ? diagram.diagramType : "",
      title: typeof diagram.title === "string" ? diagram.title : "",
      shapes,
      boundaries,
      rels,
      N: shapes.length,
      B: authorBoundaries.length,
      R: rels.length,
      // CR17's two sorts. `nodes + others === B` by construction.
      nodes: deploymentNodes.length,
      others: authorBoundaries.length - deploymentNodes.length,
      families,
      sharedLabels,
    };
  }

  // ---------------------------------------------------------------------
  // The short tier - rule C1
  // ---------------------------------------------------------------------

  /**
   * Build the plain short sentence (rule C1, as amended by CR1 and CR9).
   *
   * The titled clause fires only on a non-empty title; E4 is the one exemplar
   * to drop it. Zero boundaries drops the "in B boundaries" clause rather than
   * reading "in 0 boundaries"; zero relationships reads "and no relationships".
   *
   * CR17: THE BOUNDARY CLAUSE COUNTS THE TWO SORTS SEPARATELY and the sort is
   * a property of each BOUNDARY, not of the diagram - see
   * `DEPLOYMENT_NODE_HAS_NO_KIND`. A diagram carrying both reads "in N
   * deployment nodes and M boundaries". NO GOLD TARGET REACHES THE MIXED ARM:
   * E6's four boundaries are all deployment nodes and no other exemplar
   * carries one, which is why sweep finding F2 could sit here undetected
   * through a six-of-six comparator run. Fixture `c4/mixed-boundaries` is what
   * pins it.
   *
   * CR9's ZERO-ELEMENT FORM drops the boundary clause WHATEVER B IS, which is
   * not an oversight: a boundary with no descendant shape cannot occur (a parse
   * error, census Q10), so N zero implies no author boundary is drawable. The
   * case is MEASURED AUTHORABLE - measurement Z1 rendered a bare `C4Context`
   * with a title alone - and is reached by no exemplar.
   *
   * THE `esc` PARAMETER IS THE CONVENTIONS RULE MADE MECHANICAL, and it is not
   * a convenience. This sentence is assembled from AUTHOR TEXT (the title) and
   * GENERATOR FURNITURE (the quotation marks round it, the counts, the full
   * stop). `escapeHtml` applies to the first and never to the second, so the
   * sink decides the escaper and the assembly stays in one place:
   *
   *   PLAIN SHORT TIER        esc = identity - raw author text, never escaped,
   *                           because it reaches a textContent sink and the
   *                           SVG aria-label where an entity is read aloud;
   *   DETAILED's OPENING <p>  esc = escapeText - the TITLE is escaped at its
   *                           interpolation site and the quotation marks this
   *                           module wrote stay literal `"`;
   *   HTML SHORT TIER         NOT built here - it is the PLAIN string escaped
   *                           whole, which is a different thing (see
   *                           `buildShortHtml`).
   *
   * THE FIRST BUILD OF THIS MODULE GOT THAT WRONG AND THE GOLD CAUGHT IT. It
   * used the whole-line escape for the detailed's opening paragraph too, on the
   * reasoning that the quotation marks are the only thing an escape would touch
   * and the HTML-short invariant wants them touched. That is true of the TIER
   * and false of the PARAGRAPH, and gold-compare reported five of six targets
   * mismatching at the first `&quot;` - E4 passing only because it has no title
   * to escape. The rule was already written down; the reasoning was a
   * rationalisation of a shortcut.
   *
   * @param {Object} facts - From `measure`
   * @param {Function} esc - Escaper applied to AUTHOR TEXT only
   * @returns {string} The short sentence
   */
  function buildShortText(facts, esc) {
    const escape = typeof esc === "function" ? esc : (t) => t;
    const kindWord = DIAGRAM_WORD[facts.diagramType];
    if (!kindWord) {
      // C1's kind table is closed and the census measured all five. A sixth
      // would be a Mermaid change, and guessing a word for it is exactly what
      // rule C10 forbids.
      throw new Error(
        `C4 STOP: getC4Type() delivered "${facts.diagramType}", which is outside C1's five kinds`
      );
    }

    let sentence = `A C4 ${kindWord} diagram`;
    if (has(facts.title)) {
      // The quotation marks are this module's own furniture; only what is
      // between them is author text.
      sentence += ` titled "${escape(facts.title)}"`;
    }

    if (facts.N === 0) {
      return `${sentence} with no elements and no relationships.`;
    }

    sentence += ` with ${narrationCount(facts.N)} element${
      facts.N === 1 ? "" : "s"
    }`;

    // CR17: THE TWO BOUNDARY SORTS ARE COUNTED SEPARATELY, per boundary rather
    // than per diagram, on every diagram kind. Both present reads "in N
    // deployment nodes and M boundaries"; one present reads that one alone;
    // neither drops the clause, which is C1's original behaviour at B zero.
    //
    // THE CLAUSE IS BUILT FROM PIECES RATHER THAN BY BRANCHING ON THREE CASES,
    // so the singular and plural of each noun are written once and cannot
    // drift - which is what the form this replaced got wrong in a different
    // way, by picking one noun for a count that covered two sorts.
    const sorts = [];
    if (facts.nodes > 0) {
      sorts.push(
        `${narrationCount(facts.nodes)} deployment node${facts.nodes === 1 ? "" : "s"}`
      );
    }
    if (facts.others > 0) {
      sorts.push(
        `${narrationCount(facts.others)} boundar${facts.others === 1 ? "y" : "ies"}`
      );
    }
    // CR24: THE JOIN DEPENDS ON HOW MANY SORTS ARE PRESENT, and it is the JOIN
    // that moves rather than the counting CR17 established.
    //
    //   ONE sort  - unchanged, the preposition stays: "in four deployment
    //               nodes", "in two boundaries".
    //   BOTH      - the preposition is DROPPED and the counts become a comma
    //               list continuing straight into the relationship clause
    //               below: "with two elements, one deployment node, two
    //               boundaries and one relationship".
    //
    // WHY IT MOVED. CR17's own form gave THREE "and"s in a row, because the
    // relationship clause supplies a third: "in one deployment node and two
    // boundaries and one relationship". A listener can reasonably group the
    // last two counts as one unit and hear a diagram with three boundaries -
    // the sentence was correct and unparseable. CR2 RULED THE SAME PROBLEM ONE
    // LEVEL DOWN on the family sentence and cured it by changing the JOINS
    // rather than the facts, and this is that cure applied to the opening.
    //
    // "in" IS DROPPED RATHER THAN KEPT WITH COMMAS AROUND IT because a
    // preposition in a flat list would govern the relationship count too, and
    // relationships are not IN boundaries; keeping it would fix the ambiguity
    // by introducing a falsehood.
    //
    // THE COMMA LIST IS BUILT BY LEAVING THE CLAUSE OPEN, not by assembling a
    // second sentence: the relationship clause below supplies the final "and"
    // on both arms, so there is exactly one place in this function where that
    // word is written and the two arms cannot drift apart on it.
    //
    // NO GOLD TARGET REACHES THE MIXED ARM - E6's four boundaries are all
    // deployment nodes and no other exemplar carries one, the same reason CR17
    // moved no byte. Fixture `c4/mixed-boundaries` is the only place in the
    // corpus either form can be read, and it therefore pins both rulings.
    if (sorts.length === 1) {
      sentence += ` in ${sorts[0]}`;
    } else if (sorts.length > 1) {
      sentence += `, ${sorts.join(", ")}`;
    }

    sentence +=
      facts.R === 0
        ? " and no relationships."
        : ` and ${narrationCount(facts.R)} relationship${
            facts.R === 1 ? "" : "s"
          }.`;

    return sentence;
  }

  /**
   * The HTML SHORT TIER - rule C11.
   *
   * TWO TIERS FROM ONE VALUE. The plain short is built once and this wraps THE
   * SAME STRING; there is deliberately no second sentence builder.
   *
   * THE INVARIANT IS UNCONDITIONAL AND IS WHAT gold-compare's COLUMN 3
   * ASSERTS: shortHTML === escapeHtml(plain short), WHOLE-LINE. That column
   * exists because the quadrant rebuild shipped a 227-character plain short
   * beside a 267-character HTML one and every other instrument reported green.
   * On all six exemplars it means the title's quotation marks become `&quot;`
   * and nothing else moves; E4 has no title, so its two tiers are
   * byte-identical at 83 characters.
   *
   * THIS IS NOT THE SAME STRING AS THE DETAILED TIER'S OPENING PARAGRAPH, and
   * conflating the two is the defect `buildShortText`'s note records. The tier
   * escapes the assembled line; the paragraph escapes the title alone.
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The plain short, escaped whole
   */
  function buildShortHtml(facts) {
    return escapeText(buildShortText(facts, null));
  }

  /**
   * The DETAILED tier's opening paragraph - rule C11 and the CONVENTIONS rule.
   *
   * The same sentence with the TITLE escaped at its interpolation site and the
   * generator's own quotation marks left literal. See `buildShortText`.
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The sentence for the Overview paragraph
   */
  function buildOverviewSentence(facts) {
    return buildShortText(facts, escapeText);
  }

  // ---------------------------------------------------------------------
  // The detailed tier - rule C3
  // ---------------------------------------------------------------------

  /**
   * The family sentence - rule C3, as ruled by CR2 and CR3.
   *
   * "The elements are PART, PART and PART." Parts join with commas and a final
   * "and". WHEN ANY PART CARRIES A COMMA OF ITS OWN - which on this type means
   * an external count - EVERY join becomes a semicolon and the final join
   * becomes "; and". E2 is the only exemplar to reach that arm, and it reaches
   * it with both of its parts. A diagram of one element reads "The element is
   * one person."
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The family sentence
   */
  function buildFamilySentence(facts) {
    const parts = FAMILY_ORDER.filter((f) => facts.families[f]).map((f) => {
      const { total, external } = facts.families[f];
      const noun = total === 1 ? FAMILY_SINGULAR[f] : f;
      let part = `${narrationCount(total)} ${noun}`;
      if (external > 0) {
        part += `, ${narrationCount(external)} of them external`;
      }
      return part;
    });

    // CR2's serial-semicolon arm, triggered by a part carrying its own comma.
    const anyComma = parts.some((p) => p.indexOf(",") !== -1);
    const separator = anyComma ? "; " : ", ";
    const finalJoin = anyComma ? "; and " : " and ";

    const joined =
      parts.length === 1
        ? parts[0]
        : parts.slice(0, -1).join(separator) + finalJoin + parts[parts.length - 1];

    // CR2: the frame agrees with N, not with the number of parts.
    const frame = facts.N === 1 ? "The element is " : "The elements are ";
    return `${frame}${joined}.`;
  }

  /**
   * One element line - rule C4, as amended by CR6 and CR4.
   *
   * `"LABEL", a KIND-WORD[, external][ using TECHN][: DESCR].`
   *
   * THE STOP CLAUSE IS REAL AND IS NOT A FORMALITY. A token outside CR6's
   * nineteen halts and reports rather than guessing a word - and a token
   * carrying the `external_` prefix whose base is outside the ten is outside
   * the nineteen and halts too.
   *
   * THE SUBJECT IS NOT BUILT HERE. `makeSubjects` builds it, because CR18 and
   * CR20 both say this line and the two relationship ends read the same phrase.
   *
   * @param {Object} shape - A delivered element
   * @param {Object} subjects - From `makeSubjects`
   * @returns {string} The line, author text escaped at each interpolation site
   */
  function renderShape(shape, subjects) {
    const { base, external } = splitKind(shape.kind);
    const word = KIND_WORD[base];
    if (!word) {
      throw new Error(
        `C4 STOP: element kind token "${shape.kind}" is outside rule C4's nineteen; refusing to guess a word for it`
      );
    }

    let line = `${subjects.subjectOf(shape)}, ${article(word)} ${word}`;
    // CR6: the marker goes AFTER the kind word and leaves the word unchanged,
    // so external_system_db reads "a database system, external".
    if (external) line += ", external";
    // CR19: the technology is QUOTED. See `quotedTechn`.
    if (has(shape.techn)) line += ` using ${quotedTechn(shape.techn)}`;

    // CR4: the generator supplies the full stop, unless the author's own DESCR
    // already ended the sentence.
    line += has(shape.descr)
      ? `: ${escapeText(shape.descr)}${terminalStop(shape.descr)}`
      : ".";

    return line;
  }

  /**
   * One boundary line - rule C5, as amended by CR7, CR8, CR10 and CR4.
   *
   * Ordinary: `"LABEL", a KIND boundary containing:`
   * Deployment: `"LABEL", a deployment node[ using TECHN][ (DESCR)] containing:`
   *
   * THE LINE CARRIES NO FULL STOP (CR4) - it ends at the colon, because what
   * follows it is the list.
   *
   * CR10's BRACKETED DESCR IS THE CLAUSE THE SURFACE HAD TO GROW FOR. A
   * deployment node's FOURTH argument is drawn by the canvas as its own text
   * element (measurement M1) and the surface delivered no field for it, so E6's
   * target carried a line no generator could emit until the sixth boundary key
   * landed. No punctuation is added inside the brackets.
   *
   * THE DISCRIMINATOR IS THE SURFACE'S, NOT THIS MODULE'S. The db's single
   * `type` slot holds a machine KIND on four boundary sorts and the AUTHOR'S
   * OWN TECHNOLOGY on a deployment node, with no flag on the field (census
   * CONTRADICTION 1); the adapter splits it into `kind` and `techn`, exactly
   * one of which is ever non-null, so this file reads two fields and never has
   * to know which sort it is holding.
   *
   * @param {Object} boundary - A delivered boundary
   * @returns {string} The line, ending at the colon
   */
  function renderBoundary(boundary) {
    // A deployment node is the one boundary sort with no kind and a technology.
    if (boundary.kind === null) {
      let line = `${boundaryName(boundary)}, a deployment node`;
      // CR23: the technology is QUOTED here too, through the SAME helper the
      // element and relationship lines use. See `quotedTechn`.
      if (has(boundary.techn)) line += ` using ${quotedTechn(boundary.techn)}`;
      // CR10's brackets are OUTSIDE the quotes and are unchanged by CR23: the
      // technology and the description are two fields the author declares
      // separately and the canvas draws separately, so quoting the whole
      // `TECHN (DESCR)` run would read as one field and undo that.
      if (has(boundary.descr)) line += ` (${escapeText(boundary.descr)})`;
      return `${line} containing:`;
    }

    // CR8: the three upper-case tokens read as words; ANY other non-empty
    // string reads as an open slot, quoted verbatim and in its delivered case.
    const phrase =
      BOUNDARY_KIND_WORD[boundary.kind] ||
      `boundary of kind "${escapeText(boundary.kind)}"`;
    // CR7: the article agrees with the word that follows it.
    return `${boundaryName(boundary)}, ${article(phrase)} ${phrase} containing:`;
  }

  /**
   * The list position of every boundary - ruling CR11.
   *
   * A BOUNDARY TAKES THE LIST POSITION OF ITS FIRST DESCENDANT SHAPE, at any
   * depth. THIS IS THE DELIVERY'S LIMIT RATHER THAN A PREFERENCE: shapes and
   * boundaries are two separate arrays and NEITHER CARRIES A SOURCE POSITION,
   * so there is no way to order a boundary against a sibling shape directly.
   * The derivation reproduces source order on every exemplar that reaches it -
   * E2 puts its enterprise boundary third, between the auditor and the clearing
   * house, which is where the author wrote it.
   *
   * IT IS TOTAL RATHER THAN A DEFAULT WITH A HOLE: a boundary with no
   * descendant shape cannot occur (a parse error, census Q10), so every
   * boundary has a first descendant.
   *
   * @param {Object} facts - From `measure`
   * @returns {Map<string, number>} Boundary alias to shape index
   */
  function firstDescendantIndex(facts) {
    const byAlias = new Map();
    facts.boundaries.forEach((b) => {
      if (b && typeof b.alias === "string") byAlias.set(b.alias, b);
    });

    const positions = new Map();
    facts.shapes.forEach((shape, index) => {
      // Walk up the containment chain, claiming every ancestor that has not
      // been claimed by an earlier shape.
      let alias = shape.parentBoundary;
      while (alias) {
        if (positions.has(alias)) break;
        positions.set(alias, index);
        const parent = byAlias.get(alias);
        alias = parent ? parent.parentBoundary : "";
      }
    });
    return positions;
  }

  /**
   * Render the element list for one containment level, recursively.
   *
   * Shapes take their own index; boundaries take their first descendant's
   * (CR11). The two are then sorted together, which is what reproduces source
   * order across the delivery's two flat arrays.
   *
   * @param {Object} facts - From `measure`
   * @param {Map} positions - From `firstDescendantIndex`
   * @param {string} parentAlias - The containing boundary's alias
   * @param {Object} subjects - From `makeSubjects`
   * @returns {Array<string>} The `<li>` lines for this level
   */
  function renderLevel(facts, positions, parentAlias, subjects) {
    const items = [];

    facts.shapes.forEach((shape, index) => {
      if (shape.parentBoundary === parentAlias) {
        items.push({ order: index, shape });
      }
    });

    facts.boundaries.forEach((boundary) => {
      if (boundary.alias === SYNTHETIC_ROOT_ALIAS) return;
      if (boundary.parentBoundary !== parentAlias) return;
      items.push({ order: positions.get(boundary.alias), boundary });
    });

    items.sort((a, b) => a.order - b.order);

    const lines = [];
    items.forEach((item) => {
      if (item.shape) {
        lines.push(`<li>${renderShape(item.shape, subjects)}</li>`);
        return;
      }
      lines.push(`<li>${renderBoundary(item.boundary)}<ul>`);
      lines.push(...renderLevel(facts, positions, item.boundary.alias, subjects));
      lines.push("</ul></li>");
    });
    return lines;
  }

  /**
   * One relationship line - rule C6, REWRITTEN IN FULL BY CR14.
   *
   * CR14 is the only ruling in this arc that originates outside the
   * programme's own machinery: Matthew read the review page, approved E1 as
   * drafted, asked on E2 for a clearer relationship line, and approved the
   * design seat's recommendation for all six. It moved FIFTEEN target lines -
   * every relationship line the gold carries.
   *
   *   labelled    `"SOURCE", "LABEL", "TARGET"[, using TECHN][. DESCR].`
   *   unlabelled  `"SOURCE" to "TARGET", unlabelled[, using TECHN][. DESCR].`
   *   birel       `"SOURCE" and "TARGET", in both directions, "LABEL"[, ...].`
   *   self        `"SOURCE" to itself, "LABEL"[, using TECHN][. DESCR].`
   *
   * THE WORDS "both ways" ARE STRUCK EVERYWHERE, and the technology moved from
   * a " using X" trailing a colon to a ", using X" clause after the last quoted
   * run.
   *
   * DIRECTION IS AS THE CANVAS DRAWS IT (census Q5), AND THE SWAP WAS READ AT
   * THE MARKERS RATHER THAN INHERITED. `rel_b` draws its ONE head at the
   * SOURCE, so `Rel_Back(A, B)` is an arrow from B to A: E2's is drawn with
   * marker-start ONLY while its birel carries both markers. The endpoints are
   * therefore swapped here and the labelled form then applies to them. The four
   * directional spellings `rel_u`/`_d`/`_l`/`_r` draw IDENTICALLY to a plain
   * `rel` and never narrate as different kinds.
   *
   * CR12's "to itself" SURVIVES CR14 - a birel whose two endpoints are the same
   * element reads the same line, because "in both directions" would say nothing
   * about a loop - and it is tested FIRST for exactly that reason.
   *
   * THE ENDPOINTS ARE NOT NAMED HERE. `makeSubjects` names them, because CR18
   * and CR20 both say an endpoint reads exactly as its element line does, and
   * CR22 decides which array the alias is looked up in.
   *
   * @param {Object} rel - A delivered relationship
   * @param {Function} labelOf - From `makeSubjects().endpointOf`
   * @returns {string} The line
   */
  function renderRel(rel, labelOf) {
    const label = has(rel.label) ? `"${escapeText(rel.label)}"` : "unlabelled";

    // CR14: the technology is a comma clause after the last quoted run. CR4's
    // terminal punctuation is unchanged by that ruling.
    const tail =
      (has(rel.techn) ? `, using ${quotedTechn(rel.techn)}` : "") +
      (has(rel.descr)
        ? `. ${escapeText(rel.descr)}${terminalStop(rel.descr)}`
        : ".");

    // CR12 + CR14, tested before the birel branch so a self-birel reaches it.
    if (rel.from === rel.to) {
      return `${labelOf(rel.from)} to itself, ${label}${tail}`;
    }

    if (rel.type === "birel") {
      return `${labelOf(rel.from)} and ${labelOf(rel.to)}, in both directions, ${label}${tail}`;
    }

    // C6: rel_b's endpoints are SWAPPED, and CR14's form then applies to them.
    const from = rel.type === "rel_b" ? rel.to : rel.from;
    const to = rel.type === "rel_b" ? rel.from : rel.to;

    // CR14: an unlabelled relationship has no run to put between the endpoints,
    // so it keeps "to" and reports the absence last.
    if (!has(rel.label)) {
      return `${labelOf(from)} to ${labelOf(to)}, ${label}${tail}`;
    }
    return `${labelOf(from)}, ${label}, ${labelOf(to)}${tail}`;
  }

  /**
   * THE SUBJECT PHRASE - ONE BUILDER FOR THREE PLACES A THING IS NAMED.
   *
   * An element is named on its own element line and at either end of a
   * relationship, and rulings CR18 and CR20 both say all three read the same.
   * They are built here, once, for exactly that reason: sweep finding F4 was
   * two relationship lines coming out word-for-word symmetrical, and a fix that
   * reached the element line and not the endpoints would have looked right in
   * the list and stayed wrong in the arrows.
   *
   *   ordinary        `"LABEL"`
   *   empty label     `unlabelled element "ALIAS"`          (CR18)
   *   shared label    `"LABEL" (alias ALIAS)`               (CR20)
   *
   * CR18 - AN EMPTY LABEL IS NEVER NARRATED AS `""`. Sweep P04 measured the
   * delivery FLATTENING `" "` and `""` to one empty string, so a whitespace-
   * only label is indistinguishable at the surface and takes the same reading
   * with no choice in the matter - the same shape as C13's null/`""` for a
   * technology. The canvas draws an EMPTY tspan for each, nothing rather than a
   * placeholder, so "unlabelled" reports an absence a sighted reader is also
   * shown, and the ALIAS is the only handle either reader has. The bare
   * unquoted alias was rejected by the seat: that spelling belongs to C6's
   * unresolved arm, where a name names nothing, and this is a DECLARED element
   * whose author left the label blank.
   *
   * CR20 - A SHARED LABEL CARRIES ITS ALIAS, and it does so wherever the label
   * is spoken. A unique label never carries it, so the ordinary case is
   * untouched and no gold byte moves.
   *
   * CR22 - THE ENDPOINT LOOKUP INDEXES SHAPES AND THEN BOUNDARIES. Sweep P19
   * measured the fault: it indexed shapes only, so `Rel(customer, bank, ...)`
   * on a declared BOUNDARY `bank` fell through to the unresolved arm and read
   * the bare alias while the boundary's own label sat in the delivery. THE
   * UNRESOLVED ARM IS NOT WEAKENED - it still fires for an alias in neither
   * array, which is the only case it was ever for.
   *
   * SHAPES ARE INDEXED FIRST AND WIN A COLLISION, because a shape is what C4
   * and C6 are about and a duplicate id keeps the last declaration on both the
   * db and the canvas (census Q10). THE SYNTHETIC ROOT IS EXCLUDED: rule C2
   * never counts it and rule C5 never narrates it, so resolving an endpoint to
   * it would speak a machine string.
   *
   * CR22 IS UNREACHABLE ON THE PAGE ON THIS BUILD AND IS PINNED BY NO FIXTURE.
   * A boundary used as an endpoint PARSES and then THROWS on render, so the
   * canvas draws nothing and the core hands the reader its error fallback
   * (sweep F8 attributes that fallback to the core, a flowchart that throws
   * producing the identical readings). It is reachable by calling the generator
   * directly, which is why it is implemented rather than left wrong against the
   * day it becomes reachable. RETEST ON ANY MERMAID UPGRADE: the day the render
   * stops throwing is the day this arm reaches a reader with no instrument
   * watching it.
   *
   * @param {Object} facts - From `measure`
   * @returns {Object} `{ subjectOf, endpointOf }`
   */
  function makeSubjects(facts) {
    const shapeByAlias = new Map();
    facts.shapes.forEach((s) => {
      if (s && typeof s.alias === "string") shapeByAlias.set(s.alias, s);
    });

    const boundaryByAlias = new Map();
    facts.boundaries.forEach((b) => {
      if (!b || typeof b.alias !== "string") return;
      if (b.alias === SYNTHETIC_ROOT_ALIAS) return;
      boundaryByAlias.set(b.alias, b);
    });

    /**
     * Name one delivered shape.
     * @param {Object} shape - A delivered element
     * @returns {string} The subject phrase
     */
    function subjectOf(shape) {
      if (!has(shape.label)) {
        // CR18. The alias is quoted where the label would have been, and the
        // CR20 suffix is NOT added - the alias is already here and already
        // unique, so appending it again would say it twice.
        return `unlabelled element "${escapeText(shape.alias)}"`;
      }
      let phrase = `"${escapeText(shape.label)}"`;
      if (facts.sharedLabels.has(shape.label)) {
        phrase += ` (alias ${escapeText(shape.alias)})`;
      }
      return phrase;
    }

    /**
     * Name one relationship endpoint.
     * @param {string} alias - The endpoint's delivered alias
     * @returns {string} The subject phrase, or the bare alias
     */
    function endpointOf(alias) {
      const shape = shapeByAlias.get(alias);
      if (shape) return subjectOf(shape);
      const boundary = boundaryByAlias.get(alias);
      // CR22. A boundary's label is quoted like any other endpoint. CR18 ruled
      // the empty label on a shape and said nothing about a boundary; enactment
      // 4 (3 October 2026) extends the same reading to one, so an empty
      // boundary label is the unlabelled phrase here as on its own line.
      if (boundary) return boundaryName(boundary);
      // C6's unresolved arm: an alias in neither array, read verbatim.
      return escapeText(alias);
    }

    return { subjectOf, endpointOf };
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
   * `isC4Healthy()` reads `null` until the lazy self-check settles, which is
   * why the guard tests for `false` rather than falsiness - a `!healthy` test
   * would refuse every first call on a page.
   *
   * THE GUARD RUNS AFTER THE PARSE, which is the block and sequence order:
   * `parseC4` is what STARTS the lazy self-check, and the self-check takes its
   * own queue slot ahead of this call's, so a guard placed before the parse
   * reads `null` on the first call of every page and could never refuse - a
   * guard off the path it protects on exactly the call where an unhealthy
   * surface matters most.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised c4 delivery
   */
  async function readC4(code) {
    const diagram = await window.MermaidParseAdapter.parseC4(code);
    if (window.MermaidParseAdapter.isC4Healthy() === false) {
      logWarn(
        "[Mermaid Accessibility] C4 self-check failed; refusing to narrate"
      );
      throw new Error(
        "Parse adapter failed its c4 self-check; refusing to narrate an unverified diagram"
      );
    }
    logDebug(
      `[Mermaid Accessibility] C4 delivery: ${diagram.diagramType}, ${
        (diagram.shapes || []).length
      } elements, ${(diagram.boundaries || []).length} boundaries including the synthetic root, ${
        (diagram.rels || []).length
      } relationships`
    );
    return diagram;
  }

  /**
   * Generate a short description for a C4 diagram.
   *
   * The PLAIN form is the tier of record and is never escaped: it reaches a
   * `textContent` sink and the SVG's `aria-label`, where an entity would be
   * announced literally. The HTML form is the same sentence escaped exactly
   * once (rule C11).
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating C4 short description");

    const diagram = await readC4(code);
    const facts = measure(diagram);
    const text = buildShortText(facts, null);
    logDebug(`[Mermaid Accessibility] C4 short: ${text}`);

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
   * Generate a detailed description for a C4 diagram - rule C3.
   *
   * `<h4>Overview</h4>` with the short and the family sentence, then
   * `<h4>Elements</h4>` with a nested list following the boundary tree, then
   * `<h4>Relationships</h4>` with an `<ol>` in source order. NO STYLING SECTION,
   * EVER (C12 and C3's last clause) - E6 declares an `UpdateElementStyle` and
   * gets no section and no mention.
   *
   * CR9's TWO ZERO FORMS ARE DIFFERENT AND BOTH ARE HERE. Where N is 0 the tier
   * is the Overview heading and the short ALONE - no family sentence, no
   * Elements heading, no Relationships heading. Where R is 0 and N is NOT, the
   * Relationships HEADING STAYS and the section reads `<p>None.</p>`, because a
   * diagram with elements and no relationships is a fact about the diagram
   * rather than an absence of one. Neither is reached by an exemplar; both are
   * measured authorable (Z1, Z2).
   *
   * THE `<ol>` IS WHAT NUMBERS A DYNAMIC DIAGRAM - rule C7, as amended by CR5.
   * The canvas prefixes each relationship label with "N: " in SOURCE ORDER, and
   * measurement M2 established that a `RelIndex` argument is DISCARDED by the
   * db and the canvas alike - three RelIndex statements declared deliberately
   * out of order drew 1, 2, 3 in the order written. So the `<ol>`'s numbering
   * agrees with the canvas's BY CONSTRUCTION, both being source order, and
   * C7's original "1. " prefix was struck: authoring both would render
   * "1. 1. From ...". THERE IS NO DYNAMIC BRANCH IN THIS FUNCTION, and that is
   * the ruling rather than an omission.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating C4 detailed description");

    const diagram = await readC4(code);
    const facts = measure(diagram);

    const parts = ["<h4>Overview</h4>", `<p>${buildOverviewSentence(facts)}</p>`];

    // CR9: N zero is the Overview heading and the short alone.
    if (facts.N === 0) {
      return parts.join("\n");
    }

    parts.push(`<p>${buildFamilySentence(facts)}</p>`);

    // ONE SUBJECT BUILDER FOR BOTH SECTIONS, so the element list and the
    // relationship list cannot name the same element two ways (CR18, CR20).
    const subjects = makeSubjects(facts);

    parts.push("<h4>Elements</h4>");
    parts.push("<ul>");
    parts.push(
      ...renderLevel(facts, firstDescendantIndex(facts), SYNTHETIC_ROOT_ALIAS, subjects)
    );
    parts.push("</ul>");

    parts.push("<h4>Relationships</h4>");
    if (facts.R === 0) {
      // CR9: the heading stays and the section reads None.
      parts.push("<p>None.</p>");
    } else {
      const labelOf = subjects.endpointOf;
      parts.push("<ol>");
      facts.rels.forEach((rel) => {
        parts.push(`<li>${renderRel(rel, labelOf)}</li>`);
      });
      parts.push("</ol>");
    }

    // Newline-joined so text-content extraction stays readable: without them,
    // list and heading boundaries concatenate with no space.
    return parts.join("\n");
  }

  // Register with the core module. `generateShort` returns plain text because
  // the core assigns its result straight to descriptions.short, which reaches
  // the figcaption and the SVG aria-label.
  //
  // THE KEY IS "c4", AND THE DETECTOR ROW THAT ROUTES TO IT LANDS IN THE SAME
  // CHANGE AS THIS FILE. A generator registered without its
  // MERMAID_TYPE_TO_KEY row registers and is never called - the core resolves a
  // generator by the detected key, and without the row a c4 source resolves to
  // `unsupported:c4` and reaches the honest fallback instead. The block module
  // shipped in exactly that state and its own header records the halt; this one
  // does not repeat it.
  //
  // ONE ROW COVERS ALL FIVE KINDS, because Mermaid's detector answers `c4` for
  // every one of them (census Q1) and the kind is read from the db instead.
  //
  // generateShortHTML is the ASYNC shape, and it has to be: this module awaits
  // the parse adapter, so `generateShortDescription(...).html` on the returned
  // promise would be `undefined` and the tier would register, be called, and
  // yield nothing silently (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("c4", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] C4 diagram module loaded and registered on the parse adapter's c4 surface"
  );
})();
