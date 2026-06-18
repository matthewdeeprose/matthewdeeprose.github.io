/**
 * @fileoverview Context-AI suite — Phase 2 Stage 1 (Context auto-fill)
 * @module mathpix-context-ai-tests
 * @version 1.0.0
 *
 * @description
 * Console harness for the Context auto-fill feature (Phase 2, Stage 1). This
 * P0 parcel stands up the suite and proves ONLY the base the build relies on,
 * before any feature code exists. It asserts that the dependencies are present
 * and carry the exact contract later parcels lean on:
 *
 *   - window.MathPixContextManager exposes getContext / setContext / getSchema /
 *     updateField / reset, and getSchema() returns the eight canonical keys.
 *   - setContext is SILENT on the dirty channel (it repopulates the form roots
 *     but does NOT dispatch "mathpix:context-edited"); a manual dispatch of that
 *     same event IS observable. updateField — the user-edit path — is the only
 *     dispatcher, and is exercised by later parcels rather than here.
 *   - The data-provider factories createResumeDataProvider /
 *     createUploadDataProvider exist and produce providers exposing
 *     getSourcePDF / getMMDContent / isAvailable.
 *   - window.OpenRouterEmbed is a constructable function (read at call time).
 *
 * Later parcels (P1+) append fixture sections for the pure prompt/parse/coerce
 * logic and the stubbed transport. This file is therefore expected to grow.
 * Section 6 below now exercises MathPixContextAI's pure functions against the
 * P1 fixtures.
 *
 * REGRESSION BASELINE — emitted-check floor: runContextAITests() reports a
 * `total` of 51 checks on a bare page (26 dependency-contract preflight checks
 * in sections 1–5, plus 25 MathPixContextAI fixture assertions in section 6).
 * This is the count of every assert() EMITTED, pass or fail — the eight-key and
 * three-method groups, and the per-fixture assertions, each expand into
 * individual rows, which is why the figure is larger than the visible block
 * count. Treat the emitted total (not a pass count) as the floor so it stays
 * honest as the suite grows: a change to the emitted total means a check was
 * added or removed, whereas a RED on today's code means a contract drifted. On
 * today's code with the feature scripts loaded, all 51 are green.
 *
 * @usage
 * Include after mathpix-context-manager.js, mathpix-ai-data-provider.js and
 * openrouter-embed-core.js in tools.html (PF5 test slot).
 *   - window.runContextAITests()  — run the whole harness
 */

(function () {
  "use strict";

  // =========================================================================
  // LOGGING (IIFE-scoped, suite tracing only)
  // =========================================================================

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
      console.error(`[ContextAITests] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ContextAITests] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ContextAITests] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ContextAITests] ${message}`, ...args);
  }

  // =========================================================================
  // CONTRACT CONSTANTS
  // =========================================================================

  /** The eight canonical schema keys, in declaration order (Q1 schema). */
  const EXPECTED_SCHEMA_KEYS = [
    "subjectArea",
    "specificTopic",
    "learningObjective",
    "moduleName",
    "moduleCode",
    "audienceLevel",
    "documentType",
    "extraInformation",
  ];

  /** The dirty-channel event setContext must NOT fire but updateField must. */
  const DIRTY_EVENT = "mathpix:context-edited";

  /** The three provider methods later parcels read through. */
  const PROVIDER_METHODS = ["getSourcePDF", "getMMDContent", "isAvailable"];

  // =========================================================================
  // SECTION 6 FIXTURES — MathPixContextAI pure prompt/parse/coerce logic
  //
  // Each fixture is the kind of reply parseResponse/coerceSelects must survive.
  // They are module-scoped constants so the asserts that consume them read as a
  // flat list against named inputs.
  // =========================================================================

  /** (1) Well-formed — every one of the eight blocks present and closed. */
  const FIXTURE_WELL_FORMED = [
    "<subjectArea>Mathematics</subjectArea>",
    "<specificTopic>Integration by parts</specificTopic>",
    "<learningObjective>Apply integration by parts to definite integrals</learningObjective>",
    "<moduleName>Calculus I</moduleName>",
    "<moduleCode>MATH1001</moduleCode>",
    "<audienceLevel>ug1</audienceLevel>",
    "<documentType>worksheet</documentType>",
    "<extraInformation>Includes three worked examples</extraInformation>",
  ].join("\n");

  /** (2) Blocks wrapped in chatty model prose that must be ignored. */
  const FIXTURE_WRAPPED = [
    "Certainly! Here are the values I propose for this document:",
    "",
    "<subjectArea>Physics</subjectArea>",
    "<specificTopic>Kinematics</specificTopic>",
    "<moduleName>PHYS100</moduleName>",
    "",
    "I hope these are helpful — let me know if you need anything else!",
  ].join("\n");

  /** (3) Truncated after the fourth field — moduleName left open, no further <. */
  const FIXTURE_TRUNCATED = [
    "<subjectArea>Chemistry</subjectArea>",
    "<specificTopic>Acid-base titration</specificTopic>",
    "<learningObjective>Calculate concentration from titration data</learningObjective>",
    "<moduleName>Practical Chemistry",
  ].join("\n");

  /** (4) Two fields missing — no learningObjective and no extraInformation block. */
  const FIXTURE_TWO_MISSING = [
    "<subjectArea>Biology</subjectArea>",
    "<specificTopic>Cell division</specificTopic>",
    "<moduleName>Cell Biology</moduleName>",
    "<moduleCode>BIOL2002</moduleCode>",
    "<audienceLevel>ug2</audienceLevel>",
    "<documentType>lecture-notes</documentType>",
  ].join("\n");

  /** (5) Selects given as human labels — must coerce onto canonical values. */
  const FIXTURE_COERCE_LABELS = {
    subjectArea: "Mathematics",
    audienceLevel: "Undergraduate Year 1",
    documentType: "Worksheet",
  };

  /** (6) An audienceLevel that matches no value or label — must coerce to "". */
  const FIXTURE_COERCE_UNMAPPABLE = {
    audienceLevel: "Reception class",
    documentType: "worksheet",
  };

  // =========================================================================
  // RUNNER
  // =========================================================================

  /**
   * Run the Context-AI harness. Self-contained: collects every check into one
   * results object, prints it with console.table, and returns it.
   *
   * @returns {{passed:number, failed:number, total:number, failures:Array<string>, checks:Object}}
   */
  function runContextAITests() {
    logInfo("Starting Context-AI harness");

    const checks = {};
    const failures = [];
    let passed = 0;
    let failed = 0;
    let total = 0;

    /**
     * Record one boolean check. Never throws — a thrown predicate is caught by
     * the caller and recorded as a failure, so one bad check can't abort the
     * run.
     * @param {string} label
     * @param {boolean} condition
     */
    function assert(label, condition) {
      total++;
      const ok = condition === true;
      if (ok) {
        passed++;
      } else {
        failed++;
        failures.push(label);
      }
      checks[label] = ok ? "✅ PASS" : "❌ FAIL";
    }

    // -----------------------------------------------------------------------
    // 1. MathPixContextManager presence + public API
    // -----------------------------------------------------------------------
    const mgr = window.MathPixContextManager;
    assert("1.1 window.MathPixContextManager exists", !!mgr);
    assert(
      "1.2 MathPixContextManager.getContext is a function",
      !!mgr && typeof mgr.getContext === "function",
    );
    assert(
      "1.3 MathPixContextManager.setContext is a function",
      !!mgr && typeof mgr.setContext === "function",
    );
    assert(
      "1.4 MathPixContextManager.getSchema is a function",
      !!mgr && typeof mgr.getSchema === "function",
    );
    assert(
      "1.5 MathPixContextManager.updateField is a function",
      !!mgr && typeof mgr.updateField === "function",
    );
    assert(
      "1.6 MathPixContextManager.reset is a function",
      !!mgr && typeof mgr.reset === "function",
    );

    // -----------------------------------------------------------------------
    // 2. Schema shape — exactly the eight canonical keys
    // -----------------------------------------------------------------------
    let schemaKeys = [];
    try {
      const schema = mgr && mgr.getSchema ? mgr.getSchema() : null;
      schemaKeys = Array.isArray(schema)
        ? schema.map((field) => field && field.key)
        : [];
    } catch (err) {
      logError("getSchema() threw while reading keys", err);
    }
    assert("2.1 getSchema() returns exactly 8 fields", schemaKeys.length === 8);
    for (const key of EXPECTED_SCHEMA_KEYS) {
      assert(`2.2 schema includes key "${key}"`, schemaKeys.includes(key));
    }

    // -----------------------------------------------------------------------
    // 3. Data-provider factories + the three methods each provider exposes
    // -----------------------------------------------------------------------
    const makeResume = window.createResumeDataProvider;
    const makeUpload = window.createUploadDataProvider;
    assert(
      "3.1 window.createResumeDataProvider is a function",
      typeof makeResume === "function",
    );
    assert(
      "3.2 window.createUploadDataProvider is a function",
      typeof makeUpload === "function",
    );

    // Build minimal providers (resume factory needs a getter fn; upload factory
    // needs a truthy controller) and confirm each exposes the three methods.
    let resumeProvider = null;
    let uploadProvider = null;
    try {
      if (typeof makeResume === "function") {
        resumeProvider = makeResume(() => null);
      }
    } catch (err) {
      logError("createResumeDataProvider threw on a minimal getter", err);
    }
    try {
      if (typeof makeUpload === "function") {
        uploadProvider = makeUpload({});
      }
    } catch (err) {
      logError("createUploadDataProvider threw on a minimal controller", err);
    }
    for (const method of PROVIDER_METHODS) {
      assert(
        `3.3 resume provider exposes ${method}()`,
        !!resumeProvider && typeof resumeProvider[method] === "function",
      );
    }
    for (const method of PROVIDER_METHODS) {
      assert(
        `3.4 upload provider exposes ${method}()`,
        !!uploadProvider && typeof uploadProvider[method] === "function",
      );
    }

    // -----------------------------------------------------------------------
    // 4. OpenRouterEmbed is loadable (read at call time, not at script load —
    //    embed core loads later in the page than this suite)
    // -----------------------------------------------------------------------
    assert(
      "4.1 window.OpenRouterEmbed is a function",
      typeof window.OpenRouterEmbed === "function",
    );

    // -----------------------------------------------------------------------
    // 5. Behavioural probe — the dirty-channel contract
    //
    //    setContext repopulates the form roots but must stay SILENT on the
    //    dirty channel; only updateField (the user-edit path) dispatches
    //    "mathpix:context-edited". We prove both halves: setContext does NOT
    //    fire, a manual dispatch DOES. The original subjectArea is captured and
    //    restored so the probe leaves no residue.
    // -----------------------------------------------------------------------
    if (mgr && typeof mgr.setContext === "function") {
      let fired = false;
      const onEdited = function () {
        fired = true;
      };
      let originalSubject = "";
      try {
        originalSubject =
          typeof mgr.getContext === "function"
            ? mgr.getContext().subjectArea || ""
            : "";
      } catch (err) {
        logWarn("Probe: getContext() threw while capturing original", err);
      }

      try {
        document.addEventListener(DIRTY_EVENT, onEdited);

        // Half 1: setContext must be silent on the dirty channel.
        mgr.setContext({ subjectArea: "probe" });
        const firedAfterSetContext = fired;
        assert(
          "5.1 setContext does NOT fire mathpix:context-edited",
          firedAfterSetContext === false,
        );

        // Half 2: a manual dispatch of the same event IS observable.
        document.dispatchEvent(new CustomEvent(DIRTY_EVENT));
        assert(
          "5.2 manual dispatch of mathpix:context-edited IS observed",
          fired === true,
        );
      } catch (err) {
        logError("Behavioural probe threw", err);
        assert("5.1 setContext does NOT fire mathpix:context-edited", false);
        assert("5.2 manual dispatch of mathpix:context-edited IS observed", false);
      } finally {
        document.removeEventListener(DIRTY_EVENT, onEdited);
        // Restore the field so the probe leaves no residue.
        try {
          mgr.setContext({ subjectArea: originalSubject });
        } catch (err) {
          logWarn("Probe: failed to restore subjectArea", err);
        }
      }
    } else {
      assert("5.1 setContext does NOT fire mathpix:context-edited", false);
      assert("5.2 manual dispatch of mathpix:context-edited IS observed", false);
    }

    // -----------------------------------------------------------------------
    // 6. MathPixContextAI — pure prompt/parse/coerce logic against the P1
    //    fixtures. Every helper is wrapped so a missing module or a thrown
    //    predicate degrades to a recorded FAIL rather than aborting the run;
    //    the assert COUNT here is therefore fixed regardless of load state.
    // -----------------------------------------------------------------------
    const ai = window.MathPixContextAI;

    let schemaForAI = [];
    try {
      schemaForAI = mgr && typeof mgr.getSchema === "function" ? mgr.getSchema() : [];
    } catch (err) {
      logError("getSchema() threw while preparing the AI fixtures", err);
    }

    function aiParse(text) {
      try {
        return ai && typeof ai.parseResponse === "function"
          ? ai.parseResponse(text, schemaForAI)
          : {};
      } catch (err) {
        logError("parseResponse threw on a fixture", err);
        return {};
      }
    }
    function aiCoerce(obj) {
      try {
        return ai && typeof ai.coerceSelects === "function"
          ? ai.coerceSelects(obj, schemaForAI)
          : {};
      } catch (err) {
        logError("coerceSelects threw on a fixture", err);
        return {};
      }
    }

    // Presence + public API.
    assert("6.1 window.MathPixContextAI exists", !!ai);
    assert(
      "6.2 MathPixContextAI.buildPrompt is a function",
      !!ai && typeof ai.buildPrompt === "function",
    );
    assert(
      "6.3 MathPixContextAI.parseResponse is a function",
      !!ai && typeof ai.parseResponse === "function",
    );
    assert(
      "6.4 MathPixContextAI.coerceSelects is a function",
      !!ai && typeof ai.coerceSelects === "function",
    );

    // buildPrompt — shape, MMD folding, and the listed select vocabularies.
    let builtPrompt = { systemPrompt: "", userPrompt: "" };
    const PROMPT_MMD_PROBE = "Sample MMD document about thermodynamics.";
    try {
      if (ai && typeof ai.buildPrompt === "function") {
        builtPrompt = ai.buildPrompt(PROMPT_MMD_PROBE, schemaForAI) || builtPrompt;
      }
    } catch (err) {
      logError("buildPrompt threw on the probe", err);
    }
    assert(
      "6.5 buildPrompt returns non-empty systemPrompt + userPrompt strings",
      typeof builtPrompt.systemPrompt === "string" &&
        builtPrompt.systemPrompt.length > 0 &&
        typeof builtPrompt.userPrompt === "string" &&
        builtPrompt.userPrompt.length > 0,
    );
    assert(
      "6.6 userPrompt folds in the supplied MMD",
      typeof builtPrompt.userPrompt === "string" &&
        builtPrompt.userPrompt.includes(PROMPT_MMD_PROBE),
    );
    assert(
      "6.7 userPrompt lists the restricted select values (ug1 + worksheet)",
      typeof builtPrompt.userPrompt === "string" &&
        builtPrompt.userPrompt.includes("ug1") &&
        builtPrompt.userPrompt.includes("worksheet"),
    );

    // Fixture (1) — well-formed all-eight blocks.
    const f1 = aiParse(FIXTURE_WELL_FORMED);
    assert('6.8 fixture 1: subjectArea === "Mathematics"', f1.subjectArea === "Mathematics");
    assert('6.9 fixture 1: moduleCode === "MATH1001"', f1.moduleCode === "MATH1001");
    assert(
      '6.10 fixture 1: extraInformation === "Includes three worked examples"',
      f1.extraInformation === "Includes three worked examples",
    );
    assert(
      "6.11 fixture 1: all eight keys present as strings",
      EXPECTED_SCHEMA_KEYS.every((key) => typeof f1[key] === "string"),
    );

    // Fixture (2) — blocks wrapped in model prose.
    const f2 = aiParse(FIXTURE_WRAPPED);
    assert('6.12 fixture 2: subjectArea === "Physics"', f2.subjectArea === "Physics");
    assert('6.13 fixture 2: specificTopic === "Kinematics"', f2.specificTopic === "Kinematics");
    assert('6.14 fixture 2: moduleName === "PHYS100" (prose stripped)', f2.moduleName === "PHYS100");
    assert('6.15 fixture 2: absent block moduleCode === ""', f2.moduleCode === "");

    // Fixture (3) — truncated after the fourth field.
    const f3 = aiParse(FIXTURE_TRUNCATED);
    assert(
      "6.16 fixture 3: earlier field learningObjective recovered",
      f3.learningObjective === "Calculate concentration from titration data",
    );
    assert(
      '6.17 fixture 3: truncated field moduleName === "Practical Chemistry"',
      f3.moduleName === "Practical Chemistry",
    );
    assert('6.18 fixture 3: field after truncation moduleCode === ""', f3.moduleCode === "");

    // Fixture (4) — two fields missing.
    const f4 = aiParse(FIXTURE_TWO_MISSING);
    assert('6.19 fixture 4: subjectArea === "Biology"', f4.subjectArea === "Biology");
    assert('6.20 fixture 4: missing learningObjective === ""', f4.learningObjective === "");
    assert('6.21 fixture 4: missing extraInformation === ""', f4.extraInformation === "");

    // Fixture (5) — selects given as labels coerce onto canonical values.
    const f5 = aiCoerce(FIXTURE_COERCE_LABELS);
    assert('6.22 fixture 5: audienceLevel "Undergraduate Year 1" → "ug1"', f5.audienceLevel === "ug1");
    assert('6.23 fixture 5: documentType "Worksheet" → "worksheet"', f5.documentType === "worksheet");
    assert(
      '6.24 fixture 5: non-select subjectArea left untouched',
      f5.subjectArea === "Mathematics",
    );

    // Fixture (6) — an unmappable audienceLevel coerces to "".
    const f6 = aiCoerce(FIXTURE_COERCE_UNMAPPABLE);
    assert('6.25 fixture 6: unmappable audienceLevel → ""', f6.audienceLevel === "");

    // -----------------------------------------------------------------------
    // Report
    // -----------------------------------------------------------------------
    console.table(checks);
    console.log(
      `📊 Context-AI harness: ${passed}/${total} checks passed` +
        (failed === 0 ? " — ALL CLEAR ✅" : ` (${failed} FAILED ❌)`),
    );
    if (failures.length > 0) {
      console.log("Failed checks:");
      for (const f of failures) console.log(`  - ${f}`);
    }

    return { passed, failed, total, failures, checks };
  }

  // =========================================================================
  // GLOBAL EXPOSURE
  // =========================================================================

  window.runContextAITests = runContextAITests;

  logInfo("Context-AI harness loaded");
  console.log("💡 Type runContextAITests() to run the Context-AI preflight");
})();
