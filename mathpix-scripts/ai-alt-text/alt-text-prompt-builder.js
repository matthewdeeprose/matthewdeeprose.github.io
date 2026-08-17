/**
 * @fileoverview MathPix alt-text prompt builder — assembles the cloud
 *   description prompt from document context, an MMD excerpt and a position
 *   clause.
 * @module MathPixAltTextPromptBuilder
 * @version 1.0.0 (parcel CTX-P3)
 * @since Phase 4 item 2, context-aware prompts
 *
 * @description
 * ONE exported function, `buildDescriptionPrompt({ context, mmd, entry,
 * allEntries })`, returning one string. It is PURE: every input arrives as an
 * argument, nothing is read off `window` inside it, and it holds no state
 * between calls. That is deliberate — it means the whole builder can be gated
 * with no page, no registry and no session, which is how its rows run.
 *
 * WHY A SEPARATE MODULE (plan decision A1). The orchestrator already accepts a
 * finished `prompt` string and has no business knowing where context comes
 * from. Wiring it in is parcel CTX-P4, which will reach this module by the
 * call-time global convention the orchestrator already uses for its other
 * collaborators — `const parser = injectedParser || window.MathPixAltTextParser;`
 * resolved inside `run()` (alt-text-orchestrator.js ~:640). This file therefore
 * publishes `window.MathPixAltTextPromptBuilder` at definition time and takes no
 * load-order dependency on anything.
 *
 * THE DEGRADATION PROPERTY IS THE POINT. Given nothing usable — no context, no
 * MMD, no position — the return value is BYTE-IDENTICAL to the orchestrator's
 * exported `DESCRIPTION_PROMPT`. So enriching can only ever add; it can never
 * silently change what a model is asked for when the inputs are missing. The
 * suite pins that by string identity against the export itself, not against a
 * copy of it.
 *
 * @see mathpix-scripts/docs/alt-text/context-aware-prompts-plan.md — decisions
 *   A1, A3, A4 and A9, and the B5 window measurements these constants come from
 * @see mathpix-scripts/ai-alt-text/alt-text-orchestrator.js — DESCRIPTION_PROMPT
 * @see mathpix-scripts/ai-alt-text/alt-text-parser.js — the four-section contract
 */

const MathPixAltTextPromptBuilder = (function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

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
      console.error(`[AltTextPromptBuilder] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AltTextPromptBuilder] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AltTextPromptBuilder] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AltTextPromptBuilder] ${message}`, ...args);
  }

  // ============================================================================
  // THE FOUR-SECTION INSTRUCTION — A NECESSARY COPY
  // ============================================================================

  /**
   * The module's own copy of the orchestrator's `DESCRIPTION_PROMPT`.
   *
   * IT IS A COPY ON PURPOSE, and the duplication is guarded rather than
   * tolerated. Reading the orchestrator's export at build time would make this
   * module impure and would give it a load-order dependency it does not
   * otherwise have; reading it at call time would make the builder fail soft
   * in exactly the case its own degradation rule exists to cover. So it is
   * copied, and a suite row asserts the two are byte-identical at runtime —
   * the same arrangement, and the same reasoning, as `CORE_FIELD_LABELS` in
   * the orchestrator, whose docblock calls itself a necessary copy and is
   * pinned by a label-parity guard.
   *
   * If that row ever reddens, the two have drifted: copy the orchestrator's
   * value here, do not edit the row.
   *
   * FORM: a template literal whose lines start at COLUMN ZERO. Indenting it
   * would inject leading whitespace into every line of the prompt and break the
   * byte-identity row. A row pins that no line begins with whitespace.
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

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  /**
   * The eight context keys, in the order they are presented to the model, each
   * with the plain-words label that introduces it. Order and spelling are taken
   * from `MathPixContextManager`'s own `SCHEMA` declaration order so a reader
   * comparing the two sees the same sequence.
   *
   * A frozen const object as an enum, per the house convention.
   */
  const CONTEXT_FIELD_LABELS = Object.freeze({
    subjectArea: "Subject area",
    specificTopic: "Specific topic",
    learningObjective: "Learning objective",
    moduleName: "Module name",
    moduleCode: "Module code",
    audienceLevel: "Audience level",
    documentType: "Document type",
    extraInformation: "Additional information",
  });

  /** The eight keys in presentation order, derived so the two cannot drift. */
  const CONTEXT_KEY_ORDER = Object.freeze(Object.keys(CONTEXT_FIELD_LABELS));

  /**
   * Excerpt window: lines either side of the image's own line. Plan decision
   * A9, grounded in the B5 measurements — the largest window at which every one
   * of the capacitors fixture's eleven excerpts stays under 1200 characters
   * (worst case measured 1170), so the cap below is a backstop for a denser
   * document rather than the routine limiter.
   */
  const MMD_EXCERPT_LINES_EACH_SIDE = 8;

  /**
   * Excerpt character cap. Plan decision A9: clears the fixture's worst case at
   * the window above with headroom, while sitting below the 1629 measured at ±12
   * lines, so it bounds a long-line document without truncating this one.
   *
   * ⚠ ON THE CAPACITORS FIXTURE THIS CAP NEVER FIRES. It is a documented
   * non-exercise, not a validated limit; the truncation ladder below is
   * therefore gated by constructed rows rather than by the fixture, and the
   * first real document that trips it is the first real test of it.
   */
  const MMD_EXCERPT_CHAR_CAP = 1500;

  /** `extraInformation` is free text and can be arbitrarily long; cap it. */
  const EXTRA_INFORMATION_CHAR_CAP = 2000;

  /** Appended when `extraInformation` is cut, so the model knows it was cut. */
  const CONTEXT_TRUNCATION_MARKER = "[context truncated]";

  const CONTEXT_HEADING = "Document context for this image:";
  const EXCERPT_BEGIN =
    "--- BEGIN surrounding document text (the image appears within this excerpt) ---";
  const EXCERPT_END = "--- END surrounding document text ---";
  const BLOCK_SEPARATOR = "\n\n";

  // ============================================================================
  // INTERNAL — CONTEXT BLOCK
  // ============================================================================

  /**
   * True when a context value is worth sending: a string with something other
   * than whitespace in it. Everything else — null, undefined, a number, an
   * empty string, three spaces — is skipped rather than sent as an empty label,
   * because a label with nothing after it spends tokens telling the model
   * nothing and invites it to invent a value.
   * @param {*} value
   * @returns {boolean}
   */
  function isUsableContextValue(value) {
    return typeof value === "string" && value.trim() !== "";
  }

  /**
   * Build the labelled context block, or `null` when no field is usable.
   * @param {Object} context
   * @returns {string|null}
   */
  function buildContextBlock(context) {
    if (!context || typeof context !== "object") return null;

    const lines = [];
    for (const key of CONTEXT_KEY_ORDER) {
      const raw = context[key];
      if (!isUsableContextValue(raw)) continue;

      let value = raw.trim();
      if (
        key === "extraInformation" &&
        value.length > EXTRA_INFORMATION_CHAR_CAP
      ) {
        // Cut at the cap and mark it, so a model reading a sentence that stops
        // mid-thought knows the stop was ours and not the author's.
        value =
          value.slice(0, EXTRA_INFORMATION_CHAR_CAP) +
          " " +
          CONTEXT_TRUNCATION_MARKER;
        logDebug(
          `extraInformation truncated at ${EXTRA_INFORMATION_CHAR_CAP} characters`,
        );
      }
      lines.push(`${CONTEXT_FIELD_LABELS[key]}: ${value}`);
    }

    if (lines.length === 0) return null;
    return CONTEXT_HEADING + "\n" + lines.join("\n");
  }

  // ============================================================================
  // INTERNAL — MMD EXCERPT
  // ============================================================================

  /**
   * A positive integer line number, 1-based, as the registry stores it. The
   * registry's default is `null`, and a non-integer would index nothing useful,
   * so both are treated as "no position known".
   * @param {*} value
   * @returns {boolean}
   */
  function isUsableLineNumber(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= 1;
  }

  /**
   * Build the fenced MMD excerpt around the image's line, or `null`.
   *
   * TRUNCATION RULE (plan decision A9, settled at CTX-P3). Start from the full
   * ±`MMD_EXCERPT_LINES_EACH_SIDE` window, then while the joined text exceeds
   * `MMD_EXCERPT_CHAR_CAP`, drop whole lines from whichever end is FARTHER from
   * the image's own line, so the window shrinks symmetrically towards it. Three
   * properties follow, and each has its own row:
   *
   *   • a line is never split — the excerpt is always whole lines, because half
   *     a table row or half a sentence is worse than one line less context;
   *   • the image's OWN line is never dropped, whatever the cap forces, since an
   *     excerpt that has lost the image it surrounds describes nothing;
   *   • on a tie the EARLIER line goes first, so the text following an image is
   *     preferred over the text preceding it. That is a judgement, not a
   *     measurement: a caption or an explanation more often follows a figure
   *     than precedes it. It is deterministic, which is what the rows need.
   *
   * NEIGHBOURING IMAGES ARE LEFT IN, deliberately (plan finding B5, settled at
   * CTX-P3). At ±8 lines, eight of the capacitors fixture's eleven windows
   * contain another image's reference line, so excerpts are NOT disjoint. They
   * stay because a neighbouring figure is genuine relational context — "the
   * figure above this one shows the uncharged state" is exactly the kind of
   * sentence a good long description can use, and stripping the reference would
   * leave the prose around it dangling mid-sentence.
   *
   * @param {string} mmd - The working MMD.
   * @param {number} lineNumber - The image's 1-based line number.
   * @returns {string|null}
   */
  function buildExcerptBlock(mmd, lineNumber) {
    if (typeof mmd !== "string" || mmd === "") return null;
    if (!isUsableLineNumber(lineNumber)) return null;

    const allLines = mmd.split("\n");
    const targetIndex = lineNumber - 1;
    if (targetIndex >= allLines.length) {
      logDebug(
        `lineNumber ${lineNumber} is past the end of the MMD (${allLines.length} lines) — no excerpt`,
      );
      return null;
    }

    let from = Math.max(0, targetIndex - MMD_EXCERPT_LINES_EACH_SIDE);
    let to = Math.min(
      allLines.length - 1,
      targetIndex + MMD_EXCERPT_LINES_EACH_SIDE,
    );

    // Shrink towards the target line until the joined body fits the cap. The
    // guards keep the target itself, so the loop always terminates with at
    // least that one line present.
    while (allLines.slice(from, to + 1).join("\n").length > MMD_EXCERPT_CHAR_CAP) {
      const distanceAbove = targetIndex - from;
      const distanceBelow = to - targetIndex;
      if (distanceAbove === 0 && distanceBelow === 0) break;
      if (distanceAbove >= distanceBelow && distanceAbove > 0) {
        from += 1;
      } else if (distanceBelow > 0) {
        to -= 1;
      } else {
        break;
      }
    }

    const body = allLines.slice(from, to + 1).join("\n");
    logDebug(
      `excerpt lines ${from + 1}-${to + 1} around line ${lineNumber}, ${body.length} characters`,
    );
    return EXCERPT_BEGIN + "\n" + body + "\n" + EXCERPT_END;
  }

  // ============================================================================
  // INTERNAL — POSITION CLAUSE
  // ============================================================================

  /**
   * Build the position clause, or `null`.
   *
   * DIGITS, NOT WORDS, and that is a deliberate departure from the house
   * spoken-number convention. The coverage-counter lines in the image manager
   * spell numbers zero to nine because a screen reader says them aloud; this
   * string is MACHINE-FACING — it goes into a prompt, is read by a model, and is
   * never spoken to anyone. Digits are what a model handles most reliably, and
   * "image 3 of 11" needs no agreement rules.
   *
   * Ordering is by `lineNumber` ascending with nulls last, because
   * `registry.getAllImages()` returns Map INSERTION order rather than document
   * order (measured at CTX-P0, read B4). An entry whose own line is unknown gets
   * no clause at all, and an entry absent from `allEntries` gets none either —
   * a position asserted from a list that does not contain you is a guess.
   *
   * @param {Object} entry
   * @param {Array<Object>} allEntries
   * @returns {string|null}
   */
  function buildPositionClause(entry, allEntries) {
    if (!entry || typeof entry !== "object") return null;
    if (!isUsableLineNumber(entry.lineNumber)) return null;
    if (!Array.isArray(allEntries) || allEntries.length === 0) return null;

    const ordered = allEntries
      .filter((e) => e && typeof e === "object")
      .slice()
      .sort((a, b) => {
        const aHas = isUsableLineNumber(a.lineNumber);
        const bHas = isUsableLineNumber(b.lineNumber);
        if (aHas && bHas) return a.lineNumber - b.lineNumber;
        if (aHas) return -1; // a has a line, b does not — nulls last
        if (bHas) return 1;
        return 0;
      });

    const total = ordered.length;
    const index = ordered.findIndex((e) => e.id === entry.id);
    if (index === -1) {
      logDebug(
        "entry not present in allEntries — omitting the position clause rather than guessing",
      );
      return null;
    }

    return `This is image ${index + 1} of ${total} in the document.`;
  }

  // ============================================================================
  // PUBLIC
  // ============================================================================

  /**
   * Assemble the description prompt.
   *
   * ONE PASS, NO REPLACE CHAINS. Each optional block is pushed onto an array in
   * presentation order and the array is joined once. A chained
   * `.replace().replace()` over a template would rescan already-substituted
   * text, so a context value containing a token would be rewritten by a later
   * pass — the defect the serialiser's own single-pass rule exists to prevent.
   * Joining an array cannot do that.
   *
   * THE ORDER IS: context, position, excerpt, then the four-section instruction
   * last. The instruction goes last so it is the freshest thing in the model's
   * window when it starts writing, and so the degradation case below is a plain
   * consequence of the array holding one element.
   *
   * DEGRADATION. With no usable context, no usable MMD excerpt and no position
   * clause, the array holds only the instruction and the join returns it
   * unchanged — BYTE-IDENTICAL to the orchestrator's exported
   * `DESCRIPTION_PROMPT`. Enrichment can only add.
   *
   * NEVER THROWS. Every input is validated by the block builders, which return
   * `null` rather than raising, so a malformed argument degrades towards the
   * fallback.
   *
   * WARNING IS ONE PER CALL, and covers `context` and `mmd` ONLY. Those two are
   * the ones a caller supplies deliberately, so a value that arrives and cannot
   * be used is usually a bug at the call site and is named in a single WARN
   * listing everything rejected. A missing or unusable `entry` / `allEntries`
   * warns NOTHING and simply omits the position clause — an image whose line
   * number is unknown is an ordinary state of the registry, not a mistake, and
   * `lineNumber` is `null` by default there. A call that supplies nothing at all
   * is the plain fallback case and warns nothing either.
   *
   * @param {Object} [args]
   * @param {Object} [args.context] - The eight-key context object, as
   *   `MathPixContextManager.getContext()` returns it.
   * @param {string} [args.mmd] - The working MMD, as
   *   `restorer.getCurrentMMDContent()` returns it (NOT
   *   `restoredSession.currentMMD`, which misses unsaved editor changes — see
   *   the plan document, read B3).
   * @param {Object} [args.entry] - The registry entry being described; needs
   *   `id` and `lineNumber`.
   * @param {Array<Object>} [args.allEntries] - Every registry entry, for the
   *   position clause. Order does not matter; this function sorts.
   * @returns {string} The assembled prompt; never empty, never throws.
   */
  function buildDescriptionPrompt(args) {
    if (!args || typeof args !== "object") {
      logWarn(
        "buildDescriptionPrompt(): no argument object — returning the plain instruction",
      );
      return DESCRIPTION_PROMPT;
    }

    // Collected so the WARN below can name what was rejected, and can fire ONCE
    // per call rather than once per field. A caller passing nothing at all is
    // the ordinary fallback case and is not warned about; a caller that passed
    // something we could not use is, because that is usually a bug at the call
    // site rather than an empty document.
    const rejected = [];

    const blocks = [];

    const contextBlock = buildContextBlock(args.context);
    if (contextBlock) {
      blocks.push(contextBlock);
    } else if (args.context !== undefined && args.context !== null) {
      rejected.push("context");
    }

    const positionClause = buildPositionClause(args.entry, args.allEntries);
    if (positionClause) blocks.push(positionClause);

    const entryLineNumber =
      args.entry && typeof args.entry === "object" ? args.entry.lineNumber : null;
    const excerptBlock = buildExcerptBlock(args.mmd, entryLineNumber);
    if (excerptBlock) {
      blocks.push(excerptBlock);
    } else if (args.mmd !== undefined && args.mmd !== null) {
      rejected.push("mmd");
    }

    if (rejected.length > 0) {
      logWarn(
        `buildDescriptionPrompt(): ignored unusable input (${rejected.join(", ")}) — the prompt degrades towards the plain instruction`,
      );
    }

    if (blocks.length === 0) {
      logDebug(
        "no usable context, excerpt or position — returning the plain instruction",
      );
    }

    blocks.push(DESCRIPTION_PROMPT);
    return blocks.join(BLOCK_SEPARATOR);
  }

  logInfo("MathPixAltTextPromptBuilder ready (pure prompt assembly)");

  return {
    buildDescriptionPrompt,
    // Exposed so the parity row can compare this module's necessary copy
    // against the orchestrator's export at runtime, and so the constants can be
    // gated without a page.
    DESCRIPTION_PROMPT,
    CONTEXT_FIELD_LABELS,
    CONTEXT_KEY_ORDER,
    MMD_EXCERPT_LINES_EACH_SIDE,
    MMD_EXCERPT_CHAR_CAP,
    EXTRA_INFORMATION_CHAR_CAP,
    CONTEXT_TRUNCATION_MARKER,
    // Exposed so a gate can locate the excerpt body by exact delimiter rather
    // than by splitting on a prefix. Added after a smoke harness did split on a
    // prefix, left the remainder of the delimiter line inside the captured body,
    // and reported two failures that were its own rather than the code's.
    EXCERPT_BEGIN,
    EXCERPT_END,
  };
})();

// Attach at definition time only (guarded so the module also loads cleanly in
// node with no `window`, proving purity — the same arrangement as the parser).
if (typeof window !== "undefined") {
  window.MathPixAltTextPromptBuilder = MathPixAltTextPromptBuilder;
}
