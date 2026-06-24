/**
 * @file mathpix-context-manager.js
 * @module MathPixContextManager
 * @description
 * Stage 7 document-level context state for the MathPix alt-text workflow.
 *
 * Holds the single authoritative "document context" object (subject area,
 * topic, audience level, document type, etc.) that the Context tab in both
 * upload mode and resume mode reads from and writes to. The manager owns the
 * truth; the DOM forms are a view (Q3 invariant). The two forms are the entry
 * and exit points of one lifecycle, never two concurrent documents.
 *
 * This parcel (Parcel 2) provides the schema + state core ONLY. Form wiring,
 * markup population and event listeners arrive in a later parcel inside this
 * same IIFE — there is deliberately no DOM access here.
 *
 * Behavioural contract (from stage-7-planning-decisions.md):
 *  - Synchronous to all callers. `getSchema()` never returns a promise; the
 *    only async is an internal, startup-once fetch of the audience-level list.
 *  - `audienceLevel.options` is seeded synchronously with AUDIENCE_FALLBACK at
 *    definition, then replaced by the config projection if the startup read
 *    yields at least one usable {value, label} pair (Q1 widened trigger).
 *  - "Empty" and "absent" are the same thing — a blank context (Q4). `reset()`
 *    is the single definition of blank.
 *
 * @see mathpix-scripts/docs/alt-text/stage-7-planning-decisions.md (Q1, Q3, Q4)
 * @see mathpix-scripts/docs/alt-text/stage-7-implementation-plan.md (§ 3, Parcel 2)
 */

const MathPixContextManager = (function () {
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
      console.error(`[MathPixContextManager] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[MathPixContextManager] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[MathPixContextManager] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[MathPixContextManager] ${message}`, ...args);
  }

  // ---------------------------------------------------------------------------
  // Audience-level fallback
  // ---------------------------------------------------------------------------

  /**
   * Hard-typed copy of the config's seven audience levels.
   *
   * FALLBACK ONLY — this is a safety net, NOT the source of truth. It is used
   * solely when the startup read of `image-describer-config.json` fails to
   * yield a usable list of {value, label} pairs. The config is the live source;
   * this copy was seeded from the config on 2026-06-02 and MUST be updated by
   * hand if the config's `audienceLevels` list changes. The drift-guard
   * assertion inside `runStage7Tests` (a later parcel) is what catches
   * divergence between this copy and the config — its sole consumer.
   *
   * Deep-frozen so callers cannot mutate it.
   *
   * @type {ReadonlyArray<{value: string, label: string}>}
   */
  const AUDIENCE_FALLBACK = Object.freeze(
    [
      { value: "general", label: "General Audience" },
      { value: "ug1", label: "Undergraduate Year 1" },
      { value: "ug2", label: "Undergraduate Year 2" },
      { value: "ug3", label: "Undergraduate Year 3" },
      { value: "ug4", label: "Undergraduate Year 4" },
      { value: "pg", label: "Postgraduate" },
      { value: "staff", label: "Staff / Academic" },
    ].map((pair) => Object.freeze(pair)),
  );

  // ---------------------------------------------------------------------------
  // Document Type options — hard-typed, feature-owned (no external source)
  // ---------------------------------------------------------------------------

  const DOCUMENT_TYPE_OPTIONS = [
    { value: "solution-sheet", label: "Solution sheet" },
    { value: "handout", label: "Handout" },
    { value: "article", label: "Article" },
    { value: "past-exam-paper", label: "Past exam paper" },
    { value: "lecture-notes", label: "Lecture notes" },
    { value: "worksheet", label: "Worksheet" },
    { value: "other", label: "Other" },
  ];

  // ---------------------------------------------------------------------------
  // Schema — the single source of field knowledge (Q1)
  // ---------------------------------------------------------------------------

  /**
   * The eight context fields, in canonical order. `key` is the camelCase
   * storage identifier (matches the registry field-naming convention and
   * becomes the context.json key in Stage 8 / localStorage shape in Stage 9).
   * `label` is the accessible name only — never instructions. `type` drives the
   * later form-population switch. `defaultValue` is the canonical empty value
   * per field (the one definition of "blank", shared by `reset()` and Stage 8's
   * empty-context shape). `options` (selects only) is an ordered array of
   * {value, label} pairs.
   *
   * `audienceLevel.options` is SEEDED SYNCHRONOUSLY with AUDIENCE_FALLBACK here
   * so `getSchema()` can never return an empty options list regardless of fetch
   * timing; the startup read below replaces it if it yields a usable list.
   *
   * @type {Array<{key: string, label: string, type: string, defaultValue: string, options?: Array<{value: string, label: string}>}>}
   */
  const SCHEMA = [
    {
      key: "subjectArea",
      label: "Subject Area",
      type: "text",
      defaultValue: "",
    },
    {
      key: "specificTopic",
      label: "Specific Topic",
      type: "text",
      defaultValue: "",
    },
    {
      key: "learningObjective",
      label: "Learning Objective",
      type: "text",
      defaultValue: "",
    },
    {
      key: "moduleName",
      label: "Module / Course Name",
      type: "text",
      defaultValue: "",
    },
    { key: "moduleCode", label: "Module Code", type: "text", defaultValue: "" },
    {
      key: "audienceLevel",
      label: "Audience Level",
      type: "select",
      defaultValue: "",
      // Seeded with the fallback; replaced at startup from the live config.
      options: AUDIENCE_FALLBACK.map((pair) => ({
        value: pair.value,
        label: pair.label,
      })),
    },
    {
      key: "documentType",
      label: "Document Type",
      type: "select",
      defaultValue: "",
      options: DOCUMENT_TYPE_OPTIONS.map((pair) => ({
        value: pair.value,
        label: pair.label,
      })),
    },
    {
      key: "extraInformation",
      label: "Extra Information",
      type: "textarea",
      defaultValue: "",
    },
  ];

  // ---------------------------------------------------------------------------
  // Canonical state — one context object, initialised from schema defaults
  // ---------------------------------------------------------------------------

  /**
   * Build a blank context (every field at its schema `defaultValue`). This is
   * the single definition of "blank" used by initialisation and `reset()`.
   * @returns {Object<string, string>}
   */
  function buildBlankContext() {
    const blank = {};
    for (const field of SCHEMA) {
      blank[field.key] = field.defaultValue;
    }
    return blank;
  }

  /** @type {Object<string, string>} The authoritative document context. */
  let context = buildBlankContext();

  /** Lookup of recognised schema keys for quick membership tests. */
  const KNOWN_KEYS = new Set(SCHEMA.map((field) => field.key));

  /**
   * Deep-clone helper for plain data (objects, arrays, strings). The schema and
   * context are plain JSON-serialisable structures, so this is sufficient and
   * guarantees callers cannot mutate canonical state or definitions.
   * @template T
   * @param {T} value
   * @returns {T}
   */
  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // ---------------------------------------------------------------------------
  // Startup read of the audience list (the only async; internal sequencing)
  // ---------------------------------------------------------------------------

  /**
   * URL of the config that owns the live audience-level list. Copied verbatim
   * from the working Image Describer mode init in tools.html (the page is
   * served from the repo root), so it resolves identically here.
   */
  const CONFIG_URL = "image-describer/image-describer-config.json";

  /**
   * Module-PRIVATE settled-state promise for the startup read. A later wiring
   * parcel awaits this internally before initial form population so the
   * dropdown renders the live config list rather than the seed. It is
   * deliberately NOT exposed: no caller of the public API ever awaits anything.
   * @type {Promise<void>}
   */
  const readyPromise = (async function loadAudienceLevels() {
    const audienceField = SCHEMA.find((field) => field.key === "audienceLevel");

    let response;
    try {
      response = await fetch(CONFIG_URL);
    } catch (error) {
      logWarn(
        `Audience-level startup read failed (fetch threw — config unreachable); keeping the seeded fallback list. ${CONFIG_URL}`,
        error,
      );
      return;
    }

    if (!response.ok) {
      logWarn(
        `Audience-level startup read failed (HTTP ${response.status}); keeping the seeded fallback list.`,
      );
      return;
    }

    let config;
    try {
      config = await response.json();
    } catch (error) {
      logWarn(
        "Audience-level startup read failed (malformed JSON); keeping the seeded fallback list.",
        error,
      );
      return;
    }

    const list = config && config.audienceLevels;
    if (!Array.isArray(list)) {
      logWarn(
        "Audience-level startup read failed (audienceLevels missing or not an array); keeping the seeded fallback list.",
      );
      return;
    }
    if (list.length === 0) {
      logWarn(
        "Audience-level startup read failed (audienceLevels is an empty array); keeping the seeded fallback list.",
      );
      return;
    }

    // Project each entry to {value, label}, keeping ONLY entries where both are
    // readable strings and IGNORING extra keys (e.g. promptModifier, always
    // present — never required).
    const projected = list
      .filter(
        (entry) =>
          entry &&
          typeof entry.value === "string" &&
          typeof entry.label === "string",
      )
      .map((entry) => ({ value: entry.value, label: entry.label }));

    // Widened fallback trigger (Q1): fall back unless the projection yields at
    // least one usable pair — covers "parsed but unusable", not only throws.
    if (projected.length === 0) {
      logWarn(
        "Audience-level startup read failed (no usable {value, label} pair after projection); keeping the seeded fallback list.",
      );
      return;
    }

    audienceField.options = projected;
    logInfo(
      `Audience-level list read from config (${projected.length} entries).`,
    );
  })();

  logDebug("Initialised with a blank context.", buildBlankContext());

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns a deep clone of the current context (all 8 keys, string values).
   * Callers cannot mutate canonical state through the returned object.
   * @returns {Object<string, string>}
   */
  function getContext() {
    return deepClone(context);
  }

  /**
   * Lenient merge into the current context. Never throws.
   *  - If `partial` is not a plain object → WARN and no-op.
   *  - For each RECOGNISED schema key present: apply if the value is a string;
   *    skip non-string values with a WARN.
   *  - Unrecognised keys are ignored (logged at DEBUG).
   * @param {Object<string, *>} partial
   * @returns {void}
   */
  function setContext(partial) {
    stateWrittenSinceLoad = true;
    if (
      partial === null ||
      typeof partial !== "object" ||
      Array.isArray(partial)
    ) {
      logWarn("setContext ignored: argument is not a plain object.", partial);
      return;
    }

    for (const key of Object.keys(partial)) {
      if (!KNOWN_KEYS.has(key)) {
        logDebug(`setContext ignoring unrecognised key "${key}".`);
        continue;
      }
      const value = partial[key];
      if (typeof value !== "string") {
        logWarn(
          `setContext skipping key "${key}": value is not a string.`,
          value,
        );
        continue;
      }
      context[key] = value;
    }

    // View-update contract (§ 3): setContext re-populates all wired form roots
    // from the new state. No-ops before wiring has initialised.
    repopulateAllRoots();
    scheduleMirrorWrite();
  }

  /**
   * Sets a single recognised field. Unknown key → WARN and no-op. Known key →
   * stored as a String.
   * @param {string} key
   * @param {*} value
   * @returns {void}
   */
  function updateField(key, value) {
    stateWrittenSinceLoad = true;
    if (!KNOWN_KEYS.has(key)) {
      logWarn(`updateField ignored: unrecognised key "${key}".`);
      return;
    }
    context[key] = String(value);
    scheduleMirrorWrite();

    // Stage 9 (Q4): signal a user-edit so the resume restorer can mark context
    // as an unsaved change. User-edit path ONLY — setContext/reset are system
    // writes and must not trip the dirty sensor. No detail payload; inert in
    // upload mode (no listener there).
    document.dispatchEvent(new CustomEvent("mathpix:context-edited"));
  }

  /**
   * Resets every field to its schema `defaultValue` — the single definition of
   * a blank context (Q4: empty and absent are the same thing).
   * @returns {void}
   */
  function reset() {
    stateWrittenSinceLoad = true;
    context = buildBlankContext();
    logDebug("Context reset to blank.");

    // View-update contract (§ 3): reset re-populates all wired form roots from
    // the now-blank state. No-ops before wiring has initialised.
    repopulateAllRoots();

    // Stage 9 (Q2/Q5): cancel any pending mirror write FIRST, then delete the
    // key so a blanked context cannot resurrect on reload.
    cancelPendingMirrorWrite();
    try {
      localStorage.removeItem(MIRROR_STORAGE_KEY);
      localStorage.removeItem(MIRROR_SOURCE_KEY);
    } catch (error) {
      logError("Context mirror clear failed.", error);
    }
  }

  /**
   * Returns a deep clone of the schema, including each select's CURRENT options
   * (the live audience list once the startup read has resolved). Never returns
   * a promise. Callers cannot mutate the canonical definitions.
   * @returns {Array<Object>}
   */
  function getSchema() {
    return deepClone(SCHEMA);
  }

  // ---------------------------------------------------------------------------
  // Form wiring and population (Parcel 7)
  //
  // Wires both hand-written Context forms to this manager. The manager owns the
  // truth (Q3); the forms are a view. All wiring is PRIVATE — the public API is
  // unchanged. Three separate concerns:
  //   1. OPTIONS FILL — once per root at init, AFTER the internal ready promise,
  //      fills the Audience select from the live schema options (config
  //      projection in the normal case, the seeded fallback when degraded). The
  //      hand-written empty <option> is left untouched; the Document Type select
  //      is markup-owned and never rebuilt.
  //   2. VALUES FILL — a generic loop over the schema, setting each control's
  //      value from the current context. Runs at init and again on every
  //      setContext/reset (the § 3 view-update contract).
  //   3. INPUT WIRING — an "input" listener per control routing typing into
  //      updateField. NO DOM write-back on this path (no echo loop fighting the
  //      caret); updateField therefore never triggers a values fill.
  // ---------------------------------------------------------------------------

  /** The two hand-written Context form roots, in lifecycle order. */
  const FORM_ROOT_IDS = ["resume-context-form", "context-form"];

  /**
   * True once init has wired the present form roots. Gates the setContext/reset
   * re-population hooks so they no-op before wiring exists.
   * @type {boolean}
   */
  let wiringInitialised = false;

  // ---------------------------------------------------------------------------
  // Stage 9 — localStorage mirror (Parcel 2)
  // ---------------------------------------------------------------------------

  /** Single flat key; serialised value byte-identical to Stage 8's context.json. */
  const MIRROR_STORAGE_KEY = "mathpix-context-current";

  /**
   * Companion stamp the session restorer writes to record which document the
   * mirror belongs to, used only for re-open scoping. The manager never reads or
   * writes its value and only clears it here (in reset), so file identity stays
   * out of the manager. The session restorer declares the same literal locally,
   * since the two IIFEs share no import.
   */
  const MIRROR_SOURCE_KEY = "mathpix-context-current-source";

  /**
   * Debounce delay for the mirror write, in milliseconds. Module-local by design:
   * NOT a mathpix-config.js key, and NOT a reuse of the restorer's auto-save
   * timer or PERSISTENCE_CONFIG.AUTO_SAVE_DEBOUNCE_MS.
   */
  const MIRROR_DEBOUNCE_MS = 1000;

  /** Pending debounced mirror-write handle; null when idle. Cancelled by reset(). */
  let pendingMirrorTimer = null;

  /**
   * Stage 9 (Q3): set true at the TOP of every state mutator. Gates hydrate-on-
   * load — hydrate applies the stored context only while this is false (a clean
   * load where nothing wrote first). A restore or boundary that lands during the
   * awaited config fetch sets it, and hydrate then stands down. Latch, NOT call-
   * order: correct for every ordering, not just the hung-fetch one.
   */
  let stateWrittenSinceLoad = false;

  /** Cancel any pending debounced mirror write (Q2 HARDEN: reset cancels first). */
  function cancelPendingMirrorWrite() {
    if (pendingMirrorTimer !== null) {
      clearTimeout(pendingMirrorTimer);
      pendingMirrorTimer = null;
    }
  }

  /**
   * Debounced write of the current context to localStorage. Source-blind: the
   * caller (updateField or setContext) does not signal whether the change is a
   * user edit or a restore. Never throws — a quota or serialisation failure
   * logs ERROR and is swallowed.
   */
  function scheduleMirrorWrite() {
    cancelPendingMirrorWrite();
    pendingMirrorTimer = setTimeout(function () {
      pendingMirrorTimer = null;
      try {
        localStorage.setItem(MIRROR_STORAGE_KEY, JSON.stringify(getContext()));
      } catch (error) {
        logError("Context mirror write failed.", error);
      }
    }, MIRROR_DEBOUNCE_MS);
  }

  /**
   * Stage 9 (Q3): one-shot hydrate from the localStorage mirror at load. Stands
   * down if anything has written state since load (the latch). Otherwise reads
   * the key and classifies it with the Stage 8 trichotomy — absent → DEBUG;
   * malformed JSON or non-plain-object → ignored + WARN, never throws — then
   * merges valid string values into state via an internal merge, NOT setContext,
   * so it neither sets the latch nor echoes a mirror write. Called once inside
   * initialiseWiring, between the config await and the first values-fill.
   * @returns {void}
   */
  function hydrateFromStorage() {
    if (stateWrittenSinceLoad) {
      logDebug("Hydrate stood down: state already written since load.");
      return;
    }
    let stored;
    try {
      stored = localStorage.getItem(MIRROR_STORAGE_KEY);
    } catch (error) {
      logWarn("Context hydrate read failed.", error);
      return;
    }
    if (stored === null) {
      logDebug("No stored context to hydrate.");
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      logWarn("Stored context is malformed JSON; ignoring.", error);
      return;
    }
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      logWarn("Stored context is not a plain object; ignoring.");
      return;
    }
    for (const key of Object.keys(parsed)) {
      if (!KNOWN_KEYS.has(key)) {
        continue;
      }
      const value = parsed[key];
      if (typeof value !== "string") {
        continue;
      }
      context[key] = value;
    }
    logInfo("Context hydrated from localStorage.");
  }

  /**
   * OPTIONS FILL — append one <option> per Audience schema entry to the
   * audienceLevel select within `root`, AFTER its hand-written empty option.
   * Creating these config-driven <option> elements is the sanctioned exception
   * to the no-markup-in-JS rule (config-/data-driven content), scoped to this
   * one select. The empty option is never removed; the documentType select is
   * markup-owned and deliberately untouched.
   * @param {Element} root
   * @returns {void}
   */
  function fillAudienceOptions(root) {
    const select = root.querySelector('[data-context-key="audienceLevel"]');
    if (!select) {
      logDebug(
        `No audienceLevel control in "#${root.id}"; skipping options fill.`,
      );
      return;
    }
    const audienceField = SCHEMA.find((field) => field.key === "audienceLevel");
    const options = (audienceField && audienceField.options) || [];
    for (const option of options) {
      const optionEl = document.createElement("option");
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      select.appendChild(optionEl);
    }
    logDebug(`Filled ${options.length} Audience options into "#${root.id}".`);
  }

  /**
   * VALUES FILL — set every schema-keyed control in `root` to the current
   * context value. Covers text, select and textarea uniformly; a select whose
   * context value is "" lands on the hand-written empty option.
   * @param {Element} root
   * @returns {void}
   */
  function populateValues(root) {
    for (const field of SCHEMA) {
      const control = root.querySelector(`[data-context-key="${field.key}"]`);
      if (!control) continue;
      control.value = context[field.key];
    }
  }

  /**
   * INPUT WIRING — one "input" listener per schema-keyed control in `root`,
   * routing each edit into updateField. No DOM write-back here.
   * @param {Element} root
   * @returns {void}
   */
  function bindInputs(root) {
    const controls = root.querySelectorAll("[data-context-key]");
    for (const control of controls) {
      const key = control.dataset.contextKey;
      control.addEventListener("input", function () {
        updateField(key, control.value);
      });
    }
  }

  /**
   * Re-populate VALUES into every present wired root. Called by setContext and
   * reset per the § 3 view-update contract; no-ops until wiring has initialised.
   * @returns {void}
   */
  function repopulateAllRoots() {
    if (!wiringInitialised) return;
    for (const rootId of FORM_ROOT_IDS) {
      const root = document.getElementById(rootId);
      if (!root) continue;
      populateValues(root);
    }
  }

  /**
   * One-time wiring init. Awaits the internal ready promise so the Audience
   * options are the config projection in the normal case (the seeded fallback
   * when degraded) — the dropdown can never be empty. Then, for each present
   * root: options-fill → values-fill → input-wire. A missing root (e.g. a
   * harness page) is logged at DEBUG and skipped — never thrown.
   * @returns {Promise<void>}
   */
  async function initialiseWiring() {
    await readyPromise;

    // Stage 9 (Q3): hydrate from the localStorage mirror BEFORE the first values-
    // fill, but only if nothing has written state since load (latch unset). A
    // restore or boundary that landed during the awaited fetch wins.
    hydrateFromStorage();

    for (const rootId of FORM_ROOT_IDS) {
      const root = document.getElementById(rootId);
      if (!root) {
        logDebug(`Form root "#${rootId}" absent; skipping wiring for it.`);
        continue;
      }
      fillAudienceOptions(root);
      populateValues(root);
      bindInputs(root);
      logInfo(`Context form "#${rootId}" wired.`);
    }
    wiringInitialised = true;
  }

  /** Kick off wiring, surfacing any unexpected failure at ERROR (never throws
   *  to the page). */
  function startWiring() {
    initialiseWiring().catch((error) => {
      logError("Context form wiring failed to initialise.", error);
    });
  }

  // Standard readyState / DOMContentLoaded guard.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWiring);
  } else {
    startWiring();
  }

  return {
    getContext,
    setContext,
    updateField,
    reset,
    getSchema,
    // Deep-frozen. Sole consumer is the runStage7Tests drift-guard (a later
    // parcel), which compares it against the projected config list.
    AUDIENCE_FALLBACK,
  };
})();

// Expose globally (IIFE module pattern, no ES6 import/export).
window.MathPixContextManager = MathPixContextManager;
