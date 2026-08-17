/**
 * @file alt-text-write-stage.js
 * @module MathPixAltTextWriteStage
 * @description
 * Phase 2 Stage 2, Parcel 4.1 — the write stage: the single boundary that
 * commits a parsed four-field description onto a MathPixImageRegistry entry
 * with explicit provenance, honouring the freeze floor and the empty predicate.
 *
 * The commit boundary itself:
 *
 *   write({ registry, id, fields, source, overwriteFields, writeFields }) →
 *     { id, source, found, results }
 *
 * Parcel 8e-1 adds one PURE PREDICATE beside it, which commits nothing:
 *
 *   isAcceptableForReview(source, content) → { acceptable, reason }
 *
 * It answers whether a person may accept a field's existing content as
 * reviewed. It lives here, with the freeze floor and the empty predicate,
 * because accepting stamps "ai-reviewed" — a FROZEN source — so the rule that
 * decides it belongs beside the rules it interacts with, and reuses them rather
 * than restating them. The gesture that calls it, and the announcement it will
 * eventually carry, are NOT this file's business.
 *
 * `fields` is the parser's exact output — { title, alt, long, text }, each a
 * string (see alt-text-parser.js). `source` is the provenance value to stamp
 * (e.g. "ai-generated"); it is REQUIRED (F4). `overwriteFields` is an OPTIONAL
 * list of field keys a person has explicitly authorised for overwrite (Parcel
 * 8b — see the per-field authorisation note below). `writeFields` is an OPTIONAL
 * list restricting WHICH fields this call considers at all (Parcel 8c-iv-pre —
 * see the selection-versus-authorisation note below). Each field maps to one
 * registry setter and is committed only if it survives three gates, checked
 * IN ORDER:
 *
 *   1. SELECT (Parcel 8c-iv-pre): when `writeFields` restricts the call, a field
 *      not named in it is not considered at all — disposition "skipped". Checked
 *      FIRST, so an unselected field is never even examined for freeze or
 *      content. An absent/undefined `writeFields` means NO restriction: all four
 *      fields are considered, exactly as before this parcel.
 *   2. FREEZE (F5): a field whose current *Source on the entry is "user",
 *      "ai-reviewed" or "ai-edited" is human-owned — never machine-touched.
 *      Checked before empty, so a frozen field is protected even from an empty
 *      incoming write. THE ONE EXCEPTION (Parcel 8b): a field named in
 *      `overwriteFields` skips THIS gate only, because a person authorised
 *      replacing that human decision in the interface.
 *   3. EMPTY (F7): a field whose incoming content is empty for provenance (see
 *      the sentinel-aware predicate below) is not stamped — the registry
 *      setters would happily stamp a source onto empty content, so guarding
 *      empty content is entirely this stage's job. This gate applies to
 *      authorised fields too: authorisation lets a person replace real content,
 *      never blank it.
 *
 * A field that clears all three gates is written via its setter with `source`.
 * Its disposition then records WHAT THE WRITE DISPLACED: "written" when it
 * filled a field that held no content, "replaced" (Parcel 8d-fid) when it
 * displaced existing non-frozen content, or "overwritten" (Parcel 8b) when an
 * authorised write replaced a live freeze. So a caller can tell a fill from a
 * replacement, and both from the replacement of a human decision.
 *
 * ── SELECTION IS ORTHOGONAL TO AUTHORISATION (Parcel 8c-iv-pre) ─────────────
 * `writeFields` and `overwriteFields` answer two different questions and neither
 * implies the other:
 *
 *   • `writeFields`     — WHICH fields does this call touch? (scope)
 *   • `overwriteFields` — MAY a human-owned field be replaced? (permission)
 *
 * Restricting scope NEVER grants permission. A field that is both selected and
 * frozen still needs `overwriteFields` to be replaced: it passes gate 1 and is
 * then refused by gate 2, exactly as it would have been without any selection.
 * Conversely, authorising a field does not select it — an authorised field that
 * `writeFields` excludes is "skipped", never written. Keeping the two separate
 * is what stops a narrowed scope from being read as a licence to overwrite.
 *
 * ── Why this stage owns require-source / never-stamp-empty / freeze ──────────
 * None of the four registry setters (updateAltText / updateLongDescription /
 * updateTitle / updateTextInImage) guard any of these: an undefined source is
 * silently preserved, a valid member (including null) is stamped, anything else
 * is coerced to "user" with a warning, empty content is stamped anyway, and no
 * setter consults the freeze floor. So the three policies live here.
 *
 * ── Freeze set is copied EXACTLY from the chemistry writer (locked decision 3)
 * classifyField in mathpix-chemistry-registry-writer.js freezes on source
 * "user" or "ai-reviewed" and nothing wider. This stage copies that set and
 * NOTHING else from the chemistry writer — no adopt path, no slot-prose or
 * raw-SMILES machinery, which are chemistry-specific.
 *
 * ── Locked decision 3 is AMENDED here (Parcel 8b: per-field overwrite authn) ──
 * The freeze floor still refuses EVERY machine write to a human-owned field BY
 * DEFAULT — that default is unchanged and load-bearing. The ONLY way past it is
 * an explicit per-field authorisation that a person gave in the interface,
 * passed as `overwriteFields`. It is per-field (never a blanket "overwrite
 * everything"), it bypasses the freeze gate ONLY (the empty gate still applies),
 * and it never widens the freeze set itself. Non-interactive writers — the
 * chemistry writer above all — pass nothing, so they stay fully frozen exactly
 * as before. Authorisation is a caller's per-call assertion, not a property of
 * this stage's defaults.
 *
 * ── Sentinel-aware empty predicate (S2F option 2) ───────────────────────────
 * The generation prompt's section 4 asks the model to write the literal
 * "No text content." when an image has no visible words (see buildQwenPrompt in
 * image-describer-controller-generate.js). The parser passes that sentinel
 * through literally (its own doc says the write stage owns whether it counts as
 * "no content"). One predicate treats a blank string AND that sentinel as empty
 * for provenance, applied uniformly to all four fields — the sentinel only ever
 * appears in `text` in practice, so it is a no-op elsewhere, and one predicate
 * keeps the rule in one place.
 *
 * Attaches to `window` at definition time only (guarded), matching the
 * ai-alt-text siblings.
 *
 * @see mathpix-scripts/ai-alt-text/alt-text-parser.js (3.1 sibling — emits the { title, alt, long, text } shape)
 * @see mathpix-scripts/core/mathpix-image-registry.js (updateAltText/updateLongDescription/updateTitle/updateTextInImage — the setters this stage drives)
 * @see mathpix-scripts/core/mathpix-chemistry-registry-writer.js (classifyField — the freeze set copied here)
 * @see image-describer/image-describer-controller-generate.js (buildQwenPrompt — origin of the section-4 "No text content." sentinel)
 * @see mathpix-scripts/testing/mathpix-registry-mirror-tests.js (write-path TEST discipline: throwaway registries, cancel the debounce, save/restore the mirror key)
 */

const MathPixAltTextWriteStage = (function () {
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
      console.error(`[AltTextWriteStage] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AltTextWriteStage] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AltTextWriteStage] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AltTextWriteStage] ${message}`, ...args);
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /**
   * The section-4 sentinel the generation prompt asks the model to emit when an
   * image has no visible words. Origin: buildQwenPrompt section 4 in
   * image-describer-controller-generate.js. Treated as empty for provenance.
   */
  const NO_TEXT_SENTINEL = "No text content.";

  /**
   * The human-owned *Source values that freeze a field against machine writes:
   * user, ai-reviewed, and ai-edited. This is the freeze set the chemistry
   * writer's classifyField also freezes on (locked decision 3). classifyField
   * additionally freezes any unrecognised non-null source (forward-safe, F9);
   * that fallthrough is not mirrored here, since this list is an explicit
   * includes-check. A field whose current source is one of these is human-owned
   * and must never be machine-overwritten.
   *
   * Locked decision 3 is AMENDED by Parcel 8b: this set is unchanged and STILL
   * refuses every machine write by default. The ONLY escape is an explicit
   * per-field `overwriteFields` authorisation a person gave in the interface,
   * which bypasses the freeze gate for the named field only. This set is never
   * mutated by that — authorisation is decided per call, not by widening it.
   */
  const FROZEN_SOURCES = Object.freeze(["user", "ai-reviewed", "ai-edited"]);

  /**
   * The *Source values a person may accept as reviewed. Accepting stamps
   * "ai-reviewed", which is a member of FROZEN_SOURCES above — so the stamp
   * FREEZES the field against every later machine write. That one-way step is
   * why this list is short and why every other state is refused rather than
   * waved through.
   *
   *   - "ai-generated"   — an AI model wrote it (8e-1).
   *   - "algo-generated" — the chemistry tools wrote it (8e-1).
   *   - "original"       — the content came with the document (8e-2).
   *
   * ── Why "original" is here, decided 10 August 2026 ────────────────────────
   * 8e-1 refused it and recorded the question as open. It is now settled, and
   * settled on a REACHABILITY argument rather than an authorship one: an
   * "original" field is refreshable through classifyField, so a later run can
   * overwrite document-supplied or OCR alt text, and until this change a person
   * had NO way to protect it. Every other refused state is already protected —
   * "user", "ai-edited" and "ai-reviewed" are all in FROZEN_SOURCES — so
   * "original" was the one reviewable-in-practice state with no gesture.
   * Freezing it is what the person is asking for, not a side effect.
   *
   * Exposed on the namespace for the same reason FROZEN_SOURCES is: a guard row
   * or a caller should iterate the live list rather than pin its own copy.
   */
  const REVIEWABLE_SOURCES = Object.freeze([
    "ai-generated",
    "algo-generated",
    "original",
  ]);

  /**
   * The reason strings isAcceptableForReview returns beside its verdict
   * (Parcel 8e-1). They are STABLE IDENTIFIERS for guard rows and for the
   * announcement wording — never prose for a person to read. Keep them short,
   * and change one only with its consumers.
   *
   * 8e-2 REMOVED "original-refused". It is not deprecated or reserved: no code
   * path can return it now that "original" is reviewable, and a member nothing
   * can produce reads to the next author as a state the predicate still has.
   */
  const ACCEPT_REASON = Object.freeze({
    ACCEPTABLE: "acceptable",
    EMPTY_CONTENT: "empty-content",
    HUMAN_AUTHORED: "human-authored",
    ALREADY_REVIEWED: "already-reviewed",
    NO_PROVENANCE: "no-provenance",
    UNRECOGNISED_SOURCE: "unrecognised-source",
  });

  /**
   * Refusal reason per non-reviewable source, for the sources that have a named
   * one. "user" and "ai-edited" share HUMAN_AUTHORED deliberately: in both a
   * person authored the words, so there is nothing for them to review.
   *
   * `null` is NOT a key here — it is checked separately, because a property
   * lookup would coerce it to the string "null" and quietly conflate a genuine
   * absence of provenance with a field literally sourced "null".
   */
  const REFUSAL_REASON_BY_SOURCE = Object.freeze({
    user: ACCEPT_REASON.HUMAN_AUTHORED,
    "ai-edited": ACCEPT_REASON.HUMAN_AUTHORED,
    "ai-reviewed": ACCEPT_REASON.ALREADY_REVIEWED,
  });

  /**
   * Field → { setter method name, entry *Source property, entry content
   * property } mapping. Drives the per-field loop in write(). The four output
   * keys are exactly the parser's emitted shape ({ title, alt, long, text }).
   *
   * `contentKey` (Parcel 8d-fid) names the entry property holding the field's
   * CURRENT content. Without it the loop could read a field's provenance but
   * never its content, so a write that filled a blank and a write that
   * displaced existing prose were indistinguishable — both reported "written".
   * Reading it lets the write step split those two outcomes.
   */
  const FIELD_MAP = Object.freeze([
    {
      field: "title",
      setter: "updateTitle",
      sourceKey: "titleSource",
      contentKey: "title",
    },
    {
      field: "alt",
      setter: "updateAltText",
      sourceKey: "altTextSource",
      contentKey: "altText",
    },
    {
      field: "long",
      setter: "updateLongDescription",
      sourceKey: "longDescriptionSource",
      contentKey: "longDescription",
    },
    {
      field: "text",
      setter: "updateTextInImage",
      sourceKey: "textInImageSource",
      contentKey: "textInImage",
    },
  ]);

  /**
   * The four known field keys, derived from FIELD_MAP so the two cannot drift.
   * `overwriteFields` is validated against exactly this set — an authorisation
   * can never widen beyond these four (Parcel 8b).
   */
  const KNOWN_FIELD_KEYS = Object.freeze(FIELD_MAP.map((entry) => entry.field));

  /**
   * Dispositions a field can end with in the returned results object.
   *
   * The three committing dispositions differ by WHAT THE WRITE DISPLACED:
   *
   *   • "written"     — the field held no content beforehand, so this write
   *                     filled a blank and displaced nothing. NARROWED at Parcel
   *                     8d-fid: it previously also covered replacing existing
   *                     content, which made a fill and a replacement
   *                     indistinguishable in the return value.
   *   • "replaced"    — (Parcel 8d-fid) the field already held content that was
   *                     NOT frozen, and this write displaced it. Emptiness is
   *                     decided by isEmptyForProvenance — the SAME predicate the
   *                     EMPTY gate uses — so "held content" means one thing
   *                     throughout the module, and a whitespace-only or sentinel
   *                     prior counts as a fill rather than a replacement.
   *   • "overwritten" — (Parcel 8b) an authorised write replaced a live freeze,
   *                     displacing a HUMAN DECISION rather than merely some
   *                     content. It deliberately KEEPS the fill/replace
   *                     ambiguity that "written" has just shed, because what it
   *                     reports is source displacement, not content
   *                     displacement: it is returned even when the frozen prior
   *                     was empty, since displacing an explicit human empty
   *                     still displaces a decision. Recorded here as a wording
   *                     input for Parcel 8d — an announcement must not describe
   *                     an "overwritten" field as having had its text replaced.
   *
   * The refusing dispositions are unchanged. "frozen" refuses on provenance,
   * "empty" refuses on incoming content, and "skipped" (Parcel 8c-iv-pre) means
   * `writeFields` excluded the field from this call so it was never considered.
   */
  const DISPOSITION = Object.freeze({
    WRITTEN: "written",
    REPLACED: "replaced",
    OVERWRITTEN: "overwritten",
    FROZEN: "frozen",
    EMPTY: "empty",
    SKIPPED: "skipped",
    NOT_FOUND: "not-found",
  });

  // ---------------------------------------------------------------------------
  // Predicates
  // ---------------------------------------------------------------------------

  /**
   * True when `content` counts as "no content" for provenance: a non-string, a
   * blank/whitespace-only string, or the exact section-4 sentinel. Applied
   * uniformly to all four fields (the sentinel is a no-op outside `text`).
   *
   * @param {*} content
   * @returns {boolean}
   */
  function isEmptyForProvenance(content) {
    if (typeof content !== "string") return true;
    const trimmed = content.trim();
    return trimmed === "" || trimmed === NO_TEXT_SENTINEL;
  }

  /**
   * True when a field's current source freezes it against machine writes.
   * @param {*} currentSource
   * @returns {boolean}
   */
  function isFrozen(currentSource) {
    return FROZEN_SOURCES.includes(currentSource);
  }

  /**
   * Parcel 8e-1 — may a person accept this field's current content as reviewed,
   * stamping "ai-reviewed" over its current source?
   *
   * True ONLY when the content is non-empty for provenance AND the source is
   * exactly one of REVIEWABLE_SOURCES. Every other case refuses with its own
   * reason, because the stamp is one-way: "ai-reviewed" is in FROZEN_SOURCES,
   * so accepting freezes the field against every later machine write. Refusing
   * wrongly costs a person one gesture; accepting wrongly is not undoable by
   * any machine path.
   *
   * ── Content is checked FIRST, whatever the source says ────────────────────
   * Never stamping a blank is the floor, so it is tested before provenance and
   * reuses isEmptyForProvenance rather than reimplementing it — a whitespace-
   * only field and the section-4 sentinel are blanks here exactly as they are
   * at the EMPTY gate in write(). A field that is both blank and, say,
   * human-authored therefore reports EMPTY_CONTENT; both are refusals, so the
   * ordering changes only which reason a caller sees.
   *
   * ── "original" is ACCEPTABLE as of 8e-2, and that is now settled ──────────
   * 8e-1 refused it and recorded the question as open; Matthew settled it on
   * 10 August 2026. The reasoning is on REVIEWABLE_SOURCES above and is a
   * reachability argument, not an authorship one: an "original" field can be
   * overwritten by a later classifyField run, so refusing left document-supplied
   * and OCR alt text with no way to be protected at all. Do not re-refuse it
   * without reopening that decision.
   *
   * @param {*} source - The field's CURRENT *Source value from the entry.
   * @param {*} content - The field's CURRENT content.
   * @returns {{acceptable: boolean, reason: string}} `reason` is a member of
   *   ACCEPT_REASON — a stable identifier, not prose for a person.
   */
  function isAcceptableForReview(source, content) {
    if (isEmptyForProvenance(content)) {
      logDebug(
        `isAcceptableForReview(): refused — content is empty for provenance (source "${source}")`,
      );
      return { acceptable: false, reason: ACCEPT_REASON.EMPTY_CONTENT };
    }

    if (REVIEWABLE_SOURCES.includes(source)) {
      logDebug(`isAcceptableForReview(): acceptable — source "${source}"`);
      return { acceptable: true, reason: ACCEPT_REASON.ACCEPTABLE };
    }

    // null first — see the note on REFUSAL_REASON_BY_SOURCE. hasOwnProperty
    // guards the lookup so an inherited Object.prototype member (a source of
    // "constructor", say) cannot answer for a real reason.
    let reason;
    if (source === null) {
      reason = ACCEPT_REASON.NO_PROVENANCE;
    } else if (
      Object.prototype.hasOwnProperty.call(REFUSAL_REASON_BY_SOURCE, source)
    ) {
      reason = REFUSAL_REASON_BY_SOURCE[source];
    } else {
      reason = ACCEPT_REASON.UNRECOGNISED_SOURCE;
    }

    logDebug(
      `isAcceptableForReview(): refused — source "${source}" (${reason})`,
    );
    return { acceptable: false, reason };
  }

  /**
   * Normalise the optional `overwriteFields` argument into a Set of authorised
   * field keys, defensively (Parcel 8b). The result NEVER contains anything but
   * the four keys in KNOWN_FIELD_KEYS, so an authorisation can never widen the
   * write surface beyond the known fields.
   *
   *   - omitted / undefined / null  → empty Set (today's behaviour for all)
   *   - a non-array                 → empty Set, with a WARN
   *   - unknown keys                → ignored, with a WARN naming them
   *
   * @param {*} overwriteFields
   * @returns {Set<string>} Authorised field keys, a subset of KNOWN_FIELD_KEYS.
   */
  function normaliseOverwriteFields(overwriteFields) {
    if (overwriteFields === undefined || overwriteFields === null) {
      return new Set();
    }

    if (!Array.isArray(overwriteFields)) {
      logWarn(
        `write(): overwriteFields must be an array of field keys; received ${typeof overwriteFields} — ignoring (no field authorised for overwrite)`,
      );
      return new Set();
    }

    const authorised = new Set();
    const unknown = [];
    for (const key of overwriteFields) {
      if (KNOWN_FIELD_KEYS.includes(key)) {
        authorised.add(key);
      } else {
        unknown.push(key);
      }
    }

    if (unknown.length > 0) {
      logWarn(
        `write(): overwriteFields contains unknown key(s) [${unknown.join(", ")}] — ignored; valid keys are ${KNOWN_FIELD_KEYS.join(", ")}`,
      );
    }

    return authorised;
  }

  /**
   * Normalise the optional `writeFields` argument into either `null` (no
   * restriction) or a Set of the field keys this call may consider (Parcel
   * 8c-iv-pre). Like normaliseOverwriteFields, the returned Set never contains
   * anything outside KNOWN_FIELD_KEYS.
   *
   *   - omitted / undefined  → null, meaning NO RESTRICTION: all four fields are
   *                            considered. This is the pre-parcel behaviour and
   *                            the no-regression lock for every existing caller.
   *   - null                 → EMPTY Set, with a WARN. Nothing is written.
   *   - a non-array          → EMPTY Set, with a WARN naming the type received.
   *   - an array             → filtered against KNOWN_FIELD_KEYS, unknown keys
   *                            dropped with a WARN naming them; returned even
   *                            when the result is empty (an empty selection is a
   *                            valid choice, not an error).
   *
   * ── The deliberate asymmetry with normaliseOverwriteFields ────────────────
   * There, `null` and `undefined` are treated identically, because both resolve
   * to "authorise nothing" — already the safe direction, so conflating them can
   * only ever be over-cautious. HERE they must differ: `undefined` means "no
   * restriction" and `null` means "no fields", which are OPPOSITE outcomes, and
   * only one of them is safe to arrive at by accident. `null` is in particular
   * the field-selection dialog's cancel sentinel, so reading it as "write
   * everything" would turn a cancelled dialog into a full four-field write.
   * This helper therefore fails CLOSED on every malformed input: only an
   * explicit absence widens the scope.
   *
   * @param {*} writeFields
   * @returns {Set<string>|null} Selected field keys, or null for no restriction.
   */
  function normaliseWriteFields(writeFields) {
    // Only an explicit absence means "no restriction" — see the asymmetry note.
    if (writeFields === undefined) {
      return null;
    }

    // null is the dialog's cancel sentinel: fail closed, never widen.
    if (writeFields === null) {
      logWarn(
        "write(): writeFields was null (the cancel sentinel), which is NOT the same as omitting it — selecting no fields; nothing will be written",
      );
      return new Set();
    }

    if (!Array.isArray(writeFields)) {
      logWarn(
        `write(): writeFields must be an array of field keys; received ${typeof writeFields} — failing closed (no field selected, nothing will be written)`,
      );
      return new Set();
    }

    const selected = new Set();
    const unknown = [];
    for (const key of writeFields) {
      if (KNOWN_FIELD_KEYS.includes(key)) {
        selected.add(key);
      } else {
        unknown.push(key);
      }
    }

    if (unknown.length > 0) {
      logWarn(
        `write(): writeFields contains unknown key(s) [${unknown.join(", ")}] — ignored; valid keys are ${KNOWN_FIELD_KEYS.join(", ")}`,
      );
    }

    return selected;
  }

  // ---------------------------------------------------------------------------
  // WRITE — the single commit boundary
  // ---------------------------------------------------------------------------

  /**
   * Commit a parsed four-field description onto a registry entry with explicit
   * provenance, honouring the freeze floor (F5) and the empty predicate (F7).
   *
   * @param {Object} args
   * @param {Object} args.registry - A MathPixImageRegistry instance.
   * @param {string} args.id - The image id.
   * @param {{title: string, alt: string, long: string, text: string}} args.fields
   *   - The parser's exact output; each value a string (possibly "").
   * @param {string|null} args.source - The provenance value to stamp. REQUIRED;
   *   `undefined` is refused (F4). `null` is a VALID member and accepted.
   * @param {string[]} [args.overwriteFields] - OPTIONAL (Parcel 8b). Field keys,
   *   drawn from "title" | "alt" | "long" | "text", that a person has explicitly
   *   authorised for overwrite in the interface. A named field skips the FREEZE
   *   gate ONLY; the empty gate still applies. Omitted, undefined, null, or an
   *   empty list means today's behaviour for every field. A non-array is coerced
   *   to empty with a WARN; unknown keys are ignored with a WARN. Non-interactive
   *   writers (chemistry above all) pass nothing and stay fully frozen.
   * @param {string[]} [args.writeFields] - OPTIONAL (Parcel 8c-iv-pre). Field
   *   keys, drawn from "title" | "alt" | "long" | "text", restricting WHICH
   *   fields this call considers; any other field is "skipped" untouched.
   *   OMITTING it means no restriction (all four considered) — today's
   *   behaviour. Every malformed value fails CLOSED to an empty selection: null
   *   (the dialog's cancel sentinel) and a non-array both select nothing, each
   *   with a WARN; unknown keys are dropped with a WARN. Selection is orthogonal
   *   to `overwriteFields` — it never grants permission to replace a frozen
   *   field.
   * @returns {{id: string, source: (string|null), found: boolean,
   *   results: {title: string, alt: string, long: string, text: string}}}
   *   Each `results` value is "written" | "replaced" | "overwritten" | "frozen"
   *   | "empty" | "skipped" (or "not-found" for every field when the entry does
   *   not exist). "written" means the write filled a field that held no
   *   content; "replaced" (Parcel 8d-fid) means it displaced existing
   *   non-frozen content; "overwritten" means an authorised write replaced a
   *   live freeze (source displacement, so it is returned whether or not the
   *   frozen prior held content); "skipped" means `writeFields` excluded the
   *   field from this call.
   * @throws {TypeError} If `source` is undefined (the forgotten-argument case).
   */
  function write({
    registry,
    id,
    fields,
    source,
    overwriteFields,
    writeFields,
  } = {}) {
    // (a) F4 — require an explicit source. undefined is the forgotten-argument
    // case; refuse it BEFORE touching the registry. null is a valid member and
    // must NOT be refused here.
    if (source === undefined) {
      throw new TypeError(
        "MathPixAltTextWriteStage.write requires an explicit source; refusing a sourceless write (F4)",
      );
    }

    // (a2) Normalise the optional per-field overwrite authorisation (Parcel 8b).
    // Defensive: a non-array warns and behaves as today; unknown keys are
    // dropped with a warning; the result can never widen beyond the four keys.
    const authorisedOverwrites = normaliseOverwriteFields(overwriteFields);

    // (a3) Normalise the optional field selection (Parcel 8c-iv-pre). `null`
    // here means NO RESTRICTION; an empty Set means nothing is selected. Every
    // malformed value fails closed to the latter — see normaliseWriteFields.
    const selectedFields = normaliseWriteFields(writeFields);

    // (b) Look up the entry once. A missing entry writes nothing.
    const entry = registry.getImage(id);
    if (!entry) {
      logWarn(`write(): id "${id}" not found — nothing written`);
      return {
        id,
        source,
        found: false,
        results: {
          title: DISPOSITION.NOT_FOUND,
          alt: DISPOSITION.NOT_FOUND,
          long: DISPOSITION.NOT_FOUND,
          text: DISPOSITION.NOT_FOUND,
        },
      };
    }

    const results = {};

    // (d) Decide and (where warranted) commit each field. Selection is checked
    // BEFORE freeze, so an unselected field is never even examined; freeze is
    // checked BEFORE empty, so a human-owned field is never touched, even by an
    // empty incoming write.
    for (const { field, setter, sourceKey, contentKey } of FIELD_MAP) {
      const content = fields ? fields[field] : undefined;
      const currentSource = entry[sourceKey];
      const frozen = isFrozen(currentSource);
      const authorised = authorisedOverwrites.has(field);

      // Prior content, read BEFORE any setter runs (Parcel 8d-fid) — this is
      // what decides "written" (filled a blank) from "replaced" (displaced
      // existing content) at the write step. `entry` is the pre-write snapshot
      // taken above, and getImage returns a deep clone, so no setter run by an
      // earlier iteration can disturb it; capturing it here rather than after
      // the setter keeps that independent of the registry's cloning behaviour.
      const priorContent = entry[contentKey];

      // 1. SELECT (Parcel 8c-iv-pre) first — a field this call does not select
      // is not considered at all. A null selection means no restriction, so
      // every field passes this gate exactly as it did before the parcel.
      if (selectedFields !== null && !selectedFields.has(field)) {
        results[field] = DISPOSITION.SKIPPED;
        logDebug(`write(): ${field} not selected by writeFields — skipped`);
        continue;
      }

      // 2. FREEZE (F5) next — UNLESS a person explicitly authorised this field
      // for overwrite (Parcel 8b). Authorisation skips this gate only.
      if (frozen && !authorised) {
        results[field] = DISPOSITION.FROZEN;
        logDebug(
          `write(): ${field} frozen (source "${currentSource}") — not written`,
        );
        continue;
      }

      // 3. EMPTY (F7) last — applies to authorised fields too, so an authorised
      // field with empty incoming content is still not stamped.
      if (isEmptyForProvenance(content)) {
        results[field] = DISPOSITION.EMPTY;
        logDebug(`write(): ${field} empty for provenance — not written`);
        continue;
      }

      // 4. WRITE. Three outcomes, decided by what this write displaced:
      // an authorised replacement of a live freeze is "overwritten" (source
      // displacement — unchanged by this parcel, and reported whether or not
      // the frozen prior held content); otherwise a prior that was empty for
      // provenance means the write filled a blank ("written"), and any other
      // prior means it displaced existing non-frozen content ("replaced").
      // The prior is judged by isEmptyForProvenance, the same predicate the
      // EMPTY gate above uses, so a whitespace-only prior counts as a fill.
      const priorWasEmpty = isEmptyForProvenance(priorContent);

      registry[setter](id, content, source);

      if (frozen && authorised) {
        results[field] = DISPOSITION.OVERWRITTEN;
        logDebug(
          `write(): ${field} overwritten with source "${source}" — authorised replacement of a frozen field (was "${currentSource}")`,
        );
      } else if (priorWasEmpty) {
        results[field] = DISPOSITION.WRITTEN;
        logDebug(
          `write(): ${field} written with source "${source}" — filled a field that held no content`,
        );
      } else {
        results[field] = DISPOSITION.REPLACED;
        logDebug(
          `write(): ${field} replaced with source "${source}" — displaced existing non-frozen content (source was "${currentSource}")`,
        );
      }
    }

    return { id, source, found: true, results };
  }

  logInfo("MathPixAltTextWriteStage ready (four-field provenance write)");

  return {
    write,
    // Parcel 8e-1 — the accept predicate, and the two lists a caller or a guard
    // row should read live rather than copy.
    isAcceptableForReview,
    REVIEWABLE_SOURCES,
    ACCEPT_REASON,
    // Exposed for tests / callers that need the sentinel or freeze set literally.
    NO_TEXT_SENTINEL,
    FROZEN_SOURCES,
  };
})();

// Attach at definition time only (guarded so the module also loads cleanly
// where `window` is absent), matching the ai-alt-text siblings.
if (typeof window !== "undefined") {
  window.MathPixAltTextWriteStage = MathPixAltTextWriteStage;
}
