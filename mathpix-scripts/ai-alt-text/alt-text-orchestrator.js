/**
 * @file alt-text-orchestrator.js
 * @module MathPixAltTextOrchestrator
 * @description
 * Phase 2 Stage 2, Parcel 5.1a — the AI-description ORCHESTRATOR (choreography
 * only). This is the headless, stub-driven choreography that binds the four
 * ai-alt-text collaborators (adapter → parser → write stage) around the progress
 * controller and speaks EXACTLY ONE aria-live line per run.
 *
 * ── What it does ────────────────────────────────────────────────────────────
 * `create(options)` bakes the injected collaborators and returns `{ run }`.
 * `run({ image, id, model })`:
 *   1. drives the progress controller (PREPARING → GENERATING),
 *   2. calls the INJECTED adapter's `generate({ image, prompt, model })`, which
 *      ALREADY returns a FINALISED contract result (it calls finalise itself),
 *   3. branches on `result.status` — the orchestrator does NOT finalise,
 *   4. on success: FINALISING → parse → write → hideProgress(true) → ONE
 *      showStatus success line,
 *   5. on error: hideProgress(false) → ONE showError with the VERBATIM contract
 *      error (S2F option 1).
 *
 * ── What it deliberately does NOT do ────────────────────────────────────────
 * It constructs NO embed and injects NO real DOM — that is 5.1c. It does NOT
 * call `finalise` (the adapter already did). It stamps NO source other than the
 * injected one. It reaches NO embed. It keeps exactly ONE showStatus OR ONE
 * showError per run (never both), so the progress module's honesty pin holds:
 * a single aria-live line on success, a single one on error.
 *
 * ── Injection ──────────────────────────────────────────────────────────────
 * The module attaches to `window` at definition time, but an INSTANCE reaches
 * the defaulted globals only at CALL time, guarded:
 *   • adapter  — REQUIRED, injected (embed-backed in production via 5.1c/the
 *     trigger; a stub in tests). No production default; logWarn if absent.
 *   • progress — REQUIRED, injected (a real factory controller in production, a
 *     stub in tests).
 *   • registry — optional; default window.getMathPixSessionRestorer?.().imageRegistry
 *     reached at CALL time.
 *   • parser   — optional; default window.MathPixAltTextParser at call time.
 *   • writeStage — optional; default window.MathPixAltTextWriteStage at call time.
 *   • prompt   — optional; default DESCRIPTION_PROMPT.
 *   • source   — optional; default DEFAULT_SOURCE.
 *
 * British spelling throughout; no `title` attribute; no DOM built here.
 *
 * @see mathpix-scripts/ai-alt-text/alt-text-cloud-adapter.js (2.3 — generate() returns a FINALISED contract result)
 * @see mathpix-scripts/ai-alt-text/alt-text-generation-contract.js (2.1 — STATUS.SUCCESS/ERROR)
 * @see mathpix-scripts/ai-alt-text/alt-text-progress.js (1.1 — showProgress/showStatus/showError/hideProgress)
 * @see mathpix-scripts/ai-alt-text/alt-text-parser.js (3.1 — parse(rawText) → { title, alt, long, text })
 * @see mathpix-scripts/ai-alt-text/alt-text-write-stage.js (4.1 — write({ registry, id, fields, source }))
 * @see image-describer/image-describer-controller-generate.js (buildQwenPrompt — the four-section shape mirrored below)
 */

const MathPixAltTextOrchestrator = (function () {
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
      console.error(`[AltTextOrchestrator] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AltTextOrchestrator] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AltTextOrchestrator] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AltTextOrchestrator] ${message}`, ...args);
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /**
   * The single polite aria-live line spoken on a successful run. Wording is a
   * judgement call refined at 5.1c after the real NVDA listen; kept short and
   * plain for now.
   */
  const SUCCESS_ANNOUNCEMENT = "AI description generated.";

  // ---------------------------------------------------------------------------
  // Parcel 8d — the CORE SENTENCE
  //
  // SUCCESS_ANNOUNCEMENT above is true of every successful run and specific to
  // none of them: it says a description was generated whether the run filled
  // four blanks, displaced text the person was reading a moment ago, or wrote
  // nothing at all because every field was theirs. buildCoreSentence replaces it
  // at the showStatus call with a sentence assembled from the write stage's own
  // per-field dispositions, so the line describes what actually happened.
  //
  // FOUR clauses, in this fixed order, each omitted entirely when it has nothing
  // to report, joined by a single space, each ending in a full stop:
  //
  //   1. fills        — a count, never field names. Nothing was displaced, so
  //                     naming the fields would spend the listener's attention
  //                     on the outcome that needs it least.
  //   2. replacements — named. MACHINE text was displaced.
  //   3. overwrites   — named, possessive. Per the 8d-fid lock this reports a
  //                     displaced SOURCE, not displaced text: the write stage
  //                     returns "overwritten" whether or not the frozen prior
  //                     held anything, so the clause must stay true of a field
  //                     that was empty but owned. That is why it must NEVER use
  //                     the word "replaced" — clause 2's word, and a different
  //                     claim.
  //   4. kept         — named, same possessive as clause 3 by design. It reports
  //                     a PROTECTION, never a failure: the write stage stood
  //                     back because the person owns that field. "Overwrote your
  //                     Caption" when they authorised it; "Kept your Caption"
  //                     when they did not.
  //
  // "skipped", "empty" and "not-found" contribute NO clause, and neither does an
  // unrecognised value (forward-safe). CORE_NO_WRITES is therefore NARROWER than
  // "nothing happened": an all-frozen run returns the kept clause, and only a run
  // where every field was skipped, empty or not-found reaches that line.
  // ---------------------------------------------------------------------------

  /**
   * The disposition strings this module matches on. A NECESSARY COPY: the write
   * stage's DISPOSITION object is module-private (its return exposes only
   * `write`, `NO_TEXT_SENTINEL` and `FROZEN_SOURCES`), so these cannot be
   * imported. They are matched by VALUE against alt-text-write-stage.js's
   * DISPOSITION.WRITTEN / REPLACED / OVERWRITTEN / FROZEN — change one end and
   * the affected clause silently stops firing, which is why the gate carries a
   * row per clause rather than one row for the function.
   */
  const DISPOSITION_WRITTEN = "written";
  const DISPOSITION_REPLACED = "replaced";
  const DISPOSITION_OVERWRITTEN = "overwritten";
  const DISPOSITION_FROZEN = "frozen";

  /**
   * The four write-stage field keys in the order clauses name them — the same
   * order the write stage's FIELD_MAP commits them in, so the sentence reads in
   * the order the interface lists the fields.
   */
  const CORE_FIELD_ORDER = Object.freeze(["title", "alt", "long", "text"]);

  /**
   * Field key → human label. The SECOND necessary copy: these are byte-identical
   * to FIELD_LABELS in mathpix-image-manager-ui.js, reached through that file's
   * FIELD_SELECT_ROWS `writeKey` bridge (caption→title is the deliberate
   * non-matching pair). Importing is not an option — this module is headless and
   * must stay callable with no manager, no DOM and no page. The label-parity
   * guard row compares the two at runtime; it is the only thing that catches a
   * rename on either side.
   *
   * Stored in the interface's own capitalisation so the parity guard stays an
   * EXACT string comparison — the case rule is applied at RENDER time instead
   * (see sentenceCaseLabel / lowerCaseLabel). Weakening the guard to a
   * case-insensitive compare to accommodate the rule would blind it to exactly
   * the drift it exists to catch.
   */
  const CORE_FIELD_LABELS = Object.freeze({
    title: "Caption",
    alt: "Alt text",
    long: "Long description",
    text: "Text in image",
  });

  /**
   * Counts are spoken as WORDS, per house style for numbers under ten. The list
   * is indexed by count, and four fields is the hard ceiling — the write stage
   * reports on exactly four keys — so every reachable plural is covered here.
   * A count outside the list falls back to the digit with a WARN rather than
   * throwing: this string is spoken, and a line that reads slightly wrong is a
   * far better outcome than an exception inside the one announcement a person
   * gets. See countWord.
   */
  const CORE_COUNT_WORDS = Object.freeze(["One", "Two", "Three", "Four"]);

  /** Clause templates. Tokens are substituted in ONE pass — see fillTemplate. */
  const CORE_FILLS_SINGULAR = "One description written.";
  const CORE_FILLS_PLURAL = "{count} descriptions written.";
  const CORE_REPLACEMENTS = "{fields} replaced.";
  const CORE_OVERWRITES = "Overwrote your {fields}.";
  const CORE_KEPT = "Kept your {fields}.";

  /** The all-quiet line. See the narrowing note above — this is NOT all-frozen. */
  const CORE_NO_WRITES = "No descriptions written.";

  /**
   * Substitution tokens and the single alternation that matches them.
   *
   * ONE replace over this pattern with a FUNCTION replacer, never chained
   * sequential replaces: chaining is order-dependent, so a value substituted by
   * an earlier pass is rescanned by a later one. A function replacer also stops
   * String.replace treating `$&` or `$1` inside a substituted value as a
   * substitution pattern of its own. Field labels are fixed constants here and
   * carry neither hazard today, but the pattern is what makes that a property of
   * the code rather than of the current label strings.
   */
  const CORE_COUNT_TOKEN = "{count}";
  const CORE_FIELDS_TOKEN = "{fields}";
  const CORE_TOKEN_PATTERN = /\{count\}|\{fields\}/g;

  /** Joiners: clause-to-clause, and the list join inside a named clause. */
  const CORE_CLAUSE_SEPARATOR = " ";
  const CORE_LIST_SEPARATOR = ", ";
  const CORE_LIST_FINAL_SEPARATOR = " and ";

  /** Default provenance value stamped by the write stage. */
  const DEFAULT_SOURCE = "ai-generated";

  /**
   * Fallback error line when the contract carries no error string (defensive —
   * the contract's F1 invariant supplies DEFAULT_ERROR_MESSAGE, so this is a
   * belt-and-braces only).
   */
  const FALLBACK_ERROR_MESSAGE = "AI description could not be generated.";

  /** Error line when a collaborator throws unexpectedly (the catch tail). */
  const UNEXPECTED_ERROR_MESSAGE = "AI description failed unexpectedly.";

  /**
   * Fallback STATUS vocabulary when the 2.1 contract is unavailable at call
   * time. Mirrors STATUS.SUCCESS / STATUS.ERROR exactly.
   */
  const STATUS_FALLBACK = Object.freeze({ SUCCESS: "success", ERROR: "error" });

  /**
   * The four-section instruction sent to a cloud model.
   *
   * THE FOUR HEADERS ARE A PARSER CONTRACT, not prose. They mirror
   * buildQwenPrompt in image-describer-controller-generate.js so the parser
   * round-trips against what the model is asked to emit — `## 1. Title`,
   * `## 2. Alt Text`, `## 3. Long Description`, `## 4. Text Content`, and the
   * section-4 "No text content." sentinel (which the parser passes through
   * literally — treating it as empty is the write stage's policy, not the
   * parser's).
   *
   * WHAT BINDS IS THE NAME, NOT THE NUMBER. `alt-text-parser.js` matches a
   * heading line at ANY level 1-6, strips an optional leading "N." with
   * `(?:\d+\.?\s*)?`, then looks the normalised name up in `NAME_TO_FIELD`. So
   * RENAMING or RE-WORDING any of the four silently routes that section's
   * content to the wrong field or drops it, while RENUMBERING is tolerated by
   * construction — `## 5. Title` still resolves to `title`, and so does a bare
   * `## Title`. The numbers are kept anyway, for parity with buildQwenPrompt and
   * because they help the model hold the order. Do not rename the four.
   *
   * THE GUIDANCE DELIBERATELY DIVERGES from buildQwenPrompt. That prompt targets
   * a small local model, where terse instructions do better; this one targets a
   * cloud model that can follow structural guidance, so sections 2 and 3 ask for
   * screen-reader-first prose and for markdown structure where it aids
   * comprehension. Most of it is adapted from the image describer's own prompt
   * text (`image-describer/prompts/prompt-image-description.txt`), recorded as
   * read B6 in
   * `mathpix-scripts/docs/alt-text/context-aware-prompts-plan.md`. The banned
   * "Image of" opener is NOT from that source — it came from the CTX-P2 dispatch,
   * and the B-addendum in the plan document says so rather than implying a
   * provenance it does not have.
   *
   * NO HEADING LEVEL IS SPECIFIED ANYWHERE HERE, on purpose. Levels are owned by
   * `demoteEntryHeadings` in `mathpix-alt-text-mmd-serialiser.js`, which
   * normalises whatever the model emits at serialise time by rank compaction. A
   * level named here would go stale the moment the appendix level moved (plan
   * decision A4).
   *
   * The reserved-name sentence in section 3 is a MEASURED mitigation, not
   * politeness: a subheading whose name normalises to one of the four section
   * names re-opens that field in the parser and misroutes everything after it.
   * Inviting headings at all is what makes that reachable, so the invitation and
   * the warning ship together (parcel CTX-P2 read 2, hazard probe).
   *
   * FORM: a single template literal whose lines start at COLUMN ZERO. Indenting
   * it to match the surrounding code would inject leading whitespace into every
   * line of the prompt. A suite row pins that no line begins with whitespace, so
   * a well-meaning re-indent reddens instead of silently changing what the model
   * is sent.
   */
  const DESCRIPTION_PROMPT = `Describe this image for accessibility using these sections:

## 1. Title
A brief descriptive title under 10 words.

## 2. Alt Text
One or two sentences, concise enough to serve as an HTML alt attribute: what the image shows, then why it matters educationally. It must stand alone when the image fails to load. Do not open with "Image of", "Picture of", "A photograph of" or any similar phrase — the reader already knows this is an image.

## 3. Long Description
Describe the visual content and its educational purpose in full. Write for someone listening to this description rather than looking at the image, and put the important information first.

Use markdown structure wherever it aids comprehension, rather than as decoration:

- a numbered list for steps, sequences, or anything the reader must take in order;
- a bullet list for unordered groups of related points;
- a markdown table where the content is genuinely tabular, so a screen-reader user can navigate it by row and column;
- headings to separate the distinct parts of a longer description.

Where the image carries data, give the actual values, in a table if they suit one, and order them logically — chronologically for a time series, or highest to lowest for ranked data.

Do not reuse "Title", "Alt Text", "Long Description" or "Text Content" as a heading inside this section.

## 4. Text Content
List every word, number, and label visible in the image. If none, write "No text content."`;

  // ---------------------------------------------------------------------------
  // Global reach helpers (reached at CALL time, guarded)
  // ---------------------------------------------------------------------------

  /**
   * The STATUS vocabulary, reached at call time from the 2.1 contract; falls
   * back to STATUS_FALLBACK when the contract is absent.
   * @returns {{SUCCESS: string, ERROR: string}}
   */
  function _status() {
    const status =
      window.MathPixAltTextGenerationContract &&
      window.MathPixAltTextGenerationContract.STATUS;
    if (!status || !status.SUCCESS || !status.ERROR) {
      logWarn(
        "MathPixAltTextGenerationContract.STATUS unavailable at call time — using fallback vocabulary",
      );
      return STATUS_FALLBACK;
    }
    return status;
  }

  /** The default registry (session restorer's imageRegistry), reached at call time. */
  function _defaultRegistry() {
    const restorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;
    return restorer ? restorer.imageRegistry : null;
  }

  // ---------------------------------------------------------------------------
  // CORE SENTENCE — pure, so a node smoke check can call it with no page
  // ---------------------------------------------------------------------------

  /**
   * Substitute every token in one pass over CORE_TOKEN_PATTERN.
   *
   * A token with no supplied value is left in place rather than rendered as
   * "undefined" — a template carrying an unexpected token then fails visibly
   * instead of quietly speaking the word "undefined" at somebody.
   *
   * @param {string} template - a clause template.
   * @param {Object} valuesByToken - keyed by the token strings themselves.
   * @returns {string}
   */
  function fillTemplate(template, valuesByToken) {
    return template.replace(CORE_TOKEN_PATTERN, (token) => {
      const value = valuesByToken[token];
      if (value === undefined) {
        logWarn(
          `fillTemplate(): no value supplied for token "${token}" — leaving it in place`,
        );
        return token;
      }
      return value;
    });
  }

  /**
   * The count as a word ("Two"), or the digit with a WARN when it falls outside
   * CORE_COUNT_WORDS. Never throws — see the constant's note.
   *
   * @param {number} count
   * @returns {string}
   */
  function countWord(count) {
    const word = CORE_COUNT_WORDS[count - 1];
    if (word === undefined) {
      logWarn(
        `countWord(): count ${count} is outside CORE_COUNT_WORDS — falling back to the digit`,
      );
      return String(count);
    }
    return word;
  }

  /**
   * Case helpers, applied at RENDER time only — CORE_FIELD_LABELS keeps the
   * interface's own capitalisation so the parity guard stays exact.
   *
   * Both touch the FIRST CHARACTER only, never the whole string: a label is a
   * short phrase whose later words are already cased as they should read
   * ("Alt text" → "alt text"), and a blanket toLowerCase would flatten any
   * proper noun or acronym a future label carries.
   */
  function sentenceCaseLabel(label) {
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function lowerCaseLabel(label) {
    return label.charAt(0).toLowerCase() + label.slice(1);
  }

  /**
   * Join field keys as their labels: "A", "A and B", "A, B and C".
   *
   * Field names are sentence-cased at a clause START and lower-cased
   * everywhere else. Only the replacements clause is field-first, so only it
   * passes clauseInitial — the overwrites and kept clauses open with a verb, so
   * every label in them is lower case. Passed as a named option rather than a
   * bare boolean, so the call site says which rule it is asking for.
   *
   * @param {string[]} fields - field keys, already in CORE_FIELD_ORDER order.
   * @param {Object} [options]
   * @param {boolean} [options.clauseInitial=false] - true when the list opens
   *   the clause, so its FIRST label (and only its first) is sentence-cased.
   * @returns {string}
   */
  function joinFieldLabels(fields, options) {
    const clauseInitial = Boolean(options && options.clauseInitial);
    const labels = fields.map((field, index) => {
      const label = CORE_FIELD_LABELS[field];
      return clauseInitial && index === 0
        ? sentenceCaseLabel(label)
        : lowerCaseLabel(label);
    });
    if (labels.length === 1) return labels[0];
    return (
      labels.slice(0, -1).join(CORE_LIST_SEPARATOR) +
      CORE_LIST_FINAL_SEPARATOR +
      labels[labels.length - 1]
    );
  }

  /**
   * Build the run's core sentence from the write stage's per-field disposition
   * map — the `results` object of a write-stage return.
   *
   * PURE: no DOM, no `this`, no registry read, no global reach. It can be called
   * directly from a node smoke check, which is the point — the sentence is the
   * part of this parcel most worth pinning, and pinning it must not need a page.
   *
   * Clause order and wording are documented at the constants above; the two
   * rules worth restating at the code are that clause 3 never uses the word
   * "replaced" (it reports a displaced SOURCE, not displaced text), and that
   * CORE_NO_WRITES is narrower than "nothing happened" (an all-frozen run
   * returns the kept clause instead).
   *
   * A missing or non-object map degrades to SUCCESS_ANNOUNCEMENT — the older,
   * vaguer line that is still TRUE of any successful run. It deliberately does
   * NOT fall through to CORE_NO_WRITES: with the dispositions unreadable we do
   * not know that nothing was written, and a specific false line is worse than
   * a general true one.
   *
   * @param {Object} results - per-field dispositions keyed by title/alt/long/text.
   * @returns {string} the core sentence.
   */
  function buildCoreSentence(results) {
    if (!results || typeof results !== "object") {
      logWarn(
        "buildCoreSentence(): dispositions missing or not an object — degrading to the generic success line",
      );
      return SUCCESS_ANNOUNCEMENT;
    }

    const fills = [];
    const replacements = [];
    const overwrites = [];
    const kept = [];

    for (const field of CORE_FIELD_ORDER) {
      const disposition = results[field];
      switch (disposition) {
        case DISPOSITION_WRITTEN:
          fills.push(field);
          break;
        case DISPOSITION_REPLACED:
          replacements.push(field);
          break;
        case DISPOSITION_OVERWRITTEN:
          overwrites.push(field);
          break;
        case DISPOSITION_FROZEN:
          kept.push(field);
          break;
        default:
          // "skipped", "empty", "not-found", and anything unrecognised: no
          // clause. Forward-safe — a disposition added later is silent here
          // until it is given wording, rather than mis-spoken as one of these.
          logDebug(
            `buildCoreSentence(): ${field} disposition "${disposition}" contributes no clause`,
          );
          break;
      }
    }

    const clauses = [];

    if (fills.length === 1) {
      clauses.push(CORE_FILLS_SINGULAR);
    } else if (fills.length > 1) {
      clauses.push(
        fillTemplate(CORE_FILLS_PLURAL, {
          [CORE_COUNT_TOKEN]: countWord(fills.length),
        }),
      );
    }

    if (replacements.length > 0) {
      clauses.push(
        // The only field-first clause, so its first label opens the sentence.
        fillTemplate(CORE_REPLACEMENTS, {
          [CORE_FIELDS_TOKEN]: joinFieldLabels(replacements, {
            clauseInitial: true,
          }),
        }),
      );
    }

    if (overwrites.length > 0) {
      clauses.push(
        fillTemplate(CORE_OVERWRITES, {
          [CORE_FIELDS_TOKEN]: joinFieldLabels(overwrites),
        }),
      );
    }

    if (kept.length > 0) {
      clauses.push(
        fillTemplate(CORE_KEPT, {
          [CORE_FIELDS_TOKEN]: joinFieldLabels(kept),
        }),
      );
    }

    if (clauses.length === 0) {
      logDebug(
        "buildCoreSentence(): no clause to report — every field was skipped, empty or not-found",
      );
      return CORE_NO_WRITES;
    }

    return clauses.join(CORE_CLAUSE_SEPARATOR);
  }

  // ===========================================================================
  // FACTORY — bake the injected collaborators
  // ===========================================================================

  /**
   * Create an orchestrator instance bound to injected collaborators.
   *
   * @param {Object} [options]
   * @param {Object} options.adapter - REQUIRED. { generate({ image, prompt, model }) }
   *   returning a FINALISED contract result. No production default.
   * @param {Object} options.progress - REQUIRED. A controller exposing
   *   showProgress / showStatus / showError / hideProgress.
   * @param {Object} [options.registry] - optional; default reached at call time
   *   via window.getMathPixSessionRestorer?.().imageRegistry.
   * @param {Object} [options.parser] - optional; default window.MathPixAltTextParser.
   * @param {Object} [options.writeStage] - optional; default window.MathPixAltTextWriteStage.
   * @param {string} [options.prompt] - optional; default DESCRIPTION_PROMPT.
   * @param {string} [options.source] - optional; default DEFAULT_SOURCE.
   * @returns {{ run: Function }}
   */
  function create(options) {
    const opts = options || {};
    const adapter = opts.adapter || null;
    const progress = opts.progress || null;
    const injectedRegistry = opts.registry || null;
    const injectedParser = opts.parser || null;
    const injectedWriteStage = opts.writeStage || null;
    const prompt =
      typeof opts.prompt === "string" && opts.prompt ? opts.prompt : DESCRIPTION_PROMPT;
    const source = opts.source != null ? opts.source : DEFAULT_SOURCE;

    if (!adapter || typeof adapter.generate !== "function") {
      logWarn(
        "create(): no adapter injected (or no generate) — run() will error until one is supplied",
      );
    }
    if (
      !progress ||
      typeof progress.showProgress !== "function" ||
      typeof progress.showStatus !== "function" ||
      typeof progress.showError !== "function" ||
      typeof progress.hideProgress !== "function"
    ) {
      logWarn(
        "create(): progress controller is missing or incomplete — run() cannot drive the UI",
      );
    }

    /**
     * Drive one AI-description generation end to end. Wrapped in try/catch so a
     * thrown collaborator never leaves the progress UI stuck. Exactly ONE
     * showStatus OR ONE showError is emitted per run (never both).
     *
     * @param {Object} runOptions
     * @param {File|Blob} runOptions.image - the image to describe.
     * @param {string} runOptions.id - the registry entry id to write onto.
     * @param {string} [runOptions.model] - explicit model id override (passed to adapter).
     * @param {string[]} [runOptions.overwriteFields] - optional write-stage field keys a
     *   person explicitly authorised for overwrite in the interface (Parcel 8b). Forwarded
     *   to the write stage UNVALIDATED — the write stage owns validation.
     * @param {string[]} [runOptions.writeFields] - optional write-stage field keys
     *   restricting WHICH fields this run writes (Parcel 8c-iv-pre). Forwarded to the write
     *   stage UNVALIDATED and RAW — the write stage owns validation, and it distinguishes
     *   `undefined` (no restriction) from `null` (select nothing), which are opposite
     *   outcomes, so this value is never defaulted or coerced here. `writeFields` is SCOPE
     *   and `overwriteFields` is PERMISSION: neither implies the other, so narrowing the
     *   scope never authorises replacing a frozen field.
     * @returns {Promise<Object>} on success: { status: "success", result, fields, writeResult };
     *   on contract error: { status: "error", result }; on thrown error:
     *   { status: "error", error }.
     */
    async function run(runOptions) {
      const r = runOptions || {};
      const STATUS = _status();

      try {
        // 1. Drive the visual progress into the generating state.
        progress.showProgress("PREPARING");
        progress.showProgress("GENERATING");

        // 2. Call the injected adapter — it returns a FINALISED contract result.
        const result = await adapter.generate({
          image: r.image,
          prompt,
          model: r.model,
        });

        // 3. Branch on the finalised status (never finalise here).
        if (result && result.status === STATUS.SUCCESS) {
          // 4a. Success — finalise the visual bar, parse, write, speak once.
          progress.showProgress("FINALISING");

          const parser = injectedParser || window.MathPixAltTextParser;
          const writeStage = injectedWriteStage || window.MathPixAltTextWriteStage;
          const registry = injectedRegistry || _defaultRegistry();

          const fields = parser.parse(result.text || "");
          const writeResult = writeStage.write({
            registry,
            id: r.id,
            fields,
            source,
            overwriteFields: r.overwriteFields,
            writeFields: r.writeFields,
          });

          progress.hideProgress(true);
          // The ONE success line — Parcel 8d. Built from the write stage's own
          // per-field dispositions rather than the fixed SUCCESS_ANNOUNCEMENT,
          // so it describes THIS run. The call's arity and its "success" type
          // are unchanged, and so are run()'s three resolution shapes: only the
          // string moved.
          progress.showStatus(
            buildCoreSentence(writeResult && writeResult.results),
            "success",
          );

          logDebug("run(): success", {
            id: r.id,
            overwriteFields: r.overwriteFields,
            writeFields: r.writeFields,
            writeResult,
          });
          return { status: "success", result, fields, writeResult };
        }

        // 4b. Error — the contract's only other status. Speak the VERBATIM
        //     contract error once (S2F option 1).
        progress.hideProgress(false);
        logWarn("generation failed", result && result.error);
        // The ONE error line.
        progress.showError(
          (result && result.error) || FALLBACK_ERROR_MESSAGE,
        );

        return { status: "error", result };
      } catch (err) {
        // 5. A collaborator threw — tear the UI down defensively and speak once.
        logError("orchestrator run threw", err);
        try {
          progress.hideProgress(false);
          progress.showError(UNEXPECTED_ERROR_MESSAGE);
        } catch (defensiveErr) {
          logError(
            "orchestrator defensive teardown also threw",
            defensiveErr,
          );
        }
        return { status: "error", error: err };
      }
    }

    return { run };
  }

  logInfo("MathPixAltTextOrchestrator ready (choreography only)");

  return {
    create,
    // Parcel 8d — the pure sentence builder, exposed so it can be gated with no
    // page, and its labels, exposed so the label-parity guard can compare this
    // module's necessary copy against the manager's FIELD_LABELS at runtime.
    buildCoreSentence,
    CORE_FIELD_LABELS,
    // Exposed for tests / callers that need the constants literally.
    SUCCESS_ANNOUNCEMENT,
    DESCRIPTION_PROMPT,
    DEFAULT_SOURCE,
  };
})();

window.MathPixAltTextOrchestrator = MathPixAltTextOrchestrator;
