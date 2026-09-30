/**
 * @file mathpix-context-ai.js
 * @module MathPixContextAI
 * @description
 * Phase 2 Stage 1 — Context auto-fill: pure prompt/parse/coerce logic.
 *
 * Three side-effect-free functions that bridge the MathPix Context tab schema
 * (owned by {@link MathPixContextManager}) and an LLM round-trip:
 *
 *   - `buildPrompt(mmd, schema)`  — assemble the system + user prompt pair that
 *     asks a model to propose education-metadata values for one document.
 *   - `parseResponse(text, schema)` — recover each field's value from the model's
 *     labelled-block reply, tolerant of surrounding prose and truncation.
 *   - `coerceSelects(obj, schema)` — normalise the two restricted-vocabulary
 *     fields (audienceLevel, documentType) onto canonical option values.
 *
 * NO DOM, NO network, NO embed instance lives here. The transport and wiring
 * arrive in later parcels; this module is the testable core they call. Every
 * function is pure: same inputs → same outputs, and none mutates its arguments.
 *
 * @see mathpix-scripts/core/mathpix-context-manager.js (the schema owner)
 * @see mathpix-scripts/docs/alt-text/phase-2-stage-1-implementation-plan.md
 */

const MathPixContextAI = (function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Logging (per CLAUDE.md § Logging Standards — IIFE pattern)
  // ---------------------------------------------------------------------------

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[MathPixContextAI] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[MathPixContextAI] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[MathPixContextAI] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[MathPixContextAI] ${message}`, ...args);
  }

  // ---------------------------------------------------------------------------
  // The two restricted-vocabulary fields. These — and only these — carry a
  // fixed `options` list in the schema, so they are the only fields buildPrompt
  // constrains and the only ones coerceSelects normalises.
  // ---------------------------------------------------------------------------

  const SELECT_KEYS = ["audienceLevel", "documentType"];

  // ---------------------------------------------------------------------------
  // Transport configuration (P2 — embed wiring).
  //
  // These govern the hidden OpenRouter Embed instance the Context tab will
  // drive. NO DOM is touched and NO embed exists until initEmbed() runs; the
  // pure functions above never read any of these.
  // ---------------------------------------------------------------------------

  /** Hidden, aria-hidden container the embed renders into (never displayed). */
  const EMBED_CONTAINER_ID = "mathpix-context-ai-embed-container";

  /**
   * The provider whose default answers when nothing else does. Matches
   * ProviderSwitcher's own DEFAULT_PROVIDER_ID and _resolveModel's existing
   * `getActive()` fallback; declared separately because this module has to
   * work when the switcher has not loaded.
   */
  const DEFAULT_PROVIDER_ID = "openrouter";

  /**
   * The purpose this seam asks the shared registry about (parcel I5-2).
   *
   * Named rather than inlined for the reason the enhancer names its own
   * (`AI_ENHANCER_CONFIG.RECOMMENDATION_PURPOSE`, I5-1): a bare string at the
   * call site is a magic value, and the registry REFUSES an unrecognised
   * purpose, so a typo resolves null and reads as "this provider has no
   * default" rather than as "this file asked the wrong question".
   *
   * It must equal `MathPixModelRegistry.PURPOSES.CONTEXT`. It is NOT read off
   * that module, because a capture of a global published by another script is
   * the dead-announcer shape, and because a constant that reads its own
   * expected value from the thing it is checked against can never disagree
   * with it — which is the same reason the suite pins the ids as literals.
   */
  const RECOMMENDATION_PURPOSE = "context";

  /**
   * The model this provider defaults to — the ONE resolver over the shared
   * `window.MathPixModelRegistry`, asking it for the `context` purpose (parcel
   * I5-2; previously over a local frozen `DEFAULT_BY_PROVIDER` map, AW-29).
   *
   * THE LOCAL MAP IS DELETED, NOT LEFT BESIDE THIS. A second copy holding the
   * same two ids answers identically to the registry, so no behavioural row
   * anywhere could see one — which is exactly how the third copy drifts. The
   * absence is asserted against this function's own source text instead.
   *
   * Reached from FOUR call sites, each of which once decided for itself: both
   * rungs of `_resolveModel` (through one read, so the preferred-pick and the
   * fallback anchor cannot name two different models within a call),
   * `initEmbed`'s last resort, and the cost preview. Routing them here is what
   * stops the sent id and the estimated id naming different models.
   *
   * THE FOUR ARE THREE STATEMENTS AND ONE SHARED READ, and the count is stated
   * as call sites rather than as calls: `_resolveModel` calls this ONCE at
   * `:665` and uses the result on both rungs. Counted against comment-stripped
   * source at I5-2 rather than inherited from the AW-29 comment, because the
   * enhancer's equivalent count was found wrong in BOTH directions.
   *
   * THE IDS ARE MEASURED, NOT PREFERRED, and they have not changed — parcel
   * AW-27, 10 September 2026, six documents x five models x three runs,
   * blinded, key opened at `5f650fd`, re-verified at AW-34 against the prompt
   * that results once the page-range clause moved into the user half. The
   * evidence lives in the registry entry beside the ids, together with the
   * round and the date, rather than in a comment here that a re-point would
   * leave behind.
   *
   * Resolves the ACTIVE provider at CALL time and never captures it —
   * ProviderSwitcher loads after this file, and the provider is shared mutable
   * state that a persistent browser profile carries between runs (AW-19).
   *
   * AN UNRECOGNISED PROVIDER RETURNS null AND WARNS, unchanged from AW-29 and
   * now inherited from the registry rather than re-implemented here. The
   * contract is the one all three seams settled on at AW-36; it is NOT reopened
   * by this parcel, and no cross-provider borrow may be reintroduced. The
   * Context tab attaches a PDF, and `_resolveModel`'s provider-membership gate
   * exists precisely to stop an OpenRouter id being resolved for Foundry — a
   * silent fallback here would defeat that gate from inside.
   *
   * @param {string} [providerId] defaults to the active provider
   * @returns {string|null} a model id, or null for a provider the registry has
   *   no entry for under this purpose, and null when the registry is absent
   */
  /**
   * Is the shared model registry MODULE absent from the page? (parcel WL-1)
   *
   * ITS OWN COPY, NOT A REACH INTO A SIBLING, and the reason is not tidiness.
   * `MathPixAltTextCloudAdapter._modelRegistryIsAbsent` exists and is exported,
   * and this file loads BEFORE it in tools.html — so a call-time read would in
   * fact resolve. It is refused anyway: that module belongs to the ALT-TEXT
   * lane, nothing makes it a dependency of the Context tab, and if it were ever
   * absent from the page this guard would VANISH WITH IT and the defect would
   * come back silently. A guard that disappears when an unrelated file does is
   * not a guard.
   *
   * THE SHARED CAPABILITY MODULE WAS ALSO REFUSED AS A HOME. Every export in
   * `mathpix-model-capability.js` takes a model id and answers a question about
   * that id; this takes nothing and asks about a DIFFERENT module. RF-1 named
   * that same boundary when it refused to put `ABSENT_MODEL_REFUSAL` there.
   *
   * THERE IS NO DATA HERE TO DRIFT. All three copies read the same global and
   * test the same method name, and the three are compared against one another
   * in a suite row under both registry states, so a divergence reddens rather
   * than hiding.
   *
   * Reached at CALL time and never captured — the same reason the provider and
   * the registry itself are.
   *
   * @returns {boolean} true when nothing on the page can answer a preference
   */
  function _modelRegistryIsAbsent() {
    const registry = window.MathPixModelRegistry;
    return !registry || typeof registry.recommendedModel !== "function";
  }

  function _defaultModelForProvider(providerId) {
    const active =
      providerId ||
      (window.ProviderSwitcher &&
      typeof window.ProviderSwitcher.getActive === "function"
        ? window.ProviderSwitcher.getActive()
        : DEFAULT_PROVIDER_ID);

    // The shared registry, reached at CALL time and never captured — the same
    // reason the provider is. A module-scope capture of a global published by
    // another script captures undefined when the script order moves, which is
    // the shape AGENTS.md records ten dead call sites of.
    const registry = window.MathPixModelRegistry;
    const found =
      registry && typeof registry.recommendedModel === "function"
        ? registry.recommendedModel(RECOMMENDATION_PURPOSE, active)
        : null;

    if (!found || typeof found.modelId !== "string") {
      // FAIL CLOSED, NEVER OPEN. A hardcoded id here would be the private copy
      // this parcel exists to remove, reinstated one indirection further from
      // the resolver and therefore harder to find. null flows to the callers'
      // existing guards: `_resolveModel` returns null and `handleAnalyseClick`
      // refuses before any embed is built, and the cost preview leaves the
      // estimate blank rather than naming a model that would not be sent.
      //
      // ONE WARNING COVERING BOTH CAUSES, AND IT NAMES WHICH IT IS, on the
      // I5-1 precedent. The absent-module case is unreachable on a normally
      // loaded page, because the registry's script tag PRECEDES this file's in
      // tools.html — stated as an ORDER and deliberately not as two line
      // numbers, which drift every time another lane edits that file and were
      // already stale within an hour of being written. So it is reported
      // loudly rather than silently. Both spellings carry "no default
      // registered for provider", which is what the suite's rows match on; the
      // clause in front of it is what tells a reader whether to look at the
      // registry's contents or at the page's script order.
      logWarn(
        registry
          ? `_defaultModelForProvider: no default registered for provider '${active}'; returning null rather than borrowing another provider's id.`
          : `_defaultModelForProvider: the shared model registry is absent from the page, so no default registered for provider '${active}'; returning null rather than borrowing another provider's id.`
      );
      return null;
    }
    return found.modelId;
  }

  // ---------------------------------------------------------------------------
  // Shared capability module (parcel EA-4)
  // ---------------------------------------------------------------------------

  /**
   * Reach the shared capability module at CALL time, never as a module-scope
   * capture. Its script tag precedes this file in tools.html, so an absence
   * here is a page-configuration fault rather than a capability finding — and
   * it is reported as one, with its own sentence, so it can never be mistaken
   * for a model being refused on its merits.
   *
   * @returns {Object|null} window.MathPixModelCapability, or null with an error.
   */
  function _capability() {
    const shared = window.MathPixModelCapability;
    if (!shared) {
      logError(
        "MathPixModelCapability unavailable at call time. Its script tag precedes this file in tools.html, so this is a page-configuration fault, not a capability result."
      );
      return null;
    }
    return shared;
  }

  /**
   * The sentence used when the shared module itself did not load. Deliberately
   * NOT a second copy of NON_PDF_REFUSAL: it names a different fault, so a
   * reader who sees it is not sent looking at the model.
   */
  const CAPABILITY_MODULE_MISSING =
    "The model capability module did not load. Reload the page and try again.";

  /**
   * The PDF refusal sentence, read from the shared module at call time.
   *
   * @deprecated Moved to window.MathPixModelCapability.NON_PDF_REFUSAL at EA-4.
   *   Kept here only as a working facade for existing consumers; read it from
   *   the shared module in new code.
   * @returns {string}
   */
  function _nonPdfRefusal() {
    const shared = _capability();
    return shared && typeof shared.NON_PDF_REFUSAL === "string"
      ? shared.NON_PDF_REFUSAL
      : CAPABILITY_MODULE_MISSING;
  }

  /**
   * The provider-membership refusal sentence, read from the shared module at
   * call time.
   *
   * @deprecated Moved to window.MathPixModelCapability.PROVIDER_REFUSAL at EA-4.
   *   Kept here only as a working facade for existing consumers.
   * @returns {string}
   */
  function _providerRefusal() {
    const shared = _capability();
    return shared && typeof shared.PROVIDER_REFUSAL === "string"
      ? shared.PROVIDER_REFUSAL
      : CAPABILITY_MODULE_MISSING;
  }

  /**
   * The system prompt's opening sentence when the request carries ONLY the
   * document text. Kept BYTE-IDENTICAL to the pre-AW-33 wording, so a
   * two-argument buildPrompt() call — which is how section 6's fixture
   * assertions call it — produces exactly the prompt it always produced.
   */
  const MMD_ONLY_SENTENCE =
    "You are given a document in Mathpix Markdown (MMD) form.";

  /**
   * The system prompt's opening sentence when the full source PDF is attached
   * alongside the MMD.
   *
   * AW-32 measured the defect this closes: handleAnalyseClick attaches
   * provider.getSourcePDF() — the WHOLE source document — while the prompt
   * named only the MMD, so the model was never told what it actually held or
   * which of the two views was which. Telling a model what it has been given is
   * correct whether or not whole-source knowledge turns out to help, which is
   * why this change needs no prior ruling on that question.
   */
  const PDF_ATTACHED_SENTENCE =
    "You are given two views of the same document: the full source PDF, " +
    "attached to this request, and the document's text in Mathpix Markdown " +
    "(MMD) form.";

  /** Approximate characters per token, for the max_tokens scaling below. */
  const CHARS_PER_TOKEN = 4;

  /** Floor for the response budget — the labelled-block reply is small. */
  const MAX_TOKENS_FLOOR = 1024;

  /**
   * Conservative, generic output budget — deliberately NOT tied to a specific
   * model. It clamps the response budget in initEmbed regardless of which model
   * _resolveModel() picks. Follow-up: derive the true per-model output cap from
   * the selected model's registry metadata in the alt-text adapter phase. Left
   * generic here as a conscious, documented leave, not a silent mismatch.
   */
  const DEFAULT_MODEL_MAX_OUTPUT = 8192;

  /**
   * OpenRouter rejects uploads whose encoded body nears 25 MB. We warn before
   * the base64 form of a PDF crosses most of that ceiling, so the caller can
   * suggest a smaller document rather than hit an opaque API failure. base64
   * inflates raw bytes by 4/3.
   */
  const OPENROUTER_MAX_BASE64_BYTES = 25 * 1024 * 1024;
  const PDF_SIZE_WARN_RATIO = 0.9;
  const BASE64_EXPANSION = 4 / 3;

  /**
   * Hard timeout for the context round-trip (P4 wiring). A PDF + MMD analysis
   * is a single, modest reply; two minutes is generous headroom before
   * sendWithTimeout() surfaces its smaller-document / faster-model guidance.
   */
  const CONTEXT_TIMEOUT_MS = 120000;

  /**
   * Parcel 38: the embed retry layer's attempt ceiling, named once so the
   * spoken cue and the configured limit cannot drift apart. Equal to the
   * embed's own default (DEFAULT_CONFIG.retry.maxRetries in
   * openrouter-embed-core.js). The retry's worst case (about 1 + 2 + 4 s of
   * backoff plus jitter) sits well inside CONTEXT_TIMEOUT_MS.
   */
  const EMBED_RETRY_MAX_ATTEMPTS = 3;

  /**
   * `CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS` is denominated PER 1,000 PAGES — the
   * `mistral-ocr: 2.0` entry is $2 per 1,000 pages, i.e. $0.002 per page, which
   * is the figure OC-2b measured at the wire to six decimal places. Named rather
   * than written inline so the division cannot be read as arbitrary.
   */
  const PAGES_PER_RATE_UNIT = 1000;

  /** P3 element IDs for the resume Context AI control (init() caches these). */
  const RESUME_ELEMENT_IDS = {
    analyseBtn: "resume-context-ai-analyse",
    cost: "resume-context-ai-cost",
    progress: "resume-context-ai-progress",
    summary: "resume-context-ai-summary",
    undoBtn: "resume-context-ai-undo",
    announce: "resume-context-ai-announce",
  };

  /**
   * MP-1 element IDs for the model picker. A SECOND map rather than six more
   * entries in the one above, because `init()` treats a missing
   * `RESUME_ELEMENT_IDS.analyseBtn` as "the control is not on this page" and
   * refuses to wire anything at all. The picker must not be able to take the
   * whole workflow down by being absent, so it is looked up separately and
   * every consumer of it is null-guarded.
   */
  const PICKER_ELEMENT_IDS = {
    pickerRoot: "resume-context-model-picker",
    pickerFieldset: "resume-context-model-recommended",
    pickerOptions: "resume-context-model-options",
    pickerMeasured: "resume-context-model-measured",
    pickerNone: "resume-context-model-none",
    pickerUnavailable: "resume-context-model-unavailable",
    pickerAdvanced: "resume-context-model-advanced",
    pickerOverride: "resume-context-model-override",
  };

  /** The radio group's shared name — one constant, used by build and by reset. */
  const PICKER_RADIO_NAME = "resume-context-model";

  /** The override <select>'s placeholder value: "use the recommendation". */
  const PICKER_OVERRIDE_PLACEHOLDER = "";

  /**
   * THE USER'S OWN MODEL CHOICE — module scope, NOT a property of the exported
   * singleton, and NOT persisted anywhere.
   *
   * WHY MODULE SCOPE. `_resolveModel` is `this`-free by construction and is
   * called both as `this._resolveModel()` (the wired journey) and, in the
   * suite, on the facade. This module is `"use strict"`, so a bare internal
   * call would see `this === undefined`; reading the choice from module scope
   * removes that whole class of binding hazard from the one function that
   * decides what gets sent.
   *
   * WHY NOTHING IS PERSISTED, STATED SO IT IS NOT READ AS AN OVERSIGHT. The
   * Context tab writes NO localStorage key today — measured at MP-1, zero
   * `localStorage` occurrences in this file before this parcel — and MP-1 does
   * not add the first one. A choice that does not outlive the page cannot be
   * restored under a provider that does not serve it, which is the strongest
   * available form of the fail-safe the parcel asks for. The provider itself IS
   * carried between page loads by the browser profile (AGENTS.md § Testing
   * records the trap), which is precisely why the picker reads the ACTIVE
   * provider on every build rather than trusting anything it stored.
   *
   * IT IS STILL RE-VALIDATED AT RESOLVE TIME. `_resolveUserChoice` re-asks both
   * send-boundary predicates for the ACTIVE provider on every run, so the
   * discard does not depend on the provider-change handler having fired. Two
   * independent guards, because a single one that stops running is silent.
   */
  let _userModelChoice = null;

  /** How long an announcement lingers before the region is cleared (ms). */
  const ANNOUNCE_CLEAR_MS = 3000;

  /**
   * Exact refuse message for an ABSENT REGISTRY MODULE (parcel WL-1,
   * 14 September 2026; British spelling).
   *
   * A SECOND SENTENCE, NOT A REPLACEMENT. The shipped refusal — "This provider
   * cannot read PDF files. Choose a different provider to run context
   * auto-fill." — is reached whenever `_resolveModel()` returns null, and it is
   * CORRECT for the condition it was written for: a provider that genuinely
   * serves no PDF-capable model and has no default in its own unfiltered list.
   * It is WRONG for an absent registry module, where it sends a person to
   * another provider and the auto-fill then proceeds there SILENTLY on a model
   * nobody measured — measured 14 September 2026: with the registry deleted,
   * OpenRouter refuses with this sentence while Foundry resolves
   * `pdfEligible[0]` and runs.
   *
   * THE FIRST CLAUSE IS RF-1's, shipped and heard at RF-2. The tail names which
   * workflow stopped, which is why this is not the same string as the alt-text
   * lane's: a person needs to know whether their description or their context
   * fields is the thing that did not happen.
   */
  const ABSENT_REGISTRY_REFUSAL =
    "No AI model is set up for the AI provider you have selected, so context auto-fill cannot run.";

  // ---------------------------------------------------------------------------
  // Internal helpers (pure)
  // ---------------------------------------------------------------------------

  /**
   * The schema field for a key, or null. Tolerant of a missing / malformed
   * schema so the public functions never throw on bad input.
   * @param {Array<Object>} fields
   * @param {string} key
   * @returns {Object|null}
   */
  function findField(fields, key) {
    if (!Array.isArray(fields)) return null;
    return fields.find((field) => field && field.key === key) || null;
  }

  /**
   * The {value, label} option list for a select field, or []. Always an array.
   * @param {Array<Object>} fields
   * @param {string} key
   * @returns {Array<{value: string, label: string}>}
   */
  function optionsFor(fields, key) {
    const field = findField(fields, key);
    return field && Array.isArray(field.options) ? field.options : [];
  }

  // ---------------------------------------------------------------------------
  // buildPrompt — assemble { systemPrompt, userPrompt }
  // ---------------------------------------------------------------------------

  /**
   * What this run has actually been given, read from the bound data provider.
   *
   * AW-33 read these two values inline in `initEmbed`, which was correct while
   * BOTH clauses lived in the system prompt — `initEmbed` builds that half and
   * discards the other. AW-34 moved the page-range clause into the USER half,
   * which `handleAnalyseClick` builds from its own `buildPrompt` call, so the
   * two halves are now assembled at two different call sites and must describe
   * the SAME run. One helper read by both is how that holds by construction
   * rather than by two reads happening to agree.
   *
   * Both values come from `this.provider` — the same canonical data provider
   * the enhancer reads — so the Context tab and the enhancer cannot disagree
   * about which pages the session holds. Reading the range a second way is
   * exactly how two copies of one fact drift apart.
   *
   * `pdfAttached` is read from the provider rather than from `this.embed`,
   * because `attachPDF()` has not run yet when `initEmbed` asks:
   * `handleAnalyseClick` establishes a truthy source PDF before it calls
   * `initEmbed` and attaches it immediately afterwards, so a truthy
   * `getSourcePDF()` is the live answer to "will a PDF go with this request".
   *
   * @param {Object|null} contextProvider — the bound data provider, or null.
   * @returns {{pdfAttached: boolean, pageRangeContext: string}}
   */
  function _readPromptGivens(contextProvider) {
    const provider = contextProvider || null;

    const pdfAttached = !!(
      provider &&
      typeof provider.getSourcePDF === "function" &&
      provider.getSourcePDF()
    );

    let pageRangeContext = "";
    try {
      if (provider && typeof provider.getPageRangeContext === "function") {
        pageRangeContext = provider.getPageRangeContext() || "";
      }
    } catch (error) {
      logWarn(
        "_readPromptGivens: getPageRangeContext threw; continuing without the page-range clause.",
        error
      );
      pageRangeContext = "";
    }

    return { pdfAttached, pageRangeContext };
  }

  /**
   * Build the system + user prompt pair for the context auto-fill round-trip.
   *
   * The system prompt sets the task: read the document and propose values for
   * the listed education-metadata fields, grounded strictly in the source. The
   * user prompt folds the MMD into a fenced block and instructs the model to
   * return ONLY labelled blocks — one `<KEY>value</KEY>` per schema key — to
   * leave a block empty when the value is unknown, and to use one of the listed
   * allowed values for the two restricted selects.
   *
   * Pure: no DOM, no network. `mmd`, `schema` and `options` are read, never
   * mutated.
   *
   * AW-33 added the third parameter. BOTH of its members default to absent, so
   * a two-argument call produces a prompt carrying NEITHER clause — that is the
   * back-compatibility contract section 6 leans on, and it is pinned by its own
   * suite row rather than left to inspection.
   *
   * AW-34 moved the page-range clause from the SYSTEM half to the USER half.
   * The clause's own words are "The MMD content below ONLY covers these pages",
   * and the MMD is in the user message — so in the system prompt the word
   * "below" named nothing. It now sits IMMEDIATELY above the MMD fence, which
   * is where the enhancer's copy of the same string effectively sits, and the
   * word is true. The PDF sentence stays in the system half deliberately: it is
   * a statement about the request as a whole, not about what follows it.
   *
   * @param {string} mmd — the document in Mathpix Markdown form.
   * @param {Array<Object>} schema — MathPixContextManager.getSchema() output.
   * @param {Object} [options] — what this run has actually been given.
   * @param {boolean} [options.pdfAttached=false] — true when the full source
   *   PDF is attached to the request alongside the MMD. Reaches the SYSTEM half.
   * @param {string} [options.pageRangeContext=""] — the data provider's own
   *   partial-processing clause, passed through VERBATIM. Empty means the
   *   session holds the whole document, or nothing is known about the range.
   *   Reaches the USER half, immediately above the MMD fence.
   * @returns {{systemPrompt: string, userPrompt: string}}
   */
  function buildPrompt(mmd, schema, options) {
    const fields = Array.isArray(schema) ? schema : [];
    const mmdText = typeof mmd === "string" ? mmd : "";

    if (!Array.isArray(schema)) {
      logWarn("buildPrompt called without an array schema; using no fields.");
    }

    // AW-33 — what the model has been given. Both default to absent.
    const opts = options && typeof options === "object" ? options : {};
    const pdfAttached = opts.pdfAttached === true;
    // Held UNTRIMMED and inserted verbatim: the provider's string is the one
    // source of truth for this wording, shared with the enhancer, and a
    // reformatted copy here would be a second copy free to drift. Only the
    // emptiness TEST trims.
    const pageRangeContext =
      typeof opts.pageRangeContext === "string" ? opts.pageRangeContext : "";
    const hasPageRange = pageRangeContext.trim().length > 0;

    // One bullet per field — the camelCase tag the model must emit, plus the
    // human label so it understands what each field means.
    const fieldList = fields
      .filter((field) => field && typeof field.key === "string")
      .map((field) => `- <${field.key}> — ${field.label || field.key}`)
      .join("\n");

    // Allowed-value lists for the two restricted selects, drawn live from the
    // schema (audienceLevel from the config projection, documentType fixed).
    function allowedValues(key) {
      return optionsFor(fields, key)
        .map((option) => `${option.value} (${option.label})`)
        .join(", ");
    }
    const audienceValues = allowedValues("audienceLevel");
    const documentValues = allowedValues("documentType");

    // The empty-block skeleton the model fills in — one block per field.
    const blockTemplate = fields
      .filter((field) => field && typeof field.key === "string")
      .map((field) => `<${field.key}></${field.key}>`)
      .join("\n");

    const systemPrompt =
      "You are an expert academic-document analyst working within a UK " +
      "higher-education accessibility tool. " +
      (pdfAttached ? PDF_ATTACHED_SENTENCE : MMD_ONLY_SENTENCE) +
      " Your task is to read the document and propose values " +
      "for a fixed set of education-metadata fields that describe it — its " +
      "subject area, specific topic, intended audience, document type, and " +
      "similar descriptive metadata. Base every proposed value strictly on " +
      "evidence within the document. Where the document does not support a " +
      "confident value, leave that field empty rather than guessing. Never " +
      "invent module names, module codes, or any detail not present in the " +
      "source. Use British spelling throughout.";

    const userPrompt =
      "Read the document below and propose values for these education-metadata " +
      "fields:\n\n" +
      fieldList +
      "\n\nTwo fields are restricted to a fixed list of allowed values.\n" +
      "For <audienceLevel>, the value must be exactly one of: " +
      audienceValues +
      ".\nFor <documentType>, the value must be exactly one of: " +
      documentValues +
      "." +
      // AW-34 — the provider's own partial-processing clause, inserted VERBATIM
      // and positioned IMMEDIATELY above the MMD fence, because the clause says
      // "The MMD content below ONLY covers these pages" and that word has to be
      // true where the string sits. The clause already opens and closes with
      // its own newlines; the one added "\n" separates it from the preceding
      // sentence without touching the provider's string. When absent this whole
      // term is the empty string, so the user prompt stays BYTE-IDENTICAL to
      // the pre-AW-34 one — the contract section 6's 25 fixture assertions and
      // suite rows 13.1 and 13.6 lean on.
      (hasPageRange ? "\n" + pageRangeContext : "") +
      "\n\nDocument (Mathpix Markdown):\n\n" +
      "```mmd\n" +
      mmdText +
      "\n```\n\n" +
      "Return ONLY labelled blocks — one per field — in exactly this form, and " +
      "nothing else:\n\n" +
      blockTemplate +
      "\n\nPlace each proposed value between the opening and closing tag for its " +
      "field. Leave a field's block empty if the document does not tell you its " +
      "value. For <audienceLevel> and <documentType>, use one of the allowed " +
      "values listed above. Do not add any commentary, explanation, or text " +
      "outside these blocks.";

    logDebug("buildPrompt assembled", {
      fields: fields.length,
      mmdLength: mmdText.length,
      // AW-33 — the two clause states, so a capture says which prompt shipped.
      pdfAttached,
      hasPageRangeContext: hasPageRange,
    });

    return { systemPrompt, userPrompt };
  }

  // ---------------------------------------------------------------------------
  // parseResponse — recover each field's value from the labelled-block reply
  // ---------------------------------------------------------------------------

  /**
   * Extract one value per schema key from a model reply of `<KEY>value</KEY>`
   * blocks. For each key, the content runs from just after its `<KEY>` opening
   * tag up to the NEXT `<` character (which covers the field's own `</KEY>`, the
   * next field's opening tag, or — for a truncated reply — end of string). The
   * content is trimmed; a missing or empty block yields "". Any text outside the
   * blocks is ignored. Never throws.
   *
   * Reading to the next `<` (rather than insisting on a matching `</KEY>`) is
   * what lets a reply truncated mid-field still surrender every earlier field.
   *
   * @param {string} text — the raw model reply.
   * @param {Array<Object>} schema — MathPixContextManager.getSchema() output.
   * @returns {Object<string, string>} one trimmed string per schema key.
   */
  function parseResponse(text, schema) {
    const fields = Array.isArray(schema) ? schema : [];
    const source = typeof text === "string" ? text : "";
    const result = {};

    for (const field of fields) {
      if (!field || typeof field.key !== "string") continue;
      const key = field.key;
      result[key] = "";

      const openTag = `<${key}>`;
      const openIndex = source.indexOf(openTag);
      if (openIndex === -1) {
        // No block for this key at all → leave the seeded "".
        continue;
      }

      const valueStart = openIndex + openTag.length;
      // The value ends at the next "<" — closing tag, next opening tag, or, when
      // the reply is truncated, there is none and we read to end of string.
      let valueEnd = source.indexOf("<", valueStart);
      if (valueEnd === -1) valueEnd = source.length;

      result[key] = source.slice(valueStart, valueEnd).trim();
    }

    if (!Array.isArray(schema)) {
      logWarn("parseResponse called without an array schema; returning {}.");
    }

    logDebug("parseResponse extracted", result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // coerceSelects — normalise the two restricted-vocabulary fields
  // ---------------------------------------------------------------------------

  /**
   * Normalise the audienceLevel and documentType fields onto canonical option
   * values. Each is matched case-folded against every option's `value` first,
   * then every option's `label`; a match sets the option's `value`, no match
   * sets "". The other six fields are copied through untouched.
   *
   * Pure: returns a new object; the input `obj` is never mutated.
   *
   * @param {Object<string, string>} obj — parsed field values (e.g. parseResponse output).
   * @param {Array<Object>} schema — MathPixContextManager.getSchema() output.
   * @returns {Object<string, string>}
   */
  function coerceSelects(obj, schema) {
    const source =
      obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
    const fields = Array.isArray(schema) ? schema : [];

    // Copy every field through; only the two selects are then overwritten.
    const result = {};
    for (const key of Object.keys(source)) {
      result[key] = source[key];
    }

    for (const key of SELECT_KEYS) {
      const options = optionsFor(fields, key);
      const raw = typeof source[key] === "string" ? source[key] : "";
      const folded = raw.trim().toLowerCase();

      let matched = "";
      if (folded !== "") {
        // Try option values first, then option labels.
        let option = options.find(
          (opt) => opt && String(opt.value).toLowerCase() === folded
        );
        if (!option) {
          option = options.find(
            (opt) => opt && String(opt.label).toLowerCase() === folded
          );
        }
        if (option) matched = option.value;
      }

      result[key] = matched;
      logDebug(`coerceSelects ${key}: "${raw}" → "${matched}"`);
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Transport (P2) — hidden embed, PDF attach, timed send, error bridge.
  //
  // These are stateful: the embed lives on the returned singleton (this.embed)
  // exactly as the AI Enhancer keeps it on its instance, so they MUST be called
  // as MathPixContextAI.method(...). Nothing here is wired to the DOM yet beyond
  // the one hidden, aria-hidden container the embed library requires.
  // ---------------------------------------------------------------------------

  /**
   * Resolve ONE model for this run from the global provider switch (S2F-D8: no
   * picker UI). Reads ProviderSwitcher.getActive(), asks EmbedModelSelector for
   * the PDF-capable eligible models of that provider, and returns a single
   * choice — the documented preferred id when eligible, else the first eligible
   * model — mirroring the reference default-pick in
   * image-describer-controller-model.js. The Context tab attaches a PDF, so the
   * capability filter is ["pdf"], not ["vision"].
   *
   * Returns null (a clear sentinel) when the selector is unavailable or the
   * active provider serves no PDF-capable model, so the caller can refuse
   * cleanly rather than send to a model that cannot read the attachment.
   *
   * @returns {{id: string, model: Object, providerId: string}|null}
   */
  function _resolveModel() {
    const providerId =
      window.ProviderSwitcher &&
      typeof window.ProviderSwitcher.getActive === "function"
        ? window.ProviderSwitcher.getActive()
        : "openrouter";

    if (
      !window.EmbedModelSelector ||
      typeof window.EmbedModelSelector.getEligibleModels !== "function"
    ) {
      logWarn(
        "_resolveModel: EmbedModelSelector unavailable; cannot resolve a PDF-capable model."
      );
      return null;
    }

    // MP-1: THE USER'S OWN PICK OUTRANKS THE MEASURED DEFAULT, and it is the
    // FIRST rung rather than a filter applied to the last one. Placed here, at
    // the top and before either existing rung reads anything, so both of those
    // rungs stay byte-identical and their four AW-29 / I5-2 rows keep asserting
    // exactly what they asserted before this parcel.
    //
    // It can still return null — a pick the ACTIVE provider no longer serves is
    // discarded here rather than sent — in which case the two rungs below run
    // unchanged and the person gets the measured default. FAIL SAFE, not fail
    // open: the discard narrows the choice back to the measured one, never
    // widens it to a model nobody checked.
    const userPick = _resolveUserChoice(providerId);
    if (userPick) return userPick;

    let pdfEligible = [];
    try {
      pdfEligible = window.EmbedModelSelector.getEligibleModels({
        providerId,
        capabilities: ["pdf"],
      });
    } catch (error) {
      logWarn("_resolveModel: getEligibleModels(['pdf']) threw:", error);
      pdfEligible = [];
    }

    // The ACTIVE provider's own default. Read ONCE here and used by both rungs
    // below, so the preferred-pick and the fallback anchor cannot name two
    // different models within one call.
    const providerDefault = _defaultModelForProvider(providerId);

    if (Array.isArray(pdfEligible) && pdfEligible.length > 0) {
      // Foundry-first path: the provider tags PDF as a per-model capability.
      // Default-pick: prefer THIS PROVIDER'S default id when it is itself
      // eligible, otherwise the first eligible model (registry order).
      //
      // AW-29: this rung previously matched a single cross-provider constant,
      // which no Foundry model could ever equal — so Foundry resolved
      // pdfEligible[0] by list position alone, and the "preferred" lookup was
      // decorative on the only provider that reaches this branch.
      const preferred = providerDefault
        ? pdfEligible.find((model) => model && model.id === providerDefault)
        : null;
      const chosen = preferred || pdfEligible[0];
      logInfo("Context model resolved via ['pdf'] capability gate", {
        providerId,
        model: chosen.id,
        providerDefault,
        preferredWasEligible: !!preferred,
        eligibleCount: pdfEligible.length,
      });
      return { id: chosen.id, model: chosen, providerId };
    }

    // Fallback path (FF.1 plan correction): OpenRouter — the default provider —
    // expresses PDF support at the engine / file-upload level (native,
    // mistral-ocr), NOT as a per-model capability token, so NO OpenRouter model
    // passes a ["pdf"] filter. To keep the default provider working, fall back
    // to THIS PROVIDER'S default — but ONLY when that id genuinely belongs to
    // the ACTIVE provider (it appears in that provider's UNFILTERED eligible
    // list). The provider-membership gate is kept even though the map is now
    // per-provider: the map is a declaration, the list is the live registry,
    // and this gate is what refuses when the two disagree.
    //
    // Follow-up (roadmap, not this parcel): reconcile how the two providers
    // express PDF capability so a single gate serves both without this fallback.
    let unfiltered = [];
    try {
      unfiltered = window.EmbedModelSelector.getEligibleModels({
        providerId,
        capabilities: [],
      });
    } catch (error) {
      logWarn("_resolveModel: getEligibleModels([]) fallback threw:", error);
      unfiltered = [];
    }

    const fallbackModel =
      providerDefault &&
      Array.isArray(unfiltered) &&
      unfiltered.find((model) => model && model.id === providerDefault);

    if (fallbackModel) {
      logInfo(
        "Context model resolved via per-provider default fallback (provider has no ['pdf']-tagged model)",
        { providerId, model: fallbackModel.id }
      );
      return { id: fallbackModel.id, model: fallbackModel, providerId };
    }

    logWarn(
      `_resolveModel: no ['pdf'] model and no per-provider default fallback for provider '${providerId}'.`
    );
    return null;
  }

  // ===========================================================================
  // MP-1 — THE MODEL PICKER
  // ===========================================================================
  //
  // THE CONTEXT TAB HAD NO MODEL CONTROL AT ALL BEFORE THIS PARCEL. That is a
  // feature never built rather than a regression — AW-31's capture reads
  // `modelControls: []` for both context panels under both providers, inside
  // panels carrying 8 and 10 controls, so the empty result is an absence and
  // not a dead selector. There is no prior behaviour to restore.
  //
  // IT IS BUILT IN THE RESUME PANEL ONLY, AND THAT IS NOT AN OVERSIGHT.
  // `#panel-context`, the upload-mode panel, carries the eight context fields
  // and NO AI journey — no analyse button, no cost element, no progress
  // element, no announce region. Measured at MP-1: every `context-ai-*` id in
  // tools.html is `resume-`-prefixed. A picker there would be a control with
  // nothing to control.
  //
  // THIS BLOCK ADDS NO SPOKEN LINE. Nothing here calls `_announce`, and the
  // markup carries no live region and no live role. Every string it writes is
  // visible text, read when a person reaches it — the arrangement the enhancer
  // already uses for its own empty-state message. What a change WOULD say, if a
  // later parcel decides it should, is recorded in `_handleModelRadioChange`.

  /**
   * The ACTIVE provider id, resolved at CALL time and never captured.
   *
   * A NEW HELPER USED ONLY BY NEW CODE. `_defaultModelForProvider` and
   * `_resolveModel` each inline this same three-line read, and neither is
   * repointed here: both are load-bearing for rows in sections 12 and 14 that
   * assert their behaviour, and rewriting a shared resolver to save two lines
   * is a change whose blast radius is larger than its benefit.
   *
   * @returns {string}
   */
  function _activeProviderId() {
    return window.ProviderSwitcher &&
      typeof window.ProviderSwitcher.getActive === "function"
      ? window.ProviderSwitcher.getActive()
      : DEFAULT_PROVIDER_ID;
  }

  /**
   * The WHOLE registry entry for a provider — id, round and measured date.
   *
   * `_defaultModelForProvider` returns the bare id and cannot answer the other
   * two, which the picker surfaces as visible text. The registry exports the
   * entry rather than the id precisely so a caller wanting the provenance does
   * not need a second lookup that could disagree with the first.
   *
   * @param {string} providerId
   * @returns {{modelId: string, round: string, measured: string}|null}
   */
  function _recommendedEntryFor(providerId) {
    const registry = window.MathPixModelRegistry;
    if (!registry || typeof registry.recommendedModel !== "function") {
      return null;
    }
    return registry.recommendedModel(RECOMMENDATION_PURPOSE, providerId) || null;
  }

  /** Month names for the British long date the measured note carries. */
  const MEASURED_MONTHS = Object.freeze([
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]);

  /**
   * "2026-09-11" to "11 September 2026".
   *
   * Formatted here rather than through `toLocaleDateString`, which would render
   * in whatever locale the browser happens to be set to — so the date a British
   * reader sees would depend on their machine rather than on the record.
   * Returns the input unchanged when it is not the expected shape, so a
   * malformed registry date degrades to something readable instead of "NaN".
   *
   * @param {string} iso
   * @returns {string}
   */
  function _formatMeasuredDate(iso) {
    if (typeof iso !== "string") return "";
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!match) return iso;
    const month = MEASURED_MONTHS[Number(match[2]) - 1];
    if (!month) return iso;
    return `${Number(match[3])} ${month} ${match[1]}`;
  }

  /**
   * Every model the ACTIVE provider serves that can read a PDF.
   *
   * THE FILTER IS `isModelPdfCapable` ITSELF, asked once per id, rather than a
   * re-implementation of its two rungs. That predicate is the SAME one the send
   * boundary in `initEmbed` applies, so the picker cannot offer a model the
   * send would then refuse — the dead-end-one-layer-in the enhancer's EA-2b
   * comment records measuring on six Foundry ids. Re-deriving its logic here
   * would be a second copy of a predicate whose two rungs are asymmetric for a
   * load-bearing reason, and the copy would drift.
   *
   * Its cost is two `getEligibleModels` calls per candidate. That is paid once
   * per picker build, not per render and not in a loop, which is why
   * correctness is preferred to hoisting the lists.
   *
   * @param {string} providerId
   * @returns {Array<Object>} possibly empty, sorted by display name
   */
  function _pdfCapableModelsFor(providerId) {
    const selector = window.EmbedModelSelector;
    if (!selector || typeof selector.getEligibleModels !== "function") {
      logWarn(
        "_pdfCapableModelsFor: EmbedModelSelector unavailable; the override list is offered empty rather than fabricated."
      );
      return [];
    }

    let all = [];
    try {
      all = selector.getEligibleModels({ providerId, capabilities: [] });
    } catch (error) {
      logWarn("_pdfCapableModelsFor: getEligibleModels([]) threw:", error);
      return [];
    }
    if (!Array.isArray(all)) return [];

    const kept = all.filter(
      (model) =>
        model && typeof model.id === "string" && isModelPdfCapable(model.id)
    );
    kept.sort((a, b) =>
      String(a.name || a.id).localeCompare(String(b.name || b.id))
    );
    return kept;
  }

  /**
   * The user's pick, re-validated for the ACTIVE provider — or null.
   *
   * THE SECOND OF TWO INDEPENDENT GUARDS. The first is the provider-change
   * rebuild, which clears the pick outright; this one re-asks both
   * send-boundary predicates on every resolve, so the discard does not depend
   * on that handler having fired, having been subscribed, or having run before
   * the click. A single guard that silently stops running is indistinguishable
   * from one that is working.
   *
   * It returns the FULL `{id, model, providerId}` shape both existing rungs
   * return, and falls back rather than returning a half-resolved one when the
   * id clears both predicates but cannot be found in the provider's list — a
   * state that should be unreachable, since both predicates consult that list.
   *
   * @param {string} providerId the provider `_resolveModel` is resolving for
   * @returns {{id: string, model: Object, providerId: string}|null}
   */
  function _resolveUserChoice(providerId) {
    const chosen = _userModelChoice;
    if (!chosen) return null;

    if (!isModelPdfCapable(chosen) || !isModelProviderAvailable(chosen)) {
      logWarn(
        `_resolveUserChoice: the chosen model '${chosen}' is not served by provider '${providerId}' or cannot read a PDF; discarding the choice and falling back to the measured default.`
      );
      _userModelChoice = null;
      return null;
    }

    let model = null;
    try {
      const all = window.EmbedModelSelector.getEligibleModels({
        providerId,
        capabilities: [],
      });
      if (Array.isArray(all)) {
        model = all.find((entry) => entry && entry.id === chosen) || null;
      }
    } catch (error) {
      logWarn("_resolveUserChoice: the membership lookup threw:", error);
    }

    if (!model) {
      logWarn(
        `_resolveUserChoice: '${chosen}' cleared both predicates but is absent from provider '${providerId}' unfiltered list; falling back rather than returning a half-resolved model.`
      );
      _userModelChoice = null;
      return null;
    }

    logInfo("Context model resolved from the user's own pick", {
      providerId,
      model: chosen,
    });
    return { id: chosen, model, providerId };
  }

  /**
   * Record the user's pick, refusing anything the send would refuse.
   *
   * VALIDATES AT THE CONTROL AS WELL AS AT THE RESOLVER. The picker only ever
   * offers ids that pass both predicates, so a refusal here means the page
   * state moved underneath the control — which is worth a warning rather than a
   * silent correction.
   *
   * @param {string|null} modelId null or "" clears the pick
   * @returns {boolean} true when the choice was recorded or cleared
   */
  function _setUserModelChoice(modelId) {
    if (!modelId) {
      _userModelChoice = null;
      logDebug("Context model choice cleared; the measured default applies.");
      return true;
    }
    if (typeof modelId !== "string" || !modelId.trim()) {
      logWarn("_setUserModelChoice: refusing a model id that is not a string.", {
        modelId,
      });
      return false;
    }
    if (!isModelPdfCapable(modelId) || !isModelProviderAvailable(modelId)) {
      logWarn(
        `_setUserModelChoice: refusing '${modelId}' — the active provider does not serve it, or it cannot read a PDF.`
      );
      return false;
    }
    _userModelChoice = modelId;
    logInfo("Context model choice set by the user", { model: modelId });
    return true;
  }

  /** The user's current pick, or null. Exported so a row can read it. */
  function _getUserModelChoice() {
    return _userModelChoice;
  }

  /**
   * One recommended radio, as DOM rather than as an HTML string.
   *
   * BUILT WITH createElement AND textContent, NOT innerHTML. This module has no
   * escaping helper, and a model name reaching innerHTML unescaped is a defect
   * waiting for a catalogue entry to contain a bracket. Building nodes removes
   * the question rather than answering it.
   *
   * The accessible name comes from the WRAPPING LABEL's visible text — the
   * model's display name, the recommended marker, and the id beneath it — which
   * is the enhancer's own arrangement. No aria-label, no title.
   *
   * @param {Object} model a catalogue entry
   * @param {boolean} checked
   * @returns {HTMLLabelElement}
   */
  function _buildRecommendedRadio(model, checked) {
    const label = document.createElement("label");
    label.className = "model-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = PICKER_RADIO_NAME;
    input.value = model.id;
    if (checked) {
      // BOTH, deliberately. `defaultChecked` writes the content attribute, so
      // the recommendation survives a native form reset — this picker lives
      // inside #resume-context-form, and a reset would otherwise leave the
      // group with nothing checked and no way to get back to it.
      input.defaultChecked = true;
      input.checked = true;
    }

    const content = document.createElement("span");
    content.className = "model-option-content";

    const name = document.createElement("span");
    name.className = "model-option-name";
    name.textContent = `${model.name || model.id} (Recommended)`;

    const description = document.createElement("span");
    description.className = "model-option-description";
    description.textContent = model.id;

    content.appendChild(name);
    content.appendChild(description);
    label.appendChild(input);
    label.appendChild(content);
    return label;
  }

  /**
   * Fill the override select with every PDF-capable model for this provider.
   *
   * @param {HTMLSelectElement|null} select
   * @param {Array<Object>} candidates
   */
  function _populateOverrideSelect(select, candidates) {
    if (!select) return;
    select.textContent = "";

    const placeholder = document.createElement("option");
    placeholder.value = PICKER_OVERRIDE_PLACEHOLDER;
    placeholder.textContent = "Use the recommended model above";
    select.appendChild(placeholder);

    for (const model of candidates) {
      const option = document.createElement("option");
      option.value = model.id;
      const providerPrefix = String(model.id).split("/")[0] || "";
      option.textContent = `${model.name || model.id} (${providerPrefix})`;
      select.appendChild(option);
    }
    select.value = PICKER_OVERRIDE_PLACEHOLDER;
  }

  /**
   * Build (or rebuild) the picker for the ACTIVE provider.
   *
   * THREE STATES, AND EXACTLY ONE RENDERS. Two-sided by construction, so the
   * empty state cannot show a radio and the populated state cannot show the
   * empty message — the shape `buildRecommendedModelSection` uses in the
   * enhancer.
   *
   *   1. a measured recommendation this provider can use — the radio group,
   *      preselected, with the round and the date as visible text, plus the
   *      override list;
   *   2. no such recommendation — no radio group, no fabricated default, the
   *      override list still offered, because `_resolveModel` can still resolve
   *      `pdfEligible[0]` and the run does proceed;
   *   3. the shared registry MODULE absent — the WL-1 refusal sentence, read by
   *      identity from `ABSENT_REGISTRY_REFUSAL` so there is one copy of it,
   *      and the override disclosure HIDDEN. `handleAnalyseClick` refuses on
   *      that condition before any model is resolved, so an override there
   *      would be a control whose value is discarded — which would contradict
   *      the refusal rather than agree with it.
   *
   * EVERY BUILD CLEARS THE USER'S PICK. That is the provider-change fail-safe:
   * a pick made under one provider cannot survive into another, whether or not
   * the new provider happens to serve it.
   *
   * @returns {boolean} true when the picker markup was found and rendered
   */
  function _buildModelPicker() {
    const els = this.elements;
    if (!els || !els.pickerRoot || !els.pickerOptions) {
      logDebug("_buildModelPicker: no picker markup on this page.");
      return false;
    }

    // Every build starts from a clean slate, so no state can be left over from
    // the provider that was active a moment ago.
    _userModelChoice = null;
    els.pickerOptions.textContent = "";
    if (els.pickerMeasured) els.pickerMeasured.textContent = "";
    if (els.pickerFieldset) els.pickerFieldset.hidden = true;
    if (els.pickerNone) els.pickerNone.hidden = true;
    if (els.pickerUnavailable) els.pickerUnavailable.hidden = true;
    if (els.pickerAdvanced) els.pickerAdvanced.hidden = false;
    els.pickerRoot.hidden = false;

    // --- STATE 3: the registry module is absent -----------------------------
    if (_modelRegistryIsAbsent()) {
      if (els.pickerUnavailable) {
        // BY IDENTITY, never retyped — the same constant WL-1's rows match on,
        // so the sentence the picker shows and the sentence the refusal speaks
        // cannot drift apart.
        els.pickerUnavailable.textContent = ABSENT_REGISTRY_REFUSAL;
        els.pickerUnavailable.hidden = false;
      }
      if (els.pickerAdvanced) els.pickerAdvanced.hidden = true;
      logWarn(
        "_buildModelPicker: the shared model registry module is absent from the page, so the picker offers no default and no override. This is a page-configuration fault: check the script order in tools.html."
      );
      return true;
    }

    const providerId = _activeProviderId();
    const candidates = _pdfCapableModelsFor(providerId);
    _populateOverrideSelect(els.pickerOverride, candidates);

    const entry = _recommendedEntryFor(providerId);
    const recommendedId =
      entry && typeof entry.modelId === "string" ? entry.modelId : null;
    const recommended = recommendedId
      ? candidates.find((model) => model.id === recommendedId) || null
      : null;

    // --- STATE 2: no measured recommendation this provider can use ----------
    if (!recommended) {
      if (els.pickerNone) els.pickerNone.hidden = false;
      logWarn(
        `_buildModelPicker: no measured recommendation is available for provider '${providerId}' that it can also use to read a PDF; offering the override list with nothing preselected rather than fabricating a default.`,
        { registryId: recommendedId, pdfCapableCount: candidates.length }
      );
      return true;
    }

    // --- STATE 1: the measured recommendation -------------------------------
    if (els.pickerFieldset) els.pickerFieldset.hidden = false;
    els.pickerOptions.appendChild(_buildRecommendedRadio(recommended, true));
    if (els.pickerMeasured) {
      els.pickerMeasured.textContent = `Chosen by measurement round ${entry.round}, measured ${_formatMeasuredDate(entry.measured)}.`;
    }
    logDebug("_buildModelPicker: built", {
      providerId,
      recommended: recommended.id,
      overrideOptions: candidates.length,
    });
    return true;
  }

  /**
   * A recommended radio was chosen.
   *
   * IT DOES NOT ANNOUNCE, AND THAT IS A DECISION RATHER THAN AN OMISSION.
   * Parcel MP-1 carries no screen-reader listen, and AGENTS.md § Announcements
   * is explicit that a silent event is a worse outcome than a doubled one — so
   * a line added here without being heard could be the defect it was meant to
   * prevent. A radio reports its own new state when the person moves it, which
   * is what a reader already speaks. WERE one added, the wording would be
   * "Context auto-fill will use <model name>." and it would owe a sitting on
   * both motion arms before it shipped.
   *
   * @param {string} modelId the radio's value
   */
  function _handleModelRadioChange(modelId) {
    const recommendedId = _defaultModelForProvider();
    if (modelId === recommendedId) {
      // Choosing the recommendation CLEARS the pick, so the run resolves down
      // the measured-default rung exactly as it did before MP-1 — the pre-MP-1
      // path is preserved rather than re-created by a pick that happens to
      // agree with it. The general branch below is what keeps this correct if a
      // later parcel puts more than one radio in the group.
      _setUserModelChoice(null);
    } else {
      _setUserModelChoice(modelId);
    }

    const els = this.elements;
    if (els && els.pickerOverride) {
      els.pickerOverride.value = PICKER_OVERRIDE_PLACEHOLDER;
    }
  }

  /**
   * The advanced override select changed. Also does not announce, for the same
   * reason as the radio handler above.
   *
   * @param {string} modelId a model id, or "" for the placeholder
   */
  function _handleModelOverrideChange(modelId) {
    const els = this.elements;

    if (!modelId) {
      _setUserModelChoice(null);
      if (els && els.pickerOptions) {
        const first = els.pickerOptions.querySelector('input[type="radio"]');
        if (first) first.checked = true;
      }
      return;
    }

    if (!_setUserModelChoice(modelId)) {
      // Refused. Put the control back where it was rather than leaving it
      // showing a model that will not be sent.
      if (els && els.pickerOverride) {
        els.pickerOverride.value = PICKER_OVERRIDE_PLACEHOLDER;
      }
      return;
    }

    if (els && els.pickerOptions) {
      const radios = els.pickerOptions.querySelectorAll('input[type="radio"]');
      for (const radio of radios) radio.checked = false;
    }
  }

  // ===========================================================================
  // SEND-BOUNDARY PREDICATES — delegating facade (parcel EA-4)
  // ===========================================================================
  // Both predicates, both refusal sentences and the umbrella fold MOVED to
  // mathpix-scripts/core/mathpix-model-capability.js at EA-4, together with the
  // vision predicate and the 27-entry known-vision list they had always been
  // siblings of. The comment that used to sit on isModelProviderAvailable said
  // this facade was their home UNTIL that module existed; it now does.
  //
  // What is left here is a working facade, kept so this parcel changes no
  // consumer. The enhancer, the multi-pass orchestrator and the suite all reach
  // window.MathPixContextAI at call time and are untouched; they are expected to
  // move to the shared module in a later parcel, at which point these four
  // exports and the two helpers above can go.
  //
  // Each delegation reaches the shared module at CALL time, so the facade stays
  // stubbable — several suite rows replace these very properties — and so a
  // reordered script tag fails loudly rather than capturing undefined.

  /**
   * Can this model id read a PDF attachment?
   *
   * @deprecated Moved to window.MathPixModelCapability.isModelPdfCapable at
   *   EA-4. The FF.1 asymmetry, the no-authority refusals and every branch
   *   comment moved with it, unchanged; read the decision table there.
   * @param {string} modelId - the model id actually about to be sent with.
   * @returns {boolean} true only when the id is positively established as able
   *   to read a PDF for its own provider. False when the shared module is
   *   absent, matching the predicate's own no-authority branch.
   */
  function isModelPdfCapable(modelId) {
    const shared = _capability();
    if (!shared || typeof shared.isModelPdfCapable !== "function") return false;
    return shared.isModelPdfCapable(modelId);
  }

  /**
   * Is this model served by the provider the user currently has selected?
   *
   * @deprecated Moved to window.MathPixModelCapability.isModelProviderAvailable
   *   at EA-4, along with PROVIDER_GROUPS and the fail-open reasoning.
   * @param {string} modelId
   * @returns {boolean} true when the model belongs to the active provider.
   *   False when the shared module is absent — the predicate's own lookup
   *   branch refuses on a missing authority for the same reason.
   */
  function isModelProviderAvailable(modelId) {
    const shared = _capability();
    if (!shared || typeof shared.isModelProviderAvailable !== "function") {
      return false;
    }
    return shared.isModelProviderAvailable(modelId);
  }

  /**
   * Create the hidden OpenRouter Embed instance for one context round-trip.
   *
   * Mirrors MathPixAIEnhancer.initialiseEmbed(): a single off-screen,
   * aria-hidden container (we never display its output), the provider-resolved
   * PDF-capable model (this._resolvedModel from _resolveModel(), with an
   * options.model override), the context system prompt drawn from buildPrompt()
   * so the system and
   * user halves can never drift, temperature 0.3, and a max_tokens scaled from
   * the source length but clamped between a sensible floor and the model cap.
   *
   * AW-33 / AW-34: this site supplies the givens for the SYSTEM half — the
   * PDF-attached sentence. The USER half's page-range clause is supplied at
   * handleAnalyseClick's own buildPrompt call. Both read the same run through
   * `_readPromptGivens(this.provider)`; there is no longer a single production
   * site, and a change to one of the two without the other is exactly the fault
   * that helper exists to prevent.
   *
   * @param {string} mmd — the document in Mathpix Markdown form.
   * @param {Array<Object>} schema — MathPixContextManager.getSchema() output.
   * @param {{model?: string, modelMaxOutput?: number}} [options]
   * @returns {Promise<Object>} the created embed instance (also on this.embed).
   */
  async function initEmbed(mmd, schema, options = {}) {
    logDebug("initEmbed: creating hidden context embed...");

    if (typeof OpenRouterEmbed === "undefined") {
      throw new Error("OpenRouterEmbed not available");
    }

    // Hidden, aria-hidden container — created once, reused. The embed library
    // requires a container; we never show what it renders into it.
    let container = document.getElementById(EMBED_CONTAINER_ID);
    if (!container) {
      container = document.createElement("div");
      container.id = EMBED_CONTAINER_ID;
      container.style.display = "none";
      container.setAttribute("aria-hidden", "true");
      document.body.appendChild(container);
    }

    // One id drives the whole run: an explicit options.model override first,
    // then the model _resolveModel() stored for this run (this._resolvedModel),
    // then the documented last-resort fallback. The cost preview reads the SAME
    // source, so the sent id and the estimated id cannot diverge.
    const model =
      options.model ||
      (this._resolvedModel && this._resolvedModel.id) ||
      _defaultModelForProvider();

    // ---- Send boundary (S2F-D8) ---------------------------------------------
    // The one final id is now resolved, and NOTHING has been constructed or
    // attached yet. Re-check capability HERE, on that id, whatever chose it.
    //
    // On the wired UI path this is defence in depth: handleAnalyseClick already
    // refuses when _resolveModel() returns null, so the button cannot reach an
    // incapable model. What this catches is everything the button is not — the
    // per-provider-default last rung of the ladder above, an options.model override,
    // and any direct caller of the exported facade. S2F-D8 locks the placement
    // at the send boundary on the resolved model precisely because a picker
    // filters the list and not the send.
    if (!isModelPdfCapable(model)) {
      logWarn("initEmbed: refusing a model that cannot read PDF files.", {
        model,
        resolvedForRun: this._resolvedModel && this._resolvedModel.id,
        explicitOverride: options.model || null,
      });
      // Read ONCE, so the announced and the thrown string are the same string
      // by construction rather than by two reads happening to agree.
      const refusal = _nonPdfRefusal();
      if (typeof this._announce === "function") {
        this._announce(refusal);
      }
      // Throw the SAME sentence the person hears, so a direct facade caller
      // cannot proceed and cannot invent its own wording for this refusal.
      throw new Error(refusal);
    }

    const modelCap = options.modelMaxOutput || DEFAULT_MODEL_MAX_OUTPUT;

    // AW-33 / AW-34 — tell the prompt what this run has actually been given,
    // read through the ONE helper both prompt halves use.
    const { systemPrompt } = buildPrompt(
      mmd,
      schema,
      _readPromptGivens(this.provider)
    );

    // Scale the response budget from the source length, then clamp to the floor
    // (the reply is only labelled blocks) and the model's output cap.
    const mmdLength = typeof mmd === "string" ? mmd.length : 0;
    const mmdTokens = Math.ceil(mmdLength / CHARS_PER_TOKEN);
    const maxTokens = Math.min(Math.max(mmdTokens, MAX_TOKENS_FLOOR), modelCap);

    this.embed = new OpenRouterEmbed({
      containerId: EMBED_CONTAINER_ID,
      model,
      systemPrompt,
      temperature: 0.3,
      max_tokens: maxTokens,
      showNotifications: false, // we surface our own feedback
      // No embed-rendered progress: we draw our own house-style row in
      // #resume-context-ai-progress and announce milestones ourselves. This
      // also stops the embed core appending its own off-screen SR live region.
      showStreamingProgress: false,
      // Parcel 38: the embed's own retry layer — same model, up to
      // EMBED_RETRY_MAX_ATTEMPTS resends with exponential backoff, pre-stream
      // failures only. The core's built-in retry announcement only logs and its
      // toast is gated on showNotifications (false above), so the write below
      // is the ONLY voice a retry has: once per retry, into this tool's own
      // existing region (#resume-context-ai-announce) through _announce. No
      // region is created and nothing is announced beside it.
      retry: {
        enabled: true,
        maxRetries: EMBED_RETRY_MAX_ATTEMPTS,
        onRetry: (attempt) => {
          if (typeof this._announce === "function") {
            this._announce(
              `Retrying, attempt ${attempt} of ${EMBED_RETRY_MAX_ATTEMPTS}.`,
            );
          }
        },
      },
      enableLogging: true,
    });

    logInfo("Context embed initialised", {
      provider: this._resolvedModel && this._resolvedModel.providerId,
      model,
      maxTokens,
      mmdLength,
    });

    return this.embed;
  }

  /**
   * Attach a PDF blob to the embed for the round-trip.
   *
   * Mirrors MathPixAIEnhancer.attachPDF(): wrap the blob in a File, base64-encode
   * it via readFileAsBase64(), and hang the file + base64 + a file analysis on
   * the embed for buildMessages() to read. Defaults the engine to "native"
   * (the right choice for mixed text/maths documents) and tolerates an embed
   * with no fileUtils (e.g. a test stub).
   *
   * @param {Blob} blob — the source PDF.
   * @returns {Promise<void>}
   */
  async function attachPDF(blob) {
    logDebug("attachPDF: attaching PDF to context embed...");

    if (!this.embed) {
      throw new Error("Embed not initialised — call initEmbed() first");
    }

    const filename = "context-source.pdf";
    const file =
      typeof File === "function"
        ? new File([blob], filename, { type: "application/pdf" })
        : blob;

    const base64Data = await readFileAsBase64(blob);

    this.embed.currentFile = file;
    this.embed.currentFileBase64 = base64Data;

    if (
      this.embed.fileUtils &&
      typeof this.embed.fileUtils.analyzeFile === "function"
    ) {
      try {
        this.embed.currentFileAnalysis =
          await this.embed.fileUtils.analyzeFile(file);
      } catch (error) {
        logWarn("File analysis failed, using native default:", error.message);
        this.embed.currentFileAnalysis = {
          pages: 1,
          engine: "native",
          cost: 0,
        };
      }
    } else {
      this.embed.currentFileAnalysis = { pages: 1, engine: "native", cost: 0 };
    }

    // Native engine reads the PDF directly — the right default for the mixed
    // text/maths documents the Context tab sees.
    if (!this.embed.currentFileAnalysis.engine) {
      this.embed.currentFileAnalysis.engine = "native";
    }

    // PC-1 — REPLACE THE SIZE GUESS WITH THE REAL PAGE COUNT, AND PRICE THE
    // FILE PARSER BY ENGINE. Runs AFTER the engine is final, because the fee
    // depends on it. See _applyRealPageCount.
    await _applyRealPageCount.call(this, blob);

    logInfo("PDF attached to context embed", {
      filename,
      size: blob && blob.size,
      engine: this.embed.currentFileAnalysis.engine,
      pages: this.embed.currentFileAnalysis.pages,
      cost: this.embed.currentFileAnalysis.cost,
      base64Length: base64Data.length,
    });
  }

  /**
   * Overwrite the embed's file analysis with a page count READ FROM THE PDF, and
   * a file-parser fee priced from the engine actually selected.
   *
   * WHAT THIS DISPLACES. `analyzeFile` returns `pages` from
   * `js/file-handler/file-handler-core.js`'s `estimatedPages`, which is
   * `file.size / estimatePageSize(file)` and reads nothing whatever from inside
   * the document. Measured at OC-1 B5 against all six corpus fixtures it is
   * wrong about every one, always upward — 164 pages reported for a 6-page
   * document, 27.3 times over — and the Context tab multiplied that guess by a
   * flat per-page rate to produce a figure a person is shown.
   *
   * WHEN THE COUNT CANNOT BE HAD, NOTHING IS SHOWN. `pages` and `cost` are set
   * to null and the surface renders its existing "Cost estimate unavailable"
   * sentence. It NEVER falls back to the heuristic: a person acting on a wrong
   * number is worse off than a person told the figure is unavailable.
   *
   * @param {Blob} blob — the source PDF.
   * @returns {Promise<void>}
   */
  async function _applyRealPageCount(blob) {
    const analysis = this.embed.currentFileAnalysis;
    const counter = window.MathPixPDFPageCount;

    if (!counter || typeof counter.countPages !== "function") {
      analysis.pages = null;
      analysis.cost = null;
      analysis.pageCountReason = "counter-absent";
      logWarn(
        "MathPixPDFPageCount is not loaded — no page count and no cost figure will be shown."
      );
      return;
    }

    let count;
    try {
      count = await counter.countPages(blob);
    } catch (error) {
      analysis.pages = null;
      analysis.cost = null;
      analysis.pageCountReason = "threw";
      logWarn("The page counter threw; no cost figure will be shown.", error);
      return;
    }

    analysis.pageCount = count;
    analysis.pageCountReason = count.reason;

    if (typeof count.pages !== "number") {
      analysis.pages = null;
      analysis.cost = null;
      return;
    }

    analysis.pages = count.pages;
    analysis.cost = _fileParserFee(analysis.engine, count.pages);
  }

  /**
   * Read a blob as base64 (without the data-URL prefix). Same FileReader pattern
   * as MathPixAIEnhancer.readFileAsBase64().
   *
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  function readFileAsBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = String(dataUrl).split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Failed to read PDF as base64"));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Send a user prompt through the embed with a hard timeout.
   *
   * Resolves with the caller-facing response TEXT (result.text, falling back to
   * result.content, then choices[0].message.content). Rejects with a guidance
   * message — suggesting a smaller document or a faster model — when the request
   * times out OR is aborted (an AbortError from the embed is treated the same as
   * the timeout signal firing). Any other failure is bridged to the central
   * error handler via _bridgeError() before the promise rejects with it.
   *
   * Uses AbortSignal.timeout() rather than setTimeout: Chrome throttles
   * setTimeout in background tabs, so a setTimeout-based timeout can fire late or
   * never; AbortSignal.timeout() fires at the browser level, on time.
   *
   * @param {string} userPrompt — the prompt (user half from buildPrompt()).
   * @param {number} timeoutMs — hard timeout in milliseconds.
   * @returns {Promise<string>} the response text.
   */
  async function sendWithTimeout(userPrompt, timeoutMs) {
    if (!this.embed) {
      throw new Error("Embed not initialised — call initEmbed() first");
    }
    if (typeof userPrompt !== "string" || userPrompt.trim() === "") {
      throw new Error("userPrompt is required");
    }

    const timeoutMessage =
      `Context auto-fill timed out after ${Math.round(timeoutMs / 1000)} seconds. ` +
      "The document may be too large or complex for the selected model. " +
      "Try a smaller document, fewer pages, or a faster model.";

    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    let settled = false;
    const self = this;

    return new Promise((resolve, reject) => {
      timeoutSignal.addEventListener("abort", () => {
        if (settled) return;
        settled = true;
        logError("Context auto-fill timed out", { timeoutMs });
        // Best-effort cancel of the in-flight request; never let cleanup mask
        // the rejection that follows.
        try {
          if (self.embed && typeof self.embed.cancelRequest === "function") {
            self.embed.cancelRequest("Context auto-fill timed out");
          }
        } catch (cancelError) {
          logWarn("Failed to cancel embed after timeout:", cancelError);
        }
        reject(new Error(timeoutMessage));
      });

      self.embed
        .sendRequest(userPrompt)
        .then((response) => {
          if (settled) return;
          settled = true;
          const text =
            response && typeof response.text === "string"
              ? response.text
              : response && typeof response.content === "string"
                ? response.content
                : response &&
                    response.choices &&
                    response.choices[0] &&
                    response.choices[0].message &&
                    typeof response.choices[0].message.content === "string"
                  ? response.choices[0].message.content
                  : "";
          resolve(text);
        })
        .catch((error) => {
          if (settled) return;
          settled = true;
          // An abort — from our timeout signal or the embed's own cancellation —
          // surfaces as the timeout guidance, not a raw AbortError.
          if ((error && error.name === "AbortError") || timeoutSignal.aborted) {
            reject(new Error(timeoutMessage));
            return;
          }
          // Any other failure is bridged to the central error handler before we
          // reject, so classification + handling happen once, here. Called via
          // `self._bridgeError` so a test (or later wiring) can intercept it.
          self._bridgeError(error);
          reject(error);
        });
    });
  }

  /**
   * Bridge an error to the central handler: classify, then handle.
   *
   * NOTE: the live singletons exposed on window (set in js/main.js) are
   * `errorClassification.classifyError(error, context)` and
   * `errorHandler.handleError(error, context)`. (CLAUDE.md's example shows
   * `.classify` / `.handle`, but no such methods exist on the real exports —
   * the actual API is used here.) Both are guarded so a bare page without the
   * ES-module error handler degrades quietly rather than throwing.
   *
   * @param {Error|Object|string} error
   * @returns {Object|null} the classification, or null if unavailable.
   */
  function _bridgeError(error) {
    try {
      let classification = null;
      if (
        window.errorClassification &&
        typeof window.errorClassification.classifyError === "function"
      ) {
        classification = window.errorClassification.classifyError(error, {
          feature: "context-auto-fill",
        });
      }
      if (
        window.errorHandler &&
        typeof window.errorHandler.handleError === "function"
      ) {
        window.errorHandler.handleError(error, {
          silent: true,
          userContext: "Context auto-fill",
          classification,
        });
      }
      return classification;
    } catch (bridgeError) {
      logWarn("_bridgeError itself failed:", bridgeError);
      return null;
    }
  }

  /**
   * Warn when a PDF's base64 form nears the OpenRouter upload limit.
   *
   * @param {Blob} blob — the source PDF.
   * @returns {string} a warning string when close to the limit, else "".
   */
  function _checkPdfSize(blob) {
    if (!blob || typeof blob.size !== "number") return "";

    const estBase64 = Math.ceil(blob.size * BASE64_EXPANSION);
    if (estBase64 < OPENROUTER_MAX_BASE64_BYTES * PDF_SIZE_WARN_RATIO) {
      return "";
    }

    const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
    const base64MB = (estBase64 / (1024 * 1024)).toFixed(1);
    return (
      `This PDF is ${sizeMB} MB (about ${base64MB} MB once base64-encoded), ` +
      "close to the OpenRouter upload limit. Consider a smaller document or " +
      "fewer pages before running context auto-fill."
    );
  }

  // ---------------------------------------------------------------------------
  // Wiring (P4) — the resume Context AI control: init, enabled-state gate,
  // click handler (round-trip), Undo handler, summary + cost + announce.
  //
  // These are stateful and live on the returned singleton (this.provider,
  // this.elements, this._snapshot, …). They MUST be called as
  // MathPixContextAI.method(...). Every async path is guarded so a failure
  // announces a recoverable message, routes through _bridgeError, and NEVER
  // writes the eight context fields (the only write is setContext(filled) after
  // a successful, non-empty parse).
  // ---------------------------------------------------------------------------

  /** True when at least one of the parsed/coerced fields carries a value. */
  function _hasAnyValue(obj) {
    return Object.values(obj || {}).some(
      (value) => typeof value === "string" && value.trim() !== ""
    );
  }

  /** Format a US dollar estimate (mirrors MathPixAIEnhancer.formatCost thresholds). */
  /**
   * THE UNIT IS US DOLLARS, AND THIS FUNCTION USED TO SAY POUNDS.
   *
   * Settled from the tree at PC-1, not chosen. Every input to the sum this
   * formats is a US-dollar figure:
   *
   *   - the model prices come from `registryModel.costs`, whose own comments in
   *     `js/model-definitions.js` read `input: 3.0, // $3.0/M tokens` and which
   *     are populated from the OpenRouter catalogue, and OpenRouter bills in US
   *     dollars;
   *   - the file-parser fee comes from `CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS`,
   *     whose `mistral-ocr: 2.0` was measured at OC-2b at the wire as exactly
   *     $0.002000 per real page — the same digits in a different currency, which
   *     is why the disagreement went unnoticed for so long.
   *
   * So the arithmetic was always in dollars and the symbol was always wrong. The
   * SYMBOL is corrected here, on the one surface this parcel owns; `£` on a
   * dollar figure survives on other surfaces across the application and is
   * reported as a separate, wider defect rather than swept into this parcel.
   *
   * @param {number|null} cost
   * @returns {string}
   */
  function _formatCostUSD(cost) {
    if (cost === null || cost === undefined || Number.isNaN(cost)) {
      return "Cost estimate unavailable";
    }
    if (cost < 0.01) return "< $0.01";
    if (cost < 0.1) return `~$${cost.toFixed(3)}`;
    return `~$${cost.toFixed(2)}`;
  }

  /**
   * The file-parser fee for a document, in US dollars — ENGINE-AWARE.
   *
   * The engine decides the price, not the file size. Measured at OC-2b and
   * confirmed against AW-26 on a different task and a different model: exactly
   * $0.022000 for `mistral-ocr` over 11 real pages, and exactly $0.000000 for
   * `native`. A native document must never be quoted an OCR fee, which is what
   * the displaced arithmetic did — it multiplied a size-guessed page count by a
   * flat per-page rate whatever engine had been chosen.
   *
   * The rate is READ from `CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS` rather than
   * restated here, so there is one source for it. That map carries a NUMBER for
   * the engines that charge per page and the string "Charged as input tokens"
   * for `native` — so a non-numeric entry means no separate file-parser fee, and
   * the document's cost is already inside the input-token half of the estimate.
   *
   * @param {string} engine
   * @param {number|null} pages — the REAL page count, or null.
   * @returns {number|null} dollars, or null when it cannot be known.
   */
  function _fileParserFee(engine, pages) {
    const costs =
      window.CONFIG &&
      window.CONFIG.FILE_UPLOAD &&
      window.CONFIG.FILE_UPLOAD.PDF_ENGINE_COSTS;
    if (!costs) {
      logWarn(
        "No PDF_ENGINE_COSTS on CONFIG — the file-parser fee cannot be priced, so no cost figure will be shown."
      );
      return null;
    }

    const rate = costs[engine];
    if (typeof rate !== "number") return 0;
    if (rate === 0) return 0;

    // Only a per-page engine needs a page count, and only here does an absent
    // count matter. NO FALLBACK TO THE SIZE HEURISTIC: a wrong number a person
    // acts on is worse than an absent one.
    if (typeof pages !== "number" || !(pages > 0)) {
      logWarn(
        "The real page count is unavailable and the engine '" +
          engine +
          "' charges per page, so no cost figure will be shown rather than one built on a size guess."
      );
      return null;
    }
    return (pages / PAGES_PER_RATE_UNIT) * rate;
  }

  /** Human-facing display value for the summary; selects map value → label. */
  function _displayValue(key, value, fields) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (raw === "") return "(empty)";
    if (SELECT_KEYS.includes(key)) {
      const opt = optionsFor(fields, key).find(
        (option) => option && String(option.value) === raw
      );
      if (opt) return opt.label;
    }
    return raw;
  }

  /**
   * Cache the hand-written P3 elements, bind the buttons once, and set the
   * initial enabled state. Gates on a truthy source-PDF (S1-Q7), not the mode.
   *
   * @param {Object|null} provider - a data provider (getSourcePDF/getMMDContent).
   * @returns {boolean} true when the control was found and wired.
   */
  function init(provider) {
    const elements = {};
    for (const [name, id] of Object.entries(RESUME_ELEMENT_IDS)) {
      elements[name] = document.getElementById(id);
    }
    // MP-1: looked up AFTER the analyse-button gate below is decided, but into
    // the SAME elements object, so every existing reader is untouched and the
    // picker cannot make `init` refuse. A page without the picker markup wires
    // the workflow exactly as it did before this parcel.
    for (const [name, id] of Object.entries(PICKER_ELEMENT_IDS)) {
      elements[name] = document.getElementById(id);
    }

    if (!elements.analyseBtn) {
      logWarn("init: #resume-context-ai-analyse not found; control not wired.");
      return false;
    }

    this.provider = provider || null;
    this.elements = elements;

    const self = this;
    if (!elements.analyseBtn.dataset.contextAiBound) {
      elements.analyseBtn.addEventListener("click", () =>
        self.handleAnalyseClick()
      );
      elements.analyseBtn.dataset.contextAiBound = "true";
    }
    if (elements.undoBtn && !elements.undoBtn.dataset.contextAiBound) {
      elements.undoBtn.addEventListener("click", () => self.handleUndoClick());
      elements.undoBtn.dataset.contextAiBound = "true";
    }

    // MP-1 — the picker: delegated change binding, one provider subscription,
    // one build. Bound with addEventListener and a dataset guard, matching the
    // two bindings above rather than the enhancer's inline `onchange` — that
    // form reaches a global accessor (`window.getMathPixAIEnhancer`) which this
    // module has no equivalent of, so copying it would mean publishing one.
    //
    // DELEGATED ON THE PICKER ROOT rather than on each control, because the
    // radios and the options are REBUILT on every provider change: a listener
    // bound to a node the rebuild replaces stops firing, silently, and a picker
    // that has quietly stopped responding looks exactly like one nobody used.
    if (elements.pickerRoot && !elements.pickerRoot.dataset.contextAiBound) {
      elements.pickerRoot.addEventListener("change", (event) => {
        const target = event && event.target;
        if (!target) return;
        if (
          target.type === "radio" &&
          target.name === PICKER_RADIO_NAME
        ) {
          self._handleModelRadioChange(target.value);
          return;
        }
        if (target.id === PICKER_ELEMENT_IDS.pickerOverride) {
          self._handleModelOverrideChange(target.value);
        }
      });
      elements.pickerRoot.dataset.contextAiBound = "true";
    }

    if (!this._providerChangedHandler) {
      this._providerChangedHandler = (event) => {
        logInfo("provider:changed — rebuilding the Context model picker", {
          oldProvider: event && event.detail && event.detail.oldProvider,
          newProvider: event && event.detail && event.detail.newProvider,
        });
        self._buildModelPicker();
      };
      window.addEventListener(
        "provider:changed",
        this._providerChangedHandler
      );
    }

    this._buildModelPicker();

    this.refreshAvailability();
    logInfo("Context AI control wired", { hasProvider: !!this.provider });
    return true;
  }

  /**
   * Re-evaluate the enabled state from live PDF availability. Called at init and
   * whenever the resume Context tab is shown (a one-line bridge in
   * session-restorer-pdf.js::switchTab). A truthy PDF enables the button; with
   * no PDF it stays disabled, its accessible explanation supplied by the static
   * aria-describedby hint (#resume-context-ai-analyse-hint).
   */
  function refreshAvailability() {
    const btn = this.elements && this.elements.analyseBtn;
    if (!btn) return;
    // Never re-enable mid-run; the click handler restores state in finally.
    if (this._busy) return;
    const hasPDF = !!(this.provider && this.provider.getSourcePDF());
    btn.disabled = !hasPDF;
    logDebug("refreshAvailability", { hasPDF });
  }

  /**
   * Announce a milestone through the dedicated polite region, write-then-clear
   * (mirrors session-restorer-convert.js::_announceConvertSize). Reserved for
   * the three milestones — start, success, failure — so it never double-speaks
   * with the embed progress indicator's own off-screen SR region.
   *
   * @param {string} message
   */
  function _announce(message) {
    const region = this.elements && this.elements.announce;
    if (!region || !message) return;
    region.textContent = message;
    clearTimeout(this._announceTimer);
    this._announceTimer = setTimeout(() => {
      region.textContent = "";
    }, ANNOUNCE_CLEAR_MS);
  }

  /** Clear the generated summary list. */
  function _clearSummary() {
    if (this.elements && this.elements.summary) {
      this.elements.summary.textContent = "";
    }
  }

  /** An icon-library SVG string, or "" when the library is absent. */
  function _progressIcon(name) {
    return typeof window.getIcon === "function" ? window.getIcon(name) : "";
  }

  /**
   * Render the house-style progress row into -progress: an icon-library icon
   * plus a short label, as a left-accent callout matching the cost/summary
   * panels. NOT a live region — the milestone announcements (start/success/
   * failure) carry the screen-reader narrative, so this is visual only.
   *
   * @param {string} label
   * @param {string} iconName - icon-library name (e.g. "loader", "check", "error").
   * @param {{spin?: boolean, state?: "busy"|"done"|"error"}} [opts]
   */
  function _progressShow(label, iconName, opts) {
    const options = opts || {};
    const el = this.elements && this.elements.progress;
    if (!el) return;

    clearTimeout(this._progressTimer);
    el.dataset.state = options.state || "busy";
    el.textContent = "";

    const icon = document.createElement("span");
    icon.className = "context-ai-progress-icon";
    if (options.spin) icon.classList.add("context-ai-progress-spin");
    icon.innerHTML = _progressIcon(iconName || "loader"); // trusted SVG string

    const text = document.createElement("span");
    text.className = "context-ai-progress-label";
    text.textContent = label;

    el.appendChild(icon);
    el.appendChild(text);
  }

  /** Final success state — a check icon that clears itself after a moment. */
  function _progressDone() {
    this._progressShow("Complete", "check", { state: "done" });
    this._scheduleProgressClear();
  }

  /** Final failure state — an error icon; the announce region carries detail. */
  function _progressFail() {
    this._progressShow("Auto-fill could not complete", "error", {
      state: "error",
    });
    this._scheduleProgressClear();
  }

  /** Clear the progress row and cancel any pending auto-clear. */
  function _progressClear() {
    const el = this.elements && this.elements.progress;
    clearTimeout(this._progressTimer);
    if (!el) return;
    el.textContent = "";
    delete el.dataset.state;
  }

  /** Auto-clear the final (done/error) state after a brief, readable pause. */
  function _scheduleProgressClear() {
    const self = this;
    clearTimeout(this._progressTimer);
    this._progressTimer = setTimeout(() => self._progressClear(), 1800);
  }

  /**
   * Render the info-only cost preview into -cost: the PDF's ENGINE-AWARE
   * file-parser fee, priced over the REAL page count read from the document
   * (PC-1), plus an MMD-length input-token estimate at the model's registry
   * price. Mirrors the AI Enhancer's preview — info only, never a gate.
   *
   * Degrades to a token count when no registry price is found OR when the
   * file-parser fee cannot be known, using the SAME sentence in both cases. No
   * new wording is introduced, so nothing here owes a screen-reader listen; the
   * element is a plain div carrying no live role, so neither branch is spoken by
   * itself in any event.
   *
   * @param {string} mmd
   */
  function _renderCostPreview(mmd) {
    const el = this.elements && this.elements.cost;
    if (!el) return;

    // The SAME id the send path used — never the map directly — so the estimate
    // always names and prices the model actually sent (send-id === estimate-id).
    // Falls back to the ACTIVE provider's default only when no model was
    // resolved for the run (e.g. a direct call outside handleAnalyseClick), and
    // it reads that provider the same way _resolveModel does: through
    // _defaultModelForProvider(), which resolves getActive() at call time.
    const resolvedId =
      (this._resolvedModel && this._resolvedModel.id) ||
      _defaultModelForProvider();

    // AW-29: the fallback can now be null (a provider absent from the map), and
    // the "unavailable for …" sentence below interpolates this id. Return
    // rather than render "…unavailable for null." — NO EXISTING SENTENCE'S
    // WORDING CHANGES, only whether one is written at all, and the sole caller
    // (handleAnalyseClick) has already blanked the element one line before it
    // reaches here. That caller also cannot take this branch: it refuses when
    // _resolveModel() returns null and only then sets this._resolvedModel, so
    // the id is always present on the wired journey. This guards the direct
    // facade call the comment above names.
    if (!resolvedId) {
      logWarn(
        "Cost preview: no model resolved and no default for the active provider; leaving the estimate blank rather than naming a model that would not be sent."
      );
      return;
    }

    const inputTokens = Math.ceil(
      (typeof mmd === "string" ? mmd.length : 0) / CHARS_PER_TOKEN
    );
    // PC-1 — A MISSING FILE-PARSER FEE IS NOT A ZERO ONE. This used to default
    // to 0, so a document whose fee could not be priced was quoted a total that
    // silently omitted it. Now an unknown fee makes the whole total unknown, and
    // the surface says so using the sentence it already had for that case.
    const analysis = this.embed && this.embed.currentFileAnalysis;
    const pdfCost = analysis ? analysis.cost : null;
    const pdfCostKnown = typeof pdfCost === "number" && !Number.isNaN(pdfCost);

    let registryModel = null;
    try {
      if (
        window.modelRegistry &&
        typeof window.modelRegistry.getAllModels === "function"
      ) {
        registryModel =
          window.modelRegistry
            .getAllModels()
            .find((model) => model && model.id === resolvedId) || null;
      }
    } catch (error) {
      logWarn("Cost preview: registry lookup failed:", error);
      registryModel = null;
    }

    if (registryModel && registryModel.costs && pdfCostKnown) {
      // Registry prices are per 1,000,000 tokens (per the AI Enhancer).
      const inputCost =
        (inputTokens / 1_000_000) * (registryModel.costs.input || 0);
      // The reply is a small labelled-block set — budget the floor for output.
      const outputCost =
        (MAX_TOKENS_FLOOR / 1_000_000) * (registryModel.costs.output || 0);
      const total = inputCost + outputCost + pdfCost;
      el.textContent =
        `Estimated cost: ${_formatCostUSD(total)} ` +
        `(about ${inputTokens.toLocaleString()} input tokens). ` +
        "This is an estimate; the actual cost depends on the document and the reply.";
    } else {
      el.textContent =
        `About ${inputTokens.toLocaleString()} input tokens. ` +
        `Cost estimate unavailable for ${resolvedId}.`;
    }
  }

  /**
   * Populate -summary with one row per schema field, showing the value before
   * and after the fill. Built in JS (data-driven content is the allowed
   * JS-generated markup); model values go in via textContent only, never
   * innerHTML, so a reply can never inject markup. Uses a decorative arrow
   * (no data-icon spans, so no populateIcons call is required).
   *
   * @param {Object} before - snapshot from getContext().
   * @param {Object} after  - the coerced fill applied via setContext().
   * @param {Array<Object>} fields - schema (for labels + select option labels).
   */
  function _renderSummary(before, after, fields) {
    const el = this.elements && this.elements.summary;
    if (!el) return;
    el.textContent = "";

    const schemaFields = Array.isArray(fields) ? fields : [];

    const heading = document.createElement("p");
    heading.className = "context-ai-summary-heading";
    heading.textContent = "AI-filled fields — review and edit:";
    el.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "context-ai-summary-list";

    for (const field of schemaFields) {
      if (!field || typeof field.key !== "string") continue;
      const key = field.key;

      const item = document.createElement("li");
      item.className = "context-ai-summary-row";

      const label = document.createElement("span");
      label.className = "context-ai-summary-label";
      label.textContent = `${field.label || key}: `;
      item.appendChild(label);

      const beforeSpan = document.createElement("span");
      beforeSpan.className = "context-ai-summary-before";
      beforeSpan.textContent = _displayValue(
        key,
        before ? before[key] : "",
        schemaFields
      );
      item.appendChild(beforeSpan);

      const arrow = document.createElement("span");
      arrow.className = "context-ai-summary-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = " → ";
      item.appendChild(arrow);

      const connector = document.createElement("span");
      connector.className = "sr-only";
      connector.textContent = " changed to ";
      item.appendChild(connector);

      const afterSpan = document.createElement("span");
      afterSpan.className = "context-ai-summary-after";
      afterSpan.textContent = _displayValue(
        key,
        after ? after[key] : "",
        schemaFields
      );
      item.appendChild(afterSpan);

      list.appendChild(item);
    }

    el.appendChild(list);
  }

  /**
   * Run one context auto-fill round-trip. Guarded end to end: any failure
   * (no PDF/MMD, embed init, attach, timeout, offline, empty/malformed reply)
   * announces a recoverable message, bridges the error, and leaves the eight
   * fields untouched — the sole write is setContext(filled) after a non-empty
   * parse, followed by one mathpix:context-edited event.
   *
   * @returns {Promise<void>}
   */
  async function handleAnalyseClick() {
    if (this._busy) return;

    const provider = this.provider;
    if (!provider) {
      this._announce("Context auto-fill is not available.");
      return;
    }

    const pdf = provider.getSourcePDF();
    const mmd = provider.getMMDContent();
    if (!pdf) {
      this._announce("Load a PDF before running context auto-fill.");
      this.refreshAvailability();
      return;
    }
    if (!mmd || mmd.trim() === "") {
      this._announce("There is no document text to analyse yet.");
      return;
    }

    // ---- WL-1: AN ABSENT REGISTRY MODULE REFUSES WITH ITS OWN SENTENCE ------
    //
    // ASKED BEFORE `_resolveModel`, NOT AFTER, and that ordering is the whole
    // separation. Both conditions arrive at the rung below as a bare null: a
    // provider that genuinely serves no PDF-capable model, and a page with no
    // registry at all. Asking here means the shipped sentence below keeps
    // EXACTLY the condition it was written for, and no public signature moves —
    // `_resolveModel` is exported and read by four measurement drives, and it
    // is untouched.
    //
    // MEASURED 14 September 2026, and the two providers failed DIFFERENTLY,
    // which is why a wording change alone would not have been enough. With the
    // registry deleted, `_defaultModelForProvider` returns null for both. On
    // OpenRouter no model carries a ['pdf'] token, so the fallback anchor is
    // null, `_resolveModel` returns null and the person got the misdirecting
    // sentence. On Foundry the ['pdf'] list is NON-EMPTY, so `pdfEligible[0]`
    // won by list position and auto-fill RAN, silently, on a model nobody
    // measured. This rung refuses both.
    //
    // SPOKEN AND SEEN. `_announce` writes `#resume-context-ai-announce`, which
    // is `sr-only` — position absolute, 1px, clip-rect — so a sighted person
    // was told NOTHING by any refusal on this tab. `_progressShow` paints the
    // EXISTING house-style error row, `#resume-context-ai-progress` with
    // `data-state="error"`: a left-accent callout already themed in light.css
    // and dark.css, already collapsing when empty, and carrying NO role and NO
    // aria-live — so it cannot double-speak with the announcement beside it.
    // NO NEW CSS IS INTRODUCED. It is deliberately NOT `_progressFail`, whose
    // `_scheduleProgressClear` would wipe the box after 1800ms; a refusal a
    // person has to act on must stay on screen until the next run clears it.
    if (this._modelRegistryIsAbsent()) {
      logWarn(
        "Context auto-fill refused: the shared model registry module is absent from the page, so no measured choice can be read for any provider. This is a page-configuration fault: check the script order in tools.html."
      );
      this._announce(ABSENT_REGISTRY_REFUSAL);
      this._progressShow(ABSENT_REGISTRY_REFUSAL, "error", { state: "error" });
      this.refreshAvailability();
      return;
    }

    // Resolve ONE model for this run from the global provider switch (S2F-D8).
    // The Context tab always attaches a PDF, so a provider that serves no
    // PDF-capable model cannot run auto-fill — refuse cleanly before any embed
    // is built or any request is sent. Same guard shape as the ones above.
    const resolved = this._resolveModel();
    if (!resolved) {
      logWarn(
        "Context auto-fill refused: active provider has no PDF-capable model."
      );
      this._announce(
        "This provider cannot read PDF files. Choose a different provider to run context auto-fill."
      );
      this.refreshAvailability();
      return;
    }
    this._resolvedModel = resolved;

    const schema =
      (window.MathPixContextManager &&
        typeof window.MathPixContextManager.getSchema === "function" &&
        window.MathPixContextManager.getSchema()) ||
      [];

    this._busy = true;
    const btn = this.elements.analyseBtn;
    // Parcel 42: HOLD Analyse rather than natively disabling it. Native
    // `disabled` on the button the person just pressed blurred it to <body>,
    // and nothing ever put focus back (parcel 39, the worst of nine drops).
    // BusyControl sets aria-disabled and aria-busy, refuses activation, and
    // leaves focus on the button. Resolved at call time, never cached; if the
    // helper is absent the old native line runs, drop and all.
    const busyControl = window.BusyControl;
    if (busyControl && typeof busyControl.hold === "function") {
      this._busyHold = busyControl.hold(btn);
    } else {
      logWarn(
        "handleAnalyseClick: window.BusyControl is absent; disabling Analyse natively, which drops keyboard focus."
      );
      btn.disabled = true;
    }
    this._clearSummary();
    if (this.elements.cost) this.elements.cost.textContent = "";
    if (this.elements.undoBtn) this.elements.undoBtn.hidden = true;
    this._progressClear(); // clear any lingering progress from a prior run

    // The progress row is a VISUAL affordance only (house-style, rendered by
    // _progressShow below — NOT a live region): the dedicated polite region
    // carries the milestones, so screen-reader users are not double-spoken. The
    // embed makes no progress UI of its own (showStreamingProgress: false in
    // initEmbed), so there is no purple-gradient widget or stray live region.
    this._announce("Analysing the document to suggest context values…");

    try {
      this._progressShow("Preparing the document…", "loader", { spin: true });
      await this.initEmbed(mmd, schema);
      await this.attachPDF(pdf);

      // Info-only cost preview, now that analyzeFile has produced its figure.
      this._renderCostPreview(mmd);

      // AW-34 — the page-range clause now lives in the USER half, so this call
      // must supply the givens too. A two-argument call here would build a user
      // prompt with no clause at all, which is WORSE than the misplacement it
      // replaces: the guard would simply stop shipping. Same helper, same
      // provider, same run as initEmbed's system half.
      const { userPrompt } = this.buildPrompt(
        mmd,
        schema,
        _readPromptGivens(this.provider)
      );

      this._progressShow("Generating context suggestions…", "loader", {
        spin: true,
      });
      this._announce("Generating context suggestions. This can take a moment…");
      const text = await this.sendWithTimeout(userPrompt, CONTEXT_TIMEOUT_MS);

      this._progressShow("Finalising…", "loader", { spin: true });
      const parsed = this.parseResponse(text, schema);
      const filled = this.coerceSelects(parsed, schema);

      if (!_hasAnyValue(filled)) {
        throw new Error(
          "The document did not yield any context values. Please try again, " +
            "or fill the fields in yourself."
        );
      }

      const manager = window.MathPixContextManager;
      if (!manager || typeof manager.setContext !== "function") {
        throw new Error("Context manager unavailable; cannot apply values.");
      }

      // Snapshot BEFORE writing so Undo can restore it exactly.
      this._snapshot =
        typeof manager.getContext === "function" ? manager.getContext() : {};

      manager.setContext(filled);
      document.dispatchEvent(new CustomEvent("mathpix:context-edited"));

      this._renderSummary(this._snapshot, filled, schema);
      if (this.elements.undoBtn) this.elements.undoBtn.hidden = false;

      this._progressDone();
      this._announce("Context fields filled. Review and edit them.");
    } catch (error) {
      logError("Context auto-fill failed:", error);
      this._progressFail();
      // Every failure path bridges to the central handler (idempotent + silent)
      // and surfaces a recoverable message. No field has been written.
      this._bridgeError(error);
      this._announce(
        error && error.message
          ? error.message
          : "Context auto-fill failed. Please try again."
      );
    } finally {
      // Release BEFORE refreshAvailability, which returns early while `_busy`
      // and otherwise writes the standing no-PDF state exactly as before.
      // Focus still on Analyse stays there; the helper never moves it.
      if (this._busyHold) {
        this._busyHold.release();
        this._busyHold = null;
      }
      this._busy = false;
      this.refreshAvailability();
    }
  }

  /**
   * Undo: restore the pre-fill snapshot through setContext + the same single
   * mathpix:context-edited event (re-dispatching it keeps the resume save
   * button shown — expected per S1-Q6), hide the Undo button, and clear the
   * summary.
   */
  function handleUndoClick() {
    const manager = window.MathPixContextManager;
    if (!manager || typeof manager.setContext !== "function") return;
    if (!this._snapshot) return;

    manager.setContext(this._snapshot);
    document.dispatchEvent(new CustomEvent("mathpix:context-edited"));

    if (this.elements.undoBtn) this.elements.undoBtn.hidden = true;
    this._clearSummary();
    this._snapshot = null;

    // The button-hide and summary-clear are visual only; announce the result so
    // a screen-reader user who activates Undo hears it (write-then-clear).
    this._announce("Context restored to its previous values.");
    logInfo("Context auto-fill undone (snapshot restored).");
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  logInfo("MathPixContextAI loaded (pure core + transport + wiring).");

  return {
    // Pure prompt/parse/coerce core (P1).
    buildPrompt,
    // AW-34. Exported so a capture drive reads the SHIPPED givens through the
    // SAME helper the two production call sites use. A drive that re-read the
    // provider itself would be a second recipe, and would capture a prompt no
    // user can receive — which is the one thing a prompt capture must not do.
    _readPromptGivens,
    parseResponse,
    coerceSelects,
    // Transport (P2). `embed` is the live instance, set by initEmbed(); exposed
    // so it can be inspected and, under test, replaced with a stub.
    embed: null,
    _resolveModel,
    // Per-provider default (AW-29; repointed at I5-2). The RESOLVER is exported
    // and the map is NOT — because there is no longer a map here to export.
    //
    // `DEFAULT_BY_PROVIDER` WAS EXPORTED HERE UNTIL I5-2 AND HAS BEEN REMOVED
    // WITH IT. The comment it carried said both were exported "so the suite can
    // pin the LITERAL ids rather than compare a function against the map it
    // reads" — which was the right reasoning and did not need the map. A suite
    // pinning literals never had to read the map at all, and the one row that
    // did (12.1, asserting the map was frozen) was asserting a property of a
    // private copy whose whole purpose has now moved to the shared registry.
    // Section 12 pins the same two ids as literals, unchanged, and asks the
    // registry the frozen-ness question instead.
    _defaultModelForProvider,
    // WL-1: the module-presence predicate the refusal rung is keyed on, and the
    // sentence it speaks. Both exported so a row can assert the rung and the
    // predicate separately — a row driving only `handleAnalyseClick` cannot say
    // WHICH question refused — and so the line is matched BY IDENTITY rather
    // than retyped.
    _modelRegistryIsAbsent,
    ABSENT_REGISTRY_REFUSAL,
    // ------------------------------------------------------------------------
    // Send-boundary facade (parcel EA-4). All four MOVED to
    // window.MathPixModelCapability; these are working delegations kept so no
    // consumer changed in that parcel, and they are expected to be retired once
    // the consumers are repointed. New code should read the shared module.
    //
    // The two predicates stay WRITABLE data properties rather than getters
    // because several suite rows stub them in place and restore them by
    // reference afterwards; a getter would break that silently.
    // ------------------------------------------------------------------------
    /** @deprecated Use window.MathPixModelCapability.isModelPdfCapable. */
    isModelPdfCapable,
    /** @deprecated Use window.MathPixModelCapability.isModelProviderAvailable. */
    isModelProviderAvailable,
    /** @deprecated Use window.MathPixModelCapability.NON_PDF_REFUSAL. */
    get NON_PDF_REFUSAL() {
      return _nonPdfRefusal();
    },
    /** @deprecated Use window.MathPixModelCapability.PROVIDER_REFUSAL. */
    get PROVIDER_REFUSAL() {
      return _providerRefusal();
    },
    initEmbed,
    attachPDF,
    // PC-1 — exported so a row can assert the fee and the count SEPARATELY. A
    // row driving only attachPDF cannot say whether a zero fee came from the
    // engine being native or from the page count being unavailable, and those
    // are different states with the same total.
    _applyRealPageCount,
    _fileParserFee,
    _formatCostUSD,
    readFileAsBase64,
    sendWithTimeout,
    _bridgeError,
    _checkPdfSize,
    // Wiring (P4). State slots default here; init() populates provider/elements.
    provider: null,
    elements: null,
    _snapshot: null,
    _resolvedModel: null,
    _busy: false,
    // Parcel 42: the BusyControl handle holding Analyse for one run; null
    // between runs and on the native fallback.
    _busyHold: null,
    _progressTimer: null,
    // MP-1: the provider:changed subscriber handle, so init() is idempotent and
    // cannot stack a second listener on a re-init.
    _providerChangedHandler: null,
    init,
    // ------------------------------------------------------------------------
    // MP-1 — the model picker. Exported so the suite can drive the picker and
    // read the choice WITHOUT reaching into module scope, and so a row can
    // assert the control and the resolver separately: a row driving only
    // `_resolveModel` cannot say whether the PICKER offered the id it resolved.
    // ------------------------------------------------------------------------
    _buildModelPicker,
    _handleModelRadioChange,
    _handleModelOverrideChange,
    _setUserModelChoice,
    _getUserModelChoice,
    _pdfCapableModelsFor,
    _recommendedEntryFor,
    _formatMeasuredDate,
    _resolveUserChoice,
    PICKER_ELEMENT_IDS,
    PICKER_RADIO_NAME,
    refreshAvailability,
    handleAnalyseClick,
    handleUndoClick,
    _announce,
    _clearSummary,
    _renderCostPreview,
    _renderSummary,
    _progressShow,
    _progressDone,
    _progressFail,
    _progressClear,
    _scheduleProgressClear,
  };
})();

// Expose globally (IIFE module pattern, no ES6 import/export).
window.MathPixContextAI = MathPixContextAI;

// ---------------------------------------------------------------------------
// Self-bootstrap (P4) — wire the resume Context AI control once the DOM and the
// data-provider factory are present. The provider is the canonical resume
// provider; getSourcePDF()/getMMDContent() read live each call, so building it
// before any session loads is safe (it simply reports no PDF until one does).
// Wrapped so a missing dependency or absent markup degrades quietly and never
// breaks page load.
// ---------------------------------------------------------------------------
(function bootstrapResumeContextAI() {
  function boot() {
    try {
      if (typeof window.createResumeDataProvider !== "function") {
        return; // data provider not on this page — nothing to wire.
      }
      const provider = window.createResumeDataProvider(() =>
        typeof window.getMathPixSessionRestorer === "function"
          ? window.getMathPixSessionRestorer()
          : null
      );
      window.MathPixContextAI.init(provider);
    } catch (error) {
      if (window.console && window.console.warn) {
        console.warn("[MathPixContextAI] bootstrap failed:", error);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
