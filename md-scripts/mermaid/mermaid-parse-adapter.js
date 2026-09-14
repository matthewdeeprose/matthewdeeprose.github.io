/**
 * Mermaid Parse Adapter
 *
 * A thin, shared adapter over mermaid.mermaidAPI.getDiagramFromText, giving
 * the description modules one normalised flowchart graph shape instead of
 * eleven regex scanners. Stage 1 of the flowchart rewrite (item 2 in
 * docs/mermaid-outstanding.md): landed dark — nothing consumes it yet.
 *
 * getDiagramFromText is a semi-public internal of the pinned Mermaid 11.6.0
 * build (docs/mermaid-measurements-2026-08-01.md § B5), so this adapter
 * carries a self-check that parses a known fixture and asserts the accessor
 * names and field shapes measured in
 * docs/mermaid-flowchart-stage0-measurements-2026-08-01.md (M2, M3). A
 * Mermaid upgrade that changes those internals fails the self-check loudly
 * rather than degrading silently.
 */
window.MermaidParseAdapter = (function () {
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

  // Current logging level - can be modified at runtime
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Set the current logging level
   * @param {number} level - The logging level (0-3)
   */
  function setLogLevel(level) {
    if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
      currentLogLevel = level;
    }
  }

  /**
   * Check if logging should occur based on current level
   * @param {number} level - The level to check
   * @returns {boolean} True if logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} message - The error message
   * @param {...any} args - Additional arguments
   */
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Mermaid Parse Adapter] ERROR: ${message}`, ...args);
    }
  }

  /**
   * Log a warning message
   * @param {string} message - The warning message
   * @param {...any} args - Additional arguments
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Mermaid Parse Adapter] WARN: ${message}`, ...args);
    }
  }

  /**
   * Log an info message
   * @param {string} message - The info message
   * @param {...any} args - Additional arguments
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Mermaid Parse Adapter] INFO: ${message}`, ...args);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The debug message
   * @param {...any} args - Additional arguments
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Mermaid Parse Adapter] DEBUG: ${message}`, ...args);
    }
  }

  // ---------------------------------------------------------------------
  // Placeholder decoding — register item 9
  //
  // Mermaid's encodeEntities runs over the WHOLE diagram source inside
  // Diagram.fromText, BEFORE the parser ever sees it, and decodeEntities is
  // reached only from render-time label paths — never on the parse path. So
  // the db permanently holds private delimiter bytes wherever an author
  // typed Mermaid's own `#word;` / `#digits;` escape, and every description
  // tier has been reading them raw. Mechanism measured and the Mermaid
  // source quoted in
  // docs/mermaid-quot-placeholder-capture-2026-08-08.md § 3; the
  // per-surface verdicts adopted below are the completed render table in
  // docs/mermaid-quot-adoption-2026-08-08.md § 1.
  //
  // TWO transforms, because the surfaces genuinely differ and the
  // difference was MEASURED rather than assumed — the discriminator is
  // where Mermaid draws the label:
  //
  //   decodePlaceholders — resolves the placeholder to the character it
  //     stands for and leaves the author's OWN entity text alone. Correct
  //     for surfaces drawn into SVG <text>, where an author-typed `&quot;`
  //     is drawn literally. Git graph measured 0 foreignObjects.
  //   decodeAuthorText — additionally resolves the author's own character
  //     references. Correct for surfaces drawn into an HTML label subtree
  //     (foreignObject > div > span > p), where the browser's own parser
  //     resolves them: flowchart, ER and class.
  //
  // Both finish with a character-reference parse performed by a detached
  // <textarea>, which parses its content in RCDATA mode: references are
  // resolved while tag-looking text stays literal TEXT and nothing is ever
  // constructed as an element. Do not "simplify" this to DOMParser — that
  // strips tags, which would silently rewrite the hostile label of every
  // existing *-escaping fixture.
  //
  // Register item 19 (8 August 2026) completed the adoption across the
  // remaining author-text fields, on the same two functions. AMENDED
  // 4 SEPTEMBER 2026 BY REGISTER ITEM 78: this read "there is no third
  // transform, by design", and a THIRD ENTRY POINT now exists —
  // decodeSourcePlaceholders, below. It is a COMPOSITION over
  // decodePlaceholders, not a fourth mapping: it encodes with Mermaid's own
  // rule first, because its input is the CALLER'S RAW SOURCE, which
  // encodeEntities never ran over. It serves the core's author-override
  // route and nothing else. The per-surface carve-out below is UNCHANGED.
  // AMENDED 5 SEPTEMBER 2026: this read "it encodes with Mermaid's own
  // `#\w+;` rule first", which named ONE of encodeEntities' three passes.
  // The encode step is now the full three-pass copy, encodeMermaidEntities
  // (renamed from encodeXychartEntities the same day), so the override route
  // and the xychart source reader share one encoder rather than two. The two
  // leading passes strip the trailing semicolon of a `style:`/`classDef:`
  // colour token, so a one-pass encoder decoded a token the canvas leaves
  // alone — measured, and recorded on decodeSourcePlaceholders itself.
  // Its render table is
  // docs/mermaid-item19-field-capture-2026-08-08.md section 3, and each new
  // call site names its verdict. Three carve-outs are DELIBERATE and should
  // not be "completed" by a later editor:
  //
  //   accTitle / accDescr — no transform on ANY surface. ER and class deliver
  //     them permanently EMPTY while the rendered SVG's <title>/<desc> carries
  //     the author's text (a separate delivery defect, registered); flowchart
  //     and git do carry them, and no description module reads either field.
  //     AMENDED 4 SEPTEMBER 2026 BY REGISTER ITEM 78: this read "a transform
  //     there would be dead code no fixture could redden", and the CARVE-OUT
  //     STANDS for exactly that reason — the TEN surfaces still deliver both
  //     fields untransformed wherever they carry them at all. AMENDED
  //     5 SEPTEMBER 2026 BY REGISTER ITEM 80, which added the block surface
  //     and took the count from nine: the qualifier is new too, because two of
  //     the ten carry NEITHER field and a bare count implied otherwise. Sankey
  //     has no accTitle/accDescr syntax, and on block both directives are a
  //     HARD PARSE ERROR, so neither surface delivers the fields to transform.
  //     What changed is that the READER-FACING value
  //     does not come from a surface at all: the core reads the RAW SOURCE
  //     through parseAccessibilityDirectives and assigns it over both
  //     description tiers, and THAT route is now decoded, by
  //     decodeSourcePlaceholders below. Two undecoded forms from two code
  //     paths; this bullet governs the surface half only.
  //   flowchart / ER / class `title` — delivered permanently empty; those
  //     grammars have no body title statement and a frontmatter title never
  //     reaches getDiagramTitle().
  //   ER attribute `type` and `name`, class `namespaces[].name`, and the BARE
  //     `subgraph X` title form — C-NONE by rejection: their lexers refuse the
  //     delimiter bytes, so no author route delivers a placeholder to them.
  const PLACEHOLDER_NUMERIC = "ﬂ°°";
  const PLACEHOLDER_NAMED = "ﬂ°";
  const PLACEHOLDER_END = "¶ß";

  // Created on first use and reused; never inserted into the document.
  let referenceDecoder = null;

  /**
   * Resolve HTML character references in a string, without parsing tags.
   * @param {string} text - The text to decode
   * @returns {string} The text with character references resolved
   */
  function parseCharacterReferences(text) {
    if (!referenceDecoder) {
      referenceDecoder = document.createElement("textarea");
    }
    referenceDecoder.innerHTML = text;
    return referenceDecoder.value;
  }

  /**
   * Map Mermaid's private delimiters back onto the entity syntax they stand
   * for — the same mapping decodeEntities applies at render time.
   * @param {string} text - The delivered text
   * @returns {string} The text with delimiters mapped to entity syntax
   */
  function resolvePlaceholderDelimiters(text) {
    return text
      .split(PLACEHOLDER_NUMERIC)
      .join("&#")
      .split(PLACEHOLDER_NAMED)
      .join("&")
      .split(PLACEHOLDER_END)
      .join(";");
  }

  /**
   * Placeholder-only decode, for SVG-text surfaces. The author's own `&`
   * and `<` are protected BEFORE the delimiters are mapped, so an
   * author-typed entity survives as the literal text the canvas shows.
   * @param {string} text - The delivered text
   * @returns {string} The decoded text, or the input unchanged when not a
   *   non-empty string
   */
  function decodePlaceholders(text) {
    if (typeof text !== "string" || text === "") {
      return text;
    }
    const protectedText = text.split("&").join("&amp;").split("<").join("&lt;");
    return parseCharacterReferences(resolvePlaceholderDelimiters(protectedText));
  }

  /**
   * Full decode, for HTML-label surfaces: placeholders AND the author's own
   * character references, matching what the browser resolves in the label.
   * @param {string} text - The delivered text
   * @returns {string} The decoded text, or the input unchanged when not a
   *   non-empty string
   */
  function decodeAuthorText(text) {
    if (typeof text !== "string" || text === "") {
      return text;
    }
    return parseCharacterReferences(resolvePlaceholderDelimiters(text));
  }

  /**
   * Decode Mermaid's own #word; and #digits; escapes in text taken from the
   * RAW diagram source, which encodeEntities never touched.
   * Encodes with Mermaid's rule and then applies decodePlaceholders, so the
   * author's own & and < survive as typed. Register item 78: this serves ONLY
   * the core's author-override route, which reads the raw source; the TEN
   * surfaces still hand accTitle/accDescr through untransformed wherever they
   * carry them, because no module reads them there. (Nine until 5 September
   * 2026, when register item 80 added the block surface — which, like sankey,
   * carries neither field at all.)
   *
   * THE ENCODE STEP IS THE THREE-PASS COPY, AND HAS BEEN SINCE 5 SEPTEMBER
   * 2026. It was a one-pass `#\w+;` replace inlined here until then — item 78
   * implemented only the branch its dispatch named, and registered the
   * duplication as a thing to decide. It is decided: this calls the shared
   * encodeMermaidEntities below, and the local copy is gone.
   *
   * WHY THE TWO PRE-PASSES MATTER HERE and not only on xychart. Mermaid's own
   * encodeEntities runs its `style`/`classDef` passes over the WHOLE source
   * before the parser sees it, and each one STRIPS THE TRAILING SEMICOLON of a
   * colour token — so a `#…;` token following `style:` or `classDef:` with no
   * space between never becomes a placeholder, and the canvas draws it
   * literally. A one-pass encoder decodes a token the canvas leaves alone, and
   * the reader is then told something the sighted user cannot see. MEASURED
   * 5 September 2026 on `accTitle: style:#quot;x#quot;`: the SVG <title> reads
   * `style:"x#quot` where the one-pass decode gave `style:"x"`. The same value
   * WITH a space after the colon agreed on both sides before this change and
   * after it, because `\S*` cannot cross the space and no pre-pass fires.
   *
   * @param {string} text - Raw source text
   * @returns {string} The decoded text, or the input unchanged when not a
   *   non-empty string
   */
  function decodeSourcePlaceholders(text) {
    if (typeof text !== "string" || text === "") {
      return text;
    }
    // encodeMermaidEntities is a hoisted function declaration in this same
    // IIFE, declared below; the call is resolved by hoisting, not by order.
    return decodePlaceholders(encodeMermaidEntities(text));
  }

  // ---------------------------------------------------------------------
  // THE ADAPTER-WIDE PARSE QUEUE — register item 21
  //
  // Mermaid keeps the accessible title, the accessible description and the
  // diagram title in ONE module-scoped store shared by every diagram type
  // (`rA` / `iA` / `nA` in its common db), read through a single shared
  // getter and CLEARED BY EVERY PARSE. Measured and named in
  // docs/mermaid-item21-mechanism-2026-08-08.md §§ 5-6. Each normalise*
  // below reads that store inside its own parse's .then, so any OTHER parse
  // issued in the window between that parse resolving and the read had
  // already zeroed or overwritten it. Three consequences were measured:
  // ER and class delivered "" on the first call of a page (their own
  // self-check's fixture parse was the racer); two concurrent parses
  // delivered each other's accessible titles; and git's `title` — the one
  // field of the three that a description module actually consumes, since
  // it reaches the plain short and through it the SVG's aria-label — could
  // be lost outright.
  //
  // THE INVARIANT THIS QUEUE EXISTS TO ENFORCE, and the one line to keep
  // true when editing anything below:
  //
  //     NOTHING READS ANY MERMAID DB OUTSIDE A QUEUE SLOT.
  //
  // A slot runs one getDiagramFromText AND the whole read of its result —
  // normalise* for a consumer, the raw assertion reads for a self-check —
  // before the queue advances. Reading a db from a .then attached OUTSIDE
  // the slot happens to work by microtask attachment order; that is an
  // accident of scheduling, not a defence, and must not be relied on.
  //
  // THIS ONE QUEUE REPLACES THE TWO SURFACE-LOCAL QUEUES that preceded it
  // (git and sankey), and it inherits both of their rationales in full:
  //
  //   - GIT SINGLETON DEFENCE 2 (stage 0 M2e,
  //     docs/mermaid-gitgraph-stage0-measurements-2026-08-03.md): the git
  //     db is a module-level SINGLETON, and a second parse destroys the
  //     first diagram's data IN PLACE. Serialising is what stops a second
  //     call mutating it mid-snapshot.
  //   - SANKEY SINGLETON DEFENCE 2 (stage 0 S2e,
  //     docs/mermaid-sankey-stage0-measurements-2026-08-03.md): the sankey
  //     db is likewise a shared singleton, but its data is REASSIGNED by
  //     the next parse rather than mutated in place. That difference is why
  //     defence 1 there is about WHEN getGraph() is called rather than
  //     about deep-copying what it returns — a projection taken at the
  //     right moment is durable, and the queue is what guarantees the right
  //     moment.
  //
  // Each surface's eager-snapshot defence 1 stays exactly where it was, in
  // normaliseGit and normaliseSankey. This queue does not replace it.
  //
  // WHY SANKEY QUEUES EVEN THOUGH IT CANNOT LOSE ANYTHING (measured
  // 9 August 2026, check CQ11 in
  // docs/mermaid-concurrency-instrument-2026-08-09.md): the sankey shape
  // carries none of the three fields, because the type has no syntax that
  // populates them — but a sankey parse CLEARS the shared store like every
  // other parse. It is a racer that can never be a victim, so it queues for
  // the other four surfaces' sake rather than its own.
  //
  // THE SURFACES ON THIS QUEUE, and there are TEN as of 5 September 2026:
  // flowchart (the bare `parse`), ER, class, git, sankey, xychart, gantt,
  // quadrant, sequence and block. Register item 80 added the last of them, and
  // block is the type this queue matters MOST to — its db is a shared
  // singleton on which a second parse replaces the WHOLE payload rather than
  // only the shared scalar trio, so the slot is what protects the blocks and
  // edges themselves and not merely the titles (census
  // docs/mermaid-item-80-census-1-2026-09-05.md § Q8).
  //
  // SHARED FATE, ACCEPTED DELIBERATELY: one queue means a parse that never
  // settles stalls all ten surfaces where ten queues would have stalled
  // one. There is no timeout machinery here on purpose — a timeout would
  // have to abandon a slot whose parse may still be mutating a singleton
  // db, which is the very thing the queue exists to prevent. What CANNOT
  // wedge the queue is a rejection: every enqueued run appends a
  // settlement-only tail, so the chain advances whether its parse resolved
  // or rejected.
  //
  // RESIDUAL, named rather than implied: the store belongs to Mermaid, so
  // this queue contains only the parses THIS ADAPTER issues. A
  // mermaid.render anywhere else on the page parses through the same store
  // and is outside it — registered separately in
  // docs/mermaid-outstanding.md.
  //
  // Verification: .claude/mermaid-harness/concurrency.mjs, which must be
  // fully green after any change to this file.
  let adapterParseQueue = Promise.resolve();

  // ---------------------------------------------------------------------

  // Direction spellings: Mermaid preserves "TD" rather than normalising it
  // (stage 0 M3a), so the adapter collapses the synonym itself.
  const DIRECTION_SYNONYMS = Object.freeze({ TD: "TB" });

  // Shape spellings: Mermaid delivers every `@{ shape: … }` name VERBATIM,
  // so one visual shape reaches the modules under several different strings
  // — a diamond as `diam`, `decision`, `question` or `diamond`. Measured
  // in docs/mermaid-shape-grounding-2026-08-20.md § 1.2 and § 5.1: 121
  // distinct strings collapse onto roughly forty visual shapes.
  //
  // The modules test the CANONICAL string, so an alias spelling silently
  // misses every shape predicate. `decisionIds` and the R7 split guard both
  // read `shape === "diamond"`, and an alias-spelled diamond was measured
  // narrating as an ordinary step — or, with unlabelled exits, as a
  // parallel split, which R13 forbids in terms (§ 5.2). This is the fix
  // for that defect.
  //
  // SECOND SLICE OF THE FULL NORMALISATION TABLE (register item 44 — NOT
  // item 41, which is markdown emphasis stripping; the two were conflated
  // once and item 44 records the misreading). The adapter is the only place
  // a spelling can be collapsed, because the modules never see the source.
  // Extend one shape at a time, and only for shapes something actually
  // READS — a row that no consumer tests buys nothing and can go stale.
  //
  //   Slice 1, 20 August 2026 — the diamond, for the two module predicates.
  //   Slice 2, 21 August 2026 — the datastore, both parallelogram directions
  //     and the manual-input sloped rectangle, for R25's shape vocabulary.
  //
  // CANONICAL CHOICE: the string the CLASSIC bracket form delivers, where a
  // classic form exists, otherwise Mermaid's own canonical name. That is why
  // the right-hand side carries the underscore spellings `lean_right` and
  // `lean_left` — those are what `[/x/]` and `[\x\]` deliver, and they cannot
  // be written inside `@{ shape: … }` at all (measured 21 August 2026: an
  // underscore name is REJECTED there, "Shape names should be lowercase").
  //
  // BOTH PARALLELOGRAM DIRECTIONS KEEP DISTINCT CANONICALS. They are
  // measurably different drawn shapes — mirrored polygons — and the adapter's
  // job is to preserve visual identity. R25 maps both to one narration
  // prefix; that collapse belongs to the module, not here.
  //
  // `disk` IS DELIBERATELY ABSENT from the cylinder rows. The shape grounding
  // lists it as a cylinder alias; a rendered-geometry comparison on
  // 21 August 2026 measured its outline byte-identical to `lin-cyl` ("disk
  // storage") and DIFFERENT from `cyl`. Including it would fire the datastore
  // narration on a shape the reader sees as something else, which is the
  // exact defect this table exists to prevent. See the shape vocabulary
  // report of 21 August 2026.
  //
  // NO TRAPEZOID SPELLING APPEARS HERE. `manual` and `manual-file` name the
  // manual-TASK trapezoid, a different visual shape from the manual-INPUT
  // sloped rectangle, and the two were measured distinct in both directions
  // — different delivered strings and different drawn outlines. Register
  // item 44 carries the ruling and its stop condition.
  const SHAPE_SYNONYMS = Object.freeze({
    // Slice 1: the diamond. Canonical is the classic `{ }` form's string.
    diam: "diamond",
    decision: "diamond",
    question: "diamond",
    // Slice 2, datastore. Canonical `cylinder` is what `[(x)]` delivers.
    cyl: "cylinder",
    db: "cylinder",
    database: "cylinder",
    // Slice 2, parallelogram pointing right. Canonical `lean_right` is what
    // `[/x/]` delivers; the `@{ }` spellings all collapse onto it.
    "lean-r": "lean_right",
    "in-out": "lean_right",
    "lean-right": "lean_right",
    // Slice 2, parallelogram pointing left. Canonical `lean_left` is what
    // `[\x\]` delivers.
    "lean-l": "lean_left",
    "out-in": "lean_left",
    "lean-left": "lean_left",
    // Slice 2, manual-input sloped rectangle. NO classic form exists for it,
    // so the canonical is Mermaid's own canonical name, `sl-rect`.
    "manual-input": "sl-rect",
  });

  // Single-slot memo: the last code string parsed and its promise. The
  // promise is cached, not the resolved value, so concurrent callers with
  // the same code share one parse and a rejection stays deterministic.
  let memoCode = null;
  let memoPromise = null;

  // Self-check health: null until the check has run, then true or false.
  let healthy = null;

  // The self-check runs LAZILY, memoised, on the first parse() call — not
  // eagerly at script evaluation. Measured 2 August 2026 (stage 1, step 0
  // and its gate): on a fully loaded tools.html, getDiagramFromText
  // resolves normally with no explicit mermaid.initialize call, but at
  // script-evaluation time — when this file's tag executes during page
  // load — the same call REJECTS with "No diagram type detected matching
  // given configuration", because Mermaid's diagram detectors are not yet
  // registered that early. An eager check therefore reported a false
  // failure on every page load; by first consumer call, Mermaid is ready.
  let selfCheckStarted = false;
  let selfCheckPromise = null;

  /**
   * The embedded self-check fixture. Small on purpose: three nodes and two
   * edges exercise all seven accessors and every field the normalised shape
   * exposes (labelled and bare-id nodes, labelled and unlabelled edges).
   */
  const SELF_CHECK_FIXTURE = [
    "graph TB",
    "    A[Start] -->|go| B(Round)",
    "    B --> C",
  ].join("\n");

  /**
   * Collapse an alias shape spelling onto the canonical string the
   * description modules test. Anything absent from SHAPE_SYNONYMS — `null`
   * included — is returned exactly as Mermaid delivered it.
   * @param {string|null} rawShape - The shape as the db delivered it
   * @returns {string|null} The canonical shape, or the raw value unchanged
   */
  function normaliseShape(rawShape) {
    const canonical = SHAPE_SYNONYMS[rawShape];
    // A typeof test rather than a truthiness one: a shape string that happens
    // to name an Object.prototype member must not resolve through the
    // prototype chain and rewrite the shape into a function.
    if (typeof canonical !== "string") return rawShape;
    logDebug(`Shape alias "${rawShape}" normalised to "${canonical}"`);
    return canonical;
  }

  /**
   * Normalise one Mermaid Diagram instance into the adapter's graph shape.
   * Field sources are the stage 0 measurements: vertex and edge shapes from
   * M2, bare-id text and absent type from M3i, subgraph flattening from M3l.
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised graph
   */
  function normaliseFlowchart(diagram) {
    const db = diagram.db;

    const rawDirection = db.getDirection();
    const direction = DIRECTION_SYNONYMS[rawDirection] || rawDirection;

    // Map iteration order is source first-mention order (M3j).
    // Item 9, verdict C-FULL for this surface: flowchart labels are drawn
    // inside an HTML label subtree, so the author's own character
    // references resolve on the canvas too. `id` is a join key that edges
    // reference and is deliberately left raw.
    const nodes = [...db.getVertices().values()].map((vertex) => ({
      id: vertex.id,
      label: decodeAuthorText(vertex.text),
      // Bare-id nodes carry no type property at all (M3i); null marks
      // "no declared shape" explicitly for consumers. The alias spellings are
      // collapsed here, inside the queue slot the db read already runs in, so
      // every consumer sees one string per visual shape.
      shape: normaliseShape(vertex.type === undefined ? null : vertex.type),
    }));

    const edges = db.getEdges().map((edge) => ({
      from: edge.start,
      to: edge.end,
      label: decodeAuthorText(edge.text),
      kind: edge.type,
      stroke: edge.stroke,
    }));

    // Mermaid reports subgraphs flat, with a child subgraph's id appearing
    // in its parent's nodes array alongside real node ids (M3l). Split the
    // two by matching entries against the set of subgraph ids.
    const rawSubgraphs = db.getSubGraphs();
    const subgraphIds = new Set(rawSubgraphs.map((s) => s.id));
    // Item 19, verdict C-FULL (8 August 2026): a subgraph title is drawn in an
    // HTML label subtree like every other flowchart label. `id` is the join key
    // childSubgraphIds resolve against and stays RAW. One recorded wrinkle:
    // the consumer narrates `sub.title || sub.id`, so the fallback branch would
    // narrate a raw id where the primary narrates a decoded title — unreachable
    // today, because the BARE `subgraph X` form rejects every placeholder and
    // only the bracketed form can carry one.
    const subgraphs = rawSubgraphs.map((s) => ({
      id: s.id,
      title: decodeAuthorText(s.title),
      nodeIds: s.nodes.filter((n) => !subgraphIds.has(n)),
      childSubgraphIds: s.nodes.filter((n) => subgraphIds.has(n)),
    }));

    return {
      type: "flowchart",
      direction: direction,
      title: db.getDiagramTitle() || "",
      accTitle: db.getAccTitle() || "",
      accDescr: db.getAccDescription() || "",
      nodes: nodes,
      edges: edges,
      subgraphs: subgraphs,
    };
  }

  /**
   * Parse Mermaid flowchart code into the normalised graph shape.
   *
   * Rejects with Mermaid's own Error on a parse failure — the call itself
   * never throws synchronously (stage 0 M3k), so awaiting this promise is
   * the single error path.
   *
   * SERIALISED PARSES (register item 21): the parse AND normaliseFlowchart's
   * read of it run in one slot of the adapter-wide queue, so no other
   * adapter parse can clear Mermaid's shared accessible-title store between
   * them. The chain advances on settlement, not success, so a rejection
   * cannot wedge the queue. See the queue declaration for the mechanism.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised graph
   */
  function parse(code) {
    // Lazy self-check trigger (see the comment on selfCheckStarted). The
    // flag is set before runSelfCheck() parses the fixture, so the
    // re-entrant parse() call inside it cannot recurse.
    if (!selfCheckStarted) {
      runSelfCheck();
    }

    if (code === memoCode && memoPromise) {
      logDebug("Returning memoised parse for identical code string");
      return memoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24). It sits INSIDE run, so every line
    // is emitted from the queue slot the parse actually executes in rather
    // than from the caller's turn. The code string's LENGTH is logged and
    // never its text - author content stays out of the console.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`Flowchart parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Flowchart parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const graph = normaliseFlowchart(diagram);
          logDebug(
            `Flowchart parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return graph;
        })
        .catch((error) => {
          logDebug(
            `Flowchart parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    memoCode = code;
    memoPromise = result;
    return result;
  }

  /**
   * Parse the embedded fixture and assert the accessor names and field
   * shapes this adapter depends on. Resolves true on a clean pass. On any
   * failure it logs one ERROR naming the failed assertion, marks the
   * adapter unhealthy, and resolves false. Never throws and never rejects.
   *
   * Memoised: the check runs once, and later calls return the same settled
   * promise. It goes through parse() itself, so it exercises exactly the
   * path consumers use — and, since item 21, that means its fixture parse
   * takes a slot on the adapter-wide queue like any other. The trigger runs
   * before the consumer's own parse enqueues, so the fixture parse holds
   * the earlier slot; `selfCheckStarted` is set before the re-entrant
   * parse() call, so that call cannot re-trigger the check.
   *
   * @returns {Promise<boolean>} Resolves to the health verdict
   */
  function runSelfCheck() {
    if (selfCheckPromise) {
      return selfCheckPromise;
    }
    selfCheckStarted = true;

    selfCheckPromise = parse(SELF_CHECK_FIXTURE)
      .then((graph) => {
        // Each entry: [assertion name, predicate]. The first false predicate
        // fails the check and is named in the single ERROR line.
        const assertions = [
          ["three nodes", graph.nodes.length === 3],
          [
            "node order A, B, C",
            graph.nodes.map((n) => n.id).join(",") === "A,B,C",
          ],
          [
            "node A label 'Start'",
            graph.nodes[0] && graph.nodes[0].label === "Start",
          ],
          [
            "node A shape 'square'",
            graph.nodes[0] && graph.nodes[0].shape === "square",
          ],
          [
            "node B shape 'round'",
            graph.nodes[1] && graph.nodes[1].shape === "round",
          ],
          ["node C label 'C'", graph.nodes[2] && graph.nodes[2].label === "C"],
          ["node C shape null", graph.nodes[2] && graph.nodes[2].shape === null],
          ["two edges", graph.edges.length === 2],
          [
            "edge A to B with label 'go'",
            graph.edges[0] &&
              graph.edges[0].from === "A" &&
              graph.edges[0].to === "B" &&
              graph.edges[0].label === "go",
          ],
          [
            "edge B to C with empty label",
            graph.edges[1] &&
              graph.edges[1].from === "B" &&
              graph.edges[1].to === "C" &&
              graph.edges[1].label === "",
          ],
          [
            "both edges kind 'arrow_point'",
            graph.edges.every((e) => e.kind === "arrow_point"),
          ],
          [
            "both edges stroke 'normal'",
            graph.edges.every((e) => e.stroke === "normal"),
          ],
          ["direction 'TB'", graph.direction === "TB"],
          ["no subgraphs", graph.subgraphs.length === 0],
        ];

        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Self-check FAILED at assertion: ${failed[0]}. ` +
              "The pinned Mermaid build's parse internals no longer match " +
              "the stage 0 measurements; do not trust adapter output."
          );
          healthy = false;
          return false;
        }

        logInfo("Self-check passed: all accessor and field-shape assertions hold");
        healthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `Self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        healthy = false;
        return false;
      });

    return selfCheckPromise;
  }

  /**
   * Report the adapter's health.
   * @returns {boolean|null} True or false once the self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isHealthy() {
    return healthy;
  }

  // ---------------------------------------------------------------------
  // Entity relationship surface
  //
  // Deliberately PARALLEL to the flowchart surface above rather than
  // generalised into a dispatcher: its own memo slot, its own self-check
  // state, its own health flag. A shared single-slot memo would let
  // parse(code) and parseEr(code) on the same string hand each other the
  // wrong cached promise, and a shared health flag would let a failed ER
  // check stop flowchart narrating (and vice versa).
  //
  // Field sources are docs/mermaid-er-stage0-measurements-2026-08-02.md.
  // ---------------------------------------------------------------------

  // Single-slot memo for the ER surface, matching parse()'s contract: the
  // promise is cached rather than the resolved value.
  let erMemoCode = null;
  let erMemoPromise = null;

  // ER self-check health: null until the check has run, then true or false.
  // Independent of the flowchart `healthy` flag by design.
  let erHealthy = null;

  // Lazy, memoised, first-parseEr trigger — same reasoning as the flowchart
  // self-check above: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let erSelfCheckStarted = false;
  let erSelfCheckPromise = null;

  /**
   * The embedded ER self-check fixture. Two entities, one relationship and
   * one attribute row exercise every db accessor and field shape the ER
   * surface depends on — including the crossed cardinality convention,
   * which is the assertion most worth failing loudly.
   */
  const ER_SELF_CHECK_FIXTURE = [
    "erDiagram",
    "    CUSTOMER ||--o{ ORDER : places",
    "    CUSTOMER {",
    '        string name PK "check"',
    "    }",
  ].join("\n");

  /**
   * Normalise one resolved ER Diagram instance into the adapter's ER shape.
   *
   * THE CROSSED CARDINALITY CONVENTION — resolved here, permanently.
   * Mermaid's relSpec does NOT describe the end you would expect from the
   * field names. Measured over eight relationship probes in
   * docs/mermaid-er-stage0-measurements-2026-08-02.md (M3 E1-E3):
   *
   *   relSpec.cardA records the RIGHT-hand symbol, drawn at entityB's end
   *     — i.e. how many `to` entities exist per `from` entity.
   *   relSpec.cardB records the LEFT-hand symbol, drawn at entityA's end
   *     — i.e. how many `from` entities exist per `to` entity.
   *
   * Anyone reading `cardA` as "entityA's own cardinality" inverts every
   * cardinality sentence in the narration. The normalised field names
   * `toPerFrom` and `fromPerTo` carry the measured meaning instead, so no
   * consumer ever sees cardA or cardB and no future editor can reintroduce
   * the trap downstream. runErSelfCheck() pins the raw convention so a
   * Mermaid upgrade that flips the sides fails loudly.
   *
   * Endpoints in relationships[] hold generated ids (`entity-CUSTOMER-0`),
   * not names (M2c), so both are resolved back to the entities Map key.
   * Attributes are copied into fresh objects with a fresh keys array —
   * db internals are never handed out, matching normaliseFlowchart.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised ER graph
   * @throws {Error} When a relationship endpoint id resolves to no entity
   */
  function normaliseEr(diagram) {
    const db = diagram.db;

    // Map iteration order is source first-mention order (E11), whether the
    // first mention is a relationship or an attribute block.
    const rawEntities = db.getEntities();

    // Endpoint ids are generated; the Map key is the source name (M2c).
    const idToName = new Map();
    rawEntities.forEach((entity, name) => {
      idToName.set(entity.id, name);
    });

    const entities = [];
    rawEntities.forEach((entity, name) => {
      entities.push({
        // `name` is the Map key AND the join key relationships resolve to,
        // so it stays RAW — the consumer narrates displayName, and the two
        // carry identical bytes on every measured probe (item 9 § 1).
        name: name,
        // Display name is alias when declared, otherwise label (E5).
        // Item 9, verdict C-FULL: ER labels are drawn in an HTML subtree.
        displayName: decodeAuthorText(
          typeof entity.alias === "string" && entity.alias !== ""
            ? entity.alias
            : entity.label
        ),
        // Fresh objects and a fresh keys array — never db internals (E4).
        // Item 19 (8 August 2026): `comment` is the only attribute field that
        // can carry a placeholder, verdict C-FULL. `type` and `name` are
        // C-NONE BY REJECTION — the ATTRIBUTE_WORD lexer refuses U+00B0, so a
        // #word; token (which reaches the parser already as delimiter bytes)
        // rejects the whole diagram and can never be delivered here. `keys` is
        // a fixed enumeration, not author text.
        attributes: (entity.attributes || []).map((attribute) => ({
          type: attribute.type,
          name: attribute.name,
          keys: Array.isArray(attribute.keys) ? [...attribute.keys] : [],
          comment: decodeAuthorText(attribute.comment),
        })),
      });
    });

    /**
     * Resolve one generated endpoint id back to its entity name.
     * @param {string} id - The generated endpoint id
     * @returns {string} The entities Map key
     */
    function resolveEndpoint(id) {
      const name = idToName.get(id);
      if (name === undefined) {
        throw new Error(
          `ER relationship endpoint id "${id}" does not resolve to any entity`
        );
      }
      return name;
    }

    // Source order (E11); duplicates between the same pair are preserved
    // as distinct relationships (E9).
    const relationships = db.getRelationships().map((relationship) => {
      const relSpec = relationship.relSpec || {};
      return {
        from: resolveEndpoint(relationship.entityA),
        to: resolveEndpoint(relationship.entityB),
        // May be "" — an empty quoted label parses (E6). Item 9, C-FULL.
        role: decodeAuthorText(relationship.roleA),
        toPerFrom: relSpec.cardA,
        fromPerTo: relSpec.cardB,
        relType: relSpec.relType,
      };
    });

    return {
      type: "er",
      direction: db.getDirection(),
      title: db.getDiagramTitle() || "",
      accTitle: db.getAccTitle() || "",
      accDescr: db.getAccDescription() || "",
      entities: entities,
      relationships: relationships,
    };
  }

  /**
   * Parse Mermaid entity relationship code into the normalised ER shape.
   *
   * Rejects with Mermaid's own Error on a parse failure — the call itself
   * never throws synchronously (stage 0 E12), so awaiting this promise is
   * the single error path. An unresolvable relationship endpoint rejects
   * the same way, reaching the consumer's await rather than yielding a
   * half-built graph.
   *
   * SERIALISED PARSES (register item 21): the parse AND normaliseEr's read
   * of it run in one slot of the adapter-wide queue, so no other adapter
   * parse can clear Mermaid's shared accessible-title store between them.
   * Before that queue existed, this surface's own self-check parse was the
   * racer, and the first parseEr of every page delivered accTitle "".
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised ER graph
   */
  function parseEr(code) {
    // Lazy ER self-check trigger. The flag is set before the check parses
    // its fixture, matching the flowchart surface's ordering.
    if (!erSelfCheckStarted) {
      runErSelfCheck();
    }

    if (code === erMemoCode && erMemoPromise) {
      logDebug("Returning memoised ER parse for identical code string");
      return erMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for
    // why it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`ER parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `ER parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const graph = normaliseEr(diagram);
          logDebug(
            `ER parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return graph;
        })
        .catch((error) => {
          logDebug(
            `ER parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    erMemoCode = code;
    erMemoPromise = result;
    return result;
  }

  /**
   * Parse the embedded ER fixture and assert the db accessor names and
   * field shapes the ER surface depends on. Resolves true on a clean pass.
   * On any failure it logs one ERROR naming the failed assertion, marks the
   * ER surface unhealthy, and resolves false. Never throws and never
   * rejects, and never reads or writes the flowchart health flag.
   *
   * Memoised: the check runs once, and later calls return the same settled
   * promise.
   *
   * Unlike the flowchart check, this one resolves the Diagram itself rather
   * than going through parseEr(): its assertions are deliberately about the
   * RAW db internals — the entities Map, the entity `id` fields, and
   * relSpec.cardA/cardB — which the normalised shape exists to hide. That
   * is the point of the check: pin the crossed convention at source, so a
   * Mermaid upgrade that flips the sides fails here instead of silently
   * inverting every cardinality sentence downstream.
   *
   * @returns {Promise<boolean>} Resolves to the ER health verdict
   */
  function runErSelfCheck() {
    if (erSelfCheckPromise) {
      return erSelfCheckPromise;
    }
    erSelfCheckStarted = true;

    // The fixture parse goes through the ADAPTER-WIDE QUEUE, and every raw
    // db read happens INSIDE the queued run: `run` resolves to the completed
    // assertion list, never to a diagram for a later .then to read. That is
    // the queue's invariant made structural — see its declaration.
    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            ER_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;

          const entities = db.getEntities();
          const isMap = entities instanceof Map;
          const entityNames = isMap ? [...entities.keys()] : [];
          const customer = isMap ? entities.get("CUSTOMER") : undefined;
          const order = isMap ? entities.get("ORDER") : undefined;
          const attribute =
            customer && Array.isArray(customer.attributes)
              ? customer.attributes[0]
              : undefined;

          const relationships = db.getRelationships();
          const relationship = Array.isArray(relationships)
            ? relationships[0]
            : undefined;
          const relSpec = relationship ? relationship.relSpec : undefined;

          // Each entry: [assertion name, predicate]. The first false predicate
          // fails the check and is named in the single ERROR line. The
          // predicates are EVALUATED HERE, inside the slot, so the verdict
          // below never touches the db.
          return [
            [
              "entities container is a Map of size 2",
              isMap && entities.size === 2,
            ],
            [
              "entity order CUSTOMER, ORDER",
              entityNames.join(",") === "CUSTOMER,ORDER",
            ],
            [
              "CUSTOMER first attribute has the four measured fields",
              attribute &&
                attribute.type === "string" &&
                attribute.name === "name" &&
                Array.isArray(attribute.keys) &&
                attribute.keys.length === 1 &&
                attribute.keys[0] === "PK" &&
                attribute.comment === "check",
            ],
            [
              "both relationship endpoints resolve through entity id fields",
              relationship &&
                customer &&
                order &&
                relationship.entityA === customer.id &&
                relationship.entityB === order.id,
            ],
            [
              "crossed cardinality convention holds (cardA right, cardB left)",
              relSpec &&
                relSpec.cardA === "ZERO_OR_MORE" &&
                relSpec.cardB === "ONLY_ONE" &&
                relSpec.relType === "IDENTIFYING",
            ],
            [
              "getDirection, getAccTitle, getAccDescription and getDiagramTitle return strings",
              typeof db.getDirection() === "string" &&
                typeof db.getAccTitle() === "string" &&
                typeof db.getAccDescription() === "string" &&
                typeof db.getDiagramTitle() === "string",
            ],
          ];
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    erSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `ER self-check FAILED at assertion: ${failed[0]}. ` +
              "The pinned Mermaid build's ER parse internals no longer match " +
              "the stage 0 measurements; do not trust ER adapter output."
          );
          erHealthy = false;
          return false;
        }

        logInfo(
          "ER self-check passed: all accessor and field-shape assertions hold"
        );
        erHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `ER self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        erHealthy = false;
        return false;
      });

    return erSelfCheckPromise;
  }

  /**
   * Report the ER surface's health, independently of the flowchart surface.
   * @returns {boolean|null} True or false once the ER self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isErHealthy() {
    return erHealthy;
  }

  // ---------------------------------------------------------------------
  // Class diagram surface
  //
  // Parallel to the flowchart and ER surfaces above, for the same reasons:
  // its own memo slot, its own self-check state, its own health flag. None
  // of the three surfaces reads or writes another's state.
  //
  // Field sources are docs/mermaid-class-stage0-measurements-2026-08-02.md.
  // ---------------------------------------------------------------------

  // Single-slot memo for the class surface, matching parse()'s contract.
  let classMemoCode = null;
  let classMemoPromise = null;

  // Class self-check health: null until the check has run, then true or
  // false. Independent of the flowchart and ER flags by design.
  let classHealthy = null;

  // Lazy, memoised, first-parseClass trigger — same reasoning as the other
  // two self-checks: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let classSelfCheckStarted = false;
  let classSelfCheckPromise = null;

  /**
   * The embedded class self-check fixture. Four classes, one member and two
   * relations pin the raw internals the class surface depends on — above
   * all that AGGREGATION is the number 0 and the marker sits at the end
   * where the glyph is drawn (stage 0 C2, C3).
   */
  const CLASS_SELF_CHECK_FIXTURE = [
    "classDiagram",
    "    Animal <|-- Duck",
    "    Animal : +int age",
    "    Car o-- Wheel",
  ].join("\n");

  /**
   * Decode one raw class relation into { kind, markerAt, dashed }.
   *
   * TWO DECODE TRAPS, both measured (stage 0 M2a, C3) — every comparison
   * below is numeric and explicit, never truthiness:
   *   - AGGREGATION is the number 0, which is FALSY, so `if (type1)` drops
   *     every aggregation;
   *   - an absent marker is the STRING "none", which is TRUTHY, so the same
   *     test also fires on ends with no marker at all. Truthiness is wrong
   *     in both directions at once.
   *
   * The marker code sits at the end where the glyph is drawn (C2): in
   * `Animal <|-- Duck` the 1 lands on Animal, the parent. lineType is the
   * only field separating association from dependency and inheritance from
   * realisation (C3) — the codes alone cannot.
   *
   * Unmeasured input — an unknown code, or two DIFFERENT non-"none" codes
   * at the two ends — degrades honestly to a plain link with one WARN,
   * never a throw.
   *
   * @param {Object} relation - The raw relation object ({type1, type2, lineType})
   * @returns {Object} { kind, markerAt, dashed }
   */
  function decodeClassRelation(relation) {
    const type1 = relation.type1;
    const type2 = relation.type2;
    const dashed = relation.lineType === 1;

    const markerAtFrom = type1 !== "none";
    const markerAtTo = type2 !== "none";

    if (markerAtFrom && markerAtTo && type1 !== type2) {
      logWarn(
        `Class relation carries two different marker codes (${type1}, ${type2}); ` +
          "degrading to a plain link"
      );
      return { kind: "link", markerAt: "both", dashed: dashed };
    }

    if (!markerAtFrom && !markerAtTo) {
      return { kind: "link", markerAt: "none", dashed: dashed };
    }

    const markerAt = markerAtFrom && markerAtTo ? "both" : markerAtFrom ? "from" : "to";
    const code = markerAtFrom ? type1 : type2;

    let kind;
    if (code === 1) {
      kind = dashed ? "realisation" : "inheritance";
    } else if (code === 2) {
      kind = "composition";
    } else if (code === 0) {
      kind = "aggregation";
    } else if (code === 3) {
      kind = dashed ? "dependency" : "association";
    } else if (code === 4) {
      kind = "lollipop";
    } else {
      logWarn(
        `Class relation carries an unmeasured marker code (${code}); ` +
          "degrading to a plain link"
      );
      return { kind: "link", markerAt: "both", dashed: dashed };
    }

    return { kind: kind, markerAt: markerAt, dashed: dashed };
  }

  /**
   * Normalise one resolved class Diagram instance into the adapter's class
   * shape.
   *
   * ENDPOINT RESOLUTION — deliberately DIFFERENT from the ER surface: no
   * throw when an endpoint is absent from the classes list. A lollipop
   * relation legitimately synthesises an id (`interface0`) that appears in
   * no class list, and drops the source's class name from getClasses()
   * entirely (stage 0 C3). `from` and `to` therefore stay raw ids and
   * consumers guard their lookups. Do not "fix" this into the ER surface's
   * throwing behaviour — that would reject every lollipop diagram.
   *
   * Members and methods are copied field by field from the ClassMember
   * instances, and NEVER from their `text` field, which carries an escaped
   * visibility prefix and HTML-escaped generics (C5, C6).
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised class graph
   */
  function normaliseClass(diagram) {
    const db = diagram.db;

    // Map iteration order is source first-mention order (C13), whether the
    // first mention is a relation, a member block or a namespace body.
    const classes = [];
    db.getClasses().forEach((cls, name) => {
      classes.push({
        // `name` is the Map key, and relations reference it through their
        // own raw id1/id2, so it stays RAW. Measured: it holds the class
        // IDENTIFIER, never the bracket label, so it cannot carry a
        // placeholder (item 9 § 1). The consumer narrates displayName.
        name: name,
        // Always populated: equals the id when no bracket label given (C8).
        // Item 9, verdict C-FULL: class labels are drawn in an HTML subtree.
        displayName: decodeAuthorText(cls.label),
        // The generic parameter lives in its own field (C6): Shelf~Item~
        // gives type "Item"; "" when the class is not generic.
        // Item 19, verdict C-FULL (8 August 2026) for both.
        genericType: decodeAuthorText(cls.type || ""),
        annotations: (Array.isArray(cls.annotations) ? cls.annotations : []).map(
          (annotation) => decodeAuthorText(annotation)
        ),
        // A namespaced class carries `parent`; others lack the key (C9).
        namespace: typeof cls.parent === "string" ? cls.parent : "",
        members: (cls.members || []).map((member) => ({
          visibility: member.visibility,
          classifier: member.classifier,
          // Item 9, C-FULL. The renderer prefixes the visibility glyph
          // itself, so this field never carries it.
          declaration: decodeAuthorText(member.id),
        })),
        // Item 19, verdict C-FULL (8 August 2026) for all three text fields.
        // The renderer prefixes the visibility glyph and the signature
        // punctuation itself, so none of these carries it.
        methods: (cls.methods || []).map((method) => ({
          visibility: method.visibility,
          classifier: method.classifier,
          name: decodeAuthorText(method.id),
          parameters: decodeAuthorText(method.parameters),
          returnType: decodeAuthorText(method.returnType),
        })),
      });
    });

    // Source order (C13); duplicates between the same pair are preserved
    // as distinct relations (C11).
    const relationships = db.getRelations().map((relation) => {
      const decoded = decodeClassRelation(relation.relation || {});

      // `title` is an ABSENT KEY when the relation has no label — never ""
      // or null (M2c) — so presence is tested with `in`, not truthiness. A
      // quoted label keeps its quote characters (C4); one symmetric
      // surrounding pair is stripped here.
      let label = "";
      if ("title" in relation) {
        label = relation.title;
        if (
          label.length >= 2 &&
          label.charAt(0) === '"' &&
          label.charAt(label.length - 1) === '"'
        ) {
          label = label.slice(1, -1);
        }
      }

      return {
        from: relation.id1,
        to: relation.id2,
        kind: decoded.kind,
        markerAt: decoded.markerAt,
        // Carried on every relationship for honesty, even where the kind
        // (realisation, dependency) already implies it.
        dashed: decoded.dashed,
        // Item 19 (8 August 2026), verdict C-FULL. C-PH and C-FULL are
        // PROVABLY IDENTICAL on this field: the two differ only on an intact
        // author-typed `&...;`, and the relation-label lexer rejects one
        // outright — measured on both the bare and the quoted form. C-FULL is
        // chosen for consistency with every other class field, not because the
        // measurement separated them.
        label: decodeAuthorText(label),
        // An absent multiplicity is the string "none" (C4). Item 19, C-FULL.
        // These two are also the lookup keys into the consumer's
        // MULTIPLICITY_PHRASES table, and the join cannot break: the transform
        // changes only a string carrying a #...; token or the delimiter bytes,
        // and no key in that table contains either.
        multiplicityFrom: decodeAuthorText(
          relation.relationTitle1 === "none" ? "" : relation.relationTitle1
        ),
        multiplicityTo: decodeAuthorText(
          relation.relationTitle2 === "none" ? "" : relation.relationTitle2
        ),
      };
    });

    const namespaces = [];
    db.getNamespaces().forEach((namespace, name) => {
      namespaces.push({
        name: name,
        classNames: [...namespace.classes.keys()],
      });
    });

    // A note's attachment may name a class that does not exist (C10); it
    // is passed through and the consumer guards the lookup.
    // Item 19, verdict C-FULL (8 August 2026) for `text`. `attachedTo` stays
    // RAW: it is a join key the consumer looks up in a Map built on the raw
    // classes[].name.
    const notes = db.getNotes().map((note) => ({
      text: decodeAuthorText(note.text),
      attachedTo: typeof note.class === "string" ? note.class : "",
    }));

    return {
      type: "class",
      direction: db.getDirection(),
      title: db.getDiagramTitle() || "",
      accTitle: db.getAccTitle() || "",
      accDescr: db.getAccDescription() || "",
      classes: classes,
      relationships: relationships,
      namespaces: namespaces,
      notes: notes,
    };
  }

  /**
   * Parse Mermaid class diagram code into the normalised class shape.
   *
   * Rejects with Mermaid's own Error on a parse failure — the call itself
   * never throws synchronously (stage 0 C14), so awaiting this promise is
   * the single error path.
   *
   * SERIALISED PARSES (register item 21): the parse AND normaliseClass's
   * read of it run in one slot of the adapter-wide queue, so no other
   * adapter parse can clear Mermaid's shared accessible-title store between
   * them. Before that queue existed, this surface's own self-check parse
   * was the racer, and the first parseClass of every page delivered
   * accTitle "".
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised class graph
   */
  function parseClass(code) {
    // Lazy class self-check trigger, matching the other surfaces' ordering.
    if (!classSelfCheckStarted) {
      runClassSelfCheck();
    }

    if (code === classMemoCode && classMemoPromise) {
      logDebug("Returning memoised class parse for identical code string");
      return classMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for
    // why it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`Class parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Class parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const graph = normaliseClass(diagram);
          logDebug(
            `Class parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return graph;
        })
        .catch((error) => {
          logDebug(
            `Class parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    classMemoCode = code;
    classMemoPromise = result;
    return result;
  }

  /**
   * Parse the embedded class fixture and assert the db accessor names and
   * field shapes the class surface depends on. Resolves true on a clean
   * pass. On any failure it logs one ERROR naming the failed assertion,
   * marks the class surface unhealthy, and resolves false. Never throws,
   * never rejects, and never reads or writes the flowchart or ER flags.
   *
   * Like the ER check and unlike the flowchart one, this resolves the
   * Diagram itself rather than going through parseClass(): its assertions
   * are deliberately about the RAW db internals the normalised shape exists
   * to hide — above all that AGGREGATION is the number 0 and that the
   * marker code sits at the end where the glyph is drawn. A Mermaid upgrade
   * that changes either fails here instead of silently mislabelling every
   * relation downstream.
   *
   * @returns {Promise<boolean>} Resolves to the class health verdict
   */
  function runClassSelfCheck() {
    if (classSelfCheckPromise) {
      return classSelfCheckPromise;
    }
    classSelfCheckStarted = true;

    // The fixture parse goes through the ADAPTER-WIDE QUEUE, and every raw
    // db read happens INSIDE the queued run: `run` resolves to the completed
    // assertion list, never to a diagram for a later .then to read. That is
    // the queue's invariant made structural — see its declaration.
    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            CLASS_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;

          const classes = db.getClasses();
          const isMap = classes instanceof Map;
          const classNames = isMap ? [...classes.keys()] : [];
          const animal = isMap ? classes.get("Animal") : undefined;
          const member =
            animal && Array.isArray(animal.members)
              ? animal.members[0]
              : undefined;

          const relations = db.getRelations();
          const first = Array.isArray(relations) ? relations[0] : undefined;
          const second = Array.isArray(relations) ? relations[1] : undefined;

          // Each entry: [assertion name, predicate]. The first false predicate
          // fails the check and is named in the single ERROR line. The
          // predicates are EVALUATED HERE, inside the slot, so the verdict
          // below never touches the db.
          return [
            [
              "classes container is a Map of size 4 in order Animal, Duck, Car, Wheel",
              isMap && classNames.join(",") === "Animal,Duck,Car,Wheel",
            ],
            [
              "Animal's first member carries the four measured fields",
              member &&
                member.memberType === "attribute" &&
                member.visibility === "+" &&
                member.classifier === "" &&
                member.id === "int age",
            ],
            [
              "inheritance relation raw shape (marker 1 at Animal's end, lineType 0)",
              first &&
                first.id1 === "Animal" &&
                first.id2 === "Duck" &&
                first.relation &&
                first.relation.type1 === 1 &&
                first.relation.type2 === "none" &&
                first.relation.lineType === 0,
            ],
            [
              "AGGREGATION is 0 at the glyph end (Car o-- Wheel)",
              second &&
                second.id1 === "Car" &&
                second.relation &&
                second.relation.type1 === 0,
            ],
            [
              "title is not an own key of an unlabelled relation",
              first &&
                second &&
                !Object.prototype.hasOwnProperty.call(first, "title") &&
                !Object.prototype.hasOwnProperty.call(second, "title"),
            ],
            [
              "getDirection, getAccTitle, getAccDescription and getDiagramTitle return strings",
              typeof db.getDirection() === "string" &&
                typeof db.getAccTitle() === "string" &&
                typeof db.getAccDescription() === "string" &&
                typeof db.getDiagramTitle() === "string",
            ],
          ];
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    classSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Class self-check FAILED at assertion: ${failed[0]}. ` +
              "The pinned Mermaid build's class parse internals no longer " +
              "match the stage 0 measurements; do not trust class adapter output."
          );
          classHealthy = false;
          return false;
        }

        logInfo(
          "Class self-check passed: all accessor and field-shape assertions hold"
        );
        classHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `Class self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        classHealthy = false;
        return false;
      });

    return classSelfCheckPromise;
  }

  /**
   * Report the class surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the class self-check has
   *   run; null when it has not yet run (or not yet settled)
   */
  function isClassHealthy() {
    return classHealthy;
  }

  // ---------------------------------------------------------------------
  // Git graph surface
  //
  // Parallel to the three surfaces above — own memo slot, own self-check
  // state, own health flag — but structurally DIFFERENT in one measured
  // respect: the git graph db is a module-level SINGLETON, not a fresh
  // instance per parse. Measured in
  // docs/mermaid-gitgraph-stage0-measurements-2026-08-03.md § M2e: two
  // sequential getDiagramFromText calls return the SAME db object, and the
  // second parse destroys the first diagram's data in place. Two defences
  // follow, both mandatory:
  //
  //   1. EAGER SNAPSHOT — normaliseGit copies every value it reads into
  //      fresh plain objects and arrays inside the parse's own .then, so
  //      nothing in a resolved graph references a db-owned object. This
  //      defence lives here, on the surface, and is unaffected by item 21.
  //   2. SERIALISED PARSES — parseGit calls are chained through a promise
  //      queue, so a second call with different code cannot begin parsing
  //      (and therefore mutating the singleton) until the previous call's
  //      snapshot is complete. The self-check's fixture parse goes through
  //      the same queue for the same reason. Since item 21 that queue is
  //      the ADAPTER-WIDE `adapterParseQueue` rather than a git-local one,
  //      and the rationale for it — including this defence, restated in
  //      full — sits at its declaration near the top of this file. Nothing
  //      about the defence weakened in the move: widening the queue can
  //      only serialise MORE parses against a git parse, never fewer.
  //
  // Field sources are docs/mermaid-gitgraph-stage0-measurements-2026-08-03.md.
  // ---------------------------------------------------------------------

  // Single-slot memo for the git graph surface, matching parse()'s
  // contract: the promise is cached rather than the resolved value. The
  // memo sits IN FRONT of the parse queue — an identical-code call returns
  // the cached promise without enqueueing a second singleton mutation.
  let gitMemoCode = null;
  let gitMemoPromise = null;

  // Git self-check health: null until the check has run, then true or
  // false. Independent of the other three flags by design.
  let gitHealthy = null;

  // Lazy, memoised, first-parseGit trigger — same reasoning as the other
  // three self-checks: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let gitSelfCheckStarted = false;
  let gitSelfCheckPromise = null;

  /**
   * The embedded git graph self-check fixture. Three named commits, two
   * branches and one merge pin the raw internals the surface depends on —
   * above all the merge parent order (stage 0 G5), so a Mermaid upgrade
   * that reorders merge parents fails loudly instead of silently swapping
   * every "merged X into Y" sentence. `branch` auto-checks-out the new
   * branch (G4), so B and C land on dev and topic with no checkout
   * statements.
   *
   * THE FIXTURE DELIBERATELY NEVER NAMES THE DEFAULT BRANCH. Measured
   * 3 August 2026 (stage 2): rendering a git graph whose init directive
   * sets gitGraph.mainBranchName leaks that name into the config used by
   * subsequent getDiagramFromText parses (until the next render resets
   * it). A fixture saying `checkout main` REJECTED outright under that
   * leak — there is no branch called main in a renamed session — which
   * latched gitHealthy false for the whole page. So the merge is pinned
   * between two explicitly created branches (checkout dev is safe: dev is
   * created by this fixture), and the default branch appears only through
   * commit A's branch field, asserted against the db's own configured
   * name, never the literal "main".
   */
  const GIT_SELF_CHECK_FIXTURE = [
    "gitGraph",
    '    commit id: "A"',
    "    branch dev",
    '    commit id: "B"',
    "    branch topic",
    '    commit id: "C"',
    "    checkout dev",
    "    merge topic",
  ].join("\n");

  // Auto-generated commit ids have the measured shape `<seq>-<7 hex>`
  // (stage 0 G1) — see the hasCustomId rule in normaliseGit.
  const GIT_AUTO_ID_PATTERN = /^(\d+)-[0-9a-f]{7}$/;

  /**
   * Decode one numeric git commit type code into a kind string.
   *
   * THE FALSY-ZERO TRAP, third enum running on this project (stage 0 M2a):
   * NORMAL is the number 0, so any truthiness test reads every normal
   * commit as typeless. Every comparison below is numeric and explicit.
   *
   * An unmeasured code degrades to "unknown" with one WARN, never a throw.
   *
   * @param {number} code - The raw commitType code
   * @returns {string} "normal" | "reverse" | "highlight" | "merge" |
   *   "cherryPick" | "unknown"
   */
  function decodeGitCommitKind(code) {
    if (code === 0) return "normal";
    if (code === 1) return "reverse";
    if (code === 2) return "highlight";
    if (code === 3) return "merge";
    if (code === 4) return "cherryPick";
    logWarn(
      `Git commit carries an unmeasured type code (${code}); ` +
        'recording kind "unknown"'
    );
    return "unknown";
  }

  /**
   * Normalise one resolved git graph Diagram instance into the adapter's
   * git shape.
   *
   * EAGER SNAPSHOT (singleton defence 1, stage 0 M2e): the git graph db is
   * a shared singleton and the next git graph parse anywhere in the page
   * destroys its contents in place, so every value read here is copied
   * into fresh plain objects and arrays before this function returns.
   * Nothing in the returned graph references a db-owned object, and no
   * consumer may ever go back to the db later.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised git graph
   */
  function normaliseGit(diagram) {
    const db = diagram.db;

    // Seq order (G11): creation order regardless of branch.
    const rawCommits = db.getCommitsArray();

    // Snapshot-local id lookup for mergedFromBranch resolution — resolved
    // within this parse's own data, never against the db afterwards.
    const idToCommit = new Map();
    rawCommits.forEach((commit) => {
      idToCommit.set(commit.id, commit);
    });

    const commits = rawCommits.map((commit) => {
      const kind = decodeGitCommitKind(commit.type);
      const parents = Array.isArray(commit.parents) ? [...commit.parents] : [];

      // hasCustomId: for merge commits the db's own customId flag is
      // authoritative (M2c — the flag exists only on merges). For every
      // other commit this is a measured-shape heuristic (G1): an id is
      // auto-generated exactly when it matches `<seq>-<7 hex>` AND the
      // number equals the commit's own seq; hasCustomId is the negation.
      let hasCustomId;
      if (kind === "merge") {
        hasCustomId = commit.customId === true;
      } else {
        const autoMatch = GIT_AUTO_ID_PATTERN.exec(commit.id);
        const isAutoGenerated =
          autoMatch !== null && Number(autoMatch[1]) === commit.seq;
        hasCustomId = !isAutoGenerated;
      }

      // overrideKind: merges only — a `type:` option on a merge lands in
      // customType (numeric) while type stays 3 (G5). An unmodified merge
      // carries customType as an own key holding undefined (M2c), so the
      // check is an explicit typeof, never truthiness.
      const overrideKind =
        kind === "merge" && typeof commit.customType === "number"
          ? decodeGitCommitKind(commit.customType)
          : "";

      // Author tags only: the machine-generated cherry-pick markers
      // ("cherry-pick:S1", "cherry-pick:MG|parent:M2") are filtered out
      // (G6); the source reference survives structurally in parents[1].
      const tags = (Array.isArray(commit.tags) ? commit.tags : []).filter(
        (tag) => !/^cherry-pick:/.test(tag)
      );

      // mergedFromBranch: merges only — the branch of the commit whose id
      // is parents[1] (the merged-from head, G5), resolved within this
      // snapshot. Fails closed to "" when parents[1] is missing, self, or
      // unresolvable — including the self-parenting commit the
      // duplicate-id garbage produces (G10d), which is copied raw into
      // parents and never "repaired".
      let mergedFromBranch = "";
      if (kind === "merge" && parents.length > 1) {
        const source = idToCommit.get(parents[1]);
        if (source && source.id !== commit.id) {
          mergedFromBranch = source.branch;
        }
      }

      // cherryPickSourceId: cherry-picks only — parents[1] is the source
      // commit (G6); "" on any other commit or when absent.
      const cherryPickSourceId =
        kind === "cherryPick" && typeof parents[1] === "string"
          ? parents[1]
          : "";

      // Item 9, verdict C-PH for this surface: git graph draws into SVG
      // <text> (0 foreignObjects measured), so an author-typed entity is
      // drawn literally and must NOT be resolved — only the placeholders.
      //
      // EVERY commit-id-shaped and branch-name-shaped value is decoded
      // together, so the normalised shape's own cross-references keep
      // matching: consumers key commits by `id` and look `cherryPickSourceId`
      // up in that index, and compare `branch` against `branches[].name`.
      // All internal resolution above ran on the RAW values first —
      // `hasCustomId` in particular is computed from the raw id — so the
      // decode changes what is DELIVERED and never what was resolved.
      //
      // Item 19 (8 August 2026) adds `message` and `tags[]`, both C-PH.
      // `tags[]` was measured: it is drawn into SVG <text> like every other
      // git label, and C-PH is the only candidate matching all nine rows.
      // `message` is the one field in the corpus that Mermaid NEVER DRAWS —
      // gitGraph paints the branch label and the commit id and nothing else —
      // so there is no canvas to match and the render table could not decide
      // it. It is adopted C-PH on AUTHOR INTENT: someone who typed `#quot;`
      // meant a quote, and with no drawing to contradict them the surface's
      // own convention is what the reader should hear. It is also narrated in
      // the SAME SENTENCE as the id (refFor), which is the visible defect this
      // closes. The cherry-pick filter above runs on the RAW tags, so the
      // decode changes what is delivered and never what was filtered.
      return {
        id: decodePlaceholders(commit.id),
        hasCustomId: hasCustomId,
        message: decodePlaceholders(commit.message),
        seq: commit.seq,
        kind: kind,
        overrideKind: overrideKind,
        tags: tags.map((tag) => decodePlaceholders(tag)),
        parents: parents.map((parent) => decodePlaceholders(parent)),
        branch: decodePlaceholders(commit.branch),
        mergedFromBranch: decodePlaceholders(mergedFromBranch),
        cherryPickSourceId: decodePlaceholders(cherryPickSourceId),
      };
    });

    // Branches in DISPLAY order: getBranchesAsObjArray honours `order:`
    // options (G4) and supplies the sequence; each head comes from the
    // getBranches Map. headId is null for a branch with no head — an
    // empty graph's main maps to null (G8).
    const headByName = db.getBranches();
    const branches = db.getBranchesAsObjArray().map((branch) => {
      // The lookup uses the RAW name; only the delivered values decode.
      const headId = headByName.get(branch.name);
      return {
        name: decodePlaceholders(branch.name),
        headId:
          headId === undefined || headId === null
            ? null
            : decodePlaceholders(headId),
      };
    });

    return {
      type: "gitGraph",
      // "LR" default; LR, TB and BT all live (G9) — no synonym collapsing.
      direction: db.getDirection(),
      // Populated by a body `title` statement — the first measured type
      // where this accessor ever carries data (G10a). Item 9, C-PH.
      title: decodePlaceholders(db.getDiagramTitle() || ""),
      accTitle: db.getAccTitle() || "",
      accDescr: db.getAccDescription() || "",
      currentBranch: decodePlaceholders(db.getCurrentBranch()),
      branches: branches,
      commits: commits,
    };
  }

  /**
   * Parse Mermaid git graph code into the normalised git shape.
   *
   * Rejects with Mermaid's own error on a parse failure — a
   * MermaidParseError with NO `hash` property on this type (stage 0 G12;
   * git graph is on the new parser, unlike flowchart, ER and class). The
   * call itself never throws synchronously, so awaiting this promise is
   * the single error path.
   *
   * SERIALISED PARSES (singleton defence 2, stage 0 M2e; adapter-wide since
   * register item 21): every parse is chained through the queue so it cannot
   * mutate the shared singleton db while an earlier call's snapshot is still
   * in progress — and, since the queue now spans all five surfaces, nor can
   * a parse of any OTHER type clear Mermaid's shared accessible-title store
   * between this parse and normaliseGit's read of `title`. The chain
   * advances on settlement, not success, so a rejection cannot wedge it.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised git graph
   */
  function parseGit(code) {
    // Lazy git self-check trigger, matching the other surfaces' ordering.
    // The check enqueues its own fixture parse first, so it holds the
    // front of the queue ahead of this call's parse.
    if (!gitSelfCheckStarted) {
      runGitSelfCheck();
    }

    if (code === gitMemoCode && gitMemoPromise) {
      logDebug("Returning memoised git parse for identical code string");
      return gitMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for
    // why it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`Git parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Git parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const graph = normaliseGit(diagram);
          logDebug(
            `Git parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return graph;
        })
        .catch((error) => {
          logDebug(
            `Git parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    gitMemoCode = code;
    gitMemoPromise = result;
    return result;
  }

  /**
   * Parse the embedded git fixture and assert the db accessor names and
   * field shapes the git surface depends on. Resolves true on a clean
   * pass. On any failure it logs one ERROR naming the failed assertion,
   * marks the git surface unhealthy, and resolves false. Never throws,
   * never rejects, and never reads or writes the other three health flags.
   *
   * Like the ER and class checks, this resolves the Diagram itself rather
   * than going through parseGit(): its assertions are deliberately about
   * the RAW db internals the normalised shape exists to hide — above all
   * the merge parent order (parents[0] = target head, parents[1] =
   * merged-from head, stage 0 G5) and the numeric commitType enum with
   * NORMAL at 0 (M2a). A Mermaid upgrade that changes either fails here
   * instead of silently corrupting every merge sentence downstream.
   *
   * The fixture parse goes through the parse QUEUE (singleton defence 2):
   * a direct unqueued getDiagramFromText call could mutate the singleton
   * db mid-snapshot of a queued consumer parse. All raw reads happen
   * synchronously inside the parse's own .then, before the queue advances.
   *
   * @returns {Promise<boolean>} Resolves to the git health verdict
   */
  function runGitSelfCheck() {
    if (gitSelfCheckPromise) {
      return gitSelfCheckPromise;
    }
    gitSelfCheckStarted = true;

    // Every raw db read happens INSIDE the queued run, so `run` resolves to
    // the completed assertion list rather than to a diagram for a later
    // .then to read. Until item 21 those reads sat in a .then attached to
    // `queued` from outside the run, which held only by microtask
    // attachment order; the invariant is now structural — see the queue
    // declaration.
    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            GIT_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;

          // All raw reads are synchronous within the slot — the queue cannot
          // advance until they are done (singleton defence, M2e).
          const commitType = db.commitType;
          const commits = db.getCommits();
          const isMap = commits instanceof Map;
          const ids = isMap ? [...commits.keys()] : [];
          const values = isMap ? [...commits.values()] : [];
          const commitA = isMap ? commits.get("A") : undefined;
          const commitB = isMap ? commits.get("B") : undefined;
          const commitC = isMap ? commits.get("C") : undefined;
          const mergeCommit = values[3];
          const branchHeads = db.getBranches();
          const branchesIsMap = branchHeads instanceof Map;

          // The default branch's name is read from the db's own config, never
          // hard-coded as "main" — see the fixture comment above for the
          // measured directive leak that makes the literal wrong.
          const mainName =
            typeof db.getConfig === "function" &&
            db.getConfig() &&
            typeof db.getConfig().mainBranchName === "string"
              ? db.getConfig().mainBranchName
              : "main";

          // Each entry: [assertion name, predicate]. The first false predicate
          // fails the check and is named in the single ERROR line. The
          // predicates are EVALUATED HERE, inside the slot, so the verdict
          // below never touches the db.
          return [
            [
              "commitType enum is numeric with NORMAL 0, MERGE 3, CHERRY_PICK 4",
              commitType &&
                commitType.NORMAL === 0 &&
                commitType.MERGE === 3 &&
                commitType.CHERRY_PICK === 4,
            ],
            [
              "commits container is a Map of size 4 in order A, B, C, merge",
              isMap &&
                commits.size === 4 &&
                ids[0] === "A" &&
                ids[1] === "B" &&
                ids[2] === "C" &&
                mergeCommit !== undefined &&
                ids[3] === mergeCommit.id,
            ],
            [
              "commit A: type 0, empty parents array, on the configured default branch",
              commitA &&
                commitA.type === 0 &&
                Array.isArray(commitA.parents) &&
                commitA.parents.length === 0 &&
                commitA.branch === mainName,
            ],
            [
              "commit B on branch dev and commit C on branch topic",
              commitB &&
                commitB.branch === "dev" &&
                commitC &&
                commitC.branch === "topic",
            ],
            [
              "merge parent order: type 3 on dev with parents [B, C] " +
                "(parents[0] = target head, parents[1] = merged-from head)",
              mergeCommit &&
                mergeCommit.type === 3 &&
                mergeCommit.branch === "dev" &&
                Array.isArray(mergeCommit.parents) &&
                mergeCommit.parents[0] === "B" &&
                mergeCommit.parents[1] === "C",
            ],
            [
              "getBranches maps the default branch to A, dev to the merge commit, topic to C",
              branchesIsMap &&
                mergeCommit &&
                branchHeads.get(mainName) === "A" &&
                branchHeads.get("dev") === mergeCommit.id &&
                branchHeads.get("topic") === "C",
            ],
            [
              "getDirection, getAccTitle, getAccDescription and getDiagramTitle return strings",
              typeof db.getDirection() === "string" &&
                typeof db.getAccTitle() === "string" &&
                typeof db.getAccDescription() === "string" &&
                typeof db.getDiagramTitle() === "string",
            ],
          ];
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    gitSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Git self-check FAILED at assertion: ${failed[0]}. ` +
              "The pinned Mermaid build's git graph parse internals no " +
              "longer match the stage 0 measurements; do not trust git " +
              "adapter output."
          );
          gitHealthy = false;
          return false;
        }

        logInfo(
          "Git self-check passed: all accessor and field-shape assertions hold"
        );
        gitHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `Git self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        gitHealthy = false;
        return false;
      });

    return gitSelfCheckPromise;
  }

  /**
   * Report the git surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the git self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isGitHealthy() {
    return gitHealthy;
  }

  // ---------------------------------------------------------------------
  // Sankey surface
  //
  // Parallel to the four surfaces above — own memo slot, own self-check
  // state, own health flag — and, like the git graph surface, built over a
  // SHARED SINGLETON db rather than a fresh instance per parse. Measured in
  // docs/mermaid-sankey-stage0-measurements-2026-08-03.md § S2e: two
  // sequential getDiagramFromText calls return the SAME db object
  // (dA.db === dB.db) and the second parse's data replaces the first's.
  // The same two defences follow, both mandatory:
  //
  //   1. EAGER SNAPSHOT — normaliseSankey reads db.getGraph() ONCE inside
  //      the parse's own .then and maps it into the adapter's own shape
  //      there. getGraph() projects the db's CURRENT arrays, so a call made
  //      after a later parse has begun would project the wrong diagram.
  //      This defence lives here, on the surface, and is unaffected by
  //      item 21.
  //   2. SERIALISED PARSES — parseSankey calls are chained through a
  //      promise queue, so a second call with different code cannot begin
  //      parsing (and therefore replacing the singleton's data) until the
  //      previous call's snapshot is complete. The self-check's fixture
  //      parse goes through the same queue for the same reason. Since
  //      item 21 that queue is the ADAPTER-WIDE `adapterParseQueue` rather
  //      than a sankey-local one, and the rationale for it — including this
  //      defence and the S2e reassignment note below, both restated in
  //      full — sits at its declaration near the top of this file.
  //
  // One measured difference from git graph, recorded so a future editor
  // does not weaken the defences on the strength of it: a sankey parse
  // REASSIGNS the db's internal arrays rather than mutating them in place
  // (S2e), so a snapshot taken at the right moment is durable. That is why
  // defence 1 is about WHEN getGraph() is called, not about deep-copying
  // what it returns — the projection is already a fresh plain object built
  // per call. The queue is what guarantees the "right moment".
  //
  // THREE THINGS THIS SURFACE DELIBERATELY NEVER TOUCHES:
  //   - db.getNodes() / db.getLinks() — the LIVE SankeyNode / SankeyLink
  //     instances, whose node key is an uppercase ID and whose link
  //     endpoints are object references (S2c). Reading `.id` off one of
  //     those returns undefined SILENTLY, which is stage 0's central trap;
  //     the self-check pins both key cases so an upgrade fails loudly.
  //   - db.nodesMap — vestigial. It reads Map(0) after every parse even as
  //     nodes are created, so the dedup index is a closure variable and
  //     this is not it (S2a).
  //   - every mutator, above all db.addLink(). Called with no arguments it
  //     returns undefined WITHOUT THROWING and poisons the db, so the
  //     failure arrives later, on an innocent-looking getGraph() call
  //     (S2b). This surface calls getters only.
  //
  // Field sources are docs/mermaid-sankey-stage0-measurements-2026-08-03.md.
  // ---------------------------------------------------------------------

  // Single-slot memo for the sankey surface, matching parse()'s contract:
  // the promise is cached rather than the resolved value. The memo sits IN
  // FRONT of the parse queue — an identical-code call returns the cached
  // promise without enqueueing a second singleton replacement.
  let sankeyMemoCode = null;
  let sankeyMemoPromise = null;

  // Sankey self-check health: null until the check has run, then true or
  // false. Independent of the other four flags by design.
  let sankeyHealthy = null;

  // Lazy, memoised, first-parseSankey trigger — same reasoning as the other
  // four self-checks: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let sankeySelfCheckStarted = false;
  let sankeySelfCheckPromise = null;

  /**
   * The embedded sankey self-check fixture. Two links and three nodes are
   * enough to pin everything this surface depends on: the projection's
   * lowercase `id` keys and STRING link endpoints, first-mention node order
   * (stage 0 K8), and a decimal value passing through as a number (K3).
   *
   * The fixture uses ASCII names only — not a stylistic choice. Every
   * character at or above U+0080 REJECTS the whole parse on this type
   * (K2), so an accented or curly-quoted fixture name would latch
   * sankeyHealthy false for the whole page session.
   */
  const SANKEY_SELF_CHECK_FIXTURE = [
    "sankey-beta",
    "    A,B,10",
    "    B,C,2.5",
  ].join("\n");

  /**
   * Normalise one resolved sankey Diagram instance into the adapter's
   * sankey shape.
   *
   * EAGER SNAPSHOT (singleton defence 1, stage 0 S2e): the sankey db is a
   * shared singleton whose data the next sankey parse replaces, so
   * getGraph() is read ONCE here — inside the parse's own .then, behind the
   * queue — and mapped into the adapter's own objects immediately. Nothing
   * in the returned graph references a db-owned object, and no consumer may
   * ever go back to the db later.
   *
   * The db's two graph shapes are NOT interchangeable (S2c): getGraph()
   * gives a freshly built plain projection with lowercase `id` and string
   * endpoints, while getNodes()/getLinks() give live SankeyNode/SankeyLink
   * instances keyed uppercase `ID` with object-reference endpoints. This
   * surface reads the projection only.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised sankey graph
   */
  function normaliseSankey(diagram) {
    const db = diagram.db;

    // The single read. Everything below maps this one projection.
    const graph = db.getGraph();
    const rawNodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
    const rawLinks = graph && Array.isArray(graph.links) ? graph.links : [];

    // Projection order is first-mention, scanning source before target on
    // each row (K8) — deterministic within and across parses, so narration
    // may quote "the first flow" from it.
    // ITEM 9, VERDICT C-NONE — this surface applies NO decode, and that is
    // a measured result rather than an omission. encodeEntities runs before
    // the parser, so any `#word;` in sankey source reaches the grammar as
    // private delimiter bytes at or above U+0080, which this type rejects
    // outright (stage 0 K2). Every placeholder-bearing probe REJECTS here,
    // in both the bare and the quoted name form, so a sankey graph can
    // never carry a placeholder to decode. The two probes that do parse
    // (an apostrophe, and an author-typed `&quot;` which the canvas draws
    // literally) are identity under every candidate transform.
    // See docs/mermaid-quot-adoption-2026-08-08.md § 1.
    const nodes = rawNodes.map((node) => ({
      // A node name may legitimately be the EMPTY STRING: a name that
      // sanitises away (for example a leading "<") yields an id of ""
      // (K10a). It is passed through rather than dropped or substituted —
      // the narration module owns the fallback phrase.
      name: typeof node.id === "string" ? node.id : "",
    }));

    const links = rawLinks.map((link) => ({
      from: link.source,
      to: link.target,
      // VALUE IS COPIED RAW, and no truthiness test or filtering happens
      // anywhere on this surface. Measured in K3: value is ALWAYS
      // typeof "number", but 0 is a legal link value and is falsy, while
      // "abc" parses silently to NaN and "Infinity" to a real Infinity.
      // A filter on truthiness would drop every zero-value flow; a filter
      // on finiteness would hide the bad rows the narration layer has to
      // report. Guarding with Number.isFinite is the narration module's
      // job, not the adapter's.
      value: link.value,
    }));

    // NO title, accTitle or accDescr fields. Measured in K9: sankey has no
    // accTitle/accDescr syntax at all — every placement rejects the whole
    // parse — and a YAML frontmatter title does not arrive either, so
    // getDiagramTitle(), getAccTitle() and getAccDescription() are
    // permanently "" on this type. Dead fields would invite a consumer to
    // branch on data that can never exist; do not "complete" the shape by
    // adding them.
    //
    // NO config field either. getConfig() carries the only unit
    // information that exists (prefix/suffix/showValues), and it is
    // corrupted on exactly the path the engine uses: a render's sankey
    // config leaks into every subsequent getDiagramFromText parse until the
    // next render of any diagram type (S2f). This surface deliberately does
    // not expose it.
    return {
      type: "sankey",
      nodes: nodes,
      links: links,
    };
  }

  /**
   * Parse Mermaid sankey code into the normalised sankey shape.
   *
   * Rejects with Mermaid's own error on a parse failure — a plain Error
   * carrying the full five-key jison `hash` (text, token, line, loc,
   * expected) on this type (stage 0 K11; sankey sits with flowchart, ER and
   * class, not with git graph's hashless MermaidParseError). The call
   * itself never throws synchronously, so awaiting this promise is the
   * single error path.
   *
   * SERIALISED PARSES (singleton defence 2, stage 0 S2e; adapter-wide since
   * register item 21): every parse is chained through the queue so it cannot
   * replace the shared singleton's data while an earlier call's snapshot is
   * still in progress. Sankey carries none of the accessible-title fields
   * itself, but its parse CLEARS that shared store like any other, so it
   * queues for the other four surfaces' sake as well as its own. The chain
   * advances on settlement, not success, so a rejection cannot wedge it.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised sankey graph
   */
  function parseSankey(code) {
    // Lazy sankey self-check trigger, matching the other surfaces'
    // ordering. The check enqueues its own fixture parse first, so it holds
    // the front of the queue ahead of this call's parse.
    if (!sankeySelfCheckStarted) {
      runSankeySelfCheck();
    }

    if (code === sankeyMemoCode && sankeyMemoPromise) {
      logDebug("Returning memoised sankey parse for identical code string");
      return sankeyMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for
    // why it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`Sankey parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Sankey parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const graph = normaliseSankey(diagram);
          logDebug(
            `Sankey parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return graph;
        })
        .catch((error) => {
          logDebug(
            `Sankey parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    sankeyMemoCode = code;
    sankeyMemoPromise = result;
    return result;
  }

  /**
   * Parse the embedded sankey fixture and assert the db accessor names and
   * field shapes the sankey surface depends on. Resolves true on a clean
   * pass. On any failure it logs one ERROR naming the failed assertion,
   * marks the sankey surface unhealthy, and resolves false. Never throws,
   * never rejects, and never reads or writes the other four health flags.
   *
   * Like the ER, class and git checks, this resolves the Diagram itself
   * rather than going through parseSankey(): its assertions are
   * deliberately about the RAW db internals the normalised shape exists to
   * hide — above all THE TWO-SHAPES TRAP (stage 0 S2c), pinned here at
   * source so a Mermaid upgrade that renames or unifies the key cases fails
   * loudly instead of letting a future editor's `.id` read off the live
   * objects return undefined silently.
   *
   * The fixture parse goes through the parse QUEUE (singleton defence 2):
   * a direct unqueued getDiagramFromText call could replace the singleton
   * db's data mid-snapshot of a queued consumer parse. All raw reads happen
   * synchronously inside the parse's own .then, before the queue advances.
   *
   * @returns {Promise<boolean>} Resolves to the sankey health verdict
   */
  function runSankeySelfCheck() {
    if (sankeySelfCheckPromise) {
      return sankeySelfCheckPromise;
    }
    sankeySelfCheckStarted = true;

    // Every raw db read happens INSIDE the queued run, so `run` resolves to
    // the completed assertion list rather than to a diagram for a later
    // .then to read. Until item 21 those reads sat in a .then attached to
    // `queued` from outside the run, which held only by microtask
    // attachment order; the invariant is now structural — see the queue
    // declaration.
    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            SANKEY_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;

          // All raw reads are synchronous within the slot — the queue cannot
          // advance until they are done (singleton defence, S2e).
          const graph = db.getGraph();
          const graphNodes =
            graph && Array.isArray(graph.nodes) ? graph.nodes : [];
          const graphLinks =
            graph && Array.isArray(graph.links) ? graph.links : [];

          // The live objects, read ONLY to pin the two-shapes trap below.
          // Nothing else on this surface ever calls getNodes() (S2c).
          const liveNodes = db.getNodes();
          const liveFirst = Array.isArray(liveNodes) ? liveNodes[0] : undefined;

          // Each entry: [assertion name, predicate]. The first false predicate
          // fails the check and is named in the single ERROR line. The
          // predicates are EVALUATED HERE, inside the slot, so the verdict
          // below never touches the db.
          return [
            [
              "getGraph returns a plain object whose nodes are " +
                '[{id "A"}, {id "B"}, {id "C"}] in first-mention order with ' +
                "lowercase id keys",
              graph &&
                typeof graph === "object" &&
                graphNodes.length === 3 &&
                graphNodes[0].id === "A" &&
                graphNodes[1].id === "B" &&
                graphNodes[2].id === "C",
            ],
            [
              "getGraph links are [{A,B,10}, {B,C,2.5}] in source order with " +
                "STRING source/target and numeric values",
              graphLinks.length === 2 &&
                typeof graphLinks[0].source === "string" &&
                typeof graphLinks[0].target === "string" &&
                graphLinks[0].source === "A" &&
                graphLinks[0].target === "B" &&
                typeof graphLinks[0].value === "number" &&
                graphLinks[0].value === 10 &&
                typeof graphLinks[1].source === "string" &&
                typeof graphLinks[1].target === "string" &&
                graphLinks[1].source === "B" &&
                graphLinks[1].target === "C" &&
                typeof graphLinks[1].value === "number" &&
                graphLinks[1].value === 2.5,
            ],
            [
              "THE TWO-SHAPES PIN: the live getNodes() objects are keyed " +
                'uppercase ID ("A") and have NO lowercase id property',
              liveFirst !== undefined &&
                liveFirst !== null &&
                liveFirst.ID === "A" &&
                liveFirst.id === undefined,
            ],
            [
              "getAccTitle, getAccDescription and getDiagramTitle all return " +
                '"" (sankey has no syntax that populates them)',
              db.getAccTitle() === "" &&
                db.getAccDescription() === "" &&
                db.getDiagramTitle() === "",
            ],
          ];
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    sankeySelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Sankey self-check FAILED at assertion: ${failed[0]}. ` +
              "The pinned Mermaid build's sankey parse internals no longer " +
              "match the stage 0 measurements; do not trust sankey adapter " +
              "output."
          );
          sankeyHealthy = false;
          return false;
        }

        logInfo(
          "Sankey self-check passed: all accessor and field-shape assertions hold"
        );
        sankeyHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `Sankey self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        sankeyHealthy = false;
        return false;
      });

    return sankeySelfCheckPromise;
  }

  /**
   * Report the sankey surface's health, independently of the other
   * surfaces.
   * @returns {boolean|null} True or false once the sankey self-check has
   *   run; null when it has not yet run (or not yet settled)
   */
  function isSankeyHealthy() {
    return sankeyHealthy;
  }

  // ---------------------------------------------------------------------
  // XY chart surface
  //
  // Parallel to the five surfaces above in every structural respect — own
  // single-slot memo, own lazy self-check state, own advisory health flag,
  // every parse-and-read inside one adapterParseQueue slot — and DIFFERENT
  // from all five in one: ITS DATA COMES FROM READING THE DIAGRAM SOURCE,
  // not from the db.
  //
  // THAT IS FORCED BY MEASUREMENT, NOT CHOSEN. Measured 22 August 2026 and
  // recorded in docs/mermaid-xychart-grounding-2026-08-22.md:
  //
  //   - § 3.2 THE DB DELIVERS NO DATA. All nineteen of its members are
  //     FUNCTIONS and not one returns the chart's numbers. The only route to
  //     content is getDrawableElem(), which returns RENDERED GEOMETRY —
  //     a bar's value exists solely as a rectangle height and a line's values
  //     solely as pixel coordinates inside one SVG path string (§ 3.4). A
  //     description that wants to say "872 submissions on Friday" cannot get
  //     872 from Mermaid.
  //   - § 7 SERIES NAMES ARE DISCARDED OUTRIGHT. `bar "Actual intake" […]`
  //     parses cleanly and the name appears nowhere: not in the db, not in
  //     any group name, not in the rendered SVG.
  //   - § 6.2 BAND AND RANGE X-AXES ARE INDISTINGUISHABLE from anything
  //     Mermaid delivers. Two sources constructed to collide produced
  //     identical group structure, identical label texts, an identical path
  //     string byte for byte and an identical getChartConfig().xAxis; the
  //     ONLY difference anywhere was floating-point noise in tick
  //     x-positions (145.1 against 145.10000000000002), which is not a
  //     signal and which a Mermaid patch release could erase.
  //   - § 6.3 THE DECLARED AXIS RANGE IS NOT DELIVERED, and the top tick is
  //     not a substitute for it: a source declaring `0 --> 250` delivers a
  //     top tick of 240.
  //
  // MERMAID IS STILL THE JUDGE OF VALIDITY. The reader runs ONLY after
  // getDiagramFromText has resolved, in the same queue slot, so this surface
  // can never narrate a source Mermaid rejected. The reader is a second
  // opinion about CONTENT, never a first opinion about legality.
  //
  // THE READER'S FAILURE CONTRACT, stated here because a future consumer
  // depends on it: if the reader meets a source Mermaid ACCEPTED but our
  // grammar subset cannot understand — Mermaid's grammar growing past ours —
  // it THROWS an Error whose message begins XYCHART_READER_ERROR_PREFIX. It
  // never guesses, never partially fills the shape, and never returns a
  // chart with fields quietly missing. The generator module of build session
  // 2 will let that throw reach the core's generation-failed branch, so the
  // reader says "we could not read this" out loud instead of describing a
  // chart it half understood. A silent partial read is the one outcome this
  // surface must never produce.
  //
  // WHY THE SINGLETON DEFENCES STILL APPLY EVEN THOUGH THE DATA IS OURS.
  // Measured § 3.3: the xychart db IS a shared singleton (two parses return
  // the same object, and the second silently rewrites the first diagram's
  // contents), and § 5: `title`, `accTitle` and `accDescr` come from
  // Mermaid's cross-type shared store, which EVERY parse of EVERY type
  // clears. So the three scalars are read same-tick inside the parse's own
  // .then, behind the queue, exactly as normaliseGit does. The axis and
  // series data cannot be lost that way — it is read from the caller's own
  // string — but the three scalars can, and they are the whole reason this
  // surface queues.
  //
  // TWO DB MEMBERS THIS SURFACE DELIBERATELY NEVER TOUCHES:
  //   - setTmpSVGG() — handed a raw SVG <g> instead of a d3 selection it
  //     accepts silently and then EVERY subsequent getDrawableElem() on the
  //     page throws, for every diagram, not only the one that poisoned it
  //     (grounding § 0). getDrawableElem does not need it, so the correct
  //     handling is never to call it.
  //   - getDrawableElem() itself — rendered geometry, per the headline
  //     above. Nothing here needs it, and reading it would reintroduce the
  //     scale-inversion guesswork the source read exists to avoid.
  //
  // Field sources are docs/mermaid-xychart-grounding-2026-08-22.md; the
  // delivered shape is docs/mermaid-xychart-gold-targets-2026-08-23.md § 3.
  // ---------------------------------------------------------------------

  // Frozen-const enums rather than bare strings, per AGENTS.md: these values
  // cross the adapter boundary into a generator that will branch on them.
  const XYCHART_ORIENTATIONS = Object.freeze({
    VERTICAL: "vertical",
    HORIZONTAL: "horizontal",
  });
  const XYCHART_AXIS_KINDS = Object.freeze({ BAND: "band", RANGE: "range" });
  const XYCHART_SERIES_KINDS = Object.freeze({ BAR: "bar", LINE: "line" });

  // Every reader refusal carries this prefix, so a consumer can tell "our
  // subset lags Mermaid's grammar" from "Mermaid rejected the source" without
  // string-matching on Mermaid's own error text.
  const XYCHART_READER_ERROR_PREFIX = "XY chart source reader";

  // A declared axis bound: an optionally-signed integer or decimal. Anchored
  // at BOTH ends deliberately — an unanchored variant would accept trailing
  // text and silently discard it (AGENTS.md § Diagnosis Discipline: verify
  // the exact variant the prose names).
  const XYCHART_NUMBER = "-?\\d+(?:\\.\\d+)?";
  const XYCHART_RANGE_ONLY = new RegExp(
    `^(${XYCHART_NUMBER})\\s*-->\\s*(${XYCHART_NUMBER})$`
  );
  const XYCHART_TITLED_RANGE = new RegExp(
    `^(.*?)\\s+(${XYCHART_NUMBER})\\s*-->\\s*(${XYCHART_NUMBER})$`
  );

  // Single-slot memo, matching every other surface's contract: the PROMISE is
  // cached, not the resolved value, and the memo sits IN FRONT of the parse
  // queue so an identical-code call never enqueues a second singleton
  // replacement.
  let xychartMemoCode = null;
  let xychartMemoPromise = null;

  // XY chart self-check health: null until the check has run, then true or
  // false. Independent of the other five flags by design.
  let xychartHealthy = null;

  // Lazy, memoised, first-parseXychart trigger — same reasoning as the other
  // five self-checks: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let xychartSelfCheckStarted = false;
  let xychartSelfCheckPromise = null;

  /**
   * Band self-check fixture: a categorical x-axis, a declared y range and one
   * bar series. It carries a body `title`, an `accTitle` and an `accDescr`
   * because those three are the fields the shared store can lose, so the
   * check pins the same-tick snapshot as well as the reader.
   *
   * ASCII only, and every label distinctive, so a cross-delivery from another
   * diagram NAMES ITS SOURCE rather than merely looking wrong.
   */
  const XYCHART_SELF_CHECK_FIXTURE_BAND = [
    "xychart-beta",
    "    accTitle: SelfCheck xychart acc title",
    "    accDescr: SelfCheck xychart acc descr",
    '    title "SelfCheck xychart title"',
    '    x-axis "SelfCheck x title" [Alpha, "Bravo two", Charlie]',
    '    y-axis "SelfCheck y title" 0 --> 90',
    '    bar "SelfCheck bar" [10, 20.5, 30]',
  ].join("\n");

  /**
   * Range self-check fixture: a NUMERIC-RANGE x-axis and a line series with
   * no series name. Two fixtures rather than one because the band/range split
   * is the single distinction Mermaid cannot express (grounding § 6.2) and is
   * therefore the reader's whole reason to exist — a check that exercised only
   * one of them would leave the other's branch unproven.
   */
  const XYCHART_SELF_CHECK_FIXTURE_RANGE = [
    "xychart-beta",
    '    title "SelfCheck range title"',
    '    x-axis "SelfCheck range x" 0 --> 100',
    "    y-axis 0 --> 40",
    "    line [1, 2, 4]",
  ].join("\n");

  /**
   * Reproduce Mermaid's own `encodeEntities` over raw source text.
   *
   * Quoted verbatim from the pinned 11.6.0 bundle in
   * docs/mermaid-quot-placeholder-capture-2026-08-08.md § 3.1, including the
   * two leading `style` / `classDef` passes, which are reproduced rather than
   * dropped so this function is a faithful copy rather than an approximation
   * of one.
   *
   * WHY IT IS HERE AT ALL, and it is the one thing about a raw-source decode
   * that a reader must understand. The db-fed surfaces receive text Mermaid
   * has ALREADY encoded — encodeEntities runs on the whole source inside
   * Diagram.fromText, before the parser sees it. A raw-source reader has been
   * through nothing. So to reach the same delivered bytes the db-fed surfaces
   * start from, the raw text must be encoded here first, and only then decoded
   * by the shared decodePlaceholders. Encode-then-decode is not a round trip
   * to nowhere: it is how Mermaid's own `#word;` escape reaches the character
   * it stands for.
   *
   * IT NOW SERVES TWO ROUTES, AND WAS RENAMED FOR IT ON 5 SEPTEMBER 2026 —
   * `encodeXychartEntities` until then, from the xychart surface that first
   * needed it. The second route is `decodeSourcePlaceholders` above, which
   * carried its own one-pass copy of the `#\w+;` branch alone until this date;
   * that copy is deleted and the two routes now share this one encoder. The
   * rename was taken because the single call site was, and remained, inside
   * this file. Dated session reports in docs/ still name the old spelling and
   * are correct as of their own dates.
   *
   * @param {string} source - Raw Mermaid text: a whole diagram source, or a
   *   directive value taken out of one
   * @returns {string} The text with `#word;` tokens in Mermaid's private
   *   delimiter form
   */
  function encodeMermaidEntities(source) {
    return source
      .replace(/style.*:\S*#.*;/g, (match) => match.substring(0, match.length - 1))
      .replace(/classDef.*:\S*#.*;/g, (match) => match.substring(0, match.length - 1))
      .replace(/#\w+;/g, (match) => {
        const inner = match.substring(1, match.length - 1);
        return /^\+?\d+$/.test(inner)
          ? `${PLACEHOLDER_NUMERIC}${inner}${PLACEHOLDER_END}`
          : `${PLACEHOLDER_NAMED}${inner}${PLACEHOLDER_END}`;
      });
  }

  /**
   * Throw the reader's own distinct, descriptive error.
   * @param {string} detail - What could not be read
   * @param {number|null} lineNumber - 1-based source line, when known
   */
  function throwXychartReaderError(detail, lineNumber) {
    throw buildXychartReaderError(detail, lineNumber);
  }

  /**
   * The line shapes that hang Mermaid 11.6.0's xychart parser.
   *
   * `accDescr` has two spellings in Mermaid's accessibility grammar: the
   * one-line colon form and a braced BLOCK form. On `xychart-beta` the block
   * form does not parse — it HANGS, synchronously, and the whole page with it.
   * Measured 23 August 2026 (docs/mermaid-xychart-adapter-2026-08-23.md § 7):
   * four cases on their own fresh pages, each behind a positive control —
   * multi-line block NO SETTLE in 20,000ms, single-line `accDescr { inline }`
   * NO SETTLE in 20,000ms, one-line `accDescr:` ACCEPT in 12ms, and the same
   * block form on a `flowchart` ACCEPT in 19ms. The loop is SYNCHRONOUS by
   * inference rather than observation: two earlier probes raced the call
   * against a `setTimeout` and the timeout never fired, which requires the JS
   * thread to be blocked.
   *
   * `accDescription` is not Mermaid syntax at all and cannot hang; it is
   * matched here because the block form of a near-miss spelling is exactly the
   * thing a reader of this file will try next, and refusing is the safe
   * direction — an unreadable source falls back, where a hang takes the page.
   */
  const XYCHART_ACC_BLOCK_PATTERN = /^accDesc(?:r|ription)\s*\{/;

  /**
   * Cheap pre-scan for the hanging form, run BEFORE the parse is queued.
   *
   * The adapter has no timeout machinery by design (see the queue's own
   * declaration: a timeout would abandon a slot whose parse may still be
   * mutating a singleton db), so a queued parse that never settles would
   * stall ALL SIX surfaces for the life of the page. This is the only defence
   * available, and it costs one pass over the source's lines.
   *
   * NOT COMMENT-STRIPPED BEYOND `%%`, and deliberately not frontmatter-aware:
   * a false positive refuses a source and falls back, which is recoverable,
   * where a false negative hangs the page, which is not.
   *
   * @param {string} code - The caller's raw Mermaid source
   * @returns {number|null} The 1-based line number of the offending statement,
   *   or null when the source carries none
   */
  function findXychartHangingAccBlock(code) {
    // Same line-ending normalisation the source reader uses, and for the
    // same reason: a CRLF source must split identically to an LF one.
    const lines = String(code)
      .split("\r\n")
      .join("\n")
      .split("\r")
      .join("\n")
      .split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (XYCHART_ACC_BLOCK_PATTERN.test(stripXychartComment(lines[i]).trim())) {
        return i + 1;
      }
    }
    return null;
  }

  // The default tail on a reader refusal, and it states a PRECONDITION rather
  // than decorating the sentence: every refusal raised from readXychartSource
  // happens inside `getDiagramFromText(...).then`, so Mermaid has already
  // judged the source valid by the time it is reached. The hang guard is the
  // one refusal raised BEFORE the parse, so it must not claim this, and it
  // passes its own tail.
  const XYCHART_READER_ERROR_TAIL =
    "Mermaid accepted this source, so the reader's grammar subset lags " +
    "Mermaid's own; the diagram must fall back rather than be described " +
    "from a partial read.";

  /**
   * Build (never throw) the reader's own distinct, descriptive error.
   * @param {string} detail - What could not be read
   * @param {number|null} lineNumber - 1-based source line, when known
   * @param {string} [tail] - Closing sentence; defaults to the
   *   Mermaid-already-accepted-it precondition above
   * @returns {Error} The reader error
   */
  function buildXychartReaderError(detail, lineNumber, tail) {
    const where = typeof lineNumber === "number" ? ` at source line ${lineNumber}` : "";
    return new Error(
      `${XYCHART_READER_ERROR_PREFIX}: ${detail}${where}. ` +
        (tail || XYCHART_READER_ERROR_TAIL)
    );
  }

  /**
   * Remove a trailing `%%` comment, ignoring one that falls inside quotes.
   * @param {string} line - One source line
   * @returns {string} The line with any comment removed
   */
  function stripXychartComment(line) {
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const character = line.charAt(i);
      if (character === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && character === "%" && line.charAt(i + 1) === "%") {
        return line.slice(0, i);
      }
    }
    return line;
  }

  /**
   * Take a leading double-quoted string off a statement's remainder.
   * @param {string} text - The trimmed remainder
   * @returns {Object|null} `{ value, rest }`, or null when there is no
   *   leading quoted string
   */
  function takeXychartQuoted(text) {
    if (text.charAt(0) !== '"') {
      return null;
    }
    const end = text.indexOf('"', 1);
    if (end === -1) {
      return null;
    }
    return { value: text.slice(1, end), rest: text.slice(end + 1).trim() };
  }

  /**
   * Strip one surrounding pair of double quotes, if present.
   * @param {string} text - A bracket-list item
   * @returns {string} The item without its surrounding quotes
   */
  function unquoteXychartItem(text) {
    const trimmed = text.trim();
    if (
      trimmed.length >= 2 &&
      trimmed.charAt(0) === '"' &&
      trimmed.charAt(trimmed.length - 1) === '"'
    ) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }

  /**
   * Split a bracket list's interior on TOP-LEVEL commas only, so a quoted
   * label may legitimately contain one.
   * @param {string} inner - The text between `[` and `]`
   * @returns {string[]} The items, quotes intact, untrimmed
   */
  function splitXychartList(inner) {
    if (inner.trim() === "") {
      return [];
    }
    const items = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < inner.length; i += 1) {
      const character = inner.charAt(i);
      if (character === '"') {
        inQuotes = !inQuotes;
        current += character;
        continue;
      }
      if (character === "," && !inQuotes) {
        items.push(current);
        current = "";
        continue;
      }
      current += character;
    }
    items.push(current);
    return items;
  }

  /**
   * Read one `x-axis` or `y-axis` statement's remainder.
   *
   * Four accepted forms, each with an optional leading axis title in either
   * the quoted or the bare spelling: a bracketed band list (x only), a
   * `min --> max` range, a title with no data at all, and a bare range.
   *
   * @param {string} remainder - The statement text after the keyword
   * @param {boolean} allowBand - True for the x-axis, false for the y-axis
   * @param {number} lineNumber - 1-based source line, for the error message
   * @returns {Object} `{ kind, title, categories }` or `{ kind, title, min, max }`
   */
  function readXychartAxis(remainder, allowBand, lineNumber) {
    let rest = remainder.trim();
    let title = null;

    const quoted = takeXychartQuoted(rest);
    if (quoted) {
      title = quoted.value;
      rest = quoted.rest;
    }

    // Title only, no data — a legal `y-axis "Count"` with no declared range.
    if (rest === "") {
      if (title === null) {
        throwXychartReaderError("an axis statement with nothing after it", lineNumber);
      }
      // The title decodes here exactly as it does on every other return path
      // below. Missing it would make ONE axis form silently deliver raw
      // placeholder bytes while the others decoded — the kind of per-branch
      // omission that reads as correct in review.
      return allowBand
        ? {
            kind: XYCHART_AXIS_KINDS.RANGE,
            title: decodePlaceholders(title),
            min: null,
            max: null,
          }
        : { kind: null, title: decodePlaceholders(title), min: null, max: null };
    }

    const open = rest.indexOf("[");
    if (open !== -1) {
      if (!allowBand) {
        throwXychartReaderError(
          "a bracketed category list on the y-axis, which has no band form",
          lineNumber
        );
      }
      const close = rest.lastIndexOf("]");
      if (close < open) {
        throwXychartReaderError("an unclosed category list", lineNumber);
      }
      if (rest.slice(close + 1).trim() !== "") {
        throwXychartReaderError("trailing text after a category list", lineNumber);
      }
      const beforeBracket = rest.slice(0, open).trim();
      if (beforeBracket !== "") {
        if (title !== null) {
          throwXychartReaderError(
            "two axis titles on one statement, one quoted and one bare",
            lineNumber
          );
        }
        title = beforeBracket;
      }
      const categories = splitXychartList(rest.slice(open + 1, close)).map((item) =>
        decodePlaceholders(unquoteXychartItem(item))
      );
      return {
        kind: XYCHART_AXIS_KINDS.BAND,
        title: title === null ? null : decodePlaceholders(title),
        categories: categories,
      };
    }

    const bare = XYCHART_RANGE_ONLY.exec(rest);
    if (bare) {
      return {
        kind: XYCHART_AXIS_KINDS.RANGE,
        title: title === null ? null : decodePlaceholders(title),
        min: Number(bare[1]),
        max: Number(bare[2]),
      };
    }

    // A bare (unquoted) axis title in front of a range.
    const titled = XYCHART_TITLED_RANGE.exec(rest);
    if (titled && titled[1].trim() !== "") {
      if (title !== null) {
        throwXychartReaderError(
          "two axis titles on one statement, one quoted and one bare",
          lineNumber
        );
      }
      return {
        kind: XYCHART_AXIS_KINDS.RANGE,
        title: decodePlaceholders(titled[1].trim()),
        min: Number(titled[2]),
        max: Number(titled[3]),
      };
    }

    throwXychartReaderError(
      `an axis statement in a form the reader does not know: ${JSON.stringify(remainder.trim())}`,
      lineNumber
    );
    return null;
  }

  /**
   * Read one `bar` or `line` statement's remainder.
   * @param {string} kind - "bar" or "line"
   * @param {string} remainder - The statement text after the keyword
   * @param {number} lineNumber - 1-based source line, for the error message
   * @returns {Object} `{ kind, name, values }`
   */
  function readXychartSeries(kind, remainder, lineNumber) {
    let rest = remainder.trim();
    let name = null;

    const quoted = takeXychartQuoted(rest);
    if (quoted) {
      name = quoted.value;
      rest = quoted.rest;
    }

    const open = rest.indexOf("[");
    const close = rest.lastIndexOf("]");
    if (open === -1 || close < open) {
      throwXychartReaderError(`a ${kind} statement with no value list`, lineNumber);
    }
    if (rest.slice(close + 1).trim() !== "") {
      throwXychartReaderError(`trailing text after a ${kind} value list`, lineNumber);
    }
    const beforeBracket = rest.slice(0, open).trim();
    if (beforeBracket !== "") {
      if (name !== null) {
        throwXychartReaderError(
          `two series names on one ${kind} statement, one quoted and one bare`,
          lineNumber
        );
      }
      name = beforeBracket;
    }

    const values = splitXychartList(rest.slice(open + 1, close)).map((item) => {
      const text = item.trim();
      const value = Number(text);
      if (text === "" || !Number.isFinite(value)) {
        throwXychartReaderError(
          `a ${kind} value the reader cannot read as a number: ${JSON.stringify(text)}`,
          lineNumber
        );
      }
      return value;
    });

    return {
      kind: kind,
      name: name === null ? null : decodePlaceholders(name),
      values: values,
    };
  }

  /**
   * Read the chart's axes, series and orientation out of the diagram SOURCE.
   *
   * Runs ONLY after getDiagramFromText has resolved on the same string, in
   * the same queue slot — see the surface preamble. Titles are NOT read here:
   * `title`, `accTitle` and `accDescr` statements are skipped, because the db
   * delivers those three and delivers them decoded of quoting.
   *
   * @param {string} code - The caller's raw Mermaid source
   * @returns {Object} `{ orientation, xAxis, yAxis, series }`
   */
  function readXychartSource(code) {
    // Encode first, so the shared decodePlaceholders below starts from the
    // same bytes every other surface starts from. See encodeMermaidEntities.
    const encoded = encodeMermaidEntities(
      String(code).split("\r\n").join("\n").split("\r").join("\n")
    );
    const lines = encoded.split("\n");

    let sawHeader = false;
    let inFrontmatter = false;
    let inAccBlock = false;
    let orientation = XYCHART_ORIENTATIONS.VERTICAL;
    let xAxis = null;
    let yAxis = null;
    const series = [];

    for (let i = 0; i < lines.length; i += 1) {
      const lineNumber = i + 1;
      let text = stripXychartComment(lines[i]).trim();

      if (inAccBlock) {
        if (text.indexOf("}") !== -1) {
          inAccBlock = false;
        }
        continue;
      }
      if (text === "") {
        continue;
      }
      // YAML frontmatter is skipped wholesale: whatever it carries, this
      // surface takes its three scalars from the db, never from the source.
      if (!sawHeader && text === "---") {
        inFrontmatter = !inFrontmatter;
        continue;
      }
      if (inFrontmatter) {
        continue;
      }
      if (text.charAt(text.length - 1) === ";") {
        text = text.slice(0, -1).trim();
      }

      if (!sawHeader) {
        if (!/^xychart-beta\b/.test(text)) {
          throwXychartReaderError(
            "a source that does not open with xychart-beta",
            lineNumber
          );
        }
        const tail = text.slice("xychart-beta".length).trim();
        if (tail === XYCHART_ORIENTATIONS.HORIZONTAL) {
          orientation = XYCHART_ORIENTATIONS.HORIZONTAL;
        } else if (tail !== "" && tail !== XYCHART_ORIENTATIONS.VERTICAL) {
          throwXychartReaderError(
            `an unknown word after xychart-beta: ${JSON.stringify(tail)}`,
            lineNumber
          );
        }
        sawHeader = true;
        continue;
      }

      // The db supplies all three of these; the reader only has to not choke.
      if (/^accDescr\s*\{/.test(text)) {
        inAccBlock = text.indexOf("}") === -1;
        continue;
      }
      if (/^(accTitle|accDescr)\s*:/.test(text)) {
        continue;
      }
      if (/^title\b/.test(text)) {
        continue;
      }

      if (/^x-axis\b/.test(text)) {
        if (xAxis !== null) {
          throwXychartReaderError("a second x-axis statement", lineNumber);
        }
        xAxis = readXychartAxis(text.slice("x-axis".length), true, lineNumber);
        continue;
      }
      if (/^y-axis\b/.test(text)) {
        if (yAxis !== null) {
          throwXychartReaderError("a second y-axis statement", lineNumber);
        }
        const read = readXychartAxis(text.slice("y-axis".length), false, lineNumber);
        yAxis = { title: read.title, min: read.min, max: read.max };
        continue;
      }
      const seriesKeyword = /^(bar|line)\b/.exec(text);
      if (seriesKeyword) {
        series.push(
          readXychartSeries(
            seriesKeyword[1] === XYCHART_SERIES_KINDS.BAR
              ? XYCHART_SERIES_KINDS.BAR
              : XYCHART_SERIES_KINDS.LINE,
            text.slice(seriesKeyword[1].length),
            lineNumber
          )
        );
        continue;
      }

      throwXychartReaderError(
        `a statement the reader does not know: ${JSON.stringify(text.slice(0, 60))}`,
        lineNumber
      );
    }

    if (!sawHeader) {
      throwXychartReaderError("a source with no xychart-beta header at all", null);
    }
    if (series.length === 0) {
      throwXychartReaderError("a chart with no bar or line series", null);
    }

    // AN ABSENT x-axis IS NOT AN ABSENT AXIS. Measured § 6.4: Mermaid
    // silently synthesises a numeric range 1 → N over the data length. It is
    // delivered here as a RANGE axis with NULL bounds rather than with the
    // synthesised 1 and N, because those bounds are the renderer's invention
    // and not the author's declaration — and rule XC2 says a description
    // speaks DECLARED bounds. A generator therefore finds nothing to speak,
    // which is the correct outcome, and the ordinal rule XC6 still applies.
    if (xAxis === null) {
      xAxis = {
        kind: XYCHART_AXIS_KINDS.RANGE,
        title: null,
        min: null,
        max: null,
      };
    }

    return {
      orientation: orientation,
      xAxis: xAxis,
      yAxis: yAxis,
      series: series,
    };
  }

  /**
   * Normalise one resolved xychart Diagram instance into the adapter's
   * xychart shape.
   *
   * SAME-TICK SNAPSHOT (the git/sankey singleton defence 1, reaching a third
   * surface): the three scalars below come from Mermaid's CROSS-TYPE shared
   * store, which every parse of every type clears (register item 21), and the
   * xychart db is itself a singleton (grounding § 3.3). They are therefore
   * read here — inside the parse's own .then, behind the queue — and copied
   * into this function's own return object before it returns. Nothing in the
   * delivered chart references a db-owned object, and no consumer may go back
   * to the db later.
   *
   * The axis and series data cannot be lost that way, because it is read from
   * the caller's own string rather than from the db; the source read is done
   * inside the slot anyway, so the whole function is one indivisible unit and
   * a future editor cannot accidentally split the scalars from the rest.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @param {string} code - The caller's raw source, the reader's input
   * @returns {Object} The normalised xychart
   */
  function normaliseXychart(diagram, code) {
    const db = diagram.db;

    // The three shared-store reads, together, first, before anything else can
    // yield. Measured § 5: all three surface on the db and only on the db.
    const rawTitle = db.getDiagramTitle() || "";
    const rawAccTitle = db.getAccTitle() || "";
    const rawAccDescription = db.getAccDescription() || "";

    const read = readXychartSource(code);

    return {
      type: "xychart",
      // ITEM 9, VERDICT C-PH for the drawn text on this surface. Measured
      // § 6.1 on a CATEGORY LABEL: an author's `#quot;` is drawn as a real
      // quote, an author's `&` is drawn as itself, and there is no
      // foreignObject anywhere in an xychart. [OBSERVED]
      //
      // Applying the same verdict to the chart TITLE is an INFERENCE, stated
      // as one: `chart-title` is a `text` element on the same SVG drawing
      // path as `bottom-axis/label` (§ 3.4), so the same treatment follows —
      // but the title itself was not among the strings measured in § 6.1. The
      // test that would settle it is a render of a title carrying `#quot;`,
      // read back as code points; it has not been run.
      //
      // The one DELIBERATE DIVERGENCE FROM THE DRAWING, ruled by the design
      // seat as rule XC9 on 23 August 2026: an author's `<` is drawn by
      // Mermaid 11.6.0 as the literal five characters `&lt;` — a rendering
      // defect visible with none of our code involved — and this surface
      // delivers a real `<` instead, because the description speaks author
      // intent. Re-open trigger: a Mermaid upgrade that changes the drawing.
      title: decodePlaceholders(rawTitle),
      // NO transform on accTitle or accDescr, matching the standing
      // carve-out declared at the placeholder-decoding block near the top of
      // this file. It is deliberate on all six surfaces and must not be
      // "completed" by a later editor.
      accTitle: rawAccTitle,
      accDescr: rawAccDescription,
      orientation: read.orientation,
      xAxis: read.xAxis,
      yAxis: read.yAxis,
      series: read.series,
    };
  }

  /**
   * Parse Mermaid xychart code into the normalised xychart shape.
   *
   * Rejects with Mermaid's own error on a parse failure, and with a distinct
   * Error whose message begins "XY chart source reader" when Mermaid accepted
   * a source the reader's grammar subset cannot read. Both are rejections of
   * the returned promise; the call itself never throws synchronously, so
   * awaiting this promise is the single error path.
   *
   * SERIALISED PARSES: every parse is chained through the adapter-wide queue,
   * so it cannot replace the shared singleton's data or clear the shared
   * accessible-title store while an earlier call's snapshot is still in
   * progress. The chain advances on settlement, not success, so a rejection
   * cannot wedge it.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised xychart
   */
  function parseXychart(code) {
    // THE HANG GUARD, AND IT RUNS BEFORE EVERYTHING ELSE — before the memo,
    // before the self-check trigger, before the queue. An `accDescr { ... }`
    // block hangs Mermaid's xychart parser synchronously, and this adapter
    // has no timeout machinery to recover a queue slot from that, so the one
    // safe move is never to queue such a source at all. See
    // findXychartHangingAccBlock for the measurements.
    //
    // It REJECTS rather than throwing, because this function's contract is
    // that it never throws synchronously and awaiting the promise is the
    // single error path. The rejection carries the reader's own error, so a
    // generator awaiting it propagates and the core speaks its
    // generation-failed statement, exactly as for any other refusal.
    const hangingBlockLine = findXychartHangingAccBlock(code);
    if (hangingBlockLine !== null) {
      return Promise.reject(
        buildXychartReaderError(
          "an accDescr block (brace syntax), which Mermaid 11.6.0 cannot " +
            "parse on an xychart at all",
          hangingBlockLine,
          "Mermaid has NOT judged this source: the block form hangs its " +
            "xychart parser synchronously, so the parse was refused before " +
            "it was queued rather than after it was accepted. Use the " +
            "one-line `accDescr:` form, which is fully supported."
        )
      );
    }

    // Lazy xychart self-check trigger, matching the other surfaces' ordering.
    // The check enqueues its own fixture parses first, so it holds the front
    // of the queue ahead of this call's parse.
    if (!xychartSelfCheckStarted) {
      runXychartSelfCheck();
    }

    if (code === xychartMemoCode && xychartMemoPromise) {
      logDebug("Returning memoised xychart parse for identical code string");
      return xychartMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for why
    // it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(
        `XY chart parse entering its queue slot, ${code.length} characters`
      );
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `XY chart parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          // MERMAID HAS NOW JUDGED THE SOURCE VALID. Only here does the
          // reader run, and it runs inside this same slot.
          const chart = normaliseXychart(diagram, code);
          logDebug(
            `XY chart parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return chart;
        })
        .catch((error) => {
          logDebug(
            `XY chart parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects (see
    // the tail below), but `run` is passed as both handlers so a future change
    // to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    xychartMemoCode = code;
    xychartMemoPromise = result;
    return result;
  }

  /**
   * Parse the two embedded xychart fixtures and assert the db accessor names,
   * the same-tick title snapshot and the source reader's normalised shape.
   * Resolves true on a clean run; on any failure logs ONE ERROR naming the
   * first failed assertion, marks the xychart surface unhealthy, and resolves
   * false. Never throws.
   *
   * BOTH FIXTURES RUN INSIDE ONE QUEUE SLOT, and the band chart is fully
   * normalised BEFORE the range parse is issued. That ordering is the point:
   * the second parse clears the shared title store and rewrites the singleton
   * db, so a check that parsed both and read afterwards would be measuring
   * the second chart twice. One slot rather than two is deliberate — it is
   * strictly stronger isolation, and it keeps the pair indivisible.
   *
   * @returns {Promise<boolean>} Resolves to the xychart health verdict
   */
  function runXychartSelfCheck() {
    if (xychartSelfCheckPromise) {
      return xychartSelfCheckPromise;
    }
    xychartSelfCheckStarted = true;

    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            XYCHART_SELF_CHECK_FIXTURE_BAND
          );
        })
        .then((bandDiagram) => {
          const db = bandDiagram.db;
          // The accessor names this surface depends on, read before anything
          // else, so a Mermaid rename fails here rather than delivering "".
          const accessorsPresent =
            typeof db.getDiagramTitle === "function" &&
            typeof db.getAccTitle === "function" &&
            typeof db.getAccDescription === "function";
          // Fully normalised — including the same-tick scalar snapshot —
          // before the second parse is allowed to begin.
          const band = normaliseXychart(bandDiagram, XYCHART_SELF_CHECK_FIXTURE_BAND);

          return window.mermaid.mermaidAPI
            .getDiagramFromText(XYCHART_SELF_CHECK_FIXTURE_RANGE)
            .then((rangeDiagram) => {
              const range = normaliseXychart(
                rangeDiagram,
                XYCHART_SELF_CHECK_FIXTURE_RANGE
              );

              const bandSeries = band.series[0];
              const rangeSeries = range.series[0];

              // Each entry: [assertion name, predicate]. The first false
              // predicate fails the check and is named in the single ERROR
              // line. The predicates are EVALUATED HERE, inside the slot, so
              // the verdict below never touches a db.
              return [
                [
                  "the three shared-store accessors exist by name on the db",
                  accessorsPresent,
                ],
                [
                  "the band chart's title, accTitle and accDescr survive " +
                    "the same-tick snapshot",
                  band.title === "SelfCheck xychart title" &&
                    band.accTitle === "SelfCheck xychart acc title" &&
                    band.accDescr === "SelfCheck xychart acc descr",
                ],
                [
                  'the band x-axis reads kind "band", its quoted title, and ' +
                    "three categories in source order with quotes stripped",
                  band.xAxis.kind === "band" &&
                    band.xAxis.title === "SelfCheck x title" &&
                    band.xAxis.categories.length === 3 &&
                    band.xAxis.categories[0] === "Alpha" &&
                    band.xAxis.categories[1] === "Bravo two" &&
                    band.xAxis.categories[2] === "Charlie",
                ],
                [
                  "the band y-axis reads its title and its DECLARED bounds 0 " +
                    "and 90 as numbers",
                  band.yAxis !== null &&
                    band.yAxis.title === "SelfCheck y title" &&
                    band.yAxis.min === 0 &&
                    band.yAxis.max === 90,
                ],
                [
                  'the band series reads kind "bar", its quoted name, and its ' +
                    "three values including a decimal, as numbers",
                  band.series.length === 1 &&
                    bandSeries.kind === "bar" &&
                    bandSeries.name === "SelfCheck bar" &&
                    bandSeries.values.length === 3 &&
                    bandSeries.values[0] === 10 &&
                    bandSeries.values[1] === 20.5 &&
                    bandSeries.values[2] === 30,
                ],
                [
                  'orientation defaults to "vertical" with no keyword',
                  band.orientation === "vertical",
                ],
                [
                  'THE BAND/RANGE PIN: the range chart\'s x-axis reads kind ' +
                    '"range" with declared bounds 0 and 100 and NO categories ' +
                    "— the one distinction Mermaid cannot express",
                  range.xAxis.kind === "range" &&
                    range.xAxis.title === "SelfCheck range x" &&
                    range.xAxis.min === 0 &&
                    range.xAxis.max === 100 &&
                    range.xAxis.categories === undefined,
                ],
                [
                  'the range chart\'s series reads kind "line" with a null ' +
                    "name, and its untitled y-axis reads a null title with " +
                    "declared bounds",
                  range.series.length === 1 &&
                    rangeSeries.kind === "line" &&
                    rangeSeries.name === null &&
                    range.yAxis !== null &&
                    range.yAxis.title === null &&
                    range.yAxis.min === 0 &&
                    range.yAxis.max === 40,
                ],
                [
                  "the range chart's own title reaches it, proving the band " +
                    "chart's snapshot was taken before this parse cleared the " +
                    "shared store",
                  range.title === "SelfCheck range title",
                ],
              ];
            });
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    xychartSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `XY chart self-check FAILED at assertion: ${failed[0]}. ` +
              "Either the pinned Mermaid build's xychart internals no longer " +
              "match the 22 August 2026 measurements, or the source reader's " +
              "grammar subset has drifted; do not trust xychart adapter output."
          );
          xychartHealthy = false;
          return false;
        }

        logInfo(
          "XY chart self-check passed: accessor, snapshot and source-reader " +
            "assertions all hold"
        );
        xychartHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `XY chart self-check FAILED at assertion: both fixtures parse and read. ` +
            `The fixture run rejected: ${error && error.message}`
        );
        xychartHealthy = false;
        return false;
      });

    return xychartSelfCheckPromise;
  }

  /**
   * Report the xychart surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the xychart self-check has
   *   run; null when it has not yet run (or not yet settled)
   */
  function isXychartHealthy() {
    return xychartHealthy;
  }

  // ---------------------------------------------------------------------
  // Gantt chart surface
  //
  // Parallel to the five STANDARD surfaces above in every structural
  // respect — own single-slot memo, own lazy self-check state, own advisory
  // health flag, every parse-and-read inside one adapterParseQueue slot —
  // and deliberately NOT modelled on the xychart surface beside it. Xychart
  // reads the diagram source because its db delivers no data; the gantt db
  // is measured FULL, so this is an ordinary db-reading surface and there is
  // no source reader here.
  //
  // WHY THIS SURFACE EXISTS. The shipped gantt description module parses the
  // source with its own regexes, and a task line carrying a status flag
  // defeats them: `Research :done, r1, 2026-01-05, 5d` has FOUR metadata
  // fields against a THREE-capture pattern, so the flag becomes the id slot,
  // the real id is read as a timing field, and the date and duration arrive
  // jammed together. Every date in such a chart is lost, and the fixture
  // pinning it passes green while encoding a chart with no dates at all.
  // Measured in docs/mermaid-item-68-arc-open-2026-08-29.md § 3.3. Mermaid's
  // own db parses that line correctly, which is the whole reason for this
  // surface. Register item 68 owns the module rebuild that consumes it.
  //
  // WHAT THE DB DELIVERS, measured 29 August 2026 (arc-open § 3.6) and
  // re-measured directly this session:
  //
  //   - getTasks() returns fully RESOLVED tasks: `id` correct even behind a
  //     status flag, `prevTaskId` carrying the `after` target, and
  //     `startTime` / `endTime` as real Date instances with the dependency
  //     chain already walked.
  //   - `excludes weekends` is applied BY MERMAID: the same 5d task runs
  //     05→10 Jan with no excludes and 05→12 Jan with weekends excluded.
  //     Nothing here recomputes a working-day calendar.
  //   - the four status flags arrive as own keys holding `undefined` when
  //     absent and `true` when set, so every read is an explicit test rather
  //     than a truthiness check.
  //
  // SINGLETON MODE — REASSIGNMENT, LIKE SANKEY, NOT IN-PLACE LIKE GIT.
  // Measured this session, and it is why the snapshot below is shaped as it
  // is. Two parses return the SAME db object; the second installs a NEW
  // tasks array rather than mutating the first's, so the first parse's task
  // objects survive untouched (a tagged object kept its tag and its name),
  // while the db itself then answers with the second diagram's data. So a
  // projection taken at the right moment is durable — exactly sankey's S2e
  // reasoning — and the queue is what guarantees the right moment.
  //
  // EAGER SNAPSHOT (defence 1) IS REQUIRED, and the check that settles it:
  // getTasks() and getSections() return the SAME array reference, holding
  // the SAME element references, on repeated calls within one parse — they
  // are NOT freshly built per call the way sankey's getGraph() projection
  // is. So every value is copied into the adapter's own objects here, inside
  // the parse's own .then, behind the queue, and no consumer may ever go
  // back to the db afterwards.
  //
  // DATES ARE COPIED, NOT ALIASED, and that is not tidiness. Measured: a
  // dependent task's `startTime` IS THE SAME Date OBJECT as its
  // predecessor's `endTime`. Delivering those references would hand two
  // tasks one shared mutable Date, so a consumer normalising one task's date
  // in place would silently move another's. Every date below is a new Date.
  //
  // ITEM 9, VERDICT C-PLACEHOLDER — decodePlaceholders, MEASURED FOR THIS
  // TYPE rather than copied from another. The discriminator is where Mermaid
  // draws the label, and the gantt renderer draws every label into SVG
  // <text>: foreignObject count is ZERO on both a plain and a hostile
  // render, with the title, the section name and the task names all in
  // <text> nodes. A hostile source was then round-tripped: the db delivers
  // `Task <placeholder>one<placeholder> &amp; two` holding Mermaid's private
  // delimiter bytes, and the canvas DRAWS `Task "one" &amp; two` — the
  // placeholder resolved, the author's own `&amp;` drawn literally. Applying
  // both candidate transforms to the delivered bytes, decodePlaceholders
  // reproduces the drawn string exactly on the title, the section and the
  // task name, and decodeAuthorText differs on all three. Gantt therefore
  // sits with git graph, not with flowchart / ER / class.
  //
  // accTitle AND accDescr ARE POPULATED ON THIS TYPE, unlike ER and class
  // which deliver them permanently empty. Measured: `accTitle:` and
  // `accDescr:` both round-trip. They are still delivered with NO transform,
  // per the standing carve-out at the top of this file — clause X3 owns
  // author override and reads the raw source.
  //
  // The `title` body form wins over a frontmatter title, measured: a source
  // carrying both delivers the body form.
  //
  // Field sources and the three verbatim deliveries are in
  // docs/mermaid-item-68-gantt-surface-2026-08-29.md.
  // ---------------------------------------------------------------------

  // Single-slot memo for the gantt surface, matching parse()'s contract: the
  // promise is cached rather than the resolved value. The memo sits IN FRONT
  // of the parse queue — an identical-code call returns the cached promise
  // without enqueueing a second singleton replacement.
  let ganttMemoCode = null;
  let ganttMemoPromise = null;

  // Gantt self-check health: null until the check has run, then true or
  // false. Independent of the other six flags by design.
  let ganttHealthy = null;

  // Lazy, memoised, first-parseGantt trigger — same reasoning as the other
  // six self-checks: Mermaid's diagram detectors are not registered at
  // script-evaluation time, so an eager check reports a false failure.
  let ganttSelfCheckStarted = false;
  let ganttSelfCheckPromise = null;

  /**
   * The embedded gantt self-check fixture. Two tasks are enough to pin
   * everything this surface depends on.
   *
   * The FIRST task is deliberately a FOUR-FIELD line carrying a status flag
   * (`:done, s1, 2026-01-05, 5d`). That is the exact shape the shipped
   * module's regexes mis-split, and pinning it here is the point of the
   * surface: if a Mermaid upgrade ever started reading the flag as the id,
   * this check fails loudly instead of the surface quietly delivering the
   * same wrong answer the regex parser does.
   *
   * The THIRD task pins `after` dependency resolution AND the distinction
   * between the dependency and Mermaid's `prevTaskId`: it depends on the
   * FIRST task while the SECOND is the one declared before it, so a reading
   * that confused the two would fail here. That confusion is not
   * hypothetical — this surface shipped it for one draft.
   */
  const GANTT_SELF_CHECK_FIXTURE = [
    "gantt",
    "    title Adapter self check",
    "    accTitle: Self check accessible title",
    "    dateFormat YYYY-MM-DD",
    "    section Alpha",
    "    First :done, s1, 2026-01-05, 5d",
    "    Second :s2, 2026-02-01, 2d",
    "    Third :s3, after s1, 3d",
  ].join("\n");

  /**
   * One day in milliseconds, for the duration assertion in the self-check.
   */
  const GANTT_MS_PER_DAY = 86400000;

  /**
   * An `after` dependency clause, matched case-insensitively on the keyword.
   */
  const GANTT_AFTER_CLAUSE = /^after\s+/i;

  /**
   * An `until` clause in the end slot.
   */
  const GANTT_UNTIL_CLAUSE = /^until\s+/i;

  /**
   * The task's START declaration, verbatim as the author wrote it — a date
   * string, or an `after ...` clause.
   * @param {Object} task - The db's task object
   * @returns {string} The declaration, or "" when absent
   */
  function ganttStartDeclaration(task) {
    const start = task && task.raw ? task.raw.startTime : null;
    return start && typeof start.startData === "string" ? start.startData : "";
  }

  /**
   * The task's END declaration, verbatim — a duration such as "5d", an
   * explicit end date, or an `until ...` clause.
   * @param {Object} task - The db's task object
   * @returns {string} The declaration, or "" when absent
   */
  function ganttEndDeclaration(task) {
    const end = task && task.raw ? task.raw.endTime : null;
    return end && typeof end.data === "string" ? end.data : "";
  }

  /**
   * The ids a task's `after` clause names, in the order written.
   *
   * THIS IS NOT prevTaskId, and the difference is the trap this helper
   * exists to close. MEASURED 29 August 2026: `prevTaskId` is the task
   * declared immediately BEFORE this one, unconditionally — a task with an
   * absolute start date and no dependency at all still carries one, and a
   * task written `after a` two positions later reports `b`. Mermaid resolves
   * the real dependency into startTime and keeps the clause only in
   * raw.startTime.startData, which is what this reads.
   *
   * Mermaid accepts several targets (`after a b`) and starts the task after
   * the LATEST of them, so this returns every id rather than the first.
   *
   * @param {Object} task - The db's task object
   * @returns {string[]} The dependency ids, empty when the start is a date
   */
  function ganttDependencies(task) {
    const declaration = ganttStartDeclaration(task);
    if (!GANTT_AFTER_CLAUSE.test(declaration)) {
      return [];
    }
    return declaration
      .replace(GANTT_AFTER_CLAUSE, "")
      .split(/\s+/)
      .filter((id) => id !== "");
  }

  /**
   * The id an `until` clause names, or null.
   * @param {Object} task - The db's task object
   * @returns {string|null} The target id, or null when the end is not an
   *   `until` clause
   */
  function ganttUntilTarget(task) {
    const declaration = ganttEndDeclaration(task);
    if (!GANTT_UNTIL_CLAUSE.test(declaration)) {
      return null;
    }
    const target = declaration.replace(GANTT_UNTIL_CLAUSE, "").trim();
    return target === "" ? null : target;
  }

  /**
   * Copy a db-owned Date into an adapter-owned one, or null.
   *
   * Never returns the db's own object: a dependent task's startTime is the
   * SAME Date instance as its predecessor's endTime (measured), so passing
   * references through would share one mutable date between two delivered
   * tasks. An unparseable date arrives as an Invalid Date rather than as
   * null, and is normalised to null here so a consumer has one absent case
   * to test rather than two.
   *
   * @param {*} value - The db's date value
   * @returns {Date|null} An adapter-owned Date, or null when absent/invalid
   */
  function copyGanttDate(value) {
    if (!(value instanceof Date)) {
      return null;
    }
    const time = value.getTime();
    return Number.isNaN(time) ? null : new Date(time);
  }

  /**
   * Normalise one resolved gantt Diagram instance into the adapter's gantt
   * shape.
   *
   * EAGER SNAPSHOT (defence 1): getTasks() and getSections() hand back the
   * db's own arrays holding the db's own objects — the same references on
   * every call — and the next gantt parse replaces them. Both are therefore
   * read ONCE here, inside the parse's own .then and behind the queue, and
   * mapped into the adapter's own objects immediately. Nothing in the
   * returned shape references a db-owned object, dates included.
   *
   * The three shared-store scalars (title, accTitle, accDescr) are read in
   * this same slot, per register item 21: they live in Mermaid's cross-type
   * common db, which EVERY parse of EVERY type clears.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised gantt chart
   */
  function normaliseGantt(diagram) {
    const db = diagram.db;

    // The two data reads. Everything below maps these.
    const rawTasks = Array.isArray(db.getTasks()) ? db.getTasks() : [];
    const rawSections = Array.isArray(db.getSections()) ? db.getSections() : [];

    const tasks = rawTasks.map((task) => ({
      // ITEM 9, VERDICT C-PLACEHOLDER — see the section header.
      //
      // TRIMMED, ruled 29 August 2026, reversing this surface's first
      // draft. Mermaid's grammar captures everything up to the colon, so
      // `Task :id` delivers "Task " and `Task:id` delivers "Task" —
      // measured, and the difference is the author's SEPARATOR spacing
      // rather than content they chose. Left untrimmed, every consumer
      // would have to strip it before interpolating or emit
      // "Research , which starts on ...", and the gold targets
      // (docs/mermaid-gantt-gold-targets-2026-08-29.md) are authored
      // against trimmed names.
      //
      // TRIMMED AFTER THE DECODE, not before: an author-encoded space
      // reaches the db as placeholder bytes and only becomes whitespace
      // once decoded, so trimming first would leave it behind.
      //
      // PER-TYPE BY RULE. This trim belongs to the gantt surface alone;
      // the other six deliver their author text untouched. The adapter
      // decides delivery per type on measurement and does not generalise
      // one surface's normalisation across the rest.
      name: decodePlaceholders(
        typeof task.task === "string" ? task.task : ""
      ).trim(),

      // The id survives a leading status flag — the defect this surface
      // exists to route around. Absent ids arrive as undefined; normalised
      // to null so a consumer has one absent case.
      id: typeof task.id === "string" ? task.id : null,

      section: decodePlaceholders(
        typeof task.section === "string" ? task.section : ""
      ),

      // Creation order across the whole chart, not within a section.
      order: typeof task.order === "number" ? task.order : null,

      // AN AUTO-GENERATED ID IS NOT AUTHOR TEXT. A task written without one
      // still receives an id — measured: an id-less task is delivered as
      // `task1`. The test is exact rather than a pattern match: Mermaid keeps
      // the author's own metadata verbatim in raw.data, so an id the author
      // wrote appears there and a generated one does not. A description that
      // said "task task1" would be quoting the parser to the reader.
      hasGeneratedId:
        typeof task.id === "string" &&
        !(
          task.raw &&
          typeof task.raw.data === "string" &&
          task.raw.data.indexOf(task.id) !== -1
        ),

      // The author's own start and end clauses, verbatim. Delivered raw
      // because Mermaid keeps no parsed form of them and the narration layer
      // owns how a duration or an explicit end date should read.
      startDeclaration: ganttStartDeclaration(task),
      endDeclaration: ganttEndDeclaration(task),

      // The REAL dependency, from the `after` clause — NOT prevTaskId, which
      // is declaration order (see ganttDependencies). An array because
      // Mermaid accepts several targets and starts after the latest.
      dependsOn: ganttDependencies(task),

      // The `until` target, which ends a task at another task rather than
      // after a duration.
      untilTaskId: ganttUntilTarget(task),

      startDate: copyGanttDate(task.startTime),
      endDate: copyGanttDate(task.endTime),

      // The four status flags are own keys holding `undefined` when unset,
      // so each is an explicit === true rather than a truthiness test, and
      // each is delivered as a real boolean.
      isDone: task.done === true,
      isActive: task.active === true,
      isCritical: task.crit === true,
      isMilestone: task.milestone === true,
    }));

    return {
      type: "gantt",

      // Gantt accepts the body `title` form, and it WINS over a frontmatter
      // title (measured). This is the third type after git graph and xychart
      // whose title genuinely carries data.
      title: decodePlaceholders(db.getDiagramTitle()),

      // NO transform on either, per the standing carve-out: clause X3 owns
      // author override and reads the raw source. Unlike ER and class these
      // are genuinely POPULATED on this type, so they are delivered rather
      // than omitted.
      accTitle: db.getAccTitle(),
      accDescr: db.getAccDescription(),

      // The author's declared date format, which the description names.
      dateFormat: db.getDateFormat(),

      // The day the working week starts. It is not decoration: it decides
      // WHICH days `excludes weekends` actually removes, so a description
      // naming Saturday and Sunday is wrong on a chart declaring
      // `weekday monday`.
      weekday: db.getWeekday(),

      // Copied into adapter-owned arrays for the same reason the tasks are.
      excludes: Array.isArray(db.getExcludes()) ? [...db.getExcludes()] : [],
      includes: Array.isArray(db.getIncludes()) ? [...db.getIncludes()] : [],

      sections: rawSections.map((section) =>
        decodePlaceholders(typeof section === "string" ? section : "")
      ),

      tasks: tasks,
    };
  }

  /**
   * Parse Mermaid gantt code into the normalised gantt shape.
   *
   * Rejects with Mermaid's own error on a parse failure. The call itself
   * never throws synchronously, so awaiting this promise is the single error
   * path.
   *
   * SERIALISED PARSES (adapter-wide since register item 21): every parse is
   * chained through the queue so it cannot replace the shared singleton's
   * data while an earlier call's snapshot is still in progress, and so the
   * three shared-store scalars are read before another parse can clear them.
   * The chain advances on settlement, not success, so a rejection cannot
   * wedge it.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised gantt chart
   */
  function parseGantt(code) {
    // Lazy gantt self-check trigger, matching the other surfaces' ordering.
    // The check enqueues its own fixture parse first, so it holds the front
    // of the queue ahead of this call's parse.
    if (!ganttSelfCheckStarted) {
      runGanttSelfCheck();
    }

    if (code === ganttMemoCode && ganttMemoPromise) {
      logDebug("Returning memoised gantt parse for identical code string");
      return ganttMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for
    // why it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(`Gantt parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Gantt parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const chart = normaliseGantt(diagram);
          logDebug(
            `Gantt parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return chart;
        })
        .catch((error) => {
          logDebug(
            `Gantt parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects
    // (see the tail below), but `run` is passed as both handlers so a
    // future change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    ganttMemoCode = code;
    ganttMemoPromise = result;
    return result;
  }

  /**
   * Parse the embedded gantt fixture and assert the db accessor names and
   * field shapes the gantt surface depends on. Resolves true on a clean
   * pass. On any failure it logs one ERROR naming the failed assertion,
   * marks the gantt surface unhealthy, and resolves false. Never throws,
   * never rejects, and never reads or writes the other six health flags.
   *
   * Like the ER, class, git, sankey and xychart checks, this resolves the
   * Diagram itself rather than going through parseGantt(): its assertions
   * are deliberately about the RAW db internals the normalised shape exists
   * to hide — above all THE FOUR-FIELD PIN, so a Mermaid upgrade that
   * started mis-splitting a flagged task line would fail here rather than
   * letting this surface deliver the same wrong answer the regex parser it
   * replaces already delivers.
   *
   * The fixture parse goes through the parse QUEUE: a direct unqueued
   * getDiagramFromText call could replace the singleton db's data
   * mid-snapshot of a queued consumer parse. All raw reads happen
   * synchronously inside the parse's own .then, before the queue advances.
   *
   * NO ABSOLUTE CALENDAR DATE IS ASSERTED, deliberately — though NOT for
   * the reason this comment first gave, which was inverted.
   *
   * MEASURED 29 August 2026: Mermaid builds these Dates at LOCAL midnight,
   * NOT at UTC midnight. The consequence runs the opposite way to the
   * original claim — getDate() is the SAFE accessor and toISOString() is
   * the unsafe one, because from 29 March 2026 British Summer Time puts
   * local midnight at 23:00 UTC the previous day, so a UTC read reports
   * every date one day early. That silently invalidated a first-pass
   * derivation of the gold targets before it was caught.
   *
   * The assertions below are UNCHANGED and were measured sound: they use
   * only differences and identities, which hold in any zone, and the
   * day-count is rounded so a DST boundary inside a span cannot fail it.
   * An absolute-date assertion is still avoided, because it would pin this
   * check to the machine's own zone for no gain.
   *
   * @returns {Promise<boolean>} Resolves to the gantt health verdict
   */
  function runGanttSelfCheck() {
    if (ganttSelfCheckPromise) {
      return ganttSelfCheckPromise;
    }
    ganttSelfCheckStarted = true;

    // Every raw db read happens INSIDE the queued run, so `run` resolves to
    // the completed assertion list rather than to a diagram for a later
    // .then to read — the structural form of the queue's invariant.
    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            GANTT_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;

          // All raw reads are synchronous within the slot — the queue cannot
          // advance until they are done.
          const tasks = Array.isArray(db.getTasks()) ? db.getTasks() : [];
          const sections = Array.isArray(db.getSections())
            ? db.getSections()
            : [];
          const first = tasks[0];
          const second = tasks[1];
          const third = tasks[2];

          // The freshness pin below needs a second read of the same accessor.
          const tasksAgain = db.getTasks();

          const title = db.getDiagramTitle();
          const accTitle = db.getAccTitle();

          // Each entry: [assertion name, predicate]. The first false
          // predicate fails the check and is named in the single ERROR line.
          // The predicates are EVALUATED HERE, inside the slot, so the
          // verdict below never touches the db.
          return [
            [
              'getSections returns ["Alpha"] and getTasks returns three tasks',
              sections.length === 1 &&
                sections[0] === "Alpha" &&
                tasks.length === 3 &&
                !!first &&
                !!second &&
                !!third,
            ],
            [
              "THE FOUR-FIELD PIN: a task line written `:done, s1, <date>, 5d` " +
                'delivers id "s1" with done true — the flag is NOT read as the id',
              !!first && first.id === "s1" && first.done === true,
            ],
            [
              "an unset status flag is an own key holding undefined, not false",
              !!second &&
                Object.prototype.hasOwnProperty.call(second, "done") &&
                second.done === undefined,
            ],
            [
              "startTime and endTime are real Date instances spanning the " +
                "declared 5d duration",
              !!first &&
                first.startTime instanceof Date &&
                first.endTime instanceof Date &&
                !Number.isNaN(first.startTime.getTime()) &&
                !Number.isNaN(first.endTime.getTime()) &&
                Math.round(
                  (first.endTime.getTime() - first.startTime.getTime()) /
                    GANTT_MS_PER_DAY
                ) === 5,
            ],
            [
              "the `after` dependency is RESOLVED: the third task declares " +
                '`after s1` and starts exactly where the first task ends',
              !!third &&
                third.raw &&
                third.raw.startTime &&
                third.raw.startTime.startData === "after s1" &&
                third.startTime instanceof Date &&
                third.startTime.getTime() === first.endTime.getTime(),
            ],
            [
              "THE DEPENDENCY/ORDER PIN: prevTaskId is the task declared " +
                'BEFORE this one ("s2"), NOT the `after` target ("s1") — the ' +
                "two are different fields and this fixture separates them",
              !!third && third.prevTaskId === "s2",
            ],
            [
              "THE ALIASING PIN: a dependent task's startTime is the SAME Date " +
                "object as its dependency's endTime, so the surface must copy",
              !!third && third.startTime === first.endTime,
            ],
            [
              "THE FRESHNESS PIN: getTasks returns the db's OWN array, the same " +
                "reference on a second call, so an eager snapshot is required",
              tasksAgain === tasks,
            ],
            [
              "the body `title` form and `accTitle:` both populate on this type",
              title === "Adapter self check" &&
                accTitle === "Self check accessible title",
            ],
          ];
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    ganttSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Gantt self-check FAILED at assertion: ${failed[0]}. ` +
              "The pinned Mermaid build's gantt parse internals no longer " +
              "match the measurements this surface was built on; do not " +
              "trust gantt adapter output."
          );
          ganttHealthy = false;
          return false;
        }

        logInfo(
          "Gantt self-check passed: all accessor and field-shape assertions hold"
        );
        ganttHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `Gantt self-check FAILED at assertion: parse resolves. ` +
            `The fixture parse rejected: ${error && error.message}`
        );
        ganttHealthy = false;
        return false;
      });

    return ganttSelfCheckPromise;
  }

  /**
   * Report the gantt surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the gantt self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isGanttHealthy() {
    return ganttHealthy;
  }

  // ---------------------------------------------------------------------
  // Quadrant chart surface
  //
  // THE EIGHTH PER-TYPE SURFACE, and the second HYBRID one after xychart:
  // three scalars from Mermaid's db, everything else from a reader over the
  // author's own source. The split is a design-seat ruling of 1 September
  // 2026, and it rests on one measurement — Mermaid's quadrant db delivers
  // NO AUTHORED COORDINATE. `getQuadrantData().points` carries laid-out
  // PIXELS: an author's `[0.25, 0.85]` arrives as `{ x: 147, y: 108.6 }`,
  // after a layout that reserves a title band when a title is present and
  // does not when it is absent.
  //
  // The authored pair IS arithmetically recoverable from those pixels plus
  // the delivered quadrant rectangles — eight of eight exact to four decimal
  // places, measured in
  // docs/mermaid-item-69-quadrant-grounding-2026-09-01.md § B3.4a — and this
  // surface DELIBERATELY DOES NOT DO THAT. Recovering an author's number by
  // inverting a private layout is the same class of mistake as reading a
  // title off a rendered SVG (register item 67): the float noise needs an
  // arbitrary rounding decision nobody has authority to take on the author's
  // behalf, the plot rectangle changes shape with the title, and the
  // transform is Mermaid's layout code rather than a published contract, so
  // any release can move every recovered figure with no gate of ours
  // noticing. A description that states "coordinates [0.25, 0.85]" as fact
  // must not compute that number from a picture.
  //
  // WHAT THE DB IS USED FOR INSTEAD. The pixels, the positional axis-label
  // array and the quadrant rectangles are read in the SAME SLOT and
  // delivered under `crossCheck`, which is CORROBORATION MATERIAL AND NEVER
  // NARRATION. A consumer that speaks a crossCheck value is using the wrong
  // field; its purpose is to let a gate assert that the source read and the
  // canvas agree, which is the one thing a source reader cannot prove about
  // itself.
  //
  // MERMAID IS STILL THE JUDGE OF VALIDITY, exactly as on the xychart
  // surface: the reader runs ONLY after getDiagramFromText has resolved, in
  // the same queue slot, so this surface can never narrate a source Mermaid
  // rejected. The reader is a second opinion about CONTENT, never a first
  // opinion about legality.
  //
  // THE READER'S FAILURE CONTRACT. A point line the reader cannot parse is a
  // STOP: it throws an Error whose message begins
  // QUADRANT_READER_ERROR_PREFIX and NAMES THE LINE. It never guesses, never
  // partially fills the shape, and above all NEVER SILENTLY DROPS A POINT.
  // That last clause is the defect this surface exists to remove: the
  // shipped module's point regex cannot match Mermaid's own `Name:::class:`
  // syntax, so a three-point chart is narrated as "1 data point" with two of
  // the author's points invisible and nothing said about the loss
  // (grounding § B2.7, measured in both directions).
  //
  // WHY THE SINGLETON DEFENCES APPLY, and here they are STRONGER than on any
  // earlier surface. Measured (grounding § B3.4f): the quadrant db is a
  // shared singleton whose object identity is the same across every parse on
  // a page, and a second parse replaces the FIRST diagram's ENTIRE payload —
  // points, axis labels and quadrant labels, not merely the three scalars
  // register item 21 is about. Re-reading a stale Diagram handle after a
  // second parse returns the second chart's data in full, and the handle
  // looks live. So every db read below happens inside the parse's own .then,
  // behind the queue, and the whole normalise is one indivisible unit.
  //
  // The source-read half cannot be lost that way, because it is read from
  // the caller's own string — but the crossCheck half can, and it is exactly
  // the half a gate would trust.
  //
  // DECODE — measured 1 September 2026, and the answer is SPLIT. Recorded as
  // the ruling on open question OQ1.
  //
  //   Point names, axis end labels and quadrant labels: NO DECODE, because
  //   no escape can reach them. Mermaid's quadrant lexer REJECTS `#quot;`
  //   and `#35;` outright in all three positions ("Unrecognized text", and
  //   the error text shows the placeholder bytes, so encodeEntities ran
  //   first and the lexer then refused its own delimiters); it rejects a
  //   bare `"` with a parse error; and it rejects a pre-escaped `&lt;`. The
  //   one character that does get through is a bare `&`, and it is delivered
  //   and DRAWN as itself, untransformed. So there is nothing to decode, and
  //   a decode call here would be dead code no fixture could ever redden.
  //
  //   `title`: DECODED with decodePlaceholders, item 9 verdict C-PLACEHOLDER,
  //   [OBSERVED] on all four routes rather than inferred from a sibling
  //   surface. The title statement is a DIFFERENT lexer path from the three
  //   above and does accept escapes. Author `#quot;` reaches the db as
  //   placeholder bytes and is drawn as `"`; `#35;` is drawn as `#`; a bare
  //   `&` is drawn as itself; a pre-escaped `&lt;` is drawn as the literal
  //   six characters. decodePlaceholders reproduces the drawing in all four,
  //   and the quadrant SVG has ZERO foreignObjects, so the SVG-text verdict
  //   is the right one.
  //
  //   `accTitle` / `accDescr`: NO TRANSFORM, matching the standing carve-out
  //   on all seven earlier surfaces. They accept escapes and deliver
  //   placeholder bytes, and that is deliberately left alone here.
  //
  // NO HANG GUARD, and its absence is measured rather than assumed. The
  // `accDescr { ... }` block form that hangs Mermaid 11.6.0's xychart parser
  // parses cleanly on a quadrant chart in about a second and delivers its
  // text correctly (grounding § B4, re-confirmed this session as grammar
  // case G25). Register item 47 is unchanged; its blast radius simply does
  // not reach this type.
  //
  // Field sources, the grammar census and three verbatim deliveries are in
  // docs/mermaid-item-69-quadrant-surface-2026-09-01.md.
  // ---------------------------------------------------------------------

  // Every reader refusal carries this prefix, so a consumer can tell "our
  // subset lags Mermaid's grammar" from "Mermaid rejected the source"
  // without string-matching on Mermaid's own error text.
  const QUADRANT_READER_ERROR_PREFIX = "Quadrant chart source reader";

  // Stated as a PRECONDITION rather than as decoration: every refusal raised
  // from readQuadrantSource happens inside `getDiagramFromText(...).then`,
  // so Mermaid has already judged the source valid by the time it is
  // reached. This surface has no pre-parse refusal, so unlike xychart there
  // is no second tail.
  const QUADRANT_READER_ERROR_TAIL =
    "Mermaid accepted this source, so the reader's grammar subset lags " +
    "Mermaid's own; the diagram must fall back rather than be described " +
    "from a partial read.";

  // THE POINT LINE, and every branch of it was measured against Mermaid's
  // own parser on 1 September 2026 rather than copied from the shipped
  // module, whose equivalent pattern is the defect this surface replaces.
  //
  //   name        either a double-quoted string, or a bare run with NO
  //               colon in it. Bare is safe because Mermaid REJECTS a colon
  //               inside an unquoted point name (measured), so `[^:]*`
  //               cannot swallow the separator.
  //   :::class    Mermaid's class syntax, OPTIONAL. The class name itself is
  //               read and discarded — see readQuadrantSource for why it is
  //               matched at all rather than ignored.
  //   [x, y]      unsigned integer or decimal, both captured as the
  //               AUTHOR'S OWN STRING. Mermaid rejects a negative, a value
  //               above 1 and a bare `.5`, so this character class is
  //               exactly its accepted set.
  //   rest        trailing style pairs, accepted and discarded; this surface
  //               delivers no styling.
  //
  // Anchored at BOTH ends, so trailing text cannot be silently discarded
  // (AGENTS.md § Diagnosis Discipline — verify the exact variant the prose
  // names).
  const QUADRANT_POINT_LINE =
    /^(?:"([^"]*)"|([^:]*))(?::::([^:\s]+))?\s*:\s*\[\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\]\s*(.*)$/;

  // The four quadrant statements, `quadrant-1` to `quadrant-4`. Case is
  // Mermaid's own: measured, the axis keywords accept any case (`X-AXIS`
  // parses), so every keyword test here is case-insensitive to match.
  const QUADRANT_LABEL_LINE = /^quadrant-([1-4])\b\s*(.*)$/i;

  // Mermaid draws the arrow as `-->` in source. A dangling `x-axis Low -->`
  // is ACCEPTED by the grammar and delivered by the db as a single label
  // reading "Low ⟶" — the arrow glyph survives into the label text. Split
  // on the source spelling and the author's declaration is recovered
  // correctly; see readQuadrantAxis.
  const QUADRANT_AXIS_ARROW = "-->";

  // Single-slot memo, matching every other surface's contract: the PROMISE
  // is cached, not the resolved value, and the memo sits IN FRONT of the
  // parse queue so an identical-code call never enqueues a second singleton
  // replacement.
  let quadrantMemoCode = null;
  let quadrantMemoPromise = null;

  // Quadrant self-check health: null until the check has run, then true or
  // false. Independent of the other seven flags by design.
  let quadrantHealthy = null;

  // Lazy, memoised, first-parseQuadrant trigger — same reasoning as the
  // other seven self-checks: Mermaid's diagram detectors are not registered
  // at script-evaluation time, so an eager check reports a false failure.
  let quadrantSelfCheckStarted = false;
  let quadrantSelfCheckPromise = null;

  /**
   * Full self-check fixture: a title, both accessible fields, both axes with
   * arrows, all four quadrant labels, and three points.
   *
   * The THIRD point is written `Gamma:::big:` and there is a `classDef` line
   * below it. That is the whole reason this fixture exists in this shape: it
   * is the exact construct the shipped module's regex drops in silence, so
   * if a Mermaid upgrade ever changed the class syntax this check fails
   * loudly instead of the surface quietly losing a point the way the parser
   * it replaces already does.
   *
   * The SECOND point carries trailing inline styling, so the reader's
   * discard-the-rest branch is exercised rather than assumed.
   *
   * ASCII only, and every label distinctive, so a cross-delivery from
   * another diagram NAMES ITS SOURCE rather than merely looking wrong.
   */
  const QUADRANT_SELF_CHECK_FIXTURE_FULL = [
    "quadrantChart",
    "    title SelfCheck quadrant title",
    "    accTitle: SelfCheck quadrant acc title",
    "    accDescr: SelfCheck quadrant acc descr",
    "    x-axis SelfCheck low x --> SelfCheck high x",
    "    y-axis SelfCheck low y --> SelfCheck high y",
    "    quadrant-1 SelfCheck q one",
    "    quadrant-2 SelfCheck q two",
    "    quadrant-3 SelfCheck q three",
    "    quadrant-4 SelfCheck q four",
    "    Alpha point: [0.25, 0.85]",
    "    Beta point: [0.80, 0.30] radius: 12, color: #ff0000",
    "    Gamma point:::big: [0.5, 0.5]",
    "    classDef big radius: 15, stroke-width: 3px",
  ].join("\n");

  /**
   * Small self-check fixture: two points, no title, no quadrant labels, no
   * accessible fields.
   *
   * Two fixtures rather than one because the second is what proves the
   * FIRST one's scalars were snapshotted before it ran — the quadrant db is
   * a measured singleton whose second parse replaces the first chart's whole
   * payload, so a check that parsed both and read afterwards would be
   * measuring the second chart twice. It also pins the absent cases: an
   * unlabelled quadrant is delivered as "" rather than omitted, and an
   * absent title is "" rather than null.
   */
  const QUADRANT_SELF_CHECK_FIXTURE_SMALL = [
    "quadrantChart",
    "    x-axis SelfCheck small low --> SelfCheck small high",
    "    y-axis SelfCheck small bottom --> SelfCheck small top",
    "    Quick win: [0.2, 0.8]",
    "    Long haul: [0.8, 0.3]",
  ].join("\n");

  /**
   * Single-label self-check fixture: an x-axis written with NO arrow beside a
   * y-axis written with one.
   *
   * A third fixture rather than a flag on the second, because the distinction
   * it pins is a RULING and not a shape detail. Gold rule R6 says a
   * single-label axis is an axis TITLE and must never be narrated as though
   * the author had declared a polarity, so this surface delivers such a label
   * in its own field with both ends left empty. Mixing the two forms in one
   * chart is what makes the fixture bite: a reader that filled `left` from
   * either form would pass on a chart carrying only one of them.
   */
  const QUADRANT_SELF_CHECK_FIXTURE_SINGLE_LABEL = [
    "quadrantChart",
    "    x-axis SelfCheck lone x",
    "    y-axis SelfCheck lone low y --> SelfCheck lone high y",
    "    Lone point: [0.7, 0.2]",
  ].join("\n");

  /**
   * Build (never throw) the reader's own distinct, descriptive error.
   * @param {string} detail - What could not be read
   * @param {number|null} lineNumber - 1-based source line, when known
   * @returns {Error} The reader error
   */
  function buildQuadrantReaderError(detail, lineNumber) {
    const where =
      typeof lineNumber === "number" ? ` at source line ${lineNumber}` : "";
    return new Error(
      `${QUADRANT_READER_ERROR_PREFIX}: ${detail}${where}. ` +
        QUADRANT_READER_ERROR_TAIL
    );
  }

  /**
   * Throw the reader's own distinct, descriptive error.
   * @param {string} detail - What could not be read
   * @param {number|null} lineNumber - 1-based source line, when known
   */
  function throwQuadrantReaderError(detail, lineNumber) {
    throw buildQuadrantReaderError(detail, lineNumber);
  }

  /**
   * Remove a trailing `%%` comment, ignoring one that falls inside quotes.
   *
   * Quote-awareness is not decoration: a quoted point name is legal
   * (measured — `"Alpha Beta": [0.2, 0.7]` parses and delivers the name with
   * the quotes stripped), so a name could contain the comment marker.
   *
   * @param {string} line - One source line
   * @returns {string} The line with any comment removed
   */
  function stripQuadrantComment(line) {
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const character = line.charAt(i);
      if (character === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && character === "%" && line.charAt(i + 1) === "%") {
        return line.slice(0, i);
      }
    }
    return line;
  }

  /**
   * Read one axis statement's remainder into its end labels.
   *
   * Mermaid accepts three forms, all measured, and THEY ARE NOT THE SAME
   * DECLARATION:
   *
   *   `Low --> High`   two ends, a polarity the author stated.
   *   `Effort`         ONE LABEL AND NO POLARITY — an axis title. Mermaid
   *                    happens to draw it at the low end of the axis, but
   *                    that is a rendering choice, not something the author
   *                    said.
   *   `Low -->`        a dangling arrow: a low end declared and a high end
   *                    left empty. The db obscures this by delivering the
   *                    single label "Low ⟶", arrow glyph included; splitting
   *                    the author's own source on `-->` recovers it.
   *
   * THE SINGLE LABEL IS DELIVERED IN ITS OWN FIELD, NOT AS `low`, and that
   * is gold rule R6 rather than a preference: R6 rules that a single-label
   * axis narrates as `The x-axis is labelled "LABEL"` and explicitly REJECTS
   * "treating the single label as the left end and leaving the right end
   * blank", because doing so fabricates a polarity the author never wrote.
   * Delivering it as `low` would put the fabrication one step from every
   * consumer and would ALSO make it indistinguishable from the dangling-arrow
   * form, which really does declare a low end.
   *
   * @param {string} remainder - Everything after the axis keyword
   * @param {number} lineNumber - 1-based source line, for a refusal
   * @returns {Object} `{ low, high, label }`, each a string, "" when
   *   undeclared. `label` is non-empty ONLY for the single-label form, and
   *   `low`/`high` are both "" in that case.
   */
  function readQuadrantAxis(remainder, lineNumber) {
    const parts = String(remainder).split(QUADRANT_AXIS_ARROW);
    if (parts.length > 2) {
      throwQuadrantReaderError(
        `an axis statement with more than one ${QUADRANT_AXIS_ARROW} in it`,
        lineNumber
      );
    }
    if (parts.length === 1) {
      return { low: "", high: "", label: parts[0].trim() };
    }
    return {
      low: parts[0].trim(),
      high: parts[1].trim(),
      label: "",
    };
  }

  /**
   * Read the chart's axes, quadrant labels and points out of the diagram
   * SOURCE.
   *
   * Runs ONLY after getDiagramFromText has resolved on the same string, in
   * the same queue slot — see the surface preamble. `title`, `accTitle` and
   * `accDescr` statements are SKIPPED, because the db delivers those three
   * and is the better source for them.
   *
   * @param {string} code - The caller's raw Mermaid source
   * @returns {Object} `{ xAxis, yAxis, quadrants, points }`
   */
  function readQuadrantSource(code) {
    // No encode step, unlike xychart. That surface must reproduce Mermaid's
    // encodeEntities over the raw source so its reader starts from the same
    // bytes the db would have delivered — but here the three fields the
    // reader owns cannot carry an escape at all: the lexer refuses `#word;`
    // in a point name, an axis label and a quadrant label alike (measured).
    // Encoding would therefore transform nothing, and the decode that
    // followed it would be dead code.
    const lines = String(code)
      .split("\r\n")
      .join("\n")
      .split("\r")
      .join("\n")
      .split("\n");

    let sawHeader = false;
    let inFrontmatter = false;
    let inAccBlock = false;
    let xAxis = null;
    let yAxis = null;
    const quadrants = ["", "", "", ""];
    const points = [];

    for (let i = 0; i < lines.length; i += 1) {
      const lineNumber = i + 1;
      let text = stripQuadrantComment(lines[i]).trim();

      if (inAccBlock) {
        if (text.indexOf("}") !== -1) {
          inAccBlock = false;
        }
        continue;
      }
      if (text === "") {
        continue;
      }
      // YAML frontmatter is skipped wholesale. Measured, and worth stating
      // because it is a real delivery limit rather than a shortcut: a
      // frontmatter `title:` does NOT reach getDiagramTitle on this type,
      // exactly as on flowchart, ER and class, so there is nothing here for
      // either half of the surface to read. Only the body `title` form
      // carries a title.
      if (!sawHeader && text === "---") {
        inFrontmatter = !inFrontmatter;
        continue;
      }
      if (inFrontmatter) {
        continue;
      }
      if (text.charAt(text.length - 1) === ";") {
        text = text.slice(0, -1).trim();
      }

      if (!sawHeader) {
        if (!/^quadrantChart\b/i.test(text)) {
          throwQuadrantReaderError(
            "a source that does not open with quadrantChart",
            lineNumber
          );
        }
        const tail = text.slice("quadrantChart".length).trim();
        if (tail !== "") {
          throwQuadrantReaderError(
            `an unknown word after quadrantChart: ${JSON.stringify(tail)}`,
            lineNumber
          );
        }
        sawHeader = true;
        continue;
      }

      // The db supplies all three of these; the reader only has to not choke.
      if (/^accDescr\s*\{/i.test(text)) {
        inAccBlock = text.indexOf("}") === -1;
        continue;
      }
      if (/^(accTitle|accDescr)\s*:/i.test(text)) {
        continue;
      }
      if (/^title\b/i.test(text)) {
        continue;
      }

      // classDef is RECOGNISED AND SKIPPED. This surface delivers no
      // styling, so the declaration has nothing to contribute — but it must
      // be matched explicitly, because falling through to the point branch
      // would make a perfectly legal `classDef` line a reader refusal.
      if (/^classDef\b/i.test(text)) {
        continue;
      }

      // LAST DECLARATION WINS on a repeated axis or quadrant statement, and
      // that is Mermaid's own measured behaviour rather than a choice: two
      // `x-axis` lines deliver the second, and `quadrant-1` twice delivers
      // the second. Refusing the source instead would reject something
      // Mermaid accepts and describes perfectly well.
      if (/^x-axis\b/i.test(text)) {
        xAxis = readQuadrantAxis(text.slice("x-axis".length), lineNumber);
        continue;
      }
      if (/^y-axis\b/i.test(text)) {
        yAxis = readQuadrantAxis(text.slice("y-axis".length), lineNumber);
        continue;
      }

      const quadrantMatch = QUADRANT_LABEL_LINE.exec(text);
      if (quadrantMatch) {
        quadrants[Number(quadrantMatch[1]) - 1] = quadrantMatch[2].trim();
        continue;
      }

      // Anything left must be a point line, and a point line the reader
      // cannot parse is a STOP. It is never dropped: dropping one is the
      // shipped module's defect, and a description that states a point count
      // it computed from a partial read is worse than no description.
      const pointMatch = QUADRANT_POINT_LINE.exec(text);
      if (!pointMatch) {
        throwQuadrantReaderError(
          `a statement the reader does not know: ${JSON.stringify(text.slice(0, 60))}`,
          lineNumber
        );
      }

      const quoted = pointMatch[1];
      const bare = pointMatch[2];
      const name = (quoted === undefined ? bare : quoted).trim();
      if (name === "") {
        throwQuadrantReaderError("a point line with an empty name", lineNumber);
      }

      points.push({
        name: name,
        // THE AUTHOR'S OWN STRING, verbatim: `0.850` stays `0.850` and `0.85`
        // stays `0.85`. The db cannot supply this — it delivers a laid-out
        // pixel — and a consumer that wants to print the coordinate the
        // author wrote has no other source for it.
        x: pointMatch[4],
        y: pointMatch[5],
        // The same pair as numbers, so a consumer comparing against the 0.5
        // boundary does not each parse the strings itself and disagree about
        // how.
        xValue: Number(pointMatch[4]),
        yValue: Number(pointMatch[5]),
      });
    }

    if (!sawHeader) {
      throwQuadrantReaderError(
        "a source with no quadrantChart header at all",
        null
      );
    }

    // AN UNDECLARED AXIS IS NOT AN ERROR. Measured: a quadrant chart with no
    // axis statement at all, or with only one of the two, renders correctly
    // and Mermaid simply draws no label. It is delivered as two empty
    // strings, matching the way an unlabelled quadrant is delivered, so a
    // consumer has ONE absent case across every author-text field on this
    // surface rather than a null here and an empty string there.
    //
    // A POINTLESS CHART IS ALSO LEGAL, measured — `points` may be empty and
    // that is not a refusal.
    return {
      xAxis: xAxis || { low: "", high: "", label: "" },
      yAxis: yAxis || { low: "", high: "", label: "" },
      quadrants: quadrants,
      points: points,
    };
  }

  /**
   * Read the db's own view of the same chart, for corroboration only.
   *
   * EVERY VALUE HERE IS CROSS-CHECK MATERIAL AND NONE OF IT MAY BE
   * NARRATED. It is delivered so a gate can assert that the source read and
   * the canvas agree — the one thing a source reader cannot prove about
   * itself — and for no other purpose.
   *
   * Two normalisations are applied, both mechanical and both measured:
   *
   *   THE AXIS ARRAY IS NOT FIXED AT FOUR. Mermaid delivers one entry per
   *   DECLARED end, so its length is 0, 2, 3 or 4 depending on how many
   *   arrows the author wrote. x entries carry `rotation: 0` and y entries
   *   `rotation: -90`, which discriminates them reliably, so each axis's
   *   entries are placed in its own two slots and the rest padded with "".
   *   Without that the array's meaning would depend on the source, and a
   *   positional comparison against the delivered fields would be nonsense.
   *
   *   THE POINT ARRAY IS REVERSED. Mermaid delivers points in REVERSE
   *   declaration order (measured on every probe), so they are reversed back
   *   into source order here — otherwise a positional comparison against the
   *   reader's own list would pair every point with the wrong one.
   *
   * @param {Object} db - The resolved diagram's db, read inside the slot
   * @returns {Object} `{ axisLabels, quadrantLabels, pixels, plotRect }`
   */
  function readQuadrantCrossCheck(db) {
    const data = db.getQuadrantData();
    const rawAxis = Array.isArray(data.axisLabels) ? data.axisLabels : [];
    const rawQuadrants = Array.isArray(data.quadrants) ? data.quadrants : [];
    const rawPoints = Array.isArray(data.points) ? data.points : [];

    const xLabels = [];
    const yLabels = [];
    rawAxis.forEach((label) => {
      const text = label && typeof label.text === "string" ? label.text : "";
      if (label && label.rotation === 0) {
        xLabels.push(text);
      } else {
        yLabels.push(text);
      }
    });
    const slot = (list, index) =>
      typeof list[index] === "string" ? list[index] : "";

    // The plot rectangle as the UNION of the four quadrant rectangles,
    // derived rather than assumed. It moves with the chart — a titled chart
    // reserves a title band and an untitled one does not, and a chart with
    // no axis labels reclaims their margin — so nothing here may be a
    // constant.
    let minX = null;
    let minY = null;
    let maxX = null;
    let maxY = null;
    rawQuadrants.forEach((quadrant) => {
      if (!quadrant || typeof quadrant.x !== "number") {
        return;
      }
      const right = quadrant.x + quadrant.width;
      const bottom = quadrant.y + quadrant.height;
      minX = minX === null ? quadrant.x : Math.min(minX, quadrant.x);
      minY = minY === null ? quadrant.y : Math.min(minY, quadrant.y);
      maxX = maxX === null ? right : Math.max(maxX, right);
      maxY = maxY === null ? bottom : Math.max(maxY, bottom);
    });

    return {
      axisLabels: [
        slot(xLabels, 0),
        slot(xLabels, 1),
        slot(yLabels, 0),
        slot(yLabels, 1),
      ],
      quadrantLabels: rawQuadrants.map((quadrant) =>
        quadrant && quadrant.text && typeof quadrant.text.text === "string"
          ? quadrant.text.text
          : ""
      ),
      pixels: rawPoints
        .map((point) => ({
          name:
            point && point.text && typeof point.text.text === "string"
              ? point.text.text
              : "",
          x: typeof point.x === "number" ? point.x : null,
          y: typeof point.y === "number" ? point.y : null,
        }))
        .reverse(),
      plotRect: {
        x: minX === null ? null : minX,
        y: minY === null ? null : minY,
        width: minX === null ? null : maxX - minX,
        height: minY === null ? null : maxY - minY,
      },
    };
  }

  /**
   * Normalise one resolved quadrant Diagram instance into the adapter's
   * quadrant shape.
   *
   * SAME-TICK SNAPSHOT, and on this surface it protects more than the three
   * scalars. The quadrant db is a measured singleton whose SECOND PARSE
   * REPLACES THE FIRST CHART'S ENTIRE PAYLOAD — points, axis labels and
   * quadrant labels included — and a stale Diagram handle read afterwards
   * returns the second chart's data while looking perfectly live. So the
   * crossCheck reads happen here, inside the parse's own .then, behind the
   * queue, and are copied into this function's own return object before it
   * returns. Nothing delivered references a db-owned object, and no consumer
   * may go back to the db later.
   *
   * The reader's half cannot be lost that way, because it comes from the
   * caller's own string; the source read is done inside the slot anyway, so
   * the whole function is one indivisible unit and a future editor cannot
   * accidentally split the db reads from the rest.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @param {string} code - The caller's raw source, the reader's input
   * @returns {Object} The normalised quadrant chart
   */
  function normaliseQuadrant(diagram, code) {
    const db = diagram.db;

    // WRONG-TYPE GUARD, and it earns its place: getDiagramTitle, getAccTitle
    // and getAccDescription exist on EVERY Mermaid db, so a caller that
    // hands this surface a flowchart gets three happy scalar reads and then
    // a bare `db.getQuadrantData is not a function` TypeError from inside
    // the cross-check — measured. That is a stack trace where the contract
    // promises a named refusal, so the type is checked on the one accessor
    // that discriminates, before anything is read.
    if (typeof db.getQuadrantData !== "function") {
      throwQuadrantReaderError(
        "a diagram whose db has no getQuadrantData accessor, so it is not a " +
          "quadrant chart at all",
        null
      );
    }

    // The three shared-store reads, together, first, before anything else
    // can yield. They come from Mermaid's CROSS-TYPE shared store, which
    // every parse of every type clears (register item 21).
    const rawTitle = db.getDiagramTitle() || "";
    const rawAccTitle = db.getAccTitle() || "";
    const rawAccDescription = db.getAccDescription() || "";

    // The db's own view, same slot, corroboration only.
    const crossCheck = readQuadrantCrossCheck(db);

    // Mermaid has judged the source valid; only now does the reader run.
    const read = readQuadrantSource(code);

    return {
      type: "quadrantChart",
      // ITEM 9, VERDICT C-PLACEHOLDER for this field, [OBSERVED] on all four
      // routes rather than inferred: `#quot;` is drawn as `"`, `#35;` as
      // `#`, a bare `&` as itself, and a pre-escaped `&lt;` as the literal
      // six characters. decodePlaceholders reproduces the drawing in every
      // case, and the quadrant SVG carries no foreignObject.
      title: decodePlaceholders(rawTitle),
      // NO transform on accTitle or accDescr, matching the standing
      // carve-out declared at the placeholder-decoding block near the top of
      // this file. It is deliberate on all eight surfaces and must not be
      // "completed" by a later editor.
      accTitle: rawAccTitle,
      accDescr: rawAccDescription,

      // The author's own declarations, from the source. NO DECODE: the
      // lexer refuses every escape form in these positions, so there is
      // nothing a transform could do. See the surface preamble, OQ1.
      //
      // THREE FIELDS PER AXIS, NOT TWO, and the third is gold rule R6. A
      // two-ended axis fills left/right and leaves `label` ""; a single-label
      // axis fills `label` and leaves BOTH ends "". They are different
      // declarations — the first states a polarity, the second is an axis
      // title — and R6 forbids narrating the second as though it were the
      // first. Collapsing them into left/right would also merge the
      // single-label form with the dangling `x-axis Low -->`, which really
      // does declare a low end and no high one.
      xAxis: {
        left: read.xAxis.low,
        right: read.xAxis.high,
        label: read.xAxis.label,
      },
      yAxis: {
        bottom: read.yAxis.low,
        top: read.yAxis.high,
        label: read.yAxis.label,
      },

      // Mermaid's own quadrant order, 1 to 4. An unlabelled quadrant is ""
      // rather than omitted, so the array is always length four and a
      // consumer never indexes past its end.
      quadrants: read.quadrants.slice(),

      // SOURCE ORDER, which is the order the author wrote and the order a
      // description should speak. The db reverses it.
      points: read.points,

      crossCheck: crossCheck,
    };
  }

  /**
   * Parse Mermaid quadrant chart code into the normalised quadrant shape.
   *
   * Rejects with Mermaid's own error on a parse failure, and with a distinct
   * Error whose message begins "Quadrant chart source reader" when Mermaid
   * accepted a source the reader's grammar subset cannot read. Both are
   * rejections of the returned promise; the call itself never throws
   * synchronously, so awaiting this promise is the single error path.
   *
   * SERIALISED PARSES: every parse is chained through the adapter-wide
   * queue, so it cannot replace the shared singleton's data or clear the
   * shared accessible-title store while an earlier call's snapshot is still
   * in progress. The chain advances on settlement, not success, so a
   * rejection cannot wedge it.
   *
   * @param {string} code - The Mermaid source
   * @returns {Promise<Object>} Resolves to the normalised quadrant chart
   */
  function parseQuadrant(code) {
    // Lazy quadrant self-check trigger, matching the other surfaces'
    // ordering. The check enqueues its own fixture parses first, so it holds
    // the front of the queue ahead of this call's parse.
    if (!quadrantSelfCheckStarted) {
      runQuadrantSelfCheck();
    }

    if (code === quadrantMemoCode && quadrantMemoPromise) {
      logDebug("Returning memoised quadrant parse for identical code string");
      return quadrantMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    // Per-parse trace (register item 24) - see the flowchart surface for why
    // it sits inside run and why only the code LENGTH is logged.
    const run = () => {
      const startedAt = performance.now();
      logDebug(
        `Quadrant parse entering its queue slot, ${code.length} characters`
      );
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Quadrant parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          // MERMAID HAS NOW JUDGED THE SOURCE VALID. Only here does the
          // reader run, and it runs inside this same slot.
          const chart = normaliseQuadrant(diagram, code);
          logDebug(
            `Quadrant parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return chart;
        })
        .catch((error) => {
          logDebug(
            `Quadrant parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    // Chain on settlement, not success: the queue itself never rejects (see
    // the tail below), but `run` is passed as both handlers so a future
    // change to that invariant cannot silently skip a parse.
    const result = adapterParseQueue.then(run, run);

    // Settlement-only tail — a rejected parse must not wedge the queue.
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    quadrantMemoCode = code;
    quadrantMemoPromise = result;
    return result;
  }

  /**
   * Parse the two embedded quadrant fixtures and assert the db accessor
   * names, the same-tick snapshot, the source reader's normalised shape and
   * the agreement between the two halves. Resolves true on a clean run; on
   * any failure logs ONE ERROR naming the first failed assertion, marks the
   * quadrant surface unhealthy, and resolves false. Never throws.
   *
   * BOTH FIXTURES RUN INSIDE ONE QUEUE SLOT, and the full chart is fully
   * normalised BEFORE the small one is issued. That ordering is the point,
   * and on this surface it is load-bearing beyond the three scalars: the
   * second parse replaces the first chart's WHOLE payload in the singleton
   * db, so a check that parsed both and read afterwards would be measuring
   * the second chart twice — including its crossCheck. One slot rather than
   * two is deliberate, is strictly stronger isolation, and keeps the pair
   * indivisible.
   *
   * @returns {Promise<boolean>} Resolves to the quadrant health verdict
   */
  function runQuadrantSelfCheck() {
    if (quadrantSelfCheckPromise) {
      return quadrantSelfCheckPromise;
    }
    quadrantSelfCheckStarted = true;

    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            QUADRANT_SELF_CHECK_FIXTURE_FULL
          );
        })
        .then((fullDiagram) => {
          const db = fullDiagram.db;
          // The accessor names this surface depends on, read before anything
          // else, so a Mermaid rename fails here rather than delivering "".
          const accessorsPresent =
            typeof db.getDiagramTitle === "function" &&
            typeof db.getAccTitle === "function" &&
            typeof db.getAccDescription === "function" &&
            typeof db.getQuadrantData === "function";
          // Fully normalised — including the same-tick snapshot of both the
          // scalars and the crossCheck — before the second parse begins.
          const full = normaliseQuadrant(
            fullDiagram,
            QUADRANT_SELF_CHECK_FIXTURE_FULL
          );

          return window.mermaid.mermaidAPI
            .getDiagramFromText(QUADRANT_SELF_CHECK_FIXTURE_SMALL)
            .then((smallDiagram) => {
              const small = normaliseQuadrant(
                smallDiagram,
                QUADRANT_SELF_CHECK_FIXTURE_SMALL
              );

              // THE THIRD PARSE, still inside this one slot. Each chart is
              // fully normalised before the next is issued, because the
              // quadrant db is a singleton whose next parse replaces the
              // previous chart's whole payload.
              return window.mermaid.mermaidAPI
                .getDiagramFromText(QUADRANT_SELF_CHECK_FIXTURE_SINGLE_LABEL)
                .then((singleLabelDiagram) => {
                  const singleLabel = normaliseQuadrant(
                    singleLabelDiagram,
                    QUADRANT_SELF_CHECK_FIXTURE_SINGLE_LABEL
                  );

                  // Each entry: [assertion name, predicate]. The first false
                  // predicate fails the check and is named in the single
                  // ERROR line. The predicates are EVALUATED HERE, inside the
                  // slot, so the verdict below never touches a db.
                  return [
                  [
                    "the four db accessors this surface reads exist by name",
                    accessorsPresent,
                  ],
                  [
                    "the full chart's title, accTitle and accDescr survive the " +
                      "same-tick snapshot",
                    full.title === "SelfCheck quadrant title" &&
                      full.accTitle === "SelfCheck quadrant acc title" &&
                      full.accDescr === "SelfCheck quadrant acc descr",
                  ],
                  [
                    "both axes read their two declared end labels from the " +
                      "source, with an EMPTY single-label field",
                    full.xAxis.left === "SelfCheck low x" &&
                      full.xAxis.right === "SelfCheck high x" &&
                      full.xAxis.label === "" &&
                      full.yAxis.bottom === "SelfCheck low y" &&
                      full.yAxis.top === "SelfCheck high y" &&
                      full.yAxis.label === "",
                  ],
                  [
                    "all four quadrant labels arrive in Mermaid's own 1-to-4 order",
                    full.quadrants.length === 4 &&
                      full.quadrants[0] === "SelfCheck q one" &&
                      full.quadrants[1] === "SelfCheck q two" &&
                      full.quadrants[2] === "SelfCheck q three" &&
                      full.quadrants[3] === "SelfCheck q four",
                  ],
                  [
                    "THE :::CLASS PIN: a point written `Gamma point:::big:` is " +
                      "READ, not dropped — three points arrive, in SOURCE order, " +
                      "and the classDef line is skipped rather than refused",
                    full.points.length === 3 &&
                      full.points[0].name === "Alpha point" &&
                      full.points[1].name === "Beta point" &&
                      full.points[2].name === "Gamma point",
                  ],
                  [
                    "THE AUTHORED STRING PIN: `0.80` is delivered as \"0.80\" and " +
                      "not as \"0.8\", with xValue/yValue the matching numbers",
                    full.points[1].x === "0.80" &&
                      full.points[1].y === "0.30" &&
                      full.points[1].xValue === 0.8 &&
                      full.points[1].yValue === 0.3 &&
                      full.points[0].x === "0.25" &&
                      full.points[0].y === "0.85",
                  ],
                  [
                    "trailing inline styling is discarded rather than read as " +
                      "part of the coordinate",
                    full.points[1].xValue === 0.8 && full.points[1].yValue === 0.3,
                  ],
                  [
                    "the crossCheck axis and quadrant labels agree with the " +
                      "source read, field for field",
                    full.crossCheck.axisLabels[0] === full.xAxis.left &&
                      full.crossCheck.axisLabels[1] === full.xAxis.right &&
                      full.crossCheck.axisLabels[2] === full.yAxis.bottom &&
                      full.crossCheck.axisLabels[3] === full.yAxis.top &&
                      full.crossCheck.quadrantLabels.length === 4 &&
                      full.crossCheck.quadrantLabels[0] === full.quadrants[0] &&
                      full.crossCheck.quadrantLabels[3] === full.quadrants[3],
                  ],
                  [
                    "THE R6 PIN: a SINGLE-LABEL axis delivers its label in " +
                      "`label` with BOTH ends empty, so no consumer can read it " +
                      "as a polarity the author never wrote — and the db's own " +
                      "positional array puts that same label in the first slot",
                    singleLabel.xAxis.label === "SelfCheck lone x" &&
                      singleLabel.xAxis.left === "" &&
                      singleLabel.xAxis.right === "" &&
                      singleLabel.yAxis.bottom === "SelfCheck lone low y" &&
                      singleLabel.yAxis.top === "SelfCheck lone high y" &&
                      singleLabel.yAxis.label === "" &&
                      singleLabel.crossCheck.axisLabels[0] === "SelfCheck lone x" &&
                      singleLabel.crossCheck.axisLabels[1] === "",
                  ],
                  [
                    "the crossCheck pixels are reversed back into SOURCE order " +
                      "and name the same three points",
                    full.crossCheck.pixels.length === 3 &&
                      full.crossCheck.pixels[0].name === "Alpha point" &&
                      full.crossCheck.pixels[2].name === "Gamma point",
                  ],
                  [
                    "THE PIXEL AGREEMENT PIN: every point's authored pair " +
                      "reproduces its delivered pixel through the plotRect, so " +
                      "the source read and the canvas describe one chart",
                    full.crossCheck.plotRect.width > 0 &&
                      full.crossCheck.plotRect.height > 0 &&
                      full.points.every((point, index) => {
                        const pixel = full.crossCheck.pixels[index];
                        const rect = full.crossCheck.plotRect;
                        const expectedX = rect.x + point.xValue * rect.width;
                        const expectedY =
                          rect.y + (1 - point.yValue) * rect.height;
                        return (
                          Math.abs(pixel.x - expectedX) < 0.5 &&
                          Math.abs(pixel.y - expectedY) < 0.5
                        );
                      }),
                  ],
                  [
                    "the small chart's ABSENT fields are empty strings rather " +
                      "than null, and its two points still arrive",
                    small.title === "" &&
                      small.accTitle === "" &&
                      small.accDescr === "" &&
                      small.quadrants.length === 4 &&
                      small.quadrants.every((label) => label === "") &&
                      small.points.length === 2 &&
                      small.points[0].name === "Quick win",
                  ],
                  [
                    "the small chart's own axis labels reach it, proving the " +
                      "full chart's snapshot was taken before this parse " +
                      "replaced the singleton's whole payload",
                    small.xAxis.left === "SelfCheck small low" &&
                      small.yAxis.top === "SelfCheck small top" &&
                      small.crossCheck.pixels.length === 2,
                  ],
                  [
                    "and the SINGLE-LABEL chart's own point reaches it too, so " +
                      "all three snapshots in this slot survived the two parses " +
                      "that followed them",
                    singleLabel.points.length === 1 &&
                      singleLabel.points[0].name === "Lone point" &&
                      singleLabel.crossCheck.pixels.length === 1 &&
                      singleLabel.crossCheck.pixels[0].name === "Lone point",
                  ],
                  ];
                });
            });
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    quadrantSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Quadrant self-check FAILED at assertion: ${failed[0]}. ` +
              "Either the pinned Mermaid build's quadrant internals no longer " +
              "match the 1 September 2026 measurements, or the source " +
              "reader's grammar subset has drifted; do not trust quadrant " +
              "adapter output."
          );
          quadrantHealthy = false;
          return false;
        }

        logInfo(
          "Quadrant self-check passed: accessor, snapshot, source-reader and " +
            "cross-check assertions all hold"
        );
        quadrantHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          `Quadrant self-check FAILED at assertion: both fixtures parse and read. ` +
            `The fixture run rejected: ${error && error.message}`
        );
        quadrantHealthy = false;
        return false;
      });

    return quadrantSelfCheckPromise;
  }

  /**
   * Report the quadrant surface's health, independently of the other
   * surfaces.
   * @returns {boolean|null} True or false once the quadrant self-check has
   *   run; null when it has not yet run (or not yet settled)
   */
  function isQuadrantHealthy() {
    return quadrantHealthy;
  }

  // ---------------------------------------------------------------------
  // SEQUENCE — the ninth surface, and the second read entirely from the db
  //
  // WHY THERE IS NO SOURCE READER HERE, unlike quadrant. Quadrant needed one
  // because its db delivers points as LAID-OUT PIXELS: the author's own
  // numbers are recoverable only by inverting Mermaid's private layout.
  // Sequence's db delivers no post-layout value at all — every field below is
  // the author's own text, an id, or an enumerated constant, fixed at parse
  // time before any geometry exists. There is nothing to invert and nothing
  // to round. Measured in docs/mermaid-item-70-sequence-grounding-2026-09-02.md
  // and ruled by the design seat on 3 September 2026.
  //
  // THE SHAPE THIS DELIVERY IS BUILT FOR is the gold document's rules S7-S12
  // (docs/mermaid-sequence-gold-targets-2026-09-03.md). Mermaid hands back ONE
  // ordered array carrying messages, block markers, notes, activations and the
  // autonumber directive together. This surface keeps that single order —
  // splitting it into per-kind lists would destroy the only record of where a
  // note or a block boundary sits relative to the messages — but lifts the
  // autonumber directives out, because they are a property of the diagram
  // rather than events in it. EVERY directive is lifted, as an array carrying
  // the ordinal each one starts governing at (ruling R17, 4 September 2026);
  // the single object this surface delivered until then could not represent a
  // second directive, so `autonumber off` erased the `autonumber` that
  // preceded it.
  //
  // NESTING IS POSITIONAL IN THE DB: no depth field, no parent pointer. The
  // stack below recovers it, and refuses rather than repairs.
  const SEQUENCE_ARROW_KINDS = {
    SOLID: { line: "solid", head: "arrow" },
    SOLID_OPEN: { line: "solid", head: "open" },
    DOTTED: { line: "dotted", head: "arrow" },
    DOTTED_OPEN: { line: "dotted", head: "open" },
    SOLID_CROSS: { line: "solid", head: "cross" },
    DOTTED_CROSS: { line: "dotted", head: "cross" },
    SOLID_POINT: { line: "solid", head: "async" },
    DOTTED_POINT: { line: "dotted", head: "async" },
    BIDIRECTIONAL_SOLID: { line: "solid", head: "bidirectional" },
    BIDIRECTIONAL_DOTTED: { line: "dotted", head: "bidirectional" },
  };

  // Block markers, by LINETYPE NAME. Names rather than integers everywhere
  // except the self-check, which is where the integers are pinned, so an
  // upstream renumbering fails loudly in one place instead of silently
  // remapping every arrow.
  const SEQUENCE_BLOCK_STARTS = {
    LOOP_START: "loop",
    ALT_START: "alt",
    OPT_START: "opt",
    PAR_START: "par",
    PAR_OVER_START: "par",
    CRITICAL_START: "critical",
    BREAK_START: "break",
    RECT_START: "rect",
  };
  const SEQUENCE_BLOCK_BRANCHES = {
    ALT_ELSE: "alt",
    PAR_AND: "par",
    CRITICAL_OPTION: "critical",
  };
  const SEQUENCE_BLOCK_ENDS = {
    LOOP_END: "loop",
    ALT_END: "alt",
    OPT_END: "opt",
    PAR_END: "par",
    CRITICAL_END: "critical",
    BREAK_END: "break",
    RECT_END: "rect",
  };
  const SEQUENCE_PLACEMENTS = { LEFTOF: "left", RIGHTOF: "right", OVER: "over" };

  let sequenceMemoCode = null;
  let sequenceMemoPromise = null;
  let sequenceHealthy = null;
  let sequenceSelfCheckStarted = false;
  let sequenceSelfCheckPromise = null;

  /**
   * Build the integer-to-name lookup for a db enumeration, read OFF THE DB.
   * @param {Object} enumeration - db.LINETYPE or db.PLACEMENT
   * @returns {Object} Integer-keyed map of constant names
   */
  function sequenceNamesByValue(enumeration) {
    const names = {};
    if (!enumeration) {
      return names;
    }
    Object.keys(enumeration).forEach((name) => {
      names[enumeration[name]] = name;
    });
    return names;
  }

  /**
   * Normalise one Mermaid sequence diagram into the ninth surface's delivery.
   *
   * Every field is always present — "" or [] or null rather than absent — so a
   * consumer has one absent case per field and never an undefined member.
   *
   * @param {Object} diagram - The resolved Mermaid diagram
   * @returns {Object} The normalised sequence delivery
   */
  function normaliseSequence(diagram) {
    const db = diagram.db;

    // Read the two enumerations ONCE per parse, off this db instance.
    const lineTypeNames = sequenceNamesByValue(db.LINETYPE);
    const placementNames = sequenceNamesByValue(db.PLACEMENT);

    const rawEntries = Array.isArray(db.getMessages()) ? db.getMessages() : [];
    const actorKeys = Array.isArray(db.getActorKeys()) ? db.getActorKeys() : [];
    const actorMap = db.getActors();

    // The ordinal of a message is its one-based position among ARROW entries
    // only. Notes, block markers, activations and the autonumber directive do
    // not advance it, so the number a consumer narrates is the number the
    // diagram's own autonumber draws. Register item 70 ruling R7.
    const ordinalByIndex = {};
    let messageOrdinal = 0;
    rawEntries.forEach((entry, index) => {
      const name = lineTypeNames[entry.type];
      if (SEQUENCE_ARROW_KINDS[name]) {
        messageOrdinal += 1;
        ordinalByIndex[index] = messageOrdinal;
      }
    });

    /**
     * Convert a delivered list INDEX into a message ordinal, by counting arrow
     * entries up to and including it. Used for create and destroy, which the
     * db keys by index into getMessages().
     * @param {number} index - The delivered list index
     * @returns {number|null} The one-based message ordinal, or null
     */
    function ordinalForIndex(index) {
      if (typeof index !== "number") {
        return null;
      }
      let count = 0;
      for (let i = 0; i <= index && i < rawEntries.length; i += 1) {
        if (SEQUENCE_ARROW_KINDS[lineTypeNames[rawEntries[i].type]]) {
          count += 1;
        }
      }
      return count > 0 ? count : null;
    }

    /**
     * Read a Map delivered by the db into a plain id-to-ordinal object.
     * @param {Map|null} source - getCreatedActors() or getDestroyedActors()
     * @returns {Object} Id-keyed map of message ordinals
     */
    function lifecycleOrdinals(source) {
      const out = {};
      if (source && typeof source.forEach === "function") {
        source.forEach((index, id) => {
          out[id] = ordinalForIndex(index);
        });
      }
      return out;
    }

    const createdAtById = lifecycleOrdinals(
      typeof db.getCreatedActors === "function" ? db.getCreatedActors() : null
    );
    const destroyedAtById = lifecycleOrdinals(
      typeof db.getDestroyedActors === "function" ? db.getDestroyedActors() : null
    );

    // BOXES ARE BUILT BEFORE PARTICIPANTS, because membership is delivered as
    // an INDEX into this array (ruling R15) rather than as the owning box's
    // name. `getBoxes()` is the db's own grouping and is correct for an
    // unnamed box, where `actor.box.name` is not a string at all.
    const rawBoxes = typeof db.getBoxes === "function" ? db.getBoxes() : [];
    const boxes = (Array.isArray(rawBoxes) ? rawBoxes : []).map((box) => ({
      name: decodePlaceholders(typeof box.name === "string" ? box.name : ""),
      members: Array.isArray(box.actorKeys) ? box.actorKeys.slice() : [],
    }));

    // Id to the index of the box that holds it, built once. The FIRST box
    // naming an actor wins, matching the old consumer-side reconstruction; the
    // db does not put one actor in two boxes.
    const boxIndexById = {};
    boxes.forEach((box, boxIndex) => {
      box.members.forEach((id) => {
        if (!Object.prototype.hasOwnProperty.call(boxIndexById, id)) {
          boxIndexById[id] = boxIndex;
        }
      });
    });

    const participants = actorKeys.map((key) => {
      const actor = actorMap && actorMap.get ? actorMap.get(key) : null;
      // LINKS ARE DELIVERED VERBATIM, deliberately. The decode ruling below
      // covers text Mermaid DRAWS into an SVG <text>; a link is a menu entry
      // and a URL, and a URL must never be transformed. Recorded rather than
      // left to inference — see the surface report of 3 September 2026.
      const rawLinks = actor && actor.links ? actor.links : {};
      const links = Object.keys(rawLinks).map((label) => ({
        label: label,
        url: typeof rawLinks[label] === "string" ? rawLinks[label] : "",
      }));
      return {
        id: key,
        // The DISPLAY text is `description`; `name` on the db object is the
        // declared id. Delivered under the names a consumer expects.
        name: decodePlaceholders(
          actor && typeof actor.description === "string" ? actor.description : ""
        ),
        kind:
          actor && typeof actor.type === "string" ? actor.type : "participant",
        // RULING R15, 4 September 2026: the INDEX into `boxes`, or null. This
        // replaces a `box` field carrying the owning box's NAME, which could
        // not tell "in no box" from "in an UNNAMED box" — both delivered null,
        // because an unnamed box's `actor.box.name` is not a string (sweep
        // F12, docs/mermaid-item-70-sequence-sweep-2026-09-04.md). No
        // narration was wrong on that account, because the only consumer read
        // `boxes[].members`; the field is repaired because the obvious field
        // being silently wrong is a trap for the next consumer.
        boxIndex: Object.prototype.hasOwnProperty.call(boxIndexById, key)
          ? boxIndexById[key]
          : null,
        links: links,
        createdAt:
          Object.prototype.hasOwnProperty.call(createdAtById, key) === true
            ? createdAtById[key]
            : null,
        destroyedAt:
          Object.prototype.hasOwnProperty.call(destroyedAtById, key) === true
            ? destroyedAtById[key]
            : null,
      };
    });

    // THE BLOCK STACK. Push on a start, check the top on a branch, pop on an
    // end. Every failure throws and names the entry index; nothing is
    // recovered silently, because a mis-paired block would otherwise deliver a
    // plausible tree describing a diagram nobody drew.
    const blockStack = [];
    const events = [];
    // RULING R17, 4 September 2026: EVERY directive, in source order, not one
    // field the last one overwrites. Empty array when the diagram has none.
    const autonumber = [];
    const activateFlags = [];
    const counts = {
      messages: 0,
      loops: 0,
      alternatives: 0,
      optionalSections: 0,
      parallelSections: 0,
      criticalSections: 0,
      breaks: 0,
    };
    const COUNT_KEY_FOR_BLOCK = {
      loop: "loops",
      alt: "alternatives",
      opt: "optionalSections",
      par: "parallelSections",
      critical: "criticalSections",
      break: "breaks",
    };

    rawEntries.forEach((entry, index) => {
      const name = lineTypeNames[entry.type];
      const text = typeof entry.message === "string" ? entry.message : "";

      if (name === "AUTONUMBER") {
        // THE ONLY HONEST SIGNAL. showSequenceNumbers() reads false on a
        // diagram that HAS autonumber, and getConfig().showSequenceNumbers
        // reads true on every diagram because it is the page's own Mermaid
        // config — measured, grounding § B1.5. Both were rejected.
        //
        // RULING R17: EVERY directive is delivered, each carrying the ordinal
        // of the FIRST MESSAGE IT GOVERNS. `counts.messages` is the count of
        // arrow entries seen so far in this ordered walk, so one more than it
        // is that ordinal by construction. Keeping a single overwritten object
        // made a second directive invisible: `autonumber` … `autonumber off`
        // delivered only the off, and a diagram drawing the numbers 1 and 2
        // was narrated as saying nothing about numbering at all (sweep F4).
        const directive = entry.message && typeof entry.message === "object" ? entry.message : {};
        autonumber.push({
          atOrdinal: counts.messages + 1,
          start: typeof directive.start === "number" ? directive.start : null,
          step: typeof directive.step === "number" ? directive.step : null,
          visible: directive.visible === true,
        });
        return;
      }

      const arrow = SEQUENCE_ARROW_KINDS[name];
      if (arrow) {
        counts.messages += 1;
        const ordinal = ordinalByIndex[index];
        events.push({
          kind: "message",
          ordinal: ordinal,
          from: typeof entry.from === "string" ? entry.from : null,
          to: typeof entry.to === "string" ? entry.to : null,
          text: decodePlaceholders(text),
          line: arrow.line,
          head: arrow.head,
        });
        activateFlags.push({ ordinal: ordinal, activate: entry.activate === true });
        return;
      }

      if (name === "ACTIVE_START" || name === "ACTIVE_END") {
        events.push({
          kind: name === "ACTIVE_START" ? "activate" : "deactivate",
          actor: typeof entry.from === "string" ? entry.from : null,
        });
        return;
      }

      if (name === "NOTE") {
        const placement = SEQUENCE_PLACEMENTS[placementNames[entry.placement]] || null;
        // A single-actor note arrives with from === to; there is no
        // isSpanning field, so the comparison IS the signal.
        const actors =
          entry.from === entry.to
            ? [typeof entry.from === "string" ? entry.from : null]
            : [
                typeof entry.from === "string" ? entry.from : null,
                typeof entry.to === "string" ? entry.to : null,
              ];
        events.push({
          kind: "note",
          placement: placement,
          actors: actors,
          text: decodePlaceholders(text),
        });
        return;
      }

      const startKind = SEQUENCE_BLOCK_STARTS[name];
      if (startKind) {
        blockStack.push({ block: startKind, index: index });
        const countKey = COUNT_KEY_FOR_BLOCK[startKind];
        if (countKey) {
          counts[countKey] += 1;
        }
        const startEvent = {
          kind: "blockStart",
          block: startKind,
          label: decodePlaceholders(text),
        };
        if (name === "PAR_OVER_START") {
          // MEASURED UNREACHABLE on this build (3 September 2026): `par over
          // A,B: …` and `par over Label` both deliver PAR_START with the word
          // "over" swallowed into the label. The mapping is kept anyway so a
          // future build emitting 32 is delivered rather than refused as an
          // unknown integer; the flag is therefore UNEXERCISED, not proven.
          startEvent.parOver = true;
        }
        events.push(startEvent);
        return;
      }

      const branchKind = SEQUENCE_BLOCK_BRANCHES[name];
      if (branchKind) {
        const top = blockStack[blockStack.length - 1];
        if (!top || top.block !== branchKind) {
          throw new Error(
            `Sequence block structure is inconsistent: a ${name} branch at entry ` +
              `${index} inside ${top ? `a ${top.block} block` : "no block"}`
          );
        }
        events.push({
          kind: "blockBranch",
          block: branchKind,
          label: decodePlaceholders(text),
        });
        return;
      }

      const endKind = SEQUENCE_BLOCK_ENDS[name];
      if (endKind) {
        const top = blockStack.pop();
        if (!top || top.block !== endKind) {
          throw new Error(
            `Sequence block structure is inconsistent: a ${name} at entry ` +
              `${index} closing ${top ? `a ${top.block} block` : "no open block"}`
          );
        }
        events.push({ kind: "blockEnd", block: endKind });
        return;
      }

      // An integer this surface has no mapping for is a STOP carrying the
      // integer, never a dropped event: a silently skipped entry would take a
      // message's neighbours with it and no consumer could tell.
      throw new Error(
        `Sequence delivered an unmapped LINETYPE ${entry.type}` +
          `${name ? ` (${name})` : ""} at entry ${index}`
      );
    });

    if (blockStack.length > 0) {
      throw new Error(
        `Sequence block structure is inconsistent: ${blockStack.length} block(s) ` +
          `left open at the last entry, the outermost a ${blockStack[0].block} ` +
          `opened at entry ${blockStack[0].index}`
      );
    }

    return {
      type: "sequence",
      // THE THREE SHARED-STORE FIELDS. Read here, inside the same slot and
      // the same .then as the payload, because Mermaid keeps the diagram
      // title, accessible title and accessible description in ONE
      // module-scoped store shared by every diagram type and cleared by every
      // parse (register item 21; measured for sequence at grounding § B3,
      // where a second parse overwrote the first handle's title in both
      // orders while its actors and messages survived untouched).
      title: decodePlaceholders(
        typeof db.getDiagramTitle === "function" ? db.getDiagramTitle() || "" : ""
      ),
      // accTitle and accDescr take NO transform, on this surface as on every
      // other — the standing carve-out documented at the top of this file.
      accTitle:
        typeof db.getAccTitle === "function" ? db.getAccTitle() || "" : "",
      accDescr:
        typeof db.getAccDescription === "function"
          ? db.getAccDescription() || ""
          : "",
      participants: participants,
      boxes: boxes,
      autonumber: autonumber,
      events: events,
      counts: counts,
      // Delivered for derivation checks only, never narrated: the message
      // objects' own activate flag, which differs between the two activation
      // spellings while the ACTIVE_START/ACTIVE_END events do not.
      crossCheck: { activateFlags: activateFlags },
    };
  }

  /**
   * Parse a sequence diagram and deliver the normalised shape.
   *
   * Same contract as the other eight surfaces: the PROMISE is memoised on the
   * code string, the memo sits in front of the adapter-wide queue, and every
   * db read happens inside this call's own queue slot.
   *
   * @param {string} code - The Mermaid sequence source
   * @returns {Promise<Object>} Resolves to the normalised delivery
   */
  function parseSequence(code) {
    if (!sequenceSelfCheckStarted) {
      runSequenceSelfCheck();
    }

    if (code === sequenceMemoCode && sequenceMemoPromise) {
      logDebug("Returning memoised sequence parse for identical code string");
      return sequenceMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    const run = () => {
      const startedAt = performance.now();
      logDebug(
        `Sequence parse entering its queue slot, ${code.length} characters`
      );
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Sequence parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const sequence = normaliseSequence(diagram);
          logDebug(
            `Sequence parse delivered after ${Math.round(performance.now() - startedAt)}ms`
          );
          return sequence;
        })
        .catch((error) => {
          logDebug(
            `Sequence parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    const result = adapterParseQueue.then(run, run);
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    sequenceMemoCode = code;
    sequenceMemoPromise = result;
    return result;
  }

  /**
   * Self-check fixture: a title and both accessible fields, TWO autonumber
   * directives, a NAMED box holding an actor-kind and a participant-kind
   * declaration, an UNNAMED box holding one participant, a created
   * participant belonging to no box, ONE MESSAGE OF EACH OF THE TEN ARROW
   * FORMS, a note spanning two actors, and an alt with an else.
   *
   * THE SECOND BOX AND THE SECOND DIRECTIVE WERE ADDED 4 SEPTEMBER 2026,
   * with rulings R15 and R17, and each is the only thing that can catch its
   * own defect. The unnamed box gives `boxIndex` a member whose owning box
   * has no name — the case the old `box` NAME field could not tell from "in
   * no box", because both delivered null (sweep F12). The second directive,
   * `autonumber off` after two messages, gives the array a second element at
   * `atOrdinal` 3 — the case the old single overwritten object could not
   * represent at all, and the one that made a diagram drawing numbers 1 and 2
   * narrate as saying nothing about numbering (sweep F4). A fixture with one
   * box and one directive passes an assertion over either shape, which is why
   * neither was enough.
   *
   * The ten arrow forms are the point. The module this surface replaces reads
   * arrows with a regex whose greedy sender class swallows a hyphen, so an
   * unspaced two-dash arrow degrades and both bidirectional forms are dropped
   * entirely (grounding § A4.5). Every form is written UNSPACED here, which is
   * exactly the shape that defeated the regex, so if a Mermaid upgrade ever
   * changed the arrow lexer this check fails loudly rather than the surface
   * quietly reproducing the defect it exists to remove.
   *
   * ASCII only, every string distinctive, so a cross-delivery from another
   * diagram NAMES ITS SOURCE rather than merely looking wrong.
   */
  const SEQUENCE_SELF_CHECK_FIXTURE = [
    "sequenceDiagram",
    "    title SelfCheck sequence title",
    "    accTitle: SelfCheck sequence acc title",
    "    accDescr: SelfCheck sequence acc descr",
    "    autonumber 3 2",
    "    box SelfCheck box",
    "        actor SA as SelfCheck actor",
    "        participant SB as SelfCheck bee",
    "    end",
    "    box rgb(210,220,230)",
    "        participant SC as SelfCheck cee",
    "    end",
    "    create participant SD as SelfCheck dee",
    "    SA->>SD: SelfCheck created",
    "    SA->SB: SelfCheck solid open",
    "    autonumber off",
    "    SA->>SB: SelfCheck solid arrow",
    "    SA-->SB: SelfCheck dotted open",
    "    SA-->>SB: SelfCheck dotted arrow",
    "    SA-xSB: SelfCheck solid cross",
    "    SA--xSB: SelfCheck dotted cross",
    "    SA-)SB: SelfCheck solid async",
    "    SA--)SB: SelfCheck dotted async",
    "    SA<<->>SB: SelfCheck solid bidi",
    "    SA<<-->>SB: SelfCheck dotted bidi",
    "    Note over SA,SB: SelfCheck note",
    "    alt SelfCheck alt cond",
    "        SA->>SC: SelfCheck alt yes",
    "    else SelfCheck else cond",
    "        SA->>SC: SelfCheck alt no",
    "    end",
  ].join("\n");

  /**
   * Parse the embedded fixture and assert every delivered field against known
   * values. Resolves true on a clean run; on any failure logs ONE ERROR naming
   * the first failed assertion, marks the sequence surface unhealthy, and
   * resolves false. Never throws.
   *
   * @returns {Promise<boolean>} Resolves to the sequence health verdict
   */
  function runSequenceSelfCheck() {
    if (sequenceSelfCheckPromise) {
      return sequenceSelfCheckPromise;
    }
    sequenceSelfCheckStarted = true;

    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            SEQUENCE_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;
          const accessorsPresent =
            typeof db.getActorKeys === "function" &&
            typeof db.getActors === "function" &&
            typeof db.getBoxes === "function" &&
            typeof db.getMessages === "function" &&
            typeof db.getCreatedActors === "function" &&
            typeof db.getDestroyedActors === "function" &&
            typeof db.getDiagramTitle === "function" &&
            typeof db.getAccTitle === "function" &&
            typeof db.getAccDescription === "function";

          // THE INTEGERS ARE PINNED HERE AND NOWHERE ELSE. Everything above
          // maps by NAME, so this is the single place an upstream renumbering
          // is caught.
          const lt = db.LINETYPE || {};
          const pl = db.PLACEMENT || {};
          const integersPinned =
            lt.SOLID === 0 &&
            lt.DOTTED === 1 &&
            lt.NOTE === 2 &&
            lt.SOLID_CROSS === 3 &&
            lt.DOTTED_CROSS === 4 &&
            lt.SOLID_OPEN === 5 &&
            lt.DOTTED_OPEN === 6 &&
            lt.SOLID_POINT === 24 &&
            lt.DOTTED_POINT === 25 &&
            lt.AUTONUMBER === 26 &&
            lt.BIDIRECTIONAL_SOLID === 33 &&
            lt.BIDIRECTIONAL_DOTTED === 34 &&
            pl.LEFTOF === 0 &&
            pl.RIGHTOF === 1 &&
            pl.OVER === 2;

          const rawEntryCount = Array.isArray(db.getMessages())
            ? db.getMessages().length
            : -1;

          const delivery = normaliseSequence(diagram);
          const messages = delivery.events.filter((e) => e.kind === "message");
          const heads = messages.map((m) => m.line + "/" + m.head).join(" ");

          return [
            [
              "the nine db accessors this surface reads exist by name",
              accessorsPresent,
            ],
            [
              "db.LINETYPE and db.PLACEMENT still carry the 3 September 2026 " +
                "integers for every constant this surface maps",
              integersPinned,
            ],
            [
              "the title and both accessible fields survive the read",
              delivery.title === "SelfCheck sequence title" &&
                delivery.accTitle === "SelfCheck sequence acc title" &&
                delivery.accDescr === "SelfCheck sequence acc descr",
            ],
            [
              "four participants arrive in declaration order, with display " +
                "names and kinds",
              delivery.participants.length === 4 &&
                delivery.participants[0].id === "SA" &&
                delivery.participants[0].name === "SelfCheck actor" &&
                delivery.participants[0].kind === "actor" &&
                delivery.participants[1].id === "SB" &&
                delivery.participants[1].kind === "participant" &&
                delivery.participants[2].id === "SC" &&
                delivery.participants[3].name === "SelfCheck dee",
            ],
            [
              "RULING R15: boxIndex is the INDEX of the owning box — 0 for " +
                "the boxed actor and its neighbour, 1 for the member of the " +
                "UNNAMED box, and null for the participant in no box",
              delivery.participants[0].boxIndex === 0 &&
                delivery.participants[1].boxIndex === 0 &&
                delivery.participants[2].boxIndex === 1 &&
                delivery.participants[3].boxIndex === null &&
                Object.prototype.hasOwnProperty.call(
                  delivery.participants[0],
                  "box"
                ) === false,
            ],
            [
              "two boxes arrive in declaration order — the named one with its " +
                "two members, the unnamed one with an EMPTY NAME and its one " +
                "member",
              delivery.boxes.length === 2 &&
                delivery.boxes[0].name === "SelfCheck box" &&
                delivery.boxes[0].members.length === 2 &&
                delivery.boxes[0].members[0] === "SA" &&
                delivery.boxes[0].members[1] === "SB" &&
                delivery.boxes[1].name === "" &&
                delivery.boxes[1].members.length === 1 &&
                delivery.boxes[1].members[0] === "SC",
            ],
            [
              "the created participant carries message ordinal one, converted " +
                "from the delivered list index, and nothing is destroyed",
              delivery.participants[3].createdAt === 1 &&
                delivery.participants[3].destroyedAt === null &&
                delivery.participants[0].createdAt === null,
            ],
            [
              "RULING R17: BOTH autonumber directives arrive, in source " +
                "order, at atOrdinal 1 and 3 — the first with its start and " +
                "step, the second the trailing `off`",
              Array.isArray(delivery.autonumber) &&
                delivery.autonumber.length === 2 &&
                delivery.autonumber[0].atOrdinal === 1 &&
                delivery.autonumber[0].start === 3 &&
                delivery.autonumber[0].step === 2 &&
                delivery.autonumber[0].visible === true &&
                delivery.autonumber[1].atOrdinal === 3 &&
                delivery.autonumber[1].start === null &&
                delivery.autonumber[1].step === null &&
                delivery.autonumber[1].visible === false,
            ],
            [
              "THE TEN ARROW FORMS: each unspaced form is typed distinctly, in " +
                "source order, and none degrades to another",
              heads ===
                "solid/arrow solid/open solid/arrow dotted/open dotted/arrow " +
                  "solid/cross dotted/cross solid/async dotted/async " +
                  "solid/bidirectional dotted/bidirectional solid/arrow solid/arrow",
            ],
            [
              "the note spans two actors, with its placement and text",
              delivery.events.filter((e) => e.kind === "note").length === 1 &&
                delivery.events.find((e) => e.kind === "note").placement ===
                  "over" &&
                delivery.events.find((e) => e.kind === "note").actors.length ===
                  2 &&
                delivery.events.find((e) => e.kind === "note").actors[0] ===
                  "SA" &&
                delivery.events.find((e) => e.kind === "note").text ===
                  "SelfCheck note",
            ],
            [
              "the alt arrives as a balanced start, branch and end, with both " +
                "conditions",
              delivery.events.filter((e) => e.kind === "blockStart").length ===
                1 &&
                delivery.events.find((e) => e.kind === "blockStart").block ===
                  "alt" &&
                delivery.events.find((e) => e.kind === "blockStart").label ===
                  "SelfCheck alt cond" &&
                delivery.events.find((e) => e.kind === "blockBranch").label ===
                  "SelfCheck else cond" &&
                delivery.events.filter((e) => e.kind === "blockEnd").length === 1,
            ],
            [
              "events.length and counts.messages are what the source declares, " +
                "and NEITHER autonumber directive is an event",
              rawEntryCount === 19 &&
                delivery.events.length === 17 &&
                delivery.counts.messages === 13 &&
                messages.length === 13,
            ],
            [
              "the structure counts read one alternative and nothing else",
              delivery.counts.loops === 0 &&
                delivery.counts.alternatives === 1 &&
                delivery.counts.optionalSections === 0 &&
                delivery.counts.parallelSections === 0 &&
                delivery.counts.criticalSections === 0 &&
                delivery.counts.breaks === 0,
            ],
            [
              "the crossCheck carries one activate flag per message, ordinals " +
                "one to thirteen, and none is set in this fixture",
              delivery.crossCheck.activateFlags.length === 13 &&
                delivery.crossCheck.activateFlags[0].ordinal === 1 &&
                delivery.crossCheck.activateFlags[12].ordinal === 13 &&
                delivery.crossCheck.activateFlags.every(
                  (f) => f.activate === false
                ),
            ],
          ];
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    sequenceSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Sequence self-check FAILED at assertion: ${failed[0]}. ` +
              "Either the pinned Mermaid build's sequence internals no longer " +
              "match the 2 September 2026 census, or this surface's mapping " +
              "has drifted; do not trust sequence adapter output."
          );
          sequenceHealthy = false;
          return false;
        }

        logInfo(
          "Sequence self-check passed: accessor, enumeration, arrow-form, " +
            "block-balance and lifecycle assertions all hold"
        );
        sequenceHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          "Sequence self-check FAILED at assertion: the fixture parses and " +
            `reads. The fixture run rejected: ${error && error.message}`
        );
        sequenceHealthy = false;
        return false;
      });

    return sequenceSelfCheckPromise;
  }

  /**
   * Report the sequence surface's health, independently of the other
   * surfaces.
   * @returns {boolean|null} True or false once the sequence self-check has
   *   run; null when it has not yet run (or not yet settled)
   */
  function isSequenceHealthy() {
    return sequenceHealthy;
  }

  // ---------------------------------------------------------------------
  // BLOCK — the tenth surface, and the third read entirely from the db
  //
  // WHY THERE IS NO SOURCE READER HERE, unlike xychart and quadrant. Every
  // fact the canvas draws is in the db: ids, labels, shape names, nesting,
  // per-composite column declarations, spans, spaces and their widths, edge
  // endpoints, edge labels, edge arrow kinds, block-arrow directions, class
  // names, class definitions and inline styles. Three facts live in the
  // source and NOT in the db, and a sighted reader is given none of them
  // either — a frontmatter `title:` is discarded by the db, by Mermaid's
  // shared store AND by the canvas; the link spellings `---`, `-->` and
  // `<-->` are drawn identically at the markers; and an author's own
  // accTitle/accDescr is unauthorable, being a hard parse error. So there is
  // nothing for a source reader to recover. Measured in
  // docs/mermaid-item-80-census-1-2026-09-05.md §§ Q4, Q5 and Q9. This is the
  // SEQUENCE answer, not the quadrant one.
  //
  // NO title, accTitle OR accDescr FIELD — a MEASURED ABSENCE, 5 September
  // 2026, not an omission (census § Q5 and its CONTRADICTION 2). The block db
  // carries NO COMMON TRIO AT ALL: `getDiagramTitle`, `getAccTitle` and
  // `getAccDescription` are `undefined` on it, on every one of the census's
  // eight parsed probes, and `Object.keys(diagram)` has no title-shaped member
  // either. `accTitle:` and `accDescr:` are HARD PARSE ERRORS in this grammar
  // — the whole diagram fails to render — and a frontmatter `title:` reaches
  // neither the db, nor the shared store, nor the canvas, on a read route
  // positively controlled in the same session. A field here would therefore be
  // a FICTION: permanently empty, and implying an author route that does not
  // exist. Do not "complete" the shape by adding them.
  //
  // THE DECODE IS decodeAuthorText ON BOTH LABEL KINDS, and each half was
  // measured rather than inherited from the other. Block labels: the census's
  // § Q6 read nine probes at securityLevel "strict" and found a
  // <foreignObject> HTML subtree on every one, with ZERO <text> elements, and
  // decodeAuthorText agreeing with the canvas on all four author-typed
  // character references where decodePlaceholders disagreed on three. EDGE
  // labels were measured SEPARATELY in this session, 5 September 2026, because
  // the block-label answer does not transfer: on the census's P5 rendered at
  // strict the SVG carries 10 <foreignObject> and 0 <text>, the one labelled
  // edge's text sits in 1 foreignObject and 0 SVG text, and its host chain is
  // g.edgeLabel > g.label > foreignObject > div > span.edgeLabel. A second
  // probe confirmed the bytes: an edge label written `Amp &amp; edge` draws
  // `Amp & edge` and `Quot &quot;x&quot; edge` draws `Quot "x" edge`, which is
  // decodeAuthorText's output and not decodePlaceholders'. Both halves take
  // the same transform, for the same measured reason.
  //
  // THE DB IS A SHARED SINGLETON, AND THE WHOLE PAYLOAD CROSSES — this is the
  // register item 21 hazard in its strongest form. Census § Q8 measured
  // `dbA === dbB` true across two parses, with the first handle's getters
  // returning the SECOND diagram's blocks afterwards. Unlike sequence, where
  // only the shared scalar trio crosses, block has no per-instance half at
  // all. Every read below therefore happens inside this parse's own queue slot
  // and is copied into the adapter's own objects in the SAME TICK, before the
  // slot ends. See the eager snapshot in normaliseBlock.
  //
  // A RENDER MUTATES THE OBJECTS THE DB HANDS OUT (census § Q10), adding a
  // pixel `size` and a LIVE d3 selection holding DOM nodes, plus an
  // `intersect` function. That is why the copy below takes a NAMED KEY LIST
  // and must never become a structured clone of the db's block: a clone would
  // drag a d3 selection and a function across, and a later consumer would be
  // reading post-layout geometry it must never narrate. Nothing post-layout is
  // delivered by this surface at all — there is no crossCheck field, because
  // there is no authored value to corroborate against a laid-out one. `size`
  // is cross-check material only, and this surface does not carry it.
  //
  // WHAT `columns` MEANS HERE, and why getColumns is never called. Census § Q2:
  // `getColumns(id)` is a LAYOUT CONVENIENCE, not the author's declaration — it
  // returns `children.length` for a composite the author left alone, so a
  // two-child `block:grp` reports 2 whether the author wrote `columns 2` or
  // wrote nothing at all. The declaration is the block's OWN `columns` key,
  // which a nested composite carries only when declared and root always
  // carries, defaulting to -1. Both -1 and absent deliver null here, meaning
  // "not declared", so a narration can say "laid out in two columns" only when
  // the author said so.
  const BLOCK_COLUMNS_UNSET = -1;

  // The db's own `type` string for an empty cell. Named because the width
  // reconciliation in copyBlock branches on it, and a bare string literal in
  // that branch would read as an arbitrary choice rather than as the db's own
  // vocabulary. Delivered verbatim as the block's `shape`.
  const BLOCK_SHAPE_SPACE = "space";

  // Every delivered space cell spans exactly ONE column. Measured 13 September
  // 2026 across `space`, `space:1`, `space:2`, `space:3` and `space:2 space`,
  // the gap width read off the canvas against a control's own column centres
  // (register item 80, unruled edge U1). The db hands out one cell per column
  // the gap occupies, so the run's total is the CELL COUNT and never a sum of
  // the `width` values — which carry the run's declared K on every one of its
  // cells.
  const BLOCK_SPACE_COLUMNS_PER_CELL = 1;

  // The nine keys a delivered block carries, in order. Named as a constant
  // because the self-check asserts the delivered key set EXACTLY against it:
  // that is the assertion which catches a stray `size` from a render, and any
  // future field added here without a field-manifest row.
  const BLOCK_DELIVERED_KEYS = Object.freeze([
    "id",
    "label",
    "shape",
    "children",
    "widthInColumns",
    "columns",
    "classes",
    "styles",
    "directions",
  ]);

  let blockMemoCode = null;
  let blockMemoPromise = null;
  let blockHealthy = null;
  let blockSelfCheckStarted = false;
  let blockSelfCheckPromise = null;

  /**
   * Read a block's OWN declared column count.
   *
   * NEVER getColumns(id) — see the surface comment above. Absent and the
   * sentinel -1 both mean "the author declared nothing" and both deliver null,
   * so a consumer has ONE absent case rather than two.
   *
   * @param {Object|null} raw - A db block object, or null
   * @returns {number|null} The declared count, or null when undeclared
   */
  function blockDeclaredColumns(raw) {
    if (!raw || !Object.prototype.hasOwnProperty.call(raw, "columns")) {
      return null;
    }
    const value = raw.columns;
    if (typeof value !== "number" || value === BLOCK_COLUMNS_UNSET) {
      return null;
    }
    return value;
  }

  /**
   * Copy ONE db block into this surface's own object, recursing into children.
   *
   * THE KEY LIST IS CLOSED AND THAT IS THE POINT (census § Q10). Only the nine
   * keys in BLOCK_DELIVERED_KEYS are read; nothing is spread, assigned wholesale
   * or cloned, so a `size` and a live d3 selection added by a render cannot
   * cross into the delivery even if this runs after one.
   *
   * A SPACE CELL'S SPAN IS ONE COLUMN, AND `width` IS NOT ITS SPAN.
   * CORRECTED 13 September 2026 (register item 80, unruled edge U1). This
   * comment previously read: "Both are the author's declared span in columns,
   * so both arrive here under the single delivered name `widthInColumns`",
   * and the code mapped `width` onto `widthInColumns` for a space cell. THAT
   * WAS WRONG, and surface contradiction C1 recorded the mapping as the
   * resolution of a field-name gap when it was in fact a value error.
   *
   * MEASURED, six sources on the pinned build, the column count read off the
   * CANVAS against a same-width control's own column centres rather than from
   * pixels: `space` and `space:1` deliver ONE cell of width 1 and draw a
   * ONE-column gap; `space:2` delivers TWO cells EACH of width 2 and draws a
   * TWO-column gap; `space:3` delivers THREE cells each of width 3 and draws a
   * THREE-column gap; `space:2 space` delivers three cells and draws three
   * columns. So the db hands out ONE CELL PER COLUMN THE GAP OCCUPIES, and
   * `width` is the RUN'S declared K repeated on each of the K cells — never
   * that cell's own span. Mapping it onto `widthInColumns` gave every cell of
   * a `space:2` a span of two, consumed four columns where the canvas draws
   * two, and pushed the following block onto a row it is not on.
   *
   * A DECLARED BLOCK is unaffected: `wide["W"]:3` carries `widthInColumns: 3`
   * on the block itself and is read straight through. `width` is now read
   * NOWHERE — it was only ever present on space cells, and its value is not a
   * span.
   *
   * ONE TRAP THE COPY STILL PRESERVES, because repairing it would hide the
   * db's own behaviour from a consumer that has to know it: a space block's
   * `label` is its OWN GENERATED PARENT ID, which is machine text,
   * non-deterministic between parses, and must never be spoken.
   *
   * @param {Object} raw - A db block object
   * @returns {Object} The delivered block
   */
  function copyBlock(raw) {
    const id = typeof raw.id === "string" ? raw.id : "";

    // LABEL. decodeAuthorText, per the ruling above. A block whose db label is
    // ABSENT delivers the id as the db gives it — and it should be recorded
    // which case the db actually produces, because the answer is "none of the
    // delivered ones". Measured 5 September 2026 across four sources: every
    // leaf, every space block and every composite carries a `label` key. A
    // composite's is the EMPTY STRING, not the id and not absent, so it is
    // delivered as "" and the narration module owns the fallback phrase. Only
    // ROOT has no label, and root is never delivered as a block. The fallback
    // is therefore a defence, not a live path.
    const label =
      typeof raw.label === "string" ? decodeAuthorText(raw.label) : id;

    // A SPACE CELL DEFAULTS TO ONE COLUMN when the db gives it no
    // `widthInColumns`, which on this build is every time. The default is
    // stated rather than the raw key being read through to null, because a
    // consumer laying out a grid has to consume SOMETHING for a cell the
    // canvas draws a column for, and 1 is what the canvas draws. `raw.width`
    // is deliberately not consulted — see the block comment above.
    const widthInColumns =
      typeof raw.widthInColumns === "number"
        ? raw.widthInColumns
        : raw.type === BLOCK_SHAPE_SPACE
          ? BLOCK_SPACE_COLUMNS_PER_CELL
          : null;

    return {
      id: id,
      label: label,
      // THE DB'S OWN TYPE STRING, VERBATIM. Naming the vocabulary — deciding
      // that `stadium` is spoken one way and `lean_right` another — is a later
      // session's table, and inventing one here would put a wording decision
      // in the adapter where no fixture could reach it.
      shape: typeof raw.type === "string" ? raw.type : "",
      // [] FOR A LEAF, so the shape is uniform and a consumer never branches
      // on the presence of a key. A leaf carries no `children` key at all on
      // the db; a space block carries an empty array.
      children: Array.isArray(raw.children) ? raw.children.map(copyBlock) : [],
      widthInColumns: widthInColumns,
      columns: blockDeclaredColumns(raw),
      // Assigned class NAMES, and raw declaration strings, each present on the
      // db only when something was assigned. Both are the AUTHOR'S OWN
      // declarations rather than computed values, so unlike `size` they are
      // honest to read — but they are paint, and whether paint is ever
      // narrated is the presentation standard's question, not this file's.
      classes: Array.isArray(raw.classes) ? raw.classes.slice() : [],
      styles: Array.isArray(raw.styles) ? raw.styles.slice() : [],
      // AN ARRAY FOR block_arrow SHAPES, [] OTHERWISE. Measured 5 September
      // 2026: `ar1<["Right"]>(right)` delivers ["right"] and `(x)` delivers
      // ["x"], while every other kind carries `directions` as an OWN KEY
      // HOLDING undefined — invisible to JSON.stringify, which is why it was
      // read with Object.keys. A space block has no such key at all.
      directions: Array.isArray(raw.directions) ? raw.directions.slice() : [],
    };
  }

  /**
   * Snapshot the classDef table.
   *
   * The db delivers a MAP keyed by class name, whose values are db-owned
   * objects; this returns a plain object keyed the same way, with each entry's
   * arrays copied, so nothing in the delivery references anything the next
   * parse can replace. A Map is not delivered because the shape a consumer
   * reads should not depend on a container type the db happens to have chosen.
   *
   * @param {Map|null} rawClasses - db.getClasses()
   * @returns {Object} Class-name-keyed table of { id, styles, textStyles }
   */
  function copyBlockClasses(rawClasses) {
    const table = {};
    if (!rawClasses || typeof rawClasses.forEach !== "function") {
      return table;
    }
    rawClasses.forEach((value, name) => {
      table[name] = {
        id: value && typeof value.id === "string" ? value.id : String(name),
        styles: value && Array.isArray(value.styles) ? value.styles.slice() : [],
        textStyles:
          value && Array.isArray(value.textStyles) ? value.textStyles.slice() : [],
      };
    });
    return table;
  }

  /**
   * Normalise one Mermaid block diagram into the tenth surface's delivery.
   *
   * EAGER SNAPSHOT (the singleton defence, census § Q8): every db accessor is
   * called ONCE here, inside the parse's own .then and behind the adapter-wide
   * queue, and each result is mapped into this adapter's own objects in the
   * same tick. Nothing in the returned object references a db-owned object, and
   * no consumer may ever go back to the db later — on this type a second parse
   * replaces the WHOLE payload, not merely the shared scalars.
   *
   * Every field is always present — "" or [] or null rather than absent — so a
   * consumer has one absent case per field and never an undefined member.
   *
   * @param {Object} diagram - The resolved Diagram from getDiagramFromText
   * @returns {Object} The normalised block delivery
   */
  function normaliseBlock(diagram) {
    const db = diagram.db;

    // The four reads. Everything below maps these and nothing else.
    // `getBlocks()` is ROOT'S CHILDREN as a tree, in declaration order, with
    // nesting preserved to every depth (census § Q1). `getBlocksFlat()` is the
    // same objects in a depth-first pre-order walk with ROOT FIRST, and it is
    // read here for one reason only: root's own `columns` key, which is the
    // author's top-level declaration and is on no other object.
    const rawBlocks = db.getBlocks();
    const rawFlat = db.getBlocksFlat();
    const rawEdges = db.getEdges();
    const rawClasses = db.getClasses();

    const rawRoot = Array.isArray(rawFlat) && rawFlat.length > 0 ? rawFlat[0] : null;

    const blocks = (Array.isArray(rawBlocks) ? rawBlocks : []).map(copyBlock);

    const edges = (Array.isArray(rawEdges) ? rawEdges : []).map((edge) => ({
      // The id is COMPOSED BY MERMAID as `<n>-<start>-<end>` and the endpoints
      // are the AUTHOR'S OWN ids (census § Q4), so an edge is quotable against
      // the blocks above without a lookup table.
      id: typeof edge.id === "string" ? edge.id : "",
      start: typeof edge.start === "string" ? edge.start : null,
      end: typeof edge.end === "string" ? edge.end : null,
      // decodeAuthorText, on the foreignObject measurement recorded at the top
      // of this surface. An unlabelled edge delivers "" from the db, not
      // undefined or null, and "" is passed through unchanged.
      label: typeof edge.label === "string" ? decodeAuthorText(edge.label) : "",
      // THE ARROW-TYPE STRINGS ARE DELIVERED VERBATIM AND ARE FAITHFUL, which
      // is worth stating because they look lossy. `---` and `<-->` are both
      // typed `arrow_point` at the end and `arrow_open` at the start, exactly
      // as a plain `-->` is — and the CANVAS AGREES: rendered at strict, the
      // plain `---` carries the same `marker-end` and a null `marker-start` as
      // `-->`, so the db is a truthful record of what is drawn rather than a
      // dropped distinction (census § Q4). Only `--o` and `--x` draw
      // differently, and only those two are distinguished here.
      arrowTypeStart:
        typeof edge.arrowTypeStart === "string" ? edge.arrowTypeStart : null,
      arrowTypeEnd:
        typeof edge.arrowTypeEnd === "string" ? edge.arrowTypeEnd : null,
    }));

    return {
      // `diagramType` rather than `type`, because `type` is this surface's
      // per-block SHAPE key and one word cannot honestly mean both. Named by
      // the design seat's dispatch of 5 September 2026; it is the only surface
      // of the ten whose discriminator is spelt this way, and the field
      // manifest carries it under that name.
      diagramType: "block",
      blocks: blocks,
      rootColumns: blockDeclaredColumns(rawRoot),
      edges: edges,
      classes: copyBlockClasses(rawClasses),
    };
  }

  /**
   * Parse a block diagram and deliver the normalised shape.
   *
   * Same contract as the other nine surfaces: the PROMISE is memoised on the
   * code string, the memo sits in front of the adapter-wide queue, and every db
   * read happens inside this call's own queue slot. On this type the queue is
   * load-bearing for the payload itself and not only for the shared scalars —
   * the db is a singleton whose whole contents a concurrent parse replaces.
   *
   * @param {string} code - The Mermaid block source
   * @returns {Promise<Object>} Resolves to the normalised delivery
   */
  function parseBlock(code) {
    if (!blockSelfCheckStarted) {
      runBlockSelfCheck();
    }

    if (code === blockMemoCode && blockMemoPromise) {
      logDebug("Returning memoised block parse for identical code string");
      return blockMemoPromise;
    }

    if (
      !window.mermaid ||
      !window.mermaid.mermaidAPI ||
      typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
    ) {
      return Promise.reject(
        new Error(
          "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
        )
      );
    }

    const run = () => {
      const startedAt = performance.now();
      logDebug(`Block parse entering its queue slot, ${code.length} characters`);
      return window.mermaid.mermaidAPI
        .getDiagramFromText(code)
        .then((diagram) => {
          logDebug(
            `Block parse resolved after ${Math.round(performance.now() - startedAt)}ms, normalising`
          );
          const block = normaliseBlock(diagram);
          logDebug(
            `Block parse delivered after ${Math.round(performance.now() - startedAt)}ms: ` +
              `${block.blocks.length} top-level block(s), ${block.edges.length} edge(s), ` +
              `rootColumns ${block.rootColumns}`
          );
          return block;
        })
        .catch((error) => {
          logDebug(
            `Block parse threw after ${Math.round(performance.now() - startedAt)}ms: ${error && error.message}`
          );
          throw error;
        });
    };

    const result = adapterParseQueue.then(run, run);
    adapterParseQueue = result.then(
      () => undefined,
      () => undefined
    );

    blockMemoCode = code;
    blockMemoPromise = result;
    return result;
  }

  /**
   * Self-check fixture: root declaring `columns 2`, three leaf blocks, one
   * composite carrying one child and declaring NO columns of its own, a
   * `space:2`, and one labelled edge between two of the leaves.
   *
   * THE `space:2` IS THE U1 WITNESS, added 13 September 2026. It is the one
   * shape in this fixture whose db keys DISAGREE with the delivered ones: the
   * db hands out two cells each carrying `width: 2` and no `widthInColumns`,
   * and the delivery must answer ONE column for each. A fixture carrying only
   * declared blocks passes whether the width reconciliation is right or wrong,
   * which is why this one does not.
   *
   * THE UNDECLARED COMPOSITE IS THE POINT. `getColumns("scGroup")` returns 1 on
   * this fixture — its child count — which is indistinguishable from an author
   * who wrote `columns 1`. The delivered value must be null, and this is the
   * assertion that catches a future editor "simplifying" the own-key read into
   * a getColumns call. A fixture whose composite declared its own columns would
   * pass either way, which is why this one does not.
   *
   * ASCII only, every string distinctive and prefixed SelfCheck, so a
   * cross-delivery from another diagram NAMES ITS SOURCE rather than merely
   * looking wrong.
   */
  const BLOCK_SELF_CHECK_FIXTURE = [
    "block-beta",
    "    columns 2",
    '    scAlpha["SelfCheck alpha"]',
    '    scBravo["SelfCheck bravo"]',
    '    scCharlie["SelfCheck charlie"]',
    "    block:scGroup",
    '        scDelta["SelfCheck delta"]',
    "    end",
    "    space:2",
    '    scAlpha -- "SelfCheck edge" --> scBravo',
  ].join("\n");

  /**
   * Parse the embedded fixture and assert every delivered field against known
   * values. Resolves true on a clean run; on any failure logs ONE ERROR naming
   * the first failed assertion, marks the block surface unhealthy, and resolves
   * false. Never throws.
   *
   * @returns {Promise<boolean>} Resolves to the block health verdict
   */
  function runBlockSelfCheck() {
    if (blockSelfCheckPromise) {
      return blockSelfCheckPromise;
    }
    blockSelfCheckStarted = true;

    const run = () =>
      Promise.resolve()
        .then(() => {
          if (
            !window.mermaid ||
            !window.mermaid.mermaidAPI ||
            typeof window.mermaid.mermaidAPI.getDiagramFromText !== "function"
          ) {
            throw new Error(
              "mermaid.mermaidAPI.getDiagramFromText is not available - is Mermaid loaded?"
            );
          }
          return window.mermaid.mermaidAPI.getDiagramFromText(
            BLOCK_SELF_CHECK_FIXTURE
          );
        })
        .then((diagram) => {
          const db = diagram.db;
          const accessorsPresent =
            typeof db.getBlocks === "function" &&
            typeof db.getBlocksFlat === "function" &&
            typeof db.getEdges === "function" &&
            typeof db.getClasses === "function" &&
            typeof db.getColumns === "function";

          // THE MEASURED ABSENCE, PINNED. The block db has no common trio, and
          // this surface's decision to deliver no title, accTitle or accDescr
          // rests on that. A Mermaid upgrade that ADDS any of the three should
          // fail here loudly, because it reopens the decision — a silently
          // available getter would leave the surface delivering a fiction of
          // absence rather than a measured one.
          const trioStillAbsent =
            typeof db.getDiagramTitle === "undefined" &&
            typeof db.getAccTitle === "undefined" &&
            typeof db.getAccDescription === "undefined";

          // Raw reads, taken in this same slot, for the two structural facts
          // the delivery cannot itself expose: that the flat walk starts at
          // root, and that getColumns would have LIED about the composite.
          const rawFlat = db.getBlocksFlat();
          const rawRoot = Array.isArray(rawFlat) ? rawFlat[0] : null;
          const rootIsFirst = !!rawRoot && rawRoot.id === "root";
          const getColumnsWouldLie = db.getColumns("scGroup") === 1;

          // The two RAW space cells, read in this same slot. The new space
          // assertion below needs both halves: that the db really did hand out
          // two cells carrying `width: 2` and NO `widthInColumns`, and that
          // the delivery answers 1 for each anyway. Without the raw half, a
          // build that simply stopped delivering `width` would satisfy the
          // delivered half for a reason that has nothing to do with the fix.
          const rawSpaces = (rawRoot && Array.isArray(rawRoot.children)
            ? rawRoot.children
            : []
          ).filter((b) => b && b.type === BLOCK_SHAPE_SPACE);

          const delivery = normaliseBlock(diagram);
          const [alpha, bravo, charlie, group, space1, space2] = delivery.blocks;
          const child = group && group.children ? group.children[0] : null;
          const edge = delivery.edges[0];
          const keysOf = (b) => (b ? Object.keys(b).join(",") : "");
          const expectedKeys = BLOCK_DELIVERED_KEYS.join(",");

          return [
            [
              "the five db accessors this surface reads exist by name",
              accessorsPresent,
            ],
            [
              "the block db still carries NO getDiagramTitle, getAccTitle or " +
                "getAccDescription — the measured absence this surface's " +
                "missing title fields rest on",
              trioStillAbsent,
            ],
            [
              "getBlocksFlat still starts at root, which is where rootColumns " +
                "is read from",
              rootIsFirst,
            ],
            [
              "the delivery names its type and carries six top-level blocks " +
                "in declaration order, with the author's ids — the last two " +
                "being the pair of cells a `space:2` delivers",
              delivery.diagramType === "block" &&
                delivery.blocks.length === 6 &&
                alpha.id === "scAlpha" &&
                bravo.id === "scBravo" &&
                charlie.id === "scCharlie" &&
                group.id === "scGroup" &&
                !!space1 &&
                space1.shape === BLOCK_SHAPE_SPACE &&
                !!space2 &&
                space2.shape === BLOCK_SHAPE_SPACE,
            ],
            [
              "a `space:2` delivers TWO cells of ONE column each, and the db's " +
                "own `width: 2` on both is NOT read as a span — the U1 " +
                "correction of 13 September 2026, asserted on both halves so " +
                "a db that stopped delivering `width` could not satisfy it by " +
                "accident",
              rawSpaces.length === 2 &&
                rawSpaces.every(
                  (b) =>
                    b.width === 2 &&
                    !Object.prototype.hasOwnProperty.call(b, "widthInColumns")
                ) &&
                space1.widthInColumns === BLOCK_SPACE_COLUMNS_PER_CELL &&
                space2.widthInColumns === BLOCK_SPACE_COLUMNS_PER_CELL,
            ],
            [
              "every delivered block carries EXACTLY the nine documented keys " +
                "and no other — the assertion that catches a render's `size` " +
                "and `intersect` crossing into the delivery",
              keysOf(alpha) === expectedKeys &&
                keysOf(group) === expectedKeys &&
                keysOf(child) === expectedKeys &&
                keysOf(space1) === expectedKeys,
            ],
            [
              "labels are the author's text, the composite's is the EMPTY " +
                "STRING the db delivers rather than its id, and shapes are the " +
                "db's own type strings verbatim",
              alpha.label === "SelfCheck alpha" &&
                bravo.label === "SelfCheck bravo" &&
                charlie.label === "SelfCheck charlie" &&
                group.label === "" &&
                alpha.shape === "square" &&
                group.shape === "composite",
            ],
            [
              "root's declared columns reads 2, and the UNDECLARED composite " +
                "reads null even though getColumns would answer 1 for it",
              delivery.rootColumns === 2 &&
                group.columns === null &&
                alpha.columns === null &&
                getColumnsWouldLie,
            ],
            [
              "the composite carries its one child nested, and a leaf carries " +
                "an EMPTY children array rather than no key",
              group.children.length === 1 &&
                child.id === "scDelta" &&
                child.label === "SelfCheck delta" &&
                Array.isArray(alpha.children) &&
                alpha.children.length === 0,
            ],
            [
              "spans, classes, styles and directions are the empty-case shapes " +
                "this fixture declares — widthInColumns 1, and [] rather than " +
                "absent for the other three",
              alpha.widthInColumns === 1 &&
                group.widthInColumns === 1 &&
                Array.isArray(alpha.classes) &&
                alpha.classes.length === 0 &&
                Array.isArray(alpha.styles) &&
                alpha.styles.length === 0 &&
                Array.isArray(alpha.directions) &&
                alpha.directions.length === 0,
            ],
            [
              "the one edge carries the AUTHOR'S OWN ids at start and end, its " +
                "decoded label, and an arrow type at each end",
              delivery.edges.length === 1 &&
                edge.start === "scAlpha" &&
                edge.end === "scBravo" &&
                edge.label === "SelfCheck edge" &&
                edge.arrowTypeStart === "arrow_open" &&
                edge.arrowTypeEnd === "arrow_point" &&
                edge.id === "1-scAlpha-scBravo",
            ],
            [
              "the class table is a PLAIN OBJECT snapshot rather than the db's " +
                "Map, and is empty on a fixture declaring no classDef",
              !!delivery.classes &&
                typeof delivery.classes === "object" &&
                !(delivery.classes instanceof Map) &&
                Object.keys(delivery.classes).length === 0,
            ],
          ];
        });

    const queued = adapterParseQueue.then(run, run);
    adapterParseQueue = queued.then(
      () => undefined,
      () => undefined
    );

    blockSelfCheckPromise = queued
      .then((assertions) => {
        const failed = assertions.find(([, pass]) => !pass);
        if (failed) {
          logError(
            `Block self-check FAILED at assertion: ${failed[0]}. ` +
              "Either the pinned Mermaid build's block internals no longer " +
              "match the 5 September 2026 census, or this surface's mapping " +
              "has drifted; do not trust block adapter output."
          );
          blockHealthy = false;
          return false;
        }

        logInfo(
          "Block self-check passed: accessor, absent-trio, key-set, nesting, " +
            "declared-column and edge assertions all hold"
        );
        blockHealthy = true;
        return true;
      })
      .catch((error) => {
        logError(
          "Block self-check FAILED at assertion: the fixture parses and " +
            `reads. The fixture run rejected: ${error && error.message}`
        );
        blockHealthy = false;
        return false;
      });

    return blockSelfCheckPromise;
  }

  /**
   * Report the block surface's health, independently of the other surfaces.
   * @returns {boolean|null} True or false once the block self-check has run;
   *   null when it has not yet run (or not yet settled)
   */
  function isBlockHealthy() {
    return blockHealthy;
  }

  return {
    parse: parse,
    runSelfCheck: runSelfCheck,
    isHealthy: isHealthy,
    parseEr: parseEr,
    runErSelfCheck: runErSelfCheck,
    isErHealthy: isErHealthy,
    parseClass: parseClass,
    runClassSelfCheck: runClassSelfCheck,
    isClassHealthy: isClassHealthy,
    parseGit: parseGit,
    runGitSelfCheck: runGitSelfCheck,
    isGitHealthy: isGitHealthy,
    parseSankey: parseSankey,
    runSankeySelfCheck: runSankeySelfCheck,
    isSankeyHealthy: isSankeyHealthy,
    parseXychart: parseXychart,
    runXychartSelfCheck: runXychartSelfCheck,
    isXychartHealthy: isXychartHealthy,
    parseGantt: parseGantt,
    runGanttSelfCheck: runGanttSelfCheck,
    isGanttHealthy: isGanttHealthy,
    parseQuadrant: parseQuadrant,
    runQuadrantSelfCheck: runQuadrantSelfCheck,
    isQuadrantHealthy: isQuadrantHealthy,
    parseSequence: parseSequence,
    runSequenceSelfCheck: runSequenceSelfCheck,
    isSequenceHealthy: isSequenceHealthy,
    parseBlock: parseBlock,
    runBlockSelfCheck: runBlockSelfCheck,
    isBlockHealthy: isBlockHealthy,
    // Register item 78: the ONE decoder exported from this module, for the
    // core's author-override route, which reads the raw diagram source.
    decodeSourcePlaceholders: decodeSourcePlaceholders,
    // Register item 24: the global enableAllLog() cannot reach this module's
    // level, so the control is exported here as MermaidThemes and
    // MermaidControls already do. Without it the per-parse trace above is
    // unreachable from outside and every adapter investigation needs its own
    // scratch instrumentation.
    setLogLevel: setLogLevel,
  };
})();
