/**
 * @fileoverview Stage 5 test runner — verifies the Edit Alt Text view
 *   UI shell added in Stage 5 Chunk 2, and (in future chunks) the
 *   form-state machinery and save flow.
 * @module MathPixStage5Tests
 * @requires MathPixImageRegistry, MathPixImageManagerUI
 * @version 1.0.0 (Stage 5 Chunk 2)
 *
 * Per stage-5-planning-decisions.md Q9 (amended Phase B): one consolidated
 * runner, internally organised by task with clear section headers.
 *
 * Location deviation: Q9 originally specified js/testing/; Phase B amended
 * to mathpix-scripts/testing/ to match the existing mathpix-*-tests.js
 * convention. Recorded in the Stage 5 outcome row.
 *
 * Group 2 (always runs) — UI shell assertions against the rendered HTML
 *   produced by MathPixImageManagerUI._buildEditAltViewHTML.
 *
 * Group 3 (preconditioned) — integration assertions against the live DOM
 *   when the manager is open. Reports as skipped (not failed) when
 *   preconditions (MathPix mode active, manager open) are not all met.
 *
 * Group 4 (always runs) — Phase 4a.5 synthetic restore invariant (registry
 *   mmdReference ↔ currentMMD substring match after blob-URL rewrite).
 *
 * Group 5 (preconditioned) — Chunk 4b close-flow save integration: Back
 *   button, Escape-in-edit-view, and manager onClose all route through
 *   _performSave per Q10. Same preconditions as Group 3.
 *
 * Usage: `window.runStage5Tests()` from the console. Returns
 *   { passed, failed, skipped, results }.
 *
 * @see mathpix-scripts/docs/alt-text/stage-5-planning-decisions.md — Q9, Q10
 */

(function () {
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
  function logError(msg, ...args) {
    if (shouldLog(0)) console.error(`[Stage5Tests] ${msg}`, ...args);
  }
  function logWarn(msg, ...args) {
    if (shouldLog(1)) console.warn(`[Stage5Tests] ${msg}`, ...args);
  }
  function logInfo(msg, ...args) {
    if (shouldLog(2)) console.log(`[Stage5Tests] ${msg}`, ...args);
  }
  function logDebug(msg, ...args) {
    if (shouldLog(3)) console.log(`[Stage5Tests] ${msg}`, ...args);
  }

  // ============================================================================
  // CONSTANTS — snapshots of module-internal constants in mathpix-image-manager-ui.js
  // If those copies change, these snapshot tests will flag the divergence.
  // ============================================================================

  const EXPECTED_LEGACY_CONFLICT_BANNER_TEXT =
    "Decorative is on, and this image has stored alt text and long description. Those values won't be used while decorative is on. Untick decorative to use them, or save without changes to keep things as they are.";

  const EXPECTED_INCLUDEGRAPHICS_CLEAR_HINT =
    "This image had a figure wrapper in the source document. Clearing the caption will keep the wrapper in place in the MMD. To remove it entirely, edit the MMD directly.";

  const EXPECTED_DISABLE_HINT =
    "Decorative images don't need alt text or long description.";

  const EXPECTED_FIELD_HELP = {
    caption: "Adds a visible caption shown beneath the image.",
    altText: "Two sentences usually works well.",
    longDescription:
      "Use this for diagrams, charts, or images that need a fuller explanation than alt text can carry.",
    textInImage:
      "List any text visible inside the image (labels, captions, signs).",
  };

  const EXPECTED_GRID_REGION_HEADING_TEXT = "Document images";
  const EXPECTED_EDIT_VIEW_HEADING_PREFIX = "Edit alt text";

  // Phase D Fix 1 — body class added to <body> while the manager modal is
  // open; scoped CSS rule body.mathpix-manager-open .universal-toggletip
  // raises the toggletip z-index above UniversalModal's 107974.
  const EXPECTED_BODY_CLASS_MANAGER_OPEN = "mathpix-manager-open";

  // Per-field IDs, mirrored from FIELD_IDS in mathpix-image-manager-ui.js.
  const EXPECTED_FIELD_IDS = {
    caption: {
      input: "edit-alt-caption-input",
      help: "edit-alt-caption-help",
      count: "edit-alt-caption-count",
      hint: "edit-alt-caption-hint",
      toggletip: "edit-alt-caption-toggletip",
    },
    altText: {
      input: "edit-alt-alttext-input",
      help: "edit-alt-alttext-help",
      count: "edit-alt-alttext-count",
    },
    longDescription: {
      input: "edit-alt-longdesc-input",
      help: "edit-alt-longdesc-help",
      count: "edit-alt-longdesc-count",
    },
    textInImage: {
      input: "edit-alt-textinimage-input",
      help: "edit-alt-textinimage-help",
      count: "edit-alt-textinimage-count",
    },
    decorative: {
      input: "edit-alt-decorative-input",
    },
  };

  // Container / control IDs.
  const ID_GRID_VIEW = "mmd-image-manager-grid-view";
  const ID_GRID_REGION_HEADING = "mmd-image-manager-grid-view-heading";
  const ID_EDIT_VIEW = "mmd-image-manager-edit-view";
  const ID_EDIT_HEADING = "edit-alt-view-heading";
  const ID_EDIT_SUBTITLE = "edit-alt-view-subtitle";
  const ID_EDIT_FORM = "edit-alt-form";
  const ID_EDIT_BACK_BTN = "edit-alt-back-btn";
  const ID_EDIT_SAVE_BTN = "edit-alt-save-btn";
  const ID_EDIT_BANNER = "edit-alt-legacy-banner";
  const ID_EDIT_PREVIEW_IMG = "edit-alt-preview-img";
  const ID_EDIT_PREVIEW_CAPTION = "edit-alt-preview-caption";
  const ID_EDIT_DISABLE_HINT = "edit-alt-disable-hint";

  // Group 3 assertion count — used for skip bookkeeping. Keep in sync.
  //   30 = Chunk 2 UI shell live-DOM assertions.
  //    1 = Chunk 3a Phase D body-class assertion (manager open ⇒ class on body).
  //    1 = Chunk 3a Phase D round 2 toggletip-re-parented-into-dialog
  //        assertion (top-layer stacking context fix).
  //   16 = Chunk 3a form-lifecycle live-DOM assertions (open / close /
  //        focus / field population / character counts; +1 in Phase D for
  //        Back-button focus return to the originating Alt button).
  //   11 = Chunk 3b form-reactivity live-DOM assertions (caption count +
  //        dirty set/clear on revert; decorative tick disables alt +
  //        longdesc + un-hides Q3 hint + shows banner; decorative untick
  //        re-enables fields + hides hint + hides banner).
  //    7 = Chunk 4a save-flow live-DOM assertions (dirty save updates
  //        registry + closes view; clean save leaves registry untouched;
  //        forced error keeps edit view open + emits error toast; direct
  //        _undoSave reverts the registry).
  // When no images are present, the 34 lifecycle + reactivity + save-flow
  // assertions skip internally — see runGroup3.
  const GROUP_3_ASSERTION_COUNT = 66;
  const GROUP_3_LIFECYCLE_ASSERTION_COUNT = 34;

  // Group 5 assertion count — Chunk 4b close-flow save integration.
  //   3 = Case 1 (Back-dirty saves): registry mutated, edit hidden, grid shown.
  //   3 = Case 2 (Back-clean is silent close): registry unchanged, edit hidden,
  //       no success toast.
  //   2 = Case 3 (Escape-dirty saves): registry mutated, edit hidden.
  //   2 = Case 4 (Escape-clean is silent close): registry unchanged, edit hidden.
  //   1 = Cases 5–7 prerequisite (X button exists in modal DOM and
  //       _attachXButtonInterceptor is a function).
  //   1 = Case 5 (X-close-dirty): _performSave invoked once by capture-phase
  //       listener.
  //   1 = Case 6 (X-close-clean, edit view open): _performSave not invoked.
  //   1 = Case 7 setup (_currentEditImageId null in grid view).
  //   1 = Case 7 (X-close in grid view): _performSave not invoked.
  //   1 = Case 8a (Discovery 19 — notifySuccess forceToast option): with
  //       modal active, forceToast:true routes to global toast not in-modal.
  //   1 = Case 8b (Discovery 19): without forceToast, routes in-modal as
  //       before.
  //   1 = Case 9 (Discovery 19 — _performSave plumbing): _performSave passes
  //       options.forceToast through to notifySuccess.
  //   1 = Case 10 (Discovery 19 — X interceptor): the X-button capture-phase
  //       listener calls _performSave with { forceToast: true }.
  //   5 = Case 11 (13(c) / Discovery 20 — grid re-renders after save/undo):
  //       11A: after save with non-empty altText, Alt button has NO
  //            --needs-attention modifier class.
  //       11B: after save clearing altText to "", Alt button HAS the
  //            --needs-attention modifier class.
  //       11C: after _undoSave reverting altText "" → "X", Alt button
  //            re-acquires --needs-attention.
  //       11D: after save with non-empty altText, the card's metadata
  //            cluster contains the alt-set icon (B.3 regression check
  //            for the wider stale-state scope refresh() also fixes).
  //       11E: after _performSave runs refresh() and _closeEditAltText
  //            returns focus, document.activeElement is the originating
  //            card's Alt button (Q8b focus-return invariant survives
  //            the new refresh() in step 4 because _focusCardAltBtn
  //            re-queries by data-image-id, not a cached reference).
  // Skipped wholesale when preconditions (MathPix mode + manager open) or
  // image registry are unavailable.
  const GROUP_5_ASSERTION_COUNT = 24;

  // ============================================================================
  // RESULTS ACCUMULATOR
  // ============================================================================

  function makeResults() {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const results = [];

    function assert(label, condition, detail) {
      if (condition) {
        passed++;
        results.push({ label, passed: true, error: null });
        console.log(`  ✓ ${label}`);
        return true;
      }
      failed++;
      const errMsg = detail || null;
      results.push({ label, passed: false, error: errMsg });
      console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
      return false;
    }

    function skip(count) {
      skipped += count;
    }

    return {
      get passed() {
        return passed;
      },
      get failed() {
        return failed;
      },
      get skipped() {
        return skipped;
      },
      results,
      assert,
      skip,
    };
  }

  // ============================================================================
  // STUB MANAGER FOR RENDERER UNIT TESTS
  // ============================================================================

  /**
   * Resolve the MathPixImageManagerUI class from window. The IIFE at the
   * bottom of mathpix-image-manager-ui.js exposes a namespace object
   * `{ MathPixImageManagerUI, getInstance }` — so the class is at
   * `window.MathPixImageManagerUI.MathPixImageManagerUI`. Defensive
   * fallback handles the case where the class is exposed directly.
   *
   * @returns {Function|null}
   */
  function resolveManagerClass() {
    const ns = window.MathPixImageManagerUI;
    if (!ns) return null;
    if (typeof ns === "function") return ns;
    if (typeof ns.MathPixImageManagerUI === "function") {
      return ns.MathPixImageManagerUI;
    }
    return null;
  }

  /**
   * Build a minimal MathPixImageManagerUI stub for invoking
   * _buildEditAltViewHTML outside a live manager session. The method
   * reads no instance state, so an empty stub is sufficient.
   *
   * Using Object.create avoids invoking the constructor, which would
   * refuse an absent restorer with logError.
   *
   * @returns {Object|null} Stub instance with prototype methods, or null
   */
  function makeStubManager() {
    const Cls = resolveManagerClass();
    if (!Cls) return null;
    const stub = Object.create(Cls.prototype);
    stub.restorer = { imageFilenameMap: {}, imageBlobUrlMap: null };
    return stub;
  }

  /**
   * Parse the edit-view HTML string into a DOM section element.
   * @param {string} html
   * @returns {HTMLElement|null}
   */
  function parseEditView(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return doc.getElementById(ID_EDIT_VIEW);
  }

  // ============================================================================
  // === Task 5.1: UI shell ===
  // ============================================================================

  // ----------------------------------------------------------------------------
  // GROUP 2 — RENDERER UNIT TESTS (always runs)
  // ----------------------------------------------------------------------------

  function runGroup2(r) {
    console.log("\n--- Group 2: UI shell renderer unit tests ---");

    const Cls = resolveManagerClass();
    r.assert(
      "MathPixImageManagerUI class exposed on window",
      typeof Cls === "function",
    );
    if (typeof Cls !== "function") return;

    const mgr = makeStubManager();
    r.assert(
      "_buildEditAltViewHTML method exists on prototype",
      typeof mgr?._buildEditAltViewHTML === "function",
    );
    if (typeof mgr?._buildEditAltViewHTML !== "function") return;

    const html = mgr._buildEditAltViewHTML();
    r.assert(
      "_buildEditAltViewHTML returns a non-empty string",
      typeof html === "string" && html.trim().length > 0,
    );

    const section = parseEditView(html);
    r.assert("Rendered HTML contains the edit-view <section>", !!section);
    if (!section) return;

    // --- Section attributes ---
    r.assert(
      "Edit view <section> tag name === SECTION",
      section.tagName === "SECTION",
    );
    r.assert(
      `Edit view aria-labelledby === "${ID_EDIT_HEADING}"`,
      section.getAttribute("aria-labelledby") === ID_EDIT_HEADING,
    );
    r.assert("Edit view starts hidden", section.hasAttribute("hidden"));

    // --- Header structure ---
    const header = section.querySelector(
      ".mmd-image-manager-edit-view-header",
    );
    r.assert(
      "Header element present and is <header>",
      !!header && header.tagName === "HEADER",
    );

    const backBtn = section.querySelector(`#${ID_EDIT_BACK_BTN}`);
    r.assert("Back button present", !!backBtn);
    r.assert(
      "Back button is <button type=\"button\">",
      backBtn?.tagName === "BUTTON" && backBtn?.getAttribute("type") === "button",
    );
    r.assert(
      "Back button has data-icon=\"arrowLeft\" span",
      !!backBtn?.querySelector('[data-icon="arrowLeft"]'),
    );
    r.assert(
      "Back button visible label includes \"Back\"",
      (backBtn?.textContent || "").trim().includes("Back"),
    );

    const heading = section.querySelector(`#${ID_EDIT_HEADING}`);
    r.assert("Edit view heading present", !!heading);
    r.assert(
      `Edit view heading is <h2> with tabindex="-1"`,
      heading?.tagName === "H2" && heading?.getAttribute("tabindex") === "-1",
    );
    r.assert(
      `Edit view heading initial text === "${EXPECTED_EDIT_VIEW_HEADING_PREFIX}"`,
      (heading?.textContent || "").trim() ===
        EXPECTED_EDIT_VIEW_HEADING_PREFIX,
    );

    const subtitle = section.querySelector(`#${ID_EDIT_SUBTITLE}`);
    r.assert(
      "Edit view subtitle <p> present and empty in Chunk 2",
      !!subtitle && subtitle.tagName === "P",
    );

    // --- Legacy-conflict banner (Q6d exception) ---
    const banner = section.querySelector(`#${ID_EDIT_BANNER}`);
    r.assert("Legacy banner present", !!banner);
    r.assert(
      "Banner role=\"status\"",
      banner?.getAttribute("role") === "status",
    );
    r.assert(
      "Banner aria-live=\"polite\"",
      banner?.getAttribute("aria-live") === "polite",
    );
    r.assert("Banner starts hidden", banner?.hasAttribute("hidden"));
    r.assert(
      "Banner text exact match (Q6a)",
      (banner?.textContent || "").trim() ===
        EXPECTED_LEGACY_CONFLICT_BANNER_TEXT,
    );

    // --- Body: figure + form ---
    const figure = section.querySelector(".mmd-image-manager-edit-preview");
    r.assert(
      "Image preview <figure> present",
      !!figure && figure.tagName === "FIGURE",
    );
    r.assert(
      "Preview <img> present with expected ID",
      !!figure?.querySelector(`#${ID_EDIT_PREVIEW_IMG}`),
    );
    r.assert(
      "Preview <figcaption> present with expected ID",
      !!figure?.querySelector(`#${ID_EDIT_PREVIEW_CAPTION}`),
    );

    const form = section.querySelector(`#${ID_EDIT_FORM}`);
    r.assert(
      "Form element present and is <form>",
      !!form && form.tagName === "FORM",
    );

    // --- Fields: tag + label-linkage + aria-describedby resolution ---
    const fields = [
      {
        key: "caption",
        ids: EXPECTED_FIELD_IDS.caption,
        expectedTag: "INPUT",
        expectedType: "text",
        // Caption intentionally lists only help+count. The Q2 hint is in
        // the DOM but excluded from initial aria-describedby — see the
        // dedicated assertion block below for the contract. Chunk 3 will
        // toggle the hint ID dynamically alongside the hint's hidden attr.
        describers: ["help", "count"],
      },
      {
        key: "altText",
        ids: EXPECTED_FIELD_IDS.altText,
        expectedTag: "TEXTAREA",
        describers: ["help", "count"],
      },
      {
        key: "longDescription",
        ids: EXPECTED_FIELD_IDS.longDescription,
        expectedTag: "TEXTAREA",
        describers: ["help", "count"],
      },
      {
        key: "textInImage",
        ids: EXPECTED_FIELD_IDS.textInImage,
        expectedTag: "INPUT",
        expectedType: "text",
        describers: ["help", "count"],
      },
    ];

    for (const f of fields) {
      const input = section.querySelector(`#${f.ids.input}`);
      r.assert(`Field "${f.key}" — input present`, !!input);
      r.assert(
        `Field "${f.key}" — tag === ${f.expectedTag}`,
        input?.tagName === f.expectedTag,
      );
      if (f.expectedType) {
        r.assert(
          `Field "${f.key}" — type === "${f.expectedType}"`,
          input?.getAttribute("type") === f.expectedType,
        );
      }

      // Label linkage (label[for] === input ID)
      const label = section.querySelector(`label[for="${f.ids.input}"]`);
      r.assert(`Field "${f.key}" — label linked via for=`, !!label);

      // aria-describedby resolves to elements that exist
      const describedBy = (input?.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean);
      const expectedDescribers = f.describers.map((d) => f.ids[d]);
      const allDescribersResolve = expectedDescribers.every((id) =>
        section.querySelector(`#${id}`),
      );
      r.assert(
        `Field "${f.key}" — all aria-describedby IDs resolve in DOM (${expectedDescribers.join(", ")})`,
        allDescribersResolve,
      );
      r.assert(
        `Field "${f.key}" — aria-describedby includes all expected IDs`,
        expectedDescribers.every((id) => describedBy.includes(id)),
      );

      // Help text content
      const help = section.querySelector(`#${f.ids.help}`);
      r.assert(
        `Field "${f.key}" — help text exact match`,
        (help?.textContent || "").trim() === EXPECTED_FIELD_HELP[f.key],
      );

      // Count element is <small> initialised to "0 characters"
      const count = section.querySelector(`#${f.ids.count}`);
      r.assert(
        `Field "${f.key}" — count is <small> with "0 characters"`,
        count?.tagName === "SMALL" &&
          (count?.textContent || "").trim() === "0 characters",
      );
    }

    // --- Decorative checkbox ---
    const decorative = section.querySelector(
      `#${EXPECTED_FIELD_IDS.decorative.input}`,
    );
    r.assert("Decorative checkbox present", !!decorative);
    r.assert(
      "Decorative checkbox is <input type=\"checkbox\">",
      decorative?.tagName === "INPUT" &&
        decorative?.getAttribute("type") === "checkbox",
    );
    r.assert(
      "Decorative label linked via for=",
      !!section.querySelector(
        `label[for="${EXPECTED_FIELD_IDS.decorative.input}"]`,
      ),
    );

    // --- Q2 caption hint, Q3 shared disable hint ---
    const captionHint = section.querySelector(
      `#${EXPECTED_FIELD_IDS.caption.hint}`,
    );
    r.assert("Q2 caption hint element present", !!captionHint);
    r.assert("Q2 caption hint hidden initially", captionHint?.hasAttribute("hidden"));
    r.assert(
      "Q2 caption hint text exact match",
      (captionHint?.textContent || "").trim() ===
        EXPECTED_INCLUDEGRAPHICS_CLEAR_HINT,
    );

    const disableHint = section.querySelector(`#${ID_EDIT_DISABLE_HINT}`);
    r.assert("Q3 disable hint element present", !!disableHint);
    r.assert(
      "Q3 disable hint hidden initially",
      disableHint?.hasAttribute("hidden"),
    );
    r.assert(
      "Q3 disable hint text exact match",
      (disableHint?.textContent || "").trim() === EXPECTED_DISABLE_HINT,
    );

    // --- Caption toggletip trigger (bare shell per Phase B decision 3) ---
    const toggletipBtn = section.querySelector(
      `#${EXPECTED_FIELD_IDS.caption.toggletip}`,
    );
    r.assert("Caption toggletip trigger button present", !!toggletipBtn);
    r.assert(
      "Toggletip trigger has no data-toggletip-content attribute",
      !toggletipBtn?.hasAttribute("data-toggletip-content"),
    );
    r.assert(
      "Toggletip trigger has no universal-toggletip-trigger class (added by Chunk 3)",
      !toggletipBtn?.classList.contains("universal-toggletip-trigger"),
    );
    r.assert(
      "Toggletip trigger has aria-label \"More about captions\"",
      toggletipBtn?.getAttribute("aria-label") === "More about captions",
    );

    // --- Caption label-row structure (a11y polish per Chunk 2 testing) ---
    // The Caption <label> and the toggletip <button> are siblings inside
    // a .field-label-row container. The toggletip's aria-label must not
    // bleed into the Caption input's accessible name.
    const captionInput = section.querySelector(
      `#${EXPECTED_FIELD_IDS.caption.input}`,
    );
    const captionFieldGroup = captionInput?.closest(".field-group");
    const captionLabelRow = captionFieldGroup?.querySelector(
      ".field-label-row",
    );
    const captionLabel = section.querySelector(
      `label[for="${EXPECTED_FIELD_IDS.caption.input}"]`,
    );
    r.assert(
      "Caption field-group contains a .field-label-row wrapper",
      !!captionLabelRow,
    );
    r.assert(
      "Caption <label> is a direct child of .field-label-row",
      captionLabel?.parentElement === captionLabelRow,
    );
    r.assert(
      "Caption toggletip <button> is a sibling of the <label>, not a descendant",
      toggletipBtn?.parentElement === captionLabelRow &&
        !captionLabel?.contains(toggletipBtn),
    );
    r.assert(
      "Caption <label> textContent === \"Caption\" (no toggletip text leak)",
      (captionLabel?.textContent || "").trim() === "Caption",
    );

    // --- Caption aria-describedby contract (a11y polish — NVDA hint leak) ---
    // NVDA reads aria-describedby references through hidden elements, so
    // the Q2 includegraphics-clear hint ID is excluded from the initial
    // list. Chunk 3 toggles the hint ID dynamically alongside the hint's
    // hidden attribute.
    const captionDescribers = (
      captionInput?.getAttribute("aria-describedby") || ""
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    r.assert(
      "Caption aria-describedby contains help ID",
      captionDescribers.includes(EXPECTED_FIELD_IDS.caption.help),
    );
    r.assert(
      "Caption aria-describedby contains count ID",
      captionDescribers.includes(EXPECTED_FIELD_IDS.caption.count),
    );
    r.assert(
      "Caption aria-describedby does NOT contain hint ID (Chunk 3 toggles dynamically)",
      !captionDescribers.includes(EXPECTED_FIELD_IDS.caption.hint),
    );
    r.assert(
      "Caption aria-describedby has exactly 2 IDs",
      captionDescribers.length === 2,
    );

    // --- Save button in <footer> (Phase B decision 2 — Option A) ---
    const footer = section.querySelector(
      ".mmd-image-manager-edit-form-footer",
    );
    r.assert(
      "Form footer present and is <footer>",
      !!footer && footer.tagName === "FOOTER",
    );
    r.assert(
      "Save button is inside the form's <footer>, not in <header>",
      !!footer?.querySelector(`#${ID_EDIT_SAVE_BTN}`),
    );
    r.assert(
      "Save button NOT present in <header>",
      !header?.querySelector(`#${ID_EDIT_SAVE_BTN}`),
    );

    // --- DOM order matches Q8d natural tab order ---
    // Sequence: Back → Caption → Alt → Long desc → Text in image → Decorative → Save
    const focusables = section.querySelectorAll(
      `#${ID_EDIT_BACK_BTN}, #${EXPECTED_FIELD_IDS.caption.input}, #${EXPECTED_FIELD_IDS.altText.input}, #${EXPECTED_FIELD_IDS.longDescription.input}, #${EXPECTED_FIELD_IDS.textInImage.input}, #${EXPECTED_FIELD_IDS.decorative.input}, #${ID_EDIT_SAVE_BTN}`,
    );
    const expectedOrder = [
      ID_EDIT_BACK_BTN,
      EXPECTED_FIELD_IDS.caption.input,
      EXPECTED_FIELD_IDS.altText.input,
      EXPECTED_FIELD_IDS.longDescription.input,
      EXPECTED_FIELD_IDS.textInImage.input,
      EXPECTED_FIELD_IDS.decorative.input,
      ID_EDIT_SAVE_BTN,
    ];
    const actualOrder = Array.from(focusables).map((el) => el.id);
    r.assert(
      `DOM order matches Q8d tab order: ${expectedOrder.join(" → ")}`,
      actualOrder.length === expectedOrder.length &&
        actualOrder.every((id, i) => id === expectedOrder[i]),
      `actual: ${actualOrder.join(" → ")}`,
    );

    // ========================================================================
    // === Task 5.2a: Form lifecycle ===
    //
    // Prototype-level method existence checks. The live-DOM open/close
    // behaviour is verified in Group 3 (preconditioned on the manager
    // being open with at least one image in the registry).
    // ========================================================================

    console.log("\n  -- Task 5.2a: form lifecycle (prototype) --");

    r.assert(
      "openEditAltText method exists on prototype",
      typeof Cls.prototype.openEditAltText === "function",
    );
    r.assert(
      "_closeEditAltText method exists on prototype",
      typeof Cls.prototype._closeEditAltText === "function",
    );
    r.assert(
      "_focusEditHeading method exists on prototype",
      typeof Cls.prototype._focusEditHeading === "function",
    );
    r.assert(
      "_focusCardAltBtn method exists on prototype",
      typeof Cls.prototype._focusCardAltBtn === "function",
    );
    r.assert(
      "_focusGridFallback method exists on prototype",
      typeof Cls.prototype._focusGridFallback === "function",
    );
    r.assert(
      "_focusModalTrigger method exists on prototype",
      typeof Cls.prototype._focusModalTrigger === "function",
    );
    r.assert(
      "_setupToggletips method exists on prototype",
      typeof Cls.prototype._setupToggletips === "function",
    );
    r.assert(
      "_destroyToggletips method exists on prototype",
      typeof Cls.prototype._destroyToggletips === "function",
    );
    r.assert(
      "window.openEditAltText global handler is a function",
      typeof window.openEditAltText === "function",
    );
    r.assert(
      "window.altPlaceholderClick (Stage 4 placeholder name) removed",
      typeof window.altPlaceholderClick === "undefined",
    );

    // ========================================================================
    // === Task 5.2b: Form reactivity (Chunk 3b — prototype) ===
    //
    // Method existence checks. Live-DOM behaviour (decorative-driven
    // disable, count updates on input, dirty tracking, banner, Q2 hint)
    // is verified in Group 3 alongside the Task 5.2a lifecycle live-DOM
    // assertions.
    // ========================================================================

    console.log("\n  -- Task 5.2b: form reactivity (prototype) --");

    r.assert(
      "_updateCharacterCount method exists on prototype",
      typeof Cls.prototype._updateCharacterCount === "function",
    );
    r.assert(
      "_updateDirtyFlag method exists on prototype",
      typeof Cls.prototype._updateDirtyFlag === "function",
    );
    r.assert(
      "_updateBannerVisibility method exists on prototype",
      typeof Cls.prototype._updateBannerVisibility === "function",
    );
    r.assert(
      "_setCaptionHintVisible method exists on prototype",
      typeof Cls.prototype._setCaptionHintVisible === "function",
    );
    r.assert(
      "_handleCaptionInput method exists on prototype",
      typeof Cls.prototype._handleCaptionInput === "function",
    );
    r.assert(
      "_handleAltTextInput method exists on prototype",
      typeof Cls.prototype._handleAltTextInput === "function",
    );
    r.assert(
      "_handleLongDescriptionInput method exists on prototype",
      typeof Cls.prototype._handleLongDescriptionInput === "function",
    );
    r.assert(
      "_handleTextInImageInput method exists on prototype",
      typeof Cls.prototype._handleTextInImageInput === "function",
    );
    r.assert(
      "_handleDecorativeChange method exists on prototype",
      typeof Cls.prototype._handleDecorativeChange === "function",
    );

    // ========================================================================
    // === Task 5.2c: Save flow (Chunk 4a — prototype) ===
    // ========================================================================

    console.log("\n  -- Task 5.2c: save flow (prototype) --");

    r.assert(
      "_performSave method exists on prototype",
      typeof Cls.prototype._performSave === "function",
    );
    r.assert(
      "_undoSave method exists on prototype",
      typeof Cls.prototype._undoSave === "function",
    );
    r.assert(
      "_readEditFieldValue method exists on prototype",
      typeof Cls.prototype._readEditFieldValue === "function",
    );
    r.assert(
      "_applyValuesToRegistry method exists on prototype",
      typeof Cls.prototype._applyValuesToRegistry === "function",
    );
    r.assert(
      "_writeMMDFromRegistry method exists on prototype",
      typeof Cls.prototype._writeMMDFromRegistry === "function",
    );

    // Phase D Fix 1 — the module exposes its BODY_CLASS_MANAGER_OPEN
    // constant on the namespace. Asserting the literal matches the
    // expected string keeps the CSS scoping rule and the JS class-toggle
    // in lockstep — if either side drifts, this test flags it.
    const ns = window.MathPixImageManagerUI;
    r.assert(
      `Namespace exposes BODY_CLASS_MANAGER_OPEN === "${EXPECTED_BODY_CLASS_MANAGER_OPEN}"`,
      typeof ns?.BODY_CLASS_MANAGER_OPEN === "string" &&
        ns.BODY_CLASS_MANAGER_OPEN === EXPECTED_BODY_CLASS_MANAGER_OPEN,
    );
  }

  // ----------------------------------------------------------------------------
  // GROUP 3 — INTEGRATION TESTS (preconditioned)
  // ----------------------------------------------------------------------------

  function checkPreconditions() {
    const mathpixRadio = document.getElementById("MathPix");
    // Manager-open signal: the existing Stage 4 coverage counter only exists
    // when the manager modal has been rendered into the DOM.
    const counter = document.getElementById(
      "mmd-image-manager-coverage-counter",
    );
    return {
      mathpixModeActive: !!(mathpixRadio && mathpixRadio.checked),
      managerOpen: !!counter,
    };
  }

  async function runGroup3(r) {
    // Phase D Fix 1 — manager is open (Group 3 precondition), so the
    // body class added in open() should be present. This is the runtime
    // half of the Group 2 constant snapshot above.
    r.assert(
      `Live: <body> has "${EXPECTED_BODY_CLASS_MANAGER_OPEN}" class while manager open`,
      document.body.classList.contains(EXPECTED_BODY_CLASS_MANAGER_OPEN),
    );

    // Edit view section
    const editView = document.getElementById(ID_EDIT_VIEW);
    r.assert("Edit view section exists in live DOM", !!editView);
    r.assert(
      `Edit view aria-labelledby === "${ID_EDIT_HEADING}"`,
      editView?.getAttribute("aria-labelledby") === ID_EDIT_HEADING,
    );
    r.assert(
      "Edit view starts hidden in live DOM",
      editView?.hasAttribute("hidden"),
    );

    // Header + back button + heading + subtitle
    const header = editView?.querySelector(
      ".mmd-image-manager-edit-view-header",
    );
    r.assert(
      "Live: header element present and is <header>",
      !!header && header.tagName === "HEADER",
    );

    const backBtn = document.getElementById(ID_EDIT_BACK_BTN);
    r.assert("Live: Back button present", !!backBtn);
    r.assert(
      "Live: Back button has data-icon=\"arrowLeft\"",
      !!backBtn?.querySelector('[data-icon="arrowLeft"]'),
    );

    const heading = document.getElementById(ID_EDIT_HEADING);
    r.assert(
      "Live: heading is <h2> with tabindex=\"-1\"",
      heading?.tagName === "H2" && heading?.getAttribute("tabindex") === "-1",
    );

    // Form + five fields
    const form = document.getElementById(ID_EDIT_FORM);
    r.assert(
      "Live: form element present and is <form>",
      !!form && form.tagName === "FORM",
    );

    const liveFields = [
      { key: "caption", id: EXPECTED_FIELD_IDS.caption.input, tag: "INPUT" },
      { key: "altText", id: EXPECTED_FIELD_IDS.altText.input, tag: "TEXTAREA" },
      {
        key: "longDescription",
        id: EXPECTED_FIELD_IDS.longDescription.input,
        tag: "TEXTAREA",
      },
      {
        key: "textInImage",
        id: EXPECTED_FIELD_IDS.textInImage.input,
        tag: "INPUT",
      },
      {
        key: "decorative",
        id: EXPECTED_FIELD_IDS.decorative.input,
        tag: "INPUT",
      },
    ];
    for (const f of liveFields) {
      const el = document.getElementById(f.id);
      r.assert(
        `Live: field "${f.key}" present (#${f.id}, ${f.tag})`,
        !!el && el.tagName === f.tag,
      );
    }

    // aria-describedby resolution in live DOM
    const captionInput = document.getElementById(
      EXPECTED_FIELD_IDS.caption.input,
    );
    const captionDescribers = (
      captionInput?.getAttribute("aria-describedby") || ""
    )
      .split(/\s+/)
      .filter(Boolean);
    const allCaptionDescribersResolve = captionDescribers.every((id) =>
      document.getElementById(id),
    );
    r.assert(
      "Live: caption field aria-describedby resolves all IDs (2 initial, hint added in Chunk 3)",
      allCaptionDescribersResolve && captionDescribers.length === 2,
    );

    // Banner
    const banner = document.getElementById(ID_EDIT_BANNER);
    r.assert("Live: banner present", !!banner);
    r.assert(
      "Live: banner role=\"status\"",
      banner?.getAttribute("role") === "status",
    );
    r.assert(
      "Live: banner aria-live=\"polite\"",
      banner?.getAttribute("aria-live") === "polite",
    );
    r.assert("Live: banner hidden initially", banner?.hasAttribute("hidden"));

    // Q2 caption hint and Q3 disable hint
    const captionHint = document.getElementById(
      EXPECTED_FIELD_IDS.caption.hint,
    );
    r.assert("Live: Q2 caption hint present", !!captionHint);
    r.assert(
      "Live: Q2 caption hint hidden initially",
      captionHint?.hasAttribute("hidden"),
    );

    const disableHint = document.getElementById(ID_EDIT_DISABLE_HINT);
    r.assert("Live: Q3 disable hint present", !!disableHint);
    r.assert(
      "Live: Q3 disable hint hidden initially",
      disableHint?.hasAttribute("hidden"),
    );

    // Save button in footer
    const footer = editView?.querySelector(
      ".mmd-image-manager-edit-form-footer",
    );
    r.assert(
      "Live: form <footer> present",
      !!footer && footer.tagName === "FOOTER",
    );
    const saveBtn = document.getElementById(ID_EDIT_SAVE_BTN);
    r.assert("Live: Save button present", !!saveBtn);
    r.assert(
      "Live: Save button is inside the <footer>",
      !!footer?.contains(saveBtn),
    );

    // Grid view container + region heading
    const gridView = document.getElementById(ID_GRID_VIEW);
    r.assert(
      "Live: grid view section exists alongside edit view",
      !!gridView,
    );
    r.assert(
      "Live: grid view visible (not hidden) by default",
      !gridView?.hasAttribute("hidden"),
    );
    const gridHeading = document.getElementById(ID_GRID_REGION_HEADING);
    r.assert(
      "Live: grid region heading present (focus fallback per Q8e step 3)",
      !!gridHeading,
    );
    r.assert(
      `Live: grid region heading text === "${EXPECTED_GRID_REGION_HEADING_TEXT}"`,
      (gridHeading?.textContent || "").trim() ===
        EXPECTED_GRID_REGION_HEADING_TEXT,
    );
    r.assert(
      "Live: grid region heading is visually-hidden",
      gridHeading?.classList.contains("visually-hidden"),
    );

    // Phase D round 3 — toggletip re-parented into dialog top-layer.
    // _setupToggletips() runs at manager open and moves the toggletip element
    // out of document.body and into the manager's <dialog> (located via
    // trigger.closest("dialog") because UniversalModal's className config
    // applies to a wrapping container, not the dialog element itself), so
    // it shares the dialog's top-layer stacking context. Body-level z-index
    // cannot beat the top-layer regardless of values.
    const setupNs = window.MathPixImageManagerUI;
    const setupMgr =
      setupNs && typeof setupNs.getInstance === "function"
        ? setupNs.getInstance()
        : null;
    const captionToggletipId = setupMgr?._captionToggletipId || null;
    const captionToggletipEl = captionToggletipId
      ? document.getElementById(captionToggletipId)
      : null;
    // Locate the manager dialog the same way the production code does:
    // walk up from the toggletip trigger to its nearest <dialog> ancestor.
    const captionToggletipTrigger = document.getElementById(
      "edit-alt-caption-toggletip",
    );
    const managerDialog = captionToggletipTrigger
      ? captionToggletipTrigger.closest("dialog")
      : null;
    r.assert(
      "Caption toggletip is re-parented into dialog top-layer (not body)",
      !!captionToggletipEl &&
        !!managerDialog &&
        managerDialog.contains(captionToggletipEl) &&
        captionToggletipEl.parentElement !== document.body,
    );

    // ========================================================================
    // Task 5.2a — live-DOM open/close lifecycle.
    //
    // Picks the first image in the registry, opens the form, asserts on
    // populated state + Q8a focus, then closes the form and asserts the
    // view toggle. Skips internally via GROUP_3_LIFECYCLE_ASSERTION_COUNT
    // when no images are present in the registry.
    // ========================================================================

    console.log("\n  -- Task 5.2a: form lifecycle (live DOM) --");

    const ns = window.MathPixImageManagerUI;
    const mgr =
      ns && typeof ns.getInstance === "function" ? ns.getInstance() : null;
    const registry = mgr?.restorer?.imageRegistry;
    const allImages =
      registry && typeof registry.getAllImages === "function"
        ? registry.getAllImages()
        : [];

    if (
      !mgr ||
      typeof mgr.openEditAltText !== "function" ||
      typeof mgr._closeEditAltText !== "function"
    ) {
      console.log(
        "  ⚠ Task 5.2a live DOM: manager instance unavailable — skipping lifecycle assertions",
      );
      r.skip(GROUP_3_LIFECYCLE_ASSERTION_COUNT);
      return;
    }
    if (allImages.length === 0) {
      console.log(
        "  ⚠ Task 5.2a live DOM: no images in registry — skipping lifecycle assertions",
      );
      r.skip(GROUP_3_LIFECYCLE_ASSERTION_COUNT);
      return;
    }

    const testImage = allImages[0];
    const testId = testImage.id;

    function expectedCountText(s) {
      const n = (s || "").length;
      return `${n} character${n === 1 ? "" : "s"}`;
    }

    // Open the edit view for the test image.
    mgr.openEditAltText(testId);

    // (1) Edit view un-hidden after open.
    r.assert(
      "Task 5.2a: edit view un-hidden after openEditAltText",
      document.getElementById(ID_EDIT_VIEW)?.hasAttribute("hidden") === false,
    );

    // (2) Grid view hidden after open.
    r.assert(
      "Task 5.2a: grid view hidden after openEditAltText",
      document.getElementById(ID_GRID_VIEW)?.hasAttribute("hidden") === true,
    );

    // (3) Focus on heading per Q8a.
    r.assert(
      "Task 5.2a: heading is the active element after open (Q8a)",
      document.activeElement === document.getElementById(ID_EDIT_HEADING),
    );

    // (4) Heading text contains the prefix.
    const headingEl = document.getElementById(ID_EDIT_HEADING);
    r.assert(
      `Task 5.2a: heading text contains "${EXPECTED_EDIT_VIEW_HEADING_PREFIX}"`,
      (headingEl?.textContent || "").includes(
        EXPECTED_EDIT_VIEW_HEADING_PREFIX,
      ),
    );

    // (5–9) Field-value population from the registry snapshot.
    // Local var names prefixed `lc` (lifecycle) to avoid collision with the
    // existing `captionInput` declared earlier in this function for the
    // Chunk 2 aria-describedby checks.
    const lcCaption = document.getElementById(EXPECTED_FIELD_IDS.caption.input);
    const lcAltText = document.getElementById(EXPECTED_FIELD_IDS.altText.input);
    const lcLongDesc = document.getElementById(
      EXPECTED_FIELD_IDS.longDescription.input,
    );
    const lcTextInImage = document.getElementById(
      EXPECTED_FIELD_IDS.textInImage.input,
    );
    const lcDecorative = document.getElementById(
      EXPECTED_FIELD_IDS.decorative.input,
    );

    r.assert(
      "Task 5.2a: caption input value matches entry.title",
      (lcCaption?.value || "") === (testImage.title || ""),
    );
    r.assert(
      "Task 5.2a: alt text input value matches entry.altText",
      (lcAltText?.value || "") === (testImage.altText || ""),
    );
    r.assert(
      "Task 5.2a: long description input value matches entry.longDescription",
      (lcLongDesc?.value || "") === (testImage.longDescription || ""),
    );
    r.assert(
      "Task 5.2a: text-in-image input value matches entry.textInImage",
      (lcTextInImage?.value || "") === (testImage.textInImage || ""),
    );
    r.assert(
      "Task 5.2a: decorative checkbox matches entry.decorative",
      lcDecorative?.checked === Boolean(testImage.decorative),
    );

    // (10–13) Character counts reflect the loaded values.
    r.assert(
      "Task 5.2a: caption character count reflects loaded value",
      document.getElementById(EXPECTED_FIELD_IDS.caption.count)?.textContent ===
        expectedCountText(testImage.title),
    );
    r.assert(
      "Task 5.2a: alt text character count reflects loaded value",
      document.getElementById(EXPECTED_FIELD_IDS.altText.count)?.textContent ===
        expectedCountText(testImage.altText),
    );
    r.assert(
      "Task 5.2a: long description character count reflects loaded value",
      document.getElementById(EXPECTED_FIELD_IDS.longDescription.count)
        ?.textContent === expectedCountText(testImage.longDescription),
    );
    r.assert(
      "Task 5.2a: text-in-image character count reflects loaded value",
      document.getElementById(EXPECTED_FIELD_IDS.textInImage.count)
        ?.textContent === expectedCountText(testImage.textInImage),
    );

    // Close the edit view.
    mgr._closeEditAltText();

    // (14) Edit view hidden after close.
    r.assert(
      "Task 5.2a: edit view hidden after _closeEditAltText",
      document.getElementById(ID_EDIT_VIEW)?.hasAttribute("hidden") === true,
    );

    // (15) Grid view un-hidden after close.
    r.assert(
      "Task 5.2a: grid view un-hidden after _closeEditAltText",
      document.getElementById(ID_GRID_VIEW)?.hasAttribute("hidden") === false,
    );

    // (16) Phase D Fix 3 — Q8b focus return: after close, focus lands on
    // the Alt button of the originating card (selector matches what
    // _focusCardAltBtn uses internally).
    const expectedAltBtn = document.querySelector(
      `.image-manager-alt-btn[data-image-id="${testId}"]`,
    );
    r.assert(
      "Task 5.2a: focus returns to originating Alt button after _closeEditAltText (Q8b)",
      !!expectedAltBtn && document.activeElement === expectedAltBtn,
    );

    // ========================================================================
    // Task 5.2b — live-DOM form reactivity (Chunk 3b).
    //
    // Re-opens the same test image (5.2a closed it) and exercises:
    //   1–3 caption input: count updates + dirty set; revert clears dirty.
    //   4–7 decorative tick: alt + longdesc disabled, Q3 hint un-hidden,
    //       banner visible (alt non-empty).
    //   8–11 decorative untick: alt + longdesc re-enabled, Q3 hint hidden,
    //        banner hidden.
    //
    // Restores any test-mutated state before _closeEditAltText so the
    // registry snapshot is untouched.
    // ========================================================================

    console.log("\n  -- Task 5.2b: form reactivity (live DOM) --");

    mgr.openEditAltText(testId);

    const rxCaption = document.getElementById(EXPECTED_FIELD_IDS.caption.input);
    const rxAlt = document.getElementById(EXPECTED_FIELD_IDS.altText.input);
    const rxLongDesc = document.getElementById(
      EXPECTED_FIELD_IDS.longDescription.input,
    );
    const rxDecorative = document.getElementById(
      EXPECTED_FIELD_IDS.decorative.input,
    );
    const rxBanner = document.getElementById(ID_EDIT_BANNER);
    const rxQ3Hint = document.getElementById(ID_EDIT_DISABLE_HINT);

    const origCaption = rxCaption?.value ?? "";
    const origAlt = rxAlt?.value ?? "";
    const origDecorative = rxDecorative?.checked ?? false;

    // (1) Caption count updates on input dispatch.
    if (rxCaption) {
      rxCaption.value = "TEST_CHUNK_3B";
      rxCaption.dispatchEvent(new Event("input", { bubbles: true }));
    }
    r.assert(
      "Task 5.2b: caption count updates after input event",
      document.getElementById(EXPECTED_FIELD_IDS.caption.count)?.textContent ===
        expectedCountText("TEST_CHUNK_3B"),
    );

    // (2) Dirty flag set after value differs from value-at-open.
    r.assert(
      "Task 5.2b: _dirtyFields has 'caption' after change from value-at-open",
      mgr._dirtyFields instanceof Set && mgr._dirtyFields.has("caption"),
    );

    // (3) Revert clears the dirty flag (value-dirty definition).
    if (rxCaption) {
      rxCaption.value = origCaption;
      rxCaption.dispatchEvent(new Event("input", { bubbles: true }));
    }
    r.assert(
      "Task 5.2b: _dirtyFields clears 'caption' on revert to value-at-open",
      mgr._dirtyFields instanceof Set && !mgr._dirtyFields.has("caption"),
    );

    // Ensure alt has non-empty content so the banner can be visible when
    // decorative is ticked (Q6 expression: decorative && (alt || longdesc)).
    const altWasEmpty = origAlt === "";
    if (altWasEmpty && rxAlt) {
      rxAlt.value = "TEST_CHUNK_3B_ALT";
      rxAlt.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // Force a known false-baseline for decorative before the tick test.
    if (rxDecorative && rxDecorative.checked) {
      rxDecorative.checked = false;
      rxDecorative.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // (4–7) Tick decorative: disable alt + longdesc, un-hide Q3 hint, show banner.
    if (rxDecorative) {
      rxDecorative.checked = true;
      rxDecorative.dispatchEvent(new Event("change", { bubbles: true }));
    }
    r.assert(
      "Task 5.2b: alt text input has disabled=true after decorative tick",
      rxAlt?.disabled === true,
    );
    r.assert(
      "Task 5.2b: long description input has disabled=true after decorative tick",
      rxLongDesc?.disabled === true,
    );
    r.assert(
      "Task 5.2b: Q3 disable hint un-hidden after decorative tick",
      rxQ3Hint?.hasAttribute("hidden") === false,
    );
    r.assert(
      "Task 5.2b: legacy-conflict banner visible after decorative tick (alt non-empty)",
      rxBanner?.hasAttribute("hidden") === false,
    );

    // (8–11) Untick decorative: re-enable fields, hide Q3 hint, hide banner.
    if (rxDecorative) {
      rxDecorative.checked = false;
      rxDecorative.dispatchEvent(new Event("change", { bubbles: true }));
    }
    r.assert(
      "Task 5.2b: alt text input re-enables after decorative untick",
      rxAlt?.disabled === false,
    );
    r.assert(
      "Task 5.2b: long description input re-enables after decorative untick",
      rxLongDesc?.disabled === false,
    );
    r.assert(
      "Task 5.2b: Q3 disable hint hidden after decorative untick",
      rxQ3Hint?.hasAttribute("hidden") === true,
    );
    r.assert(
      "Task 5.2b: legacy-conflict banner hidden after decorative untick",
      rxBanner?.hasAttribute("hidden") === true,
    );

    // Restore state for any subsequent runs / interactive use.
    if (altWasEmpty && rxAlt) {
      rxAlt.value = origAlt;
      rxAlt.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (rxDecorative && rxDecorative.checked !== origDecorative) {
      rxDecorative.checked = origDecorative;
      rxDecorative.dispatchEvent(new Event("change", { bubbles: true }));
    }

    mgr._closeEditAltText();

    // ========================================================================
    // Task 5.2c — live-DOM save flow (Chunk 4a).
    //
    // Exercises the Q5c six-step sequence and its error / undo branches:
    //   1–2 dirty save: registry's title updates; edit view closes.
    //   3   clean save: registry untouched.
    //   4–5 error path: applyRegistryToMMD throws; persistent error
    //       toast appears; edit view stays open.
    //   6–7 undo path: direct _undoSave call reverts the registry.
    //
    // Each fragment restores state before the next so the suite is
    // re-runnable. The error-path stub is wrapped in try/finally to
    // guarantee restoration of MathPixAltTextIntegrator.applyRegistryToMMD.
    // ========================================================================

    console.log("\n  -- Task 5.2c: save flow (live DOM) --");

    const SAVE_TEST_MARKER = "TEST_CHUNK_4A_SAVE";

    // Capture a pre-save snapshot of the entry directly from the
    // registry so the undo / clean-save assertions have an authoritative
    // baseline (registry.getImage returns a clone — safe to retain).
    const preSaveEntry = registry.getImage(testId);
    const preSaveTitle = preSaveEntry?.title || "";
    const preSaveAlt = preSaveEntry?.altText || "";
    const preSaveLongDesc = preSaveEntry?.longDescription || "";
    const preSaveTextInImage = preSaveEntry?.textInImage || "";
    const preSaveDecorative = Boolean(preSaveEntry?.decorative);

    // (1) Dirty save — change caption, save, registry's title updates.
    mgr.openEditAltText(testId);
    const saveCaption = document.getElementById(
      EXPECTED_FIELD_IDS.caption.input,
    );
    if (saveCaption) {
      saveCaption.value = SAVE_TEST_MARKER;
      saveCaption.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await mgr._performSave();
    r.assert(
      "Task 5.2c: dirty save — registry.getImage(id).title equals new caption value",
      registry.getImage(testId)?.title === SAVE_TEST_MARKER,
    );

    // (2) Dirty save — edit view closed after save.
    r.assert(
      "Task 5.2c: dirty save — edit view hidden after save",
      document.getElementById(ID_EDIT_VIEW)?.hasAttribute("hidden") === true,
    );

    // Restore the registry's title before subsequent fragments so a
    // clean-save baseline is preserved.
    registry.updateTitle(testId, preSaveTitle, "user");

    // (3) Clean save — open, don't modify, save. Registry must be
    // byte-identical to the pre-save snapshot. Compare via JSON of
    // the editable fields (decorative is the only non-string).
    function captureEditableState() {
      const e = registry.getImage(testId);
      return JSON.stringify({
        title: e?.title || "",
        altText: e?.altText || "",
        longDescription: e?.longDescription || "",
        textInImage: e?.textInImage || "",
        decorative: Boolean(e?.decorative),
      });
    }
    mgr.openEditAltText(testId);
    const cleanBefore = captureEditableState();
    await mgr._performSave();
    const cleanAfter = captureEditableState();
    r.assert(
      "Task 5.2c: clean save — registry editable fields unchanged",
      cleanBefore === cleanAfter,
    );
    r.assert(
      "Task 5.2c: clean save — edit view hidden after silent save",
      document.getElementById(ID_EDIT_VIEW)?.hasAttribute("hidden") === true,
    );

    // (4) Error path — stub applyRegistryToMMD to throw. _performSave
    // should catch, leave the edit view open, and emit an error toast.
    const I = window.MathPixAltTextIntegrator;
    const origApply = I?.applyRegistryToMMD;
    let errorPathRan = false;
    if (I && typeof origApply === "function") {
      mgr.openEditAltText(testId);
      const errCaption = document.getElementById(
        EXPECTED_FIELD_IDS.caption.input,
      );
      if (errCaption) {
        errCaption.value = SAVE_TEST_MARKER + "_ERR";
        errCaption.dispatchEvent(new Event("input", { bubbles: true }));
      }
      I.applyRegistryToMMD = function () {
        throw new Error("Stage 5 Chunk 4a test: forced error");
      };
      try {
        await mgr._performSave();
        errorPathRan = true;
      } finally {
        I.applyRegistryToMMD = origApply;
      }
      r.assert(
        "Task 5.2c: error path — edit view STILL open after save failure",
        document.getElementById(ID_EDIT_VIEW)?.hasAttribute("hidden") === false,
      );
      r.assert(
        "Task 5.2c: error path — error notification visible in modal",
        !!document.querySelector(".universal-modal-status.show.status-error"),
      );

      // Clean up: dismiss any lingering error notification, close the
      // view, and revert the registry title (the error path leaves
      // the registry update from step 1 in place — Q5b no-rollback).
      // Save-flow notifications auto-route in-modal (Commit B), so
      // dismiss via the modal's public hideStatus API.
      window.UniversalModal?.hideStatus?.();
      registry.updateTitle(testId, preSaveTitle, "user");
      // Reset _dirtyFields so the close below is silent.
      if (mgr._dirtyFields instanceof Set) mgr._dirtyFields.clear();
      mgr._closeEditAltText();
    } else {
      console.log(
        "  ⚠ Task 5.2c error path: MathPixAltTextIntegrator unavailable — skipping 2 assertions",
      );
      r.skip(2);
    }

    // (5) Undo path — manually invoke _undoSave with a synthetic
    // snapshot matching the pre-save state. Registry should revert to
    // the original title.
    if (errorPathRan) {
      // Apply a modification through the registry to simulate a
      // post-save state, then call _undoSave with the pre-save snapshot.
      registry.updateAltText(testId, "UNDO_TEST_TEMP_ALT", "user");
      const undoSnapshot = {
        caption: preSaveTitle,
        altText: preSaveAlt,
        longDescription: preSaveLongDesc,
        textInImage: preSaveTextInImage,
        decorative: preSaveDecorative,
      };
      mgr._undoSave(testId, undoSnapshot, ["altText"]);
      r.assert(
        "Task 5.2c: _undoSave reverts registry altText to snapshot value",
        (registry.getImage(testId)?.altText || "") === preSaveAlt,
      );
    } else {
      r.skip(1);
    }

    // Final restore — guarantee the pre-test entry state regardless of
    // which fragments ran.
    registry.updateTitle(testId, preSaveTitle, "user");
    registry.updateAltText(testId, preSaveAlt, "user");
    registry.updateLongDescription(testId, preSaveLongDesc, "user");
    registry.updateTextInImage(testId, preSaveTextInImage, "user");
    registry.updateDecorative(testId, preSaveDecorative);
    // Dismiss any "Changes saved." / "Changes undone." in-modal
    // success notifications that accumulated so subsequent test runs
    // / interactive use start clean. Save-flow notifications auto-
    // route in-modal (Commit B), so dismiss via the modal's public
    // hideStatus API.
    window.UniversalModal?.hideStatus?.();
  }

  // ============================================================================
  // GROUP 4 — PHASE 4a.5 SYNTHETIC RESTORE INVARIANT (always runs)
  // ----------------------------------------------------------------------------
  // Regression assertion for the registry/MMD sync gap that Stage 5's save flow
  // surfaced. Before 4a.5, a restored session left `entry.mmdReference` in
  // CDN-URL form while `currentMMD` was rewritten to blob-URL form — so the
  // alt-text serialiser's `findImage` (substring match on `mmdReference`)
  // could not locate any image in the live MMD. After 4a.5, the invariant
  // "every registry entry's `mmdReference` is a literal substring of the
  // current MMD" must hold immediately after a restore.
  //
  // This group builds a synthetic restored-session state (registry populated
  // with CDN-form references, imageBlobUrlMap holding CDN→blob mappings,
  // currentMMD rewritten to blob form) and calls the public restorer helper
  // to perform the sync, then asserts the invariant.
  // ============================================================================

  function runGroup4(r) {
    console.log(
      "\n--- Group 4: Phase 4a.5 synthetic restore invariant ---",
    );

    if (typeof window.MathPixImageRegistry !== "function") {
      r.assert(
        "Group 4 prerequisite: MathPixImageRegistry available",
        false,
        "MathPixImageRegistry not loaded",
      );
      return;
    }

    const restorer = window.getMathPixSessionRestorer?.();
    if (
      !restorer ||
      typeof restorer.syncRegistryReferencesToBlobUrls !== "function" ||
      typeof restorer.rewriteMMDWithBlobUrls !== "function"
    ) {
      r.assert(
        "Group 4 prerequisite: restorer + sync helper available",
        false,
        "session restorer or sync helper missing",
      );
      return;
    }

    // Build a synthetic 3-image MMD in CDN-URL form — what we'd see in a
    // freshly-parsed ZIP before rewriteMMDWithBlobUrls runs.
    const cdnUrl1 = "https://cdn.mathpix.com/cropped/4a5-sync-1.jpg";
    const cdnUrl2 = "https://cdn.mathpix.com/cropped/4a5-sync-2.jpg";
    const cdnUrl3 = "https://cdn.mathpix.com/cropped/4a5-sync-3.jpg";
    const blobUrl1 = "blob:http://localhost/4a5-blob-1";
    const blobUrl2 = "blob:http://localhost/4a5-blob-2";
    const blobUrl3 = "blob:http://localhost/4a5-blob-3";

    const originalMMD =
      "Intro paragraph.\n\n" +
      `![](${cdnUrl1})\n\n` +
      `![](${cdnUrl2})\n\n` +
      `![](${cdnUrl3})\n\n` +
      "Trailing paragraph.";

    const reg = new window.MathPixImageRegistry();
    reg.buildFromMMD(originalMMD);
    const refsBefore = reg.getAllImages().map((e) => e.mmdReference);

    r.assert(
      "Group 4 setup: all entries start with CDN-form mmdReference",
      refsBefore.every((ref) => ref.includes("cdn.mathpix.com")),
      `got refs: ${JSON.stringify(refsBefore)}`,
    );

    // Save prior restorer state so we don't leak into other tests.
    const priorRegistry = restorer.imageRegistry;
    const priorMapEntries = Array.from(restorer.imageBlobUrlMap.entries());

    try {
      restorer.imageRegistry = reg;
      restorer.imageBlobUrlMap.clear();
      restorer.imageBlobUrlMap.set(cdnUrl1, blobUrl1);
      restorer.imageBlobUrlMap.set(cdnUrl2, blobUrl2);
      restorer.imageBlobUrlMap.set(cdnUrl3, blobUrl3);

      // Step 1: rewrite the MMD (matches what rewriteMMDWithBlobUrls does
      // at restore time).
      const currentMMD = restorer.rewriteMMDWithBlobUrls(originalMMD);

      r.assert(
        "Group 4 mid-state: currentMMD now holds blob URLs, no CDN URLs",
        currentMMD.includes(blobUrl1) &&
          currentMMD.includes(blobUrl2) &&
          currentMMD.includes(blobUrl3) &&
          !currentMMD.includes("cdn.mathpix.com"),
      );

      // Step 2: registry's mmdReferences are still CDN-form at this point —
      // this is the pre-4a.5 gap that we are about to close.
      const refsAtMidState = reg.getAllImages().map((e) => e.mmdReference);
      r.assert(
        "Group 4 mid-state: registry refs still CDN-form pre-sync (the gap)",
        refsAtMidState.every((ref) => ref.includes("cdn.mathpix.com")),
        `got refs: ${JSON.stringify(refsAtMidState)}`,
      );

      // Step 3: run the sync — this is the production code path under test.
      restorer.syncRegistryReferencesToBlobUrls();

      // Step 4: the core invariant — every entry's mmdReference is now a
      // literal substring of the live MMD. This is what unblocks the save
      // flow's `applyRegistryToMMD` → `findImage` chain.
      const entriesAfter = reg.getAllImages();
      const allInMMD = entriesAfter.every((entry) =>
        currentMMD.includes(entry.mmdReference),
      );
      r.assert(
        "Group 4 invariant: every entry's mmdReference is a substring of currentMMD",
        allInMMD,
        `currentMMD has refs: ${entriesAfter.map((e) => currentMMD.includes(e.mmdReference)).join(",")}`,
      );

      r.assert(
        "Group 4 invariant: every entry's mmdReference is now blob-form",
        entriesAfter.every((e) => e.mmdReference.startsWith("![](blob:")),
        `got refs: ${JSON.stringify(entriesAfter.map((e) => e.mmdReference))}`,
      );

      r.assert(
        "Group 4 invariant: no entry's mmdReference still contains cdn.mathpix.com",
        entriesAfter.every((e) => !e.mmdReference.includes("cdn.mathpix.com")),
      );

      r.assert(
        "Group 4 side-effect absence: no entry's isModified flipped by sync",
        entriesAfter.every((e) => e.isModified === false),
      );
    } finally {
      // Restore prior state — safe even if the test threw above.
      restorer.imageRegistry = priorRegistry;
      restorer.imageBlobUrlMap.clear();
      for (const [k, v] of priorMapEntries) {
        restorer.imageBlobUrlMap.set(k, v);
      }
    }
  }

  // ============================================================================
  // GROUP 5 — CHUNK 4b CLOSE-FLOW SAVE INTEGRATION (preconditioned)
  // ----------------------------------------------------------------------------
  // Verifies that Back, Escape-in-edit-view, and the manager modal's X
  // close all route through _performSave per Q10. The dirty branch
  // writes through to the registry + MMD; the clean branch is a silent
  // close.
  //
  // Back and Escape are exercised through real DOM events (button click,
  // keyboard keydown on the dialog). The X-close path (Cases 5–7) is
  // exercised by clicking the actual X button after spying on
  // _performSave AND registering a test-only capture-phase
  // stopImmediatePropagation blocker on the button. The blocker fires
  // after the manager's capture-phase interceptor (registration order),
  // halting further propagation so UniversalModal's bubble-phase
  // listener never runs and the modal DOM stays alive for subsequent
  // test cases.
  //
  // Why this restructure: the Path-2 onClose fire-and-forget approach
  // failed Smoke Test 5 because onClose fires AFTER finishClose has
  // destroyed the modal DOM. _performSave reads field values from the
  // DOM (line 1867-1870 in mathpix-image-manager-ui.js); post-teardown
  // those reads return empty strings, overwriting the registry with
  // empties. The previous tests passed because they mocked
  // _currentEditImageId / _dirtyFields state and invoked the onClose
  // callback directly — they never simulated the DOM teardown the
  // real path triggers. That is a test-quality gap: the tests asserted
  // state-based behaviour instead of the wiring contract.
  // ============================================================================

  async function runGroup5(r) {
    console.log("\n--- Group 5: Chunk 4b close-flow save integration ---");

    const ns = window.MathPixImageManagerUI;
    const mgr =
      ns && typeof ns.getInstance === "function" ? ns.getInstance() : null;
    const registry = mgr?.restorer?.imageRegistry;
    const allImages =
      registry && typeof registry.getAllImages === "function"
        ? registry.getAllImages()
        : [];

    if (
      !mgr ||
      !mgr.currentModal ||
      typeof mgr.openEditAltText !== "function" ||
      typeof mgr._performSave !== "function" ||
      allImages.length === 0
    ) {
      console.log(
        "  ⚠ Group 5: prerequisites unavailable (manager / modal / registry) — skipping",
      );
      r.skip(GROUP_5_ASSERTION_COUNT);
      return;
    }

    const testImage = allImages[0];
    const testId = testImage.id;

    // Baseline snapshot for restoration between fragments.
    const baseline = {
      title: testImage.title || "",
      altText: testImage.altText || "",
      longDescription: testImage.longDescription || "",
      textInImage: testImage.textInImage || "",
      decorative: Boolean(testImage.decorative),
    };

    function restoreBaseline() {
      registry.updateTitle(testId, baseline.title, "user");
      registry.updateAltText(testId, baseline.altText, "user");
      registry.updateLongDescription(testId, baseline.longDescription, "user");
      registry.updateTextInImage(testId, baseline.textInImage, "user");
      registry.updateDecorative(testId, baseline.decorative);
    }

    function captureEditableState() {
      const e = registry.getImage(testId);
      return JSON.stringify({
        title: e?.title || "",
        altText: e?.altText || "",
        longDescription: e?.longDescription || "",
        textInImage: e?.textInImage || "",
        decorative: Boolean(e?.decorative),
      });
    }

    const MARKER = "TEST_CHUNK_4B";

    // ========================================================================
    // Case 1 — Back-dirty saves through to the registry.
    // ========================================================================
    console.log("\n  -- Case 1: Back button (dirty) saves --");

    mgr.openEditAltText(testId);
    const c1Caption = document.getElementById(EXPECTED_FIELD_IDS.caption.input);
    if (c1Caption) {
      c1Caption.value = MARKER + "_BACK_DIRTY";
      c1Caption.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const c1BackBtn = document.getElementById(ID_EDIT_BACK_BTN);
    c1BackBtn?.click();
    // _performSave is declared async but its write path is synchronous
    // (Phase B audit); the await here is defensive in case a future
    // change introduces real async work.
    await Promise.resolve();

    r.assert(
      "Case 1: Back-dirty — registry.title updated to marker",
      registry.getImage(testId)?.title === MARKER + "_BACK_DIRTY",
    );
    r.assert(
      "Case 1: Back-dirty — edit view hidden after Back click",
      document.getElementById(ID_EDIT_VIEW)?.hasAttribute("hidden") === true,
    );
    r.assert(
      "Case 1: Back-dirty — grid view visible after Back click",
      document.getElementById(ID_GRID_VIEW)?.hasAttribute("hidden") === false,
    );

    restoreBaseline();
    window.UniversalModal?.hideStatus?.();

    // ========================================================================
    // Case 2 — Back-clean is a silent close (no save, no toast).
    // ========================================================================
    console.log("\n  -- Case 2: Back button (clean) is silent close --");

    mgr.openEditAltText(testId);
    const c2Before = captureEditableState();
    const c2BackBtn = document.getElementById(ID_EDIT_BACK_BTN);
    c2BackBtn?.click();
    await Promise.resolve();
    const c2After = captureEditableState();

    r.assert(
      "Case 2: Back-clean — registry editable fields unchanged",
      c2Before === c2After,
    );
    r.assert(
      "Case 2: Back-clean — edit view hidden after Back click",
      document.getElementById(ID_EDIT_VIEW)?.hasAttribute("hidden") === true,
    );
    r.assert(
      "Case 2: Back-clean — no success toast emitted",
      !document.querySelector(
        ".universal-modal-status.show.status-success",
      ),
    );

    // ========================================================================
    // Case 3 — Escape-in-edit-view (dirty) saves.
    // ========================================================================
    console.log("\n  -- Case 3: Escape (dirty) saves --");

    mgr.openEditAltText(testId);
    const c3Caption = document.getElementById(EXPECTED_FIELD_IDS.caption.input);
    if (c3Caption) {
      c3Caption.value = MARKER + "_ESC_DIRTY";
      c3Caption.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const c3Dialog = document
      .getElementById(ID_EDIT_VIEW)
      ?.closest("dialog");
    c3Dialog?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await Promise.resolve();

    r.assert(
      "Case 3: Escape-dirty — registry.title updated to marker",
      registry.getImage(testId)?.title === MARKER + "_ESC_DIRTY",
    );
    r.assert(
      "Case 3: Escape-dirty — edit view hidden after Escape",
      document.getElementById(ID_EDIT_VIEW)?.hasAttribute("hidden") === true,
    );

    restoreBaseline();
    window.UniversalModal?.hideStatus?.();

    // ========================================================================
    // Case 4 — Escape-in-edit-view (clean) is a silent close.
    // ========================================================================
    console.log("\n  -- Case 4: Escape (clean) is silent close --");

    mgr.openEditAltText(testId);
    const c4Before = captureEditableState();
    const c4Dialog = document
      .getElementById(ID_EDIT_VIEW)
      ?.closest("dialog");
    c4Dialog?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await Promise.resolve();
    const c4After = captureEditableState();

    r.assert(
      "Case 4: Escape-clean — registry editable fields unchanged",
      c4Before === c4After,
    );
    r.assert(
      "Case 4: Escape-clean — edit view hidden after Escape",
      document.getElementById(ID_EDIT_VIEW)?.hasAttribute("hidden") === true,
    );

    // ========================================================================
    // Cases 5–7 — X-close paths via real X-button click + interceptor.
    //
    // Approach:
    //   1. Locate the X button on the live modal.
    //   2. Spy _performSave (replace with a call counter; never invoke the
    //      real save during X-close tests, since these test the *wiring*
    //      contract — that the interceptor fires the call at all).
    //   3. Register a test-only capture-phase listener on the X button
    //      that calls stopImmediatePropagation. Because event listeners
    //      within the same phase fire in registration order, our blocker
    //      runs AFTER the manager's interceptor (open() registers the
    //      interceptor first; this test registers the blocker second).
    //      stopImmediatePropagation halts the bubble-phase listener too,
    //      so modalManager.close never fires and the modal stays alive
    //      for subsequent test cases.
    //   4. Dispatch click(); verify the spy's call count.
    //
    // This asserts the wiring (interceptor calls _performSave at the
    // right times) rather than mocking state and re-invoking the
    // callback — which is precisely the test-quality gap Path 2's
    // tests had.
    // ========================================================================
    console.log("\n  -- Cases 5–7: X-close paths (real click + spy) --");

    const modalEl = mgr.currentModal?.modal;
    const closeBtn = modalEl?.querySelector(".universal-modal-close");
    const interceptorWired =
      typeof mgr._attachXButtonInterceptor === "function" && !!closeBtn;
    r.assert(
      "Cases 5–7 prerequisite: X button present and _attachXButtonInterceptor wired",
      interceptorWired,
    );

    if (interceptorWired) {
      // Spy on _performSave (capture invocations without doing real work).
      const origPerformSave = mgr._performSave;
      let saveCallCount = 0;
      mgr._performSave = function spyPerformSave() {
        saveCallCount++;
      };

      // Test-only capture-phase blocker — fires AFTER the manager's
      // interceptor (registration order within the same phase) and
      // halts both the rest of capture and the bubble-phase listener
      // that would otherwise tear down the modal.
      const blocker = (e) => e.stopImmediatePropagation();
      closeBtn.addEventListener("click", blocker, { capture: true });

      try {
        // ------------------------------------------------------------------
        // Case 5 — X with edit view open AND dirty: interceptor fires save.
        // ------------------------------------------------------------------
        mgr.openEditAltText(testId);
        const c5Caption = document.getElementById(
          EXPECTED_FIELD_IDS.caption.input,
        );
        if (c5Caption) {
          c5Caption.value = MARKER + "_X_DIRTY";
          c5Caption.dispatchEvent(new Event("input", { bubbles: true }));
        }
        saveCallCount = 0;
        closeBtn.click();
        r.assert(
          "Case 5: X-dirty — interceptor invoked _performSave exactly once",
          saveCallCount === 1,
        );

        // Spy didn't actually save, so clear dirty + edit state by hand
        // before Case 6 (otherwise the next click would still be dirty).
        if (mgr._dirtyFields instanceof Set) mgr._dirtyFields.clear();
        mgr._currentEditImageId = null;
        const editView = document.getElementById(ID_EDIT_VIEW);
        const gridView = document.getElementById(ID_GRID_VIEW);
        if (editView) editView.hidden = true;
        if (gridView) gridView.hidden = false;

        // ------------------------------------------------------------------
        // Case 6 — X with edit view open BUT clean: interceptor does NOT
        // fire save (guard: _dirtyFields.size > 0 is false).
        // ------------------------------------------------------------------
        mgr.openEditAltText(testId);
        // Confirm clean by clearing any incidental dirty state from open.
        if (mgr._dirtyFields instanceof Set) mgr._dirtyFields.clear();
        saveCallCount = 0;
        closeBtn.click();
        r.assert(
          "Case 6: X-clean (edit view open) — interceptor did NOT call _performSave",
          saveCallCount === 0,
        );

        // Reset edit state before Case 7.
        mgr._currentEditImageId = null;
        if (editView) editView.hidden = true;
        if (gridView) gridView.hidden = false;

        // ------------------------------------------------------------------
        // Case 7 — X while in grid view: interceptor does NOT fire save
        // (guard: _currentEditImageId is null).
        // ------------------------------------------------------------------
        r.assert(
          "Case 7 setup: _currentEditImageId is null in grid view",
          mgr._currentEditImageId === null,
        );
        saveCallCount = 0;
        closeBtn.click();
        r.assert(
          "Case 7: X-in-grid — interceptor did NOT call _performSave",
          saveCallCount === 0,
        );
      } finally {
        // Restore real _performSave and remove the test-only blocker.
        mgr._performSave = origPerformSave;
        closeBtn.removeEventListener("click", blocker, { capture: true });
      }
    } else {
      // Skip the four conditional asserts (Case 5, Case 6, Case 7 setup,
      // Case 7).
      r.skip(4);
    }

    // ========================================================================
    // Cases 8–10 — Discovery 19 fix: forceToast option for save-during-close.
    //
    // Case 8 exercises the notifications routing API directly: with the
    //   manager modal active, forceToast:true should bypass the in-modal
    //   routing and render a global toast instead.
    // Case 9 asserts _performSave plumbs options.forceToast through to the
    //   notifySuccess call (spy on window.notifySuccess, no real emission).
    // Case 10 asserts the X-button capture-phase interceptor passes
    //   { forceToast: true } when firing _performSave (reuses the Cases 5–7
    //   spy + capture-phase-blocker pattern with its own fragment).
    // ========================================================================

    // ------------------------------------------------------------------------
    // Case 8 — Notifications API: forceToast bypasses in-modal routing.
    // ------------------------------------------------------------------------
    console.log("\n  -- Case 8: notifySuccess forceToast option --");

    const MARKER_FORCE_TOAST = "TEST_DISCOVERY_19_FORCE_TOAST";
    const MARKER_NORMAL_INMODAL = "TEST_DISCOVERY_19_INMODAL";

    // Sub-check 8a: forceToast:true → global toast appears, no in-modal
    // status entry with the same marker.
    window.notifySuccess(MARKER_FORCE_TOAST, {
      duration: 100,
      forceToast: true,
    });
    await Promise.resolve();
    const c8aToast = Array.from(document.querySelectorAll(".gb-toast")).find(
      (t) => t.textContent.includes(MARKER_FORCE_TOAST),
    );
    const c8aInModal = Array.from(
      document.querySelectorAll(".universal-modal-status.show"),
    ).find((el) => el.textContent.includes(MARKER_FORCE_TOAST));
    r.assert(
      "Case 8a: notifySuccess({forceToast:true}) routes to global toast (not in-modal) while modal active",
      !!c8aToast && !c8aInModal,
    );

    // Sub-check 8b: no forceToast → in-modal status appears (manager open
    // is the precondition, so isModalActive() is true).
    window.notifySuccess(MARKER_NORMAL_INMODAL, { duration: 100 });
    await Promise.resolve();
    const c8bInModal = Array.from(
      document.querySelectorAll(".universal-modal-status.show"),
    ).find((el) => el.textContent.includes(MARKER_NORMAL_INMODAL));
    r.assert(
      "Case 8b: notifySuccess(no forceToast) routes in-modal while modal active",
      !!c8bInModal,
    );

    // Cleanup any lingering notifications from Case 8 before Case 9.
    window.UniversalNotifications?.clearAll?.();
    window.UniversalModal?.hideStatus?.();

    // ------------------------------------------------------------------------
    // Case 9 — _performSave plumbs forceToast into notifySuccess options.
    //
    // Spy window.notifySuccess to capture the options bag without emitting.
    // The image manager IIFE looks up notifySuccess via the scope chain at
    // call time, so a window-level replacement is visible to it.
    // ------------------------------------------------------------------------
    console.log("\n  -- Case 9: _performSave plumbs forceToast --");

    const origNotifySuccessC9 = window.notifySuccess;
    let c9LastNotifyOptions = null;
    window.notifySuccess = function spyNotifySuccessC9(msg, options) {
      c9LastNotifyOptions = options;
      // No emission — pure capture.
    };

    try {
      mgr.openEditAltText(testId);
      const c9Caption = document.getElementById(
        EXPECTED_FIELD_IDS.caption.input,
      );
      if (c9Caption) {
        c9Caption.value = MARKER + "_C9_PLUMB";
        c9Caption.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await mgr._performSave({ forceToast: true });
      r.assert(
        "Case 9: _performSave({forceToast:true}) passes forceToast:true to notifySuccess",
        !!c9LastNotifyOptions && c9LastNotifyOptions.forceToast === true,
      );
    } finally {
      window.notifySuccess = origNotifySuccessC9;
      restoreBaseline();
      window.UniversalModal?.hideStatus?.();
    }

    // ------------------------------------------------------------------------
    // Case 10 — X interceptor passes {forceToast:true} to _performSave.
    //
    // Same spy + capture-phase-blocker pattern as Cases 5–7, but the spy
    // records the first argument instead of just counting calls. Re-checks
    // `interceptorWired` from the outer scope.
    // ------------------------------------------------------------------------
    console.log("\n  -- Case 10: X interceptor passes forceToast option --");

    if (interceptorWired) {
      const origPerformSaveC10 = mgr._performSave;
      let c10LastArgs = null;
      mgr._performSave = function spyArgsPerformSaveC10(opts) {
        c10LastArgs = opts;
      };
      const c10Blocker = (e) => e.stopImmediatePropagation();
      closeBtn.addEventListener("click", c10Blocker, { capture: true });

      try {
        mgr.openEditAltText(testId);
        const c10Caption = document.getElementById(
          EXPECTED_FIELD_IDS.caption.input,
        );
        if (c10Caption) {
          c10Caption.value = MARKER + "_C10_FORCE";
          c10Caption.dispatchEvent(new Event("input", { bubbles: true }));
        }
        closeBtn.click();
        r.assert(
          "Case 10: X interceptor calls _performSave with {forceToast: true}",
          !!c10LastArgs && c10LastArgs.forceToast === true,
        );
      } finally {
        mgr._performSave = origPerformSaveC10;
        closeBtn.removeEventListener("click", c10Blocker, { capture: true });
        // Restore edit-state to known-clean baseline (the spy didn't run the
        // real save, so the dirty flags + edit view need a manual reset).
        if (mgr._dirtyFields instanceof Set) mgr._dirtyFields.clear();
        mgr._currentEditImageId = null;
        const c10EditView = document.getElementById(ID_EDIT_VIEW);
        const c10GridView = document.getElementById(ID_GRID_VIEW);
        if (c10EditView) c10EditView.hidden = true;
        if (c10GridView) c10GridView.hidden = false;
      }
    } else {
      // X button / interceptor not available — already counted as the
      // Cases 5–7 prerequisite failure; skip the one Case 10 assertion.
      r.skip(1);
    }

    // ========================================================================
    // Case 11 — 13(c) / Discovery 20 — grid re-renders after save and undo.
    //
    // The Alt button's image-manager-alt-btn--needs-attention modifier
    // class is computed at render time from entry.altText (via
    // MathPixImageRegistry.getMetadataStatus → altState === "no-alt").
    // _performSave now calls this.refresh() after the registry write so
    // the grid card matches the saved state. _undoSave does the same
    // after the revert.
    //
    // 11A: save altText: "" → "X11A" — Alt button must lose --needs-attention.
    // 11B: save altText: "X" → ""   — Alt button must gain --needs-attention.
    // 11C: undo a "" → "X" save     — Alt button re-acquires --needs-attention.
    // 11D: regression check for B.3 wider scope — after save, the card's
    //      metadata cluster contains the alt-set icon (not the missing one).
    // ========================================================================
    console.log("\n  -- Case 11: 13(c) / Discovery 20 — grid re-renders --");

    const NEEDS_ATTN_CLASS = "image-manager-alt-btn--needs-attention";
    // BADGE_ICONS.alt — the cluster slot is OMITTED when alt is missing
    // and ADDED with this icon when alt is set (or replaced by the
    // eyeOff icon when decorative). The icon name is "missingAlt" for
    // historical reasons; presence/absence of the slot is what conveys
    // the state, not the icon string itself.
    const BADGE_ALT_SET_ICON = "missingAlt";

    function altBtnForId(imageId) {
      return document.querySelector(
        `.image-manager-alt-btn[data-image-id="${imageId}"]`,
      );
    }

    function metadataClusterForId(imageId) {
      const card = document.querySelector(
        `.image-manager-card[data-image-id="${imageId}"]`,
      );
      return card?.querySelector(".mmd-image-manager-metadata-cluster");
    }

    // --- 11A: empty → non-empty altText, --needs-attention removed ---
    registry.updateAltText(testId, "", "user");
    mgr.refresh();
    mgr.openEditAltText(testId);
    const c11aAltInput = document.getElementById(
      EXPECTED_FIELD_IDS.altText.input,
    );
    if (c11aAltInput) {
      c11aAltInput.value = "X11A_NON_EMPTY_ALT_TEXT";
      c11aAltInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await mgr._performSave();
    await Promise.resolve();
    const c11aBtn = altBtnForId(testId);
    r.assert(
      "Case 11A: after save with non-empty altText, Alt button has NO --needs-attention modifier",
      !!c11aBtn && !c11aBtn.classList.contains(NEEDS_ATTN_CLASS),
    );

    // 11D: cluster now contains an alt-set badge (wider B.3 regression check).
    const c11aCluster = metadataClusterForId(testId);
    const c11aHasAltSetIcon = !!c11aCluster?.querySelector(
      `[data-icon="${BADGE_ALT_SET_ICON}"]`,
    );
    r.assert(
      "Case 11D: after save with non-empty altText, metadata cluster contains alt-set icon",
      c11aHasAltSetIcon,
    );

    // 11E: focus-return invariant survives refresh(). _performSave's new
    // step-4 refresh() destroys the originating button's DOM node before
    // _closeEditAltText calls _focusCardAltBtn. The focus helper re-queries
    // by data-image-id, so the rebuilt button (same selector) receives
    // focus. If a future change were to cache the originating node before
    // refresh(), focus would land on <body> and this assertion would catch
    // the regression.
    r.assert(
      "Case 11E: after save, focus returned to the originating card's Alt button (Q8b survives refresh)",
      !!c11aBtn &&
        document.activeElement === c11aBtn &&
        document.activeElement?.dataset?.imageId === testId,
    );

    // --- 11B: non-empty → empty altText, --needs-attention re-acquired ---
    mgr.openEditAltText(testId);
    const c11bAltInput = document.getElementById(
      EXPECTED_FIELD_IDS.altText.input,
    );
    if (c11bAltInput) {
      c11bAltInput.value = "";
      c11bAltInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await mgr._performSave();
    await Promise.resolve();
    const c11bBtn = altBtnForId(testId);
    r.assert(
      "Case 11B: after save clearing altText to empty, Alt button HAS --needs-attention modifier",
      !!c11bBtn && c11bBtn.classList.contains(NEEDS_ATTN_CLASS),
    );

    // --- 11C: undo a "" → "X" save, button re-acquires --needs-attention ---
    // Set up a clean "" baseline, save → "X11C", then call _undoSave
    // with the snapshot { altText: "" } so the revert empties altText.
    registry.updateAltText(testId, "", "user");
    mgr.refresh();
    mgr.openEditAltText(testId);
    const c11cAltInput = document.getElementById(
      EXPECTED_FIELD_IDS.altText.input,
    );
    if (c11cAltInput) {
      c11cAltInput.value = "X11C_TO_BE_UNDONE";
      c11cAltInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await mgr._performSave();
    await Promise.resolve();
    // Now invoke undo directly with a snapshot reverting to "".
    mgr._undoSave(testId, { altText: "" }, ["altText"]);
    await Promise.resolve();
    const c11cBtn = altBtnForId(testId);
    r.assert(
      "Case 11C: after _undoSave reverting altText to empty, Alt button re-acquires --needs-attention",
      !!c11cBtn && c11cBtn.classList.contains(NEEDS_ATTN_CLASS),
    );

    restoreBaseline();
    mgr.refresh();
    window.UniversalModal?.hideStatus?.();

    // Final cleanup — guarantee the registry baseline is intact regardless
    // of which fragments ran. Dismiss any lingering modal status.
    restoreBaseline();
    window.UniversalModal?.hideStatus?.();
  }

  // ============================================================================
  // TOP-LEVEL RUNNER
  // ============================================================================

  async function runStage5Tests() {
    console.log("=== Stage 5 Tests ===");
    const r = makeResults();

    const pre = checkPreconditions();
    console.log("Preconditions:");
    console.log(`  ${pre.mathpixModeActive ? "✓" : "✗"} mathpixModeActive`);
    console.log(`  ${pre.managerOpen ? "✓" : "✗"} managerOpen`);

    // Group 2 — always runs
    runGroup2(r);

    // Group 3 — preconditioned (async since Chunk 4a save flow is async)
    const allMet = pre.mathpixModeActive && pre.managerOpen;
    if (allMet) {
      console.log("\n--- Group 3: Integration consistency tests ---");
      await runGroup3(r);
    } else {
      const failing = Object.entries(pre)
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(", ");
      const plural = failing.includes(",") ? "s" : "";
      console.log(
        `\n--- Group 3: SKIPPED (${failing} precondition${plural} missing) ---`,
      );
      r.skip(GROUP_3_ASSERTION_COUNT);
    }

    // Group 4 — Phase 4a.5 synthetic restore invariant (always runs, no
    // dependency on UI state — builds its own fixture).
    runGroup4(r);

    // Group 5 — Chunk 4b close-flow save integration (preconditioned same
    // as Group 3: needs MathPix mode active + manager open + ≥1 image).
    if (allMet) {
      await runGroup5(r);
    } else {
      const failing = Object.entries(pre)
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(", ");
      const plural = failing.includes(",") ? "s" : "";
      console.log(
        `\n--- Group 5: SKIPPED (${failing} precondition${plural} missing) ---`,
      );
      r.skip(GROUP_5_ASSERTION_COUNT);
    }

    console.log(
      `\n--- Task 5.1 (UI shell) results ---`,
    );
    console.log(
      `Results: ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped`,
    );

    return {
      passed: r.passed,
      failed: r.failed,
      skipped: r.skipped,
      results: r.results,
    };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.runStage5Tests = runStage5Tests;

  logInfo("Stage 5 test runner registered: window.runStage5Tests()");
})();
