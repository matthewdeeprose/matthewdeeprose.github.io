/**
 * @fileoverview MathPix alt-text prompt builder — assembles the cloud
 *   description prompt from document context, an MMD excerpt and a position
 *   clause.
 * @module MathPixAltTextPromptBuilder
 * @version 1.1.0 (parcel PB-1)
 * @since Phase 4 item 2, context-aware prompts
 *
 * @description
 * ONE exported function, `buildDescriptionPrompt({ context, mmd, entry,
 * allEntries })`, returning one string. It is PURE apart from ONE guarded
 * call-time read: every input arrives as an argument, it holds no state
 * between calls, and the only thing read off `window` is the context
 * manager's audience options, to send an audience label in place of its
 * stored value (parcel PB-1, `resolveAudienceLabel`). With no manager the
 * value is sent unchanged, so the builder still runs with no page, no
 * registry and no session, which is how its rows run.
 *
 * PB-1, 26 September 2026: `DESCRIPTION_PROMPT` and `CONTEXT_USE_INSTRUCTION`
 * were rewritten from the image describer's prompt, taking its context,
 * accuracy and screen-reader guidance and leaving its MathJax notation guide
 * and definition lists behind, so every construct asked for renders in
 * MathPix Markdown (the PB-0 measurements).
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
   *
   * PB-3, 27 September 2026: the second line, pinning the four headings at
   * level 2, was added to both copies in the same parcel. The reasoning, and
   * why it does not reopen plan decision A4, is in the orchestrator's docblock.
   */
  const DESCRIPTION_PROMPT = `Describe this image for accessibility using these sections:
Use exactly these four headings, each a level-2 heading with its number, and no other level-2 heading.

Write all output in British English.

Before you write, look at the whole image: note its overall layout, every labelled part and how the parts relate, and any text. Describe what is drawn, not what a similar diagram usually contains. Where you are inferring rather than seeing, say so, and where an element is unclear, say it is unclear rather than guessing.

If the picture shows only a word or a short phrase, with nothing else worth describing, give those words exactly in the alt text, and keep the long description to one sentence that gives the words and how they are written.

## 1. Title
A brief descriptive title under 10 words that says what the image is for. Do not use a generic title such as "Diagram" or "Figure".

## 2. Alt Text
One or two sentences, concise enough to serve as an HTML alt attribute: what the image shows, then why it matters educationally. It must stand alone when the image fails to load. Do not open with "Image of", "Picture of", "A photograph of" or any similar phrase — the reader already knows this is an image.

## 3. Long Description
Describe the visual content and its educational purpose in full. Write for someone listening to this description rather than looking at the image, and put the important information first.

Write so that it reads well aloud: use commas where a listener needs a pause, write "equals", "plus" and "minus" as words inside prose, name each part the same way every time once you have named it, and give positions in words, such as top left, centre, or along the bottom edge.

Use markdown structure wherever it aids comprehension, rather than as decoration:

- a numbered list for steps, sequences, or anything the reader must take in order;
- a bullet list for unordered groups of related points;
- a markdown table where the content is genuinely tabular, so a screen-reader user can navigate it by row and column;
- headings to separate the distinct parts of a longer description.

Where the image carries data, such as a value for each category, place or time, give the actual values in a markdown table with a header row instead of a list, and give each value once. Introduce the table with one sentence that says what it holds. Order the rows logically — chronologically for a time series, or highest to lowest for ranked data. A picture with no such data needs no table.

Write mathematical expressions as inline LaTeX between dollar signs, and display equations between double dollar signs, matching the notation used in the surrounding document. This description is written into the same MathPix Markdown document as the surrounding text, so every expression must be valid there. This applies to the long description and the text content only: the alt text stays plain prose, with no LaTeX and no markdown.

Do not reuse "Title", "Alt Text", "Long Description" or "Text Content" as a heading inside this section.

## 4. Text Content
List every word, number and label visible in the image as a numbered list, one item per line, in reading order, each followed by its position in the image in words. Write mathematical labels as inline LaTeX between dollar signs, matching the surrounding document. If none, write "No text content."`;

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
    learningObjective: "Learning outcome",
    moduleName: "Module name",
    moduleCode: "Module code",
    audienceLevel: "Audience level",
    documentType: "Document type",
    extraInformation: "Additional information",
  });

  /** The eight keys in presentation order, derived so the two cannot drift. */
  const CONTEXT_KEY_ORDER = Object.freeze(Object.keys(CONTEXT_FIELD_LABELS));

  /** The context fields whose stored value is a select option slug (DT-1). */
  const SELECT_BACKED_KEYS = Object.freeze(["audienceLevel", "documentType"]);

  /**
   * Excerpt window: lines either side of the image's own line. Widened from 8
   * to 16 at M-4s (30 October 2026). History: plan decision A9 chose 8, the
   * largest window at which every one of the capacitors fixture's eleven
   * excerpts stayed under 1200 characters (worst case 1170). M-4 (blind
   * reading) and M-4j and M-4bj (`mai-4j-blind-reading`, `mai-4bj-blind-reading`)
   * then found the coaxial picture reached its explaining sentence in 8 of 8
   * runs at 16 lines against 1 of 4 at 8 (the pooling across the two rounds is
   * the design seat's, INFERRED), with no regression found against 8. The
   * Gaussian arrow is not fixed by either window, and the fixture has no
   * pictures in its moderate document, so no description regression check
   * exists there (M-4 P6).
   */
  const MMD_EXCERPT_LINES_EACH_SIDE = 16;

  /**
   * Excerpt character cap. Raised from 1500 to 3000 at M-4s with the window
   * above. Plan decision A9 set 1500 to clear the old worst case; at ±16 lines
   * the capacitors fixture's largest excerpt is 2525 characters (MEASURED at M-4s, `img-5920f834`).
   *
   * ⚠ ON THE CAPACITORS FIXTURE THIS CAP STILL NEVER FIRES. It is a documented
   * non-exercise, not a validated limit; the truncation ladder below is
   * therefore gated by constructed rows rather than by the fixture, and the
   * first real document that trips it is the first real test of it.
   */
  const MMD_EXCERPT_CHAR_CAP = 3000;

  /** `extraInformation` is free text and can be arbitrarily long; cap it. */
  const EXTRA_INFORMATION_CHAR_CAP = 2000;

  /** Appended when `extraInformation` is cut, so the model knows it was cut. */
  const CONTEXT_TRUNCATION_MARKER = "[context truncated]";

  const CONTEXT_HEADING = "Document context for this image:";

  /**
   * The sentence that tells the model what to DO with the context lines above
   * it. Before parcel CX-1 the fields arrived as bare `Label: value` lines and
   * nothing asked the model to use them; AT-2's null result measured exactly
   * that gap.
   *
   * IT LIVES INSIDE THE CONTEXT BLOCK, so it is present only when at least one
   * field is present. With no usable context the block is `null`, this sentence
   * never reaches the prompt, and the degradation property (plan decision A9)
   * holds: the prompt stays byte-identical to the orchestrator's
   * `DESCRIPTION_PROMPT`.
   *
   * IT MUST NEVER CONTAIN ANY `CONTEXT_FIELD_LABELS` VALUE as an exact-case
   * substring. The orchestrator suite's skip rows assert
   * `out.indexOf(label) === -1` for a skipped field on a prompt whose other
   * fields are present, so a label-cased mention here would redden them for a
   * reason that has nothing to do with skipping. Lower-case mentions are safe;
   * a CX-1 row pins the rule.
   *
   * A plain string constant: a string is already immutable, so
   * `Object.freeze` would add nothing.
   *
   * Origin: parcel CX-1, 25 September 2026. Rewritten at parcel PB-1, 26
   * September 2026, from the image describer's prompt: one instruction per
   * field, as a list, and a closing sentence for the fields that are absent.
   * Still one string, joined with line breaks, still placed exactly where CX-1
   * placed it.
   */
  const CONTEXT_USE_INSTRUCTION = [
    "Use this context when you write:",
    "- match the vocabulary, the assumed knowledge and the depth of explanation to the audience level;",
    "- use the terminology and conventions of the subject area;",
    "- give most weight to the parts of the image that bear on the specific topic;",
    "- where a learning outcome is given, say in the alt text and the long description what the image contributes to it;",
    "- use any additional information about how the image is used in teaching.",
    "Where a field is absent, describe from what you observe.",
  ].join("\n");
  const EXCERPT_BEGIN =
    "--- BEGIN surrounding document text (the image appears within this excerpt) ---";
  const EXCERPT_END = "--- END surrounding document text ---";
  const BLOCK_SEPARATOR = "\n\n";

  // M-10r (6 November 2026, Matthew's ruling): a re-describe must not show the
  // model the picture's OWN old description, or the new description is anchored
  // on the old one. These two lines replace it in the excerpt. They are not
  // prompt wording about what to write; they only mark a gap.
  const OWN_ALT_PLACEHOLDER = "(the picture being described)";
  const OWN_LONG_DESCRIPTION_PLACEHOLDER =
    "(the long description of the picture being described is hidden)";
  // M-10y: said once, after the position clause, whenever an excerpt is sent.
  const OWN_LINE_EXPLANATION = `In the nearby text, its own line is marked "${OWN_ALT_PLACEHOLDER}".`;
  // M-10s: the picture's own caption, when the AI wrote it with no edit.
  const OWN_CAPTION_PLACEHOLDER = "(the title of the picture being described)";

  /**
   * The only provenance stamp that means "the AI wrote this and nobody has
   * touched it" (M-10s, Matthew's ruling of 6 November 2026). Anything a person
   * wrote or edited (`user`, `ai-reviewed`, `ai-edited`), the page's own text
   * (`original`), and chemistry-tool text (`algo-generated`) stays visible.
   */
  const UNEDITED_AI_SOURCE = "ai-generated";

  const FIGURE_BEGIN = "\\begin{figure}";
  const FIGURE_END = "\\end{figure}";
  const CAPTION_OPEN = "\\caption{";

  /** `alt={` inside the options of an `\includegraphics` command. */
  const LATEX_ALT_OPEN_RE = /alt\s*=\s*\{/;
  /** A markdown image, the same shape the serialiser's own locator uses. */
  const MARKDOWN_IMAGE_ALT_RE = /!\[((?:[^\]]|\](?!\())*)\]\(/;
  /** The appendix marker the serialiser writes before each long description. */
  const APPENDIX_MARKER_RE = /<!--\s*img-desc:([^\s>][^\s>]*?)\s*-->/;
  const MARKDOWN_HEADING_RE = /^(#{1,6})\s+\S/;
  /** Deeper than any heading, so "a heading of this level or higher" matches all. */
  const BEYOND_HEADING_LEVEL = 7;

  /**
   * Outcomes of looking for the picture's own alt on its own line.
   * Frozen const object as an enum, per the house convention.
   */
  const OWN_ALT_OUTCOME = Object.freeze({
    HIDDEN: "hidden",
    NONE_TO_HIDE: "none-to-hide",
    UNRECOGNISED: "unrecognised",
    UNMATCHED_BRACE: "unmatched-brace",
  });

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
   * The audience level as a person would name it. The form stores an option
   * VALUE such as `ug1`, which tells a model nothing; the matching option
   * LABEL, `Undergraduate Year 1`, does. Parcel PB-1.
   *
   * THE ONE READ OFF `window` IN THIS MODULE, made at call time and guarded,
   * the same way the orchestrator reaches `window.MathPixContextManager` for
   * the context itself. The options come from `getSchema()`, which returns the
   * schema as an ARRAY of fields (not an object keyed by field), so the
   * audience field is found by its `key`. When the manager is absent, throws,
   * or has no option with this value, the value is returned unchanged: a free
   * or unknown value is still worth sending as it stands.
   *
   * Read through `window` deliberately, never the bare identifier, so a row
   * can make the manager absent and restore it.
   *
   * DT-1 (16 October 2026): generalised from the audience field to every
   * select-backed field, so the document type is sent as `Lecture notes` and
   * not as its stored slug `lecture-notes`. The stored value stays the slug.
   *
   * @param {string} key - The schema key of a select-backed field.
   * @param {string} value - A trimmed, usable stored value.
   * @returns {string} The option label, or the value unchanged.
   */
  function resolveSelectLabel(key, value) {
    const manager =
      typeof window !== "undefined" ? window.MathPixContextManager : undefined;
    if (!manager || typeof manager.getSchema !== "function") return value;

    let schema;
    try {
      schema = manager.getSchema();
    } catch (err) {
      logWarn("getSchema() threw — sending the value unchanged", err);
      return value;
    }

    const field = Array.isArray(schema)
      ? schema.find((f) => f && f.key === key)
      : null;
    const options = field && Array.isArray(field.options) ? field.options : [];
    const match = options.find(
      (o) => o && o.value === value && isUsableContextValue(o.label),
    );
    return match ? match.label.trim() : value;
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
      if (SELECT_BACKED_KEYS.includes(key)) value = resolveSelectLabel(key, value);
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
    return (
      CONTEXT_HEADING +
      "\n" +
      lines.join("\n") +
      "\n" +
      CONTEXT_USE_INSTRUCTION
    );
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

  /** The literal every page marker contains; a text without it needs no strip. */
  const PAGE_MARKER_HINT = "<!-- page: ";

  /**
   * M-10ao: the working MMD with its page markers removed, and how many
   * own-line marker lines sit above `lineNumber` (so a line number counted in
   * the marked text can be moved onto the unmarked one). Absent
   * `window.MathPixPageMarkers`: the text comes back unchanged and one warning
   * is logged, each time a marked text is seen.
   *
   * @param {string} mmd
   * @param {number} lineNumber - 1-based, in the marked text.
   * @returns {{ text: string, lineShift: number }}
   */
  function withoutPageMarkers(mmd, lineNumber) {
    if (!mmd.includes(PAGE_MARKER_HINT)) return { text: mmd, lineShift: 0 };
    const markers = window.MathPixPageMarkers;
    if (!markers || typeof markers.stripMarkers !== "function") {
      logWarn(
        "MathPixPageMarkers is not loaded — page markers stay in the excerpt",
      );
      return { text: mmd, lineShift: 0 };
    }
    const lineShift = markers
      .readMarkers(mmd)
      .filter((m) => m.kind === "own-line" && m.line < lineNumber).length;
    return { text: markers.stripMarkers(mmd), lineShift };
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
   * THE PICTURE'S OWN OLD DESCRIPTION IS HIDDEN (M-10r, Matthew's ruling of 6
   * November 2026). Its alt value on its own line becomes
   * `OWN_ALT_PLACEHOLDER`, and the lines of its own long-description section,
   * where the window reaches them, become one line. Only that picture's own
   * text is hidden; neighbours, the caption and the prose stay.
   *
   * M-10s: each part is hidden only when its provenance stamp is
   * `ai-generated` (unedited AI text). The caption of the picture's own figure
   * is hidden the same way, by `titleSource`.
   *
   * @param {string} mmd - The working MMD.
   * @param {number} lineNumber - The image's 1-based line number.
   * @param {Object} [entry] - The registry entry: `id` and the three source fields.
   * @returns {string|null}
   */
  function buildExcerptBlock(mmd, lineNumber, entry) {
    const ownId = entry && typeof entry === "object" ? entry.id : undefined;
    const hideAlt = isUneditedAi(entry, "altTextSource");
    const hideSection = isUneditedAi(entry, "longDescriptionSource");
    const hideCaption = isUneditedAi(entry, "titleSource");

    if (typeof mmd !== "string" || mmd === "") return null;
    if (!isUsableLineNumber(lineNumber)) return null;

    // M-10ao: page markers are page furniture and never reach the model. They
    // come out BEFORE windowing, so the window covers the same lines as the
    // unmarked text. An own-line marker is a line of its own, so the picture's
    // number (counted in the marked text) is moved up by the ones above it.
    const { text: unmarkedMMD, lineShift } = withoutPageMarkers(mmd, lineNumber);
    const allLines = unmarkedMMD.split("\n");
    const targetIndex = lineNumber - lineShift - 1;
    if (targetIndex >= allLines.length) {
      logDebug(
        `lineNumber ${lineNumber} is past the end of the MMD (${allLines.length} lines) — no excerpt`,
      );
      return null;
    }

    const windowFrom = Math.max(0, targetIndex - MMD_EXCERPT_LINES_EACH_SIDE);
    const windowTo = Math.min(
      allLines.length - 1,
      targetIndex + MMD_EXCERPT_LINES_EACH_SIDE,
    );

    // M-10r: the picture's own old description never reaches the model. The
    // window is chosen on the ORIGINAL line numbers (so its size is unchanged),
    // then its own alt and its own long-description section are replaced, and
    // the character cap is measured on what will actually be sent.
    const ownSection = hideSection
      ? findOwnLongDescriptionRange(allLines, ownId)
      : null;
    const ownCaption = hideCaption
      ? findOwnCaptionHidden(allLines, targetIndex)
      : null;
    const windowLines = [];
    let targetPosition = 0;
    let sectionPlaced = false;
    let captionPlaced = false;
    for (let i = windowFrom; i <= windowTo; i++) {
      if (i === targetIndex) {
        targetPosition = windowLines.length;
        windowLines.push(markOwnLine(allLines[i], lineNumber, hideAlt));
        continue;
      }
      const inOwnCaption =
        ownCaption && i >= ownCaption.start && i <= ownCaption.end;
      if (inOwnCaption) {
        // A caption over several lines becomes one line, placed once.
        if (!captionPlaced) {
          windowLines.push(ownCaption.replacement);
          captionPlaced = true;
        }
        continue;
      }
      const inOwnSection =
        ownSection && i >= ownSection.start && i <= ownSection.end;
      if (!inOwnSection) {
        windowLines.push(allLines[i]);
        continue;
      }
      if (!sectionPlaced) {
        windowLines.push(OWN_LONG_DESCRIPTION_PLACEHOLDER);
        sectionPlaced = true;
      }
    }

    let from = 0;
    let to = windowLines.length - 1;

    // Shrink towards the target line until the joined body fits the cap. The
    // guards keep the target itself, so the loop always terminates with at
    // least that one line present.
    while (
      windowLines.slice(from, to + 1).join("\n").length > MMD_EXCERPT_CHAR_CAP
    ) {
      const distanceAbove = targetPosition - from;
      const distanceBelow = to - targetPosition;
      if (distanceAbove === 0 && distanceBelow === 0) break;
      if (distanceAbove >= distanceBelow && distanceAbove > 0) {
        from += 1;
      } else if (distanceBelow > 0) {
        to -= 1;
      } else {
        break;
      }
    }

    const body = windowLines.slice(from, to + 1).join("\n");
    logDebug(
      `excerpt ${to - from + 1} lines around line ${lineNumber}, ${body.length} characters`,
    );
    return EXCERPT_BEGIN + "\n" + body + "\n" + EXCERPT_END;
  }

  // ============================================================================
  // INTERNAL — HIDING THE PICTURE'S OWN OLD DESCRIPTION (M-10r)
  // ============================================================================

  /**
   * Index of the `}` matching the `{` at `openIndex`; `\{` and `\}` do not count.
   * A necessary copy of the serialiser's public `findMatchingBrace`: this module
   * stays pure and loads with no `window`. A row compares the two.
   * @param {string} text
   * @param {number} openIndex
   * @returns {number} -1 when there is no match.
   */
  function findMatchingBrace(text, openIndex) {
    if (typeof text !== "string" || text[openIndex] !== "{") return -1;
    let depth = 0;
    for (let i = openIndex; i < text.length; i++) {
      if (text[i] === "\\" && i + 1 < text.length) {
        i++;
        continue;
      }
      if (text[i] === "{") {
        depth++;
      } else if (text[i] === "}") {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /**
   * True when the entry's named provenance field is exactly the unedited-AI stamp.
   * Missing entry, missing field, `null` and every other value are false, so
   * anything not known to be pure AI text stays visible to the model.
   * @param {Object|undefined} entry
   * @param {string} field - `altTextSource`, `longDescriptionSource` or `titleSource`.
   * @returns {boolean}
   */
  function isUneditedAi(entry, field) {
    return (
      !!entry && typeof entry === "object" && entry[field] === UNEDITED_AI_SOURCE
    );
  }

  /**
   * The picture's own `\caption{...}` with its text hidden, or `null`.
   *
   * A necessary copy of the serialiser's `detectFigureContext` caption
   * location (this module stays pure): walk up from the picture line to
   * `\begin{figure}` (a `\end{figure}` first means no figure), down to
   * `\end{figure}` (a second `\begin{figure}` first means no figure), take the
   * first `\caption{` inside, and brace-match it across lines. A row compares the
   * located caption with the serialiser's. FAIL SAFE: anything unrecognised, an
   * empty caption, or an unmatched brace gives `null`, the lines are sent
   * unchanged, and nothing throws. A picture with no caption is the ordinary
   * case and is silent.
   * @param {Array<string>} lines - The whole document.
   * @param {number} imageIndex - 0-based index of the picture's own line.
   * @returns {{ start: number, end: number, replacement: string }|null}
   */
  function findOwnCaptionHidden(lines, imageIndex) {
    try {
      let beginIndex = null;
      for (let i = imageIndex - 1; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (trimmed === FIGURE_BEGIN) {
          beginIndex = i;
          break;
        }
        if (trimmed === FIGURE_END) return null;
      }
      if (beginIndex === null) return null;

      let endIndex = null;
      for (let i = imageIndex + 1; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === FIGURE_END) {
          endIndex = i;
          break;
        }
        if (trimmed === FIGURE_BEGIN) return null;
      }
      if (endIndex === null) return null;

      for (let i = beginIndex + 1; i < endIndex; i++) {
        const tagIdx = lines[i].indexOf(CAPTION_OPEN);
        if (tagIdx === -1) continue;

        const openIdx = tagIdx + "\\caption".length;
        const joined = lines.slice(i, endIndex).join("\n");
        const closeIdx = findMatchingBrace(joined, openIdx);
        if (closeIdx === -1) {
          logWarn(
            `own caption not hidden at line ${i + 1} (unmatched brace) — the lines are sent unchanged`,
          );
          return null;
        }
        if (joined.slice(openIdx + 1, closeIdx).trim() === "") return null;

        const lineOffset = joined.slice(0, closeIdx + 1).split("\n").length - 1;
        // M-10t: keep only the caption's own lines (up to the end of the line
        // holding the closing brace). Later lines are left to the window loop,
        // so they are sent once, not twice.
        const closingLineEnd = joined.indexOf("\n", closeIdx);
        return {
          start: i,
          end: i + lineOffset,
          replacement:
            joined.slice(0, openIdx + 1) +
            OWN_CAPTION_PLACEHOLDER +
            joined.slice(
              closeIdx,
              closingLineEnd === -1 ? joined.length : closingLineEnd,
            ),
        };
      }
      return null;
    } catch (err) {
      logWarn("hiding the own caption threw — the lines are sent unchanged", err);
      return null;
    }
  }

  /**
   * Replace the alt value on the picture's own line with the placeholder, in
   * either image syntax, and say what happened.
   * @param {string} line
   * @returns {{ line: string, outcome: string }}
   */
  function replaceAltOnLine(line) {
    const commandIndex = line.indexOf("\\includegraphics");
    if (commandIndex !== -1) {
      const afterCommand = line.slice(commandIndex);
      const match = LATEX_ALT_OPEN_RE.exec(afterCommand);
      if (!match) return { line, outcome: OWN_ALT_OUTCOME.NONE_TO_HIDE };

      const openIndex = commandIndex + match.index + match[0].length - 1;
      const closeIndex = findMatchingBrace(line, openIndex);
      if (closeIndex === -1) {
        return { line, outcome: OWN_ALT_OUTCOME.UNMATCHED_BRACE };
      }
      if (line.slice(openIndex + 1, closeIndex).trim() === "") {
        return { line, outcome: OWN_ALT_OUTCOME.NONE_TO_HIDE };
      }
      return {
        line:
          line.slice(0, openIndex + 1) +
          OWN_ALT_PLACEHOLDER +
          line.slice(closeIndex),
        outcome: OWN_ALT_OUTCOME.HIDDEN,
      };
    }

    const markdown = MARKDOWN_IMAGE_ALT_RE.exec(line);
    if (markdown) {
      if (markdown[1].trim() === "") {
        return { line, outcome: OWN_ALT_OUTCOME.NONE_TO_HIDE };
      }
      const altStart = markdown.index + 2;
      return {
        line:
          line.slice(0, altStart) +
          OWN_ALT_PLACEHOLDER +
          line.slice(altStart + markdown[1].length),
        outcome: OWN_ALT_OUTCOME.HIDDEN,
      };
    }

    return { line, outcome: OWN_ALT_OUTCOME.UNRECOGNISED };
  }

  /**
   * M-10y (Matthew's ruling of 6 November 2026): the picture's own line is
   * ALWAYS marked in the request, a first describe included, exactly once.
   *   1. An unedited AI alt that is found becomes the placeholder (M-10r).
   *   2. A markdown image with an empty alt gets the placeholder as its alt.
   *   3. Every other case keeps the line and ends it with the placeholder.
   * The mark lives only in the request text; nothing is written to the document.
   * FAIL SAFE: nothing throws and the line is never dropped.
   * @param {string} line
   * @param {number} lineNumber - for the log only.
   * @param {boolean} hideAlt - true when the alt is unedited AI text.
   * @returns {string}
   */
  function markOwnLine(line, lineNumber, hideAlt) {
    try {
      if (hideAlt) {
        const result = replaceAltOnLine(line);
        if (result.outcome === OWN_ALT_OUTCOME.HIDDEN) return result.line;
        if (
          result.outcome === OWN_ALT_OUTCOME.UNRECOGNISED ||
          result.outcome === OWN_ALT_OUTCOME.UNMATCHED_BRACE
        ) {
          logWarn(
            `own alt not hidden on line ${lineNumber} (${result.outcome}) — the line is marked at its end`,
          );
        }
      }

      // An empty markdown alt takes the placeholder in place (Matthew's example).
      if (line.indexOf("\\includegraphics") === -1) {
        const markdown = MARKDOWN_IMAGE_ALT_RE.exec(line);
        if (markdown && markdown[1].trim() === "") {
          const altStart = markdown.index + 2;
          return (
            line.slice(0, altStart) +
            OWN_ALT_PLACEHOLDER +
            line.slice(altStart + markdown[1].length)
          );
        }
      }

      // Everything else: the line unchanged, the mark at its end (before a CR).
      const carriage = line.endsWith("\r") ? "\r" : "";
      const bare = carriage ? line.slice(0, -1) : line;
      return bare + " " + OWN_ALT_PLACEHOLDER + carriage;
    } catch (err) {
      logWarn("marking the own line threw — the line is sent unchanged", err);
      return line;
    }
  }

  /**
   * The line range (inclusive, 0-based, over the WHOLE document) of the
   * picture's own long-description section in the appendix, or `null`.
   *
   * The serialiser ties a section to a picture by the marker
   * `<!-- img-desc:<id> -->` written before it. The section runs from that
   * marker to the line before the next marker, or the next heading of the same
   * or a higher level than the section's own heading, or the end of the
   * document. Its sub-headings (and the `Text in the image` subsection) stay
   * inside. Trailing blank lines are left out so the spacing survives.
   * No marker is the ordinary case (a fresh document) and returns `null` quietly.
   * @param {Array<string>} lines
   * @param {string|undefined} ownId
   * @returns {{ start: number, end: number }|null}
   */
  function findOwnLongDescriptionRange(lines, ownId) {
    if (typeof ownId !== "string" || ownId === "") return null;

    let markerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const match = APPENDIX_MARKER_RE.exec(lines[i]);
      if (match && match[1] === ownId) {
        markerIndex = i;
        break;
      }
    }
    if (markerIndex === -1) return null;

    let level = BEYOND_HEADING_LEVEL;
    let scanFrom = markerIndex + 1;
    for (let i = markerIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === "") continue;
      const heading = MARKDOWN_HEADING_RE.exec(lines[i].trim());
      if (heading) {
        level = heading[1].length;
        scanFrom = i + 1;
      }
      break;
    }

    let end = lines.length - 1;
    for (let i = scanFrom; i < lines.length; i++) {
      const heading = MARKDOWN_HEADING_RE.exec(lines[i].trim());
      if (
        APPENDIX_MARKER_RE.test(lines[i]) ||
        (heading && heading[1].length <= level)
      ) {
        end = i - 1;
        break;
      }
    }
    while (end > markerIndex && lines[end].trim() === "") end--;
    return { start: markerIndex, end };
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

    const entryLineNumber =
      args.entry && typeof args.entry === "object" ? args.entry.lineNumber : null;
    const excerptBlock = buildExcerptBlock(
      args.mmd,
      entryLineNumber,
      args.entry,
    );

    // M-10y: with an excerpt, the one sentence that says what the mark means
    // follows the position clause (or stands alone when there is no clause).
    if (positionClause && excerptBlock) {
      blocks.push(positionClause + " " + OWN_LINE_EXPLANATION);
    } else if (positionClause) {
      blocks.push(positionClause);
    } else if (excerptBlock) {
      blocks.push(OWN_LINE_EXPLANATION);
    }

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
    CONTEXT_USE_INSTRUCTION,
    // Exposed so a gate can locate the excerpt body by exact delimiter rather
    // than by splitting on a prefix. Added after a smoke harness did split on a
    // prefix, left the remainder of the delimiter line inside the captured body,
    // and reported two failures that were its own rather than the code's.
    EXCERPT_BEGIN,
    EXCERPT_END,
    // M-10r: the two gap markers, exported so a gate counts them by the
    // module's own text rather than a copy.
    OWN_ALT_PLACEHOLDER,
    OWN_LONG_DESCRIPTION_PLACEHOLDER,
    // M-10s: the caption gap marker, for the same reason.
    OWN_CAPTION_PLACEHOLDER,
    // M-10y: the sentence that explains the own-line mark.
    OWN_LINE_EXPLANATION,
  };
})();

// Attach at definition time only (guarded so the module also loads cleanly in
// node with no `window`, proving purity — the same arrangement as the parser).
if (typeof window !== "undefined") {
  window.MathPixAltTextPromptBuilder = MathPixAltTextPromptBuilder;
}
