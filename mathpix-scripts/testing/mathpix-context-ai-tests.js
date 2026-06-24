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
 * Section 6 exercises MathPixContextAI's pure functions against the P1 fixtures;
 * section 7 (P2) exercises the transport — initEmbed/attachPDF/sendWithTimeout/
 * _bridgeError/_checkPdfSize — against a STUBBED embed (no live AI call).
 * Sections 8–10 are the persistence round-trips: section 8 proves the context
 * ZIP round-trip (setContext → real addContextToArchive → real
 * extractAndRestoreContext); section 9 proves the localStorage autosave mirror
 * (real debounced write → read mathpix-context-current → blank → re-hydrate);
 * section 10 proves the dirty signal (a fill dispatches mathpix:context-edited
 * and the resume restorer's listener is restoredSession-gated). Unlike 1–7,
 * these three need the FULL page loaded — JSZip, the total-downloader and the
 * session restorer must be present — and section 9 plus the settle step each
 * sleep past the manager's ~1 s mirror debounce, so the suite runs a few
 * seconds longer than the bare preflight.
 *
 * REGRESSION BASELINE — emitted-check floor: runContextAITests() reports a
 * `total` of 81 checks (26 dependency-contract preflight checks in sections
 * 1–5, plus 25 MathPixContextAI fixture assertions in section 6, plus 16
 * stubbed-transport assertions in section 7, plus 14 persistence round-trip
 * assertions in sections 8–10 — 5 ZIP round-trip + 5 localStorage autosave + 4
 * dirty-signal). This is the count of every assert() EMITTED, pass or fail — the
 * eight-key and three-method groups, and the per-fixture assertions, each expand
 * into individual rows, which is why the figure is larger than the visible block
 * count. Treat the emitted total (not a pass count) as the floor so it stays
 * honest as the suite grows: a change to the emitted total means a check was
 * added or removed, whereas a RED on today's code means a contract drifted.
 * Sections 8–10 keep a FIXED assert count regardless of load state (a missing
 * dependency degrades to a recorded FAIL, never aborts), so the floor holds. On
 * today's code with the feature scripts loaded on the full page, all 81 are green.
 *
 * NOTE: runContextAITests() is async (the section-7 transport probes await a
 * stubbed sendRequest). It returns a Promise resolving to the results object;
 * the console.table + summary still print when it settles.
 *
 * @usage
 * Include after mathpix-context-manager.js, mathpix-ai-data-provider.js and
 * openrouter-embed-core.js in tools.html (PF5 test slot).
 *   - window.runContextAITests()  — run the whole harness (await or read console)
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
  async function runContextAITests() {
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
    // 7. MathPixContextAI transport — STUBBED embed. No live AI call is made:
    //    the embed is replaced with a stub whose sendRequest behaviour is
    //    injected per probe. We prove the transport ATTACHES then SENDS and
    //    surfaces result.text; that an AbortError becomes the timeout-guidance
    //    message; and that any other failure reaches _bridgeError. _checkPdfSize
    //    is pure and probed directly. Every arm is wrapped so the assert COUNT
    //    here is fixed regardless of load state or embed availability.
    //
    //    NOTE: initEmbed() is NOT exercised here — it constructs a real
    //    OpenRouterEmbed (live client + provider registry) and is covered by the
    //    [MANUAL] small-PDF check instead. Its presence is asserted (7.1) only.
    // -----------------------------------------------------------------------

    /**
     * Build a stub embed. sendRequest delegates to the injected impl, recording
     * that send happened and snapshotting the attach state (currentFile) at send
     * time so "attaches THEN sends" is observable. fileUtils is null so
     * attachPDF() takes its default-analysis branch.
     */
    function makeStubEmbed(sendImpl) {
      return {
        currentFile: null,
        currentFileBase64: null,
        currentFileAnalysis: null,
        fileUtils: null,
        sendCalled: false,
        fileAtSend: null,
        sendRequest(prompt) {
          this.sendCalled = true;
          this.fileAtSend = this.currentFile;
          return sendImpl(prompt);
        },
        cancelRequest() {
          return true;
        },
      };
    }

    // Public-API presence for the transport surface.
    assert(
      "7.1 MathPixContextAI.initEmbed is a function",
      !!ai && typeof ai.initEmbed === "function",
    );
    assert(
      "7.2 MathPixContextAI.attachPDF is a function",
      !!ai && typeof ai.attachPDF === "function",
    );
    assert(
      "7.3 MathPixContextAI.sendWithTimeout is a function",
      !!ai && typeof ai.sendWithTimeout === "function",
    );
    assert(
      "7.4 MathPixContextAI._bridgeError is a function",
      !!ai && typeof ai._bridgeError === "function",
    );
    assert(
      "7.5 MathPixContextAI._checkPdfSize is a function",
      !!ai && typeof ai._checkPdfSize === "function",
    );

    // _checkPdfSize — pure size probe (reads only .size, so a plain object
    // stands in for a Blob). Small → no warning; near-limit → a warning string.
    function aiCheckSize(blobLike) {
      try {
        return ai && typeof ai._checkPdfSize === "function"
          ? ai._checkPdfSize(blobLike)
          : null;
      } catch (err) {
        logError("_checkPdfSize threw on a probe", err);
        return null;
      }
    }
    assert(
      '7.6 _checkPdfSize returns "" for a small (1 MB) PDF',
      aiCheckSize({ size: 1 * 1024 * 1024 }) === "",
    );
    const nearWarning = aiCheckSize({ size: 20 * 1024 * 1024 });
    assert(
      "7.7 _checkPdfSize warns (non-empty string) for a near-limit (20 MB) PDF",
      typeof nearWarning === "string" && nearWarning.length > 0,
    );

    // The three round-trip probes share the stub harness. Each is fully guarded;
    // ai.embed is reset and _bridgeError restored in the finally so no probe
    // leaks state into the next.
    const originalEmbed = ai ? ai.embed : null;
    try {
      // -- Probe A: attaches then sends; resolves with result.text. -----------
      let okText = "";
      let okStub = null;
      try {
        if (ai && typeof ai.attachPDF === "function") {
          okStub = makeStubEmbed(() =>
            Promise.resolve({
              text: "<subjectArea>Maths</subjectArea>\n<documentType>worksheet</documentType>",
            }),
          );
          ai.embed = okStub;
          const pdfBlob = new Blob(["%PDF-1.4 stub content"], {
            type: "application/pdf",
          });
          await ai.attachPDF(pdfBlob);
          okText = await ai.sendWithTimeout("probe user prompt", 60000);
        }
      } catch (err) {
        logError("Transport probe A (attach+send) threw", err);
      }
      assert(
        "7.8 attachPDF sets currentFile on the embed (attach happened)",
        !!okStub && !!okStub.currentFile,
      );
      assert(
        "7.9 attachPDF sets currentFileBase64 on the embed",
        !!okStub &&
          typeof okStub.currentFileBase64 === "string" &&
          okStub.currentFileBase64.length > 0,
      );
      assert(
        "7.10 sendWithTimeout resolves with result.text",
        typeof okText === "string" && okText.includes("<subjectArea>"),
      );
      assert(
        "7.11 send was reached with a file already attached (attaches THEN sends)",
        !!okStub && okStub.sendCalled === true && !!okStub.fileAtSend,
      );
      assert(
        '7.12 the resolved text parses correctly (subjectArea === "Maths")',
        aiParse(okText).subjectArea === "Maths",
      );

      // -- Probe B: AbortError → timeout-guidance message. --------------------
      let timeoutErr = null;
      try {
        if (ai && typeof ai.sendWithTimeout === "function") {
          ai.embed = makeStubEmbed(() =>
            Promise.reject(
              Object.assign(new Error("aborted"), { name: "AbortError" }),
            ),
          );
          await ai.sendWithTimeout("probe user prompt", 60000);
        }
      } catch (err) {
        timeoutErr = err;
      }
      assert(
        "7.13 an AbortError rejection becomes the timeout message",
        !!timeoutErr && /timed out/i.test(timeoutErr.message),
      );
      assert(
        "7.14 the timeout message suggests a smaller document and a faster model",
        !!timeoutErr &&
          /smaller/i.test(timeoutErr.message) &&
          /faster/i.test(timeoutErr.message),
      );

      // -- Probe C: a generic failure reaches _bridgeError, then rejects. -----
      let bridgeReached = false;
      let throwErr = null;
      const savedBridge = ai ? ai._bridgeError : null;
      try {
        if (ai && typeof ai.sendWithTimeout === "function") {
          ai._bridgeError = function () {
            bridgeReached = true;
            return null;
          };
          ai.embed = makeStubEmbed(() => Promise.reject(new Error("boom")));
          await ai.sendWithTimeout("probe user prompt", 60000);
        }
      } catch (err) {
        throwErr = err;
      } finally {
        if (ai && savedBridge) ai._bridgeError = savedBridge;
      }
      assert(
        "7.15 a non-abort failure reaches _bridgeError",
        bridgeReached === true,
      );
      assert(
        '7.16 sendWithTimeout still rejects with the original error ("boom")',
        !!throwErr && throwErr.message === "boom",
      );
    } finally {
      // Leave no residue: restore the embed slot to its pre-probe value.
      if (ai) ai.embed = originalEmbed;
    }

    // =======================================================================
    // SECTIONS 8–10 — CONTEXT PERSISTENCE ROUND-TRIPS (loaded page)
    //
    // Unlike sections 1–7 (pure/stubbed, bare-page runnable), these three arms
    // exercise the real persistence spines and so need the FULL page loaded:
    // section 8 needs JSZip + MathPixTotalDownloader + MathPixSessionRestorer;
    // section 9 lets the manager's REAL debounced mirror write fire (so it
    // sleeps past the debounce); section 10 drives the live resume restorer's
    // document-level dirty listener. All three mutate the manager's context and
    // its localStorage mirror, so we snapshot both up front and a single
    // settle-and-restore at the end leaves the page clean for the [MANUAL]
    // persistence checks. The assert COUNT here is fixed regardless of load
    // state (a missing dependency degrades to a recorded FAIL, never aborts),
    // keeping the emitted-total floor honest.
    // =======================================================================

    /** The mirror key the manager autosaves to (private const there; mirrored). */
    const MIRROR_KEY = "mathpix-context-current";
    /** Mirrors the manager's module-local MIRROR_DEBOUNCE_MS (1000 ms). */
    const MIRROR_DEBOUNCE_MS = 1000;
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

    /**
     * A FULL eight-key fixture with REAL select values (audienceLevel "ug1",
     * documentType "worksheet") so the round-trips exercise the coerced selects,
     * not just the free-text fields.
     */
    const FULL_FIXTURE = {
      subjectArea: "Mathematics",
      specificTopic: "Integration by parts",
      learningObjective: "Apply integration by parts to definite integrals",
      moduleName: "Calculus I",
      moduleCode: "MATH1001",
      audienceLevel: "ug1",
      documentType: "worksheet",
      extraInformation: "Includes three worked examples",
    };

    // Snapshot context + mirror BEFORE any arm mutates them; restored in the
    // settle step after section 10 so the page is left exactly as found.
    const origContext =
      mgr && typeof mgr.getContext === "function" ? mgr.getContext() : {};
    let origMirror = null;
    try {
      origMirror = localStorage.getItem(MIRROR_KEY);
    } catch (err) {
      logWarn("Could not snapshot the context mirror key", err);
    }

    // -----------------------------------------------------------------------
    // 8. ZIP round-trip — setContext → real addContextToArchive → real
    //    extractAndRestoreContext. We do NOT hand-roll a context JSON blob:
    //    extractAndRestoreContext is strict (Stage 8 contract — rejects
    //    malformed or non-object JSON), so a genuine archive built by the real
    //    create-archive spine is what keeps the arm honest. extractAndRestoreContext
    //    reset()s to blank before applying the parsed JSON, so the restored
    //    values genuinely come from the archive, not residual memory.
    // -----------------------------------------------------------------------
    let zipPrereqOk = false;
    let zipBranch = null;
    let zipRestored = {};
    try {
      zipPrereqOk =
        typeof JSZip !== "undefined" &&
        typeof window.MathPixTotalDownloader === "function" &&
        !!window.MathPixSessionRestorer &&
        !!window.MathPixSessionRestorer.prototype &&
        typeof window.MathPixSessionRestorer.prototype
          .extractAndRestoreContext === "function" &&
        !!mgr &&
        typeof mgr.setContext === "function" &&
        typeof mgr.getContext === "function";
      if (zipPrereqOk) {
        // Seed the manager, serialise the live context through the real
        // create-archive helper (this-free by design — driven as a static).
        mgr.setContext(FULL_FIXTURE);
        const zip = new JSZip();
        window.MathPixTotalDownloader.prototype.addContextToArchive.call(
          null,
          zip,
        );
        // Restore through the real restorer step, with a minimal fake `this`
        // carrying only the ZIP handle it reads (its documented test entry).
        const outcome =
          await window.MathPixSessionRestorer.prototype.extractAndRestoreContext.call(
            { restoredSession: { zip } },
          );
        zipBranch = outcome && outcome.branch;
        zipRestored = mgr.getContext();
      }
    } catch (err) {
      logError("ZIP round-trip arm threw", err);
    }
    assert(
      "8.1 ZIP round-trip prerequisites present (JSZip + downloader + restorer)",
      zipPrereqOk === true,
    );
    assert(
      '8.2 extractAndRestoreContext reports branch "valid"',
      zipBranch === "valid",
    );
    assert(
      "8.3 all eight context values survive the ZIP round-trip",
      EXPECTED_SCHEMA_KEYS.every((k) => zipRestored[k] === FULL_FIXTURE[k]),
    );
    assert(
      '8.4 coerced select audienceLevel survives as "ug1"',
      zipRestored.audienceLevel === "ug1",
    );
    assert(
      '8.5 coerced select documentType survives as "worksheet"',
      zipRestored.documentType === "worksheet",
    );

    // -----------------------------------------------------------------------
    // 9. localStorage autosave — fill, let the REAL debounced mirror write
    //    fire, read mathpix-context-current, blank the in-memory context, then
    //    re-hydrate and assert the eight values return.
    //
    //    hydrateFromStorage() is private (not on the manager's public API) AND
    //    latch-gated (it stands down once any state has been written since
    //    load), so it cannot be driven directly here. We therefore prove the
    //    autosave WRITE genuinely (the real scheduleMirrorWrite), then drive the
    //    restore through setContext — the byte-identical merge hydrate performs
    //    for valid string values — after re-seeding the key reset() removed.
    // -----------------------------------------------------------------------
    let autosaveRaw = null;
    let autosaveStored = {};
    let blankedOk = false;
    let rehydrated = {};
    try {
      if (mgr && typeof mgr.setContext === "function") {
        mgr.setContext(FULL_FIXTURE); // schedules the debounced mirror write
        await sleep(MIRROR_DEBOUNCE_MS + 200); // let the REAL autosave fire
        autosaveRaw = localStorage.getItem(MIRROR_KEY);
        autosaveStored = autosaveRaw ? JSON.parse(autosaveRaw) : {};

        // "clear the in-memory context": reset() blanks state AND removes the
        // mirror key (and cancels any pending write).
        mgr.reset();
        const blanked = mgr.getContext();
        blankedOk = EXPECTED_SCHEMA_KEYS.every((k) => blanked[k] === "");

        // Re-seed the key the autosave wrote, then drive hydrate's merge via the
        // public setContext (see note above).
        if (autosaveRaw) localStorage.setItem(MIRROR_KEY, autosaveRaw);
        mgr.setContext(autosaveStored);
        rehydrated = mgr.getContext();
      }
    } catch (err) {
      logError("localStorage autosave arm threw", err);
    }
    assert(
      "9.1 autosave wrote the mathpix-context-current mirror key",
      typeof autosaveRaw === "string" && autosaveRaw.length > 0,
    );
    assert(
      "9.2 autosaved mirror holds all eight values (incl. coerced selects)",
      EXPECTED_SCHEMA_KEYS.every((k) => autosaveStored[k] === FULL_FIXTURE[k]),
    );
    assert("9.3 reset() blanks the in-memory context", blankedOk === true);
    assert(
      "9.4 all eight values return after re-hydrating from the mirror",
      EXPECTED_SCHEMA_KEYS.every((k) => rehydrated[k] === FULL_FIXTURE[k]),
    );
    assert(
      '9.5 coerced select audienceLevel returns as "ug1" after re-hydrate',
      rehydrated.audienceLevel === "ug1",
    );

    // -----------------------------------------------------------------------
    // 10. Dirty signal — a fill dispatches mathpix:context-edited, and the
    //     resume restorer's document-level listener is restoredSession-gated:
    //     it flags edits when a session is present and stays inert when null.
    //     Both legs run against the LIVE singleton restorer; restoredSession,
    //     hasContextEdits and the Download Updated ZIP button are snapshotted
    //     and restored so the page is left clean.
    // -----------------------------------------------------------------------
    const liveRestorer =
      typeof window.getMathPixSessionRestorer === "function"
        ? window.getMathPixSessionRestorer()
        : null;
    const DOWNLOAD_BTN_ID = "resume-download-updated-btn";

    let fillDispatched = false;
    let inertHasEdits = null;
    let inertButtonSurfaced = null;
    let activeHasEdits = null;

    const origRestoredSession = liveRestorer
      ? liveRestorer.restoredSession
      : undefined;
    const origHasContextEdits = liveRestorer
      ? liveRestorer.hasContextEdits
      : undefined;
    const btnExistedBefore = !!document.getElementById(DOWNLOAD_BTN_ID);

    const fillListener = () => {
      fillDispatched = true;
    };
    try {
      if (liveRestorer) {
        // Inert leg: no active session → the resume listener must stand down.
        liveRestorer.restoredSession = null;
        liveRestorer.hasContextEdits = false;

        // A fill — the updateField user-edit path — dispatches the dirty event.
        document.addEventListener(DIRTY_EVENT, fillListener);
        if (mgr && typeof mgr.updateField === "function") {
          mgr.updateField("subjectArea", "dirty-probe-fill");
        }
        inertHasEdits = liveRestorer.hasContextEdits;
        inertButtonSurfaced =
          !!document.getElementById(DOWNLOAD_BTN_ID) && !btnExistedBefore;

        // Active leg: a truthy restoredSession arms the listener.
        liveRestorer.hasContextEdits = false;
        liveRestorer.restoredSession = { zip: null };
        document.dispatchEvent(new CustomEvent(DIRTY_EVENT));
        activeHasEdits = liveRestorer.hasContextEdits;
      }
    } catch (err) {
      logError("dirty-signal arm threw", err);
    } finally {
      document.removeEventListener(DIRTY_EVENT, fillListener);
      if (liveRestorer) {
        liveRestorer.restoredSession = origRestoredSession;
        liveRestorer.hasContextEdits = origHasContextEdits;
        try {
          if (typeof liveRestorer.updateDownloadButtonVisibility === "function") {
            liveRestorer.updateDownloadButtonVisibility();
          }
        } catch (e) {
          logWarn(
            "dirty-signal cleanup: updateDownloadButtonVisibility threw",
            e,
          );
        }
        // Remove any button that surfaced but wasn't present before the arm.
        if (!btnExistedBefore) {
          const stray = document.getElementById(DOWNLOAD_BTN_ID);
          if (stray) stray.remove();
        }
      }
    }
    assert(
      "10.1 a fill (updateField) dispatches mathpix:context-edited",
      fillDispatched === true,
    );
    assert(
      "10.2 resume listener inert when restoredSession is null (no edits flagged)",
      inertHasEdits === false,
    );
    assert(
      "10.3 resume listener inert when null (no Download Updated ZIP button surfaced)",
      inertButtonSurfaced === false,
    );
    assert(
      "10.4 resume listener fires when a session is present (edits flagged)",
      activeHasEdits === true,
    );

    // ── Settle + restore — leave the context, mirror and form clean ─────────
    try {
      if (
        mgr &&
        typeof mgr.reset === "function" &&
        typeof mgr.setContext === "function"
      ) {
        mgr.reset(); // cancels any pending mirror write + clears the key
        mgr.setContext(origContext); // repaint forms to the original context
        await sleep(MIRROR_DEBOUNCE_MS + 200); // let that single write settle
        if (origMirror === null) {
          localStorage.removeItem(MIRROR_KEY);
        } else {
          localStorage.setItem(MIRROR_KEY, origMirror);
        }
      }
    } catch (err) {
      logWarn("Context/mirror restore after sections 8–10 failed", err);
    }

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
