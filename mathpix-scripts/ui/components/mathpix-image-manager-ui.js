/**
 * @fileoverview MathPix Image Manager UI — Phase 8H.1
 * @module MathPixImageManagerUI
 * @version 1.0.0
 * @since Phase 8H.1
 *
 * @description
 * Modal-based UI for managing images in restored OCR documents.
 * Allows users to view, replace (swap), add, and delete images
 * via a thumbnail grid. Integrates with MathPixImageRegistry and
 * MathPixSessionRestorer.
 *
 * Architecture:
 * - IIFE with class pattern (matches image-registry, display-layer, ai-enhancer)
 * - Uses UniversalModal.Modal for modal lifecycle
 * - onclick handlers on buttons for simplicity
 * - Icons via data-icon attribute (auto-populated by icon-library.js)
 *
 * @see mathpix-image-registry.js — Registry API
 * @see mathpix-mmd-display-layer.js — Display layer API
 * @see mathpix-session-restorer.js — Integration target
 * @see mathpix-ai-enhancer.js — Modal pattern reference
 */

const MathPixImageManagerUI = (function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ImageManagerUI ERROR]: ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ImageManagerUI WARN]: ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ImageManagerUI INFO]: ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ImageManagerUI DEBUG]: ${message}`, ...args);
  }

  // ============================================================================
  // ESCAPING HELPERS
  // ============================================================================

  /**
   * Escape a value for safe interpolation into an inline
   * onclick="fn('${value}')" attribute. The onclick value is parsed twice:
   * first as an HTML attribute (decoding entities), then as JavaScript
   * (the decoded string is the JS source). So defence has to cover both
   * surfaces:
   *
   *   - HTML attribute breakout: &, ", <, > → HTML entities.
   *   - JS string breakout: \, ', newlines → JS backslash escapes.
   *
   * Image IDs are UUID-style in practice, but defence in depth is the right
   * posture for any attribute interpolation. Note: pass the raw ID here —
   * do NOT pass a value that has already been through _escapeAttr (the HTML
   * entities would be double-escaped).
   *
   * @param {string} value - Raw value to escape.
   * @returns {string} Escape-safe for the onclick double-surface context.
   */
  function escapeForOnclick(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  // Parcel 7a — entry→File materialisation. The OpenRouter Embed validator
  // (openrouter-embed-file.js) accepts SUPPORTED_TYPES and MAX_FILE_SIZE only,
  // so an entry whose type cannot be established as one of those is rejected
  // here rather than at the API boundary.
  const MATERIALISE_ERROR_PREFIX = "Image unavailable: ";
  const MATERIALISE_FETCH_TIMEOUT_MS = 30000; // matches the image downloader

  // Blob types that assert nothing about the bytes, so a known extension may
  // fill the gap (mirrors the ZIP-restore re-wrap in session-restorer-images).
  // A blob that positively declares an unsupported type (e.g. "image/gif") is
  // never relabelled — that would hand the embed mislabelled bytes.
  const UNASSERTED_BLOB_TYPES = ["", "application/octet-stream"];

  const EXTENSION_TYPE_MAP = Object.freeze({
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  });

  const TYPE_EXTENSION_MAP = Object.freeze({
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  });

  const STATUS_LABELS = {
    "cdn-linked": "OCR original",
    downloaded: "Downloaded",
    "user-replaced": "Replaced",
    "user-added": "Added by user",
    "data-uri": "Embedded",
    missing: "Missing",
  };

  // Stage 4 — image manager metadata cluster and counter configuration.
  // All copy and icon choices are isolated here so wording or icon swaps
  // are a one-line edit.
  const COUNTER_LABEL = "covered";
  const COUNTER_DESCRIPTION =
    "Counts images with alt text or marked decorative.";
  const BADGE_ICONS = {
    caption: "message",
    alt: "missingAlt",
    longDesc: "document",
    decorative: "eyeOff",
  };
  const KEY_DECORATIVE_WORDING =
    "Decorative — alt and long description skipped";

  // ============================================================================
  // STAGE 5 — EDIT VIEW CONSTANTS
  // All wording strings and element IDs for the Edit Alt Text view live here
  // so adjusting copy or selectors is a one-line edit.
  // ============================================================================

  // --- Element IDs (grid view + edit view containers, edit view internals) ---

  // The resume toolbar button that opens this manager. Lives in tools.html and
  // is never removed, so it is both the open trigger and (parcel g-6) the focus
  // park the deferred close announcement is spoken behind.
  const MANAGE_IMAGES_BTN_ID = "resume-manage-images-btn";

  const GRID_VIEW_CONTAINER_ID = "mmd-image-manager-grid-view";
  const GRID_REGION_HEADING_ID = "mmd-image-manager-grid-view-heading";
  const EDIT_VIEW_CONTAINER_ID = "mmd-image-manager-edit-view";
  const EDIT_VIEW_HEADING_ID = "edit-alt-view-heading";
  const EDIT_VIEW_SUBTITLE_ID = "edit-alt-view-subtitle";
  const EDIT_VIEW_FORM_ID = "edit-alt-form";
  const EDIT_VIEW_BACK_BTN_ID = "edit-alt-back-btn";
  const EDIT_VIEW_SAVE_BTN_ID = "edit-alt-save-btn";
  const EDIT_VIEW_GENERATE_BTN_ID = "edit-alt-generate-btn";
  const EDIT_VIEW_BANNER_ID = "edit-alt-legacy-banner";
  const EDIT_VIEW_PREVIEW_IMG_ID = "edit-alt-preview-img";
  const EDIT_VIEW_PREVIEW_CAPTION_ID = "edit-alt-preview-caption";

  // Per-field IDs grouped by field key (consumed by Chunks 3 / 4).
  //
  // `accept` (Parcel 8e-2) is the per-field "mark as reviewed" control. It is
  // absent from `decorative` deliberately, and that absence is the same
  // load-bearing one FIELD_SELECT_ROWS records: the flag carries no provenance,
  // so there is nothing about it a person could mark reviewed.
  const FIELD_IDS = {
    caption: {
      input: "edit-alt-caption-input",
      help: "edit-alt-caption-help",
      count: "edit-alt-caption-count",
      provenance: "edit-alt-caption-provenance",
      hint: "edit-alt-caption-hint",
      toggletip: "edit-alt-caption-toggletip",
      accept: "edit-alt-caption-accept",
    },
    altText: {
      input: "edit-alt-alttext-input",
      help: "edit-alt-alttext-help",
      count: "edit-alt-alttext-count",
      provenance: "edit-alt-alttext-provenance",
      accept: "edit-alt-alttext-accept",
    },
    longDescription: {
      input: "edit-alt-longdesc-input",
      help: "edit-alt-longdesc-help",
      count: "edit-alt-longdesc-count",
      provenance: "edit-alt-longdesc-provenance",
      accept: "edit-alt-longdesc-accept",
    },
    textInImage: {
      input: "edit-alt-textinimage-input",
      help: "edit-alt-textinimage-help",
      count: "edit-alt-textinimage-count",
      provenance: "edit-alt-textinimage-provenance",
      accept: "edit-alt-textinimage-accept",
    },
    decorative: {
      input: "edit-alt-decorative-input",
    },
  };

  // --- Provenance labels (registry source state per field) ---
  // Two hand-tweakable maps: the on-screen pill text, and the phrase a screen
  // reader hears. Five source states carry a pill; "original" and null carry
  // the data-provenance attribute but no pill.
  //
  // The current model:
  //   - "ai-generated" and "algo-generated" are machine-authored and
  //     unreviewed ("ai-generated" by an AI model, "algo-generated" by the
  //     chemistry tools).
  //   - "ai-reviewed" is machine-authored and reviewed unchanged by a person.
  //   - "ai-edited" is machine-authored, then changed by a person.
  //   - "user" and "original" are human-authored.

  // Visible pill text — shown on screen, hidden from assistive tech via aria-hidden.
  const EDIT_PROVENANCE_TEXT_VISIBLE = {
    user: "Edited by user",
    "ai-generated": "AI generated, not reviewed",
    "ai-reviewed": "AI generated, reviewed",
    "algo-generated": "Generated by chemistry tools",
    "ai-edited": "Human-edited",
  };

  // Screen-reader phrase — visually hidden, read by assistive tech.
  const EDIT_PROVENANCE_TEXT_SR = {
    user: "Edited by user",
    "ai-generated": "Generated by an AI model, not yet reviewed by a person",
    "ai-reviewed":
      "Generated by an AI model, reviewed by a person and left unchanged",
    "algo-generated":
      "Generated automatically by the chemistry tools, not an AI model",
    "ai-edited": "Edited by a person after AI generation",
  };

  // Q3 disable hint sits above the Alt + Long Description block and is shared.
  const EDIT_VIEW_DISABLE_HINT_ID = "edit-alt-disable-hint";

  // Stage 10 (H-7): dedicated polite region announcing decorative-toggle
  // transitions. Visually hidden; empty on render; written by
  // _applyDecorativeState; cleared on Edit-view open (F2.2).
  const EDIT_VIEW_DECORATIVE_ANNOUNCE_ID = "image-manager-decorative-announce";

  // Parcel 5: the AI run's own polite announcement channel — a SEPARATE
  // region from the decorative announce above, deliberately not shared with
  // it. Present and empty from Edit-view open (never `hidden`) so assistive
  // tech is already watching it when a later parcel injects run text.
  const EDIT_VIEW_AI_STATUS_ID = "edit-alt-ai-status";

  // Parcel 9a: the AI-run block wrapping the Generate control and the status
  // region above. Identified so the announcement channel has a named container
  // that holds exactly one live region.
  const EDIT_VIEW_AI_RUN_ID = "edit-alt-ai-run";

  // Parcel 5: container OpenRouterEmbed renders into. Kept out of sight and
  // out of the accessibility tree — see the template comment for why the
  // `hidden` attribute specifically is load-bearing here.
  const EDIT_VIEW_AI_EMBED_SINK_ID = "edit-alt-ai-embed-sink";

  // Parcel 8d-pre: the running indication. The progress block gives the
  // injected progress controller somewhere to paint between the Generate
  // button and the status region. It carries NO aria-live, no role="status"
  // and no role="progressbar" — #edit-alt-ai-status stays the ONE live region
  // inside the AI-run wrapper, which the 9a wrapper row asserts.
  const EDIT_VIEW_AI_PROGRESS_ID = "edit-alt-ai-progress";
  const EDIT_VIEW_AI_PROGRESS_SPINNER_ID = "edit-alt-ai-progress-spinner";
  const EDIT_VIEW_AI_PROGRESS_STAGE_ID = "edit-alt-ai-progress-stage";
  const EDIT_VIEW_AI_PROGRESS_TIME_ID = "edit-alt-ai-progress-time";

  // Parcel 8d-pre: the run's START line. Paired with the orchestrator's outcome
  // line, a run now speaks at most twice — one at start, one at outcome. The
  // wording lives here so parcel 8d can refine it in exactly one place.
  const EDIT_ALT_RUN_START_ANNOUNCEMENT = "Generating AI description.";
  const EDIT_ALT_RUN_START_STATUS_TYPE = "loading";

  // Parcel 8d-notify: the run's COMPLETION line for the journeys where the
  // person has LEFT the edit view before the run resolved. It sits here beside
  // the start line deliberately — parcel 8d rewrites both, and both must be a
  // one-line edit in one place.
  //
  // It names the image because the person is no longer looking at the view that
  // says which one. The token is substituted from the ZIP filename map, not from
  // a registry field: the registry entry exposes no display name (see
  // _resolveImageDisplayName).
  //
  // Parcel 8d-notify-b — IT ALSO CARRIES THE COVERAGE COUNT. The 1 August listen
  // found THREE polite lines on the Back-to-grid journey, not two: the start
  // line, this completion line, and the coverage counter's own "1/11 covered"
  // spoken anyway.
  //
  // HISTORY of why that third line happened, no longer current behaviour: the
  // counter's aria-live was genuinely absent while its text mutated — the guard
  // row measured that correctly — but the run's finally restored the attribute
  // milliseconds later and NVDA spoke the changed text on restore. A green
  // guard row read clean over a regression a human could hear. Parcel g-1
  // (5 August 2026) removed the attribute from the template permanently, so
  // there is no restore and no third line by construction.
  //
  // Going from no described images to one IS the news, so the count is MERGED
  // into this single line rather than silenced. Both facts, one line, one
  // announcement. That merge is now the ONLY route by which the count is
  // spoken on this journey, which is why it stays after g-1.
  //
  // PARCEL 8d PART 2 — IT NOW WRAPS THE CORE SENTENCE RATHER THAN REPLACING IT.
  // Until this parcel the method took the orchestrator's message and threw it
  // away, rebuilding a fixed "AI description generated for {name}." — so the
  // out-of-view journey was told LESS than the in-view one, which since 8d part
  // 1 hears what the run actually did (filled, replaced, overwrote, kept). The
  // person who walked away is exactly the person who cannot see the fields and
  // most needs telling. The core sentence is now substituted in whole.
  //
  // ORDER: the count leads, the core sentence closes. The count is the one part
  // whose length is bounded and predictable, so putting it first lets a listener
  // reach the variable-length part already knowing the tally.
  //
  // DEGRADATION LADDER, strictly in this order: the NAME is dropped first (it is
  // the only part that can fail to resolve), the COUNT only when no registry can
  // be read at all, and the CORE SENTENCE never — it is what the run did, and
  // dropping it would return this journey to the silence 8d-notify closed. Same
  // shape as the 8d-err ladder below, where the name degrades and the error
  // never does.
  //
  // Numbers still come from _computeCoverage — the SAME source the visible
  // counter reads, never a second equivalent-looking filter. Part 2 did not move
  // that, and the merge guard row depends on it not moving.
  const EDIT_ALT_RUN_COMPLETE_WRAP =
    "For {name}, {covered} of {total} covered: {core}";
  const EDIT_ALT_RUN_COMPLETE_WRAP_NO_NAME =
    "{covered} of {total} covered: {core}";
  const EDIT_ALT_RUN_COMPLETE_WRAP_NO_COVERAGE = "For {name}: {core}";
  const EDIT_ALT_RUN_COMPLETE_WRAP_CORE_ONLY = "{core}";
  const EDIT_ALT_RUN_COMPLETE_NAME_TOKEN = "{name}";
  const EDIT_ALT_RUN_COMPLETE_COVERED_TOKEN = "{covered}";
  const EDIT_ALT_RUN_COMPLETE_TOTAL_TOKEN = "{total}";
  const EDIT_ALT_RUN_COMPLETE_CORE_TOKEN = "{core}";
  // ALL FOUR TOKENS IN ONE PASS, matching the 8d-err machinery below. This
  // parcel RETIRED a chained `.replace(...).replace(...)` plus a third separate
  // replace for the name, which were safe only by accident of ordering: none of
  // the three values happened to contain another token. That is no longer a safe
  // assumption, because {core} now carries a string built elsewhere — a single
  // sequential pass would rescan it, so a core sentence containing "{name}" or
  // "{total}" would be rewritten into the image's name or the tally. One pass
  // with a function replacer makes that impossible by construction rather than
  // by luck, and the function form also stops String.replace treating `$&` or
  // `$1` inside a display name or a core sentence as a substitution pattern.
  const EDIT_ALT_RUN_COMPLETE_TOKEN_PATTERN =
    /\{name\}|\{covered\}|\{total\}|\{core\}/g;
  const EDIT_ALT_RUN_COMPLETE_STATUS_TYPE = "success";

  // Parcel 8d-err: the run's FAILURE line, for the same out-of-view journeys the
  // completion line above serves. 8d-notify re-routed success and left failure
  // suppressed, which made silence ambiguous: it meant "still running", "nothing
  // happened", AND "it failed" at once. Worse, silence now reads as SUCCESS,
  // because success is the case that speaks.
  //
  // It carries the VERBATIM contract error, because the in-view error line is
  // the only place that text ever appears and nothing re-shows it later — what
  // this line drops is lost to the person for good.
  //
  // NO COVERAGE COUNT, by design, unlike the completion line: a failed run
  // writes nothing, so there is no new number and reciting the old one would
  // imply progress that did not happen.
  const EDIT_ALT_RUN_FAILED_NAME_SENTENCE =
    "AI description failed for {name}. {error}";
  const EDIT_ALT_RUN_FAILED_DEGRADED_SENTENCE = "AI description failed. {error}";
  const EDIT_ALT_RUN_FAILED_NAME_TOKEN = "{name}";
  const EDIT_ALT_RUN_FAILED_ERROR_TOKEN = "{error}";
  // Both tokens in ONE pass, so a substituted value is never rescanned for the
  // other token — an API error string containing "{name}" is not rewritten into
  // the image name, and a filename containing "{error}" is not rewritten either.
  // Sequential replaces cannot give that guarantee in both directions. Keep this
  // alternation in step with the two token constants above.
  const EDIT_ALT_RUN_FAILED_TOKEN_PATTERN = /\{name\}|\{error\}/g;
  const EDIT_ALT_RUN_FAILED_STATUS_TYPE = "error";

  // The coverage counter's own id. It is a VISUAL readout only — parcel g-1,
  // 5 August 2026 — and there is no longer a resting-politeness constant
  // beside it, because there is no politeness to rest at.
  //
  // HISTORY, kept because it is the evidence for the decision rather than a
  // description of current behaviour:
  //   - Measured on real NVDA, say-all OFF, 1 August 2026: the counter SPOKE.
  //     One Add Image gesture produced four announcements, "1/12 covered"
  //     among them.
  //   - 8d-notify therefore suppressed it for the duration of a run, and
  //     8d-notify-c extended that to the whole modal session after the restore
  //     itself was heard speaking (see _handleGenerateAltText's finally).
  //   - The residue was a lifecycle nobody could hear the state of: a toggle
  //     whose correctness depended on when an attribute came back.
  //
  // DECISION (5 August 2026): the composed gesture lines that parcels g-2
  // onward add carry the count IN WORDS, so this readout keeps its visible
  // text and loses live semantics permanently, at build time. The toggle and
  // its restore-speaks hazard are deleted rather than managed.
  const COVERAGE_COUNTER_ID = "mmd-image-manager-coverage-counter";

  // --- Focus-management selectors (Chunks 3 / 4) ---
  // Q8b: focus returns to the Alt button of the card the user came from.
  function altButtonSelectorForId(imageId) {
    return `.image-manager-alt-btn[data-image-id="${imageId}"]`;
  }

  // --- Alt-button needs-attention signals (8c-v-b) ---
  // The two DOM signals _buildAltButtonHTML() gates on `altState === "no-alt"`.
  // Named here because _refreshCardAltButton() has to move the same two on an
  // already-rendered button. Both paths now read the names from here, so a
  // rename is a single edit — but the Stage 5 tests bind to the modifier class
  // by literal, so a rename still has to reach them.
  const ALT_BTN_NEEDS_ATTENTION_CLASS =
    "image-manager-alt-btn--needs-attention";
  const ALT_BTN_WARNING_CLASS = "image-manager-alt-btn-warning";

  // The button's accessible name, in two parts (WCAG 1.3.1). The button carries
  // an aria-label, which OVERRIDES its contents, so nothing inside it — not the
  // visible "Alt" text, not the warning icon — reaches assistive technology.
  // Until now the label was identical in both states, so the needs-attention
  // state was a purely visual cue and a screen reader user could not tell which
  // images still need work. Putting the state in the label is the only surface
  // that can carry it.
  //
  // The suffix appears exactly ONCE in this file, here, so a reword is a
  // one-place edit. Both the build path and the refresh path assemble the label
  // through _altButtonAriaLabel() from these two constants.
  const ALT_BTN_LABEL_PREFIX = "Edit alt text for image ";
  const ALT_BTN_NEEDS_ATTENTION_LABEL_SUFFIX = ", needs attention";

  // --- Field labels ---
  const FIELD_LABELS = {
    caption: "Caption", // Q1
    altText: "Alt text", // Q7
    longDescription: "Long description", // Q7
    textInImage: "Text in image", // Q7
    decorative: "Mark image as decorative", // Q3
  };

  // --- Field help text ---
  // Q1 (caption), Q7 (alt text "two sentences usually works well"; long
  // description and text in image strings approved Stage 5 Chunk 2 Phase B).
  const FIELD_HELP_TEXT = {
    caption: "Adds a visible caption shown beneath the image.",
    altText: "Two sentences usually works well.",
    longDescription:
      "Use this for diagrams, charts, or images that need a fuller explanation than alt text can carry.",
    textInImage:
      "List any text visible inside the image (labels, captions, signs).",
  };

  // --- Hints (shown conditionally; initially hidden) ---
  // Q2 — appears when the user clears a non-empty caption on an
  // includegraphics-origin image. Visibility logic lives in Chunk 3.
  const INCLUDEGRAPHICS_CLEAR_HINT =
    "This image had a figure wrapper in the source document. Clearing the caption will keep the wrapper in place in the MMD. To remove it entirely, edit the MMD directly.";

  // Q3 — appears above Alt Text + Long Description when decorative is ticked.
  // Visibility logic lives in Chunk 3.
  const DISABLE_HINT =
    "Decorative images don't need alt text or long description.";

  // --- Legacy-conflict banner (Q6a) ---
  const LEGACY_CONFLICT_BANNER_TEXT =
    "Decorative is on, and this image has stored alt text and long description. Those values won't be used while decorative is on. Untick decorative to use them, or save without changes to keep things as they are.";

  // --- Decorative-toggle announcements (Stage 10 H-7 / Flag 1) ---
  // Three state-aware messages written to the dedicated polite region by
  // _applyDecorativeState. The region announces in EVERY transition; it never
  // defers to the static-text banner (which does not reliably announce on
  // un-hide). Wording is PROVISIONAL pending the P9 screen-reader gate.
  const DECORATIVE_ANNOUNCE_ON =
    "Marked decorative; alt text and long description disabled.";
  const DECORATIVE_ANNOUNCE_ON_CONFLICT =
    "Marked decorative; the stored alt text and long description won't be used while decorative is on.";
  const DECORATIVE_ANNOUNCE_OFF =
    "Decorative removed; alt text and long description enabled.";

  // --- Caption toggletip (Q1) ---
  // Single paragraph; covers both wrap (markdown-origin) and unwrap (with
  // the Q2 includegraphics-source asymmetry) so the toggletip carries both
  // directions. Used by Chunk 3's UniversalToggletip.create({ content }) call.
  const CAPTION_TOGGLETIP_CONTENT =
    "Adding a caption wraps the image in a figure environment in the MMD so the caption renders below it. If you clear a caption later, an image that started life without a wrapper unwraps back to a plain image; an image whose original document already had a figure wrapper keeps the wrapper in place with an empty caption.";

  // --- Button labels ---
  const BACK_BUTTON_LABEL = "Back"; // Q8a
  const SAVE_BUTTON_LABEL = "Save"; // Q5d / Q4
  const GENERATE_BUTTON_LABEL = "Generate alt text";

  // --- Parcel g-10 — the Generate control across a cross-image run ------------
  // The edit view is ONE set of DOM shared by every image, so the Generate
  // button carries whatever state the last image left on it. Measured 12 August
  // 2026 (.claude/a11y/sr/generate-reentry-probe.mjs, committed at 1963b35):
  // with image A generating, arriving at image B found that button ALREADY
  // aria-disabled="true" — a true statement about A, made about B. The control
  // lied before it went silent. Same shared-DOM residue class as the accept
  // controls' reset (_refreshAcceptControls) and the 8d-pre-strand incident.
  //
  // The reason goes in the ACCESSIBLE NAME, via a visually-hidden span inside
  // the button. Grounded rather than assumed: the button carries NO aria-label,
  // so its name is computed from its contents and the icon span is excluded by
  // aria-hidden — which means a visually-hidden span inside it DOES contribute.
  // That is the opposite of a control whose name comes from an aria-label, where
  // the label would have to carry the state instead. Never a title attribute.
  const GENERATE_BLOCKED_NAME_SUFFIX = ", another image is generating";
  // The marker the reset finds its own span by. A class alone would also match
  // any other visually-hidden span a future parcel puts in this button.
  const GENERATE_BLOCKED_SUFFIX_ATTR = "data-generate-blocked";
  const GENERATE_BLOCKED_SUFFIX_CLASS = "visually-hidden";
  // Deliberately does NOT name the other image: a filename read aloud
  // mid-sentence is noise when the action is simply to wait.
  const GENERATE_BLOCKED_STATUS_LINE =
    "Another image is still generating. Wait for it to finish.";
  const GENERATE_BLOCKED_STATUS_TYPE = "info";

  // ============================================================================
  // PARCEL BG-P2 — BATCH GENERATION ("Describe All")
  //
  // A SIBLING UniversalModal opened over the manager, copying the
  // _promptFieldSelection pattern exactly (plan decision A1): markup built in
  // JS, buttons wired in onOpen, a resolve-once guard, and the distinctive
  // class stamped onto the live dialog in onOpen because the shim does not
  // forward `className`. It is never injected into the manager's own dialog DOM.
  //
  // THE ANNOUNCEMENT PIN (A10). EXACTLY TWO polite lines per batch — a start
  // line and an outcome line — both through UniversalModal.showStatus while the
  // batch dialog is stack top, so both land on the batch dialog's OWN
  // div.universal-modal-status-text. Everything between them (per-image
  // progress, the filename, elapsed time) is VISUAL-ONLY on non-live elements.
  // The batch's progress controller is silent BY CONSTRUCTION for that reason:
  // the orchestrator emits one showStatus or showError per run, so a speaking
  // controller would put N lines into the spoken stream for one gesture.
  // ============================================================================

  const BATCH_DIALOG_TITLE = "Describe all images";
  const BATCH_DIALOG_CLASS = "mmd-image-manager-batch";
  const BATCH_DESCRIBE_ALL_BTN_ID = "image-manager-describe-all-btn";
  const BATCH_DESCRIBE_ALL_LABEL = "Describe All";

  // The three views (A3). Exactly one is visible at a time; the others carry
  // the `hidden` property, so nothing in a non-current view is reachable.
  const BATCH_START_VIEW_ID = "image-manager-batch-start";
  const BATCH_RUNNING_VIEW_ID = "image-manager-batch-running";
  const BATCH_COMPLETE_VIEW_ID = "image-manager-batch-complete";

  const BATCH_CONFIRM_BTN_ID = "image-manager-batch-confirm-btn";
  const BATCH_CANCEL_BTN_ID = "image-manager-batch-cancel-btn";
  const BATCH_CLOSE_BTN_ID = "image-manager-batch-close-btn";

  // VISUAL-ONLY progress elements. None carries aria-live or a live role, and
  // none may ever gain one — that is the A10 pin, not a preference.
  const BATCH_PROGRESS_COUNT_ID = "image-manager-batch-progress-count";
  const BATCH_PROGRESS_STAGE_ID = "image-manager-batch-progress-stage";
  const BATCH_PROGRESS_TIME_ID = "image-manager-batch-progress-time";
  // F9-FIX removed the completion-view paragraph this id named. The
  // constant is KEPT, and still exported, because the guard rows that
  // assert the paragraph stays gone resolve the id through the module
  // rather than restating the literal — so a rename moves those rows with
  // it instead of leaving them asserting a stale element. Deleting it
  // would make those rows pass vacuously; they carry a canary that
  // reddens if it ever goes.
  const BATCH_SUMMARY_ID = "image-manager-batch-summary";

  const BATCH_CONFIRM_LABEL = "Start describing";
  const BATCH_CANCEL_LABEL = "Cancel";
  const BATCH_CLOSE_LABEL = "Close";

  // The two spoken lines. The OUTCOME line is never composed here — it is the
  // runner's own composed line, passed through verbatim, so the taxonomy lives
  // in one place (plan decisions A8, A9).
  const BATCH_START_LINE_SINGULAR = "Describing one image. Please wait.";
  const BATCH_START_LINE_PLURAL =
    "Describing {count} images. Please wait.";
  const BATCH_START_COUNT_TOKEN = "{count}";
  const BATCH_START_STATUS_TYPE = "info";
  const BATCH_OUTCOME_STATUS_TYPE = "success";

  // Visible-only strings for the three views.
  const BATCH_NO_TARGETS_TEXT =
    "Every image already has alt text, or is marked decorative. There is nothing to describe.";
  const BATCH_START_INTRO_SINGULAR =
    "One image has no alt text and is not decorative. It will be described using AI.";
  const BATCH_START_INTRO_PLURAL =
    "{count} images have no alt text and are not decorative. They will be described using AI.";
  const BATCH_RUNNING_STAGE_TEXT = "Describing image {index} of {total}…";

  // THE BLOCKED DIRECTION (A11, reverse). Mirrors the g-10 arrangement exactly:
  // aria-disabled rather than the disabled property, the control never removed,
  // the reason in the accessible name through a visually-hidden span, and the
  // blocked press writing ONE line on ONE channel with no announcer beside it.
  const DESCRIBE_ALL_BLOCKED_SUFFIX_ATTR = "data-describe-all-blocked";
  const DESCRIBE_ALL_BLOCKED_SUFFIX_CLASS = "visually-hidden";
  const DESCRIBE_ALL_BLOCKED_BY_RUN_SUFFIX = ", an image is generating";
  const DESCRIBE_ALL_BLOCKED_BY_EDIT_SUFFIX = ", close the edit view first";
  const DESCRIBE_ALL_BLOCKED_BY_RUN_LINE =
    "An image is still generating. Wait for it to finish.";
  // A2 is a LOCK, not a preference: a batch write into an open edit view leaves
  // _valuesAtOpen stale, and a later Save then reverts the batch's work.
  const DESCRIBE_ALL_BLOCKED_BY_EDIT_LINE =
    "Close the edit view before describing all images.";
  const DESCRIBE_ALL_BLOCKED_STATUS_TYPE = "info";

  // ============================================================================
  // PARCEL 8c-ii — FIELD-SELECTION DIALOG (interactive Generate)
  // A SIBLING UniversalModal opened over the manager to choose which
  // descriptions the AI should (re)generate. All IDs live in the
  // edit-alt-fieldsel-* family (matching FIELD_IDS' own suffixes:
  // caption/alttext/longdesc/textinimage); the class is the stylesheet + test
  // hook. Wording is read from FIELD_LABELS and the LIVE provenance map at
  // build time (never a captured copy), so the dialog always shows current
  // wording. This parcel builds the dialog only — nothing is generated.
  // ============================================================================
  const FIELD_SELECT_DIALOG_CLASS = "mmd-image-manager-fieldsel-modal";
  const FIELD_SELECT_DIALOG_TITLE = "Choose which descriptions to generate";
  const FIELD_SELECT_CONFIRM_LABEL = "Generate selected";
  const FIELD_SELECT_CANCEL_LABEL = "Cancel";
  const FIELD_SELECT_CONFIRM_BTN_ID = "edit-alt-fieldsel-confirm";
  const FIELD_SELECT_CANCEL_BTN_ID = "edit-alt-fieldsel-cancel";
  // State phrase for a field whose provenance is null or "original" (no pill).
  const FIELD_SELECT_STATE_NOT_SET = "not set";
  const FIELD_SELECT_STATE_HAS_CONTENT = "Has content";
  const FIELD_SELECT_STATE_EMPTY = "Empty";
  const FIELD_SELECT_INTRO_TEXT =
    "Tick the descriptions you want the AI to generate. Fields without content are ticked by default.";

  // One row per AI-writable content field, in display order. Each row ties the
  // manager field key to (a) its checkbox id, (b) the entry content property to
  // test for emptiness, (c) the entry provenance-source property, and (d) the
  // WRITE-STAGE field key 8c-iii will consume. caption→title is the deliberate
  // non-matching pair (T3): the manager's "caption" is the registry title.
  //
  // `setter` (Parcel 8e-1) names the registry method that writes the field.
  // It is added HERE rather than in a second accept-only map because the other
  // three properties would have had to be restated there, and a duplicated
  // contentProp/sourceProp pair is exactly the kind of copy that drifts. The
  // dialog ignores it; _acceptField reads all four.
  //
  // `decorative` is deliberately absent from this list, and that absence is
  // load-bearing for _acceptField: updateDecorative takes no source argument
  // and the flag carries no provenance, so it can never be accepted as
  // reviewed. It falls out of the row lookup as an unknown key.
  const FIELD_SELECT_ROWS = Object.freeze([
    {
      key: "caption",
      checkboxId: "edit-alt-fieldsel-caption",
      contentProp: "title",
      sourceProp: "titleSource",
      writeKey: "title",
      setter: "updateTitle",
    },
    {
      key: "altText",
      checkboxId: "edit-alt-fieldsel-alttext",
      contentProp: "altText",
      sourceProp: "altTextSource",
      writeKey: "alt",
      setter: "updateAltText",
    },
    {
      key: "longDescription",
      checkboxId: "edit-alt-fieldsel-longdesc",
      contentProp: "longDescription",
      sourceProp: "longDescriptionSource",
      writeKey: "long",
      setter: "updateLongDescription",
    },
    {
      key: "textInImage",
      checkboxId: "edit-alt-fieldsel-textinimage",
      contentProp: "textInImage",
      sourceProp: "textInImageSource",
      writeKey: "text",
      setter: "updateTextInImage",
    },
  ]);

  // ============================================================================
  // PARCEL 8e-1 — ACCEPT AS REVIEWED (write path only; no interface)
  // The source stamped on acceptance, and the manager-side refusal reasons.
  // The PROVENANCE reasons ("human-authored", "already-reviewed", …) are the
  // write stage's and are passed through untouched; the ones below are the
  // environment failures only this file can see.
  // ============================================================================
  const ACCEPTED_SOURCE = "ai-reviewed";
  const ACCEPT_FAIL_REASON = Object.freeze({
    PREDICATE_UNAVAILABLE: "predicate-unavailable",
    UNKNOWN_FIELD: "unknown-field",
    NO_REGISTRY: "no-registry",
    ENTRY_NOT_FOUND: "entry-not-found",
    NON_STRING_CONTENT: "non-string-content",
  });

  // Warn once per page for an unreachable write stage. A person pressing accept
  // repeatedly against a broken load should not fill the console with the same
  // line; the refusal itself is returned every time regardless.
  let acceptPredicateWarned = false;

  // ============================================================================
  // PARCEL 8e-2 — THE ACCEPT CONTROL, ITS ACTIVATION, AND ITS SPOKEN LINE
  // ============================================================================
  // The icon is DECORATIVE — aria-hidden, meaning carried entirely by the
  // button's visible text, which is why the reviewed state is a TEXT change and
  // not an icon swap. No aria-label anywhere on this control: an aria-label
  // overrides the contents, so the state a person can see would stop being the
  // state a screen reader hears.
  const ACCEPT_BUTTON_ICON = "checkCircle";

  // ── Parcel 8e-2b — the labels are PER FIELD ─────────────────────────────────
  // 8e-2 gave all four controls the same words, so an image with two acceptable
  // fields presented two identically named buttons and a person tabbing to one
  // could not tell which field it marked. The capacitors fixture happens to show
  // only one control, which is why the 8e-2 drive never met the case — the
  // defect was in the fixture's coverage, not in the assertion.
  //
  // Still NO aria-label: the name has to come from the visible text, or the
  // state a person sees stops being the state a reader hears.
  //
  // THE THREE FORMS ARE DELIBERATELY DISTINCT, and that is the whole point of
  // the wording rather than a stylistic choice. If NVDA re-reads the button when
  // its text changes under focus, the person hears a STATE ("Alt text reviewed")
  // and not the status line repeated back at them verbatim.
  const ACCEPT_BUTTON_RESTING_TEMPLATE = "Mark {field} as reviewed";
  const ACCEPT_BUTTON_REVIEWED_TEMPLATE = "{Field} reviewed";

  // The two spoken lines, UNCHANGED by 8e-2b. A guard row pins that, because a
  // label change dragging the announcement with it is exactly the drift that
  // sharing one composer between the two could introduce.
  //
  // NEITHER LINE CARRIES THE COVERAGE CLAUSE, and that is a decision rather than
  // an omission (Matthew, 10 August 2026): accepting does not move coverage — the
  // field already had content — so a repeated unchanged number would imply
  // something had happened. _withCoverageClause must never be applied to these;
  // a guard row pins its absence, because the refactor that routes this through
  // save's path is exactly how the clause would arrive uninvited.
  const ACCEPT_SUCCESS_TEMPLATE = "{Field} marked as reviewed.";
  const ACCEPT_REFUSAL_TEMPLATE =
    "{Field} can no longer be marked as reviewed.";

  // ONE regex, applied ONCE, with a function replacer. Sequential per-token
  // replaces are the trap this avoids: each pass rescans text an earlier pass
  // substituted, so a field label that happened to contain a token would be
  // rewritten by the pass after it. An alternation with a lookup keeps every
  // substitution in a single left-to-right sweep over the ORIGINAL string.
  //
  // 8e-2b made the alternation genuinely two-branch. {Field} is the FIELD_LABELS
  // value as stored, for a sentence-initial position; {field} is the same value
  // lower-cased, for mid-sentence. Case is the ONLY difference, so there is no
  // second label map to drift from the spoken line — which is why both the
  // labels and the announcement go through this one function.
  const ACCEPT_LINE_TOKEN_PATTERN = /\{(Field|field)\}/g;

  /**
   * Parcel 8e-2b — substitute {Field} / {field} from FIELD_LABELS.
   *
   * MODULE-LEVEL rather than a class method because _buildEditAltViewHTML needs
   * it too, and a template literal reaching for `this` inside the builder is how
   * a builder acquires an instance dependency it does not otherwise have.
   *
   * @param {string} template - one of the four ACCEPT_* templates.
   * @param {string} fieldKey - one of the four content field keys.
   * @returns {string}
   */
  function composeAcceptText(template, fieldKey) {
    const label = FIELD_LABELS[fieldKey] || "";
    const values = { Field: label, field: label.toLowerCase() };
    return template.replace(
      ACCEPT_LINE_TOKEN_PATTERN,
      (match, token) => values[token],
    );
  }

  // --- Chunk 4a save flow notifications ---
  // Success + undo + error wording per Q5d / Q5b. Duration per Q4 (12s).
  // The Undo affordance is rendered by notifySuccess's `actions` option
  // (Commit A) — auto-routes into the manager modal's in-modal status
  // area so the button renders where the user can see it.
  const TOAST_SUCCESS_TEXT = "Changes saved.";
  const TOAST_SUCCESS_UNDO_LABEL = "Undo";
  const TOAST_SUCCESS_UNDO_ARIA_LABEL = "Undo saved changes";
  const TOAST_SUCCESS_DURATION_MS = 12000;
  const TOAST_UNDONE_TEXT = "Changes undone.";
  const TOAST_ERROR_TEXT =
    "Couldn't save changes — please try again. Your typed values are still here.";

  // --- Parcel g-2: the coverage clause (option B, locked 5 August 2026) ---
  // Each gesture's existing outcome line gains a SECOND sentence carrying the
  // coverage count in full context. This exists because g-1 made the two
  // toolbar readouts permanently non-live: they no longer speak, so the count
  // has to travel on the sentence a gesture already produces, or not at all.
  //
  // Parcel g-2 lands it on save and undo-of-save only. Add, replace and remove
  // are g-3/g-4 and will call the SAME _composeCoverageClause() — the clause is
  // built once here so five gestures cannot come to word it five ways.
  //
  // A LOCAL words map, deliberately. alt-text-orchestrator.js has a sibling
  // countWord()/CORE_COUNT_WORDS for parcel 8d's "Four descriptions written",
  // and it is NOT reused here, for three independent reasons: it is not on the
  // module's public surface (which exposes create, buildCoreSentence,
  // CORE_FIELD_LABELS, SUCCESS_ANNOUNCEMENT, DESCRIPTION_PROMPT, DEFAULT_SOURCE
  // and nothing else); that file loads AFTER this one in tools.html; and its
  // range is 1..4 indexed by count-1 with no zero at all, because four fields
  // is its hard ceiling. A coverage count starts at zero and runs to the image
  // total. Two maps with different domains, not one map duplicated.
  //
  // Numbers as words zero to nine, digits from 10. Covered and total are
  // formatted INDEPENDENTLY, so "Zero of 11" and "10 of 12" are both correct;
  // a spoken sentence may open with a digit.
  const COVERAGE_CLAUSE_WORDS = Object.freeze([
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
  ]);

  // One template, five tokens, substituted in ONE pass (see the orchestrator's
  // fillTemplate note for why sequential replaces are avoided: a value that
  // happens to contain a later token would otherwise be rewritten).
  //
  // AGREEMENT, and the two rules are independent:
  //   - the NOUN is singular when the TOTAL is one   ("one image" / "11 images")
  //   - the VERBS are singular when the COVERED count is one, OR when the total
  //     is one — "One of 11 images has", but also "Zero of one image has"
  // Hence 0/11 takes plural verbs while 0/1 does not.
  const COVERAGE_CLAUSE_TEMPLATE =
    "{covered} of {total} {noun} {have} alt text or {are} marked decorative.";
  const COVERAGE_CLAUSE_TOKENS = /\{covered\}|\{total\}|\{noun\}|\{have\}|\{are\}/g;

  // The single space that joins a gesture's outcome sentence to the clause.
  // Named so the two call sites cannot drift to different separators.
  const COVERAGE_CLAUSE_JOINER = " ";

  // --- Parcel g-3: the add and replace outcome sentences ---
  // Named rather than left inline at the notify site because the FULL STOP is
  // load-bearing: the clause is joined with a single space, so a sentence that
  // loses its terminator produces "Image added to document Zero of 12 images…"
  // — one run-on sentence rather than two. A named const puts the terminator
  // somewhere a reader can see it belongs there.
  //
  // The replace line dropped its "successfully" on 6 August 2026: the adverb
  // adds nothing to a success line, and the clause after it is the part
  // carrying information. The retired wording still exists on ANOTHER LANE —
  // session-restorer-images.js announces the old adverbial form into
  // #radioSRannounce from swapImage() — which is out of scope for g-3 and
  // top-layer blocked while the manager modal is open. The inconsistency is
  // known and deliberate rather than missed.
  //
  // The retired string is deliberately NOT spelled out anywhere in this file,
  // so a marker count of it here is a true zero rather than a prose hit.
  const STATUS_ADD_TEXT = "Image added to document.";
  const STATUS_SWAP_TEXT = "Image replaced.";

  // --- Parcel g-4: the remove outcome sentence, and the stack-top wait ---
  // Same full-stop rule as the two above: the clause joins with a single
  // space, so the terminator is what keeps it two sentences.
  const STATUS_REMOVE_TEXT = "Image removed from document.";

  // The bounded wait that keeps remove's line out of the confirm dialog.
  // 600ms is three times the 200ms close animation it exists to outlast
  // (universal-modal.js close(): setTimeout(finishClose, 200) on the
  // no-preference branch), so an ordinary close clears it with room to spare
  // and only a genuinely stuck stack reaches the bound.
  const MODAL_TOP_WAIT_INTERVAL_MS = 50;
  const MODAL_TOP_WAIT_BOUND_MS = 600;

  // --- Parcel g-5: the re-orientation settle on remove's line ---------------
  // Remove is the ONLY gesture that opens a nested dialog, and it was the only
  // one nobody could hear. Being top of the stack again is not the same as the
  // screen reader having finished re-orienting to the dialog underneath: a
  // live-region write that lands during that re-orientation is DROPPED, with no
  // trace in the DOM or the accessibility tree — the host reads exposed, polite
  // and correctly populated either way.
  //
  // MEASURED 6 August 2026, three-cell run on the real product line, one write
  // per cell, differing only in delay:
  //     826 ms after Yes  -> SILENT
  //    1331 ms            -> spoken
  //    2376 ms            -> spoken
  // So the threshold sits inside (826, 1331] ms. 1000 ms puts the write at
  // ~1.8 s, roughly 500 ms clear of the latest known-silent point and between
  // two measured-heard points.
  //
  // Corroborated in the Speech Viewer transcript rather than inferred: the
  // silent cell made NVDA speak TWO context items after teardown ("Accessibility
  // tools document", then "dialog Manage Images") where each heard cell spoke
  // only one. The lost write is the one that arrived while the reader was still
  // working through the context change.
  //
  // ⚠ TUNED TO ONE READER, ONE MACHINE, ONE DATE — NVDA 2026.1 on DINING,
  // 6 August 2026, n=1 per cell. Other readers, versions and machines may sit
  // elsewhere in that bracket. RE-MEASURE before trusting this value elsewhere,
  // and do not treat a passing guard row as evidence about speech: the rows
  // assert the delay happened, which is not the same as anyone hearing it.
  //
  // The cost is deliberate and was Matthew's call (option 1, 6 August 2026):
  // _showStatus writes the visible line and the announcement in one call, so
  // the visible status is delayed by this much too. One write, one utterance —
  // preferred over writing twice and risking a double-speak.
  const REMOVE_ANNOUNCE_SETTLE_MS = 1000;

  // --- Parcel g-8: the settle on the LAST-IMAGE line ------------------------
  // A SEPARATE CONSTANT, DELIBERATELY. g-5's 1000 ms above was measured against
  // a dialog-to-dialog re-orientation with the manager still open. This branch
  // is a different event: the manager itself is torn down, focus is restored by
  // finishClose, and the reader re-orients across a landmark-scale change. Same
  // failure mode, different window — so the value is measured here rather than
  // borrowed, and retuning one must not silently retune the other.
  //
  // MEASURED 8 August 2026 (ear ladder g-8-pre), real NVDA 2026.1 with Speech
  // Viewer, "Automatic Say All on page load" OFF, real Remove and real confirm
  // Yes on the one-image fixture. The decisive pair differed only in the delay:
  //    ALPHA-2    0 ms, focus park held, no page read  -> SILENT
  //    BRAVO-2 1500 ms, focus park held, no page read  -> HEARD
  // BRAVO was heard in 3 of 3 runs, across both focus outcomes. The clean pair
  // is what isolates the settle: same focus result, same absence of a full-page
  // read, one variable moved.
  //
  // ⚠ ONE READER, ONE MACHINE, ONE DATE, and the lower bound is NOT bracketed —
  // nothing between 0 and 1500 ms was tested, so this is a value known to work
  // rather than a threshold. RE-MEASURE before trusting it elsewhere, and never
  // read a passing guard row as evidence that anybody heard anything: the rows
  // assert that the delay happened, which is a different claim.
  //
  // ACCEPTED TRADE-OFF (Matthew, 8 August 2026). The line and the toast travel
  // in ONE notifySuccess call by design — g-6 removed the two-call shape
  // precisely because a second call survived only on the announcer's
  // exact-string repeat suppression. So delaying the announcement delays the
  // visible toast by the same ~1.5 s. That is knowingly accepted: the grid has
  // already changed and the manager has already closed, so sighted users have
  // immediate feedback meanwhile, and splitting the call to recover 1.5 s of
  // toast latency would reintroduce the defect g-6 was built to remove.
  const LAST_IMAGE_ANNOUNCE_SETTLE_MS = 1500;

  /**
   * The count as a word ("zero".."nine"), or the digit from 10 up. Capitalised
   * only where the caller says so — covered opens the sentence, total does not.
   *
   * Never throws and never returns empty: this string is SPOKEN, and a line
   * that reads slightly wrong beats an exception inside the one sentence a
   * person gets. Anything outside 0..9 (including a negative or a non-integer
   * a future caller might hand it) falls back to the digit form.
   *
   * @param {number} n
   * @param {boolean} capitalise - true for the sentence-initial position.
   * @returns {string}
   */
  function coverageCountWord(n, capitalise) {
    const word = Number.isInteger(n) ? COVERAGE_CLAUSE_WORDS[n] : undefined;
    if (word === undefined) return String(n);
    return capitalise ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  }

  // --- Heading and subtitle ---
  // Static prefix in Chunk 2; Chunk 3 overwrites with "Edit alt text for {filename}".
  const EDIT_VIEW_HEADING_PREFIX = "Edit alt text";
  // Grid-region heading (visually-hidden) — focus fallback per Q8e step 3.
  const GRID_REGION_HEADING_TEXT = "Document images";

  // --- Count-element format (Q7) ---
  function formatCharacterCount(n) {
    return `${n} character${n === 1 ? "" : "s"}`;
  }

  // --- Toggletip lifecycle (Chunk 3a) ---
  // UniversalToggletip.create returns a string ID stashed on the instance
  // (this._captionToggletipId) and destroyed on manager close. Position +
  // type are passed into create() per Q1.
  const TOGGLETIP_POSITION = "bottom"; // Q1 — toggletip appears below the trigger
  const TOGGLETIP_TYPE = "info"; // Q1 — informational tone

  // --- Body class for scoped CSS (Phase D Fix 1) ---
  // UniversalModal renders at z-index 107974, and UniversalToggletip appends
  // to <body> with a default z-index of 10001. Toggletips spawned from inside
  // the manager modal therefore sit *behind* the modal in the body's
  // stacking context. We add this class to <body> while the manager is open
  // and use it as a scoping selector in mathpix-image-manager.css so the
  // toggletip override (z-index: 200000 !important) only fires while the
  // manager is on screen — toggletips elsewhere in the app are unaffected.
  // Matches the existing project convention (cf. "resume-focus-mode").
  const BODY_CLASS_MANAGER_OPEN = "mathpix-manager-open";

  // --- Q8e fallback chain selector (Chunk 3a; consumed by Chunks 3b / 4) ---
  // Scoped to the image manager's own modal wrapper so the lookup is
  // unambiguous if another UniversalModal happens to be open at the same
  // time. The wrapper class is applied at UniversalModal construction —
  // see open() below.
  const MODAL_TITLE_SELECTOR =
    ".image-manager-modal-wrapper .universal-modal-heading";

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Format file size in human-readable form
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size string
   */
  function formatFileSize(bytes) {
    if (bytes == null || bytes < 0) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get MIME type label
   * @param {string} mimeType - MIME type string
   * @returns {string} Short label (e.g. "JPEG")
   */
  function getMimeLabel(mimeType) {
    if (!mimeType) return "";
    const map = {
      "image/jpeg": "JPEG",
      "image/png": "PNG",
      "image/webp": "WebP",
    };
    return map[mimeType] || mimeType;
  }

  // ============================================================================
  // CLASS: MathPixImageManagerUI
  // ============================================================================

  class MathPixImageManagerUI {
    /**
     * @param {Object} restorer - MathPixSessionRestorer instance
     */
    constructor(restorer) {
      if (!restorer) {
        logError("Constructor requires a MathPixSessionRestorer instance");
        return;
      }

      /** @type {Object} Reference to the session restorer */
      this.restorer = restorer;

      /** @type {UniversalModal.Modal|null} Current modal instance */
      this.currentModal = null;

      /** @type {string|null} Pending action context for file input */
      this._pendingAction = null;

      /** @type {string|null} Image ID for pending swap action */
      this._pendingSwapId = null;

      /** @type {HTMLElement|null} Trigger button for focus return */
      this._triggerButton = null;

      /**
       * @type {string|null} Parcel g-4. A line deferred until the modal has
       * finished closing, spoken from the PAGE announcer rather than the modal
       * status host. Set only by the last-image remove; flushed and cleared in
       * onClose. Null at every other moment, so an ordinary close is silent.
       */
      this._pendingCloseAnnouncement = null;

      logInfo("MathPixImageManagerUI constructed");
    }

    // ========================================================================
    // MODAL LIFECYCLE
    // ========================================================================

    /**
     * Open the image manager modal.
     * Populates the grid from the registry.
     */
    open() {
      logInfo("Opening image manager modal");

      this._triggerButton = document.getElementById(MANAGE_IMAGES_BTN_ID);

      const content = this._buildModalContent();

      try {
        this.currentModal = new UniversalModal.Modal({
          title: "Manage Images",
          content: content,
          size: "fullscreen",
          className: "image-manager-modal-wrapper",
          closeOnOverlayClick: true,
          onClose: () => {
            // Chunk 4b — save-on-X is handled by _attachXButtonInterceptor,
            // a capture-phase click listener registered during open(). It
            // fires _performSave BEFORE UniversalModal's bubble-phase
            // listener tears the modal DOM down. onClose runs after
            // teardown, by which point _performSave's _readEditFieldValue
            // calls would read empty strings (Smoke Test 5 regression
            // from the Path-2 onClose fire-and-forget attempt).

            // Tear down toggletip and reset edit-view custody to grid
            // BEFORE returning focus. Reset is defensive — a next-open
            // should land on the grid view regardless of where the user
            // closed from (mode-switcher invariant: deterministic start).
            this._destroyToggletips();
            const editView = document.getElementById(EDIT_VIEW_CONTAINER_ID);
            const gridView = document.getElementById(GRID_VIEW_CONTAINER_ID);
            if (editView) editView.hidden = true;
            if (gridView) gridView.hidden = false;
            this._currentEditImageId = null;

            // Parcel g-1 (5 August 2026): nothing to restore on close. The
            // coverage counter is permanently non-live, so there is no
            // suppression lifecycle to unwind here.

            document.body.classList.remove(BODY_CLASS_MANAGER_OPEN);

            // Parcel g-4: speak anything deferred to close. This runs AFTER
            // the dialog element has left the DOM (onClose is invoked from a
            // .then() on modalManager.show(), whose promise finishClose
            // resolves last), so the page's own live region is no longer
            // blocked by the top layer. Before _returnFocus, so the
            // announcement is in the region ahead of the focus move.
            this._flushPendingCloseAnnouncement();

            this._returnFocus();
          },
        });

        this.currentModal.open();
        document.body.classList.add(BODY_CLASS_MANAGER_OPEN);

        // After modal opens: reconcile the registry against the current
        // MMD (Stage 6) before rendering the grid. The reconcile is a
        // per-user-open event (Q5 hard rule: never in refresh()). The
        // rAF callback is async so the cleanup loop can await
        // _removeCachedImage; refresh() runs after reconcile completes
        // so the grid renders the reconciled state on first paint.
        requestAnimationFrame(async () => {
          try {
            await this._reconcileOnOpen();
          } catch (err) {
            logError("Stage 6 reconcile-on-open failed:", err);
          }

          this.refresh();
          this._attachFileInputListener();
          this._attachXButtonInterceptor();
          this._setupToggletips();
          this._attachEditViewListeners();
          this._constructEditAltEmbed();
          this._constructEditAltRunPipeline();

          // Populate data-icon spans inserted by _buildModalContent (key row,
          // the edit view's Back / Generate / accept buttons) and by refresh()
          // above (cluster icons, Alt button pencil).
          //
          // populateIcons(scope) DOES take an optional scope and this file
          // already passes one elsewhere. It is called argument-less HERE on
          // purpose: the spans needing inflation are spread across the grid, the
          // toolbar key row and the edit view, so a document-wide pass is the
          // one call that covers them all. Re-population is idempotent.
          if (
            window.IconLibrary &&
            typeof window.IconLibrary.populateIcons === "function"
          ) {
            window.IconLibrary.populateIcons();
            logDebug("Populated icons after modal open");
          }
        });

        logDebug("Image manager modal opened");
      } catch (error) {
        logError("Failed to open modal:", error);
      }
    }

    /**
     * Close the image manager modal.
     * Returns focus to the trigger button.
     */
    close() {
      logInfo("Closing image manager modal");

      if (this.currentModal) {
        this.currentModal.close();
        this.currentModal = null;
      }

      this._returnFocus();
    }

    /**
     * Return focus to the trigger button
     * @private
     */
    _returnFocus() {
      if (
        this._triggerButton &&
        typeof this._triggerButton.focus === "function"
      ) {
        this._triggerButton.focus();
        logDebug("Focus returned to manage images button");
      }
      this._triggerButton = null;
    }

    // ========================================================================
    // STAGE 6: RECONCILE-ON-OPEN
    // ========================================================================

    /**
     * Reconcile the image registry against the current MMD before the
     * grid renders. Per Stage 6 planning Q5: fires once per
     * user-initiated open(), unconditionally; never appears in refresh()
     * or any other re-render path.
     *
     * Five-step sequence (Phase 2b URL-form fix):
     *
     *   A. Translate liveMMD blob URLs → CDN URLs using imageBlobUrlMap
     *      (reverse direction). Restored sessions hold blob URLs in the
     *      MMD but CDN URLs in the registry; IDs are hash(url + line),
     *      so passing the live MMD straight through to buildFromMMD
     *      would never match anything and would destroy every entry.
     *   B. registry.buildFromMMD(cdnMMD)
     *      Set-diff against the CDN-form MMD: preserves matched entries,
     *      adds new ones, removes entries whose IDs no longer appear in
     *      the MMD.
     *   C. _cleanupRemovedEntries(setDiff.removed)
     *      Per Q3 four-step ordering: resolve blob URL FIRST, then
     *      imageBlobUrlMap delete, then revoke, then Cache API removal.
     *   D. restorer.syncRegistryReferencesToBlobUrls()
     *      Step B refreshed matched entries' mmdReference to CDN-form;
     *      this restores blob-form so findImage and the rest of the
     *      live-editor pipeline keep working. Existing restorer helper
     *      (introduced for the initial restore flow) is idempotent.
     *   E. integrator.reconcileMMDIntoRegistry(liveMMD, registry, map)
     *      Field-content reverse-sync (Stage 3.B) against the LIVE
     *      (blob-form) MMD — findImage handles the CDN↔blob translation
     *      internally via Discovery 18.
     *
     * Defensive: when no restored session / no registry / empty MMD,
     * returns without throwing.
     *
     * @returns {Promise<void>}
     * @private
     */
    async _reconcileOnOpen() {
      let liveMMD = this.restorer?.restoredSession?.currentMMD ?? "";
      if (!liveMMD) {
        logDebug("_reconcileOnOpen: no current MMD, skipping");
        return;
      }

      const registry = this.restorer?.imageRegistry;
      if (!registry || typeof registry.buildFromMMD !== "function") {
        logWarn("_reconcileOnOpen: no registry available, skipping");
        return;
      }

      const blobMap = this.restorer?.imageBlobUrlMap || null;

      // Phase A: translate liveMMD (blob URLs) → CDN-form so buildFromMMD's
      // ID computation matches the registry's CDN-derived entries.
      // User-added images keep their blob URLs (no entry in blobMap) and
      // pass through unchanged — their registry originalUrl is the blob
      // URL itself, so the IDs match naturally.
      const cdnMMD = this._translateBlobUrlsToCdn(liveMMD, blobMap);

      // Phase B: set-diff (Stage 6 Q2/Q3) against the CDN-form MMD.
      const setDiff = registry.buildFromMMD(cdnMMD);
      logInfo(
        `_reconcileOnOpen: setDiff added=${setDiff.added.length} removed=${setDiff.removed.length}`,
      );

      // Phase C: per-entry external-state cleanup (Q3 four-step pattern).
      await this._cleanupRemovedEntries(setDiff.removed);

      // Phase D: repair matched entries' mmdReference. Phase B refreshed
      // mmdReference to CDN-form on every match; the live editor expects
      // blob-form. The restorer's existing helper iterates entries whose
      // originalUrl is keyed in imageBlobUrlMap and rewrites mmdReference
      // back to the blob form via syncMmdReferenceForRestore (Discovery 23
      // setter). Idempotent — entries already in blob form are a no-op.
      if (
        typeof this.restorer?.syncRegistryReferencesToBlobUrls === "function"
      ) {
        this.restorer.syncRegistryReferencesToBlobUrls();
      }

      // Lane C C-P3: manager-open generation host + pure-prose propagation.
      // Generate chemistry descriptions into the registry, propagate them into the
      // working MMD (alt slots + appendix) via the commit primitive, then refresh
      // liveMMD so the Phase E reconcile below reads the PROPAGATED content, not the
      // pre-propagation snapshot. Without the refresh, reconcile re-reads the
      // <smiles> slot and clobbers the prose, freezing it on the wrong value (F9).
      try {
        const chemWriter = window.MathPixChemistryRegistryWriter;
        if (chemWriter && typeof chemWriter.writeChemistryDescriptions === "function") {
          const pristineMmd =
            this.restorer?.restoredSession?.results?.mmd ||
            this.restorer?.restoredSession?.currentMMD ||
            "";
          const chemistryData =
            window.getMathPixController?.()?.resultRenderer?._chemistryData || [];
          // Chemistry phase 2, item A parcel 2: capture any OCR figure caption into an
          // empty registry title (stamped "original") before the chemistry writer runs,
          // so a real OCR caption seeds the title ahead of any synthesised one and
          // survives the manager-open serialise. CDN-form MMD, matching the writer's
          // alt-slot keying; findImage resolves entries via their CDN-form originalUrl.
          if (
            window.MathPixAltTextMMDSerialiser &&
            typeof window.MathPixAltTextMMDSerialiser.captureCaptionsIntoEmptyTitles ===
              "function"
          ) {
            window.MathPixAltTextMMDSerialiser.captureCaptionsIntoEmptyTitles(
              cdnMMD,
              registry,
            );
          }
          const chemResult = await chemWriter.writeChemistryDescriptions({
            registry,
            pristineMmd,
            workingMmd: cdnMMD, // was liveMMD — CDN-form so alt-slot keys match img.originalUrl on recovered sessions
            chemistryData,
          });
          const chemWrote = Array.isArray(chemResult?.results)
            ? chemResult.results.filter((r) => r.altWritten || r.longWritten || r.textWritten).length
            : 0;
          if (chemWrote > 0) {
            // Propagate registry → working MMD, then re-read the refreshed source.
            this._writeMMDFromRegistry(registry);
            liveMMD = this.restorer?.restoredSession?.currentMMD ?? liveMMD;
          }
          logInfo(
            `Lane C manager-open host: chemistry generated for ${chemResult?.total ?? 0} image(s), ${chemWrote} wrote a field`,
          );
        }
      } catch (chemErr) {
        logError("Lane C manager-open chemistry generation failed", chemErr);
      }

      // Phase E: field-content reverse-sync (Stage 3.B) against the LIVE
      // (blob-form) MMD. findImage threads through blobMap per Discovery 18.
      const integrator = window.MathPixAltTextIntegrator;
      if (
        integrator &&
        typeof integrator.reconcileMMDIntoRegistry === "function"
      ) {
        integrator.reconcileMMDIntoRegistry(liveMMD, registry, blobMap);
      } else {
        logWarn(
          "_reconcileOnOpen: MathPixAltTextIntegrator.reconcileMMDIntoRegistry not available",
        );
      }
    }

    /**
     * Translate blob URLs back to their CDN-URL form using imageBlobUrlMap.
     * The map is CDN→blob; this walks it and substitutes each blobUrl back
     * to its originalUrl in the MMD string. User-added images and any blob
     * URL not present in the map pass through unchanged.
     *
     * Sibling helpers carrying the same regex-escape vocabulary (see F-E in
     * pre-stage-7-discoveries-stage6-post-close-audit.md): session-restorer-images.js
     * proto._translateBlobUrlsToCdnForMMD and proto.getMMDForAPI Step 1. Drift
     * risk on the regex-escape pattern is real but small — fix one, fix all.
     *
     * @param {string} mmd - Live MMD content (may contain blob URLs)
     * @param {Map<string,string>|null} blobMap - imageBlobUrlMap (CDN→blob)
     * @returns {string} MMD with restorer-substituted blob URLs reversed
     * @private
     */
    _translateBlobUrlsToCdn(mmd, blobMap) {
      if (!mmd || !blobMap || blobMap.size === 0) return mmd;

      let result = mmd;
      for (const [cdnUrl, blobUrl] of blobMap) {
        if (!cdnUrl || !blobUrl) continue;
        // Escape regex metacharacters in the blob URL for a literal match.
        const escaped = blobUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp(escaped, "g"), cdnUrl);
      }
      return result;
    }

    /**
     * Per-entry cleanup for entries removed by buildFromMMD's set-diff.
     * Implements Q3's mandatory four-step ordering. Adapted from
     * deleteImage's cleanup block (session-restorer-images.js:1062-1091)
     * minus the user-initiated extras (no undo push, no auto-save, no
     * grid refresh — those belong to interactive delete, not reconcile).
     *
     * Step 1 MUST run before Step 2: the CDN-mapped lookup in Step 1
     * uses imageBlobUrlMap.get(entry.originalUrl), and Step 2 removes
     * that map entry. Flipping the order makes the lookup miss.
     *
     * _removeCachedImage is async; await it so memory-hygiene assertions
     * in runStage6Tests can observe the Cache API state post-cleanup.
     * Individual entry failures are caught and logged (do not abort
     * the whole loop) — matches deleteImage's fire-and-forget posture
     * for the Cache API call itself.
     *
     * @param {Object[]} removedClones - Entry clones from setDiff.removed
     * @returns {Promise<void>}
     * @private
     */
    async _cleanupRemovedEntries(removedClones) {
      if (!Array.isArray(removedClones) || removedClones.length === 0) return;

      const imageBlobUrlMap = this.restorer?.imageBlobUrlMap || null;
      const imageFilenameMap = this.restorer?.imageFilenameMap || {};

      for (const entry of removedClones) {
        try {
          // Step 1: Resolve blobUrl FIRST. Different lookup depending on
          // entry source — user-upload / user-added entries carry the
          // blob URL directly in originalUrl; OCR entries store CDN URLs
          // and need translation via imageBlobUrlMap.
          const isUserAdded =
            entry.source === "user-upload" || entry.status === "user-added";
          const blobUrl = isUserAdded
            ? entry.originalUrl
            : imageBlobUrlMap?.get(entry.originalUrl);

          // Step 2: Remove from imageBlobUrlMap (CDN-mapped entries only).
          // User-upload entries never had a map entry, so skip.
          if (
            !isUserAdded &&
            entry.originalUrl &&
            imageBlobUrlMap &&
            imageBlobUrlMap.has(entry.originalUrl)
          ) {
            imageBlobUrlMap.delete(entry.originalUrl);
          }

          // Step 3: Revoke the blob URL — guard against revoking CDN URLs.
          if (
            blobUrl &&
            typeof blobUrl === "string" &&
            blobUrl.startsWith("blob:")
          ) {
            URL.revokeObjectURL(blobUrl);
          }

          // Step 4: Remove from Cache API. Filename is the secondary
          // key; null is safe if the filename map has no record.
          const filename = imageFilenameMap?.[entry.id]?.filename || null;
          if (typeof this.restorer?._removeCachedImage === "function") {
            await this.restorer._removeCachedImage(entry.id, filename);
          }
        } catch (err) {
          logWarn(
            `_cleanupRemovedEntries: error cleaning up entry ${entry?.id}:`,
            err,
          );
        }
      }

      logInfo(
        `_cleanupRemovedEntries: completed for ${removedClones.length} entries`,
      );
    }

    // ========================================================================
    // CONTENT BUILDING
    // ========================================================================

    /**
     * Build the inner HTML content for the modal body.
     * The toolbar and grid container are static; cards are populated by refresh().
     * @returns {string} HTML string
     * @private
     */
    _buildModalContent() {
      return `
        <section id="${GRID_VIEW_CONTAINER_ID}"
                 class="mmd-image-manager-grid-view"
                 aria-labelledby="${GRID_REGION_HEADING_ID}">
          <h2 id="${GRID_REGION_HEADING_ID}" class="visually-hidden">${GRID_REGION_HEADING_TEXT}</h2>

          <div class="mmd-image-manager-icon-key" role="group" aria-label="Icon key">
            <span class="mmd-image-manager-icon-key-item">
              <span data-icon="${BADGE_ICONS.caption}" aria-hidden="true"></span>Caption
            </span>
            <span class="mmd-image-manager-icon-key-item">
              <span data-icon="${BADGE_ICONS.alt}" aria-hidden="true"></span>Alt text
            </span>
            <span class="mmd-image-manager-icon-key-item">
              <span data-icon="${BADGE_ICONS.longDesc}" aria-hidden="true"></span>Long description
            </span>
            <span class="mmd-image-manager-icon-key-item">
              <span data-icon="${BADGE_ICONS.decorative}" aria-hidden="true"></span><span>${KEY_DECORATIVE_WORDING}</span>
            </span>
            <span class="mmd-image-manager-icon-key-item">
              <span data-icon="warning" aria-hidden="true"></span>Needs attention
            </span>
          </div>

          <div class="image-manager-toolbar">
            <button
              type="button"
              id="image-manager-add-btn"
              class="image-manager-action-btn"
              onclick="addImageToDocument()"
            >
              <span aria-hidden="true" data-icon="plus"></span>
              Add Image
            </button>
            <!-- Parcel BG-P2 — Describe All. Visible text, never an icon-only
                 control, so its accessible name comes from its contents; the
                 blocked reason is appended there as a visually-hidden span,
                 exactly as the edit view's Generate button does (g-10). -->
            <button
              type="button"
              id="${BATCH_DESCRIBE_ALL_BTN_ID}"
              class="image-manager-action-btn"
              onclick="describeAllImages()"
            >
              <span aria-hidden="true" data-icon="aiSparkle"></span>
              ${BATCH_DESCRIBE_ALL_LABEL}
            </button>
            <!-- Parcel g-1 (5 August 2026): BOTH toolbar readouts are
                 permanently VISUAL. Neither carries aria-live, role="status"
                 or any other live semantics — the composed gesture lines
                 (parcels g-2 onward) carry the count in words, so a live
                 region here would only repeat what a sentence already said.
                 Their text still updates on every registry change; that is
                 what they are for. Do not re-add aria-live. -->
            <span id="image-manager-count" class="image-manager-count"></span>
            <span class="mmd-image-manager-coverage-counter"
                  id="mmd-image-manager-coverage-counter"
                  aria-describedby="mmd-image-manager-coverage-counter-description"></span>
            <span class="visually-hidden"
                  id="mmd-image-manager-coverage-counter-description">${COUNTER_DESCRIPTION}</span>
          </div>

          <ul
            id="image-manager-grid"
            class="image-manager-grid"
            aria-label="Document images"
          >
          </ul>

          <p id="image-manager-empty" class="image-manager-empty" hidden>
            No images in this document.
          </p>

          <input type="file" id="image-manager-file-input" accept="image/jpeg,image/png,image/webp" hidden />
        </section>

        ${this._buildEditAltViewHTML()}
      `;
    }

    /**
     * Build an image card HTML string from a registry entry.
     * @param {Object} entry - Image registry entry
     * @param {number} index - 0-based index
     * @param {number} total - Total image count
     * @returns {string} HTML string
     * @private
     */
    _buildImageCard(entry, index, total) {
      const imgSrc = this._getImageSrc(entry);
      const sizeLabel = formatFileSize(entry.fileSize);
      const mimeLabel = getMimeLabel(entry.mimeType);
      const sizeDisplay = [sizeLabel, mimeLabel].filter(Boolean).join(" · ");
      const statusLabel =
        STATUS_LABELS[entry.status] || entry.status || "Unknown";
      const safeId = this._escapeAttr(entry.id);
      const idAttr = `image-card-label-${safeId}`;

      // Stage 4 — metadata cluster: caption / alt / longDesc state
      const status = MathPixImageRegistry.getMetadataStatus(entry);
      const clusterHTML = this._buildMetadataClusterHTML(status);

      // Build meaningful alt text: prefer user/OCR alt text, fall back to identifiable description
      const altText = entry.altText
        ? `Image ${index + 1} of ${total}: ${entry.altText}`
        : `Image ${index + 1} of ${total} (${safeId}, ${sizeDisplay})`;

      // Look up friendly filename from the ZIP's filenameMap (if available)
      const filenameMap = this.restorer.imageFilenameMap || {};
      const mapEntry = filenameMap[entry.id];
      let friendlyName = mapEntry?.filename || null;

      // If the image was replaced by the user, show the replacement filename
      // instead of the stale ZIP filename (which refers to the original OCR image)
      if (entry.status === "user-replaced" && mapEntry?.replacedWithFilename) {
        friendlyName = mapEntry.replacedWithFilename;
      }

      // Group label for screen readers — used by aria-labelledby on the card
      // and to give context to the Replace/Remove buttons within it
      const displayName = friendlyName || safeId;

      // Stage 4 — per-card Alt button placeholder (Stage 5 wiring point).
      // Built here (not earlier) so displayName is in scope for its aria-label.
      const altButtonHTML = this._buildAltButtonHTML(
        safeId,
        entry.id,
        status,
        displayName,
      );

      const groupLabel = entry.altText
        ? `${entry.altText} — ${sizeDisplay}`
        : `${displayName} — ${sizeDisplay}`;

      return `
        <li class="image-manager-card"
            data-image-id="${safeId}"
            data-alt-text-source="${this._escapeAttr(entry.altTextSource || "")}"
            data-long-description-source="${this._escapeAttr(entry.longDescriptionSource || "")}"
            data-title-source="${this._escapeAttr(entry.titleSource || "")}"
            data-text-in-image-source="${this._escapeAttr(entry.textInImageSource || "")}">
          ${clusterHTML}
          <div role="group" aria-labelledby="${idAttr}">
          <div class="image-manager-thumbnail">
${
  imgSrc
    ? `<img src="${this._escapeAttr(imgSrc)}" alt="${this._escapeAttr(altText)}" loading="lazy" data-image-id="${safeId}" onerror="_handleThumbnailError(this)" />`
    : `<span class="image-manager-no-preview">No preview available</span>`
}
          </div>
          <dl class="image-manager-meta">
<dt class="visually-hidden">Image name</dt>
            <dd class="image-manager-id" id="${idAttr}">${this._escapeHTML(friendlyName || entry.id)}</dd>
            <dt class="visually-hidden">File details</dt>
            <dd class="image-manager-size">${this._escapeHTML(sizeDisplay)}</dd>
            <dt class="visually-hidden">Status</dt>
            <dd class="image-manager-status" data-status="${this._escapeAttr(entry.status)}">${this._escapeHTML(statusLabel)}</dd>
          </dl>
          <div class="image-manager-actions">
            <button type="button" class="image-manager-btn image-manager-swap-btn"
                    onclick="swapImage('${escapeForOnclick(entry.id)}')"
aria-label="Replace image ${this._escapeAttr(displayName)}">
              <span aria-hidden="true" data-icon="refresh"></span> Replace
            </button>
            <button type="button" class="image-manager-btn image-manager-delete-btn"
                    onclick="deleteImage('${escapeForOnclick(entry.id)}')"
aria-label="Remove image ${this._escapeAttr(displayName)}">
              <span aria-hidden="true" data-icon="trash"></span> Remove
            </button>
            ${altButtonHTML}
</div>
          </div>
        </li>
      `;
    }

    /**
     * Build the Stage 4 metadata cluster HTML for one card.
     *
     * Cluster wrapper is always emitted (role="group" stays stable per Q1)
     * even when no icons are inside it. Slots use show-vs-don't-show
     * rendering — no reserved positions. Decorative override collapses
     * both alt and long-description slots to the eyeOff icon.
     *
     * @param {{hasCaption: boolean, altState: string, longDescState: string}} status
     * @returns {string} HTML string
     * @private
     */
    _buildMetadataClusterHTML(status) {
      // Decorative === true sets BOTH altState and longDescState to
      // "decorative" together (getMetadataStatus contract). Treat them
      // as a single dimension here so the cluster does not render two
      // identical eyeOff icons, and so the aria-label does not duplicate
      // the "(decorative)" phrase. Matches the icon-key wording at the
      // top of the modal: "Decorative — alt and long description
      // skipped".
      const isDecorative = status.altState === "decorative";

      const captionPart = status.hasCaption ? "Caption set" : "Caption missing";

      let altLongPart;
      if (isDecorative) {
        altLongPart = "alt text and long description skipped (decorative)";
      } else {
        const altPart =
          status.altState === "has-alt" ? "alt text set" : "alt text missing";
        const longDescPart =
          status.longDescState === "has-longdesc"
            ? "long description set"
            : "long description missing";
        altLongPart = `${altPart}, ${longDescPart}`;
      }

      const ariaLabel = `Accessibility metadata: ${captionPart}, ${altLongPart}`;

      const slots = [];

      if (status.hasCaption) {
        slots.push(
          `<span class="mmd-image-manager-metadata-slot" data-icon="${BADGE_ICONS.caption}" aria-hidden="true"></span>`,
        );
      }

      if (isDecorative) {
        // Single decorative slot represents both alt and long-description
        // being skipped — the user-facing wording above keeps the audio
        // surface aligned with the visual surface.
        slots.push(
          `<span class="mmd-image-manager-metadata-slot" data-icon="${BADGE_ICONS.decorative}" aria-hidden="true"></span>`,
        );
      } else {
        if (status.altState === "has-alt") {
          slots.push(
            `<span class="mmd-image-manager-metadata-slot" data-icon="${BADGE_ICONS.alt}" aria-hidden="true"></span>`,
          );
        }
        if (status.longDescState === "has-longdesc") {
          slots.push(
            `<span class="mmd-image-manager-metadata-slot" data-icon="${BADGE_ICONS.longDesc}" aria-hidden="true"></span>`,
          );
        }
      }

      return `<div class="mmd-image-manager-metadata-cluster" role="group" aria-label="${this._escapeAttr(ariaLabel)}">${slots.join("")}</div>`;
    }

    /**
     * Assemble the Alt button's accessible name for one state.
     *
     * Returns the RAW, unescaped string. Escaping is the caller's job, because
     * it differs by surface: the HTML emission path runs it through
     * _escapeAttr, while setAttribute("aria-label", …) takes the raw string and
     * escaping it there would put literal entities into the spoken name.
     *
     * @param {string} displayName - Image name as shown on the card.
     * @param {boolean} needsAttention - True when the image has no alt text.
     * @returns {string} Unescaped accessible name.
     * @private
     */
    _altButtonAriaLabel(displayName, needsAttention) {
      return (
        ALT_BTN_LABEL_PREFIX +
        displayName +
        (needsAttention ? ALT_BTN_NEEDS_ATTENTION_LABEL_SUFFIX : "")
      );
    }

    /**
     * Build the Stage 4 per-card Alt button placeholder HTML.
     *
     * Stage 5 wiring point: this button will open the alt-text edit sub-view.
     * The Stage 5 implementation will call:
     *   - MathPixAltTextIntegrator.applyRegistryToMMD(mmd, registry) on save
     *   - MathPixAltTextIntegrator.reconcileMMDIntoRegistry(mmd, registry) on open
     * See mathpix-alt-text-integrator.js for the canonical save / open hooks.
     *
     * Variant follows altState: primary (needs attention) when alt missing,
     * secondary (addressed) when alt set or decorative. Visible "Alt" text
     * always present alongside the pencil icon.
     *
     * @param {string} safeId - Image ID escaped for HTML attribute context
     *   (via _escapeAttr). Used for data-image-id and aria-label.
     * @param {string} rawId - Raw image ID. Passed through escapeForOnclick
     *   for the inline onclick handler, which has its own escape requirements
     *   (HTML + JS double-surface) distinct from plain HTML-attribute escaping.
     * @param {{altState: string}} status - Metadata status
     * @returns {string} HTML string
     * @private
     */
    _buildAltButtonHTML(safeId, rawId, status, displayName) {
      const needsAttention = status.altState === "no-alt";
      // THREE signals now, all gated by `needsAttention` above so they cannot
      // drift apart:
      //   1. The aria-label suffix (below, via _altButtonAriaLabel): THE ONE
      //      ASSISTIVE TECHNOLOGY READS. The button has an aria-label, which
      //      overrides its contents, so neither of the other two reaches a
      //      screen reader user at all — signals 2 and 3 are visual only.
      //   2. --needs-attention modifier on the button: testable contract
      //      Stage 5 Cases 11A/11B/11C bind to (classList.contains).
      //   3. Warning icon appended inside the button (below): the
      //      user-visible cue. Positioned by .image-manager-alt-btn-warning;
      //      populateIcons() inflates the data-icon span after refresh.
      // If any signal is removed in future, update the others and the
      // Stage 5 tests together — the coupling is unchanged. What HAS changed
      // (8c-v-c) is where the names live: both class names come from the
      // module constants below, so a RENAME is a one-place edit here and in
      // _refreshCardAltButton. The Stage 5 tests still bind to the modifier
      // class by literal, so a rename touches them too.
      const variantClass = needsAttention
        ? `image-manager-btn image-manager-alt-btn ${ALT_BTN_NEEDS_ATTENTION_CLASS}`
        : "image-manager-btn image-manager-alt-btn";
      const warningIcon = needsAttention
        ? ` <span aria-hidden="true" data-icon="warning" class="${ALT_BTN_WARNING_CLASS}"></span>`
        : "";
      return `<button type="button" class="${variantClass}"
                    data-action="alt"
                    data-image-id="${safeId}"
                    onclick="openEditAltText('${escapeForOnclick(rawId)}')"
                    aria-label="${this._escapeAttr(this._altButtonAriaLabel(displayName, needsAttention))}">
              <span aria-hidden="true" data-icon="pencil"></span> Alt${warningIcon}
            </button>`;
    }

    /**
     * Build the Stage 5 Edit Alt Text view HTML.
     *
     * Pure DOM shell — no event handlers wired here. Chunk 3 attaches
     * handlers to the elements via the IDs in FIELD_IDS and
     * EDIT_VIEW_*_ID constants.
     *
     * The section is initially hidden via the `hidden` attribute. The
     * grid view (its sibling) is the default visible view. Chunk 3
     * toggles between them via openEditAltText() / Back-button closures.
     *
     * Semantic HTML throughout per the Stage 5 planning principle:
     *   <section> wraps the view; <header> contains Back + titles;
     *   <figure> wraps the image preview; <form> wraps the fields;
     *   <label for> ties labels to inputs; <p class="field-help"> for
     *   help; <small class="field-count"> for character counts;
     *   <footer> inside the form holds the Save button (Phase B B5
     *   Option A — natural DOM order matches Q8d tab order);
     *   <div role="status"> is the Q6d exception for the legacy banner.
     *
     * Caption toggletip trigger is a bare button shell. UniversalToggletip
     * is wired imperatively in Chunk 3 — no data-attribute auto-init.
     *
     * @returns {string} HTML string
     * @private
     */
    _buildEditAltViewHTML() {
      return `
        <section id="${EDIT_VIEW_CONTAINER_ID}"
                 class="mmd-image-manager-edit-view"
                 aria-labelledby="${EDIT_VIEW_HEADING_ID}"
                 hidden>
          <header class="mmd-image-manager-edit-view-header">
            <button type="button"
                    id="${EDIT_VIEW_BACK_BTN_ID}"
                    class="image-manager-btn mmd-image-manager-edit-back-btn">
              <span aria-hidden="true" data-icon="arrowLeft"></span> ${BACK_BUTTON_LABEL}
            </button>
            <div class="mmd-image-manager-edit-view-titles">
              <h2 id="${EDIT_VIEW_HEADING_ID}" tabindex="-1">${EDIT_VIEW_HEADING_PREFIX}</h2>
              <p id="${EDIT_VIEW_SUBTITLE_ID}" class="mmd-image-manager-edit-view-subtitle"></p>
            </div>
          </header>

          <div id="${EDIT_VIEW_BANNER_ID}"
               class="mmd-image-manager-edit-banner"
               role="status"
               aria-live="polite"
               hidden>${LEGACY_CONFLICT_BANNER_TEXT}</div>

          <div class="mmd-image-manager-edit-body">
            <figure class="mmd-image-manager-edit-preview">
              <img id="${EDIT_VIEW_PREVIEW_IMG_ID}" src="" alt="" />
              <figcaption id="${EDIT_VIEW_PREVIEW_CAPTION_ID}"></figcaption>
            </figure>

            <form id="${EDIT_VIEW_FORM_ID}" class="mmd-image-manager-edit-form">

              <!--
                AI-run block. Parcel 7 adds the Generate control alongside the
                status region, so both live in this one container. The region is
                rendered present and EMPTY, with no hidden attribute, so it can
                be watched while empty — a region that only appears at write time
                is not reliably announced. It also sits outside any
                .imgdesc-output-section ancestor, whose :empty { display: none }
                rule would drop it out of the tree while empty.
              -->
              <div id="${EDIT_VIEW_AI_RUN_ID}" class="mmd-image-manager-ai-run">
                <!--
                  Cycle 2b — the button opens OPERABLE. aria-disabled (never the
                  disabled property) carries the running state, so focus stays on
                  the button across a run; _editAltGenerating is the real guard.
                -->
                <button type="button"
                        id="${EDIT_VIEW_GENERATE_BTN_ID}"
                        class="image-manager-btn mmd-image-manager-edit-generate-btn"
                        aria-disabled="false">
                  <span aria-hidden="true" data-icon="aiSparkle"></span> ${GENERATE_BUTTON_LABEL}
                </button>
                <!--
                  8d-pre — the running indication. Starts hidden; showProgress()
                  reveals it and hideProgress() hides it again, which the
                  orchestrator calls on all three of its paths (success, contract
                  error, thrown), so no path can strand it visible.

                  Deliberately carries NO aria-live, no role="status" and no
                  role="progressbar": #edit-alt-ai-status below stays the single
                  live region inside this wrapper.

                  There is deliberately NO progress bar and NO
                  .imgdesc-progress-fill. PREPARING and GENERATING fire back to
                  back with no await between them, so a bar would jump straight
                  to 85% and stall there for the whole run — worse than no bar.
                  Omitting it also makes the reduced-motion specificity trap
                  structurally impossible rather than merely guarded. The
                  module's bar refs are direct property reads behind an if
                  guard, not ref() lookups, so their absence is silent and safe.
                -->
                <div id="${EDIT_VIEW_AI_PROGRESS_ID}"
                     class="imgdesc-progress"
                     hidden>
                  <div class="imgdesc-progress-info">
                    <span id="${EDIT_VIEW_AI_PROGRESS_SPINNER_ID}"
                          class="mmd-image-manager-ai-spinner"
                          aria-hidden="true"></span>
                    <span id="${EDIT_VIEW_AI_PROGRESS_STAGE_ID}"
                          class="imgdesc-progress-stage"></span>
                    <span id="${EDIT_VIEW_AI_PROGRESS_TIME_ID}"
                          class="imgdesc-progress-time"></span>
                  </div>
                </div>
                <div id="${EDIT_VIEW_AI_STATUS_ID}"
                     class="imgdesc-status"
                     role="status"
                     aria-live="polite"
                     aria-atomic="true"></div>
              </div>

              <div class="field-group">
                <div class="field-label-row">
                  <span class="field-heading">
                    <label for="${FIELD_IDS.caption.input}">${FIELD_LABELS.caption}</label>
                    <button type="button"
                            id="${FIELD_IDS.caption.toggletip}"
                            aria-label="More about captions">
                      ${getIcon("infoCircle")}
                    </button>
                  </span>
                  <small id="${FIELD_IDS.caption.provenance}" class="field-provenance" data-provenance="">
                    <span class="field-provenance-text" aria-hidden="true"></span>
                    <span class="field-provenance-sr visually-hidden"></span>
                  </small>
                  <!--
                    Parcel 8e-2 — accept control. Emitted UNCONDITIONALLY and
                    starting hidden, matching the disable hint, the legacy banner
                    and the progress block. It CANNOT be emitted conditionally:
                    this builder takes no entry and its output is shared by every
                    image in the document, so there is nothing here to test.
                    _refreshAcceptControls(entry) is the sole writer of hidden,
                    aria-disabled and the visible text; the activation handler is
                    the only other writer, and only of the latter two.
                  -->
                  <button type="button"
                          id="${FIELD_IDS.caption.accept}"
                          class="image-manager-btn mmd-image-manager-accept-btn"
                          aria-disabled="false"
                          hidden>
                    <span aria-hidden="true" data-icon="${ACCEPT_BUTTON_ICON}"></span> ${composeAcceptText(ACCEPT_BUTTON_RESTING_TEMPLATE, "caption")}
                  </button>
                </div>
                <!--
                  Caption input's aria-describedby intentionally omits
                  FIELD_IDS.caption.hint. NVDA reads aria-describedby
                  references into hidden elements (HTML5 spec says hidden
                  should remove from accessibility tree, but AT support
                  varies). Chunk 3 toggles BOTH the hint paragraph's
                  hidden attribute AND the input's aria-describedby
                  list — adds the hint ID when showing, removes when
                  hiding.
                -->
                <input type="text"
                       id="${FIELD_IDS.caption.input}"
                       aria-describedby="${FIELD_IDS.caption.help} ${FIELD_IDS.caption.count} ${FIELD_IDS.caption.provenance}" />
                <p id="${FIELD_IDS.caption.help}" class="field-help">${FIELD_HELP_TEXT.caption}</p>
                <small id="${FIELD_IDS.caption.count}" class="field-count">${formatCharacterCount(0)}</small>
                <p id="${FIELD_IDS.caption.hint}" class="field-hint" hidden>${INCLUDEGRAPHICS_CLEAR_HINT}</p>
              </div>

              <p id="${EDIT_VIEW_DISABLE_HINT_ID}" class="field-hint field-hint--disable" hidden>${DISABLE_HINT}</p>

              <div id="${EDIT_VIEW_DECORATIVE_ANNOUNCE_ID}"
                   class="visually-hidden"
                   role="status"
                   aria-live="polite"></div>

              <div class="field-group">
                <div class="field-label-row">
                  <span class="field-heading">
                    <label for="${FIELD_IDS.altText.input}">${FIELD_LABELS.altText}</label>
                  </span>
                  <small id="${FIELD_IDS.altText.provenance}" class="field-provenance" data-provenance="">
                    <span class="field-provenance-text" aria-hidden="true"></span>
                    <span class="field-provenance-sr visually-hidden"></span>
                  </small>
                  <!-- Parcel 8e-2 accept control — see the caption block above. -->
                  <button type="button"
                          id="${FIELD_IDS.altText.accept}"
                          class="image-manager-btn mmd-image-manager-accept-btn"
                          aria-disabled="false"
                          hidden>
                    <span aria-hidden="true" data-icon="${ACCEPT_BUTTON_ICON}"></span> ${composeAcceptText(ACCEPT_BUTTON_RESTING_TEMPLATE, "altText")}
                  </button>
                </div>
                <textarea id="${FIELD_IDS.altText.input}"
                          rows="3"
                          aria-describedby="${FIELD_IDS.altText.help} ${FIELD_IDS.altText.count} ${FIELD_IDS.altText.provenance}"></textarea>
                <p id="${FIELD_IDS.altText.help}" class="field-help">${FIELD_HELP_TEXT.altText}</p>
                <small id="${FIELD_IDS.altText.count}" class="field-count">${formatCharacterCount(0)}</small>
              </div>

              <div class="field-group">
                <div class="field-label-row">
                  <span class="field-heading">
                    <label for="${FIELD_IDS.longDescription.input}">${FIELD_LABELS.longDescription}</label>
                  </span>
                  <small id="${FIELD_IDS.longDescription.provenance}" class="field-provenance" data-provenance="">
                    <span class="field-provenance-text" aria-hidden="true"></span>
                    <span class="field-provenance-sr visually-hidden"></span>
                  </small>
                  <!-- Parcel 8e-2 accept control — see the caption block above. -->
                  <button type="button"
                          id="${FIELD_IDS.longDescription.accept}"
                          class="image-manager-btn mmd-image-manager-accept-btn"
                          aria-disabled="false"
                          hidden>
                    <span aria-hidden="true" data-icon="${ACCEPT_BUTTON_ICON}"></span> ${composeAcceptText(ACCEPT_BUTTON_RESTING_TEMPLATE, "longDescription")}
                  </button>
                </div>
                <textarea id="${FIELD_IDS.longDescription.input}"
                          rows="5"
                          aria-describedby="${FIELD_IDS.longDescription.help} ${FIELD_IDS.longDescription.count} ${FIELD_IDS.longDescription.provenance}"></textarea>
                <p id="${FIELD_IDS.longDescription.help}" class="field-help">${FIELD_HELP_TEXT.longDescription}</p>
                <small id="${FIELD_IDS.longDescription.count}" class="field-count">${formatCharacterCount(0)}</small>
              </div>

              <div class="field-group">
                <div class="field-label-row">
                  <span class="field-heading">
                    <label for="${FIELD_IDS.textInImage.input}">${FIELD_LABELS.textInImage}</label>
                  </span>
                  <small id="${FIELD_IDS.textInImage.provenance}" class="field-provenance" data-provenance="">
                    <span class="field-provenance-text" aria-hidden="true"></span>
                    <span class="field-provenance-sr visually-hidden"></span>
                  </small>
                  <!-- Parcel 8e-2 accept control — see the caption block above. -->
                  <button type="button"
                          id="${FIELD_IDS.textInImage.accept}"
                          class="image-manager-btn mmd-image-manager-accept-btn"
                          aria-disabled="false"
                          hidden>
                    <span aria-hidden="true" data-icon="${ACCEPT_BUTTON_ICON}"></span> ${composeAcceptText(ACCEPT_BUTTON_RESTING_TEMPLATE, "textInImage")}
                  </button>
                </div>
                <input type="text"
                       id="${FIELD_IDS.textInImage.input}"
                       aria-describedby="${FIELD_IDS.textInImage.help} ${FIELD_IDS.textInImage.count} ${FIELD_IDS.textInImage.provenance}" />
                <p id="${FIELD_IDS.textInImage.help}" class="field-help">${FIELD_HELP_TEXT.textInImage}</p>
                <small id="${FIELD_IDS.textInImage.count}" class="field-count">${formatCharacterCount(0)}</small>
              </div>

              <div class="field-group field-group--checkbox">
                <input type="checkbox" id="${FIELD_IDS.decorative.input}" />
                <label for="${FIELD_IDS.decorative.input}">${FIELD_LABELS.decorative}</label>
              </div>

              <footer class="mmd-image-manager-edit-form-footer">
                <button type="button"
                        id="${EDIT_VIEW_SAVE_BTN_ID}"
                        class="image-manager-btn mmd-image-manager-edit-save-btn">
                  ${SAVE_BUTTON_LABEL}
                </button>
              </footer>

            </form>

            <!--
              OpenRouterEmbed render sink. The hidden attribute is required,
              not merely tidy: it gives display:none, which removes the
              container from the accessibility tree and makes the focus() call
              the embed's injectContent performs mid-stream a no-op, so the
              modal's focus trap survives a run. .visually-hidden would leave
              it focusable and in the tree; aria-hidden alone would not stop
              focus. Its own unique ID, and no shared status class — the
              announcement channel is the region above, not this element.
            -->
            <div id="${EDIT_VIEW_AI_EMBED_SINK_ID}" hidden></div>
          </div>
        </section>
      `;
    }

    // ========================================================================
    // STAGE 5 CHUNK 3a — EDIT VIEW LIFECYCLE
    //
    // Opening, closing, focus on open, toggletip wiring. No in-form
    // reactivity yet (Chunk 3b). No save flow yet (Chunk 4).
    // ========================================================================

    /**
     * Open the Edit Alt Text view for the given image. Populates form
     * fields from the registry entry, swaps grid view for edit view,
     * focuses the heading per Q8a.
     *
     * Replaces Stage 4's placeholder altPlaceholderClick handler.
     *
     * Chunk 3a wires opening + initial render only. Reactivity (decorative
     * disable, character count updates, dirty tracking, banner) lands in 3b.
     * Save flow lands in Chunk 4.
     *
     * @param {string} imageId - Registry image ID to edit.
     * @public
     */
    openEditAltText(imageId) {
      logInfo(`openEditAltText(${imageId})`);

      // 1. Fetch registry entry. Warn + return if missing.
      const registry = this.restorer.imageRegistry;
      if (!registry) {
        logWarn("openEditAltText: no registry on restorer");
        return;
      }
      const entry = registry.getImage(imageId);
      if (!entry) {
        logWarn(`openEditAltText: image ID "${imageId}" not found in registry`);
        return;
      }

      // 2. Resolve filename (replacement-aware per Q1 / B1).
      const filenameMap = this.restorer.imageFilenameMap || {};
      const mapEntry = filenameMap[entry.id];
      let friendlyName = mapEntry?.filename || null;
      if (entry.status === "user-replaced" && mapEntry?.replacedWithFilename) {
        friendlyName = mapEntry.replacedWithFilename;
      }
      logDebug(
        `openEditAltText: resolved filename "${friendlyName}" (status=${entry.status})`,
      );

      // 3. Populate form fields from the registry snapshot. The open path and
      // the post-run refresh now share ONE population site: the inputs and their
      // character counts go through _repopulateEditAltInputs and the provenance
      // pills through _refreshFieldProvenance, so the two paths can no longer
      // drift (the tier-consistency hazard this dedupe removes). The decorative
      // checkbox is set here directly because neither helper owns it. The form
      // reads from the snapshot at open time; persistence on Save (Chunk 4) goes
      // through registry update* methods, not by mutating this entry clone.
      this._repopulateEditAltInputs(entry);

      const decorativeInput = document.getElementById(
        FIELD_IDS.decorative.input,
      );
      if (decorativeInput) decorativeInput.checked = Boolean(entry.decorative);

      this._refreshFieldProvenance(entry);
      // Parcel 8e-2. Must run on EVERY open, not only where something is
      // acceptable: the accept buttons live in DOM shared by every image, so
      // this call is what clears the previous image's accepted state.
      this._refreshAcceptControls(entry);
      // Parcel g-10. Same reason as the line above, for the Generate button:
      // this call is what clears a DIFFERENT image's running state off a
      // control shared by every image. Placed with the other resets and before
      // the preview, so the view is never painted carrying stale state.
      // imageId, NOT this._currentEditImageId — that field is not assigned
      // until step 8 below, and reading it here compared the incoming image
      // against the previous one (see the method's own note).
      this._refreshGenerateControl(imageId);
      // BG-P2 — the Describe All control moves in step with Generate, so the
      // two mutual-exclusion directions can never disagree about the state.
      this._refreshDescribeAllControl();

      // 4. Populate <img> preview from _getImageSrc(). When null, hide
      // the <figure> so the body collapses cleanly rather than showing a
      // broken image.
      const previewImg = document.getElementById(EDIT_VIEW_PREVIEW_IMG_ID);
      const previewFigure = previewImg?.closest("figure");
      const previewCaption = document.getElementById(
        EDIT_VIEW_PREVIEW_CAPTION_ID,
      );
      const imgSrc = this._getImageSrc(entry);
      if (previewImg && imgSrc) {
        previewImg.src = imgSrc;
        previewImg.alt = entry.altText || friendlyName || "";
        if (previewFigure) previewFigure.hidden = false;
      } else if (previewFigure) {
        previewFigure.hidden = true;
        logDebug("openEditAltText: no preview source; hiding <figure>");
      }
      if (previewCaption) {
        previewCaption.textContent = friendlyName || "";
      }

      // 5. Update heading text + subtitle paragraph. Heading takes the
      // filename suffix when resolved; subtitle mirrors filename or clears.
      const headingEl = document.getElementById(EDIT_VIEW_HEADING_ID);
      if (headingEl) {
        headingEl.textContent = friendlyName
          ? `${EDIT_VIEW_HEADING_PREFIX} for ${friendlyName}`
          : EDIT_VIEW_HEADING_PREFIX;
      }
      const subtitleEl = document.getElementById(EDIT_VIEW_SUBTITLE_ID);
      if (subtitleEl) {
        subtitleEl.textContent = friendlyName || "";
      }

      // 6. Chunk 3b: initialise reactivity state from the entry snapshot.
      //
      // _valuesAtOpen captures the value-at-open per field for the
      // value-dirty definition (Q3/Q4): a field is dirty iff its current
      // value differs from value-at-open. Type-and-revert clears the flag
      // naturally because the comparison flips back to equal.
      //
      // _dirtyFields is a Set of field keys ("caption", "altText",
      // "longDescription", "textInImage", "decorative") consumed by
      // Chunk 4's save flow. Empty at form open.
      //
      // _captionHadContent + _originalSyntaxForCurrent drive Q2's hint
      // (only relevant when origin === "includegraphics" AND the caption
      // transitions from non-empty to empty).
      this._valuesAtOpen = {
        caption: entry.title || "",
        altText: entry.altText || "",
        longDescription: entry.longDescription || "",
        textInImage: entry.textInImage || "",
        decorative: Boolean(entry.decorative),
      };
      this._dirtyFields = new Set();
      this._captionHadContent = (entry.title || "").length > 0;
      this._originalSyntaxForCurrent = entry.originalSyntax || null;

      // Apply initial decorative-driven state (matches checkbox state,
      // which was set from entry.decorative during population above).
      const isDecorative = Boolean(entry.decorative);
      const altTextInput = document.getElementById(FIELD_IDS.altText.input);
      const longDescInput = document.getElementById(
        FIELD_IDS.longDescription.input,
      );
      if (altTextInput) altTextInput.disabled = isDecorative;
      if (longDescInput) longDescInput.disabled = isDecorative;

      const q3Hint = document.getElementById(EDIT_VIEW_DISABLE_HINT_ID);
      if (q3Hint) q3Hint.hidden = !isDecorative;

      // Q2 hint always hidden on open (no transition has happened yet).
      this._setCaptionHintVisible(false);

      // Initial banner visibility (Q6 single expression).
      this._updateBannerVisibility();

      // Stage 10 (F2.2): clear the decorative announce region on open so a
      // repeat same-direction toggle on a *different* image still announces.
      // The open path sets state by direct DOM (above), never via the
      // handler, so the region stays silent on open.
      const decorativeAnnounce = document.getElementById(
        EDIT_VIEW_DECORATIVE_ANNOUNCE_ID,
      );
      if (decorativeAnnounce) decorativeAnnounce.textContent = "";

      // Parcel 8d-pre-fix: clear the AI status region on open, for the same
      // reason as the decorative region above — the edit view is ONE shared DOM,
      // so without this the previous image's "AI description generated." is
      // still on screen when a different image's edit view opens. Pre-existing
      // since the status region landed; _clearEditAltStatus had exactly one
      // caller (run start) until now.
      //
      // This cannot wipe a line just legitimately written. The open path is the
      // only writer of the form, and it always runs BEFORE a run rather than
      // after one: a run's success branch refreshes the already-open view in
      // place (_repopulateEditAltInputs / _refreshFieldProvenance) and never
      // calls openEditAltText, so no completed run for the image being opened
      // can be followed by an open of that same view. Re-opening an image whose
      // run finished earlier is a NEW visit, where a stale outcome line is the
      // defect, not the message.
      this._clearEditAltStatus();

      // Parcel 8d-pre-strand: and the progress block with it. _closeEditAltText
      // is the causal hook for the carry-over; this one is the DETERMINISTIC
      // START hook, matching the mode-switcher invariant and the two clears
      // above — an opening view begins from a known state rather than inheriting
      // whatever the last one left, however it was left. Cheap, and it covers
      // any path that reaches an open view without passing through
      // _closeEditAltText.
      if (this._editAltProgress) this._editAltProgress.hideProgress(false);

      logDebug(
        `Chunk 3b: reactivity state initialised — decorative=${isDecorative}, ` +
          `captionHadContent=${this._captionHadContent}, ` +
          `originalSyntax=${this._originalSyntaxForCurrent}`,
      );

      // 7. Toggle grid-view hidden; un-hide edit-view.
      const gridView = document.getElementById(GRID_VIEW_CONTAINER_ID);
      const editView = document.getElementById(EDIT_VIEW_CONTAINER_ID);
      if (gridView) gridView.hidden = true;
      if (editView) editView.hidden = false;

      // 8. Stash the image ID for the back-button focus path, save flow,
      // and dirty tracking (Chunks 3b / 4).
      this._currentEditImageId = imageId;

      // 9. Focus the heading per Q8a.
      this._focusEditHeading();
    }

    /**
     * Close the Edit Alt Text view and return to grid view. No save in
     * Chunk 3a — Back closes unconditionally. Chunk 4 will replace this
     * with a save-then-close flow that respects dirty state.
     *
     * Phase D Fix 3 — wires focus return now (Q8b). The original Q10
     * deferral of "focus management triggered by save/return paths" was
     * about the save flow; the no-save Back path needs focus return now
     * to avoid a WCAG 2.4.3 Focus Order failure (focus would otherwise
     * land on <body> after Back).
     *
     * @private
     */
    _closeEditAltText() {
      logInfo("_closeEditAltText");

      // Close the Caption toggletip if it's still open — the ⓘ trigger is
      // about to be hidden along with the edit view, so leaving the toggletip
      // visible would look orphaned in the grid.
      if (this._captionToggletipId && window.UniversalToggletip?.hide) {
        window.UniversalToggletip.hide(this._captionToggletipId);
      }

      // Stash the ID before we null it — _focusCardAltBtn needs it.
      const closingImageId = this._currentEditImageId;

      const editView = document.getElementById(EDIT_VIEW_CONTAINER_ID);
      const gridView = document.getElementById(GRID_VIEW_CONTAINER_ID);
      if (editView) editView.hidden = true;
      if (gridView) gridView.hidden = false;

      // Q8b focus return — focus the Alt button of the originating card.
      // Q8e fallback chain if the card is no longer in the grid (rare).
      const focused = this._focusCardAltBtn(closingImageId);
      if (!focused) {
        this._focusGridFallback();
      }

      // Parcel 8d-pre-strand: tear the progress block down on the way out. This
      // is the CAUSAL hook — without it, leaving mid-run carried the running
      // image's spinner, stage label and ticking timer straight onto the next
      // image's edit view (measured: hidden=false, height > 0, "1s", after
      // opening a different image). hideProgress also clears the elapsed-time
      // interval through the injected clock, so no stray 1s timer survives.
      //
      // The run itself is NOT cancelled and Back is NOT blocked. Trapping a
      // person in a modal during an operation that can take minutes is a worse
      // accessibility problem than the one being fixed; the run completes, the
      // registry write lands, and the grid updates.
      //
      // It does not touch the status region — hideProgress moves only the
      // progress block and the timer — so this cannot swallow a status line.
      if (this._editAltProgress) this._editAltProgress.hideProgress(false);

      // Clear stashed imageId — Chunk 4 will respect this when deciding
      // save scope.
      this._currentEditImageId = null;

      // BG-P2 — the edit view was the A2 blocker, so recompute Describe All
      // AFTER the id is cleared, never before: _isEditViewOpen reads that field
      // and would still say open. Same reset-then-compute ordering rule as
      // _refreshGenerateControl's own.
      this._refreshDescribeAllControl();

      // Chunk 3b: reset reactivity state so a re-open starts clean.
      this._valuesAtOpen = null;
      this._dirtyFields = null;
      this._captionHadContent = false;
      this._originalSyntaxForCurrent = null;

      // Reset transient UI state so a re-open starts from a clean slate.
      this._setCaptionHintVisible(false);
      const q3HintEl = document.getElementById(EDIT_VIEW_DISABLE_HINT_ID);
      if (q3HintEl) q3HintEl.hidden = true;
      const bannerEl = document.getElementById(EDIT_VIEW_BANNER_ID);
      if (bannerEl) bannerEl.hidden = true;

      // Re-enable Alt + Long Description in case decorative had disabled
      // them — keeps the DOM tidy for the next open's population.
      const altOnClose = document.getElementById(FIELD_IDS.altText.input);
      const longDescOnClose = document.getElementById(
        FIELD_IDS.longDescription.input,
      );
      if (altOnClose) altOnClose.disabled = false;
      if (longDescOnClose) longDescOnClose.disabled = false;
    }

    /**
     * Set the textContent of a character-count <small> element.
     * @param {string} countElementId
     * @param {string} value
     * @private
     */
    _setFieldCount(countElementId, value) {
      const el = document.getElementById(countElementId);
      if (el) el.textContent = formatCharacterCount(value.length);
    }

    /**
     * Surface the registry provenance state for a field. Writes the
     * data-provenance attribute for every state (null becomes ""), and a
     * visible pill plus a screen-reader phrase for the five labelled states in
     * EDIT_PROVENANCE_TEXT_VISIBLE / EDIT_PROVENANCE_TEXT_SR ("user",
     * "ai-generated", "ai-reviewed", "algo-generated", "ai-edited").
     * "original" and null yield the data-provenance attribute with empty text.
     * @param {string} elementId
     * @param {string|null|undefined} source
     * @private
     */
    _applyFieldProvenance(elementId, source) {
      const el = document.getElementById(elementId);
      if (!el) return;
      const state = source == null ? "" : String(source);
      el.setAttribute("data-provenance", state);
      const textEl = el.querySelector(".field-provenance-text");
      const srEl = el.querySelector(".field-provenance-sr");
      if (textEl) textEl.textContent = EDIT_PROVENANCE_TEXT_VISIBLE[state] || "";
      if (srEl) srEl.textContent = EDIT_PROVENANCE_TEXT_SR[state] || "";
    }

    // Nested-modal inert needs nothing from this file. Parcel 8c-i kept a
    // _captureInertElements / _releaseInertAddedSince pair here to contain a
    // UniversalModal trait: a nested modal made background elements inert but
    // only released them when the LAST modal closed, so a nested modal opened
    // over this manager stranded whatever it had swept — the toggletip live
    // region among it. Parcel UM-4 gave UniversalModal a per-modal inert record
    // released on that modal's own close, which fixes the trait at source, and
    // the pair was measured finding nothing left to release. Deleted in T1. Do
    // not re-add it: a second releaser would be racing the one that works.

    /**
     * Parcel 8c-ii — prompt the user to choose which descriptions the AI should
     * generate, via a SIBLING UniversalModal opened OVER the manager (never
     * markup injected into the manager's own dialog DOM — that would let Escape
     * fire the edit view's save/close underneath; 8c probe R4/P6).
     *
     * Builds nothing beyond the dialog: it changes no registry field and calls
     * no run()/write(). The ticked state is rebuilt from the passed entry on
     * every open, so a cancel (by any route) is always safe.
     *
     * Resolution contract:
     *   - array of write-stage field keys drawn from ["title","alt","long",
     *     "text"] — the ticked rows mapped through FIELD_SELECT_ROWS.writeKey
     *     (caption→title is the deliberate non-match; T3). The array MAY be
     *     empty — an empty confirm is valid per the locked Option-1 decision.
     *   - null — cancelled (cancel button, Escape, overlay click, or X).
     *
     * Every dismissal route resolves exactly once, because Escape / overlay / X
     * bypass the button handlers and land only in onClose (T2).
     *
     * @param {Object} entry - the registry entry being edited.
     * @returns {Promise<string[]|null>} chosen write-stage keys, or null.
     * @private
     */
    async _promptFieldSelection(entry) {
      // B0 — null-entry guard, matching the file's other helpers. Resolve to
      // null, never throw.
      if (!entry) {
        logWarn("_promptFieldSelection: no entry; returning null");
        return null;
      }

      // B1 — re-entry guard, modelled on _editAltGenerating. A second call
      // while the dialog is open is refused without opening a second dialog.
      // Cleared in onClose (not before), so the refusal holds for the whole
      // lifetime of the open dialog.
      if (this._fieldSelectOpen) {
        logWarn(
          "_promptFieldSelection: a field-selection dialog is already open; ignoring re-entry",
        );
        return null;
      }
      this._fieldSelectOpen = true;

      // T5 — read the LIVE wording map at build time, never a captured copy, so
      // the dialog always shows current wording.
      const provenanceVisible = EDIT_PROVENANCE_TEXT_VISIBLE;

      // B2 — data-driven rows from FIELD_SELECT_ROWS. Locked default: a field
      // with NO content arrives CHECKED (the safe outcome is preselected); a
      // field WITH content arrives UNCHECKED. All interpolated text goes
      // through _escapeHTML.
      const rowsHTML = FIELD_SELECT_ROWS.map((row) => {
        const value = entry[row.contentProp];
        const hasContent =
          typeof value === "string" && value.trim().length > 0;
        const checkedAttr = hasContent ? "" : " checked";
        const contentPhrase = hasContent
          ? FIELD_SELECT_STATE_HAS_CONTENT
          : FIELD_SELECT_STATE_EMPTY;

        const source = entry[row.sourceProp];
        const provenancePhrase =
          source && source !== "original" && provenanceVisible[source]
            ? provenanceVisible[source]
            : FIELD_SELECT_STATE_NOT_SET;

        const label = FIELD_LABELS[row.key];
        const stateId = `${row.checkboxId}-state`;
        const stateLine = `${contentPhrase} · ${provenancePhrase}`;

        return `
          <li class="mmd-image-manager-fieldsel-row">
            <input type="checkbox"
                   id="${row.checkboxId}"
                   data-write-key="${this._escapeAttr(row.writeKey)}"
                   aria-describedby="${stateId}"${checkedAttr} />
            <label for="${row.checkboxId}">${this._escapeHTML(label)}</label>
            <span id="${stateId}" class="mmd-image-manager-fieldsel-state">${this._escapeHTML(
              stateLine,
            )}</span>
          </li>`;
      }).join("");

      // B3 — confirm + cancel buttons live in the content and are wired in
      // onOpen (declared-button arrays cannot read checkbox state before
      // teardown).
      const content = `
        <div class="mmd-image-manager-fieldsel">
          <p class="mmd-image-manager-fieldsel-intro">${this._escapeHTML(
            FIELD_SELECT_INTRO_TEXT,
          )}</p>
          <ul class="mmd-image-manager-fieldsel-list">${rowsHTML}
          </ul>
          <div class="mmd-image-manager-fieldsel-actions">
            <button type="button"
                    id="${FIELD_SELECT_CONFIRM_BTN_ID}"
                    class="image-manager-btn mmd-image-manager-fieldsel-confirm">${this._escapeHTML(
                      FIELD_SELECT_CONFIRM_LABEL,
                    )}</button>
            <button type="button"
                    id="${FIELD_SELECT_CANCEL_BTN_ID}"
                    class="image-manager-btn mmd-image-manager-fieldsel-cancel">${this._escapeHTML(
                      FIELD_SELECT_CANCEL_LABEL,
                    )}</button>
          </div>
        </div>`;

      logInfo(
        `_promptFieldSelection: opening for entry ${entry.id} (${FIELD_SELECT_ROWS.filter(
          (r) => {
            const v = entry[r.contentProp];
            return !(typeof v === "string" && v.trim().length > 0);
          },
        ).length} field(s) empty → pre-ticked)`,
      );

      return new Promise((resolve) => {
        // B5 — resolve-once guard so no path double-resolves.
        let resolved = false;
        const resolveOnce = (value) => {
          if (resolved) return;
          resolved = true;
          logInfo(
            `_promptFieldSelection: resolved with ${
              value === null ? "null (cancelled)" : `[${value.join(", ")}]`
            }`,
          );
          resolve(value);
        };

        const modal = new UniversalModal.Modal({
          // B4 — accessible name that names the task.
          title: FIELD_SELECT_DIALOG_TITLE,
          content,
          size: "small",
          className: FIELD_SELECT_DIALOG_CLASS,
          // Option 1: overlay, Escape and X all close and all resolve to
          // cancel. The dialog changes nothing until confirm, so cancel is
          // safe, and the ticked state rebuilds from the registry on each open.
          closeOnOverlayClick: true,
          onOpen: (instance) => {
            // The shim does NOT forward `className` to the dialog element (it is
            // stored but never placed in the manager config), so stamp the
            // distinctive class onto the live dialog here — the stylesheet and
            // 8c-ii-guard target this class at the dialog level.
            if (instance.modal) {
              instance.modal.classList.add(FIELD_SELECT_DIALOG_CLASS);
            }

            // Wire the two buttons. The confirm handler reads live checkbox
            // state and maps ticked rows to WRITE-STAGE keys (T3).
            const root = instance.modal;
            const confirmBtn = root
              ? root.querySelector(`#${FIELD_SELECT_CONFIRM_BTN_ID}`)
              : null;
            const cancelBtn = root
              ? root.querySelector(`#${FIELD_SELECT_CANCEL_BTN_ID}`)
              : null;

            if (confirmBtn) {
              confirmBtn.addEventListener("click", () => {
                const chosen = FIELD_SELECT_ROWS.filter((row) => {
                  const cb = root.querySelector(`#${row.checkboxId}`);
                  return !!(cb && cb.checked);
                }).map((row) => row.writeKey);
                // An empty array is valid (locked Option-1 empty-selection).
                resolveOnce(chosen);
                instance.close();
              });
            } else {
              logWarn("_promptFieldSelection: confirm button not found in DOM");
            }

            if (cancelBtn) {
              cancelBtn.addEventListener("click", () => {
                resolveOnce(null);
                instance.close();
              });
            } else {
              logWarn("_promptFieldSelection: cancel button not found in DOM");
            }
          },
          onClose: () => {
            // B6 — exact order: (1) resolve with null if no button path already
            // resolved (covers Escape / overlay / X — T2), (2) clear the
            // re-entry flag. Resolving first keeps the promise settled before
            // the flag lets another open through.
            resolveOnce(null);
            this._fieldSelectOpen = false;
          },
        });

        modal.open();
      });
    }

    /**
     * Parcel 8c-iv — decide whether the field-selection dialog must be shown
     * before a run (locked decision Lock 3). The dialog is SKIPPED only for a
     * genuinely untouched entry: all four content fields empty AND no field
     * carrying a human-owned (frozen) source. Anything else — existing content,
     * or a human decision recorded in provenance — is something a blind run
     * could destroy, so we ask first.
     *
     * Fails TOWARDS the dialog. An unusable entry, or an unreachable write
     * stage / freeze list, returns true: asking is always recoverable, a silent
     * overwrite is not.
     *
     * The four content/source property pairs are read from FIELD_SELECT_ROWS,
     * and the freeze set live from the write stage, so neither is restated here
     * and neither can drift from its owner.
     *
     * Synchronous and free of DOM reads, so the 8c-iv-guard rows can call it
     * directly on a constructed entry with no page.
     *
     * @param {Object} entry - the registry entry a run is about to target.
     * @returns {boolean} true when the dialog must be shown.
     * @private
     */
    _needsFieldSelection(entry) {
      if (!entry || typeof entry !== "object") {
        logWarn(
          "_needsFieldSelection: missing or non-object entry; showing the dialog",
        );
        return true;
      }

      const frozenSources =
        window.MathPixAltTextWriteStage &&
        window.MathPixAltTextWriteStage.FROZEN_SOURCES;

      if (!Array.isArray(frozenSources)) {
        logWarn(
          `_needsFieldSelection: FROZEN_SOURCES unreachable on window.MathPixAltTextWriteStage; showing the dialog for entry ${entry.id}`,
        );
        return true;
      }

      const hasContent = FIELD_SELECT_ROWS.some((row) => {
        const value = entry[row.contentProp];
        return typeof value === "string" && value.trim().length > 0;
      });

      const hasFrozenSource = FIELD_SELECT_ROWS.some((row) =>
        frozenSources.includes(entry[row.sourceProp]),
      );

      const needed = hasContent || hasFrozenSource;
      logInfo(
        `_needsFieldSelection: entry ${entry.id} → ${
          needed ? "SHOW dialog" : "SKIP dialog"
        } (content present: ${hasContent}, frozen source present: ${hasFrozenSource})`,
      );
      return needed;
    }

    /**
     * Parcel 8e-1 — accept ONE field's existing content as reviewed by a person:
     * write the content back unchanged with the source "ai-reviewed".
     *
     * NO INTERFACE. This parcel adds the write path and its predicate only —
     * nothing calls this yet, nothing is announced, nothing is notified. The
     * gesture and the spoken line are 8e-2.
     *
     * ── Why a read-then-write-back rather than a source-only update ──────────
     * The registry has no source-only write. Every setter coerces a non-string
     * content argument to "" (updateAltText: `typeof altText === "string" ?
     * altText : ""`), so calling one with `undefined` to "just stamp the source"
     * would BLANK the field while recording that a person approved it. So we
     * read the content and hand the very same string back.
     *
     * ── Why the policy is here and not in the setters ────────────────────────
     * Locked decision 3 puts require-source, never-stamp-empty and the freeze
     * floor on the WRITER and leaves the setters dumb. This is the chem-floor
     * precedent, and the same shape write() already follows.
     *
     * Touches ONE field: no other field, no input value, no dirty-state
     * baseline, no decorative checkbox.
     *
     * @param {string} imageId - Registry image id.
     * @param {string} fieldKey - One of the four content field keys in
     *   FIELD_SELECT_ROWS ("caption" | "altText" | "longDescription" |
     *   "textInImage"). "decorative" is NOT acceptable — it carries no
     *   provenance — and is refused as an unknown key rather than throwing.
     * @returns {{accepted: boolean, reason: string, fieldKey: string}} On a
     *   refusal, `reason` is either the write stage's own provenance reason
     *   (ACCEPT_REASON) or one of ACCEPT_FAIL_REASON; on acceptance it is the
     *   predicate's own "acceptable". Refusals write NOTHING.
     * @private
     */
    _acceptField(imageId, fieldKey) {
      const verdictFor = (accepted, reason) => ({ accepted, reason, fieldKey });

      // 1. Read the write-stage namespace at CALL time, never at definition
      // time: alt-text-write-stage.js loads AFTER this file in tools.html, so a
      // definition-time capture is undefined. The chemistry writer hit exactly
      // this. Refusing is the safe failure — a stale local copy of the rule is
      // not, because the stamp freezes the field.
      const predicate =
        window.MathPixAltTextWriteStage &&
        window.MathPixAltTextWriteStage.isAcceptableForReview;

      if (typeof predicate !== "function") {
        if (!acceptPredicateWarned) {
          acceptPredicateWarned = true;
          logWarn(
            "_acceptField: isAcceptableForReview unreachable on window.MathPixAltTextWriteStage — refusing every accept rather than duplicating the rule",
          );
        }
        return verdictFor(false, ACCEPT_FAIL_REASON.PREDICATE_UNAVAILABLE);
      }

      const row = FIELD_SELECT_ROWS.find((entry) => entry.key === fieldKey);
      if (!row) {
        logWarn(`_acceptField: unknown field key "${fieldKey}" — refusing`);
        return verdictFor(false, ACCEPT_FAIL_REASON.UNKNOWN_FIELD);
      }

      const registry = this.restorer?.imageRegistry;
      if (!registry) {
        logWarn("_acceptField: no image registry — refusing");
        return verdictFor(false, ACCEPT_FAIL_REASON.NO_REGISTRY);
      }

      // 2. getImage returns a DEEP CLONE, not a live reference. Read from it;
      // never write through it — a mutation here would be silently discarded.
      const entry = registry.getImage(imageId);
      if (!entry) {
        logWarn(`_acceptField: image "${imageId}" not found — refusing`);
        return verdictFor(false, ACCEPT_FAIL_REASON.ENTRY_NOT_FOUND);
      }

      // 3. Resolve the field's content and provenance properties from the row.
      const content = entry[row.contentProp];
      const source = entry[row.sourceProp];

      // 4. THE NEVER-BLANK GUARD, and the whole reason this method exists. If
      // the content is not a string, the setter would coerce it to "" — so a
      // blind accept would destroy the person's content while recording that
      // they approved it. Refuse before going anywhere near a setter.
      if (typeof content !== "string") {
        logWarn(
          `_acceptField: ${fieldKey} content is ${typeof content}, not a string — refusing rather than letting the setter coerce it to empty`,
        );
        return verdictFor(false, ACCEPT_FAIL_REASON.NON_STRING_CONTENT);
      }

      // 5. Ask the predicate. A refusal writes nothing at all.
      const verdict = predicate(source, content);
      if (!verdict || !verdict.acceptable) {
        const reason = verdict
          ? verdict.reason
          : ACCEPT_FAIL_REASON.PREDICATE_UNAVAILABLE;
        logInfo(
          `_acceptField: ${fieldKey} on ${imageId} refused (${reason}, source "${source}") — nothing written`,
        );
        return verdictFor(false, reason);
      }

      // 6. Write the content back BYTE-IDENTICAL with the reviewed source.
      registry[row.setter](imageId, content, ACCEPTED_SOURCE);

      // 7. Refresh THAT ONE pill. Deliberately not _refreshFieldProvenance,
      // which rewrites all four and takes an entry rather than a field key.
      this._applyFieldProvenance(FIELD_IDS[fieldKey].provenance, ACCEPTED_SOURCE);

      logInfo(
        `_acceptField: ${fieldKey} on ${imageId} accepted — source "${source}" → "${ACCEPTED_SOURCE}", content unchanged`,
      );
      return verdictFor(true, verdict.reason);
    }

    /**
     * Parcel 8e-2 — set an accept button's VISIBLE text while preserving the
     * inflated icon.
     *
     * The icon span is re-appended as the same ELEMENT rather than rebuilt from
     * markup, so the SVG that populateIcons already inflated into it survives.
     * Writing innerHTML with a fresh `<span data-icon>` would give an empty span
     * that nothing re-populates, and the button would silently lose its icon on
     * the first state change — visible to a sighted person, invisible to every
     * test that reads textContent.
     *
     * Parcel 8e-2b — COMPOSES the label rather than receiving it. Callers pass a
     * template and a field key, never a finished string, so there is exactly one
     * place a per-field accept label can be built and no opportunity for a
     * caller to hand over a generic one. It reads the same FIELD_LABELS through
     * the same composeAcceptText the spoken line uses, so the label and the
     * announcement cannot come to disagree about what a field is called.
     *
     * @param {HTMLElement} button - the accept button.
     * @param {string} template - ACCEPT_BUTTON_RESTING_TEMPLATE or
     *   ACCEPT_BUTTON_REVIEWED_TEMPLATE.
     * @param {string} fieldKey - one of the four content field keys.
     * @private
     */
    _setAcceptButtonLabel(button, template, fieldKey) {
      if (!button) return;
      const icon = button.querySelector("[data-icon]");
      button.textContent = "";
      if (icon) {
        button.appendChild(icon);
        button.appendChild(document.createTextNode(" "));
      }
      button.appendChild(
        document.createTextNode(composeAcceptText(template, fieldKey)),
      );
    }

    /**
     * Parcel 8e-2 — refresh all four accept controls from a registry entry.
     *
     * THE ONLY WRITER of these buttons' hidden, aria-disabled and visible text,
     * apart from the activation handler, which writes the latter two on the
     * gesture itself. Nothing else may touch them.
     *
     * ── Why all three are written UNCONDITIONALLY, every time ────────────────
     * _buildEditAltViewHTML emits ONE set of field blocks for the whole
     * document, so this DOM is shared by every image. A person who accepts a
     * field on image A leaves that button aria-disabled and reading "Marked as
     * reviewed"; open image B and, without an unconditional reset, B's field
     * would present as already reviewed when its registry entry says nothing of
     * the kind. A reset that runs "only when needed" IS the bug — the needed
     * case is exactly the one a conditional gets wrong. This is the same class
     * of shared-DOM residue as the 8d-pre-strand incident, where a run's result
     * landed in a different image's form.
     *
     * Visibility is the ONLY thing the predicate decides. Called from both
     * population sites, exactly as _refreshFieldProvenance is, so the open path
     * and the post-run path cannot drift.
     *
     * Reads the predicate at CALL time for the same reason _acceptField does:
     * alt-text-write-stage.js loads after this file. With it unreachable every
     * control stays hidden — a person cannot press what is not there, which
     * agrees with _acceptField refusing every accept in the same condition.
     *
     * @param {Object} entry - the registry entry to read.
     * @private
     */
    _refreshAcceptControls(entry) {
      if (!entry) {
        logWarn("_refreshAcceptControls: no entry; skipping");
        return;
      }

      const predicate =
        window.MathPixAltTextWriteStage &&
        window.MathPixAltTextWriteStage.isAcceptableForReview;
      const predicateUsable = typeof predicate === "function";

      let shown = 0;

      for (const row of FIELD_SELECT_ROWS) {
        const button = document.getElementById(FIELD_IDS[row.key].accept);
        if (!button) continue;

        // The two RESETS, before anything conditional is computed. Order is
        // deliberate: state first, visibility second, so a throw in the
        // predicate can never strand a button visible in a reviewed state.
        //
        // Parcel 8e-2b — the label reset is now PER FIELD, and it is `row.key`
        // that makes it so. The reset was already the shared-DOM contract; with
        // per-field wording its failure mode is worse than it was, because a
        // missed reset no longer shows a generic "Marked as reviewed" on image
        // B but shows image B's alt-text button reading "Long description
        // reviewed" — a control asserting it has marked a field it has not
        // touched. Taking the key from the row being iterated is what keeps the
        // label, the id and the predicate verdict describing the same field.
        button.setAttribute("aria-disabled", "false");
        this._setAcceptButtonLabel(
          button,
          ACCEPT_BUTTON_RESTING_TEMPLATE,
          row.key,
        );

        const verdict = predicateUsable
          ? predicate(entry[row.sourceProp], entry[row.contentProp])
          : null;
        const acceptable = !!(verdict && verdict.acceptable === true);
        button.hidden = !acceptable;
        if (acceptable) shown++;
      }

      logInfo(
        `_refreshAcceptControls: ${shown} of ${FIELD_SELECT_ROWS.length} accept controls shown` +
          (predicateUsable ? "" : " (predicate unreachable — all hidden)"),
      );
    }

    /**
     * Parcel g-10 — set the Generate control's state from the CURRENT image's
     * situation, unconditionally, every time the edit view is populated.
     *
     * ── Why unconditionally, and why from every population site ──────────────
     * Modelled on _refreshAcceptControls, and for the identical reason: the edit
     * view emits ONE Generate button for the whole document, so without a reset
     * that always runs, image B shows whatever image A left behind. A reset that
     * runs "only when needed" IS the bug — the needed case is exactly the one a
     * conditional gets wrong.
     *
     * ── The three states ─────────────────────────────────────────────────────
     *   no run in flight            → enabled, plain name
     *   a run for THIS image        → aria-disabled="true", plain name. This is
     *                                 what the file already did on the running
     *                                 path and it is NOT redesigned here.
     *   a run for a DIFFERENT image → aria-disabled="true", and the reason in
     *                                 the button's own accessible name.
     *
     * ── Focus, because a name change is audible ──────────────────────────────
     * Changing a FOCUSED control's accessible name makes NVDA re-announce it.
     * On the open path that cannot bite: openEditAltText sends focus to the
     * heading (_focusEditHeading), so this button is not focused when the view
     * is populated. From the run's `finally` it CAN bite — aria-disabled rather
     * than disabled keeps focus on the button, so a person who pressed the
     * blocked control is still on it when the other run ends and the suffix is
     * removed. That re-announcement is UNMEASURED and is a listen question, not
     * a claim; it is recorded in the parcel report rather than asserted here.
     *
     * Reads _activeRunImageId, which the file already maintains beside
     * _editAltGenerating — both set before the first await and both cleared in
     * the same finally, so they cannot disagree.
     *
     * ── Why the open image is a PARAMETER and not read from state ────────────
     * Measured during this parcel's own self-gate, and it is the reason the
     * first build of this method did nothing at all. openEditAltText assigns
     * this._currentEditImageId at its STEP 8, long after the resets at step 3 —
     * so a reset that read the field from state compared the incoming image
     * against the PREVIOUS one, concluded "this image is the running one", and
     * silently took the wrong branch. The control stayed unnamed and the drive
     * reported a plain accessible name with the flag correctly set. Taking the
     * id from the caller makes the method independent of when that field is
     * written, which is the same discipline _refreshAcceptControls follows in
     * taking its entry rather than re-reading one.
     *
     * Guards and returns at every step: nothing here may throw, and nothing here
     * may block a legitimate press.
     * @param {string|null} openImageId - the image the edit view is showing, or
     *   about to show. Callers on the open path pass the incoming id; callers
     *   after a run pass this._currentEditImageId.
     * @private
     */
    _refreshGenerateControl(openImageId) {
      const button = document.getElementById(EDIT_VIEW_GENERATE_BTN_ID);
      if (!button) {
        logWarn(
          `_refreshGenerateControl: #${EDIT_VIEW_GENERATE_BTN_ID} not in DOM; nothing to reset`,
        );
        return;
      }

      // THE RESET, before anything conditional is computed — same ordering rule
      // as _refreshAcceptControls. Removing the suffix first means no path can
      // strand image A's reason on image B's control.
      const existing = button.querySelector(`[${GENERATE_BLOCKED_SUFFIX_ATTR}]`);
      if (existing) existing.remove();

      const running = this._editAltGenerating === true;
      if (!running) {
        button.setAttribute("aria-disabled", "false");
        logDebug("_refreshGenerateControl: no run in flight; control enabled");
        return;
      }

      const openId = openImageId || null;
      const runningId = this._activeRunImageId || null;

      // A run is in flight but we cannot say whose. Disable WITHOUT a reason:
      // an unexplained unavailable control is poor, but naming the wrong cause
      // is worse, and this is the branch where we do not know the cause.
      if (!openId || !runningId) {
        button.setAttribute("aria-disabled", "true");
        logWarn(
          `_refreshGenerateControl: run in flight but ids incomplete ` +
            `(open=${openId}, running=${runningId}); disabled with no reason given`,
        );
        return;
      }

      if (runningId === openId) {
        // THIS image's own run. Unchanged from what the running path already
        // does — this parcel does not redesign that state.
        button.setAttribute("aria-disabled", "true");
        logDebug(
          `_refreshGenerateControl: this image (${openId}) is generating; running state left as-is`,
        );
        return;
      }

      // A DIFFERENT image is generating. The state goes into the NAME.
      button.setAttribute("aria-disabled", "true");
      const suffix = document.createElement("span");
      suffix.className = GENERATE_BLOCKED_SUFFIX_CLASS;
      suffix.setAttribute(GENERATE_BLOCKED_SUFFIX_ATTR, "true");
      suffix.textContent = GENERATE_BLOCKED_NAME_SUFFIX;
      button.appendChild(suffix);
      logInfo(
        `_refreshGenerateControl: ${runningId} is generating while ${openId} is open — ` +
          "control disabled and the reason added to its accessible name",
      );
    }

    /**
     * Parcel g-10 — the blocked press SPEAKS.
     *
     * Writes one line to #edit-alt-ai-status, the edit view's single live
     * region. Measured before this parcel: the blocked path wrote nothing at
     * all, on any channel, so a person who could not see the screen had no way
     * to tell a swallowed press from a broken control.
     *
     * ONE channel, not two. No announce() beside this write: the region's own
     * liveness IS the spoken path, and adding an announcer call would speak the
     * line twice (AGENTS.md § Announcements).
     *
     * Goes through _editAltProgress.showStatus — the RAW controller, the same
     * one _announceEditAltRunStart writes through, NOT _editAltProgressScoped.
     * The scoped wrapper suppresses writes when the view has moved off
     * _activeRunImageId, which on this path is ALWAYS true by construction: the
     * whole point is that the open image is not the running one.
     * @private
     */
    _announceGenerateBlocked() {
      if (this._editAltProgress) {
        this._editAltProgress.showStatus(
          GENERATE_BLOCKED_STATUS_LINE,
          GENERATE_BLOCKED_STATUS_TYPE,
        );
        logDebug("_announceGenerateBlocked: blocked line written");
        return;
      }

      // Fall back to the region itself rather than staying silent — silence is
      // the defect this method exists to remove.
      const statusEl = document.getElementById(EDIT_VIEW_AI_STATUS_ID);
      if (!statusEl) {
        logWarn(
          `_announceGenerateBlocked: no progress controller and no #${EDIT_VIEW_AI_STATUS_ID}; ` +
            "the blocked press stays silent",
        );
        return;
      }
      statusEl.textContent = GENERATE_BLOCKED_STATUS_LINE;
      statusEl.className = `imgdesc-status imgdesc-status-${GENERATE_BLOCKED_STATUS_TYPE}`;
      statusEl.hidden = false;
      logWarn(
        "_announceGenerateBlocked: no progress controller; wrote the blocked line directly",
      );
    }

    // ========================================================================
    // PARCEL BG-P2 — BATCH GENERATION
    // ========================================================================

    /**
     * Is the edit view currently open?
     *
     * Read from `_currentEditImageId` rather than from the section's `hidden`
     * property, because that field is the one the save baseline hangs off — and
     * the baseline is what A2 exists to protect. A DOM read could go true while
     * the id was already null mid-transition; the id cannot.
     * @private
     */
    _isEditViewOpen() {
      return Boolean(this._currentEditImageId);
    }

    /**
     * Substitute {count} in ONE pass with a function replacer — never a chained
     * replace, for the reason the batch runner's own fillTemplate gives.
     * @private
     */
    _fillBatchCount(template, count) {
      return String(template).replace(
        new RegExp(BATCH_START_COUNT_TOKEN.replace(/[{}]/g, "\\$&"), "g"),
        () => String(count),
      );
    }

    /**
     * Parcel BG-P3 — substitute {count} in a SPOKEN line with the WORD form,
     * per plan decision A9: counts are spoken as words zero to nine, digits
     * from 10.
     *
     * THE WORD LIST IS THE RUNNER'S OWN, reached through its exported
     * `countWord`, so the crossover lives in exactly one place; retuning it
     * there retunes this line too. A second list here is how the start line and
     * the outcome line would come to disagree about what "three" is.
     *
     * WHY THIS EXISTS AT ALL: the outcome line already honoured A9, because the
     * runner composes it. The START line did not — it went through
     * `_fillBatchCount`, which substitutes the digit — so a three-image batch
     * opened by saying "Describing 3 images" and closed by saying "Three
     * descriptions generated". One gesture, two conventions.
     *
     * ⚠ SPOKEN ONLY, AND THAT IS DELIBERATE. The start view's VISIBLE intro
     * keeps the digit form through `_fillBatchCount`: A9 governs what is
     * spoken, and a digit is the ordinary convention for a count on screen.
     *
     * The guard is independent of `_openBatchDialog`'s own module check, which
     * tests `create` only — a build exposing the factory but not this helper
     * would otherwise throw on the first line the person hears. It degrades to
     * the digit form rather than to no line, on the same principle the runner's
     * own `countWord` states: a count nobody can word is still a count.
     *
     * ⚠ IT PRODUCES THE MID-SENTENCE FORM, and that is not a detail. The
     * runner's list is CAPITALISED — "Three", "Nine" — because its own clauses
     * are sentence-initial ("Three descriptions generated."). This slot is not:
     * the token sits inside "Describing {count} images", so the word arrives
     * mid-sentence and its initial is cased down here. Found by the suite row
     * that pins this, on its first run, where the naive version produced
     * "Describing Three images. Please wait." — heard the same by a reader,
     * which is exactly why only a written assertion catches it, and wrong on
     * screen, because `showStatus` writes the visible status line too.
     *
     * THE FIX BELONGS TO THE CONSUMER, NEVER TO THE SHARED LIST. Lower-casing
     * `BATCH_COUNT_WORDS` would silently break the outcome line's three clauses,
     * every one of which starts its sentence with the count. A future
     * sentence-initial consumer should call `countWord` directly, as the
     * runner's own clauses do.
     *
     * ⚠ FOR MARKER GATES: a guarded call NAMES ITS METHOD TWICE — once in the
     * typeof test and once in the call — so a needle on `countWord` counts two
     * occurrences here, not one. Read the count out; do not predict it.
     * @private
     */
    _fillBatchCountWord(template, count, runnerModule) {
      const raw =
        runnerModule && typeof runnerModule.countWord === "function"
          ? runnerModule.countWord(count)
          : String(count);
      // Only the FIRST character, and only because this slot is mid-sentence.
      // A digit is unchanged by this, so the crossover at ten needs no branch.
      const word = raw.charAt(0).toLowerCase() + raw.slice(1);
      // ONE pass with a function replacer, never a chained replace — a
      // sequential pass rescans substituted values.
      return String(template).replace(
        new RegExp(BATCH_START_COUNT_TOKEN.replace(/[{}]/g, "\\$&"), "g"),
        () => word,
      );
    }

    /**
     * Parcel BG-P2 — the REVERSE mutual-exclusion direction (A11).
     *
     * Mirrors `_refreshGenerateControl` deliberately and in every particular:
     * the reset comes FIRST so no path can strand one reason on top of another,
     * the control takes `aria-disabled` and NEVER the `disabled` property, it is
     * never removed, and the reason goes into the accessible name through a
     * visually-hidden span rather than a title attribute.
     *
     * TWO blocking causes, and they are given DIFFERENT names on purpose: a run
     * in flight is a wait, and an open edit view is an action the person must
     * take. Naming them identically would tell somebody to wait for something
     * that will never finish on its own.
     * @private
     */
    _refreshDescribeAllControl() {
      const button = document.getElementById(BATCH_DESCRIBE_ALL_BTN_ID);
      if (!button) {
        logDebug(
          `_refreshDescribeAllControl: #${BATCH_DESCRIBE_ALL_BTN_ID} not in DOM; nothing to reset`,
        );
        return;
      }

      // THE RESET, before anything conditional is computed.
      const existing = button.querySelector(
        `[${DESCRIBE_ALL_BLOCKED_SUFFIX_ATTR}]`,
      );
      if (existing) existing.remove();

      const blockedByRun = this._editAltGenerating === true;
      const blockedByEdit = this._isEditViewOpen();

      if (!blockedByRun && !blockedByEdit) {
        button.setAttribute("aria-disabled", "false");
        logDebug("_refreshDescribeAllControl: nothing blocking; control enabled");
        return;
      }

      button.setAttribute("aria-disabled", "true");

      // A run in flight is reported ahead of an open edit view when both hold:
      // the run is the one the person cannot do anything about.
      const suffixText = blockedByRun
        ? DESCRIBE_ALL_BLOCKED_BY_RUN_SUFFIX
        : DESCRIBE_ALL_BLOCKED_BY_EDIT_SUFFIX;

      const suffix = document.createElement("span");
      suffix.className = DESCRIBE_ALL_BLOCKED_SUFFIX_CLASS;
      suffix.setAttribute(DESCRIBE_ALL_BLOCKED_SUFFIX_ATTR, "true");
      suffix.textContent = suffixText;
      button.appendChild(suffix);
      logInfo(
        `_refreshDescribeAllControl: blocked (run=${blockedByRun}, edit=${blockedByEdit}) — ` +
          "control disabled and the reason added to its accessible name",
      );
    }

    /**
     * Parcel BG-P2 — the blocked Describe All press SPEAKS, once, on ONE channel.
     *
     * Goes through the manager's own status host via `_showStatus`, which writes
     * the visible line and the announcement in one call. NO `announce()` beside
     * it and NO `notify*()`: either would speak the line twice, which is the
     * commonest defect in AGENTS.md section Announcements.
     *
     * Silence is the defect this method exists to remove, so an unreachable host
     * logs loudly rather than returning quietly.
     * @private
     */
    _announceDescribeAllBlocked(reason) {
      const line =
        reason === "edit"
          ? DESCRIBE_ALL_BLOCKED_BY_EDIT_LINE
          : DESCRIBE_ALL_BLOCKED_BY_RUN_LINE;
      this._showStatus(line, DESCRIBE_ALL_BLOCKED_STATUS_TYPE);
      logDebug(`_announceDescribeAllBlocked: wrote the ${reason} line`);
    }

    /**
     * Build the batch dialog's markup — three views (A3), exactly one visible.
     *
     * Every interpolated value passes through _escapeHTML. Both controls carry
     * VISIBLE TEXT beside their icon, so neither depends on an aria-label.
     * @private
     */
    _buildBatchDialogHTML(targetCount) {
      const intro =
        targetCount === 1
          ? BATCH_START_INTRO_SINGULAR
          : this._fillBatchCount(BATCH_START_INTRO_PLURAL, targetCount);

      return `
        <div class="mmd-image-manager-batch">
          <section id="${BATCH_START_VIEW_ID}" class="mmd-image-manager-batch-view">
            <p class="mmd-image-manager-batch-intro">${this._escapeHTML(intro)}</p>
            <div class="mmd-image-manager-batch-actions">
              <button type="button"
                      id="${BATCH_CONFIRM_BTN_ID}"
                      class="image-manager-btn mmd-image-manager-batch-confirm">
                <span aria-hidden="true" data-icon="play"></span>
                ${this._escapeHTML(BATCH_CONFIRM_LABEL)}
              </button>
            </div>
          </section>

          <!-- RUNNING VIEW. Every element here is VISUAL-ONLY and carries no
               live semantics of any kind. The A10 pin allows exactly two spoken
               lines per batch and both come from the dialog's own status host,
               so anything live here would be a third voice. The rule is stated
               without naming the attributes it forbids ON PURPOSE: this markup
               sits inside a JS template literal, so an HTML comment here is not
               reached by comment-stripping and a quoted attribute name would be
               counted as a real live region by the live-region inventory. That
               is exactly what happened when this comment was first written. -->
          <section id="${BATCH_RUNNING_VIEW_ID}" class="mmd-image-manager-batch-view" hidden>
            <p id="${BATCH_PROGRESS_COUNT_ID}" class="mmd-image-manager-batch-count"></p>
            <p id="${BATCH_PROGRESS_STAGE_ID}" class="mmd-image-manager-batch-stage"></p>
            <p id="${BATCH_PROGRESS_TIME_ID}" class="mmd-image-manager-batch-time"></p>
            <div class="mmd-image-manager-batch-actions">
              <button type="button"
                      id="${BATCH_CANCEL_BTN_ID}"
                      class="image-manager-btn mmd-image-manager-batch-cancel">
                <span aria-hidden="true" data-icon="close"></span>
                ${this._escapeHTML(BATCH_CANCEL_LABEL)}
              </button>
            </div>
          </section>

          <!-- COMPLETION VIEW. A paragraph carrying the outcome sentence
               used to sit at the top of this section. F9-FIX removed it:
               the sentence is written once, to the dialog status band,
               which is where it is also spoken from. Two copies on screen
               at the same moment was the whole of the defect. -->
          <section id="${BATCH_COMPLETE_VIEW_ID}" class="mmd-image-manager-batch-view" hidden>
            <div class="mmd-image-manager-batch-actions">
              <button type="button"
                      id="${BATCH_CLOSE_BTN_ID}"
                      class="image-manager-btn mmd-image-manager-batch-close">
                <span aria-hidden="true" data-icon="check"></span>
                ${this._escapeHTML(BATCH_CLOSE_LABEL)}
              </button>
            </div>
          </section>
        </div>`;
    }

    /**
     * Show exactly one of the three views. Uses the `hidden` property so a
     * non-current view is out of the accessibility tree entirely rather than
     * merely invisible.
     * @private
     */
    _showBatchView(root, viewId) {
      if (!root) return;
      [BATCH_START_VIEW_ID, BATCH_RUNNING_VIEW_ID, BATCH_COMPLETE_VIEW_ID].forEach(
        (id) => {
          const section = root.querySelector(`#${id}`);
          if (section) section.hidden = id !== viewId;
        },
      );
    }

    /**
     * Build the batch's SILENT progress controller.
     *
     * THIS IS THE A10 PIN IN CODE. The orchestrator emits exactly one
     * `showStatus` OR one `showError` per run — that is per IMAGE — so handing
     * it a speaking controller would put N lines into the spoken stream for a
     * gesture the person made once. Every method here writes to a non-live
     * element or does nothing at all, and none reaches an announcer.
     *
     * The visible per-image detail is written by the loop's own onProgress
     * callback rather than from here, because the orchestrator's stage labels
     * describe one image's run and the person needs the batch's position.
     * @private
     */
    _makeBatchProgressController(root) {
      const stageEl = root ? root.querySelector(`#${BATCH_PROGRESS_STAGE_ID}`) : null;
      return {
        showProgress: () => {},
        // Deliberately writes NOTHING anywhere. The per-image outcome is
        // carried by the tally and spoken once, at the end, by the runner's
        // composed line.
        showStatus: (message) => {
          logDebug(`batch progress: per-image status suppressed (${message})`);
        },
        showError: (message) => {
          logDebug(`batch progress: per-image error suppressed (${message})`);
        },
        hideProgress: () => {
          if (stageEl) stageEl.textContent = "";
        },
      };
    }

    /**
     * Parcel BG-P2 — the Describe All toolbar handler.
     *
     * Both blocking directions are checked HERE, before anything opens, and the
     * blocked press speaks (A11). The order matters: a run in flight is checked
     * first because it is the condition the person cannot resolve themselves.
     *
     * ⚠ ITS RETURNED PROMISE SETTLES ON DIALOG CLOSE, NOT ON DIALOG OPEN, and
     * on a blocked press it settles immediately. That is inherited from
     * _promptFieldSelection, whose promise is the person's answer. The onclick
     * wrapper ignores it, so nothing in production waits — but ANY DRIVE THAT
     * AWAITS THIS CALL ON AN UNBLOCKED PRESS WILL HANG for the lifetime of the
     * dialog. Park it and poll `_batchDialogOpen` instead. Recorded because the
     * BG-P2 gate probe did exactly that and had to be killed.
     * @private
     */
    async _handleDescribeAll() {
      if (this._editAltGenerating === true) {
        logInfo("_handleDescribeAll: blocked — a per-field run is in flight");
        this._refreshDescribeAllControl();
        this._announceDescribeAllBlocked("run");
        return;
      }

      // A2 — the LOCK. A batch write into an open edit view leaves the save
      // baseline stale, and a later Save silently reverts the batch's work.
      if (this._isEditViewOpen()) {
        logInfo("_handleDescribeAll: blocked — the edit view is open");
        this._refreshDescribeAllControl();
        this._announceDescribeAllBlocked("edit");
        return;
      }

      if (this._batchDialogOpen) {
        logWarn("_handleDescribeAll: a batch dialog is already open; ignoring re-entry");
        return;
      }

      await this._openBatchDialog();
    }

    /**
     * Parcel BG-P2 — open the batch dialog and drive the run (A1, A3).
     *
     * A SIBLING UniversalModal over the manager, copying _promptFieldSelection
     * in every particular: markup built in JS, buttons wired in onOpen against
     * instance.modal, a resolve-once guard, the distinctive class stamped in
     * onOpen because the shim does not forward `className`, and onClose
     * resolving before it clears the re-entry flag.
     * @private
     */
    async _openBatchDialog() {
      const registry = this.restorer?.imageRegistry;
      const runnerModule = window.MathPixAltTextBatchRunner;

      if (!runnerModule || typeof runnerModule.create !== "function") {
        logWarn("_openBatchDialog: MathPixAltTextBatchRunner unavailable");
        this._showStatus("Batch description is unavailable.", "error");
        return;
      }

      const allEntries =
        registry && typeof registry.getAllImages === "function"
          ? registry.getAllImages()
          : [];
      // Uncovered-only targeting (A6) comes from the RUNNER, never re-derived
      // here — one predicate, one place.
      const targets = runnerModule.selectTargets(allEntries);

      if (targets.length === 0) {
        logInfo("_openBatchDialog: no uncovered targets");
        this._showStatus(BATCH_NO_TARGETS_TEXT, "info");
        return;
      }

      this._batchDialogOpen = true;

      return new Promise((resolve) => {
        let resolved = false;
        const resolveOnce = (value) => {
          if (resolved) return;
          resolved = true;
          resolve(value);
        };

        const modal = new UniversalModal.Modal({
          title: BATCH_DIALOG_TITLE,
          content: this._buildBatchDialogHTML(targets.length),
          size: "small",
          className: BATCH_DIALOG_CLASS,
          // Escape, the X and the overlay all close. While a run is in flight
          // that close acts as CANCEL — see the onClose handler.
          closeOnOverlayClick: true,
          onOpen: (instance) => {
            // The shim does not forward `className`, so stamp it on the live
            // dialog here or the stylesheet and the guard rows will not bind.
            if (instance.modal) {
              instance.modal.classList.add(BATCH_DIALOG_CLASS);
            }
            const root = instance.modal;
            if (root && typeof window.refreshIcons === "function") {
              window.refreshIcons(root);
            }

            const confirmBtn = root
              ? root.querySelector(`#${BATCH_CONFIRM_BTN_ID}`)
              : null;
            const cancelBtn = root
              ? root.querySelector(`#${BATCH_CANCEL_BTN_ID}`)
              : null;
            const closeBtn = root
              ? root.querySelector(`#${BATCH_CLOSE_BTN_ID}`)
              : null;

            if (confirmBtn) {
              confirmBtn.addEventListener("click", () => {
                this._runBatch({ instance, root, targets, resolveOnce });
              });
            } else {
              logWarn("_openBatchDialog: confirm button not found in DOM");
            }

            if (cancelBtn) {
              // A7 — Cancel sets the flag and STAYS IN THE DIALOG. It is never
              // removed and never gains the `disabled` property, because the
              // person who pressed it is focused on it and removing a focused
              // control drops focus to the document.
              cancelBtn.addEventListener("click", () => {
                if (this._batchRunner) this._batchRunner.cancel();
                cancelBtn.setAttribute("aria-disabled", "true");
                logInfo("_openBatchDialog: cancel pressed; the in-flight image will finish");
              });
            } else {
              logWarn("_openBatchDialog: cancel button not found in DOM");
            }

            if (closeBtn) {
              closeBtn.addEventListener("click", () => instance.close());
            } else {
              logWarn("_openBatchDialog: close button not found in DOM");
            }
          },
          onClose: () => {
            // THE SETTLED DECISION — closing mid-run acts as CANCEL. The
            // in-flight image finishes and is written (A5's no-mid-flight-abort
            // is unchanged); the loop stops; and the outcome line REDIRECTS to
            // the manager's own host, because this dialog is going away and its
            // host goes with it. Still exactly two lines: the pin is honoured by
            // redirect, not by dropping a line.
            if (this._batchRunning) {
              this._batchClosedMidRun = true;
              if (this._batchRunner) this._batchRunner.cancel();
              logInfo("_openBatchDialog: closed mid-run — treating as cancel, outcome will redirect");
            }
            resolveOnce(null);
            this._batchDialogOpen = false;
          },
        });

        modal.open();

        // NO STATUS LINE IS WRITTEN HERE, AND THAT IS THE PARCEL (F1-FIX).
        // The first of the two spoken lines used to be emitted on this line,
        // immediately after open(). Two symptoms, one moment: a sighted person
        // saw a notification stating the run had begun while the dialog was
        // still asking them to confirm it, and a screen-reader user heard
        // NOTHING — zero utterances across two journeys, on the stubbed engine
        // and on the real one, with the write demonstrably arriving by element
        // identity. The start line now fires from _runBatch, on RUN START,
        // which is what A10 meant by "one at start", and it was HEARD there on
        // real NVDA the same day. See the F1 item in the phase 3 breakdown, and
        // bg-p3-listen-2026-08-18.md — section 6 for the defect, section 10 for
        // the fix and the confirmed mechanism.
      });
    }

    /**
     * Parcel BG-P2 — drive the runner and place the outcome line.
     * @private
     */
    async _runBatch({ instance, root, targets, resolveOnce }) {
      const runnerModule = window.MathPixAltTextBatchRunner;
      const orchestrator = this._buildBatchOrchestrator(root);

      if (!orchestrator) {
        logWarn("_runBatch: could not build a batch orchestrator");
        this._showStatus("Batch description is unavailable.", "error");
        return;
      }

      this._batchRunner = runnerModule.create({ orchestrator });
      this._batchRunning = true;
      this._batchClosedMidRun = false;

      // THE FIRST OF THE TWO SPOKEN LINES (A10), MOVED HERE BY F1-FIX from
      // _openBatchDialog, where it fired on dialog OPEN. It now fires on RUN
      // START — the person has pressed the confirm control, so the line
      // describes something that is actually happening, and the batch dialog's
      // own status host has existed for as long as the person took to read the
      // dialog rather than for microseconds. It is placed AFTER the
      // orchestrator check deliberately: a build that cannot describe anything
      // must not announce that it is describing.
      //
      // The count goes through the WORD filler, not the digit one, so the start
      // line and the outcome line speak the same convention (A9). The singular
      // branch needs no substitution: it carries "one" already.
      const startLine =
        targets.length === 1
          ? BATCH_START_LINE_SINGULAR
          : this._fillBatchCountWord(
              BATCH_START_LINE_PLURAL,
              targets.length,
              runnerModule,
            );
      UniversalModal.showStatus(startLine, BATCH_START_STATUS_TYPE);
      this._batchSpokenLines = 1;

      this._showBatchView(root, BATCH_RUNNING_VIEW_ID);

      const countEl = root ? root.querySelector(`#${BATCH_PROGRESS_COUNT_ID}`) : null;
      const stageEl = root ? root.querySelector(`#${BATCH_PROGRESS_STAGE_ID}`) : null;
      const timeEl = root ? root.querySelector(`#${BATCH_PROGRESS_TIME_ID}`) : null;

      // Elapsed time, VISUAL ONLY, on a plain interval into a non-live element.
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (timeEl) {
          const seconds = Math.floor((Date.now() - startedAt) / 1000);
          timeEl.textContent = `Elapsed: ${seconds}s`;
        }
      }, 1000);

      let result = null;
      try {
        result = await this._batchRunner.run({
          targets,
          onProgress: ({ phase, index, total }) => {
            if (phase !== runnerModule.PHASE.STARTING) return;
            if (countEl) countEl.textContent = `${index + 1} of ${total}`;
            if (stageEl) {
              stageEl.textContent = this._fillBatchCount(
                BATCH_RUNNING_STAGE_TEXT.replace("{index}", String(index + 1)),
                total,
              ).replace("{total}", String(total));
            }
          },
        });
      } catch (batchErr) {
        logError("_runBatch: the batch loop threw", batchErr);
      } finally {
        clearInterval(timer);
        this._batchRunning = false;
      }

      // Refresh the grid and the counters — the registry has moved.
      try {
        this.refresh();
      } catch (refreshErr) {
        logWarn("_runBatch: grid refresh failed after the batch", refreshErr);
      }

      // THE SECOND OF THE TWO SPOKEN LINES (A10). It is the RUNNER'S OWN
      // composed line, passed through verbatim — never recomposed here, so the
      // taxonomy lives in exactly one place.
      const outcomeLine = result ? result.line : null;
      if (!outcomeLine) {
        logWarn("_runBatch: the runner returned no composed line; nothing to speak");
        return;
      }

      if (this._batchClosedMidRun) {
        await this._announceBatchOutcomeRedirected(outcomeLine);
        return;
      }

      // Ordinary completion (A3): the dialog STAYS OPEN and carries its own
      // line, so no teardown-settle race is entered at all.
      // F9-FIX — ONE VISIBLE SENTENCE. The outcome was written twice: into
      // a paragraph in the completion view, and through showStatus. Both
      // were on screen at the same moment, so a sighted person read the
      // sentence twice where a reader heard it once.
      //
      // showStatus is the survivor, and the choice was FORCED rather than
      // preferred: the status band renders its message into the very node
      // that carries the announcement, so the visible line and the spoken
      // line cannot be separated through this API. Removing that half
      // would have taken the second spoken line with it — the line A10
      // pins and F1-FIX has only just heard.
      //
      // The paragraph was not buying persistence the band lacks. Measured
      // on this path: showStatus is passed no duration, and the modal
      // status area auto-hides only on a duration, so the band holds the
      // sentence for as long as the dialog is open. (The manager-level
      // _showStatus helper DOES auto-hide success after 3s, but that
      // helper is on the redirect path, not this one.)
      this._showBatchView(root, BATCH_COMPLETE_VIEW_ID);
      UniversalModal.showStatus(outcomeLine, BATCH_OUTCOME_STATUS_TYPE);
      this._batchSpokenLines = (this._batchSpokenLines || 0) + 1;
      logInfo(`_runBatch: outcome spoken from the batch dialog's own host — ${outcomeLine}`);
    }

    /**
     * Parcel BG-P2 — the REDIRECT path: the dialog was closed mid-run, so its
     * status host went with it and the outcome line must land on the MANAGER's.
     *
     * The settle is READ FROM THE MODULE'S OWN CONSTANT, never restated, so
     * retuning it retunes this path too. It is the dialog-scale settle because
     * this is a dialog-scale teardown — a nested modal closing over the manager
     * — which is the event REMOVE_ANNOUNCE_SETTLE_MS was measured against.
     *
     * Still the SECOND line, not a third: the pin is honoured by redirecting
     * where the outcome is spoken, not by adding a voice.
     * @private
     */
    async _announceBatchOutcomeRedirected(outcomeLine) {
      await this._waitForOwnModalTop();
      await new Promise((resolve) =>
        setTimeout(resolve, REMOVE_ANNOUNCE_SETTLE_MS),
      );
      // _showStatus writes the visible line and the announcement in one call,
      // through the manager's own host. No announce() beside it.
      this._showStatus(outcomeLine, BATCH_OUTCOME_STATUS_TYPE);
      this._batchSpokenLines = (this._batchSpokenLines || 0) + 1;
      logInfo(
        `_runBatch: dialog closed mid-run — outcome REDIRECTED to the manager's host after ` +
          `${REMOVE_ANNOUNCE_SETTLE_MS}ms — ${outcomeLine}`,
      );
    }

    /**
     * Build an orchestrator for the batch, wired to the SILENT progress
     * controller. Separate from `_editAltOrchestrator` on purpose: that one is
     * view-scoped and would suppress or misdirect writes with no edit view open.
     * @private
     */
    _buildBatchOrchestrator(root) {
      if (
        typeof window.MathPixAltTextCloudAdapter?.create !== "function" ||
        typeof window.MathPixAltTextOrchestrator?.create !== "function"
      ) {
        logWarn("_buildBatchOrchestrator: an alt-text engine factory is unavailable");
        return null;
      }
      try {
        const adapter =
          this._editAltAdapter ||
          window.MathPixAltTextCloudAdapter.create({ embed: this._editAltEmbed });
        const orchestrator = window.MathPixAltTextOrchestrator.create({
          adapter,
          progress: this._makeBatchProgressController(root),
        });

        // MATERIALISE LAZILY, IN A WRAPPER, one image at a time.
        //
        // The runner hands the orchestrator whatever `image` its target
        // carried, and a registry entry carries none — the bytes come from
        // _materialiseImageFile, which reads the restorer's blob and filename
        // maps. Doing it here rather than in the runner is what keeps A4's
        // no-DOM rule intact: the runner stays drivable with no page. Doing it
        // per image rather than up front matters too, because a batch over
        // eleven images would otherwise hold eleven files in memory before the
        // first call, and a cancel would have paid for all of them.
        //
        // A materialisation failure is reported to the runner as a contract
        // error, which is exactly how it is already counted: one failed image,
        // the loop continues.
        return {
          run: async (runOptions) => {
            const r = runOptions || {};
            let image = r.image;
            if (!image) {
              const entry = this.restorer?.imageRegistry?.getImage(r.id);
              try {
                image = await this._materialiseImageFile(entry, r.id);
              } catch (error) {
                const message =
                  error && error.message ? error.message : String(error);
                logWarn(
                  `_buildBatchOrchestrator: materialisation failed for ${r.id}: ${message}`,
                );
                return { status: "error", result: { error: message } };
              }
            }
            return orchestrator.run({ ...r, image });
          },
        };
      } catch (error) {
        logWarn(
          `_buildBatchOrchestrator: construction failed: ${
            error && error.message ? error.message : String(error)
          }`,
        );
        return null;
      }
    }

    /**
     * Parcel 8e-2 — compose one spoken line from a template and a field key.
     *
     * 8e-2b moved the substitution itself out to the module-level
     * composeAcceptText, which the button labels now share. This method stays as
     * the SPOKEN-LINE entry point rather than being inlined at its two call
     * sites, because the guard rows and the coverage-clause markers are scoped
     * to it: a named seam is what lets "no clause on the accept line" be
     * asserted about a place rather than about the whole file.
     *
     * DELIBERATELY does not call _withCoverageClause. Accepting moves no
     * coverage, so the clause would repeat an unchanged number and imply
     * something happened. A guard row pins its absence.
     *
     * @param {string} template - ACCEPT_SUCCESS_TEMPLATE or ACCEPT_REFUSAL_TEMPLATE.
     * @param {string} fieldKey - one of the four content field keys.
     * @returns {string}
     * @private
     */
    _composeAcceptLine(template, fieldKey) {
      return composeAcceptText(template, fieldKey);
    }

    /**
     * Parcel 8e-2 — the gesture. Accept one field, then report.
     *
     * ── The control STAYS IN PLACE ───────────────────────────────────────────
     * On success it becomes aria-disabled and its visible text changes; it is
     * never removed and never gains the `disabled` property. Removing a control
     * at the instant of its own activation destroys focus, and `disabled` would
     * drop it out of the tab order and take focus with it — this project has
     * already paid for that once. aria-disabled plus a handler guard is the
     * parcel 7 precedent the Generate button already follows.
     *
     * FOCUS MUST NOT MOVE. Nothing here calls focus(), and the button is not
     * replaced, so document.activeElement is unchanged across the handler.
     *
     * ONE notify call on either branch. No announce() beside it: both toast
     * systems already announce through the shared announcer, so a second call
     * would speak the line twice.
     *
     * @param {string} fieldKey - one of the four content field keys.
     * @private
     */
    _handleAcceptField(fieldKey) {
      const ids = FIELD_IDS[fieldKey];
      const button = ids ? document.getElementById(ids.accept) : null;

      // The real guard behind aria-disabled — a second press after acceptance
      // must do nothing at all, not re-enter the write path.
      if (button && button.getAttribute("aria-disabled") === "true") {
        logDebug(
          `_handleAcceptField: ${fieldKey} already accepted this open — ignoring`,
        );
        return;
      }

      const imageId = this._currentEditImageId;
      if (!imageId) {
        logWarn("_handleAcceptField: no image open in the edit view — ignoring");
        return;
      }

      const verdict = this._acceptField(imageId, fieldKey);

      if (verdict && verdict.accepted) {
        // The pill was already refreshed inside _acceptField. Do not refresh it
        // again here — a second write repaints state this gesture did not change.
        if (button) {
          button.setAttribute("aria-disabled", "true");
          this._setAcceptButtonLabel(
            button,
            ACCEPT_BUTTON_REVIEWED_TEMPLATE,
            fieldKey,
          );
        }
        notifySuccess(this._composeAcceptLine(ACCEPT_SUCCESS_TEMPLATE, fieldKey));
        logInfo(`_handleAcceptField: ${fieldKey} accepted and reported`);
        return;
      }

      // Refused: the control stays ACTIVE and nothing was written. notifyWarning
      // rather than notifySuccess — this is an outcome the person did not get,
      // and the edit view's other outcomes already route through the notify
      // toasts, which announce through the shared long-lived region.
      notifyWarning(this._composeAcceptLine(ACCEPT_REFUSAL_TEMPLATE, fieldKey));
      logInfo(
        `_handleAcceptField: ${fieldKey} refused (${verdict ? verdict.reason : "no verdict"}) — control left active`,
      );
    }

    // ------------------------------------------------------------------------
    // Focus helpers (Q8). Declared in Chunk 3a; wired into save / Back / X
    // flows by Chunk 4. _focusEditHeading is already triggered by
    // openEditAltText above.
    // ------------------------------------------------------------------------

    /**
     * Focus the edit view's <h2> heading. Q8a — heading announces the new
     * context to screen readers ("Edit alt text for X, heading level 2").
     * The heading has tabindex="-1" so it's programmatically focusable
     * without being in the natural tab order.
     * @private
     */
    _focusEditHeading() {
      logInfo("_focusEditHeading");
      const heading = document.getElementById(EDIT_VIEW_HEADING_ID);
      if (heading && typeof heading.focus === "function") {
        heading.focus();
      } else {
        logWarn(
          "_focusEditHeading: heading element not found or not focusable",
        );
      }
    }

    /**
     * Focus the Alt button on the card matching the given image ID. Q8b
     * focus-return target after Back / Save flow (wired by Chunk 4).
     * @param {string} imageId
     * @returns {boolean} true if focus landed, false if the card is gone.
     * @private
     */
    _focusCardAltBtn(imageId) {
      logInfo(`_focusCardAltBtn(${imageId})`);
      const btn = document.querySelector(altButtonSelectorForId(imageId));
      if (btn && typeof btn.focus === "function") {
        btn.focus();
        return true;
      }
      logDebug(`_focusCardAltBtn: no Alt button matches image ID "${imageId}"`);
      return false;
    }

    /**
     * Card-missing fallback chain per Q8e. Used by Chunk 4 when the card
     * the user came from no longer exists on return (rare — would require
     * registry changes from outside the form).
     *
     * Order:
     *   1. First available Alt button in the grid.
     *   2. Grid region heading.
     *   3. Modal main heading.
     *
     * (Step 1 of the Q8e chain — "alt button matching the image ID" — is
     * covered by _focusCardAltBtn() being tried first by the caller.
     * _focusGridFallback() starts at Q8e step 2.)
     *
     * @returns {boolean} true if focus landed somewhere, false if nothing
     *   focusable was reachable.
     * @private
     */
    _focusGridFallback() {
      logInfo("_focusGridFallback");

      // Q8e step 2: first available Alt button in the grid.
      const firstAltBtn = document.querySelector(".image-manager-alt-btn");
      if (firstAltBtn && typeof firstAltBtn.focus === "function") {
        firstAltBtn.focus();
        return true;
      }

      // Q8e step 3: grid region heading.
      const gridHeading = document.getElementById(GRID_REGION_HEADING_ID);
      if (gridHeading && typeof gridHeading.focus === "function") {
        // Headings aren't focusable by default; setTabindex if missing so
        // the focus call lands. This is one-shot and doesn't pollute tab
        // order because the heading already exists in the layout.
        if (!gridHeading.hasAttribute("tabindex")) {
          gridHeading.setAttribute("tabindex", "-1");
        }
        gridHeading.focus();
        return true;
      }

      // Q8e step 4: modal main heading (UniversalModal's <h1>).
      const modalHeading = document.querySelector(MODAL_TITLE_SELECTOR);
      if (modalHeading && typeof modalHeading.focus === "function") {
        modalHeading.focus();
        return true;
      }

      logWarn("_focusGridFallback: no fallback target found");
      return false;
    }

    /**
     * Parcel g-9. The position of one image in the registry's own order.
     *
     * Card order matches this order by construction: refresh() maps over
     * getAllImages(), which iterates the registry's Map, and a Map preserves
     * insertion order across a delete. So an index read here addresses the same
     * slot in the rebuilt grid.
     *
     * MUST be called BEFORE the delete. The ordering it reads is destroyed by
     * the delete and the rebuild that follows it, so afterwards there is nothing
     * left to read the position from.
     *
     * @param {string} imageId
     * @returns {number} zero-based index, or -1 if the id is not present.
     * @private
     */
    _registryIndexOf(imageId) {
      const registry = this.restorer ? this.restorer.imageRegistry : null;
      if (!registry || typeof registry.getAllImages !== "function") {
        logWarn("_registryIndexOf: no registry available");
        return -1;
      }
      const index = registry.getAllImages().findIndex((e) => e.id === imageId);
      logDebug(`_registryIndexOf(${imageId}) = ${index}`);
      return index;
    }

    /**
     * Parcel g-9. Which card should hold focus after a deletion.
     *
     * Matthew's decision: the person KEEPS THEIR PLACE and carries on with the
     * next image, rather than being sent back to the top of an eleven-image
     * list. So the target is the card that has moved INTO the deleted slot —
     * the same index, which is now the next image along.
     *
     * The one special case is deleting the last card: that slot no longer
     * exists, so the target clamps to the new last card.
     *
     * Kept separate from the focus call on purpose. The arithmetic is the part
     * with edge cases and it is the part a guard row can assert directly,
     * without a drive and without touching the registry.
     *
     * @param {number} deletedIndex - index the deleted image occupied.
     * @param {number} remainingCount - registry count AFTER the delete.
     * @returns {number|null} index to focus, or null when there is no valid
     *   target (nothing remaining, or an index that was never resolved).
     * @private
     */
    _altBtnIndexAfterDeletion(deletedIndex, remainingCount) {
      if (typeof remainingCount !== "number" || remainingCount < 1) return null;
      if (typeof deletedIndex !== "number" || deletedIndex < 0) return null;
      // Deleting the last card clamps to the new last card; every other
      // deletion keeps the same index, which now holds the next image.
      return Math.min(deletedIndex, remainingCount - 1);
    }

    /**
     * Parcel g-9. Focus the alt button of the card that took the deleted card's
     * place, and VERIFY THE LANDING.
     *
     * WHY THE VERIFICATION IS NOT OPTIONAL. A focus() call that looks perfect
     * can move nothing, silently, with no error thrown — that has happened four
     * times in this lane. Parcel g-9a measured both failure modes and they have
     * NO ATTRIBUTE IN COMMON: the #main landmark fails with a readable `inert`
     * attribute, while a target outside the topmost modal dialog is blocked by
     * the top layer with no attribute anywhere in the chain, so
     * closest("[inert]") returns null on a call that lands nothing. Identity of
     * document.activeElement is therefore the only verdict that catches both,
     * and the diagnostics below are a COLUMN rather than the test.
     *
     * NO RETRY AND NO FALLBACK, deliberately. Turning a silent no-op into a
     * visible one is the whole point; a fallback would restore the silence one
     * level down, and on a failure the person is no worse off than before this
     * parcel. Every step guards and returns rather than throwing, because
     * nothing here may cost the caller its status announcement.
     *
     * @param {number} deletedIndex - index the deleted image occupied, read
     *   BEFORE the delete via _registryIndexOf.
     * @returns {boolean} true only if activeElement IS the intended target.
     * @private
     */
    _focusNextCardAltBtn(deletedIndex) {
      const grid = document.getElementById("image-manager-grid");
      if (!grid) {
        logWarn("_focusNextCardAltBtn: no grid on screen; focus not moved");
        return false;
      }

      const buttons = grid.querySelectorAll(".image-manager-alt-btn");
      if (!buttons.length) {
        logWarn(
          "_focusNextCardAltBtn: the rebuilt grid carries no Alt buttons; focus not moved",
        );
        return false;
      }

      const targetIndex = this._altBtnIndexAfterDeletion(
        deletedIndex,
        buttons.length,
      );
      if (targetIndex === null) {
        logWarn(
          `_focusNextCardAltBtn: no valid target for deletedIndex ${deletedIndex} ` +
            `against ${buttons.length} card(s); focus not moved`,
        );
        return false;
      }

      const target = buttons[targetIndex];
      if (!target || typeof target.focus !== "function") {
        logWarn(
          `_focusNextCardAltBtn: no focusable Alt button at index ${targetIndex}; focus not moved`,
        );
        return false;
      }

      target.focus();

      // THE VERDICT, by identity, immediately after the call.
      const landed = document.activeElement === target;
      if (landed) {
        logInfo(
          `_focusNextCardAltBtn: focus landed on the Alt button at index ${targetIndex} ` +
            `of ${buttons.length} ("${target.getAttribute("aria-label") || ""}")`,
        );
        return true;
      }

      // The diagnostic set from g-9a, printed beside the failure so the next
      // reader is not left to supply a causal story. openDialogs is the column
      // that distinguished the two failure modes when no attribute could.
      const rects =
        typeof target.getClientRects === "function"
          ? target.getClientRects().length
          : null;
      let display = null;
      try {
        display = window.getComputedStyle(target).display;
      } catch (e) {
        /* a detached node has no computed style */
      }
      const openDialogs = Array.from(
        document.querySelectorAll("dialog[open]"),
      ).map((d) => d.id || "(no id)");

      logWarn(
        `_focusNextCardAltBtn: focus did NOT land on the Alt button at index ${targetIndex} ` +
          `of ${buttons.length} ("${target.getAttribute("aria-label") || ""}") — ` +
          `clientRects=${rects}, display=${display}, isConnected=${target.isConnected}, ` +
          `tabIndex=${target.tabIndex}, openDialogs=[${openDialogs.join(", ")}], ` +
          `activeElement=${document.activeElement ? document.activeElement.tagName : "none"}`,
      );
      return false;
    }

    /**
     * Focus the original modal trigger. Q8c — when the X closes the
     * manager modal, focus returns to the button that opened it.
     *
     * The trigger is already stashed at open() time by Stage 4 (see
     * _triggerButton), and Stage 4's _returnFocus() implements the actual
     * focus call. This helper delegates to _returnFocus() to document
     * intent at Chunk 4 call sites — there is no separate Q8c focus
     * call to add; this is the symmetry stub.
     *
     * @private
     */
    _focusModalTrigger() {
      logInfo("_focusModalTrigger (delegating to _returnFocus)");
      this._returnFocus();
    }

    // ------------------------------------------------------------------------
    // Toggletip lifecycle (Q1). Caption toggletip is created on manager
    // open and destroyed on manager close — see open() and onClose below.
    // ------------------------------------------------------------------------

    /**
     * Create the Caption ⓘ toggletip and stash its ID. Idempotent: a
     * second call destroys any existing instance first so re-opens of the
     * manager don't leak orphan toggletips.
     * @private
     */
    _setupToggletips() {
      logInfo("_setupToggletips");

      if (!window.UniversalToggletip) {
        logError(
          "_setupToggletips: window.UniversalToggletip is not available",
        );
        return;
      }

      // Idempotency: tear down any prior instance before creating a new one.
      if (this._captionToggletipId) {
        this._destroyToggletips();
      }

      const trigger = document.getElementById(FIELD_IDS.caption.toggletip);
      if (!trigger) {
        logWarn("_setupToggletips: caption toggletip trigger not in DOM");
        return;
      }

      this._captionToggletipId = window.UniversalToggletip.create({
        trigger,
        content: CAPTION_TOGGLETIP_CONTENT,
        position: TOGGLETIP_POSITION,
        type: TOGGLETIP_TYPE,
      });

      logDebug(
        `_setupToggletips: caption toggletip created (id=${this._captionToggletipId})`,
      );

      // Re-parent the toggletip element into the dialog so it can render
      // above the modal. The manager modal is a native <dialog> opened with
      // showModal(), which enters the browser's top-layer — body-level
      // z-index cannot beat the top-layer regardless of CSS values.
      // Re-parenting puts the toggletip in the same top-layer stacking
      // context as the dialog. See Phase D round 2 finding.
      const toggletipEl = document.getElementById(this._captionToggletipId);
      // The .image-manager-modal-wrapper className is applied to a container,
      // not the dialog itself. Walk up from the trigger (which is inside the
      // modal's edit view) to find the nearest <dialog> ancestor — that's the
      // manager's dialog regardless of which classes UniversalModal applies.
      const dialog = trigger.closest("dialog");
      if (toggletipEl && dialog) {
        dialog.appendChild(toggletipEl);
        logDebug("_setupToggletips: toggletip moved into dialog top-layer");
      } else {
        if (!toggletipEl) {
          logWarn(
            "_setupToggletips: toggletip element not found in DOM after create()",
          );
        }
        if (!dialog) {
          logWarn(
            "_setupToggletips: could not find dialog ancestor of toggletip trigger",
          );
        }
      }
    }

    /**
     * Destroy the Caption toggletip created by _setupToggletips. Called
     * from UniversalModal's onClose so the toggletip's globally-stored
     * DOM and event listeners don't leak across manager open/close cycles.
     * @private
     */
    _destroyToggletips() {
      if (!this._captionToggletipId) return;

      logInfo(`_destroyToggletips: destroying ${this._captionToggletipId}`);

      if (window.UniversalToggletip?.destroy) {
        window.UniversalToggletip.destroy(this._captionToggletipId);
      }
      this._captionToggletipId = null;
    }

    /**
     * Attach edit-view event listeners. Called from open() after the
     * modal DOM is built. Chunk 3a wires only the Back button. Chunk 3b
     * adds field-input listeners; Chunk 4 wires the Save button.
     * @private
     */
    _attachEditViewListeners() {
      const backBtn = document.getElementById(EDIT_VIEW_BACK_BTN_ID);
      if (backBtn) {
        // Chunk 4b — Back routes through _performSave per Q10. Clean
        // form is a silent close (handled inside _performSave); dirty
        // form saves through to the MMD with an in-modal Undo toast.
        backBtn.addEventListener("click", () => this._performSave());
        logDebug("_attachEditViewListeners: Back button wired");
      } else {
        logWarn("_attachEditViewListeners: Back button not in DOM");
      }

      // Chunk 4a — Save button. Fires _performSave (Q5c six-step
      // sequence). No disabled-during-save state in 4a per the
      // discovery (B6) and Phase B sign-off — add a _savingInFlight
      // guard only if smoke testing surfaces re-entrancy.
      const saveBtn = document.getElementById(EDIT_VIEW_SAVE_BTN_ID);
      if (saveBtn) {
        saveBtn.addEventListener("click", () => this._performSave());
        logDebug("_attachEditViewListeners: Save button wired");
      } else {
        logWarn("_attachEditViewListeners: Save button not in DOM");
      }

      // Cycle 2b — Generate button. Fires the alt-text run pipeline built by
      // _constructEditAltRunPipeline; the handler owns the in-flight guard.
      const generateBtn = document.getElementById(EDIT_VIEW_GENERATE_BTN_ID);
      if (generateBtn) {
        generateBtn.addEventListener("click", () =>
          this._handleGenerateAltText(),
        );
        logDebug("_attachEditViewListeners: Generate button wired");
      } else {
        logWarn("_attachEditViewListeners: Generate button not in DOM");
      }

      // Parcel 8e-2 — the four accept controls. addEventListener, matching Back,
      // Save and Generate above; the onclick-attribute form in this file appears
      // only on grid cards. Iterated over FIELD_SELECT_ROWS rather than written
      // out four times because that list already ties the field keys together
      // and _acceptField reads the same rows — four hand-copied blocks is how
      // one of them comes to be wired to the wrong key.
      for (const row of FIELD_SELECT_ROWS) {
        const acceptBtn = document.getElementById(FIELD_IDS[row.key].accept);
        if (acceptBtn) {
          acceptBtn.addEventListener("click", () =>
            this._handleAcceptField(row.key),
          );
          logDebug(`_attachEditViewListeners: accept button wired (${row.key})`);
        } else {
          logWarn(
            `_attachEditViewListeners: accept button not in DOM (${row.key})`,
          );
        }
      }

      // Phase D round 3 — Escape cascade inside the manager:
      //   1. grid view shown (edit view hidden) → let UA close the dialog
      //   2. edit view shown + toggletip open   → close toggletip only
      //   3. edit view shown + no toggletip     → close edit view, return to grid
      //
      // The listener attaches to the <dialog> itself rather than the edit-view
      // section because _setupToggletips() re-parents the toggletip element
      // onto the dialog as a sibling of the edit view. When the toggletip is
      // open and focus is inside the toggletip, keydown bubbles up to the
      // dialog WITHOUT passing through the edit view section. A section-level
      // listener would never fire and the UA's native dialog-Escape would
      // close the manager. A dialog-level listener catches Escape regardless
      // of which descendant has focus.
      //
      // For case 2 + 3 we preventDefault + stopPropagation because the
      // manager modal is a native <dialog>, which has UA-level
      // Escape-to-close behaviour.
      const section = document.getElementById(EDIT_VIEW_CONTAINER_ID);
      const dialog = section ? section.closest("dialog") : null;
      if (dialog && section) {
        dialog.addEventListener("keydown", (e) => {
          if (e.key !== "Escape") return;
          if (section.hidden) return; // edit view not visible; let modal handle Escape

          e.preventDefault();
          e.stopPropagation();

          if (window.UniversalToggletip?.isActive?.()) {
            // Toggletip is open — close it via the tracked ID. The library
            // doesn't expose closeAll() despite the README mentioning it;
            // hide(id) is the documented per-toggletip close path.
            if (this._captionToggletipId && window.UniversalToggletip?.hide) {
              window.UniversalToggletip.hide(this._captionToggletipId);
            }
            logInfo("Escape: closing open toggletip");
            return;
          }

          // Chunk 4b — Escape-in-edit-view routes through _performSave
          // for consistency with Back (same user intent: return to
          // grid). Clean form is a silent close; dirty saves. Ctrl-Z
          // in the MMD editor remains as the deliberate discard
          // affordance (Q4 §197).
          logInfo("Escape: routing to _performSave (Chunk 4b)");
          this._performSave();
        });
        logDebug("_attachEditViewListeners: dialog-level Escape handler wired");
      } else {
        if (!section) {
          logWarn("_attachEditViewListeners: edit view section not in DOM");
        }
        if (section && !dialog) {
          logWarn(
            "_attachEditViewListeners: edit view section has no dialog ancestor",
          );
        }
      }

      // Chunk 3b: form-state reactivity (decorative toggle, character
      // counts, dirty tracking, banner, Q2 hint).
      this._attachFormReactivityListeners();
    }

    /**
     * Construct the silent embed on the hidden AI sink, once per manager
     * open. The sink stays display:none, so the aria-live the embed stamps
     * on it is inert (absent from the accessibility tree). Cycle 2 reads
     * this._editAltEmbed at click time to run a generate. Degrades to null
     * on any failure so a missing dependency never breaks the manager open.
     * @private
     */
    _constructEditAltEmbed() {
      this._editAltEmbed = null;

      const sink = document.getElementById(EDIT_VIEW_AI_EMBED_SINK_ID);
      if (!sink) {
        logWarn(
          `_constructEditAltEmbed: sink #${EDIT_VIEW_AI_EMBED_SINK_ID} not in DOM; skipping`,
        );
        return;
      }

      if (typeof window.OpenRouterEmbed !== "function") {
        logWarn(
          "_constructEditAltEmbed: window.OpenRouterEmbed unavailable; skipping",
        );
        return;
      }

      try {
        this._editAltEmbed = new window.OpenRouterEmbed({
          containerId: EDIT_VIEW_AI_EMBED_SINK_ID,
          showNotifications: false,
          showStreamingProgress: false,
        });
        logInfo("_constructEditAltEmbed: embed constructed on the silent sink");
      } catch (error) {
        this._editAltEmbed = null;
        logWarn(
          `_constructEditAltEmbed: construction failed, leaving embed null: ${
            error && error.message ? error.message : String(error)
          }`,
        );
      }
    }

    /**
     * Construct the adapter, progress controller and orchestrator on top of the
     * cycle-1 embed, once per manager open. The adapter bakes the silent embed;
     * the progress controller drives the single live channel (#edit-alt-ai-status);
     * the orchestrator owns the run choreography. Cycle 2b's button handler reads
     * this._editAltOrchestrator at click time. Degrades all three to null on any
     * failure so a missing engine never breaks the manager open.
     * @private
     */
    _constructEditAltRunPipeline() {
      this._editAltAdapter = null;
      this._editAltProgress = null;
      this._editAltProgressScoped = null;
      this._editAltOrchestrator = null;
      // Parcel 8d-pre-strand: the image id the in-flight run belongs to, or null
      // between runs. Read by _viewStillShows to decide whether a run-driven
      // write is still addressed to the view the person is looking at.
      this._activeRunImageId = null;

      if (!this._editAltEmbed) {
        logWarn(
          "_constructEditAltRunPipeline: no embed; run pipeline unavailable",
        );
        return;
      }

      const statusEl = document.getElementById(EDIT_VIEW_AI_STATUS_ID);
      if (!statusEl) {
        logWarn(
          `_constructEditAltRunPipeline: status region #${EDIT_VIEW_AI_STATUS_ID} not in DOM; run pipeline unavailable`,
        );
        return;
      }

      if (
        typeof window.MathPixAltTextCloudAdapter?.create !== "function" ||
        typeof window.MathPixAltTextProgress?.create !== "function" ||
        typeof window.MathPixAltTextOrchestrator?.create !== "function"
      ) {
        logWarn(
          "_constructEditAltRunPipeline: an alt-text engine factory is unavailable; run pipeline unavailable",
        );
        return;
      }

      try {
        this._editAltAdapter = window.MathPixAltTextCloudAdapter.create({
          embed: this._editAltEmbed,
        });
        // 8d-pre — give the controller somewhere to paint. progressBar and
        // progressFill are deliberately NOT passed: there is no bar in the edit
        // view (see the template comment). updateProgressBar() reads both as
        // direct properties behind `if` guards, never through ref(), so their
        // absence is silent rather than a warn-per-write.
        const progressEl = document.getElementById(EDIT_VIEW_AI_PROGRESS_ID);
        const progressStageEl = document.getElementById(
          EDIT_VIEW_AI_PROGRESS_STAGE_ID,
        );
        const progressTimeEl = document.getElementById(
          EDIT_VIEW_AI_PROGRESS_TIME_ID,
        );

        // getIcon is NOT optional. Without it buildStageLabel falls back to an
        // aria-hidden span wrapping the icon NAME, painting the literal token
        // "aiSparkle" on screen (observed 30 July 2026). It reads no `this`, so
        // passing it unbound is safe (measured). If the library is missing we
        // warn loudly and continue — the guard row catches it.
        const iconFn = window.IconLibrary?.getIcon;
        if (typeof iconFn !== "function") {
          logWarn(
            "_constructEditAltRunPipeline: window.IconLibrary.getIcon is " +
              "unavailable — the stage label will render the raw icon token " +
              "instead of an icon",
          );
        }

        this._editAltProgress = window.MathPixAltTextProgress.create({
          elements: {
            status: statusEl,
            progress: progressEl,
            progressStage: progressStageEl,
            progressTime: progressTimeEl,
          },
          deps: {
            getIcon: iconFn,
            // Each timer function is wrapped in an arrow so none is invoked
            // unbound — they are host methods and need `window` as receiver.
            clock: {
              now: () => Date.now(),
              setInterval: (fn, ms) => window.setInterval(fn, ms),
              clearInterval: (handle) => window.clearInterval(handle),
            },
          },
        });
        // Parcel 8d-pre-strand: the orchestrator writes the run's OUTCOME line
        // and its stage labels itself (alt-text-orchestrator.js — showStatus,
        // showError, showProgress). Those are view-specific writes made from a
        // view-agnostic collaborator, so guarding the success branch in this file
        // would NOT have stopped image A's "AI description generated." landing in
        // image B's status region. It is stopped here instead, by giving the
        // orchestrator a view-scoped facade rather than the raw controller.
        //
        // The identity test is evaluated per CALL, not once at construction,
        // because the view can move at any moment during a run. hideProgress is
        // ALWAYS forwarded: it is unconditional teardown, and a run that ends
        // after the person has left must still stop the timer and hide the block.
        this._editAltProgressScoped = {
          showProgress: (stage) => {
            if (!this._viewStillShows(this._activeRunImageId)) {
              logDebug(
                `_editAltProgressScoped: showProgress("${stage}") suppressed — view moved on`,
              );
              return undefined;
            }
            return this._editAltProgress.showProgress(stage);
          },
          showStatus: (message, type) => {
            if (!this._viewStillShows(this._activeRunImageId)) {
              // Parcel 8d-notify: RE-ROUTED, not merely suppressed. Suppressing
              // this line is still correct for the EDIT VIEW — it belongs to a
              // different image than the one on screen — but dropping it
              // entirely left the run ending in silence. It is re-spoken on the
              // modal's own status region instead, named so the person knows
              // which image finished. See _announceRunCompleteOutOfView.
              //
              // This branch is only ever reached by the ORCHESTRATOR: the start
              // line and the materialisation-error line both go through
              // this._editAltProgress directly, not through this facade.
              logDebug(
                "_editAltProgressScoped: showStatus suppressed for the edit view — view moved on; re-routing to the modal status region",
              );
              this._announceRunCompleteOutOfView(message, type);
              return undefined;
            }
            return this._editAltProgress.showStatus(message, type);
          },
          showError: (message) => {
            if (!this._viewStillShows(this._activeRunImageId)) {
              // Parcel 8d-err: RE-ROUTED, not merely suppressed — the same move
              // the showStatus branch above made at 8d-notify, and for a sharper
              // reason. Suppressing this line is still correct for the EDIT VIEW
              // (it belongs to a different image than the one on screen), but
              // dropping it entirely left a failed run silent AFTER success had
              // been given a voice, so silence read as success.
              //
              // It is re-spoken on the modal's own status region, named, with
              // the contract error VERBATIM — the in-view line is the only other
              // place that text appears and nothing re-shows it later.
              //
              // This branch is only ever reached by the ORCHESTRATOR: the start
              // line and the materialisation-error line both go through
              // this._editAltProgress directly, not through this facade.
              logDebug(
                "_editAltProgressScoped: showError suppressed for the edit view — view moved on; re-routing to the modal status region",
              );
              this._announceRunFailedOutOfView(message);
              return undefined;
            }
            return this._editAltProgress.showError(message);
          },
          hideProgress: (showFinalTime) =>
            this._editAltProgress.hideProgress(showFinalTime),
        };

        this._editAltOrchestrator = window.MathPixAltTextOrchestrator.create({
          adapter: this._editAltAdapter,
          progress: this._editAltProgressScoped,
        });
        logInfo(
          "_constructEditAltRunPipeline: adapter, progress and orchestrator constructed",
        );
      } catch (error) {
        this._editAltAdapter = null;
        this._editAltProgress = null;
        this._editAltOrchestrator = null;
        logWarn(
          `_constructEditAltRunPipeline: construction failed, leaving pipeline null: ${
            error && error.message ? error.message : String(error)
          }`,
        );
      }
    }

    /**
     * Attach a capture-phase click listener to the manager modal's X
     * close button so we can intercept dirty-edit-view closes BEFORE
     * UniversalModal's bubble-phase listener fires modalManager.close
     * and tears down the modal DOM.
     *
     * _performSave's write path is synchronous (Phase B audit) but it
     * reads field values from the DOM at line 1867-1870. At click time
     * the DOM is still alive, so reads succeed; by the time onClose
     * fires (after teardown), it's gone — which is why Path 2 was
     * abandoned post-Smoke-Test-5.
     *
     * When _performSave finishes, _dirtyFields is null and the edit
     * view is hidden (step 5 — _closeEditAltText). The bubble-phase
     * listener then tears the modal down normally.
     *
     * Called from open() after the modal is rendered.
     *
     * @private
     */
    _attachXButtonInterceptor() {
      const modalEl = this.currentModal?.modal;
      const closeBtn =
        modalEl?.querySelector(".universal-modal-close") ||
        document.querySelector(".universal-modal-close");

      if (!closeBtn) {
        logWarn(
          "_attachXButtonInterceptor: X button not found — save-on-X will not fire",
        );
        return;
      }

      closeBtn.addEventListener(
        "click",
        () => {
          if (this._currentEditImageId && this._dirtyFields?.size > 0) {
            logInfo(
              "X button intercepted — saving dirty edit before modal close",
            );
            // forceToast: the bubble-phase X listener will tear down the
            // modal as soon as this handler returns, so the in-modal
            // status host would be destroyed before the user could see
            // the success toast (Discovery 19). Route to global toast
            // instead — it survives the close animation.
            this._performSave({ forceToast: true });
          }
        },
        { capture: true },
      );

      logDebug("X button interceptor attached");
    }

    // ========================================================================
    // STAGE 5 CHUNK 3b — FORM REACTIVITY
    //
    // Decorative-driven disable (Q3), character counts (Q7), value-dirty
    // tracking (Q3/Q4), banner visibility (Q6), and Q2 includegraphics-
    // clear hint with dual-toggle aria-describedby per discovery #8.
    // Save flow lands in Chunk 4.
    // ========================================================================

    /**
     * Attach Chunk 3b reactivity listeners to the edit-view form fields.
     * Called once per modal-open lifecycle (alongside the Back button
     * wiring); the listeners read from current state at fire time, so
     * they survive multiple openEditAltText / _closeEditAltText cycles.
     *
     * @private
     */
    _attachFormReactivityListeners() {
      const captionInput = document.getElementById(FIELD_IDS.caption.input);
      const altInput = document.getElementById(FIELD_IDS.altText.input);
      const longDescInput = document.getElementById(
        FIELD_IDS.longDescription.input,
      );
      const textInImageInput = document.getElementById(
        FIELD_IDS.textInImage.input,
      );
      const decorative = document.getElementById(FIELD_IDS.decorative.input);

      if (captionInput) {
        captionInput.addEventListener("input", () =>
          this._handleCaptionInput(),
        );
      } else {
        logWarn("_attachFormReactivityListeners: Caption input not in DOM");
      }
      if (altInput) {
        altInput.addEventListener("input", () => this._handleAltTextInput());
      } else {
        logWarn("_attachFormReactivityListeners: Alt Text input not in DOM");
      }
      if (longDescInput) {
        longDescInput.addEventListener("input", () =>
          this._handleLongDescriptionInput(),
        );
      } else {
        logWarn(
          "_attachFormReactivityListeners: Long Description input not in DOM",
        );
      }
      if (textInImageInput) {
        textInImageInput.addEventListener("input", () =>
          this._handleTextInImageInput(),
        );
      } else {
        logWarn(
          "_attachFormReactivityListeners: Text in Image input not in DOM",
        );
      }
      if (decorative) {
        decorative.addEventListener("change", () =>
          this._handleDecorativeChange(),
        );
      } else {
        logWarn(
          "_attachFormReactivityListeners: Decorative checkbox not in DOM",
        );
      }

      logDebug("_attachFormReactivityListeners: listeners attached");
    }

    /**
     * Update the character-count <small> element for the given field key.
     * Delegates to _setFieldCount so a future formatting or aria-live
     * change to that helper automatically applies to the reactive path
     * as well as Chunk 3a's open-time count population.
     *
     * @param {string} fieldKey - one of "caption", "altText",
     *   "longDescription", "textInImage".
     * @private
     */
    _updateCharacterCount(fieldKey) {
      const ids = FIELD_IDS[fieldKey];
      if (!ids) {
        logWarn(`_updateCharacterCount: unknown field "${fieldKey}"`);
        return;
      }
      const input = document.getElementById(ids.input);
      if (!input) return;
      this._setFieldCount(ids.count, input.value);
    }

    /**
     * Update the dirty flag for the given field per Q3/Q4's value-dirty
     * definition. Type-and-revert clears the flag because the current
     * value once again matches value-at-open.
     *
     * @param {string} fieldKey - one of "caption", "altText",
     *   "longDescription", "textInImage", "decorative".
     * @private
     */
    _updateDirtyFlag(fieldKey) {
      if (!this._valuesAtOpen || !this._dirtyFields) return;
      const ids = FIELD_IDS[fieldKey];
      if (!ids) {
        logWarn(`_updateDirtyFlag: unknown field "${fieldKey}"`);
        return;
      }
      const input = document.getElementById(ids.input);
      if (!input) return;

      const currentValue =
        input.type === "checkbox" ? input.checked : input.value;
      const openValue = this._valuesAtOpen[fieldKey];

      if (currentValue === openValue) {
        this._dirtyFields.delete(fieldKey);
      } else {
        this._dirtyFields.add(fieldKey);
      }
      logDebug(
        `_updateDirtyFlag: ${fieldKey} dirty=${this._dirtyFields.has(fieldKey)} ` +
          `(value=${JSON.stringify(currentValue)} open=${JSON.stringify(openValue)})`,
      );
    }

    /**
     * Q6 banner visibility — single expression re-evaluated on form
     * open, decorative change, alt-text input, and long-description
     * input. Banner shown when decorative is checked AND at least one
     * of altText / longDescription is non-empty.
     *
     * @private
     */
    _updateBannerVisibility() {
      const banner = document.getElementById(EDIT_VIEW_BANNER_ID);
      const decorative = document.getElementById(FIELD_IDS.decorative.input);
      const altText = document.getElementById(FIELD_IDS.altText.input);
      const longDesc = document.getElementById(FIELD_IDS.longDescription.input);
      if (!banner || !decorative || !altText || !longDesc) return;

      const shouldShow =
        decorative.checked && (altText.value !== "" || longDesc.value !== "");
      banner.hidden = !shouldShow;
      logDebug(`_updateBannerVisibility: shouldShow=${shouldShow}`);
    }

    /**
     * Q2 hint visibility with dual-toggle aria-describedby per discovery
     * #8. NVDA reads aria-describedby references into hidden elements,
     * so we toggle BOTH the `hidden` attribute AND the hint ID's
     * membership of the Caption input's aria-describedby list.
     *
     * @param {boolean} show
     * @private
     */
    _setCaptionHintVisible(show) {
      const hint = document.getElementById(FIELD_IDS.caption.hint);
      const captionInput = document.getElementById(FIELD_IDS.caption.input);
      if (!hint || !captionInput) return;

      if (show) {
        hint.hidden = false;
        const current = (
          captionInput.getAttribute("aria-describedby") || ""
        ).trim();
        const ids = current ? current.split(/\s+/) : [];
        if (!ids.includes(FIELD_IDS.caption.hint)) {
          ids.push(FIELD_IDS.caption.hint);
          captionInput.setAttribute("aria-describedby", ids.join(" "));
        }
      } else {
        hint.hidden = true;
        const current = (
          captionInput.getAttribute("aria-describedby") || ""
        ).trim();
        const ids = current
          ? current.split(/\s+/).filter((id) => id !== FIELD_IDS.caption.hint)
          : [];
        captionInput.setAttribute("aria-describedby", ids.join(" "));
      }
      logDebug(`_setCaptionHintVisible: show=${show}`);
    }

    /**
     * Caption input handler — character count, dirty flag, and Q2 hint
     * transition logic.
     * @private
     */
    _handleCaptionInput() {
      const captionInput = document.getElementById(FIELD_IDS.caption.input);
      if (!captionInput) return;

      this._updateCharacterCount("caption");
      this._updateDirtyFlag("caption");

      const value = captionInput.value;
      if (value.length > 0) {
        // Field has content — hide Q2 hint, remember that content was
        // present (so a future clear can trigger the hint).
        this._setCaptionHintVisible(false);
        this._captionHadContent = true;
      } else if (
        this._captionHadContent &&
        this._originalSyntaxForCurrent === "includegraphics"
      ) {
        // Field just emptied on an includegraphics-origin image — show
        // the hint to surface the figure-wrapper-stays asymmetry.
        this._setCaptionHintVisible(true);
      } else {
        // Empty but no transition condition met — keep hint hidden.
        this._setCaptionHintVisible(false);
      }
    }

    /**
     * Alt Text input handler — character count, dirty flag, banner.
     * @private
     */
    _handleAltTextInput() {
      this._updateCharacterCount("altText");
      this._updateDirtyFlag("altText");
      this._updateBannerVisibility();
    }

    /**
     * Long Description input handler — character count, dirty flag, banner.
     * @private
     */
    _handleLongDescriptionInput() {
      this._updateCharacterCount("longDescription");
      this._updateDirtyFlag("longDescription");
      this._updateBannerVisibility();
    }

    /**
     * Text in Image input handler — character count + dirty flag only.
     * Decorative-agnostic per Q3; not part of the banner expression.
     * @private
     */
    _handleTextInImageInput() {
      this._updateCharacterCount("textInImage");
      this._updateDirtyFlag("textInImage");
    }

    /**
     * Decorative checkbox change handler — Q3 disable + hint + banner +
     * announce + dirty flag. One-way per Q3: typing in content fields does
     * NOT untick decorative, so no reverse listener is needed.
     *
     * Stage 10 (Flag 4): the presentation-only consequences are extracted
     * into _applyDecorativeState so the P6 render harness can drive them via
     * a stub-restorer instance. The dirty flag stays HERE, never in the
     * helper, so the harness never trips it.
     * @private
     */
    _handleDecorativeChange() {
      const decorative = document.getElementById(FIELD_IDS.decorative.input);
      if (!decorative) return;
      const checked = decorative.checked;

      this._applyDecorativeState(checked);
      this._updateDirtyFlag("decorative");

      logDebug(`_handleDecorativeChange: checked=${checked}`);
    }

    /**
     * Apply the presentation-only consequences of the decorative state and
     * announce the change. Order is load-bearing: disable Alt + Long
     * Description, toggle the Q3 disable hint, recompute the legacy-conflict
     * banner, THEN write the state-aware message to the dedicated polite
     * region — so banner visibility is computed before the message is chosen.
     *
     * The region announces in EVERY transition and never defers to the
     * static-text banner (Flag 1 / F2.1). Presentation-only — the dirty flag
     * is owned by _handleDecorativeChange, so the P6 harness can call this
     * without dirtying state. The reorder versus the old handler is
     * behaviour-safe: _updateBannerVisibility reads only the checkbox + field
     * values, never the dirty flag (F2.5).
     * @param {boolean} checked
     * @private
     */
    _applyDecorativeState(checked) {
      // Q3: native disabled on Alt Text + Long Description.
      const altInput = document.getElementById(FIELD_IDS.altText.input);
      const longDescInput = document.getElementById(
        FIELD_IDS.longDescription.input,
      );
      if (altInput) altInput.disabled = checked;
      if (longDescInput) longDescInput.disabled = checked;

      // Q3 disable hint visibility (sighted-user feedback; aria-describedby
      // wiring deferred unless usability testing surfaces a need — see
      // Phase B7).
      const q3HintEl = document.getElementById(EDIT_VIEW_DISABLE_HINT_ID);
      if (q3HintEl) q3HintEl.hidden = !checked;

      this._updateBannerVisibility();

      // Stage 10 (Flag 1 / F2.1): announce the transition in the dedicated
      // region. Same conflict expression as _updateBannerVisibility, so the
      // ON-with-conflict message and the banner agree.
      const announce = document.getElementById(
        EDIT_VIEW_DECORATIVE_ANNOUNCE_ID,
      );
      if (announce) {
        const hasExistingContent =
          (altInput && altInput.value !== "") ||
          (longDescInput && longDescInput.value !== "");
        if (!checked) {
          announce.textContent = DECORATIVE_ANNOUNCE_OFF;
        } else if (hasExistingContent) {
          announce.textContent = DECORATIVE_ANNOUNCE_ON_CONFLICT;
        } else {
          announce.textContent = DECORATIVE_ANNOUNCE_ON;
        }
      }
    }

    /**
     * Parcel 8d-notify-b. Derive the coverage pair from the current registry
     * state — how many entries count as described, out of how many there are.
     *
     * THE SINGLE SOURCE for both the visible counter and the spoken completion
     * line. Both read this method rather than each running its own filter: a
     * second, equivalent-looking predicate is precisely how the two would come
     * to report different numbers for the same registry, and a guard row now
     * asserts that the spoken pair matches the rendered one exactly.
     *
     * M = entries with non-empty altText OR decorative === true (i.e.
     * getAltCompletionStatus(entry) !== "no-alt").
     * N = registry.getCount().
     *
     * @returns {{covered: number, total: number}|null} null when there is no
     *   registry to read; each caller decides what that means for it.
     * @private
     */
    _computeCoverage() {
      const registry = this.restorer?.imageRegistry;
      if (!registry) {
        logDebug("_computeCoverage: no image registry; coverage unavailable");
        return null;
      }

      const images = registry.getAllImages();
      const covered = images.filter(
        (entry) =>
          MathPixImageRegistry.getAltCompletionStatus(entry) !== "no-alt",
      ).length;

      return { covered, total: registry.getCount() };
    }

    /**
     * Parcel g-2. The coverage clause a gesture's outcome line carries as its
     * SECOND sentence — "Zero of 11 images have alt text or are marked
     * decorative."
     *
     * Reads _computeCoverage(), the same single source the visible counter and
     * the 8d completion line read, so a gesture cannot speak one pair while the
     * toolbar shows another.
     *
     * Returns null when coverage is unavailable, and the CALLER OMITS THE
     * CLAUSE ENTIRELY in that case rather than substituting a placeholder — a
     * gesture that says only "Changes saved." is a degraded line; one that says
     * "null of null images" is a wrong one.
     *
     * Reachable through getInstance() on purpose: the guard rows call this
     * directly with an injected registry state rather than brace-matching the
     * template out of source fetched over HTTP (the FIELD_LABELS lesson).
     *
     * total === 0 RETURNS NULL TOO — option 1, ruled 6 August 2026 by parcel
     * g-3, which is the first parcel to reach a gesture that can leave the
     * registry empty. g-2 deferred this rather than inventing it: on save and
     * undo-of-save an edit implies an image, so total was always at least 1.
     *
     * The alternative was a "Zero of zero images…" clause, and it was rejected
     * as noise: on an empty document the gesture sentence alone ("Image removed
     * from document.") is the whole of what a person needs, and a count of
     * nothing out of nothing is a sentence that costs listening time to convey
     * that there is nothing to convey. Same treatment as the no-registry case
     * above, and for the same reason — the caller OMITS the clause rather than
     * degrading it.
     *
     * @returns {string|null} the clause, or null when there is no coverage or
     *   the registry is empty.
     * @private
     */
    _composeCoverageClause() {
      const coverage = this._computeCoverage();
      if (!coverage) {
        logDebug(
          "_composeCoverageClause: no coverage available; clause omitted",
        );
        return null;
      }

      const { covered, total } = coverage;

      // Empty registry (g-3): the gesture's own sentence speaks alone.
      if (total === 0) {
        logDebug("_composeCoverageClause: registry empty; clause omitted");
        return null;
      }
      const singularNoun = total === 1;
      const singularVerb = covered === 1 || total === 1;

      const fills = {
        "{covered}": coverageCountWord(covered, true),
        "{total}": coverageCountWord(total, false),
        "{noun}": singularNoun ? "image" : "images",
        "{have}": singularVerb ? "has" : "have",
        "{are}": singularVerb ? "is" : "are",
      };

      const clause = COVERAGE_CLAUSE_TEMPLATE.replace(
        COVERAGE_CLAUSE_TOKENS,
        (token) => fills[token],
      );
      logDebug(`_composeCoverageClause: ${covered}/${total} -> "${clause}"`);
      return clause;
    }

    /**
     * Parcel g-2. A gesture's outcome sentence with the coverage clause
     * appended, or the outcome sentence alone when coverage is unavailable.
     *
     * Both call sites go through here so the separator and the omit-on-null
     * rule are stated once. g-3/g-4 add their gestures to this same helper.
     *
     * @param {string} sentence - the gesture's own outcome line.
     * @returns {string}
     * @private
     */
    _withCoverageClause(sentence) {
      const clause = this._composeCoverageClause();
      if (!clause) return sentence;
      return sentence + COVERAGE_CLAUSE_JOINER + clause;
    }

    /**
     * Parcel g-4. Wait until THIS manager's modal is the top of the modal
     * stack, so a status write addressed through UniversalModal.showStatus —
     * which resolves its target with getCurrentModalId(), the stack TOP — lands
     * in our own status host and not in a dialog that is closing over us.
     *
     * WHY A WAIT RATHER THAN AN EXPLICIT ADDRESS. There is no public id-taking
     * status API to address instead: Modal.prototype carries open, close,
     * setContent, setTitle and destroy and no status method; modalManager, which
     * does have showModalStatus(modalId, …), is closure-private and never
     * exported; and all three UniversalModal.*Status wrappers resolve through
     * getCurrentModalId(). Waiting is what this file can do without editing
     * shared modal infrastructure another lane is also working in.
     *
     * BOTH MOTION BRANCHES, because they differ and a fixed delay would be wrong
     * in one of them. modalManager.close() defers finishClose by 200ms ONLY when
     * (prefers-reduced-motion: no-preference) matches; under `reduce` it calls
     * finishClose synchronously, so the stack is already ours by the time the
     * confirm's resolve is awaited. The first check happens before any sleep, so
     * that branch satisfies immediately and pays nothing.
     *
     * WRITE ANYWAY ON EXPIRY — the caller does not treat false as "give up". A
     * silent event is a worse outcome than a mis-targeted one (AGENTS.md
     * § Announcements), so expiry logs the foreign stack top BY NAME and the
     * caller writes regardless, degrading to exactly today's behaviour rather
     * than to nothing.
     *
     * @param {Object} [options]
     * @param {number} [options.boundMs] - total wait before giving up. Defaults
     *   to MODAL_TOP_WAIT_BOUND_MS; the guard rows shorten it so a deliberate
     *   expiry costs milliseconds instead of the full bound.
     * @returns {Promise<boolean>} true if our modal reached the top inside the
     *   bound, false on expiry.
     * @private
     */
    async _waitForOwnModalTop(options = {}) {
      const boundMs =
        typeof options.boundMs === "number"
          ? options.boundMs
          : MODAL_TOP_WAIT_BOUND_MS;

      const ownId = this.currentModal?.modal?.id || null;
      if (!ownId) {
        logWarn("_waitForOwnModalTop: no own modal id available; not waiting");
        return false;
      }

      if (
        typeof UniversalModal === "undefined" ||
        typeof UniversalModal.getCurrentModalId !== "function"
      ) {
        logWarn(
          "_waitForOwnModalTop: UniversalModal.getCurrentModalId unavailable; not waiting",
        );
        return false;
      }

      let waited = 0;
      while (waited <= boundMs) {
        if (UniversalModal.getCurrentModalId() === ownId) {
          logDebug(`_waitForOwnModalTop: own modal on top after ${waited}ms`);
          return true;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, MODAL_TOP_WAIT_INTERVAL_MS),
        );
        waited += MODAL_TOP_WAIT_INTERVAL_MS;
      }

      logWarn(
        `_waitForOwnModalTop: bound ${boundMs}ms expired with ` +
          `"${UniversalModal.getCurrentModalId()}" on top instead of "${ownId}" — ` +
          "writing anyway rather than staying silent",
      );
      return false;
    }

    /**
     * Parcel g-4. Speak a line that was deferred to modal close, then clear it.
     *
     * The last-image remove needs this because the manager itself is what is
     * going away: with the registry empty the close timer fires 300ms after the
     * delete, so a modal status write would be destroyed within about 50ms of
     * landing — worse than the confirm-dialog mis-targeting it replaces.
     *
     * The page-level announcer is reachable at this moment and the modal host is
     * not. It is reached through notifySuccess rather than called directly — see
     * the ROUTE note in the body — and writes to #a11y-sr-announce: role="status",
     * aria-live="polite", declared top-level in tools.html OUTSIDE every tool
     * <article>, which is what keeps it reachable from any mode.
     *
     * ORDERING, and it is the whole reason this runs from onClose: Modal's
     * onClose is invoked from a .then() on modalManager.show(), and that promise
     * is resolved by the LAST statement of finishClose — after the dialog element
     * has been removed from the DOM and after activeModals.delete(). So nothing
     * is left in the top layer to block the page's own live region.
     *
     * Resolved at CALL TIME and never cached: window.a11y, window.accessibility
     * and window.announceToScreenReader are referenced across this codebase and
     * none of them is ever assigned (AGENTS.md § Announcements).
     *
     * The flag is cleared BEFORE the announce, so a throw inside the announcer
     * cannot leave a line pending for some later, unrelated close to speak.
     *
     * @private
     */
    async _flushPendingCloseAnnouncement() {
      const line = this._pendingCloseAnnouncement;
      if (!line) return;

      this._pendingCloseAnnouncement = null;

      // PARK (parcel g-6, 7 August 2026). Move focus to a living control BEFORE
      // the line is written, because by this point focus has just landed on the
      // #main landmark and NVDA's landmark read swallows the polite line.
      //
      // Measured 7 August 2026 (g-6-pre): the flush runs 18ms after
      // finishClose's tier-2 restore lands on main#main. Tier 1 is unusable
      // because modalManager.originalFocus is a SINGLE shared property, which
      // the confirm dialog overwrote with the card's Remove button — and that
      // button died in the refresh() following the delete. Probe five
      // (6 August) heard the line cleanly when it was written with focus
      // parked on a living control instead.
      //
      // This button is the right park: authored in tools.html, never removed,
      // and still visible in the zero-image state this path always runs in —
      // its label just becomes "Add image" (updateManageImagesButtonState in
      // session-restorer-display-layer.js). Guarded, and the guard costs the
      // focus move only: a missing button must never cost the announcement.
      const parkTarget = document.getElementById(MANAGE_IMAGES_BTN_ID);
      if (parkTarget && typeof parkTarget.focus === "function") {
        parkTarget.focus();
      } else {
        logWarn(
          `_flushPendingCloseAnnouncement: #${MANAGE_IMAGES_BTN_ID} unavailable; ` +
            "announcing without the focus park",
        );
      }

      // SETTLE (parcel g-8, 8 August 2026). The park above is necessary and NOT
      // sufficient: measured on the real journey, a write landing ~9ms after the
      // park — while NVDA is still speaking the newly focused button — is
      // dropped silently, exactly as g-5 found on the other remove branch. Wait
      // out the re-orientation before writing. See LAST_IMAGE_ANNOUNCE_SETTLE_MS
      // for the ALPHA-2/BRAVO-2 pair that isolates this, its one-reader caveat,
      // and why g-5's constant was not reused.
      //
      // Not awaited by onClose — this function is fire-and-forget from there, so
      // the settle delays only the announcement, never the teardown. _returnFocus
      // runs immediately after the park and targets the SAME button, so it does
      // not disturb the parked focus this write depends on.
      await new Promise((resolve) =>
        setTimeout(resolve, LAST_IMAGE_ANNOUNCE_SETTLE_MS),
      );

      // ROUTE. Through notifySuccess, not window.accessibilityHelpers directly.
      // finishClose has already cleared hasActiveModal by now, so isModalActive()
      // is false and this takes the TOAST path: the visible toast sighted users
      // get for every other gesture in this manager, and exactly ONE utterance,
      // from the toast's own _announceToast through the same permanent region.
      //
      // Announcing here as well would be two writes surviving only on the
      // announcer's exact-string repeat suppression — an accident of wording,
      // not a design (AGENTS.md § Announcements: one announcement per event,
      // and never an announce() beside a notify*()).
      if (typeof window.notifySuccess !== "function") {
        logWarn(
          "_flushPendingCloseAnnouncement: window.notifySuccess unavailable; " +
            `line not spoken: "${line}"`,
        );
        return;
      }

      window.notifySuccess(line);
      logInfo(`Announced on close, behind the focus park: "${line}"`);
    }

    /**
     * Update the Stage 4 coverage counter from the current registry state.
     *
     * Reads _computeCoverage() rather than filtering the registry itself, so the
     * counter and the run's spoken completion line cannot disagree.
     *
     * Adds the --complete modifier class when M === N AND N > 0.
     *
     * @private
     */
    _updateCoverageCounter() {
      const counter = document.getElementById(COVERAGE_COUNTER_ID);
      if (!counter) return;

      const coverage = this._computeCoverage();
      if (!coverage) {
        counter.textContent = "";
        counter.classList.remove(
          "mmd-image-manager-coverage-counter--complete",
        );
        return;
      }

      const { covered, total } = coverage;
      counter.textContent = `${covered}/${total} ${COUNTER_LABEL}`;

      if (total > 0 && covered === total) {
        counter.classList.add("mmd-image-manager-coverage-counter--complete");
      } else {
        counter.classList.remove(
          "mmd-image-manager-coverage-counter--complete",
        );
      }
    }

    /**
     * Re-derive one card's Alt-button needs-attention signals from a registry
     * entry, mutating the existing button in place (8c-v-b).
     *
     * Uses the SAME predicate as _updateCoverageCounter() —
     * getAltCompletionStatus(entry) !== "no-alt" — so the counter and the card
     * cannot disagree about the same image by testing different things. That
     * shared predicate is the point of this method; a second, equivalent-looking
     * test here would reintroduce exactly the divergence it exists to close.
     *
     * Mutates in place rather than rebuilding the button, because
     * _closeEditAltText() returns focus to this element via _focusCardAltBtn()
     * and the focus-return assertion is already known unreliable on repeat
     * in-page execution. Replacing the node would add an avoidable risk to it.
     *
     * All THREE signals move together, matching the coupling
     * _buildAltButtonHTML() documents: the aria-label suffix, the modifier
     * class and the warning span are added together or removed together. The
     * LABEL is the one assistive technology reads — the button's aria-label
     * overrides its contents, so the class and the icon are visual only — which
     * is why it is set unconditionally below, ahead of the branch, rather than
     * once per branch where a future edit could reach only one of them.
     *
     * @param {Object} entry - Registry entry (needs `id`)
     * @private
     */
    _refreshCardAltButton(entry) {
      if (!entry || !entry.id) {
        logDebug("_refreshCardAltButton: no entry or entry.id; nothing to do");
        return;
      }

      // The grid may not be rendered — the edit view can be open over a hidden
      // grid, and the modal may be closed entirely. Absent button is normal.
      const btn = document.querySelector(altButtonSelectorForId(entry.id));
      if (!btn) {
        logDebug(
          `_refreshCardAltButton: no Alt button matches image ID "${entry.id}"; grid not rendered`,
        );
        return;
      }

      const needsAttention =
        MathPixImageRegistry.getAltCompletionStatus(entry) === "no-alt";
      const existingWarning = btn.querySelector(`.${ALT_BTN_WARNING_CLASS}`);

      // Set on BOTH paths, before the branch. setAttribute takes the raw string
      // — escaping here would put literal entities into the spoken name.
      btn.setAttribute(
        "aria-label",
        this._altButtonAriaLabel(
          this._resolveImageDisplayName(entry.id),
          needsAttention,
        ),
      );

      if (!needsAttention) {
        btn.classList.remove(ALT_BTN_NEEDS_ATTENTION_CLASS);
        if (existingWarning) existingWarning.remove();
        logDebug(
          `_refreshCardAltButton: cleared needs-attention on ${entry.id}`,
        );
        return;
      }

      btn.classList.add(ALT_BTN_NEEDS_ATTENTION_CLASS);

      if (!existingWarning) {
        // Same markup _buildAltButtonHTML emits, including the separating space
        // before the span.
        const warning = document.createElement("span");
        warning.setAttribute("aria-hidden", "true");
        warning.setAttribute("data-icon", "warning");
        warning.className = ALT_BTN_WARNING_CLASS;
        btn.append(" ", warning);

        // A data-icon span inserted after DOMContentLoaded is not inflated by
        // the auto-populator, so inflate it here. populateIcons(scope) DOES
        // honour its argument (icon-library.js: it includes the scope element
        // itself when that element carries data-icon), despite a comment
        // elsewhere in this file claiming otherwise — verified 26 July 2026.
        // Scoping to the span alone leaves every other icon on the page
        // untouched.
        if (window.IconLibrary?.populateIcons) {
          window.IconLibrary.populateIcons(warning);
        } else {
          logWarn(
            "_refreshCardAltButton: IconLibrary unavailable; warning icon will not render",
          );
        }
      }

      logDebug(`_refreshCardAltButton: set needs-attention on ${entry.id}`);
    }

    // ========================================================================
    // STAGE 5 CHUNK 4a — SAVE FLOW
    //
    // Q5c six-step sequence on Save click. Dirty-aware registry updates
    // with source = "user" (Q5a) → applyRegistryToMMD → push MMD via
    // loadMMDContent + currentMMD assignment + persistence saveContent
    // (option (b) — Ctrl-Z support per Q4 §197) → counter refresh →
    // edit-view close (focus return is free via _closeEditAltText) →
    // success toast with 12s Undo (Q4).
    //
    // On any error, persistent error toast (Q5b wording), edit view
    // stays open for retry. No registry rollback (Q5b § "no-rollback").
    //
    // Back / X save-decision integration is Chunk 4b.
    // ========================================================================

    /**
     * Read the current DOM value for an edit-view field key.
     *
     * @param {string} fieldKey - One of "caption", "altText",
     *   "longDescription", "textInImage", "decorative".
     * @returns {string|boolean|null} String value for text fields,
     *   boolean for decorative, null if the input element is missing.
     * @private
     */
    _readEditFieldValue(fieldKey) {
      const idMap = FIELD_IDS[fieldKey];
      if (!idMap) return null;
      const el = document.getElementById(idMap.input);
      if (!el) return null;
      if (fieldKey === "decorative") return Boolean(el.checked);
      return el.value || "";
    }

    /**
     * Apply a values-by-field-key bag to the registry. Iterates the
     * supplied dirtyKeys list and dispatches each to the matching
     * registry update* method.
     *
     * Each provenance-stamped field is written through editedSource
     * (Phase 3 parcel 4a): a human edit-view save of a machine value
     * (ai-generated or algo-generated) or of a reviewed value lands
     * "ai-edited"; every other prior state (user, original, null)
     * lands "user". Only dirty fields reach this method, so an
     * untouched field is never re-stamped. Note the asymmetry:
     * updateDecorative takes (id, value) only — no source parameter
     * (no provenance tracking for decorative; see
     * mathpix-image-registry.js:883).
     *
     * @param {Object} registry - MathPixImageRegistry instance.
     * @param {string} imageId
     * @param {Object} valuesByKey - Same shape as `_valuesAtOpen`.
     * @param {Array<string>} fieldKeys - Subset of valuesByKey keys to apply.
     * @returns {boolean} True if every dispatched update returned true.
     * @private
     */
    _applyValuesToRegistry(registry, imageId, valuesByKey, fieldKeys) {
      let allOk = true;
      // Read the current entry once so each provenance-stamped case can map its
      // existing source through the edit-view transition (editedSource, parcel
      // 4a). If getImage returns null, optional chaining yields undefined, which
      // editedSource resolves to "user".
      const currentEntry = registry.getImage(imageId);
      for (const fieldKey of fieldKeys) {
        const value = valuesByKey[fieldKey];
        let ok = false;
        switch (fieldKey) {
          case "caption":
            ok = registry.updateTitle(
              imageId,
              value,
              window.MathPixAltTextProvenance.editedSource(
                currentEntry?.titleSource,
              ),
            );
            break;
          case "altText":
            ok = registry.updateAltText(
              imageId,
              value,
              window.MathPixAltTextProvenance.editedSource(
                currentEntry?.altTextSource,
              ),
            );
            break;
          case "longDescription":
            ok = registry.updateLongDescription(
              imageId,
              value,
              window.MathPixAltTextProvenance.editedSource(
                currentEntry?.longDescriptionSource,
              ),
            );
            break;
          case "textInImage":
            ok = registry.updateTextInImage(
              imageId,
              value,
              window.MathPixAltTextProvenance.editedSource(
                currentEntry?.textInImageSource,
              ),
            );
            break;
          case "decorative":
            ok = registry.updateDecorative(imageId, value);
            break;
          default:
            logWarn(
              `_applyValuesToRegistry: unknown fieldKey "${fieldKey}" — skipped`,
            );
            ok = true;
        }
        if (!ok) allOk = false;
      }
      return allOk;
    }

    /**
     * Image Manager entry point for regenerating the MMD from the current
     * registry state. Delegates to the restorer's writeMMDFromRegistry,
     * which owns the registry→working-MMD propagation and its three sinks —
     * see MathPixSessionRestorer.prototype.writeMMDFromRegistry for the
     * sink detail.
     *
     * @param {Object} registry - MathPixImageRegistry instance.
     * @returns {{ mmd: string, captions: Object, altText: Object, appendix: Object }}
     * @throws If the restorer or its writeMMDFromRegistry is unavailable, or
     *   re-throws any error the restorer method raises, for the caller's
     *   catch path.
     * @private
     */
    _writeMMDFromRegistry(registry) {
      if (
        !this.restorer ||
        typeof this.restorer.writeMMDFromRegistry !== "function"
      ) {
        throw new Error(
          "_writeMMDFromRegistry: restorer.writeMMDFromRegistry unavailable",
        );
      }
      return this.restorer.writeMMDFromRegistry(registry);
    }

    /**
     * Q5c six-step save sequence. Reads dirty-field state, snapshots
     * pre-save values for Undo, applies registry updates, regenerates
     * MMD, recalcs the coverage counter, closes the edit view, and
     * shows a success toast with 12-second Undo.
     *
     * On any error in steps 1–3, catches, shows a persistent error
     * toast (Q5b wording), leaves the edit view open. No registry
     * rollback (Q5b § "no-rollback").
     *
     * @param {Object} [options] - Routing options for the success toast.
     * @param {boolean} [options.forceToast=false] - Spread into the success
     *   notifySuccess call so it bypasses the in-modal routing and renders
     *   as a global toast. Used only by the X-close-dirty path (via
     *   _attachXButtonInterceptor), where the in-modal status host would
     *   be destroyed by the modal close animation before the user could
     *   see the toast. Back and Escape paths keep the manager open and
     *   continue to route in-modal. See Discovery 19.
     * @returns {Promise<void>}
     * @private
     */
    async _performSave(options = {}) {
      logInfo("_performSave: invoked");

      const registry = this.restorer?.imageRegistry;
      const imageId = this._currentEditImageId;

      if (!registry || !imageId) {
        logWarn(
          `_performSave: missing registry or imageId (registry=${!!registry}, imageId=${imageId})`,
        );
        return;
      }

      // Q5c step 0 — clean form is a silent close (no toast per Q4
      // §194 "clean form + Back click. No save, no toast").
      if (!this._dirtyFields || this._dirtyFields.size === 0) {
        logDebug("_performSave: no dirty fields — silent close");
        this._closeEditAltText();
        return;
      }

      // Snapshot pre-save values for Undo. Shallow copy of
      // _valuesAtOpen — keys match the fieldKey set the form tracks.
      const snapshot = { ...this._valuesAtOpen };
      const dirtyKeys = [...this._dirtyFields];

      // Build the post-save values bag the same way: read each dirty
      // field's current DOM value.
      const newValues = {};
      for (const fieldKey of dirtyKeys) {
        newValues[fieldKey] = this._readEditFieldValue(fieldKey);
      }

      try {
        // Step 1 — apply registry updates per dirty field.
        this._applyValuesToRegistry(registry, imageId, newValues, dirtyKeys);

        // Steps 2 + 3 — apply registry to MMD, push to editor + undo stack.
        this._writeMMDFromRegistry(registry);

        // Step 4 — re-render the grid from current registry state so
        // every render-time derivation (Alt button --needs-attention
        // modifier, metadata cluster icons, card aria-labels, image alt
        // attribute) reflects the just-saved values. refresh() also
        // calls _updateCoverageCounter(), so this is a strict superset
        // of the prior counter-only update (13(c) / Discovery 20).
        // Lands before _closeEditAltText so the grid is fresh when the
        // edit view hides and reveals it (no flash of stale content).
        // _closeEditAltText's focus return re-queries by data-image-id,
        // which the rebuilt cards preserve, so Q8b focus return is safe.
        this.refresh();

        // Step 5 — navigate to grid view. _closeEditAltText handles
        // focus return to the originating Alt button (Q8b) and clears
        // the form's reactivity state.
        this._closeEditAltText();

        // Step 6 — success notification with Undo action. Auto-routes
        // to the manager modal's in-modal status area (Commit A) when
        // the manager is staying open. The X-close-dirty path passes
        // forceToast: true so the success renders as a global toast
        // instead — the in-modal host is destroyed by the close
        // animation before the user could see it (Discovery 19). The
        // aria-live announcement runs after the focus change has
        // completed (Q5d rationale).
        // Parcel g-2: the outcome sentence now carries the coverage clause as
        // a second sentence. Routing is unchanged — same notifySuccess, same
        // in-modal re-route, same Undo affordance; only the message string is
        // longer. The clause is omitted entirely when coverage is unavailable.
        notifySuccess(this._withCoverageClause(TOAST_SUCCESS_TEXT), {
          duration: TOAST_SUCCESS_DURATION_MS,
          actions: [
            {
              label: TOAST_SUCCESS_UNDO_LABEL,
              ariaLabel: TOAST_SUCCESS_UNDO_ARIA_LABEL,
              onClick: () => this._undoSave(imageId, snapshot, dirtyKeys),
            },
          ],
          ...(options.forceToast ? { forceToast: true } : {}),
        });

        logInfo(
          `_performSave: completed — imageId=${imageId}, dirtyKeys=${JSON.stringify(dirtyKeys)}`,
        );
      } catch (err) {
        logError("_performSave: save failed", err);
        // Persistent error notification — Q5b wording verbatim. Edit
        // view stays open so the user can correct or retry. No
        // registry rollback.
        notifyError(TOAST_ERROR_TEXT, {
          duration: 0,
          dismissible: true,
        });
      }
    }

    /**
     * Parcel 8d-pre-strand. Is the edit view still showing the image the given
     * run belongs to?
     *
     * The edit view is ONE shared DOM, so every run-driven write to it is only
     * correct while the view still shows that run's image. A run survives both
     * leaving the view and opening a different one — `id` is captured before the
     * first await, so the REGISTRY write stays correctly addressed, but the
     * VIEW work does not follow it.
     *
     * Both failing cases are covered by the one comparison, because
     * _closeEditAltText nulls _currentEditImageId and openEditAltText overwrites
     * it: a closed view compares null against the run's id, and a different
     * image compares that image's id against the run's. A null runImageId (no
     * run in flight) is treated as "not still showing" rather than matching a
     * closed view by accident.
     *
     * @param {string|null} runImageId - the id captured when the run started.
     * @returns {boolean} true only when the open edit view is that same image.
     * @private
     */
    _viewStillShows(runImageId) {
      return Boolean(runImageId) && this._currentEditImageId === runImageId;
    }

    /**
     * Parcel 8d-notify. Resolve the display name for an image id, for the
     * out-of-view completion line.
     *
     * The registry entry carries NO name field. The name lives in the restorer's
     * ZIP filename map, with a replacement-aware override when the user has
     * swapped the image. That resolution already appears at two sites in this
     * file (the card builder and openEditAltText); this is a third reader, so it
     * is factored here rather than copied a third time. The two existing sites
     * are deliberately left alone — adopting this helper there is tidy-up, not
     * part of this parcel.
     *
     * Falls back to the id, which is what the card builder's displayName does.
     *
     * @param {string|null} imageId - registry image id.
     * @returns {string} a name safe to speak; never empty.
     * @private
     */
    _resolveImageDisplayName(imageId) {
      if (!imageId) return "";

      const filenameMap = this.restorer?.imageFilenameMap || {};
      const mapEntry = filenameMap[imageId];
      let friendlyName = mapEntry?.filename || null;

      const entry = this.restorer?.imageRegistry?.getImage(imageId);
      if (entry?.status === "user-replaced" && mapEntry?.replacedWithFilename) {
        friendlyName = mapEntry.replacedWithFilename;
      }

      return friendlyName || imageId;
    }

    /**
     * Parcel 8d-notify. Speak the run's completion when the person has LEFT the
     * edit view the run belongs to.
     *
     * WHY THIS EXISTS. 8d-pre-strand correctly stopped image A's outcome line
     * landing in image B's status region, by suppressing it in the view-scoped
     * facade. The cost, measured 1 August 2026, was silence: a completed run in
     * the Back-to-grid journey wrote only the start line and the coverage
     * counter, and in the open-another-image journey the counter's write landed
     * in a region reading ignored/notRendered. Nothing said the work had
     * finished.
     *
     * WHERE IT GOES. div.universal-modal-status-text, inside the modal, which
     * measured EXPOSED with the grid showing AND with an edit view showing, and
     * which mutates while already in the accessibility tree (SHAPE 1, three
     * runs). It is the only candidate that escapes the grid/edit `hidden`
     * toggle, which guarantees any section-bound region reads notRendered in one
     * journey or the other.
     *
     * NO AUTO-HIDE. This deliberately does NOT go through _showStatus, whose
     * unconditional 3000ms fire-and-forget timer hides whatever is in the region
     * when it fires, without checking the message is still its own — it would
     * wipe a later caller's line, and an earlier caller's timer would wipe ours.
     * UniversalModal.showStatus only schedules a hide when options.duration > 0,
     * so omitting options leaves the line in place until something replaces it.
     *
     * KNOWN HAZARD, not addressed here: this region is contended. Every notify*
     * call in the app re-routes into it while a modal is active
     * (universal-notifications.js), and UniversalModal.showStatus resolves the
     * target through getCurrentModalId(), which returns the modal stack TOP. No
     * queue or ownership scheme is built in this parcel.
     *
     * ERRORS TAKE THE PARALLEL ROUTE. The orchestrator reports failure through
     * showError, a different facade method, which re-routes to
     * _announceRunFailedOutOfView — a separate method, deliberately, because the
     * two lines differ in what they carry (no coverage count on a failure) and
     * in status type. Closing that gap post-dated 8d-notify: this method shipped
     * first and left failure silent, which made silence read as SUCCESS, since
     * success was the only case that spoke. Parcel 8d-err closed it.
     *
     * PARCEL 8d PART 2 — `message` IS NOW LOAD-BEARING. It was previously read
     * only to log it and was otherwise discarded; the spoken line is now built
     * AROUND it. The single caller is the orchestrator's own progress facade
     * (the showStatus arrow in _constructEditAltRunPipeline), which nothing else
     * holds or calls, so the string arriving here is always the orchestrator's
     * core sentence for this run. The start line and the materialisation-error
     * line reach this._editAltProgress directly and never pass through here.
     *
     * @param {string} message - the orchestrator's CORE SENTENCE for this run,
     *   wrapped verbatim into the spoken line. Never discarded.
     * @param {string} type - the orchestrator's status type.
     * @private
     */
    _announceRunCompleteOutOfView(message, type) {
      const runImageId = this._activeRunImageId;

      if (type !== EDIT_ALT_RUN_COMPLETE_STATUS_TYPE) {
        logDebug(
          `_announceRunCompleteOutOfView: type "${type}" is not ` +
            `"${EDIT_ALT_RUN_COMPLETE_STATUS_TYPE}" — not re-routed (original: "${message}")`,
        );
        return;
      }

      if (
        typeof UniversalModal === "undefined" ||
        typeof UniversalModal.showStatus !== "function"
      ) {
        logWarn(
          "_announceRunCompleteOutOfView: UniversalModal.showStatus unavailable; completion line not spoken",
        );
        return;
      }

      const name = this._resolveImageDisplayName(runImageId);

      // Parcel 8d-notify-b. The coverage count rides THIS line. Since parcel
      // g-1 (5 August 2026) the counter has no voice of its own at all — it is
      // a permanently visual readout — so this line is the only place the count
      // is spoken on the out-of-view journey. Read from _computeCoverage, the
      // same source the visible counter renders from.
      //
      // Ordering is load-bearing and already correct: the orchestrator writes
      // the registry BEFORE it calls showStatus (alt-text-orchestrator.js step
      // 4 — parse → write → hideProgress → ONE showStatus), so the pair read
      // here is the post-write state, the same state _updateCoverageCounter
      // renders a moment later in _handleGenerateAltText's success branch.
      //
      // Parcel 8d part 2: what degrades is the NAME, then the COUNT, and never
      // the core sentence. A degraded line, never a wrong one, and never the
      // silence this method exists to close.
      const coverage = this._computeCoverage();

      // Parcel 8d part 2. The orchestrator's own sentence, WRAPPED rather than
      // discarded. It arrives as `message` and is substituted whole.
      const core = message == null ? "" : String(message);

      // Pick the template down the degradation ladder: name first, then count,
      // and the core sentence never.
      let template;
      if (coverage && name) {
        template = EDIT_ALT_RUN_COMPLETE_WRAP;
      } else if (coverage) {
        logWarn(
          "_announceRunCompleteOutOfView: no resolvable display name; speaking the count-and-core line",
        );
        template = EDIT_ALT_RUN_COMPLETE_WRAP_NO_NAME;
      } else if (name) {
        logWarn(
          "_announceRunCompleteOutOfView: coverage unavailable; speaking the name-and-core line",
        );
        template = EDIT_ALT_RUN_COMPLETE_WRAP_NO_COVERAGE;
      } else {
        logWarn(
          "_announceRunCompleteOutOfView: neither name nor coverage resolvable; speaking the core sentence alone",
        );
        template = EDIT_ALT_RUN_COMPLETE_WRAP_CORE_ONLY;
      }

      // ONE pass over all four tokens (see the pattern's note at the constants).
      // The replacer is a FUNCTION, so neither a display name nor a core
      // sentence carrying `$&` or `$1` triggers substitution patterns, and a
      // substituted value is never rescanned for another token.
      const line = template.replace(
        EDIT_ALT_RUN_COMPLETE_TOKEN_PATTERN,
        (token) => {
          switch (token) {
            case EDIT_ALT_RUN_COMPLETE_NAME_TOKEN:
              return name;
            case EDIT_ALT_RUN_COMPLETE_COVERED_TOKEN:
              return String(coverage.covered);
            case EDIT_ALT_RUN_COMPLETE_TOTAL_TOKEN:
              return String(coverage.total);
            case EDIT_ALT_RUN_COMPLETE_CORE_TOKEN:
              return core;
            default:
              return token;
          }
        },
      );

      UniversalModal.showStatus(line, EDIT_ALT_RUN_COMPLETE_STATUS_TYPE);
      logInfo(
        `_announceRunCompleteOutOfView: completion line spoken for ${runImageId}: "${line}"`,
      );
    }

    /**
     * Parcel 8d-err. Speak the run's FAILURE when the person has LEFT the edit
     * view the run belongs to.
     *
     * WHY THIS EXISTS. 8d-notify re-routed the SUCCESS line and left this branch
     * suppressed, so an out-of-view failed run ended in silence. That is worse
     * than the silence 8d-notify closed: once success speaks, SILENCE READS AS
     * SUCCESS. A person who leaves the view and hears nothing has been told, in
     * effect, that the description arrived.
     *
     * WHERE IT GOES. div.universal-modal-status-text — the same § 9 host the
     * completion line uses, and for the same measured reason: it is the only
     * candidate exposed in BOTH journeys (grid showing and edit view showing),
     * because it escapes the grid/edit `hidden` toggle and mutates while already
     * in the accessibility tree.
     *
     * KEPT SEPARATE from _announceRunCompleteOutOfView rather than folded into
     * it. The two lines differ in status type, in what they carry, and in what
     * they must never carry; a single method with a mode flag would put those
     * differences behind a boolean at the call site and invite a future edit to
     * leak one line's rules into the other.
     *
     * THE ERROR TEXT IS VERBATIM. The in-view error line is the ONLY place the
     * contract's error string is ever shown, and nothing re-shows it later — so
     * whatever this line drops is lost to the person permanently. The name is
     * the part that degrades when it cannot be resolved; the error never is.
     *
     * NO COVERAGE COUNT, and no coverage read anywhere in this method. A failed
     * run writes nothing, so there is no new number; speaking the old one would
     * imply progress that did not happen.
     *
     * NO AUTO-HIDE, for the reason the completion line records: showStatus
     * schedules a hide only when options.duration > 0, so passing no options
     * leaves the line until something replaces it. An error the person has not
     * read yet must not evaporate on a timer.
     *
     * THE PIN HOLDS BY CONSTRUCTION. The orchestrator emits exactly one
     * showStatus OR one showError per run, never both, so this line IS the run's
     * one outcome line — start line plus this one is the at-most-two pin.
     *
     * KNOWN HAZARD, inherited and NOT addressed here, at parity with the
     * completion line: this region is contended. Every notify* call re-routes
     * into it while a modal is active, and showStatus resolves its target
     * through getCurrentModalId(), which returns the modal stack TOP. No queue
     * or ownership scheme is built in this parcel either.
     *
     * @param {string} message - the VERBATIM error line the orchestrator wrote.
     * @private
     */
    _announceRunFailedOutOfView(message) {
      const runImageId = this._activeRunImageId;

      if (
        typeof UniversalModal === "undefined" ||
        typeof UniversalModal.showStatus !== "function"
      ) {
        logWarn(
          "_announceRunFailedOutOfView: UniversalModal.showStatus unavailable; failure line not spoken",
        );
        return;
      }

      const name = this._resolveImageDisplayName(runImageId);
      const errorText = message == null ? "" : String(message);

      // The NAME degrades, never the error. With no resolvable name the person
      // still learns that a run failed and why — a degraded line, never a wrong
      // one, and never the silence this method exists to close.
      let template;
      if (name) {
        template = EDIT_ALT_RUN_FAILED_NAME_SENTENCE;
      } else {
        logWarn(
          "_announceRunFailedOutOfView: no resolvable display name; speaking the degraded line",
        );
        template = EDIT_ALT_RUN_FAILED_DEGRADED_SENTENCE;
      }

      // One pass over both tokens (see the pattern's note at the constants).
      // The replacer is a FUNCTION, so a name or an error carrying `$&` or `$1`
      // is inserted literally rather than triggering substitution patterns.
      const line = template.replace(EDIT_ALT_RUN_FAILED_TOKEN_PATTERN, (token) =>
        token === EDIT_ALT_RUN_FAILED_NAME_TOKEN ? name : errorText,
      );

      UniversalModal.showStatus(line, EDIT_ALT_RUN_FAILED_STATUS_TYPE);
      logInfo(
        `_announceRunFailedOutOfView: failure line spoken for ${runImageId}: "${line}"`,
      );
    }

    /**
     * Clear the AI status region at run start: empty its text and reset it to
     * the base class, WITHOUT hiding it. hideStatus() sets hidden=true and would
     * reintroduce the parcel-5 appears-only-at-write-time bug, so it is NOT
     * used. Emptying a watched-while-empty region also makes a subsequent
     * identical line announce as an addition (empty → text) rather than a no-op.
     * @private
     */
    _clearEditAltStatus() {
      const statusEl = document.getElementById(EDIT_VIEW_AI_STATUS_ID);
      if (!statusEl) {
        logWarn(
          `_clearEditAltStatus: #${EDIT_VIEW_AI_STATUS_ID} not in DOM; nothing to clear`,
        );
        return;
      }

      statusEl.textContent = "";
      statusEl.className = "imgdesc-status";
      // Deliberately do NOT touch hidden — the region stays present and watched.
      logDebug("_clearEditAltStatus: status region cleared");
    }

    /**
     * 8d-pre — write the run's START line on the single live channel, immediately
     * before an orchestrator.run() call. Paired with the orchestrator's outcome
     * line, a run now speaks at most twice: one at start, one at outcome.
     *
     * Called at BOTH run() call sites deliberately, rather than being hoisted to
     * one place above the branch: hoisting would edit the untouched-entry
     * pass-through path that 8c-iv-pre row 1 locks. The wording and type live
     * here so parcel 8d can refine them in exactly one place.
     * @private
     */
    _announceEditAltRunStart() {
      if (!this._editAltProgress) {
        logWarn(
          "_announceEditAltRunStart: no progress controller; start line skipped",
        );
        return;
      }

      // Parcel 8d-pre-strand. The start line is written AFTER two awaits — the
      // materialisation, and on the dialog path the field selection — so the
      // view can already have moved on by the time it runs. Reading
      // _activeRunImageId rather than taking a parameter keeps BOTH call sites
      // byte-identical, which is the property the 8d-pre-fix row 7 guard and the
      // addendum both record.
      if (!this._viewStillShows(this._activeRunImageId)) {
        logInfo(
          `_announceEditAltRunStart: view moved on (run=${this._activeRunImageId}, ` +
            `open=${this._currentEditImageId}) — start line suppressed`,
        );
        return;
      }
      this._editAltProgress.showStatus(
        EDIT_ALT_RUN_START_ANNOUNCEMENT,
        EDIT_ALT_RUN_START_STATUS_TYPE,
      );
      logDebug("_announceEditAltRunStart: start line written");
    }

    /**
     * Cycle 2b — Generate button handler. Materialises the current image, then
     * hands it to the orchestrator, which owns the write and the single
     * announcement on #edit-alt-ai-status.
     *
     * Two deliberate departures from the Image Describer's generate() spine
     * (image-describer-controller-generate.js), which this otherwise mirrors:
     * the running state is carried by aria-disabled, NOT the disabled property,
     * so focus is never dropped off the button mid-run; and no progress fill or
     * "generating" class is touched, because the single live channel is the
     * status region alone.
     *
     * 7d-i repopulates the four inputs and their char counts on success only;
     * provenance refresh (7d-ii) and the dirty-state reconcile (7d-iii) are
     * still to come, so those remain untouched here.
     *
     * @returns {Promise<void>}
     * @private
     */
    async _handleGenerateAltText() {
      if (this._editAltGenerating) {
        logDebug("_handleGenerateAltText: run already in flight; ignoring click");
        // Parcel g-10 — the blocked press now speaks. The logDebug above is
        // kept: it is the developer's record, and it was never the person's.
        this._announceGenerateBlocked();
        return;
      }

      const id = this._currentEditImageId;
      const btn = document.getElementById(EDIT_VIEW_GENERATE_BTN_ID);

      if (!id || !this._editAltOrchestrator || !this._editAltProgress) {
        logWarn(
          "_handleGenerateAltText: missing id, orchestrator or progress; aborting",
        );
        return;
      }

      // Claim the run BEFORE the first await, so two clicks dispatched in the
      // same task cannot both pass the guard above. aria-disabled (NOT the
      // disabled property) keeps focus on the button; _editAltGenerating is the
      // real guard.
      this._editAltGenerating = true;
      if (btn) btn.setAttribute("aria-disabled", "true");

      // Parcel g-1 (5 August 2026): no counter suppression here any more — the
      // toolbar readouts are permanently non-live, so a run has nothing to
      // silence.

      // Parcel 8d-pre-strand: record which image this run belongs to, so every
      // view-specific write below — and the orchestrator's own writes, through
      // _editAltProgressScoped — can test whether the view still shows it.
      // Cleared in the finally.
      this._activeRunImageId = id;

      // Clear the previous run's line before this run starts. Not an
      // announcement — it empties the region rather than writing to it, so the
      // one-status-line-per-run invariant is untouched.
      this._clearEditAltStatus();

      try {
        // Materialise the File. A typed failure is announced here on the same
        // channel — mutually exclusive with the run's own announcement, so
        // exactly one line speaks per gesture. The finally below resets the
        // running state.
        let image;
        try {
          const entry = this.restorer.imageRegistry.getImage(id);
          image = await this._materialiseImageFile(entry, id);
        } catch (error) {
          const message =
            error && error.message ? error.message : String(error);
          logWarn(`_handleGenerateAltText: materialisation failed: ${message}`);
          // Parcel 8d-pre-strand: materialisation is itself awaited, so this
          // error can arrive after the person has left. Same identity test as
          // the success branch — an error about image A must not appear in
          // image B's status region.
          if (this._viewStillShows(id)) {
            this._editAltProgress.showStatus(message, "error");
          } else {
            logInfo(
              `_handleGenerateAltText: view moved on (run=${id}, ` +
                `open=${this._currentEditImageId}) — materialisation error line suppressed`,
            );
          }
          return;
        }

        // 8c-iv — re-read the entry (the materialisation try's own `entry` is
        // scoped to that block) and decide whether to ask which descriptions to
        // (re)generate before anything is spent.
        const currentEntry = this.restorer.imageRegistry.getImage(id);

        // The orchestrator owns the write and the single announcement; this
        // reads the entry it just wrote and refreshes the visible fields.
        let outcome;

        if (!this._needsFieldSelection(currentEntry)) {
          // Untouched entry — there is nothing to ask about. Call exactly as
          // before, with writeFields and overwriteFields OMITTED (not passed as
          // undefined), so this path stays the no-regression pass-through that
          // 8c-iv-pre row 1 locks.
          this._announceEditAltRunStart();
          outcome = await this._editAltOrchestrator.run({ image, id });
        } else {
          const chosen = await this._promptFieldSelection(currentEntry);

          // Cancel (null) and confirm-with-nothing-ticked ([]) are both no-work
          // outcomes: write nothing, call no adapter, add NO announcement. The
          // announcement question is parcel 8d's to settle, not this one's. The
          // finally below resets the running state, and because the button is
          // aria-disabled rather than disabled, focus stays on Generate.
          if (
            chosen === null ||
            (Array.isArray(chosen) && chosen.length === 0)
          ) {
            logInfo(
              `_handleGenerateAltText: field selection produced no work for ${id} (${
                chosen === null ? "cancelled" : "nothing ticked"
              }) — nothing written, no adapter called`,
            );
            return;
          }

          // The tick IS the authorisation gesture, so scope (writeFields) and
          // permission (overwriteFields) coincide at this one call site and
          // nowhere else. Lock 1 keeps the two separate at the API — do not
          // collapse them in the orchestrator or the write stage.
          this._announceEditAltRunStart();
          outcome = await this._editAltOrchestrator.run({
            image,
            id,
            writeFields: chosen,
            overwriteFields: chosen,
          });
        }

        if (outcome && outcome.status === "success") {
          const entry = this.restorer.imageRegistry.getImage(id);

          // Parcel 8d-pre-strand. The three statements below are VIEW-SPECIFIC:
          // they write this entry into the shared edit-view DOM and rebase the
          // dirty baseline against it. Run when the view has moved on, they
          // filled a DIFFERENT image's form with this image's text, marked it
          // ai-generated, and left a dirty baseline under which one keystroke
          // wrote this text onto that other image attributed to "user"
          // (measured end to end, 31 July 2026).
          //
          // Everything BELOW this block is GRID-LEVEL and stays unconditional —
          // the registry write already happened inside the orchestrator, and the
          // counter, the card button and the MMD projection are all correct
          // regardless of which view is open. Skipping them would lose the work
          // rather than protect it.
          //
          // Skipping _reconcileDirtyAfterRun is safe: openEditAltText rebuilds
          // _valuesAtOpen from the registry and resets _dirtyFields to an empty
          // Set on every open, so re-opening this image cannot inherit a stale
          // baseline. _closeEditAltText nulls both, and the method's own guard
          // returns early on a null baseline.
          if (this._viewStillShows(id)) {
            this._repopulateEditAltInputs(entry);
            this._refreshFieldProvenance(entry);
            // Parcel 8e-2 — a field that has just become ai-generated gains its
            // accept control here. Inside the _viewStillShows guard with the
            // other two: these buttons are view-specific, and writing them when
            // the view has moved on would decorate a DIFFERENT image's form.
            this._refreshAcceptControls(entry);
            // Parcel g-10 — the second population site, joined for the same
            // reason _refreshAcceptControls is called from both: the open path
            // and the post-run path must not drift. The run has not ended yet
            // here (the finally below clears the flag), so this call correctly
            // computes the running state for THIS image; the finally then
            // re-runs it against a cleared flag.
            this._refreshGenerateControl(id);
            this._refreshDescribeAllControl();
            this._reconcileDirtyAfterRun(entry);
          } else {
            logInfo(
              `_handleGenerateAltText: view moved on (run=${id}, ` +
                `open=${this._currentEditImageId}) — edit-view repopulate, ` +
                "provenance refresh and dirty reconcile all skipped; the " +
                "registry write, coverage counter, card button and MMD push " +
                "still run",
            );
          }

          // 8c-v — close the recorded counter-staleness gap. The counter is
          // derived from the registry, which the orchestrator has just written,
          // so without this a generate-then-Back leaves it stale in the SAFE,
          // under-reporting direction (verified 26 July 2026: registry 1 of 11
          // covered, counter still reading 0/11 after Back).
          //
          // _updateCoverageCounter() and NOT refresh(): at this point the edit
          // view is open and the grid is hidden, so a full refresh would rebuild
          // card DOM nobody can see. It would also rebuild the very Alt button
          // that _closeEditAltText returns focus to, which sits upstream of a
          // focus-return assertion already known to be unreliable. The counter is
          // the recorded gap; the card rebuild is not.
          this._updateCoverageCounter();

          // 8c-v-b — the counter and the card's Alt button are two views of one
          // fact (does this image have alt text?), shown on one screen at the
          // same time. They run together here, off the same predicate, so they
          // cannot diverge: updating one without the other is precisely the
          // disagreement this pairing exists to prevent. In-place mutation of
          // the one button, NOT the refresh() the paragraph above rules out.
          this._refreshCardAltButton(entry);

          // The metadata cluster icons on the card are still stale after this
          // write — _closeEditAltText calls neither refresh() nor either update
          // above (the three refresh() sites are _executeSwap, _executeAdd and
          // handleDelete). That one needs the card rebuild ruled out above, so
          // it remains its own parcel.
          logDebug(
            `_handleGenerateAltText: coverage counter and card Alt button ` +
              `recomputed for ${id}; cluster icons may remain stale until the ` +
              "next refresh()",
          );

          // Registry-is-truth invariant: the registry is the source of truth and
          // the working MMD is its projection, so a registry write is followed by
          // a projection push — matching the Lane C chemistry-writer precedent in
          // this same file (see _reconcileOnOpen). The orchestrator has already
          // written the registry and spoken the single status line; this push only
          // propagates that registry state into the MMD. Its own local try/catch
          // keeps a projection failure from adding a second status line: exactly
          // one line speaks per gesture, and it has already been spoken. Breaking
          // that pin is a fault, not a trade-off, so on throw we log and do
          // nothing else — no showStatus, no touch of the AI status region.
          try {
            this._writeMMDFromRegistry(this.restorer.imageRegistry);
          } catch (pushError) {
            logError(
              `_handleGenerateAltText: projection push failed: ${
                pushError && pushError.message
                  ? pushError.message
                  : String(pushError)
              }`,
            );
          }
        }
      } catch (error) {
        // run() should never reject, but guard anyway — log only; do not add a
        // second announcement.
        logError(
          `_handleGenerateAltText: orchestrator.run rejected unexpectedly: ${
            error && error.message ? error.message : String(error)
          }`,
        );
      } finally {
        this._editAltGenerating = false;
        this._activeRunImageId = null;
        // Parcel g-10 — AFTER the two clears above, never before: the reset
        // reads both, so running it first would recompute the state it is
        // meant to be lifting. This replaces a bare
        // btn.setAttribute("aria-disabled", "false"), which re-enabled the
        // control but could not remove a cross-image reason from its name —
        // and the person most likely to be looking at this control when a run
        // ends is the one who pressed it while it was blocked. It also fires
        // when the OPEN view is a different image from the one that just
        // finished, which is exactly the case the bare setAttribute got wrong.
        // Reads the field here deliberately: on this path the open image is
        // whatever the person is looking at NOW, which is precisely what that
        // field holds.
        this._refreshGenerateControl(this._currentEditImageId);
        this._refreshDescribeAllControl();
        // Parcel g-1 (5 August 2026): no speech restore here — there is no
        // suppression to lift. HISTORY, kept because it is why the toggle
        // existed at all: 8d-notify-c removed this restore after the 1 August
        // listen heard the completion line followed by "1/11 covered". NVDA
        // compares a live region against what it last held and speaks the
        // changed text when the attribute RETURNS, so mute-during-mutation
        // with unmute-after was the same as never muting. g-1 settles it by
        // making the region non-live at build time instead.
      }
    }

    /**
     * Populate the four edit-view inputs and their character counts from a
     * registry entry (caption reads title). This IS the input/count half of the
     * edit-view population — the single site called both by openEditAltText on
     * open and after a successful AI run, so the two paths cannot drift. Does NOT
     * touch the provenance pills (7d-ii), the decorative checkbox, or the
     * dirty-state baseline (7d-iii).
     * @param {Object} entry - the registry entry to read.
     * @private
     */
    _repopulateEditAltInputs(entry) {
      if (!entry) {
        logWarn("_repopulateEditAltInputs: no entry; skipping");
        return;
      }

      const captionInput = document.getElementById(FIELD_IDS.caption.input);
      const altTextInput = document.getElementById(FIELD_IDS.altText.input);
      const longDescInput = document.getElementById(
        FIELD_IDS.longDescription.input,
      );
      const textInImageInput = document.getElementById(
        FIELD_IDS.textInImage.input,
      );

      if (captionInput) captionInput.value = entry.title || "";
      if (altTextInput) altTextInput.value = entry.altText || "";
      if (longDescInput) longDescInput.value = entry.longDescription || "";
      if (textInImageInput) textInImageInput.value = entry.textInImage || "";

      this._setFieldCount(FIELD_IDS.caption.count, captionInput?.value || "");
      this._setFieldCount(FIELD_IDS.altText.count, altTextInput?.value || "");
      this._setFieldCount(
        FIELD_IDS.longDescription.count,
        longDescInput?.value || "",
      );
      this._setFieldCount(
        FIELD_IDS.textInImage.count,
        textInImageInput?.value || "",
      );

      logInfo("_repopulateEditAltInputs: inputs and counts refreshed");
    }

    /**
     * Populate the four provenance pills from a registry entry so each reflects
     * its stored source — the single site called both by openEditAltText on open
     * and after a successful AI run, so the two paths cannot drift. A frozen
     * field (the write stage's FROZEN_SOURCES — user, ai-reviewed, ai-edited)
     * keeps its source through a write, so re-applying it leaves its pill
     * unchanged; unfrozen fields read ai-generated after a run. Caption reads
     * titleSource. Does NOT touch inputs (7d-i), the decorative checkbox, or the
     * dirty-state baseline (7d-iii).
     * @param {Object} entry - the registry entry to read.
     * @private
     */
    _refreshFieldProvenance(entry) {
      if (!entry) {
        logWarn("_refreshFieldProvenance: no entry; skipping");
        return;
      }

      this._applyFieldProvenance(FIELD_IDS.caption.provenance, entry.titleSource);
      this._applyFieldProvenance(
        FIELD_IDS.altText.provenance,
        entry.altTextSource,
      );
      this._applyFieldProvenance(
        FIELD_IDS.longDescription.provenance,
        entry.longDescriptionSource,
      );
      this._applyFieldProvenance(
        FIELD_IDS.textInImage.provenance,
        entry.textInImageSource,
      );

      logInfo("_refreshFieldProvenance: pills refreshed from registry sources");
    }

    /**
     * After a successful run, adopt the generated content as the new dirty-state
     * baseline so it is not read as a user edit. Update the four CONTENT baselines
     * in _valuesAtOpen to the generated values and drop those four keys from
     * _dirtyFields. Decorative is untouched — a run doesn't change it, and a
     * pending decorative toggle stays pending. Without this, a later Save reads
     * the generated content as dirty and re-stamps it user/ai-edited, tripping
     * the freeze floor. Caption baseline reads title.
     * @private
     * @param {Object} entry - the registry entry just written.
     */
    _reconcileDirtyAfterRun(entry) {
      if (!entry || !this._valuesAtOpen || !this._dirtyFields) {
        logWarn("_reconcileDirtyAfterRun: no entry or no open baseline; skipping");
        return;
      }
      this._valuesAtOpen.caption = entry.title || "";
      this._valuesAtOpen.altText = entry.altText || "";
      this._valuesAtOpen.longDescription = entry.longDescription || "";
      this._valuesAtOpen.textInImage = entry.textInImage || "";
      this._dirtyFields.delete("caption");
      this._dirtyFields.delete("altText");
      this._dirtyFields.delete("longDescription");
      this._dirtyFields.delete("textInImage");
      logInfo("_reconcileDirtyAfterRun: content baselines adopted, content dirty flags cleared (decorative untouched)");
    }

    /**
     * Revert a save by re-applying the pre-save snapshot to the
     * registry and re-running the MMD push pipeline. Source remains
     * "user" on undo (Q5a — every form-driven update is a user
     * decision, including a revert).
     *
     * Called from the success-toast Undo button within the 12s window.
     * Beyond that window the toast has dismissed and this method is
     * unreachable from the UI; Ctrl-Z in the MMD editor remains as
     * a deeper escape hatch (option (b) wiring in _writeMMDFromRegistry).
     *
     * @param {string} imageId
     * @param {Object} snapshot - Pre-save values bag (same shape as
     *   _valuesAtOpen).
     * @param {Array<string>} dirtyKeys - Fields that were modified.
     * @private
     */
    _undoSave(imageId, snapshot, dirtyKeys) {
      logInfo(
        `_undoSave: imageId=${imageId}, dirtyKeys=${JSON.stringify(dirtyKeys)}`,
      );

      const registry = this.restorer?.imageRegistry;
      if (!registry) {
        logWarn("_undoSave: no registry — undo aborted");
        return;
      }

      try {
        this._applyValuesToRegistry(registry, imageId, snapshot, dirtyKeys);
        this._writeMMDFromRegistry(registry);
        // 13(c) — re-render grid after undo so render-time derivations
        // (Alt button modifier, metadata cluster icons, card aria-labels,
        // image alt attribute) match the reverted altText. May re-acquire
        // the --needs-attention modifier if the revert emptied altText.
        // refresh() also calls _updateCoverageCounter() — strict superset.
        this.refresh();
        // Fire-and-forget confirmation — no action affordance, so the
        // 12s success-with-Undo duration would feel over-prominent.
        // 4s is the conventional confirmation-toast window.
        //
        // Parcel g-2: carries the coverage clause too. The undo is exactly the
        // gesture most likely to have MOVED the count back down, so leaving it
        // off would make the one line that reports a decrease the one line
        // without a number. refresh() above has already recounted, so the
        // clause reads the post-undo state.
        notifySuccess(this._withCoverageClause(TOAST_UNDONE_TEXT), {
          duration: 4000,
        });
        logInfo("_undoSave: completed");
      } catch (err) {
        logError("_undoSave: undo failed", err);
        // Match the save-error notification wording — the user's
        // options are the same (retry, edit MMD directly). No
        // second-level error ladder.
        notifyError(TOAST_ERROR_TEXT, {
          duration: 0,
          dismissible: true,
        });
      }
    }

    /**
     * Get the best available image source URL for display.
     * Prefers blob URL, then data URI, then original URL.
     * @param {Object} entry - Image registry entry
     * @returns {string|null} URL string or null
     * @private
     */
    _getImageSrc(entry) {
      // For OCR images: check the blob URL map on the restorer
      if (entry.originalUrl && this.restorer.imageBlobUrlMap) {
        const blobUrl = this.restorer.imageBlobUrlMap.get(entry.originalUrl);
        if (blobUrl) return blobUrl;
      }

      // For user-added images: originalUrl IS the blob URL
      if (entry.originalUrl && entry.originalUrl.startsWith("blob:")) {
        return entry.originalUrl;
      }

      // Fallback to data URI
      if (entry.dataUri) return entry.dataUri;

      // Fallback to original URL (CDN — may not load if offline)
      if (entry.originalUrl) return entry.originalUrl;

      return null;
    }

    /**
     * Materialise a registry entry into a File the OpenRouter Embed validator
     * accepts: `instanceof File`, `.type` one of SUPPORTED_TYPES, and
     * `.size` within MAX_FILE_SIZE.
     *
     * Never returns null — it either returns a validated File or throws a
     * typed Error whose message is prefixed MATERIALISE_ERROR_PREFIX, so the
     * caller can surface the reason verbatim.
     *
     * Resolution order:
     *   A. Type first. An unacceptable type is a hard stop, because the embed
     *      would only reject it later with a less useful message.
     *   B. Happy path — `entry.blob` holds the bytes already (true for every
     *      entry of a ZIP-restored session), so no fetch is issued.
     *   C. Fallback — fetch a `blob:` URL resolved through _getImageSrc.
     *      `entry.originalUrl` (the CDN https form) is deliberately NOT a
     *      fetch source: it was observed unreachable from the page, so trying
     *      it would only convert a clear failure into a slow one.
     *   D. Neither available → the no-source error.
     *
     * Note the boundary: a `data:` URI is not treated as a source. Entries
     * built from MMD never populate `dataUri` (the registry stores null and
     * leaves the base64 in the MMD), and entries that do carry one also carry
     * a blob, so such an entry would already have returned at step B.
     *
     * @param {Object} entry - Image registry entry (from getImage/getAllImages)
     * @param {string} id - Registry ID for the entry (used for the filename)
     * @returns {Promise<File>} A File the embed validator accepts
     * @throws {Error} "Image unavailable: …" with a specific reason
     * @private
     */
    async _materialiseImageFile(entry, id) {
      if (!entry || typeof entry !== "object") {
        throw new Error(
          `${MATERIALISE_ERROR_PREFIX}no registry entry was supplied`,
        );
      }

      const entryId = id || entry.id || "unknown";
      const filenameMap = this.restorer?.imageFilenameMap || {};
      const mappedFilename = filenameMap?.[entryId]?.filename || null;

      // --- A. Type resolution, before anything is constructed or fetched ---
      const candidateType =
        (entry.blob instanceof Blob && entry.blob.type) || entry.mimeType || "";

      let resolvedType = SUPPORTED_TYPES.includes(candidateType)
        ? candidateType
        : null;

      // Only fall back to the extension when nothing has asserted a type.
      // A declared-but-unsupported type is rejected rather than overridden.
      if (!resolvedType && UNASSERTED_BLOB_TYPES.includes(candidateType)) {
        const extSource = mappedFilename || entry.originalUrl || "";
        const extMatch = extSource
          .split("?")[0]
          .split("#")[0]
          .toLowerCase()
          .match(/\.([a-z0-9]+)$/);
        resolvedType = extMatch ? EXTENSION_TYPE_MAP[extMatch[1]] || null : null;
      }

      if (!resolvedType) {
        logWarn(
          `_materialiseImageFile: no acceptable type for ${entryId} (candidate "${candidateType}")`,
        );
        throw new Error(
          `${MATERIALISE_ERROR_PREFIX}unsupported or unknown image type`,
        );
      }

      // --- B/C. Obtain the bytes ---
      let sourceBlob = null;

      if (entry.blob instanceof Blob) {
        sourceBlob = entry.blob;
        logDebug(
          `_materialiseImageFile: using attached blob for ${entryId} (${sourceBlob.size} bytes)`,
        );
      } else {
        const src = this._getImageSrc(entry);

        // Only an object URL is a usable source here — see the note above.
        if (typeof src !== "string" || !src.startsWith("blob:")) {
          logWarn(
            `_materialiseImageFile: no blob and no blob: URL for ${entryId}`,
          );
          throw new Error(
            `${MATERIALISE_ERROR_PREFIX}no image data could be reached (a re-import of the session ZIP may be needed)`,
          );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          MATERIALISE_FETCH_TIMEOUT_MS,
        );

        try {
          const response = await fetch(src, {
            method: "GET",
            signal: controller.signal,
            // No credentials — object URLs are same-origin by construction
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }

          sourceBlob = await response.blob();

          if (!sourceBlob || sourceBlob.size === 0) {
            throw new Error("Empty response body");
          }
        } catch (error) {
          if (error.name === "AbortError") {
            logWarn(
              `_materialiseImageFile: timeout reading blob URL for ${entryId}`,
            );
            throw new Error(
              `${MATERIALISE_ERROR_PREFIX}timed out after ${MATERIALISE_FETCH_TIMEOUT_MS}ms reading the stored image`,
            );
          }

          // A revoked or stale object URL fails exactly this way — the same
          // signature a pre-reload blob: URL gives after the page reloads.
          if (
            error instanceof TypeError &&
            error.message.includes("Failed to fetch")
          ) {
            logWarn(
              `_materialiseImageFile: blob URL no longer resolves for ${entryId}`,
            );
            throw new Error(
              `${MATERIALISE_ERROR_PREFIX}no image data could be reached (a re-import of the session ZIP may be needed)`,
            );
          }

          logError(
            `_materialiseImageFile: failed to read blob URL for ${entryId}`,
            error,
          );
          throw new Error(`${MATERIALISE_ERROR_PREFIX}${error.message}`);
        } finally {
          clearTimeout(timeoutId);
        }
      }

      // --- Construct, then prove it against the validator's own criteria ---
      const name =
        mappedFilename || `image-${entryId}${TYPE_EXTENSION_MAP[resolvedType]}`;
      const file = new File([sourceBlob], name, { type: resolvedType });

      if (!(file instanceof File) || !SUPPORTED_TYPES.includes(file.type)) {
        throw new Error(
          `${MATERIALISE_ERROR_PREFIX}unsupported or unknown image type`,
        );
      }

      if (file.size === 0) {
        throw new Error(
          `${MATERIALISE_ERROR_PREFIX}no image data could be reached (a re-import of the session ZIP may be needed)`,
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new Error(
          `${MATERIALISE_ERROR_PREFIX}image exceeds the 10MB limit`,
        );
      }

      logInfo(
        `_materialiseImageFile: materialised ${entryId} as ${file.name} (${file.type}, ${file.size} bytes)`,
      );
      return file;
    }

    // ========================================================================
    // GRID POPULATION
    // ========================================================================

    /**
     * Refresh the thumbnail grid from the current registry state.
     */
    refresh() {
      logDebug("Refreshing image manager grid");

      const grid = document.getElementById("image-manager-grid");
      const emptyMsg = document.getElementById("image-manager-empty");
      const countEl = document.getElementById("image-manager-count");

      if (!grid) {
        logWarn("Grid element not found — modal may not be open");
        return;
      }

      const registry = this.restorer.imageRegistry;
      if (!registry) {
        logWarn("No image registry on restorer");
        grid.innerHTML = "";
        if (emptyMsg) emptyMsg.hidden = false;
        if (countEl) countEl.textContent = "";
        this._updateCoverageCounter();
        return;
      }

      const images = registry.getAllImages();
      const total = images.length;

      if (total === 0) {
        grid.innerHTML = "";
        if (emptyMsg) emptyMsg.hidden = false;
        if (countEl) countEl.textContent = "0 images";
        this._updateCoverageCounter();
        return;
      }

      if (emptyMsg) emptyMsg.hidden = true;
      if (countEl) {
        countEl.textContent = `${total} image${total !== 1 ? "s" : ""}`;
      }

      const cardsHTML = images
        .map((entry, i) => this._buildImageCard(entry, i, total))
        .join("");

      grid.innerHTML = cardsHTML;

      // Populate data-icon spans inserted by _buildImageCard
      // (cluster slot icons, Alt button pencil icon).
      if (
        window.IconLibrary &&
        typeof window.IconLibrary.populateIcons === "function"
      ) {
        window.IconLibrary.populateIcons();
        logDebug("Populated icons after grid refresh");
      }

      this._updateCoverageCounter();

      // BG-P2 — set the Describe All control's initial state. The toolbar is
      // rebuilt with the manager's markup, so on a fresh open the button starts
      // with no aria-disabled attribute at all; computing it here means the
      // control is never briefly unlabelled-but-live between open and the first
      // edit-view interaction.
      this._refreshDescribeAllControl();

      logDebug(`Grid refreshed with ${total} image(s)`);
    }

    // ========================================================================
    // FILE INPUT HANDLING
    // ========================================================================

    /**
     * Attach the change listener to the hidden file input.
     * @private
     */
    _attachFileInputListener() {
      const fileInput = document.getElementById("image-manager-file-input");
      if (!fileInput) {
        logWarn("File input not found in modal");
        return;
      }

      // Remove any previous listener by replacing the element
      const clone = fileInput.cloneNode(true);
      fileInput.parentNode.replaceChild(clone, fileInput);

      clone.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset input so the same file can be selected again
        clone.value = "";

        try {
          await this._handleFileSelected(file);
        } catch (error) {
          logError("File handling error:", error);
          this._showStatus(`Error: ${error.message}`, "error");
        }
      });

      logDebug("File input listener attached");
    }

    /**
     * Handle a file selected from the file picker.
     * Routes to swap or add based on pending action.
     * @param {File} file - Selected file
     * @private
     */
    async _handleFileSelected(file) {
      // Validate
      const validation = this.validateFile(file);
      if (!validation.valid) {
        this._showStatus(validation.message, "error");
        return;
      }

      // Process file
      this._showStatus("Processing image…", "loading");
      const fileData = await this.processFile(file);

      if (this._pendingAction === "swap" && this._pendingSwapId) {
        await this._executeSwap(this._pendingSwapId, fileData);
      } else if (this._pendingAction === "add") {
        await this._executeAdd(fileData);
      }

      this._pendingAction = null;
      this._pendingSwapId = null;
    }

    // ========================================================================
    // SWAP (REPLACE) FLOW
    // ========================================================================

    /**
     * Initiate the swap flow for a specific image.
     * Opens the file picker; completion handled by file input listener.
     * @param {string} imageId - Registry image ID
     */
    handleSwap(imageId) {
      logInfo(`Swap initiated for image: ${imageId}`);

      const registry = this.restorer.imageRegistry;
      if (!registry || !registry.hasImage(imageId)) {
        this._showStatus("Image not found in registry", "error");
        return;
      }

      this._pendingAction = "swap";
      this._pendingSwapId = imageId;

      const fileInput = document.getElementById("image-manager-file-input");
      if (fileInput) {
        fileInput.click();
      }
    }

    /**
     * Execute the swap after file is processed.
     * @param {string} imageId - Registry image ID
     * @param {Object} fileData - Processed file data
     * @private
     */
    async _executeSwap(imageId, fileData) {
      logInfo(`Executing swap for ${imageId}`);

      try {
        await this.restorer.swapImage(imageId, fileData);

        // Update the filenameMap so the card shows the new file's name
        const filenameMap = this.restorer.imageFilenameMap || {};
        if (filenameMap[imageId] && fileData.originalFilename) {
          filenameMap[imageId].replacedWithFilename = fileData.originalFilename;
        }

        // Parcel g-3: the outcome line carries the coverage clause as its
        // second sentence, via the same helper save and undo use. "Image
        // replaced." rather than "…replaced successfully" — the adverb says
        // nothing the sentence does not, and the clause that follows is what
        // the listener is actually here for.
        this._showStatus(
          this._withCoverageClause(STATUS_SWAP_TEXT),
          "success",
        );
        this.refresh();
      } catch (error) {
        logError("Swap failed:", error);
        this._showStatus(`Replace failed: ${error.message}`, "error");
      }
    }

    // ========================================================================
    // ADD FLOW
    // ========================================================================

    /**
     * Initiate the add-image flow.
     * Opens the file picker; completion handled by file input listener.
     */
    handleAdd() {
      logInfo("Add image initiated");

      this._pendingAction = "add";
      this._pendingSwapId = null;

      const fileInput = document.getElementById("image-manager-file-input");
      if (fileInput) {
        fileInput.click();
      }
    }

    /**
     * Execute the add after file is processed.
     * @param {Object} fileData - Processed file data
     * @private
     */
    async _executeAdd(fileData) {
      logInfo("Executing add image");

      try {
        await this.restorer.addImageToDocument(fileData);
        // Parcel g-3: coverage clause as the second sentence, same helper.
        this._showStatus(this._withCoverageClause(STATUS_ADD_TEXT), "success");
        this.refresh();
      } catch (error) {
        logError("Add failed:", error);
        this._showStatus(`Add failed: ${error.message}`, "error");
      }
    }

    // ========================================================================
    // DELETE FLOW
    // ========================================================================

    /**
     * Initiate the delete flow for a specific image.
     * Shows confirmation dialog, then removes if confirmed.
     * @param {string} imageId - Registry image ID
     */
    async handleDelete(imageId) {
      logInfo(`Delete initiated for image: ${imageId}`);

      const registry = this.restorer.imageRegistry;
      if (!registry || !registry.hasImage(imageId)) {
        this._showStatus("Image not found in registry", "error");
        return;
      }

      // Close the current modal temporarily so safeConfirm is visible
      // (safeConfirm creates its own modal which would conflict)
      const confirmed = await this._confirmDelete();

      if (!confirmed) {
        logDebug("Delete cancelled by user");
        return;
      }

      // Parcel g-9. The deleted image's POSITION, read BEFORE the delete: the
      // delete and the rebuild that follows destroy the ordering this is read
      // from, so afterwards there is nothing left to read it from. Only the
      // images-remain branch below consumes it.
      const deletedIndex = this._registryIndexOf(imageId);

      try {
        await this.restorer.deleteImage(imageId);
        this.refresh();

        // Read the registry AFTER the delete: this decides both the clause's
        // count and which of the two routes below the line takes.
        const remaining = registry.getCount();

        if (remaining === 0) {
          // LAST IMAGE. No modal write at all — the close timer below fires
          // 300ms from here, so a line written into the modal would be torn
          // down with it. It is spoken from the page announcer instead, once
          // onClose confirms teardown has completed.
          //
          // No coverage clause: with the registry empty _composeCoverageClause
          // returns null anyway (the g-3 0/0 ruling), so the gesture sentence
          // stands alone by the same rule rather than by a second decision.
          this._pendingCloseAnnouncement = STATUS_REMOVE_TEXT;
          logDebug(
            "Last image removed — remove line deferred to the close announcer",
          );
        } else {
          // Images remain, so the manager stays open and owns the line. Wait
          // for our own modal to be the stack top before writing: the confirm
          // resolves synchronously BEFORE its own finishClose, so without this
          // the write lands in the closing confirm dialog. The helper writes
          // anyway on expiry — see its doc comment.
          await this._waitForOwnModalTop();

          // Parcel g-9. FOCUS RETURN, placed exactly here and nowhere else.
          //
          // Measured at g-9a, three moments, three runs each. A call placed
          // immediately after refresh() lands NOTHING, zero of three: the
          // confirm dialog is still open, so the target sits outside the topmost
          // modal dialog and is blocked by the top layer with no inert attribute
          // anywhere. A call placed HERE lands three of three, and cannot be
          // stolen by the modal's own tier restore — the removal from
          // activeModals and that restore are both synchronous inside
          // finishClose, and the polled wait above cannot resolve between them,
          // so it is causally after both.
          //
          // BEFORE THE SETTLE, not after it. Measured 1012 to 1381ms of clear
          // air between this point and the status write below, which keeps the
          // focus change well outside the ~10ms window measured in this lane to
          // make NVDA drop a polite write. Placing it after the settle collides
          // with the write instead.
          //
          // The wait's false expiry path is deliberately NOT consulted, matching
          // the write-anyway rule immediately below: the focus is attempted
          // regardless and the verification inside the helper reports what
          // actually happened, rather than skipping and going silent.
          this._focusNextCardAltBtn(deletedIndex);

          // Parcel g-5. Being top of the stack is necessary and NOT sufficient:
          // the reader is still re-orienting to this dialog, and a write that
          // lands during that window is dropped silently. Settle past it before
          // the single write. See REMOVE_ANNOUNCE_SETTLE_MS for the measurement
          // and its one-reader/one-machine caveat.
          //
          // The wait's return value is deliberately not consulted — its
          // write-anyway rule stands, so an expired wait still settles and still
          // writes rather than going silent.
          await new Promise((resolve) =>
            setTimeout(resolve, REMOVE_ANNOUNCE_SETTLE_MS),
          );

          this._showStatus(
            this._withCoverageClause(STATUS_REMOVE_TEXT),
            "success",
          );
        }

        // If no images remain, close the modal after a short delay.
        // Delay is necessary because safeConfirm's modal close uses a 200ms
        // animation timeout — resolve() fires before finishClose() removes it
        // from activeModals. Without this delay, getCurrentModalId() returns
        // the confirm modal's ID instead of ours, so our close() is misdirected.
        if (registry.getCount() === 0) {
          setTimeout(() => this.close(), 300);
        }
      } catch (error) {
        logError("Delete failed:", error);
        this._showStatus(`Remove failed: ${error.message}`, "error");
      }
    }

    /**
     * Show confirmation dialog for delete.
     * @returns {Promise<boolean>} True if confirmed
     * @private
     */
    async _confirmDelete() {
      if (typeof safeConfirm === "function") {
        return await safeConfirm(
          "Remove this image from the document?",
          "Remove Image",
        );
      }
      // Fallback
      return confirm("Remove this image from the document?");
    }

    // ========================================================================
    // FILE VALIDATION & PROCESSING
    // ========================================================================

    /**
     * Validate a file for upload.
     * Checks type (JPEG, PNG, WebP) and size (<10 MB).
     * @param {File} file - File to validate
     * @returns {{ valid: boolean, message: string }}
     */
    validateFile(file) {
      if (!file) {
        return { valid: false, message: "No file selected" };
      }

      if (!SUPPORTED_TYPES.includes(file.type)) {
        return {
          valid: false,
          message: `Unsupported file type: ${file.type || "unknown"}. Use JPEG, PNG, or WebP.`,
        };
      }

      if (file.size > MAX_FILE_SIZE) {
        return {
          valid: false,
          message: `File too large (${formatFileSize(file.size)}). Maximum is 10 MB.`,
        };
      }

      return { valid: true, message: "OK" };
    }

    /**
     * Process a file into the data structure needed for registry operations.
     * Reads as data URI and gets dimensions.
     * @param {File} file - File to process
     * @returns {Promise<Object>} { blob, blobUrl, dataUri, mimeType, fileSize, dimensions }
     */
    async processFile(file) {
      const blob = file;
      const blobUrl = URL.createObjectURL(blob);
      const mimeType = file.type;
      const fileSize = file.size;
      const originalFilename = file.name || null;

      // Read as data URI (base64)
      const dataUri = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      // Get dimensions
      const dimensions = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = blobUrl;
      });

      logDebug("File processed:", {
        originalFilename,
        mimeType,
        fileSize: formatFileSize(fileSize),
        dimensions,
      });

      return {
        blob,
        blobUrl,
        dataUri,
        mimeType,
        fileSize,
        dimensions,
        originalFilename,
      };
    }
    // ========================================================================
    // STATUS MESSAGES
    // ========================================================================

    /**
     * Show a status message in the modal.
     * Uses UniversalModal.showStatus if available, else logs.
     * @param {string} message - Message text
     * @param {string} type - "info" | "success" | "error" | "loading"
     * @private
     */
    _showStatus(message, type) {
      if (typeof UniversalModal !== "undefined" && UniversalModal.showStatus) {
        UniversalModal.showStatus(message, type);

        // Auto-hide success/info after 3 seconds
        if (type === "success" || type === "info") {
          setTimeout(() => {
            if (typeof UniversalModal.hideStatus === "function") {
              UniversalModal.hideStatus();
            }
          }, 3000);
        }
      } else {
        logInfo(`[${type}] ${message}`);
      }
    }

    // ========================================================================
    // UTILITY: ESCAPING
    // ========================================================================

    /**
     * Escape HTML entities
     * @param {string} str - Raw string
     * @returns {string} Escaped string
     * @private
     */
    _escapeHTML(str) {
      if (!str) return "";
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    /**
     * Escape for use in HTML attributes
     * @param {string} str - Raw string
     * @returns {string} Escaped string
     * @private
     */
    _escapeAttr(str) {
      if (!str) return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }

  // ============================================================================
  // THUMBNAIL ERROR RECOVERY
  // ============================================================================

  /**
   * Handle thumbnail load failure by falling back to dataUri or CDN URL.
   * Called via inline onerror on <img> elements in the image grid.
   * @param {HTMLImageElement} imgEl - The <img> element that failed to load
   */
  function handleThumbnailError(imgEl) {
    // Prevent infinite error loops
    imgEl.onerror = null;

    const imageId = imgEl.dataset.imageId;
    if (!imageId) {
      logWarn("Thumbnail error: no data-image-id on <img>");
      return;
    }

    // Get or create the singleton instance
    const mgr = getInstance();
    if (!mgr?.restorer?.imageRegistry) {
      logWarn(`Thumbnail error for ${imageId}: no registry available`);
      return;
    }

    const entry = mgr.restorer.imageRegistry.getImage(imageId);
    if (!entry) {
      logWarn(`Thumbnail error for ${imageId}: not found in registry`);
      return;
    }

    // Try dataUri first (works offline, always available for user-added)
    if (entry.dataUri) {
      logInfo(`Thumbnail fallback for ${imageId}: using dataUri`);
      imgEl.src = entry.dataUri;
      return;
    }

    // Try CDN URL (requires network, only for OCR images)
    if (entry.originalUrl && entry.originalUrl.startsWith("http")) {
      logInfo(`Thumbnail fallback for ${imageId}: using CDN URL`);
      imgEl.src = entry.originalUrl;
      return;
    }

    logWarn(
      `Thumbnail fallback exhausted for ${imageId}: no displayable source`,
    );
  }

  // Expose globally for inline onerror handlers
  window._handleThumbnailError = handleThumbnailError;

  // ============================================================================
  // SINGLETON & GLOBAL EXPOSURE
  // ============================================================================

  /** @type {MathPixImageManagerUI|null} Singleton instance */
  let instance = null;

  /**
   * Get or create the singleton instance.
   * @returns {MathPixImageManagerUI|null}
   */
  function getInstance() {
    if (instance) return instance;

    // Try to get the restorer via its getter function
    const restorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;

    if (!restorer) {
      logWarn("Cannot create instance: session restorer not available");
      return null;
    }

    instance = new MathPixImageManagerUI(restorer);
    return instance;
  }

  // ============================================================================
  // GLOBAL ONCLICK WRAPPERS
  // ============================================================================

  window.openImageManager = function () {
    const mgr = getInstance();
    if (mgr) {
      mgr.open();
    } else {
      logError("Image manager could not be initialised");
    }
  };

  window.closeImageManager = function () {
    if (instance) {
      instance.close();
    }
  };

  window.swapImage = function (imageId) {
    const mgr = getInstance();
    if (mgr) {
      mgr.handleSwap(imageId);
    }
  };

  window.addImageToDocument = function () {
    const mgr = getInstance();
    if (mgr) {
      mgr.handleAdd();
    }
  };

  // Parcel BG-P2 — the Describe All toolbar handler, on the same inline-onclick
  // convention as addImageToDocument above (AGENTS.md accepts onclick for simple
  // handlers). The blocking checks and the spoken feedback are the method's, not
  // this wrapper's, so the button and any future caller behave identically.
  window.describeAllImages = function () {
    const mgr = getInstance();
    if (mgr) {
      mgr._handleDescribeAll();
    }
  };

  window.deleteImage = function (imageId) {
    const mgr = getInstance();
    if (mgr) {
      mgr.handleDelete(imageId);
    }
  };

  // Stage 5 Chunk 3a — global handler for the per-card Alt button.
  // Delegates to the manager instance method. Logs at INFO so the click
  // is visible during testing without flipping the file's log level.
  window.openEditAltText = function (imageId) {
    logInfo(`openEditAltText called for image: ${imageId}`);
    const mgr = getInstance();
    if (mgr) {
      mgr.openEditAltText(imageId);
    }
  };

  // ============================================================================
  // CONSOLE TESTS
  // ============================================================================

  /**
   * Test image manager UI functionality
   * @returns {Object} Test results
   */
  window.testImageManagerUI = function () {
    console.log("=== Image Manager UI Tests ===\n");
    let passed = 0;
    let failed = 0;

    function assert(name, condition) {
      if (condition) {
        console.log(`  ✓ ${name}`);
        passed++;
      } else {
        console.error(`  ✗ ${name}`);
        failed++;
      }
    }

    // Test 1: Class exists
    assert(
      "MathPixImageManagerUI class exists",
      typeof MathPixImageManagerUI === "function",
    );

    // Test 2: Global functions exist
    assert(
      "openImageManager exists",
      typeof window.openImageManager === "function",
    );
    assert(
      "closeImageManager exists",
      typeof window.closeImageManager === "function",
    );
    assert("swapImage exists", typeof window.swapImage === "function");
    assert(
      "addImageToDocument exists",
      typeof window.addImageToDocument === "function",
    );
    assert("deleteImage exists", typeof window.deleteImage === "function");

    // Test 3: getInstance
    const mgr = getInstance();
    const hasRestorer = !!window.mathPixSessionRestorer;
    if (hasRestorer) {
      assert("getInstance returns instance when restorer available", !!mgr);
      assert("Instance has open method", typeof mgr?.open === "function");
      assert("Instance has close method", typeof mgr?.close === "function");
      assert("Instance has refresh method", typeof mgr?.refresh === "function");
      assert(
        "Instance has handleSwap method",
        typeof mgr?.handleSwap === "function",
      );
      assert(
        "Instance has handleAdd method",
        typeof mgr?.handleAdd === "function",
      );
      assert(
        "Instance has handleDelete method",
        typeof mgr?.handleDelete === "function",
      );
      assert(
        "Instance has validateFile method",
        typeof mgr?.validateFile === "function",
      );
      assert(
        "Instance has processFile method",
        typeof mgr?.processFile === "function",
      );
    } else {
      console.log("  ⚠ Skipping instance tests — no restorer available");
    }

    // Test 4: File validation
    if (mgr) {
      const fakeJPEG = new File(["data"], "test.jpg", { type: "image/jpeg" });
      const validResult = mgr.validateFile(fakeJPEG);
      assert("Valid JPEG passes validation", validResult.valid === true);

      const fakePDF = new File(["data"], "test.pdf", {
        type: "application/pdf",
      });
      const invalidResult = mgr.validateFile(fakePDF);
      assert("PDF fails validation", invalidResult.valid === false);

      const noFile = mgr.validateFile(null);
      assert("null file fails validation", noFile.valid === false);
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    return { passed, failed };
  };

  // Return public API
  return {
    MathPixImageManagerUI,
    getInstance,
    // Exposed for Stage 5 tests (Phase D Fix 1): asserts the body class
    // string the manager toggles is the one the scoped CSS rule targets.
    BODY_CLASS_MANAGER_OPEN,
    // Parcel 8a-ii — the provenance label maps, exposed as the single source of
    // truth so tests (and any future consumer) read the wording from here rather
    // than hard-coding it. The module-level consts keep their names; these are
    // the same object references, not copies.
    EDIT_PROVENANCE_TEXT_VISIBLE,
    EDIT_PROVENANCE_TEXT_SR,
    // Parcel g-5 — same single-source rule as the two maps above: the guard row
    // asserting the settle READS this value rather than restating 1000, so
    // retuning the constant retunes its own gate instead of reddening it.
    REMOVE_ANNOUNCE_SETTLE_MS,
    // Parcel g-8 — the last-image branch's own settle, exposed on the same
    // single-source rule as g-5's: the guard row READS this value rather than
    // restating 1500, so retuning it retunes its own gate instead of reddening
    // one. Kept separate from REMOVE_ANNOUNCE_SETTLE_MS on purpose — different
    // event, different measurement.
    LAST_IMAGE_ANNOUNCE_SETTLE_MS,
    // Parcel g-6 — the focus park the deferred close announcement is spoken
    // behind. Exposed on the same single-source rule: the guard row READS the
    // id from here, so moving the park moves its own gate rather than leaving
    // a row that quietly asserts the wrong element.
    MANAGE_IMAGES_BTN_ID,
    // Parcel g-10 — same single-source rule as the constants above: the guard
    // rows READ these rather than restating the strings, so rewording the
    // blocked line or the name suffix retunes its own gate instead of
    // reddening one. EDIT_VIEW_GENERATE_BTN_ID joins them because a row
    // asserting on that control must not hard-code its id either.
    GENERATE_BLOCKED_NAME_SUFFIX,
    GENERATE_BLOCKED_STATUS_LINE,
    GENERATE_BLOCKED_SUFFIX_ATTR,
    EDIT_VIEW_GENERATE_BTN_ID,
    EDIT_VIEW_AI_STATUS_ID,
    // Parcel BG-P2 — same single-source rule as every constant above: the guard
    // rows READ these rather than restating the strings and ids, so rewording a
    // blocked line or renaming a view retunes its own gate instead of reddening
    // one. The two blocked suffixes are exposed separately because they are
    // deliberately DIFFERENT sentences — a run in flight is a wait, an open edit
    // view is an action — and a row must be able to tell them apart.
    BATCH_DESCRIBE_ALL_BTN_ID,
    BATCH_DIALOG_CLASS,
    BATCH_START_VIEW_ID,
    BATCH_RUNNING_VIEW_ID,
    BATCH_COMPLETE_VIEW_ID,
    BATCH_CONFIRM_BTN_ID,
    BATCH_CANCEL_BTN_ID,
    BATCH_CLOSE_BTN_ID,
    BATCH_SUMMARY_ID,
    BATCH_START_LINE_SINGULAR,
    BATCH_START_LINE_PLURAL,
    DESCRIBE_ALL_BLOCKED_SUFFIX_ATTR,
    DESCRIBE_ALL_BLOCKED_BY_RUN_SUFFIX,
    DESCRIBE_ALL_BLOCKED_BY_EDIT_SUFFIX,
    DESCRIBE_ALL_BLOCKED_BY_RUN_LINE,
    DESCRIBE_ALL_BLOCKED_BY_EDIT_LINE,
  };
})();

// Export for external access
window.MathPixImageManagerUI = MathPixImageManagerUI;
