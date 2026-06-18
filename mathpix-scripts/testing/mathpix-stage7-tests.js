/**
 * @fileoverview Stage 7 test runner — verifies the document-level Context
 *   feature added across Parcels 2–7: the MathPixContextManager state core,
 *   the two hand-written Context forms in tools.html (upload + resume), and
 *   the form wiring that binds them to the manager.
 * @module MathPixStage7Tests
 * @requires MathPixContextManager
 * @version 1.0.0 (Stage 7 Parcel 8)
 *
 * Single runner: `window.runStage7Tests` is the ONLY exposed name (Stage 7
 * lock — no canonical+alias convention). Returns
 * { passed, failed, skipped, results }.
 *
 * Four groups:
 *   1. MARKUP   — tabs/panels exist with the § 3 pinned attributes, label
 *                 association, no duplicate ids, 8 data-context-key controls
 *                 per form whose key set equals the schema's, empty-option-first
 *                 on every select.
 *   2. MODULE   — API surface (exactly the five methods + AUDIENCE_FALLBACK),
 *                 frozen fallback, schema shape + pinned key order, the
 *                 documentType dual-source drift check (markup vs schema),
 *                 clone semantics, updateField/setContext/reset behaviour.
 *   3. WIRING   — synthetic "input" events reach state on both roots, setContext
 *                 re-populates both forms, reset clears both, Audience options
 *                 deep-equal the live schema list.
 *   4. DRIFT-GUARD — fetches image-describer-config.json (a deliberate file-read
 *                 dependency) and pins the live audienceLevels list to
 *                 AUDIENCE_FALLBACK. Two distinct failure modes:
 *                 "drift-guard: config unreadable — <detail>" and
 *                 "drift-guard: lists differ — <first divergence>".
 *
 * STATE HYGIENE: the wiring tests mutate manager state and form DOM. The
 * runner snapshots getContext() at suite start and, in a finally block,
 * reset()s then setContext(snapshot) so any value the user had typed before
 * running the suite survives the run (the § 3 view-update contract re-populates
 * the form DOM from the restored state).
 *
 * @see mathpix-scripts/docs/alt-text/stage-7-implementation-plan.md — § 3, Parcel 8
 * @see mathpix-scripts/core/mathpix-context-manager.js
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
    if (shouldLog(0)) console.error(`[Stage7Tests] ${msg}`, ...args);
  }
  function logWarn(msg, ...args) {
    if (shouldLog(1)) console.warn(`[Stage7Tests] ${msg}`, ...args);
  }
  function logInfo(msg, ...args) {
    if (shouldLog(2)) console.log(`[Stage7Tests] ${msg}`, ...args);
  }
  function logDebug(msg, ...args) {
    if (shouldLog(3)) console.log(`[Stage7Tests] ${msg}`, ...args);
  }

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
  // SHARED CONSTANTS & HELPERS
  // ============================================================================

  /** The eight schema keys, in canonical (pinned) order. */
  const EXPECTED_KEYS = [
    "subjectArea",
    "specificTopic",
    "learningObjective",
    "moduleName",
    "moduleCode",
    "audienceLevel",
    "documentType",
    "extraInformation",
  ];

  /** The seven hard-typed Document Type {value, label} pairs (markup-owned). */
  const EXPECTED_DOCUMENT_TYPES = [
    { value: "solution-sheet", label: "Solution sheet" },
    { value: "handout", label: "Handout" },
    { value: "article", label: "Article" },
    { value: "past-exam-paper", label: "Past exam paper" },
    { value: "lecture-notes", label: "Lecture notes" },
    { value: "worksheet", label: "Worksheet" },
    { value: "other", label: "Other" },
  ];

  /** The exact public-API surface (five methods + the frozen fallback). */
  const EXPECTED_API_KEYS = [
    "getContext",
    "setContext",
    "updateField",
    "reset",
    "getSchema",
    "AUDIENCE_FALLBACK",
  ];

  /** The five members that must be functions. */
  const EXPECTED_METHODS = [
    "getContext",
    "setContext",
    "updateField",
    "reset",
    "getSchema",
  ];

  const CONFIG_URL = "image-describer/image-describer-config.json";

  function resolveManager() {
    const M = window.MathPixContextManager;
    return M && typeof M === "object" ? M : null;
  }

  /**
   * Compare two arrays of {value, label} pairs for order-sensitive equality.
   * Returns null when equal, otherwise a human-readable first-divergence string.
   * @param {Array<{value:string,label:string}>} got
   * @param {Array<{value:string,label:string}>} want
   * @returns {string|null}
   */
  function firstPairDivergence(got, want) {
    if (got.length !== want.length) {
      return `length ${got.length} vs expected ${want.length}`;
    }
    for (let i = 0; i < want.length; i++) {
      if (got[i].value !== want[i].value || got[i].label !== want[i].label) {
        return (
          `index ${i}: got {"${got[i].value}","${got[i].label}"} ` +
          `vs expected {"${want[i].value}","${want[i].label}"}`
        );
      }
    }
    return null;
  }

  /**
   * Project a <select>'s NON-empty <option> children to {value, label} pairs
   * (skips the hand-written empty option at index 0). Label is the visible
   * text, trimmed.
   * @param {HTMLSelectElement} select
   * @returns {Array<{value:string,label:string}>}
   */
  function projectSelectOptions(select) {
    return [...select.options]
      .filter((opt) => opt.value !== "")
      .map((opt) => ({ value: opt.value, label: opt.textContent.trim() }));
  }

  /** Dispatch a bubbling "input" event (selects fire "input" natively). */
  function fireInput(control) {
    control.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ============================================================================
  // GROUP 1: MARKUP
  // ============================================================================

  function runGroup1(r, M) {
    console.log("\n--- Group 1: Markup (tabs, panels, forms) ---");

    // --- All six core ids exist. ---
    const coreIds = [
      "resume-tab-context",
      "resume-panel-context",
      "tab-context",
      "panel-context",
      "resume-context-form",
      "context-form",
    ];
    for (const id of coreIds) {
      r.assert(
        `1: element #${id} exists`,
        !!document.getElementById(id),
      );
    }

    const uploadTab = document.getElementById("tab-context");
    const resumeTab = document.getElementById("resume-tab-context");
    const uploadPanel = document.getElementById("panel-context");
    const resumePanel = document.getElementById("resume-panel-context");

    // --- data-format: upload tab carries it; resume tab deliberately does not. ---
    r.assert(
      '1: #tab-context has data-format="context"',
      uploadTab && uploadTab.dataset.format === "context",
      uploadTab ? `got "${uploadTab.dataset.format}"` : "tab absent",
    );
    r.assert(
      "1: #resume-tab-context has NO data-format (deliberate)",
      resumeTab && !("format" in resumeTab.dataset),
      resumeTab ? `got "${resumeTab.dataset.format}"` : "tab absent",
    );

    // --- aria-controls pairings on both tabs. ---
    r.assert(
      '1: #tab-context aria-controls="panel-context"',
      uploadTab && uploadTab.getAttribute("aria-controls") === "panel-context",
    );
    r.assert(
      '1: #resume-tab-context aria-controls="resume-panel-context"',
      resumeTab &&
        resumeTab.getAttribute("aria-controls") === "resume-panel-context",
    );

    // --- Both panels role="tabpanel" with correct aria-labelledby. ---
    r.assert(
      '1: #panel-context role="tabpanel"',
      uploadPanel && uploadPanel.getAttribute("role") === "tabpanel",
    );
    r.assert(
      '1: #panel-context aria-labelledby="tab-context"',
      uploadPanel &&
        uploadPanel.getAttribute("aria-labelledby") === "tab-context",
    );
    r.assert(
      '1: #resume-panel-context role="tabpanel"',
      resumePanel && resumePanel.getAttribute("role") === "tabpanel",
    );
    r.assert(
      '1: #resume-panel-context aria-labelledby="resume-tab-context"',
      resumePanel &&
        resumePanel.getAttribute("aria-labelledby") === "resume-tab-context",
    );

    // --- Resume panel sits inside #mathpix-resume-mode-container (the reset
    //     loop hides panels by container selector). ---
    r.assert(
      "1: #resume-panel-context is inside #mathpix-resume-mode-container",
      resumePanel && !!resumePanel.closest("#mathpix-resume-mode-container"),
    );

    // --- The four new tab/panel ids are unique in the document. ---
    for (const id of [
      "resume-tab-context",
      "resume-panel-context",
      "tab-context",
      "panel-context",
    ]) {
      r.assert(
        `1: id "${id}" appears exactly once`,
        document.querySelectorAll(`[id="${id}"]`).length === 1,
        `count=${document.querySelectorAll(`[id="${id}"]`).length}`,
      );
    }

    // --- Per-form control checks: 8 controls, each with id + label[for], and
    //     a key set equal to the schema's. ---
    const schemaKeys = M.getSchema().map((f) => f.key);
    for (const formId of ["resume-context-form", "context-form"]) {
      const form = document.getElementById(formId);
      if (!form) continue;
      const controls = [...form.querySelectorAll("[data-context-key]")];

      r.assert(
        `1: #${formId} has 8 [data-context-key] controls`,
        controls.length === 8,
        `got ${controls.length}`,
      );

      const missingId = controls.filter((c) => !c.id);
      r.assert(
        `1: #${formId} — every control has an id`,
        missingId.length === 0,
        `${missingId.length} without id`,
      );

      const unlabelled = controls.filter(
        (c) => !c.id || !document.querySelector(`label[for="${c.id}"]`),
      );
      r.assert(
        `1: #${formId} — every control has an associated label[for]`,
        unlabelled.length === 0,
        `${unlabelled.length} unlabelled: ${unlabelled
          .map((c) => c.id || "(no id)")
          .join(", ")}`,
      );

      const formKeys = controls.map((c) => c.dataset.contextKey).sort();
      const wantKeys = [...schemaKeys].sort();
      r.assert(
        `1: #${formId} — key set equals the schema key set exactly`,
        JSON.stringify(formKeys) === JSON.stringify(wantKeys),
        `got [${formKeys.join(",")}]`,
      );
    }

    // --- Both selects (audienceLevel, documentType) in both forms have the
    //     hand-written empty option FIRST. ---
    for (const formId of ["resume-context-form", "context-form"]) {
      const form = document.getElementById(formId);
      if (!form) continue;
      for (const key of ["audienceLevel", "documentType"]) {
        const select = form.querySelector(`[data-context-key="${key}"]`);
        const first = select && select.options[0];
        r.assert(
          `1: #${formId} ${key} — first option is the empty option (value === "")`,
          !!first && first.value === "",
          first ? `got "${first.value}"` : "no select/options",
        );
      }
    }
  }

  // ============================================================================
  // GROUP 2: MODULE
  // ============================================================================

  function runGroup2(r, M) {
    console.log("\n--- Group 2: Module (API, schema, semantics) ---");

    // --- API surface: exactly the five methods + AUDIENCE_FALLBACK. ---
    const keys = Object.keys(M).sort();
    r.assert(
      "2: enumerable API surface is exactly the five methods + AUDIENCE_FALLBACK",
      JSON.stringify(keys) === JSON.stringify([...EXPECTED_API_KEYS].sort()),
      `got [${keys.join(",")}]`,
    );
    for (const m of EXPECTED_METHODS) {
      r.assert(`2: ${m} is a function`, typeof M[m] === "function");
    }

    // --- AUDIENCE_FALLBACK: frozen, 7 entries, each {value, label} strings. ---
    const fallback = M.AUDIENCE_FALLBACK;
    r.assert(
      "2: AUDIENCE_FALLBACK is frozen",
      Object.isFrozen(fallback),
    );
    r.assert(
      "2: AUDIENCE_FALLBACK has 7 entries",
      Array.isArray(fallback) && fallback.length === 7,
      `got ${Array.isArray(fallback) ? fallback.length : typeof fallback}`,
    );
    const fallbackShapeOk =
      Array.isArray(fallback) &&
      fallback.every(
        (e) => e && typeof e.value === "string" && typeof e.label === "string",
      );
    r.assert(
      "2: every AUDIENCE_FALLBACK entry has string value + label",
      fallbackShapeOk,
    );

    // --- Schema: 8 fields, pinned key order. ---
    const schema = M.getSchema();
    r.assert(
      "2: schema has 8 fields",
      Array.isArray(schema) && schema.length === 8,
      `got ${Array.isArray(schema) ? schema.length : typeof schema}`,
    );
    const schemaKeys = schema.map((f) => f.key);
    r.assert(
      "2: schema key order matches the pinned order",
      JSON.stringify(schemaKeys) === JSON.stringify(EXPECTED_KEYS),
      `got [${schemaKeys.join(",")}]`,
    );

    // --- audienceLevel and documentType carry options. ---
    const audienceField = schema.find((f) => f.key === "audienceLevel");
    const docTypeField = schema.find((f) => f.key === "documentType");
    r.assert(
      "2: audienceLevel field carries a non-empty options array",
      audienceField &&
        Array.isArray(audienceField.options) &&
        audienceField.options.length > 0,
    );
    r.assert(
      "2: documentType field carries an options array",
      docTypeField && Array.isArray(docTypeField.options),
    );

    // --- documentType options are the seven hard-typed pairs. ---
    const docDiv = docTypeField
      ? firstPairDivergence(docTypeField.options, EXPECTED_DOCUMENT_TYPES)
      : "documentType field absent";
    r.assert(
      "2: documentType schema options are the seven hard-typed pairs, in order",
      docDiv === null,
      docDiv || undefined,
    );

    // --- DOCUMENT TYPE DUAL-SOURCE DRIFT CHECK: in BOTH forms, the markup's
    //     documentType options must deep-equal the schema's (markup + schema
    //     are two hand-typed copies of one list). ---
    for (const formId of ["resume-context-form", "context-form"]) {
      const form = document.getElementById(formId);
      const select =
        form && form.querySelector('[data-context-key="documentType"]');
      if (!select) {
        r.assert(
          `2: #${formId} documentType select present for drift check`,
          false,
          "select absent",
        );
        continue;
      }
      const markupOptions = projectSelectOptions(select);
      const div = firstPairDivergence(
        markupOptions,
        docTypeField ? docTypeField.options : EXPECTED_DOCUMENT_TYPES,
      );
      r.assert(
        `2: #${formId} documentType markup options deep-equal the schema options`,
        div === null,
        div || undefined,
      );
    }

    // --- Clone semantics: mutating a returned schema/context does not bleed
    //     into subsequent calls. ---
    const s1 = M.getSchema();
    s1[0].label = "MUTATED";
    s1.push({ key: "injected", label: "x", type: "text", defaultValue: "" });
    if (s1[5] && Array.isArray(s1[5].options)) s1[5].options.push({ value: "z", label: "z" });
    const s2 = M.getSchema();
    r.assert(
      "2: getSchema() returns are independent clones (label mutation does not persist)",
      s2[0].label !== "MUTATED" && s2.length === 8,
      `got label="${s2[0].label}", length=${s2.length}`,
    );

    const c1 = M.getContext();
    c1.subjectArea = "MUTATED_CLONE";
    c1.injected = "x";
    const c2 = M.getContext();
    r.assert(
      "2: getContext() returns are independent clones",
      c2.subjectArea !== "MUTATED_CLONE" && !("injected" in c2),
      `got subjectArea="${c2.subjectArea}"`,
    );

    // --- updateField: unknown key → no-op; known key coerces to String. ---
    const beforeUnknown = JSON.stringify(M.getContext());
    M.updateField("totallyBogusKey", "value");
    r.assert(
      "2: updateField(unknown) is a no-op (state unchanged)",
      JSON.stringify(M.getContext()) === beforeUnknown,
    );
    M.updateField("moduleCode", 42);
    r.assert(
      '2: updateField(known, 42) coerces to "42"',
      M.getContext().moduleCode === "42",
      `got ${JSON.stringify(M.getContext().moduleCode)}`,
    );

    // --- setContext: non-object → no-op; recognised strings applied;
    //     recognised non-string skipped; unrecognised ignored. ---
    const beforeNonObject = JSON.stringify(M.getContext());
    M.setContext(null);
    M.setContext("not an object");
    M.setContext(["array", "is", "not", "plain"]);
    r.assert(
      "2: setContext(non-object) is a no-op",
      JSON.stringify(M.getContext()) === beforeNonObject,
    );

    M.setContext({
      subjectArea: "Chemistry", // recognised string → applied
      moduleName: 12345, // recognised non-string → skipped
      bogusKey: "ignored", // unrecognised → ignored
    });
    const afterSet = M.getContext();
    r.assert(
      "2: setContext applied recognised string key (subjectArea)",
      afterSet.subjectArea === "Chemistry",
      `got "${afterSet.subjectArea}"`,
    );
    r.assert(
      "2: setContext skipped recognised non-string key (moduleName unchanged)",
      afterSet.moduleName === "",
      `got "${afterSet.moduleName}"`,
    );
    r.assert(
      "2: setContext ignored unrecognised key (bogusKey absent)",
      !("bogusKey" in afterSet),
    );

    // --- reset(): all eight values become "". ---
    M.reset();
    const afterReset = M.getContext();
    const allBlank =
      Object.keys(afterReset).length === 8 &&
      EXPECTED_KEYS.every((k) => afterReset[k] === "");
    r.assert(
      "2: reset() blanks all eight values",
      allBlank,
      `got ${JSON.stringify(afterReset)}`,
    );
  }

  // ============================================================================
  // GROUP 3: WIRING
  // ============================================================================
  //
  // Selects fire "input" natively (verified); dispatch
  // new Event("input", { bubbles: true }) throughout. Each test mutates a
  // control's .value then fires the event, asserting state/views react.

  function runGroup3(r, M) {
    console.log("\n--- Group 3: Wiring (input events, view-update contract) ---");

    const uploadForm = document.getElementById("context-form");
    const resumeForm = document.getElementById("resume-context-form");
    if (!uploadForm || !resumeForm) {
      r.assert(
        "3: both form roots present for wiring tests",
        false,
        "a form root is missing — wiring tests cannot run",
      );
      return;
    }

    const schema = M.getSchema();
    const audienceOptions =
      (schema.find((f) => f.key === "audienceLevel") || {}).options || [];

    // --- Text control in the UPLOAD form. ---
    {
      const ctrl = uploadForm.querySelector('[data-context-key="subjectArea"]');
      ctrl.value = "WIRING_UPLOAD_SUBJECT";
      fireInput(ctrl);
      r.assert(
        '3: upload text "input" reaches state (subjectArea)',
        M.getContext().subjectArea === "WIRING_UPLOAD_SUBJECT",
        `got "${M.getContext().subjectArea}"`,
      );
    }

    // --- Upload audienceLevel select to a real option value. ---
    {
      const ctrl = uploadForm.querySelector(
        '[data-context-key="audienceLevel"]',
      );
      const realValue = audienceOptions.length ? audienceOptions[0].value : "";
      ctrl.value = realValue;
      fireInput(ctrl);
      r.assert(
        '3: upload audienceLevel select "input" reaches state',
        M.getContext().audienceLevel === realValue && realValue !== "",
        `got "${M.getContext().audienceLevel}" (option "${realValue}")`,
      );
    }

    // --- Upload documentType select to a real option value. ---
    {
      const ctrl = uploadForm.querySelector(
        '[data-context-key="documentType"]',
      );
      ctrl.value = "worksheet";
      fireInput(ctrl);
      r.assert(
        '3: upload documentType select "input" reaches state',
        M.getContext().documentType === "worksheet",
        `got "${M.getContext().documentType}"`,
      );
    }

    // --- Text control in the RESUME form (both roots wired). ---
    {
      const ctrl = resumeForm.querySelector('[data-context-key="moduleCode"]');
      ctrl.value = "WIRING_RESUME_CODE";
      fireInput(ctrl);
      r.assert(
        '3: resume text "input" reaches state (moduleCode)',
        M.getContext().moduleCode === "WIRING_RESUME_CODE",
        `got "${M.getContext().moduleCode}"`,
      );
    }

    // --- setContext re-populates BOTH forms (view-update contract). ---
    {
      M.setContext({ moduleName: "WIRING_VIEW_UPDATE" });
      const uploadCtrl = uploadForm.querySelector(
        '[data-context-key="moduleName"]',
      );
      const resumeCtrl = resumeForm.querySelector(
        '[data-context-key="moduleName"]',
      );
      r.assert(
        "3: setContext updated the upload form's moduleName control",
        uploadCtrl.value === "WIRING_VIEW_UPDATE",
        `got "${uploadCtrl.value}"`,
      );
      r.assert(
        "3: setContext updated the resume form's moduleName control",
        resumeCtrl.value === "WIRING_VIEW_UPDATE",
        `got "${resumeCtrl.value}"`,
      );
    }

    // --- reset() blanks both forms; both selects back on the empty option. ---
    {
      M.reset();
      const uploadBlank = [
        ...uploadForm.querySelectorAll("[data-context-key]"),
      ].every((c) => c.value === "");
      const resumeBlank = [
        ...resumeForm.querySelectorAll("[data-context-key]"),
      ].every((c) => c.value === "");
      r.assert("3: reset() blanked every upload control", uploadBlank);
      r.assert("3: reset() blanked every resume control", resumeBlank);

      for (const [formId, form] of [
        ["context-form", uploadForm],
        ["resume-context-form", resumeForm],
      ]) {
        for (const key of ["audienceLevel", "documentType"]) {
          const select = form.querySelector(`[data-context-key="${key}"]`);
          r.assert(
            `3: #${formId} ${key} back on the empty option after reset`,
            select.value === "",
            `got "${select.value}"`,
          );
        }
      }
    }

    // --- Audience options: 1 empty + N appended options whose {value,label}
    //     pairs deep-equal the schema's audienceLevel options. ---
    for (const [formId, form] of [
      ["context-form", uploadForm],
      ["resume-context-form", resumeForm],
    ]) {
      const select = form.querySelector('[data-context-key="audienceLevel"]');
      const firstEmpty = select.options[0] && select.options[0].value === "";
      r.assert(
        `3: #${formId} audienceLevel has the empty option first`,
        firstEmpty,
      );
      const projected = projectSelectOptions(select);
      const div = firstPairDivergence(projected, audienceOptions);
      r.assert(
        `3: #${formId} audienceLevel appended options deep-equal the schema list`,
        div === null,
        div || undefined,
      );
    }
  }

  // ============================================================================
  // GROUP 4: DRIFT-GUARD
  // ============================================================================
  //
  // Locked: the runner carries a file-read dependency on the config BY DESIGN.
  // Two failure modes with DISTINCT messages that must never collide:
  //   "drift-guard: config unreadable — <detail>"
  //   "drift-guard: lists differ — <first divergence>"

  async function runGroup4(r, M) {
    console.log("\n--- Group 4: Drift-guard (config ↔ AUDIENCE_FALLBACK) ---");

    const fallback = M.AUDIENCE_FALLBACK.map((e) => ({
      value: e.value,
      label: e.label,
    }));

    // --- Read the same config URL the module uses. ---
    let config = null;
    let unreadable = null;
    try {
      const response = await fetch(CONFIG_URL);
      if (!response.ok) {
        unreadable = `HTTP ${response.status}`;
      } else {
        try {
          config = await response.json();
        } catch (e) {
          unreadable = `malformed JSON (${e && e.message})`;
        }
      }
    } catch (e) {
      unreadable = `fetch threw (${e && e.message})`;
    }

    let list = null;
    if (!unreadable) {
      list = config && config.audienceLevels;
      if (!Array.isArray(list)) {
        unreadable = "audienceLevels missing or not an array";
      }
    }

    if (unreadable) {
      // DISTINCT failure mode 1 — never softened to a skip.
      r.assert(
        `drift-guard: config unreadable — ${unreadable}`,
        false,
        unreadable,
      );
      return;
    }

    r.assert(
      "drift-guard: config audienceLevels is a readable array",
      true,
    );

    // --- Shape PRESENT-AND-READABLE: each entry offers readable string value
    //     and label. EXTRA KEYS (promptModifier etc.) are ignored — never
    //     assert exact key sets. ---
    let badEntry = null;
    for (const entry of list) {
      if (
        !entry ||
        typeof entry.value !== "string" ||
        typeof entry.label !== "string"
      ) {
        badEntry = JSON.stringify(entry);
        break;
      }
    }
    r.assert(
      "drift-guard: every config entry offers a readable string value + label (extra keys ignored)",
      badEntry === null,
      badEntry ? `unreadable entry: ${badEntry}` : undefined,
    );

    // --- Project to {value, label} and deep-compare, in order, against
    //     AUDIENCE_FALLBACK. ---
    const projected = list.map((e) => ({ value: e.value, label: e.label }));
    const divergence = firstPairDivergence(projected, fallback);
    if (divergence) {
      // DISTINCT failure mode 2 — never softened to a skip.
      r.assert(`drift-guard: lists differ — ${divergence}`, false, divergence);
    } else {
      r.assert(
        "drift-guard: config audienceLevels deep-equal AUDIENCE_FALLBACK, in order",
        true,
      );
    }
  }

  // ============================================================================
  // TOP-LEVEL RUNNER
  // ============================================================================

  async function runStage7Tests() {
    console.log("=== Stage 7 Tests ===");
    const r = makeResults();

    const M = resolveManager();
    if (!M) {
      r.assert(
        "0: window.MathPixContextManager is available",
        false,
        "manager not exposed — cannot run Stage 7 tests",
      );
      console.log("\n--- Stage 7 results ---");
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
    r.assert("0: window.MathPixContextManager is available", true);

    // STATE HYGIENE — snapshot the user's live context before any mutation;
    // restore it (and re-populate the form DOM via the view-update contract)
    // in the finally block so a typed-but-unsaved value survives the run.
    const snapshot = M.getContext();

    try {
      runGroup1(r, M);
      runGroup2(r, M);
      runGroup3(r, M);
      await runGroup4(r, M);
    } finally {
      M.reset();
      M.setContext(snapshot);
      logInfo("State hygiene: context restored from pre-run snapshot.");
    }

    console.log("\n--- Stage 7 results ---");
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

  window.runStage7Tests = runStage7Tests;

  logInfo("Stage 7 test runner registered: window.runStage7Tests()");
})();
