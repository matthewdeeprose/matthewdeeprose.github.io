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
  // remaining author-text fields, on the same two functions — there is no
  // third transform, by design. Its render table is
  // docs/mermaid-item19-field-capture-2026-08-08.md section 3, and each new
  // call site names its verdict. Three carve-outs are DELIBERATE and should
  // not be "completed" by a later editor:
  //
  //   accTitle / accDescr — no transform on ANY surface. ER and class deliver
  //     them permanently EMPTY while the rendered SVG's <title>/<desc> carries
  //     the author's text (a separate delivery defect, registered); flowchart
  //     and git do carry them, and no description module reads either field.
  //     A transform there would be dead code no fixture could redden.
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
  // SHARED FATE, ACCEPTED DELIBERATELY: one queue means a parse that never
  // settles stalls all five surfaces where five queues would have stalled
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
      // "no declared shape" explicitly for consumers.
      shape: vertex.type === undefined ? null : vertex.type,
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
    // Register item 24: the global enableAllLog() cannot reach this module's
    // level, so the control is exported here as MermaidThemes and
    // MermaidControls already do. Without it the per-parse trace above is
    // unreachable from outside and every adapter investigation needs its own
    // scratch instrumentation.
    setLogLevel: setLogLevel,
  };
})();
